import { transform } from 'sucrase';
import { CodeState } from '../types';
import { CodebaseFile, createCodebaseFile } from './codebaseVault';

export interface CompiledCodebaseResult {
  code: CodeState;
  projectType: 'web' | 'react-ts' | 'script' | 'text';
  entryFile: string;
  includedFiles: string[];
  title: string;
}

export interface VaultPatchResult {
  updatedFiles: CodebaseFile[];
  patchedPaths: string[];
  addedPaths: string[];
  unmatchedBlocks: number;
  appliedBlocksCount?: number;
  analysis?: string;
  unmatchedDetails?: Array<{ fileHint?: string; searchSnippet: string }>;
}

export interface VaultCompilationError {
  filePath: string;
  message: string;
  line?: number;
  column?: number;
  kind: 'ts-js' | 'css' | 'html' | 'json';
}

export interface VaultVerificationResult {
  valid: boolean;
  checkedFiles: number;
  errors: VaultCompilationError[];
}

function escapeHtmlText(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function safeJsonForHtmlScript(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

function resolveRelativeFile(
  filesByPath: Map<string, CodebaseFile>,
  allFiles: CodebaseFile[],
  fromFilePath: string,
  specifier: string
): CodebaseFile | null {
  const cleanSpec = specifier.split('?')[0].split('#')[0].replace(/\\/g, '/').trim();
  if (!cleanSpec || /^(?:https?:|data:|blob:|\/\/)/i.test(cleanSpec)) return null;

  const baseDir = fromFilePath.includes('/')
    ? fromFilePath.slice(0, fromFilePath.lastIndexOf('/'))
    : '';

  const candidates: string[] = [];
  if (cleanSpec.startsWith('/')) {
    const stripped = cleanSpec.replace(/^\/+/, '');
    candidates.push(stripped);
    if (baseDir) {
      const topFolder = baseDir.split('/')[0];
      if (topFolder) candidates.push(`${topFolder}/${stripped}`);
    }
  } else {
    const parts = baseDir ? baseDir.split('/') : [];
    for (const seg of cleanSpec.split('/')) {
      if (!seg || seg === '.') continue;
      if (seg === '..') {
        if (parts.length > 0) parts.pop();
      } else {
        parts.push(seg);
      }
    }
    candidates.push(parts.join('/'));
    candidates.push(cleanSpec.replace(/^\.\//, ''));
  }

  for (const cand of candidates) {
    const exact =
      filesByPath.get(cand) || allFiles.find((f) => f.path.toLowerCase() === cand.toLowerCase());
    if (exact) return exact;
  }

  // Fallback suffix match
  const strippedSuffix = cleanSpec.replace(/^(?:\.\.?\/)+/, '').replace(/^\/+/, '').toLowerCase();
  if (strippedSuffix) {
    return (
      allFiles.find((f) => f.path.toLowerCase() === strippedSuffix) ||
      allFiles.find((f) => f.path.toLowerCase().endsWith(`/${strippedSuffix}`)) ||
      null
    );
  }
  return null;
}

function pickBestHtmlEntry(htmlFiles: CodebaseFile[]): CodebaseFile | null {
  if (htmlFiles.length === 0) return null;
  const sorted = [...htmlFiles].sort((a, b) => {
    const aIsIndex = /(?:^|\/)index\.html?$/i.test(a.path) ? 0 : 1;
    const bIsIndex = /(?:^|\/)index\.html?$/i.test(b.path) ? 0 : 1;
    if (aIsIndex !== bIsIndex) return aIsIndex - bIsIndex;
    const aDepth = a.path.split('/').length;
    const bDepth = b.path.split('/').length;
    return aDepth - bDepth;
  });
  return sorted[0];
}

function isConfigOrIgnoredBuildFile(path: string): boolean {
  const lower = path.toLowerCase();
  return (
    /\.d\.ts$/i.test(lower) ||
    /(?:^|\/)(?:vite|vitest|tailwind|postcss|eslint|prettier|jest)\.config\.[jt]s$/i.test(lower) ||
    /(?:^|\/)server\.[jt]s$/i.test(lower) ||
    lower.startsWith('public/assets/')
  );
}

function stripCssTailwindDirectives(cssText: string): string {
  return cssText
    .replace(/@import\s+["']tailwindcss(?:\/[^"']*)?["']\s*;?/gi, '')
    .replace(/@tailwind\s+(?:base|components|utilities|variants)\s*;?/gi, '')
    .trim();
}

function neutralizeImportMeta(source: string): string {
  return source
    .replace(/\bimport\.meta\.env\b/g, '({MODE:"production",PROD:true,DEV:false,SSR:false})')
    .replace(/\bimport\.meta\.url\b/g, 'location.href')
    .replace(/\bimport\.meta\b/g, '({url:location.href,env:{MODE:"production",PROD:true,DEV:false}})');
}

interface CompiledVfsEntry {
  kind: 'js' | 'json' | 'svg' | 'error';
  code: string;
}

function compileModuleMap(moduleFiles: CodebaseFile[]): Record<string, CompiledVfsEntry> {
  const vfs: Record<string, CompiledVfsEntry> = {};

  for (const f of moduleFiles) {
    const lower = f.path.toLowerCase();
    if (lower.endsWith('.json')) {
      vfs[f.path] = { kind: 'json', code: f.content };
      continue;
    }
    if (lower.endsWith('.svg')) {
      vfs[f.path] = { kind: 'svg', code: f.content };
      continue;
    }

    const cleanSource = neutralizeImportMeta(f.content);
    const isPlainTs = /\.ts$/i.test(lower) && !/\.tsx$/i.test(lower);
    try {
      const result = transform(cleanSource, {
        transforms: isPlainTs ? ['typescript', 'imports'] : ['typescript', 'jsx', 'imports'],
        jsxRuntime: 'classic',
        production: true,
        disableESTransforms: true,
        filePath: f.path
      });
      vfs[f.path] = { kind: 'js', code: result.code };
    } catch (err: any) {
      vfs[f.path] = {
        kind: 'error',
        code: `Compilation error in ${f.path}: ${err?.message || String(err)}`
      };
    }
  }

  return vfs;
}

function detectRootPrefixAndEntry(params: {
  allFiles: CodebaseFile[];
  moduleFiles: CodebaseFile[];
  htmlEntry: CodebaseFile | null;
}): { rootPrefix: string; entryPath: string } {
  const { allFiles, moduleFiles, htmlEntry } = params;
  const moduleSet = new Set(moduleFiles.map((f) => f.path));

  // 1. Compute rootPrefix from shallowest package.json / htmlEntry / src/
  let rootPrefix = '';
  const pkgJson = [...allFiles]
    .filter((f) => /(?:^|\/)package\.json$/i.test(f.path))
    .sort((a, b) => a.path.split('/').length - b.path.split('/').length)[0];

  const anchorPath = pkgJson?.path || htmlEntry?.path || '';
  if (anchorPath && anchorPath.includes('/')) {
    rootPrefix = anchorPath.slice(0, anchorPath.lastIndexOf('/') + 1);
  } else if (!anchorPath) {
    // Detect common top-level wrapper folder (e.g. "my-app/src/App.tsx" or "my-app/App.tsx")
    const srcHolder = [...moduleFiles]
      .filter((f) => /(?:^|\/)src\/(?:main|index|App)\.[jt]sx?$/i.test(f.path))
      .sort((a, b) => a.path.split('/').length - b.path.split('/').length)[0];
    if (srcHolder) {
      const idx = srcHolder.path.toLowerCase().indexOf('src/');
      if (idx > 0) rootPrefix = srcHolder.path.slice(0, idx);
    } else {
      const topFolders = new Set(moduleFiles.map((f) => (f.path.includes('/') ? f.path.split('/')[0] : '')));
      if (topFolders.size === 1) {
        const only = Array.from(topFolders)[0];
        if (only && only.toLowerCase() !== 'src') rootPrefix = `${only}/`;
      }
    }
  }

  // 2. If htmlEntry explicitly specifies a local module script, trust it first!
  if (htmlEntry) {
    const scriptTags = [...htmlEntry.content.matchAll(/<script\b([^>]*)>/gi)];
    for (const tag of scriptTags) {
      const src = tag[1].match(/\bsrc=["']([^"']+)["']/i)?.[1];
      if (!src || /^(?:https?:|data:|blob:|\/\/)/i.test(src)) continue;
      const resolved = resolveRelativeFile(
        new Map(moduleFiles.map((f) => [f.path, f])),
        moduleFiles,
        htmlEntry.path,
        src
      );
      if (resolved && moduleSet.has(resolved.path)) {
        return { rootPrefix, entryPath: resolved.path };
      }
    }
  }

  // 3. Canonical entry priority list relative to rootPrefix
  const preferredExact = [
    `${rootPrefix}src/main.tsx`,
    `${rootPrefix}src/main.jsx`,
    `${rootPrefix}src/index.tsx`,
    `${rootPrefix}src/index.jsx`,
    `${rootPrefix}main.tsx`,
    `${rootPrefix}main.jsx`,
    `${rootPrefix}index.tsx`,
    `${rootPrefix}index.jsx`,
    `${rootPrefix}src/App.tsx`,
    `${rootPrefix}src/App.jsx`,
    `${rootPrefix}App.tsx`,
    `${rootPrefix}App.jsx`,
    `${rootPrefix}src/main.ts`,
    `${rootPrefix}src/main.js`,
    `${rootPrefix}main.ts`,
    `${rootPrefix}main.js`
  ];

  for (const cand of preferredExact) {
    const match = moduleFiles.find((f) => f.path.toLowerCase() === cand.toLowerCase());
    if (match) return { rootPrefix, entryPath: match.path };
  }

  // 4. Depth-sorted fallback among TSX/JSX/entry JS files (shallowest wins; avoid components/* unless nothing else exists)
  const rankedModules = [...moduleFiles].sort((a, b) => {
    const score = (p: string) => {
      const lower = p.toLowerCase();
      let s = p.split('/').length * 20;
      if (/(?:^|\/)(?:main|index)\.[jt]sx?$/i.test(lower)) s -= 15;
      if (/(?:^|\/)app\.[jt]sx?$/i.test(lower)) s -= 12;
      if (/\.(?:tsx|jsx)$/i.test(lower)) s -= 8;
      if (/(?:^|\/)(?:components|types|utils|services|hooks|styles)\//i.test(lower)) s += 35;
      return s;
    };
    return score(a.path) - score(b.path);
  });

  return {
    rootPrefix,
    entryPath: rankedModules[0]?.path || ''
  };
}

function extractBodyAttrsAndMarkup(rawHtml: string): {
  bodyClass: string;
  bodyStyle: string;
  markup: string;
  extraHeadTags: string;
} {
  const linkMatches =
    rawHtml
      .match(/<link[^>]+href=["']https?:\/\/[^"']+["'][^>]*>/gi)
      ?.filter((t) => !/cdn\.tailwindcss\.com/i.test(t)) || [];
  const extScriptMatches =
    rawHtml
      .match(/<script[^>]+src=["']https?:\/\/[^"']+["'][^>]*>\s*<\/script>/gi)
      ?.filter((t) => !/cdn\.tailwindcss\.com|unpkg\.com\/react/i.test(t)) || [];

  const bodyOpenMatch = rawHtml.match(/<body([^>]*)>/i);
  const bodyAttrs = bodyOpenMatch?.[1] || '';
  const bodyClass = bodyAttrs.match(/\bclass=["']([^"']*)["']/i)?.[1] || '';
  const bodyStyle = bodyAttrs.match(/\bstyle=["']([^"']*)["']/i)?.[1] || '';

  const bodyMatch = rawHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  let markup = '<div id="root"></div>';
  if (bodyMatch) {
    const cleanedBody = bodyMatch[1]
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
      .trim();
    if (cleanedBody) {
      markup = /\bid=["'](?:root|app)["']/i.test(cleanedBody)
        ? cleanedBody
        : `<div id="root"></div>\n${cleanedBody}`;
    }
  }

  return {
    bodyClass,
    bodyStyle,
    markup,
    extraHeadTags: [...linkMatches, ...extScriptMatches].join('\n  ')
  };
}

function buildModuleRuntimeScript(params: {
  vfs: Record<string, CompiledVfsEntry>;
  rootPrefix: string;
  entryPath: string;
  includeReactRuntime: boolean;
}): string {
  const { vfs, rootPrefix, entryPath, includeReactRuntime } = params;
  const serializedVfs = safeJsonForHtmlScript(vfs);

  return `<script id="studiox-vfs" type="application/json">${serializedVfs}</script>
  <script>
    (function() {
      var vfsEl = document.getElementById('studiox-vfs');
      var rawVfs = {};
      try {
        rawVfs = JSON.parse((vfsEl && vfsEl.textContent) || '{}');
      } catch (parseErr) {
        document.body.innerHTML = '<div style="padding:20px;margin:16px;border-radius:12px;background:#1e293b;border:1px solid #ef4444;color:#fecaca;font-family:monospace;">Failed to parse bundled module archive: ' + String(parseErr) + '</div>';
        return;
      }

      // Polyfill Node/Vite globals expected by uploaded React & TS projects
      window.process = window.process || { env: { NODE_ENV: 'production' } };
      if (!window.process.env) window.process.env = { NODE_ENV: 'production' };
      window.global = window.global || window;
      var process = window.process;

      var paths = Object.keys(rawVfs);
      var pathMap = {};
      paths.forEach(function(p) { pathMap[p.toLowerCase()] = p; });
      var cache = {};
      var rootPrefix = ${JSON.stringify(rootPrefix)};
      var entryPath = ${JSON.stringify(entryPath)};
      var includeReactRuntime = ${includeReactRuntime ? 'true' : 'false'};

      function escapeDiagHtml(str) {
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      }

      function showCompileError(titleText, err) {
        var errEl = document.getElementById('root') || document.getElementById('app') || document.body;
        var detail = err && err.stack ? err.stack : String(err || 'Unknown error');
        errEl.innerHTML = '<div style="padding:20px;margin:16px;border-radius:12px;background:#1e293b;border:1px solid #ef4444;color:#fecaca;font-family:ui-monospace,monospace;white-space:pre-wrap;line-height:1.5;">' +
          '<div style="font-weight:700;font-size:14px;margin-bottom:8px;color:#fca5a5;">' + escapeDiagHtml(titleText) + '</div>' +
          '<div style="font-size:12px;">' + escapeDiagHtml(detail) + '</div></div>';
      }

      window.addEventListener('error', function(ev) {
        var target = document.getElementById('root') || document.getElementById('app');
        if (target && (!target.children || target.children.length === 0)) {
          showCompileError('Runtime Error:', ev.error || ev.message || 'Unknown script error');
        }
      });

      function resolvePath(fromPath, spec) {
        if (!spec) return null;
        if (spec.indexOf('@/') === 0 || spec.indexOf('~/') === 0) {
          var sub = spec.slice(2);
          var aliasCandidates = [rootPrefix + 'src/' + sub, rootPrefix + sub, 'src/' + sub, sub];
          for (var a = 0; a < aliasCandidates.length; a++) {
            var hit = matchVfsFile(aliasCandidates[a]);
            if (hit) return hit;
          }
          return null;
        } else if (spec.indexOf('/') === 0) {
          spec = rootPrefix + spec.slice(1);
        } else if (spec.indexOf('./') === 0 || spec.indexOf('../') === 0) {
          var dir = fromPath.indexOf('/') !== -1 ? fromPath.slice(0, fromPath.lastIndexOf('/')) : '';
          var stack = dir ? dir.split('/') : [];
          spec.split('/').forEach(function(part) {
            if (!part || part === '.') return;
            if (part === '..') stack.pop();
            else stack.push(part);
          });
          spec = stack.join('/');
        } else {
          // Support TypeScript baseUrl non-relative imports (e.g. "components/Button" or "types")
          var baseCandidates = [rootPrefix + 'src/' + spec, rootPrefix + spec, 'src/' + spec, spec];
          for (var b = 0; b < baseCandidates.length; b++) {
            var baseHit = matchVfsFile(baseCandidates[b]);
            if (baseHit) return baseHit;
          }
          return null;
        }
        return matchVfsFile(spec);
      }

      function matchVfsFile(spec) {
        var stripped = spec.replace(/\\.(?:[jt]sx?|mjs|cjs)$/i, '');
        var tryNames = [
          spec,
          spec + '.tsx',
          spec + '.ts',
          spec + '.jsx',
          spec + '.js',
          spec + '.mjs',
          spec + '.cjs',
          spec + '.json',
          spec + '.svg',
          spec + '/index.tsx',
          spec + '/index.ts',
          spec + '/index.jsx',
          spec + '/index.js',
          stripped + '.tsx',
          stripped + '.ts',
          stripped + '.jsx',
          stripped + '.js'
        ];
        for (var i = 0; i < tryNames.length; i++) {
          var cand = tryNames[i];
          if (Object.prototype.hasOwnProperty.call(rawVfs, cand)) return cand;
          var lower = pathMap[cand.toLowerCase()];
          if (lower) return lower;
        }
        return null;
      }

      function joinClasses() {
        var out = [];
        for (var i = 0; i < arguments.length; i++) {
          var arg = arguments[i];
          if (!arg) continue;
          if (typeof arg === 'string' || typeof arg === 'number') {
            out.push(String(arg));
          } else if (Array.isArray(arg)) {
            var inner = joinClasses.apply(null, arg);
            if (inner) out.push(inner);
          } else if (typeof arg === 'object') {
            Object.keys(arg).forEach(function(k) {
              if (arg[k]) out.push(k);
            });
          }
        }
        return out.join(' ');
      }

      function toCamelAttr(key) {
        if (key === 'stroke-width') return 'strokeWidth';
        if (key === 'stroke-linecap') return 'strokeLinecap';
        if (key === 'stroke-linejoin') return 'strokeLinejoin';
        if (key === 'fill-rule') return 'fillRule';
        if (key === 'clip-rule') return 'clipRule';
        return key;
      }

      function createLucideProxy() {
        var React = window.React;
        return new Proxy({ __esModule: true }, {
          get: function(_target, prop) {
            if (prop === '__esModule') return true;
            if (prop === 'default') return createLucideProxy();
            if (typeof prop !== 'string') return undefined;
            return function LucideIcon(props) {
              props = props || {};
              var className = props.className || '';
              var size = props.size || 16;
              var lib = window.lucide && (window.lucide.icons || window.lucide);
              var iconNode = lib && (lib[prop] || lib[prop.replace(/Icon$/, '')]);
              if (Array.isArray(iconNode)) {
                var children = iconNode.map(function(child, idx) {
                  if (Array.isArray(child)) {
                    var normalizedAttrs = { key: idx };
                    var rawAttrs = child[1] || {};
                    Object.keys(rawAttrs).forEach(function(k) {
                      normalizedAttrs[toCamelAttr(k)] = rawAttrs[k];
                    });
                    return React.createElement(child[0], normalizedAttrs);
                  }
                  return null;
                }).filter(Boolean);
                return React.createElement('svg', {
                  xmlns: 'http://www.w3.org/2000/svg',
                  width: size,
                  height: size,
                  viewBox: '0 0 24 24',
                  fill: 'none',
                  stroke: 'currentColor',
                  strokeWidth: props.strokeWidth || 2,
                  strokeLinecap: 'round',
                  strokeLinejoin: 'round',
                  className: className
                }, children);
              }
              return React.createElement('svg', {
                xmlns: 'http://www.w3.org/2000/svg',
                width: size,
                height: size,
                viewBox: '0 0 24 24',
                fill: 'none',
                stroke: 'currentColor',
                strokeWidth: props.strokeWidth || 2,
                className: className
              }, React.createElement('circle', { cx: 12, cy: 12, r: 7 }));
            };
          }
        });
      }

      function makeMotionElement(tag) {
        return function MotionComponent(props) {
          if (!props) return null;
          var clean = {};
          var skip = {
            initial: 1, animate: 1, exit: 1, transition: 1, variants: 1,
            whileHover: 1, whileTap: 1, whileInView: 1, viewport: 1, layout: 1, layoutId: 1
          };
          Object.keys(props).forEach(function(k) {
            if (!skip[k]) clean[k] = props[k];
          });
          if (typeof tag === 'string' && /^[a-z]/.test(tag)) {
            return window.React.createElement(tag, clean, props.children);
          }
          return props.children ? window.React.createElement(window.React.Fragment, null, props.children) : null;
        };
      }

      var motionProxy = new Proxy(
        function(Comp) { return Comp; },
        {
          get: function(_t, prop) {
            if (prop === '__esModule') return true;
            if (prop === 'default') return motionProxy;
            if (prop === 'AnimatePresence' || prop === 'MotionConfig' || prop === 'LazyMotion') {
              return function Wrapper(props) { return props && props.children ? props.children : null; };
            }
            if (prop === 'motion') return motionProxy;
            if (typeof prop === 'string' && /^[a-z]/.test(prop)) return makeMotionElement(prop);
            return function() { return null; };
          }
        }
      );

      function makeComponentStub(tag) {
        return function StubComponent(props) {
          if (!props) return null;
          if (typeof tag === 'string' && /^[a-z]/.test(tag)) {
            return window.React.createElement(tag, { className: props.className, style: props.style, onClick: props.onClick }, props.children || null);
          }
          return props.children ? window.React.createElement(window.React.Fragment, null, props.children) : null;
        };
      }

      var silentStub = new Proxy(function() { return makeComponentStub('div').apply(null, arguments); }, {
        get: function(_t, p) {
          if (p === '__esModule') return true;
          if (p === 'default') return silentStub;
          if (typeof p === 'string' && /^[a-z]/.test(p)) return makeComponentStub(p);
          return silentStub;
        }
      });

      var genaiShim = {
        __esModule: true,
        GoogleGenAI: function GoogleGenAI() {
          this.models = {
            generateContent: function() { return Promise.resolve({ text: '' }); }
          };
        },
        Type: { STRING: 'STRING', NUMBER: 'NUMBER', BOOLEAN: 'BOOLEAN', ARRAY: 'ARRAY', OBJECT: 'OBJECT' }
      };

      var rootMounted = false;
      var reactExport = null;
      var reactDomExport = null;
      var jsxRuntimeExport = null;
      var lucideProxy = null;

      function initReactExports() {
        var R = window.React;
        var RDOM = window.ReactDOM;
        var wrappedCreateRoot = function(container, options) {
          rootMounted = true;
          return RDOM.createRoot(container, options);
        };
        var legacyRender = function(element, container) {
          rootMounted = true;
          if (RDOM.createRoot) {
            return RDOM.createRoot(container).render(element);
          }
          return RDOM.render(element, container);
        };
        reactExport = Object.assign({}, R, { __esModule: true, default: R });
        reactDomExport = Object.assign({}, RDOM, {
          __esModule: true,
          default: Object.assign({}, RDOM, { createRoot: wrappedCreateRoot, hydrateRoot: wrappedCreateRoot, render: legacyRender }),
          createRoot: wrappedCreateRoot,
          hydrateRoot: wrappedCreateRoot,
          render: legacyRender
        });
        var jsxFn = function(type, config, maybeKey) {
          var props = Object.assign({}, config || {});
          if (maybeKey !== undefined) props.key = maybeKey;
          return R.createElement(type, props);
        };
        jsxRuntimeExport = {
          __esModule: true,
          Fragment: R.Fragment,
          jsx: jsxFn,
          jsxs: jsxFn,
          jsxDEV: jsxFn
        };
        lucideProxy = createLucideProxy();
      }

      function requireModule(fromPath, spec) {
        if (includeReactRuntime && window.React) {
          if (!reactExport) initReactExports();
          if (spec === 'react') return reactExport;
          if (spec === 'react/jsx-runtime' || spec === 'react/jsx-dev-runtime') return jsxRuntimeExport;
          if (spec === 'react-dom' || spec === 'react-dom/client') return reactDomExport;
          if (spec === 'lucide-react') return lucideProxy;
          if (spec === 'framer-motion' || spec === 'motion/react' || spec === 'motion') return motionProxy;
        }

        if (spec === 'clsx' || spec === 'classnames' || spec === 'tailwind-merge') {
          var fn = function() { return joinClasses.apply(null, arguments); };
          return { __esModule: true, default: fn, clsx: fn, cn: fn, twMerge: fn, classNames: fn };
        }
        if (spec === '@google/genai') return genaiShim;
        if (/\\.(?:css|scss|sass|less)(?:\\?.*)?$/i.test(spec)) return {};
        if (/\\.(?:png|jpe?g|gif|webp|ico|bmp|avif)(?:\\?.*)?$/i.test(spec)) return '';

        var target = resolvePath(fromPath, spec);
        if (!target) {
          if (/\\.svg(?:\\?.*)?$/i.test(spec)) return '';
          return includeReactRuntime ? silentStub : {};
        }
        return loadModule(target);
      }

      function loadModule(filePath) {
        if (cache[filePath]) return cache[filePath].exports;
        var entry = rawVfs[filePath];
        if (!entry) return {};

        if (entry.kind === 'error') {
          throw new Error(entry.code);
        }
        if (entry.kind === 'json') {
          var parsed = JSON.parse(entry.code);
          cache[filePath] = { exports: parsed };
          return parsed;
        }
        if (entry.kind === 'svg') {
          var uri = 'data:image/svg+xml;utf8,' + encodeURIComponent(entry.code);
          cache[filePath] = { exports: { __esModule: true, default: uri } };
          return cache[filePath].exports;
        }

        var mod = { exports: {} };
        cache[filePath] = mod;
        var localRequire = function(spec) { return requireModule(filePath, spec); };
        var fn = new Function('require', 'module', 'exports', 'React', 'ReactDOM', 'process', entry.code);
        fn(localRequire, mod, mod.exports, window.React, window.ReactDOM, window.process);
        return mod.exports;
      }

      function isReactComponentLike(val) {
        if (typeof val === 'function') return true;
        if (val && typeof val === 'object' && val.$$typeof) return true;
        return false;
      }

      function pickComponentExport(exp) {
        if (!exp) return null;
        if (isReactComponentLike(exp)) return exp;
        if (isReactComponentLike(exp.default)) return exp.default;
        if (isReactComponentLike(exp.App)) return exp.App;
        var keys = Object.keys(exp);
        for (var i = 0; i < keys.length; i++) {
          if (/^[A-Z]/.test(keys[i]) && isReactComponentLike(exp[keys[i]])) {
            return exp[keys[i]];
          }
        }
        return null;
      }

      function bootApp() {
        try {
          if (includeReactRuntime) {
            if (!window.React || !window.ReactDOM) {
              showCompileError('React Runtime Failed to Load', 'Unable to load React / ReactDOM libraries from CDN. Check network access and refresh preview.');
              return;
            }
            initReactExports();
          }

          var rootEl = document.getElementById('root') || document.getElementById('app') || document.body.appendChild(document.createElement('div'));
          if (entryPath) {
            var entryExports = loadModule(entryPath);
            if (includeReactRuntime && !rootMounted) {
              var RootComp = pickComponentExport(entryExports);
              if (!RootComp) {
                var appKey = paths.find(function(p) { return /(?:^|\\/)App\\.[jt]sx?$/i.test(p); });
                if (appKey) {
                  RootComp = pickComponentExport(loadModule(appKey));
                }
              }
              if (RootComp) {
                var R = window.React;
                class ErrorBoundary extends R.Component {
                  constructor(props) {
                    super(props);
                    this.state = { error: null };
                  }
                  static getDerivedStateFromError(error) {
                    return { error: error };
                  }
                  render() {
                    if (this.state.error) {
                      return R.createElement('div', {
                        style: {
                          padding: '20px',
                          margin: '16px',
                          borderRadius: '12px',
                          background: '#1e293b',
                          border: '1px solid #ef4444',
                          color: '#fecaca',
                          fontFamily: 'ui-monospace, monospace',
                          whiteSpace: 'pre-wrap'
                        }
                      }, 'Render Error: ' + (this.state.error.stack || String(this.state.error)));
                    }
                    return this.props.children;
                  }
                }
                reactDomExport.createRoot(rootEl).render(
                  R.createElement(ErrorBoundary, null, R.createElement(RootComp))
                );
              }
            }
          }
        } catch (err) {
          console.error('Compile / Execution Error:', err);
          showCompileError('Compilation / Runtime Error:', err);
        }
      }

      if (!includeReactRuntime || (window.React && window.ReactDOM)) {
        bootApp();
      } else {
        var r1 = document.createElement('script');
        r1.src = 'https://cdn.jsdelivr.net/npm/react@18/umd/react.production.min.js';
        r1.crossOrigin = 'anonymous';
        r1.onload = function() {
          var r2 = document.createElement('script');
          r2.src = 'https://cdn.jsdelivr.net/npm/react-dom@18/umd/react-dom.production.min.js';
          r2.crossOrigin = 'anonymous';
          r2.onload = bootApp;
          r2.onerror = bootApp;
          document.head.appendChild(r2);
        };
        r1.onerror = bootApp;
        document.head.appendChild(r1);
      }
    })();
  </script>`;
}

function buildMultiFileReactHtml(params: {
  allFiles: CodebaseFile[];
  moduleFiles: CodebaseFile[];
  htmlEntry: CodebaseFile | null;
  title: string;
}): string {
  const { allFiles, moduleFiles, htmlEntry, title } = params;
  const vfs = compileModuleMap(moduleFiles);
  const { rootPrefix, entryPath } = detectRootPrefixAndEntry({
    allFiles,
    moduleFiles,
    htmlEntry
  });

  const bodyInfo = htmlEntry
    ? extractBodyAttrsAndMarkup(htmlEntry.content)
    : {
        bodyClass: 'bg-slate-950 text-slate-100 min-h-screen',
        bodyStyle: '',
        markup: '<div id="root"></div>',
        extraHeadTags: ''
      };

  const bodyClassAttr = bodyInfo.bodyClass
    ? ` class="${escapeHtmlText(bodyInfo.bodyClass)}"`
    : ' class="bg-slate-950 text-slate-100 min-h-screen"';
  const bodyStyleAttr = bodyInfo.bodyStyle
    ? ` style="${escapeHtmlText(bodyInfo.bodyStyle)}"`
    : '';

  const runtimeScript = buildModuleRuntimeScript({
    vfs,
    rootPrefix,
    entryPath,
    includeReactRuntime: true
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtmlText(title)}</title>
  ${bodyInfo.extraHeadTags}
  <script src="https://unpkg.com/react@18/umd/react.production.min.js" crossorigin></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js" crossorigin></script>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://unpkg.com/lucide@latest/dist/umd/lucide.min.js"></script>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
  </style>
</head>
<body${bodyClassAttr}${bodyStyleAttr}>
  ${bodyInfo.markup}
  ${runtimeScript}
</body>
</html>`;
}

function hasRealEsmModuleSyntax(content: string): boolean {
  // Ignore lines inside comments and require real top-level import/export syntax
  const withoutComments = content
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
  return (
    /^\s*import\s+(?:[\w*{},\s]+\s+from\s+)?['"][^'"]+['"]/m.test(withoutComments) ||
    /^\s*export\s+(?:default\s+|async\s+)?(?:function|const|let|var|class|interface|type|enum|\{|\*)/m.test(
      withoutComments
    )
  );
}

/**
 * Deterministically copies & compiles uploaded files or ZIP archives 100% verbatim
 * into a runnable live preview without rewriting or altering the user's code.
 */
export function compileCodebaseFiles(
  files: CodebaseFile[],
  projectNameHint?: string
): CompiledCodebaseResult {
  if (!files || files.length === 0) {
    throw new Error('No uploaded files found to compile.');
  }

  const filesByPath = new Map<string, CodebaseFile>();
  for (const f of files) {
    filesByPath.set(f.path, f);
  }

  const htmlFiles = files.filter((f) => /\.html?$/i.test(f.path));
  const cssFiles = files.filter((f) => /\.css$/i.test(f.path));
  const tsxJsxFiles = files.filter(
    (f) => /\.(?:tsx|jsx)$/i.test(f.path) && !isConfigOrIgnoredBuildFile(f.path)
  );
  const allCodeModules = files.filter(
    (f) =>
      /\.(?:ts|tsx|js|jsx|mjs|cjs|json|svg)$/i.test(f.path) &&
      !isConfigOrIgnoredBuildFile(f.path)
  );

  const htmlEntry = pickBestHtmlEntry(htmlFiles);

  // Check if HTML links local module script(s)
  const localModuleScriptsInHtml = htmlEntry
    ? [...htmlEntry.content.matchAll(/<script\b([^>]*)>/gi)].filter((m) => {
        const attrs = m[1];
        const src = attrs.match(/\bsrc=["']([^"']+)["']/i)?.[1];
        if (!src || /^(?:https?:|data:|blob:|\/\/)/i.test(src)) return false;
        const resolved = resolveRelativeFile(filesByPath, files, htmlEntry.path, src);
        return Boolean(resolved && (/\.[jt]sx?$/i.test(resolved.path) || /type=["']module["']/i.test(attrs)));
      })
    : [];

  const usesReactPkg = files.some(
    (f) =>
      /\.(?:ts|tsx|js|jsx|mjs)$/i.test(f.path) &&
      !isConfigOrIgnoredBuildFile(f.path) &&
      (/\bfrom\s+['"]react(?:-dom)?(?:\/[^'"]*)?['"]/.test(f.content) ||
        /\bReactDOM\.createRoot\b/.test(f.content) ||
        /\bReact\.createElement\b/.test(f.content))
  );

  const hasEsmOrTsModules = files.some(
    (f) =>
      /\.(?:ts|mjs)$/i.test(f.path) ||
      (/\.(?:js|cjs)$/i.test(f.path) &&
        !isConfigOrIgnoredBuildFile(f.path) &&
        hasRealEsmModuleSyntax(f.content))
  );

  const titleFromHtml = htmlEntry?.content.match(/<title[^>]*>([^<]{1,64})<\/title>/i)?.[1]?.trim();
  const derivedTitle =
    projectNameHint ||
    (titleFromHtml && !/studiox|vite \+ react/i.test(titleFromHtml) ? titleFromHtml : '') ||
    files[0]?.name.replace(/\.[^.]+$/, '') ||
    'Compiled Project';

  // 1. Multi-file or single-file React / TypeScript / JSX project
  if (tsxJsxFiles.length > 0 || usesReactPkg || (allCodeModules.some((f) => /\.tsx?$/i.test(f.path)) && !htmlEntry)) {
    const compiledCss = cssFiles
      .map((f) => stripCssTailwindDirectives(f.content))
      .filter(Boolean)
      .join('\n\n');

    const compiledHtml = buildMultiFileReactHtml({
      allFiles: files,
      moduleFiles: allCodeModules,
      htmlEntry,
      title: derivedTitle
    });
    return {
      code: {
        html: compiledHtml,
        css: compiledCss,
        js: ''
      },
      projectType: 'react-ts',
      entryFile: htmlEntry?.path || tsxJsxFiles[0]?.path || allCodeModules[0]?.path || files[0].path,
      includedFiles: [...allCodeModules, ...cssFiles].map((f) => f.path),
      title: derivedTitle
    };
  }

  // 2. Vanilla HTML / CSS / JS (supports both standard <script> AND <script type="module"> + TypeScript modules!)
  if (htmlEntry) {
    let html = htmlEntry.content;
    const matchedCssFiles: CodebaseFile[] = [];
    const matchedJsFiles: CodebaseFile[] = [];
    const seenCss = new Set<string>();
    const seenJs = new Set<string>();

    // Resolve local <link rel="stylesheet" href="..."> verbatim
    html = html.replace(/<link\b[^>]*>/gi, (tag) => {
      if (!/rel=["']stylesheet["']/i.test(tag)) return tag;
      const href = tag.match(/\bhref=["']([^"']+)["']/i)?.[1];
      if (!href) return tag;
      const target = resolveRelativeFile(filesByPath, files, htmlEntry.path, href);
      if (target) {
        if (!seenCss.has(target.path)) {
          seenCss.add(target.path);
          matchedCssFiles.push(target);
        }
        return '';
      }
      return tag;
    });

    // If HTML uses ES modules (`<script type="module" src="...">` or module syntax in linked JS), preserve HTML body verbatim + inject compiled CommonJS runner
    const linkedJsUsesEsm =
      localModuleScriptsInHtml.some((m) => /type=["']module["']/i.test(m[1])) ||
      (hasEsmOrTsModules && allCodeModules.some((f) => /\.(?:ts|js|mjs)$/i.test(f.path)));

    if (linkedJsUsesEsm && allCodeModules.length > 0) {
      let matchedAnyModule = false;
      html = html.replace(/<script\b([^>]*)>\s*<\/script>/gi, (fullTag, attrs) => {
        const src = attrs.match(/\bsrc=["']([^"']+)["']/i)?.[1];
        if (!src) return fullTag;
        const target = resolveRelativeFile(filesByPath, files, htmlEntry.path, src);
        if (target) {
          matchedAnyModule = true;
          return '';
        }
        return fullTag;
      });

      const vfs = compileModuleMap(allCodeModules);
      const { rootPrefix, entryPath } = detectRootPrefixAndEntry({
        allFiles: files,
        moduleFiles: allCodeModules,
        htmlEntry
      });
      const runtimeScript = buildModuleRuntimeScript({
        vfs,
        rootPrefix,
        entryPath,
        includeReactRuntime: false
      });

      const lastBodyClose = html.toLowerCase().lastIndexOf('</body>');
      if (lastBodyClose !== -1) {
        html = `${html.slice(0, lastBodyClose)}\n${runtimeScript}\n${html.slice(lastBodyClose)}`;
      } else {
        html = `${html}\n${runtimeScript}`;
      }

      const combinedCss = (matchedCssFiles.length > 0 ? matchedCssFiles : cssFiles)
        .map((f) => stripCssTailwindDirectives(f.content))
        .filter(Boolean)
        .join('\n\n');

      return {
        code: {
          html,
          css: combinedCss,
          js: ''
        },
        projectType: 'web',
        entryFile: matchedAnyModule ? entryPath || htmlEntry.path : htmlEntry.path,
        includedFiles: Array.from(
          new Set([htmlEntry.path, ...allCodeModules.map((f) => f.path), ...cssFiles.map((f) => f.path)])
        ),
        title: derivedTitle
      };
    }

    // Standard multi-script or single-file HTML/CSS/JS project — preserve exact execution order!
    const orderedJsSegments: string[] = [];
    html = html.replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi, (fullTag, attrs, inlineBody) => {
      const src = attrs.match(/\bsrc=["']([^"']+)["']/i)?.[1];
      const typeAttr = attrs.match(/\btype=["']([^"']+)["']/i)?.[1]?.toLowerCase() || '';

      // Preserve non-JS data/template/babel/importmap script blocks untouched inside HTML
      if (
        typeAttr &&
        typeAttr !== 'text/javascript' &&
        typeAttr !== 'application/javascript' &&
        typeAttr !== 'application/ecmascript'
      ) {
        return fullTag;
      }

      if (src) {
        const target = resolveRelativeFile(filesByPath, files, htmlEntry.path, src);
        if (target) {
          if (!seenJs.has(target.path)) {
            seenJs.add(target.path);
            matchedJsFiles.push(target);
            orderedJsSegments.push(target.content);
          }
          return '';
        }
        return fullTag;
      }

      if (inlineBody && inlineBody.trim()) {
        orderedJsSegments.push(inlineBody.trim());
        return '';
      }

      return fullTag;
    });

    let combinedCss = matchedCssFiles.map((f) => f.content).join('\n\n');
    if (!combinedCss && cssFiles.length > 0 && matchedCssFiles.length === 0) {
      combinedCss = cssFiles.map((f) => f.content).join('\n\n');
    }

    const plainJsFiles = files.filter(
      (f) => /\.(?:js|mjs|cjs)$/i.test(f.path) && !isConfigOrIgnoredBuildFile(f.path)
    );
    let combinedJs = orderedJsSegments.join('\n\n');
    if (!combinedJs && plainJsFiles.length > 0 && matchedJsFiles.length === 0) {
      combinedJs = plainJsFiles.map((f) => f.content).join('\n\n');
    }

    // Extract inline <style> if no separate CSS files were linked
    if (!combinedCss) {
      const inlineStyles = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)];
      if (inlineStyles.length > 0) {
        combinedCss = inlineStyles.map((m) => m[1].trim()).join('\n\n');
        html = html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '').trim();
      }
    }

    return {
      code: {
        html,
        css: combinedCss,
        js: combinedJs
      },
      projectType: 'web',
      entryFile: htmlEntry.path,
      includedFiles: Array.from(
        new Set([
          htmlEntry.path,
          ...matchedCssFiles.map((f) => f.path),
          ...matchedJsFiles.map((f) => f.path),
          ...(matchedCssFiles.length === 0 ? cssFiles.map((f) => f.path) : []),
          ...(matchedJsFiles.length === 0 ? plainJsFiles.map((f) => f.path) : [])
        ])
      ),
      title: derivedTitle
    };
  }

  // 3. Standalone JS / TS / CSS upload without HTML
  const standaloneModules = files.filter(
    (f) => /\.(?:js|mjs|cjs|ts)$/i.test(f.path) && !isConfigOrIgnoredBuildFile(f.path)
  );
  if (standaloneModules.length > 0 || cssFiles.length > 0) {
    if (hasEsmOrTsModules || standaloneModules.some((f) => /\.ts$/i.test(f.path))) {
      const compiledHtml = buildMultiFileReactHtml({
        allFiles: files,
        moduleFiles: allCodeModules,
        htmlEntry: null,
        title: derivedTitle
      });
      return {
        code: {
          html: compiledHtml,
          css: cssFiles.map((f) => stripCssTailwindDirectives(f.content)).filter(Boolean).join('\n\n'),
          js: ''
        },
        projectType: 'react-ts',
        entryFile: standaloneModules[0]?.path || cssFiles[0].path,
        includedFiles: [...standaloneModules, ...cssFiles].map((f) => f.path),
        title: derivedTitle
      };
    }

    return {
      code: {
        html: '<div id="app"></div>\n<div id="root"></div>',
        css: cssFiles.map((f) => f.content).join('\n\n'),
        js: standaloneModules.map((f) => f.content).join('\n\n')
      },
      projectType: 'script',
      entryFile: standaloneModules[0]?.path || cssFiles[0].path,
      includedFiles: [...standaloneModules, ...cssFiles].map((f) => f.path),
      title: derivedTitle
    };
  }

  // 4. Text / JSON / Markdown fallback (or HTML document saved with .txt extension)
  const primary = files[0];
  if (/<!DOCTYPE\s+html|<html[\s>]/i.test(primary.content)) {
    return {
      code: { html: primary.content, css: '', js: '' },
      projectType: 'web',
      entryFile: primary.path,
      includedFiles: [primary.path],
      title: derivedTitle
    };
  }

  return {
    code: {
      html: `<div style="max-width:960px;margin:24px auto;padding:24px;font-family:ui-monospace,monospace;">
  <h2 style="margin:0 0 12px;color:#38bdf8;">${escapeHtmlText(primary.path)}</h2>
  <pre style="white-space:pre-wrap;word-break:break-word;background:#020617;border:1px solid #1e293b;padding:16px;border-radius:12px;color:#e2e8f0;font-size:12px;line-height:1.5;">${escapeHtmlText(primary.content)}</pre>
</div>`,
      css: '',
      js: ''
    },
    projectType: 'text',
    entryFile: primary.path,
    includedFiles: [primary.path],
    title: derivedTitle
  };
}

function cleanPathHint(rawPathHint: string): string {
  return rawPathHint
    .replace(/\*+/g, '')
    .replace(/[`'"<>]/g, '')
    .replace(/\s*\([^)]*\)\s*$/, '')
    .replace(/=+$/g, '')
    .replace(/\\/g, '/')
    .replace(/^(?:\.\/)+/, '')
    .replace(/^\/+/, '')
    .trim();
}

function findMatchingVaultIndices(files: CodebaseFile[], rawPathHint?: string): number[] {
  if (files.length === 0) return [];
  if (!rawPathHint) return files.length === 1 ? [0] : [];

  const cleaned = cleanPathHint(rawPathHint);
  if (!cleaned) return files.length === 1 ? [0] : [];

  const exactIdx = files.findIndex((f) => f.path === cleaned);
  if (exactIdx !== -1) return [exactIdx];

  const lower = cleaned.toLowerCase();
  const ciExactIdx = files.findIndex((f) => f.path.toLowerCase() === lower);
  if (ciExactIdx !== -1) return [ciExactIdx];

  const suffixMatches: number[] = [];
  const baseMatches: number[] = [];
  const baseHint = lower.split('/').pop() || lower;

  for (let i = 0; i < files.length; i++) {
    const pLower = files[i].path.toLowerCase();
    const nLower = files[i].name.toLowerCase();
    if (pLower.endsWith(`/${lower}`)) {
      suffixMatches.push(i);
    } else if (nLower === baseHint) {
      baseMatches.push(i);
    }
  }

  if (suffixMatches.length > 0) return suffixMatches;
  if (baseMatches.length > 0) return baseMatches;
  return files.length === 1 ? [0] : [];
}

function stripLeadingLineNumbers(block: string): string {
  const lines = block.split('\n');
  const numberedCount = lines.filter((l) => /^\d+:\s/.test(l)).length;
  if (lines.length > 0 && numberedCount >= Math.ceil(lines.length * 0.7)) {
    return lines.map((l) => l.replace(/^\d+:\s?/, '')).join('\n');
  }
  return block;
}

function getLeadingIndent(line: string): string {
  const m = line.match(/^([ \t]*)/);
  return m ? m[1] : '';
}

function applyIndentDelta(lines: string[], origIndent: string, searchIndent: string): string[] {
  if (origIndent === searchIndent) return lines;
  if (origIndent.startsWith(searchIndent)) {
    const extra = origIndent.slice(searchIndent.length);
    return lines.map((l) => (l.trim() ? `${extra}${l}` : l));
  }
  if (searchIndent.startsWith(origIndent)) {
    const stripLen = searchIndent.length - origIndent.length;
    return lines.map((l) => {
      if (!l.trim()) return l;
      const leading = getLeadingIndent(l);
      return leading.length >= stripLen ? l.slice(stripLen) : l.trimStart();
    });
  }
  return lines;
}

function collapseLineWhitespace(line: string): string {
  return line.trim().replace(/[ \t]+/g, ' ');
}

export function applySearchReplaceOnce(
  originalContent: string,
  rawSearch: string,
  rawReplace: string
): { updated: string; matched: boolean; matchKind?: 'exact' | 'trimmed' | 'normalized' } {
  const normalizedContent = originalContent.replace(/\r\n/g, '\n');
  const searchCandidates = [
    rawSearch.replace(/\r\n/g, '\n'),
    stripLeadingLineNumbers(rawSearch.replace(/\r\n/g, '\n'))
  ];
  const replaceText = rawReplace.replace(/\r\n/g, '\n');

  // Tier 1: Exact substring match (safest & preserves formatting 100%)
  for (const search of searchCandidates) {
    if (!search) continue;
    const exactIdx = normalizedContent.indexOf(search);
    if (exactIdx !== -1) {
      return {
        updated:
          normalizedContent.slice(0, exactIdx) +
          replaceText +
          normalizedContent.slice(exactIdx + search.length),
        matched: true,
        matchKind: 'exact'
      };
    }
  }

  const contentLines = normalizedContent.split('\n');

  // Tier 2: Trimmed line-by-line match with original base indentation preservation
  for (const search of searchCandidates) {
    if (!search) continue;
    const searchLines = search.replace(/^\n+|\n+$/g, '').split('\n');
    if (searchLines.length > 0 && searchLines.some((l) => l.trim().length > 0)) {
      const trimmedSearch = searchLines.map((l) => l.trim());
      for (let i = 0; i <= contentLines.length - trimmedSearch.length; i++) {
        let allMatch = true;
        for (let j = 0; j < trimmedSearch.length; j++) {
          if (contentLines[i + j].trim() !== trimmedSearch[j]) {
            allMatch = false;
            break;
          }
        }
        if (allMatch) {
          const replacementLines = replaceText.replace(/^\n+|\n+$/g, '').split('\n');
          const firstNonEmptyIdx = trimmedSearch.findIndex((l) => l.length > 0);
          let adjustedReplacement = replacementLines;
          if (firstNonEmptyIdx !== -1) {
            const origIndent = getLeadingIndent(contentLines[i + firstNonEmptyIdx]);
            const searchIndent = getLeadingIndent(searchLines[firstNonEmptyIdx]);
            adjustedReplacement = applyIndentDelta(replacementLines, origIndent, searchIndent);
          }
          const nextLines = [
            ...contentLines.slice(0, i),
            ...adjustedReplacement,
            ...contentLines.slice(i + trimmedSearch.length)
          ];
          return {
            updated: nextLines.join('\n'),
            matched: true,
            matchKind: 'trimmed'
          };
        }
      }
    }
  }

  // Tier 3: Whitespace-collapsed normalized matching (tolerates minor blank-line & spacing differences)
  for (const search of searchCandidates) {
    if (!search) continue;
    const searchLines = search.replace(/^\n+|\n+$/g, '').split('\n');
    const nonEmptySearch = searchLines
      .map((l, idx) => ({ norm: collapseLineWhitespace(l), raw: l, idx }))
      .filter((x) => x.norm.length > 0);

    if (nonEmptySearch.length === 0) continue;

    const nonEmptyContent: Array<{ lineIdx: number; norm: string }> = [];
    for (let i = 0; i < contentLines.length; i++) {
      const norm = collapseLineWhitespace(contentLines[i]);
      if (norm.length > 0) {
        nonEmptyContent.push({ lineIdx: i, norm });
      }
    }

    for (let i = 0; i <= nonEmptyContent.length - nonEmptySearch.length; i++) {
      let allMatch = true;
      for (let j = 0; j < nonEmptySearch.length; j++) {
        if (nonEmptyContent[i + j].norm !== nonEmptySearch[j].norm) {
          allMatch = false;
          break;
        }
      }
      if (allMatch) {
        const startLineIdx = nonEmptyContent[i].lineIdx;
        const endLineIdx = nonEmptyContent[i + nonEmptySearch.length - 1].lineIdx;
        const replacementLines = replaceText.replace(/^\n+|\n+$/g, '').split('\n');
        const origIndent = getLeadingIndent(contentLines[startLineIdx]);
        const searchIndent = getLeadingIndent(nonEmptySearch[0].raw);
        const adjustedReplacement = applyIndentDelta(replacementLines, origIndent, searchIndent);

        const nextLines = [
          ...contentLines.slice(0, startLineIdx),
          ...adjustedReplacement,
          ...contentLines.slice(endLineIdx + 1)
        ];
        return {
          updated: nextLines.join('\n'),
          matched: true,
          matchKind: 'normalized'
        };
      }
    }
  }

  return { updated: originalContent, matched: false };
}

function extractPrecedingFileHint(prefixText: string): string | undefined {
  // Inspect up to 4 non-empty lines directly preceding <<<<<<< SEARCH
  const tailLines = prefixText.split(/\r?\n/).slice(-5);
  for (let i = tailLines.length - 1; i >= 0; i--) {
    const line = tailLines[i].trim();
    if (!line || /^```/.test(line)) continue;
    const headerMatch = line.match(
      /^(?:#{1,4}\s*)?(?:={2,}\s*)?(?:\*\*)?(?:FILE|File|Path|TARGET(?:\s+FILE)?)(?:\*\*)?:\s*(.+?)(?:\s*={2,})?$/i
    );
    if (headerMatch && headerMatch[1]) {
      const cleaned = cleanPathHint(headerMatch[1]);
      if (cleaned) return cleaned;
    }
    break;
  }
  return undefined;
}

interface StructuredSurgicalEditJson {
  analysis?: string;
  edits?: Array<{
    filePath: string;
    search: string;
    replace: string;
  }>;
  newFiles?: Array<{
    filePath: string;
    content: string;
  }>;
}

function extractBalancedJsonObject(text: string): string | null {
  let startIdx = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === '\\' && inString) {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (ch === '{') {
      if (depth === 0) startIdx = i;
      depth += 1;
    } else if (ch === '}') {
      if (depth > 0) {
        depth -= 1;
        if (depth === 0 && startIdx !== -1) {
          const candidate = text.slice(startIdx, i + 1);
          if (/"edits"\s*:|"newFiles"\s*:/.test(candidate)) {
            return candidate;
          }
          startIdx = -1;
        }
      }
    }
  }
  return null;
}

function parseStructuredSurgicalJson(aiResponse: string): StructuredSurgicalEditJson | null {
  const candidates: string[] = [];

  const trimmed = aiResponse.trim();
  if (trimmed.startsWith('{')) {
    candidates.push(trimmed);
  }

  for (const m of aiResponse.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)) {
    const body = (m[1] || '').trim();
    if (body.startsWith('{')) candidates.push(body);
  }

  const balanced = extractBalancedJsonObject(aiResponse);
  if (balanced) candidates.push(balanced);

  for (const raw of candidates) {
    try {
      const parsed = JSON.parse(raw);
      if (
        parsed &&
        typeof parsed === 'object' &&
        (Array.isArray(parsed.edits) || Array.isArray(parsed.newFiles))
      ) {
        return parsed as StructuredSurgicalEditJson;
      }
    } catch {
      // Try next JSON candidate
    }
  }
  return null;
}

function applySingleEditBlock(
  workingFiles: CodebaseFile[],
  fileHint: string | undefined,
  searchBlock: string,
  replaceBlock: string,
  patchedSet: Set<string>,
  unmatchedDetails: Array<{ fileHint?: string; searchSnippet: string }>
): { matched: boolean } {
  const candidateIndices = findMatchingVaultIndices(workingFiles, fileHint);
  let chosenIdx = -1;

  for (const pass of ['exact', 'trimmed', 'normalized'] as const) {
    for (const idx of candidateIndices) {
      const probe = applySearchReplaceOnce(workingFiles[idx].content, searchBlock, replaceBlock);
      if (probe.matched && probe.matchKind === pass) {
        chosenIdx = idx;
        break;
      }
    }
    if (chosenIdx !== -1) break;
  }

  if (chosenIdx === -1) {
    for (const pass of ['exact', 'trimmed', 'normalized'] as const) {
      const matchesInPass: number[] = [];
      for (let i = 0; i < workingFiles.length; i++) {
        const probe = applySearchReplaceOnce(workingFiles[i].content, searchBlock, replaceBlock);
        if (probe.matched && probe.matchKind === pass) {
          matchesInPass.push(i);
        }
      }
      if (matchesInPass.length === 1) {
        chosenIdx = matchesInPass[0];
        break;
      } else if (matchesInPass.length > 1 && fileHint) {
        const hintExt = fileHint.split('.').pop()?.toLowerCase();
        const byExt = matchesInPass.find((idx) => workingFiles[idx].ext.toLowerCase() === hintExt);
        if (byExt !== undefined) {
          chosenIdx = byExt;
          break;
        }
      } else if (matchesInPass.length > 1 && !fileHint && pass === 'exact') {
        chosenIdx = matchesInPass[0];
        break;
      }
    }
  }

  if (chosenIdx !== -1) {
    const target = workingFiles[chosenIdx];
    const applied = applySearchReplaceOnce(target.content, searchBlock, replaceBlock);
    if (applied.matched) {
      workingFiles[chosenIdx] = createCodebaseFile(target.path, applied.updated, target.bytes);
      patchedSet.add(workingFiles[chosenIdx].path);
      return { matched: true };
    }
  }

  unmatchedDetails.push({ fileHint, searchSnippet: searchBlock.slice(0, 240) });
  return { matched: false };
}

/**
 * Applies structured JSON surgical edits (preferred) or legacy FILE + SEARCH/REPLACE / FULL_FILE / NEW_FILE
 * patches cleanly onto the CodebaseFile vault without touching unrelated files/lines.
 */
export function applySurgicalPatchesToVault(
  files: CodebaseFile[],
  aiResponse: string
): VaultPatchResult {
  const workingFiles = files.map((f) => ({ ...f }));
  const patchedSet = new Set<string>();
  const addedSet = new Set<string>();
  const unmatchedDetails: Array<{ fileHint?: string; searchSnippet: string }> = [];
  let unmatchedBlocks = 0;
  let appliedBlocksCount = 0;
  let analysis: string | undefined;

  // 1. Preferred structured JSON surgical format
  const jsonPatch = parseStructuredSurgicalJson(aiResponse);
  if (jsonPatch) {
    if (typeof jsonPatch.analysis === 'string' && jsonPatch.analysis.trim()) {
      analysis = jsonPatch.analysis.trim();
    }

    if (Array.isArray(jsonPatch.edits)) {
      for (const edit of jsonPatch.edits) {
        if (!edit || typeof edit.search !== 'string' || typeof edit.replace !== 'string') continue;
        const fileHint = typeof edit.filePath === 'string' ? cleanPathHint(edit.filePath) : undefined;
        if (!edit.search.trim() && fileHint) {
          const matchedIndices = findMatchingVaultIndices(workingFiles, fileHint);
          if (matchedIndices.length === 1 && edit.replace.trim()) {
            const idx = matchedIndices[0];
            workingFiles[idx] = createCodebaseFile(workingFiles[idx].path, edit.replace);
            patchedSet.add(workingFiles[idx].path);
            appliedBlocksCount += 1;
            continue;
          }
        }
        const res = applySingleEditBlock(
          workingFiles,
          fileHint,
          edit.search,
          edit.replace,
          patchedSet,
          unmatchedDetails
        );
        if (res.matched) {
          appliedBlocksCount += 1;
        } else {
          unmatchedBlocks += 1;
        }
      }
    }

    if (Array.isArray(jsonPatch.newFiles)) {
      for (const nf of jsonPatch.newFiles) {
        if (!nf || typeof nf.filePath !== 'string' || typeof nf.content !== 'string') continue;
        const rawPath = cleanPathHint(nf.filePath);
        if (!rawPath || !nf.content.trim()) continue;
        const matchedIndices = findMatchingVaultIndices(workingFiles, rawPath);
        if (matchedIndices.length === 1) {
          const idx = matchedIndices[0];
          workingFiles[idx] = createCodebaseFile(workingFiles[idx].path, nf.content);
          patchedSet.add(workingFiles[idx].path);
          appliedBlocksCount += 1;
        } else {
          const created = createCodebaseFile(rawPath, nf.content);
          workingFiles.push(created);
          addedSet.add(created.path);
          appliedBlocksCount += 1;
        }
      }
    }
  }

  // 2. Backwards-compatible fallback parsing for <<<<<<< SEARCH ... ======= ... >>>>>>> REPLACE blocks
  const blockRegex = /<<<<<<< SEARCH[ \t]*\r?\n([\s\S]*?)\r?\n=======[ \t]*\r?\n([\s\S]*?)\r?\n>>>>>>> REPLACE/g;

  let match: RegExpExecArray | null;
  let lastExplicitFileHint: string | undefined;
  let prevIndex = 0;

  while ((match = blockRegex.exec(aiResponse)) !== null) {
    const betweenText = aiResponse.slice(prevIndex, match.index);
    prevIndex = match.index + match[0].length;

    const explicitHint = extractPrecedingFileHint(betweenText);
    if (explicitHint) {
      lastExplicitFileHint = explicitHint;
    }
    const fileHint = explicitHint || lastExplicitFileHint;

    const res = applySingleEditBlock(
      workingFiles,
      fileHint,
      match[1],
      match[2],
      patchedSet,
      unmatchedDetails
    );
    if (res.matched) {
      appliedBlocksCount += 1;
    } else {
      unmatchedBlocks += 1;
    }
  }

  // 3. Explicit === FULL_FILE: path === / === NEW_FILE: path === blocks
  const fullFileRegex = /(?:^|\n)\s*===\s*(?:FULL_FILE|NEW_FILE):\s*([^\n=]+?)\s*===\s*\n```[a-zA-Z0-9_-]*\r?\n([\s\S]*?)```/g;
  while ((match = fullFileRegex.exec(aiResponse)) !== null) {
    const rawPath = cleanPathHint(match[1]);
    const newBody = match[2];
    if (!rawPath || !newBody.trim()) continue;
    const matchedIndices = findMatchingVaultIndices(workingFiles, rawPath);
    if (matchedIndices.length === 1) {
      const idx = matchedIndices[0];
      workingFiles[idx] = createCodebaseFile(workingFiles[idx].path, newBody);
      patchedSet.add(workingFiles[idx].path);
      appliedBlocksCount += 1;
    } else {
      const created = createCodebaseFile(rawPath, newBody);
      workingFiles.push(created);
      addedSet.add(created.path);
      appliedBlocksCount += 1;
    }
  }

  // 4. Fallback for single-file upload when AI emitted a single fenced code block
  if (patchedSet.size === 0 && addedSet.size === 0 && workingFiles.length === 1) {
    const target = workingFiles[0];
    const fenceMatches = [...aiResponse.matchAll(/```([a-zA-Z0-9_-]*)\r?\n([\s\S]*?)```/g)];
    if (fenceMatches.length === 1 && fenceMatches[0][1].toLowerCase() !== 'json') {
      const body = fenceMatches[0][2].trim();
      const isSubstantive =
        body.length >= Math.min(target.chars * 0.45, 400) ||
        (/<\/html>/i.test(body) && /<\/html>/i.test(target.content)) ||
        (/\bexport\s+default\b/.test(body) && /\bexport\s+default\b/.test(target.content));
      if (isSubstantive) {
        workingFiles[0] = createCodebaseFile(target.path, body);
        patchedSet.add(workingFiles[0].path);
        unmatchedBlocks = 0;
        appliedBlocksCount = 1;
      }
    }
  }

  return {
    updatedFiles: workingFiles,
    patchedPaths: Array.from(patchedSet),
    addedPaths: Array.from(addedSet),
    unmatchedBlocks,
    appliedBlocksCount,
    analysis,
    unmatchedDetails: unmatchedDetails.length > 0 ? unmatchedDetails : undefined
  };
}

function checkCssSyntax(cssText: string): { message: string; line?: number } | null {
  let depth = 0;
  let line = 1;
  let inSingle = false;
  let inDouble = false;
  let inComment = false;
  let commentStartLine = 1;

  for (let i = 0; i < cssText.length; i++) {
    const ch = cssText[i];
    const next = cssText[i + 1];

    if (ch === '\n') line += 1;

    if (inComment) {
      if (ch === '*' && next === '/') {
        inComment = false;
        i += 1;
      }
      continue;
    }

    if (inSingle) {
      if (ch === '\\') {
        i += 1;
      } else if (ch === "'") {
        inSingle = false;
      }
      continue;
    }

    if (inDouble) {
      if (ch === '\\') {
        i += 1;
      } else if (ch === '"') {
        inDouble = false;
      }
      continue;
    }

    if (ch === '/' && next === '*') {
      inComment = true;
      commentStartLine = line;
      i += 1;
      continue;
    }
    if (ch === "'") {
      inSingle = true;
      continue;
    }
    if (ch === '"') {
      inDouble = true;
      continue;
    }
    if (ch === '{') {
      depth += 1;
    } else if (ch === '}') {
      depth -= 1;
      if (depth < 0) {
        return { message: `Unexpected closing brace '}' at line ${line}`, line };
      }
    }
  }

  if (inComment) {
    return { message: `Unclosed CSS comment starting at line ${commentStartLine}`, line: commentStartLine };
  }
  if (inSingle || inDouble) {
    return { message: 'Unclosed string literal in CSS', line };
  }
  if (depth > 0) {
    return { message: `Unclosed CSS block: ${depth} missing closing '}' brace(s)`, line };
  }
  return null;
}

function checkHtmlSyntax(htmlText: string): { message: string; line?: number } | null {
  const openScriptCount = (htmlText.match(/<script\b/gi) || []).length;
  const closeScriptCount = (htmlText.match(/<\/script>/gi) || []).length;
  if (openScriptCount > closeScriptCount) {
    return { message: `Unclosed <script> tag (${openScriptCount} open, ${closeScriptCount} closing)` };
  }

  const openStyleCount = (htmlText.match(/<style\b/gi) || []).length;
  const closeStyleCount = (htmlText.match(/<\/style>/gi) || []).length;
  if (openStyleCount > closeStyleCount) {
    return { message: `Unclosed <style> tag (${openStyleCount} open, ${closeStyleCount} closing)` };
  }

  if (/<html\b/i.test(htmlText) && !/<\/html>/i.test(htmlText)) {
    return { message: 'Unclosed <html> tag (missing </html>)' };
  }
  if (/<body\b/i.test(htmlText) && !/<\/body>/i.test(htmlText)) {
    return { message: 'Unclosed <body> tag (missing </body>)' };
  }

  // Validate inline <style> blocks
  for (const m of htmlText.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) {
    const cssErr = checkCssSyntax(m[1]);
    if (cssErr) {
      return { message: `Inline <style> CSS error: ${cssErr.message}`, line: cssErr.line };
    }
  }

  // Validate inline JavaScript <script> blocks
  for (const m of htmlText.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const attrs = m[1] || '';
    const body = (m[2] || '').trim();
    if (!body || /\bsrc\s*=/i.test(attrs)) continue;
    const typeAttr = attrs.match(/\btype=["']([^"']+)["']/i)?.[1]?.toLowerCase() || '';
    if (
      typeAttr &&
      typeAttr !== 'text/javascript' &&
      typeAttr !== 'application/javascript' &&
      typeAttr !== 'module'
    ) {
      continue;
    }
    try {
      const cleanJs = neutralizeImportMeta(body);
      const transformed = transform(cleanJs, {
        transforms: ['jsx', 'imports'],
        jsxRuntime: 'classic',
        production: true,
        disableESTransforms: true
      });
      new Function('require', 'module', 'exports', transformed.code);
    } catch (err: any) {
      return { message: `Inline <script> syntax error: ${err?.message || String(err)}` };
    }
  }

  return null;
}

/**
 * Verifies every .ts, .tsx, .js, .jsx file in the vault using Sucrase transform() + JS parse check,
 * and checks HTML/CSS/JSON syntax before committing edits to the vault & live preview.
 */
export function verifyVaultCompilation(files: CodebaseFile[]): VaultVerificationResult {
  const errors: VaultCompilationError[] = [];
  let checkedFiles = 0;

  for (const file of files) {
    const lower = file.path.toLowerCase();
    if (/\.d\.ts$/i.test(lower) || lower.startsWith('public/assets/')) {
      continue;
    }

    if (/\.(?:ts|tsx|js|jsx|mjs|cjs)$/i.test(lower)) {
      checkedFiles += 1;
      const isPlainTs = /\.ts$/i.test(lower) && !/\.tsx$/i.test(lower);
      const isTsx = /\.tsx$/i.test(lower);
      const transforms: Array<'typescript' | 'jsx' | 'imports'> = isPlainTs
        ? ['typescript', 'imports']
        : isTsx
        ? ['typescript', 'jsx', 'imports']
        : ['jsx', 'imports'];

      try {
        const cleanSource = neutralizeImportMeta(file.content);
        const result = transform(cleanSource, {
          transforms,
          jsxRuntime: 'classic',
          production: true,
          disableESTransforms: true,
          filePath: file.path
        });
        new Function('require', 'module', 'exports', result.code);
      } catch (err: any) {
        const msg = err?.message || String(err);
        const locLine =
          typeof err?.loc?.line === 'number'
            ? err.loc.line
            : (() => {
                const m = msg.match(/\((\d+):(\d+)\)/);
                return m ? Number(m[1]) : undefined;
              })();
        const locCol =
          typeof err?.loc?.column === 'number'
            ? err.loc.column
            : (() => {
                const m = msg.match(/\((\d+):(\d+)\)/);
                return m ? Number(m[2]) : undefined;
              })();
        errors.push({
          filePath: file.path,
          message: msg,
          line: locLine,
          column: locCol,
          kind: 'ts-js'
        });
      }
      continue;
    }

    if (/\.(?:css|scss)$/i.test(lower)) {
      checkedFiles += 1;
      const cssErr = checkCssSyntax(file.content);
      if (cssErr) {
        errors.push({
          filePath: file.path,
          message: cssErr.message,
          line: cssErr.line,
          kind: 'css'
        });
      }
      continue;
    }

    if (/\.html?$/i.test(lower)) {
      checkedFiles += 1;
      const htmlErr = checkHtmlSyntax(file.content);
      if (htmlErr) {
        errors.push({
          filePath: file.path,
          message: htmlErr.message,
          line: htmlErr.line,
          kind: 'html'
        });
      }
      continue;
    }

    if (/\.json$/i.test(lower) && !/(?:^|\/)tsconfig[^/]*\.json$/i.test(lower)) {
      checkedFiles += 1;
      try {
        if (file.content.trim()) {
          JSON.parse(file.content);
        }
      } catch (err: any) {
        errors.push({
          filePath: file.path,
          message: err?.message || 'Invalid JSON syntax',
          kind: 'json'
        });
      }
    }
  }

  return {
    valid: errors.length === 0,
    checkedFiles,
    errors
  };
}
