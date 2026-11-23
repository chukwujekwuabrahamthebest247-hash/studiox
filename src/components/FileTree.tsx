import React from 'react';
import { 
  Folder, 
  FolderOpen, 
  FileCode, 
  FileText, 
  FileJson, 
  ChevronRight, 
  ChevronDown, 
  Code,
  FilePlus,
  Layers,
  Upload
} from 'lucide-react';
import { ProjectFile, FileType } from '../types';

interface FileTreeProps {
  files: ProjectFile[];
  activeFileId: string;
  onSelectFile: (fileId: string) => void;
  projectName: string;
  onOpenImportZip?: () => void;
}

export const FileTree: React.FC<FileTreeProps> = ({
  files,
  activeFileId,
  onSelectFile,
  projectName,
  onOpenImportZip
}) => {
  const [isOpen, setIsOpen] = React.useState(true);

  const getFileIcon = (type: FileType) => {
    switch (type) {
      case 'html':
        return <FileCode className="w-3.5 h-3.5 text-orange-400 shrink-0" />;
      case 'css':
        return <Code className="w-3.5 h-3.5 text-blue-400 shrink-0" />;
      case 'js':
        return <FileCode className="w-3.5 h-3.5 text-amber-400 shrink-0" />;
      case 'json':
        return <FileJson className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
      case 'markdown':
      default:
        return <FileText className="w-3.5 h-3.5 text-purple-400 shrink-0" />;
    }
  };

  return (
    <div className="w-48 bg-slate-950 border-r border-slate-800/80 flex flex-col select-none text-xs h-full shrink-0">
      {/* File Tree Header */}
      <div className="px-3 py-2 border-b border-slate-800/80 flex items-center justify-between text-slate-400 font-mono text-[11px] font-semibold tracking-wider uppercase">
        <span className="flex items-center gap-1.5 text-slate-300">
          <Layers className="w-3 h-3 text-cyan-400" />
          <span>Explorer</span>
        </span>
        <div className="flex items-center gap-1.5">
          {onOpenImportZip && (
            <button
              onClick={onOpenImportZip}
              className="p-1 hover:text-cyan-400 text-slate-400 rounded hover:bg-slate-900 transition-colors cursor-pointer"
              title="Upload project ZIP"
            >
              <Upload className="w-3 h-3" />
            </button>
          )}
          <span className="text-[10px] text-slate-500 font-mono">{files.length}</span>
        </div>
      </div>

      {/* Directory Node */}
      <div className="flex-1 overflow-y-auto py-1">
        <div 
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1 px-2.5 py-1 text-slate-300 hover:text-white cursor-pointer hover:bg-slate-900/60 font-mono font-medium text-[11px]"
        >
          {isOpen ? <ChevronDown className="w-3.5 h-3.5 text-slate-500" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-500" />}
          {isOpen ? <FolderOpen className="w-3.5 h-3.5 text-cyan-400" /> : <Folder className="w-3.5 h-3.5 text-cyan-400" />}
          <span className="truncate max-w-[120px]">{projectName.toLowerCase().replace(/\s+/g, '-')}</span>
        </div>

        {/* File items */}
        {isOpen && (
          <div className="flex flex-col pl-4 pr-1 gap-0.5 mt-0.5 font-mono">
            {files.map((file) => {
              const isActive = file.id === activeFileId;
              return (
                <button
                  key={file.id}
                  onClick={() => onSelectFile(file.id)}
                  className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md text-left text-xs transition-colors cursor-pointer w-full ${
                    isActive
                      ? 'bg-cyan-950/60 text-cyan-300 border border-cyan-800/40 font-medium'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/80'
                  }`}
                >
                  {getFileIcon(file.type)}
                  <span className="truncate flex-1 text-[11px]">{file.name}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Bottom workspace info */}
      <div className="p-2 border-t border-slate-800/80 bg-slate-950/80 text-[10px] text-slate-500 flex items-center justify-between font-mono">
        <span>Vite + ES2022</span>
        <span className="text-emerald-400">● Live</span>
      </div>
    </div>
  );
};
