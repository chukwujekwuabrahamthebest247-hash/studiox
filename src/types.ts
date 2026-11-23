export interface CodeState {
  html: string;
  css: string;
  js: string;
}

export interface ConsoleLogItem {
  id: string;
  type: 'log' | 'info' | 'warn' | 'error' | 'system';
  message: string;
  args?: string[];
  timestamp: string;
}

export interface OpenRouterSettings {
  apiKey: string;
  model: string;
  temperature: number;
  useOpenRouter: boolean;
  useGemini?: boolean;
  geminiModel?: string;
  customModel?: string;
  serperApiKey?: string;
  tavilyApiKey?: string;
  enableWebResearch?: boolean;
  groqApiKey?: string;
  groqModel?: string;
  groqCustomModel?: string;
  useGroqFallback?: boolean;
}

export type ThinkingMode = 'strict' | 'balanced' | 'outside-the-box';

export interface PromptControllerConfig {
  thinkingMode: ThinkingMode;
  customDirectives: string;
  allowAutonomousResearch: boolean;
  strictFidelity: boolean;
  autoAudioHaptics: boolean;
  localStoragePersistence: boolean;
  temperatureOverride?: number;
}

export interface ResearchFinding {
  provider: 'tavily' | 'serper' | 'combined';
  query: string;
  summary: string;
  results: Array<{
    title: string;
    url: string;
    snippet: string;
  }>;
  timestamp: string;
}

export type ViewportMode = 'desktop' | 'tablet' | 'mobile' | 'responsive';
export type WorkshopViewMode = 'preview' | 'split' | 'code';

export interface TemplateApp {
  id: string;
  name: string;
  category: string;
  keywords: string[];
  description: string;
  code: CodeState;
}

export type FileType = 'html' | 'css' | 'js' | 'markdown' | 'json';
export type TargetFileScope = 'all' | 'index.html' | 'styles.css' | 'app.js';

export interface PromptIntentAnalysis {
  isEdit: boolean;
  targetFile: TargetFileScope;
  researchMode: 'with-research' | 'without-research' | 'auto';
  cleanUserInstruction: string;
  targetPart?: string;
  surgicalOnly?: boolean;
}

export interface ProjectFile {
  id: string;
  name: string;
  type: FileType;
  path: string;
}

export interface UploadedFilePayload {
  name: string;
  content: string;
  type: 'html' | 'css' | 'js' | 'other';
  targetPart?: string;
  surgicalLock: boolean;
  lineCount?: number;
  sizeBytes?: number;
}

export interface BuildTurn {
  id: string;
  prompt: string;
  timestamp: string;
  model: string;
  status: 'completed' | 'generating' | 'failed';
  summary?: string;
  explanation?: string;
  researchFinding?: ResearchFinding | null;
  image?: string;
  targetFile?: TargetFileScope;
  researchMode?: 'with-research' | 'without-research' | 'auto';
  actionType?: 'edit' | 'generate';
  uploadedFile?: {
    name: string;
    targetPart?: string;
    surgicalLock: boolean;
  };
  modifiedFiles?: Array<{
    path: string;
    name: string;
    content: string;
  }>;
}

export interface DeploymentInfo {
  isDeployed: boolean;
  url: string;
  deployedAt?: string;
  hostingProvider: 'cloudrun' | 'firebase' | 'sideload';
}
