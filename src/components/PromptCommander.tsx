import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Play, Wand2, Zap, ArrowRight, CornerDownLeft, Loader2, Globe } from 'lucide-react';
import { OpenRouterSettings } from '../types';

interface PromptCommanderProps {
  onGenerate: (prompt: string) => Promise<void>;
  isGenerating: boolean;
  statusMessage: string;
  settings: OpenRouterSettings;
  onOpenSettings: () => void;
  activePrompt: string;
  setActivePrompt: (prompt: string) => void;
}

const QUICK_PROMPTS = [
  { label: '🔥 Habit Tracker', prompt: 'Build an interactive Habit Tracker app with local storage tracking, streaks, and categories' },
  { label: '🧮 Calculator', prompt: 'Build a working visual scientific calculator with dark theme and calculation history' },
  { label: '⛅ Weather Dashboard', prompt: 'Create an interactive weather dashboard with live forecast, city search, and metric cards' },
  { label: '📋 Kanban Board', prompt: 'Create a Kanban task management board with To Do, In Progress, and Completed columns' },
  { label: '⏳ Pomodoro Timer', prompt: 'Create a Pomodoro focus timer with circular progress and chime alerts' },
  { label: '🕹️ Cyber Snake Game', prompt: 'Create a retro arcade Snake game with score tracking, cyber neon style, and canvas animation' }
];

export const PromptCommander: React.FC<PromptCommanderProps> = ({
  onGenerate,
  isGenerating,
  statusMessage,
  settings,
  onOpenSettings,
  activePrompt,
  setActivePrompt
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea as text grows
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(160, Math.max(68, textareaRef.current.scrollHeight))}px`;
    }
  }, [activePrompt]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!activePrompt.trim() || isGenerating) return;
    onGenerate(activePrompt);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const hasResearchKeys = Boolean(settings.tavilyApiKey?.trim() || settings.serperApiKey?.trim());

  return (
    <div className="bg-slate-900/90 border-b border-slate-800 p-4 transition-all">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        {/* Header row of prompt box */}
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 font-medium text-slate-300">
            <Wand2 className="w-3.5 h-3.5 text-cyan-400" />
            <span>Prompt Command Box</span>
          </div>

          <div className="flex items-center gap-2">
            {hasResearchKeys && settings.enableWebResearch && (
              <span
                className="hidden sm:inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/30"
                title="When AI encounters novel prompts, it researches Tavily / Serper to think outside the box"
              >
                <Globe className="w-3 h-3 text-emerald-400" />
                <span>Web Research Active</span>
              </span>
            )}
            {settings.useGemini !== false ? (
              <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-300 border border-blue-500/30">
                <Zap className="w-3 h-3" />
                <span>{settings.geminiModel || 'gemini-4-hydrogen'}</span>
              </span>
            ) : settings.useOpenRouter && settings.apiKey ? (
              <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/30">
                <Zap className="w-3 h-3" />
                <span>Nemotron 3.5 (T: {settings.temperature})</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                <Sparkles className="w-3 h-3" />
                <span>Local Rule Compiler</span>
              </span>
            )}
            <button
              type="button"
              onClick={onOpenSettings}
              className="text-[11px] text-slate-400 hover:text-cyan-400 underline decoration-slate-700 underline-offset-2"
            >
              Configure
            </button>
          </div>
        </div>

        {/* Text Area Command Input */}
        <div className="relative group">
          <textarea
            ref={textareaRef}
            value={activePrompt}
            onChange={(e) => setActivePrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type natural language prompt (e.g. Build an interactive Habit Tracker with local storage, streaks, and progress rings...)"
            rows={2}
            className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500/70 focus:ring-1 focus:ring-cyan-500/50 resize-none transition-all pr-36 shadow-inner font-sans leading-relaxed"
          />

          {/* Action Button inside Textarea */}
          <div className="absolute right-2 bottom-2.5 flex items-center gap-1.5">
            <button
              type="submit"
              disabled={isGenerating || !activePrompt.trim()}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-md transition-all cursor-pointer ${
                isGenerating || !activePrompt.trim()
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
                  : 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 shadow-cyan-500/20 active:scale-95'
              }`}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Compiling...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Generate & Run</span>
                  <span className="hidden sm:inline-block text-[10px] opacity-75 font-mono ml-0.5">⌘↵</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Progress or Status message */}
        {statusMessage && (
          <div className="flex items-center gap-2 text-xs text-cyan-300 bg-cyan-950/40 px-3 py-1.5 rounded-lg border border-cyan-800/40">
            <div className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
            <span className="font-mono">{statusMessage}</span>
          </div>
        )}

        {/* Quick Suggestion Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-0.5 no-scrollbar">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 shrink-0">Try:</span>
          {QUICK_PROMPTS.map((item, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                setActivePrompt(item.prompt);
                onGenerate(item.prompt);
              }}
              className="px-2.5 py-1 text-xs bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-cyan-300 border border-slate-800 hover:border-slate-700 rounded-lg whitespace-nowrap transition-all shrink-0 cursor-pointer text-left"
            >
              {item.label}
            </button>
          ))}
        </div>
      </form>
    </div>
  );
};
