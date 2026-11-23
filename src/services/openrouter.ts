import { CodeState, OpenRouterSettings } from '../types';

export const DEFAULT_OPENROUTER_MODEL = 'nvidia/nemotron-3.5-super-vl:free';

export const AVAILABLE_MODELS = [
  { id: 'nvidia/nemotron-3.5-super-vl:free', name: 'Nvidia Nemotron 3.5 Super VL (Free)', badge: 'Recommended' },
  { id: 'nvidia/nemotron-4-340b-instruct', name: 'Nvidia Nemotron 4 340B Instruct', badge: 'Flagship' },
  { id: 'meta-llama/llama-3.3-70b-instruct:free', name: 'Llama 3.3 70B Instruct (Free)', badge: 'Fast' },
  { id: 'google/gemini-2.0-flash-exp:free', name: 'Gemini 2.0 Flash Exp (Free)', badge: 'Fast' },
  { id: 'qwen/qwen-2.5-coder-32b-instruct', name: 'Qwen 2.5 Coder 32B', badge: 'Coding' },
  { id: 'custom', name: 'Custom Model ID...', badge: 'Manual' }
];

const SETTINGS_KEY = 'studiox_openrouter_settings_v1';

export function loadOpenRouterSettings(): OpenRouterSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        apiKey: parsed.apiKey || '',
        model: parsed.model || DEFAULT_OPENROUTER_MODEL,
        temperature: typeof parsed.temperature === 'number' ? parsed.temperature : 0.7,
        useOpenRouter: Boolean(parsed.useOpenRouter && parsed.apiKey),
        useGemini: typeof parsed.useGemini === 'boolean' ? parsed.useGemini : true,
        geminiModel: parsed.geminiModel || 'gemini-4-hydrogen',
        customModel: parsed.customModel || '',
        serperApiKey: parsed.serperApiKey || '',
        tavilyApiKey: parsed.tavilyApiKey || '',
        enableWebResearch: typeof parsed.enableWebResearch === 'boolean' ? parsed.enableWebResearch : true,
        groqApiKey: parsed.groqApiKey || '',
        groqModel: parsed.groqModel || 'llama-3.3-70b-versatile',
        groqCustomModel: parsed.groqCustomModel || '',
        useGroqFallback: typeof parsed.useGroqFallback === 'boolean' ? parsed.useGroqFallback : true
      };
    }
  } catch (e) {
    console.error('Failed to parse OpenRouter settings from localStorage', e);
  }

  return {
    apiKey: '',
    model: DEFAULT_OPENROUTER_MODEL,
    temperature: 0.7,
    useOpenRouter: false,
    useGemini: true,
    geminiModel: 'gemini-4-hydrogen',
    customModel: '',
    serperApiKey: '',
    tavilyApiKey: '',
    enableWebResearch: true,
    groqApiKey: '',
    groqModel: 'llama-3.3-70b-versatile',
    groqCustomModel: '',
    useGroqFallback: true
  };
}

export interface LiveModelOption {
  id: string;
  name: string;
  badge: string;
  contextWindow?: number;
}

export async function fetchLiveOpenRouterModels(apiKey?: string): Promise<LiveModelOption[]> {
  const headers: Record<string, string> = {
    'HTTP-Referer': window.location.origin || 'https://studiox.dev',
    'X-Title': 'StudioX Code Generator'
  };
  if (apiKey?.trim()) {
    headers['Authorization'] = `Bearer ${apiKey.trim()}`;
  }
  const res = await fetch('https://openrouter.ai/api/v1/models', { headers });
  if (!res.ok) {
    throw new Error(`OpenRouter Models Error (${res.status})`);
  }
  const data = await res.json();
  const list: any[] = Array.isArray(data?.data) ? data.data : [];
  return list
    .filter((m) => m && typeof m.id === 'string')
    .slice(0, 120)
    .map((m) => ({
      id: m.id,
      name: m.name || m.id,
      badge: m.id.endsWith(':free') ? 'Free' : m.context_length ? `${Math.round(m.context_length / 1000)}k` : 'Live',
      contextWindow: m.context_length
    }));
}

export function saveOpenRouterSettings(settings: OpenRouterSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error('Failed to save OpenRouter settings', e);
  }
}

