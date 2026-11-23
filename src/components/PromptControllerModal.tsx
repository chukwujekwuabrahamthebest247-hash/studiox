import React, { useState } from 'react';
import { 
  X, 
  Target, 
  Brain, 
  Scale, 
  Sliders, 
  Sparkles, 
  Globe, 
  Volume2, 
  Database, 
  Check, 
  Plus, 
  RotateCcw,
  ShieldCheck,
  Zap
} from 'lucide-react';
import { PromptControllerConfig, ThinkingMode } from '../types';
import { QUICK_DIRECTIVE_CHIPS } from '../services/promptController';

interface PromptControllerModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: PromptControllerConfig;
  onSave: (newConfig: PromptControllerConfig) => void;
}

export const PromptControllerModal: React.FC<PromptControllerModalProps> = ({
  isOpen,
  onClose,
  config,
  onSave
}) => {
  const [thinkingMode, setThinkingMode] = useState<ThinkingMode>(config.thinkingMode);
  const [customDirectives, setCustomDirectives] = useState<string>(config.customDirectives);
  const [allowAutonomousResearch, setAllowAutonomousResearch] = useState<boolean>(config.allowAutonomousResearch);
  const [strictFidelity, setStrictFidelity] = useState<boolean>(config.strictFidelity);
  const [autoAudioHaptics, setAutoAudioHaptics] = useState<boolean>(config.autoAudioHaptics);
  const [localStoragePersistence, setLocalStoragePersistence] = useState<boolean>(config.localStoragePersistence);
  const [temperature, setTemperature] = useState<number>(config.temperatureOverride ?? 0.7);

  if (!isOpen) return null;

  const handleAddChipDirective = (text: string) => {
    if (!customDirectives.includes(text)) {
      setCustomDirectives(prev => prev ? `${prev.trim()}\n- ${text}` : `- ${text}`);
    }
  };

  const handleSave = () => {
    onSave({
      thinkingMode,
      customDirectives,
      allowAutonomousResearch,
      strictFidelity,
      autoAudioHaptics,
      localStoragePersistence,
      temperatureOverride: temperature
    });
    onClose();
  };

  const handleResetDefaults = () => {
    setThinkingMode('outside-the-box');
    setCustomDirectives('');
    setAllowAutonomousResearch(true);
    setStrictFidelity(false);
    setAutoAudioHaptics(true);
    setLocalStoragePersistence(true);
    setTemperature(0.7);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div 
        className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center text-slate-950 font-bold shadow-md shadow-cyan-500/20">
              <Sliders className="w-4 h-4 text-slate-950" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <span>Prompt Controller & AI Director</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-800/80">
                  Directive Guardrails
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">
                Tell the AI exactly what to do, when to think outside the box, and when to obey strict boundaries.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Section 1: When to Think Outside The Box vs Strict Mode */}
          <div>
            <label className="text-xs font-bold text-slate-200 uppercase tracking-wider mb-2 flex items-center justify-between">
              <span>Thinking Strategy & Innovation Bounds</span>
              <span className="text-[11px] font-mono font-normal text-slate-400">
                Controls AI speculation level
              </span>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Option A: Strict Mode */}
              <button
                type="button"
                onClick={() => setThinkingMode('strict')}
                className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col gap-2 relative ${
                  thinkingMode === 'strict'
                    ? 'bg-cyan-950/50 border-cyan-500 shadow-md shadow-cyan-500/10'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-950'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="w-7 h-7 rounded-lg bg-slate-900 border border-slate-700 flex items-center justify-center text-cyan-400">
                    <Target className="w-4 h-4" />
                  </div>
                  {thinkingMode === 'strict' && (
                    <span className="text-[10px] font-mono font-bold text-cyan-400 flex items-center gap-0.5">
                      <Check className="w-3 h-3" /> Active
                    </span>
                  )}
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-100">Strict & Literal</h4>
                  <p className="text-[10px] text-slate-400 mt-0.5 leading-relaxed">
                    <strong>Do NOT think outside the box</strong>. Implement only what is explicitly written with zero assumptions.
                  </p>
                </div>
              </button>

              {/* Option B: Balanced Mode */}
              <button
                type="button"
                onClick={() => setThinkingMode('balanced')}
                className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col gap-2 relative ${
                  thinkingMode === 'balanced'
                    ? 'bg-blue-950/50 border-blue-500 shadow-md shadow-blue-500/10'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-950'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="w-7 h-7 rounded-lg bg-slate-900 border border-slate-700 flex items-center justify-center text-blue-400">
                    <Scale className="w-4 h-4" />
                  </div>
                  {thinkingMode === 'balanced' && (
                    <span className="text-[10px] font-mono font-bold text-blue-400 flex items-center gap-0.5">
                      <Check className="w-3 h-3" /> Active
                    </span>
                  )}
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-100">Balanced Adaptive</h4>
                  <p className="text-[10px] text-slate-400 mt-0.5 leading-relaxed">
                    Follows user request faithfully while applying standard UI design and usability conventions.
                  </p>
                </div>
              </button>

              {/* Option C: Think Outside The Box */}
              <button
                type="button"
                onClick={() => setThinkingMode('outside-the-box')}
                className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col gap-2 relative ${
                  thinkingMode === 'outside-the-box'
                    ? 'bg-purple-950/50 border-purple-500 shadow-md shadow-purple-500/10'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-950'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="w-7 h-7 rounded-lg bg-slate-900 border border-slate-700 flex items-center justify-center text-purple-400">
                    <Brain className="w-4 h-4" />
                  </div>
                  {thinkingMode === 'outside-the-box' && (
                    <span className="text-[10px] font-mono font-bold text-purple-400 flex items-center gap-0.5">
                      <Check className="w-3 h-3" /> Active
                    </span>
                  )}
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-100">Think Outside Box</h4>
                  <p className="text-[10px] text-slate-400 mt-0.5 leading-relaxed">
                    <strong>Max innovation</strong>: Enriches with web research, audio feedback, smart shortcuts, and rich interactions.
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* Section 2: Tell AI What To Do (Custom Directives) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                Tell AI What To Do (Custom Directives & Rules)
              </label>
              <span className="text-[10px] text-slate-500 font-mono">
                Injected into system instructions
              </span>
            </div>
            <textarea
              value={customDirectives}
              onChange={(e) => setCustomDirectives(e.target.value)}
              placeholder="Give AI permanent instructions (e.g., 'Always use high-contrast text', 'Include reset button', 'Never delete user habits', 'Add sound effects')..."
              rows={3}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500 font-sans leading-relaxed resize-none shadow-inner"
            />

            {/* Quick Directive Chips */}
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="text-[10px] text-slate-500 uppercase font-mono py-0.5">Add Rule:</span>
              {QUICK_DIRECTIVE_CHIPS.map((chip, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleAddChipDirective(chip.directive)}
                  className="px-2 py-0.5 text-[10px] bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-cyan-300 border border-slate-800 rounded-md transition-colors cursor-pointer flex items-center gap-1"
                >
                  <Plus className="w-2.5 h-2.5 text-cyan-400" />
                  <span>{chip.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Section 3: Fine-Tuned Feature Guardrails */}
          <div>
            <label className="text-xs font-bold text-slate-200 uppercase tracking-wider mb-2.5 block">
              Behavioral Guardrails
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <label className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 cursor-pointer hover:border-slate-700 transition-colors">
                <input
                  type="checkbox"
                  checked={allowAutonomousResearch}
                  onChange={(e) => setAllowAutonomousResearch(e.target.checked)}
                  className="mt-0.5 rounded text-cyan-500 focus:ring-0 bg-slate-900 border-slate-700"
                />
                <div className="flex flex-col text-xs">
                  <span className="font-semibold text-slate-200 flex items-center gap-1">
                    <Globe className="w-3 h-3 text-emerald-400" />
                    <span>Autonomous Web Research (Tavily/Serper)</span>
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Search web automatically when thinking outside the box
                  </span>
                </div>
              </label>

              <label className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 cursor-pointer hover:border-slate-700 transition-colors">
                <input
                  type="checkbox"
                  checked={autoAudioHaptics}
                  onChange={(e) => setAutoAudioHaptics(e.target.checked)}
                  className="mt-0.5 rounded text-cyan-500 focus:ring-0 bg-slate-900 border-slate-700"
                />
                <div className="flex flex-col text-xs">
                  <span className="font-semibold text-slate-200 flex items-center gap-1">
                    <Volume2 className="w-3 h-3 text-cyan-400" />
                    <span>Synthesize Tactile Sound Effects</span>
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Include Web Audio click & chime feedback on buttons
                  </span>
                </div>
              </label>

              <label className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 cursor-pointer hover:border-slate-700 transition-colors">
                <input
                  type="checkbox"
                  checked={localStoragePersistence}
                  onChange={(e) => setLocalStoragePersistence(e.target.checked)}
                  className="mt-0.5 rounded text-cyan-500 focus:ring-0 bg-slate-900 border-slate-700"
                />
                <div className="flex flex-col text-xs">
                  <span className="font-semibold text-slate-200 flex items-center gap-1">
                    <Database className="w-3 h-3 text-amber-400" />
                    <span>Automatic LocalStorage Persistence</span>
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Ensure user data persists across page reloads
                  </span>
                </div>
              </label>

              <label className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 cursor-pointer hover:border-slate-700 transition-colors">
                <input
                  type="checkbox"
                  checked={strictFidelity}
                  onChange={(e) => setStrictFidelity(e.target.checked)}
                  className="mt-0.5 rounded text-cyan-500 focus:ring-0 bg-slate-900 border-slate-700"
                />
                <div className="flex flex-col text-xs">
                  <span className="font-semibold text-slate-200 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-cyan-400" />
                    <span>Strict Zero-Mistake Guardrail</span>
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Enforce complete code output with zero omissions
                  </span>
                </div>
              </label>
            </div>
          </div>

          {/* Section 4: Creativity & Precision Temperature Slider */}
          <div>
            <div className="flex items-center justify-between mb-1.5 text-xs">
              <span className="font-bold text-slate-200 uppercase tracking-wider">
                Precision vs Creativity Temperature
              </span>
              <span className="font-mono text-cyan-400 font-bold">{temperature.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="0.0"
              max="1.0"
              step="0.05"
              value={temperature}
              onChange={(e) => setTemperature(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-1">
              <span>0.0 (Strict Precision)</span>
              <span>0.7 (Optimal Balanced)</span>
              <span>1.0 (Maximum Creative Autonomy)</span>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3.5 border-t border-slate-800 bg-slate-950/50 flex items-center justify-between">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset to Defaults</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 text-xs font-semibold text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs rounded-lg shadow-md shadow-cyan-500/20 cursor-pointer transition-all active:scale-95"
            >
              <Check className="w-3.5 h-3.5 text-slate-950" />
              <span>Save & Apply Directives</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
