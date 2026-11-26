/* Schulplan – Desktop: stellt der Oberfläche dieselbe Brücke wie in der Android-App bereit */
'use strict';
const { contextBridge, ipcRenderer, webUtils } = require('electron');

const syncFns = ['loadData', 'saveData', 'listBackups', 'readBackup', 'isSystemDark', 'notificationsAllowed', 'appVersion', 'versionCode', 'getLaunchRoute', 'getIncoming', 'syncInfo', 'installDownloaded', 'widgetEnabled'];
const asyncFns = ['saveFile', 'shareFile', 'shareText', 'shareApk', 'print', 'syncReminders', 'requestNotificationPermission', 'setBarColors', 'setPageBackground', 'vibrate', 'keepScreenOn', 'setSecure', 'toast', 'exitApp', 'appReady', 'updateWidgets', 'setUpdateUrls', 'checkUpdate', 'startUpdate', 'syncPick', 'syncClear', 'syncRead', 'syncWrite', 'toggleWidget', 'widgetClose', 'widgetPin', 'openRoute'];

const api = { isDesktop: true };
syncFns.forEach((n) => { api[n] = (...args) => ipcRenderer.sendSync('sync', n, args); });
asyncFns.forEach((n) => { api[n] = (...args) => { ipcRenderer.send('async', n, args); return true; }; });
contextBridge.exposeInMainWorld('Android', api);
contextBridge.exposeInMainWorld('SCHULPLAN_DESKTOP', true);
ipcRenderer.on('refresh', () => window.postMessage({ schulplanRefresh: true }, '*'));

// Dateien (Team-Pakete, Einladungen, Sicherungen) per Ziehen & Ablegen öffnen
window.addEventListener('DOMContentLoaded', () => {
  document.addEventListener('dragover', (e) => e.preventDefault());
  document.addEventListener('drop', (e) => {
    e.preventDefault();
    const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (!f) return;
    f.text().then((t) => window.postMessage({ schulplanIncoming: t }, '*'));
  });
});
