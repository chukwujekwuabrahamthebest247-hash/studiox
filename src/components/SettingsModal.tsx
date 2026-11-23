import React, { useState, useEffect } from 'react';
import { 
  X, 
  Key, 
  Cpu, 
  Sliders, 
  CheckCircle2, 
  AlertCircle, 
  ExternalLink, 
  Zap, 
  Eye, 
  EyeOff,
  Info,
  Globe,
  Search,
  Compass,
  Check,
  RefreshCw,
  ShieldCheck
} from 'lucide-react';
import { OpenRouterSettings } from '../types';
import {
  AVAILABLE_MODELS,
  DEFAULT_OPENROUTER_MODEL,
  LiveModelOption,
  fetchLiveOpenRouterModels
} from '../services/openrouter';
import {
  DEFAULT_GROQ_MODEL,
  DEFAULT_GROQ_MODELS,
  fetchLiveGroqModels,
  testGroqKey
} from '../services/groq';
import {
  DEFAULT_GEMINI_MODEL,
  GEMINI_MODELS,
  callGeminiProxy,
  fetchGeminiStatus
} from '../services/gemini';
import { testSerperKey, testTavilyKey } from '../services/research';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: OpenRouterSettings;
  onSave: (newSettings: OpenRouterSettings) => void;
  initialTab?: 'gemini' | 'openrouter' | 'groq' | 'research';
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSave,
  initialTab = 'gemini'
}) => {
  const [activeTab, setActiveTab] = useState<'gemini' | 'openrouter' | 'groq' | 'research'>(initialTab);

  // Google Gemini State (uses server-side GEMINI_API_KEY)
  const [useGemini, setUseGemini] = useState(settings.useGemini !== false);
  const [geminiModel, setGeminiModel] = useState(settings.geminiModel || DEFAULT_GEMINI_MODEL);
  const [geminiTestStatus, setGeminiTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [geminiTestMsg, setGeminiTestMsg] = useState('');

  // OpenRouter State
  const [apiKey, setApiKey] = useState(settings.apiKey || '');
  const [model, setModel] = useState(settings.model || DEFAULT_OPENROUTER_MODEL);
  const [customModel, setCustomModel] = useState(settings.customModel || '');
  const [temperature, setTemperature] = useState(settings.temperature ?? 0.7);
  const [useOpenRouter, setUseOpenRouter] = useState(settings.useOpenRouter);
  const [showKey, setShowKey] = useState(false);
  const [testingStatus, setTestingStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState('');
  const [liveOpenRouterModels, setLiveOpenRouterModels] = useState<LiveModelOption[]>(AVAILABLE_MODELS);
  const [isLoadingOpenRouterModels, setIsLoadingOpenRouterModels] = useState(false);

  // Groq Fallback State
  const [groqApiKey, setGroqApiKey] = useState(settings.groqApiKey || '');
  const [groqModel, setGroqModel] = useState(settings.groqModel || DEFAULT_GROQ_MODEL);
  const [groqCustomModel, setGroqCustomModel] = useState(settings.groqCustomModel || '');
  const [useGroqFallback, setUseGroqFallback] = useState(settings.useGroqFallback ?? true);
  const [showGroqKey, setShowGroqKey] = useState(false);
  const [groqTestStatus, setGroqTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [groqTestMsg, setGroqTestMsg] = useState('');
  const [liveGroqModels, setLiveGroqModels] = useState<LiveModelOption[]>(DEFAULT_GROQ_MODELS);
  const [isLoadingGroqModels, setIsLoadingGroqModels] = useState(false);

  // Research State (Serper & Tavily)
  const [serperApiKey, setSerperApiKey] = useState(settings.serperApiKey || '');
  const [tavilyApiKey, setTavilyApiKey] = useState(settings.tavilyApiKey || '');
  const [enableWebResearch, setEnableWebResearch] = useState(settings.enableWebResearch ?? true);
  const [showSerperKey, setShowSerperKey] = useState(false);
  const [showTavilyKey, setShowTavilyKey] = useState(false);

  const [serperTestStatus, setSerperTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [serperTestMsg, setSerperTestMsg] = useState('');

  const [tavilyTestStatus, setTavilyTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [tavilyTestMsg, setTavilyTestMsg] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setActiveTab(initialTab);
    setUseGemini(settings.useGemini !== false);
    setGeminiModel(settings.geminiModel || DEFAULT_GEMINI_MODEL);
    setApiKey(settings.apiKey || '');
    setModel(settings.model || DEFAULT_OPENROUTER_MODEL);
    setCustomModel(settings.customModel || '');
    setTemperature(settings.temperature ?? 0.7);
    setUseOpenRouter(settings.useOpenRouter);
    setGroqApiKey(settings.groqApiKey || '');
    setGroqModel(settings.groqModel || DEFAULT_GROQ_MODEL);
    setGroqCustomModel(settings.groqCustomModel || '');
    setUseGroqFallback(settings.useGroqFallback ?? true);
    setSerperApiKey(settings.serperApiKey || '');
    setTavilyApiKey(settings.tavilyApiKey || '');
    setEnableWebResearch(settings.enableWebResearch ?? true);
  }, [isOpen, initialTab, settings]);

  if (!isOpen) return null;

  const handleSave = () => {
    onSave({
      apiKey: apiKey.trim(),
      model,
      customModel: customModel.trim(),
      temperature,
      useOpenRouter: useOpenRouter && Boolean(apiKey.trim()),
      useGemini,
      geminiModel,
      serperApiKey: serperApiKey.trim(),
      tavilyApiKey: tavilyApiKey.trim(),
      enableWebResearch,
      groqApiKey: groqApiKey.trim(),
      groqModel,
      groqCustomModel: groqCustomModel.trim(),
      useGroqFallback
    });
    onClose();
  };

  const handleTestGeminiConnection = async () => {
    setGeminiTestStatus('testing');
    setGeminiTestMsg(`Verifying server-side Google Gemini (${geminiModel})...`);
    try {
      const status = await fetchGeminiStatus();
      if (!status.configured) {
        throw new Error('Server Google API key is not set yet. Check Settings > Secrets.');
      }
      await callGeminiProxy({
        model: geminiModel,
        messages: [{ role: 'user', content: 'Reply with OK' }]
      });
      setGeminiTestStatus('success');
      setGeminiTestMsg(`Connected! "${geminiModel}" is ready via your Google API key.`);
      setUseGemini(true);
    } catch (err: any) {
      setGeminiTestStatus('error');
      setGeminiTestMsg(err?.message || 'Google Gemini connection check failed.');
    }
  };

  const handleLoadLiveOpenRouterModels = async () => {
    setIsLoadingOpenRouterModels(true);
    try {
      const fetched = await fetchLiveOpenRouterModels(apiKey);
      if (fetched.length > 0) {
        const merged = [
          ...fetched,
          { id: 'custom', name: 'Custom Model ID...', badge: 'Manual' }
        ];
        setLiveOpenRouterModels(merged);
        setTestingStatus('success');
        setTestMessage(`Loaded ${fetched.length} live OpenRouter models.`);
      }
    } catch (err: any) {
      setTestingStatus('error');
      setTestMessage(err.message || 'Failed to fetch live OpenRouter models.');
    } finally {
      setIsLoadingOpenRouterModels(false);
    }
  };

  const handleLoadLiveGroqModels = async () => {
    if (!groqApiKey.trim()) {
      setGroqTestStatus('error');
      setGroqTestMsg('Enter your Groq API key first to load live models.');
      return;
    }
    setIsLoadingGroqModels(true);
    try {
      const models = await fetchLiveGroqModels(groqApiKey);
      setLiveGroqModels(models);
      if (!models.some((m) => m.id === groqModel) && models.length > 1) {
        setGroqModel(models[0].id);
      }
      setGroqTestStatus('success');
      setGroqTestMsg(`Loaded ${models.length - 1} live Groq models.`);
    } catch (err: any) {
      setGroqTestStatus('error');
      setGroqTestMsg(err.message || 'Failed to load live Groq models.');
    } finally {
      setIsLoadingGroqModels(false);
    }
  };

  const handleTestGroqConnection = async () => {
    if (!groqApiKey.trim()) {
      setGroqTestStatus('error');
      setGroqTestMsg('Please enter a Groq API key first.');
      return;
    }
    setGroqTestStatus('testing');
    setGroqTestMsg('Verifying Groq API key & loading live models...');
    try {
      const models = await testGroqKey(groqApiKey);
      setLiveGroqModels(models);
      if (!models.some((m) => m.id === groqModel) && models.length > 1) {
        setGroqModel(models[0].id);
      }
      setGroqTestStatus('success');
      setGroqTestMsg(`Verified! ${models.length - 1} live Groq models ready.`);
      setUseGroqFallback(true);
    } catch (err: any) {
      setGroqTestStatus('error');
      setGroqTestMsg(err.message || 'Groq verification failed.');
    }
  };

  const handleTestConnection = async () => {
    if (!apiKey.trim()) {
      setTestingStatus('error');
      setTestMessage('Please enter an OpenRouter API key first.');
      return;
    }

    setTestingStatus('testing');
    setTestMessage('Testing OpenRouter connection...');

    const targetModel = model === 'custom' && customModel.trim() ? customModel.trim() : model;

    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey.trim()}`,
          'HTTP-Referer': window.location.origin,
          'X-Title': 'StudioX Validator',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: targetModel,
          messages: [{ role: 'user', content: 'Say "OK"' }],
          max_tokens: 5,
          temperature: 0.7
        })
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `HTTP ${res.status}`);
      }

      setTestingStatus('success');
      setTestMessage(`Verified! Model "${targetModel}" is responding.`);
      setUseOpenRouter(true);
    } catch (err: any) {
      setTestingStatus('error');
      setTestMessage(err.message || 'Verification failed.');
    }
  };

  const handleTestSerper = async () => {
    if (!serperApiKey.trim()) {
      setSerperTestStatus('error');
      setSerperTestMsg('Please enter a Serper API key first.');
      return;
    }
    setSerperTestStatus('testing');
    setSerperTestMsg('Connecting to Serper Google Search API...');
    try {
      await testSerperKey(serperApiKey);
      setSerperTestStatus('success');
      setSerperTestMsg('Serper API key is active and responding!');
    } catch (e: any) {
      setSerperTestStatus('error');
      setSerperTestMsg(e.message || 'Serper verification failed.');
    }
  };

  const handleTestTavily = async () => {
    if (!tavilyApiKey.trim()) {
      setTavilyTestStatus('error');
      setTavilyTestMsg('Please enter a Tavily API key first.');
      return;
    }
    setTavilyTestStatus('testing');
    setTavilyTestMsg('Connecting to Tavily AI Research Engine...');
    try {
      await testTavilyKey(tavilyApiKey);
      setTavilyTestStatus('success');
      setTavilyTestMsg('Tavily API key is active and responding!');
    } catch (e: any) {
      setTavilyTestStatus('error');
      setTavilyTestMsg(e.message || 'Tavily verification failed.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
              <Compass className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">StudioX Engine &amp; Intelligence</h2>
              <p className="text-xs text-slate-400">Google Gemini (Primary), OpenRouter, Groq Fallback &amp; Research</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 px-6 pt-2 gap-4 overflow-x-auto">
          <button
            onClick={() => setActiveTab('gemini')}
            className={`pb-2.5 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'gemini'
                ? 'border-blue-400 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Google Gemini</span>
            {useGemini && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('openrouter')}
            className={`pb-2.5 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'openrouter'
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>OpenRouter</span>
          </button>

          <button
            onClick={() => setActiveTab('groq')}
            className={`pb-2.5 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'groq'
                ? 'border-orange-400 text-orange-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Groq Fallback AI</span>
            {groqApiKey.trim() && (
              <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('research')}
            className={`pb-2.5 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'research'
                ? 'border-emerald-400 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Web Research (Serper &amp; Tavily)</span>
            {(serperApiKey || tavilyApiKey) && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            )}
          </button>
        </div>

        {/* Tab 0: Google Gemini (Server-Side Key) */}
        {activeTab === 'gemini' && (
          <div className="p-6 overflow-y-auto max-h-[70vh] flex flex-col gap-5">
            <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
              <div>
                <span className="font-semibold text-sm text-slate-200 block">Use Google Gemini AI Engine (Primary)</span>
                <span className="text-xs text-slate-400">
                  Routes App Builder, Surgical Code Editor, Vision &amp; AI Chat through your server-configured Google API key in place of OpenRouter.
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-3">
                <input
                  type="checkbox"
                  checked={useGemini}
                  onChange={(e) => setUseGemini(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
              </label>
            </div>

            <div className="p-3.5 bg-blue-950/25 border border-blue-800/40 rounded-xl flex items-start gap-2.5 text-xs text-blue-200">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-blue-100 block mb-0.5">Server-Side Google API Key Active</strong>
                StudioX connects securely via <span className="font-mono text-blue-300">/api/gemini/chat</span> using the key configured in <strong>Settings &gt; Secrets</strong>—no manual key entry needed here.
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="font-semibold text-xs text-slate-300 flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-blue-400" />
                <span>Google Gemini Model</span>
              </label>
              <select
                value={geminiModel}
                onChange={(e) => setGeminiModel(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
              >
                {GEMINI_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} [{m.badge}]
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                onClick={handleTestGeminiConnection}
                disabled={geminiTestStatus === 'testing'}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Zap className="w-3.5 h-3.5 text-blue-400" />
                <span>{geminiTestStatus === 'testing' ? 'Testing...' : 'Verify Gemini Connection'}</span>
              </button>

              {geminiTestMsg && (
                <span className={`text-xs flex items-center gap-1.5 ${
                  geminiTestStatus === 'success' ? 'text-emerald-400' : 'text-red-400'
                }`}>
                  {geminiTestStatus === 'success' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                  <span className="truncate max-w-xs">{geminiTestMsg}</span>
                </span>
              )}
            </div>
          </div>
        )}

        {/* Tab 1: OpenRouter AI Settings */}
        {activeTab === 'openrouter' && (
          <div className="p-6 overflow-y-auto max-h-[70vh] flex flex-col gap-5">
            {/* Engine Mode Toggle */}
            <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
              <div>
                <span className="font-semibold text-sm text-slate-200 block">Use OpenRouter AI Cloud Engine</span>
                <span className="text-xs text-slate-400">
                  When active, queries OpenRouter models directly. When inactive, uses StudioX's instant local compiler.
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={useOpenRouter}
                  onChange={(e) => setUseOpenRouter(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-500"></div>
              </label>
            </div>

            {/* API Key Input */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs">
                <label className="font-semibold text-slate-300 flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-cyan-400" />
                  <span>OpenRouter API Key</span>
                </label>
                <a
                  href="https://openrouter.ai/keys"
                  target="_blank"
                  rel="noreferrer"
                  className="text-cyan-400 hover:underline flex items-center gap-1 text-[11px]"
                >
                  <span>Get API key</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <div className="relative">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-or-v1-..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 font-mono pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300"
                >
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <span className="text-[11px] text-slate-500">
                Keys are stored securely in your browser's local storage and used exclusively for your requests.
              </span>
            </div>

            {/* Groq Fallback API Key Quick Entry */}
            <div className="p-3.5 bg-orange-950/15 border border-orange-800/40 rounded-xl flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs">
                <label className="font-semibold text-orange-200 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-orange-400" />
                  <span>Groq API Key (Auto-Fallback &amp; Direct)</span>
                </label>
                <div className="flex items-center gap-3">
                  <a
                    href="https://console.groq.com/keys"
                    target="_blank"
                    rel="noreferrer"
                    className="text-orange-400 hover:underline flex items-center gap-1 text-[11px]"
                  >
                    <span>Get Groq key</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                  <button
                    type="button"
                    onClick={() => setActiveTab('groq')}
                    className="text-[11px] text-orange-300 hover:text-orange-200 underline cursor-pointer"
                  >
                    Live Models →
                  </button>
                </div>
              </div>

              <div className="relative">
                <input
                  type={showGroqKey ? 'text' : 'password'}
                  value={groqApiKey}
                  onChange={(e) => setGroqApiKey(e.target.value)}
                  placeholder="gsk_... (paste your Groq API key here)"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 font-mono pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowGroqKey(!showGroqKey)}
                  className="absolute right-3 top-2 text-slate-500 hover:text-slate-300"
                >
                  {showGroqKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              <div className="flex items-center justify-between gap-2 text-[11px]">
                <span className="text-slate-400 truncate">
                  Active fallback model: <span className="text-orange-300 font-mono">{groqModel === 'custom' && groqCustomModel ? groqCustomModel : groqModel}</span>
                </span>
                <button
                  type="button"
                  onClick={handleTestGroqConnection}
                  disabled={groqTestStatus === 'testing' || !groqApiKey.trim()}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-orange-200 text-[11px] font-semibold rounded-md border border-slate-700 cursor-pointer shrink-0"
                >
                  {groqTestStatus === 'testing' ? 'Verifying...' : 'Verify & Load Models'}
                </button>
              </div>
              {groqTestMsg && (
                <div className={`text-[11px] flex items-center gap-1.5 ${
                  groqTestStatus === 'success' ? 'text-emerald-400' : 'text-red-400'
                }`}>
                  {groqTestStatus === 'success' ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                  <span>{groqTestMsg}</span>
                </div>
              )}
            </div>

            {/* Model Selection */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-xs text-slate-300 flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Model Selection ({liveOpenRouterModels.length - 1} models)</span>
                </label>
                <button
                  type="button"
                  onClick={handleLoadLiveOpenRouterModels}
                  disabled={isLoadingOpenRouterModels}
                  className="text-[11px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 disabled:opacity-50 cursor-pointer"
                >
                  <RefreshCw className={`w-3 h-3 ${isLoadingOpenRouterModels ? 'animate-spin' : ''}`} />
                  <span>{isLoadingOpenRouterModels ? 'Loading...' : 'Refresh Live Models'}</span>
                </button>
              </div>

              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-cyan-500"
              >
                {!liveOpenRouterModels.some((m) => m.id === model) && model && (
                  <option value={model}>{model} [Selected]</option>
                )}
                {liveOpenRouterModels.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} [{m.badge}]
                  </option>
                ))}
              </select>

              {model === 'custom' && (
                <input
                  type="text"
                  value={customModel}
                  onChange={(e) => setCustomModel(e.target.value)}
                  placeholder="Enter OpenRouter model ID (e.g., nvidia/nemotron-3.5-super-vl:free)"
                  className="mt-1 w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500 font-mono"
                />
              )}

              <div className="p-2.5 bg-cyan-950/20 border border-cyan-800/30 rounded-lg flex items-start gap-2 text-xs text-cyan-300">
                <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Nemotron 3.5 Super VL Free</strong> is specifically configured for StudioX code synthesis. It delivers high-accuracy HTML5, modern CSS, and clean Vanilla JavaScript.
                </span>
              </div>
            </div>

            {/* Temperature Slider */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs">
                <label className="font-semibold text-slate-300 flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Temperature: <span className="font-mono text-cyan-400 text-sm ml-1">{temperature}</span></span>
                </label>
                <button
                  type="button"
                  onClick={() => setTemperature(0.7)}
                  className="text-[11px] text-slate-400 hover:text-cyan-400 underline decoration-slate-700"
                >
                  Reset to 0.7
                </button>
              </div>

              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
                className="w-full accent-cyan-400 cursor-pointer h-2 bg-slate-800 rounded-lg"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                <span>0.0 (Deterministic)</span>
                <span className="text-cyan-400 font-semibold">0.7 (Precise Code Gen)</span>
                <span>1.0 (Creative)</span>
              </div>
            </div>

            {/* Test Connection Button & Status */}
            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={testingStatus === 'testing' || !apiKey.trim()}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition-colors flex items-center gap-1.5"
              >
                {testingStatus === 'testing' ? (
                  <>Testing...</>
                ) : (
                  <>
                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                    <span>Verify OpenRouter Key</span>
                  </>
                )}
              </button>

              {testMessage && (
                <span className={`text-xs flex items-center gap-1.5 ${
                  testingStatus === 'success' ? 'text-emerald-400' : 'text-red-400'
                }`}>
                  {testingStatus === 'success' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                  <span className="truncate max-w-xs">{testMessage}</span>
                </span>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Groq Fallback AI Settings */}
        {activeTab === 'groq' && (
          <div className="p-6 overflow-y-auto max-h-[70vh] flex flex-col gap-5">
            <div className="p-3.5 bg-gradient-to-r from-orange-950/30 to-slate-900 border border-orange-800/40 rounded-xl flex items-start gap-3 text-xs text-orange-200">
              <ShieldCheck className="w-5 h-5 text-orange-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-orange-300 block font-semibold mb-1">
                  Automatic Groq Fallback & Live Model Selection
                </strong>
                Whenever OpenRouter fails (rate limit, quota exceeded, network, or invalid key), StudioX automatically switches to your Groq API key & selected live Groq model across App Builder and AI Chat. Also works directly if OpenRouter is off.
              </div>
            </div>

            {/* Fallback Toggle */}
            <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
              <div>
                <span className="font-semibold text-sm text-slate-200 block">Enable Groq Fallback When OpenRouter Fails</span>
                <span className="text-xs text-slate-400">
                  Automatically retries failed OpenRouter requests on Groq before falling back locally.
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={useGroqFallback}
                  onChange={(e) => setUseGroqFallback(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
              </label>
            </div>

            {/* Groq API Key Input */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs">
                <label className="font-semibold text-slate-300 flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-orange-400" />
                  <span>Groq API Key</span>
                </label>
                <a
                  href="https://console.groq.com/keys"
                  target="_blank"
                  rel="noreferrer"
                  className="text-orange-400 hover:underline flex items-center gap-1 text-[11px]"
                >
                  <span>Get Groq key</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <div className="relative">
                <input
                  type={showGroqKey ? 'text' : 'password'}
                  value={groqApiKey}
                  onChange={(e) => setGroqApiKey(e.target.value)}
                  placeholder="gsk_..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 font-mono pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowGroqKey(!showGroqKey)}
                  className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300"
                >
                  {showGroqKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Live Groq Model Selection */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-xs text-slate-300 flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-orange-400" />
                  <span>Live Groq Model Selection ({liveGroqModels.length - 1} models)</span>
                </label>
                <button
                  type="button"
                  onClick={handleLoadLiveGroqModels}
                  disabled={isLoadingGroqModels || !groqApiKey.trim()}
                  className="text-[11px] text-orange-400 hover:text-orange-300 flex items-center gap-1 disabled:opacity-50 cursor-pointer"
                >
                  <RefreshCw className={`w-3 h-3 ${isLoadingGroqModels ? 'animate-spin' : ''}`} />
                  <span>{isLoadingGroqModels ? 'Loading...' : 'Refresh Live Models'}</span>
                </button>
              </div>

              <select
                value={groqModel}
                onChange={(e) => setGroqModel(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-orange-500"
              >
                {!liveGroqModels.some((m) => m.id === groqModel) && groqModel && (
                  <option value={groqModel}>{groqModel} [Selected]</option>
                )}
                {liveGroqModels.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} [{m.badge}]
                  </option>
                ))}
              </select>

              {groqModel === 'custom' && (
                <input
                  type="text"
                  value={groqCustomModel}
                  onChange={(e) => setGroqCustomModel(e.target.value)}
                  placeholder="Enter Groq model ID (e.g., llama-3.3-70b-versatile)"
                  className="mt-1 w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-orange-500 font-mono"
                />
              )}
            </div>

            {/* Verify Key & Load Live Models */}
            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                onClick={handleTestGroqConnection}
                disabled={groqTestStatus === 'testing' || !groqApiKey.trim()}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                {groqTestStatus === 'testing' ? (
                  <>Verifying...</>
                ) : (
                  <>
                    <ShieldCheck className="w-3.5 h-3.5 text-orange-400" />
                    <span>Verify Key &amp; Load Live Models</span>
                  </>
                )}
              </button>

              {groqTestMsg && (
                <span className={`text-xs flex items-center gap-1.5 ${
                  groqTestStatus === 'success' ? 'text-emerald-400' : 'text-red-400'
                }`}>
                  {groqTestStatus === 'success' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                  <span className="truncate max-w-xs">{groqTestMsg}</span>
                </span>
              )}
            </div>
          </div>
        )}

        {/* Tab 3: Web Research & Outside-The-Box Thinking (Serper & Tavily) */}
        {activeTab === 'research' && (
          <div className="p-6 overflow-y-auto max-h-[70vh] flex flex-col gap-5">
            {/* Explanatory callout */}
            <div className="p-3.5 bg-gradient-to-r from-emerald-950/30 to-slate-900 border border-emerald-800/40 rounded-xl flex items-start gap-3 text-xs text-emerald-200">
              <Globe className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-emerald-300 block font-semibold mb-1">
                  Autonomous Web Research & Out-of-the-Box Thinking
                </strong>
                When you input complex, open-ended, or domain-specific prompts, the AI autonomously queries <strong>Tavily</strong> and <strong>Serper</strong> to research cutting-edge web patterns, current data, APIs, and unexpected ideas before writing code!
              </div>
            </div>

            {/* Enable Web Research Toggle */}
            <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
              <div>
                <span className="font-semibold text-xs text-slate-200 block">Auto-Research for Novel Prompts</span>
                <span className="text-[11px] text-slate-400">
                  Researches the web when the AI needs external knowledge or wants to innovate.
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={enableWebResearch}
                  onChange={(e) => setEnableWebResearch(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
              </label>
            </div>

            {/* Tavily API Key Section */}
            <div className="flex flex-col gap-2 p-4 bg-slate-950 rounded-xl border border-slate-800/80">
              <div className="flex items-center justify-between text-xs">
                <label className="font-semibold text-slate-200 flex items-center gap-1.5">
                  <Search className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Tavily API Key (AI Web Research)</span>
                </label>
                <a
                  href="https://tavily.com"
                  target="_blank"
                  rel="noreferrer"
                  className="text-emerald-400 hover:underline flex items-center gap-1 text-[11px]"
                >
                  <span>Get Tavily Key</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <div className="relative">
                <input
                  type={showTavilyKey ? 'text' : 'password'}
                  value={tavilyApiKey}
                  onChange={(e) => setTavilyApiKey(e.target.value)}
                  placeholder="tvly-..."
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500 font-mono pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowTavilyKey(!showTavilyKey)}
                  className="absolute right-3 top-2 text-slate-500 hover:text-slate-300"
                >
                  {showTavilyKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-slate-500">Provides synthesized search answers and web sources</span>
                <button
                  type="button"
                  onClick={handleTestTavily}
                  disabled={tavilyTestStatus === 'testing' || !tavilyApiKey.trim()}
                  className="px-2.5 py-1 text-[11px] bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 rounded border border-slate-700 cursor-pointer"
                >
                  {tavilyTestStatus === 'testing' ? 'Testing...' : 'Verify Tavily'}
                </button>
              </div>

              {tavilyTestMsg && (
                <div className={`text-[11px] flex items-center gap-1.5 ${
                  tavilyTestStatus === 'success' ? 'text-emerald-400' : 'text-red-400'
                }`}>
                  {tavilyTestStatus === 'success' ? <Check className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                  <span>{tavilyTestMsg}</span>
                </div>
              )}
            </div>

            {/* Serper API Key Section */}
            <div className="flex flex-col gap-2 p-4 bg-slate-950 rounded-xl border border-slate-800/80">
              <div className="flex items-center justify-between text-xs">
                <label className="font-semibold text-slate-200 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-blue-400" />
                  <span>Serper API Key (Google Search API)</span>
                </label>
                <a
                  href="https://serper.dev"
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-400 hover:underline flex items-center gap-1 text-[11px]"
                >
                  <span>Get Serper Key</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <div className="relative">
                <input
                  type={showSerperKey ? 'text' : 'password'}
                  value={serperApiKey}
                  onChange={(e) => setSerperApiKey(e.target.value)}
                  placeholder="Enter Serper API Key..."
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500 font-mono pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowSerperKey(!showSerperKey)}
                  className="absolute right-3 top-2 text-slate-500 hover:text-slate-300"
                >
                  {showSerperKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-slate-500">Provides live Google organic results and snippets</span>
                <button
                  type="button"
                  onClick={handleTestSerper}
                  disabled={serperTestStatus === 'testing' || !serperApiKey.trim()}
                  className="px-2.5 py-1 text-[11px] bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 rounded border border-slate-700 cursor-pointer"
                >
                  {serperTestStatus === 'testing' ? 'Testing...' : 'Verify Serper'}
                </button>
              </div>

              {serperTestMsg && (
                <div className={`text-[11px] flex items-center gap-1.5 ${
                  serperTestStatus === 'success' ? 'text-emerald-400' : 'text-red-400'
                }`}>
                  {serperTestStatus === 'success' ? <Check className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                  <span>{serperTestMsg}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/70 flex items-center justify-between">
          <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>Config saved locally in browser</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 active:scale-95 text-slate-950 text-xs font-bold rounded-lg shadow-md shadow-cyan-500/20 transition-all cursor-pointer"
            >
              Save Configuration
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
