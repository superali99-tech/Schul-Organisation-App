/* Schulplan – Start, Lebenszyklus, Erinnerungen */
'use strict';

// ------------------------------------------------------------------ Erinnerungen
function buildReminders() {
  const r = S.settings.remind;
  if (!r.on) return [];
  const out = [];
  const nowMs = Date.now();
  const horizon = nowMs + 45 * 86400000;
  const td = today();
  const add = (id, time, title, text, route) => { if (time > nowMs && time < horizon) out.push({ code: hashInt(id), time, title, text, route }); };

  // Stunden & Morgen-Übersicht (14 Tage)
  for (let i = 0; i < 14; i++) {
    const d = addDays(td, i);
    const hol = holidayOn(d);
    const ls = lessonsOn(d).filter((l) => !l.holiday);
    const active = ls.filter((l) => !l.cancelled);
    if (r.briefing && !hol) {
      const parts = [];
      if (active.length) { const f = active[0]; const p = periodTime(f.period); parts.push(`${plural(active.length, 'Stunde', 'Stunden')}, erste um ${p ? p.s : '?'}: ${lessonLabel(f)}`); }
      const canc = ls.filter((l) => l.cancelled).length;
      if (canc) parts.push(`${canc} entfällt`);
      const due = S.tasks.filter((t) => !t.done && t.due === d).length;
      if (due) parts.push(plural(due, 'Aufgabe', 'Aufgaben') + ' fällig');
      const exams = S.assessments.filter((a) => a.date === d && (cat(a.catId) || {}).exam);
      if (exams.length) parts.push('Prüfung: ' + exams.map((a) => `${a.title} (${cName(a.classId)})`).join(', '));
      const evs = S.events.filter((e) => e.type !== 'ferien' && e.type !== 'feiertag' && e.date <= d && (e.end || e.date) >= d);
      if (evs.length) parts.push('Termin: ' + evs.map((e) => e.title + (e.time ? ' ' + e.time : '')).join(', '));
      if (parts.length) add('br' + d, dateTimeMs(d, r.briefingTime || '06:45'), `Guten Morgen! Dein ${WD[dow(d)]}`, parts.join(' · '), '/today');
    }
    ls.forEach((l) => {
      const p = periodTime(l.period);
      if (!p || l.cancelled) return;
      const room = lessonRoom(l);
      const entry = l.classId ? lessonEntry(l.classId, d, l.period) : null;
      const route = `/lesson/${d}/${l.period}`;
      if (r.lessons) {
        const m = Number(r.lessonMin) || 0;
        add(`ls${d}-${l.period}`, dateTimeMs(d, p.s) - m * 60000, `${m ? 'In ' + m + ' Min.' : 'Jetzt'}: ${l.period + 1}. Stunde · ${lessonLabel(l)}`,
          [room ? 'Raum ' + room : '', `${p.s}–${p.e} Uhr`, entry && entry.topic ? 'Thema: ' + entry.topic : ''].filter(Boolean).join(' · '), route);
      }
      if (r.lessonEnd) {
        const m = Number(r.lessonEndMin) || 0;
        add(`le${d}-${l.period}`, dateTimeMs(d, p.e) - m * 60000, `${m ? 'Noch ' + m + ' Min.' : 'Stundenende'}: ${lessonLabel(l)}`, 'Hausaufgabe aufgeben oder Klassenbuch eintragen?', route);
      }
    });
  }
  // Prüfungen
  S.assessments.forEach((a) => {
    const k = cat(a.catId);
    if (!a.date || !k || !k.exam) return;
    if (r.examDays > 0) add('ex' + a.id, dateTimeMs(addDays(a.date, -r.examDays), r.time || '18:00'), `${k.name.split(' ')[0]}: ${a.title}`, `${cName(a.classId)} – ${r.examDays === 1 ? 'morgen' : 'am ' + fmtDW(a.date)}`, '/assessment/' + a.id);
    if (r.examMorning) add('exm' + a.id, dateTimeMs(a.date, '07:00'), `Heute: ${a.title}`, `${cName(a.classId)}${a.subjectId ? ' · ' + subName(a.subjectId) : ''} – viel Erfolg!`, '/assessment/' + a.id);
  });
  // Termine (Erinnerung vorher, Beginn, Ende) und Ferien
  S.events.forEach((e) => {
    const t = EVENT_TYPES[e.type] || EVENT_TYPES.termin;
    if (e.type === 'ferien' || e.type === 'feiertag') {
      if (r.holidays) add('hol' + e.id, dateTimeMs(addDays(e.date, -1), '18:00'), e.type === 'ferien' ? `Morgen beginnen die ${e.title} 🎉` : `Morgen frei: ${e.title}`, e.end && e.end !== e.date ? `Bis ${fmtDW(e.end)} – erhol dich gut!` : 'Genieß den freien Tag!', '/calendar');
      return;
    }
    if (!r.events) return;
    const place = e.place ? ' · ' + e.place : '';
    if (e.mandatory && e.official && (e.remind === '' || e.remind == null)) add('evm' + e.id, dateTimeMs(addDays(e.date, -1), '17:00'), `Morgen Pflichttermin: ${e.title}`, `${t.l}${e.time ? ' um ' + e.time + ' Uhr' : ''}${place} – Termin der Schulleitung`, '/calendar');
    if (e.remind !== '' && e.remind != null) add('ev' + e.id, dateTimeMs(e.date, e.time || '07:30') - Number(e.remind) * 60000, `Erinnerung: ${e.title}`, `${t.l}${e.time ? ' um ' + e.time + ' Uhr' : ''}${place}`, '/calendar');
    if (r.eventStart) {
      if (e.time) add('evs' + e.id, dateTimeMs(e.date, e.time), `Jetzt: ${e.title}`, `${t.l}${e.endTime ? ' bis ' + e.endTime + ' Uhr' : ''}${place}`, '/calendar');
      else add('evs' + e.id, dateTimeMs(e.date, '07:00'), `Heute: ${e.title}`, `${t.l}${e.end && e.end !== e.date ? ' bis ' + fmtDW(e.end) : ''}${place}`, '/calendar');
    }
    if (r.eventEnd && e.endTime) add('eve' + e.id, dateTimeMs(e.end || e.date, e.endTime), `Endet jetzt: ${e.title}`, t.l + place, '/calendar');
  });
  // Pausenaufsichten (5 Minuten vorher)
  if (S.team && S.team.id && typeof myDutiesOn === 'function') {
    for (let i = 0; i < 8; i++) {
      const day = addDays(today(), i);
      myDutiesOn(day).forEach((x) => { if (x.start) add('duty' + x.id + day, dateTimeMs(day, x.start) - 5 * 60000, `Gleich Aufsicht: ${x.slot || 'Pause'}`, `${x.start}${x.end ? '–' + x.end : ''} Uhr${x.place ? ' · ' + x.place : ''}`, '/team/duties'); });
    }
  }
  // Aufgaben
  if (r.tasks) S.tasks.forEach((t) => {
    if (t.done || !t.due) return;
    add('tk' + t.id, dateTimeMs(t.due, t.time || r.taskTime || '07:30'), t.prio === 2 ? 'Dringende Aufgabe fällig' : 'Aufgabe fällig', t.title + (t.cat ? ' · ' + t.cat : ''), '/tasks');
  });
  // Hausaufgaben (Kontrolle)
  if (r.homework) S.homework.forEach((h) => {
    if (h.done || !h.due) return;
    add('hw' + h.id, dateTimeMs(h.due, '07:15'), `Heute fällig in ${cName(h.classId)}`, `Hausaufgabe: ${h.title} – Kontrolle nicht vergessen`, '/homework');
  });
  // Geburtstage
  if (r.birthdays) S.students.forEach((s) => {
    if (!s.birthday || !cls(s.classId) || cls(s.classId).archived) return;
    const n = nextBirthday(s.birthday, td);
    add('bd' + s.id + n, dateTimeMs(n, '07:05'), `🎂 ${sName(s)} hat heute Geburtstag`, `${cName(s.classId)} · wird ${age(s.birthday, n)}`, '/student/' + s.id);
  });
  // Wiedervorlagen
  if (r.followUps) S.talks.forEach((t) => {
    if (!t.followUp || t.followUpDone) return;
    add('fu' + t.id, dateTimeMs(t.followUp, '07:30'), 'Wiedervorlage Elterngespräch', `${sName(stu(t.studentId))}: ${t.topic || ''}`, '/talks');
  });
  return out.sort((a, b) => a.time - b.time).slice(0, 400);
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

// ------------------------------------------------------------------ Web-App: Zahl am App-Symbol
function updateAppBadge() {
  if (Native.has || !('setAppBadge' in navigator)) return;
  const td = today();
  const n = S.settings.appBadge === false ? 0
    : S.tasks.filter((t) => !t.done && t.due && t.due <= td).length + S.homework.filter((h) => !h.done && h.due === td).length;
  try { (n ? navigator.setAppBadge(n) : navigator.clearAppBadge()).catch(() => {}); } catch (e) { /* nicht unterstützt */ }
}
Store.onSave(debounce(updateAppBadge, 800));

// ------------------------------------------------------------------ Web-App: offline nutzbar und automatisch aktuell
if (!Native.has && 'serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  navigator.serviceWorker.register('sw.js').then((reg) => {
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      if (!w) return;
      w.addEventListener('statechange', () => {
        if (w.state === 'installed' && navigator.serviceWorker.controller) {
          UI.toast('Neue Version geladen – sie gilt ab dem nächsten Öffnen', { ms: 5000 });
        }
      });
    });
  }).catch(() => {});
}

