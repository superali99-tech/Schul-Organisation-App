/* Schulplan – Desktop (Windows) – Hauptprozess */
'use strict';

const { app, BrowserWindow, protocol, net, ipcMain, dialog, shell, Notification, nativeTheme, Menu, Tray, clipboard, powerSaveBlocker, session } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { pathToFileURL } = require('url');
const { spawn } = require('child_process');

app.setAppUserModelId('app.schulorga.lehrer.desktop');
protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }]);

const WWW = app.isPackaged ? path.join(process.resourcesPath, 'www') : path.join(__dirname, 'www');
const DATA = () => app.getPath('userData');
const FILE = () => path.join(DATA(), 'schulplan-data.json');
const BACKUPS = () => path.join(DATA(), 'auto-backups');
const CONF = () => path.join(DATA(), 'desktop-config.json');
const INSTALLER_URL = 'https://raw.githubusercontent.com/superali99-tech/Schul-Organisation-App/HEAD/release/Schulplan-Setup.exe';

let win = null;
let tray = null;
let quitting = false;
let blocker = null;
let reminderTimers = [];
let pendingIncoming = '';

// ------------------------------------------------------------------ Einstellungen der Desktop-Hülle
function conf() { try { return JSON.parse(fs.readFileSync(CONF(), 'utf8')); } catch (e) { return {}; } }
function setConf(patch) { const c = { ...conf(), ...patch }; fs.mkdirSync(DATA(), { recursive: true }); fs.writeFileSync(CONF(), JSON.stringify(c)); return c; }

function writeAtomic(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, content, 'utf8');
  fs.renameSync(tmp, file);
}
function dailyBackup(content) {
  try {
    const day = new Date().toISOString().slice(0, 10);
    writeAtomic(path.join(BACKUPS(), `auto-${day}.json`), content);
    const all = fs.readdirSync(BACKUPS()).filter((n) => n.startsWith('auto-') && n.endsWith('.json')).sort();
    all.slice(0, Math.max(0, all.length - 14)).forEach((n) => fs.unlinkSync(path.join(BACKUPS(), n)));
  } catch (e) { /* ignorieren */ }
}

// Ruft eine Funktion im Fenster auf (Rückmeldungen wie bei der Android-App)
function call(fn, ...args) {
  if (!win || win.isDestroyed()) return;
  win.webContents.executeJavaScript(`window.App && App.${fn} && App.${fn}(${args.map((a) => JSON.stringify(a)).join(',')})`).catch(() => {});
}
function toast(msg) {
  if (!win || win.isDestroyed()) return;
  win.webContents.executeJavaScript(`window.UI && UI.toast(${JSON.stringify(msg)})`).catch(() => {});
}

function versionCode(v) {
  const p = String(v).split('.').map((x) => parseInt(x, 10) || 0);
  return (p[0] || 0) * 10000 + (p[1] || 0) * 100 + (p[2] || 0);
}

// Download über den Netzwerk-Stack von Chromium (beachtet Proxy-Einstellungen von Windows)
async function httpGet(url, onProgress) {
  if (!url.startsWith('https://')) throw new Error('Nur sichere Adressen (https) erlaubt');
  let timer;
  const timeout = new Promise((_, rej) => { timer = setTimeout(() => rej(new Error('Zeitüberschreitung')), 10 * 60 * 1000); });
  const work = (async () => {
    const res = await net.fetch(url, { headers: { 'Cache-Control': 'no-cache' } });
    if (!res.ok) throw new Error('Server antwortet mit ' + res.status);
    const total = Number(res.headers.get('content-length') || 0);
    const reader = res.body.getReader();
    const chunks = [];
    let done = 0, last = -1;
    for (;;) {
      const { done: end, value } = await reader.read();
      if (end) break;
      chunks.push(Buffer.from(value));
      done += value.length;
      if (onProgress && total) { const pct = Math.floor((done * 100) / total); if (pct !== last) { last = pct; onProgress(pct); } }
    }
    return Buffer.concat(chunks);
  })();
  try { return await Promise.race([work, timeout]); } finally { clearTimeout(timer); }
}

// ------------------------------------------------------------------ Erinnerungen (solange Schulplan läuft, auch im Infobereich)
function scheduleReminders(list) {
  reminderTimers.forEach(clearTimeout);
  reminderTimers = [];
  const now = Date.now();
  for (const r of list) {
    const delay = r.time - now;
    if (delay <= 0 || delay > 2000000000) continue;
    reminderTimers.push(setTimeout(() => {
      if (!Notification.isSupported()) return;
      const n = new Notification({ title: r.title || 'Schulplan', body: r.text || '', icon: path.join(__dirname, 'build', 'icon.png') });
      n.on('click', () => { showWindow(); if (r.route) call('navigate', r.route); });
      n.show();
    }, delay));
  }
}

