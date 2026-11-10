'use strict';

const fs = require('fs');
const path = require('path');
const { app } = require('electron');

// Port of PersistedState / AppStore persistence.

function defaults() {
  return {
    highlights: {},
    bookmarks: [],
    notes: [],
    history: [],
    fontSize: 19,
    serif: true,
    columnWidth: 720,
    lastQuery: 'John 1',
    appearance: 'system'
  };
}

function statePath() {
  return path.join(app.getPath('userData'), 'state.json');
}

function coerce(raw) {
  const base = defaults();
  if (!raw || typeof raw !== 'object') return base;

  const highlights = {};
  if (raw.highlights && typeof raw.highlights === 'object' && !Array.isArray(raw.highlights)) {
    for (const [key, value] of Object.entries(raw.highlights)) {
      const index = Number(value);
      if (Number.isInteger(index) && index >= 0 && index < 5) highlights[key] = index;
    }
  }

  const bookmarks = Array.isArray(raw.bookmarks)
    ? raw.bookmarks.filter((b) => b && typeof b.reference === 'string').map((b) => ({
      id: String(b.id || ''),
      reference: String(b.reference),
      apiQuery: String(b.apiQuery || b.reference),
      snippet: String(b.snippet || ''),
      createdAt: String(b.createdAt || new Date().toISOString())
    }))
    : [];

  const notes = Array.isArray(raw.notes)
    ? raw.notes.filter((n) => n && typeof n.reference === 'string').map((n) => ({
      id: String(n.id || ''),
      reference: String(n.reference),
      verseText: String(n.verseText || ''),
      body: String(n.body || ''),
      createdAt: String(n.createdAt || new Date().toISOString()),
      updatedAt: String(n.updatedAt || n.createdAt || new Date().toISOString())
    }))
    : [];

  const history = Array.isArray(raw.history)
    ? raw.history.filter((h) => h && typeof h.apiQuery === 'string').slice(0, 40).map((h) => ({
      id: String(h.id || ''),
      title: String(h.title || h.apiQuery),
      apiQuery: String(h.apiQuery),
      visitedAt: String(h.visitedAt || new Date().toISOString())
    }))
    : [];

  const num = (value, fallback, lo, hi) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(Math.max(n, lo), hi);
  };

  return {
    highlights,
    bookmarks,
    notes,
    history,
    fontSize: num(raw.fontSize, base.fontSize, 14, 28),
    serif: typeof raw.serif === 'boolean' ? raw.serif : base.serif,
    columnWidth: num(raw.columnWidth, base.columnWidth, 520, 900),
    lastQuery: typeof raw.lastQuery === 'string' && raw.lastQuery.trim() ? raw.lastQuery : base.lastQuery,
    appearance: ['system', 'light', 'dark'].includes(raw.appearance) ? raw.appearance : base.appearance
  };
}

function loadState() {
  try {
    const data = fs.readFileSync(statePath(), 'utf8');
    return coerce(JSON.parse(data));
  } catch (_) {
    return defaults();
  }
}

function saveState(state) {
  const clean = coerce(state);
  const target = statePath();
  const temp = `${target}.tmp`;
  try {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(temp, JSON.stringify(clean, null, 2), 'utf8');
    fs.renameSync(temp, target);
    return { ok: true };
  } catch (error) {
    try { fs.unlinkSync(temp); } catch (_) { /* ignore */ }
    return { ok: false, error: error.message };
  }
}

module.exports = { loadState, saveState, defaults };
