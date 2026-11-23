import { TargetFileScope, PromptIntentAnalysis } from '../types';

/**
 * Intelligent Intent Parser
 * Recognizes natural language commands like:
 * - "edit styles.css without researching: change colors to cyber neon"
 * - "edit app.js without researching: add sound effects to buttons"
 * - "generate a calculator without researching"
 * - "generate a weather app with research"
 * - "edit index.html without research: add header banner"
 */
export function analyzePromptIntent(
  rawPrompt: string,
  explicitTargetFile: TargetFileScope = 'all',
  explicitResearchMode: 'with-research' | 'without-research' | 'auto' = 'auto'
): PromptIntentAnalysis {
  const p = rawPrompt.toLowerCase().trim();

  // 1. Detect Research Mode
  let researchMode: 'with-research' | 'without-research' | 'auto' = explicitResearchMode;

  const noResearchPatterns = [
    'without research',
    'without researching',
    'no research',
    'no researching',
    'dont research',
    "don't research",
    'do not research',
    'skip research',
    'skip researching',
    'no web search',
    'without web search',
    'without searching',
    'offline',
    'zero research'
  ];

  const withResearchPatterns = [
    'with research',
    'with researching',
    'research and',
    'research it',
    'use research',
    'use serper',
    'use tavily',
    'search web',
    'web research',
    'look up online',
    'browse web'
  ];

  if (noResearchPatterns.some(pat => p.includes(pat))) {
    researchMode = 'without-research';
  } else if (withResearchPatterns.some(pat => p.includes(pat))) {
    researchMode = 'with-research';
  }

  // 2. Detect Target File Scope
  let targetFile: TargetFileScope = explicitTargetFile;

  if (targetFile === 'all') {
    if (p.includes('styles.css') || p.includes('style.css') || p.includes('in styles') || p.includes('edit css') || p.includes('in css') || p.includes('css file')) {
      targetFile = 'styles.css';
    } else if (p.includes('app.js') || p.includes('script.js') || p.includes('in js') || p.includes('edit js') || p.includes('in javascript') || p.includes('js file')) {
      targetFile = 'app.js';
    } else if (p.includes('index.html') || p.includes('in html') || p.includes('edit html') || p.includes('html file') || p.includes('in markup')) {
      targetFile = 'index.html';
    }
  }

  // 3. Detect Edit vs Generate
  const editKeywords = [
    'edit',
    'change',
    'modify',
    'update',
    'tweak',
    'add to',
    'fix',
    'adjust',
    'alter',
    'enhance',
    'refactor',
    'replace',
    'recolor',
    'restyle',
    'rename',
    'move',
    'hide',
    'show',
    'enable',
    'disable',
    'increase',
    'decrease',
    'enlarge',
    'shrink',
    'center',
    'align',
    'format',
    'validate',
    'highlight',
    'animate',
    'make the',
    'set the',
    'turn the',
    'switch the',
    'remove'
  ];

  const generateKeywords = [
    'generate a new',
    'build a new',
    'build me a new',
    'create a new',
    'create me a new',
    'start fresh',
    'from scratch',
    'new app'
  ];

  let isEdit = false;
  if (generateKeywords.some(pat => p.includes(pat))) {
    isEdit = false;
  } else if (targetFile !== 'all' || editKeywords.some(pat => p.includes(pat))) {
    isEdit = true;
  }

  // 4. Detect Surgical Precision / "Edit only that part and nothing else"
  const surgicalPatterns = [
    'only that part',
    'nothing else',
    'edit only',
    'change only',
    'touch only',
    'modify only',
    'surgical',
    'do not touch other',
    'do not touch anything else',
    'leave the rest',
    'leave other parts',
    'just that part'
  ];

  const surgicalOnly = surgicalPatterns.some(pat => p.includes(pat));

  // Try extracting specific target part from prompt
  let targetPart: string | undefined;
  const partMatch = rawPrompt.match(/(?:edit|change|modify|update)\s+only\s+(?:the\s+)?([^,.:\n]+?)(?:\s+(?:and\s+)?nothing\s+else|:|\.|$)/i);
  if (partMatch && partMatch[1]) {
    targetPart = partMatch[1].trim();
  }

  // Clean the prompt for the compiler / LLM to make the core instruction crystal clear
  let cleanUserInstruction = rawPrompt;

  return {
    isEdit,
    targetFile,
    researchMode,
    cleanUserInstruction,
    targetPart,
    surgicalOnly
  };
}
