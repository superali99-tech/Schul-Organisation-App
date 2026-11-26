/* App-Updates: Prüfen, Herunterladen, Installieren, Neuerungen anzeigen */
'use strict';

const UPDATE_URLS = ['https://raw.githubusercontent.com/superali99-tech/Schul-Organisation-App/HEAD/release/version.json'];

/** Neuerungen je Version (neueste zuerst) */
const CHANGELOG = [
  { v: '1.3.2', items: [
    'Schulplan gibt es jetzt auch für den Mac (Apple Silicon und Intel)',
    'Die Suche nach Updates bricht nach spätestens 15 Sekunden ab, statt endlos zu laufen',
  ] },
  { v: '1.3.1', items: [
    'Schulplan gibt es jetzt auch für Windows (Desktop-Version mit Installer)',
    'Zurück-Taste funktioniert wieder richtig (geht zur vorherigen Seite statt die App zu schließen)',
    'Update-Prüfung, Cloud-Abgleich im Kollegium und Speichern-Meldungen repariert',
    'Neue Ansicht für große Bildschirme und Tablets mit Seitenleiste',
  ] },
  { v: '1.3.0', items: [
    'Automatische Updates: Neue Versionen werden in der App angezeigt und mit einem Tipp installiert',
    'Benachrichtigungen für alles: Stundenbeginn und -ende, Termine (Beginn & Ende), Aufgaben, Hausaufgaben, Prüfungen, Geburtstage, Ferien',
    'Morgen-Übersicht: Jeden Schultag eine kurze Zusammenfassung deines Tages',
    'Kein schwarzer Bildschirm mehr beim Start – stattdessen erscheint das Schulplan-Logo',
  ] },
  { v: '1.2.0', items: ['4 Widgets für den Startbildschirm: Stundenplan heute, Nächste Stunde, Aufgaben, Termine & Prüfungen', 'Kein weißes Aufblitzen mehr beim Öffnen'] },
  { v: '1.1.1', items: ['Neuer Name: Schulplan', 'Astrid Lindgren Schule voreingestellt'] },
  { v: '1.1.0', items: ['Kollegium: Kolleg:innen einladen, Schwarzes Brett, Vertretungsplan, geteilte Klassenlisten', 'Komplett neues, modernes Design'] },
];

function cmpVersion(a, b) {
  const pa = String(a).split('.').map(Number), pb = String(b).split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] || 0, y = pb[i] || 0;
    if (x !== y) return x < y ? -1 : 1;
  }
  return 0;
}