// ------------------------------------------------------------------ Startbildschirm-Widgets
function buildWidgetData() {
  const td = today();
  const days = {};
  for (let i = 0; i < 8; i++) {
    const d = addDays(td, i);
    days[d] = lessonsOn(d).filter((l) => !l.holiday).map((l) => {
      const p = periodTime(l.period) || {};
      return { p: l.period, s: p.s || '', e: p.e || '', t: lessonLabel(l), r: lessonRoom(l), x: l.cancelled ? 1 : 0, c: subjectColor(l.subjectId, l.classId) };
    }).filter((l) => l.s);
  }
  const open = S.tasks.filter((t) => !t.done);
  const tasks = sortBy(open, (t) => t.due || '9999', (t) => -(t.prio || 0)).slice(0, 10).map((t) => ({ t: t.title, d: t.due || '', p: t.prio || 0, k: t.cat || '' }));
  const agenda = [];
  const end = addDays(td, 21);
  S.assessments.forEach((a) => {
    const k = cat(a.catId);
    if (a.date && a.date >= td && a.date <= end && k && k.exam) agenda.push({ d: a.date, t: a.title, s: `${cName(a.classId)} · ${k.name.split(' ')[0]}`, c: k.color || '#dc2626' });
  });
  S.events.forEach((e) => {
    if (e.type === 'ferien' || (e.end || e.date) < td || e.date > end) return;
    const t = EVENT_TYPES[e.type] || EVENT_TYPES.termin;
    agenda.push({ d: e.date < td ? td : e.date, t: e.title, s: [e.time ? e.time + ' Uhr' : t.l, e.place].filter(Boolean).join(' · '), c: t.c });
  });
  S.homework.forEach((h) => {
    if (!h.done && h.due && h.due >= td && h.due <= addDays(td, 7)) agenda.push({ d: h.due, t: 'HA: ' + h.title, s: cName(h.classId), c: '#0891b2' });
  });
  S.students.forEach((s) => {
    if (!s.birthday || !cls(s.classId) || cls(s.classId).archived) return;
    const n = nextBirthday(s.birthday, td);
    if (daysBetween(td, n) <= 7) agenda.push({ d: n, t: '🎂 ' + sName(s), s: `${cName(s.classId)} · wird ${age(s.birthday, n)}`, c: '#f59e0b' });
  });
  agenda.sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : 0));
  return { v: 1, day: td, school: S.settings.school, days, tasks, taskCount: open.length, agenda: agenda.slice(0, 12) };
}
let lastWidgetJSON = null;
const syncWidgets = debounce(() => {
  if (!Native.has) return;
  const json = JSON.stringify(buildWidgetData());
  if (json === lastWidgetJSON) return;
  lastWidgetJSON = json;
  Native.call('updateWidgets', json);
}, 1200);
Store.onSave(syncWidgets);

