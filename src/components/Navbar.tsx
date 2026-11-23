import React from 'react';
import { 
  Sparkles, 
  Download, 
  Settings, 
  Monitor, 
  Tablet, 
  Smartphone, 
  Code2, 
  Zap,
  Globe,
  Rocket,
  Github,
  Laptop,
  CheckCircle2,
  ExternalLink,
  Upload,
  Eye,
  Sliders,
  MessageSquare,
  Plus
} from 'lucide-react';
import { OpenRouterSettings, ViewportMode, DeploymentInfo, PromptControllerConfig } from '../types';

interface NavbarProps {
  settings: OpenRouterSettings;
  viewportMode: ViewportMode;
  onViewportChange: (mode: ViewportMode) => void;
  onOpenSettings: (tab?: 'gemini' | 'openrouter' | 'groq' | 'research') => void;
  onDownloadZip: () => void;
  onOpenDeploy: () => void;
  onOpenGitHubExport: () => void;
  onOpenSideload: () => void;
  onOpenImportZip: () => void;
  onOpenFullScreenPreview: () => void;
  isGenerating: boolean;
  activeProjectName: string;
  deployment: DeploymentInfo;
  promptControllerConfig?: PromptControllerConfig;
  onOpenPromptControllerModal?: () => void;
  activeWorkspace?: 'builder' | 'chat';
  onWorkspaceChange?: (workspace: 'builder' | 'chat') => void;
  builderProjects?: { id: string; name: string }[];
  activeBuilderProjectId?: string;
  onSelectBuilderProject?: (id: string) => void;
  onNewBuilderProject?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  settings,
  viewportMode,
  onViewportChange,
  onOpenSettings,
  onDownloadZip,
  onOpenDeploy,
  onOpenGitHubExport,
  onOpenSideload,
  onOpenImportZip,
  onOpenFullScreenPreview,
  isGenerating,
  activeProjectName,
  deployment,
  promptControllerConfig,
  onOpenPromptControllerModal,
  activeWorkspace = 'builder',
  onWorkspaceChange,
  builderProjects = [],
  activeBuilderProjectId,
  onSelectBuilderProject,
  onNewBuilderProject
}) => {
  const hasResearchKeys = Boolean(settings.tavilyApiKey?.trim() || settings.serperApiKey?.trim());
  const thinkingMode = promptControllerConfig?.thinkingMode || 'outside-the-box';

  return (
    <header className="h-14 border-b border-slate-800 bg-slate-950/95 backdrop-blur-md px-4 flex items-center justify-between z-30 sticky top-0 select-none">
      {/* Left: Google AI Studio Branding & Environment Status */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-500 via-sky-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 border border-cyan-400/30">
            <Code2 className="w-4 h-4 text-slate-950 font-bold" strokeWidth={2.5} />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-sm tracking-tight text-white font-mono">
                Studio<span className="text-cyan-400">X</span>
              </span>
              <span className="text-[10px] uppercase font-bold px-1.5 py-0.2 rounded bg-gradient-to-r from-blue-950 to-indigo-950 text-cyan-300 border border-cyan-800/50">
                AI Studio
              </span>
            </div>
          </div>
        </div>

        <div className="h-4 w-px bg-slate-800 hidden md:block" />

        {/* Workspace Switcher: App Builder vs AI Chat */}
        {onWorkspaceChange && (
          <div className="flex items-center bg-slate-900 p-0.5 rounded-lg border border-slate-800">
            <button
              onClick={() => onWorkspaceChange('builder')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                activeWorkspace === 'builder'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Code2 className="w-3.5 h-3.5" />
              <span>App Builder</span>
            </button>
            <button
              onClick={() => onWorkspaceChange('chat')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                activeWorkspace === 'chat'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>AI Chat</span>
            </button>
          </div>
        )}

        {/* App Builder Project Switcher + New App Button */}
        {activeWorkspace === 'builder' && onNewBuilderProject && (
          <div className="flex items-center gap-1.5">
            {builderProjects.length > 0 && onSelectBuilderProject ? (
              <select
                value={activeBuilderProjectId || ''}
                onChange={(e) => onSelectBuilderProject(e.target.value)}
                className="bg-slate-900/90 border border-slate-800 text-xs text-slate-200 rounded-md px-2 py-1 max-w-[170px] truncate focus:outline-none focus:border-cyan-500/50"
                title="Switch preserved App Builder project"
              >
                {builderProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            ) : (
              <div className="flex items-center gap-2 text-xs text-slate-300 bg-slate-900/80 px-2.5 py-1 rounded-md border border-slate-800">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="font-medium truncate max-w-[160px]">{activeProjectName}</span>
              </div>
            )}
            <button
              onClick={onNewBuilderProject}
              className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-md bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/25 transition-colors"
              title="Create a new App Builder while preserving existing ones"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New App</span>
            </button>
          </div>
        )}

        {/* Prompt Controller Thinking Strategy Chip */}
        {onOpenPromptControllerModal && (
          <button
            onClick={onOpenPromptControllerModal}
            className={`hidden sm:flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md border transition-all text-left cursor-pointer ${
              thinkingMode === 'strict'
                ? 'bg-amber-950/30 border-amber-600/40 text-amber-300 hover:bg-amber-900/40'
                : thinkingMode === 'outside-the-box'
                ? 'bg-purple-950/30 border-purple-600/40 text-purple-300 hover:bg-purple-900/40'
                : 'bg-slate-900/60 border-slate-700/60 text-slate-300 hover:bg-slate-800'
            }`}
            title="Prompt Controller: Click to set when AI thinks outside the box or follows strict literal instructions"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span className="font-mono text-[11px] font-medium">
              {thinkingMode === 'strict' ? '🎯 Strict (No Speculation)' : thinkingMode === 'outside-the-box' ? '🧠 Outside The Box' : '⚖️ Balanced'}
            </span>
          </button>
        )}

        {/* Engine status indicator chip (Google Gemini / OpenRouter / Groq Fallback / Local Compiler) */}
        <button
          onClick={() => onOpenSettings('gemini')}
          className="hidden xl:flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md border transition-all text-left group bg-slate-900/60 hover:bg-slate-800 border-slate-800 hover:border-slate-700 cursor-pointer"
          title="Click to configure Google Gemini, OpenRouter, Groq Fallback & Web Research"
        >
          {settings.useGemini !== false ? (
            <>
              <Zap className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-blue-200 font-mono text-[11px] truncate max-w-[160px]">
                {settings.geminiModel || 'gemini-4-hydrogen'}
              </span>
              {settings.groqApiKey?.trim() && settings.useGroqFallback !== false && (
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-orange-500/15 text-orange-300 border border-orange-500/30 font-mono">
                  +Groq
                </span>
              )}
            </>
          ) : settings.useOpenRouter && settings.apiKey ? (
            <>
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-slate-300 font-mono text-[11px] truncate max-w-[140px]">
                {(settings.model === 'custom' && settings.customModel?.trim()
                  ? settings.customModel.trim()
                  : settings.model
                ).split('/').pop()} (T: {settings.temperature})
              </span>
              {settings.groqApiKey?.trim() && settings.useGroqFallback !== false && (
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-orange-500/15 text-orange-300 border border-orange-500/30 font-mono">
                  +Groq
                </span>
              )}
            </>
          ) : settings.groqApiKey?.trim() && settings.useGroqFallback !== false ? (
            <>
              <Zap className="w-3.5 h-3.5 text-orange-400" />
              <span className="text-orange-200 font-mono text-[11px] truncate max-w-[160px]">
                Groq: {(settings.groqModel === 'custom' && settings.groqCustomModel?.trim()
                  ? settings.groqCustomModel.trim()
                  : settings.groqModel || 'llama-3.3-70b-versatile')}
              </span>
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-slate-300 font-mono text-[11px]">Built-in Compiler</span>
            </>
          )}

          {hasResearchKeys && settings.enableWebResearch && (
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 ml-1" title="Tavily / Serper active" />
          )}
        </button>
      </div>

      {/* Center: Device Viewport Controls */}
      <div className="hidden md:flex items-center gap-1 bg-slate-900/90 border border-slate-800 p-0.5 rounded-lg">
        <button
          onClick={() => onViewportChange('desktop')}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
            viewportMode === 'desktop'
              ? 'bg-slate-800 text-cyan-400 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
          title="Desktop Viewport"
        >
          <Monitor className="w-3.5 h-3.5" />
          <span>Desktop</span>
        </button>
        <button
          onClick={() => onViewportChange('tablet')}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
            viewportMode === 'tablet'
              ? 'bg-slate-800 text-cyan-400 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
          title="Tablet Viewport (768px)"
        >
          <Tablet className="w-3.5 h-3.5" />
          <span>Tablet</span>
        </button>
        <button
          onClick={() => onViewportChange('mobile')}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
            viewportMode === 'mobile'
              ? 'bg-slate-800 text-cyan-400 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
          title="Mobile Viewport (375px)"
        >
          <Smartphone className="w-3.5 h-3.5" />
          <span>Mobile</span>
        </button>
      </div>

      {/* Right: Deployment Actions & Account */}
      <div className="flex items-center gap-2">
        {/* Prominent Live Preview Action (Full Screen Live Preview) */}
        <button
          onClick={onOpenFullScreenPreview}
          className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 active:scale-95 text-slate-950 font-black text-xs rounded-lg shadow-lg shadow-emerald-500/25 border border-emerald-300/40 transition-all cursor-pointer group"
          title="Press to see Live Preview covering the entire screen"
        >
          <Eye className="w-4 h-4 text-slate-950 group-hover:scale-110 transition-transform" />
          <span className="font-extrabold tracking-tight">Live Preview</span>
          <span className="text-[10px] bg-slate-950/20 text-slate-950 px-1 py-0.2 rounded font-mono font-bold uppercase hidden sm:inline">
            Full Screen ⛶
          </span>
        </button>

        {/* Deploy to URL Quick Action */}
        <button
          onClick={onOpenDeploy}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 active:scale-95 text-slate-950 font-bold text-xs rounded-lg shadow-md shadow-cyan-500/20 transition-all cursor-pointer"
        >
          <Rocket className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Deploy</span>
        </button>

        {/* GitHub Export */}
        <button
          onClick={onOpenGitHubExport}
          className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-lg border border-slate-800 transition-colors"
          title="Export to GitHub"
        >
          <Github className="w-3.5 h-3.5" />
        </button>

        {/* Install Sideload */}
        <button
          onClick={onOpenSideload}
          className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-lg border border-slate-800 transition-colors"
          title="Install Sideload App"
        >
          <Laptop className="w-3.5 h-3.5 text-emerald-400" />
        </button>

        {/* Upload ZIP */}
        <button
          onClick={onOpenImportZip}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium bg-slate-900 hover:bg-slate-800 text-cyan-300 hover:text-cyan-200 rounded-lg border border-slate-800 hover:border-cyan-800/60 transition-colors cursor-pointer"
          title="Upload and edit a project ZIP"
        >
          <Upload className="w-3.5 h-3.5 text-cyan-400" />
          <span className="hidden md:inline">Upload ZIP</span>
        </button>

        {/* Download ZIP */}
        <button
          onClick={onDownloadZip}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-lg border border-slate-800 transition-colors cursor-pointer"
          title="Download Project ZIP"
        >
          <Download className="w-3.5 h-3.5" />
        </button>

        {/* Groq Key Quick Button */}
        <button
          onClick={() => onOpenSettings('groq')}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
            settings.groqApiKey?.trim()
              ? 'bg-orange-500/15 hover:bg-orange-500/25 text-orange-300 border-orange-500/40'
              : 'bg-slate-900 hover:bg-slate-800 text-orange-300 border-slate-800 hover:border-orange-500/40'
          }`}
          title="Enter or manage your Groq API Key & live models"
        >
          <Zap className="w-3.5 h-3.5 text-orange-400" />
          <span className="hidden md:inline">{settings.groqApiKey?.trim() ? 'Groq Key' : 'Add Groq Key'}</span>
        </button>

        {/* Settings */}
        <button
          onClick={() => onOpenSettings('gemini')}
          className="p-1.5 text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-800 rounded-lg border border-slate-800 transition-colors cursor-pointer"
          title="Engine & Research Settings"
        >
          <Settings className="w-4 h-4" />
        </button>

        {/* User Account Chip (Google AI Studio profile) */}
        <div className="flex items-center gap-1.5 pl-1">
          <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-cyan-600 to-indigo-600 text-white font-bold flex items-center justify-center text-xs shadow-inner">
            I
          </div>
        </div>
      </div>
    </header>
  );
};
