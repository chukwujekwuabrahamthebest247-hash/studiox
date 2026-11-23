import { CodeState, OpenRouterSettings, ResearchFinding } from '../types';
import { chatWithGroq, resolveGroqModelId } from './groq';
import {
  CodebaseFile,
  buildCodebaseContextForPrompt,
  buildResponsibilityMapText,
  buildTargetedSurgicalContext,
  getCodebaseStats,
  partitionCodebaseForDeepRead,
  rankResponsibleFiles
} from './codebaseVault';
import {
  applySurgicalPatchesToVault,
  verifyVaultCompilation,
  VaultCompilationError
} from './codebaseCompiler';

export function getProviderCharBudget(settings: OpenRouterSettings): number {
  return settings.useGemini !== false || (settings.useOpenRouter && settings.apiKey?.trim())
    ? 240000
    : 120000;
}

export function hasCloudAIConfigured(settings: OpenRouterSettings): boolean {
  return (
    settings.useGemini !== false ||
    Boolean(settings.useOpenRouter && settings.apiKey?.trim()) ||
    (Boolean(settings.groqApiKey?.trim()) && settings.useGroqFallback !== false)
  );
}

const BACKUP_GROQ_MODELS = [
  'llama-3.3-70b-versatile',
  'qwen-2.5-coder-32b',
  'llama-3.1-8b-instant'
];

export type ChatCodebaseIntent = 'compile-exact' | 'surgical-edit' | 'chat-qa' | 'build-new';

