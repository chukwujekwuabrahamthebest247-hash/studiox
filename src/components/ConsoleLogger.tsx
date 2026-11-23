import React, { useState, useRef, useEffect } from 'react';
import { Terminal, Trash2, ChevronDown, ChevronUp, AlertCircle, AlertTriangle, Info, Play, CornerDownLeft } from 'lucide-react';
import { ConsoleLogItem } from '../types';

interface ConsoleLoggerProps {
  logs: ConsoleLogItem[];
  onClear: () => void;
  onSendEval: (code: string) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export const ConsoleLogger: React.FC<ConsoleLoggerProps> = ({
  logs,
  onClear,
  onSendEval,
  isCollapsed,
  onToggleCollapse
}) => {
  const [filter, setFilter] = useState<'all' | 'log' | 'warn' | 'error'>('all');
  const [evalInput, setEvalInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new log
  useEffect(() => {
    if (scrollRef.current && !isCollapsed) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, isCollapsed]);

  const filteredLogs = logs.filter((item) => {
    if (filter === 'all') return true;
    if (filter === 'log') return item.type === 'log' || item.type === 'info';
    return item.type === filter;
  });

  const errorCount = logs.filter(l => l.type === 'error').length;
  const warnCount = logs.filter(l => l.type === 'warn').length;

  const handleEvalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!evalInput.trim()) return;
    onSendEval(evalInput.trim());
    setEvalInput('');
  };

