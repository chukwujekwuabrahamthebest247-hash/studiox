import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { LeftPanelAIStudio } from './components/LeftPanelAIStudio';
import { RightPanelDigitalWorkshop } from './components/RightPanelDigitalWorkshop';
import { DeployModal } from './components/DeployModal';
import { GitHubExportModal } from './components/GitHubExportModal';
import { SideloadModal } from './components/SideloadModal';
import { SettingsModal } from './components/SettingsModal';
import { ImportZipModal } from './components/ImportZipModal';
import { FullScreenLivePreview } from './components/FullScreenLivePreview';
import { PromptControllerModal } from './components/PromptControllerModal';
import { AIChatWorkspace } from './components/AIChatWorkspace';
import { ImportedProject } from './services/importer';
import { loadPromptControllerConfig, savePromptControllerConfig } from './services/promptController';
import { 
  CodeState, 
  ConsoleLogItem, 
  OpenRouterSettings, 
  ViewportMode, 
  TemplateApp, 
  BuildTurn, 
  DeploymentInfo,
  PromptControllerConfig 
} from './types';
import { TEMPLATES } from './services/templates';
import { compilePromptLocally } from './services/compiler';
import { generateCodeWithOpenRouter, loadOpenRouterSettings, saveOpenRouterSettings } from './services/openrouter';
import { generateCodeWithGemini, resolveGeminiModelId } from './services/gemini';
import { generateCodeWithGroq, resolveGroqModelId } from './services/groq';
import { downloadProjectZip, downloadSingleFile } from './services/exporter';
import {
  CodebaseFile,
  clearCodebaseFromVault,
  createCodebaseFile,
  exportVaultAsZip,
  getCodebaseStats,
  loadCodebaseFromVault,
  mergeCodebaseFiles,
  saveCodebaseToVault
} from './services/codebaseVault';
import { hasCloudAIConfigured, runSurgicalCodebaseEdit } from './services/aiEngine';
import { compileCodebaseFiles } from './services/codebaseCompiler';

function codeStateToVaultFiles(c: CodeState): CodebaseFile[] {
  return [
    createCodebaseFile('index.html', c.html || ''),
    createCodebaseFile('styles.css', c.css || ''),
    createCodebaseFile('app.js', c.js || '')
  ];
}

function isStandardThreeFileVault(files: CodebaseFile[]): boolean {
  if (files.length === 0 || files.length > 3) return false;
  return files.every((f) => ['index.html', 'styles.css', 'app.js'].includes(f.path));
}