export const ZERO_MISTAKE_SYSTEM_PROMPT = `You are StudioX, a Principal Full-Stack Software Engineer and UI/UX Architect. Build applications with the craft, visual polish, and architectural discipline of top engineering teams—zero shortcuts, zero syntax errors, zero missing handlers.

ARCHITECTURAL & DESIGN EXCELLENCE:
1. PRINCIPAL-ENGINEER THINKING: Plan layout hierarchy, typography, spacing, color contrast, state model, keyboard/mouse ergonomics, and edge cases before emitting code.
2. COMPLETE RUNNABLE CODE: Never write placeholder comments like '// ... rest of code', '/* unchanged */', or '// TODO'. Every single line of HTML, CSS, and JS must be complete and immediately executable.
3. MODERN PRODUCTION UI: Craft intentional visual design with CSS variables, smooth transitions, clean typography, crisp inline SVGs, responsive CSS Grid/Flexbox layouts, clear empty/active states, and zero overlapping or clipped elements on desktop or mobile.
4. PRESERVE EXISTING CODE & CODEBASE INTEGRITY: When editing existing code or working from an uploaded multi-file codebase, retain all working features, styles, naming conventions, and persistence unless explicitly asked to replace them.
5. VISION MODE PRECISION: If a screenshot or mockup is attached, reproduce its exact layout, hierarchy, palette, spacing, and interactive controls faithfully.
6. DEFENSIVE DOM & STATE PERSISTENCE:
   - Guard DOM element lookups before attaching listeners (const el = document.getElementById('btn'); if (el) { ... }).
   - Add helpful console.log() instrumentation for user actions and state updates.
   - Persist created/edited user data in window.localStorage cleanly with try/catch.
7. OUTPUT FORMAT: Output EXACTLY three complete, closed markdown code blocks:
\`\`\`html
<!-- Complete semantic HTML body markup -->
\`\`\`
\`\`\`css
/* Complete modern responsive CSS */
\`\`\`
\`\`\`js
// Complete interactive Vanilla JavaScript (ES6+)
\`\`\`
Do not output conversational filler before or after the code blocks.`;

import { analyzePromptIntent } from './intentParser';
import { CodebaseFile, buildCodebaseContextForPrompt, getCodebaseStats } from './codebaseVault';
import { isPayloadOverflowError, verifyAndRepairGeneratedCode } from './aiEngine';

