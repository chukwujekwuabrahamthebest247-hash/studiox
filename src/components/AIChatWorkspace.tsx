import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Send,
  Globe,
  Code2,
  Copy,
  Check,
  Sparkles,
  Trash2,
  Play,
  Loader2,
  Bot,
  User,
  Search,
  Plus,
  Paperclip,
  X,
  FileText,
  Eye,
  Monitor,
  Smartphone,
  RefreshCw,
  Maximize2,
  Minimize2,
  ClipboardPaste,
  Clipboard,
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
  Layers,
  Square,
  FolderUp,
  Database,
  FileCode,
  Download
} from 'lucide-react';
import { OpenRouterSettings, CodeState, ResearchFinding } from '../types';
import { performTaskResearch } from '../services/research';
import { resolveGroqModelId } from '../services/groq';
import { buildSandboxSrcDoc } from '../services/sandbox';
import {
  classifyChatCodebaseIntent,
  runPrincipalAIChat,
  runSurgicalCodebaseEdit,
  verifyAndRepairGeneratedCode
} from '../services/aiEngine';
import { compileCodebaseFiles } from '../services/codebaseCompiler';
import { downloadProjectZip, downloadSingleFile } from '../services/exporter';
import {
  CodebaseFile,
  createCodebaseFile,
  ingestUploadedFiles,
  mergeCodebaseFiles,
  getCodebaseStats,
  saveCodebaseToVault,
  loadCodebaseFromVault,
  clearCodebaseFromVault,
  exportVaultAsZip
} from '../services/codebaseVault';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  researchUsed?: ResearchFinding | null;
  extractedCode?: Partial<CodeState> | null;
  modifiedFiles?: Array<{ path: string; name: string; content: string }>;
}

interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  updatedAt: string;
}

interface BuiltAppItem {
  id: string;
  sessionId: string;
  sessionTitle: string;
  title: string;
  timestamp: string;
  code: CodeState;
}

const CHAT_SESSIONS_KEY = 'studiox_chat_sessions_v1';
const CHAT_PAD_KEY = 'studiox_chat_pad_v1';
const CHAT_PAD_OPEN_KEY = 'studiox_chat_pad_open_v1';

interface AIChatWorkspaceProps {
  settings: OpenRouterSettings;
  onOpenSettings: (tab?: 'gemini' | 'openrouter' | 'groq' | 'research') => void;
  onLoadCodeInBuilder: (code: CodeState, projectName?: string, vaultFiles?: CodebaseFile[]) => void;
  onActiveAppChange?: (app: { code: CodeState; name: string } | null) => void;
}