function askNotificationsOnce() {
  if (!Native.has || !S.settings.remind.on || !S.settings.onboarded) return;
  if (Native.call('notificationsAllowed')) return;
  let asked = null;
  try { asked = localStorage.getItem('sp-notif-asked'); } catch (e) { /* egal */ }
  if (asked) return;
  try { localStorage.setItem('sp-notif-asked', '1'); } catch (e) { /* egal */ }
  Native.call('requestNotificationPermission');
}

// ------------------------------------------------------------------ Native Rückrufe
App.onPause = () => {
  Store.save.flush();
  Lock.hiddenAt = Date.now();
};
App.onResume = () => {
  Lock.maybeLock();
  if (Date.now() - Update.lastCheck > 3 * 3600000) Update.check(true);
  if (Update.state === 'permission') Native.call('installDownloaded');
  syncWidgets();
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

// Desktop: per Ziehen & Ablegen geöffnete Dateien
window.addEventListener('message', (e) => { if (e.data && typeof e.data.schulplanIncoming === 'string') App.onIncoming(e.data.schulplanIncoming); });

document.addEventListener('visibilitychange', () => {
  if (Native.has) return; // Android meldet sich über onPause/onResume
  if (document.hidden) App.onPause(); else App.onResume();
});
window.addEventListener('beforeunload', () => Store.save.flush());
if (window.matchMedia) {
  try { window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => applyTheme()); } catch (e) { /* alt */ }
}

