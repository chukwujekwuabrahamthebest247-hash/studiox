import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  RefreshCw, 
  Monitor, 
  Tablet, 
  Smartphone, 
  ExternalLink, 
  ShieldCheck, 
  Maximize2, 
  Minimize2, 
  Sparkles,
  ChevronUp,
  ChevronDown,
  Volume2,
  VolumeX,
  Zap,
  RotateCcw
} from 'lucide-react';
import { CodeState, ViewportMode } from '../types';
import { buildSandboxSrcDoc } from '../services/sandbox';

interface FullScreenLivePreviewProps {
  isOpen: boolean;
  onClose: () => void;
  code: CodeState;
  projectName: string;
}

export const FullScreenLivePreview: React.FC<FullScreenLivePreviewProps> = ({
  isOpen,
  onClose,
  code,
  projectName
}) => {
  const [viewportMode, setViewportMode] = useState<ViewportMode>('desktop');
  const [reloadKey, setReloadKey] = useState<number>(0);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isBarCollapsed, setIsBarCollapsed] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Keyboard shortcut: Esc to exit fullscreen
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const srcDoc = buildSandboxSrcDoc(code);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setReloadKey(prev => prev + 1);
    setTimeout(() => setIsRefreshing(false), 300);
  };

  const handleToggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    iframeRef.current?.contentWindow?.postMessage({
      source: 'studiox-parent',
      type: 'toggle-sound',
      enabled: next
    }, '*');
  };

  const handleTriggerDemo = () => {
    iframeRef.current?.contentWindow?.postMessage({
      source: 'studiox-parent',
      type: 'interactive-demo'
    }, '*');
  };

  const handleResetState = () => {
    iframeRef.current?.contentWindow?.postMessage({
      source: 'studiox-parent',
      type: 'reset-state'
    }, '*');
  };

  const handleOpenInNewWindow = () => {
    const newWindow = window.open();
    if (newWindow) {
      newWindow.document.open();
      newWindow.document.write(srcDoc);
      newWindow.document.close();
    }
  };

  const getContainerMaxWidth = () => {
    switch (viewportMode) {
      case 'mobile': return '390px';
      case 'tablet': return '820px';
      case 'desktop':
      default: return '100%';
    }
  };

  return (
    <div className="fixed inset-0 z-50 w-screen h-screen bg-slate-950 flex flex-col overflow-hidden animate-in fade-in duration-200 select-none">
      {/* Sleek Floating Glassmorphism Header Bar */}
      <div 
        className={`w-full bg-slate-950/90 backdrop-blur-md border-b border-slate-800/80 px-4 py-2 flex items-center justify-between gap-3 shrink-0 transition-all ${
          isBarCollapsed ? '-mt-12 opacity-0 hover:mt-0 hover:opacity-100' : ''
        }`}
      >
        {/* Left: App Title and Live Indicator */}
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-slate-950 font-bold font-mono text-xs shadow-md shadow-cyan-500/20">
            SX
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-white truncate max-w-[200px] sm:max-w-md">
                {projectName}
              </span>
              <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-400 bg-emerald-950/80 border border-emerald-800/60 px-2 py-0.5 rounded-full font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live Preview (Covering Entire Screen)
              </span>
            </div>
            <div className="text-[11px] text-slate-400 hidden sm:flex items-center gap-1 font-mono">
              <ShieldCheck className="w-3 h-3 text-emerald-400" />
              <span>Full interactive browser execution sandbox</span>
            </div>
          </div>
        </div>

        {/* Center: Device Viewport Controls */}
        <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 p-1 rounded-xl shadow-inner">
          <button
            onClick={() => setViewportMode('desktop')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              viewportMode === 'desktop'
                ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
            title="Desktop Mode (Edge-to-Edge 100%)"
          >
            <Monitor className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Full Desktop (100%)</span>
            <span className="md:hidden">100%</span>
          </button>

          <button
            onClick={() => setViewportMode('tablet')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              viewportMode === 'tablet'
                ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
            title="Tablet View (820px)"
          >
            <Tablet className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Tablet (820px)</span>
            <span className="md:hidden">Tablet</span>
          </button>

          <button
            onClick={() => setViewportMode('mobile')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              viewportMode === 'mobile'
                ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
            title="Mobile Phone View (390px)"
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Mobile (390px)</span>
            <span className="md:hidden">Mobile</span>
          </button>
        </div>

        {/* Right: Interactive Actions, Sound, Demo & Exit Fullscreen Button */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Sound Toggle Button */}
          <button
            onClick={handleToggleSound}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
              soundEnabled
                ? 'bg-slate-900 border-emerald-500/50 text-emerald-300'
                : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300'
            }`}
            title={soundEnabled ? 'Interactive audio clicks enabled (Click to mute)' : 'Interactive audio muted (Click to enable)'}
          >
            {soundEnabled ? <Volume2 className="w-3.5 h-3.5 text-emerald-400" /> : <VolumeX className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{soundEnabled ? 'Audio ON' : 'Audio OFF'}</span>
          </button>

          {/* Auto Interactive Demo Action */}
          <button
            onClick={handleTriggerDemo}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-cyan-300 hover:text-cyan-200 border border-cyan-800/60 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
            title="Auto-trigger interactive elements in sandbox"
          >
            <Zap className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">Auto Demo</span>
          </button>

          {/* Reset App State */}
          <button
            onClick={handleResetState}
            className="p-2 text-slate-400 hover:text-amber-300 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg transition-colors cursor-pointer"
            title="Reset Sandboxed State / Storage"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          {/* Reload Sandbox */}
          <button
            onClick={handleRefresh}
            className={`p-2 text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg transition-colors cursor-pointer ${
              isRefreshing ? 'animate-spin text-cyan-400' : ''
            }`}
            title="Reload App Sandbox"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {/* Open in New Tab */}
          <button
            onClick={handleOpenInNewWindow}
            className="p-2 text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg transition-colors cursor-pointer hidden md:block"
            title="Open in new browser window"
          >
            <ExternalLink className="w-4 h-4" />
          </button>

          {/* Prominent Exit Fullscreen Button */}
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 active:scale-95 text-white font-bold text-xs rounded-lg shadow-lg shadow-red-900/40 border border-red-500/40 transition-all cursor-pointer"
            title="Exit Fullscreen Preview (or press Esc)"
          >
            <X className="w-4 h-4" />
            <span>Exit Fullscreen</span>
            <span className="text-[10px] bg-red-950/60 px-1 py-0.2 rounded font-mono hidden sm:inline">Esc</span>
          </button>
        </div>
      </div>

      {/* Main Full-Screen Frame Container */}
      <div className="flex-1 w-full h-full bg-slate-950 overflow-hidden flex items-center justify-center relative p-0 sm:p-2">
        <div
          className={`h-full bg-slate-900 overflow-hidden transition-all duration-200 relative flex flex-col shadow-2xl ${
            viewportMode === 'mobile'
              ? 'w-full max-w-[390px] border-4 border-slate-800 rounded-3xl shadow-cyan-500/10 my-2 max-h-[96%]'
              : viewportMode === 'tablet'
              ? 'w-full max-w-[820px] border-2 border-slate-800 rounded-2xl shadow-cyan-500/10 my-2 max-h-[98%]'
              : 'w-full h-full border-0 rounded-none'
          }`}
          style={{
            width: getContainerMaxWidth()
          }}
        >
          {/* Speaker Notch for Mobile Phone Mode */}
          {viewportMode === 'mobile' && (
            <div className="h-5 bg-slate-950 flex items-center justify-center shrink-0 border-b border-slate-800/80">
              <div className="w-14 h-1 bg-slate-800 rounded-full" />
            </div>
          )}

          {/* The Actual Running Sandbox Application */}
          <iframe
            key={reloadKey}
            ref={iframeRef}
            srcDoc={srcDoc}
            title={`${projectName} - Live Fullscreen Preview`}
            sandbox="allow-scripts allow-modals allow-forms allow-popups allow-same-origin"
            className="w-full flex-1 border-0 bg-slate-950"
          />
        </div>

        {/* Floating Quick Action Pill in bottom right corner */}
        <div className="absolute bottom-4 right-4 flex items-center gap-2 bg-slate-900/90 backdrop-blur-md border border-slate-800 px-3 py-1.5 rounded-full shadow-2xl z-20 select-none">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <span className="text-xs font-semibold text-slate-200">Interactive Sandbox Active</span>
          <div className="h-3 w-px bg-slate-700" />
          <button
            onClick={onClose}
            className="text-xs text-cyan-400 hover:text-cyan-300 font-bold underline cursor-pointer"
          >
            Back to Editor
          </button>
        </div>
      </div>
    </div>
  );
};
