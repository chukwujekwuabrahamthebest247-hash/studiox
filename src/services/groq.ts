import { CodeState, OpenRouterSettings, ResearchFinding } from '../types';
import {
  ZERO_MISTAKE_SYSTEM_PROMPT,
  applySearchReplacePatches,
  parseGeneratedCode,
  LiveModelOption
} from './openrouter';
import { analyzePromptIntent } from './intentParser';
import { CodebaseFile, buildCodebaseContextForPrompt, getCodebaseStats } from './codebaseVault';
import {
  PRINCIPAL_ENGINEER_CHAT_PROMPT,
  isPayloadOverflowError,
  verifyAndRepairGeneratedCode
} from './aiEngine';

export const DEFAULT_GROQ_MODEL = 'llama-3.3-70b-versatile';

export const DEFAULT_GROQ_MODELS: LiveModelOption[] = [
  { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B Versatile', badge: '128k' },
  { id: 'qwen-2.5-coder-32b', name: 'Qwen-2.5-Coder-32B', badge: 'Coding · 128k' },
  { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B Instant', badge: '128k' },
  { id: 'meta-llama/llama-4-scout-17b-16e-instruct', name: 'Llama 4 Scout 17B Vision', badge: '128k' },
  { id: 'meta-llama/llama-4-maverick-17b-128e-instruct', name: 'Llama 4 Maverick 17B', badge: '128k' },
  { id: 'qwen/qwen3-32b', name: 'Qwen 3 32B', badge: '128k' },
  { id: 'openai/gpt-oss-120b', name: 'GPT OSS 120B', badge: '128k' },
  { id: 'custom', name: 'Custom Model ID...', badge: 'Manual' }
];

export function resolveGroqModelId(settings: OpenRouterSettings): string {
  if (settings.groqModel === 'custom' && settings.groqCustomModel?.trim()) {
    return settings.groqCustomModel.trim();
  }
  return settings.groqModel?.trim() || DEFAULT_GROQ_MODEL;
}

function isNonChatGroqModel(modelId: string): boolean {
  const lower = modelId.toLowerCase();
  return (
    lower.includes('whisper') ||
    lower.includes('tts') ||
    lower.includes('guard') ||
    lower.includes('playai') ||
    lower.includes('orpheus') ||
    lower.includes('distil-whisper')
  );
}

function supportsGroqVision(modelId: string): boolean {
  const lower = modelId.toLowerCase();
  return (
    lower.includes('vision') ||
    lower.includes('llama-4') ||
    lower.includes('scout') ||
    lower.includes('maverick')
  );
}

export async function fetchLiveGroqModels(apiKey: string): Promise<LiveModelOption[]> {
  if (!apiKey.trim()) {
    throw new Error('Groq API key is required to load live models.');
  }

  const res = await fetch('https://api.groq.com/openai/v1/models', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey.trim()}`,
      'Content-Type': 'application/json'
    }
  });

  if (!res.ok) {
    let errorDetail = '';
    try {
      const errJson = await res.json();
      errorDetail = errJson.error?.message || JSON.stringify(errJson);
    } catch {
      errorDetail = await res.text();
    }
    throw new Error(`Groq Models Error (${res.status}): ${errorDetail || 'Failed to load models'}`);
  }

  const data = await res.json();
  const list: any[] = Array.isArray(data?.data) ? data.data : [];

  const mapped: LiveModelOption[] = list
    .filter((m) => m && typeof m.id === 'string' && m.active !== false && !isNonChatGroqModel(m.id))
    .sort((a, b) => {
      if (a.id === DEFAULT_GROQ_MODEL) return -1;
      if (b.id === DEFAULT_GROQ_MODEL) return 1;
      return a.id.localeCompare(b.id);
    })
    .map((m) => ({
      id: m.id,
      name: m.owned_by ? `${m.id} (${m.owned_by})` : m.id,
      badge: m.context_window ? `${Math.round(m.context_window / 1000)}k` : 'Live',
      contextWindow: m.context_window
    }));

  if (!mapped.some((m) => m.id === 'qwen-2.5-coder-32b')) {
    mapped.unshift({
      id: 'qwen-2.5-coder-32b',
      name: 'Qwen-2.5-Coder-32B (Alibaba Cloud)',
      badge: 'Coding · 128k',
      contextWindow: 131072
    });
  }

  mapped.push({ id: 'custom', name: 'Custom Model ID...', badge: 'Manual' });
  return mapped;
}

export async function testGroqKey(apiKey: string): Promise<LiveModelOption[]> {
  const models = await fetchLiveGroqModels(apiKey);
  if (models.length <= 1) {
    throw new Error('Groq key verified, but no active chat models were returned.');
  }
  return models;
}

export async function generateCodeWithGroq(
  prompt: string,
  settings: OpenRouterSettings,
  onProgress?: (status: string) => void,
  researchContext?: ResearchFinding | null,
  existingCode?: CodeState,
  image?: string | null,
  promptControllerConfig?: import('../types').PromptControllerConfig,
  explicitTargetFile: import('../types').TargetFileScope = 'all',
  explicitResearchMode: 'with-research' | 'without-research' | 'auto' = 'auto',
  uploadedFile?: import('../types').UploadedFilePayload,
  codebaseFiles?: CodebaseFile[]
): Promise<CodeState> {
  const groqKey = settings.groqApiKey?.trim();
  if (!groqKey) {
    throw new Error('Groq API key is required. Add your Groq key in Settings -> Groq Fallback AI.');
  }

  const intent = analyzePromptIntent(prompt, explicitTargetFile, explicitResearchMode);
  const vaultFiles = codebaseFiles && codebaseFiles.length > 0 ? codebaseFiles : [];

  let effectiveCode = existingCode ? { ...existingCode } : { html: '', css: '', js: '' };
  if (uploadedFile && uploadedFile.content) {
    if (uploadedFile.name.endsWith('.html') || uploadedFile.type === 'html') {
      effectiveCode.html = uploadedFile.content;
    } else if (uploadedFile.name.endsWith('.css') || uploadedFile.type === 'css') {
      effectiveCode.css = uploadedFile.content;
    } else if (uploadedFile.name.endsWith('.js') || uploadedFile.name.endsWith('.ts') || uploadedFile.type === 'js') {
      effectiveCode.js = uploadedFile.content;
    }
  } else if (vaultFiles.length > 0) {
    const htmlEntry = vaultFiles.find((f) => /(?:^|\/)index\.html$/i.test(f.path)) || vaultFiles.find((f) => f.ext === 'html');
    const cssEntry = vaultFiles.find((f) => /(?:style|styles|main|index)\.css$/i.test(f.path)) || vaultFiles.find((f) => f.ext === 'css');
    const jsEntry = vaultFiles.find((f) => /(?:app|main|script|index)\.js$/i.test(f.path));
    if (htmlEntry && htmlEntry.content.length <= 120000) effectiveCode.html = htmlEntry.content;
    if (cssEntry && cssEntry.content.length <= 120000) effectiveCode.css = cssEntry.content;
    if (jsEntry && jsEntry.content.length <= 120000) effectiveCode.js = jsEntry.content;
  }

  const modelId = resolveGroqModelId(settings);
  const isVisionActive = Boolean(image);
  const canSendImageToGroq = isVisionActive && supportsGroqVision(modelId);
  const vaultStats = getCodebaseStats(vaultFiles);

  onProgress?.(
    vaultFiles.length > 0
      ? `Groq (${modelId}): Indexing ${vaultStats.totalFiles} file(s) (${vaultStats.totalLines.toLocaleString()} lines)...`
      : uploadedFile
      ? `Groq Engine (${modelId}): Targeting "${uploadedFile.name}" for surgical edit...`
      : `Connecting to Groq (${modelId})...`
  );

  const isSingleFileSurgical = Boolean(uploadedFile && vaultFiles.length <= 1);
  const isEditingApp = (intent.isEdit || intent.targetFile !== 'all' || isSingleFileSurgical) && vaultFiles.length <= 1;
  const targetPartDescription = uploadedFile?.targetPart || intent.targetPart || '';
  const isSurgical = uploadedFile?.surgicalLock || intent.surgicalOnly || Boolean(targetPartDescription);

  const buildPayloadForBudget = async (charBudget: number): Promise<any> => {
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

Build the complete, fully working, responsive runnable web application in \`\`\`html, \`\`\`css, and \`\`\`js blocks implementing 100% of the requested features.`;
    } else if (isEditingApp && effectiveCode) {
      const safeFileContent =
        uploadedFile && uploadedFile.content.length > charBudget
          ? buildCodebaseContextForPrompt(
              [{
                id: uploadedFile.name,
                path: uploadedFile.name,
                name: uploadedFile.name,
                content: uploadedFile.content,
                lines: uploadedFile.lineCount || uploadedFile.content.split('\n').length,
                chars: uploadedFile.content.length,
                bytes: uploadedFile.sizeBytes || uploadedFile.content.length,
                ext: uploadedFile.name.split('.').pop() || 'txt',
                symbols: []
              }],
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

${isVisionActive && !canSendImageToGroq ? '[NOTE: A UI mockup image was attached, fulfill the described visual & functional edits cleanly.]' : ''}

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
${isVisionActive && canSendImageToGroq ? 'CRITICAL VISION DIRECTIVE: An image/screenshot/mockup of the target user interface is attached. Replicate the visual layout, color theme, typography, components, and controls shown in the image with pixel-level precision, and write complete functional JavaScript for all interactive controls.' : ''}`;
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

    if (canSendImageToGroq && image) {
      return [
        { type: 'text', text: userTextContent },
        { type: 'image_url', image_url: { url: image } }
      ];
    }
    return userTextContent;
  };

  onProgress?.(`Groq (${modelId}): Engineering application code...`);

  const activeTemperature = promptControllerConfig?.temperatureOverride ?? settings.temperature ?? 0.7;

  const systemPrompt = isEditingApp
    ? `You are StudioX Surgical Code Editor. Identify which file (index.html for markup/labels, styles.css for colors/spacing/typography/layout, app.js for behavior/calculations/state, or the uploaded file) owns the responsibility and apply minimal, exact edits meeting 100% of the user's specification.
CRITICAL RULES:
1. Prefix each patch block with \`FILE: <filename>\` followed by \`<<<<<<< SEARCH\` / \`=======\` / \`>>>>>>> REPLACE\`.
2. NEVER rewrite unrelated lines or files. NEVER convert React/TSX/JS/CSS into a different format.
3. Every SEARCH block must match the exact existing lines verbatim.`
    : ZERO_MISTAKE_SYSTEM_PROMPT;

  const budgets = [120000, 48000, 18000];
  let content = '';
  let lastError: Error = new Error('Groq request failed');

  for (let attempt = 0; attempt < budgets.length; attempt++) {
    const userMessagePayload = await buildPayloadForBudget(budgets[attempt]);
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${groqKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: modelId,
        temperature: activeTemperature,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessagePayload }
        ]
      })
    });

    if (response.ok) {
      const data = await response.json();
      content = data.choices?.[0]?.message?.content || '';
      break;
    }

    let errorDetail = '';
    try {
      const errJson = await response.json();
      errorDetail = errJson.error?.message || JSON.stringify(errJson);
    } catch {
      errorDetail = await response.text();
    }
    lastError = new Error(`Groq Error (${response.status}): ${errorDetail || 'Request failed'}`);

    if (isPayloadOverflowError(errorDetail) && attempt < budgets.length - 1) {
      onProgress?.(`Groq payload limit reached — compacting codebase slice (${budgets[attempt + 1].toLocaleString()} chars)...`);
      continue;
    }
    if ((response.status === 429 || response.status >= 500) && attempt < budgets.length - 1) {
      await new Promise((r) => setTimeout(r, 1400 * (attempt + 1)));
      continue;
    }
    throw lastError;
  }

  if (!content.trim()) {
    throw lastError;
  }

  onProgress?.('Verifying JavaScript syntax and compiling Groq output...');

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