// Roter Punkt an „Mehr", wenn im Kollegium etwas auf dich wartet
function navBadges() {
  const btn = document.querySelector('#bottomnav [data-tab="more"]');
  if (!btn) return;
  let news = false;
  if (S && S.team && S.team.id) {
    const t = S.team;
    news = t.posts.some((x) => x.by !== t.me && (x.updatedAt || 0) > (t.seenPosts || 0))
      || (typeof SubNotice !== 'undefined' && SubNotice.pending().length > 0)
      || (typeof openPollsForMe === 'function' && openPollsForMe().length > 0);
  }
  btn.classList.toggle('has-dot', news);
}

// ------------------------------------------------------------------ Start
(function boot() {
  Store.load();
  applyTheme();
  if (S.settings.secure) Native.call('setSecure', true);
  applyLeaderClass();
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
  setTimeout(() => Native.call('appReady'), 0);
  Lock.maybeLock(true);
  const incoming = Native.has ? Native.call('getIncoming') : '';
  if (incoming) setTimeout(() => App.onIncoming(incoming), 400);
  else if (!S.settings.onboarded) setTimeout(showOnboarding, 300);
  setTimeout(() => { if (App.onTeamResume) App.onTeamResume(); }, 2500);
  // Minütlich die Startseite aktualisieren (aktuelle Stunde)
  setInterval(() => { if ((App.path === '/today' || App.path.startsWith('/timetable')) && !UI.stack.length && !document.hidden && !document.activeElement.matches('input,textarea,select')) App.refresh(); }, 60000);
  // Erinnerungen, Widgets und App-Symbol nach dem ersten Bild – die Startseite erscheint so schneller
  setTimeout(() => { syncReminders(); syncWidgets(); updateAppBadge(); }, 250);
  // Neuerungen nach einem Update, Update-Prüfung, Benachrichtigungs-Erlaubnis
  setTimeout(() => {
    if (!UI.stack.length && !Lock.active) showWhatsNew();
    Update.check(true);
    askNotificationsOnce();
  }, 1200);
}());