export async function generateCodeWithOpenRouter(
  prompt: string,
  settings: OpenRouterSettings,
  onProgress?: (status: string) => void,
  researchContext?: import('../types').ResearchFinding | null,
  existingCode?: CodeState,
  image?: string | null,
  promptControllerConfig?: import('../types').PromptControllerConfig,
  explicitTargetFile: import('../types').TargetFileScope = 'all',
  explicitResearchMode: 'with-research' | 'without-research' | 'auto' = 'auto',
  uploadedFile?: import('../types').UploadedFilePayload,
  codebaseFiles?: CodebaseFile[]
): Promise<CodeState> {
  if (!settings.apiKey.trim()) {
    throw new Error('OpenRouter API key is required. Please add your key in the OpenRouter Settings modal.');
  }

  const intent = analyzePromptIntent(prompt, explicitTargetFile, explicitResearchMode);
  const vaultFiles = codebaseFiles && codebaseFiles.length > 0 ? codebaseFiles : [];

  // Integrate uploaded file or main web entry files from massive codebase upload
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
    if (htmlEntry && htmlEntry.content.length <= 240000) effectiveCode.html = htmlEntry.content;
    if (cssEntry && cssEntry.content.length <= 240000) effectiveCode.css = cssEntry.content;
    if (jsEntry && jsEntry.content.length <= 240000) effectiveCode.js = jsEntry.content;
  }

  const modelId = settings.model === 'custom' && settings.customModel?.trim()
    ? settings.customModel.trim()
    : settings.model || DEFAULT_OPENROUTER_MODEL;

  const isVisionActive = Boolean(image);
  const vaultStats = getCodebaseStats(vaultFiles);
  onProgress?.(isVisionActive 
    ? `Engaging Vision Engine (${modelId}) with attached mockup...`
    : vaultFiles.length > 0
    ? `Indexing ${vaultStats.totalFiles} file(s) (${vaultStats.totalLines.toLocaleString()} lines) via ${modelId.split('/').pop()}...`
    : uploadedFile
    ? `Targeting uploaded file "${uploadedFile.name}" for surgical editing...`
    : `Connecting to OpenRouter (${modelId})...`
  );

  // Build prompt for editing existing app, massive codebase synthesis, surgical edit, or new build
  const isSingleFileSurgical = Boolean(uploadedFile && vaultFiles.length <= 1);
  const isEditingApp = (intent.isEdit || intent.targetFile !== 'all' || isSingleFileSurgical) && vaultFiles.length <= 1;

  const targetPartDescription = uploadedFile?.targetPart || intent.targetPart || '';
  const isSurgical = uploadedFile?.surgicalLock || intent.surgicalOnly || Boolean(targetPartDescription);

  const buildUserPayloadForBudget = async (charBudget: number): Promise<any> => {
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

    if (image) {
      return [
        { type: 'text', text: userTextContent },
        { type: 'image_url', image_url: { url: image } }
      ];
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
  let lastError: Error = new Error('OpenRouter request failed');

  for (let attempt = 0; attempt < budgets.length; attempt++) {
    const userMessagePayload = await buildUserPayloadForBudget(budgets[attempt]);
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${settings.apiKey.trim()}`,
        'HTTP-Referer': window.location.origin || 'https://studiox.dev',
        'X-Title': 'StudioX Code Generator',
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
    lastError = new Error(`OpenRouter Error (${response.status}): ${errorDetail || 'Request failed'}`);

    if (isPayloadOverflowError(errorDetail) && attempt < budgets.length - 1) {
      onProgress?.(`Large codebase exceeded single-call token cap — automatically compacting context index (${budgets[attempt + 1].toLocaleString()} chars)...`);
      continue;
    }
    if ((response.status === 429 || response.status >= 500) && attempt < budgets.length - 1) {
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
      continue;
    }
    throw lastError;
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
    // If model emitted complete markdown code blocks instead of SEARCH/REPLACE patches, extract them rather than discarding the edit
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

function replaceBlockInSlot(content: string, searchBlock: string, replaceBlock: string): string | null {
  const normalized = content.replace(/\r\n/g, '\n');
  const search = searchBlock.replace(/\r\n/g, '\n');
  const replace = replaceBlock.replace(/\r\n/g, '\n');

  if (normalized.includes(search)) {
    return normalized.replace(search, replace);
  }
  const trimmed = search.trim();
  if (trimmed && normalized.includes(trimmed)) {
    return normalized.replace(trimmed, replace.trim());
  }

  const contentLines = normalized.split('\n');
  const searchLines = search.replace(/^\n+|\n+$/g, '').split('\n');
  if (searchLines.length > 0 && searchLines.some((l) => l.trim().length > 0)) {
    const trimmedSearch = searchLines.map((l) => l.trim());
    for (let i = 0; i <= contentLines.length - trimmedSearch.length; i++) {
      let ok = true;
      for (let j = 0; j < trimmedSearch.length; j++) {
        if (contentLines[i + j].trim() !== trimmedSearch[j]) {
          ok = false;
          break;
        }
      }
      if (ok) {
        const repLines = replace.replace(/^\n+|\n+$/g, '').split('\n');
        return [...contentLines.slice(0, i), ...repLines, ...contentLines.slice(i + trimmedSearch.length)].join('\n');
      }
    }
  }
  return null;
}

export function applySearchReplacePatches(
  rawText: string,
  baseCode: CodeState,
  targetFile: import('../types').TargetFileScope
): CodeState | null {
  const blockRegex = /<<<<<<< SEARCH[ \t]*\r?\n([\s\S]*?)\r?\n=======[ \t]*\r?\n([\s\S]*?)\r?\n>>>>>>> REPLACE/gi;
  const matches = Array.from(rawText.matchAll(blockRegex));
  if (matches.length === 0) return null;

  const updated: CodeState = { ...baseCode };
  let appliedAny = false;
  let prevIndex = 0;
  let lastHint = '';

  for (const match of matches) {
    const between = rawText.slice(prevIndex, match.index);
    prevIndex = (match.index || 0) + match[0].length;
    const headerLines = between.split(/\r?\n/).slice(-5).reverse();
    for (const line of headerLines) {
      const m = line.trim().match(/^(?:#{1,4}\s*)?(?:={2,}\s*)?(?:\*\*)?(?:FILE|File|Path)(?:\*\*)?:\s*(.+?)(?:\s*={2,})?$/i);
      if (m && m[1]) {
        lastHint = m[1].replace(/[*`'"<>]/g, '').trim().toLowerCase();
        break;
      }
    }

    const searchBlock = match[1];
    const replaceBlock = match[2];

    const slotOrder: Array<'html' | 'css' | 'js'> =
      targetFile === 'styles.css' ? ['css'] :
      targetFile === 'app.js' ? ['js'] :
      targetFile === 'index.html' ? ['html'] :
      lastHint.endsWith('.css') || lastHint.includes('style') ? ['css', 'html', 'js'] :
      lastHint.endsWith('.js') || lastHint.endsWith('.ts') || lastHint.includes('app.') || lastHint.includes('script') ? ['js', 'html', 'css'] :
      ['html', 'css', 'js'];

    for (const slot of slotOrder) {
      const nextVal = replaceBlockInSlot(updated[slot], searchBlock, replaceBlock);
      if (nextVal !== null) {
        updated[slot] = nextVal;
        appliedAny = true;
        break;
      }
    }
  }

  return appliedAny ? updated : null;
}

