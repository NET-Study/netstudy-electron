'use strict';

const fs = require('fs');
const path = require('path');
const { app } = require('electron');

// Port of the Swift BibleAPI actor: memory cache -> network -> disk cache.

const memory = new Map();

function cacheDirectory() {
  const dir = path.join(app.getPath('userData'), 'passages');
  try { fs.mkdirSync(dir, { recursive: true }); } catch (_) { /* ignore */ }
  return dir;
}

function fnv1a(text) {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const mask = 0xffffffffffffffffn;
  for (const byte of Buffer.from(text, 'utf8')) {
    hash ^= BigInt(byte);
    hash = (hash * prime) & mask;
  }
  return hash.toString(16);
}

function cacheFile(key) {
  const safe = key.replace(/\//g, '-').slice(0, 28).replace(/ /g, '_');
  return path.join(cacheDirectory(), `${safe}-${fnv1a(key)}.json`);
}

function readCache(key) {
  try {
    const parsed = JSON.parse(fs.readFileSync(cacheFile(key), 'utf8'));
    return Array.isArray(parsed) && parsed.length ? parsed : null;
  } catch (_) {
    return null;
  }
}

function writeCache(key, verses) {
  try {
    fs.writeFileSync(cacheFile(key), JSON.stringify(verses), 'utf8');
  } catch (_) { /* cache is best effort */ }
}

class BibleError extends Error {
  constructor(message) { super(message); this.name = 'BibleError'; }
}

function normalizeVerse(item) {
  if (!item || typeof item !== 'object') return null;
  const book = item.bookname;
  const chapter = item.chapter;
  const verse = item.verse;
  const text = item.text;
  if (book == null || chapter == null || verse == null || text == null) return null;
  return {
    bookname: String(book),
    chapter: String(chapter),
    verse: String(verse),
    text: String(text)
  };
}

async function request(passage) {
  const url = new URL('https://labs.bible.org/api/');
  url.searchParams.set('passage', passage);
  url.searchParams.set('formatting', 'plain');
  url.searchParams.set('type', 'json');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 18000);

  let response;
  try {
    response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'NETStudy/1.0 (Electron)' }
    });
  } catch (_) {
    throw new BibleError("Can't reach the NET Bible service right now.");
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    throw new BibleError(`The Bible service replied with ${response.status}.`);
  }

  const body = await response.text();
  let parsed = null;
  try { parsed = JSON.parse(body); } catch (_) { parsed = null; }

  if (Array.isArray(parsed)) {
    const verses = parsed.map(normalizeVerse).filter(Boolean);
    if (!verses.length) throw new BibleError('No verses came back for that reference.');
    return verses;
  }

  // The service occasionally answers with an HTML error page even on 200.
  const stripped = body
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .trim();
  if (stripped) throw new BibleError(stripped.slice(0, 180));
  throw new BibleError('No verses came back for that reference.');
}

async function fetchPassage(passage) {
  const key = String(passage || '').trim();
  if (!key) return { ok: false, error: 'That reference doesn\u2019t look quite right.' };

  if (memory.has(key)) return { ok: true, verses: memory.get(key) };

  try {
    const verses = await request(key);
    memory.set(key, verses);
    writeCache(key, verses);
    return { ok: true, verses };
  } catch (error) {
    const cached = readCache(key);
    if (cached && cached.length) {
      memory.set(key, cached);
      return { ok: true, verses: cached, cached: true };
    }
    return { ok: false, error: error.message || 'Something went wrong.' };
  }
}

module.exports = { fetchPassage };