const Update = {
  info: null,
  state: 'idle', // idle | checking | downloading | installing | permission | error
  pct: 0,
  error: '',
  lastCheck: 0,
  waits: {},
  urls() {
    const u = (S.settings.updateUrl || '').trim();
    return u ? [u, ...UPDATE_URLS] : UPDATE_URLS;
  },
  current() { return Native.has ? Number(Native.call('versionCode')) || 0 : 0; },
  versionName() { return Native.has ? Native.call('appVersion') : 'Web'; },
  check(silent = true) {
    if (!Native.has) { if (!silent) UI.toast('Die Web-App aktualisiert sich beim Öffnen automatisch – du hast immer die neueste Version.'); return Promise.resolve(null); }
    Native.call('setUpdateUrls', JSON.stringify(Update.urls()));
    Update.lastCheck = Date.now();
    if (!silent) { Update.state = 'checking'; Update.redraw(); }
    return new Promise((res) => {
      const id = uid();
      Update.waits[id] = (ok, txt) => {
        if (Update.state === 'checking') Update.state = 'idle';
        if (!ok) {
          if (!silent) { UI.toast('Update-Prüfung nicht möglich: ' + txt, { type: 'err', ms: 5000 }); Update.redraw(); }
          res(null); return;
        }
        let info = null;
        try { info = JSON.parse(txt); } catch (e) { info = null; }
        if (info && Number(info.versionCode) > Update.current()) {
          const isNew = !Update.info || Update.info.versionCode !== info.versionCode;
          Update.info = info;
          if (!silent) Update.sheet();
          else if (isNew && !UI.stack.length && App.path === '/today') App.refresh();
        } else {
          Update.info = null;
          if (!silent) UI.toast(`Du hast die neueste Version (${Update.versionName()}) ✓`);
        }
        Update.redraw();
        res(Update.info);
      };
      Native.call('checkUpdate', id, JSON.stringify(Update.urls()));
      // Nie endlos suchen: nach 15 Sekunden abbrechen
      setTimeout(() => { const f = Update.waits[id]; if (f) { delete Update.waits[id]; f(false, 'keine Antwort vom Server (Internet prüfen)'); } }, 15000);
    });
  },
  start() {
    if (!Update.info) return;
    Update.state = 'downloading'; Update.pct = 0; Update.error = '';
    Update.redraw();
    Native.call('startUpdate', Update.info.apk);
  },
  redraw() {
    const box = $('#upd-box');
    if (box) box.innerHTML = Update.boxHTML();
    if (App.path === '/update' && !UI.stack.length) App.refresh();
  },
  notesHTML(info) {
    const notes = (info && info.notes) || [];
    return notes.length ? `<ul class="upd-notes">${notes.map((n) => `<li>${icon('sparkles')}<span>${esc(n)}</span></li>`).join('')}</ul>` : '';
  },
  boxHTML() {
    const i = Update.info;
    if (Update.state === 'downloading') {
      return `<div class="upd-progress"><div class="progress" style="height:10px"><i style="width:${Update.pct}%"></i></div><p class="center muted small">Wird heruntergeladen … ${Update.pct} %</p></div>`;
    }
    if (Update.state === 'mac-ready') {
      return `<div class="banner ok">${icon('download')}<div><b>Heruntergeladen!</b><br>Die neue Version liegt in deinem Download-Ordner. Doppelklick zum Entpacken, dann „Schulplan" in den Ordner <b>Programme</b> ziehen und ersetzen. Deine Daten bleiben erhalten.</div></div>`;
    }
    if (Update.state === 'installing' && window.SCHULPLAN_DESKTOP) {
      return `<div class="banner ok">${icon('refresh-cw')}<div><b>Wird installiert …</b><br>Schulplan schließt sich kurz und startet dann in der neuen Version. Deine Daten bleiben erhalten.</div></div>`;
    }
    if (Update.state === 'installing') {
      return `<div class="banner ok">${icon('download')}<div><b>Fast geschafft!</b><br>Bestätige im nächsten Fenster mit <b>„Aktualisieren"</b>. Deine Daten bleiben erhalten.</div></div>
        <button class="btn btn-block" data-act="upd-install">${icon('refresh-cw')}Installation erneut öffnen</button>`;
    }
    if (Update.state === 'permission') {
      return `<div class="banner warn">${icon('shield')}<div><b>Einmalig erlauben:</b> Aktiviere „Apps aus dieser Quelle zulassen" für Schulplan und komm dann zurück.</div></div>
        <button class="btn btn-primary btn-block btn-lg" data-act="upd-install">${icon('download')}Jetzt installieren</button>`;
    }
    if (Update.state === 'error') {
      return `<div class="banner err">${icon('triangle-alert')}<div>${esc(Update.error || 'Fehler beim Update')}</div></div>
        <button class="btn btn-primary btn-block" data-act="upd-start">${icon('refresh-cw')}Erneut versuchen</button>`;
    }
    if (!i) return '';
    return `<button class="btn btn-primary btn-block btn-lg" data-act="upd-start">${icon('download')}Jetzt aktualisieren</button>`;
  },
  sheet() {
    const i = Update.info;
    if (!i) return;
    UI.open({
      title: `Neue Version ${i.versionName || ''}`,
      body: `<div class="upd-hero">${icon('sparkles')}<div><b>Schulplan ${esc(i.versionName || '')} ist da!</b><br><span class="muted small">Du hast ${esc(Update.versionName())}${i.date ? ` · veröffentlicht am ${fmtD(i.date)}` : ''}</span></div></div>
        <div class="f-section">${icon('star')}Das ist neu</div>${Update.notesHTML(i)}
        <div id="upd-box" class="mt">${Update.boxHTML()}</div>
        <p class="muted small center">Deine Daten bleiben beim Aktualisieren erhalten.</p>`,
    });
  },
};
App.onUpdateInfo = (id, ok, txt) => { const f = Update.waits[id]; if (f) { delete Update.waits[id]; f(ok, txt); } };
App.onUpdateProgress = (pct) => { Update.pct = pct; const bar = $('#upd-box .progress i'); if (bar) { bar.style.width = pct + '%'; const t = $('#upd-box p'); if (t) t.textContent = `Wird heruntergeladen … ${pct} %`; } };
App.onUpdateState = (state, msg) => { Update.state = state; Update.error = msg; Update.redraw(); };
A['upd-start'] = () => Update.start();
A['upd-install'] = () => { if (!Native.call('installDownloaded')) Update.start(); };
A['upd-check'] = () => Update.check(false);
A['upd-open'] = () => Update.sheet();
A['upd-source'] = async () => {
  const u = await UI.prompt('Update-Quelle (Fortgeschritten)', { value: S.settings.updateUrl || '', ph: UPDATE_URLS[0], label: 'Adresse einer version.json (https). Leer lassen = Standard.' });
  if (u === null) return;
  S.settings.updateUrl = u.trim(); save(); App.refresh();
};

