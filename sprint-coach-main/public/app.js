const SKILLS = ['Reading', 'Writing', 'Listening', 'Speaking'];
const SKILL_ICONS = { Reading: '\uD83D\uDCD6', Writing: '\u270D\uFE0F', Listening: '\uD83C\uDFA7', Speaking: '\uD83D\uDDE3\uFE0F' };
const LEVELS = ['Very Low', 'Low', 'Okay', 'Good', 'Confident'];
const LEVEL_EMOJI = ['\uD83D\uDE30', '\uD83D\uDE1F', '\uD83D\uDE10', '\uD83D\uDE0A', '\uD83D\uDD25'];
const SPRINTS = {
  Reading: [
    "Read a short passage (150 words) and identify the main idea in one sentence.",
    "Skim a paragraph and find 3 key facts in under 2 minutes.",
    "Read a passage and match 4 headings to paragraphs.",
    "Identify True/False/Not Given for 3 statements about a short text."
  ],
  Writing: [
    "Write a 50-word summary of a given chart description.",
    "Draft an introduction paragraph for: 'Should universities be free?'",
    "Rewrite 3 sentences using formal academic vocabulary.",
    "Write a conclusion for an essay on 'remote work vs office work'."
  ],
  Listening: [
    "Listen prompt: Write down 5 keywords you'd expect in a lecture about climate change.",
    "Practice: Spell out 5 common IELTS names/addresses from memory.",
    "Map exercise: Describe a route from your home to the nearest store in 3 sentences.",
    "Fill in blanks: Complete 3 sentences about a university campus description."
  ],
  Speaking: [
    "Record yourself: Describe your hometown in 60 seconds.",
    "Practice: Give your opinion on 'Is technology making us less social?' in 45 seconds.",
    "Describe an object on your desk for 30 seconds using varied vocabulary.",
    "Answer: 'What do you enjoy doing in your free time?' \u2014 speak for 1 minute."
  ]
};

let state = { levels: {}, completedToday: {}, streak: 0 };
let activeSkill = SKILLS[0];
let currentUserId = null;

function today() { return new Date().toISOString().slice(0, 10); }

// Cookie helpers
function getCookie(name) {
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? match[2] : null;
}

// Theme (stays in localStorage)
function toggleTheme() {
  const dark = document.getElementById('theme-toggle').checked;
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : '');
  localStorage.setItem('theme', dark ? 'dark' : 'light');
}
(function initTheme() {
  const saved = localStorage.getItem('theme');
  if (saved === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
    document.getElementById('theme-toggle').checked = true;
  }
})();

// API helpers
async function api(method, url, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  return res.json();
}

async function loadState() {
  state = await api('GET', `/api/state/${currentUserId}`);
}

// Init
async function init() {
  const savedUserId = getCookie('userId');
  if (savedUserId) {
    currentUserId = parseInt(savedUserId);
    await loadState();
    renderApp();
  } else {
    renderUsernameScreen();
  }
}

function renderUsernameScreen() {
  const root = document.getElementById('app-root');
  root.innerHTML = `
    <div class="username-screen">
      <h2>Welcome! Pick a username</h2>
      <input type="text" id="username-input" placeholder="Enter username..." maxlength="30" autofocus>
      <button class="btn btn-primary" style="max-width:300px" onclick="submitUsername()">Start</button>
    </div>
  `;
  document.getElementById('username-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submitUsername();
  });
}

async function submitUsername() {
  const input = document.getElementById('username-input');
  const username = input.value.trim();
  if (!username) return;
  const user = await api('POST', '/api/user', { username });
  if (user.error) { alert(user.error); return; }
  currentUserId = user.id;
  await loadState();
  renderApp();
}