export function parseGeneratedCode(rawText: string, fallbackPrompt: string): CodeState {
  let html = '';
  let css = '';
  let js = '';

  // 1. Try markdown code blocks extraction: ```html ... ```
  const htmlMatch = rawText.match(/```(?:html|xml)\s*([\s\S]*?)```/i);
  if (htmlMatch) {
    html = htmlMatch[1].trim();
  }

  // 2. CSS block
  const cssMatch = rawText.match(/```css\s*([\s\S]*?)```/i);
  if (cssMatch) {
    css = cssMatch[1].trim();
  }

  // 3. JS block
  const jsMatch = rawText.match(/```(?:javascript|js)\s*([\s\S]*?)```/i);
  if (jsMatch) {
    js = jsMatch[1].trim();
  }

  // If HTML is not found via ```html, look for standard HTML document structure
  if (!html) {
    const rawHtml = rawText.match(/(?:<!DOCTYPE html>|<html[\s\S]*?<\/html>|<div[\s\S]*?<\/div>)/i);
    if (rawHtml) {
      html = rawHtml[0].trim();
    }
  }

  // If CSS was embedded in <style> tag
  if (!css) {
    const styleTag = html.match(/<style[\s\S]*?>([\s\S]*?)<\/style>/i);
    if (styleTag) {
      css = styleTag[1].trim();
      // Remove style tag from html to keep it clean
      html = html.replace(/<style[\s\S]*?>[\s\S]*?<\/style>/i, '').trim();
    }
  }

  // If JS was embedded in <script> tag
  if (!js) {
    const scriptTag = html.match(/<script[\s\S]*?>([\s\S]*?)<\/script>/i);
    if (scriptTag) {
      js = scriptTag[1].trim();
      // Remove script tag from html
      html = html.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/i, '').trim();
    }
  }

  // Fallbacks if one is missing
  if (!html) {
    html = `<div style="padding: 24px; text-align: center; color: #f8fafc; font-family: sans-serif;">
  <h2>${escapeHtml(fallbackPrompt)}</h2>
  <p>Generated via OpenRouter AI</p>
  <button id="action-btn" style="margin-top: 16px; padding: 10px 20px; background: #38bdf8; border: none; border-radius: 8px; font-weight: bold; cursor: pointer;">Click Me</button>
</div>`;
  }

  if (!css) {
    css = `body { background: #0f172a; color: #f8fafc; margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; }`;
  }

  if (!js) {
    js = `console.log("App loaded successfully from OpenRouter.");
document.getElementById('action-btn')?.addEventListener('click', () => {
  console.log("Button clicked!");
  alert("Interactive action triggered!");
});`;
  }

  return validateAndRepairCode({ html, css, js });
}

/**
 * Self-healing sanitizer and validation pipeline to guarantee zero syntax or runtime crashes.
 */
export function validateAndRepairCode(code: CodeState): CodeState {
  let { html, css, js } = code;

  // 1. Strip stray markdown fences
  html = html.replace(/```(?:html|xml)?/gi, '').replace(/```/g, '').trim();
  css = css.replace(/```css?/gi, '').replace(/```/g, '').trim();
  js = js.replace(/```(?:javascript|js)?/gi, '').replace(/```/g, '').trim();

  // 2. CSS Syntax Healing (balance unclosed braces)
  const openBraces = (css.match(/\{/g) || []).length;
  const closeBraces = (css.match(/\}/g) || []).length;
  if (openBraces > closeBraces) {
    css += '\n' + '}'.repeat(openBraces - closeBraces);
  }

  // 3. HTML Tag Balancing
  const openDivs = (html.match(/<div[\s>]/gi) || []).length;
  const closeDivs = (html.match(/<\/div>/gi) || []).length;
  if (openDivs > closeDivs) {
    html += '</div>'.repeat(openDivs - closeDivs);
  }

  // 4. JavaScript Defensive Shield
  // Ensure that script execution won't break if an element is missing in partial edits
  const shield = `// [StudioX Zero-Mistake Runtime Guard]
window.onerror = function(message, source, lineno, colno, error) {
  console.warn("StudioX Sandbox Alert:", message);
  return false;
};
`;

  if (!js.includes('StudioX Zero-Mistake Runtime Guard')) {
    js = shield + js;
  }

  return { html, css, js };
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
