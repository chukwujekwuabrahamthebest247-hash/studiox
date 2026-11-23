import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Copy, Check, RotateCcw, FileCode, Hash, AlignLeft, Sparkles } from 'lucide-react';
import { CodeState } from '../types';

interface CodeEditorPaneProps {
  code: CodeState;
  onChange: (newCode: CodeState) => void;
}

type TabType = 'html' | 'css' | 'js';

export const CodeEditorPane: React.FC<CodeEditorPaneProps> = ({ code, onChange }) => {
  const [activeTab, setActiveTab] = useState<TabType>('html');
  const [copied, setCopied] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);

  const currentContent = code[activeTab];

  // Compute line count
  const lineNumbers = useMemo(() => {
    const count = (currentContent.match(/\n/g) || []).length + 1;
    return Array.from({ length: count }, (_, i) => i + 1);
  }, [currentContent]);

  // Sync scroll between textarea and line numbers gutter
  const handleScroll = () => {
    if (textareaRef.current && lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    onChange({
      ...code,
      [activeTab]: val
    });
  };

  // Support Tab key indentation inside the editor
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const target = e.currentTarget;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const value = target.value;

      const newValue = value.substring(0, start) + '  ' + value.substring(end);
      onChange({
        ...code,
        [activeTab]: newValue
      });

      // Restore cursor position after state updates
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + 2;
        }
      }, 0);
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(currentContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error('Failed to copy', e);
    }
  };

  const formatCode = () => {
    // Basic clean beautifier: trims trailing whitespace and normalizes indent
    const lines = currentContent.split('\n');
    const formatted = lines.map(line => line.trimEnd()).join('\n');
    onChange({
      ...code,
      [activeTab]: formatted
    });
  };

  const getTabLabel = (tab: TabType) => {
    switch (tab) {
      case 'html': return 'HTML';
      case 'css': return 'CSS';
      case 'js': return 'JavaScript';
    }
  };

  const getTabColorBadge = (tab: TabType) => {
    switch (tab) {
      case 'html': return 'text-orange-400 bg-orange-950/40 border-orange-800/40';
      case 'css': return 'text-blue-400 bg-blue-950/40 border-blue-800/40';
      case 'js': return 'text-amber-400 bg-amber-950/40 border-amber-800/40';
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-950">
      {/* Editor Tab Bar */}
      <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/70 px-3 py-1.5 select-none">
        {/* Left Tabs */}
        <div className="flex items-center gap-1">
          {(['html', 'css', 'js'] as TabType[]).map((tab) => {
            const isActive = activeTab === tab;
            const size = (code[tab] || '').length;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex items-center gap-2 px-3 py-1.5 text-xs font-mono font-medium rounded-t-lg transition-all border-b-2 cursor-pointer ${
                  isActive
                    ? 'bg-slate-950 text-cyan-400 border-cyan-400 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 border-transparent hover:bg-slate-800/50'
                }`}
              >
                <span>{getTabLabel(tab)}</span>
                <span className={`text-[10px] px-1 rounded border ${getTabColorBadge(tab)} font-mono`}>
                  {Math.round(size / 1024 * 10) / 10}kb
                </span>
              </button>
            );
          })}
        </div>

        {/* Right Tab Toolbar */}
        <div className="flex items-center gap-1 text-slate-400">
          <div className="text-[11px] font-mono text-slate-500 mr-2 hidden sm:block">
            {lineNumbers.length} lines
          </div>

          <button
            onClick={formatCode}
            className="p-1.5 hover:text-cyan-400 hover:bg-slate-800 rounded transition-colors text-xs flex items-center gap-1"
            title="Trim & Format Code"
          >
            <AlignLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline text-[11px]">Format</span>
          </button>

          <button
            onClick={copyToClipboard}
            className="p-1.5 hover:text-cyan-400 hover:bg-slate-800 rounded transition-colors text-xs flex items-center gap-1"
            title="Copy Tab Code"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-[11px] text-emerald-400">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span className="hidden sm:inline text-[11px]">Copy</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Code Editor Body with Line Numbers */}
      <div className="flex-1 flex overflow-hidden relative font-mono text-xs bg-slate-950">
        {/* Line Numbers Gutter */}
        <div
          ref={lineNumbersRef}
          className="w-11 py-3 bg-slate-950 border-r border-slate-900 select-none text-slate-600 text-right pr-2.5 overflow-hidden font-mono text-[12px] leading-relaxed shrink-0 pointer-events-none"
        >
          {lineNumbers.map((num) => (
            <div key={num} className="leading-5">
              {num}
            </div>
          ))}
        </div>

        {/* Real Editable Textarea */}
        <textarea
          ref={textareaRef}
          value={currentContent}
          onChange={handleTextChange}
          onScroll={handleScroll}
          onKeyDown={handleKeyDown}
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          autoCorrect="off"
          placeholder={`Enter raw ${getTabLabel(activeTab)} here...`}
          className="flex-1 w-full h-full p-3 bg-transparent text-slate-200 outline-none resize-none font-mono text-[12px] leading-5 selection:bg-cyan-500/30 overflow-auto whitespace-pre editor-textarea"
        />
      </div>
    </div>
  );
};