function renderApp() {
  const root = document.getElementById('app-root');
  root.innerHTML = `
    <div class="streak" id="streak"></div>
    <div class="tabs" id="tabs"></div>
    <div id="sprint-area"></div>
    <div class="card">
      <div class="ladder">
        <h3>Confidence Ladder</h3>
        <div id="all-ladders"></div>
      </div>
    </div>
    <button class="reset" onclick="resetProgress()">Reset Progress</button>
    <div class="footer">Leap Scholar IELTS Prep &mdash; Sprint Coach</div>
  `;
  render();
}

function render() {
  // Streak
  const streakEl = document.getElementById('streak');
  if (state.streak > 0) {
    streakEl.innerHTML = `<span class="streak-icon">\uD83D\uDD25</span> ${state.streak}-day streak! Keep going!`;
  } else {
    streakEl.innerHTML = `<span class="streak-icon">\uD83C\uDFAF</span> Start your streak today!`;
  }

  // Tabs
  const tabsEl = document.getElementById('tabs');
  tabsEl.innerHTML = SKILLS.map(s => {
    const done = state.completedToday[s] === today();
    return `<div class="tab ${s === activeSkill ? 'active' : ''}" onclick="selectSkill('${s}')">
      <span class="tab-icon">${SKILL_ICONS[s]}</span>${s}${done ? '<span class="tab-check">\u2713</span>' : ''}
    </div>`;
  }).join('');

  // Sprint area
  const area = document.getElementById('sprint-area');
  const doneToday = state.completedToday[activeSkill] === today();

  if (doneToday) {
    area.innerHTML = `<div class="card">
      <div class="done-msg">
        <span class="done-icon">\u2705</span>
        ${activeSkill} sprint completed today!<br>Come back tomorrow for your next sprint.
      </div>
    </div>`;
  } else {
    const task = SPRINTS[activeSkill][Math.floor(Math.random() * 4)];
    area.innerHTML = `
      <div class="card">
        <h2>${SKILL_ICONS[activeSkill]} Today's Sprint: ${activeSkill}</h2>
        <div class="timer-hint">\u23F1 ~10 minutes</div>
        <div class="sprint-task">${task}</div>
        <button class="btn btn-primary" id="complete-btn" onclick="completeSprint()">Complete Sprint</button>
        <div class="confidence-q" id="conf-q" style="display:none;">
          <h3>How confident do you feel about ${activeSkill} compared to yesterday?</h3>
          <div class="conf-options">
            ${LEVELS.map((l, i) => `<div class="conf-opt" onclick="submitConfidence(${i})">${LEVEL_EMOJI[i]} ${l}</div>`).join('')}
          </div>
        </div>
      </div>`;
  }

  // All ladders
  const laddersEl = document.getElementById('all-ladders');
  laddersEl.innerHTML = SKILLS.map(s => `
    <div class="ladder-skill-label"><span class="skill-dot"></span>${SKILL_ICONS[s]} ${s}</div>
    <div class="ladder-bar">
      ${LEVELS.map((l, i) => {
        const filled = i <= (state.levels[s] || 0);
        const current = i === (state.levels[s] || 0);
        return `<div class="ladder-step ${filled ? 'filled l' + i : ''} ${current ? 'current' : ''}">${l}</div>`;
      }).join('')}
    </div>
  `).join('');
}

function selectSkill(s) { activeSkill = s; render(); }

function completeSprint() {
  document.getElementById('complete-btn').disabled = true;
  document.getElementById('complete-btn').textContent = '\u2705 Done! Now reflect below:';
  document.getElementById('conf-q').style.display = 'block';
}

async function submitConfidence(level) {
  const newState = await api('POST', '/api/sprint/complete', {
    userId: currentUserId,
    skill: activeSkill,
    confidenceLevel: level
  });
  if (newState.error) { alert(newState.error); return; }
  state = newState;
  render();
}

async function resetProgress() {
  if (!confirm('Reset all progress?')) return;
  await api('POST', '/api/reset', { userId: currentUserId });
  await loadState();
  render();
}

init();
