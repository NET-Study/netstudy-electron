'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('netStudy', {
  platform: process.platform,
  fetchPassage: (passage) => ipcRenderer.invoke('bible:fetch', passage),
  searchCached: (term) => ipcRenderer.invoke('bible:search', term),
  loadState: () => ipcRenderer.invoke('state:load'),
  saveState: (state) => ipcRenderer.invoke('state:save', state),
  copy: (text) => ipcRenderer.invoke('clipboard:write', text),
  setTheme: (theme) => ipcRenderer.invoke('theme:set', theme),
  info: () => ipcRenderer.invoke('app:info'),
  onCommand: (handler) => {
    const listener = (_event, command) => handler(command);
    ipcRenderer.on('menu', listener);
    return () => ipcRenderer.removeListener('menu', listener);
  }
});