// ------------------------------------------------------------------ Fenster
function showWindow() {
  if (!win) { createWindow(); return; }
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

function createWindow() {
  const c = conf();
  const dark = c.dark != null ? c.dark : nativeTheme.shouldUseDarkColors;
  const bg = c.bg || (dark ? '#0b0d13' : '#f3f4fa');
  const b = c.bounds || {};
  win = new BrowserWindow({
    width: b.width || 1240, height: b.height || 820, x: b.x, y: b.y,
    minWidth: 380, minHeight: 560,
    backgroundColor: bg,
    show: false,
    title: 'Schulplan',
    icon: path.join(__dirname, 'build', 'icon.png'),
    autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: false, spellcheck: true, devTools: !app.isPackaged },
  });
  if (c.maximized) win.maximize();
  win.loadURL('app://schulplan/www/index.html');
  win.once('ready-to-show', () => win.show());

  const saveBounds = () => { if (!win.isDestroyed() && !win.isMinimized()) setConf({ bounds: win.isMaximized() ? c.bounds : win.getBounds(), maximized: win.isMaximized() }); };
  win.on('resize', saveBounds);
  win.on('move', saveBounds);
  win.on('close', (e) => {
    // Schließen = in den Infobereich, damit Erinnerungen weiterlaufen
    if (!quitting && tray) {
      e.preventDefault();
      win.hide();
      if (!conf().trayHintShown) {
        setConf({ trayHintShown: true });
        new Notification({ title: 'Schulplan läuft weiter', body: 'Schulplan ist unten rechts im Infobereich, damit Erinnerungen ankommen. Rechtsklick → „Beenden" schließt die App ganz.' }).show();
      }
    }
  });
  win.on('closed', () => { win = null; });

  // Externe Links (Telefon, E-Mail, Webseiten) im System öffnen
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('app://')) { e.preventDefault(); shell.openExternal(url); } });
}

function createTray() {
  try {
    tray = new Tray(path.join(__dirname, 'build', 'icon.png'));
    tray.setToolTip('Schulplan');
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: 'Schulplan öffnen', click: showWindow },
      { label: 'Heute', click: () => { showWindow(); call('navigate', '/today'); } },
      { label: 'Stundenplan', click: () => { showWindow(); call('navigate', '/timetable'); } },
      { type: 'separator' },
      { label: 'Beenden', click: () => { quitting = true; app.quit(); } },
    ]));
    tray.on('click', showWindow);
    tray.on('double-click', showWindow);
  } catch (e) { tray = null; }
}

// ------------------------------------------------------------------ Brücke (gleiche Funktionen wie in der Android-App)
const sync = {
  loadData: () => { try { return fs.readFileSync(FILE(), 'utf8'); } catch (e) { return ''; } },
  saveData: (json) => { try { writeAtomic(FILE(), json); dailyBackup(json); return true; } catch (e) { return false; } },
  listBackups: () => {
    try {
      return JSON.stringify(fs.readdirSync(BACKUPS()).filter((n) => n.endsWith('.json')).sort().reverse().map((name) => {
        const st = fs.statSync(path.join(BACKUPS(), name));
        return { name, size: st.size, modified: st.mtimeMs };
      }));
    } catch (e) { return '[]'; }
  },
  readBackup: (name) => { try { if (/[\\/]|\.\./.test(name)) return ''; return fs.readFileSync(path.join(BACKUPS(), name), 'utf8'); } catch (e) { return ''; } },
  isSystemDark: () => nativeTheme.shouldUseDarkColors,
  notificationsAllowed: () => true,
  appVersion: () => app.getVersion(),
  versionCode: () => versionCode(app.getVersion()),
  getLaunchRoute: () => '',
  getIncoming: () => { const t = pendingIncoming; pendingIncoming = ''; return t; },
  syncInfo: () => { const c = conf(); return c.syncFile ? JSON.stringify({ uri: c.syncFile, name: path.basename(c.syncFile) }) : ''; },
  installDownloaded: () => false,
};
ipcMain.on('sync', (e, name, args) => {
  try { e.returnValue = sync[name] ? sync[name](...args) : null; } catch (err) { e.returnValue = null; }
});

