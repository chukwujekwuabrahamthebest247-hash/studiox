import {
  CodeState,
  OpenRouterSettings,
  PromptControllerConfig,
  ResearchFinding,
  TargetFileScope,
  UploadedFilePayload
} from '../types';
import { CodebaseFile, buildCodebaseContextForPrompt, getCodebaseStats } from './codebaseVault';
import { analyzePromptIntent } from './intentParser';
import {
  ZERO_MISTAKE_SYSTEM_PROMPT,
  applySearchReplacePatches,
  parseGeneratedCode,
  LiveModelOption
} from './openrouter';
import { isPayloadOverflowError, verifyAndRepairGeneratedCode } from './aiEngine';

export const DEFAULT_GEMINI_MODEL = 'gemini-4-hydrogen';

export const GEMINI_MODELS: LiveModelOption[] = [
  { id: 'gemini-4-hydrogen', name: 'Gemini 4 Hydrogen', badge: 'Recommended' },
  { id: 'gemini-3.1-flash-lite', name: 'Gemini 3.1 Flash Lite', badge: 'Fast' }
];

export interface GeminiServerStatus {
  configured: boolean;
  defaultModel: string;
  models: LiveModelOption[];
}

export function resolveGeminiModelId(settings?: OpenRouterSettings): string {
  const m = settings?.geminiModel?.trim();
  if (!m || m.includes('/')) return DEFAULT_GEMINI_MODEL;
  return m;
}

export async function fetchGeminiStatus(): Promise<GeminiServerStatus> {
  const res = await fetch('/api/gemini/status');
  if (!res.ok) {
    throw new Error(`Gemini status check failed (${res.status})`);
  }
  return (await res.json()) as GeminiServerStatus;
}

export async function callGeminiProxy(params: {
  model?: string;
  systemPrompt?: string;
  messages: Array<{
    role: 'user' | 'assistant';
    content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
  }>;
  temperature?: number;
  image?: string | null;
  responseMimeType?: string;
  signal?: AbortSignal;
}): Promise<string> {
  const res = await fetch('/api/gemini/chat', {
    method: 'POST',
    signal: params.signal,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: params.model || DEFAULT_GEMINI_MODEL,
      systemPrompt: params.systemPrompt,
      messages: params.messages,
      temperature: params.temperature,
      image: params.image,
      responseMimeType: params.responseMimeType
    })
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || `Google Gemini Error (${res.status})`);
  }

  const text = String(data?.text || '');
  if (!text.trim()) {
    throw new Error('Google Gemini returned an empty response.');
  }
  return text;
}

