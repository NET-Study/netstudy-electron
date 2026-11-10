'use strict';

const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const NETBible = require('./core/bible');

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

// MARK: - Cached keyword search

const BOOK_ORDER = new Map(NETBible.BOOKS.map((book, index) => [book.name.toLowerCase(), index]));
const SEARCH_OPTIONS = { sensitivity: 'base' };

function stripMarks(text) {
  return NETBible.cleanText(text);
}

/**
 * Full-text search over passages already cached on disk.
 * Every whitespace-separated token must appear somewhere in the verse.
 */
function searchCached(term, limit = 80) {
  const tokens = String(term || '')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);

  if (!tokens.length) return { verses: [], passages: 0, truncated: false };

  let files = [];
  try {
    files = fs.readdirSync(cacheDirectory()).filter((name) => name.toLowerCase().endsWith('.json'));
  } catch (_) {
    return { verses: [], passages: 0, truncated: false };
  }

  const seen = new Set();
  const hits = [];

  for (const name of files) {
    let verses = [];
    try {
      const parsed = JSON.parse(fs.readFileSync(path.join(cacheDirectory(), name), 'utf8'));
      if (Array.isArray(parsed)) verses = parsed;
    } catch (_) { continue; }

    for (const item of verses) {
      if (!item || item.bookname == null || item.chapter == null || item.verse == null || item.text == null) continue;
      const verse = {
        bookname: String(item.bookname),
        chapter: String(item.chapter),
        verse: String(item.verse),
        text: String(item.text)
      };
      const id = NETBible.verseId(verse);
      if (seen.has(id)) continue;

      const text = stripMarks(verse.text);
      const matches = tokens.every((token) => text.toLocaleLowerCase().includes(token.toLocaleLowerCase()));
      if (!matches) continue;

      seen.add(id);
      hits.push({ ...verse, id, reference: NETBible.verseReference(verse) });
    }
  }

  hits.sort((a, b) => {
    const left = BOOK_ORDER.has(a.bookname.toLowerCase()) ? BOOK_ORDER.get(a.bookname.toLowerCase()) : 999;
    const right = BOOK_ORDER.has(b.bookname.toLowerCase()) ? BOOK_ORDER.get(b.bookname.toLowerCase()) : 999;
    if (left !== right) return left - right;
    const chapterDiff = Number(a.chapter) - Number(b.chapter);
    if (chapterDiff) return chapterDiff;
    return Number(a.verse) - Number(b.verse);
  });

  return {
    verses: hits.slice(0, limit),
    passages: files.length,
    truncated: hits.length > limit
  };
}

module.exports = { fetchPassage, searchCached };
