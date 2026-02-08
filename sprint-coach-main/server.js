const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');
const db = require('./db');

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Create or get user
app.post('/api/user', (req, res) => {
  const { username } = req.body;
  if (!username || typeof username !== 'string' || username.trim().length === 0) {
    return res.status(400).json({ error: 'Username required' });
  }
  const user = db.getOrCreateUser(username.trim());
  res.cookie('userId', user.id, { maxAge: 365 * 24 * 60 * 60 * 1000, httpOnly: false });
  res.json({ id: user.id, username: user.username });
});

// Get user state
app.get('/api/state/:userId', (req, res) => {
  const userId = parseInt(req.params.userId);
  const user = db.getUserById(userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const state = db.getUserState(userId);
  res.json(state);
});

// Complete sprint
app.post('/api/sprint/complete', (req, res) => {
  const { userId, skill, confidenceLevel } = req.body;
  if (!userId || !skill || confidenceLevel === undefined) {
    return res.status(400).json({ error: 'Missing fields' });
  }
  const result = db.completeSprint(userId, skill, confidenceLevel);
  if (result.error) return res.status(409).json(result);
  const state = db.getUserState(userId);
  res.json(state);
});

// Reset progress
app.post('/api/reset', (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: 'Missing userId' });
  db.resetUser(userId);
  res.json({ ok: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Sprint Coach running on http://localhost:${PORT}`));
