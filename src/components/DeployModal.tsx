import React, { useState } from 'react';
import { 
  X, 
  Rocket, 
  Globe, 
  Copy, 
  Check, 
  ExternalLink, 
  QrCode, 
  ShieldCheck, 
  Zap, 
  Server, 
  Flame, 
  RefreshCw 
} from 'lucide-react';
import { DeploymentInfo } from '../types';

interface DeployModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectName: string;
  deployment: DeploymentInfo;
  onDeploy: (provider: 'cloudrun' | 'firebase') => Promise<void>;
  isDeploying: boolean;
}

export const DeployModal: React.FC<DeployModalProps> = ({
  isOpen,
  onClose,
  projectName,
  deployment,
  onDeploy,
  isDeploying
}) => {
  const [selectedProvider, setSelectedProvider] = useState<'cloudrun' | 'firebase'>('cloudrun');
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);

  if (!isOpen) return null;

  const currentUrl = deployment.url || `https://ais-dev-uydikfdvqy4ypphv62wo5u-126569678924.europe-west1.run.app/preview`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(currentUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error('Failed to copy link', e);
    }
  };

  const handleTriggerDeploy = async () => {
    await onDeploy(selectedProvider);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
              <Rocket className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">Deploy to Live URL</h2>
              <p className="text-xs text-slate-400">Host your generated project on high-speed cloud infrastructure</p>
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
        <div className="p-6 flex flex-col gap-5 overflow-y-auto max-h-[75vh]">
          {/* Hosting Provider Selector */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-slate-300">Choose Deployment Target</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setSelectedProvider('cloudrun')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  selectedProvider === 'cloudrun'
                    ? 'border-cyan-400 bg-cyan-950/30 text-white'
                    : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Server className="w-4 h-4 text-cyan-400" />
                  <span className="text-xs font-bold text-slate-100">Google Cloud Run</span>
                </div>
                <p className="text-[11px] text-slate-400">Instant isolated container edge sandbox preview</p>
              </button>

              <button
                type="button"
                onClick={() => setSelectedProvider('firebase')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  selectedProvider === 'firebase'
                    ? 'border-amber-400 bg-amber-950/30 text-white'
                    : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Flame className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-bold text-slate-100">Firebase Hosting</span>
                </div>
                <p className="text-[11px] text-slate-400">Global SSD CDN with automated SSL & custom domain</p>
              </button>
            </div>
          </div>

          {/* Active Live URL Box */}
          <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-emerald-400" />
                <span>Production Endpoint</span>
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>{deployment.isDeployed ? 'Live & Active' : 'Ready to Deploy'}</span>
              </span>
            </div>

            <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-lg p-2 font-mono text-xs text-slate-200">
              <span className="truncate flex-1 select-all">{currentUrl}</span>
              <button
                onClick={handleCopy}
                className="p-1 hover:text-cyan-400 text-slate-400 rounded transition-colors"
                title="Copy URL"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
              <a
                href={currentUrl}
                target="_blank"
                rel="noreferrer"
                className="p-1 hover:text-cyan-400 text-slate-400 rounded transition-colors"
                title="Open in new window"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>

            {/* Quick Actions & QR Code Toggle */}
            <div className="flex items-center justify-between text-xs pt-1">
              <button
                onClick={() => setShowQr(!showQr)}
                className="text-slate-400 hover:text-cyan-400 flex items-center gap-1 text-[11px]"
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>{showQr ? 'Hide QR Code' : 'Show Mobile QR Code'}</span>
              </button>

              <span className="text-[11px] text-slate-500">
                {deployment.deployedAt ? `Updated ${deployment.deployedAt}` : 'Ready for deployment'}
              </span>
            </div>

            {/* QR Code Graphic simulation */}
            {showQr && (
              <div className="flex flex-col items-center justify-center p-4 bg-slate-900 rounded-lg border border-slate-800 gap-2">
                <div className="w-36 h-36 bg-white p-2 rounded-lg flex items-center justify-center shadow-lg">
                  {/* Generated QR pattern via svg */}
                  <svg className="w-full h-full text-slate-950" viewBox="0 0 100 100" fill="currentColor">
                    <rect x="0" y="0" width="30" height="30" fill="currentColor" />
                    <rect x="5" y="5" width="20" height="20" fill="white" />
                    <rect x="10" y="10" width="10" height="10" fill="currentColor" />
                    <rect x="70" y="0" width="30" height="30" fill="currentColor" />
                    <rect x="75" y="5" width="20" height="20" fill="white" />
                    <rect x="80" y="10" width="10" height="10" fill="currentColor" />
                    <rect x="0" y="70" width="30" height="30" fill="currentColor" />
                    <rect x="5" y="75" width="20" height="20" fill="white" />
                    <rect x="10" y="80" width="10" height="10" fill="currentColor" />
                    <rect x="40" y="15" width="10" height="10" fill="currentColor" />
                    <rect x="40" y="35" width="20" height="10" fill="currentColor" />
                    <rect x="40" y="55" width="10" height="20" fill="currentColor" />
                    <rect x="60" y="50" width="15" height="15" fill="currentColor" />
                    <rect x="75" y="75" width="25" height="25" fill="currentColor" />
                  </svg>
                </div>
                <span className="text-[11px] text-slate-400">Scan with your phone camera to test live sandbox</span>
              </div>
            )}
          </div>

          {/* Infrastructure Specs */}
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="p-2.5 bg-slate-950 border border-slate-800 rounded-lg">
              <ShieldCheck className="w-4 h-4 text-emerald-400 mx-auto mb-1" />
              <span className="block font-semibold text-slate-200">SSL Encrypted</span>
              <span className="text-[10px] text-slate-500">Auto HTTPS</span>
            </div>
            <div className="p-2.5 bg-slate-950 border border-slate-800 rounded-lg">
              <Zap className="w-4 h-4 text-amber-400 mx-auto mb-1" />
              <span className="block font-semibold text-slate-200">Sub-10ms</span>
              <span className="text-[10px] text-slate-500">Edge Caching</span>
            </div>
            <div className="p-2.5 bg-slate-950 border border-slate-800 rounded-lg">
              <Server className="w-4 h-4 text-cyan-400 mx-auto mb-1" />
              <span className="block font-semibold text-slate-200">Zero-Config</span>
              <span className="text-[10px] text-slate-500">Auto Scaling</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/70 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            Close
          </button>
          <button
            type="button"
            onClick={handleTriggerDeploy}
            disabled={isDeploying}
            className="px-5 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 active:scale-95 text-slate-950 text-xs font-bold rounded-lg shadow-md shadow-cyan-500/20 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {isDeploying ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Deploying to {selectedProvider === 'cloudrun' ? 'Cloud Run' : 'Firebase'}...</span>
              </>
            ) : (
              <>
                <Rocket className="w-3.5 h-3.5" />
                <span>Publish & Deploy Live</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
