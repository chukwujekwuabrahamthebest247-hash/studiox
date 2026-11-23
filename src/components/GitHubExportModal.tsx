import React, { useState } from 'react';
import { 
  X, 
  GitBranch, 
  Github, 
  Copy, 
  Check, 
  Download, 
  ExternalLink, 
  Terminal, 
  CheckCircle2, 
  Lock, 
  Globe 
} from 'lucide-react';
import { CodeState } from '../types';

interface GitHubExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectName: string;
  code: CodeState;
  onDownloadZip: () => void;
}

export const GitHubExportModal: React.FC<GitHubExportModalProps> = ({
  isOpen,
  onClose,
  projectName,
  code,
  onDownloadZip
}) => {
  const [repoName, setRepoName] = useState(() => 
    projectName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-')
  );
  const [description, setDescription] = useState('Interactive web application built with StudioX AI Sandbox');
  const [isPrivate, setIsPrivate] = useState(false);
  const [copiedCommands, setCopiedCommands] = useState(false);
  const [exportStatus, setExportStatus] = useState<'idle' | 'exporting' | 'success'>('idle');

  if (!isOpen) return null;

  const gitCommands = `# 1. Initialize local git repository
git init -b main

# 2. Add files and make initial commit
git add .
git commit -m "feat: initial commit from StudioX"

# 3. Connect to your GitHub repository
git remote add origin https://github.com/YOUR_USERNAME/${repoName}.git

# 4. Push to GitHub
git push -u origin main`;

  const handleCopyCommands = async () => {
    try {
      await navigator.clipboard.writeText(gitCommands);
      setCopiedCommands(true);
      setTimeout(() => setCopiedCommands(false), 2000);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSimulatedExport = () => {
    setExportStatus('exporting');
    setTimeout(() => {
      setExportStatus('success');
      onDownloadZip();
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-white">
              <Github className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">Export to GitHub</h2>
              <p className="text-xs text-slate-400">Push your clean source code to a GitHub repository</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 flex flex-col gap-4 overflow-y-auto max-h-[75vh]">
          {/* Repo Name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-300">Repository Name</label>
            <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-100 font-mono">
              <span className="text-slate-500">github.com/you/</span>
              <input
                type="text"
                value={repoName}
                onChange={(e) => setRepoName(e.target.value)}
                className="flex-1 bg-transparent border-none text-cyan-400 outline-none"
              />
            </div>
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-300">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-100 outline-none focus:border-cyan-500"
            />
          </div>

          {/* Visibility */}
          <div className="flex items-center justify-between p-3.5 bg-slate-950 border border-slate-800 rounded-xl">
            <div className="flex items-center gap-2">
              {isPrivate ? <Lock className="w-4 h-4 text-amber-400" /> : <Globe className="w-4 h-4 text-emerald-400" />}
              <div>
                <span className="text-xs font-semibold text-slate-200 block">
                  {isPrivate ? 'Private Repository' : 'Public Repository'}
                </span>
                <span className="text-[11px] text-slate-500">
                  {isPrivate ? 'Only you and collaborators can view' : 'Anyone on the internet can see this repository'}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsPrivate(!isPrivate)}
              className="px-3 py-1 text-xs font-medium rounded-lg border border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800"
            >
              Toggle
            </button>
          </div>

          {/* Git Terminal Commands Card */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5 text-cyan-400" />
                <span>Quick Git Terminal Setup</span>
              </span>
              <button
                type="button"
                onClick={handleCopyCommands}
                className="text-cyan-400 hover:underline flex items-center gap-1 text-[11px]"
              >
                {copiedCommands ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span className="text-emerald-400">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Copy Commands</span>
                  </>
                )}
              </button>
            </div>

            <pre className="p-3 bg-slate-950 border border-slate-800 rounded-xl font-mono text-[11px] text-slate-300 overflow-x-auto selection:bg-cyan-500/30 leading-relaxed">
              {gitCommands}
            </pre>
          </div>

          {exportStatus === 'success' && (
            <div className="p-3 bg-emerald-950/30 border border-emerald-800/40 rounded-xl flex items-center gap-2 text-xs text-emerald-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Project zip generated with git readiness! Ready to push to GitHub.</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/70 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSimulatedExport}
            disabled={exportStatus === 'exporting'}
            className="px-5 py-2 bg-gradient-to-r from-slate-100 to-slate-300 hover:from-white hover:to-slate-200 active:scale-95 text-slate-950 text-xs font-bold rounded-lg shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Github className="w-4 h-4" />
            <span>{exportStatus === 'exporting' ? 'Exporting...' : 'Export & Download Repo Bundle'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
