'use strict';

/* Dev smoke test: drives the real UI and prints PASS/FAIL.
 * Run: ./node_modules/.bin/electron scripts/smoke.js */

const path = require('path');
const fs = require('fs');
const os = require('os');
const { app, BrowserWindow, ipcMain, clipboard } = require('electron');

const { fetchPassage, searchCached } = require('../src/api');
const { loadState, saveState } = require('../src/store');

const OUT = path.join(__dirname, 'out');
fs.mkdirSync(OUT, { recursive: true });
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'netstudy-smoke-')));

const logs = [];
const results = [];

function check(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  ${detail}` : ''}`);
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

app.whenReady().then(async () => {
  ipcMain.handle('bible:fetch', (_e, passage) => fetchPassage(passage));
  ipcMain.handle('bible:search', (_e, term) => searchCached(term));
  ipcMain.handle('state:load', () => loadState());
  ipcMain.handle('state:save', (_e, state) => saveState(state));
  ipcMain.handle('clipboard:write', (_e, text) => { clipboard.writeText(String(text)); return true; });
  ipcMain.handle('theme:set', () => true);
  ipcMain.handle('app:info', () => ({ platform: process.platform, version: '1.0.1' }));

  const win = new BrowserWindow({
    width: 1200,
    height: 820,
    show: false,
    backgroundColor: '#F1EBE1',
    webPreferences: {
      preload: path.join(__dirname, '..', 'src', 'preload.js'),
      contextIsolation: true,
      sandbox: false
    }
  });

  win.webContents.on('console-message', (_e, level, message, line, source) => {
    logs.push(`${level}: ${message} (${source}:${line})`);
  });

  const js = (code) => win.webContents.executeJavaScript(code, true);

  await win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  await wait(3500);

  const initial = await js(`({
    rows: document.querySelectorAll('.verse-row').length,
    title: document.getElementById('doc-title').textContent,
    selected: document.querySelectorAll('.verse-row.selected').length,
    error: !!document.querySelector('[data-retry]')
  })`);
  check('passage renders', initial.rows > 0, JSON.stringify(initial));
  check('nothing selected on load', initial.selected === 0, `selected=${initial.selected}`);

  await js(`document.querySelector('.verse-row').dispatchEvent(new MouseEvent('click',{bubbles:true}))`);
  await wait(250);
  let state = await js(`({
    bar: !document.getElementById('action-bar').classList.contains('hidden'),
    selected: document.querySelectorAll('.verse-row.selected').length,
    ref: document.querySelector('.action-ref strong')?.textContent || ''
  })`);
  check('verse click opens action bar', state.bar && state.selected === 1, state.ref);

  await js(`document.querySelector('[data-act="hl:2"]').dispatchEvent(new MouseEvent('click',{bubbles:true}))`);
  await wait(250);
  state = await js(`({
    hasHl: !!document.querySelector('.verse-row.has-hl'),
    varSet: (document.querySelector('.verse-row.has-hl')?.getAttribute('style') || '').includes('--hl')
  })`);
  check('highlight applies', state.hasHl && state.varSet, JSON.stringify(state));

  await js(`document.querySelector('[data-act="bookmark"]').dispatchEvent(new MouseEvent('click',{bubbles:true}))`);
  await wait(250);
  await js(`document.querySelector('[data-section="saved"]').dispatchEvent(new MouseEvent('click',{bubbles:true}))`);
  await wait(200);
  state = await js(`({ cards: document.querySelectorAll('[data-saved]').length, ref: document.querySelector('.list-ref')?.textContent || '' })`);
  check('bookmark saved in sidebar', state.cards === 1, state.ref);

  await js(`document.querySelector('[data-section="read"]').dispatchEvent(new MouseEvent('click',{bubbles:true}))`);
  await js(`document.querySelectorAll('.verse-row')[1].dispatchEvent(new MouseEvent('click',{bubbles:true}))`);
  await wait(150);
  await js(`document.querySelector('[data-act="note"]').dispatchEvent(new MouseEvent('click',{bubbles:true}))`);
  await wait(200);
  const modal = await js(`({ open: !document.getElementById('note-overlay').classList.contains('hidden'), ref: document.getElementById('note-ref').textContent })`);
  check('note editor opens', modal.open, modal.ref);

  await js(`(() => {
    const body = document.getElementById('note-body');
    body.value = 'Smoke test note';
    document.getElementById('note-save').dispatchEvent(new MouseEvent('click',{bubbles:true}));
  })()`);
  await wait(250);
  await js(`document.querySelector('[data-section="notes"]').dispatchEvent(new MouseEvent('click',{bubbles:true}))`);
  await wait(200);
  state = await js(`({ cards: document.querySelectorAll('[data-note-ref]').length, text: document.querySelector('.list-note')?.textContent || '' })`);
  check('note saved', state.cards === 1 && state.text.includes('Smoke test'), state.text);

  await js(`(() => {
    const input = document.getElementById('search-input');
    input.value = 'Ps 23';
    input.dispatchEvent(new Event('input',{bubbles:true}));
    input.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
  })()`);
  await wait(2200);
  state = await js(`({ title: document.getElementById('doc-title').textContent, rows: document.querySelectorAll('.verse-row').length })`);
  check('search parses "Ps 23"', state.title === 'Psalms 23' && state.rows > 0, JSON.stringify(state));

  await js(`document.getElementById('btn-next').dispatchEvent(new MouseEvent('click',{bubbles:true}))`);
  await wait(1800);
  state = await js(`({ title: document.getElementById('doc-title').textContent })`);
  check('next chapter', state.title === 'Psalms 24', state.title);

  // long range + multi passage
  await js(`(() => {
    const input = document.getElementById('search-input');
    input.value = 'rom 8:28-30; jude 3';
    input.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
  })()`);
  await wait(2600);
  state = await js(`({
    title: document.getElementById('doc-title').textContent,
    groups: document.querySelectorAll('.group-head').length,
    rows: document.querySelectorAll('.verse-row').length
  })`);
  check('multi-passage request', state.groups >= 2 && state.rows > 0, JSON.stringify(state));

  // cached keyword search
  await js(`(() => {
    const input = document.getElementById('search-input');
    input.focus();
    input.value = 'shepherd';
    input.dispatchEvent(new Event('input',{bubbles:true}));
  })()`);
  await wait(1000);
  state = await js(`({
    mode: document.getElementById('suggestions').classList.contains('search-mode'),
    rows: document.querySelectorAll('.search-row').length,
    first: document.querySelector('.search-ref')?.textContent || '',
    foot: document.querySelector('.search-foot')?.textContent || ''
  })`);
  check('keyword search finds cached verse',
    state.mode && state.rows > 0 && state.first === 'Psalms 23:1' && state.foot.includes('cached passage'),
    JSON.stringify(state));
  await win.webContents.capturePage().then((img) => fs.writeFileSync(path.join(OUT, 'search.png'), img.toPNG()));

  await js(`document.getElementById('search-input').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}))`);
  await wait(2200);
  state = await js(`({
    title: document.getElementById('doc-title').textContent,
    selected: document.querySelector('.verse-row.selected')?.dataset.id || '',
    bar: !document.getElementById('action-bar').classList.contains('hidden'),
    input: document.getElementById('search-input').value
  })`);
  check('keyword result opens and selects the verse',
    state.title === 'Psalms 23' && state.selected === 'Psalms|23|1' && state.bar && state.input === '',
    JSON.stringify(state));

  await js(`(() => {
    const input = document.getElementById('search-input');
    input.focus();
    input.value = 'zzzqqq';
    input.dispatchEvent(new Event('input',{bubbles:true}));
  })()`);
  await wait(900);
  state = await js(`({
    mode: document.getElementById('suggestions').classList.contains('search-mode'),
    empty: document.querySelector('.search-empty')?.textContent || ''
  })`);
  check('keyword search empty state', state.mode && /Nothing cached/.test(state.empty), state.empty);

  await js(`(() => {
    const input = document.getElementById('search-input');
    input.value = '';
    input.dispatchEvent(new Event('input',{bubbles:true}));
    input.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
  })()`);
  await wait(300);

  // persistence
  const persisted = loadState();
  check('state persisted', persisted.highlights && Object.keys(persisted.highlights).length >= 1 && persisted.bookmarks.length === 1 && persisted.notes.length === 1,
    `hl=${Object.keys(persisted.highlights || {}).length} bm=${persisted.bookmarks.length} notes=${persisted.notes.length}`);

  await js(`document.getElementById('btn-settings').dispatchEvent(new MouseEvent('click',{bubbles:true}))`);
  await wait(250);
  await win.webContents.capturePage().then((img) => fs.writeFileSync(path.join(OUT, 'light.png'), img.toPNG()));

  await js(`document.querySelector('[data-appearance="dark"]').dispatchEvent(new MouseEvent('click',{bubbles:true}))`);
  await wait(500);
  await win.webContents.capturePage().then((img) => fs.writeFileSync(path.join(OUT, 'dark.png'), img.toPNG()));

  const theme = await js(`document.documentElement.dataset.theme`);
  check('dark theme applies', theme === 'dark', theme);

  // saved/sidebar visuals
  await js(`document.getElementById('btn-settings').dispatchEvent(new MouseEvent('click',{bubbles:true}))`);
  await js(`document.querySelector('[data-section="read"]').dispatchEvent(new MouseEvent('click',{bubbles:true}))`);
  await js(`(() => {
    const input = document.getElementById('search-input');
    input.value = 'John 3:16';
    input.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
  })()`);
  await wait(2200);
  await win.webContents.capturePage().then((img) => fs.writeFileSync(path.join(OUT, 'dark-john.png'), img.toPNG()));

  const errors = logs.filter((line) => line.startsWith('3:') || /error/i.test(line));
  check('no console errors', errors.length === 0, errors.join(' | '));

  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  if (errors.length) console.log(errors.join('\n'));

  app.exit(failed ? 1 : 0);
});
