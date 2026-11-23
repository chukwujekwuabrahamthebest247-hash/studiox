import { CodeState } from '../types';
import { getTemplateByPrompt, TEMPLATES } from './templates';

export interface CompilationResult {
  code: CodeState;
  source: 'template' | 'rule-engine' | 'ai';
  matchedTemplateName?: string;
  notes?: string;
}

/**
 * Local Rule-Based Code Generation Compiler
 * Analyzes natural language prompts and produces functional HTML/CSS/JS.
 */
import { analyzePromptIntent } from './intentParser';

export function compilePromptLocally(
  prompt: string,
  researchContext?: import('../types').ResearchFinding | null,
  existingCode?: CodeState,
  explicitTargetFile: import('../types').TargetFileScope = 'all',
  uploadedFile?: import('../types').UploadedFilePayload
): CompilationResult {
  let targetFile = explicitTargetFile;
  let baseCode = existingCode ? { ...existingCode } : { html: '', css: '', js: '' };

  if (uploadedFile && uploadedFile.content) {
    if (uploadedFile.name.endsWith('.html') || uploadedFile.type === 'html') {
      baseCode.html = uploadedFile.content;
      targetFile = 'index.html';
    } else if (uploadedFile.name.endsWith('.css') || uploadedFile.type === 'css') {
      baseCode.css = uploadedFile.content;
      targetFile = 'styles.css';
    } else if (uploadedFile.name.endsWith('.js') || uploadedFile.type === 'js') {
      baseCode.js = uploadedFile.content;
      targetFile = 'app.js';
    } else {
      baseCode.js = uploadedFile.content;
      targetFile = 'app.js';
    }
  }

  const intent = analyzePromptIntent(prompt, targetFile);
  const cleanPrompt = prompt.trim().toLowerCase();

  // If editing an existing app or a specific file
  const isEditIntent = Boolean(uploadedFile || (existingCode && (
    intent.isEdit ||
    intent.targetFile !== 'all'
  )));

  if (isEditIntent && (baseCode.html || baseCode.css || baseCode.js)) {
    const updated = applyLocalEdit(baseCode, prompt, intent.targetFile);
    const targetLabel = intent.targetFile !== 'all' ? ` [Target: ${intent.targetFile}]` : '';
    const partLabel = uploadedFile?.targetPart || intent.targetPart ? ` [Part: ${uploadedFile?.targetPart || intent.targetPart}]` : '';
    const researchLabel = intent.researchMode === 'without-research' ? ' (Without Research)' : '';
    return {
      code: updated,
      source: 'rule-engine',
      matchedTemplateName: `Edited App${targetLabel}`,
      notes: `Executed surgical edit${targetLabel}${partLabel}${researchLabel} based on: "${prompt}". 100% of other code preserved.`
    };
  }

  // 1. Check direct keyword match against full built-in templates
  const matchedTemplate = getTemplateByPrompt(cleanPrompt);
  if (matchedTemplate && !researchContext) {
    return {
      code: { ...matchedTemplate.code },
      source: 'template',
      matchedTemplateName: matchedTemplate.name,
      notes: `Matched rule for "${matchedTemplate.name}" based on prompt keywords.`
    };
  }

  // 2. Specialized local generators based on specific intent
  if ((cleanPrompt.includes('quiz') || cleanPrompt.includes('trivia') || cleanPrompt.includes('test')) && !researchContext) {
    return {
      code: generateQuizApp(prompt),
      source: 'rule-engine',
      matchedTemplateName: 'Interactive Trivia Quiz',
      notes: 'Generated dynamic Trivia Quiz engine.'
    };
  }

  if ((cleanPrompt.includes('counter') || cleanPrompt.includes('clicker') || cleanPrompt.includes('tally')) && !researchContext) {
    return {
      code: generateCounterApp(prompt),
      source: 'rule-engine',
      matchedTemplateName: 'Smart Multi-Counter & Tally',
      notes: 'Generated dynamic Multi-Counter engine.'
    };
  }

  if ((cleanPrompt.includes('note') || cleanPrompt.includes('scratchpad') || cleanPrompt.includes('memo')) && !researchContext) {
    return {
      code: generateNotesApp(prompt),
      source: 'rule-engine',
      matchedTemplateName: 'QuickNotes Scratchpad',
      notes: 'Generated dynamic Scratchpad engine.'
    };
  }

  // 3. Fallback dynamic synthesis: analyze prompt keywords to generate bespoke interactive app
  return {
    code: generateCustomInteractiveApp(prompt, researchContext),
    source: 'rule-engine',
    matchedTemplateName: researchContext
      ? `Outside-the-Box (${researchContext.provider.toUpperCase()} Researched)`
      : (matchedTemplate ? matchedTemplate.name : 'Dynamic Synthesized Web App'),
    notes: researchContext
      ? `Synthesized outside-the-box app grounded by ${researchContext.provider.toUpperCase()} web intelligence.`
      : 'Generated dynamic interactive interface tailored to prompt description.'
  };
}


