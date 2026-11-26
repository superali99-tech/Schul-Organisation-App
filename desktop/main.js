/* Schulplan – Desktop (Windows, Mac, Linux) – Hauptprozess */
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
const IS_MAC = process.platform === 'darwin';
const IS_LINUX = process.platform === 'linux';
const APPIMAGE = IS_LINUX ? process.env.APPIMAGE || '' : '';

let win = null;
let tray = null;
let quitting = false;
let blocker = null;
let reminderTimers = [];
let pendingIncoming = '';
let widget = null;

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
    if (!quitting && IS_MAC) { e.preventDefault(); win.hide(); return; }
    if (!quitting && tray) {
      e.preventDefault();
      win.hide();
      if (!conf().trayHintShown) {
        setConf({ trayHintShown: true });
        new Notification({ title: 'Schulplan läuft weiter', body: IS_LINUX
          ? 'Schulplan läuft im Hintergrund weiter, damit Erinnerungen ankommen. Zurück über das Symbol in der oberen Leiste oder durch erneutes Öffnen. Strg+Q beendet die App ganz.'
          : 'Schulplan ist unten rechts im Infobereich, damit Erinnerungen ankommen. Rechtsklick → „Beenden" schließt die App ganz.' }).show();
      }
    }
  });
  win.on('closed', () => { win = null; });

  // Externe Links (Telefon, E-Mail, Webseiten) im System öffnen
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('app://')) { e.preventDefault(); shell.openExternal(url); } });
}

// Linux: Menüleiste (mit Alt einblendbar) – vor allem für die Tastenkürzel
function linuxMenu() {
  const go = (r) => () => { showWindow(); call('navigate', r); };
  return Menu.buildFromTemplate([
    { label: '&Datei', submenu: [
      { label: 'Desktop-Widget anzeigen', type: 'checkbox', checked: !!conf().widget, accelerator: 'Ctrl+Shift+W', click: (item) => setWidget(item.checked) },
      { type: 'separator' },
      { label: 'Fenster schließen', accelerator: 'Ctrl+W', click: () => { if (win) win.close(); } },
      { label: 'Beenden', accelerator: 'Ctrl+Q', click: () => { quitting = true; app.quit(); } },
    ] },
    { label: '&Bearbeiten', submenu: [
      { role: 'undo', label: 'Rückgängig' }, { role: 'redo', label: 'Wiederholen' }, { type: 'separator' },
      { role: 'cut', label: 'Ausschneiden' }, { role: 'copy', label: 'Kopieren' }, { role: 'paste', label: 'Einfügen' }, { role: 'selectAll', label: 'Alles auswählen' },
    ] },
    { label: '&Ansicht', submenu: [
      { label: 'Heute', accelerator: 'Ctrl+1', click: go('/today') },
      { label: 'Stundenplan', accelerator: 'Ctrl+2', click: go('/timetable') },
      { label: 'Klassen', accelerator: 'Ctrl+3', click: go('/classes') },
      { label: 'Kalender', accelerator: 'Ctrl+4', click: go('/calendar') },
      { type: 'separator' },
      { role: 'zoomIn', label: 'Größer' }, { role: 'zoomOut', label: 'Kleiner' }, { role: 'resetZoom', label: 'Normale Größe' },
      { type: 'separator' }, { role: 'togglefullscreen', label: 'Vollbild' },
    ] },
  ]);
}

