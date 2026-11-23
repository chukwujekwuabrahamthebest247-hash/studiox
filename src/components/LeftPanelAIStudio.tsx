import React, { useState, useEffect, useRef } from 'react';
import { 
  Sparkles, 
  Wand2, 
  Zap, 
  Globe, 
  Send, 
  CornerDownLeft, 
  Loader2, 
  Layers, 
  RotateCcw, 
  Bot, 
  User, 
  Search, 
  CheckCircle2, 
  Clock, 
  Settings2,
  ChevronDown,
  Eye,
  Download,
  Image as ImageIcon,
  Paperclip,
  X,
  FileCode,
  Check,
  EyeOff,
  Maximize2,
  Target,
  Brain,
  Sliders,
  Lock,
  FileText,
  FileCheck,
  Scissors,
  FolderUp,
  Database,
  ClipboardPaste
} from 'lucide-react';
import { OpenRouterSettings, BuildTurn, TemplateApp, ResearchFinding, PromptControllerConfig, UploadedFilePayload } from '../types';
import { TEMPLATES } from '../services/templates';
import { SAMPLE_MOCKUPS, SampleMockup } from '../services/mockups';
import {
  CodebaseFile,
  createCodebaseFile,
  exportVaultAsZip,
  ingestUploadedFiles,
  mergeCodebaseFiles,
  getCodebaseStats,
  saveCodebaseToVault,
  loadCodebaseFromVault,
  clearCodebaseFromVault
} from '../services/codebaseVault';
import { downloadSingleFile } from '../services/exporter';

interface LeftPanelAIStudioProps {
  onGenerate: (
    prompt: string, 
    image?: string | null,
    targetFile?: import('../types').TargetFileScope,
    researchMode?: 'with-research' | 'without-research' | 'auto',
    uploadedFile?: UploadedFilePayload,
    codebaseFiles?: CodebaseFile[]
  ) => Promise<void>;
  isGenerating: boolean;
  statusMessage: string;
  settings: OpenRouterSettings;
  onOpenSettings: (tab?: 'gemini' | 'openrouter' | 'groq' | 'research') => void;
  activePrompt: string;
  setActivePrompt: (prompt: string) => void;
  turns: BuildTurn[];
  onSelectTemplate: (template: TemplateApp) => void;
  activeProjectName: string;
  onResetProject: () => void;
  onViewLivePreview: () => void;
  onOpenFullScreenPreview?: () => void;
  onDownloadZip?: () => void;
  onDownloadModifiedFile?: (file: { name: string; content: string }) => void;
  promptControllerConfig: PromptControllerConfig;
  onUpdatePromptController: (newConfig: PromptControllerConfig) => void;
  onOpenPromptControllerModal: () => void;
  vaultSyncVersion?: number;
}

const QUICK_PROMPTS = [
  { label: '🔥 Habit Tracker', prompt: 'Build an interactive Habit Tracker app with local storage tracking, streaks, and categories' },
  { label: '🧮 Calculator', prompt: 'Build a working visual scientific calculator with dark theme and calculation history' },
  { label: '🎹 Beatbox Synth', prompt: 'Build an interactive Web Audio drum machine and piano synthesizer with 8 pads, sound wave visualizer, and keyboard triggers' },
  { label: '🎨 Neon Canvas', prompt: 'Build an interactive Neon Canvas Drawing Studio with glowing brushes, color wheel, undo/clear, and sparkle particle trail' },
  { label: '⛅ Weather Dashboard', prompt: 'Create an interactive weather dashboard with live forecast, city search, and metric cards' },
  { label: '📋 Kanban Board', prompt: 'Create a Kanban task management board with To Do, In Progress, and Completed columns' },
  { label: '⏳ Pomodoro Timer', prompt: 'Create a Pomodoro focus timer with circular progress and chime alerts' },
  { label: '🕹️ Cyber Snake Game', prompt: 'Create a retro arcade Snake game with score tracking, cyber neon style, and canvas animation' }
];

