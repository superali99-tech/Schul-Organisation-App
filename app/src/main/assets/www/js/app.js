/* Schulplan – Start, Lebenszyklus, Erinnerungen */
'use strict';

// ------------------------------------------------------------------ Erinnerungen
function buildReminders() {
  const r = S.settings.remind;
  if (!r.on) return [];
  const out = [];
  const nowMs = Date.now();
  const horizon = nowMs + 45 * 86400000;
  const add = (id, time, title, text, route) => { if (time > nowMs && time < horizon) out.push({ code: hashInt(id), time, title, text, route }); };

  // Prüfungen
  S.assessments.forEach((a) => {
    const k = cat(a.catId);
    if (!a.date || !k || !k.exam) return;
    const t = dateTimeMs(addDays(a.date, -(r.examDays || 0)), r.time || '18:00');
    const when = r.examDays === 0 ? 'heute' : r.examDays === 1 ? 'morgen' : `am ${fmtDW(a.date)}`;
    add('ex' + a.id, t, `${k.name.split(' ')[0]}: ${a.title}`, `${cName(a.classId)} – ${when}`, '/assessment/' + a.id);
  });
  // Termine
  if (r.events) S.events.forEach((e) => {
    if (e.remind === '' || e.remind == null || e.type === 'ferien') return;
    const start = dateTimeMs(e.date, e.time || '07:30');
    const m = Number(e.remind);
    add('ev' + e.id, start - m * 60000, e.title, `${(EVENT_TYPES[e.type] || EVENT_TYPES.termin).l}${e.time ? ' um ' + e.time + ' Uhr' : ''}${e.place ? ' · ' + e.place : ''}`, '/calendar');
  });
  // Aufgaben
  if (r.tasks) S.tasks.forEach((t) => {
    if (t.done || !t.remind || !t.due) return;
    add('tk' + t.id, dateTimeMs(t.due, t.time || r.time || '18:00'), 'Aufgabe fällig', t.title, '/tasks');
  });
  // Wiedervorlagen
  if (r.followUps) S.talks.forEach((t) => {
    if (!t.followUp || t.followUpDone) return;
    add('fu' + t.id, dateTimeMs(t.followUp, '07:30'), 'Wiedervorlage Elterngespräch', `${sName(stu(t.studentId))}: ${t.topic || ''}`, '/talks');
  });
  // Unterrichtsstunden (nächste 7 Tage)
  if (r.lessons) {
    for (let i = 0; i < 7; i++) {
      const d = addDays(today(), i);
      lessonsOn(d).forEach((l) => {
        if (l.cancelled || l.holiday) return;
        const p = periodTime(l.period);
        if (!p) return;
        const entry = l.classId ? lessonEntry(l.classId, d, l.period) : null;
        const room = l.roomChange || l.room || (cls(l.classId) || {}).room || '';
        add(`ls${d}-${l.period}`, dateTimeMs(d, p.s) - (r.lessonMin || 5) * 60000, `${l.period + 1}. Stunde: ${lessonLabel(l)}`, [room ? 'Raum ' + room : '', `${p.s}–${p.e}`, entry && entry.topic ? entry.topic : ''].filter(Boolean).join(' · '), `/lesson/${d}/${l.period}`);
      });
    }
  }
  return out.sort((a, b) => a.time - b.time).slice(0, 120);
}
let lastReminderJSON = null;
const syncReminders = debounce(() => {
  if (!Native.has) return;
  const json = JSON.stringify(buildReminders());
  if (json === lastReminderJSON) return; // nur bei Änderungen neu planen
  lastReminderJSON = json;
  Native.call('syncReminders', json);
}, 1500);
Store.onSave(syncReminders);

// ------------------------------------------------------------------ Native Rückrufe
App.onPause = () => {
  Store.save.flush();
  Lock.hiddenAt = Date.now();
};
App.onResume = () => {
  Lock.maybeLock();
  if (App.onTeamResume) App.onTeamResume();
  if (App.path === '/today' && !UI.stack.length) App.refresh();
};
App.onSystemTheme = () => applyTheme();
App.onFileSaved = (ok) => UI.toast(ok ? 'Datei gespeichert ✓' : 'Nicht gespeichert', { type: ok ? '' : 'err' });
App.onPrintDone = () => Print.done();
App.onNotifPermission = (granted) => {
  if (!granted) UI.toast('Benachrichtigungen wurden nicht erlaubt. Du kannst sie in den Android-Einstellungen aktivieren.', { ms: 6000 });
  lastReminderJSON = null;
  syncReminders();
};

document.addEventListener('visibilitychange', () => {
  if (Native.has) return; // Android meldet sich über onPause/onResume
  if (document.hidden) App.onPause(); else App.onResume();
});
window.addEventListener('beforeunload', () => Store.save.flush());
if (window.matchMedia) {
  try { window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => applyTheme()); } catch (e) { /* alt */ }
}

// ------------------------------------------------------------------ Start
(function boot() {
  Store.load();
  applyTheme();
  if (S.settings.secure) Native.call('setSecure', true);
  // Navigationssymbole
  const navIcons = { 'nav-today': 'house', 'nav-tt': 'calendar-days', 'nav-cl': 'users', 'nav-cal': 'calendar', 'nav-more': 'layout-grid' };
  Object.entries(navIcons).forEach(([id, ic]) => { $('#' + id).innerHTML = icon(ic); });
  // Startseite bestimmen
  let start = S.settings.startTab || '/today';
  const launch = Native.has ? Native.call('getLaunchRoute') : '';
  const hash = decodeURIComponent((location.hash || '').slice(1));
  if (launch) { App.stack = [start, launch]; }
  else if (!Native.has && hash && hash !== '/' && App.match(hash)) { App.stack = hash === start ? [start] : [start, hash]; }
  else App.stack = [start];
  $('#view').addEventListener('scroll', () => $('#topbar').classList.toggle('scrolled', $('#view').scrollTop > 4), { passive: true });
  App.render();
  Lock.maybeLock(true);
  const incoming = Native.has ? Native.call('getIncoming') : '';
  if (incoming) setTimeout(() => App.onIncoming(incoming), 400);
  else if (!S.settings.onboarded) setTimeout(showOnboarding, 300);
  setTimeout(() => { if (App.onTeamResume) App.onTeamResume(); }, 2500);
  // Minütlich die Startseite aktualisieren (aktuelle Stunde)
  setInterval(() => { if ((App.path === '/today' || App.path.startsWith('/timetable')) && !UI.stack.length && !document.hidden && !document.activeElement.matches('input,textarea,select')) App.refresh(); }, 60000);
  syncReminders();
}());