function macMenu() {
  return Menu.buildFromTemplate([
    { label: 'Schulplan', submenu: [
      { role: 'about', label: 'Über Schulplan' }, { type: 'separator' },
      { role: 'hide', label: 'Schulplan ausblenden' }, { role: 'hideOthers', label: 'Andere ausblenden' }, { type: 'separator' },
      { label: 'Schulplan beenden', accelerator: 'Cmd+Q', click: () => { quitting = true; app.quit(); } },
    ] },
    { label: 'Bearbeiten', submenu: [
      { role: 'undo', label: 'Widerrufen' }, { role: 'redo', label: 'Wiederholen' }, { type: 'separator' },
      { role: 'cut', label: 'Ausschneiden' }, { role: 'copy', label: 'Kopieren' }, { role: 'paste', label: 'Einfügen' }, { role: 'selectAll', label: 'Alles auswählen' },
    ] },
    { label: 'Ansicht', submenu: [
      { label: 'Heute', accelerator: 'Cmd+1', click: () => { showWindow(); call('navigate', '/today'); } },
      { label: 'Stundenplan', accelerator: 'Cmd+2', click: () => { showWindow(); call('navigate', '/timetable'); } },
      { label: 'Klassen', accelerator: 'Cmd+3', click: () => { showWindow(); call('navigate', '/classes'); } },
      { label: 'Kalender', accelerator: 'Cmd+4', click: () => { showWindow(); call('navigate', '/calendar'); } },
      { type: 'separator' }, { role: 'togglefullscreen', label: 'Vollbild' },
    ] },
    { label: 'Fenster', submenu: [{ role: 'minimize', label: 'Im Dock ablegen' }, { role: 'zoom', label: 'Zoomen' }, { label: 'Schulplan anzeigen', click: showWindow }, { type: 'separator' },
      { label: 'Desktop-Widget anzeigen', type: 'checkbox', checked: !!conf().widget, accelerator: 'Cmd+Shift+W', click: (item) => setWidget(item.checked) }] },
  ]);
}

// ------------------------------------------------------------------ Desktop-Widget
function createWidget() {
  if (widget && !widget.isDestroyed()) { widget.show(); return; }
  const c = conf();
  const b = c.widgetBounds || {};
  const { screen } = require('electron');
  const area = screen.getPrimaryDisplay().workArea;
  widget = new BrowserWindow({
    width: b.width || 320, height: b.height || 470,
    x: b.x != null ? b.x : area.x + area.width - 340, y: b.y != null ? b.y : area.y + 20,
    minWidth: 260, minHeight: 220, frame: false, transparent: true, resizable: true, skipTaskbar: true,
    alwaysOnTop: !!c.widgetPinned, minimizable: false, maximizable: false, fullscreenable: false, hasShadow: false,
    show: false, title: 'Schulplan Widget', backgroundColor: '#00000000',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: false },
  });
  if (IS_MAC) widget.setVisibleOnAllWorkspaces(true);
  widget.loadURL('app://schulplan/www/widget.html' + (c.widgetPinned ? '#pinned' : ''));
  widget.once('ready-to-show', () => widget.showInactive());
  const save = () => { if (widget && !widget.isDestroyed()) setConf({ widgetBounds: widget.getBounds() }); };
  widget.on('moved', save);
  widget.on('resized', save);
  widget.on('closed', () => { widget = null; });
}
function setWidget(on) {
  setConf({ widget: !!on });
  if (on) createWidget();
  else if (widget && !widget.isDestroyed()) widget.close();
  updateMenus();
}
function refreshWidget() {
  if (widget && !widget.isDestroyed()) widget.webContents.send('refresh');
}
function updateMenus() {
  if (tray) tray.setContextMenu(trayMenu());
  if (IS_MAC) Menu.setApplicationMenu(macMenu());
  if (IS_LINUX) Menu.setApplicationMenu(linuxMenu());
}

function trayMenu() {
  return Menu.buildFromTemplate([
    { label: 'Schulplan öffnen', click: showWindow },
    { label: 'Heute', click: () => { showWindow(); call('navigate', '/today'); } },
    { label: 'Stundenplan', click: () => { showWindow(); call('navigate', '/timetable'); } },
    { type: 'separator' },
    { label: 'Desktop-Widget anzeigen', type: 'checkbox', checked: !!conf().widget, click: (item) => setWidget(item.checked) },
    { type: 'separator' },
    { label: 'Beenden', click: () => { quitting = true; app.quit(); } },
  ]);
}

