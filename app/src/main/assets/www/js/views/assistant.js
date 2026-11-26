/* Assistent: versteht deutsche Befehle offline – optional mit KI-Modus (Claude, eigener API-Schlüssel) */
'use strict';

const AI_MODELS = [
  { v: 'claude-opus-5-5', l: 'Claude Opus 5.5 – am stärksten (Standard)' },
  { v: 'claude-sonnet-5-5', l: 'Claude Sonnet 5.5 – schneller und günstiger' },
  { v: 'claude-haiku-5-5', l: 'Claude Haiku 5.5 – am schnellsten und günstigsten' },
];
const AI_KEY_STORE = 'sp-ai-key';
const WEEKDAYS_LC = ['montag', 'dienstag', 'mittwoch', 'donnerstag', 'freitag', 'samstag', 'sonntag'];

const Assist = {
  log: [],
  apiMessages: [],
  busy: false,
  conf() {
    if (!S.settings.ai) S.settings.ai = { mode: 'offline', model: 'claude-opus-5-5', students: false };
    return S.settings.ai;
  },
  // Der Schlüssel bleibt auf diesem Gerät (nicht in Sicherungen oder im Team-Abgleich)
  key() { try { return localStorage.getItem(AI_KEY_STORE) || ''; } catch (e) { return ''; } },
  setKey(k) { try { if (k) localStorage.setItem(AI_KEY_STORE, k); else localStorage.removeItem(AI_KEY_STORE); } catch (e) { /* egal */ } },
  aiReady() { return Assist.conf().mode === 'ki' && !!Assist.key(); },
  say(html, role = 'bot', extra = {}) { Assist.log.push({ role, html, ...extra }); Assist.redraw(); },
  redraw() {
    const box = $('#as-log');
    if (!box) return;
    box.innerHTML = Assist.log.map((m) => `<div class="as-msg ${m.role}">${m.html}${m.chips ? `<div class="as-chips">${m.chips.map((c) => `<button class="chip" data-act="as-chip" data-v="${esc(c)}">${esc(c)}</button>`).join('')}</div>` : ''}</div>`).join('')
      + (Assist.busy ? '<div class="as-msg bot as-typing"><i></i><i></i><i></i></div>' : '');
    box.scrollTop = box.scrollHeight;
    const v = $('#view'); if (v) v.scrollTop = v.scrollHeight;
  },
};

// ================================================================== Datum & Uhrzeit aus Text
function parseWhen(text) {
  let t = ' ' + text + ' ';
  const lc = () => t.toLowerCase();
  let date = null, time = null;
  const cut = (re) => { t = t.replace(re, ' '); };
  let m;
  if ((m = lc().match(/\bin (\d+|einer|einem|zwei|drei) (minute|minuten|stunde|stunden)\b/))) {
    const n = { einer: 1, einem: 1, zwei: 2, drei: 3 }[m[1]] || Number(m[1]);
    const d = new Date(Date.now() + n * (m[2].startsWith('stunde') ? 3600000 : 60000));
    date = iso(d); time = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
    cut(/\bin (\d+|einer|einem|zwei|drei) (minute|minuten|stunde|stunden)\b/i);
  }
  if (!date && /\bübermorgen\b/i.test(t)) { date = addDays(today(), 2); cut(/\bübermorgen\b/i); }
  if (!date && /\bmorgen\b/i.test(t) && !/\bmorgens\b/i.test(t)) { date = addDays(today(), 1); cut(/\bmorgen\b/i); }
  if (!date && /\bheute\b/i.test(t)) { date = today(); cut(/\bheute\b/i); }
  if (!date && (m = lc().match(/\bin (\d+|einer|einem|zwei|drei) (tag|tagen|woche|wochen)\b/))) {
    const n = { einer: 1, einem: 1, zwei: 2, drei: 3 }[m[1]] || Number(m[1]);
    date = addDays(today(), m[2].startsWith('woche') ? n * 7 : n);
    cut(/\bin (\d+|einer|einem|zwei|drei) (tag|tagen|woche|wochen)\b/i);
  }
  if (!date && (m = lc().match(/\b(?:am |bis )?(\d{1,2})\.(\d{1,2})\.(\d{2,4})?/))) {
    const now = pd(today());
    let y = m[3] ? Number(m[3].length === 2 ? '20' + m[3] : m[3]) : now.getFullYear();
    let d = `${y}-${pad2(Number(m[2]))}-${pad2(Number(m[1]))}`;
    if (!m[3] && d < today()) d = `${y + 1}-${pad2(Number(m[2]))}-${pad2(Number(m[1]))}`;
    date = d;
    cut(/\b(?:am |bis )?(\d{1,2})\.(\d{1,2})\.(\d{2,4})?/i);
  }
  if (!date && (m = lc().match(/\b(?:am |bis |nächsten |kommenden )*(montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag)\b/))) {
    const want = WEEKDAYS_LC.indexOf(m[1]);
    let n = (want - dow(today()) + 7) % 7;
    if (n === 0 || /nächsten|kommenden/.test(m[0])) n = n === 0 ? 7 : n;
    date = addDays(today(), n);
    cut(/\b(?:am |bis |nächsten |kommenden )*(montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag)\b/i);
  }
  if (!time && (m = lc().match(/\bum (\d{1,2})(?:[:.](\d{2}))?(?: ?uhr)?\b/))) {
    time = `${pad2(Number(m[1]))}:${m[2] || '00'}`; cut(/\bum (\d{1,2})(?:[:.](\d{2}))?(?: ?uhr)?\b/i);
  } else if (!time && (m = lc().match(/\b(\d{1,2}):(\d{2})\b/))) {
    time = `${pad2(Number(m[1]))}:${m[2]}`; cut(/\b(\d{1,2}):(\d{2})\b/);
  } else if (!time && (m = lc().match(/\b(\d{1,2}) uhr\b/))) {
    time = `${pad2(Number(m[1]))}:00`; cut(/\b(\d{1,2}) uhr\b/i);
  }
  if (time && Number(time.slice(0, 2)) > 23) time = null;
  return { date, time, rest: t.replace(/\s+/g, ' ').trim() };
}
function cleanTitle(s) {
  return s.replace(/^[\s:,-]+|[\s:,.!-]+$/g, '').replace(/^(an |daran,? |dass |zu |für |mit dem titel |namens )/i, '').replace(/^(den |die |das |dem |der |meine?n? )/i, '').replace(/\s+/g, ' ').trim();
}
const capFirst = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

