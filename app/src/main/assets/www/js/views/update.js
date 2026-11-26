/* App-Updates: Prüfen, Herunterladen, Installieren, Neuerungen anzeigen */
'use strict';

const UPDATE_URLS = ['https://raw.githubusercontent.com/superali99-tech/Schul-Organisation-App/HEAD/release/version.json'];

/** Neuerungen je Version (neueste zuerst) */
const CHANGELOG = [
  { v: '1.8.0', items: [
    'Neu: Chat im Kollegium – Einzel- und Gruppenchats, Ende-zu-Ende verschlüsselt, mit Emojis, Reaktionen, Fotos und Sprachnachrichten',
    'Storys: Fotos und Grüße für das ganze Kollegium, die nach 24 Stunden verschwinden',
    'Anrufen und Videoanruf direkt aus dem Chat (Videoraum-Link, Dienst wählbar)',
    'Neu: Assistent – „Erinnere mich morgen um 7 an die Kopien", „Was steht morgen an?", Aufgaben, Termine, Hausaufgaben und Notizen anlegen, ändern und löschen',
    'Optionaler KI-Modus mit Claude (eigener API-Schlüssel): beantwortet freie Fragen und erledigt mehrere Aufträge auf einmal – fragt vor dem Löschen nach',
    'Benachrichtigung bei neuen Chat-Nachrichten',
  ] },
  { v: '1.7.0', items: [
    'Design 2.0: acht Farbthemen (Indigo, Ozean, Smaragd, Sonnenuntergang …), Hintergrund wählbar, Tagesring „geschafft" auf der Startseite',
    'Neu: Pausenaufsicht – die Schulleitung plant, du siehst deine Aufsichten auf der Startseite und wirst 5 Minuten vorher erinnert',
    'Neu: Räume buchen – Computerraum, Aula oder Sporthalle für eine Stunde reservieren, mit Wochenübersicht',
    'Neu: Umfragen im Kollegium – abstimmen, Ergebnisse live, auf Wunsch anonym',
    'Schulleitung: Aufsicht vertreten, wenn jemand fehlt, Statistik zu Vertretungen und Abwesenheiten (CSV-Export)',
    'Roter Punkt an „Mehr", wenn im Kollegium etwas auf dich wartet; schnellere Übergänge',
  ] },
  { v: '1.6.0', video: 'sub', items: [
    'Vertretung gezielt zuweisen: Nur die Vertretung bekommt die Meldung „Du vertrittst …" – oder auf Wunsch das ganze Kollegium',
    'Meldung mit einem Tipp versenden (WhatsApp, E-Mail …) – die Stunde landet direkt im Stundenplan der Kollegin oder des Kollegen',
    'Neue Vertretungen erscheinen beim Öffnen groß mit „Alles klar"-Bestätigung und auf der Startseite',
    'Kurzes Anleitungs-Video: Vertretungen → „So geht\'s"',
  ] },
  { v: '1.5.0', items: [
    'Neu: Schulleitermodus – Anmeldung mit eigenen Zugangsdaten (änderbar unter Einstellungen → Schulleitermodus)',
    'Schulleitungs-Cockpit: Abwesenheiten, offene Vertretungen, Lesebestätigungen und nächste Schultermine auf einen Blick',
    'Verbindliche Termine, Pflichttermine, Mitteilungen und Schulvorgaben der Schulleitung – digital unterschrieben, nur die Schulleitung kann sie ändern',
    'Jahresplanung für das ganze Schuljahr, Kollegium verwalten, Schulleitung übergeben',
    'Für Lehrkräfte: Abwesenheit melden – deine betroffenen Stunden gehen automatisch an die Vertretungsplanung',
    'Mitteilungen der Schulleitung auf der Startseite mit „Gelesen"-Bestätigung und Ferien-Countdown',
    'Frischeres Design: sanfte Farbverläufe, feinere Karten, dunkler Modus in Nachtblau',
  ] },
  { v: '1.4.3', items: [
    'Updates am Computer zuverlässiger: Schulplan startet die Installation mehrmals, statt bei „Wird installiert …“ hängen zu bleiben',
    'Ein Update läuft weiter, auch wenn du das Fenster schließt oder Schulplan beendest – danach startet Schulplan von selbst neu',
    'Schulplan gibt es jetzt auch für Linux (.deb und AppImage) – mit Desktop-Widget',
  ] },
  { v: '1.4.2', items: [
    'Windows, Mac und große Bildschirme: Alles steht jetzt sauber in der Mitte – Schnellzugriffe, Knöpfe, Hinweise und die Kopfzeile',
  ] },
  { v: '1.4.1', items: [
    'Einladung annehmen ist jetzt einfacher: Einladungs-Nachricht und PIN in einem Formular',
    'Knopf „Aus der Zwischenablage einfügen" für die kopierte Einladung',
    'Klare Hinweise, wenn nur die PIN eingegeben wurde oder die PIN nicht passt',
  ] },
  { v: '1.4.0', items: [
    'Desktop-Widget für Windows und Mac: nächste Stunde, heutige Stunden, Aufgaben und nächste Prüfung immer im Blick',
    'Web-App: Zahl am App-Symbol für fällige Aufgaben und Hausaufgaben',
    'Bessere Darstellung auf iPhone und iPad (Notch und Home-Leiste)',
    'Web-App als Alternative, wenn Windows die App blockiert (Smart App Control)',
  ] },
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
      return `<div class="banner ok">${icon('refresh-cw')}<div><b>Wird installiert …</b><br>Schulplan schließt sich kurz und startet dann in der neuen Version. Deine Daten bleiben erhalten. Du kannst das Fenster ruhig schließen – das Update läuft weiter.</div></div>
        <div class="late-hint"><p class="muted small center">Dauert es ungewöhnlich lange? Versuche es noch einmal – oder lade die neue Version von der Website und installiere sie einfach drüber.</p>
        <button class="btn btn-block" data-act="upd-start">${icon('refresh-cw')}Erneut versuchen</button></div>`;
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
  h += CHANGELOG.map((c) => `<div class="card"><div class="card-h"><h3>Version ${c.v}</h3>${c.v === Update.versionName() ? '<span class="badge acc">installiert</span>' : ''}</div><ul class="upd-notes">${c.items.map((n) => `<li>${icon('check')}<span>${esc(n)}</span></li>`).join('')}</ul>${c.video ? `<button class="btn btn-sm btn-soft mt" data-act="howto-${c.video}">${icon('play')}Video ansehen</button>` : ''}</div>`).join('');
  h += `<p class="muted small center">Die App prüft automatisch auf neue Versionen und benachrichtigt dich. <a data-act="upd-source">Update-Quelle</a></p>`;
  return { title: 'App-Updates', tab: 'more', html: h };
});