function createTray() {
  try {
    tray = new Tray(path.join(__dirname, 'build', 'icon.png'));
    tray.setToolTip('Schulplan');
    tray.setContextMenu(trayMenu());
    tray.on('click', showWindow);
    tray.on('double-click', showWindow);
  } catch (e) { tray = null; }
}

// ------------------------------------------------------------------ Updates
// Läuft komplett im Hintergrund: Fenster schließen oder Schulplan beenden bricht ein laufendes
// Update nicht ab – es wird fertig installiert und Schulplan startet danach neu.
let updateBusy = false;        // Download oder Installation läuft
let quitAfterUpdate = false;   // jemand wollte beenden, während das Update lief
let exitingForUpdate = false;  // Schulplan beendet sich gerade für die Installation
let updatePhase = '';          // 'downloading' oder 'installing'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function exitForUpdate(relaunch) {
  exitingForUpdate = true;
  quitting = true;
  if (relaunch) relaunch();
  app.quit();
  // Falls sich etwas querstellt: nach kurzer Zeit hart beenden, damit der Installer weitermachen kann
  setTimeout(() => app.exit(0), 3000);
}

function saveToDownloads(buf, name, mode) {
  const f = path.join(app.getPath('downloads'), name);
  fs.writeFileSync(f, buf, mode ? { mode } : undefined);
  return f;
}

// Startet ein Programm und meldet zuverlässig, ob es wirklich gestartet ist
function spawnChecked(file, args) {
  return new Promise((resolve) => {
    let child;
    try { child = spawn(file, args, { detached: true, stdio: 'ignore' }); } catch (e) { resolve(e); return; }
    child.once('error', (e) => resolve(e));
    child.once('spawn', () => { child.unref(); resolve(null); });
  });
}

// Windows: stiller Installer (/S), der Schulplan danach selbst wieder startet (--force-run)
async function windowsUpdate(url) {
  const buf = await httpGet(url, (pct) => call('onUpdateProgress', pct));
  // Lokaler (nicht servergespeicherter) Ordner, wie bei anderen Desktop-Apps üblich
  const dir = path.join(process.env.LOCALAPPDATA || os.tmpdir(), 'schulplan-updater');
  fs.mkdirSync(dir, { recursive: true });
  for (const n of fs.readdirSync(dir)) { try { fs.unlinkSync(path.join(dir, n)); } catch (e) { /* noch in Benutzung */ } }
  const file = path.join(dir, `Schulplan-Setup-${Date.now()}.exe`);
  fs.writeFileSync(file, buf);
  updatePhase = 'installing';
  call('onUpdateState', 'installing', '');
  // Virenscanner prüfen eine frisch geladene Datei oft einige Sekunden lang – deshalb mehrere Versuche
  let err = null;
  for (let i = 0; i < 12; i++) {
    await sleep(i === 0 ? 1000 : 1500);
    err = await spawnChecked(file, ['/S', '--force-run']);
    if (!err) { exitForUpdate(); return; }
  }
  // Rückfall: über die Windows-Shell öffnen – der Installer zeigt dann ein Fenster und startet Schulplan danach
  const shellErr = await shell.openPath(file);
  if (!shellErr) { exitForUpdate(); return; }
  let hint = '';
  try { const f = saveToDownloads(buf, 'Schulplan-Setup.exe'); shell.showItemInFolder(f); hint = ' Der Installer liegt jetzt in deinem Download-Ordner: „Schulplan-Setup.exe“ doppelklicken – deine Daten bleiben erhalten.'; } catch (e) { /* egal */ }
  throw new Error(`Das Update konnte nicht automatisch gestartet werden (${(err && (err.code || err.message)) || shellErr}).${hint}`);
}