function buildReactFallbackHtml(reactCode: string): string {
  const cleaned = reactCode
    .replace(/^\s*import\s+[\s\S]*?from\s+['"][^'"]+['"];?\s*$/gm, '')
    .replace(/^\s*import\s+['"][^'"]+['"];?\s*$/gm, '')
    .replace(/export\s+default\s+function\s+([A-Za-z0-9_]+)/g, 'function $1')
    .replace(/export\s+default\s+class\s+([A-Za-z0-9_]+)/g, 'class $1')
    .replace(/export\s+default\s+([A-Za-z0-9_]+)\s*;?/g, 'window.__StudioXRoot = $1;')
    .replace(/^\s*export\s+(?=(?:const|let|var|function|class)\s)/gm, '');

  const fnMatch = cleaned.match(/function\s+([A-Z][A-Za-z0-9_]*)\s*\(/) ||
    cleaned.match(/(?:const|let)\s+([A-Z][A-Za-z0-9_]*)\s*=/);
  const componentName = fnMatch ? fnMatch[1] : 'App';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>React App Preview</title>
  <script src="https://unpkg.com/react@18/umd/react.production.min.js" crossorigin></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js" crossorigin></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-slate-950 text-slate-100 min-h-screen">
  <div id="root"></div>
  <script type="text/babel" data-presets="react,typescript">
    const { useState, useEffect, useRef, useMemo, useCallback, useReducer, useContext, createContext, Fragment } = React;
    ${cleaned}
    const __RootComponent = window.__StudioXRoot || (typeof ${componentName} !== 'undefined' ? ${componentName} : (typeof App !== 'undefined' ? App : null));
    if (__RootComponent) {
      ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(__RootComponent));
    } else {
      document.getElementById('root').innerHTML = '<div style="padding:24px;font-family:sans-serif;color:#cbd5e1;">Component rendered. Open in App Builder or ask AI Chat for HTML/CSS/JS if a custom component name was used.</div>';
    }
  </script>
</body>
</html>`;
}

export function extractCodeFromMarkdown(text: string): CodeState | null {
  if (!text) return null;

  const htmlParts: string[] = [];
  const cssParts: string[] = [];
  const jsParts: string[] = [];
  const reactParts: string[] = [];

  const fenceRegex = /```([a-zA-Z0-9_-]*)[ \t]*(?:\r?\n|\s)([\s\S]*?)```/g;
  let match: RegExpExecArray | null;

  while ((match = fenceRegex.exec(text)) !== null) {
    const lang = (match[1] || '').toLowerCase();
    const body = (match[2] || '').trim();
    if (!body) continue;

    if (lang === 'html' || lang === 'htm' || lang === 'xml' || lang === 'svg') {
      htmlParts.push(body);
    } else if (lang === 'css' || lang === 'scss') {
      cssParts.push(body);
    } else if (lang === 'js' || lang === 'javascript' || lang === 'mjs') {
      jsParts.push(body);
    } else if (lang === 'jsx' || lang === 'tsx' || lang === 'react') {
      reactParts.push(body);
    } else if (!lang && (/<!DOCTYPE\s+html/i.test(body) || /<html[\s>]/i.test(body) || /<(?:div|main|section|form|canvas|table|header|body)[\s>]/i.test(body))) {
      htmlParts.push(body);
    }
  }

  let html = htmlParts.join('\n').trim();
  let css = cssParts.join('\n\n').trim();
  let js = jsParts.join('\n\n').trim();

  // Fallback for raw HTML outside markdown fences
  if (!html) {
    const rawHtmlMatch = text.match(/(<!DOCTYPE\s+html[\s\S]*?<\/html>|<html[\s\S]*?<\/html>)/i);
    if (rawHtmlMatch) {
      html = rawHtmlMatch[1].trim();
    }
  }

  // Extract inline <style> into css when css slot is empty (preserving clean separation)
  if (html && !css) {
    const styleMatch = html.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
    if (styleMatch) {
      css = styleMatch[1].trim();
      html = html.replace(/<style[^>]*>[\s\S]*?<\/style>/i, '').trim();
    }
  }

  // Extract inline <script> (only inline scripts without src=) into js when js slot is empty
  if (html && !js) {
    const scriptMatch = html.match(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/i);
    if (scriptMatch && scriptMatch[1].trim()) {
      js = scriptMatch[1].trim();
      html = html.replace(/<script(?![^>]*\bsrc=)[^>]*>[\s\S]*?<\/script>/i, '').trim();
    }
  }

  // Fallback for standalone React JSX/TSX apps when no HTML block was provided
  if (!html && reactParts.length > 0) {
    html = buildReactFallbackHtml(reactParts.join('\n\n'));
  }

  const hasDomJs = Boolean(js && /(?:document\.|createElement|getElementById|querySelector|canvas|getContext|innerHTML)/i.test(js));
  if (!html && !(css && js) && !hasDomJs) {
    return null;
  }

  return {
    html: html || '<div id="app"></div>',
    css,
    js
  };
}

function deriveAppTitle(assistantMsg: ChatMessage, prevUserMsg?: ChatMessage, index?: number): string {
  const html = assistantMsg.extractedCode?.html || '';
  const titleTag = html.match(/<title[^>]*>([^<]{2,48})<\/title>/i);
  if (titleTag && titleTag[1].trim() && !/studiox sandbox/i.test(titleTag[1])) {
    return titleTag[1].trim();
  }
  if (prevUserMsg?.content) {
    const cleaned = prevUserMsg.content
      .replace(/\[Attached File:[^\]]+\][\s\S]*/i, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (cleaned) {
      return cleaned.length > 38 ? `${cleaned.slice(0, 38)}...` : cleaned;
    }
  }
  return `Chat App ${index ? `#${index}` : ''}`.trim();
}

const createWelcomeMessage = (): ChatMessage => ({
  id: `welcome-${Date.now()}`,
  role: 'assistant',
  content:
    'Hi! Upload any code files, folders, or `.zip` archives below and tell me what to do:\n- **Copy & Compile verbatim**: Say *"compile these files"* or *"replicate everything on this file"* and I will compile them 100% as-is.\n- **Edit only a section**: Ask *"in `path/file` change only X"* and I will patch ONLY that section while keeping everything else untouched.\n- **Ask questions or build new apps**: Ask about your code without changing anything, or prompt me to build a new app.',
  timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
});

export const AIChatWorkspace: React.FC<AIChatWorkspaceProps> = ({
  settings,
  onOpenSettings,
  onLoadCodeInBuilder,
  onActiveAppChange
}) => {
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    try {
      const saved = localStorage.getItem(CHAT_SESSIONS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [
      {
        id: `chat-${Date.now()}`,
        title: 'New Chat',
        messages: [createWelcomeMessage()],
        updatedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ];
  });
  const [activeSessionId, setActiveSessionId] = useState<string>(() => sessions[0]?.id || '');
  const activeSession = sessions.find((s) => s.id === activeSessionId) || sessions[0];
  const messages = activeSession?.messages || [];

  // Derive all built apps from the active session and across all sessions
  const { activeSessionApps, allBuiltApps } = useMemo(() => {
    const allApps: BuiltAppItem[] = [];
    const currentApps: BuiltAppItem[] = [];

    for (const session of sessions) {
      let appIdx = 0;
      for (let i = 0; i < session.messages.length; i++) {
        const msg = session.messages[i];
        if (msg.role !== 'assistant') continue;
        const stored = msg.extractedCode;
        const dynamicallyExtracted = extractCodeFromMarkdown(msg.content);
        const resolvedCode: CodeState | null =
          stored && (stored.html || stored.css || stored.js)
            ? {
                html: stored.html || '<div id="app"></div>',
                css: stored.css || '',
                js: stored.js || ''
              }
            : dynamicallyExtracted;

        if (resolvedCode) {
          appIdx += 1;
          const prevUser = [...session.messages.slice(0, i)].reverse().find((m) => m.role === 'user');
          const item: BuiltAppItem = {
            id: msg.id,
            sessionId: session.id,
            sessionTitle: session.title,
            title: deriveAppTitle({ ...msg, extractedCode: resolvedCode }, prevUser, appIdx),
            timestamp: msg.timestamp,
            code: resolvedCode
          };
          allApps.push(item);
          if (session.id === activeSession?.id) {
            currentApps.push(item);
          }
        }
      }
    }

    return {
      activeSessionApps: currentApps.reverse(),
      allBuiltApps: allApps.reverse()
    };
  }, [sessions, activeSession?.id]);

  // App Preview panel state
  const [isPreviewOpen, setIsPreviewOpen] = useState<boolean>(() => allBuiltApps.length > 0);
  const [selectedAppId, setSelectedAppId] = useState<string>(() => activeSessionApps[0]?.id || allBuiltApps[0]?.id || '');
  const [previewViewport, setPreviewViewport] = useState<'desktop' | 'mobile'>('desktop');
  const [previewTab, setPreviewTab] = useState<'preview' | 'code'>('preview');
  const [previewCodeFile, setPreviewCodeFile] = useState<'html' | 'css' | 'js'>('html');
  const [previewReloadKey, setPreviewReloadKey] = useState(0);
  const [isPreviewFullscreen, setIsPreviewFullscreen] = useState(false);
  const [mobilePane, setMobilePane] = useState<'chat' | 'preview'>('chat');

  const selectedBuiltApp = useMemo(() => {
    return (
      allBuiltApps.find((a) => a.id === selectedAppId) ||
      activeSessionApps[0] ||
      allBuiltApps[0] ||
      null
    );
  }, [allBuiltApps, activeSessionApps, selectedAppId]);

  const previewSrcDoc = useMemo(() => {
    if (!selectedBuiltApp) return '';
    return buildSandboxSrcDoc(selectedBuiltApp.code);
  }, [selectedBuiltApp]);

  useEffect(() => {
    onActiveAppChange?.(
      selectedBuiltApp ? { code: selectedBuiltApp.code, name: selectedBuiltApp.title } : null
    );
  }, [selectedBuiltApp, onActiveAppChange]);

  // Paste & Copy Pad state
  const [padText, setPadText] = useState<string>(() => {
    try {
      return localStorage.getItem(CHAT_PAD_KEY) || '';
    } catch {
      return '';
    }
  });
  const [isPadOpen, setIsPadOpen] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(CHAT_PAD_OPEN_KEY);
      return saved === null ? true : saved === 'true';
    } catch {
      return true;
    }
  });
  const [padNotice, setPadNotice] = useState<string>('');
  const padTextareaRef = useRef<HTMLTextAreaElement>(null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem(CHAT_PAD_KEY, padText);
    } catch {}
  }, [padText]);

  useEffect(() => {
    try {
      localStorage.setItem(CHAT_PAD_OPEN_KEY, String(isPadOpen));
    } catch {}
  }, [isPadOpen]);

  const showPadFeedback = (msg: string) => {
    setPadNotice(msg);
    setTimeout(() => setPadNotice(''), 2200);
  };

  const setMessages = (updater: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => {
    setSessions((prevSessions) =>
      prevSessions.map((s) => {
        if (s.id !== activeSession.id) return s;
        const nextMsgs = typeof updater === 'function' ? updater(s.messages) : updater;
        const firstUserMsg = nextMsgs.find((m) => m.role === 'user');
        const nextTitle = firstUserMsg
          ? firstUserMsg.content.slice(0, 32) + (firstUserMsg.content.length > 32 ? '...' : '')
          : s.title;
        return {
          ...s,
          title: nextTitle,
          messages: nextMsgs,
          updatedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
      })
    );
  };

  useEffect(() => {
    try {
      const json = JSON.stringify(sessions);
      if (json.length <= 2_500_000) {
        localStorage.setItem(CHAT_SESSIONS_KEY, json);
      } else {
        // Strip oversized embedded VFS HTML from older messages so session history persists within quota
        let keptHuge = 0;
        const compact = sessions.map((s, sIdx) => ({
          ...s,
          messages: s.messages.map((m, mIdx) => {
            const htmlLen = m.extractedCode?.html?.length || 0;
            if (htmlLen > 180_000) {
              const isLatest = sIdx === 0 && mIdx >= s.messages.length - 2;
              if (isLatest && keptHuge === 0) {
                keptHuge += 1;
                return m;
              }
              return { ...m, extractedCode: null, modifiedFiles: undefined };
            }
            return { ...m, modifiedFiles: undefined };
          })
        }));
        localStorage.setItem(CHAT_SESSIONS_KEY, JSON.stringify(compact));
      }
    } catch {}
  }, [sessions]);

  const handleNewChat = () => {
    const newSession: ChatSession = {
      id: `chat-${Date.now()}`,
      title: 'New Chat',
      messages: [createWelcomeMessage()],
      updatedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setSessions((prev) => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
    setInput('');
    setMobilePane('chat');
  };

  const [input, setInput] = useState('');
  const [enableResearch, setEnableResearch] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [codebaseFiles, setCodebaseFiles] = useState<CodebaseFile[]>([]);
  const [recentlyEditedPaths, setRecentlyEditedPaths] = useState<string[]>([]);
  const [isCodebaseDrawerOpen, setIsCodebaseDrawerOpen] = useState(false);
  const [isDraggingChatFiles, setIsDraggingChatFiles] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadCodebaseFromVault('chat').then((savedFiles) => {
      if (savedFiles.length > 0) {
        setCodebaseFiles(savedFiles);
      }
    });
  }, []);

  const codebaseStats = useMemo(() => getCodebaseStats(codebaseFiles), [codebaseFiles]);

  const handleAddFilesToVault = async (fileList: FileList | File[]) => {
    const rawList = Array.from(fileList);
    const hasArchiveOrFolder = rawList.some(
      (f) =>
        f.name.toLowerCase().endsWith('.zip') ||
        Boolean((f as File & { webkitRelativePath?: string }).webkitRelativePath)
    );

    const { files: ingested, skippedCount } = await ingestUploadedFiles(rawList);
    if (ingested.length > 0) {
      setCodebaseFiles((prev) => {
        const next = hasArchiveOrFolder ? ingested : mergeCodebaseFiles(prev, ingested);
        saveCodebaseToVault('chat', next);
        return next;
      });
      if (hasArchiveOrFolder) {
        setRecentlyEditedPaths([]);
      }
      setIsCodebaseDrawerOpen(true);
      const addedStats = getCodebaseStats(ingested);
      showPadFeedback(
        `${hasArchiveOrFolder ? 'Loaded project' : 'Added'} ${ingested.length} file(s) · ${addedStats.totalLines.toLocaleString()} lines${
          skippedCount > 0 ? ` (${skippedCount} binary/ignored skipped)` : ''
        }`
      );
    } else if (skippedCount > 0) {
      showPadFeedback('No readable code/text files found in selection');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await handleAddFilesToVault(e.target.files);
    }
    e.target.value = '';
  };

  const handleRemoveVaultFile = (path: string) => {
    setCodebaseFiles((prev) => {
      const next = prev.filter((f) => f.path !== path);
      saveCodebaseToVault('chat', next);
      return next;
    });
  };

  const handleClearVault = () => {
    setCodebaseFiles([]);
    setRecentlyEditedPaths([]);
    setIsCodebaseDrawerOpen(false);
    clearCodebaseFromVault('chat');
  };

  const handleCompileVaultVerbatim = () => {
    if (codebaseFiles.length === 0 || isLoading) return;
    try {
      const stats = getCodebaseStats(codebaseFiles);
      const compiled = compileCodebaseFiles(codebaseFiles);
      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: `Compiled **${compiled.includedFiles.length}** uploaded file(s) verbatim (${stats.totalLines.toLocaleString()} total lines, mode: \`${compiled.projectType}\`, entry: \`${compiled.entryFile}\`) without altering any lines.\n\nIncluded files:\n${compiled.includedFiles
          .slice(0, 20)
          .map((p) => `- \`${p}\``)
          .join('\n')}${compiled.includedFiles.length > 20 ? `\n- ...and ${compiled.includedFiles.length - 20} more` : ''}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        extractedCode: compiled.code
      };
      upsertSessionMessage(activeSession.id, assistantMsg);
      setSelectedAppId(assistantMsg.id);
      setIsPreviewOpen(true);
      setPreviewTab('preview');
      setMobilePane('preview');
      setPreviewReloadKey((k) => k + 1);
    } catch (err: any) {
      upsertSessionMessage(activeSession.id, {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: `Compilation Error: ${err?.message || 'Could not compile uploaded files.'}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleCopy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1800);
    } catch {
      // Fallback via pad if clipboard write fails
      setPadText(text);
      setIsPadOpen(true);
      showPadFeedback('Copied into Pad');
    }
  };

  const handlePasteFromClipboard = async (target: 'pad' | 'input') => {
    try {
      const clipText = await navigator.clipboard.readText();
      if (!clipText) {
        if (target === 'pad') {
          padTextareaRef.current?.focus();
          showPadFeedback('Clipboard empty — press Ctrl+V');
        } else {
          chatInputRef.current?.focus();
        }
        return;
      }
      if (target === 'pad') {
        setIsPadOpen(true);
        setPadText((prev) => (prev.trim() ? `${prev}\n\n${clipText}` : clipText));
        showPadFeedback('Pasted from clipboard');
      } else {
        setInput((prev) => (prev.trim() ? `${prev}\n${clipText}` : clipText));
        chatInputRef.current?.focus();
      }
    } catch {
      if (target === 'pad') {
        setIsPadOpen(true);
        padTextareaRef.current?.focus();
        showPadFeedback('Click inside box & press Ctrl+V / Cmd+V');
      } else {
        chatInputRef.current?.focus();
      }
    }
  };

  const upsertSessionMessage = (targetSessionId: string, newOrUpdatedMsg: ChatMessage) => {
    setSessions((prevSessions) =>
      prevSessions.map((s) => {
        if (s.id !== targetSessionId) return s;
        const exists = s.messages.some((m) => m.id === newOrUpdatedMsg.id);
        const nextMsgs = exists
          ? s.messages.map((m) => (m.id === newOrUpdatedMsg.id ? newOrUpdatedMsg : m))
          : [...s.messages, newOrUpdatedMsg];
        const firstUserMsg = nextMsgs.find((m) => m.role === 'user');
        const nextTitle = firstUserMsg
          ? firstUserMsg.content.slice(0, 32) + (firstUserMsg.content.length > 32 ? '...' : '')
          : s.title;
        return {
          ...s,
          title: nextTitle,
          messages: nextMsgs,
          updatedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
      })
    );
  };

  const handleStopGeneration = () => {
    abortControllerRef.current?.abort();
    setStatusText('Stopping...');
  };

  const sendMessageText = async (rawPrompt: string, clearInputAfterSend = false) => {
    const trimmed = rawPrompt.trim();
    if ((!trimmed && codebaseFiles.length === 0) || isLoading) return;

    const targetSessionId = activeSession.id;
    const activeVaultSnapshot = [...codebaseFiles];
    const stats = getCodebaseStats(activeVaultSnapshot);

    const displayPrompt =
      trimmed ||
      `Copy and compile the uploaded files verbatim (${stats.totalFiles} files, ${stats.totalLines.toLocaleString()} lines).`;

    const attachmentBadge =
      activeVaultSnapshot.length > 0
        ? `\n\n[Codebase Attached: ${stats.totalFiles} file(s) · ${stats.totalLines.toLocaleString()} lines · ${stats.totalChars.toLocaleString()} chars]`
        : '';

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: `${displayPrompt}${attachmentBadge}`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    const updatedHistory = [...messages, userMsg];
    upsertSessionMessage(targetSessionId, userMsg);
    if (clearInputAfterSend) {
      setInput('');
    }
    setIsLoading(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const intent = classifyChatCodebaseIntent(displayPrompt, activeVaultSnapshot);

      // 1. EXACT COPY & COMPILE MODE (100% verbatim replication of uploaded files / ZIP)
      if (intent === 'compile-exact' && activeVaultSnapshot.length > 0) {
        setStatusText(`Copying & compiling ${stats.totalFiles} uploaded file(s) verbatim...`);
        const compiled = compileCodebaseFiles(activeVaultSnapshot);
        const assistantMsg: ChatMessage = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: `Replicated and compiled **${compiled.includedFiles.length}** uploaded file(s) **100% verbatim** (${stats.totalLines.toLocaleString()} lines, entry: \`${compiled.entryFile}\`, type: \`${compiled.projectType}\`). No code was altered.\n\nCompiled files:\n${compiled.includedFiles
            .slice(0, 25)
            .map((p) => `- \`${p}\``)
            .join('\n')}${compiled.includedFiles.length > 25 ? `\n- ...and ${compiled.includedFiles.length - 25} more` : ''}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          extractedCode: compiled.code
        };
        upsertSessionMessage(targetSessionId, assistantMsg);
        setSelectedAppId(assistantMsg.id);
        setIsPreviewOpen(true);
        setPreviewTab('preview');
        setMobilePane('preview');
        setPreviewReloadKey((k) => k + 1);
        return;
      }

      let researchFinding: ResearchFinding | null = null;
      if (enableResearch) {
        setStatusText('Researching web sources...');
        try {
          researchFinding = await performTaskResearch(
            displayPrompt,
            settings,
            (msg) => setStatusText(msg)
          );
        } catch (resErr: any) {
          console.warn('Research warning:', resErr);
        }
      }

      if (controller.signal.aborted) return;

      // 2. SURGICAL SECTION EDIT MODE (patches ONLY requested section(s) in uploaded files/ZIP & recompiles)
      if (intent === 'surgical-edit' && activeVaultSnapshot.length > 0) {
        const editResult = await runSurgicalCodebaseEdit({
          settings,
          userPrompt: displayPrompt,
          codebaseFiles: activeVaultSnapshot,
          researchFinding,
          onStatus: (msg) => setStatusText(msg),
          signal: controller.signal
        });

        const touched = [...editResult.patchedPaths, ...editResult.addedPaths];
        let compiledCode: CodeState | null = null;
        let finalReply = editResult.rawReply;

        if (touched.length > 0) {
          setCodebaseFiles(editResult.updatedFiles);
          saveCodebaseToVault('chat', editResult.updatedFiles);
          setRecentlyEditedPaths(touched);

          setStatusText('Recompiling updated codebase cleanly...');
          const compiled = compileCodebaseFiles(editResult.updatedFiles);
          compiledCode = compiled.code;
          const partialNote =
            editResult.unmatchedBlocks > 0
              ? `\n- Note: ${editResult.unmatchedBlocks} secondary patch block(s) could not match verbatim; review the diff above if anything is incomplete.`
              : '';
          const verifyNote = editResult.compilationValid
            ? `\n- Build verification: Passed cleanly${editResult.repairPassesUsed > 0 ? ` (${editResult.repairPassesUsed} auto-repair pass)` : ''}.`
            : `\n- Build verification warning: ${editResult.compilationErrors.map((e) => `${e.filePath}${e.line ? `:${e.line}` : ''} — ${e.message}`).join('; ')}`;
          finalReply = `${editResult.rawReply}\n\n---\n**Applied Surgical Update & Compiled Live Preview**\n- Responsible file(s) modified in place: ${touched.map((p) => `\`${p}\``).join(', ')}\n- All other lines and files remained 100% untouched.${verifyNote}${partialNote}`;
        } else {
          // If AI output full code blocks when single file or fallback, inspect markdown fallback
          const fallbackExtracted = extractCodeFromMarkdown(editResult.rawReply);
          if (fallbackExtracted) {
            compiledCode = await verifyAndRepairGeneratedCode({
              code: fallbackExtracted,
              prompt: displayPrompt,
              settings,
              onStatus: (msg) => setStatusText(msg),
              signal: controller.signal
            });
          } else {
            const candidateHint =
              editResult.responsibleFiles.length > 0
                ? ` Located candidate file(s): ${editResult.responsibleFiles.map((p) => `\`${p}\``).join(', ')}.`
                : '';
            finalReply = `${editResult.rawReply}\n\n> Note: Could not auto-match a \`FILE: ... SEARCH/REPLACE\` patch against the current file lines.${candidateHint} Try naming the exact file or pasting the lines you want changed.`;
          }
        }

        const modifiedFilesList =
          touched.length > 0
            ? editResult.updatedFiles
                .filter((f) => touched.includes(f.path))
                .map((f) => ({ path: f.path, name: f.name, content: f.content }))
            : undefined;

        const assistantMsg: ChatMessage = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: finalReply,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          researchUsed: researchFinding,
          extractedCode: compiledCode,
          modifiedFiles: modifiedFilesList
        };

        upsertSessionMessage(targetSessionId, assistantMsg);

        if (compiledCode) {
          setSelectedAppId(assistantMsg.id);
          setIsPreviewOpen(true);
          setPreviewTab('preview');
          setMobilePane('preview');
          setPreviewReloadKey((k) => k + 1);
        }
        return;
      }

      // 3. Q&A / INSPECTION OR NEW APP BUILD
      const chatMessagesPayload = updatedHistory.slice(-10).map((m, idx) => ({
        role: m.role,
        content: idx === updatedHistory.slice(-10).length - 1 ? displayPrompt : m.content
      }));

      const assistantText = await runPrincipalAIChat({
        settings,
        messages: chatMessagesPayload,
        userPrompt: displayPrompt,
        codebaseFiles: activeVaultSnapshot,
        researchFinding,
        mode: intent === 'chat-qa' ? 'qa' : 'build',
        onStatus: (msg) => setStatusText(msg),
        signal: controller.signal
      });

      let extracted = intent === 'chat-qa' ? null : extractCodeFromMarkdown(assistantText);
      if (extracted) {
        setStatusText('Verifying syntax & preparing live preview...');
        extracted = await verifyAndRepairGeneratedCode({
          code: extracted,
          prompt: displayPrompt,
          settings,
          onStatus: (msg) => setStatusText(msg),
          signal: controller.signal
        });
      }

      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: assistantText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        researchUsed: researchFinding,
        extractedCode: extracted
      };

      upsertSessionMessage(targetSessionId, assistantMsg);

      if (extracted) {
        setSelectedAppId(assistantMsg.id);
        setIsPreviewOpen(true);
        setPreviewTab('preview');
        setPreviewReloadKey((k) => k + 1);
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        upsertSessionMessage(targetSessionId, {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: `Error: ${err.message || 'Failed to get response.'}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });
      }
    } finally {
      abortControllerRef.current = null;
      setIsLoading(false);
      setStatusText('');
    }
  };

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    await sendMessageText(input, true);
  };

  const renderMessageContent = (msg: ChatMessage) => {
    const parts = msg.content.split(/(```[\s\S]*?```)/g);
    const msgCode =
      (msg.extractedCode && (msg.extractedCode.html || msg.extractedCode.css || msg.extractedCode.js)
        ? {
            html: msg.extractedCode.html || '<div id="app"></div>',
            css: msg.extractedCode.css || '',
            js: msg.extractedCode.js || ''
          }
        : null) || extractCodeFromMarkdown(msg.content);

    return (
      <div className="space-y-2 text-sm leading-relaxed">
        {parts.map((part, idx) => {
          if (part.startsWith('```') && part.endsWith('```')) {
            const firstNewline = part.indexOf('\n');
            const lang = firstNewline > 3 ? part.slice(3, firstNewline).trim() : 'code';
            const codeBody = firstNewline > -1 ? part.slice(firstNewline + 1, -3).trim() : part.slice(3, -3);
            const blockId = `${msg.id}-code-${idx}`;
            return (
              <div key={idx} className="rounded-lg overflow-hidden border border-slate-700/80 bg-slate-950 my-2">
                <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900 border-b border-slate-800 text-xs text-slate-400">
                  <span className="font-mono uppercase">{lang || 'code'}</span>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setPadText(codeBody);
                        setIsPadOpen(true);
                        showPadFeedback('Code copied to Pad');
                      }}
                      className="hover:text-cyan-300 transition-colors cursor-pointer whitespace-nowrap"
                    >
                      To Pad
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCopy(codeBody, blockId)}
                      className="flex items-center gap-1 hover:text-white transition-colors cursor-pointer whitespace-nowrap"
                    >
                      {copiedId === blockId ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
                <pre className="p-3 overflow-x-auto text-xs font-mono text-slate-200 max-h-72 overflow-y-auto">{codeBody}</pre>
              </div>
            );
          }
          return (
            <div key={idx} className="whitespace-pre-wrap break-words">
              {part}
            </div>
          );
        })}

        {msg.researchUsed && msg.researchUsed.results.length > 0 && (
          <div className="mt-3 pt-2 border-t border-slate-800/80">
            <div className="text-[11px] font-semibold text-cyan-400 flex items-center gap-1.5 mb-1.5">
              <Search className="w-3 h-3" />
              Web Research Sources
            </div>
            <div className="flex flex-wrap gap-1.5">
              {msg.researchUsed.results.slice(0, 4).map((src, i) => (
                <a
                  key={i}
                  href={src.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] px-2 py-1 rounded bg-slate-900 border border-slate-800 text-slate-300 hover:border-cyan-500/50 hover:text-cyan-300 truncate max-w-[240px]"
                >
                  {src.title || src.url}
                </a>
              ))}
            </div>
          </div>
        )}

        {(msgCode || (msg.modifiedFiles && msg.modifiedFiles.length > 0)) && (
          <div className="pt-2 flex flex-wrap items-center gap-2">
            {msgCode && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedAppId(msg.id);
                    setIsPreviewOpen(true);
                    setPreviewTab('preview');
                    setMobilePane('preview');
                    setPreviewReloadKey((k) => k + 1);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Eye className="w-3.5 h-3.5" />
                  Preview Live App
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onLoadCodeInBuilder(
                      msgCode,
                      allBuiltApps.find((a) => a.id === msg.id)?.title || 'Chat Generated App',
                      codebaseFiles.length > 0 ? codebaseFiles : undefined
                    )
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 font-semibold text-xs transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Play className="w-3.5 h-3.5" />
                  Open in App Builder
                </button>
              </>
            )}
            {msg.modifiedFiles && msg.modifiedFiles.slice(0, 3).map((mf) => (
              <button
                key={mf.path}
                type="button"
                onClick={() => downloadSingleFile(mf.name, mf.content)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 font-semibold text-xs transition-colors cursor-pointer whitespace-nowrap shrink-0"
                title={`Download edited file ${mf.path}`}
              >
                <Download className="w-3.5 h-3.5" />
                Download {mf.name}
              </button>
            ))}
            {codebaseFiles.length > 1 && msg.modifiedFiles && msg.modifiedFiles.length > 0 && (
              <button
                type="button"
                onClick={() => exportVaultAsZip(codebaseFiles, 'studiox-edited-project')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 font-semibold text-xs transition-colors cursor-pointer whitespace-nowrap shrink-0"
                title="Download entire modified project as a ZIP archive"
              >
                <Download className="w-3.5 h-3.5" />
                Download Updated ZIP
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  const padLineCount = padText ? padText.split('\n').length : 0;

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 text-slate-100 overflow-hidden">
      {/* Chat Header */}
      <div className="h-12 border-b border-slate-800/80 bg-slate-900/60 px-4 flex items-center justify-between shrink-0 gap-3 overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-2.5 min-w-0 shrink-0">
          <Sparkles className="w-4 h-4 text-cyan-400 shrink-0" />
          <span className="font-semibold text-sm text-white whitespace-nowrap shrink-0">AI Chat</span>
          <select
            value={activeSession?.id || ''}
            onChange={(e) => {
              const nextId = e.target.value;
              setActiveSessionId(nextId);
              const nextSession = sessions.find((s) => s.id === nextId);
              if (nextSession) {
                const foundApp = [...nextSession.messages]
                  .reverse()
                  .find((m) => m.role === 'assistant' && (extractCodeFromMarkdown(m.content) || m.extractedCode));
                if (foundApp) {
                  setSelectedAppId(foundApp.id);
                  setIsPreviewOpen(true);
                }
              }
            }}
            className="bg-slate-950 border border-slate-800 text-xs text-slate-200 rounded-md px-2 py-1 max-w-[190px] truncate focus:outline-none focus:border-cyan-500/50"
            title="Switch preserved chat"
          >
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title} ({s.updatedAt})
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleNewChat}
            className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-md bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/25 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            title="Start a new chat while preserving existing ones"
          >
            <Plus className="w-3.5 h-3.5" />
            New Chat
          </button>
        </div>

        {/* Mobile pane switcher + quick Live Preview */}
        <div className="flex lg:hidden items-center gap-1.5 shrink-0">
          <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => setMobilePane('chat')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md whitespace-nowrap ${
                mobilePane === 'chat' ? 'bg-slate-800 text-white' : 'text-slate-400'
              }`}
            >
              Chat
            </button>
            <button
              type="button"
              onClick={() => {
                setIsPreviewOpen(true);
                setMobilePane('preview');
              }}
              className={`px-2.5 py-1 text-xs font-medium rounded-md tabular-nums whitespace-nowrap ${
                mobilePane === 'preview' ? 'bg-emerald-500 text-slate-950 font-semibold' : 'text-slate-400'
              }`}
            >
              Apps ({allBuiltApps.length})
            </button>
          </div>
          {selectedBuiltApp && (
            <button
              type="button"
              onClick={() => {
                setIsPreviewOpen(true);
                setIsPreviewFullscreen(true);
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer"
              title="Open Live Preview fullscreen"
            >
              <Maximize2 className="w-3 h-3" />
              <span>Live Preview</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setIsPadOpen((prev) => !prev)}
            className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-md border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              isPadOpen
                ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40'
                : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700'
            }`}
            title="Toggle convenient Paste & Copy scratchpad"
          >
            <Clipboard className="w-3.5 h-3.5" />
            <span>Paste &amp; Copy Pad</span>
          </button>

          <button
            type="button"
            onClick={() => setIsPreviewOpen((prev) => !prev)}
            className={`hidden lg:inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-md border transition-colors tabular-nums whitespace-nowrap shrink-0 cursor-pointer ${
              isPreviewOpen
                ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-semibold'
                : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-emerald-500/40 hover:text-emerald-300'
            }`}
            title="Show or hide live preview of apps built by AI Chat"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Built Apps ({allBuiltApps.length})</span>
          </button>

          <button
            type="button"
            onClick={() => onOpenSettings('groq')}
            className="inline-flex items-center gap-1 text-[11px] font-mono px-2.5 py-1 rounded-md bg-orange-500/10 text-orange-300 border border-orange-500/30 hover:bg-orange-500/20 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            title="Enter Groq API Key & pick live Groq models"
          >
            <span>
              {settings.groqApiKey?.trim()
                ? settings.useOpenRouter && settings.apiKey
                  ? 'Groq Fallback Ready'
                  : `Groq: ${resolveGroqModelId(settings)}`
                : 'Add Groq Key'}
            </span>
          </button>

          {settings.useGemini !== false ? (
            <button
              type="button"
              onClick={() => onOpenSettings('gemini')}
              className="text-xs px-2.5 py-1 rounded-md bg-blue-500/10 text-blue-300 border border-blue-500/30 hover:bg-blue-500/20 transition-colors cursor-pointer whitespace-nowrap shrink-0 font-mono"
              title="Using server-configured Google Gemini API key"
            >
              {settings.geminiModel || 'gemini-4-hydrogen'}
            </button>
          ) : !settings.apiKey ? (
            <button
              type="button"
              onClick={() => onOpenSettings('openrouter')}
              className="text-xs px-2.5 py-1 rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/30 hover:bg-amber-500/20 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              Add OpenRouter Key
            </button>
          ) : null}

          <button
            type="button"
            onClick={() => setMessages([createWelcomeMessage()])}
            className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            title="Clear current chat"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear
          </button>
        </div>
      </div>

      {/* Main Split Workspace: Left = Chat + Paste/Copy Pad, Right = Built Apps Live Preview */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* LEFT PANE: Chat & Paste/Copy Pad */}
        <div
          className={`flex-1 flex flex-col min-w-0 min-h-0 ${
            mobilePane === 'preview' ? 'hidden lg:flex' : 'flex'
          } ${isPreviewOpen ? 'lg:border-r lg:border-slate-800' : ''}`}
        >
          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto px-4 py-5 min-h-0">
            <div className="max-w-3xl mx-auto space-y-5">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.role === 'assistant' && (
                    <div className="w-8 h-8 rounded-lg bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center shrink-0 mt-0.5">
                      <Bot className="w-4 h-4 text-cyan-400" />
                    </div>
                  )}
                  <div
                    className={`max-w-[88%] rounded-2xl px-4 py-3 ${
                      msg.role === 'user'
                        ? 'bg-blue-600 text-white rounded-br-sm'
                        : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-bl-sm'
                    }`}
                  >
                    {renderMessageContent(msg)}
                    <div
                      className={`flex items-center gap-3 mt-2 pt-1.5 border-t text-[11px] ${
                        msg.role === 'user'
                          ? 'border-blue-500/40 text-blue-100 justify-end'
                          : 'border-slate-800/80 text-slate-400 justify-between'
                      }`}
                    >
                      <span className="tabular-nums">{msg.timestamp}</span>
                      <div className="flex items-center gap-2.5">
                        <button
                          type="button"
                          onClick={() => {
                            setPadText(msg.content);
                            setIsPadOpen(true);
                            showPadFeedback('Message copied into Pad');
                          }}
                          className="hover:underline cursor-pointer whitespace-nowrap"
                          title="Send this message text to Paste & Copy Pad"
                        >
                          To Pad
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCopy(msg.content, `msg-${msg.id}`)}
                          className="inline-flex items-center gap-1 hover:underline cursor-pointer whitespace-nowrap"
                          title="Copy full message"
                        >
                          {copiedId === `msg-${msg.id}` ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-400" />
                              <span>Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                  {msg.role === 'user' && (
                    <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0 mt-0.5">
                      <User className="w-4 h-4 text-slate-300" />
                    </div>
                  )}
                </div>
              ))}

              {isLoading && (
                <div className="flex gap-3 justify-start">
                  <div className="w-8 h-8 rounded-lg bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center shrink-0">
                    <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
                  </div>
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl rounded-bl-sm px-4 py-3 text-sm text-slate-300 flex items-center gap-3">
                    <span>{statusText || 'Engineering response...'}</span>
                    <button
                      type="button"
                      onClick={handleStopGeneration}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-xs font-medium cursor-pointer"
                    >
                      <Square className="w-3 h-3" />
                      Stop
                    </button>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Dedicated Convenient Paste & Copy Pad */}
          {isPadOpen && (
            <div className="border-t border-slate-800 bg-slate-900/75 px-4 py-3 shrink-0">
              <div className="max-w-3xl mx-auto">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 text-xs">
                    <Clipboard className="w-3.5 h-3.5 text-cyan-400" />
                    <span className="font-semibold text-slate-200">Paste &amp; Copy Pad</span>
                    <span className="text-slate-500 tabular-nums">
                      {padText.length.toLocaleString()} chars · {padLineCount} {padLineCount === 1 ? 'line' : 'lines'}
                    </span>
                    {padNotice && <span className="text-emerald-400 font-medium">{padNotice}</span>}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handlePasteFromClipboard('pad')}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0"
                      title="Paste text from your clipboard into this pad"
                    >
                      <ClipboardPaste className="w-3.5 h-3.5 text-cyan-400" />
                      Paste
                    </button>
                    <button
                      type="button"
                      disabled={!padText}
                      onClick={async () => {
                        await handleCopy(padText, 'pad-copy');
                        showPadFeedback('Copied to clipboard');
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0"
                      title="Copy everything in the pad"
                    >
                      {copiedId === 'pad-copy' ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5 text-slate-300" />
                      )}
                      {copiedId === 'pad-copy' ? 'Copied' : 'Copy All'}
                    </button>
                    <button
                      type="button"
                      disabled={!padText.trim()}
                      onClick={() => {
                        setInput((prev) => (prev.trim() ? `${prev}\n\n${padText}` : padText));
                        chatInputRef.current?.focus();
                        showPadFeedback('Inserted into chat box');
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-cyan-300 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0"
                      title="Move/append pad text into the chat message box below"
                    >
                      <ArrowUpRight className="w-3.5 h-3.5" />
                      Put in Chat
                    </button>
                    <button
                      type="button"
                      disabled={!padText.trim()}
                      onClick={() => {
                        const fileName = `pasted-code-${codebaseFiles.length + 1}.txt`;
                        const pastedFile = createCodebaseFile(fileName, padText);
                        setCodebaseFiles((prev) => {
                          const next = mergeCodebaseFiles(prev, [pastedFile]);
                          saveCodebaseToVault('chat', next);
                          return next;
                        });
                        setIsCodebaseDrawerOpen(true);
                        showPadFeedback(`Saved ${pastedFile.lines.toLocaleString()} lines to Codebase Vault`);
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-emerald-300 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0"
                      title="Save huge pasted code from the pad into the unlimited Codebase Vault"
                    >
                      <Database className="w-3.5 h-3.5" />
                      Add to Codebase
                    </button>
                    <button
                      type="button"
                      disabled={!padText.trim() || isLoading}
                      onClick={() => sendMessageText(padText)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 text-slate-950 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0"
                      title="Send pad contents directly to AI Chat"
                    >
                      <Send className="w-3 h-3" />
                      Send Now
                    </button>
                    <button
                      type="button"
                      disabled={!padText}
                      onClick={() => setPadText('')}
                      className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 transition-colors cursor-pointer"
                      title="Clear pad"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsPadOpen(false)}
                      className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                      title="Minimize Paste & Copy Pad"
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <textarea
                  ref={padTextareaRef}
                  value={padText}
                  onChange={(e) => setPadText(e.target.value)}
                  placeholder="Paste prompts, huge codebases, notes, or AI replies here to edit, save to Codebase Vault, copy, or send..."
                  rows={3}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500/60 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-none resize-y min-h-[76px] max-h-60"
                />
              </div>
            </div>
          )}

          {/* Input Area with Drag-and-Drop Multi-File / Folder / ZIP Codebase Upload */}
          <div
            className={`border-t border-slate-800 bg-slate-900/60 p-3 sm:p-4 shrink-0 transition-colors ${
              isDraggingChatFiles ? 'bg-cyan-950/30 border-cyan-500/70' : ''
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDraggingChatFiles(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              setIsDraggingChatFiles(false);
            }}
            onDrop={async (e) => {
              e.preventDefault();
              setIsDraggingChatFiles(false);
              if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                await handleAddFilesToVault(e.dataTransfer.files);
              }
            }}
          >
            <form onSubmit={handleSend} className="max-w-3xl mx-auto">
              <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setEnableResearch(!enableResearch)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors cursor-pointer whitespace-nowrap ${
                      enableResearch
                        ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                    }`}
                  >
                    <Globe className="w-3.5 h-3.5" />
                    Web Research: {enableResearch ? 'ON' : 'OFF'}
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-slate-900 text-slate-300 border border-slate-800 hover:border-cyan-500/40 hover:text-cyan-300 transition-colors cursor-pointer whitespace-nowrap"
                    title="Upload multiple code files or .zip archives at once (supports hundreds of thousands of lines)"
                  >
                    <Paperclip className="w-3.5 h-3.5 text-cyan-400" />
                    Upload Files / ZIP
                  </button>
                  <button
                    type="button"
                    onClick={() => folderInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-slate-900 text-slate-300 border border-slate-800 hover:border-emerald-500/40 hover:text-emerald-300 transition-colors cursor-pointer whitespace-nowrap"
                    title="Upload an entire project folder at once"
                  >
                    <FolderUp className="w-3.5 h-3.5 text-emerald-400" />
                    Upload Folder
                  </button>
                  {!isPadOpen && (
                    <button
                      type="button"
                      onClick={() => setIsPadOpen(true)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-slate-900 text-slate-300 border border-slate-800 hover:border-cyan-500/40 hover:text-cyan-300 transition-colors cursor-pointer whitespace-nowrap"
                    >
                      <ChevronUp className="w-3.5 h-3.5" />
                      Open Paste &amp; Copy Pad
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => handlePasteFromClipboard('input')}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-900 border border-slate-800 text-slate-300 hover:text-cyan-300 hover:border-cyan-500/40 transition-colors cursor-pointer whitespace-nowrap"
                    title="Paste clipboard directly into chat input"
                  >
                    <ClipboardPaste className="w-3.5 h-3.5 text-cyan-400" />
                    Paste
                  </button>
                  <button
                    type="button"
                    disabled={!input}
                    onClick={() => handleCopy(input, 'chat-input-copy')}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-900 border border-slate-800 text-slate-300 hover:text-white disabled:opacity-40 transition-colors cursor-pointer whitespace-nowrap"
                    title="Copy text from chat input"
                  >
                    {copiedId === 'chat-input-copy' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Codebase Vault Summary & Expandable File Explorer */}
              {codebaseFiles.length > 0 && (
                <div className="mb-2.5 rounded-xl border border-cyan-500/30 bg-slate-950/90 p-2.5 text-xs">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 min-w-0">
                      <Database className="w-4 h-4 text-cyan-400 shrink-0" />
                      <span className="font-semibold text-cyan-200 tabular-nums">
                        Codebase Vault: {codebaseStats.totalFiles} file{codebaseStats.totalFiles === 1 ? '' : 's'}
                      </span>
                      <span className="text-slate-400 tabular-nums">
                        · {codebaseStats.totalLines.toLocaleString()} lines · {codebaseStats.totalChars.toLocaleString()} chars
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        type="button"
                        onClick={handleCompileVaultVerbatim}
                        disabled={isLoading}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/35 font-medium cursor-pointer disabled:opacity-40"
                        title="Copy uploaded files/ZIP 100% verbatim and compile live preview without altering anything"
                      >
                        <Play className="w-3 h-3" />
                        Compile As-Is
                      </button>
                      <button
                        type="button"
                        onClick={() => exportVaultAsZip(codebaseFiles, 'studiox-chat-project')}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-cyan-300 border border-slate-800 cursor-pointer"
                        title="Download current codebase vault (with any surgical edits) as .zip"
                      >
                        <Download className="w-3 h-3" />
                        ZIP
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsCodebaseDrawerOpen((v) => !v)}
                        className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 cursor-pointer"
                      >
                        {isCodebaseDrawerOpen ? 'Hide Files' : 'Inspect Files'}
                      </button>
                      <button
                        type="button"
                        onClick={handleClearVault}
                        className="px-2 py-0.5 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 cursor-pointer"
                      >
                        Clear All
                      </button>
                    </div>
                  </div>
                  {isCodebaseDrawerOpen && (
                    <div className="mt-2 pt-2 border-t border-slate-800/80 max-h-40 overflow-y-auto space-y-1">
                      {codebaseFiles.map((f) => {
                        const wasEdited = recentlyEditedPaths.includes(f.path);
                        return (
                          <div
                            key={f.path}
                            className="flex items-center justify-between gap-2 px-2 py-1 rounded bg-slate-900/70 text-[11px] font-mono"
                          >
                            <div className="flex items-center gap-1.5 min-w-0">
                              <FileCode className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                              <span className="text-slate-200 truncate">{f.path}</span>
                              {wasEdited && (
                                <span className="px-1.5 py-0 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] shrink-0">
                                  Edited
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 shrink-0 text-slate-400 tabular-nums">
                              <span>{f.lines.toLocaleString()}L</span>
                              <span>{f.chars.toLocaleString()}c</span>
                              <button
                                type="button"
                                onClick={() => downloadSingleFile(f.name, f.content)}
                                className="text-slate-400 hover:text-emerald-300 cursor-pointer"
                                title={`Download ${f.path}`}
                              >
                                <Download className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleCopy(f.content, `vault-copy-${f.path}`)}
                                className="text-slate-400 hover:text-cyan-300 cursor-pointer"
                                title={`Copy full content of ${f.path}`}
                              >
                                {copiedId === `vault-copy-${f.path}` ? (
                                  <Check className="w-3 h-3 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveVaultFile(f.path)}
                                className="text-slate-500 hover:text-rose-400 cursor-pointer"
                                title={`Remove ${f.path}`}
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <input
                  ref={folderInputRef}
                  type="file"
                  multiple
                  {...({ webkitdirectory: '', directory: '' } as any)}
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-cyan-500/50 text-slate-300 hover:text-cyan-300 flex items-center justify-center transition-colors shrink-0 cursor-pointer"
                  title="Upload multiple files or .zip archive"
                >
                  <Paperclip className="w-4 h-4" />
                </button>
                <textarea
                  ref={chatInputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="Ask AI Chat to build an app, upload huge codebases/ZIPs, or solve any engineering task..."
                  rows={2}
                  className="flex-1 bg-slate-950 border border-slate-800 focus:border-cyan-500/60 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none resize-none"
                />
                <button
                  type="submit"
                  disabled={isLoading || (!input.trim() && codebaseFiles.length === 0)}
                  className="px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-semibold flex items-center justify-center transition-all cursor-pointer shrink-0"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* RIGHT PANE: Built Apps Live Interactive Preview */}
        {(isPreviewOpen || mobilePane === 'preview') && (
          <div
            className={`${
              isPreviewFullscreen
                ? 'fixed inset-0 z-50 bg-slate-950 flex flex-col'
                : `${mobilePane === 'preview' ? 'flex w-full lg:w-[48%] xl:w-[50%]' : 'hidden lg:flex lg:w-[48%] xl:w-[50%]'} flex-col min-w-0 min-h-0 bg-slate-950`
            }`}
          >
            {/* Preview Top Bar */}
            <div className="h-11 px-3 border-b border-slate-800 bg-slate-900/80 flex items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <Layers className="w-4 h-4 text-emerald-400 shrink-0" />
                {allBuiltApps.length > 0 ? (
                  <select
                    value={selectedBuiltApp?.id || ''}
                    onChange={(e) => {
                      setSelectedAppId(e.target.value);
                      setPreviewReloadKey((k) => k + 1);
                    }}
                    className="bg-slate-950 border border-slate-800 text-xs text-slate-100 rounded-md px-2 py-1 max-w-[210px] truncate focus:outline-none focus:border-emerald-500/50"
                    title="Select any app built by AI Chat"
                  >
                    {activeSessionApps.length > 0 && (
                      <optgroup label="Current Chat Apps">
                        {activeSessionApps.map((app) => (
                          <option key={app.id} value={app.id}>
                            {app.title} ({app.timestamp})
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {allBuiltApps.some((a) => a.sessionId !== activeSession?.id) && (
                      <optgroup label="Apps from Other Chats">
                        {allBuiltApps
                          .filter((a) => a.sessionId !== activeSession?.id)
                          .map((app) => (
                            <option key={app.id} value={app.id}>
                              {app.title} — {app.sessionTitle}
                            </option>
                          ))}
                      </optgroup>
                    )}
                  </select>
                ) : (
                  <span className="text-xs font-medium text-slate-300 truncate">Built Apps Preview</span>
                )}
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {selectedBuiltApp && (
                  <>
                    <div className="flex items-center bg-slate-950 border border-slate-800 rounded-md p-0.5">
                      <button
                        type="button"
                        onClick={() => setPreviewTab('preview')}
                        className={`px-2 py-0.5 rounded text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                          previewTab === 'preview' ? 'bg-emerald-500 text-slate-950 font-semibold' : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        Preview
                      </button>
                      <button
                        type="button"
                        onClick={() => setPreviewTab('code')}
                        className={`px-2 py-0.5 rounded text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                          previewTab === 'code' ? 'bg-slate-800 text-cyan-300' : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        Code
                      </button>
                    </div>

                    {previewTab === 'preview' && (
                      <div className="hidden sm:flex items-center bg-slate-950 border border-slate-800 rounded-md p-0.5">
                        <button
                          type="button"
                          onClick={() => setPreviewViewport('desktop')}
                          className={`p-1 rounded cursor-pointer ${
                            previewViewport === 'desktop' ? 'bg-slate-800 text-cyan-400' : 'text-slate-400 hover:text-white'
                          }`}
                          title="Desktop Width"
                        >
                          <Monitor className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setPreviewViewport('mobile')}
                          className={`p-1 rounded cursor-pointer ${
                            previewViewport === 'mobile' ? 'bg-slate-800 text-cyan-400' : 'text-slate-400 hover:text-white'
                          }`}
                          title="Mobile Width (375px)"
                        >
                          <Smartphone className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => setPreviewReloadKey((k) => k + 1)}
                      className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                      title="Refresh App Preview"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (codebaseFiles.length > 0) {
                          exportVaultAsZip(codebaseFiles, selectedBuiltApp.title || 'studiox-edited-project');
                        } else {
                          downloadProjectZip(selectedBuiltApp.code, selectedBuiltApp.title || 'studiox-chat-app');
                        }
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap"
                      title={codebaseFiles.length > 0 ? 'Download updated codebase vault as ZIP' : 'Download app as ZIP'}
                    >
                      <Download className="w-3 h-3" />
                      <span className="hidden xl:inline">ZIP</span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        onLoadCodeInBuilder(
                          selectedBuiltApp.code,
                          selectedBuiltApp.title,
                          codebaseFiles.length > 0 ? codebaseFiles : undefined
                        )
                      }
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap"
                      title="Open this app inside StudioX App Builder"
                    >
                      <Play className="w-3 h-3" />
                      <span className="hidden xl:inline">Builder</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsPreviewFullscreen((f) => !f)}
                      className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                      title={isPreviewFullscreen ? 'Exit Fullscreen' : 'Fullscreen Preview'}
                    >
                      {isPreviewFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                    </button>
                  </>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setIsPreviewFullscreen(false);
                    setIsPreviewOpen(false);
                    setMobilePane('chat');
                  }}
                  className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                  title="Close App Preview"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Preview Content Area */}
            {selectedBuiltApp ? (
              previewTab === 'preview' ? (
                <div className="flex-1 bg-slate-950 p-2 sm:p-3 flex items-center justify-center overflow-hidden min-h-0">
                  <div
                    className={`h-full min-h-[320px] bg-slate-900 rounded-xl overflow-hidden border border-slate-800 flex flex-col transition-all ${
                      previewViewport === 'mobile' ? 'w-[375px] max-w-full rounded-2xl border-2' : 'w-full'
                    }`}
                  >
                    <iframe
                      key={`${selectedBuiltApp.id}-${previewReloadKey}`}
                      srcDoc={previewSrcDoc}
                      title={selectedBuiltApp.title}
                      sandbox="allow-scripts allow-modals allow-forms allow-popups allow-same-origin"
                      className="w-full h-full flex-1 border-0 bg-slate-950"
                    />
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col min-h-0 bg-slate-950">
                  <div className="px-3 py-2 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1">
                      {(['html', 'css', 'js'] as const).map((slot) => (
                        <button
                          key={slot}
                          type="button"
                          onClick={() => setPreviewCodeFile(slot)}
                          className={`px-2.5 py-1 rounded text-xs font-mono cursor-pointer ${
                            previewCodeFile === slot
                              ? 'bg-slate-800 text-cyan-300 font-semibold'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          {slot === 'html' ? 'index.html' : slot === 'css' ? 'styles.css' : 'app.js'}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          downloadSingleFile(
                            previewCodeFile === 'html'
                              ? 'index.html'
                              : previewCodeFile === 'css'
                              ? 'styles.css'
                              : 'app.js',
                            selectedBuiltApp.code[previewCodeFile] || ''
                          )
                        }
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-500/15 hover:bg-emerald-500/25 text-xs text-emerald-300 border border-emerald-500/30 cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download File</span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleCopy(selectedBuiltApp.code[previewCodeFile] || '', `preview-code-${previewCodeFile}`)
                        }
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 cursor-pointer"
                      >
                        {copiedId === `preview-code-${previewCodeFile}` ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="text-emerald-400">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copy File</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                  <pre className="flex-1 p-4 overflow-auto text-xs font-mono text-slate-200 whitespace-pre">
                    {selectedBuiltApp.code[previewCodeFile] || `/* No ${previewCodeFile.toUpperCase()} code in this block */`}
                  </pre>
                </div>
              )
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                <Code2 className="w-10 h-10 text-slate-600 mb-3" />
                <h3 className="text-sm font-semibold text-slate-200 mb-1">No Apps Built in AI Chat Yet</h3>
                <p className="text-xs text-slate-400 max-w-sm mb-4">
                  Ask AI Chat to build any interactive app, calculator, dashboard, or game. Every app it builds will render live right here automatically.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setInput('Build a sleek interactive Pomodoro Timer & Task List web app');
                    setMobilePane('chat');
                    chatInputRef.current?.focus();
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-semibold transition-colors cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Try Example App Prompt
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