/** Nach einem Update einmalig zeigen, was neu ist */
// Kurze Anleitungs-Videos (über eine Blob-Adresse geladen: funktioniert in Android, Desktop und Browser gleich)
const HOWTO = {
  sub: { src: 'media/vertretung.mp4', webm: 'media/vertretung.webm', poster: 'media/vertretung.jpg', title: 'So geht\'s: Vertretung zuweisen', text: 'Vertretung eintragen → „Nur die Vertretung" → Meldung senden – fertig. Die Kollegin öffnet die Datei, die Stunde steht in ihrem Stundenplan.' },
};
let howtoUrls = [];
function howtoVideoHTML(key, cls = '') {
  const h = HOWTO[key];
  return h ? `<video class="howto-video ${cls}" data-howto="${key}" poster="${h.poster}" muted playsinline loop controls preload="auto"></video>` : '';
}
async function mountHowto(el) {
  for (const v of el.querySelectorAll('video[data-howto]')) {
    const h = HOWTO[v.dataset.howto];
    // MP4 (H.264) für Android, iPhone, Windows, Mac – WebM als Ersatz, wo H.264 fehlt (z. B. Chromium unter Linux)
    const useWebm = h.webm && !v.canPlayType('video/mp4; codecs="avc1.4d401f"') && v.canPlayType('video/webm; codecs="vp9"');
    const src = useWebm ? h.webm : h.src;
    try {
      const b = await (await fetch(src)).blob();
      const url = URL.createObjectURL(new Blob([b], { type: useWebm ? 'video/webm' : 'video/mp4' }));
      howtoUrls.push(url);
      v.src = url;
    } catch (e) { v.src = src; }
    v.play().catch(() => {});
  }
}
function releaseHowto() { howtoUrls.forEach((u) => URL.revokeObjectURL(u)); howtoUrls = []; }
function showHowto(key) {
  const h = HOWTO[key];
  UI.open({
    title: h.title,
    body: `${howtoVideoHTML(key)}<p class="muted small center" style="margin:0">${esc(h.text)}</p>`,
    onMount: (el) => mountHowto(el),
    onClose: () => releaseHowto(),
  });
}
A['howto-sub'] = () => showHowto('sub');

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
    body: `${items.map((c) => `${c.video ? howtoVideoHTML(c.video, 'sm') : ''}<div class="f-section">${icon('sparkles')}Version ${c.v}</div><ul class="upd-notes">${c.items.map((n) => `<li>${icon('check')}<span>${esc(n)}</span></li>`).join('')}</ul>`).join('')}`,
    foot: '<span class="sp"></span><button class="btn btn-primary" data-x="ok">Super!</button>',
    onMount: (el, m) => { mountHowto(el); el.querySelector('[data-x="ok"]').addEventListener('click', () => m.close()); },
    onClose: () => { releaseHowto(); if (App.path === '/today') App.refresh(); },
  });
}