// Mac: neue Version in den Download-Ordner laden und im Finder zeigen
async function macUpdate(url) {
  const buf = await httpGet(url, (pct) => call('onUpdateProgress', pct));
  const file = saveToDownloads(buf, path.basename(new URL(url).pathname));
  shell.showItemInFolder(file);
  call('onUpdateState', 'mac-ready', '');
}

// Linux – AppImage: die Datei direkt ersetzen (ohne Passwort) und neu starten.
// .deb: Paket mit pkexec installieren (das System fragt nach dem Passwort) und neu starten.
async function linuxUpdate(url) {
  const buf = await httpGet(url, (pct) => call('onUpdateProgress', pct));
  if (APPIMAGE) {
    try {
      const tmp = APPIMAGE + '.update';
      fs.writeFileSync(tmp, buf, { mode: 0o755 });
      fs.chmodSync(tmp, 0o755);
      fs.renameSync(tmp, APPIMAGE);
    } catch (e) {
      const f = saveToDownloads(buf, 'Schulplan-Linux.AppImage', 0o755);
      shell.showItemInFolder(f);
      throw new Error('Die AppImage-Datei konnte nicht ersetzt werden. Die neue Version liegt im Download-Ordner – einfach von dort starten.');
    }
    updatePhase = 'installing';
  call('onUpdateState', 'installing', '');
    await sleep(1200);
    exitForUpdate(() => app.relaunch({ execPath: APPIMAGE, args: [] }));
    return;
  }
  const file = path.join(os.tmpdir(), `schulplan-update-${Date.now()}.deb`);
  fs.writeFileSync(file, buf);
  updatePhase = 'installing';
  call('onUpdateState', 'installing', '');
  toast('Bitte gib im nächsten Fenster dein Passwort ein, um das Update zu installieren.');
  const ok = await new Promise((resolve) => {
    let p;
    try { p = spawn('pkexec', ['sh', '-c', 'apt-get install -y "$1" || dpkg -i "$1"', 'sh', file], { stdio: 'ignore' }); } catch (e) { resolve(false); return; }
    p.once('error', () => resolve(false));
    p.once('exit', (code) => resolve(code === 0));
  });
  fs.unlink(file, () => {});
  if (ok) { exitForUpdate(() => app.relaunch()); return; }
  const f = saveToDownloads(buf, 'Schulplan-Linux.deb');
  shell.openPath(f);
  throw new Error('Installation nicht abgeschlossen. Die neue Version liegt im Download-Ordner (Schulplan-Linux.deb) – Doppelklick zum Installieren.');
}

async function runUpdate(url) {
  if (updateBusy) {
    // Läuft schon: Anzeige nur wieder auf den aktuellen Stand bringen
    if (updatePhase === 'installing') call('onUpdateState', 'installing', '');
    return;
  }
  updateBusy = true;
  updatePhase = 'downloading';
  quitAfterUpdate = false;
  try {
    if (IS_LINUX) await linuxUpdate(url);
    else if (IS_MAC) await macUpdate(url);
    else await windowsUpdate(url);
  } catch (e) {
    call('onUpdateState', 'error', (e && e.message) || 'Fehler beim Update');
  }
  if (exitingForUpdate) return;
  updateBusy = false;
  updatePhase = '';
  // Wurde während des Updates „Beenden“ gewählt, jetzt wirklich beenden
  if (quitAfterUpdate) { quitting = true; app.exit(0); }
}

// Unerwartete Fehler dürfen ein laufendes Update nie in „Wird installiert …“ hängen lassen
function onUnexpected(e) {
  console.error(e);
  if (updateBusy && !exitingForUpdate) {
    updateBusy = false;
    call('onUpdateState', 'error', 'Update fehlgeschlagen: ' + ((e && e.message) || e));
    if (quitAfterUpdate) { quitting = true; app.exit(0); }
  }
}
process.on('uncaughtException', onUnexpected);
process.on('unhandledRejection', onUnexpected);