function generateQuizApp(userPrompt: string): CodeState {
  return {
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Interactive Quiz</title>
</head>
<body>
  <div class="quiz-container">
    <div class="quiz-header">
      <div class="logo">🧠 MindQuest Quiz</div>
      <div class="progress-info">
        <span id="q-counter">Question 1/5</span>
        <div class="prog-bar"><div id="bar-fill" style="width: 20%"></div></div>
      </div>
    </div>

    <div id="quiz-card" class="card">
      <h3 id="question-text">Loading question...</h3>
      <div class="options-grid" id="options-container"></div>
      <div id="explanation-box" class="explanation" style="display: none;"></div>
      <button id="next-btn" class="btn" style="display: none;">Next Question →</button>
    </div>

    <div id="results-card" class="card" style="display: none; text-align: center;">
      <h2>Quiz Complete! 🎉</h2>
      <div class="final-score" id="final-score">0 / 5</div>
      <p id="score-msg">Well done on testing your knowledge!</p>
      <button id="restart-btn" class="btn">Take Quiz Again</button>
    </div>
  </div>
</body>
</html>`,
    css: `* { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
body { background: #0f172a; color: #f8fafc; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; }
.quiz-container { width: 100%; max-width: 600px; }
.quiz-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.logo { font-size: 20px; font-weight: 700; color: #38bdf8; }
.progress-info { text-align: right; }
#q-counter { font-size: 13px; color: #94a3b8; }
.prog-bar { width: 120px; height: 6px; background: #1e293b; border-radius: 9999px; overflow: hidden; margin-top: 4px; }
#bar-fill { height: 100%; background: #38bdf8; transition: width 0.3s; }
.card { background: #1e293b; border: 1px solid #334155; border-radius: 16px; padding: 28px; box-shadow: 0 10px 25px rgba(0,0,0,0.4); }
#question-text { font-size: 18px; line-height: 1.5; margin-bottom: 20px; }
.options-grid { display: flex; flex-direction: column; gap: 12px; }
.opt-btn { background: #0f172a; border: 1px solid #334155; color: #f8fafc; padding: 14px 18px; border-radius: 10px; font-size: 14px; text-align: left; cursor: pointer; transition: all 0.2s; }
.opt-btn:hover:not(:disabled) { border-color: #38bdf8; background: #182234; }
.opt-btn.correct { background: rgba(34, 197, 94, 0.2); border-color: #22c55e; color: #4ade80; }
.opt-btn.wrong { background: rgba(239, 68, 68, 0.2); border-color: #ef4444; color: #f87171; }
.explanation { margin-top: 16px; padding: 12px; background: #0f172a; border-left: 3px solid #38bdf8; border-radius: 6px; font-size: 13px; color: #cbd5e1; }
.btn { margin-top: 20px; width: 100%; padding: 12px; background: #38bdf8; color: #0f172a; border: none; border-radius: 10px; font-weight: 700; font-size: 14px; cursor: pointer; }
.btn:hover { background: #7dd3fc; }
.final-score { font-size: 48px; font-weight: 800; color: #38bdf8; margin: 16px 0; }`,
    js: `(function() {
  console.log("MindQuest Quiz system initialized.");
  const questions = [
    { q: "Which HTML element is used to link external JavaScript files?", options: ["<script>", "<js>", "<javascript>", "<link>"], answer: 0, why: "<script src='...'> is the standard tag for embedding or referencing executable client scripts." },
    { q: "In CSS Flexbox, which property aligns flex items along the cross axis?", options: ["justify-content", "align-items", "flex-direction", "align-content"], answer: 1, why: "align-items specifies the default alignment for items along the cross-axis." },
    { q: "What does the '=== ' operator evaluate in JavaScript?", options: ["Only value equality", "Strict equality (type & value)", "Memory address reference", "Type coercion match"], answer: 1, why: "Strict equality checks both operand types and their underlying values without coercion." },
    { q: "Which browser API enables saving data that persists across reloads?", options: ["sessionCookie", "localStorage", "cacheDOM", "stateStorage"], answer: 1, why: "localStorage maintains persistent key-value pairs without expiration." },
    { q: "What status code represents successful HTTP response?", options: ["404", "500", "200 OK", "301"], answer: 2, why: "200 OK indicates that the request succeeded." }
  ];

  let currentIdx = 0;
  let score = 0;

  function loadQ() {
    const q = questions[currentIdx];
    document.getElementById('q-counter').textContent = \`Question \${currentIdx + 1}/\${questions.length}\`;
    document.getElementById('bar-fill').style.width = \`\${((currentIdx + 1) / questions.length) * 100}%\`;
    document.getElementById('question-text').textContent = q.q;
    document.getElementById('explanation-box').style.display = 'none';
    document.getElementById('next-btn').style.display = 'none';

    const optsEl = document.getElementById('options-container');
    optsEl.innerHTML = q.options.map((opt, i) => \`
      <button class="opt-btn" onclick="window.pickOption(\${i})">\${opt}</button>
    \`).join('');
  }

  window.pickOption = function(idx) {
    const q = questions[currentIdx];
    const buttons = document.querySelectorAll('.opt-btn');
    buttons.forEach((b, i) => {
      b.disabled = true;
      if (i === q.answer) b.classList.add('correct');
      if (i === idx && idx !== q.answer) b.classList.add('wrong');
    });

    if (idx === q.answer) {
      score++;
      console.log(\`Correct answer selected for Q\${currentIdx + 1}!\`);
    } else {
      console.warn(\`Incorrect answer selected for Q\${currentIdx + 1}.\`);
    }

    const exp = document.getElementById('explanation-box');
    exp.textContent = "💡 " + q.why;
    exp.style.display = 'block';
    document.getElementById('next-btn').style.display = 'block';
  };

  document.getElementById('next-btn').onclick = () => {
    currentIdx++;
    if (currentIdx < questions.length) {
      loadQ();
    } else {
      showResults();
    }
  };

  function showResults() {
    document.getElementById('quiz-card').style.display = 'none';
    document.getElementById('results-card').style.display = 'block';
    document.getElementById('final-score').textContent = \`\${score} / \${questions.length}\`;
    console.log(\`Quiz completed with final score: \${score}/\${questions.length}\`);
  }

  document.getElementById('restart-btn').onclick = () => {
    currentIdx = 0;
    score = 0;
    document.getElementById('quiz-card').style.display = 'block';
    document.getElementById('results-card').style.display = 'none';
    loadQ();
  };

  loadQ();
})();`
  };
}

function generateCounterApp(userPrompt: string): CodeState {
  return {
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Smart Tally Counter</title>
</head>
<body>
  <div class="counter-app">
    <header class="header">
      <h2>🔢 TallyFlow Counter</h2>
      <button id="add-counter-btn" class="btn-sm">+ New Counter</button>
    </header>
    <div id="counters-grid" class="counters-grid"></div>
  </div>
</body>
</html>`,
    css: `* { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
body { background: #0b1120; color: #f8fafc; min-height: 100vh; display: flex; justify-content: center; padding: 24px 16px; }
.counter-app { width: 100%; max-width: 720px; }
.header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
.header h2 { font-size: 20px; color: #38bdf8; }
.btn-sm { background: #38bdf8; color: #0b1120; border: none; padding: 8px 14px; border-radius: 8px; font-weight: 600; cursor: pointer; }
.counters-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }
.tally-card { background: #1e293b; border: 1px solid #334155; border-radius: 16px; padding: 20px; display: flex; flex-direction: column; align-items: center; }
.tally-title { font-size: 15px; font-weight: 600; margin-bottom: 12px; color: #cbd5e1; }
.tally-val { font-size: 52px; font-weight: 800; color: #38bdf8; margin-bottom: 16px; }
.tally-controls { display: flex; gap: 10px; width: 100%; }
.ctrl-btn { flex: 1; padding: 12px; border: none; border-radius: 10px; font-size: 18px; font-weight: 700; cursor: pointer; transition: transform 0.1s; }
.ctrl-btn:active { transform: scale(0.95); }
.btn-dec { background: #334155; color: #fff; }
.btn-inc { background: #2563eb; color: #fff; }
.btn-rst { background: transparent; border: 1px solid #334155; color: #64748b; font-size: 13px; }`,
    js: `(function() {
  console.log("TallyFlow Counter initialized.");
  let counters = [
    { id: '1', title: 'Coffee Cups ☕', count: 2, step: 1 },
    { id: '2', title: 'Daily Pushups 💪', count: 35, step: 5 },
    { id: '3', title: 'Code Commits 💻', count: 8, step: 1 }
  ];

  function render() {
    const grid = document.getElementById('counters-grid');
    grid.innerHTML = counters.map(c => \`
      <div class="tally-card">
        <div class="tally-title">\${c.title}</div>
        <div class="tally-val">\${c.count}</div>
        <div class="tally-controls">
          <button class="ctrl-btn btn-dec" onclick="window.stepCounter('\${c.id}', -\${c.step})">−</button>
          <button class="ctrl-btn btn-rst" onclick="window.resetCounter('\${c.id}')">Reset</button>
          <button class="ctrl-btn btn-inc" onclick="window.stepCounter('\${c.id}', \${c.step})">+</button>
        </div>
      </div>
    \`).join('');
  }

  window.stepCounter = function(id, delta) {
    counters = counters.map(c => c.id === id ? { ...c, count: Math.max(0, c.count + delta) } : c);
    console.log(\`Counter updated:\`, counters.find(c => c.id === id));
    render();
  };

  window.resetCounter = function(id) {
    counters = counters.map(c => c.id === id ? { ...c, count: 0 } : c);
    render();
  };

  document.getElementById('add-counter-btn').onclick = () => {
    const title = prompt("Counter name:", "New Counter");
    if (title) {
      counters.push({ id: Date.now().toString(), title, count: 0, step: 1 });
      console.log("Added counter:", title);
      render();
    }
  };

  render();
})();`
  };
}

function generateNotesApp(userPrompt: string): CodeState {
  return {
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>QuickNotes Scratchpad</title>
</head>
<body>
  <div class="notes-app">
    <div class="sidebar">
      <div class="sidebar-top">
        <h3>📝 QuickNotes</h3>
        <button id="new-note-btn">+ New</button>
      </div>
      <div id="notes-list" class="notes-list"></div>
    </div>
    <div class="editor-pane">
      <div class="editor-toolbar">
        <input type="text" id="note-title-input" placeholder="Note Title..." />
        <button id="del-current-btn" class="del-btn">Delete Note</button>
      </div>
      <textarea id="note-body-input" placeholder="Type your thoughts, ideas, or markdown here..."></textarea>
      <div class="status-footer">
        <span id="char-count">0 words</span>
        <span id="save-status">Auto-saved</span>
      </div>
    </div>
  </div>
</body>
</html>`,
    css: `* { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
body { background: #0f172a; color: #f8fafc; height: 100vh; overflow: hidden; }
.notes-app { display: flex; height: 100vh; }
.sidebar { width: 260px; background: #131b2e; border-right: 1px solid #1e293b; display: flex; flex-direction: column; }
.sidebar-top { padding: 16px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #1e293b; }
.sidebar-top h3 { font-size: 15px; color: #38bdf8; }
.sidebar-top button { background: #2563eb; color: #fff; border: none; padding: 6px 12px; border-radius: 6px; font-size: 12px; cursor: pointer; }
.notes-list { flex: 1; overflow-y: auto; padding: 10px; display: flex; flex-direction: column; gap: 6px; }
.note-item { padding: 10px 12px; border-radius: 8px; cursor: pointer; background: #0b1120; border: 1px solid transparent; }
.note-item.active { border-color: #38bdf8; background: #1a253c; }
.note-item-title { font-size: 13px; font-weight: 600; margin-bottom: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.note-item-preview { font-size: 11px; color: #64748b; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.editor-pane { flex: 1; display: flex; flex-direction: column; background: #0b1120; }
.editor-toolbar { padding: 14px 20px; border-bottom: 1px solid #1e293b; display: flex; justify-content: space-between; align-items: center; gap: 12px; }
#note-title-input { flex: 1; background: transparent; border: none; color: #fff; font-size: 18px; font-weight: 700; outline: none; }
.del-btn { background: transparent; border: 1px solid #ef4444; color: #ef4444; padding: 6px 10px; border-radius: 6px; font-size: 12px; cursor: pointer; }
#note-body-input { flex: 1; background: transparent; border: none; padding: 20px; color: #e2e8f0; font-size: 14px; line-height: 1.6; resize: none; outline: none; }
.status-footer { padding: 8px 20px; background: #131b2e; border-top: 1px solid #1e293b; display: flex; justify-content: space-between; font-size: 11px; color: #64748b; }`,
    js: `(function() {
  console.log("QuickNotes Scratchpad engine ready.");
  const STORAGE_KEY = 'studiox_notes_data';
  const defaultNotes = [
    { id: '1', title: 'Project Blueprint', body: 'StudioX enables real-time client sandboxing with responsive iframe execution.\\n\\nKey features:\\n- Live code editor mirroring\\n- Rule-based prompt compiler\\n- OpenRouter Nemotron 3.5 support' },
    { id: '2', title: 'Architecture Decisions', body: 'Keep state cleanly synchronized between editor tabs and iframe srcDoc sandbox.' }
  ];

  let notes = JSON.parse(localStorage.getItem(STORAGE_KEY) || JSON.stringify(defaultNotes));
  let activeId = notes[0]?.id || null;

  const listEl = document.getElementById('notes-list');
  const titleInput = document.getElementById('note-title-input');
  const bodyInput = document.getElementById('note-body-input');
  const wordCountEl = document.getElementById('char-count');

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  }

  function renderList() {
    listEl.innerHTML = notes.map(n => \`
      <div class="note-item \${n.id === activeId ? 'active' : ''}" onclick="window.selectNote('\${n.id}')">
        <div class="note-item-title">\${n.title || 'Untitled'}</div>
        <div class="note-item-preview">\${(n.body || '').replace(/\\n/g, ' ')}</div>
      </div>
    \`).join('');
  }

  function updateEditor() {
    const cur = notes.find(n => n.id === activeId);
    if (cur) {
      titleInput.value = cur.title;
      bodyInput.value = cur.body;
      const words = cur.body.trim() ? cur.body.trim().split(/\\s+/).length : 0;
      wordCountEl.textContent = \`\${words} words\`;
    }
  }

  window.selectNote = function(id) {
    activeId = id;
    renderList();
    updateEditor();
  };

  titleInput.oninput = (e) => {
    const cur = notes.find(n => n.id === activeId);
    if (cur) {
      cur.title = e.target.value;
      save();
      renderList();
    }
  };

  bodyInput.oninput = (e) => {
    const cur = notes.find(n => n.id === activeId);
    if (cur) {
      cur.body = e.target.value;
      const words = cur.body.trim() ? cur.body.trim().split(/\\s+/).length : 0;
      wordCountEl.textContent = \`\${words} words\`;
      save();
      renderList();
    }
  };

  document.getElementById('new-note-btn').onclick = () => {
    const newNote = { id: Date.now().toString(), title: 'Untitled Note', body: '' };
    notes.unshift(newNote);
    activeId = newNote.id;
    save();
    renderList();
    updateEditor();
    titleInput.focus();
    console.log("Created note:", newNote.id);
  };

  document.getElementById('del-current-btn').onclick = () => {
    if (notes.length <= 1) return;
    notes = notes.filter(n => n.id !== activeId);
    activeId = notes[0].id;
    save();
    renderList();
    updateEditor();
    console.log("Deleted note");
  };

  renderList();
  updateEditor();
})();`
  };
}

function generateCustomInteractiveApp(
  userPrompt: string,
  researchContext?: import('../types').ResearchFinding | null
): CodeState {
  const safeTitle = userPrompt.length > 35 ? userPrompt.slice(0, 35) + '...' : userPrompt;
  const hasResearch = Boolean(researchContext);

  const researchSummaryHtml = hasResearch ? `
    <div class="research-highlight-card">
      <div class="research-header">
        <span class="research-tag">🧠 OUTSIDE-THE-BOX RESEARCH [${researchContext!.provider.toUpperCase()}]</span>
        <span class="research-time">${researchContext!.timestamp}</span>
      </div>
      <p class="research-summary-text">${escapeXml(researchContext!.summary)}</p>
      <div class="research-sources-grid">
        ${researchContext!.results.map(r => `
          <div class="source-chip" title="${escapeXml(r.snippet)}">
            <span class="source-icon">🌐</span>
            <div class="source-info">
              <span class="source-title">${escapeXml(r.title)}</span>
              <span class="source-snippet">${escapeXml(r.snippet.slice(0, 80))}...</span>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  ` : '';

  return {
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeXml(safeTitle)}</title>
</head>
<body>
  <div class="container">
    <header class="app-header">
      <div class="badge">${hasResearch ? '🧠 Grounded Web Intelligence' : '🚀 StudioX Generated'}</div>
      <h1>${escapeXml(safeTitle)}</h1>
      <p class="subtitle">${hasResearch ? 'Synthesized with outside-the-box research' : `Generated from prompt: "${escapeXml(userPrompt)}"`}</p>
    </header>

    ${researchSummaryHtml}

    <div class="interactive-card">
      <div class="card-hero">
        <span class="status-indicator">● Active Workspace</span>
        <div class="display-metric" id="counter-value">0</div>
        <span class="metric-caption">Dynamic Interactions</span>
      </div>

      <div class="action-grid">
        <button id="primary-action-btn" class="btn btn-primary">⚡ Execute Primary Action</button>
        <button id="secondary-action-btn" class="btn btn-secondary">Shift Color Theme</button>
        <button id="reset-action-btn" class="btn btn-outline">Reset Telemetry</button>
      </div>

      <div class="activity-feed">
        <h4>Live Sandbox Telemetry & Insights</h4>
        <div id="events-log" class="events-log">
          <div class="log-entry">${hasResearch ? 'Out-of-the-box research applied to workspace.' : 'App compiled and mounted successfully.'}</div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`,
    css: `* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}

body {
  background: #090e17;
  color: #f8fafc;
  min-height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 24px 16px;
}

.container {
  width: 100%;
  max-width: 640px;
}

.app-header {
  text-align: center;
  margin-bottom: 24px;
}

.badge {
  display: inline-block;
  background: rgba(56, 189, 248, 0.15);
  color: #38bdf8;
  border: 1px solid rgba(56, 189, 248, 0.3);
  font-size: 11px;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 9999px;
  margin-bottom: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

h1 {
  font-size: 26px;
  font-weight: 700;
  color: #ffffff;
  margin-bottom: 6px;
}

.subtitle {
  font-size: 13px;
  color: #94a3b8;
}

.research-highlight-card {
  background: rgba(30, 41, 59, 0.7);
  border: 1px solid rgba(56, 189, 248, 0.4);
  border-radius: 14px;
  padding: 16px 20px;
  margin-bottom: 20px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

.research-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.research-tag {
  font-size: 11px;
  font-weight: 700;
  color: #38bdf8;
  letter-spacing: 0.5px;
}

.research-time {
  font-size: 11px;
  color: #64748b;
}

.research-summary-text {
  font-size: 13px;
  line-height: 1.5;
  color: #cbd5e1;
  margin-bottom: 12px;
}

.research-sources-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 8px;
}

.source-chip {
  background: #090e17;
  border: 1px solid #1e293b;
  border-radius: 8px;
  padding: 8px 10px;
  display: flex;
  gap: 8px;
  align-items: center;
}

.source-icon {
  font-size: 14px;
}

.source-info {
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.source-title {
  font-size: 11px;
  font-weight: 600;
  color: #f1f5f9;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.source-snippet {
  font-size: 10px;
  color: #64748b;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.interactive-card {
  background: #111a2d;
  border: 1px solid #1e2c48;
  border-radius: 20px;
  padding: 28px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
}

.card-hero {
  text-align: center;
  background: #090e17;
  border: 1px solid #1c273e;
  border-radius: 14px;
  padding: 24px;
  margin-bottom: 24px;
}

.status-indicator {
  font-size: 12px;
  color: #22c55e;
  font-weight: 500;
}

.display-metric {
  font-size: 56px;
  font-weight: 800;
  color: #38bdf8;
  margin: 10px 0;
  font-variant-numeric: tabular-nums;
  transition: color 0.3s;
}

.metric-caption {
  font-size: 12px;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.action-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 12px;
  margin-bottom: 24px;
}

.btn {
  padding: 12px 18px;
  border-radius: 10px;
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
}

.btn:active {
  transform: scale(0.97);
}

.btn-primary {
  background: #38bdf8;
  color: #090e17;
}

.btn-primary:hover {
  background: #7dd3fc;
}

.btn-secondary {
  background: #1e2c48;
  color: #f1f5f9;
}

.btn-secondary:hover {
  background: #2a3d63;
}

.btn-outline {
  background: transparent;
  border: 1px solid #334155;
  color: #94a3b8;
}

.btn-outline:hover {
  border-color: #ef4444;
  color: #ef4444;
}

.activity-feed {
  border-top: 1px solid #1e2c48;
  padding-top: 16px;
}

.activity-feed h4 {
  font-size: 12px;
  color: #64748b;
  text-transform: uppercase;
  margin-bottom: 10px;
}

.events-log {
  max-height: 140px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.log-entry {
  font-size: 12px;
  color: #94a3b8;
  background: #090e17;
  padding: 6px 10px;
  border-radius: 6px;
  border-left: 2px solid #38bdf8;
}`,
    js: `(function () {
  console.log("Synthesized application initialized for: \\"${userPrompt.replace(/"/g, '\\"')}\\"");

  let count = 0;
  const colors = ['#38bdf8', '#818cf8', '#34d399', '#f472b6', '#fbbf24'];
  let colorIdx = 0;

  const displayEl = document.getElementById('counter-value');
  const logEl = document.getElementById('events-log');

  function logEvent(msg) {
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    const time = new Date().toLocaleTimeString();
    entry.textContent = \`[\${time}] \${msg}\`;
    logEl.prepend(entry);
    console.log("StudioX Sandbox Event:", msg);
  }

  document.getElementById('primary-action-btn').addEventListener('click', () => {
    count++;
    displayEl.textContent = count;
    logEvent(\`Action triggered (Value = \${count})\`);
  });

  document.getElementById('secondary-action-btn').addEventListener('click', () => {
    colorIdx = (colorIdx + 1) % colors.length;
    displayEl.style.color = colors[colorIdx];
    logEvent(\`Accent color shifted to \${colors[colorIdx]}\`);
  });

  document.getElementById('reset-action-btn').addEventListener('click', () => {
    count = 0;
    displayEl.textContent = 0;
    logEvent("State reset to initial values");
  });
})();`
  };
}

function applyLocalEdit(
  code: CodeState, 
  prompt: string, 
  targetFile: import('../types').TargetFileScope = 'all'
): CodeState {
  let { html, css, js } = code;
  const p = prompt.toLowerCase();

  // 0. Surgical "from X to Y" color replacement (e.g. "change color from green to black")
  const colorSwapMatch = p.match(/(?:from\s+)?(green|emerald|teal|blue|cyan|purple|violet|red|rose|amber|yellow|orange)\s+to\s+(black|white|red|blue|green|emerald|purple|amber|slate|zinc)/i);
  if (colorSwapMatch) {
    const fromColor = colorSwapMatch[1].toLowerCase();
    const toColor = colorSwapMatch[2].toLowerCase();
    const fromRegex = fromColor === 'green' || fromColor === 'emerald'
      ? /\b(emerald|green|teal)-(\d{2,3})\b/g
      : new RegExp(`\\b${fromColor}-(\\d{2,3})\\b`, 'g');

    const replaceTailwind = (text: string) => {
      if (toColor === 'black') {
        return text.replace(fromRegex, (_m, _c, shade) => {
          const num = parseInt(shade, 10);
          return num >= 700 ? 'zinc-950' : num >= 400 ? 'zinc-900' : 'zinc-800';
        });
      }
      return text.replace(fromRegex, `${toColor}-$2`);
    };

    return {
      html: replaceTailwind(html),
      css: replaceTailwind(css),
      js: replaceTailwind(js)
    };
  }

  const allowCss = targetFile === 'all' || targetFile === 'styles.css';
  const allowJs = targetFile === 'all' || targetFile === 'app.js';
  const allowHtml = targetFile === 'all' || targetFile === 'index.html';

  // 1. Color / Theme changes (CSS)
  if (allowCss) {
    if (p.includes('emerald') || p.includes('green')) {
      css += `\n/* User Edit: Emerald Accent */\n:root { --accent: #10b981; }\nbutton.btn-primary, .pill.active, .highlight { background: #10b981 !important; color: #052e16 !important; }\n`;
    } else if (p.includes('purple') || p.includes('violet')) {
      css += `\n/* User Edit: Purple Accent */\n:root { --accent: #a855f7; }\nbutton.btn-primary, .pill.active, .highlight { background: #a855f7 !important; color: #ffffff !important; }\n`;
    } else if (p.includes('amber') || p.includes('yellow') || p.includes('orange')) {
      css += `\n/* User Edit: Amber Accent */\n:root { --accent: #f59e0b; }\nbutton.btn-primary, .pill.active, .highlight { background: #f59e0b !important; color: #000000 !important; }\n`;
    } else if (p.includes('red') || p.includes('crimson') || p.includes('rose')) {
      css += `\n/* User Edit: Rose Accent */\n:root { --accent: #f43f5e; }\nbutton.btn-primary, .pill.active, .highlight { background: #f43f5e !important; color: #ffffff !important; }\n`;
    } else if (p.includes('blue') || p.includes('cyan')) {
      css += `\n/* User Edit: Cyan Accent */\n:root { --accent: #06b6d4; }\nbutton.btn-primary, .pill.active, .highlight { background: #06b6d4 !important; color: #082f49 !important; }\n`;
    }

    // Light / Dark mode adjustment
    if (p.includes('light mode') || p.includes('light theme')) {
      css += `\n/* User Edit: Light Mode */\nbody { background: #f8fafc !important; color: #0f172a !important; }\n.app-container, .card, .calculator, .interactive-card { background: #ffffff !important; border-color: #cbd5e1 !important; color: #0f172a !important; }\n`;
    } else if (p.includes('dark mode') || p.includes('dark theme') || p.includes('cyber')) {
      css += `\n/* User Edit: Dark Cyber Theme */\nbody { background: #090d16 !important; color: #f1f5f9 !important; }\n.app-container, .card, .calculator { background: #0f172a !important; border-color: #1e293b !important; }\n`;
    }

    // Glassmorphism
    if (p.includes('glass') || p.includes('blur')) {
      css += `\n/* User Edit: Glassmorphism */\n.card, .app-container, .calculator, .modal { background: rgba(15, 23, 42, 0.75) !important; backdrop-filter: blur(12px) !important; -webkit-backdrop-filter: blur(12px) !important; border: 1px solid rgba(255, 255, 255, 0.12) !important; }\n`;
    }

    // Rounded / Pill Tweaks
    if (p.includes('rounded') || p.includes('border-radius') || p.includes('pill')) {
      css += `\n/* User Edit: Extra Rounded Radii */\nbutton, .card, input, select { border-radius: 9999px !important; }\n`;
    }

    // Size tweaks
    if (p.includes('larger font') || p.includes('bigger text')) {
      css += `\n/* User Edit: Font Scale */\nbody { font-size: 110% !important; }\n`;
    }

    // Glow / Cyber Animation
    if (p.includes('glow') || p.includes('neon') || p.includes('shadow')) {
      css += `\n/* User Edit: Cyber Glow Effect */
button, .card, .app-container {
  box-shadow: 0 0 20px rgba(56, 189, 248, 0.35) !important;
  transition: all 0.2s ease-in-out !important;
}
button:hover {
  box-shadow: 0 0 30px rgba(56, 189, 248, 0.7) !important;
  transform: translateY(-2px) !important;
}\n`;
    }
  }

  // 2. HTML Structure Modifications
  if (allowHtml) {
    if (p.includes('header') || p.includes('banner') || p.includes('title')) {
      const bannerTitle = prompt.replace(/(edit|index\.html|html|without|researching|research|add|header|banner|title|:)/gi, '').trim() || 'Welcome to Applet';
      if (html.includes('<body') && html.includes('</body>')) {
        html = html.replace(/<body[^>]*>/i, `$&
    <div style="background: linear-gradient(90deg, #0284c7, #6366f1); padding: 10px 16px; color: white; display: flex; align-items: center; justify-content: space-between; font-family: sans-serif; font-size: 13px; font-weight: bold; border-radius: 8px; margin: 8px;">
      <span>✨ ${escapeXml(bannerTitle)}</span>
      <span style="font-size: 11px; opacity: 0.85;">Live Sandbox</span>
    </div>`);
      }
    }
  }

  // 3. JavaScript Interactivity Modifications
  if (allowJs || allowHtml) {
    if (p.includes('button') || p.includes('action') || p.includes('feature')) {
      const editId = `btn_${Date.now()}`;
      const btnLabel = prompt.replace(/(edit|app\.js|styles\.css|without|researching|research|button|action|add|feature|:)/gi, '').trim().slice(0, 24) || 'Interactive Action';
      
      if (allowHtml && html.includes('</div>')) {
        html = html.replace(/<\/div>(?![\s\S]*<\/div>)/i, `
        <div style="margin-top: 14px; text-align: center;">
          <button id="${editId}" style="padding: 10px 18px; background: #38bdf8; color: #0f172a; border: none; border-radius: 8px; font-weight: bold; cursor: pointer; transition: transform 0.1s;">
            ⚡ ${escapeXml(btnLabel)}
          </button>
        </div>
      </div>`);
      }

      if (allowJs) {
        js += `\n// User Prompt Edit: Action Listener\n(function() {\n  const el = document.getElementById("${editId}");\n  if (el) {\n    el.addEventListener("click", function() {\n      console.log("Action triggered: ${btnLabel}");\n    });\n  }\n})();\n`;
      }
    }
  }

  // 4. Sound / Audio Feedback (JS)
  if (allowJs) {
    if (p.includes('sound') || p.includes('audio') || p.includes('chime') || p.includes('beep')) {
      js += `\n// User Prompt Edit: Synthesized Audio Chime
(function() {
  function playBeep(freq = 587.33, dur = 0.15) {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + dur);
    } catch(e) { console.warn('Audio not available:', e); }
  }
  document.addEventListener('click', function(e) {
    if (e.target && (e.target.tagName === 'BUTTON' || e.target.classList.contains('pill') || e.target.type === 'checkbox')) {
      playBeep(659.25, 0.12);
    }
  });
  console.log("🔊 Audio chime enabled across application controls.");
})();\n`;
    }

    // LocalStorage State Reset / Clear
    if (p.includes('reset') || p.includes('clear')) {
      js += `\n// User Prompt Edit: Reset LocalStorage & State
(function() {
  console.log("🔄 Reset handler registered. Cleared cached application state.");
  window.addEventListener('keydown', function(e) {
    if (e.key === 'r' && (e.ctrlKey || e.metaKey)) {
      localStorage.clear();
      console.log("Cleared localStorage state.");
    }
  });
})();\n`;
    }
  }

  return { html, css, js };
}

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}