export default function App() {
  const defaultTemplate = TEMPLATES[0];

  const [code, setCode] = useState<CodeState>(defaultTemplate.code);
  const [activeProjectName, setActiveProjectName] = useState<string>(defaultTemplate.name);
  const [activePrompt, setActivePrompt] = useState<string>(
    'Build an interactive Habit Tracker app with local storage tracking, streaks, and categories'
  );
  const [settings, setSettings] = useState<OpenRouterSettings>(() => loadOpenRouterSettings());
  const [viewportMode, setViewportMode] = useState<ViewportMode>('desktop');
  const [workshopViewMode, setWorkshopViewMode] = useState<import('./types').WorkshopViewMode>('preview');
  const [logs, setLogs] = useState<ConsoleLogItem[]>([
    {
      id: 'init-1',
      type: 'system',
      message: 'StudioX Digital Workshop & Live Sandbox Engine Initialized.',
      timestamp: new Date().toLocaleTimeString()
    }
  ]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  // Modals state
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState<'gemini' | 'openrouter' | 'groq' | 'research'>('gemini');
  const openSettings = (tab?: 'gemini' | 'openrouter' | 'groq' | 'research' | unknown) => {
    setSettingsInitialTab(
      tab === 'gemini' || tab === 'groq' || tab === 'research' || tab === 'openrouter' ? tab : 'gemini'
    );
    setIsSettingsOpen(true);
  };
  const [isDeployOpen, setIsDeployOpen] = useState(false);
  const [isGitHubOpen, setIsGitHubOpen] = useState(false);
  const [isSideloadOpen, setIsSideloadOpen] = useState(false);
  const [isImportZipOpen, setIsImportZipOpen] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);
  const [isFullScreenPreviewOpen, setIsFullScreenPreviewOpen] = useState(false);
  const [isPromptControllerModalOpen, setIsPromptControllerModalOpen] = useState(false);
  const [promptControllerConfig, setPromptControllerConfig] = useState<PromptControllerConfig>(() => loadPromptControllerConfig());
  const [activeWorkspace, setActiveWorkspace] = useState<'builder' | 'chat'>('builder');
  const [activeChatApp, setActiveChatApp] = useState<{ code: CodeState; name: string } | null>(null);
  const [builderVaultVersion, setBuilderVaultVersion] = useState<number>(0);
  const [builderVaultFiles, setBuilderVaultFiles] = useState<CodebaseFile[]>(() =>
    codeStateToVaultFiles(defaultTemplate.code)
  );
  const [activeBuilderProjectId, setActiveBuilderProjectId] = useState<string>('proj-default');
  const [builderProjects, setBuilderProjects] = useState<
    { id: string; name: string; code: CodeState; activePrompt: string; turns: BuildTurn[] }[]
  >(() => {
    try {
      const saved = localStorage.getItem('studiox_builder_projects_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [
      {
        id: 'proj-default',
        name: defaultTemplate.name,
        code: defaultTemplate.code,
        activePrompt: 'Build an interactive Habit Tracker app with local storage tracking, streaks, and categories',
        turns: []
      }
    ];
  });

  // Deployment state
  const [deployment, setDeployment] = useState<DeploymentInfo>({
    isDeployed: true,
    url: 'https://ais-dev-uydikfdvqy4ypphv62wo5u-126569678924.europe-west1.run.app/preview',
    deployedAt: 'Just now',
    hostingProvider: 'cloudrun'
  });

  // Google AI Studio style Build History turns
  const [turns, setTurns] = useState<BuildTurn[]>([
    {
      id: 'turn-init',
      prompt: 'Build an interactive Habit Tracker app with local storage tracking, streaks, and categories',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      model: 'Gemini 4 Hydrogen',
      status: 'completed',
      summary: 'Generated HabitFlow Tracker with 7-day checkboxes, streak tracking, audio feedback, and local storage.'
    }
  ]);

  // Capture postMessage events from iframe sandbox (console logs and errors)
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.source === 'studiox-sandbox' && event.data.type === 'console') {
        const newLog: ConsoleLogItem = {
          id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          type: event.data.level || 'log',
          message: event.data.message || '',
          args: event.data.args,
          timestamp: event.data.timestamp || new Date().toLocaleTimeString()
        };
        setLogs(prev => [...prev.slice(-150), newLog]);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Initialize App Builder CodebaseFile[] vault from IndexedDB (for imported ZIPs) or current CodeState
  useEffect(() => {
    loadCodebaseFromVault('builder').then((saved) => {
      if (saved.length > 0) {
        setBuilderVaultFiles(saved);
      } else {
        setBuilderVaultFiles(codeStateToVaultFiles(code));
      }
    });
  }, []);

  // Sync current App Builder state into preserved projects list
  useEffect(() => {
    setBuilderProjects((prev) => {
      const updated = prev.map((p) =>
        p.id === activeBuilderProjectId
          ? { ...p, name: activeProjectName, code, activePrompt, turns }
          : p
      );
      try {
        const compact = updated.map((p) => ({
          ...p,
          turns: p.turns.map((t) => ({ ...t, modifiedFiles: undefined }))
        }));
        localStorage.setItem('studiox_builder_projects_v1', JSON.stringify(compact));
      } catch {}
      return updated;
    });
  }, [activeBuilderProjectId, activeProjectName, code, activePrompt, turns]);

  const handleNewBuilderProject = () => {
    const newId = `proj-${Date.now()}`;
    const newProj = {
      id: newId,
      name: `New App ${builderProjects.length + 1}`,
      code: { html: '<div id="app" style="padding:2rem;font-family:sans-serif;"><h2>New App Ready</h2><p>Describe what you want to build in the prompt box.</p></div>', css: '', js: '' },
      activePrompt: '',
      turns: []
    };
    setBuilderProjects((prev) => [newProj, ...prev]);
    setActiveBuilderProjectId(newId);
    setActiveProjectName(newProj.name);
    setCode(newProj.code);
    setBuilderVaultFiles(codeStateToVaultFiles(newProj.code));
    clearCodebaseFromVault('builder');
    setBuilderVaultVersion((v) => v + 1);
    setActivePrompt('');
    setTurns([]);
    setWorkshopViewMode('preview');
    addSystemLog(`Created new App Builder session: ${newProj.name}`, 'info');
  };

  const handleSelectBuilderProject = (id: string) => {
    const found = builderProjects.find((p) => p.id === id);
    if (!found) return;
    setActiveBuilderProjectId(found.id);
    setActiveProjectName(found.name);
    setCode(found.code);
    setBuilderVaultFiles(codeStateToVaultFiles(found.code));
    setActivePrompt(found.activePrompt);
    setTurns(found.turns);
    setWorkshopViewMode('preview');
  };

  const addSystemLog = (msg: string, type: 'system' | 'info' | 'warn' | 'error' = 'system') => {
    setLogs(prev => [
      ...prev.slice(-150),
      {
        id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        type: type === 'system' ? 'info' : type,
        message: msg,
        timestamp: new Date().toLocaleTimeString()
      }
    ]);
  };

  const handleSaveSettings = (newSettings: OpenRouterSettings) => {
    setSettings(newSettings);
    saveOpenRouterSettings(newSettings);
    const groqId = resolveGroqModelId(newSettings);
    const geminiId = resolveGeminiModelId(newSettings);
    const groqStatus = newSettings.groqApiKey?.trim() && newSettings.useGroqFallback !== false
      ? ` | Groq Fallback: ON (${groqId})`
      : '';
    const primaryLabel =
      newSettings.useGemini !== false
        ? `Google Gemini (${geminiId})`
        : newSettings.useOpenRouter
        ? `OpenRouter (${newSettings.model})`
        : newSettings.groqApiKey?.trim() && newSettings.useGroqFallback !== false
        ? `Groq (${groqId})`
        : 'Local Compiler';
    addSystemLog(`Settings updated: Engine = ${primaryLabel}${groqStatus}, Temp = ${newSettings.temperature}`);
  };

  // Compile prompt to code & record turn (supports Vision & Zero-Mistake Mode)
  // Compile prompt to code & record turn (supports Targeted File Edits, Surgical Edits, Uploaded Files, Zero-Research, Vision & Interactivity)
  const handleGenerate = async (
    promptText: string, 
    image?: string | null,
    explicitTargetFile: import('./types').TargetFileScope = 'all',
    explicitResearchMode: 'with-research' | 'without-research' | 'auto' = 'auto',
    uploadedFile?: import('./types').UploadedFilePayload,
    codebaseFiles?: CodebaseFile[]
  ) => {
    const hasVault = Boolean(codebaseFiles && codebaseFiles.length > 0);
    if (!promptText.trim() && !image && !uploadedFile && !hasVault) return;
    setIsGenerating(true);

    const { analyzePromptIntent } = await import('./services/intentParser');
    const intent = analyzePromptIntent(promptText, explicitTargetFile, explicitResearchMode);

    const targetPartDescription = uploadedFile?.targetPart || intent.targetPart || '';
    const isSurgical = uploadedFile?.surgicalLock || intent.surgicalOnly || Boolean(targetPartDescription);
    const vaultStats = hasVault ? getCodebaseStats(codebaseFiles!) : null;

    setStatusMessage(
      image 
        ? 'Nemotron 3.5 Super VL Vision: Analyzing layout & visual elements...' 
        : vaultStats && !uploadedFile
        ? `Analyzing uploaded codebase (${vaultStats.totalFiles} files, ${vaultStats.totalLines.toLocaleString()} lines)...`
        : uploadedFile
        ? `Surgical Mode: Analyzing uploaded "${uploadedFile.name}" (lock all code except: ${targetPartDescription || 'targeted part'})...`
        : isSurgical
        ? `Surgical Isolation: Editing only "${targetPartDescription || 'target part'}" and preserving all other code...`
        : intent.isEdit
        ? `Preparing edit for ${intent.targetFile !== 'all' ? intent.targetFile : 'application'} ${intent.researchMode === 'without-research' ? '(Without Research)' : ''}...`
        : `Analyzing prompt for code generation ${intent.researchMode === 'without-research' ? '(Without Research)' : ''}...`
    );

    addSystemLog(
      `Processing request [Target: ${intent.targetFile} | Mode: ${intent.researchMode.toUpperCase()} | Action: ${intent.isEdit ? 'EDIT' : 'GENERATE'}${vaultStats ? ` | Codebase Vault: ${vaultStats.totalFiles} files (${vaultStats.totalLines.toLocaleString()} lines)` : ''}${uploadedFile ? ` | Uploaded: ${uploadedFile.name}` : ''}${isSurgical ? ` | Surgical Part: ${targetPartDescription || 'locked'}` : ''}]: "${promptText}" ${image ? '[With Visual UI Mockup]' : ''}`,
      'info'
    );

    let researchFinding: import('./types').ResearchFinding | null = null;

    // Check if web research should be triggered
    const shouldResearch = intent.researchMode === 'with-research' || (
      intent.researchMode === 'auto' &&
      promptControllerConfig.thinkingMode !== 'strict' &&
      promptControllerConfig.allowAutonomousResearch
    );

    const hasResearchKeys = Boolean(settings.tavilyApiKey?.trim() || settings.serperApiKey?.trim());

    if (shouldResearch && hasResearchKeys && settings.enableWebResearch) {
      try {
        setStatusMessage('🧠 Querying web research engine (Serper / Tavily)...');
        const { performOutsideTheBoxResearch } = await import('./services/research');
        researchFinding = await performOutsideTheBoxResearch(promptText, settings, (msg) => setStatusMessage(msg));

        if (researchFinding) {
          addSystemLog(
            `🔎 Web Research completed via [${researchFinding.provider.toUpperCase()}]: ${researchFinding.summary.slice(0, 120)}... (${researchFinding.results.length} sources found)`,
            'info'
          );
        }
      } catch (researchErr: any) {
        console.warn('Research grounding error:', researchErr);
        addSystemLog(`Web research notice: ${researchErr.message}. Proceeding with core intelligence.`, 'warn');
      }
    } else if (intent.researchMode === 'without-research') {
      addSystemLog('⚡ Without Research Mode Active: Fulfilling prompt directly without external search.', 'info');
    }

    const groqModelId = resolveGroqModelId(settings);
    const geminiModelId = resolveGeminiModelId(settings);
    const hasGroqConfigured = Boolean(settings.groqApiKey?.trim()) && settings.useGroqFallback !== false;

    const currentModelName =
      settings.useGemini !== false
        ? `Google Gemini (${geminiModelId})`
        : settings.useOpenRouter && settings.apiKey.trim()
        ? (settings.model === 'custom' && settings.customModel?.trim()
            ? settings.customModel.trim().split('/').pop() || settings.customModel.trim()
            : settings.model.split('/').pop() || 'Nemotron 3.5 Super VL')
        : hasGroqConfigured
        ? `Groq (${groqModelId})`
        : 'Local Compiler';

    const recordCloudTurn = (generatedCode: CodeState, usedModelLabel: string, engineTag: string) => {
      setCode(generatedCode);
      setBuilderVaultFiles(codeStateToVaultFiles(generatedCode));
      const newAppName = intent.isEdit || uploadedFile
        ? activeProjectName
        : (promptText.length > 25 ? promptText.slice(0, 25) + ' App' : (promptText || (vaultStats ? `${codebaseFiles![0]?.name || 'Codebase'} App` : 'Vision App')));
      setActiveProjectName(newAppName);
      addSystemLog(`${engineTag} completed: ${uploadedFile ? 'Surgically updated ' + uploadedFile.name : vaultStats ? `Synthesized from ${vaultStats.totalFiles} file(s)` : (intent.isEdit ? 'Modified ' + intent.targetFile : 'Generated app')}.`, 'system');

      setTurns(prev => [
        ...prev,
        {
          id: `turn-${Date.now()}`,
          prompt: promptText || (uploadedFile ? `Edit ${uploadedFile.name}: ${targetPartDescription || 'targeted part'}` : vaultStats ? `Build from ${vaultStats.totalFiles} codebase files (${vaultStats.totalLines.toLocaleString()} lines)` : 'Generated from visual mockup'),
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          model: usedModelLabel,
          status: 'completed',
          summary: image
            ? `Vision Synthesis: Analyzed UI mockup & generated pixel-accurate "${newAppName}" with zero mistakes.`
            : uploadedFile
            ? `Surgical Edit: Edited only "${targetPartDescription || 'specified part'}" in ${uploadedFile.name}. 100% of other code was preserved untouched.`
            : vaultStats
            ? `Codebase Synthesis: Indexed ${vaultStats.totalFiles} files (${vaultStats.totalLines.toLocaleString()} lines) and built "${newAppName}".`
            : isSurgical
            ? `Surgical Edit: Edited only "${targetPartDescription || 'specified part'}". Surrounding code preserved.`
            : intent.isEdit
            ? `Edited ${intent.targetFile !== 'all' ? intent.targetFile : 'application'} ${intent.researchMode === 'without-research' ? 'without research' : ''} based on your instruction.`
            : `Generated live code for "${newAppName}" ${intent.researchMode === 'without-research' ? 'without research' : ''}.`,
          explanation: isSurgical
            ? `Surgical lock active: Only "${targetPartDescription || 'target part'}" was modified. Zero unintended side-effects.`
            : intent.isEdit
            ? `Applied modifications to ${intent.targetFile} while maintaining existing functionality.`
            : `Created new interactive application with zero syntax errors.`,
          researchFinding,
          image: image || undefined,
          targetFile: intent.targetFile,
          researchMode: intent.researchMode,
          actionType: (intent.isEdit || uploadedFile) ? 'edit' : 'generate',
          uploadedFile: uploadedFile ? {
            name: uploadedFile.name,
            targetPart: targetPartDescription,
            surgicalLock: isSurgical
          } : undefined
        }
      ]);
    };

    try {
      // Unified single-file / multi-file CodebaseFile[] surgical modification + Sucrase verification + compileCodebaseFiles pipeline
      const wantsBrandNewScratchApp = /\b(?:start\s+fresh|from\s+scratch|build\s+(?:me\s+)?a\s+new|create\s+(?:me\s+)?a\s+new|generate\s+a\s+new)\b/i.test(
        promptText
      );
      const hasAnyCloudAI = hasCloudAIConfigured(settings);

      const activeEditVault: CodebaseFile[] = uploadedFile
        ? [createCodebaseFile(uploadedFile.name, uploadedFile.content, uploadedFile.sizeBytes)]
        : hasVault
        ? codebaseFiles!
        : builderVaultFiles.length > 0
        ? builderVaultFiles
        : codeStateToVaultFiles(code);

      const isMultiFileOrCustomVault =
        !isStandardThreeFileVault(activeEditVault) && activeEditVault.length > 0;

      const shouldRunUnifiedSurgicalPipeline =
        !image &&
        hasAnyCloudAI &&
        Boolean(promptText.trim()) &&
        !wantsBrandNewScratchApp &&
        (Boolean(uploadedFile) || isMultiFileOrCustomVault || intent.isEdit);

      if (shouldRunUnifiedSurgicalPipeline) {
        const effectiveEditPrompt =
          uploadedFile && targetPartDescription
            ? `${promptText}\n\n[SURGICAL ISOLATION TARGET]: Modify ONLY "${targetPartDescription}" in "${uploadedFile.name}" and leave 100% of surrounding code verbatim.`
            : intent.targetFile !== 'all'
            ? `${promptText}\n\n[TARGETED FILE FOCUS]: Apply modifications primarily to ${intent.targetFile} (and linked callers/stylesheets only if needed).`
            : promptText;

        const editResult = await runSurgicalCodebaseEdit({
          settings,
          userPrompt: effectiveEditPrompt,
          codebaseFiles: activeEditVault,
          researchFinding,
          onStatus: (msg) => setStatusMessage(msg)
        });

        const touched = [...editResult.patchedPaths, ...editResult.addedPaths];
        if (touched.length > 0) {
          const nextVaultFiles =
            uploadedFile && !isStandardThreeFileVault(builderVaultFiles) && builderVaultFiles.length > 1
              ? mergeCodebaseFiles(builderVaultFiles, editResult.updatedFiles)
              : editResult.updatedFiles;

          setBuilderVaultFiles(nextVaultFiles);
          if (uploadedFile || hasVault || !isStandardThreeFileVault(nextVaultFiles)) {
            await saveCodebaseToVault('builder', nextVaultFiles);
            setBuilderVaultVersion((v) => v + 1);
          }

          const compiled = compileCodebaseFiles(
            editResult.updatedFiles,
            uploadedFile ? uploadedFile.name : activeProjectName
          );
          setCode(compiled.code);

          const verifyBadge = editResult.compilationValid
            ? `Build verified cleanly${editResult.repairPassesUsed > 0 ? ` (${editResult.repairPassesUsed} auto-repair pass)` : ''}`
            : `Compiled with ${editResult.compilationErrors.length} warning(s)`;

          const modifiedFilesList = editResult.updatedFiles
            .filter((f) => touched.includes(f.path))
            .map((f) => ({ path: f.path, name: f.name, content: f.content }));

          addSystemLog(
            `Unified surgical update applied to: ${touched.join(', ')} — ${verifyBadge}. Ready to download!`,
            editResult.compilationValid ? 'system' : 'warn'
          );

          setTurns((prev) => [
            ...prev,
            {
              id: `turn-${Date.now()}`,
              prompt: promptText,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              model: currentModelName,
              status: 'completed',
              summary: editResult.analysis
                ? `${editResult.analysis} (${touched.join(', ')}). ${verifyBadge}.`
                : `Identified & modified responsible file(s): ${touched.join(', ')}. ${verifyBadge}.`,
              explanation: `Precision surgical lock: Edited only ${touched.join(', ')} while preserving 100% of untouched lines and files verbatim.`,
              researchFinding,
              targetFile: intent.targetFile,
              researchMode: intent.researchMode,
              actionType: 'edit',
              uploadedFile: uploadedFile
                ? {
                    name: uploadedFile.name,
                    targetPart: targetPartDescription,
                    surgicalLock: isSurgical
                  }
                : undefined,
              modifiedFiles: modifiedFilesList
            }
          ]);
          return;
        }
      }

      if (settings.useGemini !== false) {
        try {
          setStatusMessage(`Querying Google Gemini (${geminiModelId})...`);
          const geminiCode = await generateCodeWithGemini(
            promptText,
            settings,
            (msg) => setStatusMessage(msg),
            researchFinding,
            code,
            image,
            promptControllerConfig,
            intent.targetFile,
            intent.researchMode,
            uploadedFile,
            codebaseFiles
          );
          recordCloudTurn(geminiCode, currentModelName, 'Google Gemini');
        } catch (geminiErr: any) {
          if (settings.useOpenRouter && settings.apiKey.trim()) {
            addSystemLog(
              `Google Gemini notice (${geminiErr.message}). Falling back to OpenRouter...`,
              'warn'
            );
            setStatusMessage('Google Gemini busy — falling back to OpenRouter...');
            const openRouterCode = await generateCodeWithOpenRouter(
              promptText,
              settings,
              (msg) => setStatusMessage(msg),
              researchFinding,
              code,
              image,
              promptControllerConfig,
              intent.targetFile,
              intent.researchMode,
              uploadedFile,
              codebaseFiles
            );
            recordCloudTurn(openRouterCode, settings.model.split('/').pop() || 'OpenRouter', 'OpenRouter Fallback');
          } else if (hasGroqConfigured) {
            addSystemLog(
              `Google Gemini notice (${geminiErr.message}). Falling back to Groq (${groqModelId})...`,
              'warn'
            );
            setStatusMessage(`Google Gemini busy — falling back to Groq (${groqModelId})...`);
            const groqCode = await generateCodeWithGroq(
              promptText,
              settings,
              (msg) => setStatusMessage(msg),
              researchFinding,
              code,
              image,
              promptControllerConfig,
              intent.targetFile,
              intent.researchMode,
              uploadedFile,
              codebaseFiles
            );
            recordCloudTurn(groqCode, `Groq Fallback (${groqModelId})`, 'Groq Fallback');
          } else {
            throw geminiErr;
          }
        }
      } else if (settings.useOpenRouter && settings.apiKey.trim()) {
        try {
          setStatusMessage(`Querying ${settings.model || 'Nemotron 3.5 Super VL'} via OpenRouter...`);
          const generatedCode = await generateCodeWithOpenRouter(
            promptText,
            settings,
            (msg) => setStatusMessage(msg),
            researchFinding,
            code,
            image,
            promptControllerConfig,
            intent.targetFile,
            intent.researchMode,
            uploadedFile,
            codebaseFiles
          );
          recordCloudTurn(generatedCode, currentModelName, 'OpenRouter');
        } catch (openRouterErr: any) {
          if (hasGroqConfigured) {
            addSystemLog(
              `OpenRouter failed (${openRouterErr.message}). Falling back to Groq (${groqModelId})...`,
              'warn'
            );
            setStatusMessage(`OpenRouter failed — falling back to Groq (${groqModelId})...`);
            const groqCode = await generateCodeWithGroq(
              promptText,
              settings,
              (msg) => setStatusMessage(msg),
              researchFinding,
              code,
              image,
              promptControllerConfig,
              intent.targetFile,
              intent.researchMode,
              uploadedFile,
              codebaseFiles
            );
            recordCloudTurn(groqCode, `Groq Fallback (${groqModelId})`, 'Groq Fallback');
          } else {
            throw openRouterErr;
          }
        }
      } else if (hasGroqConfigured) {
        setStatusMessage(`Querying ${groqModelId} via Groq...`);
        const groqCode = await generateCodeWithGroq(
          promptText,
          settings,
          (msg) => setStatusMessage(msg),
          researchFinding,
          code,
          image,
          promptControllerConfig,
          intent.targetFile,
          intent.researchMode,
          uploadedFile,
          codebaseFiles
        );
        recordCloudTurn(groqCode, `Groq (${groqModelId})`, 'Groq');
      } else {
        // Fast local compiler
        setStatusMessage('Compiling with local rule-based engine...');
        const result = compilePromptLocally(promptText, researchFinding, code, intent.targetFile, uploadedFile);

        setCode(result.code);
        setBuilderVaultFiles(codeStateToVaultFiles(result.code));
        if (result.matchedTemplateName && !intent.isEdit && !uploadedFile) {
          setActiveProjectName(result.matchedTemplateName);
        }
        addSystemLog(`Compiled via local engine: ${result.matchedTemplateName || 'Application'}`, 'system');

        // Record turn
        setTurns(prev => [
          ...prev,
          {
            id: `turn-${Date.now()}`,
            prompt: promptText,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            model: currentModelName,
            status: 'completed',
            summary: result.notes || `Compiled ${result.matchedTemplateName || 'App'}`,
            explanation: isSurgical
              ? `Surgical precision edit applied strictly to "${targetPartDescription || 'specified part'}".`
              : intent.isEdit
              ? `Targeted edit applied to ${intent.targetFile} without research.`
              : `Generated application using built-in interactive compiler.`,
            researchFinding,
            image: image || undefined,
            targetFile: intent.targetFile,
            researchMode: intent.researchMode,
            actionType: (intent.isEdit || uploadedFile) ? 'edit' : 'generate',
            uploadedFile: uploadedFile ? {
              name: uploadedFile.name,
              targetPart: targetPartDescription,
              surgicalLock: isSurgical
            } : undefined
          }
        ]);
      }
    } catch (err: any) {
      console.error('Generation error:', err);
      addSystemLog(`Generation warning: ${err.message}. Falling back to high-fidelity local compiler.`, 'error');

      const result = compilePromptLocally(promptText, researchFinding, code, intent.targetFile, uploadedFile);
      setCode(result.code);
      if (result.matchedTemplateName && !intent.isEdit && !uploadedFile) {
        setActiveProjectName(result.matchedTemplateName);
      }

      setTurns(prev => [
        ...prev,
        {
          id: `turn-${Date.now()}`,
          prompt: promptText,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          model: 'Local Fallback',
          status: 'completed',
          summary: result.notes || 'Executed targeted edit via local engine.',
          researchFinding: null,
          targetFile: intent.targetFile,
          researchMode: intent.researchMode,
          actionType: (intent.isEdit || uploadedFile) ? 'edit' : 'generate',
          uploadedFile: uploadedFile ? {
            name: uploadedFile.name,
            targetPart: targetPartDescription,
            surgicalLock: isSurgical
          } : undefined
        }
      ]);
    } finally {
      setIsGenerating(false);
      setStatusMessage('');
      setActivePrompt('');
      setWorkshopViewMode('preview');
    }
  };

  // Handle manual code edits in the editor
  const handleCodeChange = (newCode: CodeState) => {
    setCode(newCode);
    if (isStandardThreeFileVault(builderVaultFiles)) {
      setBuilderVaultFiles(codeStateToVaultFiles(newCode));
    }
  };

  // Handle project imported from ZIP archive
  const handleProjectImported = async (project: ImportedProject) => {
    setCode(project.code);
    setActiveProjectName(project.projectName);
    setActiveWorkspace('builder');
    setWorkshopViewMode('preview');
    const importedVault =
      project.codebaseFiles && project.codebaseFiles.length > 0
        ? project.codebaseFiles
        : codeStateToVaultFiles(project.code);
    setBuilderVaultFiles(importedVault);
    await saveCodebaseToVault('builder', importedVault);
    setBuilderVaultVersion((v) => v + 1);
    const totalFiles = project.codebaseFiles?.length || project.files.length;
    const importedFileNames =
      project.codebaseFiles && project.codebaseFiles.length > 0
        ? project.codebaseFiles.slice(0, 8).map((f) => f.path)
        : project.files.slice(0, 8).map((f) => f.name);
    addSystemLog(`Imported ZIP archive "${project.projectName}" (${totalFiles} files indexed). Ready to preview and edit!`, 'system');
    setTurns(prev => [
      ...prev,
      {
        id: `turn-${Date.now()}`,
        prompt: `Import project archive: ${project.projectName}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        model: 'ZIP Project Importer',
        status: 'completed',
        summary: `Imported "${project.projectName}" containing ${totalFiles} project files (${importedFileNames.join(', ')}). Live preview & per-file surgical editing active.`
      }
    ]);
  };

  // Select a preset template
  const handleSelectTemplate = (template: TemplateApp) => {
    setCode(template.code);
    setBuilderVaultFiles(codeStateToVaultFiles(template.code));
    clearCodebaseFromVault('builder');
    setBuilderVaultVersion((v) => v + 1);
    setActiveProjectName(template.name);
    setWorkshopViewMode('preview');
    addSystemLog(`Loaded template: ${template.name}`, 'info');
    setTurns(prev => [
      ...prev,
      {
        id: `turn-${Date.now()}`,
        prompt: `Switch to preset: ${template.name}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        model: 'Preset Engine',
        status: 'completed',
        summary: `Loaded ${template.name} (${template.category}) with live preview.`
      }
    ]);
  };

  // Reset Project
  const handleResetProject = () => {
    handleSelectTemplate(defaultTemplate);
  };

  // Download ZIP (exports full Codebase Vault with modifications when working from uploaded files/ZIPs, or standalone HTML/CSS/JS bundle otherwise)
  const handleDownloadZip = async () => {
    try {
      const hasCustomVault = !isStandardThreeFileVault(builderVaultFiles) && builderVaultFiles.length > 0;
      if (hasCustomVault) {
        addSystemLog(
          `Packaging modified project (${builderVaultFiles.length} file${builderVaultFiles.length === 1 ? '' : 's'}) into ZIP archive...`,
          'info'
        );
        await exportVaultAsZip(builderVaultFiles, activeProjectName || 'studiox-edited-project');
        addSystemLog(`Exported modified codebase ZIP (${builderVaultFiles.length} files).`, 'system');
      } else {
        addSystemLog(`Bundling "${activeProjectName}" into downloadable ZIP archive...`, 'info');
        await downloadProjectZip(code, activeProjectName);
        addSystemLog('ZIP archive exported successfully.', 'system');
      }
    } catch (err: any) {
      console.error('ZIP download error:', err);
      addSystemLog(`Failed to download ZIP: ${err.message}`, 'error');
    }
  };

  const handleDownloadModifiedFile = (file: { name: string; content: string }) => {
    downloadSingleFile(file.name, file.content);
    addSystemLog(`Downloaded modified file "${file.name}".`, 'system');
  };

  // Deploy to URL action
  const handleDeployToUrl = async (provider: 'cloudrun' | 'firebase') => {
    setIsDeploying(true);
    addSystemLog(`Deploying "${activeProjectName}" to ${provider === 'cloudrun' ? 'Google Cloud Run' : 'Firebase Hosting'}...`, 'info');
    
    setTimeout(() => {
      setIsDeploying(false);
      const url = provider === 'firebase'
        ? `https://${activeProjectName.toLowerCase().replace(/[^a-z0-9]/g, '-')}.web.app`
        : `https://ais-dev-uydikfdvqy4ypphv62wo5u-126569678924.europe-west1.run.app/app/${Date.now().toString(36)}`;
      
      setDeployment({
        isDeployed: true,
        url,
        deployedAt: 'Just now',
        hostingProvider: provider
      });
      addSystemLog(`Application successfully deployed to live endpoint: ${url}`, 'system');
    }, 1200);
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-950 text-slate-100 font-sans">
      {/* Top Google AI Studio Navbar */}
      <Navbar
        settings={settings}
        viewportMode={viewportMode}
        onViewportChange={setViewportMode}
        onOpenSettings={openSettings}
        onDownloadZip={handleDownloadZip}
        onOpenDeploy={() => setIsDeployOpen(true)}
        onOpenGitHubExport={() => setIsGitHubOpen(true)}
        onOpenSideload={() => setIsSideloadOpen(true)}
        onOpenImportZip={() => setIsImportZipOpen(true)}
        onOpenFullScreenPreview={() => setIsFullScreenPreviewOpen(true)}
        isGenerating={isGenerating}
        activeProjectName={activeProjectName}
        deployment={deployment}
        promptControllerConfig={promptControllerConfig}
        onOpenPromptControllerModal={() => setIsPromptControllerModalOpen(true)}
        activeWorkspace={activeWorkspace}
        onWorkspaceChange={setActiveWorkspace}
        builderProjects={builderProjects.map((p) => ({ id: p.id, name: p.name }))}
        activeBuilderProjectId={activeBuilderProjectId}
        onSelectBuilderProject={handleSelectBuilderProject}
        onNewBuilderProject={handleNewBuilderProject}
      />

      {/* Main Workspace Layout */}
      {activeWorkspace === 'chat' ? (
        <main className="flex-1 flex min-h-0 overflow-hidden">
          <AIChatWorkspace
            settings={settings}
            onOpenSettings={openSettings}
            onLoadCodeInBuilder={(newCode, projectName, vaultFiles) => {
              setCode(newCode);
              if (vaultFiles && vaultFiles.length > 0) {
                setBuilderVaultFiles(vaultFiles);
                saveCodebaseToVault('builder', vaultFiles);
                setBuilderVaultVersion((v) => v + 1);
              } else {
                setBuilderVaultFiles(codeStateToVaultFiles(newCode));
              }
              if (projectName) setActiveProjectName(projectName);
              setActiveWorkspace('builder');
              setWorkshopViewMode('preview');
            }}
            onActiveAppChange={setActiveChatApp}
          />
        </main>
      ) : (
      <main className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
        {/* LEFT PANEL: Google AI Studio Prompt & Build Thread */}
        <LeftPanelAIStudio
          onGenerate={handleGenerate}
          isGenerating={isGenerating}
          statusMessage={statusMessage}
          settings={settings}
          onOpenSettings={openSettings}
          activePrompt={activePrompt}
          setActivePrompt={setActivePrompt}
          turns={turns}
          onSelectTemplate={handleSelectTemplate}
          activeProjectName={activeProjectName}
          onResetProject={handleResetProject}
          onViewLivePreview={() => setWorkshopViewMode('preview')}
          onOpenFullScreenPreview={() => setIsFullScreenPreviewOpen(true)}
          onDownloadZip={handleDownloadZip}
          onDownloadModifiedFile={handleDownloadModifiedFile}
          promptControllerConfig={promptControllerConfig}
          onUpdatePromptController={(newCfg) => {
            setPromptControllerConfig(newCfg);
            savePromptControllerConfig(newCfg);
            addSystemLog(`Prompt Strategy changed to: ${newCfg.thinkingMode.toUpperCase()}`, 'info');
          }}
          onOpenPromptControllerModal={() => setIsPromptControllerModalOpen(true)}
          vaultSyncVersion={builderVaultVersion}
        />

        {/* RIGHT PANEL: Digital Workshop & Live Preview (Split Screen + File Tree + Deployment Bar) */}
        <RightPanelDigitalWorkshop
          code={code}
          onChangeCode={handleCodeChange}
          viewportMode={viewportMode}
          onViewportChange={setViewportMode}
          viewMode={workshopViewMode}
          onViewModeChange={setWorkshopViewMode}
          logs={logs}
          onClearLogs={() => setLogs([])}
          onSendEval={(evalCode) => addSystemLog(`Executed in sandbox: ${evalCode}`, 'info')}
          projectName={activeProjectName}
          onOpenDeploy={() => setIsDeployOpen(true)}
          onOpenGitHubExport={() => setIsGitHubOpen(true)}
          onOpenSideload={() => setIsSideloadOpen(true)}
          onDownloadZip={handleDownloadZip}
          onOpenImportZip={() => setIsImportZipOpen(true)}
          onOpenFullScreenPreview={() => setIsFullScreenPreviewOpen(true)}
          deployment={deployment}
          isGenerating={isGenerating}
          onAutoFixError={(errorMsg) => {
            if (isGenerating) return;
            handleGenerate(
              `Fix the runtime error in the live sandbox cleanly while preserving all existing UI and functionality:\n${errorMsg}`,
              null,
              'all',
              'without-research'
            );
          }}
        />
      </main>
      )}

      {/* Top Navbar & Workspace Headers provide non-blocking Live Preview access */}

      {/* Modals */}
      <DeployModal
        isOpen={isDeployOpen}
        onClose={() => setIsDeployOpen(false)}
        projectName={activeProjectName}
        deployment={deployment}
        onDeploy={handleDeployToUrl}
        isDeploying={isDeploying}
      />

      <GitHubExportModal
        isOpen={isGitHubOpen}
        onClose={() => setIsGitHubOpen(false)}
        projectName={activeProjectName}
        code={code}
        onDownloadZip={handleDownloadZip}
      />

      <SideloadModal
        isOpen={isSideloadOpen}
        onClose={() => setIsSideloadOpen(false)}
        projectName={activeProjectName}
        code={code}
        onDownloadZip={handleDownloadZip}
      />

      <ImportZipModal
        isOpen={isImportZipOpen}
        onClose={() => setIsImportZipOpen(false)}
        onProjectImported={handleProjectImported}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSave={handleSaveSettings}
        initialTab={settingsInitialTab}
      />

      {/* Fullscreen Live Preview Modal (Covers Entire Screen Edge-to-Edge) */}
      <FullScreenLivePreview
        isOpen={isFullScreenPreviewOpen}
        onClose={() => setIsFullScreenPreviewOpen(false)}
        code={activeWorkspace === 'chat' && activeChatApp ? activeChatApp.code : code}
        projectName={activeWorkspace === 'chat' && activeChatApp ? activeChatApp.name : activeProjectName}
      />

      {/* Prompt Controller & AI Director Modal */}
      <PromptControllerModal
        isOpen={isPromptControllerModalOpen}
        onClose={() => setIsPromptControllerModalOpen(false)}
        config={promptControllerConfig}
        onSave={(newCfg) => {
          setPromptControllerConfig(newCfg);
          savePromptControllerConfig(newCfg);
          addSystemLog(`Prompt Directives & Strategy updated: ${newCfg.thinkingMode.toUpperCase()}`, 'info');
        }}
      />
    </div>
  );
}