  return (
    <div className={`border-t border-slate-800 bg-slate-950 flex flex-col transition-all duration-200 ${
      isCollapsed ? 'h-9' : 'h-52'
    }`}>
      {/* Console Header */}
      <div className="h-9 px-3 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between select-none">
        <div className="flex items-center gap-2">
          <button
            onClick={onToggleCollapse}
            className="flex items-center gap-1.5 text-xs font-mono font-medium text-slate-300 hover:text-white"
          >
            {isCollapsed ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            <Terminal className="w-3.5 h-3.5 text-cyan-400" />
            <span>Sandbox Console</span>
          </button>

          {/* Badges for errors & warnings */}
          {errorCount > 0 && (
            <span className="flex items-center gap-1 text-[10px] bg-red-950/80 text-red-400 border border-red-800 px-1.5 py-0.2 rounded font-mono">
              <AlertCircle className="w-2.5 h-2.5" />
              {errorCount}
            </span>
          )}
          {warnCount > 0 && (
            <span className="flex items-center gap-1 text-[10px] bg-amber-950/80 text-amber-400 border border-amber-800 px-1.5 py-0.2 rounded font-mono">
              <AlertTriangle className="w-2.5 h-2.5" />
              {warnCount}
            </span>
          )}
        </div>

        {/* Filter & Clear Controls */}
        <div className="flex items-center gap-1.5 text-xs">
          {!isCollapsed && (
            <div className="flex items-center bg-slate-950 border border-slate-800 rounded p-0.5 mr-2">
              <button
                onClick={() => setFilter('all')}
                className={`px-2 py-0.5 rounded text-[11px] font-mono transition-colors ${
                  filter === 'all' ? 'bg-slate-800 text-cyan-400' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                All ({logs.length})
              </button>
              <button
                onClick={() => setFilter('log')}
                className={`px-2 py-0.5 rounded text-[11px] font-mono transition-colors ${
                  filter === 'log' ? 'bg-slate-800 text-cyan-400' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Logs
              </button>
              <button
                onClick={() => setFilter('warn')}
                className={`px-2 py-0.5 rounded text-[11px] font-mono transition-colors ${
                  filter === 'warn' ? 'bg-slate-800 text-amber-400' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Warn ({warnCount})
              </button>
              <button
                onClick={() => setFilter('error')}
                className={`px-2 py-0.5 rounded text-[11px] font-mono transition-colors ${
                  filter === 'error' ? 'bg-slate-800 text-red-400' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Err ({errorCount})
              </button>
            </div>
          )}

          <button
            onClick={onClear}
            className="p-1 hover:text-slate-200 text-slate-500 rounded hover:bg-slate-800 transition-colors"
            title="Clear Console"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Console Output Body */}
      {!isCollapsed && (
        <>
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-2 font-mono text-[11px] flex flex-col gap-1 bg-slate-950/90 selection:bg-cyan-500/30">
            {filteredLogs.length === 0 ? (
              <div className="text-slate-600 italic py-4 text-center">
                Sandbox console is idle. Run an app to stream logs.
              </div>
            ) : (
              filteredLogs.map((log) => {
                let badgeClass = 'text-slate-400 bg-slate-900 border-slate-800';
                let textClass = 'text-slate-300';
                let icon = <Info className="w-3 h-3 text-cyan-400 shrink-0" />;

                if (log.type === 'warn') {
                  badgeClass = 'text-amber-400 bg-amber-950/30 border-amber-800/40';
                  textClass = 'text-amber-200';
                  icon = <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />;
                } else if (log.type === 'error') {
                  badgeClass = 'text-red-400 bg-red-950/30 border-red-800/40';
                  textClass = 'text-red-300 font-semibold';
                  icon = <AlertCircle className="w-3 h-3 text-red-400 shrink-0" />;
                }

                return (
                  <div key={log.id} className="flex items-start gap-2 py-0.5 px-1 rounded hover:bg-slate-900/60 leading-relaxed group">
                    <span className="text-slate-600 select-none text-[10px] shrink-0 pt-0.5">{log.timestamp}</span>
                    <span className="pt-0.5">{icon}</span>
                    <span className={`flex-1 break-all whitespace-pre-wrap ${textClass}`}>
                      {log.message}
                    </span>
                  </div>
                );
              })
            )}
          </div>

          {/* Quick Interactive Sandbox Commands */}
          <div className="px-2 py-1 bg-slate-950 border-t border-slate-900/80 flex items-center gap-1.5 overflow-x-auto no-scrollbar text-[10px] font-mono text-slate-400">
            <span className="text-slate-600 shrink-0 select-none">Quick Eval:</span>
            <button
              type="button"
              onClick={() => onSendEval('alert("StudioX interactive connection active!")')}
              className="px-1.5 py-0.5 rounded bg-slate-900 hover:bg-slate-850 text-cyan-300 hover:text-white transition-colors shrink-0 cursor-pointer"
            >
              alert()
            </button>
            <button
              type="button"
              onClick={() => onSendEval('console.log("Interactive Storage items:", Object.keys(localStorage))')}
              className="px-1.5 py-0.5 rounded bg-slate-900 hover:bg-slate-850 text-cyan-300 hover:text-white transition-colors shrink-0 cursor-pointer"
            >
              Inspect Storage
            </button>
            <button
              type="button"
              onClick={() => onSendEval('document.body.style.filter = document.body.style.filter ? "" : "contrast(1.15) saturate(1.2)"')}
              className="px-1.5 py-0.5 rounded bg-slate-900 hover:bg-slate-850 text-cyan-300 hover:text-white transition-colors shrink-0 cursor-pointer"
            >
              Vibrant Mode
            </button>
          </div>

          {/* Interactive Console REPL Input */}
          <form onSubmit={handleEvalSubmit} className="h-8 border-t border-slate-900 bg-slate-950 px-2 flex items-center gap-2">
            <span className="text-cyan-400 font-mono text-xs select-none">❯</span>
            <input
              type="text"
              value={evalInput}
              onChange={(e) => setEvalInput(e.target.value)}
              placeholder="Evaluate JavaScript expression in live sandbox... (e.g. document.title, console.log(window))"
              className="flex-1 bg-transparent border-none text-slate-200 text-xs font-mono outline-none placeholder-slate-600"
            />
            <button
              type="submit"
              disabled={!evalInput.trim()}
              className="text-slate-500 hover:text-cyan-400 disabled:opacity-30 cursor-pointer"
            >
              <CornerDownLeft className="w-3 h-3" />
            </button>
          </form>
        </>
      )}
    </div>
  );
};
