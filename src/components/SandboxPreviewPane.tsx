import React, { useRef, useState, useEffect } from 'react';
import { RefreshCw, Maximize2, Minimize2, ExternalLink, ShieldCheck, Monitor, Tablet, Smartphone } from 'lucide-react';
import { CodeState, ConsoleLogItem, ViewportMode } from '../types';
import { buildSandboxSrcDoc } from '../services/sandbox';
import { ConsoleLogger } from './ConsoleLogger';

interface SandboxPreviewPaneProps {
  code: CodeState;
  viewportMode: ViewportMode;
  onViewportChange: (mode: ViewportMode) => void;
  logs: ConsoleLogItem[];
  onClearLogs: () => void;
  onSendEval: (code: string) => void;
  isConsoleCollapsed: boolean;
  onToggleConsoleCollapse: () => void;
}

export const SandboxPreviewPane: React.FC<SandboxPreviewPaneProps> = ({
  code,
  viewportMode,
  onViewportChange,
  logs,
  onClearLogs,
  onSendEval,
  isConsoleCollapsed,
  onToggleConsoleCollapse
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const srcDoc = React.useMemo(() => {
    return buildSandboxSrcDoc(code);
  }, [code]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setReloadKey(k => k + 1);
    setTimeout(() => setIsRefreshing(false), 400);
  };

  const getContainerMaxWidth = () => {
    switch (viewportMode) {
      case 'mobile': return '375px';
      case 'tablet': return '768px';
      case 'desktop':
      default: return '100%';
    }
  };

  return (
    <div className={`flex-1 flex flex-col min-h-0 bg-slate-900/40 relative ${
      isFullscreen ? 'fixed inset-0 z-50 bg-slate-950 p-4' : ''
    }`}>
      {/* Top Browser Bar */}
      <div className="h-10 px-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between gap-3 select-none shrink-0">
        <div className="flex items-center gap-2">
          {/* Window dots */}
          <div className="flex items-center gap-1.5 mr-1">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
          </div>

          <button
            onClick={handleRefresh}
            className={`p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-all ${
              isRefreshing ? 'animate-spin text-cyan-400' : ''
            }`}
            title="Reload Sandbox Engine"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Browser URL Simulation Bar */}
        <div className="flex-1 max-w-md bg-slate-950 border border-slate-800 rounded-md px-3 py-1 flex items-center justify-between text-xs font-mono text-slate-400">
          <div className="flex items-center gap-1.5 truncate">
            <ShieldCheck className="w-3 h-3 text-emerald-400 shrink-0" />
            <span className="text-slate-500 select-none">https://</span>
            <span className="text-slate-300 truncate">sandbox.studiox.preview</span>
          </div>
          <span className="text-[10px] uppercase font-semibold text-cyan-400 bg-cyan-950 px-1 rounded ml-2 shrink-0">
            Live
          </span>
        </div>

        {/* Viewport indicators & Fullscreen toggle */}
        <div className="flex items-center gap-1">
          <div className="text-[11px] font-mono text-slate-400 hidden xl:block mr-1">
            {viewportMode === 'desktop' ? '100% (Fluid)' : viewportMode === 'tablet' ? '768px' : '375px'}
          </div>

          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors"
            title={isFullscreen ? 'Exit Fullscreen' : 'Expand Sandbox Fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Sandbox Iframe Stage */}
      <div className="flex-1 bg-slate-950/60 overflow-hidden flex justify-center items-center p-2 relative">
        <div
          className="h-full bg-slate-950 rounded-lg overflow-hidden border border-slate-800 shadow-2xl transition-all duration-300 relative flex flex-col"
          style={{
            width: getContainerMaxWidth(),
            maxWidth: '100%'
          }}
        >
          <iframe
            key={reloadKey}
            ref={iframeRef}
            srcDoc={srcDoc}
            title="StudioX Live Sandbox"
            sandbox="allow-scripts allow-modals allow-forms allow-popups allow-same-origin"
            className="w-full h-full border-0 bg-transparent"
          />
        </div>
      </div>

      {/* Live Console Logger at bottom of Right Column */}
      <ConsoleLogger
        logs={logs}
        onClear={onClearLogs}
        onSendEval={(evalCode) => {
          if (iframeRef.current && iframeRef.current.contentWindow) {
            iframeRef.current.contentWindow.postMessage({
              source: 'studiox-parent',
              type: 'eval',
              code: evalCode
            }, '*');
          }
          onSendEval(evalCode);
        }}
        isCollapsed={isConsoleCollapsed}
        onToggleCollapse={onToggleConsoleCollapse}
      />
    </div>
  );
};
