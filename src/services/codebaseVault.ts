import JSZip from 'jszip';

export interface CodebaseFile {
  id: string;
  path: string;
  name: string;
  content: string;
  lines: number;
  chars: number;
  bytes: number;
  ext: string;
  symbols: string[];
}

export interface CodebaseContextResult {
  contextText: string;
  includedFiles: string[];
  totalFiles: number;
  totalLines: number;
  totalChars: number;
  includedChars: number;
  omittedFiles: string[];
}

const DB_NAME = 'studiox_codebase_vault_v1';
const STORE_NAME = 'workspaces';

const IGNORED_PATH_SEGMENTS = [
  'node_modules/',
  '.git/',
  '.next/',
  '.nuxt/',
  'coverage/',
  '__macosx/',
  '.cache/',
  '.turbo/',
  '.svelte-kit/',
  'vendor/'
];

const CONDITIONAL_BUILD_SEGMENTS = ['dist/', 'build/'];

const BINARY_EXTENSIONS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'ico', 'bmp', 'tiff', 'avif',
  'mp3', 'wav', 'ogg', 'mp4', 'webm', 'mov', 'avi',
  'woff', 'woff2', 'ttf', 'otf', 'eot',
  'pdf', 'zip', 'tar', 'gz', '7z', 'rar', 'exe', 'dll', 'so', 'dylib', 'wasm', 'lockb'
]);

const TEXT_EXTENSIONS = new Set([
  'ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'html', 'htm', 'css', 'scss', 'sass', 'less',
  'json', 'md', 'mdx', 'txt', 'xml', 'svg', 'yaml', 'yml', 'toml', 'env', 'example',
  'py', 'rb', 'go', 'rs', 'java', 'kt', 'swift', 'c', 'cpp', 'h', 'hpp', 'cs', 'php',
  'sql', 'graphql', 'gql', 'prisma', 'sh', 'bash', 'zsh', 'vue', 'svelte', 'astro'
]);

function normalizeVaultPath(rawPath: string): string {
  return rawPath
    .replace(/\\/g, '/')
    .replace(/^(?:\.\/)+/, '')
    .replace(/^\/+/, '')
    .trim();
}

function isIgnoredPath(rawPath: string, skipBuildDirs = true): boolean {
  const normalized = normalizeVaultPath(rawPath).toLowerCase();
  if (!normalized) return true;
  if (normalized.startsWith('.') && !normalized.startsWith('.env')) {
    return true;
  }
  if (normalized.includes('/.') && !normalized.includes('/.env')) {
    return true;
  }
  if (IGNORED_PATH_SEGMENTS.some((seg) => normalized.includes(seg))) {
    return true;
  }
  if (
    skipBuildDirs &&
    CONDITIONAL_BUILD_SEGMENTS.some((seg) => normalized.startsWith(seg) || normalized.includes(`/${seg}`))
  ) {
    return true;
  }
  const baseName = normalized.split('/').pop() || '';
  if (
    baseName === '.ds_store' ||
    baseName === 'package-lock.json' ||
    baseName === 'yarn.lock' ||
    baseName === 'pnpm-lock.yaml'
  ) {
    return true;
  }
  const ext = baseName.includes('.') ? baseName.split('.').pop() || '' : '';
  if (BINARY_EXTENSIONS.has(ext)) {
    return true;
  }
  return false;
}

