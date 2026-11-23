import React, { useState, useRef } from 'react';
import { 
  X, 
  Upload, 
  FolderArchive, 
  FileCode, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Code2, 
  Layers, 
  ArrowRight,
  FileCheck
} from 'lucide-react';
import { importProjectFromZip, ImportedProject } from '../services/importer';

interface ImportZipModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProjectImported: (project: ImportedProject) => void;
}

export const ImportZipModal: React.FC<ImportZipModalProps> = ({
  isOpen,
  onClose,
  onProjectImported
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewProject, setPreviewProject] = useState<ImportedProject | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleProcessFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.zip')) {
      setError('Please upload a valid .zip archive file.');
      return;
    }

    setError(null);
    setIsProcessing(true);
    setSelectedFileName(file.name);

    try {
      const imported = await importProjectFromZip(file);
      setPreviewProject(imported);
    } catch (err: any) {
      console.error('Import error:', err);
      setError(err.message || 'Failed to extract ZIP archive.');
      setPreviewProject(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleProcessFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleProcessFile(file);
    }
  };

  const handleConfirmImport = () => {
    if (previewProject) {
      onProjectImported(previewProject);
      onClose();
      // Reset state
      setPreviewProject(null);
      setSelectedFileName('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
              <FolderArchive className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">Upload & Edit Project ZIP</h2>
              <p className="text-xs text-slate-400">Import any web project ZIP to edit code, prompt AI, and run live</p>
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
          {/* Dropzone */}
          {!previewProject ? (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                isDragging
                  ? 'border-cyan-400 bg-cyan-950/20 scale-[1.01]'
                  : 'border-slate-700 bg-slate-950/60 hover:border-slate-600 hover:bg-slate-950'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".zip,application/zip,application/x-zip-compressed"
                onChange={handleFileChange}
                className="hidden"
              />

              <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-cyan-400 mb-3 shadow-inner">
                {isProcessing ? (
                  <Loader2 className="w-7 h-7 animate-spin text-cyan-400" />
                ) : (
                  <Upload className="w-7 h-7" />
                )}
              </div>

              <h3 className="text-sm font-semibold text-slate-200 mb-1">
                {isProcessing ? 'Unzipping and analyzing project...' : 'Drop your project .zip archive here'}
              </h3>
              <p className="text-xs text-slate-400 max-w-xs mb-3">
                Upload any web app ZIP containing HTML, CSS, and JS (such as previous StudioX exports or external code).
              </p>

              <button
                type="button"
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition-colors"
              >
                Browse Files
              </button>
            </div>
          ) : (
            /* Discovered files preview card */
            <div className="p-4 bg-slate-950 border border-cyan-800/40 rounded-xl flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileCheck className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold text-slate-100">{selectedFileName}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setPreviewProject(null);
                    setSelectedFileName('');
                  }}
                  className="text-[11px] text-slate-400 hover:text-cyan-400 underline decoration-slate-700"
                >
                  Choose different file
                </button>
              </div>

              <div className="p-3 bg-slate-900/90 rounded-lg border border-slate-800 flex flex-col gap-2">
                <span className="text-[11px] font-mono font-semibold text-cyan-400 uppercase tracking-wider">
                  Extracted Project Assets:
                </span>
                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div className="p-2 bg-slate-950 border border-slate-800/80 rounded flex items-center gap-2">
                    <FileCode className="w-3.5 h-3.5 text-orange-400" />
                    <span className="text-slate-300 truncate">index.html</span>
                    <span className="text-[10px] text-slate-500 ml-auto">
                      {Math.round(previewProject.code.html.length / 1024 * 10) / 10}kb
                    </span>
                  </div>

                  <div className="p-2 bg-slate-950 border border-slate-800/80 rounded flex items-center gap-2">
                    <FileCode className="w-3.5 h-3.5 text-blue-400" />
                    <span className="text-slate-300 truncate">styles.css</span>
                    <span className="text-[10px] text-slate-500 ml-auto">
                      {Math.round(previewProject.code.css.length / 1024 * 10) / 10}kb
                    </span>
                  </div>

                  <div className="p-2 bg-slate-950 border border-slate-800/80 rounded flex items-center gap-2">
                    <FileCode className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-slate-300 truncate">app.js</span>
                    <span className="text-[10px] text-slate-500 ml-auto">
                      {Math.round(previewProject.code.js.length / 1024 * 10) / 10}kb
                    </span>
                  </div>

                  <div className="p-2 bg-slate-950 border border-slate-800/80 rounded flex items-center gap-2">
                    <Layers className="w-3.5 h-3.5 text-purple-400" />
                    <span className="text-slate-300 truncate">{previewProject.projectName}</span>
                  </div>
                </div>
              </div>

              <div className="text-[11px] text-emerald-300 bg-emerald-950/30 border border-emerald-800/40 p-2.5 rounded-lg flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Ready to load! You will be able to edit this app live, tweak its code, or prompt AI to modify it.</span>
              </div>
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-950/30 border border-red-800/40 rounded-xl flex items-center gap-2 text-xs text-red-300">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{error}</span>
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
            onClick={handleConfirmImport}
            disabled={!previewProject}
            className="px-5 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 active:scale-95 text-slate-950 text-xs font-bold rounded-lg shadow-md shadow-cyan-500/20 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <span>Load & Edit in StudioX</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