export const LeftPanelAIStudio: React.FC<LeftPanelAIStudioProps> = ({
  onGenerate,
  isGenerating,
  statusMessage,
  settings,
  onOpenSettings,
  activePrompt,
  setActivePrompt,
  turns,
  onSelectTemplate,
  activeProjectName,
  onResetProject,
  onViewLivePreview,
  onOpenFullScreenPreview,
  onDownloadZip,
  onDownloadModifiedFile,
  promptControllerConfig,
  onUpdatePromptController,
  onOpenPromptControllerModal,
  vaultSyncVersion = 0
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const threadEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const codeFileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  // Vision State
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [attachedImageName, setAttachedImageName] = useState<string>('');
  const [isDraggingOver, setIsDraggingOver] = useState<boolean>(false);
  const [showMockupPicker, setShowMockupPicker] = useState<boolean>(false);
  const [previewModalImage, setPreviewModalImage] = useState<string | null>(null);

  // Uploaded File & Massive Codebase Vault State
  const [uploadedFile, setUploadedFile] = useState<UploadedFilePayload | null>(null);
  const [showCodePreview, setShowCodePreview] = useState<boolean>(false);
  const [codebaseFiles, setCodebaseFiles] = useState<CodebaseFile[]>([]);
  const [isVaultDrawerOpen, setIsVaultDrawerOpen] = useState<boolean>(false);
  const [isPasteModalOpen, setIsPasteModalOpen] = useState<boolean>(false);
  const [pasteFileName, setPasteFileName] = useState<string>('pasted-code.tsx');
  const [pasteCodeContent, setPasteCodeContent] = useState<string>('');

  // Interactive Target File Scope and Research Controls
  const [selectedScope, setSelectedScope] = useState<import('../types').TargetFileScope>('all');
  const [selectedResearch, setSelectedResearch] = useState<'auto' | 'without-research' | 'with-research'>('auto');

  useEffect(() => {
    loadCodebaseFromVault('builder').then((saved) => {
      setCodebaseFiles(saved);
    });
  }, [vaultSyncVersion]);

  const vaultStats = getCodebaseStats(codebaseFiles);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(130, Math.max(54, textareaRef.current.scrollHeight))}px`;
    }
  }, [activePrompt]);

  // Auto-scroll to latest turn
  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [turns, isGenerating]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if ((!activePrompt.trim() && !attachedImage && !uploadedFile && codebaseFiles.length === 0) || isGenerating) return;

    const promptToSend = activePrompt.trim() || (
      codebaseFiles.length > 0
        ? `Analyze the uploaded codebase (${vaultStats.totalFiles} files, ${vaultStats.totalLines.toLocaleString()} lines) and build a complete interactive web application.`
        : uploadedFile
        ? `Edit only the ${uploadedFile.targetPart || 'specified part'} in ${uploadedFile.name} and nothing else.`
        : 'Generate a pixel-perfect, fully interactive web application matching this visual mockup.'
    );

    onGenerate(
      promptToSend,
      attachedImage,
      selectedScope,
      selectedResearch,
      uploadedFile || undefined,
      codebaseFiles.length > 0 ? codebaseFiles : undefined
    );
    setAttachedImage(null);
    setAttachedImageName('');
    setUploadedFile(null);
  };

  const handleQuickAction = (
    templateText: string, 
    scope: import('../types').TargetFileScope = 'all', 
    research: 'auto' | 'without-research' | 'with-research' = 'auto'
  ) => {
    setActivePrompt(templateText);
    setSelectedScope(scope);
    setSelectedResearch(research);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Handle image file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processImageFile(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Handle single OR massive multi-file / folder / ZIP uploads
  const ingestBuilderFiles = async (fileList: FileList | File[]) => {
    const arr = Array.from(fileList);
    if (arr.length === 0) return;

    const hasArchiveOrFolder = arr.some(
      (f) =>
        f.name.toLowerCase().endsWith('.zip') ||
        Boolean((f as File & { webkitRelativePath?: string }).webkitRelativePath)
    );

    // Single non-ZIP web file (< 150k chars) can still populate quick Surgical Mode if vault isn't multi-file yet
    const singleFile = arr.length === 1 && !arr[0].name.toLowerCase().endsWith('.zip') ? arr[0] : null;

    const { files: ingested } = await ingestUploadedFiles(arr);
    if (ingested.length === 0) return;

    if (singleFile && ingested.length === 1 && codebaseFiles.length === 0 && ingested[0].chars <= 80000) {
      const f = ingested[0];
      const fileType: 'html' | 'css' | 'js' | 'other' =
        f.ext === 'html' ? 'html' :
        f.ext === 'css' ? 'css' :
        (f.ext === 'js' || f.ext === 'ts' || f.ext === 'jsx' || f.ext === 'tsx') ? 'js' : 'other';

      setUploadedFile({
        name: f.name,
        content: f.content,
        type: fileType,
        targetPart: '',
        surgicalLock: true,
        lineCount: f.lines,
        sizeBytes: f.bytes
      });

      if (fileType === 'css') setSelectedScope('styles.css');
      else if (fileType === 'js') setSelectedScope('app.js');
      else if (fileType === 'html') setSelectedScope('index.html');
    }

    setCodebaseFiles((prev) => {
      const next = hasArchiveOrFolder ? ingested : mergeCodebaseFiles(prev, ingested);
      saveCodebaseToVault('builder', next);
      return next;
    });

    if (ingested.length > 1 || hasArchiveOrFolder || ingested[0].chars > 80000) {
      setUploadedFile(null);
      setIsVaultDrawerOpen(true);
    }
  };

  const handleCodeFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await ingestBuilderFiles(e.target.files);
    }
    if (codeFileInputRef.current) codeFileInputRef.current.value = '';
    if (folderInputRef.current) folderInputRef.current.value = '';
  };

  // Convert File to base64 Data URL
  const processImageFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Please select a valid image file (PNG, JPG, WEBP, or SVG).');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setAttachedImage(reader.result);
        setAttachedImageName(file.name);
      }
    };
    reader.readAsDataURL(file);
  };

  // Handle direct clipboard paste (e.g. screenshots from Win+Shift+S or Mac Cmd+Shift+4)
  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          e.preventDefault();
          processImageFile(file);
          setAttachedImageName('Pasted Screenshot');
          break;
        }
      }
    }
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      if (files.length === 1 && files[0].type.startsWith('image/')) {
        processImageFile(files[0]);
      } else {
        await ingestBuilderFiles(files);
      }
    }
  };

  // Select pre-built sample mockup for fast vision testing
  const handleSelectSampleMockup = (mockup: SampleMockup) => {
    setAttachedImage(mockup.dataUrl);
    setAttachedImageName(mockup.title);
    if (!activePrompt.trim()) {
      setActivePrompt(mockup.recommendedPrompt);
    }
    setShowMockupPicker(false);
  };

  const hasResearchKeys = Boolean(settings.tavilyApiKey?.trim() || settings.serperApiKey?.trim());
  const isNemotronModel = settings.model.includes('nemotron') || settings.model === 'nvidia/nemotron-3.5-super-vl:free';

  return (
    <div className="w-full lg:w-[420px] xl:w-[480px] h-full flex flex-col bg-slate-950 border-r border-slate-800 shrink-0">
      {/* Hidden file inputs for multiple code files, ZIPs, folders, and images */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />
      <input
        ref={codeFileInputRef}
        type="file"
        multiple
        onChange={handleCodeFileUpload}
        className="hidden"
      />
      <input
        ref={folderInputRef}
        type="file"
        multiple
        {...({ webkitdirectory: '', directory: '' } as any)}
        onChange={handleCodeFileUpload}
        className="hidden"
      />

      {/* Top Header of Left Panel: Google AI Studio Style Title & Project Details */}
      <div className="h-14 px-4 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between shrink-0 select-none">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-slate-950 font-black shadow-sm font-mono text-sm">
            SX
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-sm text-slate-100 truncate max-w-[170px]">
                {activeProjectName}
              </span>
              <span className="text-[10px] px-1 rounded bg-slate-800 text-slate-400 font-mono">
                Applet
              </span>
            </div>
            <div className="text-[10px] text-slate-400 flex items-center gap-1">
              <span>Google AI Studio Environment</span>
            </div>
          </div>
        </div>

        {/* Quick Actions: Live Preview, Templates Picker & Reset */}
        <div className="flex items-center gap-1.5">
          {/* Prominent Live Preview Fullscreen Button */}
          <button
            onClick={onOpenFullScreenPreview || onViewLivePreview}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-black text-[11px] rounded-lg shadow-sm border border-emerald-300/40 transition-all cursor-pointer active:scale-95 group"
            title="Press to see Live Preview covering the entire screen"
          >
            <Eye className="w-3.5 h-3.5 text-slate-950 group-hover:scale-110 transition-transform" />
            <span>Live Preview</span>
            <Maximize2 className="w-3 h-3 text-slate-950/80" />
          </button>

          <div className="relative group">
            <button
              className="flex items-center gap-1 text-[11px] font-medium bg-slate-900 hover:bg-slate-800 text-slate-300 px-2 py-1 rounded border border-slate-800 transition-colors"
            >
              <Layers className="w-3 h-3 text-cyan-400" />
              <span>Presets</span>
              <ChevronDown className="w-2.5 h-2.5 text-slate-500" />
            </button>
            <div className="absolute right-0 mt-1 w-52 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl py-1 hidden group-hover:block z-50">
              <div className="px-3 py-1 text-[10px] uppercase font-semibold text-slate-500 tracking-wider">
                Built-in Apps
              </div>
              {TEMPLATES.map(tpl => (
                <button
                  key={tpl.id}
                  onClick={() => onSelectTemplate(tpl)}
                  className="w-full text-left px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800 hover:text-cyan-400 flex items-center justify-between transition-colors"
                >
                  <span>{tpl.name}</span>
                  <span className="text-[10px] text-slate-500">{tpl.category}</span>
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={onResetProject}
            className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors"
            title="Reset Project State"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Model & Web Research Indicator Bar */}
      <div className="px-4 py-2 border-b border-slate-800/80 bg-slate-950/80 flex items-center justify-between text-xs shrink-0">
        <div className="flex items-center gap-2">
          {settings.useGemini !== false ? (
            <button
              onClick={() => onOpenSettings('gemini')}
              className="flex items-center gap-1.5 text-[11px] font-mono text-blue-300 bg-blue-950/40 border border-blue-800/40 px-2 py-0.5 rounded-full hover:bg-blue-900/50 transition-colors cursor-pointer"
            >
              <Zap className="w-3 h-3 text-blue-400" />
              <span className="truncate max-w-[140px]">
                {settings.geminiModel || 'gemini-4-hydrogen'}
              </span>
              {settings.groqApiKey?.trim() && settings.useGroqFallback !== false && (
                <span className="text-[9px] text-orange-300 font-bold">+Groq</span>
              )}
            </button>
          ) : settings.useOpenRouter && settings.apiKey ? (
            <button
              onClick={() => onOpenSettings('openrouter')}
              className="flex items-center gap-1.5 text-[11px] font-mono text-emerald-300 bg-emerald-950/40 border border-emerald-800/40 px-2 py-0.5 rounded-full hover:bg-emerald-900/50 transition-colors"
            >
              <Zap className="w-3 h-3 text-emerald-400" />
              <span className="truncate max-w-[130px]">
                {(settings.model === 'custom' && settings.customModel?.trim()
                  ? settings.customModel.trim()
                  : settings.model
                ).split('/').pop()}
              </span>
              <span className="text-[10px] opacity-75">T:{settings.temperature}</span>
              {settings.groqApiKey?.trim() && settings.useGroqFallback !== false && (
                <span className="text-[9px] text-orange-300 font-bold">+Groq</span>
              )}
            </button>
          ) : settings.groqApiKey?.trim() && settings.useGroqFallback !== false ? (
            <button
              onClick={() => onOpenSettings('groq')}
              className="flex items-center gap-1.5 text-[11px] font-mono text-orange-300 bg-orange-950/40 border border-orange-800/40 px-2 py-0.5 rounded-full hover:bg-orange-900/50 transition-colors"
            >
              <Zap className="w-3 h-3 text-orange-400" />
              <span className="truncate max-w-[140px]">
                Groq: {(settings.groqModel === 'custom' && settings.groqCustomModel?.trim()
                  ? settings.groqCustomModel.trim()
                  : settings.groqModel || 'llama-3.3-70b-versatile')}
              </span>
            </button>
          ) : (
            <button
              onClick={() => onOpenSettings('gemini')}
              className="flex items-center gap-1.5 text-[11px] font-mono text-cyan-300 bg-cyan-950/40 border border-cyan-800/40 px-2 py-0.5 rounded-full hover:bg-cyan-900/50 transition-colors"
            >
              <Sparkles className="w-3 h-3 text-cyan-400" />
              <span>StudioX Fast Compiler</span>
            </button>
          )}

          {/* Direct Groq Key Shortcut */}
          <button
            onClick={() => onOpenSettings('groq')}
            className="flex items-center gap-1 text-[10px] font-mono text-orange-300 bg-orange-950/30 hover:bg-orange-900/40 border border-orange-800/40 px-2 py-0.5 rounded-full transition-colors cursor-pointer"
            title="Enter or configure your Groq API key"
          >
            <span>{settings.groqApiKey?.trim() ? 'Groq Key ✓' : '+ Groq Key'}</span>
          </button>

          {/* Zero-Mistake Vision Badge */}
          <span 
            className="flex items-center gap-1 text-[10px] font-mono text-cyan-300 bg-cyan-950/40 border border-cyan-800/40 px-2 py-0.5 rounded-full"
            title="Zero-Mistake Precision Protocol Active"
          >
            <CheckCircle2 className="w-2.5 h-2.5 text-cyan-400" />
            <span>Zero-Mistake</span>
          </span>

          {hasResearchKeys && settings.enableWebResearch && (
            <span
              className="hidden sm:flex items-center gap-1 text-[11px] text-emerald-300 bg-emerald-950/40 border border-emerald-800/40 px-2 py-0.5 rounded-full font-mono"
              title="Autonomous web research grounding via Tavily / Serper"
            >
              <Globe className="w-3 h-3 text-emerald-400" />
              <span>Research: ON</span>
            </span>
          )}
        </div>

        <button
          onClick={() => onOpenSettings('gemini')}
          className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 transition-colors"
          title="Configure Model, Keys & Research"
        >
          <Settings2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Center: Conversation & Build Iteration History (Google AI Studio prompt canvas style) */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        {turns.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-slate-500">
            <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-cyan-400 mb-3 shadow-inner">
              <Bot className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-semibold text-slate-300 mb-1">Google AI Studio Build Canvas</h3>
            <p className="text-xs text-slate-500 max-w-xs leading-relaxed">
              Describe an app or attach a design mockup/screenshot. Nemotron 3.5 Super VL will analyze the visual layout, write pristine code, and run it live in the Digital Workshop.
            </p>
          </div>
        ) : (
          turns.map((turn, idx) => (
            <div key={turn.id} className="flex flex-col gap-2.5">
              {/* User Prompt Turn */}
              <div className="flex items-start gap-2.5 self-end max-w-[90%]">
                <div className="p-3 rounded-2xl bg-cyan-950/60 border border-cyan-800/50 text-xs text-slate-100 shadow-md leading-relaxed">
                  <div className="flex items-center justify-between gap-4 mb-1 text-[10px] text-cyan-400/80 font-mono">
                    <span className="font-semibold">Prompt Turn #{idx + 1}</span>
                    <span>{turn.timestamp}</span>
                  </div>

                  {/* If user attached an image in this turn */}
                  {turn.image && (
                    <div className="mb-2 relative rounded-lg overflow-hidden border border-cyan-700/60 max-w-[200px]">
                      <img 
                        src={turn.image} 
                        alt="Attached design mockup" 
                        className="w-full max-h-36 object-cover object-top cursor-pointer hover:opacity-90 transition-opacity"
                        onClick={() => setPreviewModalImage(turn.image || null)}
                      />
                      <div className="absolute bottom-1 left-1 bg-slate-950/80 backdrop-blur-xs text-[9px] text-cyan-300 px-1.5 py-0.5 rounded font-mono">
                        Vision Input
                      </div>
                    </div>
                  )}

                  <p className="font-sans text-[13px]">{turn.prompt}</p>
                </div>
                <div className="w-6 h-6 rounded-full bg-cyan-600 text-slate-950 font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                  U
                </div>
              </div>

              {/* AI Generation Response Turn */}
              <div className="flex items-start gap-2.5 self-start max-w-[95%]">
                <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-cyan-500 to-blue-600 text-slate-950 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                  SX
                </div>
                <div className="p-3 rounded-2xl bg-slate-900/90 border border-slate-800 text-xs text-slate-300 shadow-md flex flex-col gap-2 w-full">
                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                    <span className="flex items-center gap-1 text-emerald-400 font-semibold">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>{turn.status === 'completed' ? 'Zero-Mistake Code Compiled' : 'Compiling...'}</span>
                    </span>
                    <span>{turn.model}</span>
                  </div>

                  {/* Interactive Intent Badges */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {turn.actionType && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-mono font-bold bg-slate-800 text-slate-300 border border-slate-700">
                        {turn.actionType === 'edit' ? '✏️ Edit' : '✨ Generate'}
                      </span>
                    )}

                    {turn.targetFile && turn.targetFile !== 'all' && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-mono font-bold bg-cyan-950/60 text-cyan-300 border border-cyan-800/60">
                        📄 {turn.targetFile}
                      </span>
                    )}

                    {turn.researchMode === 'without-research' ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-mono font-bold bg-amber-950/40 text-amber-300 border border-amber-800/50">
                        ⚡ Without Research
                      </span>
                    ) : turn.researchFinding ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-mono font-bold bg-emerald-950/40 text-emerald-300 border border-emerald-800/50">
                        🔍 Researched ({turn.researchFinding.provider.toUpperCase()})
                      </span>
                    ) : null}
                  </div>

                  {/* Uploaded File Surgical Edit Notice */}
                  {turn.uploadedFile && (
                    <div className="flex items-center gap-2 p-2 bg-slate-950 border border-amber-800/60 rounded-lg text-[11px] text-amber-300 font-mono">
                      <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <div className="flex flex-col min-w-0">
                        <span className="font-semibold text-slate-100">
                          Surgical Edit: {turn.uploadedFile.name}
                        </span>
                        <span className="text-[10px] text-amber-400">
                          Target Part: {turn.uploadedFile.targetPart || 'Requested Section'} • [All other code locked and untouched]
                        </span>
                      </div>
                      <span className="text-emerald-400 font-bold ml-auto text-[10px] hidden sm:inline">
                        ✓ Only that part edited
                      </span>
                    </div>
                  )}

                  {turn.summary && (
                    <p className="text-[12px] text-slate-200 leading-relaxed">{turn.summary}</p>
                  )}

                  {turn.explanation && (
                    <p className="text-[11px] text-slate-400 font-mono leading-relaxed bg-slate-950/60 p-2 rounded-lg border border-slate-800/60">
                      💡 {turn.explanation}
                    </p>
                  )}

                  {/* If research was performed for this turn */}
                  {turn.researchFinding && (
                    <div className="p-2 bg-slate-950 border border-emerald-900/40 rounded-lg text-[11px] text-emerald-300/90 flex flex-col gap-1">
                      <span className="font-semibold font-mono text-[10px] text-emerald-400 flex items-center gap-1">
                        <Search className="w-3 h-3" />
                        <span>Researched via {turn.researchFinding.provider.toUpperCase()}</span>
                      </span>
                      <p className="text-slate-300 text-[11px] line-clamp-2">
                        {turn.researchFinding.summary}
                      </p>
                    </div>
                  )}

                  {/* Interactive Quick Actions Bar for This Turn */}
                  <div className="flex flex-wrap items-center gap-1 pt-1.5 border-t border-slate-800/60">
                    <span className="text-[10px] text-slate-500 font-mono mr-1">Ask AI:</span>
                    <button
                      type="button"
                      onClick={() => handleQuickAction('Edit styles.css without researching: ', 'styles.css', 'without-research')}
                      className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-950 hover:bg-slate-800 text-cyan-300 border border-slate-800 transition-colors cursor-pointer"
                      title="Edit styles.css without researching"
                    >
                      ✏️ Edit styles (No research)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickAction('Edit app.js without researching: ', 'app.js', 'without-research')}
                      className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-950 hover:bg-slate-800 text-cyan-300 border border-slate-800 transition-colors cursor-pointer"
                      title="Edit app.js without researching"
                    >
                      ⚡ Edit app.js (No research)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickAction(`Research and upgrade: ${turn.prompt}`, 'all', 'with-research')}
                      className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-950 hover:bg-slate-800 text-purple-300 border border-slate-800 transition-colors cursor-pointer"
                      title="Re-run with research"
                    >
                      🔍 With Research
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickAction(`Generate without researching: ${turn.prompt}`, 'all', 'without-research')}
                      className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-950 hover:bg-slate-800 text-amber-300 border border-slate-800 transition-colors cursor-pointer"
                      title="Re-run without research"
                    >
                      ⚡ No Research
                    </button>
                  </div>

                  {/* Action to switch to Live Preview Panel */}
                  <div className="flex items-center justify-between pt-1 border-t border-slate-800/60 mt-0.5">
                    <span className="text-[10px] text-slate-500 font-mono">Sandbox Live</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={onViewLivePreview}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-cyan-400 hover:text-cyan-300 bg-cyan-950/60 hover:bg-cyan-900/60 border border-cyan-800/50 px-2 py-0.5 rounded cursor-pointer transition-colors shadow-sm"
                        title="View preview inside the digital workshop"
                      >
                        <Eye className="w-3 h-3" />
                        <span>Preview</span>
                      </button>
                      <button
                        type="button"
                        onClick={onOpenFullScreenPreview || onViewLivePreview}
                        className="inline-flex items-center gap-1 text-[11px] font-extrabold text-slate-950 bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 px-2.5 py-0.5 rounded cursor-pointer transition-all shadow-sm"
                        title="Expand preview to cover the entire screen"
                      >
                        <Maximize2 className="w-3 h-3 text-slate-950" />
                        <span>Cover Entire Screen ⛶</span>
                      </button>
                      {turn.modifiedFiles && turn.modifiedFiles.length > 0 && turn.modifiedFiles.slice(0, 3).map((mf) => (
                        <button
                          key={mf.path}
                          type="button"
                          onClick={() =>
                            onDownloadModifiedFile
                              ? onDownloadModifiedFile(mf)
                              : downloadSingleFile(mf.name, mf.content)
                          }
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-300 hover:text-emerald-200 bg-emerald-950/60 hover:bg-emerald-900/60 border border-emerald-700/50 px-2 py-0.5 rounded cursor-pointer transition-colors shadow-sm"
                          title={`Download edited file ${mf.path}`}
                        >
                          <Download className="w-3 h-3" />
                          <span className="max-w-[130px] truncate">Download {mf.name}</span>
                        </button>
                      ))}
                      {onDownloadZip && (
                        <button
                          type="button"
                          onClick={onDownloadZip}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-300 hover:text-amber-200 bg-amber-950/60 hover:bg-amber-900/60 border border-amber-700/50 px-2 py-0.5 rounded cursor-pointer transition-colors shadow-sm"
                          title="Download modified project/app as a ZIP archive"
                        >
                          <Download className="w-3 h-3" />
                          <span>Download ZIP</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}

        {/* Live compilation status banner */}
        {isGenerating && (
          <div className="flex items-center gap-2 p-3 bg-cyan-950/40 border border-cyan-800/40 rounded-xl text-xs text-cyan-300 font-mono animate-pulse">
            <Loader2 className="w-4 h-4 animate-spin text-cyan-400 shrink-0" />
            <span>{statusMessage || 'Compiling application code...'}</span>
          </div>
        )}

        <div ref={threadEndRef} />
      </div>

      {/* Quick Inspiration Chips */}
      <div className="px-3 pt-2 pb-1 border-t border-slate-800/60 bg-slate-950 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
        <span className="text-[10px] uppercase font-bold text-slate-500 font-mono shrink-0">Chips:</span>
        {QUICK_PROMPTS.map((item, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => {
              setActivePrompt(item.prompt);
              onGenerate(item.prompt, attachedImage, selectedScope, selectedResearch);
            }}
            className="px-2 py-0.5 text-[11px] bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-cyan-300 border border-slate-800 rounded-md whitespace-nowrap transition-colors shrink-0 cursor-pointer"
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Bottom Floating Prompt Command Bar (Google AI Studio style) with Vision & Drag/Drop */}
      <div 
        className={`p-3 border-t border-slate-800 bg-slate-900/90 select-none transition-colors ${
          isDraggingOver ? 'bg-cyan-950/40 border-cyan-500/80' : ''
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* PROMPT CONTROLLER BAR: Controls when to think outside the box & custom directives */}
        <div className="mb-2 p-1.5 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between gap-1 shadow-inner">
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-slate-500 uppercase font-mono px-1 font-bold">Strategy:</span>
            
            {/* Mode 1: Strict (Do NOT think outside the box) */}
            <button
              type="button"
              onClick={() => onUpdatePromptController({ ...promptControllerConfig, thinkingMode: 'strict' })}
              className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                promptControllerConfig.thinkingMode === 'strict'
                  ? 'bg-cyan-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
              title="Do NOT think outside the box. Implement strictly and literally what was asked."
            >
              <Target className="w-2.5 h-2.5" />
              <span>Strict Mode</span>
            </button>

            {/* Mode 2: Think Outside The Box */}
            <button
              type="button"
              onClick={() => onUpdatePromptController({ ...promptControllerConfig, thinkingMode: 'outside-the-box' })}
              className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                promptControllerConfig.thinkingMode === 'outside-the-box'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
              title="Think outside the box! Enrich with autonomous research, micro-interactions, audio, and innovative design."
            >
              <Brain className="w-2.5 h-2.5" />
              <span>Think Outside Box</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            </button>
          </div>

          {/* Open Full Controller & Custom Directives Drawer */}
          <button
            type="button"
            onClick={onOpenPromptControllerModal}
            className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-cyan-300 px-2 py-0.5 rounded-lg hover:bg-slate-900 transition-colors cursor-pointer border border-transparent hover:border-slate-800 font-medium"
            title="Configure AI Directives, Must-Follow Rules, and Behavioral Guardrails"
          >
            <Sliders className="w-3 h-3 text-cyan-400" />
            <span className="hidden sm:inline">Directives</span>
            {promptControllerConfig.customDirectives.trim() && (
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" title="Custom rules active" />
            )}
          </button>
        </div>

        {/* INTERACTIVE TARGET FILE & RESEARCH MODE SELECTOR */}
        <div className="mb-2 p-1.5 bg-slate-950/80 rounded-xl border border-slate-800/80 flex flex-col gap-1.5 shadow-inner">
          <div className="flex items-center justify-between gap-1 flex-wrap text-[10px]">
            {/* File Target Buttons */}
            <div className="flex items-center gap-1">
              <span className="text-slate-500 font-mono uppercase font-bold mr-0.5">Target:</span>
              {(['all', 'index.html', 'styles.css', 'app.js'] as const).map(scope => (
                <button
                  key={scope}
                  type="button"
                  onClick={() => setSelectedScope(scope)}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors cursor-pointer ${
                    selectedScope === scope
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 font-bold'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent'
                  }`}
                  title={`Target ${scope === 'all' ? 'the entire app' : scope}`}
                >
                  {scope === 'all' ? '🌐 All' : scope === 'index.html' ? '📄 HTML' : scope === 'styles.css' ? '🎨 CSS' : '⚡ JS'}
                </button>
              ))}
            </div>

            {/* Research Mode Buttons */}
            <div className="flex items-center gap-1">
              <span className="text-slate-500 font-mono uppercase font-bold mr-0.5">Research:</span>
              <button
                type="button"
                onClick={() => setSelectedResearch('without-research')}
                className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors cursor-pointer ${
                  selectedResearch === 'without-research'
                    ? 'bg-amber-950 text-amber-300 border border-amber-600/60 font-bold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent'
                }`}
                title="Strictly generate/edit WITHOUT researching (Offline/Direct)"
              >
                ⚡ Without Research
              </button>
              <button
                type="button"
                onClick={() => setSelectedResearch('with-research')}
                className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors cursor-pointer ${
                  selectedResearch === 'with-research'
                    ? 'bg-purple-950 text-purple-300 border border-purple-600/60 font-bold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent'
                }`}
                title="Actively query web research engine (Serper / Tavily)"
              >
                🔍 With Research
              </button>
              <button
                type="button"
                onClick={() => setSelectedResearch('auto')}
                className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors cursor-pointer ${
                  selectedResearch === 'auto'
                    ? 'bg-slate-800 text-slate-200 border border-slate-700 font-bold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent'
                }`}
                title="Automatically detect research requirement from prompt"
              >
                Auto
              </button>
            </div>
          </div>

          {/* Quick Action Pills for Immediate Editing Without Research */}
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pt-1 border-t border-slate-900">
            <span className="text-[9px] text-slate-500 font-mono uppercase font-bold shrink-0">Quick Ask:</span>
            <button
              type="button"
              onClick={() => handleQuickAction('Edit styles.css without researching: Make buttons rounded, modern cyan glow, and glassy cards', 'styles.css', 'without-research')}
              className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-cyan-300 hover:text-cyan-200 border border-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              ✏️ Edit styles (No research)
            </button>
            <button
              type="button"
              onClick={() => handleQuickAction('Edit app.js without researching: Add synthesized Web Audio sound feedback on button clicks', 'app.js', 'without-research')}
              className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-cyan-300 hover:text-cyan-200 border border-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              ⚡ Edit app.js (No research)
            </button>
            <button
              type="button"
              onClick={() => handleQuickAction('Edit index.html without researching: Add a top welcome header banner and stat counter', 'index.html', 'without-research')}
              className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-cyan-300 hover:text-cyan-200 border border-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              📄 Edit index.html (No research)
            </button>
            <button
              type="button"
              onClick={() => handleQuickAction('Generate without researching: Visual scientific calculator with calculation history', 'all', 'without-research')}
              className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-amber-300 hover:text-amber-200 border border-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              ⚡ Generate (No research)
            </button>
            <button
              type="button"
              onClick={() => handleQuickAction('Research and build an interactive crypto price tracker with live market cards', 'all', 'with-research')}
              className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-purple-300 hover:text-purple-200 border border-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              🔍 Generate (With research)
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="relative flex flex-col gap-2">
          {/* Codebase Vault Summary for Multi-File / Massive Code Uploads */}
          {codebaseFiles.length > 0 && !uploadedFile && (
            <div className="p-2.5 bg-slate-950 border border-cyan-500/40 rounded-xl shadow-lg flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Database className="w-4 h-4 text-cyan-400 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-cyan-200 tabular-nums truncate">
                      Codebase Vault: {vaultStats.totalFiles} file{vaultStats.totalFiles === 1 ? '' : 's'}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono tabular-nums">
                      {vaultStats.totalLines.toLocaleString()} lines · {vaultStats.totalChars.toLocaleString()} chars indexed
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => exportVaultAsZip(codebaseFiles, activeProjectName || 'studiox-codebase')}
                    className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 rounded border border-emerald-500/35 cursor-pointer"
                    title="Download current vault files (with edits) as ZIP"
                  >
                    <Download className="w-2.5 h-2.5" />
                    <span>ZIP</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsVaultDrawerOpen((v) => !v)}
                    className="px-2 py-0.5 text-[10px] bg-slate-900 hover:bg-slate-800 text-slate-300 rounded border border-slate-800 cursor-pointer"
                  >
                    {isVaultDrawerOpen ? 'Hide' : 'Files'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCodebaseFiles([]);
                      setIsVaultDrawerOpen(false);
                      clearCodebaseFromVault('builder');
                    }}
                    className="px-2 py-0.5 text-[10px] bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 rounded border border-rose-500/30 cursor-pointer"
                  >
                    Clear
                  </button>
                </div>
              </div>
              {isVaultDrawerOpen && (
                <div className="max-h-32 overflow-y-auto space-y-1 pt-1.5 border-t border-slate-800">
                  {codebaseFiles.map((f) => (
                    <div key={f.path} className="flex items-center justify-between gap-2 text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-900/70">
                      <span className="truncate text-slate-200">{f.path}</span>
                      <div className="flex items-center gap-2 text-slate-400 shrink-0 tabular-nums">
                        <span>{f.lines.toLocaleString()}L</span>
                        <button
                          type="button"
                          onClick={() =>
                            onDownloadModifiedFile
                              ? onDownloadModifiedFile(f)
                              : downloadSingleFile(f.name, f.content)
                          }
                          className="text-slate-400 hover:text-emerald-300 cursor-pointer"
                          title={`Download ${f.path}`}
                        >
                          <Download className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setCodebaseFiles((prev) => {
                              const next = prev.filter((item) => item.path !== f.path);
                              saveCodebaseToVault('builder', next);
                              return next;
                            });
                          }}
                          className="text-slate-500 hover:text-rose-400 cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Active Uploaded Code File & Surgical Precision Panel */}
          {uploadedFile && (
            <div className="p-2.5 bg-slate-950 border border-amber-600/50 rounded-xl shadow-lg flex flex-col gap-2 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-amber-950/60 border border-amber-700/60 flex items-center justify-center text-amber-400 shrink-0">
                    <FileCode className="w-4 h-4" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-slate-100 font-mono truncate max-w-[200px]">
                        {uploadedFile.name}
                      </span>
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-950 text-amber-300 border border-amber-700 font-mono font-bold">
                        {uploadedFile.lineCount} lines • {uploadedFile.type.toUpperCase()}
                      </span>
                    </div>
                    <span className="text-[10px] text-amber-400/90 flex items-center gap-1 font-mono">
                      <Lock className="w-2.5 h-2.5" />
                      <span>Surgical Mode: Edit ONLY specified part and nothing else</span>
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setShowCodePreview(!showCodePreview)}
                    className="px-2 py-0.5 text-[10px] bg-slate-900 hover:bg-slate-800 text-slate-300 rounded border border-slate-800 transition-colors cursor-pointer"
                  >
                    {showCodePreview ? 'Hide Code' : 'Peek Code'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setUploadedFile(null)}
                    className="p-1 rounded text-slate-400 hover:text-red-400 hover:bg-slate-900 transition-colors cursor-pointer"
                    title="Remove uploaded file"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Collapsible Code Peek */}
              {showCodePreview && (
                <div className="max-h-36 overflow-auto bg-slate-900/90 p-2 rounded-lg border border-slate-800 font-mono text-[10px] text-slate-300 whitespace-pre">
                  {uploadedFile.content.slice(0, 30000)}
                </div>
              )}

              {/* Target Part Input & Quick Selector */}
              <div className="flex flex-col gap-1.5 pt-1 border-t border-slate-900">
                <div className="flex items-center gap-1.5">
                  <Scissors className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <input
                    type="text"
                    value={uploadedFile.targetPart || ''}
                    onChange={(e) => setUploadedFile({ ...uploadedFile, targetPart: e.target.value })}
                    placeholder="Specify part to edit (e.g. 'button styles', 'calculate function', 'header')..."
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-amber-200 placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                </div>

                {/* Quick Part Suggestions */}
                <div className="flex items-center gap-1 flex-wrap text-[9px] font-mono">
                  <span className="text-slate-500 font-bold">Quick Target:</span>
                  {['Button styles', 'Header section', 'Calculation logic', 'Colors & theme', 'Reset state handler'].map(part => (
                    <button
                      key={part}
                      type="button"
                      onClick={() => {
                        setUploadedFile({ ...uploadedFile, targetPart: part });
                        setActivePrompt(`Edit only the ${part} in ${uploadedFile.name} and nothing else: `);
                        textareaRef.current?.focus();
                      }}
                      className="px-1.5 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-amber-300 hover:text-amber-200 border border-slate-800 transition-colors cursor-pointer"
                    >
                      + {part}
                    </button>
                  ))}
                </div>

                {/* Strict Isolation Toggle & Start Edit Action Button */}
                <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-slate-900">
                  <label className="flex items-center gap-1.5 text-[10px] text-slate-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={uploadedFile.surgicalLock}
                      onChange={(e) => setUploadedFile({ ...uploadedFile, surgicalLock: e.target.checked })}
                      className="rounded border-slate-700 text-amber-500 focus:ring-amber-500 cursor-pointer"
                    />
                    <span>Lock 100% of other code</span>
                  </label>

                  <button
                    type="button"
                    onClick={() => handleSubmit()}
                    disabled={isGenerating}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer shrink-0 ${
                      isGenerating
                        ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
                        : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 shadow-md shadow-amber-500/20 active:scale-95'
                    }`}
                    title="Start editing only the specified part of this file now"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span>Editing...</span>
                      </>
                    ) : (
                      <>
                        <Scissors className="w-3 h-3" />
                        <span>Start Surgical Edit</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Active Visual Attachment Preview Pill */}
          {attachedImage && (
            <div className="flex items-center justify-between p-2 bg-slate-950 border border-cyan-800/60 rounded-xl shadow-md animate-in fade-in duration-150">
              <div className="flex items-center gap-2.5 overflow-hidden">
                <div 
                  className="w-10 h-10 rounded-lg overflow-hidden border border-cyan-600/40 shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() => setPreviewModalImage(attachedImage)}
                >
                  <img src={attachedImage} alt="Attachment" className="w-full h-full object-cover object-top" />
                </div>
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-semibold text-slate-200 truncate">
                      {attachedImageName || 'Visual UI Mockup'}
                    </span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800/80 font-mono">
                      Vision Active
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400">
                    Nemotron 3.5 Super VL will analyze and replicate this design
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setAttachedImage(null);
                  setAttachedImageName('');
                }}
                className="p-1 rounded-md text-slate-400 hover:text-red-400 hover:bg-slate-900 transition-colors cursor-pointer"
                title="Remove attached mockup"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <div className="relative">
            <textarea
              ref={textareaRef}
              value={activePrompt}
              onChange={(e) => setActivePrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder={
                codebaseFiles.length > 0
                  ? `Tell AI what to build, upgrade, or fix across your ${vaultStats.totalFiles} uploaded file(s)...`
                  : uploadedFile
                  ? `Tell AI what to edit in ${uploadedFile.name} (e.g. 'make the button bounce and neon glow', 'add reset function')...`
                  : attachedImage 
                  ? "Describe modifications or let Nemotron build the exact mockup (press Enter to run)..."
                  : "Describe any app, paste/drop multiple code files, ZIPs, or folders..."
              }
              rows={1}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500/80 focus:ring-1 focus:ring-cyan-500/50 resize-none font-sans leading-relaxed pr-24 shadow-inner"
            />

            <button
              type="submit"
              disabled={isGenerating || (!activePrompt.trim() && !attachedImage && !uploadedFile && codebaseFiles.length === 0)}
              className={`absolute right-1.5 bottom-1.5 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                isGenerating || (!activePrompt.trim() && !attachedImage && !uploadedFile && codebaseFiles.length === 0)
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
                  : 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 shadow-md shadow-cyan-500/20 active:scale-95'
              }`}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Building</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Run</span>
                  <CornerDownLeft className="w-3 h-3 opacity-60" />
                </>
              )}
            </button>
          </div>

          {/* Bottom Toolbar: Upload Files/ZIP/Folder, Paste Huge Code, Attach image, Sample Mockups */}
          <div className="flex items-center justify-between text-[10px] text-slate-500 px-1 font-mono flex-wrap gap-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => codeFileInputRef.current?.click()}
                className="flex items-center gap-1 text-slate-300 hover:text-amber-300 hover:bg-slate-800/80 px-1.5 py-1 rounded transition-colors cursor-pointer"
                title="Upload multiple code files or .zip archives at once (supports hundreds of thousands of lines)"
              >
                <FileCode className="w-3.5 h-3.5 text-amber-400" />
                <span>Files / ZIP</span>
              </button>

              <button
                type="button"
                onClick={() => folderInputRef.current?.click()}
                className="flex items-center gap-1 text-slate-300 hover:text-emerald-300 hover:bg-slate-800/80 px-1.5 py-1 rounded transition-colors cursor-pointer"
                title="Upload an entire code folder"
              >
                <FolderUp className="w-3.5 h-3.5 text-emerald-400" />
                <span>Folder</span>
              </button>

              <button
                type="button"
                onClick={() => setIsPasteModalOpen(true)}
                className="flex items-center gap-1 text-slate-300 hover:text-cyan-300 hover:bg-slate-800/80 px-1.5 py-1 rounded transition-colors cursor-pointer"
                title="Paste hundreds of thousands of characters of code into the builder's Codebase Vault"
              >
                <ClipboardPaste className="w-3.5 h-3.5 text-cyan-400" />
                <span>Paste Huge Code</span>
              </button>

              {/* Attach Mockup Button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1 text-slate-400 hover:text-cyan-400 hover:bg-slate-800/80 px-1.5 py-1 rounded transition-colors cursor-pointer"
                title="Attach UI screenshot, wireframe, or mockup image (or paste with Ctrl+V)"
              >
                <ImageIcon className="w-3.5 h-3.5 text-cyan-400" />
                <span>Mockup</span>
              </button>

              {/* Sample Mockup Picker Dropdown */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowMockupPicker(!showMockupPicker)}
                  className="flex items-center gap-1 text-slate-400 hover:text-emerald-400 hover:bg-slate-800/80 px-1.5 py-1 rounded transition-colors cursor-pointer"
                  title="Try sample UI mockups with Nemotron 3.5 Super VL vision"
                >
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Sample Mockups</span>
                  <ChevronDown className="w-2.5 h-2.5 text-slate-500" />
                </button>

                {showMockupPicker && (
                  <div className="absolute left-0 bottom-full mb-2 w-72 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-2 z-50 flex flex-col gap-1.5">
                    <div className="flex items-center justify-between px-2 py-1 border-b border-slate-800 text-[10px] text-slate-400 font-sans font-semibold">
                      <span>Test Nemotron Vision with Mockup</span>
                      <button 
                        type="button" 
                        onClick={() => setShowMockupPicker(false)}
                        className="text-slate-500 hover:text-slate-300"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>

                    {SAMPLE_MOCKUPS.map((mockup) => (
                      <button
                        key={mockup.id}
                        type="button"
                        onClick={() => handleSelectSampleMockup(mockup)}
                        className="flex items-center gap-2.5 p-2 rounded-lg bg-slate-950/60 hover:bg-slate-800/80 border border-slate-800 hover:border-cyan-500/50 text-left transition-colors cursor-pointer group"
                      >
                        <div className="w-9 h-9 rounded overflow-hidden border border-slate-700 shrink-0">
                          <img src={mockup.dataUrl} alt={mockup.title} className="w-full h-full object-cover object-top" />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-[11px] font-semibold text-slate-200 group-hover:text-cyan-300 truncate">
                            {mockup.title}
                          </span>
                          <span className="text-[9px] text-slate-400 line-clamp-1">
                            {mockup.description}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="hidden sm:flex items-center gap-1.5 text-slate-400">
              <span>Paste image with <kbd className="text-slate-300 font-bold">Ctrl+V</kbd></span>
            </div>
          </div>
        </form>
      </div>

      {/* Massive Code Paste Modal for App Builder Vault */}
      {isPasteModalOpen && (
        <div
          className="fixed inset-0 bg-slate-950/90 z-50 flex items-center justify-center p-4 backdrop-blur-xs"
          onClick={() => setIsPasteModalOpen(false)}
        >
          <div
            className="w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-cyan-400" />
                <span className="text-sm font-semibold text-slate-100">
                  Paste Massive Codebase into App Builder Vault
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsPasteModalOpen(false)}
                className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1 font-mono">
                  Virtual File Name (e.g. App.tsx, index.html, backend.py, styles.css)
                </label>
                <input
                  type="text"
                  value={pasteFileName}
                  onChange={(e) => setPasteFileName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-100 focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div>
                <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                  <span>Paste hundreds of thousands of lines/characters of code:</span>
                  <span className="font-mono tabular-nums">
                    {pasteCodeContent.length.toLocaleString()} chars ·{' '}
                    {(pasteCodeContent ? pasteCodeContent.split(/\r?\n/).length : 0).toLocaleString()} lines
                  </span>
                </div>
                <textarea
                  value={pasteCodeContent}
                  onChange={(e) => setPasteCodeContent(e.target.value)}
                  rows={12}
                  placeholder="Paste massive code here..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500 resize-y"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsPasteModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg text-xs text-slate-300 hover:bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!pasteCodeContent.trim()}
                  onClick={() => {
                    const created = createCodebaseFile(pasteFileName.trim() || 'pasted-code.txt', pasteCodeContent);
                    setCodebaseFiles((prev) => {
                      const next = mergeCodebaseFiles(prev, [created]);
                      saveCodebaseToVault('builder', next);
                      return next;
                    });
                    setIsVaultDrawerOpen(true);
                    setPasteCodeContent('');
                    setIsPasteModalOpen(false);
                  }}
                  className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 text-slate-950 cursor-pointer"
                >
                  Save to Codebase Vault
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Expanded Image Preview Modal */}
      {previewModalImage && (
        <div 
          className="fixed inset-0 bg-slate-950/90 z-50 flex items-center justify-center p-4 backdrop-blur-xs"
          onClick={() => setPreviewModalImage(null)}
        >
          <div className="relative max-w-2xl max-h-[85vh] bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden p-2 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-2 border-b border-slate-800">
              <span className="text-xs font-semibold text-slate-200">Visual Design Mockup</span>
              <button 
                onClick={() => setPreviewModalImage(null)}
                className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-2 overflow-auto max-h-[75vh]">
              <img src={previewModalImage} alt="Expanded mockup" className="rounded-lg w-full h-auto object-contain" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