App.def('/update', () => {
  const i = Update.info;
  setTimeout(() => { if (Update.state === 'idle' && Date.now() - Update.lastCheck > 30000) Update.check(true); }, 50);
  let h = `<div class="upd-hero big">${icon('refresh-cw')}<div><b>Schulplan ${esc(Update.versionName())}</b><br><span class="muted small">${i ? `Neue Version ${esc(i.versionName)} verfügbar` : Update.state === 'checking' ? 'Suche nach Updates …' : 'Du bist auf dem neuesten Stand'}</span></div></div>`;
  if (i) h += `<div class="card"><div class="card-h"><h3>${icon('sparkles')}Neu in ${esc(i.versionName)}</h3></div>${Update.notesHTML(i)}<div id="upd-box">${Update.boxHTML()}</div></div>`;
  else h += `<button class="btn btn-primary btn-block btn-lg" data-act="upd-check" ${Update.state === 'checking' ? 'disabled' : ''}>${icon('refresh-cw')}Nach Updates suchen</button>`;
  h += `<div class="section-title">${icon('history')}Bisherige Neuerungen</div>`;
  h += CHANGELOG.map((c) => `<div class="card"><div class="card-h"><h3>Version ${c.v}</h3>${c.v === Update.versionName() ? '<span class="badge acc">installiert</span>' : ''}</div><ul class="upd-notes">${c.items.map((n) => `<li>${icon('check')}<span>${esc(n)}</span></li>`).join('')}</ul></div>`).join('');
  h += `<p class="muted small center">Die App prüft automatisch auf neue Versionen und benachrichtigt dich. <a data-act="upd-source">Update-Quelle</a></p>`;
  return { title: 'App-Updates', tab: 'more', html: h };
});

/** Nach einem Update einmalig zeigen, was neu ist */
function showWhatsNew() {
  if (!Native.has) return;
  const v = Update.versionName();
  const seen = S.settings.seenVersion;
  if (seen === v) return;
  S.settings.seenVersion = v;
  save();
  if (!S.settings.onboarded) return;
  // Ohne gespeicherte Version (erstes Update mit dieser Funktion) nur die aktuelle Version zeigen
  const items = seen ? CHANGELOG.filter((c) => cmpVersion(c.v, v) <= 0 && cmpVersion(c.v, seen) > 0) : CHANGELOG.filter((c) => c.v === v);
  if (!items.length) return;
  UI.open({
    title: `Neu in Schulplan ${v} 🎉`,
    body: `${items.map((c) => `<div class="f-section">${icon('sparkles')}Version ${c.v}</div><ul class="upd-notes">${c.items.map((n) => `<li>${icon('check')}<span>${esc(n)}</span></li>`).join('')}</ul>`).join('')}`,
    foot: '<span class="sp"></span><button class="btn btn-primary" data-x="ok">Super!</button>',
    onMount: (el, m) => el.querySelector('[data-x="ok"]').addEventListener('click', () => m.close()),
    onClose: () => { if (App.path === '/today') App.refresh(); },
  });
}