export function extractSymbolsFromCode(content: string, ext: string): string[] {
  const symbols = new Set<string>();
  const sample = content.slice(0, 120000);

  if (ext === 'html' || ext === 'htm') {
    const idMatches = sample.matchAll(/\bid=["']([a-zA-Z0-9_-]+)["']/g);
    for (const m of idMatches) {
      symbols.add(`#${m[1]}`);
      if (symbols.size >= 28) break;
    }
  } else if (ext === 'css' || ext === 'scss') {
    const selectorMatches = sample.matchAll(/(?:^|\n)\s*([.#][a-zA-Z_-][a-zA-Z0-9_-]{1,36})\s*[{,]/g);
    for (const m of selectorMatches) {
      symbols.add(m[1]);
      if (symbols.size >= 28) break;
    }
  } else {
    const declMatches = sample.matchAll(
      /(?:^|\n)\s*(?:export\s+(?:default\s+)?)?(?:async\s+)?(?:function|class|interface|type|enum|const|let|def|struct|fn)\s+([A-Za-z_$][A-Za-z0-9_$]{1,42})/g
    );
    for (const m of declMatches) {
      symbols.add(m[1]);
      if (symbols.size >= 30) break;
    }
  }

  return Array.from(symbols);
}

export function createCodebaseFile(rawPath: string, content: string, sizeBytes?: number): CodebaseFile {
  const normalizedPath = normalizeVaultPath(rawPath) || 'snippet.txt';
  const name = normalizedPath.split('/').pop() || normalizedPath;
  const ext = name.includes('.') ? (name.split('.').pop() || '').toLowerCase() : 'txt';
  const lines = content ? content.split(/\r?\n/).length : 0;
  const chars = content.length;

  return {
    id: `${normalizedPath}-${chars}-${lines}`,
    path: normalizedPath,
    name,
    content,
    lines,
    chars,
    bytes: sizeBytes ?? new Blob([content]).size,
    ext,
    symbols: extractSymbolsFromCode(content, ext)
  };
}

/**
 * Ingests multiple code files, folder selections, pasted snippets, and .zip archives
 * cleanly with no artificial file-size truncation.
 */
export async function ingestUploadedFiles(fileList: FileList | File[]): Promise<{
  files: CodebaseFile[];
  skippedCount: number;
}> {
  const inputFiles = Array.from(fileList);
  const collected: CodebaseFile[] = [];
  let skippedCount = 0;

  for (const file of inputFiles) {
    const relPath = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
    const lowerName = file.name.toLowerCase();

    if (lowerName.endsWith('.zip')) {
      try {
        const zip = new JSZip();
        const loaded = await zip.loadAsync(file);
        const rawEntries = Object.entries(loaded.files).filter(([, zipEntry]) => !zipEntry.dir);
        const hasNonBuildSource = rawEntries.some(([entryPath]) => !isIgnoredPath(entryPath, true));
        const skipBuildDirs = hasNonBuildSource;
        const entryTasks: Promise<void>[] = [];

        for (const [entryPath, zipEntry] of rawEntries) {
          if (isIgnoredPath(entryPath, skipBuildDirs)) {
            skippedCount += 1;
            continue;
          }
          const ext = entryPath.includes('.') ? (entryPath.split('.').pop() || '').toLowerCase() : '';
          if (ext && !TEXT_EXTENSIONS.has(ext) && BINARY_EXTENSIONS.has(ext)) {
            skippedCount += 1;
            continue;
          }
          entryTasks.push(
            zipEntry.async('string').then((text) => {
              // Skip accidental binary strings containing null bytes
              if (text.includes('\u0000')) {
                skippedCount += 1;
                return;
              }
              collected.push(createCodebaseFile(entryPath, text));
            })
          );
        }

        await Promise.all(entryTasks);
      } catch (err) {
        console.warn(`Failed to extract ZIP "${file.name}":`, err);
        skippedCount += 1;
      }
      continue;
    }

    if (isIgnoredPath(relPath)) {
      skippedCount += 1;
      continue;
    }

    const ext = file.name.includes('.') ? (file.name.split('.').pop() || '').toLowerCase() : '';
    const isLikelyText =
      !ext ||
      TEXT_EXTENSIONS.has(ext) ||
      file.type.startsWith('text/') ||
      file.type.includes('json') ||
      file.type.includes('javascript') ||
      file.type.includes('xml');

    if (!isLikelyText && file.size > 0) {
      skippedCount += 1;
      continue;
    }

    try {
      const text = await file.text();
      if (text.includes('\u0000')) {
        skippedCount += 1;
        continue;
      }
      collected.push(createCodebaseFile(relPath, text, file.size));
    } catch {
      skippedCount += 1;
    }
  }

  return { files: collected, skippedCount };
}

export function mergeCodebaseFiles(existing: CodebaseFile[], incoming: CodebaseFile[]): CodebaseFile[] {
  const byPath = new Map<string, CodebaseFile>();
  for (const f of existing) byPath.set(f.path, f);
  for (const f of incoming) byPath.set(f.path, f);
  return Array.from(byPath.values());
}

export function getCodebaseStats(files: CodebaseFile[]): {
  totalFiles: number;
  totalLines: number;
  totalChars: number;
  totalBytes: number;
} {
  let totalLines = 0;
  let totalChars = 0;
  let totalBytes = 0;
  for (const f of files) {
    totalLines += f.lines;
    totalChars += f.chars;
    totalBytes += f.bytes;
  }
  return {
    totalFiles: files.length,
    totalLines,
    totalChars,
    totalBytes
  };
}

export type FileResponsibilityRole =
  | 'style'
  | 'html-entry'
  | 'ui-component'
  | 'routing'
  | 'state-store'
  | 'api-service'
  | 'utility'
  | 'config'
  | 'doc'
  | 'code';

export interface FileResponsibilityProfile {
  path: string;
  name: string;
  ext: string;
  role: FileResponsibilityRole;
  lines: number;
  chars: number;
  exports: string[];
  imports: string[];
  importedBy: string[];
  uiCues: string[];
}

export interface RankedResponsibleFile {
  file: CodebaseFile;
  profile: FileResponsibilityProfile;
  score: number;
  reasons: string[];
}

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'this', 'that', 'from', 'into', 'your', 'you',
  'make', 'want', 'please', 'could', 'would', 'should', 'can', 'file', 'code',
  'change', 'edit', 'modify', 'update', 'when', 'where', 'what', 'which', 'only',
  'exact', 'standard', 'currently', 'there', 'here', 'have', 'has', 'are', 'not',
  'all', 'some', 'more', 'less', 'also', 'just', 'like', 'need', 'needs'
]);

export function splitIdentifierTokens(raw: string): string[] {
  const expanded = raw
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ');

  const tokens: string[] = [];
  for (const part of expanded.split(/\s+/)) {
    if (part.length >= 2 && !STOP_WORDS.has(part)) {
      tokens.push(part);
    }
  }
  return Array.from(new Set(tokens));
}

function buildSearchQueryTokens(prompt: string): string[] {
  const lower = prompt.toLowerCase();
  const rawWords = lower
    .replace(/[^a-z0-9_.-]+/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 2 && !STOP_WORDS.has(w));
  const splitWords = splitIdentifierTokens(prompt);
  return Array.from(new Set([...rawWords, ...splitWords])).slice(0, 40);
}

export function extractImportsFromCode(content: string, ext: string): string[] {
  const imports = new Set<string>();
  const sample = content.slice(0, 60000);

  if (ext === 'html' || ext === 'htm') {
    for (const m of sample.matchAll(/\b(?:src|href)=["']([^"']+)["']/gi)) {
      const target = m[1].trim();
      if (target && !/^(?:https?:|data:|mailto:|#)/i.test(target)) {
        imports.add(target);
      }
      if (imports.size >= 24) break;
    }
    return Array.from(imports);
  }

  for (const m of sample.matchAll(/\bfrom\s+['"]([^'"]+)['"]|\brequire\(\s*['"]([^'"]+)['"]\s*\)|^\s*import\s+['"]([^'"]+)['"]/gm)) {
    const spec = (m[1] || m[2] || m[3] || '').trim();
    if (spec) {
      imports.add(spec);
    }
    if (imports.size >= 28) break;
  }

  for (const m of sample.matchAll(/@import\s+(?:url\()?['"]?([^'")\s]+)['"]?\)?/gi)) {
    const spec = m[1].trim();
    if (spec) imports.add(spec);
    if (imports.size >= 28) break;
  }

  return Array.from(imports);
}

export function extractUiCuesFromCode(content: string, ext: string): string[] {
  const cues = new Set<string>();
  const addCue = (raw: string) => {
    const cleaned = raw.replace(/\s+/g, ' ').trim();
    if (cleaned.length >= 2 && cleaned.length <= 48 && !/^[\d\s.,:/-]+$/.test(cleaned)) {
      cues.add(cleaned);
    }
  };

  if (ext === 'css' || ext === 'scss' || ext === 'sass' || ext === 'less') {
    for (const m of content.matchAll(/(--[a-zA-Z0-9_-]{2,36})\s*:/g)) {
      addCue(m[1]);
      if (cues.size >= 30) break;
    }
    for (const m of content.matchAll(/(?:^|\n|,)\s*([.#][a-zA-Z_-][a-zA-Z0-9_-]{1,36})(?=[\s{,:])/g)) {
      addCue(m[1]);
      if (cues.size >= 30) break;
    }
    return Array.from(cues);
  }

  if (ext === 'html' || ext === 'htm' || ext === 'tsx' || ext === 'jsx' || ext === 'vue' || ext === 'svelte' || ext === 'js' || ext === 'ts') {
    // Visible UI text inside HTML/JSX tags: >Text<
    for (const m of content.matchAll(/>([^<>{}\n]{2,44})</g)) {
      const txt = m[1].trim();
      if (txt && !txt.startsWith('//') && !txt.includes('=>') && /[a-zA-Z]{2,}/.test(txt)) {
        addCue(txt);
      }
      if (cues.size >= 32) break;
    }
    // Common UI attributes: placeholder, aria-label, title, alt, label, name, path
    for (const m of content.matchAll(/\b(?:placeholder|aria-label|title|alt|label|data-testid)=["']([^"']{2,44})["']/gi)) {
      addCue(m[1]);
      if (cues.size >= 36) break;
    }
    // Route paths
    for (const m of content.matchAll(/\bpath\s*[:=]\s*["'`](\/[^"'`\s]{0,36})["'`]/gi)) {
      addCue(m[1]);
      if (cues.size >= 40) break;
    }
  }

  return Array.from(cues);
}

export function inferFileRole(path: string, ext: string, content: string): FileResponsibilityRole {
  const lower = path.toLowerCase();
  if (ext === 'css' || ext === 'scss' || ext === 'sass' || ext === 'less') return 'style';
  if (ext === 'html' || ext === 'htm') return 'html-entry';
  if (ext === 'md' || ext === 'mdx' || ext === 'txt') return 'doc';
  if (
    ext === 'json' ||
    ext === 'toml' ||
    ext === 'yaml' ||
    ext === 'yml' ||
    /(?:config|tsconfig|vite\.config|tailwind\.config|eslint|prettier)/i.test(lower)
  ) {
    return 'config';
  }
  if (/(?:^|\/)(?:routes?|router|pages?)\b/i.test(lower) || /<Route\b|createBrowserRouter/i.test(content.slice(0, 12000))) {
    return 'routing';
  }
  if (/(?:store|context|redux|zustand|slice|provider|state|reducer)/i.test(lower) || /\bcreateContext\b|\bcreateStore\b|\bcreate\s*\(/i.test(content.slice(0, 12000))) {
    return 'state-store';
  }
  if (/(?:api|service|client|fetch|http|auth|calc|tax|pricing|checkout|payment|billing|backend|server|db|storage)/i.test(lower)) {
    return 'api-service';
  }
  if (/(?:util|helper|lib|format|validat|hook|use[A-Z])/i.test(lower)) {
    return 'utility';
  }
  if (ext === 'tsx' || ext === 'jsx' || ext === 'vue' || ext === 'svelte' || /<[A-Za-z][A-Za-z0-9]*[\s>]/.test(content.slice(0, 20000))) {
    return 'ui-component';
  }
  return 'code';
}

export function analyzeFileResponsibility(
  file: CodebaseFile,
  importedByMap?: Map<string, string[]>
): FileResponsibilityProfile {
  return {
    path: file.path,
    name: file.name,
    ext: file.ext,
    role: inferFileRole(file.path, file.ext, file.content),
    lines: file.lines,
    chars: file.chars,
    exports: file.symbols.slice(0, 12),
    imports: extractImportsFromCode(file.content, file.ext),
    importedBy: importedByMap?.get(file.path) || [],
    uiCues: extractUiCuesFromCode(file.content, file.ext)
  };
}

interface PromptIntentDomains {
  wantsStyle: boolean;
  wantsUiMarkup: boolean;
  wantsLogicState: boolean;
  wantsHtmlHead: boolean;
  wantsRouting: boolean;
}

function detectPromptIntentDomains(promptLower: string): PromptIntentDomains {
  return {
    wantsStyle: /\b(color|colour|background|bg|font|typography|border|radius|rounded|shadow|gradient|theme|dark|light|spacing|padding|margin|gap|size|width|height|layout|grid|flex|align|center|responsive|hover|animation|transition|css|scss|tailwind|style|styles|styling|recolor|contrast|opacity)\b/i.test(promptLower),
    wantsUiMarkup: /\b(button|btn|header|navbar|nav|footer|sidebar|modal|dialog|drawer|popup|card|form|input|field|placeholder|label|title|heading|hero|badge|icon|tab|tabs|menu|dropdown|table|list|banner|text|copy|wording|section|screen|page|component|ui|view)\b/i.test(promptLower),
    wantsLogicState: /\b(calculate|calculation|formula|price|pricing|tax|total|discount|validate|validation|submit|handler|click|onclick|onchange|state|store|context|filter|sort|search|fetch|api|request|endpoint|auth|login|signup|logout|save|persist|storage|localstorage|error|bug|fix|crash|timer|format|currency|percent|decimal|round|logic|function|method|hook)\b/i.test(promptLower),
    wantsHtmlHead: /\b(tab\s+title|page\s+title|browser\s+title|favicon|meta|viewport|head\s+tag|html\s+title|google\s+font|cdn|body\s+class|index\.html)\b/i.test(promptLower),
    wantsRouting: /\b(route|routes|routing|redirect|navigate|navigation|url|slug|path|404|not\s+found)\b/i.test(promptLower)
  };
}

function detectVaultRootPrefix(files: CodebaseFile[]): string {
  const pkg = [...files]
    .filter((f) => /(?:^|\/)package\.json$/i.test(f.path))
    .sort((a, b) => a.path.split('/').length - b.path.split('/').length)[0];
  if (pkg && pkg.path.includes('/')) {
    return pkg.path.slice(0, pkg.path.lastIndexOf('/') + 1);
  }
  const srcFile = [...files]
    .filter((f) => /(?:^|\/)src\/(?:main|index|App)\.[jt]sx?$/i.test(f.path))
    .sort((a, b) => a.path.split('/').length - b.path.split('/').length)[0];
  if (srcFile) {
    const idx = srcFile.path.toLowerCase().indexOf('src/');
    if (idx > 0) return srcFile.path.slice(0, idx);
  }
  return '';
}

function resolveImportToFilePath(
  importerPath: string,
  importSpec: string,
  allPathsLowerMap: Map<string, string>,
  rootPrefix = ''
): string | null {
  const cleanSpec = importSpec.split('?')[0].split('#')[0].replace(/\\/g, '/').trim();
  if (!cleanSpec || /^(?:https?:|data:|mailto:|blob:|#)/i.test(cleanSpec)) return null;

  const baseBases: string[] = [];
  if (cleanSpec.startsWith('.')) {
    const dirParts = importerPath.split('/');
    dirParts.pop();
    for (const seg of cleanSpec.split('/')) {
      if (!seg || seg === '.') continue;
      if (seg === '..') {
        if (dirParts.length > 0) dirParts.pop();
      } else {
        dirParts.push(seg);
      }
    }
    baseBases.push(dirParts.join('/').toLowerCase());
  } else if (cleanSpec.startsWith('@/') || cleanSpec.startsWith('~/')) {
    const sub = cleanSpec.slice(2).toLowerCase();
    baseBases.push(`${rootPrefix.toLowerCase()}src/${sub}`, `${rootPrefix.toLowerCase()}${sub}`, `src/${sub}`, sub);
  } else if (cleanSpec.startsWith('/')) {
    const sub = cleanSpec.replace(/^\/+/, '').toLowerCase();
    baseBases.push(`${rootPrefix.toLowerCase()}${sub}`, sub);
  } else {
    return null;
  }

  for (const base of baseBases) {
    const stripped = base.replace(/\.(?:[jt]sx?|mjs|cjs)$/i, '');
    const candidates = [
      base,
      `${base}.ts`,
      `${base}.tsx`,
      `${base}.js`,
      `${base}.jsx`,
      `${base}.css`,
      `${base}.scss`,
      `${base}/index.ts`,
      `${base}/index.tsx`,
      `${base}/index.js`,
      `${base}/index.jsx`,
      `${stripped}.ts`,
      `${stripped}.tsx`,
      `${stripped}.js`,
      `${stripped}.jsx`
    ];
    for (const c of candidates) {
      const found = allPathsLowerMap.get(c);
      if (found) return found;
    }
  }
  return null;
}

export function buildBidirectionalDependencyGraph(files: CodebaseFile[]): {
  resolvedImports: Map<string, string[]>;
  importedBy: Map<string, string[]>;
} {
  const pathLowerMap = new Map<string, string>();
  for (const f of files) {
    pathLowerMap.set(f.path.toLowerCase(), f.path);
  }
  const rootPrefix = detectVaultRootPrefix(files);
  const resolvedImports = new Map<string, string[]>();
  const importedBySet = new Map<string, Set<string>>();

  for (const f of files) {
    const rawImports = extractImportsFromCode(f.content, f.ext);
    const resolvedList: string[] = [];
    for (const spec of rawImports) {
      const target = resolveImportToFilePath(f.path, spec, pathLowerMap, rootPrefix);
      if (target && target !== f.path) {
        if (!resolvedList.includes(target)) resolvedList.push(target);
        if (!importedBySet.has(target)) importedBySet.set(target, new Set());
        importedBySet.get(target)!.add(f.path);
      }
    }
    resolvedImports.set(f.path, resolvedList);
  }

  const importedBy = new Map<string, string[]>();
  for (const [target, callers] of importedBySet.entries()) {
    importedBy.set(target, Array.from(callers));
  }

  return { resolvedImports, importedBy };
}

/**
 * Ranks all files in the codebase by true functional responsibility for a user change request:
 * splits identifiers, checks FULL file contents, indexes UI text/labels/selectors/routes,
 * aligns file roles with styling vs UI vs logic intent, and propagates bidirectional import graph relationships.
 */
export function rankResponsibleFiles(
  files: CodebaseFile[],
  prompt: string
): RankedResponsibleFile[] {
  if (files.length === 0) return [];

  const promptLower = prompt.toLowerCase();
  const queryTokens = buildSearchQueryTokens(prompt);
  const domains = detectPromptIntentDomains(promptLower);

  // Extract quoted literal strings from prompt (e.g. "Sign In", 'Apply Promo') for exact UI matching
  const quotedPhrases = Array.from(prompt.matchAll(/["'`]([^"'`]{2,48})["'`]/g)).map((m) =>
    m[1].trim().toLowerCase()
  );

  const { resolvedImports, importedBy } = buildBidirectionalDependencyGraph(files);
  const profiles = new Map<string, FileResponsibilityProfile>();
  for (const f of files) {
    profiles.set(f.path, analyzeFileResponsibility(f, importedBy));
  }

  const baseScored = files.map((file) => {
    const profile = profiles.get(file.path)!;
    const pathLower = file.path.toLowerCase();
    const nameLower = file.name.toLowerCase();
    const stemLower = nameLower.replace(/\.[^.]+$/, '');
    const contentLower = file.content.toLowerCase();
    const reasons: string[] = [];
    let score = 0;

    // 1. Direct path / filename match
    if (promptLower.includes(pathLower)) {
      score += 260;
      reasons.push('exact path mentioned');
    } else if (nameLower.length >= 3 && promptLower.includes(nameLower)) {
      score += 200;
      reasons.push('filename mentioned');
    } else if (stemLower.length >= 3 && !['index', 'main', 'app', 'styles', 'style'].includes(stemLower) && promptLower.includes(stemLower)) {
      score += 110;
      reasons.push('module name mentioned');
    }

    // 2. Quoted UI phrases or exact strings found in content or UI cues
    for (const phrase of quotedPhrases) {
      if (contentLower.includes(phrase)) {
        score += 130;
        reasons.push(`contains "${phrase}"`);
      }
    }

    // 3. UI cues (visible JSX/HTML labels, placeholders, titles, CSS selectors, routes)
    let cueHits = 0;
    for (const cue of profile.uiCues) {
      const cueLower = cue.toLowerCase().replace(/^[.#]/, '');
      const cueTokens = splitIdentifierTokens(cue);
      if (cueLower.length >= 3 && promptLower.includes(cueLower)) {
        score += 95;
        cueHits += 1;
        if (reasons.length < 4) reasons.push(`UI cue "${cue}"`);
      } else if (cueTokens.length > 0 && cueTokens.filter((t) => queryTokens.includes(t)).length >= Math.min(2, cueTokens.length)) {
        score += 48;
        cueHits += 1;
      }
    }

    // 4. Exported symbol matches (including CamelCase split matches)
    for (const sym of file.symbols) {
      const cleanSym = sym.replace(/^[.#]/, '').toLowerCase();
      if (cleanSym.length >= 3 && promptLower.includes(cleanSym)) {
        score += 85;
        if (reasons.length < 4) reasons.push(`symbol ${sym}`);
        continue;
      }
      const symTokens = splitIdentifierTokens(sym);
      const overlap = symTokens.filter((t) => queryTokens.includes(t));
      if (overlap.length > 0) {
        score += overlap.length * 28;
      }
    }

    // 5. Path token overlap (e.g., components/checkout/CartSummary.tsx <-> "checkout cart")
    const pathTokens = splitIdentifierTokens(file.path.replace(/\.[^.]+$/, ''));
    let pathTokenHits = 0;
    for (const pt of pathTokens) {
      if (queryTokens.includes(pt)) {
        score += 44;
        pathTokenHits += 1;
      }
    }
    if (pathTokenHits > 0 && reasons.length < 4) {
      reasons.push('path tokens match');
    }

    // 6. FULL-FILE content token coverage & frequency bonus (no 40KB truncation!)
    let matchedTokenCount = 0;
    let totalOccurrences = 0;
    for (const tok of queryTokens) {
      const firstIdx = contentLower.indexOf(tok);
      if (firstIdx !== -1) {
        matchedTokenCount += 1;
        // Count up to 6 occurrences cleanly for density boost without regex allocation spikes
        let count = 1;
        let searchFrom = firstIdx + tok.length;
        while (count < 6) {
          const nextIdx = contentLower.indexOf(tok, searchFrom);
          if (nextIdx === -1) break;
          count += 1;
          searchFrom = nextIdx + tok.length;
        }
        totalOccurrences += count;
      }
    }
    if (matchedTokenCount > 0) {
      score += matchedTokenCount * 22 + Math.min(totalOccurrences, 20) * 3;
      if (cueHits === 0 && reasons.length < 4) {
        reasons.push(`${matchedTokenCount} keyword(s) in code`);
      }
    }

    // 7. Intent <-> File Role Alignment
    if (domains.wantsStyle && profile.role === 'style') {
      score += 42;
      reasons.push('stylesheet role');
    }
    if ((domains.wantsStyle || domains.wantsUiMarkup) && profile.role === 'ui-component') {
      score += 24;
    }
    if (domains.wantsLogicState && (profile.role === 'api-service' || profile.role === 'utility' || profile.role === 'state-store')) {
      score += 34;
      reasons.push(`${profile.role} role`);
    }
    if (domains.wantsHtmlHead && profile.role === 'html-entry') {
      score += 65;
      reasons.push('HTML entry');
    }
    if (domains.wantsRouting && profile.role === 'routing') {
      score += 45;
      reasons.push('routing role');
    }

    // Slight tie-breaker boost for core app entrypoints & penalty for docs/config unless relevant
    if (/^(?:index\.html|src\/app\.tsx?|app\.tsx?|src\/main\.tsx?|app\.js|styles\.css|index\.css)$/i.test(pathLower)) {
      score += 14;
    }
    if ((profile.role === 'doc' || profile.role === 'config') && !promptLower.includes(nameLower)) {
      score = Math.max(0, score - 18);
    }

    return { file, profile, score, reasons };
  });

  // 8. Bidirectional dependency propagation:
  // If file A matches strongly, boost files directly imported by A AND parent caller files that import A.
  const scoreMap = new Map<string, number>(baseScored.map((item) => [item.file.path, item.score]));
  const reasonMap = new Map<string, string[]>(baseScored.map((item) => [item.file.path, [...item.reasons]]));

  for (const item of baseScored) {
    if (item.score < 55) continue;
    const directImports = resolvedImports.get(item.file.path) || [];
    for (const resolvedPath of directImports) {
      const current = scoreMap.get(resolvedPath) || 0;
      const boost = Math.round(item.score * 0.24);
      scoreMap.set(resolvedPath, current + boost);
      const r = reasonMap.get(resolvedPath) || [];
      if (r.length < 4 && !r.some((x) => x.startsWith('imported by'))) {
        r.push(`imported by ${item.file.name}`);
        reasonMap.set(resolvedPath, r);
      }
    }

    const callers = importedBy.get(item.file.path) || [];
    for (const callerPath of callers) {
      const current = scoreMap.get(callerPath) || 0;
      const boost = Math.round(item.score * 0.2);
      scoreMap.set(callerPath, current + boost);
      const r = reasonMap.get(callerPath) || [];
      if (r.length < 4 && !r.some((x) => x.startsWith('imports '))) {
        r.push(`imports ${item.file.name}`);
        reasonMap.set(callerPath, r);
      }
    }
  }

  return baseScored
    .map((item) => ({
      file: item.file,
      profile: item.profile,
      score: scoreMap.get(item.file.path) || item.score,
      reasons: reasonMap.get(item.file.path) || item.reasons
    }))
    .sort((a, b) => b.score - a.score);
}

/**
 * Formats a concise architectural Responsibility Map covering all uploaded files so any LLM call
 * immediately sees each file's role, exports, imports, importedBy callers, and visible UI cues/selectors.
 */
export function buildResponsibilityMapText(files: CodebaseFile[], maxDetailed = 180): string {
  const { importedBy } = buildBidirectionalDependencyGraph(files);
  const rankedByImportance = [...files].slice(0, maxDetailed);
  const lines = rankedByImportance.map((f) => {
    const profile = analyzeFileResponsibility(f, importedBy);
    const parts: string[] = [`- ${f.path} [${profile.role}, ${f.lines}L]`];
    if (profile.exports.length > 0) {
      parts.push(`exports: ${profile.exports.slice(0, 8).join(', ')}`);
    }
    if (profile.uiCues.length > 0) {
      parts.push(`ui/cues: ${profile.uiCues.slice(0, 6).map((c) => `"${c}"`).join(', ')}`);
    }
    if (profile.imports.length > 0) {
      parts.push(`imports: ${profile.imports.slice(0, 6).join(', ')}`);
    }
    if (profile.importedBy.length > 0) {
      parts.push(`importedBy: ${profile.importedBy.slice(0, 6).join(', ')}`);
    }
    return parts.join(' | ');
  });

  if (files.length > maxDetailed) {
    lines.push(`...and ${files.length - maxDetailed} additional files (${files.slice(maxDetailed, maxDetailed + 35).map((f) => f.path).join(', ')})`);
  }

  return lines.join('\n');
}

function scoreFileRelevance(file: CodebaseFile, queryTokens: string[], promptLower: string): number {
  const promptText = promptLower || queryTokens.join(' ');
  const profile = analyzeFileResponsibility(file);
  const domains = detectPromptIntentDomains(promptText);
  const pathLower = file.path.toLowerCase();
  const nameLower = file.name.toLowerCase();
  const contentLower = file.content.toLowerCase();
  let score = 0;

  if (promptText.includes(pathLower)) score += 220;
  else if (promptText.includes(nameLower)) score += 160;

  for (const cue of profile.uiCues) {
    const cleanCue = cue.replace(/^[.#]/, '').toLowerCase();
    if (cleanCue.length >= 3 && promptText.includes(cleanCue)) {
      score += 75;
    }
  }

  for (const sym of file.symbols) {
    const cleanSym = sym.replace(/^[.#]/, '').toLowerCase();
    if (cleanSym.length >= 3 && promptText.includes(cleanSym)) {
      score += 65;
    }
  }

  if (domains.wantsStyle && profile.role === 'style') score += 38;
  if (domains.wantsLogicState && (profile.role === 'api-service' || profile.role === 'utility' || profile.role === 'state-store')) score += 30;
  if (domains.wantsHtmlHead && profile.role === 'html-entry') score += 50;

  if (/^(?:index\.html|package\.json|src\/app\.tsx?|app\.tsx?|src\/main\.tsx?|app\.js|styles\.css|index\.css)$/i.test(pathLower)) {
    score += 24;
  }

  for (const tok of queryTokens) {
    if (pathLower.includes(tok)) score += 32;
    if (contentLower.includes(tok)) score += 16;
  }

  return score;
}

function extractRelevantExcerpt(file: CodebaseFile, queryTokens: string[], maxFileChars: number): string {
  if (file.content.length <= maxFileChars) {
    return file.content;
  }

  const lines = file.content.split(/\r?\n/);
  const headBudget = Math.floor(maxFileChars * 0.4);
  const matchBudget = maxFileChars - headBudget;

  const headLines: string[] = [];
  let headLen = 0;
  for (let i = 0; i < lines.length; i++) {
    const next = `${i + 1}: ${lines[i]}\n`;
    if (headLen + next.length > headBudget) break;
    headLines.push(next);
    headLen += next.length;
  }

  const matchedWindows: string[] = [];
  let matchLen = 0;
  const startAfter = headLines.length;
  const usedLineIndices = new Set<number>();

  if (queryTokens.length > 0 && startAfter < lines.length) {
    // Score lines so the highest-density sections win instead of just the earliest line
    const scoredHits: Array<{ lineIdx: number; hitScore: number }> = [];
    for (let i = startAfter; i < lines.length; i++) {
      const lowerLine = lines[i].toLowerCase();
      let hitScore = 0;
      for (const t of queryTokens) {
        if (lowerLine.includes(t)) hitScore += t.length >= 5 ? 3 : 2;
      }
      if (hitScore > 0) scoredHits.push({ lineIdx: i, hitScore });
    }
    scoredHits.sort((a, b) => b.hitScore - a.hitScore || a.lineIdx - b.lineIdx);

    const selectedWindows: Array<{ from: number; to: number }> = [];
    for (const hit of scoredHits) {
      if (matchLen >= matchBudget) break;
      if (usedLineIndices.has(hit.lineIdx)) continue;
      const from = Math.max(startAfter, hit.lineIdx - 14);
      const to = Math.min(lines.length - 1, hit.lineIdx + 26);
      let estLen = 60;
      for (let j = from; j <= to; j++) {
        if (!usedLineIndices.has(j)) estLen += lines[j].length + 8;
      }
      if (matchLen + estLen > matchBudget) continue;
      for (let j = from; j <= to; j++) usedLineIndices.add(j);
      selectedWindows.push({ from, to });
      matchLen += estLen;
    }

    selectedWindows.sort((a, b) => a.from - b.from);
    for (const w of selectedWindows) {
      let chunk = `\n// --- Lines ${w.from + 1}-${w.to + 1} (matched context) ---\n`;
      for (let j = w.from; j <= w.to; j++) {
        chunk += `${j + 1}: ${lines[j]}\n`;
      }
      matchedWindows.push(chunk);
    }
  }

  if (matchedWindows.length === 0 && startAfter < lines.length) {
    const tailLines: string[] = [];
    let tailLen = 0;
    for (let i = lines.length - 1; i >= startAfter; i--) {
      const lineStr = `${i + 1}: ${lines[i]}\n`;
      if (tailLen + lineStr.length > matchBudget) break;
      tailLines.unshift(lineStr);
      tailLen += lineStr.length;
    }
    if (tailLines.length > 0) {
      matchedWindows.push(`\n// --- End of ${file.path} ---\n${tailLines.join('')}`);
    }
  }

  return `${headLines.join('')}${matchedWindows.join('')}`.trim();
}

/**
 * Builds a structured, token-budgeted codebase context string containing:
 * 1) Complete File Tree & Responsibility Map for ALL uploaded files (so nothing is invisible)
 * 2) Ranked relevant code files / excerpts fitting within charBudget.
 */
export function buildCodebaseContextForPrompt(
  files: CodebaseFile[],
  prompt: string,
  charBudget = 240000
): CodebaseContextResult {
  const stats = getCodebaseStats(files);
  if (files.length === 0) {
    return {
      contextText: '',
      includedFiles: [],
      totalFiles: 0,
      totalLines: 0,
      totalChars: 0,
      includedChars: 0,
      omittedFiles: []
    };
  }

  const queryTokens = buildSearchQueryTokens(prompt);
  const manifestText = buildResponsibilityMapText(files, 140);
  const manifestHeader = `[UPLOADED CODEBASE WORKSPACE: ${stats.totalFiles} file(s), ${stats.totalLines.toLocaleString()} total lines, ${stats.totalChars.toLocaleString()} total characters]\n[PROJECT FILE TREE & RESPONSIBILITY MAP]:\n${manifestText}\n`;

  const remainingBudget = Math.max(4000, charBudget - manifestHeader.length);

  const rankedItems = rankResponsibleFiles(files, prompt);
  const ranked = rankedItems.map((r) => r.file);

  if (stats.totalChars <= remainingBudget) {
    const fullBlocks = ranked.map(
      (f) => `\n=== FILE: ${f.path} (${f.lines} lines) ===\n\`\`\`${f.ext || 'txt'}\n${f.content}\n\`\`\``
    );
    const contextText = `${manifestHeader}\n[FULL CODEBASE CONTENTS]:${fullBlocks.join('\n')}`;
    return {
      contextText,
      includedFiles: ranked.map((f) => f.path),
      totalFiles: stats.totalFiles,
      totalLines: stats.totalLines,
      totalChars: stats.totalChars,
      includedChars: contextText.length,
      omittedFiles: []
    };
  }

  const includedFiles: string[] = [];
  const omittedFiles: string[] = [];
  const codeBlocks: string[] = [];
  let usedChars = 0;
  const maxPerFile = Math.max(4500, Math.floor(remainingBudget * 0.45));

  for (const file of ranked) {
    const budgetLeft = remainingBudget - usedChars;
    if (budgetLeft < 700) {
      omittedFiles.push(file.path);
      continue;
    }

    const allowance = Math.min(maxPerFile, budgetLeft - 120);
    const excerpt = extractRelevantExcerpt(file, queryTokens, allowance);
    const wasExcerpted = excerpt.length < file.content.length;
    const block = `\n=== FILE: ${file.path} (${file.lines} lines${wasExcerpted ? ', targeted excerpt' : ''}) ===\n\`\`\`${file.ext || 'txt'}\n${excerpt}\n\`\`\``;

    if (usedChars + block.length <= remainingBudget) {
      codeBlocks.push(block);
      includedFiles.push(file.path);
      usedChars += block.length;
    } else {
      omittedFiles.push(file.path);
    }
  }

  const contextText = `${manifestHeader}\n[RELEVANT CODEBASE FILES & TARGETED EXCERPTS]:${codeBlocks.join('\n')}${
    omittedFiles.length > 0
      ? `\n\n[ADDITIONAL INDEXED FILES (${omittedFiles.length})]: ${omittedFiles.join(', ')}`
      : ''
  }`;

  return {
    contextText,
    includedFiles,
    totalFiles: stats.totalFiles,
    totalLines: stats.totalLines,
    totalChars: stats.totalChars,
    includedChars: contextText.length,
    omittedFiles
  };
}

export function extractRawWindowsForPatch(
  file: CodebaseFile,
  queryTokens: string[],
  maxFileChars: number,
  promptLower = ''
): string {
  if (file.content.length <= maxFileChars) {
    return file.content;
  }

  const lines = file.content.split(/\r?\n/);
  const headBudget = Math.floor(maxFileChars * 0.25);
  const tailBudget = Math.floor(maxFileChars * 0.15);
  const matchBudget = maxFileChars - headBudget - tailBudget;

  const ranges: Array<{ start: number; end: number }> = [];

  // 1. Head range (imports, constants, types)
  let headChars = 0;
  let headEnd = 0;
  for (let i = 0; i < lines.length; i++) {
    if (headChars + lines[i].length + 1 > headBudget) break;
    headChars += lines[i].length + 1;
    headEnd = i;
  }
  if (headEnd > 0) ranges.push({ start: 0, end: headEnd });

  // 2. Tail boundary computation (exports, render return, listeners at bottom of file)
  let tailChars = 0;
  let tailStart = lines.length - 1;
  for (let i = lines.length - 1; i > headEnd; i--) {
    if (tailChars + lines[i].length + 1 > tailBudget) break;
    tailChars += lines[i].length + 1;
    tailStart = i;
  }

  // 3. Rank highest-density matching sections across the whole middle body
  const quotedPhrases = Array.from(promptLower.matchAll(/["'`]([^"'`]{2,48})["'`]/g)).map((m) => m[1].trim());
  const scoredLines: Array<{ idx: number; score: number }> = [];
  for (let i = headEnd + 1; i < lines.length; i++) {
    const lower = lines[i].toLowerCase();
    let lineScore = 0;
    for (const p of quotedPhrases) {
      if (lower.includes(p)) lineScore += 15;
    }
    for (const t of queryTokens) {
      if (lower.includes(t)) lineScore += t.length >= 5 ? 4 : 2;
    }
    if (lineScore > 0) {
      scoredLines.push({ idx: i, score: lineScore });
    }
  }
  scoredLines.sort((a, b) => b.score - a.score || a.idx - b.idx);

  let matchChars = 0;
  const covered = new Set<number>();
  for (const hit of scoredLines) {
    if (matchChars >= matchBudget) break;
    if (covered.has(hit.idx)) continue;
    const from = Math.max(headEnd + 1, hit.idx - 24);
    const to = Math.min(lines.length - 1, hit.idx + 36);
    const chunkLen = lines.slice(from, to + 1).join('\n').length + 60;
    if (matchChars + chunkLen <= matchBudget) {
      ranges.push({ start: from, end: to });
      matchChars += chunkLen;
      for (let j = from; j <= to; j++) covered.add(j);
    }
  }

  // Include bottom section so component return / export default is visible
  if (tailStart < lines.length - 1 && tailStart > headEnd + 1) {
    ranges.push({ start: tailStart, end: lines.length - 1 });
  }

  // Sort & merge overlapping/adjacent ranges
  ranges.sort((a, b) => a.start - b.start);
  const merged: Array<{ start: number; end: number }> = [];
  for (const r of ranges) {
    const prev = merged[merged.length - 1];
    if (prev && r.start <= prev.end + 3) {
      prev.end = Math.max(prev.end, r.end);
    } else {
      merged.push({ ...r });
    }
  }

  return merged
    .map((r, idx) => {
      const body = lines.slice(r.start, r.end + 1).join('\n');
      return idx === 0
        ? body
        : `\n/* ... [omitted unchanged section: lines ${merged[idx - 1].end + 2}-${r.start}] ... */\n${body}`;
    })
    .join('\n');
}

/**
 * Builds raw verbatim codebase context prioritizing specifically identified responsible files:
 * ALWAYS loads 100% of the full, un-truncated contents of identified primary responsible files
 * (never omitting or slicing out middle sections), followed by linked caller/imported files.
 */
export function buildTargetedSurgicalContext(
  files: CodebaseFile[],
  preferredPaths: string[],
  prompt: string,
  charBudget = 240000
): CodebaseContextResult {
  const stats = getCodebaseStats(files);
  if (files.length === 0) {
    return {
      contextText: '',
      includedFiles: [],
      totalFiles: 0,
      totalLines: 0,
      totalChars: 0,
      includedChars: 0,
      omittedFiles: []
    };
  }

  const promptLower = prompt.toLowerCase();
  const queryTokens = buildSearchQueryTokens(prompt);
  const manifestText = buildResponsibilityMapText(files, 180);
  const manifestHeader = `[UPLOADED CODEBASE FILES: ${stats.totalFiles} file(s), ${stats.totalLines.toLocaleString()} total lines]\n[PROJECT RESPONSIBILITY MAP]:\n${manifestText}\n`;
  const remainingBudget = Math.max(8000, charBudget - manifestHeader.length);

  // Build bidirectional graph so immediate neighbors (imports + importedBy callers) follow right after primary files
  const { resolvedImports, importedBy } = buildBidirectionalDependencyGraph(files);
  const neighborPaths = new Set<string>();
  for (const p of preferredPaths) {
    for (const imp of resolvedImports.get(p) || []) neighborPaths.add(imp);
    for (const caller of importedBy.get(p) || []) neighborPaths.add(caller);
  }

  const preferredSet = new Set(preferredPaths);
  const ranked = rankResponsibleFiles(files, prompt).map((r) => r.file);
  const primaryFiles = preferredPaths
    .map((p) => files.find((f) => f.path === p))
    .filter((f): f is CodebaseFile => Boolean(f));
  const neighborFiles = ranked.filter((f) => !preferredSet.has(f.path) && neighborPaths.has(f.path));
  const otherFiles = ranked.filter((f) => !preferredSet.has(f.path) && !neighborPaths.has(f.path));
  const ordered: CodebaseFile[] = [...primaryFiles, ...neighborFiles, ...otherFiles];

  // If entire project fits cleanly inside remainingBudget, include everything verbatim
  if (stats.totalChars <= remainingBudget) {
    const fullBlocks = ordered.map((f) => {
      const tag = preferredSet.has(f.path)
        ? ' [PRIMARY RESPONSIBLE FILE - FULL UNTRUNCATED]'
        : neighborPaths.has(f.path)
        ? ' [LINKED DEPENDENCY/CALLER]'
        : '';
      return `\n=== FILE: ${f.path}${tag} ===\n\`\`\`${f.ext || 'txt'}\n${f.content}\n\`\`\``;
    });
    const contextText = `${manifestHeader}\n${fullBlocks.join('\n')}`;
    return {
      contextText,
      includedFiles: ordered.map((f) => f.path),
      totalFiles: stats.totalFiles,
      totalLines: stats.totalLines,
      totalChars: stats.totalChars,
      includedChars: contextText.length,
      omittedFiles: []
    };
  }

  const includedFiles: string[] = [];
  const omittedFiles: string[] = [];
  const codeBlocks: string[] = [];
  let usedChars = 0;

  // 1. ALWAYS load 100% of full, un-truncated contents for every primary responsible file
  for (const file of primaryFiles) {
    const block = `\n=== FILE: ${file.path} [PRIMARY RESPONSIBLE FILE - FULL UNTRUNCATED (${file.lines} lines)] ===\n\`\`\`${file.ext || 'txt'}\n${file.content}\n\`\`\``;
    codeBlocks.push(block);
    includedFiles.push(file.path);
    usedChars += block.length;
  }

  // 2. Load linked dependencies/callers and remaining ranked files within the remaining budget
  for (const file of [...neighborFiles, ...otherFiles]) {
    const budgetLeft = remainingBudget - usedChars;
    if (budgetLeft < 900) {
      omittedFiles.push(file.path);
      continue;
    }

    const isNeighbor = neighborPaths.has(file.path);
    const roleTag = isNeighbor ? ' [LINKED DEPENDENCY/CALLER]' : '';
    const allowance = Math.min(file.content.length, Math.max(4000, Math.floor(budgetLeft * (isNeighbor ? 0.65 : 0.35))));

    const rawSlice =
      file.content.length <= allowance
        ? file.content
        : extractRawWindowsForPatch(file, queryTokens, allowance, promptLower);
    const sliceTag = rawSlice.length < file.content.length ? ' (verbatim sections)' : '';
    const block = `\n=== FILE: ${file.path}${roleTag}${sliceTag} ===\n\`\`\`${file.ext || 'txt'}\n${rawSlice}\n\`\`\``;

    if (usedChars + block.length <= remainingBudget) {
      codeBlocks.push(block);
      includedFiles.push(file.path);
      usedChars += block.length;
    } else {
      omittedFiles.push(file.path);
    }
  }

  const contextText = `${manifestHeader}\n${codeBlocks.join('\n')}${
    omittedFiles.length > 0 ? `\n\n[OTHER UNCHANGED FILES (${omittedFiles.length})]: ${omittedFiles.join(', ')}` : ''
  }`;

  return {
    contextText,
    includedFiles,
    totalFiles: stats.totalFiles,
    totalLines: stats.totalLines,
    totalChars: stats.totalChars,
    includedChars: contextText.length,
    omittedFiles
  };
}

/**
 * Builds raw verbatim codebase context (without line-number prefixes) specifically for surgical edits,
 * so the AI can emit exact verbatim patches that modify the user's files in place.
 */
export function buildRawSurgicalContextForPrompt(
  files: CodebaseFile[],
  prompt: string,
  charBudget = 240000
): CodebaseContextResult {
  const topCandidates = rankResponsibleFiles(files, prompt)
    .slice(0, Math.min(3, files.length))
    .filter((r) => r.score > 0)
    .map((r) => r.file.path);
  return buildTargetedSurgicalContext(files, topCandidates, prompt, charBudget);
}

export async function exportVaultAsZip(files: CodebaseFile[], archiveName = 'studiox-codebase'): Promise<void> {
  const zip = new JSZip();
  for (const file of files) {
    zip.file(file.path, file.content);
  }
  const blob = await zip.generateAsync({ type: 'blob' });
  const safeName = (archiveName.replace(/[^a-z0-9_-]+/gi, '-').replace(/^-|-$/g, '') || 'studiox-codebase') + '.zip';
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = safeName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Splits a huge codebase into bounded reading chunks for silent multi-pass deep inspection
 * when total codebase size exceeds single-call limits.
 */
export function partitionCodebaseForDeepRead(
  files: CodebaseFile[],
  chunkCharLimit = 28000
): Array<{ files: CodebaseFile[]; content: string }> {
  const chunks: Array<{ files: CodebaseFile[]; content: string }> = [];
  let currentFiles: CodebaseFile[] = [];
  let currentText = '';

  const flush = () => {
    if (currentFiles.length > 0) {
      chunks.push({ files: currentFiles, content: currentText });
      currentFiles = [];
      currentText = '';
    }
  };

  for (const file of files) {
    if (file.content.length > chunkCharLimit) {
      flush();
      // Split huge single file into clean line slices
      const lines = file.content.split(/\r?\n/);
      let sliceText = '';
      let startLine = 1;
      for (let i = 0; i < lines.length; i++) {
        const lineWithNum = `${i + 1}: ${lines[i]}\n`;
        if (sliceText.length + lineWithNum.length > chunkCharLimit && sliceText.length > 0) {
          chunks.push({
            files: [file],
            content: `=== FILE: ${file.path} (lines ${startLine}-${i}) ===\n\`\`\`${file.ext || 'txt'}\n${sliceText}\n\`\`\``
          });
          sliceText = '';
          startLine = i + 1;
        }
        sliceText += lineWithNum;
      }
      if (sliceText.trim()) {
        chunks.push({
          files: [file],
          content: `=== FILE: ${file.path} (lines ${startLine}-${lines.length}) ===\n\`\`\`${file.ext || 'txt'}\n${sliceText}\n\`\`\``
        });
      }
      continue;
    }

    const block = `=== FILE: ${file.path} (${file.lines} lines) ===\n\`\`\`${file.ext || 'txt'}\n${file.content}\n\`\`\`\n\n`;
    if (currentText.length + block.length > chunkCharLimit && currentFiles.length > 0) {
      flush();
    }
    currentFiles.push(file);
    currentText += block;
  }

  flush();
  return chunks;
}

// IndexedDB Persistence so 100k–10M+ characters persist across reloads without QuotaExceededError
function openVaultDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'scope' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveCodebaseToVault(scope: 'builder' | 'chat', files: CodebaseFile[]): Promise<void> {
  try {
    const db = await openVaultDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put({ scope, files, updatedAt: Date.now() });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch (err) {
    console.warn('Could not persist codebase vault to IndexedDB:', err);
  }
}

export async function loadCodebaseFromVault(scope: 'builder' | 'chat'): Promise<CodebaseFile[]> {
  try {
    const db = await openVaultDB();
    const result = await new Promise<CodebaseFile[]>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(scope);
      req.onsuccess = () => {
        const record = req.result as { files?: CodebaseFile[] } | undefined;
        resolve(Array.isArray(record?.files) ? record.files : []);
      };
      req.onerror = () => resolve([]);
    });
    db.close();
    return result;
  } catch {
    return [];
  }
}

export async function clearCodebaseFromVault(scope: 'builder' | 'chat'): Promise<void> {
  try {
    const db = await openVaultDB();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(scope);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
    db.close();
  } catch {}
}