export async function generateCodeWithGemini(
  prompt: string,
  settings: OpenRouterSettings,
  onProgress?: (status: string) => void,
  researchContext?: ResearchFinding | null,
  existingCode?: CodeState,
  image?: string | null,
  promptControllerConfig?: PromptControllerConfig,
  explicitTargetFile: TargetFileScope = 'all',
  explicitResearchMode: 'with-research' | 'without-research' | 'auto' = 'auto',
  uploadedFile?: UploadedFilePayload,
  codebaseFiles?: CodebaseFile[]
): Promise<CodeState> {
  const intent = analyzePromptIntent(prompt, explicitTargetFile, explicitResearchMode);
  const vaultFiles = codebaseFiles && codebaseFiles.length > 0 ? codebaseFiles : [];

  const effectiveCode = existingCode ? { ...existingCode } : { html: '', css: '', js: '' };
  if (uploadedFile && uploadedFile.content) {
    if (uploadedFile.name.endsWith('.html') || uploadedFile.type === 'html') {
      effectiveCode.html = uploadedFile.content;
    } else if (uploadedFile.name.endsWith('.css') || uploadedFile.type === 'css') {
      effectiveCode.css = uploadedFile.content;
    } else if (uploadedFile.name.endsWith('.js') || uploadedFile.name.endsWith('.ts') || uploadedFile.type === 'js') {
      effectiveCode.js = uploadedFile.content;
    }
  } else if (vaultFiles.length > 0) {
    const htmlEntry =
      vaultFiles.find((f) => /(?:^|\/)index\.html$/i.test(f.path)) ||
      vaultFiles.find((f) => f.ext === 'html');
    const cssEntry =
      vaultFiles.find((f) => /(?:style|styles|main|index)\.css$/i.test(f.path)) ||
      vaultFiles.find((f) => f.ext === 'css');
    const jsEntry = vaultFiles.find((f) => /(?:app|main|script|index)\.js$/i.test(f.path));
    if (htmlEntry && htmlEntry.content.length <= 240000) effectiveCode.html = htmlEntry.content;
    if (cssEntry && cssEntry.content.length <= 240000) effectiveCode.css = cssEntry.content;
    if (jsEntry && jsEntry.content.length <= 240000) effectiveCode.js = jsEntry.content;
  }

  const modelId = resolveGeminiModelId(settings);
  const isVisionActive = Boolean(image);
  const vaultStats = getCodebaseStats(vaultFiles);

  onProgress?.(
    isVisionActive
      ? `Engaging Google Gemini Vision (${modelId}) with attached mockup...`
      : vaultFiles.length > 0
      ? `Indexing ${vaultStats.totalFiles} file(s) (${vaultStats.totalLines.toLocaleString()} lines) via ${modelId}...`
      : uploadedFile
      ? `Targeting uploaded file "${uploadedFile.name}" via Google Gemini...`
      : `Connecting to Google Gemini (${modelId})...`
  );

  const isSingleFileSurgical = Boolean(uploadedFile && vaultFiles.length <= 1);
  const isEditingApp = (intent.isEdit || intent.targetFile !== 'all' || isSingleFileSurgical) && vaultFiles.length <= 1;

  const targetPartDescription = uploadedFile?.targetPart || intent.targetPart || '';
  const isSurgical = uploadedFile?.surgicalLock || intent.surgicalOnly || Boolean(targetPartDescription);

  const buildUserPayloadForBudget = async (charBudget: number): Promise<string> => {
    let userTextContent = '';

    if (vaultFiles.length > 0 && !isSingleFileSurgical) {
      const assembled = buildCodebaseContextForPrompt(vaultFiles, prompt, charBudget);
      userTextContent = `[BUILD / UPGRADE FROM UPLOADED MULTI-FILE CODEBASE (${assembled.totalFiles} files, ${assembled.totalLines.toLocaleString()} lines, ${assembled.totalChars.toLocaleString()} chars)]
${assembled.contextText}

[CURRENT LIVE SANDBOX CODE (IF APPLICABLE)]:
\`\`\`html
${effectiveCode.html.slice(0, Math.floor(charBudget * 0.12))}
\`\`\`
\`\`\`css
${effectiveCode.css.slice(0, Math.floor(charBudget * 0.08))}
\`\`\`
\`\`\`js
${effectiveCode.js.slice(0, Math.floor(charBudget * 0.12))}
\`\`\`

[USER ENGINEERING REQUEST]:
${prompt}

Build the complete, fully working, responsive runnable web application in \`\`\`html, \`\`\`css, and \`\`\`js blocks implementing 100% of the requested features and integrating cleanly with the uploaded codebase.`;
    } else if (isEditingApp && effectiveCode) {
      const safeFileContent =
        uploadedFile && uploadedFile.content.length > charBudget
          ? buildCodebaseContextForPrompt(
              [
                {
                  id: uploadedFile.name,
                  path: uploadedFile.name,
                  name: uploadedFile.name,
                  content: uploadedFile.content,
                  lines: uploadedFile.lineCount || uploadedFile.content.split('\n').length,
                  chars: uploadedFile.content.length,
                  bytes: uploadedFile.sizeBytes || uploadedFile.content.length,
                  ext: uploadedFile.name.split('.').pop() || 'txt',
                  symbols: []
                }
              ],
              prompt,
              charBudget
            ).contextText
          : uploadedFile?.content || '';

      userTextContent = `[EDITING APPLICATION / TARGETED SURGICAL FILE EDIT]
${intent.targetFile !== 'all' ? `[TARGETED FILE FOCUS: ${intent.targetFile.toUpperCase()}] - Preserve other files unmodified and apply changes specifically to ${intent.targetFile}.` : ''}
${uploadedFile ? `[UPLOADED FILE ATTACHED: "${uploadedFile.name}" (${uploadedFile.lineCount || 'multiple'} lines, ${uploadedFile.content.length.toLocaleString()} chars)]` : ''}
${isSurgical ? `
======================================================================
CRITICAL SURGICAL EDIT PROTOCOL (USER COMMAND: EDIT ONLY THIS PART AND NOTHING ELSE):
The user requested to edit ONLY this specific part: "${targetPartDescription || 'the requested element/logic'}" AND NOTHING ELSE.

STRICT ISOLATION RULES:
1. Locate ONLY the requested part/function/section/rule: "${targetPartDescription || 'requested modification'}".
2. Modify ONLY that exact part to satisfy the user's instructions.
3. LEAVE 100% OF SURROUNDING CODE, ALL OTHER FUNCTIONS, ALL OTHER CSS RULES, ALL OTHER HTML TAGS, EVENT LISTENERS, AND LOGIC COMPLETELY VERBATIM.
4. DO NOT REFACTOR, RENAME, REARRANGE, OR DELETE ANY UNRELATED CODE.
======================================================================` : ''}
${intent.researchMode === 'without-research' ? '[STRICT INSTRUCTION: EXECUTE WITHOUT RESEARCH. Fulfill this edit directly using Vanilla HTML/CSS/JS].' : ''}

${uploadedFile ? `
[UPLOADED FILE CONTENT: ${uploadedFile.name}]
\`\`\`${uploadedFile.name.split('.').pop() || 'txt'}
${safeFileContent}
\`\`\`
` : `
[CURRENT HTML CODE]
\`\`\`html
${effectiveCode.html}
\`\`\`

[CURRENT CSS CODE]
\`\`\`css
${effectiveCode.css}
\`\`\`

[CURRENT JS CODE]
\`\`\`js
${effectiveCode.js}
\`\`\`
`}

[USER INSTRUCTION & MODIFICATION REQUEST]:
${prompt}

${isVisionActive ? 'CRITICAL VISION DIRECTIVE: An image/screenshot of the desired UI or layout is attached. Faithfully adapt the existing code to match the visual styling, cards, controls, and colors shown in the image while maintaining all functional capabilities.' : ''}

Strict Zero-Mistake Instructions:
1. Apply the user's modifications${isSurgical ? ` strictly to the targeted part ("${targetPartDescription || 'specified section'}") and NOTHING ELSE` : ' to the existing code'}.
2. MANDATORY SURGICAL PATCH FORMAT: Output \`<<<<<<< SEARCH\` / \`=======\` / \`>>>>>>> REPLACE\` blocks${uploadedFile ? ` for "${uploadedFile.name}"` : ' preceded by `FILE: index.html`, `FILE: styles.css`, or `FILE: app.js`'}, like this:
${uploadedFile ? `FILE: ${uploadedFile.name}` : 'FILE: styles.css'}
<<<<<<< SEARCH
exact existing lines to change
=======
new replacement lines
>>>>>>> REPLACE
3. NEVER convert a .tsx/.jsx/.ts React file into vanilla HTML/CSS/JS, and NEVER rewrite or reformat untouched lines.`;
    } else {
      userTextContent = `Create this web app: ${prompt}
${intent.researchMode === 'without-research' ? '[STRICT INSTRUCTION: EXECUTE WITHOUT RESEARCH. Build self-contained, clean, zero-mistake code without external research].' : ''}
${isVisionActive ? 'CRITICAL VISION DIRECTIVE: An image/screenshot/mockup of the target user interface is attached. Replicate the visual layout, color theme, typography, components, and controls shown in the image with pixel-level precision, and write complete functional JavaScript for all interactive controls.' : ''}`;
    }

    if (promptControllerConfig) {
      const { buildControllerPromptAddendum } = await import('./promptController');
      const controllerDirectives = buildControllerPromptAddendum(promptControllerConfig);
      userTextContent += `\n\n${controllerDirectives}`;
    }

    const isStrict = promptControllerConfig?.thinkingMode === 'strict';
    if (researchContext && !isStrict) {
      userTextContent += `\n\n[OUTSIDE-THE-BOX WEB RESEARCH GROUNDING - Provider: ${researchContext.provider.toUpperCase()}]
Synthesis Summary: ${researchContext.summary}
Relevant Context & Discoveries:
${researchContext.results.map((r, i) => `${i + 1}. ${r.title}: ${r.snippet}`).join('\n')}

Instructions: Apply these researched concepts and best practices to build a polished, complete, innovative web app.`;
    }

    return userTextContent;
  };

  onProgress?.(isVisionActive ? 'Processing visual elements and synthesizing code...' : 'Engineering complete application architecture...');

  const activeTemperature = promptControllerConfig?.temperatureOverride ?? settings.temperature ?? 0.7;

  const systemPrompt = isEditingApp
    ? `You are StudioX Surgical Code Editor. Identify which file (index.html for markup/labels, styles.css for colors/spacing/typography/layout, app.js for behavior/calculations/state, or the uploaded file) owns the responsibility and apply minimal, exact edits meeting 100% of the user's specification.
CRITICAL RULES:
1. Prefix each patch block with \`FILE: <filename>\` followed by \`<<<<<<< SEARCH\` / \`=======\` / \`>>>>>>> REPLACE\`.
2. NEVER rewrite unrelated lines or files. NEVER convert React/TSX/JS/CSS into a different format.
3. Every SEARCH block must match the exact existing lines verbatim.`
    : ZERO_MISTAKE_SYSTEM_PROMPT;

  const budgets = [240000, 100000, 36000];
  let content = '';
  let lastError: Error = new Error('Google Gemini request failed');

  for (let attempt = 0; attempt < budgets.length; attempt++) {
    const userMessageText = await buildUserPayloadForBudget(budgets[attempt]);
    try {
      content = await callGeminiProxy({
        model: modelId,
        systemPrompt,
        messages: [{ role: 'user', content: userMessageText }],
        temperature: activeTemperature,
        image
      });
      break;
    } catch (err: any) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (isPayloadOverflowError(lastError.message) && attempt < budgets.length - 1) {
        onProgress?.(`Large codebase exceeded single-call token cap — automatically compacting context index (${budgets[attempt + 1].toLocaleString()} chars)...`);
        continue;
      }
      if ((lastError.message.includes('429') || lastError.message.includes('50')) && attempt < budgets.length - 1) {
        await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
        continue;
      }
      throw lastError;
    }
  }

  if (!content.trim()) {
    throw lastError;
  }

  onProgress?.('Verifying JavaScript syntax & compiling live sandbox...');

  if (isEditingApp && effectiveCode) {
    const patched = applySearchReplacePatches(content, effectiveCode, intent.targetFile);
    if (patched) {
      return await verifyAndRepairGeneratedCode({
        code: patched,
        prompt,
        settings,
        onStatus: onProgress
      });
    }
    if (/```(?:html|css|js|javascript)/i.test(content)) {
      const parsedFromEdit = parseGeneratedCode(content, prompt);
      return await verifyAndRepairGeneratedCode({
        code: parsedFromEdit,
        prompt,
        settings,
        onStatus: onProgress
      });
    }
    return effectiveCode;
  }

  const parsed = parseGeneratedCode(content, prompt);
  return await verifyAndRepairGeneratedCode({
    code: parsed,
    prompt,
    settings,
    onStatus: onProgress
  });
}
