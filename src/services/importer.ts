import { CodeState, ProjectFile } from '../types';
import { CodebaseFile, ingestUploadedFiles } from './codebaseVault';
import { compileCodebaseFiles } from './codebaseCompiler';

export interface ImportedProject {
  projectName: string;
  code: CodeState;
  files: ProjectFile[];
  codebaseFiles?: CodebaseFile[];
  manifest?: Record<string, string>;
  notes: string;
}

/**
 * Extracts and compiles any web or React/TS/Vite project from a ZIP file archive verbatim.
 */
export async function importProjectFromZip(file: File): Promise<ImportedProject> {
  const { files: extracted } = await ingestUploadedFiles([file]);

  if (extracted.length === 0) {
    throw new Error('The uploaded ZIP file appears to contain no readable project files.');
  }

  const cleanName = file.name
    .replace(/\.zip$/i, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (l) => l.toUpperCase());

  const compiled = compileCodebaseFiles(extracted, cleanName || 'Imported Web App');

  const manifest: Record<string, string> = {};
  for (const f of extracted) {
    manifest[f.path] = f.content;
  }

  const projectFiles: ProjectFile[] = [
    { id: 'index.html', name: 'index.html', type: 'html', path: '/index.html' },
    { id: 'styles.css', name: 'styles.css', type: 'css', path: '/styles.css' },
    { id: 'app.js', name: 'app.js', type: 'js', path: '/app.js' }
  ];

  if (extracted.some((f) => /readme/i.test(f.path))) {
    projectFiles.push({ id: 'README.md', name: 'README.md', type: 'markdown', path: '/README.md' });
  }
  if (extracted.some((f) => /package\.json/i.test(f.path))) {
    projectFiles.push({ id: 'package.json', name: 'package.json', type: 'json', path: '/package.json' });
  }

  return {
    projectName: compiled.title || cleanName || 'Imported Web App',
    code: compiled.code,
    files: projectFiles,
    codebaseFiles: extracted,
    manifest,
    notes: `Compiled ${compiled.includedFiles.length} file(s) from "${file.name}" (${compiled.projectType}, entry: ${compiled.entryFile}).`
  };
}

