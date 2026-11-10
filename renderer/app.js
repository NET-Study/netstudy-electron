'use strict';

/* NET Study - Electron renderer. Ports AppStore + the SwiftUI views. */

const NB = window.NETBible;
const bridge = window.netStudy;

const { Reference, PassageQuery, BOOKS, HIGHLIGHTS, cleanText, verseId, verseReference } = NB;

const ICONS = {
  sidebar: '<rect x="3" y="4" width="18" height="16" rx="2"/><line x1="9" y1="4" x2="9" y2="20"/>',
  left: '<polyline points="15 18 9 12 15 6"/>',
  right: '<polyline points="9 18 15 12 9 6"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  shuffle: '<path d="M16 3h5v5"/><path d="M4 20 21 3"/><path d="M21 16v5h-5"/><path d="M15 15l6 6"/><path d="M4 4l5 5"/>',
  type: '<path d="M4 7V4h16v3"/><path d="M9 20h6"/><path d="M12 4v16"/>',
  search: '<circle cx="11" cy="11" r="7"/><line x1="20" y1="20" x2="16.65" y2="16.65"/>',
  x: '<line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>',
  bookmark: '<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>',
  'bookmark-fill': '<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" fill="currentColor"/>',
  note: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h8M8 17h5"/>',
  pencil: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/>',
  check: '<polyline points="4 12 9 17 20 6"/>',
  dots: '<circle cx="12" cy="5" r="1.5" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="12" cy="19" r="1.5" fill="currentColor" stroke="none"/>',
  eraser: '<path d="M20 20H7L3 16a2 2 0 0 1 0-2.8L11.2 5a2 2 0 0 1 2.8 0l6 6a2 2 0 0 1 0 2.8L13 20"/>',
  trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/>',
  offline: '<path d="M2 2l20 20"/><path d="M8.5 16.5a5 5 0 0 1 6.4-.4"/><path d="M5 12.5a10 10 0 0 1 4.2-2.5"/><path d="M15.5 9.9a10 10 0 0 1 3.5 2.6"/><circle cx="12" cy="20" r="0.9" fill="currentColor" stroke="none"/>'
};

