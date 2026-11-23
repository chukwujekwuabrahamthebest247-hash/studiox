import { CodeState } from '../types';

/**
 * Builds the complete sandboxed HTML document to inject into the iframe's srcDoc.
 * Injects a logger bridge that captures console logs, warnings, errors, and unhandled rejections,
 * routing them to the parent window via postMessage.
 */
export function buildSandboxSrcDoc(code: CodeState): string {
  const { html, css, js } = code;

  // Bridge script injected into iframe to intercept console, user interactions, audio and commands
  const bridgeScript = `
    <script>
      (function() {
        const _log = console.log;
        const _info = console.info;
        const _warn = console.warn;
        const _error = console.error;

        let soundEnabled = true;
        let _audioCtx = null;

        function playTactileChime(freq = 620, type = 'sine', duration = 0.08) {
          if (!soundEnabled) return;
          try {
            if (!_audioCtx) {
              const AudioContextClass = window.AudioContext || window.webkitAudioContext;
              if (AudioContextClass) _audioCtx = new AudioContextClass();
            }
            if (_audioCtx && _audioCtx.state === 'suspended') {
              _audioCtx.resume();
            }
            if (_audioCtx) {
              const osc = _audioCtx.createOscillator();
              const gain = _audioCtx.createGain();
              osc.type = type;
              osc.frequency.setValueAtTime(freq, _audioCtx.currentTime);
              gain.gain.setValueAtTime(0.06, _audioCtx.currentTime);
              gain.gain.exponentialRampToValueAtTime(0.001, _audioCtx.currentTime + duration);
              osc.connect(gain);
              gain.connect(_audioCtx.destination);
              osc.start();
              osc.stop(_audioCtx.currentTime + duration);
            }
          } catch (e) {}
        }

        function createVisualRipple(x, y) {
          try {
            const ripple = document.createElement('div');
            ripple.style.position = 'fixed';
            ripple.style.left = (x - 15) + 'px';
            ripple.style.top = (y - 15) + 'px';
            ripple.style.width = '30px';
            ripple.style.height = '30px';
            ripple.style.borderRadius = '50%';
            ripple.style.background = 'radial-gradient(circle, rgba(56, 189, 248, 0.6) 0%, rgba(56, 189, 248, 0) 70%)';
            ripple.style.pointerEvents = 'none';
            ripple.style.zIndex = '999999';
            ripple.style.transition = 'transform 0.4s ease-out, opacity 0.4s ease-out';
            ripple.style.transform = 'scale(0.5)';
            ripple.style.opacity = '1';
            document.body.appendChild(ripple);
            requestAnimationFrame(function() {
              ripple.style.transform = 'scale(2.5)';
              ripple.style.opacity = '0';
            });
            setTimeout(function() {
              if (ripple.parentNode) ripple.parentNode.removeChild(ripple);
            }, 450);
          } catch(e) {}
        }

        function serializeArg(arg) {
          if (arg === null) return 'null';
          if (arg === undefined) return 'undefined';
          if (typeof arg === 'object') {
            try {
              return JSON.stringify(arg, null, 2);
            } catch (e) {
              return Object.prototype.toString.call(arg);
            }
          }
          return String(arg);
        }

        function sendToParent(type, args) {
          const serialized = Array.from(args).map(serializeArg);
          const message = serialized.join(' ');
          window.parent.postMessage({
            source: 'studiox-sandbox',
            type: 'console',
            level: type,
            message: message,
            args: serialized,
            timestamp: new Date().toLocaleTimeString()
          }, '*');
        }

        console.log = function(...args) {
          sendToParent('log', args);
          _log.apply(console, args);
        };
        console.info = function(...args) {
          sendToParent('info', args);
          _info.apply(console, args);
        };
        console.warn = function(...args) {
          sendToParent('warn', args);
          _warn.apply(console, args);
        };
        console.error = function(...args) {
          sendToParent('error', args);
          _error.apply(console, args);
        };

        window.onerror = function(message, source, lineno, colno, error) {
          sendToParent('error', [\`Runtime Error: \${message} at line \${lineno}:\${colno}\`]);
          return false;
        };

        window.addEventListener('unhandledrejection', function(event) {
          sendToParent('error', [\`Unhandled Promise Rejection: \${event.reason}\`]);
        });

        // Intercept tactile clicks & interactions
        document.addEventListener('click', function(e) {
          createVisualRipple(e.clientX, e.clientY);
          const interactive = e.target.closest('button, input, select, a, [role="button"], .pill, .tab, .check-btn, .btn, .card');
          if (interactive) {
            playTactileChime(700, 'sine', 0.08);
            const label = (interactive.textContent || interactive.value || interactive.getAttribute('aria-label') || interactive.id || interactive.className).trim().slice(0, 32);
            sendToParent('log', [\`[Interacted]: Clicked \${interactive.tagName.toLowerCase()} "\${label}"\`]);
          }
        }, true);

        // Listen for REPL evaluations and interactive controls from parent
        window.addEventListener('message', function(event) {
          if (!event.data || event.data.source !== 'studiox-parent') return;

          if (event.data.type === 'eval') {
            try {
              const result = eval(event.data.code);
              console.log('=>', result);
            } catch (err) {
              console.error('Eval Error:', err.message);
            }
          } else if (event.data.type === 'toggle-sound') {
            soundEnabled = Boolean(event.data.enabled);
            console.log('[Audio System]:', soundEnabled ? 'Interactive audio enabled' : 'Interactive audio muted');
          } else if (event.data.type === 'reset-state') {
            try {
              localStorage.clear();
              sessionStorage.clear();
              console.log('[System]: Sandboxed local state cleared. Reloading app...');
              window.location.reload();
            } catch(e) {
              console.error('Reset Error:', e.message);
            }
          } else if (event.data.type === 'interactive-demo') {
            // Auto-trigger an interactive demonstration
            const clickable = Array.from(document.querySelectorAll('button:not([disabled]), input[type="checkbox"], .pill:not(.active), .tab:not(.active)'));
            if (clickable.length > 0) {
              const item = clickable[Math.floor(Math.random() * clickable.length)];
              item.style.outline = '2px solid #38bdf8';
              item.style.transform = 'scale(1.08)';
              setTimeout(function() {
                item.click();
                item.style.outline = '';
                item.style.transform = '';
              }, 200);
            }
          }
        });
      })();
    </script>
  `;

  const safeJs = (js || '').replace(/<\/(script)/gi, '<\\/$1');

  // Check if html already contains <html> / <head> / <body> tags
  const hasHtmlTag = /<html[\s\S]*?>/i.test(html);
  const hasHeadTag = /<head[\s\S]*?>/i.test(html);
  const hasBodyTag = /<body[\s\S]*?>/i.test(html);

  if (hasHtmlTag && hasBodyTag) {
    let full = html;
    if (hasHeadTag) {
      full = full.replace(/<head[\s\S]*?>/i, (m) => `${m}\n${bridgeScript}\n${css ? `<style>\n${css}\n</style>\n` : ''}`);
    } else {
      full = `${bridgeScript}\n${css ? `<style>\n${css}\n</style>\n` : ''}${full}`;
    }

    if (safeJs.trim()) {
      const lowerFull = full.toLowerCase();
      const lastBodyClose = lowerFull.lastIndexOf('</body>');
      const scriptTag = `\n<script>\n${safeJs}\n</script>\n`;
      if (lastBodyClose !== -1) {
        full = `${full.slice(0, lastBodyClose)}${scriptTag}${full.slice(lastBodyClose)}`;
      } else {
        full = `${full}${scriptTag}`;
      }
    }
    return full;
  }

  // Otherwise, wrap cleanly in standard HTML5 template
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>StudioX Sandbox App</title>
  ${bridgeScript}
  <style>
    /* Default dark theme baseline */
    *, *::before, *::after {
      box-sizing: border-box;
    }
    body {
      margin: 0;
      padding: 0;
      background: #0f172a;
      color: #f8fafc;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      min-height: 100vh;
    }
    ${css}
  </style>
</head>
<body>
  ${html}
  ${safeJs.trim() ? `<script>\n${safeJs}\n</script>` : ''}
</body>
</html>`;
}

/**
 * Creates a secure Blob URL for the sandboxed app
 */
export function createSandboxBlobUrl(code: CodeState): string {
  const fullHtml = buildSandboxSrcDoc(code);
  const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' });
  return URL.createObjectURL(blob);
}
