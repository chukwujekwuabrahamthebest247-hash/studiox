import { PromptControllerConfig, ThinkingMode } from '../types';

const PROMPT_CONTROLLER_KEY = 'studiox_prompt_controller_v1';

export const DEFAULT_PROMPT_CONTROLLER_CONFIG: PromptControllerConfig = {
  thinkingMode: 'outside-the-box',
  customDirectives: '',
  allowAutonomousResearch: true,
  strictFidelity: false,
  autoAudioHaptics: true,
  localStoragePersistence: true,
  temperatureOverride: 0.7
};

export const QUICK_DIRECTIVE_CHIPS = [
  { label: '🎯 Strict Exact Match', directive: 'Follow user instructions with zero assumptions. Do not add unrequested features.' },
  { label: '🧠 Think Outside The Box', directive: 'Innovate with rich workflows, modern cards, smart shortcuts, and intuitive features.' },
  { label: '🔊 Tactile Audio Sounds', directive: 'Incorporate Web Audio synthesized clicks, chimes, and interaction feedback on all buttons.' },
  { label: '💾 Persistent LocalStorage', directive: 'Automatically persist user state and data in window.localStorage so data survives page reload.' },
  { label: '🎨 Cyber Neon Dark Theme', directive: 'Use a sleek futuristic dark theme with glowing neon accents, smooth gradients, and rounded cards.' },
  { label: '📱 Mobile Responsive Touch', directive: 'Ensure all controls, buttons, and touch targets are easy to tap on mobile phone screens.' },
  { label: '⚡ Keyboard Shortcuts', directive: 'Support intuitive keyboard shortcuts (e.g. Enter, Esc, Space, Arrows) for key actions.' }
];

export function loadPromptControllerConfig(): PromptControllerConfig {
  try {
    const raw = localStorage.getItem(PROMPT_CONTROLLER_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        thinkingMode: parsed.thinkingMode || 'outside-the-box',
        customDirectives: parsed.customDirectives || '',
        allowAutonomousResearch: typeof parsed.allowAutonomousResearch === 'boolean' ? parsed.allowAutonomousResearch : true,
        strictFidelity: Boolean(parsed.strictFidelity),
        autoAudioHaptics: typeof parsed.autoAudioHaptics === 'boolean' ? parsed.autoAudioHaptics : true,
        localStoragePersistence: typeof parsed.localStoragePersistence === 'boolean' ? parsed.localStoragePersistence : true,
        temperatureOverride: typeof parsed.temperatureOverride === 'number' ? parsed.temperatureOverride : 0.7
      };
    }
  } catch (e) {
    console.warn('Failed to load prompt controller config from localStorage:', e);
  }
  return { ...DEFAULT_PROMPT_CONTROLLER_CONFIG };
}

export function savePromptControllerConfig(config: PromptControllerConfig): void {
  try {
    localStorage.setItem(PROMPT_CONTROLLER_KEY, JSON.stringify(config));
  } catch (e) {
    console.warn('Failed to save prompt controller config to localStorage:', e);
  }
}

/**
 * Builds the explicit prompt directives based on the controller configuration.
 */
export function buildControllerPromptAddendum(config: PromptControllerConfig): string {
  const parts: string[] = [];

  if (config.thinkingMode === 'strict') {
    parts.push(`[PROMPT CONTROLLER DIRECTIVE: STRICT FIDELITY MODE - DO NOT THINK OUTSIDE THE BOX]
1. Absolute Strictness: Execute ONLY what the user explicitly requested. Do NOT make assumptions, and do NOT add unrequested extra features, speculative buttons, or unprompted modules.
2. Keep the design and scope 100% focused on the literal user prompt with zero unsolicited deviations.`);
  } else if (config.thinkingMode === 'outside-the-box') {
    parts.push(`[PROMPT CONTROLLER DIRECTIVE: THINK OUTSIDE THE BOX - AUTONOMOUS INNOVATION]
1. Think Outside The Box: Innovate boldly! In addition to fulfilling the user's request, enrich the app with clever interactive mechanics, intuitive keyboard shortcuts, elegant visual cards, and polished domain workflows.
2. Anticipate the user's unstated needs with smart defaults, clean animations, and high-end design fidelity.`);
  } else {
    parts.push(`[PROMPT CONTROLLER DIRECTIVE: BALANCED ADAPTIVE MODE]
Follow user requirements faithfully while applying standard modern frontend UX and design best practices.`);
  }

  if (config.strictFidelity) {
    parts.push(`- Zero-Mistake Guardrail: Do not omit or truncate any code. Keep all pre-existing features intact.`);
  }

  if (config.autoAudioHaptics) {
    parts.push(`- Interaction Feedback: Ensure all buttons and state toggles trigger pleasant feedback or console.log events.`);
  }

  if (config.localStoragePersistence) {
    parts.push(`- Data Persistence: Store any created items or user state in localStorage.`);
  }

  if (config.customDirectives.trim()) {
    parts.push(`\n[USER CUSTOM DIRECTIVES & MUST-FOLLOW RULES]:
${config.customDirectives.trim()}`);
  }

  return parts.join('\n\n');
}
