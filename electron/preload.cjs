'use strict';

/**
 * Masaüstü köprüsü: renderer tarafındaki uygulama ile ana süreç arasında
 * yedekleme ve güncelleme işlemlerini taşır. Tarayıcıda (web sürümü) bu dosya
 * yüklenmez, bu yüzden web davranışı değişmez.
 */
const { contextBridge, ipcRenderer } = require('electron');

function subscribe(channel, handler) {
  const listener = (_event, payload) => handler(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

contextBridge.exposeInMainWorld('stockManagerDesktop', {
  isDesktop: true,
  getInfo: () => ipcRenderer.invoke('desktop:info'),
  saveBackup: (data, reason) => ipcRenderer.invoke('desktop:save-backup', { data, reason }),
  listBackups: () => ipcRenderer.invoke('desktop:list-backups'),
  readBackup: (name) => ipcRenderer.invoke('desktop:read-backup', { name }),
  readLatest: () => ipcRenderer.invoke('desktop:read-latest'),
  openBackupFolder: () => ipcRenderer.invoke('desktop:open-backup-folder'),
  checkUpdates: () => ipcRenderer.invoke('desktop:check-updates'),
  skipVersion: (version) => ipcRenderer.invoke('desktop:skip-version', { version }),
  installUpdate: (url) => ipcRenderer.invoke('desktop:install-update', { url }),
  openReleases: () => ipcRenderer.invoke('desktop:open-releases'),
  onFlushRequest: (handler) => subscribe('desktop:flush-request', handler),
  onBackupSaved: (handler) => subscribe('desktop:backup-saved', handler),
  onUpdateProgress: (handler) => subscribe('desktop:update-progress', handler)
});