const async_ = {
  async saveFile(filename, mime, content, isB64) {
    const r = await dialog.showSaveDialog(win, { defaultPath: path.join(app.getPath('documents'), filename) });
    if (r.canceled || !r.filePath) { call('onFileSaved', false); return; }
    try { fs.writeFileSync(r.filePath, isB64 ? Buffer.from(content, 'base64') : content); call('onFileSaved', true); shell.showItemInFolder(r.filePath); } catch (e) { call('onFileSaved', false); }
  },
  async shareFile(filename, mime, content) { return async_.saveFile(filename, mime, content, false); },
  shareText(title, text) { clipboard.writeText(text); toast('In die Zwischenablage kopiert – jetzt z. B. in E-Mail oder Messenger einfügen (Strg+V)'); },
  shareApk() { clipboard.writeText(INSTALLER_URL); toast('Download-Link für Schulplan (Windows) kopiert'); },
  print(job) { win.webContents.print({ printBackground: true }, () => call('onPrintDone')); },
  syncReminders(json) { try { scheduleReminders(JSON.parse(json)); } catch (e) { /* ignorieren */ } },
  requestNotificationPermission() { call('onNotifPermission', true); },
  setBarColors(top, bottom, lightBars) { setConf({ dark: !lightBars }); },
  setPageBackground(color) { setConf({ bg: color }); if (win) win.setBackgroundColor(color); },
  vibrate() {},
  keepScreenOn(on) {
    if (on && blocker == null) blocker = powerSaveBlocker.start('prevent-display-sleep');
    if (!on && blocker != null) { powerSaveBlocker.stop(blocker); blocker = null; }
  },
  setSecure(on) { if (win) win.setContentProtection(!!on); },
  toast(msg) { toast(msg); },
  exitApp() { quitting = true; app.quit(); },
  appReady() { if (win && !win.isVisible()) win.show(); },
  updateWidgets() {},
  setUpdateUrls() {},
  async checkUpdate(reqId, urlsJson) {
    let urls = [];
    try { urls = JSON.parse(urlsJson); } catch (e) { /* leer */ }
    let lastErr = 'Keine Update-Adresse';
    for (const u of urls) {
      try {
        const buf = await httpGet(u + (u.includes('?') ? '&' : '?') + 't=' + Date.now());
        const j = JSON.parse(buf.toString('utf8'));
        const d = j.desktop;
        if (!d || !d.version || !d.url) { call('onUpdateInfo', reqId, true, JSON.stringify({ versionCode: 0 })); return; }
        call('onUpdateInfo', reqId, true, JSON.stringify({ versionCode: versionCode(d.version), versionName: d.version, apk: d.url, notes: d.notes || j.notes || [], date: d.date || j.date }));
        return;
      } catch (e) { lastErr = e.message; }
    }
    call('onUpdateInfo', reqId, false, lastErr);
  },
  async startUpdate(url) {
    try {
      const buf = await httpGet(url, (pct) => call('onUpdateProgress', pct));
      const file = path.join(os.tmpdir(), `Schulplan-Setup-${Date.now()}.exe`);
      fs.writeFileSync(file, buf);
      call('onUpdateState', 'installing', '');
      setTimeout(() => {
        // Stille Installation, danach startet Schulplan automatisch neu
        spawn(file, ['/S', '--force-run'], { detached: true, stdio: 'ignore' }).unref();
        quitting = true;
        app.quit();
      }, 1200);
    } catch (e) {
      call('onUpdateState', 'error', e.message);
    }
  },
  async syncPick(create, suggestedName) {
    const r = create
      ? await dialog.showSaveDialog(win, { title: 'Team-Datei anlegen (z. B. im OneDrive-Ordner)', defaultPath: path.join(app.getPath('documents'), suggestedName || 'Schulplan-Team.json'), filters: [{ name: 'Team-Datei', extensions: ['json'] }] })
      : await dialog.showOpenDialog(win, { title: 'Team-Datei auswählen', properties: ['openFile'], filters: [{ name: 'Team-Datei', extensions: ['json'] }] });
    const file = create ? r.filePath : (r.filePaths || [])[0];
    if (r.canceled || !file) { call('onSyncPicked', false, ''); return; }
    if (create && !fs.existsSync(file)) fs.writeFileSync(file, '');
    setConf({ syncFile: file });
    call('onSyncPicked', true, path.basename(file));
  },
  syncClear() { setConf({ syncFile: null }); },
  syncRead(reqId) {
    const f = conf().syncFile;
    fs.readFile(f || '', 'utf8', (err, txt) => call('onSyncData', reqId, !err && !!f, err ? String(err.message) : txt));
  },
  syncWrite(reqId, content) {
    const f = conf().syncFile;
    if (!f) { call('onSyncWritten', reqId, false); return; }
    fs.writeFile(f, content, 'utf8', (err) => call('onSyncWritten', reqId, !err));
  },
};
ipcMain.on('async', (e, name, args) => {
  const fn = async_[name];
  if (fn) Promise.resolve(fn(...args)).catch(() => {});
});

// ------------------------------------------------------------------ Start
function incomingFromArgv(argv) {
  const f = argv.slice(1).find((a) => /\.json$/i.test(a) && fs.existsSync(a));
  if (!f) return '';
  try { return fs.readFileSync(f, 'utf8'); } catch (e) { return ''; }
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', (e, argv) => {
    showWindow();
    const t = incomingFromArgv(argv);
    if (t) call('onIncoming', t);
  });

  app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    pendingIncoming = incomingFromArgv(process.argv);
    protocol.handle('app', (req) => {
      const u = new URL(req.url);
      const rel = decodeURIComponent(u.pathname).replace(/^\/+/, '').replace(/^www\//, '');
      const file = path.normalize(path.join(WWW, rel || 'index.html'));
      if (!file.startsWith(WWW)) return new Response('Verboten', { status: 403 });
      return net.fetch(pathToFileURL(file).toString());
    });
    // Kamera (QR-Code) und Mikrofon (Lautstärke-Ampel) erlauben
    session.defaultSession.setPermissionRequestHandler((wc, permission, cb) => cb(['media', 'notifications', 'clipboard-sanitized-write', 'fullscreen'].includes(permission)));
    createWindow();
    createTray();
  });

  app.on('before-quit', () => { quitting = true; });
  app.on('window-all-closed', () => { if (!tray) app.quit(); });
}