// ================================================================== Einträge finden
const KINDS = {
  aufgabe: { coll: 'tasks', label: 'Aufgabe', title: (x) => x.title, nav: '/tasks' },
  termin: { coll: 'events', label: 'Termin', title: (x) => x.title, nav: '/calendar' },
  hausaufgabe: { coll: 'homework', label: 'Hausaufgabe', title: (x) => x.title, nav: '/homework' },
  notiz: { coll: 'notes', label: 'Notiz', title: (x) => x.title || (x.body || '').slice(0, 40), nav: '/notes' },
};
function kindOf(text) {
  const t = text.toLowerCase();
  // Ausdrücklich genannte Art hat Vorrang („Notiz: Elternabend …“ ist eine Notiz)
  const first = t.match(/\b(hausaufgabe|aufgabe|to-?do|termin|notiz)/);
  if (first) return { hausaufgabe: 'hausaufgabe', aufgabe: 'aufgabe', todo: 'aufgabe', 'to-do': 'aufgabe', termin: 'termin', notiz: 'notiz' }[first[1]];
  if (/konferenz|elternabend|sprechtag|ausflug/.test(t)) return 'termin';
  return null;
}
// „heute“, „morgen“ oder „am Fr, 27.11.“
function whenText(d) { return d === today() ? 'heute' : d === addDays(today(), 1) ? 'morgen' : 'am ' + fmtDW(d); }
function findItems(kind, query) {
  const k = KINDS[kind];
  const words = query.toLowerCase().replace(/[^\wäöüß ]+/g, ' ').split(/\s+/).filter((w) => w.length > 2 && !['die', 'der', 'das', 'den', 'dem', 'termin', 'aufgabe', 'notiz', 'hausaufgabe', 'von', 'für', 'mit', 'und'].includes(w));
  if (!words.length) return [];
  return S[k.coll].map((x) => {
    const tt = String(k.title(x) || '').toLowerCase();
    const score = words.filter((w) => tt.includes(w)).length / words.length;
    return { x, score };
  }).filter((r) => r.score >= 0.5).sort((a, b) => b.score - a.score).map((r) => r.x);
}

// ================================================================== Offline-Befehle
const OFFLINE_HELP = ['Was steht morgen an?', 'Erstelle Aufgabe Klassenarbeit korrigieren bis Freitag', 'Erinnere mich in 30 Minuten an die Kopien', 'Termin Zeugniskonferenz am 12.12. um 14 Uhr', 'Welche Aufgaben sind offen?', 'Wann sind die nächsten Ferien?'];

function daySummary(d) {
  const lines = [];
  const ls = lessonsOn(d).filter((l) => !l.cancelled && !l.holiday);
  const hol = holidayOn(d);
  if (hol) lines.push(`🏖️ ${esc(hol.title)} – unterrichtsfrei`);
  if (ls.length) lines.push(`📚 ${plural(ls.length, 'Stunde', 'Stunden')}: ${ls.map((l) => `${l.period + 1}. ${esc(lessonLabel(l))}`).join(', ')}`);
  const evs = sortBy(S.events.filter((e) => e.type !== 'ferien' && e.date <= d && (e.end || e.date) >= d), 'time');
  evs.forEach((e) => lines.push(`📅 ${esc(e.title)}${e.time ? ' um ' + e.time : ''}${e.place ? ' · ' + esc(e.place) : ''}`));
  S.assessments.filter((a) => a.date === d).forEach((a) => lines.push(`📝 ${esc(a.title)} (${esc(cName(a.classId))})`));
  S.tasks.filter((t) => !t.done && t.due === d).forEach((t) => lines.push(`✅ ${esc(t.title)}${t.time ? ' um ' + t.time : ''}`));
  S.homework.filter((h) => !h.done && h.due === d).forEach((h) => lines.push(`📖 HA ${esc(cName(h.classId))}: ${esc(h.title)}`));
  if (typeof myDutiesOn === 'function') myDutiesOn(d).forEach((x) => lines.push(`👀 Aufsicht ${esc(x.start)}–${esc(x.end)} · ${esc(x.place || '')}`));
  if (Team.on()) S.team.subs.filter((x) => x.sub === S.team.me && x.date === d).forEach((x) => lines.push(`🔁 Vertretung ${Number(x.period) + 1}. Std. ${esc(x.className || '')}`));
  return lines.length ? lines.join('<br>') : 'Nichts eingetragen – ein freier Tag! 🎉';
}

