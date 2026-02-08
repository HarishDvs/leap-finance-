const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'sprint-coach.db'));

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sprint_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id),
    skill TEXT NOT NULL,
    confidence_level INTEGER NOT NULL,
    completed_date TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS user_state (
    user_id INTEGER REFERENCES users(id),
    skill TEXT NOT NULL,
    confidence_level INTEGER DEFAULT 0,
    PRIMARY KEY (user_id, skill)
  );
`);

const stmts = {
  createUser: db.prepare('INSERT OR IGNORE INTO users (username) VALUES (?)'),
  getUser: db.prepare('SELECT * FROM users WHERE username = ?'),
  getUserById: db.prepare('SELECT * FROM users WHERE id = ?'),

  getState: db.prepare('SELECT skill, confidence_level FROM user_state WHERE user_id = ?'),
  upsertState: db.prepare(`
    INSERT INTO user_state (user_id, skill, confidence_level)
    VALUES (?, ?, ?)
    ON CONFLICT(user_id, skill) DO UPDATE SET confidence_level = excluded.confidence_level
  `),

  logSprint: db.prepare('INSERT INTO sprint_logs (user_id, skill, confidence_level, completed_date) VALUES (?, ?, ?, ?)'),
  getCompletionsToday: db.prepare('SELECT skill FROM sprint_logs WHERE user_id = ? AND completed_date = ?'),
  getDistinctDates: db.prepare('SELECT DISTINCT completed_date FROM sprint_logs WHERE user_id = ? ORDER BY completed_date DESC'),
};

function getOrCreateUser(username) {
  stmts.createUser.run(username);
  return stmts.getUser.get(username);
}

function getUserState(userId) {
  const skills = ['Reading', 'Writing', 'Listening', 'Speaking'];
  const rows = stmts.getState.all(userId);
  const levels = {};
  for (const s of skills) levels[s] = 0;
  for (const r of rows) levels[r.skill] = r.confidence_level;

  const today = new Date().toISOString().slice(0, 10);
  const completedToday = {};
  for (const r of stmts.getCompletionsToday.all(userId, today)) {
    completedToday[r.skill] = today;
  }

  // Compute streak
  const dates = stmts.getDistinctDates.all(userId).map(r => r.completed_date);
  let streak = 0;
  if (dates.length > 0) {
    let check = new Date(today + 'T12:00:00Z');
    // If today is not in dates, start from yesterday
    if (dates[0] !== today) {
      check.setDate(check.getDate() - 1);
    }
    for (const d of dates) {
      const expected = check.toISOString().slice(0, 10);
      if (d === expected) {
        streak++;
        check.setDate(check.getDate() - 1);
      } else if (d < expected) {
        break;
      }
    }
  }

  return { levels, completedToday, streak };
}

const completeSprint = db.transaction((userId, skill, confidenceLevel) => {
  const today = new Date().toISOString().slice(0, 10);

  // Check if already completed today
  const existing = stmts.getCompletionsToday.all(userId, today);
  if (existing.some(r => r.skill === skill)) {
    return { error: 'Already completed today' };
  }

  // Compute new level
  const rows = stmts.getState.all(userId);
  let current = 0;
  for (const r of rows) {
    if (r.skill === skill) { current = r.confidence_level; break; }
  }
  let newLevel = current;
  if (confidenceLevel > current && current < 4) newLevel = current + 1;
  else if (confidenceLevel < current && current > 0) newLevel = current - 1;

  stmts.upsertState.run(userId, skill, newLevel);
  stmts.logSprint.run(userId, skill, confidenceLevel, today);

  return { ok: true };
});

function resetUser(userId) {
  db.prepare('DELETE FROM user_state WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM sprint_logs WHERE user_id = ?').run(userId);
}

module.exports = { getOrCreateUser, getUserState, completeSprint, resetUser, getUserById: (id) => stmts.getUserById.get(id) };