const DEFAULTS = {
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

let saved = { ...DEFAULTS };

const ui = {
  query: null,
  verses: [],
  loading: false,
  error: null,
  selectedVerseId: null,
  copied: false,
  votd: [],
  section: 'read',
  expandedBook: null,
  showSidebar: true,
  settingsOpen: false,
  editing: null,
  suggestions: [],
  suggestionIndex: -1
};

let loadToken = 0;
let saveTimer = null;
let copyTimer = null;

/* ---------- helpers ---------- */

const $ = (id) => document.getElementById(id);
const root = document.documentElement;

function esc(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function icon(name, cls) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"${cls ? ` class="${cls}"` : ''}>${ICONS[name] || ''}</svg>`;
}

function hydrateIcons(scope) {
  (scope || document).querySelectorAll('[data-icon]').forEach((node) => {
    node.innerHTML = icon(node.getAttribute('data-icon'));
  });
}

function uuid() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function todayLong() {
  return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

function shortDate(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function toVerse(raw) {
  const verse = {
    bookname: String(raw.bookname),
    chapter: String(raw.chapter),
    verse: String(raw.verse),
    text: String(raw.text)
  };
  verse.id = verseId(verse);
  verse.reference = verseReference(verse);
  verse.cleanText = cleanText(verse.text);
  return verse;
}

/* ---------- theme + reading prefs ---------- */

function resolvedTheme() {
  if (saved.appearance === 'light') return 'light';
  if (saved.appearance === 'dark') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme() {
  const theme = resolvedTheme();
  root.dataset.theme = theme;
  if (bridge && bridge.setTheme) bridge.setTheme(theme);
}

function applyReadingPrefs() {
  const fs = saved.fontSize;
  root.style.setProperty('--font-size', `${fs}px`);
  root.style.setProperty('--num-col', `${Math.max(fs * 1.2, 24)}px`);
  root.style.setProperty('--num-size', `${Math.max(fs * 0.56, 10)}px`);
  root.style.setProperty('--col-width', `${saved.columnWidth}px`);

  document.querySelectorAll('.verse-text').forEach((node) => {
    node.classList.toggle('serif', saved.serif);
    node.classList.toggle('sans', !saved.serif);
  });

  const sizeValue = $('size-value');
  const widthValue = $('width-value');
  if (sizeValue) sizeValue.textContent = `${Math.round(fs)} pt`;
  if (widthValue) widthValue.textContent = String(Math.round(saved.columnWidth));
}

/* ---------- persistence ---------- */

function snapshot() {
  const ref = ui.query ? ui.query.reference() : null;
  return {
    highlights: saved.highlights,
    bookmarks: saved.bookmarks,
    notes: saved.notes,
    history: saved.history,
    fontSize: saved.fontSize,
    serif: saved.serif,
    columnWidth: saved.columnWidth,
    lastQuery: ref ? ref.apiQuery() : (ui.query ? ui.query.raw : saved.lastQuery),
    appearance: saved.appearance
  };
}

function persist() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(flushSave, 300);
}

function flushSave() {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  bridge.saveState(snapshot());
}

/* ---------- data loading ---------- */

async function load(query, record = true) {
  if (query.kind === 'reference' && !query.reference()) {
    ui.error = 'I couldn\u2019t read that reference. Try something like "John 3:16" or "Psalm 23".';
    ui.loading = false;
    renderReader();
    return;
  }

  const token = ++loadToken;
  ui.loading = true;
  ui.error = null;
  ui.selectedVerseId = null;
  ui.copied = false;
  renderReader();

  const result = await bridge.fetchPassage(query.apiPassage());
  if (token !== loadToken) return;

  if (result && result.ok) {
    ui.verses = result.verses.map(toVerse);
    ui.query = query;
    ui.loading = false;

    const ref = query.reference();
    if (ref) ui.expandedBook = ref.book.name;

    if (record) recordHistory(query);

    renderAll();
    $('reader-body').scrollTop = 0;
  } else {
    ui.error = (result && result.error) || 'Something went wrong.';
    ui.loading = false;
    renderReader();
  }
}

async function loadVotd() {
  const result = await bridge.fetchPassage('votd');
  if (result && result.ok) {
    ui.votd = result.verses.map(toVerse);
    if (!ui.verses.length) renderReader();
  }
}

function recordHistory(query) {
  const key = query.apiPassage();
  if (!key) return;
  saved.history = saved.history.filter((h) => h.apiQuery.toLowerCase() !== key.toLowerCase());
  saved.history.unshift({
    id: uuid(),
    title: query.title(),
    apiQuery: key,
    visitedAt: new Date().toISOString()
  });
  if (saved.history.length > 40) saved.history = saved.history.slice(0, 40);
  flushSave();
}

function goTo(reference) {
  if (!reference) return;
  load(PassageQuery.fromReference(reference));
}

function goNext() {
  const ref = ui.query && ui.query.reference();
  const next = ref && ref.nextChapter();
  if (next) goTo(next);
}

function goPrevious() {
  const ref = ui.query && ui.query.reference();
  const prev = ref && ref.previousChapter();
  if (prev) goTo(prev);
}

function openSaved(queryString) {
  const ref = NB.parseReference(queryString);
  if (ref) goTo(ref);
}

/* ---------- rendering: header ---------- */

function renderHeader() {
  const q = ui.query;
  $('doc-title').textContent = q ? q.title() : 'NET Study';

  let sub = 'New English Translation';
  if (q) {
    if (q.kind === 'votd') sub = 'NET Bible \u00b7 Verse of the Day';
    else if (q.kind === 'random') sub = 'NET Bible \u00b7 Random';
  }
  $('doc-sub').textContent = sub;

  const ref = q && q.reference();
  $('btn-prev').disabled = !(ref && ref.previousChapter());
  $('btn-next').disabled = !(ref && ref.nextChapter());

  $('btn-votd').classList.toggle('active', !!q && q.kind === 'votd');
  $('btn-random').classList.toggle('active', !!q && q.kind === 'random');
  $('btn-settings').classList.toggle('active', ui.settingsOpen);
}

/* ---------- rendering: sidebar ---------- */

function emptyState(iconName, title, message) {
  return `<div class="empty-state">
    ${icon(iconName)}
    <div class="empty-title">${esc(title)}</div>
    <div class="empty-msg">${esc(message)}</div>
  </div>`;
}

function bookBlock(book, current) {
  const isCurrent = current && current.book.name === book.name;
  const open = ui.expandedBook === book.name;
  let html = `<div class="book-block">
    <div class="book-row${isCurrent ? ' current' : ''}" data-book="${esc(book.name)}">
      <span class="book-name">${esc(book.name)}</span>
      <span class="book-count">${book.chapters}</span>
    </div>`;
  if (open) {
    html += '<div class="chapter-grid">';
    for (let i = 1; i <= book.chapters; i++) {
      const active = isCurrent && current.chapter === i;
      html += `<button class="chapter-chip${active ? ' active' : ''}" data-chapter="${i}">${i}</button>`;
    }
    html += '</div>';
  }
  html += '</div>';
  return html;
}

function renderLibrary() {
  const current = ui.query && ui.query.reference();
  let html = '<div class="section-label">Old Testament</div>';
  NB.oldTestament.forEach((book) => { html += bookBlock(book, current); });
  html += '<div class="section-label" style="padding-top:14px">New Testament</div>';
  NB.newTestament.forEach((book) => { html += bookBlock(book, current); });
  return html;
}

function renderSaved() {
  if (!saved.bookmarks.length) {
    return emptyState('bookmark', 'Nothing saved yet', 'Open a verse, then hit the bookmark button to keep it here.');
  }
  let html = '<div class="section-label">Bookmarks</div>';
  saved.bookmarks.forEach((b) => {
    html += `<div class="list-item" data-saved="${esc(b.apiQuery)}">
      <button class="item-delete" data-del-bookmark="${esc(b.id)}" title="Remove bookmark">${icon('x')}</button>
      <div class="list-ref">${esc(b.reference)}</div>
      <div class="list-snippet">${esc(b.snippet)}</div>
    </div>`;
  });
  return html;
}

function renderNotes() {
  if (!saved.notes.length) {
    return emptyState('note', 'No notes yet', 'Select a verse and add a note. Your study trail lands here.');
  }
  let html = '<div class="section-label">Study Notes</div>';
  saved.notes.forEach((n) => {
    html += `<div class="notes-card list-item" data-note-ref="${esc(n.reference)}">
      <button class="item-delete" data-del-note="${esc(n.id)}" title="Delete note">${icon('trash')}</button>
      <div class="list-head">
        <span class="list-ref">${esc(n.reference)}</span>
        <span class="spacer"></span>
        <span class="list-date">${esc(shortDate(n.updatedAt))}</span>
      </div>
      <div class="list-note">${esc(n.body)}</div>
    </div>`;
  });
  return html;
}

function renderSidebar() {
  $('sidebar').classList.toggle('collapsed', !ui.showSidebar);
  document.querySelectorAll('#segmented .seg-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.section === ui.section);
  });

  const list = $('sidebar-list');
  if (ui.section === 'read') list.innerHTML = renderLibrary();
  else if (ui.section === 'saved') list.innerHTML = renderSaved();
  else list.innerHTML = renderNotes();
}

/* ---------- rendering: reader ---------- */

function groupVerses(verses) {
  const groups = [];
  for (const verse of verses) {
    const last = groups[groups.length - 1];
    if (last && last.book.toLowerCase() === verse.bookname.toLowerCase() && String(last.chapter) === String(verse.chapter)) {
      last.verses.push(verse);
    } else {
      groups.push({ book: verse.bookname, chapter: verse.chapter, verses: [verse] });
    }
  }
  return groups;
}

function passageHeaderHtml() {
  const q = ui.query;
  if (!q) return '';

  if (q.kind === 'votd') {
    return `<div class="passage-eyebrow">Verse of the Day</div>
      <div class="passage-title">A word for today</div>
      <div class="passage-sub">${esc(todayLong())}</div>`;
  }

  if (q.kind === 'random') {
    return `<div class="passage-eyebrow">Random Passage</div>
      <div class="passage-title">Where the pages fell open</div>`;
  }

  if (q.kind === 'custom') {
    return `<div class="passage-eyebrow">Passages</div>
      <div class="passage-title" style="font-size:30px">${esc(q.raw)}</div>`;
  }

  const ref = q.reference();
  if (!ref) {
    return `<div class="passage-title" style="font-size:30px">${esc(q.raw)}</div>`;
  }

  const testament = ref.book.testament === 'old' ? 'Old Testament' : 'New Testament';
  let title = `<span>${esc(ref.book.name)}</span>`;
  if (ref.verseStart == null) {
    title += `<span class="gold">${ref.chapter}</span>`;
  } else {
    let verses = `${ref.chapter}:${ref.verseStart}`;
    if (ref.verseEnd != null && ref.verseEnd !== ref.verseStart) verses += `-${ref.verseEnd}`;
    title += `<span class="verses">${verses}</span>`;
  }

  return `<div class="passage-eyebrow">${testament}</div>
    <div class="passage-title">${title}</div>`;
}

function verseRowHtml(verse) {
  const highlightIndex = saved.highlights[verse.id];
  const hasHighlight = Number.isInteger(highlightIndex) && HIGHLIGHTS[highlightIndex];
  const selected = ui.selectedVerseId === verse.id;
  const bookmarked = saved.bookmarks.some((b) => b.reference === verse.reference);
  const noted = saved.notes.some((n) => n.reference === verse.reference);

  const classes = ['verse-row'];
  if (hasHighlight) classes.push('has-hl');
  if (selected) classes.push('selected');
  if (bookmarked || noted) classes.push('marked');

  const style = hasHighlight ? ` style="--hl:${HIGHLIGHTS[highlightIndex]}"` : '';

  let marks = '';
  if (bookmarked) marks += `<span class="bm">${icon('bookmark-fill')}</span>`;
  if (noted) marks += `<span>${icon('note')}</span>`;

  return `<div class="${classes.join(' ')}" data-id="${esc(verse.id)}"${style}>
    <button class="verse-num" data-act="select" aria-label="Select verse ${esc(verse.verse)}">${esc(verse.verse)}</button>
    <div class="verse-text ${saved.serif ? 'serif' : 'sans'}">${esc(verse.cleanText)}</div>
    <div class="verse-marks">${marks}</div>
    <button class="verse-dots" data-act="select" aria-label="Verse actions">${icon('dots')}</button>
  </div>`;
}

function passageHtml() {
  const groups = groupVerses(ui.verses);
  let html = `<section class="passage">${passageHeaderHtml()}`;

  if (groups.length === 1 && ui.query && ui.query.reference() && ui.query.reference().verseStart != null) {
    // single verse-range: no group header, matching the Swift reader
  }

  groups.forEach((group) => {
    if (groups.length > 1) {
      html += `<div class="group-head"><span>${esc(group.book)} ${esc(group.chapter)}</span></div>`;
    }
    html += '<div class="verses">';
    group.verses.forEach((verse) => { html += verseRowHtml(verse); });
    html += '</div>';
  });

  html += '</section>';
  return html;
}

function welcomeHtml() {
  const chips = ['Psalm 23', 'John 1', 'Romans 8', 'Proverbs 3', 'Isaiah 40', 'Matthew 5'];
  let html = `<section class="welcome">
    <div class="welcome-eyebrow">NET Study</div>
    <div class="welcome-title">Read slowly.
Take notes.</div>`;

  if (ui.votd.length) {
    const text = ui.votd.map((v) => v.cleanText).join(' ');
    html += `<div class="votd-card">
      <div class="votd-label">Verse of the Day</div>
      <div class="votd-text">${esc(text)}</div>
      <div class="votd-ref">${esc(ui.votd[0].bookname)} ${esc(ui.votd[0].chapter)}:${esc(ui.votd[0].verse)}</div>
    </div>`;
  }

  html += '<div class="section-label">Start somewhere</div><div class="chips">';
  chips.forEach((chip) => { html += `<button class="soft-btn" data-ref="${esc(chip)}">${esc(chip)}</button>`; });
  html += '</div>';

  if (saved.history.length) {
    html += '<div class="section-label">Recent</div><div class="chips">';
    saved.history.slice(0, 6).forEach((h) => {
      html += `<button class="soft-btn" data-ref="${esc(h.title)}">${esc(h.title)}</button>`;
    });
    html += '</div>';
  }

  html += '</section>';
  return html;
}

function loadingHtml() {
  const widths = [120, 260, 0, 620, 580, 640, 520, 600, 440];
  let html = '<div class="loading">';
  widths.forEach((w, i) => {
    if (i === 2) html += '<div style="height:18px"></div>';
    html += `<div class="shimmer" style="width:${w ? w + 'px' : '100%'};height:${i === 1 ? 30 : 12}px"></div>`;
  });
  html += '</div>';
  return html;
}

function errorHtml(message) {
  return `<div class="center-state">
    ${icon('offline')}
    <div class="center-title">That one didn\u2019t load</div>
    <div class="center-msg">${esc(message)}</div>
    <button class="soft-btn prominent" data-retry="1">Try again</button>
  </div>`;
}

function renderContent() {
  const body = $('reader-body');
  if (ui.loading && !ui.verses.length) { body.innerHTML = loadingHtml(); return; }
  if (ui.error) { body.innerHTML = errorHtml(ui.error); return; }
  if (!ui.verses.length) { body.innerHTML = welcomeHtml(); return; }
  body.innerHTML = passageHtml();
  applyReadingPrefs();
}

function actionBarHtml(verse) {
  const highlightIndex = saved.highlights[verse.id];
  const bookmarked = saved.bookmarks.some((b) => b.reference === verse.reference);
  const hasNote = saved.notes.some((n) => n.reference === verse.reference);

  let dots = '';
  HIGHLIGHTS.forEach((color, index) => {
    dots += `<button class="hl-dot${highlightIndex === index ? ' active' : ''}" data-act="hl:${index}" style="background:${color};color:${color}" title="${NB.HIGHLIGHT_NAMES[index]} highlight"></button>`;
  });

  return `<div class="action-ref">
      <strong>${esc(verse.reference)}</strong>
      <span>Click a color to highlight</span>
    </div>
    <div class="sep"></div>
    <div class="dots">${dots}
      <button class="icon-btn small" data-act="clear" title="Clear highlight" ${Number.isInteger(highlightIndex) ? '' : 'disabled'}>${icon('eraser')}</button>
    </div>
    <div class="sep"></div>
    <div class="action-group">
      <button class="soft-btn" data-act="note">${icon('pencil')} ${hasNote ? 'Edit note' : 'Note'}</button>
      <button class="icon-btn small${bookmarked ? ' active' : ''}" data-act="bookmark" title="Bookmark verse">${icon(bookmarked ? 'bookmark-fill' : 'bookmark')}</button>
      <button class="icon-btn small${ui.copied ? ' active' : ''}" data-act="copy" title="Copy verse">${icon(ui.copied ? 'check' : 'copy')}</button>
    </div>
    <button class="icon-btn small" data-act="close" title="Close">${icon('x')}</button>`;
}

function renderActionBar() {
  const bar = $('action-bar');
  const verse = ui.selectedVerseId ? ui.verses.find((v) => v.id === ui.selectedVerseId) : null;
  if (!verse) {
    bar.classList.add('hidden');
    bar.innerHTML = '';
    return;
  }
  bar.innerHTML = actionBarHtml(verse);
  bar.classList.remove('hidden');
  hydrateIcons(bar);
}

function renderReader() {
  renderHeader();
  renderContent();
  renderActionBar();
  $('settings').classList.toggle('hidden', !ui.settingsOpen);
  renderSettings();
}

function renderAll() {
  renderSidebar();
  renderReader();
}

/* ---------- settings ---------- */

function renderSettings() {
  const size = $('set-size');
  const width = $('set-width');
  const serif = $('set-serif');
  if (!size) return;

  if (document.activeElement !== size) size.value = String(saved.fontSize);
  if (document.activeElement !== width) width.value = String(saved.columnWidth);
  serif.checked = saved.serif;

  $('size-value').textContent = `${Math.round(saved.fontSize)} pt`;
  $('width-value').textContent = String(Math.round(saved.columnWidth));

  document.querySelectorAll('#set-appearance .seg-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.appearance === saved.appearance);
  });
}

/* ---------- actions ---------- */

function selectVerse(id) {
  ui.selectedVerseId = ui.selectedVerseId === id ? null : id;
  ui.copied = false;
  document.querySelectorAll('.verse-row').forEach((row) => {
    row.classList.toggle('selected', row.dataset.id === ui.selectedVerseId);
  });
  renderActionBar();
}

function setHighlight(verse, index) {
  if (index == null) delete saved.highlights[verse.id];
  else saved.highlights[verse.id] = index;
  flushSave();
  renderContent();
  renderActionBar();
  renderSidebar();
}

function toggleBookmark(verse) {
  const index = saved.bookmarks.findIndex((b) => b.reference === verse.reference);
  if (index >= 0) {
    saved.bookmarks.splice(index, 1);
  } else {
    saved.bookmarks.unshift({
      id: uuid(),
      reference: verse.reference,
      apiQuery: `${verse.bookname} ${verse.chapter}:${verse.verse}`,
      snippet: verse.cleanText.slice(0, 160),
      createdAt: new Date().toISOString()
    });
  }
  flushSave();
  renderContent();
  renderActionBar();
  renderSidebar();
}

function noteFor(reference) {
  return saved.notes.find((n) => n.reference === reference) || null;
}

function saveNote(verse, bodyText) {
  const trimmed = String(bodyText || '').trim();
  const index = saved.notes.findIndex((n) => n.reference === verse.reference);

  if (index >= 0) {
    if (!trimmed) saved.notes.splice(index, 1);
    else {
      saved.notes[index].body = trimmed;
      saved.notes[index].updatedAt = new Date().toISOString();
    }
  } else if (trimmed) {
    const now = new Date().toISOString();
    saved.notes.unshift({
      id: uuid(),
      reference: verse.reference,
      verseText: verse.cleanText.slice(0, 200),
      body: trimmed,
      createdAt: now,
      updatedAt: now
    });
  }

  flushSave();
  renderContent();
  renderActionBar();
  renderSidebar();
}

/* ---------- note editor ---------- */

function openNoteEditor(verse) {
  ui.editing = verse;
  const existing = noteFor(verse.reference);
  $('note-ref').textContent = verse.reference.toUpperCase();
  $('note-verse').textContent = verse.cleanText;
  $('note-body').value = existing ? existing.body : '';
  $('note-delete').classList.toggle('hidden', !existing);
  $('note-overlay').classList.remove('hidden');
  setTimeout(() => $('note-body').focus(), 60);
}

function closeNoteEditor() {
  ui.editing = null;
  $('note-overlay').classList.add('hidden');
}

/* ---------- search ---------- */

function renderSuggestions() {
  const box = $('suggestions');
  if (!ui.suggestions.length) {
    box.classList.add('hidden');
    box.innerHTML = '';
    return;
  }
  box.innerHTML = ui.suggestions.map((name, i) => {
    const book = NB.bookNamed(name);
    return `<div class="suggestion${i === ui.suggestionIndex ? ' active' : ''}" data-name="${esc(name)}">
      <span>${esc(name)}</span><span class="ch">${book ? book.chapters + ' ch' : ''}</span>
    </div>`;
  }).join('');
  box.classList.remove('hidden');
}

function updateSuggestions(value) {
  ui.suggestions = NB.suggestions(value);
  ui.suggestionIndex = -1;
  renderSuggestions();
  $('search-clear').classList.toggle('hidden', !value.length);
}

function submitSearch(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return;
  ui.suggestions = [];
  ui.suggestionIndex = -1;
  renderSuggestions();
  $('search-input').blur();
  load(PassageQuery.userInput(trimmed));
}

/* ---------- events ---------- */

function bindStatic() {
  $('btn-sidebar').addEventListener('click', () => {
    ui.showSidebar = !ui.showSidebar;
    renderSidebar();
  });

  $('btn-prev').addEventListener('click', goPrevious);
  $('btn-next').addEventListener('click', goNext);

  $('btn-votd').addEventListener('click', () => { load(PassageQuery.verseOfTheDay()); });
  $('btn-random').addEventListener('click', () => { load(PassageQuery.random()); });
  $('btn-random-foot').addEventListener('click', () => { load(PassageQuery.random()); });

  $('btn-settings').addEventListener('click', (event) => {
    event.stopPropagation();
    ui.settingsOpen = !ui.settingsOpen;
    renderReader();
  });

  document.addEventListener('mousedown', (event) => {
    if (!ui.settingsOpen) return;
    if (event.target.closest('#settings') || event.target.closest('#btn-settings')) return;
    ui.settingsOpen = false;
    renderReader();
  });

  // sidebar sections
  $('segmented').addEventListener('click', (event) => {
    const btn = event.target.closest('[data-section]');
    if (!btn) return;
    ui.section = btn.dataset.section;
    renderSidebar();
  });

  // sidebar list
  $('sidebar-list').addEventListener('click', (event) => {
    const removeBookmark = event.target.closest('[data-del-bookmark]');
    if (removeBookmark) {
      event.stopPropagation();
      saved.bookmarks = saved.bookmarks.filter((b) => b.id !== removeBookmark.dataset.delBookmark);
      persist();
      renderSidebar();
      return;
    }

    const removeNote = event.target.closest('[data-del-note]');
    if (removeNote) {
      event.stopPropagation();
      saved.notes = saved.notes.filter((n) => n.id !== removeNote.dataset.delNote);
      persist();
      renderSidebar();
      renderContent();
      renderActionBar();
      return;
    }

    const chapter = event.target.closest('[data-chapter]');
    if (chapter) {
      const bookName = chapter.closest('.book-block').querySelector('[data-book]').dataset.book;
      const book = NB.bookNamed(bookName);
      const number = Math.min(Math.max(parseInt(chapter.dataset.chapter, 10), 1), book.chapters);
      ui.expandedBook = book.name;
      goTo(new Reference(book, number));
      return;
    }

    const bookRow = event.target.closest('[data-book]');
    if (bookRow && !event.target.closest('[data-chapter]')) {
      const name = bookRow.dataset.book;
      ui.expandedBook = ui.expandedBook === name ? null : name;
      renderSidebar();
      return;
    }

    const savedItem = event.target.closest('[data-saved]');
    if (savedItem) {
      openSaved(savedItem.dataset.saved);
      return;
    }

    const noteItem = event.target.closest('[data-note-ref]');
    if (noteItem) {
      openSaved(noteItem.dataset.noteRef);
    }
  });

  // reader body
  $('reader-body').addEventListener('click', (event) => {
    const retry = event.target.closest('[data-retry]');
    if (retry) {
      load(ui.query, false);
      return;
    }

    const chip = event.target.closest('[data-ref]');
    if (chip) {
      const ref = NB.parseReference(chip.dataset.ref);
      if (ref) goTo(ref);
      return;
    }

    const row = event.target.closest('.verse-row');
    if (!row) return;

    const selection = window.getSelection();
    if (selection && selection.toString().length > 2) return;

    selectVerse(row.dataset.id);
  });

  // action bar
  $('action-bar').addEventListener('click', (event) => {
    const btn = event.target.closest('[data-act]');
    if (!btn) return;
    const verse = ui.verses.find((v) => v.id === ui.selectedVerseId);
    if (!verse) return;

    const act = btn.dataset.act;
    if (act === 'close') {
      ui.selectedVerseId = null;
      renderActionBar();
      document.querySelectorAll('.verse-row.selected').forEach((row) => row.classList.remove('selected'));
      return;
    }
    if (act === 'clear') { setHighlight(verse, null); return; }
    if (act === 'bookmark') { toggleBookmark(verse); return; }
    if (act === 'note') { openNoteEditor(verse); return; }
    if (act === 'copy') {
      bridge.copy(`"${verse.cleanText}" (${verse.reference}, NET)`);
      ui.copied = true;
      renderActionBar();
      if (copyTimer) clearTimeout(copyTimer);
      copyTimer = setTimeout(() => { ui.copied = false; renderActionBar(); }, 1400);
      return;
    }
    if (act.indexOf('hl:') === 0) {
      const index = parseInt(act.slice(3), 10);
      if (saved.highlights[verse.id] === index) setHighlight(verse, null);
      else setHighlight(verse, index);
    }
  });

  // note editor
  $('note-cancel').addEventListener('click', closeNoteEditor);
  $('note-save').addEventListener('click', () => {
    if (!ui.editing) return;
    const verse = ui.editing;
    saveNote(verse, $('note-body').value);
    closeNoteEditor();
  });
  $('note-delete').addEventListener('click', () => {
    if (!ui.editing) return;
    const verse = ui.editing;
    saveNote(verse, '');
    closeNoteEditor();
  });
  $('note-overlay').addEventListener('mousedown', (event) => {
    if (event.target === $('note-overlay')) closeNoteEditor();
  });

  // settings controls
  $('set-size').addEventListener('input', (event) => {
    saved.fontSize = Number(event.target.value);
    applyReadingPrefs();
    renderSettings();
    persist();
  });

  $('set-width').addEventListener('input', (event) => {
    saved.columnWidth = Number(event.target.value);
    applyReadingPrefs();
    renderSettings();
    persist();
  });

  $('set-serif').addEventListener('change', (event) => {
    saved.serif = event.target.checked;
    applyReadingPrefs();
    persist();
  });

  $('set-appearance').addEventListener('click', (event) => {
    const btn = event.target.closest('[data-appearance]');
    if (!btn) return;
    saved.appearance = btn.dataset.appearance;
    applyTheme();
    renderSettings();
    persist();
  });

  // search
  const input = $('search-input');
  input.addEventListener('focus', () => {
    $('search-field').classList.add('focused');
    updateSuggestions(input.value);
  });
  input.addEventListener('blur', () => {
    $('search-field').classList.remove('focused');
    setTimeout(() => {
      ui.suggestions = [];
      renderSuggestions();
    }, 120);
  });
  input.addEventListener('input', () => updateSuggestions(input.value));
  input.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown' && ui.suggestions.length) {
      event.preventDefault();
      ui.suggestionIndex = (ui.suggestionIndex + 1) % ui.suggestions.length;
      renderSuggestions();
    } else if (event.key === 'ArrowUp' && ui.suggestions.length) {
      event.preventDefault();
      ui.suggestionIndex = (ui.suggestionIndex - 1 + ui.suggestions.length) % ui.suggestions.length;
      renderSuggestions();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (ui.suggestionIndex >= 0 && ui.suggestions[ui.suggestionIndex]) {
        input.value = `${ui.suggestions[ui.suggestionIndex]} `;
        ui.suggestions = [];
        ui.suggestionIndex = -1;
        renderSuggestions();
      } else {
        submitSearch(input.value);
      }
    } else if (event.key === 'Escape') {
      input.blur();
    }
  });

  $('search-clear').addEventListener('click', () => {
    input.value = '';
    updateSuggestions('');
    input.focus();
  });

  $('suggestions').addEventListener('mousedown', (event) => {
    const row = event.target.closest('[data-name]');
    if (!row) return;
    event.preventDefault();
    input.value = `${row.dataset.name} `;
    ui.suggestions = [];
    ui.suggestionIndex = -1;
    renderSuggestions();
    input.focus();
  });

  // escape closes transient UI
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (!$('note-overlay').classList.contains('hidden')) { closeNoteEditor(); return; }
    if (ui.settingsOpen) { ui.settingsOpen = false; renderReader(); return; }
    if (ui.selectedVerseId) {
      ui.selectedVerseId = null;
      renderActionBar();
      document.querySelectorAll('.verse-row.selected').forEach((row) => row.classList.remove('selected'));
    }
  });

  window.addEventListener('beforeunload', flushSave);

  if (bridge && bridge.onCommand) {
    bridge.onCommand((command) => {
      switch (command) {
        case 'focus-search':
          ui.suggestions = [];
          renderSuggestions();
          $('search-input').focus();
          $('search-input').select();
          break;
        case 'votd': load(PassageQuery.verseOfTheDay()); break;
        case 'random': load(PassageQuery.random()); break;
        case 'next': goNext(); break;
        case 'previous': goPrevious(); break;
        case 'toggle-sidebar':
          ui.showSidebar = !ui.showSidebar;
          renderSidebar();
          break;
        case 'settings':
          ui.settingsOpen = !ui.settingsOpen;
          renderReader();
          break;
        case 'font-up':
          saved.fontSize = Math.min(saved.fontSize + 1, 28);
          applyReadingPrefs();
          renderSettings();
          persist();
          break;
        case 'font-down':
          saved.fontSize = Math.max(saved.fontSize - 1, 14);
          applyReadingPrefs();
          renderSettings();
          persist();
          break;
        default:
          break;
      }
    });
  }

  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const onScheme = () => { if (saved.appearance === 'system') applyTheme(); };
  if (media.addEventListener) media.addEventListener('change', onScheme);
  else if (media.addListener) media.addListener(onScheme);
}

/* ---------- boot ---------- */

async function boot() {
  document.body.classList.add(`platform-${bridge.platform}`);
  hydrateIcons();
  bindStatic();

  const loaded = await bridge.loadState();
  saved = Object.assign({}, DEFAULTS, loaded || {});

  applyTheme();
  applyReadingPrefs();

  ui.query = PassageQuery.userInput(saved.lastQuery);
  if (ui.query.kind === 'reference' && !ui.query.reference()) {
    ui.query = PassageQuery.fromReference(new Reference(NB.bookNamed('John'), 1));
  }
  ui.expandedBook = ui.query.reference() ? ui.query.reference().book.name : 'John';

  renderAll();
  load(ui.query, false);
  loadVotd();
}

boot();