// ------------------------------------------------------------------ Brücke (gleiche Funktionen wie in der Android-App)
const sync = {
  loadData: () => { try { return fs.readFileSync(FILE(), 'utf8'); } catch (e) { return ''; } },
  saveData: (json) => { try { writeAtomic(FILE(), json); dailyBackup(json); setTimeout(refreshWidget, 50); return true; } catch (e) { return false; } },
  widgetEnabled: () => !!conf().widget,
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
  async shareFile(filename, mime, content, text) {
    if (text) { clipboard.writeText(text); toast('Nachricht kopiert – füge sie in E-Mail oder Messenger ein und hänge die gespeicherte Datei an.'); }
    return async_.saveFile(filename, mime, content, false);
  },
  shareText(title, text) { clipboard.writeText(text); toast('In die Zwischenablage kopiert – jetzt z. B. in E-Mail oder Messenger einfügen (Strg+V)'); },
  shareApk() { clipboard.writeText('https://github.com/superali99-tech/Schul-Organisation-App#readme'); toast('Download-Link für Schulplan (Windows, Mac, Linux, Android) kopiert'); },
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
  updateWidgets() { refreshWidget(); },
  toggleWidget(on) { setWidget(on); },
  widgetClose() { setWidget(false); call('onWidgetState', false); },
  widgetPin(on) { setConf({ widgetPinned: !!on }); if (widget && !widget.isDestroyed()) widget.setAlwaysOnTop(!!on, 'floating'); },
  openRoute(route) { showWindow(); call('navigate', route); },
  setUpdateUrls() {},
  async checkUpdate(reqId, urlsJson) {
    let urls = [];
    try { urls = JSON.parse(urlsJson); } catch (e) { /* leer */ }
    let lastErr = 'Keine Update-Adresse';
    for (const u of urls) {
      try {
        const buf = await httpGet(u + (u.includes('?') ? '&' : '?') + 't=' + Date.now());
        const j = JSON.parse(buf.toString('utf8'));
        const d = IS_MAC ? (j.mac && { ...j.mac, url: j.mac[process.arch === 'arm64' ? 'arm64' : 'x64'] })
          : IS_LINUX ? (j.linux && { ...j.linux, url: APPIMAGE ? j.linux.appimage : j.linux.deb })
          : j.desktop;
        if (!d || !d.version || !d.url) { call('onUpdateInfo', reqId, true, JSON.stringify({ versionCode: 0 })); return; }
        call('onUpdateInfo', reqId, true, JSON.stringify({ versionCode: versionCode(d.version), versionName: d.version, apk: d.url, notes: d.notes || j.notes || [], date: d.date || j.date }));
        return;
      } catch (e) { lastErr = e.message; }
    }
    call('onUpdateInfo', reqId, false, lastErr);
  },
  startUpdate(url) { runUpdate(url); },
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
    Menu.setApplicationMenu(IS_MAC ? macMenu() : IS_LINUX ? linuxMenu() : null);
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
    if (!IS_MAC) createTray();
    if (conf().widget) createWidget();
  });
  app.on('activate', showWindow); // Mac: Klick aufs Dock-Symbol

  app.on('before-quit', (e) => {
    if (updateBusy && !exitingForUpdate) {
      // Update läuft noch: nicht abbrechen, sondern im Hintergrund fertig machen und danach neu starten
      e.preventDefault();
      quitting = false;
      quitAfterUpdate = true;
      [win, widget].forEach((w) => { if (w && !w.isDestroyed()) w.hide(); });
      try { new Notification({ title: 'Schulplan wird aktualisiert', body: 'Das Update wird im Hintergrund fertig installiert. Danach startet Schulplan neu.' }).show(); } catch (err) { /* egal */ }
      return;
    }
    quitting = true;
  });
  app.on('window-all-closed', () => { if (!tray && !IS_MAC) app.quit(); });
}