async function offlineAnswer(raw) {
  const text = raw.trim();
  const t = text.toLowerCase();
  // Hilfe
  if (/^(hilfe|help|was kannst du|\?|befehle)/.test(t)) {
    return { html: 'Ich kann Einträge <b>erstellen, ändern, abhaken und löschen</b>, dich <b>erinnern</b> und deinen Tag zusammenfassen. Probier zum Beispiel:', chips: OFFLINE_HELP };
  }
  // Navigation
  let m = t.match(/^(?:öffne|zeig(?:e)?(?: mir)?|geh(?:e)? zu|wechsel(?:e)? zu)\s+(?:den |die |das |meine?n? )?(stundenplan|kalender|klassen|aufgaben|hausaufgaben|notizen|kollegium|chat|einstellungen|cockpit|schulleitung|vertretungen|umfragen|aufsicht|räume|ferien|prüfungen|statistik)/);
  if (m) {
    const r = { stundenplan: '/timetable', kalender: '/calendar', klassen: '/classes', aufgaben: '/tasks', hausaufgaben: '/homework', notizen: '/notes', kollegium: '/team', chat: '/chat', einstellungen: '/settings', cockpit: '/leader', schulleitung: '/leader', vertretungen: '/team/subs', umfragen: '/team/polls', aufsicht: '/team/duties', räume: '/team/rooms', ferien: '/holidays', prüfungen: '/overview/exams', statistik: '/overview/stats' }[m[1]];
    setTimeout(() => App.navigate(r), 400);
    return { html: `Ich öffne ${esc(capFirst(m[1]))} …` };
  }
  // Tagesübersicht
  if (/(was (steht|ist|habe ich|hab ich|liegt)|programm|übersicht|plan für)/.test(t) || /^(heute|morgen|übermorgen)\??$/.test(t)) {
    const w = parseWhen(text);
    if (/woche/.test(t)) {
      const ws = /nächste/.test(t) ? addDays(weekStart(today()), 7) : weekStart(today());
      return { html: Array.from({ length: 5 }, (_, i) => addDays(ws, i)).map((d) => `<b>${fmtDW(d)}</b><br>${daySummary(d)}`).join('<br><br>') };
    }
    const d = w.date || today();
    return { html: `<b>${d === today() ? 'Heute' : relDay(d)}, ${fmtDW(d)}</b><br>${daySummary(d)}` };
  }
  if (/(offene|welche|meine) aufgaben/.test(t)) {
    const open = sortBy(S.tasks.filter((x) => !x.done), (x) => x.due || '9999');
    return { html: open.length ? `${plural(open.length, 'offene Aufgabe', 'offene Aufgaben')}:<br>${open.slice(0, 12).map((x) => `• ${esc(x.title)}${x.due ? ` <span class="muted">(${relDay(x.due)})</span>` : ''}`).join('<br>')}` : 'Keine offenen Aufgaben – stark! 💪' };
  }
  if (/ferien/.test(t) && /(wann|nächste|bis zu)/.test(t)) {
    const n = sortBy(S.events.filter((e) => e.type === 'ferien' && (e.end || e.date) >= today()), 'date')[0];
    return { html: n ? `Die nächsten Ferien: <b>${esc(n.title)}</b> vom ${fmtD(n.date)}${n.end ? ' bis ' + fmtD(n.end) : ''} – noch ${daysBetween(today(), n.date)} Tage.` : 'Es sind keine Ferien eingetragen. Unter Einstellungen → Ferien kannst du sie anlegen.' };
  }
  if (/geburtstag/.test(t)) {
    const list = sortBy(S.students.filter((s) => s.birthday && cls(s.classId) && !cls(s.classId).archived).map((s) => ({ s, n: nextBirthday(s.birthday, today()) })).filter((x) => daysBetween(today(), x.n) <= 14), 'n');
    return { html: list.length ? list.map(({ s, n }) => `🎂 ${esc(sName(s))} (${esc(cName(s.classId))}) – ${relDay(n)}`).join('<br>') : 'In den nächsten zwei Wochen hat niemand Geburtstag.' };
  }
  // Erinnern
  if (/^(erinnere|erinner|erinnerung)/.test(t)) {
    const w = parseWhen(text.replace(/^(erinnere|erinner)( mich)?|^erinnerung( an)?/i, ''));
    const title = capFirst(cleanTitle(w.rest)) || 'Erinnerung';
    const due = w.date || today();
    const time = w.time || (due === today() ? null : '07:30');
    if (!time) return { html: 'Wann soll ich dich erinnern? Zum Beispiel: <i>„Erinnere mich um 15 Uhr an …“</i> oder <i>„in 20 Minuten“</i>.' };
    if (dateTimeMs(due, time) < Date.now()) return { html: `Der Zeitpunkt (${fmtDW(due)}, ${time}) liegt schon in der Vergangenheit.` };
    upsert('tasks', { title, due, time, prio: 1, cat: 'Sonstiges', remind: true, done: false, created: today(), byAssistant: true });
    if (!S.settings.remind.on) { S.settings.remind.on = true; requestNotifPermission(); }
    S.settings.remind.tasks = true;
    save();
    return { html: `🔔 Okay! Ich erinnere dich <b>${whenText(due)} um ${time} Uhr</b>: ${esc(title)}`, done: true };
  }
  const kind = kindOf(t);
  // Abhaken
  if (/(erledige|erledigt|hake|abhaken|fertig mit)/.test(t) && (kind === 'aufgabe' || !kind)) {
    const q = text.replace(/(erledige|erledigt|hake|abhaken|ab|fertig mit|die|aufgabe)/gi, ' ');
    const hits = findItems('aufgabe', q).filter((x) => !x.done);
    if (!hits.length) return { html: 'Diese Aufgabe habe ich nicht gefunden. Sag mir ein Stichwort aus dem Titel.' };
    if (hits.length > 1 && !hits[0].title.toLowerCase().includes(q.trim().toLowerCase())) return { html: 'Welche meinst du?', chips: hits.slice(0, 4).map((x) => `Erledige Aufgabe ${x.title}`) };
    hits[0].done = true; hits[0].doneAt = today(); save();
    return { html: `✅ Abgehakt: <b>${esc(hits[0].title)}</b>`, done: true };
  }
  // Löschen
  if (/^(lösche|entferne|lösch)/.test(t)) {
    if (!kind) return { html: 'Was soll ich löschen? Zum Beispiel: <i>„Lösche Termin Elternabend“</i> oder <i>„Lösche Aufgabe Kopien“</i>.' };
    const q = text.replace(/^(lösche|entferne|lösch)\s+(den |die |das |meine?n? )?/i, '').replace(new RegExp(kind, 'i'), '');
    const hits = findItems(kind, q);
    if (!hits.length) return { html: `Keine ${KINDS[kind].label} mit „${esc(cleanTitle(q))}“ gefunden.` };
    const x = hits[0];
    if (x.team && !(await UI.confirm(`„${esc(KINDS[kind].title(x))}“ ist mit dem Kollegium geteilt. Für alle löschen?`, { danger: true, ok: 'Löschen' }))) return { html: 'Okay, nichts gelöscht.' };
    if (!x.team && !(await UI.confirm(`${KINDS[kind].label} „${esc(KINDS[kind].title(x))}“ löschen?`, { danger: true, ok: 'Löschen' }))) return { html: 'Okay, nichts gelöscht.' };
    if (x.official && !Leader.isTeamLeader()) return { html: 'Das ist ein Termin der Schulleitung – den kann nur sie löschen.' };
    removeById(KINDS[kind].coll, x.id);
    if (x.team && Team.on()) { if (x.official) await Leader.signDelete(x.id); else Team.markDeleted(x.id); Team.changed(); }
    save();
    return { html: `🗑️ Gelöscht: <b>${esc(KINDS[kind].title(x))}</b>`, done: true };
  }
  // Verschieben / ändern
  if (/^(verschiebe|verlege|ändere|änder)/.test(t) && kind && kind !== 'notiz') {
    const w = parseWhen(text);
    if (!w.date && !w.time) return { html: 'Auf wann? Zum Beispiel: <i>„Verschiebe Termin Elternabend auf Donnerstag um 19 Uhr“</i>.' };
    const q = w.rest.replace(/^(verschiebe|verlege|ändere|änder)\s+/i, '').replace(new RegExp(kind, 'i'), '').replace(/\b(auf|nach)\b.*$/i, '');
    const hits = findItems(kind, q);
    if (!hits.length) return { html: `Keine ${KINDS[kind].label} mit „${esc(cleanTitle(q))}“ gefunden.` };
    const x = hits[0];
    if (x.official && !Leader.isTeamLeader()) return { html: 'Das ist ein Termin der Schulleitung – den kann nur sie ändern.' };
    if (kind === 'termin') { if (w.date) { const len = x.end ? daysBetween(x.date, x.end) : 0; x.date = w.date; if (len) x.end = addDays(w.date, len); } if (w.time) x.time = w.time; }
    else { if (w.date) x.due = w.date; if (w.time) x.time = w.time; }
    if (x.team && Team.on()) { Team.touch(x); if (x.official) await Leader.signItem(x); Team.changed(); }
    save();
    return { html: `📆 ${KINDS[kind].label} <b>${esc(KINDS[kind].title(x))}</b> jetzt am ${fmtDW(kind === 'termin' ? x.date : x.due)}${x.time ? ' um ' + x.time : ''}.`, done: true };
  }
  // Erstellen
  const create = /^(erstelle|erstell|neue?r?s?|leg(?:e)?|füge|trag(?:e)?|plane?|notiere|merke|aufgabe|termin|hausaufgabe|notiz)\b/.test(t);
  if (create && kind) {
    const w = parseWhen(text);
    let title = cleanTitle(w.rest.replace(/^(erstelle|erstell|neue?r?s?|leg(?:e)?( an)?|füge( hinzu)?|trag(?:e)?( ein)?|plane?|notiere|merke( dir)?)\s*/i, '').replace(/\b(eine?n?|neue?n?)\b/gi, ' ').replace(new RegExp('\\b' + kind + 'n?\\b', 'i'), ' ').replace(/\b(an|ein|hinzu)\s*$/i, ''));
    title = capFirst(title);
    if (kind === 'aufgabe') {
      if (!title) return { html: 'Wie soll die Aufgabe heißen?' };
      upsert('tasks', { title, due: w.date || '', time: w.time || '', prio: 0, cat: '', remind: !!w.time, done: false, created: today() });
      save();
      return { html: `✅ Aufgabe angelegt: <b>${esc(title)}</b>${w.date ? ` – fällig ${whenText(w.date)}${w.time ? ' um ' + w.time + ' Uhr' : ''}` : ''}`, done: true, chips: ['Welche Aufgaben sind offen?'] };
    }
    if (kind === 'termin') {
      if (!title) return { html: 'Wie heißt der Termin? Zum Beispiel: <i>„Termin Elternabend 7a am 3.12. um 19 Uhr“</i>.' };
      if (!w.date) return { html: `An welchem Tag ist „${esc(title)}“? Sag zum Beispiel <i>„am 3.12.“</i> oder <i>„nächsten Dienstag“</i>.` };
      const type = /konferenz/i.test(title) ? 'konferenz' : /elternabend/i.test(title) ? 'elternabend' : /sprechtag/i.test(title) ? 'sprechtag' : /ausflug|wandertag|fahrt/i.test(title) ? 'ausflug' : /fortbildung/i.test(title) ? 'fortbildung' : 'termin';
      upsert('events', { title, type, date: w.date, time: w.time || '', remind: w.time ? '60' : '1440' });
      save();
      return { html: `📅 Termin eingetragen: <b>${esc(title)}</b> ${whenText(w.date)}${w.time ? ' um ' + w.time + ' Uhr' : ''}. Ich erinnere dich ${w.time ? 'eine Stunde' : 'einen Tag'} vorher.`, done: true };
    }
    if (kind === 'hausaufgabe') {
      const c = activeClasses().find((x) => new RegExp('\\b' + x.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i').test(text));
      if (!c) return { html: `Für welche Klasse? Zum Beispiel: <i>„Hausaufgabe 7a: Buch S. 45 bis Freitag“</i>. Deine Klassen: ${activeClasses().map((x) => esc(x.name)).join(', ')}` };
      title = capFirst(cleanTitle(title.replace(new RegExp('\\b' + c.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i'), ' ').replace(/^(für|in)\s+/i, '')));
      if (!title) return { html: 'Was ist die Hausaufgabe?' };
      upsert('homework', { title, classId: c.id, subjectId: (subjectsOf(c.id)[0] || {}).id || '', given: today(), due: w.date || nextLessonDate(c.id, today()) || addDays(today(), 7), desc: '', done: false });
      save();
      return { html: `📖 Hausaufgabe für <b>${esc(c.name)}</b>: ${esc(title)}`, done: true };
    }
    if (kind === 'notiz') {
      const body = cleanTitle(text.replace(/^(erstelle|neue?|notiere|merke( dir)?)?\s*(eine )?notiz:?/i, ''));
      if (!body) return { html: 'Was soll in der Notiz stehen?' };
      S.notes.push({ id: uid(), title: body.slice(0, 40), body, color: '', pinned: false, classId: '', updated: new Date().toISOString() });
      save();
      return { html: `🗒️ Notiz gespeichert: „${esc(body.slice(0, 80))}“`, done: true };
    }
  }
  return null;
}

// ================================================================== KI-Modus (Claude)
let anthropicLoad = null;
function loadAnthropic() {
  if (window.Anthropic) return Promise.resolve();
  if (!anthropicLoad) anthropicLoad = loadScript('vendor/anthropic-sdk.js');
  return anthropicLoad;
}
const AI_TOOLS = [
  { name: 'get_schedule', description: 'Liefert Unterricht, Termine, Prüfungen, fällige Aufgaben, Hausaufgaben, Aufsichten und Vertretungen der Lehrkraft für einen Zeitraum (höchstens 31 Tage).', input_schema: { type: 'object', properties: { from: { type: 'string', description: 'Startdatum YYYY-MM-DD' }, to: { type: 'string', description: 'Enddatum YYYY-MM-DD (inklusive)' } }, required: ['from', 'to'] } },
  { name: 'list_items', description: 'Listet Einträge einer Art auf: tasks (Aufgaben), events (Termine), homework (Hausaufgaben), notes (Notizen), classes (Klassen). Liefert id, Titel und Daten.', input_schema: { type: 'object', properties: { kind: { type: 'string', enum: ['tasks', 'events', 'homework', 'notes', 'classes'] }, query: { type: 'string', description: 'Optionales Suchwort im Titel' }, only_open: { type: 'boolean', description: 'Nur offene Aufgaben/Hausaufgaben' } }, required: ['kind'] } },
  { name: 'create_task', description: 'Legt eine Aufgabe an. Mit due + time und remind=true erhält die Lehrkraft zu diesem Zeitpunkt eine Benachrichtigung (so funktionieren Erinnerungen).', input_schema: { type: 'object', properties: { title: { type: 'string' }, due: { type: 'string', description: 'YYYY-MM-DD' }, time: { type: 'string', description: 'HH:MM' }, priority: { type: 'integer', enum: [0, 1, 2], description: '0 normal, 1 wichtig, 2 dringend' }, remind: { type: 'boolean' }, notes: { type: 'string' } }, required: ['title'] } },
  { name: 'create_event', description: 'Trägt einen Termin in den Kalender ein.', input_schema: { type: 'object', properties: { title: { type: 'string' }, date: { type: 'string', description: 'YYYY-MM-DD' }, end: { type: 'string', description: 'Enddatum bei mehrtägigen Terminen' }, time: { type: 'string', description: 'HH:MM' }, end_time: { type: 'string' }, type: { type: 'string', enum: Object.keys(EVENT_TYPES) }, place: { type: 'string' }, remind_minutes_before: { type: 'integer', description: 'Erinnerung so viele Minuten vor Beginn' }, notes: { type: 'string' } }, required: ['title', 'date'] } },
  { name: 'create_homework', description: 'Legt eine Hausaufgabe für eine Klasse an (Klasse per Name, siehe list_items kind=classes).', input_schema: { type: 'object', properties: { class_name: { type: 'string' }, title: { type: 'string' }, due: { type: 'string', description: 'YYYY-MM-DD' }, details: { type: 'string' } }, required: ['class_name', 'title'] } },
  { name: 'create_note', description: 'Speichert eine Notiz.', input_schema: { type: 'object', properties: { title: { type: 'string' }, body: { type: 'string' } }, required: ['body'] } },
  { name: 'update_item', description: 'Ändert einen Eintrag (Aufgabe, Termin, Hausaufgabe oder Notiz) per id. Nur die angegebenen Felder werden geändert. Für Aufgaben: title, due, time, done, notes. Für Termine: title, date, end, time, end_time, place, notes. Für Hausaufgaben: title, due, done, desc. Für Notizen: title, body.', input_schema: { type: 'object', properties: { kind: { type: 'string', enum: ['tasks', 'events', 'homework', 'notes'] }, id: { type: 'string' }, fields: { type: 'object', description: 'Zu ändernde Felder' } }, required: ['kind', 'id', 'fields'] } },
  { name: 'delete_item', description: 'Löscht einen Eintrag per id. Die App fragt die Lehrkraft vorher um Bestätigung.', input_schema: { type: 'object', properties: { kind: { type: 'string', enum: ['tasks', 'events', 'homework', 'notes'] }, id: { type: 'string' } }, required: ['kind', 'id'] } },
  { name: 'open_page', description: 'Öffnet eine Seite der App.', input_schema: { type: 'object', properties: { page: { type: 'string', enum: ['today', 'timetable', 'calendar', 'classes', 'tasks', 'homework', 'notes', 'team', 'chat', 'settings', 'leader'] } }, required: ['page'] } },
];
const AI_STUDENT_TOOL = { name: 'list_students', description: 'Listet die Schüler:innen einer Klasse (Name, Geburtstag). Nur verfügbar, weil die Lehrkraft Schülerdaten freigegeben hat.', input_schema: { type: 'object', properties: { class_name: { type: 'string' } }, required: ['class_name'] } };
const COLL = { tasks: 'tasks', events: 'events', homework: 'homework', notes: 'notes' };
const str = (v, max = 300) => (v == null ? '' : String(v)).slice(0, max);
const isDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ''));
const isTime = (v) => /^\d{2}:\d{2}$/.test(String(v || ''));
function brief(kind, x) {
  if (kind === 'tasks') return { id: x.id, title: x.title, due: x.due || null, time: x.time || null, done: !!x.done, priority: x.prio || 0 };
  if (kind === 'events') return { id: x.id, title: x.title, date: x.date, end: x.end || null, time: x.time || null, type: x.type, place: x.place || null, shared_with_team: !!x.team, official: !!x.official };
  if (kind === 'homework') return { id: x.id, class: cName(x.classId), title: x.title, due: x.due || null, done: !!x.done };
  if (kind === 'notes') return { id: x.id, title: x.title || '', text: str(x.body, 200) };
  return x;
}

async function runTool(name, input) {
  const a = input || {};
  const classByName = (n) => activeClasses().find((c) => c.name.toLowerCase() === String(n || '').toLowerCase().trim());
  switch (name) {
    case 'get_schedule': {
      const from = isDate(a.from) ? a.from : today();
      let to = isDate(a.to) ? a.to : from;
      if (daysBetween(from, to) > 31) to = addDays(from, 31);
      const days = [];
      for (let d = from; d <= to; d = addDays(d, 1)) {
        const ls = lessonsOn(d).filter((l) => !l.holiday).map((l) => ({ period: l.period + 1, what: lessonLabel(l), room: lessonRoom(l) || null, cancelled: !!l.cancelled }));
        const day = { date: d, weekday: WD[dow(d)], holiday: (holidayOn(d) || {}).title || null, lessons: ls,
          events: S.events.filter((e) => e.date <= d && (e.end || e.date) >= d).map((e) => brief('events', e)),
          exams: S.assessments.filter((x) => x.date === d).map((x) => ({ title: x.title, class: cName(x.classId) })),
          tasks_due: S.tasks.filter((t) => !t.done && t.due === d).map((t) => brief('tasks', t)),
          homework_due: S.homework.filter((h) => !h.done && h.due === d).map((h) => brief('homework', h)),
          duties: typeof myDutiesOn === 'function' ? myDutiesOn(d).map((x) => ({ slot: x.slot, start: x.start, end: x.end, place: x.place })) : [] };
        if (ls.length || day.events.length || day.exams.length || day.tasks_due.length || day.homework_due.length || day.duties.length || day.holiday) days.push(day);
      }
      return { days };
    }
    case 'list_items': {
      if (a.kind === 'classes') return { classes: activeClasses().map((c) => ({ name: c.name, students: studentsOf(c.id).length })) };
      const coll = COLL[a.kind];
      if (!coll) return { error: 'unbekannte Art' };
      let list = S[coll];
      if (a.only_open) list = list.filter((x) => !x.done);
      if (a.query) { const q = String(a.query).toLowerCase(); list = list.filter((x) => String(x.title || x.body || '').toLowerCase().includes(q)); }
      if (a.kind === 'events') list = list.filter((e) => (e.end || e.date) >= addDays(today(), -30));
      return { items: list.slice(0, 60).map((x) => brief(a.kind, x)), total: list.length };
    }
    case 'create_task': {
      const title = str(a.title, 200).trim();
      if (!title) return { error: 'title fehlt' };
      const t = upsert('tasks', { title, due: isDate(a.due) ? a.due : '', time: isTime(a.time) ? a.time : '', prio: [0, 1, 2].includes(a.priority) ? a.priority : 0, remind: !!a.remind || isTime(a.time), notes: str(a.notes, 2000), cat: '', done: false, created: today(), byAssistant: true });
      if (t.remind && !S.settings.remind.on) { S.settings.remind.on = true; requestNotifPermission(); }
      save();
      return { ok: true, task: brief('tasks', t) };
    }
    case 'create_event': {
      const title = str(a.title, 200).trim();
      if (!title || !isDate(a.date)) return { error: 'title und date (YYYY-MM-DD) nötig' };
      const e = upsert('events', { title, date: a.date, end: isDate(a.end) && a.end > a.date ? a.end : '', time: isTime(a.time) ? a.time : '', endTime: isTime(a.end_time) ? a.end_time : '', type: EVENT_TYPES[a.type] ? a.type : 'termin', place: str(a.place, 120), notes: str(a.notes, 2000), remind: Number.isInteger(a.remind_minutes_before) && a.remind_minutes_before >= 0 ? String(a.remind_minutes_before) : '' });
      save();
      return { ok: true, event: brief('events', e) };
    }
    case 'create_homework': {
      const c = classByName(a.class_name);
      if (!c) return { error: `Klasse „${str(a.class_name, 40)}“ nicht gefunden`, classes: activeClasses().map((x) => x.name) };
      const h = upsert('homework', { title: str(a.title, 300), classId: c.id, subjectId: (subjectsOf(c.id)[0] || {}).id || '', given: today(), due: isDate(a.due) ? a.due : (nextLessonDate(c.id, today()) || addDays(today(), 7)), desc: str(a.details, 2000), done: false });
      save();
      return { ok: true, homework: brief('homework', h) };
    }
    case 'create_note': {
      const n = { id: uid(), title: str(a.title, 80), body: str(a.body, 5000), color: '', pinned: false, classId: '', updated: new Date().toISOString() };
      S.notes.push(n); save();
      return { ok: true, note: brief('notes', n) };
    }
    case 'update_item': {
      const coll = COLL[a.kind];
      const x = coll && S[coll].find((y) => y.id === a.id);
      if (!x) return { error: 'Eintrag nicht gefunden' };
      if (x.official && !Leader.isTeamLeader()) return { error: 'Termin der Schulleitung – darf nicht geändert werden' };
      const f = a.fields || {};
      const allowed = { tasks: ['title', 'due', 'time', 'done', 'notes'], events: ['title', 'date', 'end', 'time', 'end_time', 'place', 'notes'], homework: ['title', 'due', 'done', 'desc'], notes: ['title', 'body'] }[a.kind];
      for (const k of Object.keys(f)) {
        if (!allowed.includes(k)) continue;
        const v = f[k];
        if (['due', 'date', 'end'].includes(k) && v && !isDate(v)) return { error: `${k} muss YYYY-MM-DD sein` };
        if (['time', 'end_time'].includes(k) && v && !isTime(v)) return { error: `${k} muss HH:MM sein` };
        x[k === 'end_time' ? 'endTime' : k] = k === 'done' ? !!v : str(v, 5000);
      }
      if (a.kind === 'notes') x.updated = new Date().toISOString();
      if (x.team && Team.on()) { Team.touch(x); if (x.official) await Leader.signItem(x); Team.changed(); }
      save();
      return { ok: true, item: brief(a.kind, x) };
    }
    case 'delete_item': {
      const coll = COLL[a.kind];
      const x = coll && S[coll].find((y) => y.id === a.id);
      if (!x) return { error: 'Eintrag nicht gefunden' };
      if (x.official && !Leader.isTeamLeader()) return { error: 'Termin der Schulleitung – darf nicht gelöscht werden' };
      const label = { tasks: 'Aufgabe', events: 'Termin', homework: 'Hausaufgabe', notes: 'Notiz' }[a.kind];
      const ok = await UI.confirm(`Der Assistent möchte ${label} „${esc(x.title || (x.body || '').slice(0, 40))}“ löschen${x.team ? ' (auch für das Kollegium)' : ''}. Erlauben?`, { danger: true, ok: 'Löschen' });
      if (!ok) return { ok: false, declined: true, message: 'Die Lehrkraft hat das Löschen abgelehnt.' };
      removeById(coll, x.id);
      if (x.team && Team.on()) { if (x.official) await Leader.signDelete(x.id); else Team.markDeleted(x.id); Team.changed(); }
      save();
      return { ok: true };
    }
    case 'open_page': {
      const r = { today: '/today', timetable: '/timetable', calendar: '/calendar', classes: '/classes', tasks: '/tasks', homework: '/homework', notes: '/notes', team: '/team', chat: '/chat', settings: '/settings', leader: '/leader' }[a.page];
      if (r) setTimeout(() => App.navigate(r), 600);
      return { ok: !!r };
    }
    case 'list_students': {
      if (!Assist.conf().students) return { error: 'Schülerdaten sind nicht freigegeben' };
      const c = classByName(a.class_name);
      if (!c) return { error: 'Klasse nicht gefunden' };
      return { students: studentsOf(c.id).map((s) => ({ name: sName(s), birthday: s.birthday || null })) };
    }
    default: return { error: 'unbekanntes Werkzeug' };
  }
}

function aiSystemPrompt() {
  const st = S.settings;
  const lead = typeof Leader !== 'undefined' && Leader.active();
  return `Du bist der Assistent in „Schulplan“, der Organisations-App einer Lehrkraft an der ${st.school || 'Schule'}. Antworte immer auf Deutsch, freundlich, kurz und konkret (höchstens ein paar Sätze oder eine kurze Liste). Heute ist ${WD[dow(today())]}, ${fmtD(today())}, ${pad2(now().getHours())}:${pad2(now().getMinutes())} Uhr. Die Lehrkraft heißt ${teacherName() || 'unbekannt'}${lead ? ' und ist im Schulleitermodus angemeldet' : ''}.
Nutze die Werkzeuge, um Einträge nachzuschlagen, anzulegen, zu ändern oder zu löschen – erfinde keine Daten. Für Erinnerungen legst du eine Aufgabe mit Datum, Uhrzeit und remind=true an. Bevor du etwas änderst oder löschst, suche den Eintrag mit list_items und nutze die richtige id. Datumsangaben im Format YYYY-MM-DD, Uhrzeiten HH:MM. Bestätige am Ende in einem Satz, was du getan hast.
${Assist.conf().students ? 'Die Lehrkraft hat Schülerdaten freigegeben (list_students).' : 'Schülerdaten (Namen, Noten) sind nicht freigegeben – frage nicht danach und verweise bei Bedarf auf die App.'}`;
}

async function aiAnswer(text) {
  await loadAnthropic();
  const c = Assist.conf();
  const client = new window.Anthropic({ apiKey: Assist.key(), dangerouslyAllowBrowser: true });
  const model = AI_MODELS.some((x) => x.v === c.model) ? c.model : 'claude-opus-5-5';
  const tools = c.students ? [...AI_TOOLS, AI_STUDENT_TOOL] : AI_TOOLS;
  Assist.apiMessages.push({ role: 'user', content: text });
  const did = [];
  for (let round = 0; round < 8; round++) {
    const params = { model, max_tokens: 16000, system: aiSystemPrompt(), tools, messages: Assist.apiMessages, output_config: { effort: 'medium' } };
    // Bei einer Ablehnung durch die Sicherheitsfilter springt automatisch ein anderes Modell ein (nicht bei Haiku verfügbar)
    if (model !== 'claude-haiku-5-5') { params.betas = ['server-side-fallback-2026-07-01']; params.fallbacks = 'default'; }
    const res = await client.beta.messages.create(params);
    Assist.apiMessages.push({ role: 'assistant', content: res.content });
    if (res.stop_reason === 'refusal') return { html: 'Diese Anfrage kann der KI-Assistent leider nicht bearbeiten.' };
    if (res.stop_reason === 'pause_turn') continue;
    const uses = res.content.filter((b) => b.type === 'tool_use');
    if (res.stop_reason !== 'tool_use' || !uses.length) {
      const out = res.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
      if (res.stop_reason === 'max_tokens' && !out) return { html: 'Die Antwort war zu lang – bitte die Frage enger fassen.' };
      return { html: mdLite(out || 'Erledigt.'), done: did.length > 0 };
    }
    const results = [];
    for (const u of uses) {
      let r;
      try { r = await runTool(u.name, u.input); } catch (e) { r = { error: String(e && e.message || e) }; }
      if (r && r.ok && u.name !== 'open_page') did.push(u.name);
      results.push({ type: 'tool_result', tool_use_id: u.id, content: JSON.stringify(r), is_error: !!(r && r.error) });
    }
    Assist.apiMessages.push({ role: 'user', content: results });
    App.refresh && setTimeout(() => { if (App.path === '/assistant') Assist.redraw(); }, 0);
  }
  return { html: 'Ich habe die Anfrage nach mehreren Schritten abgebrochen. Bitte formuliere sie etwas genauer.' };
}
// Einfache Formatierung der KI-Antworten (fett, Listen, Zeilenumbrüche) – alles andere wird escaped
function mdLite(s) {
  return esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/^[-*] (.+)$/gm, '• $1').replace(/\n/g, '<br>');
}
function aiErrorText(e) {
  const A = window.Anthropic;
  if (A && e instanceof A.AuthenticationError) return 'Der API-Schlüssel ist ungültig. Bitte unter Assistent → Einstellungen prüfen.';
  if (A && e instanceof A.PermissionDeniedError) return 'Der API-Schlüssel hat keinen Zugriff auf dieses Modell.';
  if (A && e instanceof A.RateLimitError) return 'Zu viele Anfragen gerade – bitte kurz warten.';
  if (A && e instanceof A.APIConnectionError) return 'Keine Verbindung zum KI-Dienst. Bist du online?';
  if (A && e instanceof A.APIError) return 'Der KI-Dienst meldet einen Fehler (' + (e.status || '?') + '). Versuch es gleich noch einmal.';
  return 'Der KI-Assistent konnte nicht geladen werden. Bist du online?';
}

async function assistSend(text) {
  text = String(text || '').trim();
  if (!text || Assist.busy) return;
  Assist.say(esc(text), 'user');
  Assist.busy = true; Assist.redraw();
  let ans = null;
  try {
    if (Assist.aiReady()) {
      // KI-Modus: die KI versteht auch lange, zusammengesetzte Aufträge. Ohne Verbindung hilft der Offline-Assistent.
      try { ans = await aiAnswer(text); } catch (e) {
        console.error(e);
        Assist.apiMessages = [];
        const offline = window.Anthropic && e instanceof window.Anthropic.APIConnectionError || !window.Anthropic ? await offlineAnswer(text) : null;
        ans = offline ? { ...offline, html: offline.html + '<br><span class="muted small">(offline beantwortet – keine Verbindung zum KI-Dienst)</span>' } : { html: esc(aiErrorText(e)) };
      }
    } else ans = await offlineAnswer(text);
  } catch (e) { console.error(e); ans = { html: 'Da ist etwas schiefgelaufen: ' + esc(e.message || e) }; }
  if (!ans) {
    ans = Assist.conf().mode === 'ki' && !Assist.key()
      ? { html: 'Für freie Fragen brauche ich im KI-Modus noch deinen API-Schlüssel (Einstellungen oben rechts). Diese Befehle verstehe ich auch offline:', chips: OFFLINE_HELP.slice(0, 4) }
      : { html: 'Das habe ich offline nicht verstanden. Probier zum Beispiel:' + (Assist.conf().mode !== 'ki' ? ' <span class="muted">(Für freie Fragen kannst du in den Einstellungen den KI-Modus einschalten.)</span>' : ''), chips: OFFLINE_HELP.slice(0, 4) };
  }
  Assist.busy = false;
  Assist.say(ans.html, 'bot', { chips: ans.chips });
  if (ans.done) syncReminders();
}

App.def('/assistant', () => {
  const c = Assist.conf();
  const ki = Assist.aiReady();
  if (!Assist.log.length) Assist.log.push({ role: 'bot', html: `Hallo${teacherName() ? ' ' + esc(teacherName()) : ''}! 👋 Ich bin dein Schulplan-Assistent. ${ki ? 'Der <b>KI-Modus</b> ist an – frag mich alles rund um deinen Schulalltag.' : 'Ich verstehe kurze Befehle – auch <b>ohne Internet</b>.'}`, chips: OFFLINE_HELP.slice(0, 4) });
  return {
    title: 'Assistent', sub: ki ? 'KI-Modus · ' + (AI_MODELS.find((m) => m.v === c.model) || AI_MODELS[0]).l.split(' – ')[0] : 'Offline-Modus', tab: 'today', icon: 'sparkles', cls: 'as-view',
    html: `<div id="as-log" class="as-log"></div>
      <form class="as-input" onsubmit="return false"><input id="as-text" placeholder="${ki ? 'Frag mich etwas oder gib einen Auftrag …' : 'z. B. Erinnere mich morgen um 7 an die Kopien'}" autocomplete="off" enterkeyhint="send">
      <button type="submit" class="btn btn-primary btn-icon" aria-label="Senden">${icon('send')}</button></form>`,
    actions: [{ icon: 'trash-2', act: 'as-clear', label: 'Verlauf leeren' }, { icon: 'settings', act: 'as-settings', label: 'Assistent einstellen' }],
    mount: (el) => {
      Assist.redraw();
      const inp = el.querySelector('#as-text');
      el.querySelector('form').addEventListener('submit', () => { const v = inp.value; inp.value = ''; assistSend(v); });
      setTimeout(() => inp.focus(), 250);
    },
  };
});
A['as-chip'] = (el) => assistSend(el.dataset.v);
A['as-clear'] = () => { Assist.log = []; Assist.apiMessages = []; App.refresh(); };
A['as-settings'] = () => {
  const c = Assist.conf();
  UI.form({
    title: 'Assistent einstellen',
    fields: [
      { k: 'mode', label: 'Modus', type: 'seg', opts: [{ v: 'offline', l: 'Offline', i: 'lock' }, { v: 'ki', l: 'KI-Modus', i: 'sparkles' }] },
      { type: 'html', html: `<div class="banner">${icon('info')}<div><b>Offline:</b> versteht kurze Befehle, alles bleibt auf dem Gerät.<br><b>KI-Modus:</b> beantwortet freie Fragen mit Claude (Anthropic). Deine Frage und die dafür nötigen Einträge (Termine, Aufgaben, Stundenplan) werden dazu an Anthropic gesendet. Du brauchst einen eigenen API-Schlüssel von console.anthropic.com; die Nutzung kostet je nach Modell ein paar Cent pro Anfrage.</div></div>` },
      { k: 'key', label: 'API-Schlüssel (nur für den KI-Modus)', type: 'password', ph: Assist.key() ? '•••••••• gespeichert – leer lassen zum Behalten' : 'sk-ant-…', hint: 'Bleibt nur auf diesem Gerät – nicht in Sicherungen und nicht im Team-Abgleich.' },
      { k: 'model', label: 'Modell', type: 'select', opts: AI_MODELS },
      { k: 'students', label: 'Schülerdaten freigeben', type: 'switch', hint: 'Erlaubt der KI, Namen und Geburtstage deiner Schüler:innen abzufragen. Prüfe vorher die Vorgaben deiner Schule zum Datenschutz.' },
      Assist.key() ? { k: 'delkey', label: 'Gespeicherten Schlüssel löschen', type: 'switch' } : null,
    ],
    values: { ...c },
    onSave: (v) => {
      if (v.key && !/^sk-ant-/.test(v.key.trim())) { UI.toast('Der Schlüssel sollte mit „sk-ant-“ beginnen', { type: 'err' }); return false; }
      if (v.delkey) Assist.setKey(''); else if (v.key) Assist.setKey(v.key.trim());
      Object.assign(c, { mode: v.mode, model: v.model, students: !!v.students });
      if (c.mode === 'ki' && !Assist.key()) UI.toast('KI-Modus braucht noch einen API-Schlüssel', { type: 'err', ms: 4000 });
      Assist.apiMessages = [];
      save(); App.refresh();
    },
  });
};
