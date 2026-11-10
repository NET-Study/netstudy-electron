'use strict';

const path = require('path');
const { app, BrowserWindow, Menu, ipcMain, clipboard, shell, nativeTheme, dialog } = require('electron');

const { fetchPassage } = require('./api');
const { loadState, saveState } = require('./store');

const isMac = process.platform === 'darwin';
const isWindows = process.platform === 'win32';

let mainWindow = null;

const OVERLAY_LIGHT = { color: '#F2EADF', symbolColor: '#6B635A' };
const OVERLAY_DARK = { color: '#1A171E', symbolColor: '#C9C2B8' };

function send(command) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('menu', command);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 820,
    minWidth: 940,
    minHeight: 620,
    show: false,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#0D0C10' : '#F1EBE1',
    title: 'NET Study',
    autoHideMenuBar: true,
    titleBarStyle: isMac ? 'hiddenInset' : (isWindows ? 'hidden' : 'default'),
    ...(isMac ? { trafficLightPosition: { x: 16, y: 16 } } : {}),
    ...(isWindows ? { titleBarOverlay: { ...OVERLAY_LIGHT, height: 32 } } : {}),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: true
    }
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (process.platform === 'linux') mainWindow.maximize();
  });

  mainWindow.on('closed', () => { mainWindow = null; });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('file://')) {
      event.preventDefault();
      if (/^https?:/i.test(url)) shell.openExternal(url);
    }
  });

  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    const mod = isMac ? input.meta : input.control;
    if (!mod) return;
    const key = input.key.toLowerCase();

    if (key === 'f') { event.preventDefault(); send('focus-search'); }
    else if (key === 'd') { event.preventDefault(); send('votd'); }
    else if (key === 'r') { event.preventDefault(); send('random'); }
    else if (key === ']') { event.preventDefault(); send('next'); }
    else if (key === '[') { event.preventDefault(); send('previous'); }
    else if (key === 's' && input.alt) { event.preventDefault(); send('toggle-sidebar'); }
    else if (key === '=' || key === '+') { event.preventDefault(); send('font-up'); }
    else if (key === '-') { event.preventDefault(); send('font-down'); }
  });
}

function showAbout() {
  dialog.showMessageBox({
    type: 'info',
    title: 'About NET Study',
    message: `NET Study ${app.getVersion()}`,
    detail: 'A quiet reader for the New English Translation.\n\nScripture text is the NET Bible, \u00a9 Biblical Studies Press, served through the public API at labs.bible.org. This is an unofficial reader and is not affiliated with Bible.org.\n\nNotes, highlights and bookmarks stay on this computer.',
    buttons: ['OK'],
    noLink: true
  });
}

function buildMenu() {
  const study = {
    label: 'Study',
    submenu: [
      { label: 'Go to Reference\u2026', accelerator: 'CmdOrCtrl+F', click: () => send('focus-search') },
      { type: 'separator' },
      { label: 'Verse of the Day', accelerator: 'CmdOrCtrl+D', click: () => send('votd') },
      { label: 'Random Verse', accelerator: 'CmdOrCtrl+R', click: () => send('random') },
      { type: 'separator' },
      { label: 'Next Chapter', accelerator: 'CmdOrCtrl+]', click: () => send('next') },
      { label: 'Previous Chapter', accelerator: 'CmdOrCtrl+[', click: () => send('previous') },
      { type: 'separator' },
      { label: 'Toggle Sidebar', accelerator: isMac ? 'Cmd+Alt+S' : 'Ctrl+Alt+S', click: () => send('toggle-sidebar') },
      { label: 'Reading Settings', accelerator: 'CmdOrCtrl+,', click: () => send('settings') }
    ]
  };

  const template = isMac
    ? [
      {
        label: app.name,
        submenu: [
          { role: 'about' },
          { type: 'separator' },
          { role: 'hide' }, { role: 'hideOthers' }, { role: 'unhide' },
          { type: 'separator' },
          { role: 'quit' }
        ]
      },
      { label: 'Edit', submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
      study,
      { label: 'View', submenu: [{ role: 'toggleDevTools' }, { type: 'separator' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { type: 'separator' }, { role: 'togglefullscreen' }] },
      { role: 'windowMenu' }
    ]
    : [
      { label: 'File', submenu: [{ role: 'quit' }] },
      { label: 'Edit', submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
      study,
      { label: 'View', submenu: [{ role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { type: 'separator' }, { role: 'togglefullscreen' }, { role: 'toggleDevTools' }] },
      { label: 'Help', submenu: [{ label: 'About NET Study', click: showAbout }, { label: 'NET Bible at bible.org', click: () => shell.openExternal('https://netbible.org') }] }
    ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

const gotLock = isWindows || isMac
  ? app.requestSingleInstanceLock()
  : true;

if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    ipcMain.handle('bible:fetch', (_event, passage) => fetchPassage(passage));
    ipcMain.handle('state:load', () => loadState());
    ipcMain.handle('state:save', (_event, state) => saveState(state));
    ipcMain.handle('clipboard:write', (_event, text) => {
      clipboard.writeText(String(text == null ? '' : text));
      return true;
    });
    ipcMain.handle('theme:set', (_event, theme) => {
      if (isWindows && mainWindow && !mainWindow.isDestroyed()) {
        try {
          mainWindow.setTitleBarOverlay({ ...(theme === 'dark' ? OVERLAY_DARK : OVERLAY_LIGHT), height: 32 });
        } catch (_) { /* older Windows builds */ }
      }
      return true;
    });
    ipcMain.handle('app:info', () => ({
      platform: process.platform,
      version: app.getVersion(),
      userData: app.getPath('userData')
    }));

    buildMenu();
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (!isMac) app.quit();
  });
}
