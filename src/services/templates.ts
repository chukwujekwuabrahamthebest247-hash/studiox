import { TemplateApp } from '../types';

export const TEMPLATES: TemplateApp[] = [
  {
    id: 'habit-tracker',
    name: 'Habit Tracker Pro',
    category: 'Productivity',
    keywords: ['habit', 'tracker', 'streak', 'routine', 'goal', 'discipline'],
    description: 'Interactive habit tracker with daily checklist, streaks, progress rings, and localStorage persistence.',
    code: {
      html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Habit Tracker</title>
</head>
<body>
  <div class="app-container">
    <header class="header">
      <div class="header-left">
        <div class="logo-icon">🔥</div>
        <div>
          <h1>HabitFlow</h1>
          <p class="subtitle">Daily Habit & Momentum Tracker</p>
        </div>
      </div>
      <div class="header-stats">
        <div class="stat-badge">
          <span class="stat-number" id="overall-completion">0%</span>
          <span class="stat-label">Today's Progress</span>
        </div>
        <div class="stat-badge">
          <span class="stat-number" id="best-streak">0 🔥</span>
          <span class="stat-label">Max Streak</span>
        </div>
      </div>
    </header>

    <div class="progress-bar-container">
      <div class="progress-fill" id="progress-fill" style="width: 0%"></div>
    </div>

    <!-- Quick Add Form -->
    <form id="add-habit-form" class="add-box">
      <input type="text" id="habit-name-input" placeholder="Add a new daily habit (e.g., Read 20 pages, 30m Workout...)" required autocomplete="off" />
      <select id="habit-category-select">
        <option value="Health">🧘 Health</option>
        <option value="Learning">📚 Learning</option>
        <option value="Productivity">⚡ Productivity</option>
        <option value="Mindset">💡 Mindset</option>
      </select>
      <button type="submit" class="btn-primary">
        <span>+ Add Habit</span>
      </button>
    </form>

    <!-- Filters & Actions -->
    <div class="toolbar">
      <div class="filter-pills" id="category-filters">
        <button class="pill active" data-cat="all">All Habits</button>
        <button class="pill" data-cat="Health">🧘 Health</button>
        <button class="pill" data-cat="Learning">📚 Learning</button>
        <button class="pill" data-cat="Productivity">⚡ Productivity</button>
        <button class="pill" data-cat="Mindset">💡 Mindset</button>
      </div>
      <button id="reset-today-btn" class="btn-secondary" title="Reset Today's Checkmarks">Reset Today</button>
    </div>

    <!-- Habits List -->
    <div id="habits-list" class="habits-grid">
      <!-- Injected via JavaScript -->
    </div>

    <!-- Empty State -->
    <div id="empty-state" class="empty-state" style="display: none;">
      <div class="empty-icon">🌱</div>
      <h3>No habits tracked yet</h3>
      <p>Start small! Add a simple habit above to begin building your daily momentum.</p>
    </div>
  </div>
</body>
</html>`,
      css: `* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}

body {
  background: #0f172a;
  color: #f8fafc;
  min-height: 100vh;
  padding: 24px 16px;
  display: flex;
  justify-content: center;
}

.app-container {
  width: 100%;
  max-width: 800px;
  background: #1e293b;
  border-radius: 16px;
  padding: 28px;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5);
  border: 1px solid #334155;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  flex-wrap: wrap;
  gap: 16px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.logo-icon {
  font-size: 32px;
  background: rgba(249, 115, 22, 0.15);
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  border: 1px solid rgba(249, 115, 22, 0.3);
}

h1 {
  font-size: 24px;
  font-weight: 700;
  color: #f1f5f9;
  letter-spacing: -0.5px;
}

.subtitle {
  font-size: 13px;
  color: #94a3b8;
}

.header-stats {
  display: flex;
  gap: 12px;
}

.stat-badge {
  background: #0f172a;
  padding: 8px 14px;
  border-radius: 10px;
  border: 1px solid #334155;
  text-align: right;
}

.stat-number {
  display: block;
  font-size: 18px;
  font-weight: 700;
  color: #38bdf8;
}

.stat-label {
  font-size: 11px;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.progress-bar-container {
  height: 8px;
  background: #0f172a;
  border-radius: 9999px;
  overflow: hidden;
  margin-bottom: 24px;
  border: 1px solid #334155;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #38bdf8, #818cf8, #a855f7);
  transition: width 0.4s ease;
}

.add-box {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.add-box input {
  flex: 1;
  min-width: 240px;
  padding: 12px 16px;
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 10px;
  color: #f8fafc;
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s;
}

.add-box input:focus {
  border-color: #38bdf8;
}

.add-box select {
  padding: 12px 14px;
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 10px;
  color: #f8fafc;
  font-size: 14px;
  outline: none;
  cursor: pointer;
}

.btn-primary {
  padding: 12px 20px;
  background: #38bdf8;
  color: #0f172a;
  border: none;
  border-radius: 10px;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.2s, transform 0.1s;
}

.btn-primary:hover {
  background: #7dd3fc;
}

.btn-primary:active {
  transform: scale(0.98);
}

.btn-secondary {
  padding: 8px 14px;
  background: #334155;
  color: #cbd5e1;
  border: none;
  border-radius: 8px;
  font-size: 12px;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-secondary:hover {
  background: #475569;
  color: #fff;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  gap: 12px;
  flex-wrap: wrap;
}

.filter-pills {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 4px;
}

.pill {
  background: #0f172a;
  color: #94a3b8;
  border: 1px solid #334155;
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.pill.active, .pill:hover {
  background: #334155;
  color: #f8fafc;
  border-color: #475569;
}

.habits-grid {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.habit-card {
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 12px;
  padding: 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: transform 0.15s, border-color 0.15s, background 0.15s;
}

.habit-card:hover {
  border-color: #475569;
  transform: translateY(-1px);
}

.habit-card.completed {
  border-color: rgba(34, 197, 94, 0.4);
  background: rgba(34, 197, 94, 0.05);
}

.habit-left {
  display: flex;
  align-items: center;
  gap: 14px;
}

.check-btn {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 2px solid #64748b;
  background: transparent;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  color: transparent;
  transition: all 0.2s;
}

.check-btn:hover {
  border-color: #22c55e;
}

.habit-card.completed .check-btn {
  background: #22c55e;
  border-color: #22c55e;
  color: #0f172a;
}

.habit-details h4 {
  font-size: 15px;
  font-weight: 600;
  color: #f8fafc;
  margin-bottom: 4px;
}

.habit-card.completed .habit-details h4 {
  text-decoration: line-through;
  color: #94a3b8;
}

.habit-meta {
  display: flex;
  gap: 8px;
  font-size: 12px;
}

.tag {
  background: #1e293b;
  padding: 2px 8px;
  border-radius: 4px;
  color: #94a3b8;
  font-size: 11px;
}

.streak-tag {
  color: #f97316;
  font-weight: 600;
}

.habit-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.delete-btn {
  background: transparent;
  border: none;
  color: #64748b;
  cursor: pointer;
  padding: 6px;
  border-radius: 6px;
  transition: color 0.2s, background 0.2s;
}

.delete-btn:hover {
  color: #ef4444;
  background: rgba(239, 68, 68, 0.1);
}

.empty-state {
  text-align: center;
  padding: 40px 20px;
  color: #64748b;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 12px;
}

.empty-state h3 {
  font-size: 16px;
  color: #cbd5e1;
  margin-bottom: 6px;
}`,
      js: `// HabitFlow Live Script
(function () {
  console.log("HabitFlow engine initialized.");

  const STORAGE_KEY = 'studiox_habits_data_v1';
  let activeFilter = 'all';

  // Default seed habits if storage is empty
  const defaultHabits = [
    { id: '1', name: 'Morning hydration (500ml water)', category: 'Health', streak: 4, completedToday: true },
    { id: '2', name: 'Read 20 pages of non-fiction', category: 'Learning', streak: 12, completedToday: false },
    { id: '3', name: 'Deep work focus sprint (90 mins)', category: 'Productivity', streak: 7, completedToday: true },
    { id: '4', name: '5 minutes of evening reflection', category: 'Mindset', streak: 3, completedToday: false }
  ];

  function loadHabits() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : defaultHabits;
    } catch (err) {
      console.warn("Could not read localStorage, fallback to defaults", err);
      return defaultHabits;
    }
  }

  function saveHabits(habits) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(habits));
    } catch (err) {
      console.error("Storage save error:", err);
    }
  }

  let habits = loadHabits();

  // Play subtle audio sound when completing habit
  function playSuccessTone() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    } catch (e) {
      // AudioContext may be blocked before gesture
    }
  }

  function render() {
    const listEl = document.getElementById('habits-list');
    const emptyEl = document.getElementById('empty-state');
    const overallEl = document.getElementById('overall-completion');
    const bestStreakEl = document.getElementById('best-streak');
    const progressFill = document.getElementById('progress-fill');

    const filtered = activeFilter === 'all' 
      ? habits 
      : habits.filter(h => h.category === activeFilter);

    if (filtered.length === 0) {
      listEl.innerHTML = '';
      emptyEl.style.display = 'block';
    } else {
      emptyEl.style.display = 'none';
      listEl.innerHTML = filtered.map(habit => {
        return \`
          <div class="habit-card \${habit.completedToday ? 'completed' : ''}" data-id="\${habit.id}">
            <div class="habit-left">
              <button class="check-btn" onclick="window.toggleHabit('\${habit.id}')" title="Mark Done">
                ✓
              </button>
              <div class="habit-details">
                <h4>\${escapeHtml(habit.name)}</h4>
                <div class="habit-meta">
                  <span class="tag">\${habit.category}</span>
                  <span class="streak-tag">🔥 \${habit.streak} day streak</span>
                </div>
              </div>
            </div>
            <div class="habit-actions">
              <button class="delete-btn" onclick="window.deleteHabit('\${habit.id}')" title="Delete Habit">
                ✕
              </button>
            </div>
          </div>
        \`;
      }).join('');
    }

    // Update Stats
    const total = habits.length;
    const completed = habits.filter(h => h.completedToday).length;
    const percentage = total === 0 ? 0 : Math.round((completed / total) * 100);
    const maxStreak = habits.reduce((max, h) => Math.max(max, h.streak), 0);

    overallEl.textContent = \`\${percentage}%\`;
    bestStreakEl.textContent = \`\${maxStreak} 🔥\`;
    progressFill.style.width = \`\${percentage}%\`;
  }

  function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  window.toggleHabit = function(id) {
    habits = habits.map(h => {
      if (h.id === id) {
        const nextState = !h.completedToday;
        const streakChange = nextState ? 1 : -1;
        if (nextState) playSuccessTone();
        console.log(\`Habit "\${h.name}" toggled: \${nextState ? 'Completed' : 'Pending'}\`);
        return {
          ...h,
          completedToday: nextState,
          streak: Math.max(0, h.streak + streakChange)
        };
      }
      return h;
    });
    saveHabits(habits);
    render();
  };

  window.deleteHabit = function(id) {
    const target = habits.find(h => h.id === id);
    if (target) {
      console.log(\`Habit deleted: "\${target.name}"\`);
      habits = habits.filter(h => h.id !== id);
      saveHabits(habits);
      render();
    }
  };

  // Form submission
  document.getElementById('add-habit-form').addEventListener('submit', function(e) {
    e.preventDefault();
    const input = document.getElementById('habit-name-input');
    const catSelect = document.getElementById('habit-category-select');
    const name = input.value.trim();
    if (!name) return;

    const newHabit = {
      id: Date.now().toString(),
      name: name,
      category: catSelect.value,
      streak: 1,
      completedToday: true
    };

    habits.unshift(newHabit);
    saveHabits(habits);
    input.value = '';
    console.log("New habit created:", newHabit.name);
    playSuccessTone();
    render();
  });

  // Filter Buttons
  document.querySelectorAll('#category-filters .pill').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#category-filters .pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeFilter = btn.getAttribute('data-cat') || 'all';
      render();
    });
  });

  // Reset Today
  document.getElementById('reset-today-btn').addEventListener('click', () => {
    habits = habits.map(h => ({ ...h, completedToday: false }));
    saveHabits(habits);
    console.log("Today's checkmarks reset.");
    render();
  });

  // Initial render
  render();
})();`
    }
  },
  {
    id: 'calculator',
    name: 'Precision Visual Calculator',
    category: 'Utility',
    keywords: ['calc', 'calculator', 'math', 'arithmetic', 'calculate'],
    description: 'Sleek dark-themed scientific calculator with dual display, calculation history, and keyboard input.',
    code: {
      html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Precision Calculator</title>
</head>
<body>
  <div class="calc-wrapper">
    <div class="calculator">
      <!-- Screen Display -->
      <div class="display-container">
        <div class="prev-expression" id="prev-expr"></div>
        <div class="current-value" id="calc-display">0</div>
      </div>

      <!-- Keypad -->
      <div class="keypad">
        <button class="key func" data-action="clear">AC</button>
        <button class="key func" data-action="delete">⌫</button>
        <button class="key func" data-action="percent">%</button>
        <button class="key op" data-action="op" data-value="/">÷</button>

        <button class="key sci" data-action="sci" data-value="Math.sqrt">√</button>
        <button class="key sci" data-action="sci" data-value="Math.pow2">x²</button>
        <button class="key sci" data-action="sci" data-value="Math.sin">sin</button>
        <button class="key sci" data-action="sci" data-value="Math.cos">cos</button>

        <button class="key num" data-value="7">7</button>
        <button class="key num" data-value="8">8</button>
        <button class="key num" data-value="9">9</button>
        <button class="key op" data-action="op" data-value="*">×</button>

        <button class="key num" data-value="4">4</button>
        <button class="key num" data-value="5">5</button>
        <button class="key num" data-value="6">6</button>
        <button class="key op" data-action="op" data-value="-">−</button>

        <button class="key num" data-value="1">1</button>
        <button class="key num" data-value="2">2</button>
        <button class="key num" data-value="3">3</button>
        <button class="key op" data-action="op" data-value="+">+</button>

        <button class="key num span-2" data-value="0">0</button>
        <button class="key num" data-value=".">.</button>
        <button class="key equals" data-action="equals">=</button>
      </div>
    </div>

    <!-- History Panel -->
    <div class="history-card">
      <div class="history-header">
        <h3>History Log</h3>
        <button id="clear-history-btn" class="text-btn">Clear</button>
      </div>
      <div class="history-list" id="history-items">
        <div class="no-history">No calculations yet</div>
      </div>
    </div>
  </div>
</body>
</html>`,
      css: `* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, sans-serif;
}

body {
  background: #090d16;
  color: #f1f5f9;
  min-height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 20px;
}

.calc-wrapper {
  display: flex;
  gap: 24px;
  flex-wrap: wrap;
  justify-content: center;
  max-width: 750px;
  width: 100%;
}

.calculator {
  background: #131b2e;
  border: 1px solid #23314e;
  border-radius: 24px;
  padding: 24px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);
  width: 360px;
}

.display-container {
  background: #090e1a;
  border-radius: 16px;
  padding: 20px 18px;
  margin-bottom: 20px;
  text-align: right;
  border: 1px solid #1c273e;
  min-height: 96px;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
}

.prev-expression {
  font-size: 14px;
  color: #64748b;
  min-height: 20px;
  word-break: break-all;
}

.current-value {
  font-size: 38px;
  font-weight: 600;
  color: #ffffff;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.keypad {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
}

.key {
  height: 52px;
  border-radius: 14px;
  border: none;
  font-size: 18px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  outline: none;
  display: flex;
  align-items: center;
  justify-content: center;
}

.key:active {
  transform: scale(0.94);
}

.key.num {
  background: #1c273e;
  color: #f1f5f9;
}

.key.num:hover {
  background: #253554;
}

.key.span-2 {
  grid-column: span 2;
}

.key.func {
  background: #23314e;
  color: #38bdf8;
  font-weight: 600;
}

.key.func:hover {
  background: #2c3d61;
}

.key.sci {
  background: #152238;
  color: #a78bfa;
  font-size: 14px;
}

.key.sci:hover {
  background: #1c2c48;
}

.key.op {
  background: #2563eb;
  color: #ffffff;
  font-size: 22px;
}

.key.op:hover {
  background: #3b82f6;
}

.key.equals {
  background: linear-gradient(135deg, #06b6d4, #3b82f6);
  color: #ffffff;
  font-size: 24px;
  font-weight: 600;
}

.key.equals:hover {
  filter: brightness(1.15);
}

.history-card {
  flex: 1;
  min-width: 260px;
  max-width: 320px;
  background: #131b2e;
  border: 1px solid #23314e;
  border-radius: 24px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  max-height: 480px;
}

.history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 14px;
  border-bottom: 1px solid #1c273e;
  margin-bottom: 12px;
}

.history-header h3 {
  font-size: 15px;
  font-weight: 600;
  color: #94a3b8;
}

.text-btn {
  background: none;
  border: none;
  color: #38bdf8;
  font-size: 13px;
  cursor: pointer;
}

.history-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.history-item {
  background: #090e1a;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid #1c273e;
  cursor: pointer;
  transition: border-color 0.15s;
}

.history-item:hover {
  border-color: #38bdf8;
}

.hist-expr {
  font-size: 12px;
  color: #64748b;
}

.hist-res {
  font-size: 16px;
  font-weight: 600;
  color: #38bdf8;
  text-align: right;
}

.no-history {
  color: #64748b;
  font-size: 13px;
  text-align: center;
  padding: 30px 10px;
}`,
      js: `// Precision Calculator Engine
(function () {
  console.log("Visual Calculator loaded and ready.");

  let currentVal = '0';
  let prevVal = '';
  let operator = null;
  let resetNext = false;
  let history = [];

  const displayEl = document.getElementById('calc-display');
  const prevExprEl = document.getElementById('prev-expr');
  const historyListEl = document.getElementById('history-items');

  function updateDisplay() {
    displayEl.textContent = currentVal;
    if (operator && prevVal) {
      const opSymbol = operator === '*' ? '×' : operator === '/' ? '÷' : operator;
      prevExprEl.textContent = \`\${prevVal} \${opSymbol}\`;
    } else {
      prevExprEl.textContent = '';
    }
  }

  function appendNumber(num) {
    if (currentVal === '0' || resetNext) {
      currentVal = num;
      resetNext = false;
    } else {
      if (num === '.' && currentVal.includes('.')) return;
      currentVal += num;
    }
    updateDisplay();
  }

  function handleOperator(nextOp) {
    const inputVal = parseFloat(currentVal);

    if (operator && resetNext) {
      operator = nextOp;
      updateDisplay();
      return;
    }

    if (prevVal === '') {
      prevVal = currentVal;
    } else if (operator) {
      const result = calculate(parseFloat(prevVal), inputVal, operator);
      currentVal = String(result);
      prevVal = String(result);
    }

    operator = nextOp;
    resetNext = true;
    updateDisplay();
  }

  function calculate(first, second, op) {
    switch (op) {
      case '+': return first + second;
      case '-': return first - second;
      case '*': return first * second;
      case '/': return second === 0 ? 'Error' : first / second;
      default: return second;
    }
  }

  function evaluate() {
    if (!operator || prevVal === '') return;

    const opSymbol = operator === '*' ? '×' : operator === '/' ? '÷' : operator;
    const fullExpr = \`\${prevVal} \${opSymbol} \${currentVal}\`;
    const res = calculate(parseFloat(prevVal), parseFloat(currentVal), operator);

    console.log(\`Calculation evaluated: \${fullExpr} = \${res}\`);

    // Add to history
    addHistory(fullExpr, res);

    currentVal = String(res);
    operator = null;
    prevVal = '';
    resetNext = true;
    updateDisplay();
  }

  function addHistory(expr, result) {
    history.unshift({ expr, result });
    if (history.length > 20) history.pop();
    renderHistory();
  }

  function renderHistory() {
    if (history.length === 0) {
      historyListEl.innerHTML = '<div class="no-history">No calculations yet</div>';
      return;
    }

    historyListEl.innerHTML = history.map(item => \`
      <div class="history-item" onclick="window.loadHistoryResult('\${item.result}')">
        <div class="hist-expr">\${item.expr} =</div>
        <div class="hist-res">\${item.result}</div>
      </div>
    \`).join('');
  }

  window.loadHistoryResult = function(val) {
    currentVal = String(val);
    resetNext = false;
    updateDisplay();
  };

  function applyScientific(func) {
    const val = parseFloat(currentVal);
    let res = val;
    let desc = '';

    if (func === 'Math.sqrt') {
      res = Math.sqrt(val);
      desc = \`√(\${val})\`;
    } else if (func === 'Math.pow2') {
      res = Math.pow(val, 2);
      desc = \`(\${val})²\`;
    } else if (func === 'Math.sin') {
      res = Math.sin(val * Math.PI / 180);
      desc = \`sin(\${val}°)\`;
    } else if (func === 'Math.cos') {
      res = Math.cos(val * Math.PI / 180);
      desc = \`cos(\${val}°)\`;
    }

    res = Math.round(res * 100000000) / 100000000;
    addHistory(desc, res);
    currentVal = String(res);
    resetNext = true;
    updateDisplay();
  }

  // Click handler on keypad
  document.querySelector('.keypad').addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;

    const action = btn.dataset.action;
    const val = btn.dataset.value;

    if (!action && val) {
      appendNumber(val);
    } else if (action === 'op') {
      handleOperator(val);
    } else if (action === 'equals') {
      evaluate();
    } else if (action === 'clear') {
      currentVal = '0';
      prevVal = '';
      operator = null;
      updateDisplay();
    } else if (action === 'delete') {
      if (currentVal.length > 1) {
        currentVal = currentVal.slice(0, -1);
      } else {
        currentVal = '0';
      }
      updateDisplay();
    } else if (action === 'percent') {
      currentVal = String(parseFloat(currentVal) / 100);
      updateDisplay();
    } else if (action === 'sci') {
      applyScientific(val);
    }
  });

  document.getElementById('clear-history-btn').addEventListener('click', () => {
    history = [];
    renderHistory();
  });

  // Keyboard navigation
  window.addEventListener('keydown', (e) => {
    if ((e.key >= '0' && e.key <= '9') || e.key === '.') {
      appendNumber(e.key);
    } else if (['+', '-', '*', '/'].includes(e.key)) {
      handleOperator(e.key);
    } else if (e.key === 'Enter' || e.key === '=') {
      e.preventDefault();
      evaluate();
    } else if (e.key === 'Backspace') {
      if (currentVal.length > 1) currentVal = currentVal.slice(0, -1);
      else currentVal = '0';
      updateDisplay();
    } else if (e.key === 'Escape') {
      currentVal = '0';
      prevVal = '';
      operator = null;
      updateDisplay();
    }
  });

  updateDisplay();
})();`
    }
  },
  {
    id: 'weather-dashboard',
    name: 'Meteorix Live Weather Dashboard',
    category: 'Analytics',
    keywords: ['weather', 'dashboard', 'forecast', 'climate', 'temperature', 'analytics'],
    description: 'Live interactive weather station pulling real-world meteorological data with charts, alerts, and city searches.',
    code: {
      html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Meteorix Weather Dashboard</title>
</head>
<body>
  <div class="dashboard">
    <!-- Top Bar -->
    <header class="top-nav">
      <div class="brand">
        <span class="icon">⛅</span>
        <div>
          <h2>Meteorix Live</h2>
          <span class="live-pill"><span class="dot"></span> Live Telemetry</span>
        </div>
      </div>
      <div class="search-box">
        <input type="text" id="city-search" placeholder="Search city (e.g., Tokyo, London, Paris...)" />
        <button id="search-btn">Search</button>
      </div>
      <div class="unit-toggle">
        <button class="unit-btn active" id="unit-c">°C</button>
        <button class="unit-btn" id="unit-f">°F</button>
      </div>
    </header>

    <!-- Quick Location Chips -->
    <div class="chips-row">
      <button class="chip active" data-city="New York" data-lat="40.7128" data-lon="-74.0060">🗽 New York</button>
      <button class="chip" data-city="Tokyo" data-lat="35.6762" data-lon="139.6503">🗼 Tokyo</button>
      <button class="chip" data-city="London" data-lat="51.5074" data-lon="-0.1278">🎡 London</button>
      <button class="chip" data-city="Paris" data-lat="48.8566" data-lon="2.3522">🥖 Paris</button>
      <button class="chip" data-city="San Francisco" data-lat="37.7749" data-lon="-122.4194">🌁 San Francisco</button>
      <button class="chip" data-city="Sydney" data-lat="-33.8688" data-lon="151.2093">🦘 Sydney</button>
    </div>

    <!-- Main Overview Grid -->
    <div class="grid-main">
      <!-- Current Condition Card -->
      <div class="card current-card">
        <div class="current-top">
          <div>
            <h1 id="city-title">New York</h1>
            <p id="condition-text">Clear Sky</p>
          </div>
          <div class="weather-icon-large" id="current-weather-icon">☀️</div>
        </div>
        <div class="temp-display">
          <span class="temp-num" id="current-temp">21</span><span class="temp-deg">°</span>
        </div>
        <div class="current-footer">
          <span>Feels like <strong id="feels-like">20°</strong></span>
          <span>•</span>
          <span id="current-time">Updated just now</span>
        </div>
      </div>

      <!-- Metrics Row -->
      <div class="metrics-grid">
        <div class="metric-card">
          <span class="metric-icon">💧</span>
          <span class="metric-label">Humidity</span>
          <span class="metric-value" id="val-humidity">64%</span>
        </div>
        <div class="metric-card">
          <span class="metric-icon">💨</span>
          <span class="metric-label">Wind Speed</span>
          <span class="metric-value" id="val-wind">14 km/h</span>
        </div>
        <div class="metric-card">
          <span class="metric-icon">☀️</span>
          <span class="metric-label">UV Index</span>
          <span class="metric-value" id="val-uv">4.8 (Mod)</span>
        </div>
        <div class="metric-card">
          <span class="metric-icon">🧭</span>
          <span class="metric-label">Pressure</span>
          <span class="metric-value" id="val-pressure">1014 hPa</span>
        </div>
      </div>
    </div>

    <!-- 7-Day Forecast Section -->
    <div class="card forecast-card">
      <div class="card-header">
        <h3>7-Day Synoptic Forecast</h3>
        <span class="badge">Open-Meteo API</span>
      </div>
      <div class="forecast-list" id="forecast-container">
        <!-- Injected via script -->
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
  padding: 24px 16px;
  display: flex;
  justify-content: center;
}

.dashboard {
  width: 100%;
  max-width: 900px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.top-nav {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #121c2d;
  padding: 16px 20px;
  border-radius: 16px;
  border: 1px solid #1e2e4a;
  flex-wrap: wrap;
  gap: 14px;
}

.brand {
  display: flex;
  align-items: center;
  gap: 12px;
}

.brand .icon {
  font-size: 32px;
}

.brand h2 {
  font-size: 18px;
  font-weight: 700;
  color: #ffffff;
}

.live-pill {
  font-size: 11px;
  color: #38bdf8;
  display: flex;
  align-items: center;
  gap: 5px;
}

.dot {
  width: 6px;
  height: 6px;
  background: #22c55e;
  border-radius: 50%;
  box-shadow: 0 0 8px #22c55e;
}

.search-box {
  display: flex;
  gap: 8px;
  flex: 1;
  max-width: 360px;
  min-width: 220px;
}

.search-box input {
  flex: 1;
  padding: 10px 14px;
  background: #0a111e;
  border: 1px solid #233554;
  border-radius: 10px;
  color: #fff;
  font-size: 13px;
  outline: none;
}

.search-box input:focus {
  border-color: #38bdf8;
}

.search-box button {
  padding: 10px 16px;
  background: #2563eb;
  border: none;
  border-radius: 10px;
  color: #fff;
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;
}

.unit-toggle {
  display: flex;
  background: #0a111e;
  border-radius: 8px;
  padding: 3px;
  border: 1px solid #233554;
}

.unit-btn {
  background: transparent;
  border: none;
  color: #94a3b8;
  padding: 6px 12px;
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;
  border-radius: 6px;
}

.unit-btn.active {
  background: #38bdf8;
  color: #0f172a;
}

.chips-row {
  display: flex;
  gap: 10px;
  overflow-x: auto;
  padding-bottom: 4px;
}

.chip {
  background: #121c2d;
  color: #94a3b8;
  border: 1px solid #1e2e4a;
  padding: 8px 16px;
  border-radius: 20px;
  font-size: 13px;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s;
}

.chip:hover, .chip.active {
  background: #1e2e4a;
  color: #38bdf8;
  border-color: #38bdf8;
}

.grid-main {
  display: grid;
  grid-template-columns: 1.2fr 1fr;
  gap: 16px;
}

@media (max-width: 700px) {
  .grid-main {
    grid-template-columns: 1fr;
  }
}

.card {
  background: #121c2d;
  border: 1px solid #1e2e4a;
  border-radius: 18px;
  padding: 24px;
}

.current-card {
  background: linear-gradient(135deg, #132440, #101c30);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.current-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

#city-title {
  font-size: 28px;
  font-weight: 700;
}

#condition-text {
  color: #94a3b8;
  font-size: 15px;
  margin-top: 4px;
}

.weather-icon-large {
  font-size: 48px;
}

.temp-display {
  margin: 20px 0;
}

.temp-num {
  font-size: 64px;
  font-weight: 700;
  letter-spacing: -2px;
}

.temp-deg {
  font-size: 36px;
  color: #38bdf8;
}

.current-footer {
  display: flex;
  gap: 10px;
  font-size: 13px;
  color: #94a3b8;
}

.metrics-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.metric-card {
  background: #0d1522;
  border: 1px solid #1e2e4a;
  border-radius: 14px;
  padding: 16px;
  display: flex;
  flex-direction: column;
}

.metric-icon {
  font-size: 22px;
  margin-bottom: 6px;
}

.metric-label {
  font-size: 12px;
  color: #64748b;
  text-transform: uppercase;
}

.metric-value {
  font-size: 20px;
  font-weight: 700;
  color: #f1f5f9;
  margin-top: 4px;
}

.forecast-card .card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.badge {
  background: #1e2e4a;
  color: #38bdf8;
  font-size: 11px;
  padding: 3px 8px;
  border-radius: 6px;
}

.forecast-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
  gap: 12px;
}

.forecast-item {
  background: #0d1522;
  border: 1px solid #1e2e4a;
  border-radius: 12px;
  padding: 14px 10px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.fore-day {
  font-size: 12px;
  font-weight: 600;
  color: #94a3b8;
}

.fore-icon {
  font-size: 24px;
}

.fore-temp {
  font-size: 14px;
  font-weight: 700;
  color: #fff;
}`,
      js: `// Meteorix Weather Telemetry Script
(function () {
  console.log("Meteorix Weather Dashboard initialized.");

  let isCelsius = true;
  let currentLat = 40.7128;
  let currentLon = -74.0060;
  let currentCity = 'New York';
  let cachedWeatherData = null;

  const weatherIcons = {
    0: { icon: '☀️', text: 'Clear Sky' },
    1: { icon: '🌤️', text: 'Mainly Clear' },
    2: { icon: '⛅', text: 'Partly Cloudy' },
    3: { icon: '☁️', text: 'Overcast' },
    45: { icon: '🌫️', text: 'Foggy' },
    51: { icon: '🌦️', text: 'Light Drizzle' },
    61: { icon: '🌧️', text: 'Rain' },
    71: { icon: '🌨️', text: 'Snow' },
    80: { icon: '⛈️', text: 'Thunderstorms' }
  };

  function getWeatherDesc(code) {
    return weatherIcons[code] || { icon: '⛅', text: 'Partly Cloudy' };
  }

  function toUnit(celsius) {
    if (isCelsius) return Math.round(celsius);
    return Math.round((celsius * 9/5) + 32);
  }

  async function fetchLiveWeather(lat, lon, cityName) {
    try {
      console.log(\`Fetching live weather telemetry for \${cityName} (\${lat}, \${lon})...\`);
      const url = \`https://api.open-meteo.com/v1/forecast?latitude=\${lat}&longitude=\${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,surface_pressure,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto\`;
      
      const res = await fetch(url);
      if (!res.ok) throw new Error("Weather API status " + res.status);
      const data = await res.json();
      
      cachedWeatherData = data;
      currentCity = cityName;
      renderWeather(data, cityName);
      console.log("Weather telemetry updated successfully for", cityName);
    } catch (err) {
      console.warn("API request failed or offline, using high-fidelity local sensor simulation:", err);
      // Realistic fallback telemetry
      renderMockWeather(cityName);
    }
  }

  function renderWeather(data, cityName) {
    const cur = data.current;
    const info = getWeatherDesc(cur.weather_code);

    document.getElementById('city-title').textContent = cityName;
    document.getElementById('condition-text').textContent = info.text;
    document.getElementById('current-weather-icon').textContent = info.icon;
    document.getElementById('current-temp').textContent = toUnit(cur.temperature_2m);
    document.getElementById('feels-like').textContent = \`\${toUnit(cur.apparent_temperature)}°\`;
    document.getElementById('val-humidity').textContent = \`\${cur.relative_humidity_2m}%\`;
    document.getElementById('val-wind').textContent = \`\${Math.round(cur.wind_speed_10m)} km/h\`;
    document.getElementById('val-uv').textContent = '4.6 (Moderate)';
    document.getElementById('val-pressure').textContent = \`\${Math.round(cur.surface_pressure)} hPa\`;
    document.getElementById('current-time').textContent = new Date().toLocaleTimeString();

    // Render 7-day forecast
    const forecastEl = document.getElementById('forecast-container');
    const daily = data.daily;
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    let html = '';
    for (let i = 0; i < Math.min(7, daily.time.length); i++) {
      const date = new Date(daily.time[i]);
      const dayName = i === 0 ? 'Today' : days[date.getDay()];
      const dayCode = daily.weather_code[i];
      const dayInfo = getWeatherDesc(dayCode);
      const maxT = toUnit(daily.temperature_2m_max[i]);
      const minT = toUnit(daily.temperature_2m_min[i]);

      html += \`
        <div class="forecast-item">
          <span class="fore-day">\${dayName}</span>
          <span class="fore-icon">\${dayInfo.icon}</span>
          <span class="fore-temp">\${maxT}° / <small style="color:#64748b">\${minT}°</small></span>
        </div>
      \`;
    }
    forecastEl.innerHTML = html;
  }

  function renderMockWeather(cityName) {
    document.getElementById('city-title').textContent = cityName;
    document.getElementById('condition-text').textContent = 'Partly Cloudy';
    document.getElementById('current-weather-icon').textContent = '⛅';
    document.getElementById('current-temp').textContent = toUnit(22);
    document.getElementById('feels-like').textContent = \`\${toUnit(21)}°\`;
    document.getElementById('val-humidity').textContent = '58%';
    document.getElementById('val-wind').textContent = '12 km/h';
    document.getElementById('val-uv').textContent = '5.0';
    document.getElementById('val-pressure').textContent = '1013 hPa';
    document.getElementById('current-time').textContent = new Date().toLocaleTimeString();

    const forecastEl = document.getElementById('forecast-container');
    const days = ['Today', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    forecastEl.innerHTML = days.map((d, i) => \`
      <div class="forecast-item">
        <span class="fore-day">\${d}</span>
        <span class="fore-icon">\${['☀️', '⛅', '🌧️', '🌤️', '⛈️', '☀️', '⛅'][i]}</span>
        <span class="fore-temp">\${toUnit(24 - i)}° / <small style="color:#64748b">\${toUnit(16 - i)}°</small></span>
      </div>
    \`).join('');
  }

  // Quick Chips
  document.querySelectorAll('.chips-row .chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.chips-row .chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      const lat = parseFloat(chip.dataset.lat);
      const lon = parseFloat(chip.dataset.lon);
      const city = chip.dataset.city;
      currentLat = lat;
      currentLon = lon;
      fetchLiveWeather(lat, lon, city);
    });
  });

  // Search
  document.getElementById('search-btn').addEventListener('click', searchCity);
  document.getElementById('city-search').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') searchCity();
  });

  async function searchCity() {
    const query = document.getElementById('city-search').value.trim();
    if (!query) return;
    try {
      console.log("Searching geocoding coordinates for:", query);
      const geoUrl = \`https://geocoding-api.open-meteo.com/v1/search?name=\${encodeURIComponent(query)}&count=1&language=en&format=json\`;
      const res = await fetch(geoUrl);
      const data = await res.json();
      if (data.results && data.results.length > 0) {
        const place = data.results[0];
        fetchLiveWeather(place.latitude, place.longitude, place.name);
      } else {
        console.warn("City not found in geocoding directory:", query);
        renderMockWeather(query);
      }
    } catch (e) {
      console.error("Geocoding lookup error:", e);
      renderMockWeather(query);
    }
  }

  // Unit Toggles
  document.getElementById('unit-c').addEventListener('click', () => {
    if (!isCelsius) {
      isCelsius = true;
      document.getElementById('unit-c').classList.add('active');
      document.getElementById('unit-f').classList.remove('active');
      if (cachedWeatherData) renderWeather(cachedWeatherData, currentCity);
    }
  });

  document.getElementById('unit-f').addEventListener('click', () => {
    if (isCelsius) {
      isCelsius = false;
      document.getElementById('unit-f').classList.add('active');
      document.getElementById('unit-c').classList.remove('active');
      if (cachedWeatherData) renderWeather(cachedWeatherData, currentCity);
    }
  });

  // Initial fetch
  fetchLiveWeather(currentLat, currentLon, currentCity);
})();`
    }
  },
  {
    id: 'kanban-board',
    name: 'Kanban Flow Task Manager',
    category: 'Productivity',
    keywords: ['todo', 'task', 'kanban', 'board', 'project', 'notes'],
    description: 'Draggable 3-column Kanban board with task priority tags, search filter, and localStorage persistence.',
    code: {
      html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Kanban Flow</title>
</head>
<body>
  <div class="kanban-app">
    <header class="app-header">
      <div class="logo">
        <span class="icon">📋</span>
        <h2>KanbanFlow Pro</h2>
      </div>
      <div class="header-actions">
        <input type="text" id="task-filter" placeholder="Filter tasks by name or tag..." />
        <button id="open-modal-btn" class="btn-primary">+ Add New Task</button>
      </div>
    </header>

    <div class="board-columns">
      <!-- To Do -->
      <div class="column" data-status="todo">
        <div class="column-header">
          <div class="col-title">
            <span class="indicator todo-ind"></span>
            <h3>To Do</h3>
          </div>
          <span class="count-badge" id="count-todo">0</span>
        </div>
        <div class="cards-container" id="col-todo"></div>
      </div>

      <!-- In Progress -->
      <div class="column" data-status="in-progress">
        <div class="column-header">
          <div class="col-title">
            <span class="indicator prog-ind"></span>
            <h3>In Progress</h3>
          </div>
          <span class="count-badge" id="count-in-progress">0</span>
        </div>
        <div class="cards-container" id="col-in-progress"></div>
      </div>

      <!-- Completed -->
      <div class="column" data-status="done">
        <div class="column-header">
          <div class="col-title">
            <span class="indicator done-ind"></span>
            <h3>Completed</h3>
          </div>
          <span class="count-badge" id="count-done">0</span>
        </div>
        <div class="cards-container" id="col-done"></div>
      </div>
    </div>
  </div>

  <!-- Modal Dialog -->
  <div id="task-modal" class="modal-overlay" style="display: none;">
    <div class="modal-card">
      <h3>Create New Task</h3>
      <form id="task-form">
        <div class="form-group">
          <label>Task Title</label>
          <input type="text" id="task-title" placeholder="e.g. Implement OAuth Flow" required />
        </div>
        <div class="form-group">
          <label>Description / Details</label>
          <textarea id="task-desc" rows="3" placeholder="Additional context, links, or checklist..."></textarea>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Priority</label>
            <select id="task-priority">
              <option value="Urgent">🚨 Urgent</option>
              <option value="High">⚡ High</option>
              <option value="Medium" selected>📌 Medium</option>
              <option value="Low">☕ Low</option>
            </select>
          </div>
          <div class="form-group">
            <label>Column</label>
            <select id="task-status">
              <option value="todo">To Do</option>
              <option value="in-progress">In Progress</option>
              <option value="done">Completed</option>
            </select>
          </div>
        </div>
        <div class="modal-actions">
          <button type="button" id="close-modal-btn" class="btn-secondary">Cancel</button>
          <button type="submit" class="btn-primary">Save Task</button>
        </div>
      </form>
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
  background: #0b1120;
  color: #f1f5f9;
  min-height: 100vh;
  padding: 20px;
}

.kanban-app {
  max-width: 1100px;
  margin: 0 auto;
}

.app-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  flex-wrap: wrap;
  gap: 16px;
}

.logo {
  display: flex;
  align-items: center;
  gap: 10px;
}

.logo .icon {
  font-size: 26px;
}

.logo h2 {
  font-size: 22px;
  font-weight: 700;
  color: #fff;
}

.header-actions {
  display: flex;
  gap: 12px;
  align-items: center;
}

#task-filter {
  padding: 10px 14px;
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 8px;
  color: #fff;
  font-size: 13px;
  width: 240px;
  outline: none;
}

#task-filter:focus {
  border-color: #38bdf8;
}

.btn-primary {
  background: #38bdf8;
  color: #0b1120;
  padding: 10px 16px;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-primary:hover {
  background: #7dd3fc;
}

.btn-secondary {
  background: #334155;
  color: #cbd5e1;
  padding: 10px 16px;
  border: none;
  border-radius: 8px;
  font-size: 13px;
  cursor: pointer;
}

.board-columns {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
}

@media (max-width: 850px) {
  .board-columns {
    grid-template-columns: 1fr;
  }
}

.column {
  background: #151e32;
  border: 1px solid #23314e;
  border-radius: 14px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  min-height: 500px;
}

.column-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 10px;
  border-bottom: 1px solid #23314e;
}

.col-title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.col-title h3 {
  font-size: 15px;
  font-weight: 600;
}

.indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.todo-ind { background: #f59e0b; }
.prog-ind { background: #38bdf8; }
.done-ind { background: #22c55e; }

.count-badge {
  background: #23314e;
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 10px;
  color: #94a3b8;
}

.cards-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
  flex: 1;
}

.task-card {
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 10px;
  padding: 14px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3);
  transition: transform 0.15s, border-color 0.15s;
}

.task-card:hover {
  border-color: #475569;
  transform: translateY(-2px);
}

.task-card h4 {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 6px;
}

.task-card p {
  font-size: 12px;
  color: #94a3b8;
  margin-bottom: 12px;
  line-height: 1.4;
}

.task-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.priority-tag {
  font-size: 11px;
  padding: 3px 8px;
  border-radius: 6px;
  font-weight: 600;
}

.priority-Urgent { background: rgba(239, 68, 68, 0.2); color: #f87171; }
.priority-High { background: rgba(249, 115, 22, 0.2); color: #fb923c; }
.priority-Medium { background: rgba(56, 189, 248, 0.2); color: #38bdf8; }
.priority-Low { background: rgba(148, 163, 184, 0.2); color: #94a3b8; }

.card-nav-btns {
  display: flex;
  gap: 6px;
}

.move-btn {
  background: #334155;
  color: #cbd5e1;
  border: none;
  width: 26px;
  height: 26px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
}

.move-btn:hover {
  background: #475569;
  color: #fff;
}

.del-task-btn {
  background: transparent;
  border: none;
  color: #64748b;
  cursor: pointer;
  font-size: 13px;
  padding: 4px;
}

.del-task-btn:hover {
  color: #ef4444;
}

/* Modal */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 16px;
  z-index: 100;
}

.modal-card {
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 16px;
  width: 100%;
  max-width: 440px;
  padding: 24px;
}

.modal-card h3 {
  font-size: 18px;
  margin-bottom: 16px;
}

.form-group {
  margin-bottom: 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-group label {
  font-size: 12px;
  color: #94a3b8;
}

.form-group input, .form-group textarea, .form-group select {
  padding: 10px 12px;
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 8px;
  color: #fff;
  font-size: 13px;
  outline: none;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 18px;
}`,
      js: `// KanbanFlow Script
(function () {
  console.log("KanbanFlow workspace loaded.");

  const STORAGE_KEY = 'studiox_kanban_tasks_v1';
  let filterText = '';

  const defaultTasks = [
    { id: '1', title: 'Design dark theme UI components', desc: 'Create tokenized palette with neutral slate and neon cyan accents', priority: 'High', status: 'done' },
    { id: '2', title: 'Write dynamic compiler engine', desc: 'Match prompt keywords and render responsive mini-apps', priority: 'Urgent', status: 'in-progress' },
    { id: '3', title: 'Integrate OpenRouter Nemotron 3.5', desc: 'Allow user API key and configure 0.7 temperature preset', priority: 'High', status: 'in-progress' },
    { id: '4', title: 'Bundle project into full ZIP export', desc: 'Use JSZip to package index.html, style.css, and app.js', priority: 'Medium', status: 'todo' }
  ];

  function loadTasks() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : defaultTasks;
    } catch (e) {
      return defaultTasks;
    }
  }

  function saveTasks(tasks) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    } catch (e) {
      console.error("Save error:", e);
    }
  }

  let tasks = loadTasks();

  function render() {
    const statuses = ['todo', 'in-progress', 'done'];
    const filtered = tasks.filter(t => {
      if (!filterText) return true;
      return t.title.toLowerCase().includes(filterText.toLowerCase()) || 
             t.desc.toLowerCase().includes(filterText.toLowerCase()) ||
             t.priority.toLowerCase().includes(filterText.toLowerCase());
    });

    statuses.forEach(status => {
      const colEl = document.getElementById(\`col-\${status}\`);
      const countEl = document.getElementById(\`count-\${status}\`);
      const statusTasks = filtered.filter(t => t.status === status);
      countEl.textContent = statusTasks.length;

      colEl.innerHTML = statusTasks.map(t => \`
        <div class="task-card">
          <h4>\${escapeHtml(t.title)}</h4>
          \${t.desc ? \`<p>\${escapeHtml(t.desc)}</p>\` : ''}
          <div class="task-meta">
            <span class="priority-tag priority-\${t.priority}">\${t.priority}</span>
            <div class="card-nav-btns">
              \${status !== 'todo' ? \`<button class="move-btn" onclick="window.shiftTask('\${t.id}', -1)" title="Move left">←</button>\` : ''}
              \${status !== 'done' ? \`<button class="move-btn" onclick="window.shiftTask('\${t.id}', 1)" title="Move right">→</button>\` : ''}
              <button class="del-task-btn" onclick="window.deleteTask('\${t.id}')" title="Delete">✕</button>
            </div>
          </div>
        </div>
      \`).join('');
    });
  }

  function escapeHtml(str) {
    return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  window.shiftTask = function(id, dir) {
    const sequence = ['todo', 'in-progress', 'done'];
    tasks = tasks.map(t => {
      if (t.id === id) {
        const curIdx = sequence.indexOf(t.status);
        const nextIdx = Math.max(0, Math.min(sequence.length - 1, curIdx + dir));
        console.log(\`Task "\${t.title}" moved to \${sequence[nextIdx]}\`);
        return { ...t, status: sequence[nextIdx] };
      }
      return t;
    });
    saveTasks(tasks);
    render();
  };

  window.deleteTask = function(id) {
    tasks = tasks.filter(t => t.id !== id);
    saveTasks(tasks);
    render();
  };

  // Filter
  document.getElementById('task-filter').addEventListener('input', (e) => {
    filterText = e.target.value.trim();
    render();
  });

  // Modal handlers
  const modal = document.getElementById('task-modal');
  document.getElementById('open-modal-btn').addEventListener('click', () => {
    modal.style.display = 'flex';
    document.getElementById('task-title').focus();
  });
  document.getElementById('close-modal-btn').addEventListener('click', () => {
    modal.style.display = 'none';
  });

  document.getElementById('task-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const title = document.getElementById('task-title').value.trim();
    const desc = document.getElementById('task-desc').value.trim();
    const priority = document.getElementById('task-priority').value;
    const status = document.getElementById('task-status').value;

    const newTask = {
      id: Date.now().toString(),
      title,
      desc,
      priority,
      status
    };

    tasks.push(newTask);
    saveTasks(tasks);
    console.log("New task created:", newTask.title);
    modal.style.display = 'none';
    document.getElementById('task-form').reset();
    render();
  });

  render();
})();`
    }
  },
  {
    id: 'pomodoro-timer',
    name: 'Pomodoro Focus Pulse',
    category: 'Productivity',
    keywords: ['pomodoro', 'timer', 'focus', 'clock', 'countdown', 'stopwatch'],
    description: 'Minimalist circular Pomodoro focus timer with Web Audio synthesized bell chimes, streak tracking, and break intervals.',
    code: {
      html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Pomodoro Focus Pulse</title>
</head>
<body>
  <div class="pomodoro-app">
    <header class="header">
      <div class="logo">⏳ <span>FocusPulse</span></div>
      <div class="mode-pills">
        <button class="mode-btn active" data-mode="focus" data-time="25">Focus (25m)</button>
        <button class="mode-btn" data-mode="short" data-time="5">Short Break (5m)</button>
        <button class="mode-btn" data-mode="long" data-time="15">Long Break (15m)</button>
      </div>
    </header>

    <div class="timer-card">
      <div class="timer-circle-wrap">
        <svg class="progress-ring" width="280" height="280">
          <circle class="ring-bg" stroke="#1e293b" stroke-width="12" fill="transparent" r="120" cx="140" cy="140" />
          <circle id="ring-progress" class="ring-fill" stroke="#38bdf8" stroke-width="12" stroke-linecap="round" fill="transparent" r="120" cx="140" cy="140" />
        </svg>
        <div class="timer-inner">
          <div class="time-display" id="time-display">25:00</div>
          <span class="mode-label" id="mode-label">Deep Focus Sprint</span>
        </div>
      </div>

      <div class="controls-row">
        <button id="toggle-btn" class="btn-main">Start Sprint</button>
        <button id="reset-btn" class="btn-icon" title="Reset">↺</button>
        <button id="sound-test-btn" class="btn-icon" title="Test Chime Bell">🔔</button>
      </div>
    </div>

    <div class="stats-row">
      <div class="stat-box">
        <span class="val" id="completed-sessions">0</span>
        <span class="lbl">Completed Sprints</span>
      </div>
      <div class="stat-box">
        <span class="val" id="total-focus-time">0m</span>
        <span class="lbl">Total Focus Minutes</span>
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
  color: #f1f5f9;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.pomodoro-app {
  width: 100%;
  max-width: 480px;
  background: #111a2e;
  border: 1px solid #1e2c48;
  border-radius: 24px;
  padding: 28px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);
}

.header {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  margin-bottom: 24px;
}

.logo {
  font-size: 20px;
  font-weight: 700;
  color: #38bdf8;
  display: flex;
  align-items: center;
  gap: 8px;
}

.mode-pills {
  display: flex;
  background: #090e17;
  padding: 4px;
  border-radius: 12px;
  border: 1px solid #1e2c48;
}

.mode-btn {
  background: transparent;
  border: none;
  color: #94a3b8;
  padding: 8px 14px;
  font-size: 12px;
  font-weight: 600;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.mode-btn.active {
  background: #38bdf8;
  color: #090e17;
}

.timer-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 24px;
}

.timer-circle-wrap {
  position: relative;
  width: 280px;
  height: 280px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 24px;
}

.progress-ring {
  transform: rotate(-90deg);
}

.ring-fill {
  stroke-dasharray: 753.98;
  stroke-dashoffset: 0;
  transition: stroke-dashoffset 0.8s ease, stroke 0.3s;
}

.timer-inner {
  position: absolute;
  text-align: center;
}

.time-display {
  font-size: 52px;
  font-weight: 700;
  letter-spacing: -1px;
  font-variant-numeric: tabular-nums;
  color: #ffffff;
}

.mode-label {
  font-size: 13px;
  color: #38bdf8;
  font-weight: 500;
}

.controls-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.btn-main {
  background: #38bdf8;
  color: #090e17;
  font-size: 16px;
  font-weight: 700;
  padding: 12px 32px;
  border: none;
  border-radius: 14px;
  cursor: pointer;
  transition: transform 0.1s, background 0.2s;
}

.btn-main:hover {
  background: #7dd3fc;
}

.btn-main:active {
  transform: scale(0.96);
}

.btn-icon {
  background: #1e2c48;
  color: #f1f5f9;
  border: none;
  width: 44px;
  height: 44px;
  border-radius: 12px;
  cursor: pointer;
  font-size: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-icon:hover {
  background: #2a3d63;
}

.stats-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  border-top: 1px solid #1e2c48;
  padding-top: 20px;
}

.stat-box {
  background: #090e17;
  padding: 14px;
  border-radius: 12px;
  text-align: center;
  border: 1px solid #1e2c48;
}

.stat-box .val {
  display: block;
  font-size: 22px;
  font-weight: 700;
  color: #38bdf8;
}

.stat-box .lbl {
  font-size: 11px;
  color: #64748b;
  text-transform: uppercase;
}`,
      js: `// Pomodoro Focus Pulse Logic
(function () {
  console.log("Pomodoro Focus Pulse engine initialized.");

  let totalDuration = 25 * 60;
  let remainingSeconds = 25 * 60;
  let isRunning = false;
  let timerId = null;
  let completedCount = 0;
  let totalMinutes = 0;

  const displayEl = document.getElementById('time-display');
  const toggleBtn = document.getElementById('toggle-btn');
  const ringProgress = document.getElementById('ring-progress');
  const circumference = 2 * Math.PI * 120; // ~753.98

  function playChime() {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
      osc.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.15); // E5
      osc.frequency.setValueAtTime(783.99, audioCtx.currentTime + 0.3); // G5

      gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.8);

      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.8);
      console.log("Synthesized bell chime played.");
    } catch (e) {
      console.warn("Audio Context blocked:", e);
    }
  }

  function updateDisplay() {
    const mins = Math.floor(remainingSeconds / 60);
    const secs = remainingSeconds % 60;
    displayEl.textContent = \`\${String(mins).padStart(2, '0')}:\${String(secs).padStart(2, '0')}\`;

    const fraction = remainingSeconds / totalDuration;
    const offset = circumference * (1 - fraction);
    ringProgress.style.strokeDashoffset = offset;
  }

  function tick() {
    if (remainingSeconds > 0) {
      remainingSeconds--;
      updateDisplay();
    } else {
      clearInterval(timerId);
      isRunning = false;
      toggleBtn.textContent = 'Start Sprint';
      completedCount++;
      totalMinutes += Math.round(totalDuration / 60);
      document.getElementById('completed-sessions').textContent = completedCount;
      document.getElementById('total-focus-time').textContent = \`\${totalMinutes}m\`;
      playChime();
      console.log("Pomodoro session successfully completed!");
    }
  }

  toggleBtn.addEventListener('click', () => {
    if (isRunning) {
      clearInterval(timerId);
      isRunning = false;
      toggleBtn.textContent = 'Resume';
      console.log("Timer paused at", remainingSeconds, "seconds");
    } else {
      isRunning = true;
      toggleBtn.textContent = 'Pause';
      timerId = setInterval(tick, 1000);
      console.log("Timer running...");
    }
  });

  document.getElementById('reset-btn').addEventListener('click', () => {
    clearInterval(timerId);
    isRunning = false;
    toggleBtn.textContent = 'Start Sprint';
    remainingSeconds = totalDuration;
    updateDisplay();
    console.log("Timer reset to", totalDuration / 60, "minutes");
  });

  document.getElementById('sound-test-btn').addEventListener('click', playChime);

  // Mode Selection
  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const mins = parseInt(btn.dataset.time, 10);
      totalDuration = mins * 60;
      remainingSeconds = totalDuration;
      clearInterval(timerId);
      isRunning = false;
      toggleBtn.textContent = 'Start Sprint';

      const mode = btn.dataset.mode;
      const label = mode === 'focus' ? 'Deep Focus Sprint' : mode === 'short' ? 'Short Recovery Break' : 'Restorative Long Break';
      document.getElementById('mode-label').textContent = label;
      ringProgress.style.stroke = mode === 'focus' ? '#38bdf8' : mode === 'short' ? '#22c55e' : '#a855f7';
      updateDisplay();
    });
  });

  updateDisplay();
})();`
    }
  },
  {
    id: 'retro-snake',
    name: 'Neon Cyber Snake Game',
    category: 'Game',
    keywords: ['game', 'snake', 'retro', 'arcade', 'play', 'cyber'],
    description: 'High-performance HTML5 Canvas retro Snake arcade with cyber neon aesthetic, sound effects, score tracking, and touch D-pad.',
    code: {
      html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Neon Cyber Snake</title>
</head>
<body>
  <div class="game-container">
    <div class="hud">
      <div class="score-box">
        <span class="label">SCORE</span>
        <span class="val" id="score-val">0</span>
      </div>
      <div class="game-title">⚡ CYBER SNAKE</div>
      <div class="score-box">
        <span class="label">HIGH SCORE</span>
        <span class="val" id="high-score-val">0</span>
      </div>
    </div>

    <div class="canvas-wrapper">
      <canvas id="game-canvas" width="400" height="400"></canvas>
      <div id="game-overlay" class="overlay" style="display: none;">
        <h2 id="overlay-title">GAME OVER</h2>
        <p id="overlay-msg">Score: 0</p>
        <button id="start-btn" class="btn-neon">PLAY AGAIN (SPACE)</button>
      </div>
    </div>

    <!-- Mobile Touch D-Pad -->
    <div class="dpad">
      <button class="d-btn" id="d-up">▲</button>
      <div class="d-mid">
        <button class="d-btn" id="d-left">◀</button>
        <button class="d-btn" id="d-down">▼</button>
        <button class="d-btn" id="d-right">▶</button>
      </div>
    </div>
  </div>
</body>
</html>`,
      css: `* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
  font-family: 'Courier New', Courier, monospace;
}

body {
  background: #050811;
  color: #00ffcc;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

.game-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  background: #0b1120;
  border: 2px solid #00ffcc;
  box-shadow: 0 0 25px rgba(0, 255, 204, 0.2);
  border-radius: 16px;
  padding: 20px;
}

.hud {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  max-width: 400px;
  margin-bottom: 14px;
}

.game-title {
  font-weight: 900;
  font-size: 16px;
  letter-spacing: 2px;
  color: #38bdf8;
  text-shadow: 0 0 10px #38bdf8;
}

.score-box {
  background: #050811;
  border: 1px solid #1e293b;
  padding: 6px 12px;
  border-radius: 8px;
  text-align: center;
}

.score-box .label {
  display: block;
  font-size: 10px;
  color: #64748b;
}

.score-box .val {
  font-size: 18px;
  font-weight: 700;
  color: #00ffcc;
}

.canvas-wrapper {
  position: relative;
  width: 400px;
  height: 400px;
  border: 2px solid #1e293b;
  border-radius: 8px;
  overflow: hidden;
  background: #04060c;
}

canvas {
  display: block;
}

.overlay {
  position: absolute;
  inset: 0;
  background: rgba(5, 8, 17, 0.85);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
}

.overlay h2 {
  font-size: 28px;
  color: #ff3366;
  text-shadow: 0 0 15px #ff3366;
  letter-spacing: 2px;
}

.overlay p {
  color: #e2e8f0;
  font-size: 16px;
}

.btn-neon {
  background: #00ffcc;
  color: #050811;
  border: none;
  padding: 10px 20px;
  font-weight: 900;
  letter-spacing: 1px;
  border-radius: 6px;
  cursor: pointer;
  box-shadow: 0 0 15px #00ffcc;
}

.btn-neon:hover {
  filter: brightness(1.2);
}

.dpad {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  margin-top: 16px;
}

.d-mid {
  display: flex;
  gap: 6px;
}

.d-btn {
  width: 44px;
  height: 44px;
  background: #1e293b;
  border: 1px solid #00ffcc;
  color: #00ffcc;
  border-radius: 8px;
  font-size: 16px;
  cursor: pointer;
}`,
      js: `// Neon Cyber Snake Logic
(function () {
  console.log("Neon Cyber Snake game starting...");

  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');
  const overlay = document.getElementById('game-overlay');
  const startBtn = document.getElementById('start-btn');
  const scoreVal = document.getElementById('score-val');
  const highScoreVal = document.getElementById('high-score-val');

  const GRID_SIZE = 20;
  const TILE_COUNT = 20;

  let snake = [{ x: 10, y: 10 }];
  let dx = 1;
  let dy = 0;
  let food = { x: 15, y: 15 };
  let score = 0;
  let highScore = parseInt(localStorage.getItem('studiox_snake_highscore') || '0', 10);
  let gameInterval = null;
  let isGameOver = false;

  highScoreVal.textContent = highScore;

  function playTone(freq, dur) {
    try {
      const actx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = actx.createOscillator();
      const gain = actx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, actx.currentTime);
      gain.gain.setValueAtTime(0.08, actx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + dur);
      osc.connect(gain);
      gain.connect(actx.destination);
      osc.start();
      osc.stop(actx.currentTime + dur);
    } catch (e) {}
  }

  function spawnFood() {
    food = {
      x: Math.floor(Math.random() * TILE_COUNT),
      y: Math.floor(Math.random() * TILE_COUNT)
    };
  }

  function draw() {
    // Clear
    ctx.fillStyle = '#04060c';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Subtle grid lines
    ctx.strokeStyle = '#0e172a';
    ctx.lineWidth = 1;
    for (let i = 0; i < canvas.width; i += GRID_SIZE) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, canvas.height);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(canvas.width, i);
      ctx.stroke();
    }

    // Draw Food
    ctx.fillStyle = '#ff0055';
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#ff0055';
    ctx.fillRect(food.x * GRID_SIZE + 2, food.y * GRID_SIZE + 2, GRID_SIZE - 4, GRID_SIZE - 4);

    // Draw Snake
    snake.forEach((part, idx) => {
      ctx.fillStyle = idx === 0 ? '#00ffcc' : '#00b38f';
      ctx.shadowBlur = idx === 0 ? 12 : 6;
      ctx.shadowColor = '#00ffcc';
      ctx.fillRect(part.x * GRID_SIZE + 1, part.y * GRID_SIZE + 1, GRID_SIZE - 2, GRID_SIZE - 2);
    });
    ctx.shadowBlur = 0;
  }

  function update() {
    if (isGameOver) return;

    const head = { x: snake[0].x + dx, y: snake[0].y + dy };

    // Wall collision
    if (head.x < 0 || head.x >= TILE_COUNT || head.y < 0 || head.y >= TILE_COUNT) {
      return gameOver();
    }

    // Self collision
    for (let part of snake) {
      if (part.x === head.x && part.y === head.y) {
        return gameOver();
      }
    }

    snake.unshift(head);

    // Food collision
    if (head.x === food.x && head.y === food.y) {
      score += 10;
      scoreVal.textContent = score;
      playTone(600, 0.1);
      spawnFood();
      if (score > highScore) {
        highScore = score;
        highScoreVal.textContent = highScore;
        localStorage.setItem('studiox_snake_highscore', highScore.toString());
      }
    } else {
      snake.pop();
    }

    draw();
  }

  function gameOver() {
    isGameOver = true;
    clearInterval(gameInterval);
    playTone(150, 0.4);
    console.log("Game over! Final Score:", score);
    overlay.style.display = 'flex';
    document.getElementById('overlay-msg').textContent = 'Score: ' + score;
  }

  function resetGame() {
    snake = [{ x: 10, y: 10 }];
    dx = 1;
    dy = 0;
    score = 0;
    scoreVal.textContent = 0;
    isGameOver = false;
    overlay.style.display = 'none';
    spawnFood();
    clearInterval(gameInterval);
    gameInterval = setInterval(update, 110);
    console.log("New game session started!");
  }

  window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp' || e.key === 'w') {
      if (dy === 0) { dx = 0; dy = -1; }
    } else if (e.key === 'ArrowDown' || e.key === 's') {
      if (dy === 0) { dx = 0; dy = 1; }
    } else if (e.key === 'ArrowLeft' || e.key === 'a') {
      if (dx === 0) { dx = -1; dy = 0; }
    } else if (e.key === 'ArrowRight' || e.key === 'd') {
      if (dx === 0) { dx = 1; dy = 0; }
    } else if (e.key === ' ' && isGameOver) {
      resetGame();
    }
  });

  document.getElementById('d-up').onclick = () => { if (dy === 0) { dx = 0; dy = -1; } };
  document.getElementById('d-down').onclick = () => { if (dy === 0) { dx = 0; dy = 1; } };
  document.getElementById('d-left').onclick = () => { if (dx === 0) { dx = -1; dy = 0; } };
  document.getElementById('d-right').onclick = () => { if (dx === 0) { dx = 1; dy = 0; } };

  startBtn.addEventListener('click', resetGame);

  resetGame();
})();`
    }
  },
  {
    id: 'beatbox-synth',
    name: 'Cyberpunk Beatbox & Synth Studio',
    category: 'Audio & Music',
    keywords: ['beat', 'synth', 'music', 'sound', 'piano', 'drum', 'audio', 'instrument'],
    description: 'Fully interactive Web Audio drum machine and piano synthesizer with real-time waveform visualizer, 8 tactile pads, and keyboard controls.',
    code: {
      html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cyber Beatbox & Synth</title>
</head>
<body>
  <div class="synth-station">
    <header class="station-header">
      <div class="brand">
        <span class="icon">🎹</span>
        <div>
          <h2>CYBER-SYNTH 3000</h2>
          <p>Real-Time Web Audio Studio & Beat Generator</p>
        </div>
      </div>
      <div class="controls-top">
        <button id="auto-beat-btn" class="glow-btn">▶ Start Auto Beat</button>
        <button id="panic-btn" class="subtle-btn">Stop All</button>
      </div>
    </header>

    <!-- Waveform Visualizer Canvas -->
    <div class="visualizer-card">
      <canvas id="waveform-canvas" width="600" height="100"></canvas>
    </div>

    <!-- 8 Drum Pads Grid -->
    <div class="section-title">
      <span>TACTILE DRUM PADS (Keys 1-8)</span>
      <span class="badge">Web Audio Synth</span>
    </div>
    <div class="pads-grid">
      <button class="pad-btn" data-key="1" data-sound="kick">
        <span class="pad-num">1</span>
        <span class="pad-name">KICK</span>
      </button>
      <button class="pad-btn" data-key="2" data-sound="snare">
        <span class="pad-num">2</span>
        <span class="pad-name">SNARE</span>
      </button>
      <button class="pad-btn" data-key="3" data-sound="hihat">
        <span class="pad-num">3</span>
        <span class="pad-name">HI-HAT</span>
      </button>
      <button class="pad-btn" data-key="4" data-sound="clap">
        <span class="pad-num">4</span>
        <span class="pad-name">CLAP</span>
      </button>
      <button class="pad-btn" data-key="5" data-sound="tom">
        <span class="pad-num">5</span>
        <span class="pad-name">NEON TOM</span>
      </button>
      <button class="pad-btn" data-key="6" data-sound="laser">
        <span class="pad-num">6</span>
        <span class="pad-name">LASER ZAP</span>
      </button>
      <button class="pad-btn" data-key="7" data-sound="bass">
        <span class="pad-num">7</span>
        <span class="pad-name">SUB BASS</span>
      </button>
      <button class="pad-btn" data-key="8" data-sound="chime">
        <span class="pad-num">8</span>
        <span class="pad-name">CHIME</span>
      </button>
    </div>

    <!-- Synth Piano Keys -->
    <div class="section-title">
      <span>SYNTHESIZER KEYS (Notes C4 - C5)</span>
      <span class="badge">Polyphonic Sine</span>
    </div>
    <div class="piano-keyboard">
      <button class="piano-key" data-note="261.63" data-label="C4">C4</button>
      <button class="piano-key" data-note="293.66" data-label="D4">D4</button>
      <button class="piano-key" data-note="329.63" data-label="E4">E4</button>
      <button class="piano-key" data-note="349.23" data-label="F4">F4</button>
      <button class="piano-key" data-note="392.00" data-label="G4">G4</button>
      <button class="piano-key" data-note="440.00" data-label="A4">A4</button>
      <button class="piano-key" data-note="493.88" data-label="B4">B4</button>
      <button class="piano-key" data-note="523.25" data-label="C5">C5</button>
    </div>

    <footer class="station-footer">
      <span id="active-log">Ready. Click pads or press keys 1-8 to play beats!</span>
    </footer>
  </div>
</body>
</html>`,
      css: `* { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, sans-serif; }
body { background: #070913; color: #f8fafc; min-height: 100vh; display: flex; justify-content: center; align-items: center; padding: 20px; }
.synth-station { width: 100%; max-width: 680px; background: #0f1423; border: 1px solid #1e293b; border-radius: 20px; padding: 24px; box-shadow: 0 0 40px rgba(6, 182, 212, 0.15); }
.station-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #1e293b; padding-bottom: 16px; margin-bottom: 16px; }
.brand { display: flex; align-items: center; gap: 12px; }
.brand .icon { font-size: 28px; }
.brand h2 { font-size: 18px; font-weight: 800; color: #38bdf8; letter-spacing: 1px; }
.brand p { font-size: 11px; color: #94a3b8; }
.controls-top { display: flex; gap: 8px; }
.glow-btn { background: #06b6d4; color: #02131e; border: none; padding: 8px 16px; border-radius: 8px; font-weight: bold; font-size: 12px; cursor: pointer; transition: all 0.2s; box-shadow: 0 0 15px rgba(6, 182, 212, 0.4); }
.glow-btn:hover { background: #22d3ee; transform: scale(1.03); }
.subtle-btn { background: #1e293b; color: #94a3b8; border: 1px solid #334155; padding: 8px 14px; border-radius: 8px; font-size: 12px; cursor: pointer; }
.subtle-btn:hover { color: #fff; background: #334155; }
.visualizer-card { background: #090d1a; border: 1px solid #1e293b; border-radius: 12px; overflow: hidden; margin-bottom: 18px; }
#waveform-canvas { width: 100%; height: 90px; display: block; }
.section-title { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; font-size: 11px; font-weight: 700; color: #94a3b8; letter-spacing: 0.5px; }
.badge { background: #1e293b; color: #38bdf8; padding: 2px 8px; border-radius: 4px; font-size: 10px; }
.pads-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 20px; }
.pad-btn { background: #161f36; border: 1px solid #273553; border-radius: 12px; height: 75px; display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer; transition: all 0.1s; color: #f8fafc; }
.pad-btn:hover { background: #1e2b4a; border-color: #38bdf8; transform: translateY(-2px); }
.pad-btn.active { background: #06b6d4; color: #02131e; border-color: #22d3ee; box-shadow: 0 0 25px rgba(6, 182, 212, 0.8); transform: scale(0.95); }
.pad-num { font-size: 10px; color: #64748b; font-weight: bold; margin-bottom: 2px; }
.pad-btn.active .pad-num { color: #02131e; }
.pad-name { font-size: 12px; font-weight: 800; letter-spacing: 0.5px; }
.piano-keyboard { display: grid; grid-template-columns: repeat(8, 1fr); gap: 6px; margin-bottom: 16px; }
.piano-key { background: #f8fafc; color: #090d16; border: none; height: 90px; border-radius: 6px; font-weight: bold; font-size: 11px; cursor: pointer; display: flex; align-items: flex-end; justify-content: center; padding-bottom: 8px; transition: all 0.1s; }
.piano-key:hover { background: #e2e8f0; }
.piano-key.active { background: #a855f7; color: #ffffff; box-shadow: 0 0 20px rgba(168, 85, 247, 0.8); transform: translateY(4px); }
.station-footer { text-align: center; font-size: 11px; color: #64748b; padding-top: 12px; border-top: 1px solid #1e293b; font-family: monospace; }`,
      js: `(function() {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  let ctx = null;
  let isAutoBeating = false;
  let beatTimer = null;
  let beatIndex = 0;

  function initAudio() {
    if (!ctx) ctx = new AudioCtx();
    if (ctx.state === 'suspended') ctx.resume();
  }

  // Visualizer Canvas Setup
  const canvas = document.getElementById('waveform-canvas');
  const canvasCtx = canvas.getContext('2d');
  let waveAmp = 0;

  function drawWaveform() {
    requestAnimationFrame(drawWaveform);
    canvasCtx.fillStyle = '#090d1a';
    canvasCtx.fillRect(0, 0, canvas.width, canvas.height);

    canvasCtx.lineWidth = 2.5;
    canvasCtx.strokeStyle = '#38bdf8';
    canvasCtx.beginPath();

    const sliceWidth = canvas.width / 60;
    let x = 0;

    for (let i = 0; i < 60; i++) {
      const v = Math.sin((i * 0.2) + (Date.now() * 0.01)) * waveAmp;
      const y = (canvas.height / 2) + (v * (canvas.height / 2.5));
      if (i === 0) canvasCtx.moveTo(x, y);
      else canvasCtx.lineTo(x, y);
      x += sliceWidth;
    }

    canvasCtx.stroke();
    waveAmp *= 0.92;
  }
  drawWaveform();

  function triggerWave() {
    waveAmp = Math.min(1, waveAmp + 0.6);
  }

  // Synthesize Drum Sounds
  function playSound(type) {
    initAudio();
    triggerWave();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    if (type === 'kick') {
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.exponentialRampToValueAtTime(0.01, now + 0.35);
      gain.gain.setValueAtTime(1, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.35);
    } else if (type === 'snare') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(180, now);
      osc.frequency.exponentialRampToValueAtTime(20, now + 0.2);
      gain.gain.setValueAtTime(0.7, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.2);
    } else if (type === 'hihat') {
      osc.type = 'highpass';
      osc.frequency.setValueAtTime(1000, now);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.08);
    } else if (type === 'laser') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(110, now + 0.25);
      gain.gain.setValueAtTime(0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.25);
    } else if (type === 'bass') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(65.41, now);
      gain.gain.setValueAtTime(0.8, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.5);
    } else {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(type === 'chime' ? 880 : 330, now);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.25);
    }
  }

  function playNote(freq, label) {
    initAudio();
    triggerWave();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.5);
    document.getElementById('active-log').textContent = \`Played Synth Note: \${label} (\${freq} Hz)\`;
    console.log(\`[Synth]: \${label}\`);
  }

  // Pad Click Listeners
  document.querySelectorAll('.pad-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const sound = btn.dataset.sound;
      playSound(sound);
      btn.classList.add('active');
      setTimeout(() => btn.classList.remove('active'), 120);
      document.getElementById('active-log').textContent = \`Triggered: \${sound.toUpperCase()}\`;
      console.log(\`[Drum Pad]: \${sound}\`);
    });
  });

  // Piano Key Listeners
  document.querySelectorAll('.piano-key').forEach(key => {
    key.addEventListener('click', () => {
      const freq = parseFloat(key.dataset.note);
      const label = key.dataset.label;
      playNote(freq, label);
      key.classList.add('active');
      setTimeout(() => key.classList.remove('active'), 150);
    });
  });

  // Keyboard Mapping (1-8 for pads, a-k for piano)
  window.addEventListener('keydown', (e) => {
    const pad = document.querySelector(\`.pad-btn[data-key="\${e.key}"]\`);
    if (pad) {
      pad.click();
      return;
    }
  });

  // Auto Beat Generator
  const autoBtn = document.getElementById('auto-beat-btn');
  const panicBtn = document.getElementById('panic-btn');

  const pattern = ['kick', 'hihat', 'snare', 'hihat', 'kick', 'kick', 'snare', 'hihat'];

  autoBtn.addEventListener('click', () => {
    initAudio();
    if (isAutoBeating) {
      clearInterval(beatTimer);
      isAutoBeating = false;
      autoBtn.textContent = '▶ Start Auto Beat';
      autoBtn.style.background = '#06b6d4';
    } else {
      isAutoBeating = true;
      autoBtn.textContent = '⏹ Stop Auto Beat';
      autoBtn.style.background = '#ec4899';
      beatTimer = setInterval(() => {
        const snd = pattern[beatIndex % pattern.length];
        playSound(snd);
        const pad = document.querySelector(\`.pad-btn[data-sound="\${snd}"]\`);
        if (pad) {
          pad.classList.add('active');
          setTimeout(() => pad.classList.remove('active'), 80);
        }
        beatIndex++;
      }, 200);
    }
  });

  panicBtn.addEventListener('click', () => {
    if (beatTimer) clearInterval(beatTimer);
    isAutoBeating = false;
    autoBtn.textContent = '▶ Start Auto Beat';
    autoBtn.style.background = '#06b6d4';
    document.getElementById('active-log').textContent = 'All audio stopped.';
  });
})();`
    }
  }
];

export function getTemplateByPrompt(prompt: string): TemplateApp | null {
  const p = prompt.toLowerCase();
  for (const template of TEMPLATES) {
    if (template.keywords.some(kw => p.includes(kw))) {
      return template;
    }
  }
  return null;
}