export function classifyChatCodebaseIntent(
  userPrompt: string,
  codebaseFiles: CodebaseFile[]
): ChatCodebaseIntent {
  const prompt = userPrompt.trim();
  const strippedNegations = prompt
    .replace(
      /\b(?:without|don'?t|do\s+not|never|no)\s+(?:making\s+)?(?:any\s+)?(?:edit(?:ing|s)?|chang(?:e|ing|es)|modif(?:y|ying|ications?)|updat(?:e|ing)|alter(?:ing)?|touch(?:ing)?)\b/gi,
      ''
    )
    .toLowerCase();

  const hasCompileOrReplicateVerb =
    /\b(compile|replicate|copy|duplicate|clone|run|render|preview|execute|bundle|launch|display|as[- ]is|verbatim|exact\s+copy|replicate\s+everything|compile\s+everything|compile\s+the\s+(?:file|files|zip|code|project)|compile\s+them|show\s+(?:me\s+)?(?:the\s+)?(?:app|preview)|open\s+(?:the\s+)?preview)\b/i.test(
      prompt
    );

  const hasExplicitActionWithEdit =
    /\b(?:and|then|please|also)\s+(?:edit|change|modify|update|fix|replace|add|remove|delete|restyle|recolor|refactor|compile|make|set|move|hide|show|format|validate)\b/i.test(
      strippedNegations
    );

  const hasEditVerb =
    /\b(edit|change|modify|update|fix|replace|add|remove|delete|insert|refactor|restyle|recolor|adjust|tweak|rename|convert|upgrade|improve|redesign|patch|swap|move|hide|show|display|enable|disable|increase|decrease|enlarge|shrink|center|align|format|validate|style|highlight|animate|sort|filter|split|combine|wrap|unwrap|make\s+(?:the|it|sure)|set\s+(?:the|it)|turn\s+(?:the|it)|switch\s+(?:the|it)|use\s+[^\n]{1,40}\s+(?:instead|for\s+the)|i\s+want\s+(?:the|it|this|you\s+to|to\s+(?:change|modify|update|edit|fix|add|remove)))\b/i.test(
      strippedNegations
    );

  const hasNewScratchBuildVerb =
    /\b(build\s+(?:me\s+)?a\s+new|create\s+(?:me\s+)?a\s+new|from\s+scratch|generate\s+a\s+new)\b/i.test(
      prompt
    );

  const isPureExplanationQuestion =
    /^(?:what|why|how|where|who|which|when|explain|describe|summarize|list|audit|review|inspect|tell\s+me|can\s+you\s+explain|could\s+you\s+explain|does\s+this|is\s+there)\b/i.test(
      prompt
    ) &&
    !hasExplicitActionWithEdit &&
    !hasEditVerb &&
    !hasCompileOrReplicateVerb;

  const hasQuestionIntent =
    isPureExplanationQuestion ||
    (/\?$/.test(prompt) && !hasCompileOrReplicateVerb && !hasEditVerb);

  if (codebaseFiles.length > 0) {
    if (hasNewScratchBuildVerb && !/\b(this|these|uploaded|file|files|zip|project|codebase|above)\b/i.test(prompt)) {
      return 'build-new';
    }

    if (isPureExplanationQuestion) {
      return 'chat-qa';
    }

    if (hasEditVerb) {
      return 'surgical-edit';
    }

    if (hasCompileOrReplicateVerb) {
      return 'compile-exact';
    }

    if (hasQuestionIntent) {
      return 'chat-qa';
    }

    return 'chat-qa';
  }

  // No uploaded files in vault:
  const hasAppBuildIntent =
    /\b(build|create|make|design|develop|code|generate|write|clone|implement)\b[\s\S]{0,60}\b(app|website|web\s*app|page|site|dashboard|tool|calculator|game|timer|tracker|form|component|ui|interface|portfolio|landing|chart|editor|chat|player|store|shop|quiz|todo|kanban)\b/i.test(
      prompt
    ) ||
    /\b(html|css|javascript|react|tailwind)\b/i.test(prompt);

  if (hasAppBuildIntent && !hasQuestionIntent) {
    return 'build-new';
  }

  return hasQuestionIntent ? 'chat-qa' : 'build-new';
}

export const PRINCIPAL_ENGINEER_CHAT_PROMPT = `You are a Principal Full-Stack Software Engineer and UI/UX Architect inside StudioX.
Operate with the rigor, craft, and precision of a senior engineer:
1. FOLLOW USER INSTRUCTIONS STRICTLY: Do ONLY what the user asks. Do not ignore explicit constraints or output unrelated code.
2. COMPLETE PRODUCTION CODE: Never write '// ... rest of code', '// TODO', stubs, or truncated handlers. Write every single line completely.
3. RUNNABLE LIVE PREVIEWS FOR APPS & UI: Whenever the user asks you to build or create an app, website, dashboard, tool, calculator, or game, output complete, self-contained runnable code in \`\`\`html, \`\`\`css, and \`\`\`js markdown code blocks so StudioX renders it live beside the chat.
4. SURGICAL PRECISION ON EXISTING CODE: Respect existing architecture, naming, and features unless asked to change them.
5. POLISHED VISUAL CRAFT: Use clean typography, generous spacing, high-contrast accessible palettes, responsive CSS Grid/Flexbox, crisp inline SVGs, and localStorage persistence where state belongs.`;

export const CHAT_QA_SYSTEM_PROMPT = `You are a Principal Software Engineer inside StudioX AI Chat.
Answer the user's question directly, accurately, and concisely.
- When uploaded codebase files are provided, inspect and cite exact file paths, line behavior, and symbol names without inventing anything that is not there.
- Do NOT rewrite their files or generate an unsolicited full web app unless the user explicitly asks you to build or edit code.`;

export const SURGICAL_EDIT_SYSTEM_PROMPT = `You are a Principal Full-Stack Engineer and Precision Surgical Code Editor inside StudioX.
The user uploaded a codebase / project and described a change they want made. You have ALREADY received the FULL, un-truncated contents of the identified primary responsible file(s) along with linked caller/dependency files.

PRECISION & RESPONSIBILITY PROTOCOL:
1. MODIFY ONLY WHAT IS NEEDED: Edit ONLY the responsible file(s) and exact lines needed to fulfill 100% of the user's specification cleanly, accurately, and to their exact standard. If changing a shared prop, type, CSS class/variable, or exported signature, patch BOTH the owning file and its linked caller/stylesheet so compilation stays 100% intact.
2. ZERO UNINTENDED CHANGES: Leave 100% of unrelated files and untouched lines completely verbatim. Never refactor, shorten, or omit untouched code.
3. COMPLETE PRODUCTION CODE: Never write '// ... rest of code', '// TODO', or placeholder stubs.
4. STRUCTURED JSON OUTPUT FORMAT (MANDATORY):
Respond with valid JSON matching this exact schema:
{
  "analysis": "Brief summary of responsible files and changes",
  "edits": [
    {
      "filePath": "exact/path/to/file.ext",
      "search": "exact verbatim lines to replace (include 2-6 surrounding lines for unique matching)",
      "replace": "new replacement lines"
    }
  ],
  "newFiles": [
    {
      "filePath": "optional/new/file.ext",
      "content": "full file content"
    }
  ]
}
- Omit "newFiles" (or pass []) if no new file is needed.
- Every "search" string MUST be copied verbatim from the provided file contents.
- Output ONLY valid JSON (or wrap in a single \`\`\`json code block) with properly escaped strings.`;

export function sleepWithAbort(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

function isRetryableError(statusOrMsg: number | string): boolean {
  if (typeof statusOrMsg === 'number') {
    return statusOrMsg === 429 || statusOrMsg === 408 || statusOrMsg >= 500;
  }
  const lower = String(statusOrMsg).toLowerCase();
  return (
    lower.includes('429') ||
    lower.includes('rate limit') ||
    lower.includes('rate_limit') ||
    lower.includes('too many requests') ||
    lower.includes('temporarily') ||
    lower.includes('timeout') ||
    lower.includes('overloaded') ||
    lower.includes('502') ||
    lower.includes('503') ||
    lower.includes('504') ||
    lower.includes('500') ||
    lower.includes('failed to fetch') ||
    lower.includes('network')
  );
}

export function isPayloadOverflowError(errMsg: string): boolean {
  const lower = errMsg.toLowerCase();
  return (
    lower.includes('413') ||
    lower.includes('too large') ||
    lower.includes('context_length') ||
    lower.includes('context length') ||
    lower.includes('maximum context') ||
    lower.includes('token limit') ||
    lower.includes('tokens per minute') ||
    lower.includes('tpm') ||
    lower.includes('request too large')
  );
}

export function hasUnclosedCodeFence(text: string): boolean {
  const fences = text.match(/```/g);
  return Boolean(fences && fences.length % 2 !== 0);
}

function compactChatHistory(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  maxTotalChars = 16000
): Array<{ role: 'user' | 'assistant'; content: string }> {
  if (messages.length === 0) return [];
  const last = messages[messages.length - 1];
  const earlier = messages.slice(-5, -1);

  const trimmedLast =
    last.content.length > maxTotalChars
      ? `${last.content.slice(0, Math.floor(maxTotalChars * 0.7))}\n\n[...middle context compacted to fit model token limit...]\n\n${last.content.slice(-Math.floor(maxTotalChars * 0.25))}`
      : last.content;

  let remaining = Math.max(0, maxTotalChars - trimmedLast.length);
  const keptEarlier: Array<{ role: 'user' | 'assistant'; content: string }> = [];

  for (let i = earlier.length - 1; i >= 0; i--) {
    const m = earlier[i];
    const clipped = m.content.length > 2500 ? `${m.content.slice(0, 2500)}\n...[trimmed]` : m.content;
    if (clipped.length <= remaining) {
      keptEarlier.unshift({ role: m.role, content: clipped });
      remaining -= clipped.length;
    }
  }

  return [...keptEarlier, { role: last.role, content: trimmedLast }];
}

async function callGeminiRaw(params: {
  model: string;
  temperature: number;
  systemPrompt: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  onStatus?: (status: string) => void;
  signal?: AbortSignal;
}): Promise<string> {
  const { model, temperature, systemPrompt, onStatus, signal } = params;
  let activeMessages = params.messages;
  const maxAttempts = 3;
  let lastError: Error = new Error('Google Gemini request failed');

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    try {
      onStatus?.(
        attempt === 1
          ? `Engineering response via Google Gemini (${model})...`
          : `Retrying Google Gemini (${attempt}/${maxAttempts})...`
      );

      const response = await fetch('/api/gemini/chat', {
        method: 'POST',
        signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          temperature,
          systemPrompt,
          messages: activeMessages
        })
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const errText = data?.error || `HTTP ${response.status}`;
        const err = new Error(`Google Gemini Error (${response.status}): ${errText}`);
        if (isPayloadOverflowError(errText) && attempt < maxAttempts) {
          const compactTarget = attempt === 1 ? 100000 : 36000;
          onStatus?.(`Context exceeded provider limit — gracefully compacting to ${compactTarget.toLocaleString()} chars...`);
          activeMessages = compactChatHistory(activeMessages, compactTarget);
          await sleepWithAbort(600, signal);
          lastError = err;
          continue;
        }
        if (isRetryableError(response.status) && attempt < maxAttempts) {
          const waitMs = attempt * 1800;
          onStatus?.(`Google Gemini busy (${response.status}) — waiting ${(waitMs / 1000).toFixed(1)}s...`);
          await sleepWithAbort(waitMs, signal);
          lastError = err;
          continue;
        }
        throw err;
      }

      const content = data?.text;
      if (!content || !String(content).trim()) {
        throw new Error('Google Gemini returned an empty response.');
      }
      return String(content);
    } catch (err: any) {
      if (err?.name === 'AbortError') throw err;
      lastError = err instanceof Error ? err : new Error(String(err));
      if (isRetryableError(lastError.message) && attempt < maxAttempts) {
        await sleepWithAbort(attempt * 1800, signal);
        continue;
      }
      break;
    }
  }

  throw lastError;
}

async function callOpenRouterRaw(params: {
  apiKey: string;
  model: string;
  temperature: number;
  systemPrompt: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  onStatus?: (status: string) => void;
  signal?: AbortSignal;
}): Promise<string> {
  const { apiKey, model, temperature, systemPrompt, onStatus, signal } = params;
  let activeMessages = params.messages;
  const maxAttempts = 3;
  let lastError: Error = new Error('OpenRouter request failed');

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    try {
      onStatus?.(
        attempt === 1
          ? `Engineering response via OpenRouter (${model.split('/').pop()})...`
          : `Retrying OpenRouter (${attempt}/${maxAttempts})...`
      );

      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        signal,
        headers: {
          Authorization: `Bearer ${apiKey.trim()}`,
          'HTTP-Referer': window.location.origin || 'https://studiox.dev',
          'X-Title': 'StudioX AI Engineer',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model,
          temperature,
          messages: [{ role: 'system', content: systemPrompt }, ...activeMessages]
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        const err = new Error(`OpenRouter Error (${response.status}): ${errText}`);
        if (isPayloadOverflowError(errText) && attempt < maxAttempts) {
          const compactTarget = attempt === 1 ? 100000 : 36000;
          onStatus?.(`Context exceeded provider limit — gracefully compacting to ${compactTarget.toLocaleString()} chars...`);
          activeMessages = compactChatHistory(activeMessages, compactTarget);
          await sleepWithAbort(600, signal);
          lastError = err;
          continue;
        }
        if (isRetryableError(response.status) && attempt < maxAttempts) {
          const retryAfter = Number(response.headers.get('retry-after')) || 0;
          const waitMs = Math.max(retryAfter * 1000, attempt * 1800);
          onStatus?.(`OpenRouter busy (${response.status}) — waiting ${(waitMs / 1000).toFixed(1)}s...`);
          await sleepWithAbort(waitMs, signal);
          lastError = err;
          continue;
        }
        throw err;
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      if (!content || !String(content).trim()) {
        throw new Error('OpenRouter returned an empty response.');
      }
      return String(content);
    } catch (err: any) {
      if (err?.name === 'AbortError') throw err;
      lastError = err instanceof Error ? err : new Error(String(err));
      if (isRetryableError(lastError.message) && attempt < maxAttempts) {
        await sleepWithAbort(attempt * 1800, signal);
        continue;
      }
      break;
    }
  }

  throw lastError;
}

async function callGroqRaw(params: {
  apiKey: string;
  primaryModel: string;
  temperature: number;
  systemPrompt: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  researchFinding?: ResearchFinding | null;
  onStatus?: (status: string) => void;
  signal?: AbortSignal;
}): Promise<string> {
  const { apiKey, primaryModel, temperature, systemPrompt, researchFinding, onStatus, signal } = params;
  let activeMessages = params.messages;
  const candidateModels = Array.from(new Set([primaryModel, ...BACKUP_GROQ_MODELS]));
  let lastError: Error = new Error('Groq request failed');

  for (let mIdx = 0; mIdx < candidateModels.length; mIdx++) {
    const model = candidateModels[mIdx];
    const attemptsForModel = mIdx === 0 ? 2 : 1;

    for (let attempt = 1; attempt <= attemptsForModel; attempt++) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      try {
        onStatus?.(
          mIdx === 0 && attempt === 1
            ? `Engineering response via Groq (${model})...`
            : `Groq retry/failover (${model})...`
        );

        const content = await chatWithGroq({
          apiKey: apiKey.trim(),
          model,
          temperature,
          messages: activeMessages,
          researchFinding,
          systemPrompt,
          signal
        });

        if (!content || !content.trim()) {
          throw new Error('Groq returned an empty response.');
        }
        return content;
      } catch (err: any) {
        if (err?.name === 'AbortError') throw err;
        lastError = err instanceof Error ? err : new Error(String(err));
        if (isPayloadOverflowError(lastError.message)) {
          const compactTarget = attempt === 1 ? 48000 : 18000;
          onStatus?.(`Groq payload limit reached — gracefully compacting to ${compactTarget.toLocaleString()} chars...`);
          activeMessages = compactChatHistory(activeMessages, compactTarget);
        }
        if (isRetryableError(lastError.message) || isPayloadOverflowError(lastError.message)) {
          await sleepWithAbort(1400 * (attempt + mIdx), signal);
          continue;
        }
        break;
      }
    }
  }

  throw lastError;
}

export async function callResilientAI(params: {
  settings: OpenRouterSettings;
  systemPrompt: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  researchFinding?: ResearchFinding | null;
  onStatus?: (status: string) => void;
  signal?: AbortSignal;
}): Promise<string> {
  const { settings, systemPrompt, messages, researchFinding, onStatus, signal } = params;
  const useGemini = settings.useGemini !== false;
  const geminiModelId =
    settings.geminiModel?.trim() && !settings.geminiModel.includes('/')
      ? settings.geminiModel.trim()
      : 'gemini-4-hydrogen';
  const hasOpenRouter = Boolean(settings.useOpenRouter && settings.apiKey?.trim());
  const hasGroq = Boolean(settings.groqApiKey?.trim()) && settings.useGroqFallback !== false;
  const groqModelId = resolveGroqModelId(settings);
  const openRouterModelId =
    settings.model === 'custom' && settings.customModel?.trim()
      ? settings.customModel.trim()
      : settings.model || 'nvidia/nemotron-3.5-super-vl:free';

  const researchContextBlock = researchFinding
    ? `\n\n[WEB RESEARCH CONTEXT]\nQuery: ${researchFinding.query}\nSummary: ${researchFinding.summary}\nSources:\n${researchFinding.results
        .slice(0, 5)
        .map((s) => `- ${s.title} (${s.url}): ${s.snippet.slice(0, 350)}`)
        .join('\n')}`
    : '';

  const fullSystemPrompt = `${systemPrompt}${researchContextBlock}`;

  if (useGemini) {
    try {
      return await callGeminiRaw({
        model: geminiModelId,
        temperature: settings.temperature ?? 0.7,
        systemPrompt: fullSystemPrompt,
        messages,
        onStatus,
        signal
      });
    } catch (geminiErr: any) {
      if (geminiErr?.name === 'AbortError') throw geminiErr;
      if (hasOpenRouter) {
        onStatus?.(`Google Gemini busy — switching to OpenRouter (${openRouterModelId.split('/').pop()})...`);
        return await callOpenRouterRaw({
          apiKey: settings.apiKey,
          model: openRouterModelId,
          temperature: settings.temperature ?? 0.7,
          systemPrompt: fullSystemPrompt,
          messages,
          onStatus,
          signal
        });
      }
      if (hasGroq) {
        onStatus?.(`Google Gemini busy — switching to Groq (${groqModelId})...`);
        return await callGroqRaw({
          apiKey: settings.groqApiKey!,
          primaryModel: groqModelId,
          temperature: settings.temperature ?? 0.7,
          systemPrompt,
          messages,
          researchFinding,
          onStatus,
          signal
        });
      }
      throw geminiErr;
    }
  }

  if (hasOpenRouter) {
    try {
      return await callOpenRouterRaw({
        apiKey: settings.apiKey,
        model: openRouterModelId,
        temperature: settings.temperature ?? 0.7,
        systemPrompt: fullSystemPrompt,
        messages,
        onStatus,
        signal
      });
    } catch (openRouterErr: any) {
      if (openRouterErr?.name === 'AbortError') throw openRouterErr;
      if (hasGroq) {
        onStatus?.(`OpenRouter busy — switching seamlessly to Groq (${groqModelId})...`);
        return await callGroqRaw({
          apiKey: settings.groqApiKey!,
          primaryModel: groqModelId,
          temperature: settings.temperature ?? 0.7,
          systemPrompt,
          messages,
          researchFinding,
          onStatus,
          signal
        });
      }
      throw openRouterErr;
    }
  }

  if (hasGroq) {
    try {
      return await callGroqRaw({
        apiKey: settings.groqApiKey!,
        primaryModel: groqModelId,
        temperature: settings.temperature ?? 0.7,
        systemPrompt,
        messages,
        researchFinding,
        onStatus,
        signal
      });
    } catch (groqErr: any) {
      if (groqErr?.name === 'AbortError') throw groqErr;
      if (settings.apiKey?.trim()) {
        onStatus?.(`Groq busy — switching seamlessly to OpenRouter (${openRouterModelId.split('/').pop()})...`);
        return await callOpenRouterRaw({
          apiKey: settings.apiKey,
          model: openRouterModelId,
          temperature: settings.temperature ?? 0.7,
          systemPrompt: fullSystemPrompt,
          messages,
          onStatus,
          signal
        });
      }
      throw groqErr;
    }
  }

  return researchFinding
    ? `### Research Summary\n${researchFinding.summary}\n\n**Note:** Enable Google Gemini or add an OpenRouter/Groq API key in **Settings** to enable full AI engineering & code generation.`
    : `Enable **Google Gemini** or add an **OpenRouter / Groq API Key** in **Settings** to unlock full AI engineering responses and live app building.`;
}

/**
 * High-capacity single-flow AI Chat engineer:
 * - Reads massive uploaded codebases (hundreds of thousands of chars) by indexing + deep-reading if huge
 * - Produces complete, verified responses & runnable apps in one seamless response
 * - Auto-continues cut-off markdown code fences cleanly.
 */
export async function runPrincipalAIChat(params: {
  settings: OpenRouterSettings;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  userPrompt: string;
  codebaseFiles?: CodebaseFile[];
  researchFinding?: ResearchFinding | null;
  mode?: 'build' | 'qa';
  onStatus?: (status: string) => void;
  signal?: AbortSignal;
}): Promise<string> {
  const { settings, messages, userPrompt, codebaseFiles = [], researchFinding, mode = 'build', onStatus, signal } = params;

  const stats = getCodebaseStats(codebaseFiles);
  let codebaseContext = '';
  let deepReadSummary = '';

  if (codebaseFiles.length > 0) {
    const budget = getProviderCharBudget(settings);

    const wantsGlobalSweep =
      stats.totalChars > budget * 1.4 &&
      /\b(all|entire|whole|every|full|audit|review|refactor|migrate|convert|analyze|understand|codebase|project|repo|architecture|find|bug|fix|build|upgrade)\b/i.test(
        userPrompt
      );

    if (wantsGlobalSweep) {
      const slices = partitionCodebaseForDeepRead(codebaseFiles, 40000).slice(0, 6);
      if (slices.length > 1) {
        const notes: string[] = [];
        for (let s = 0; s < slices.length; s++) {
          if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
          onStatus?.(`Reading uploaded codebase section ${s + 1}/${slices.length} (${stats.totalLines.toLocaleString()} lines indexed)...`);
          try {
            const sliceNote = await callResilientAI({
              settings,
              systemPrompt:
                'You are a Principal Code Reviewer extracting exact symbols, architecture, data structures, bugs, UI components, and dependencies relevant to the user goal. Be concise, technical, and cite exact file names and symbols.',
              messages: [
                {
                  role: 'user',
                  content: `User Goal: ${userPrompt}\n\nExtract key architecture, symbols, state flow, and anything needed for this goal from this codebase section:\n\n${slices[s].content}`
                }
              ],
              signal
            });
            notes.push(`[Section ${s + 1}: ${slices[s].files.map((f) => f.path).join(', ')}]\n${sliceNote.slice(0, 1800)}`);
          } catch (sliceErr: any) {
            if (sliceErr?.name === 'AbortError') throw sliceErr;
          }
        }
        if (notes.length > 0) {
          deepReadSummary = `\n\n[CROSS-CODEBASE ARCHITECTURAL DIGEST (${stats.totalFiles} files, ${stats.totalLines.toLocaleString()} lines)]:\n${notes.join('\n\n')}`;
        }
      }
    }

    onStatus?.(`Indexing ${stats.totalFiles} uploaded file(s) (${stats.totalChars.toLocaleString()} chars)...`);
    const assembled = buildCodebaseContextForPrompt(codebaseFiles, userPrompt, budget);
    codebaseContext = `\n\n${assembled.contextText}${deepReadSummary}`;
  }

  const systemPrompt = mode === 'qa' ? CHAT_QA_SYSTEM_PROMPT : PRINCIPAL_ENGINEER_CHAT_PROMPT;

  const finalMessages = messages.map((m, idx) =>
    idx === messages.length - 1 && codebaseContext
      ? { ...m, content: `${m.content}${codebaseContext}` }
      : m
  );

  let reply = await callResilientAI({
    settings,
    systemPrompt,
    messages: finalMessages,
    researchFinding,
    onStatus,
    signal
  });

  if (mode === 'build' && !signal?.aborted && hasUnclosedCodeFence(reply)) {
    onStatus?.('Completing generated code blocks...');
    try {
      const completed = await callResilientAI({
        settings,
        systemPrompt,
        messages: [
          ...finalMessages.slice(-2),
          { role: 'assistant', content: reply },
          {
            role: 'user',
            content:
              'Your previous response stopped with an unclosed code block. Output ONLY the clean continuation or complete fixed code blocks so every fence is properly closed and 100% runnable.'
          }
        ],
        researchFinding,
        onStatus,
        signal
      });
      if (completed && completed.trim().length > 20) {
        if (hasUnclosedCodeFence(completed) || completed.includes('```html') || completed.includes('```js')) {
          reply = completed.includes('```html') ? completed : `${reply}\n${completed}`;
        } else {
          reply = `${reply}\n${completed}`;
        }
      }
    } catch (contErr: any) {
      if (contErr?.name === 'AbortError') throw contErr;
    }
    if (hasUnclosedCodeFence(reply)) {
      reply = `${reply}\n\`\`\``;
    }
  }

  return reply;
}

function resolveLocatedPaths(
  rawText: string,
  codebaseFiles: CodebaseFile[]
): string[] {
  const availableLower = new Map<string, string>();
  for (const f of codebaseFiles) {
    availableLower.set(f.path.toLowerCase(), f.path);
  }

  const resolved: string[] = [];
  const pushIfValid = (candidate: string) => {
    const clean = candidate
      .replace(/[`'"*,]/g, '')
      .replace(/\\/g, '/')
      .replace(/^(?:\.\/)+/, '')
      .replace(/^\/+/, '')
      .trim();
    if (!clean) return;
    const direct = availableLower.get(clean.toLowerCase());
    if (direct && !resolved.includes(direct)) {
      resolved.push(direct);
      return;
    }
    const suffixMatch = codebaseFiles.find(
      (f) => f.path.toLowerCase().endsWith(`/${clean.toLowerCase()}`) || f.name.toLowerCase() === clean.toLowerCase()
    );
    if (suffixMatch && !resolved.includes(suffixMatch.path)) {
      resolved.push(suffixMatch.path);
    }
  };

  // Try JSON parsing first: {"files": ["src/..."]} or ["src/..."]
  const jsonMatch = rawText.match(/\{[\s\S]*"files"\s*:\s*\[[\s\S]*?\][\s\S]*\}|\[[\s\S]*?\]/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      const arr = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.files) ? parsed.files : [];
      for (const item of arr) {
        if (typeof item === 'string') pushIfValid(item);
      }
    } catch {}
  }

  // Also scan any mentioned exact paths in the reply
  for (const f of codebaseFiles) {
    if (rawText.includes(f.path) && !resolved.includes(f.path)) {
      resolved.push(f.path);
    }
  }

  return resolved.slice(0, 5);
}

/**
 * Step 1 ("Read First"): Always runs a fast Locator Pass using the full Project Responsibility Map
 * (file paths, roles, exports, imports, importedBy callers, and UI cues) to return the exact 1–5
 * responsible files in JSON {"files": [...], "reason": "..."}.
 */
export async function identifyResponsibleFiles(params: {
  settings: OpenRouterSettings;
  userPrompt: string;
  codebaseFiles: CodebaseFile[];
  budget?: number;
  onStatus?: (status: string) => void;
  signal?: AbortSignal;
}): Promise<string[]> {
  const { settings, userPrompt, codebaseFiles, onStatus, signal } = params;
  if (codebaseFiles.length === 0) return [];
  if (codebaseFiles.length === 1) return [codebaseFiles[0].path];

  const ranked = rankResponsibleFiles(codebaseFiles, userPrompt);
  const heuristicTop = ranked
    .filter((r) => r.score > 0)
    .slice(0, 5)
    .map((r) => r.file.path);

  const hasAI = hasCloudAIConfigured(settings);

  if (!hasAI || signal?.aborted) {
    return heuristicTop.length > 0 ? heuristicTop : ranked.slice(0, 3).map((r) => r.file.path);
  }

  try {
    onStatus?.(`Step 1/2 Locator: Scanning responsibility map across ${codebaseFiles.length} project file(s)...`);
    const responsibilityMap = buildResponsibilityMapText(codebaseFiles, 180);
    const heuristicSummary = ranked
      .slice(0, 8)
      .map((r) => `- ${r.file.path} (score: ${r.score}, signals: ${r.reasons.join(', ') || r.profile.role})`)
      .join('\n');

    const locatorReply = await callResilientAI({
      settings,
      signal,
      systemPrompt: `You are a Principal Codebase Architect running Step 1 (File Locator) of a "Read First, Edit Second" pipeline.
Given the Project Responsibility Map (including exports, UI cues, imports, and importedBy callers) and the user's change request, identify the EXACT 1–5 responsible file(s) needed to implement the change cleanly—including linked stylesheets or parent callers (via importedBy) if props, types, slots, or exports change.
Return ONLY valid JSON in this exact format:
{"files": ["path/1", "path/2"], "reason": "brief explanation of why these files own this change"}`,
      messages: [
        {
          role: 'user',
          content: `[PROJECT RESPONSIBILITY MAP (${codebaseFiles.length} files)]:\n${responsibilityMap}\n\n[TOP HEURISTIC CANDIDATES]:\n${heuristicSummary}\n\n[USER CHANGE REQUEST]:\n${userPrompt}\n\nReturn JSON {"files": [...], "reason": "..."} listing the exact 1–5 responsible files.`
        }
      ]
    });

    const llmPaths = resolveLocatedPaths(locatorReply, codebaseFiles);
    if (llmPaths.length > 0) {
      const reasonMatch = locatorReply.match(/"reason"\s*:\s*"([^"]+)"/);
      if (reasonMatch?.[1]) {
        onStatus?.(`Located ${llmPaths.join(', ')} (${reasonMatch[1].slice(0, 90)})`);
      }
      const combined = [...llmPaths];
      for (const h of heuristicTop.slice(0, 2)) {
        if (!combined.includes(h) && combined.length < 5) {
          combined.push(h);
        }
      }
      return combined.slice(0, 5);
    }
  } catch (err: any) {
    if (err?.name === 'AbortError') throw err;
  }

  return heuristicTop.length > 0 ? heuristicTop : ranked.slice(0, 3).map((r) => r.file.path);
}

async function callSurgicalEditWithAdaptiveBudget(params: {
  settings: OpenRouterSettings;
  codebaseFiles: CodebaseFile[];
  responsibleFiles: string[];
  userPrompt: string;
  initialBudget: number;
  researchFinding?: ResearchFinding | null;
  onStatus?: (status: string) => void;
  signal?: AbortSignal;
}): Promise<string> {
  const { settings, codebaseFiles, responsibleFiles, userPrompt, initialBudget, researchFinding, onStatus, signal } = params;
  const budgets = [initialBudget, Math.floor(initialBudget * 0.45), Math.floor(initialBudget * 0.22)];
  let lastErr: any = new Error('Surgical edit AI call failed');

  for (let i = 0; i < budgets.length; i++) {
    const budget = budgets[i];
    const surgicalCtx = buildTargetedSurgicalContext(codebaseFiles, responsibleFiles, userPrompt, budget);

    const editUserMessage = `${surgicalCtx.contextText}

[IDENTIFIED PRIMARY RESPONSIBLE FILES (LOADED 100% UNTRUNCATED)]:
${responsibleFiles.length > 0 ? responsibleFiles.map((p) => `- ${p}`).join('\n') : '- Auto-detect from project files above'}

[USER CHANGE SPECIFICATION & QUALITY STANDARD]:
${userPrompt}

Respond with valid JSON:
{
  "analysis": "Brief summary of responsible files and changes",
  "edits": [
    {
      "filePath": "exact/path/to/file.ext",
      "search": "exact verbatim lines to replace",
      "replace": "new replacement lines"
    }
  ],
  "newFiles": []
}`;

    try {
      return await callResilientAI({
        settings,
        systemPrompt: SURGICAL_EDIT_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: editUserMessage }],
        researchFinding,
        onStatus,
        signal
      });
    } catch (err: any) {
      if (err?.name === 'AbortError') throw err;
      lastErr = err;
      if (isPayloadOverflowError(err?.message || '') && i < budgets.length - 1) {
        onStatus?.(`Payload limit hit — compacting secondary context to ${budgets[i + 1].toLocaleString()} chars...`);
        continue;
      }
      throw err;
    }
  }

  throw lastErr;
}

/**
 * Two-Step "Read First, Edit Second" + Post-Edit Sucrase Compilation Verification & Auto-Repair Loop:
 * 1) Runs Locator Step to pick exact 1–5 responsible files.
 * 2) Loads 100% of full, un-truncated contents of primary target files & requests structured JSON edits.
 * 3) Applies edits with 3-tier whitespace-resilient matching (fallback SEARCH/REPLACE supported).
 * 4) Runs verifyVaultCompilation() across all TS/TSX/JS/JSX/HTML/CSS/JSON files, triggering up to 2 AI auto-repair passes if any file fails.
 */
export async function runSurgicalCodebaseEdit(params: {
  settings: OpenRouterSettings;
  userPrompt: string;
  codebaseFiles: CodebaseFile[];
  researchFinding?: ResearchFinding | null;
  onStatus?: (status: string) => void;
  signal?: AbortSignal;
}): Promise<{
  rawReply: string;
  updatedFiles: CodebaseFile[];
  patchedPaths: string[];
  addedPaths: string[];
  unmatchedBlocks: number;
  responsibleFiles: string[];
  analysis?: string;
  compilationValid: boolean;
  compilationErrors: VaultCompilationError[];
  repairPassesUsed: number;
}> {
  const { settings, userPrompt, codebaseFiles, researchFinding, onStatus, signal } = params;
  const budget = getProviderCharBudget(settings);
  const stats = getCodebaseStats(codebaseFiles);

  // Step 1: Fast Locator Step
  const responsibleFiles = await identifyResponsibleFiles({
    settings,
    userPrompt,
    codebaseFiles,
    budget,
    onStatus,
    signal
  });

  const targetPreview = responsibleFiles.slice(0, 3).join(', ');
  onStatus?.(
    targetPreview
      ? `Step 2/2 Editor: Reading full ${targetPreview} (${stats.totalFiles} indexed) — crafting surgical JSON patch...`
      : `Locating target section in ${stats.totalFiles} file(s)...`
  );

  let rawReply = await callSurgicalEditWithAdaptiveBudget({
    settings,
    codebaseFiles,
    responsibleFiles,
    userPrompt,
    initialBudget: budget,
    researchFinding,
    onStatus,
    signal
  });

  let patchResult = applySurgicalPatchesToVault(codebaseFiles, rawReply);

  // Corrective retry if patches failed to match verbatim
  const needsPatchRetry =
    !signal?.aborted &&
    ((patchResult.patchedPaths.length === 0 && patchResult.addedPaths.length === 0) ||
      patchResult.unmatchedBlocks > 0);

  if (needsPatchRetry) {
    onStatus?.('Aligning surgical edits verbatim against target file contents...');
    try {
      const failedHint =
        patchResult.unmatchedDetails && patchResult.unmatchedDetails.length > 0
          ? `\nFailed search snippet(s):\n${patchResult.unmatchedDetails
              .slice(0, 3)
              .map((d, i) => `${i + 1}) File: ${d.fileHint || 'unknown'}\n\`\`\`\n${d.searchSnippet}\n\`\`\``)
              .join('\n')}`
          : '';

      const baseForRetry =
        patchResult.patchedPaths.length > 0 || patchResult.addedPaths.length > 0
          ? patchResult.updatedFiles
          : codebaseFiles;

      const retryCtx = buildTargetedSurgicalContext(
        baseForRetry,
        responsibleFiles.length > 0 ? responsibleFiles : patchResult.patchedPaths,
        userPrompt,
        budget
      );

      const retryReply = await callResilientAI({
        settings,
        systemPrompt: SURGICAL_EDIT_SYSTEM_PROMPT,
        messages: [
          { role: 'user', content: `${retryCtx.contextText}\n\n[USER CHANGE REQUEST]:\n${userPrompt}` },
          { role: 'assistant', content: rawReply },
          {
            role: 'user',
            content: `${
              patchResult.patchedPaths.length > 0
                ? 'Some edits already applied, while others failed to match verbatim. Output ONLY structured JSON {"analysis": "...", "edits": [...], "newFiles": []} for the remaining/corrected edits'
                : 'Your previous edit could not match verbatim against the target file(s). Output corrected structured JSON {"analysis": "...", "edits": [...], "newFiles": []} copying the EXACT existing lines verbatim from the full file contents shown above'
            }.${failedHint}`
          }
        ],
        researchFinding,
        onStatus,
        signal
      });

      const retryPatch = applySurgicalPatchesToVault(baseForRetry, retryReply);
      if (retryPatch.patchedPaths.length > 0 || retryPatch.addedPaths.length > 0) {
        const mergedPatched = Array.from(new Set([...patchResult.patchedPaths, ...retryPatch.patchedPaths]));
        const mergedAdded = Array.from(new Set([...patchResult.addedPaths, ...retryPatch.addedPaths]));
        rawReply = patchResult.patchedPaths.length > 0 ? `${rawReply}\n\n${retryReply}` : retryReply;
        patchResult = {
          updatedFiles: retryPatch.updatedFiles,
          patchedPaths: mergedPatched,
          addedPaths: mergedAdded,
          unmatchedBlocks: retryPatch.unmatchedBlocks,
          analysis: retryPatch.analysis || patchResult.analysis
        };
      }
    } catch (retryErr: any) {
      if (retryErr?.name === 'AbortError') throw retryErr;
    }
  }

  // Step 4: Post-Edit Sucrase Compilation Verification & Auto-Repair Loop (up to 2 repair passes)
  let verification = verifyVaultCompilation(patchResult.updatedFiles);
  let repairPassesUsed = 0;
  const touchedAny = patchResult.patchedPaths.length > 0 || patchResult.addedPaths.length > 0;

  if (touchedAny && !verification.valid && !signal?.aborted) {
    for (let pass = 1; pass <= 2 && !verification.valid && !signal?.aborted; pass++) {
      repairPassesUsed = pass;
      const errSummary = verification.errors
        .map((e) => `- ${e.filePath}${e.line ? `:${e.line}` : ''}: ${e.message}`)
        .join('\n');
      onStatus?.(`Compilation check caught ${verification.errors.length} syntax error(s) — auto-repair pass ${pass}/2...`);

      const brokenFilePaths = Array.from(new Set(verification.errors.map((e) => e.filePath)));
      const brokenFilesPayload = brokenFilePaths
        .map((fp) => {
          const brokenFile = patchResult.updatedFiles.find((f) => f.path === fp);
          if (!brokenFile) return '';
          return `\n=== BROKEN FILE: ${brokenFile.path} (${brokenFile.lines} lines) ===\n\`\`\`${brokenFile.ext || 'txt'}\n${brokenFile.content}\n\`\`\``;
        })
        .filter(Boolean)
        .join('\n');

      try {
        const repairReply = await callResilientAI({
          settings,
          systemPrompt: SURGICAL_EDIT_SYSTEM_PROMPT,
          messages: [
            {
              role: 'user',
              content: `Post-edit Sucrase compilation verification failed on the following file(s):
${errSummary}

Original user goal:
${userPrompt}

Full content of the broken file(s):
${brokenFilesPayload}

Fix ONLY the syntax/compilation error(s) listed above while preserving all requested changes and untouched code. Return valid structured JSON {"analysis": "...", "edits": [{"filePath": "...", "search": "...", "replace": "..."}], "newFiles": []}.`
            }
          ],
          onStatus,
          signal
        });

        const repairPatch = applySurgicalPatchesToVault(patchResult.updatedFiles, repairReply);
        if (repairPatch.patchedPaths.length > 0 || repairPatch.addedPaths.length > 0) {
          patchResult = {
            updatedFiles: repairPatch.updatedFiles,
            patchedPaths: Array.from(new Set([...patchResult.patchedPaths, ...repairPatch.patchedPaths])),
            addedPaths: Array.from(new Set([...patchResult.addedPaths, ...repairPatch.addedPaths])),
            unmatchedBlocks: repairPatch.unmatchedBlocks,
            analysis: patchResult.analysis || repairPatch.analysis
          };
          verification = verifyVaultCompilation(patchResult.updatedFiles);
        } else {
          break;
        }
      } catch (repairErr: any) {
        if (repairErr?.name === 'AbortError') throw repairErr;
        break;
      }
    }
  }

  const finalPatched = patchResult.patchedPaths;
  const formattedSummaryReply =
    patchResult.analysis && (finalPatched.length > 0 || patchResult.addedPaths.length > 0)
      ? `${patchResult.analysis}\n\nResponsible file(s): ${[...finalPatched, ...patchResult.addedPaths].map((p) => `\`${p}\``).join(', ')}${
          verification.valid
            ? `\nBuild verification: Passed (${verification.checkedFiles} file(s) compiled cleanly${repairPassesUsed > 0 ? ` after ${repairPassesUsed} auto-repair pass(es)` : ''}).`
            : `\nBuild verification warning: ${verification.errors.map((e) => `${e.filePath}${e.line ? `:${e.line}` : ''} — ${e.message}`).join('; ')}`
        }`
      : rawReply;

  return {
    rawReply: formattedSummaryReply,
    updatedFiles: patchResult.updatedFiles,
    patchedPaths: patchResult.patchedPaths,
    addedPaths: patchResult.addedPaths,
    unmatchedBlocks: patchResult.unmatchedBlocks,
    responsibleFiles:
      patchResult.patchedPaths.length > 0 ? patchResult.patchedPaths : responsibleFiles,
    analysis: patchResult.analysis,
    compilationValid: verification.valid,
    compilationErrors: verification.errors,
    repairPassesUsed
  };
}

/**
 * Checks generated JavaScript syntax via Function constructor and returns null if valid,
 * or the exact SyntaxError message if invalid.
 */
export function checkJavaScriptSyntax(jsCode: string): string | null {
  const trimmed = jsCode.trim();
  if (!trimmed) return null;
  try {
    // Support ES syntax minus import/export if any leaked into vanilla js block
    new Function(trimmed);
    return null;
  } catch (err: any) {
    return err?.message || 'JavaScript syntax error';
  }
}

/**
 * Verifies generated HTML/CSS/JS and uses the AI engine for 1 fast self-repair pass
 * if any JavaScript syntax error or broken truncation is detected.
 */
export async function verifyAndRepairGeneratedCode(params: {
  code: CodeState;
  prompt: string;
  settings: OpenRouterSettings;
  onStatus?: (status: string) => void;
  signal?: AbortSignal;
}): Promise<CodeState> {
  let { html, css, js } = params.code;
  const { settings, onStatus, signal } = params;

  // 1. Clean stray markdown fences
  html = html.replace(/```(?:html|xml)?/gi, '').replace(/```/g, '').trim();
  css = css.replace(/```css?/gi, '').replace(/```/g, '').trim();
  js = js.replace(/```(?:javascript|js)?/gi, '').replace(/```/g, '').trim();

  // 2. Balance CSS braces
  const openBraces = (css.match(/\{/g) || []).length;
  const closeBraces = (css.match(/\}/g) || []).length;
  if (openBraces > closeBraces) {
    css += '\n' + '}'.repeat(openBraces - closeBraces);
  }

  // 3. Check JavaScript syntax cleanly
  const jsError = checkJavaScriptSyntax(js);
  const hasAI = hasCloudAIConfigured(settings);

  if (jsError && hasAI && !signal?.aborted) {
    onStatus?.(`Detected JS syntax issue (${jsError}) — auto-repairing like a senior engineer...`);
    try {
      const repairResponse = await callResilientAI({
        settings,
        signal,
        systemPrompt:
          'You are a Principal JavaScript Debugger. Fix the syntax/truncation error in the provided HTML/CSS/JS app and output ONLY valid, complete ```html, ```css, and ```js blocks with zero placeholders.',
        messages: [
          {
            role: 'user',
            content: `User goal: ${params.prompt}\n\nJavaScript SyntaxError detected: ${jsError}\n\nFix this JavaScript (and preserve HTML/CSS) so it parses cleanly with zero syntax errors:\n\`\`\`html\n${html.slice(0, 12000)}\n\`\`\`\n\`\`\`css\n${css.slice(0, 8000)}\n\`\`\`\n\`\`\`js\n${js.slice(0, 14000)}\n\`\`\``
          }
        ]
      });

      const repairedHtml = repairResponse.match(/```(?:html|xml)\s*([\s\S]*?)```/i)?.[1]?.trim();
      const repairedCss = repairResponse.match(/```css\s*([\s\S]*?)```/i)?.[1]?.trim();
      const repairedJs = repairResponse.match(/```(?:javascript|js)\s*([\s\S]*?)```/i)?.[1]?.trim();

      if (repairedJs && !checkJavaScriptSyntax(repairedJs)) {
        html = repairedHtml || html;
        css = repairedCss || css;
        js = repairedJs;
      }
    } catch {
      // Keep original if repair request fails or aborts
    }
  }

  // 4. Add non-intrusive runtime error guard
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