export async function chatWithGroq(params: {
  apiKey: string;
  model?: string;
  temperature?: number;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  researchFinding?: ResearchFinding | null;
  systemPrompt?: string;
  signal?: AbortSignal;
}): Promise<string> {
  const groqKey = params.apiKey.trim();
  if (!groqKey) {
    throw new Error('Groq API key is missing.');
  }

  const modelId = params.model?.trim() || DEFAULT_GROQ_MODEL;
  const basePrompt = params.systemPrompt || PRINCIPAL_ENGINEER_CHAT_PROMPT;

  const systemPrompt = `${basePrompt}${
    params.researchFinding
      ? `\n\n[WEB RESEARCH CONTEXT]\nQuery: ${params.researchFinding.query}\nSummary: ${params.researchFinding.summary}\nSources:\n${params.researchFinding.results
          .map((s) => `- ${s.title} (${s.url}): ${s.snippet}`)
          .join('\n')}`
      : ''
  }`;

  const apiMessages = [
    { role: 'system', content: systemPrompt },
    ...params.messages.slice(-12).map((m) => ({
      role: m.role,
      content: m.content
    }))
  ];

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    signal: params.signal,
    headers: {
      Authorization: `Bearer ${groqKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: modelId,
      temperature: params.temperature ?? 0.7,
      messages: apiMessages
    })
  });

  if (!response.ok) {
    let errorDetail = '';
    try {
      const errJson = await response.json();
      errorDetail = errJson.error?.message || JSON.stringify(errJson);
    } catch {
      errorDetail = await response.text();
    }
    throw new Error(`Groq Error (${response.status}): ${errorDetail || 'Request failed'}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || 'No response received from Groq.';
}
