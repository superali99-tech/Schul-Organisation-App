/* Schulplan – Kern: Hilfsfunktionen, Datum, Datenspeicher, Notenlogik */
'use strict';

// ------------------------------------------------------------------ Allgemein
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
const ESC_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC_MAP[c]);
const nl2br = (s) => esc(s).replace(/\n/g, '<br>');
const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
const sum = (a) => a.reduce((x, y) => x + y, 0);
const avg = (a) => (a.length ? sum(a) / a.length : null);
const round = (n, d = 2) => Math.round(n * 10 ** d) / 10 ** d;
const pad2 = (n) => String(n).padStart(2, '0');
const deepCopy = (o) => JSON.parse(JSON.stringify(o));
function fmtNum(n, d = 2) {
  if (n == null || isNaN(n)) return '–';
  return round(n, d).toFixed(d).replace('.', ',');
}
function fmtNumShort(n, d = 2) {
  if (n == null || isNaN(n)) return '–';
  return String(round(n, d)).replace('.', ',');
}
function parseNum(s) {
  if (s == null) return null;
  const t = String(s).trim().replace(',', '.');
  if (t === '') return null;
  const n = Number(t);
  return isNaN(n) ? null : n;
}
function debounce(fn, ms) {
  let t;
  const f = (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
  f.flush = (...a) => { clearTimeout(t); fn(...a); };
  return f;
}
function sortBy(arr, ...keys) {
  return [...arr].sort((a, b) => {
    for (const k of keys) {
      const va = typeof k === 'function' ? k(a) : a[k];
      const vb = typeof k === 'function' ? k(b) : b[k];
      if (va == null && vb != null) return 1;
      if (vb == null && va != null) return -1;
      if (va < vb) return -1;
      if (va > vb) return 1;
    }
    return 0;
  });
}
const collator = new Intl.Collator('de', { sensitivity: 'base', numeric: true });
const cmpStr = (a, b) => collator.compare(a || '', b || '');
function groupBy(arr, fn) {
  const m = new Map();
  for (const x of arr) {
    const k = fn(x);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(x);
  }
  return m;
}
function hashInt(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return Math.abs(h) % 2000000000;
}
function hashPin(pin) {
  // Einfacher Hash für die App-Sperre (keine Verschlüsselung der Daten!)
  let h1 = 0xdeadbeef ^ 7, h2 = 0x41c6ce57 ^ 7;
  const s = 'schulorga:' + pin;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}
function initials(name) {
  return String(name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
}
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function plural(n, one, many) { return `${n} ${n === 1 ? one : many}`; }

// ------------------------------------------------------------------ Datum
const WD = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
const WDS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const MONTHS_S = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

let _testNow = null; // nur für Tests
const now = () => (_testNow ? new Date(_testNow) : new Date());
const iso = (d = now()) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const today = () => iso(now());
function pd(s) {
  if (!s) return null;
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function addDays(s, n) { const d = pd(s); d.setDate(d.getDate() + n); return iso(d); }
function addMonths(s, n) { const d = pd(s); d.setDate(1); d.setMonth(d.getMonth() + n); return iso(d); }
function addMonthsKeep(s, n) {
  const d = pd(s);
  const day = d.getDate();
  d.setDate(1); d.setMonth(d.getMonth() + n);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return iso(d);
}
const dow = (s) => (pd(s).getDay() + 6) % 7; // 0 = Montag
const weekStart = (s) => addDays(s, -dow(s));
function daysBetween(a, b) { return Math.round((pd(b) - pd(a)) / 86400000); }
function fmtD(s) { if (!s) return ''; const d = pd(s); return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()}`; }
function fmtDS(s) { if (!s) return ''; const d = pd(s); return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.`; }
function fmtDW(s) { if (!s) return ''; return `${WDS[dow(s)]}, ${fmtDS(s)}`; }
function fmtDL(s) { if (!s) return ''; const d = pd(s); return `${WD[dow(s)]}, ${d.getDate()}. ${MONTHS[d.getMonth()]} ${d.getFullYear()}`; }
function fmtDM(s) { if (!s) return ''; const d = pd(s); return `${d.getDate()}. ${MONTHS[d.getMonth()]}`; }
function relDay(s) {
  if (!s) return '';
  const n = daysBetween(today(), s);
  if (n === 0) return 'Heute';
  if (n === 1) return 'Morgen';
  if (n === 2) return 'Übermorgen';
  if (n === -1) return 'Gestern';
  if (n > 0 && n < 7) return WD[dow(s)];
  if (n > 0) return `in ${n} Tagen`;
  return `vor ${-n} Tagen`;
}
function isoWeek(s) {
  const d = pd(s);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const w1 = new Date(d.getFullYear(), 0, 4);
  return 1 + Math.round(((d - w1) / 86400000 - 3 + ((w1.getDay() + 6) % 7)) / 7);
}
const tmin = (t) => { if (!t) return null; const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const mint = (m) => `${pad2(Math.floor(m / 60) % 24)}:${pad2(m % 60)}`;
const nowMin = () => { const d = now(); return d.getHours() * 60 + d.getMinutes(); };
function age(bday, at = today()) {
  if (!bday) return null;
  const b = pd(bday), a = pd(at);
  let y = a.getFullYear() - b.getFullYear();
  if (a.getMonth() < b.getMonth() || (a.getMonth() === b.getMonth() && a.getDate() < b.getDate())) y--;
  return y;
}
/** Nächster Geburtstag (ISO) ab Datum */
function nextBirthday(bday, from = today()) {
  if (!bday) return null;
  const b = pd(bday), f = pd(from);
  let n = new Date(f.getFullYear(), b.getMonth(), b.getDate());
  if (n < f) n = new Date(f.getFullYear() + 1, b.getMonth(), b.getDate());
  return iso(n);
}
function inRange(d, a, b) { return (!a || d >= a) && (!b || d <= b); }
function dateTimeMs(date, time) { const d = pd(date); if (time) { const [h, m] = time.split(':').map(Number); d.setHours(h, m, 0, 0); } return d.getTime(); }

// ------------------------------------------------------------------ Native Brücke
const Native = {
  has: typeof window.Android !== 'undefined',
  call(name, ...args) {
    if (!this.has || typeof window.Android[name] !== 'function') return null;
    try { return window.Android[name](...args); } catch (e) { console.warn('Native', name, e); return null; }
  },
};

// ------------------------------------------------------------------ Konstanten
// Farbthemen (Verlauf von a nach b)
const THEMES = [
  { v: 'indigo', l: 'Indigo', a: '#4f46e5', b: '#8b5cf6' },
  { v: 'ozean', l: 'Ozean', a: '#0369a1', b: '#06b6d4' },
  { v: 'smaragd', l: 'Smaragd', a: '#047857', b: '#22c55e' },
  { v: 'sonne', l: 'Sonnenuntergang', a: '#ea580c', b: '#f43f5e' },
  { v: 'beere', l: 'Beere', a: '#be185d', b: '#a855f7' },
  { v: 'nacht', l: 'Mitternacht', a: '#1e3a8a', b: '#7c3aed' },
  { v: 'koralle', l: 'Koralle', a: '#e11d48', b: '#fb923c' },
  { v: 'graphit', l: 'Graphit', a: '#334155', b: '#64748b' },
];
const COLORS = ['#4f46e5', '#2563eb', '#0891b2', '#0d9488', '#16a34a', '#65a30d', '#ca8a04', '#ea580c', '#dc2626', '#db2777', '#9333ea', '#64748b'];
const NOTE_COLORS = ['', '#fde68a', '#bbf7d0', '#bfdbfe', '#fbcfe8', '#ddd6fe', '#fed7aa', '#e5e7eb'];

const EVENT_TYPES = {
  termin: { l: 'Termin', c: '#2563eb', i: 'calendar' },
  konferenz: { l: 'Konferenz', c: '#9333ea', i: 'users' },
  elternabend: { l: 'Elternabend', c: '#db2777', i: 'handshake' },
  sprechtag: { l: 'Elternsprechtag', c: '#e11d48', i: 'messages-square' },
  ausflug: { l: 'Ausflug / Wandertag', c: '#16a34a', i: 'bus' },
  fortbildung: { l: 'Fortbildung', c: '#0891b2', i: 'lightbulb' },
  aufsicht: { l: 'Aufsicht', c: '#ca8a04', i: 'eye' },
  ferien: { l: 'Ferien', c: '#0d9488', i: 'umbrella' },
  feiertag: { l: 'Feiertag / unterrichtsfrei', c: '#ea580c', i: 'flag' },
  frist: { l: 'Frist / Abgabe', c: '#dc2626', i: 'alarm-clock' },
  sonstiges: { l: 'Sonstiges', c: '#64748b', i: 'bookmark' },
};

const OBS_KINDS = {
  plus: { l: 'Mitarbeit +', s: '+', c: '#16a34a', i: 'thumbs-up' },
  minus: { l: 'Mitarbeit –', s: '–', c: '#dc2626', i: 'thumbs-down' },
  ha: { l: 'Hausaufgabe vergessen', s: 'HA', c: '#ea580c', i: 'book-open' },
  mat: { l: 'Material vergessen', s: 'M', c: '#ca8a04', i: 'backpack' },
  stoer: { l: 'Unterrichtsstörung', s: 'St', c: '#be123c', i: 'megaphone' },
  lob: { l: 'Lob / besondere Leistung', s: '★', c: '#7c3aed', i: 'star' },
  note: { l: 'Notiz / Beobachtung', s: 'i', c: '#2563eb', i: 'info' },
};

const ATT_STATES = {
  f: { l: 'Fehlt (unentschuldigt)', s: 'U', c: '#dc2626' },
  e: { l: 'Fehlt (entschuldigt)', s: 'E', c: '#ea580c' },
  v: { l: 'Verspätet', s: 'V', c: '#ca8a04' },
  b: { l: 'Beurlaubt / Schulveranstaltung', s: 'B', c: '#0891b2' },
};

const CHANGE_TYPES = {
  ausfall: { l: 'Ausfall', c: '#dc2626', i: 'ban' },
  vertretung: { l: 'Vertretung (ich vertrete)', c: '#9333ea', i: 'replace' },
  raum: { l: 'Raumänderung', c: '#0891b2', i: 'door-open' },
  verlegung: { l: 'Verlegung / Tausch', c: '#ca8a04', i: 'arrow-right-left' },
  zusatz: { l: 'Zusatztermin', c: '#16a34a', i: 'plus' },
};

const TALK_KINDS = { gespraech: 'Gespräch', telefon: 'Telefonat', email: 'E-Mail', brief: 'Brief / Mitteilung', hausbesuch: 'Hausbesuch', sonstiges: 'Sonstiges' };
const TASK_CATS = ['Korrektur', 'Vorbereitung', 'Verwaltung', 'Kommunikation', 'Klassenleitung', 'Privat', 'Sonstiges'];
const LESSON_STATUS = { geplant: 'Geplant', gehalten: 'Gehalten', ausgefallen: 'Ausgefallen', vertreten: 'Vertreten' };

// ------------------------------------------------------------------ Datenspeicher
let S = null;
const DATA_VERSION = 3;
const DEFAULT_SCHOOL = 'Astrid Lindgren Schule';

function defaultPeriods() {
  return [
    { s: '08:00', e: '08:45' }, { s: '08:50', e: '09:35' }, { s: '09:55', e: '10:40' }, { s: '10:45', e: '11:30' },
    { s: '11:50', e: '12:35' }, { s: '12:40', e: '13:25' }, { s: '14:00', e: '14:45' }, { s: '14:50', e: '15:35' },
  ];
}
function schoolYearDefaults(at = today()) {
  const d = pd(at);
  const y = d.getMonth() >= 7 ? d.getFullYear() : d.getFullYear() - 1;
  return { year: `${y}/${String(y + 1).slice(2)}`, yearStart: `${y}-08-01`, hj2: `${y + 1}-02-01`, yearEnd: `${y + 1}-07-31` };
}
function defaultData() {
  const sy = schoolYearDefaults();
  return {
    version: DATA_VERSION,
    created: new Date().toISOString(),
    settings: {
      teacher: '', title: '', school: DEFAULT_SCHOOL, ...sy,
      gradeSystem: 'noten', tendencies: true,
      keyNoten: [{ g: 1, min: 92 }, { g: 2, min: 81 }, { g: 3, min: 67 }, { g: 4, min: 50 }, { g: 5, min: 30 }, { g: 6, min: 0 }],
      keyPunkte: [95, 90, 85, 80, 75, 70, 65, 60, 55, 50, 45, 40, 33, 27, 20, 0],
      periods: defaultPeriods(), days: 5, abWeeks: false, abRef: weekStart(today()),
      theme: 'auto', accent: '#4f46e5', fontScale: 1,
      pin: null, secure: false,
      remind: { on: true, examDays: 1, time: '18:00', examMorning: true, lessons: true, lessonMin: 5, lessonEnd: false, lessonEndMin: 5, events: true, eventStart: true, eventEnd: true, tasks: true, taskTime: '07:30', homework: true, birthdays: true, holidays: true, briefing: true, briefingTime: '06:45', followUps: true },
      onboarded: false, lastBackup: null, startTab: '/today',
    },
    subjects: [],
    classes: [],
    students: [],
    timetable: [],
    lessons: [],
    units: [],
    attendance: [],
    categories: [
      { id: 'cat-ka', name: 'Klassenarbeit / Klausur', weight: 50, exam: true, color: '#dc2626' },
      { id: 'cat-test', name: 'Test / Lernkontrolle', weight: 15, exam: true, color: '#ea580c' },
      { id: 'cat-muendl', name: 'Mündlich / Mitarbeit', weight: 25, exam: false, color: '#16a34a' },
      { id: 'cat-sonst', name: 'Sonstige Leistung (Referat, Projekt, HA)', weight: 10, exam: false, color: '#2563eb' },
    ],
    assessments: [],
    homework: [],
    tasks: [],
    events: [],
    notes: [],
    observations: [],
    talks: [],
    changes: [],
    seating: {},
    pickHistory: {},
    team: null,
    leader: null,
  };
}

const Store = {
  key: 'schulorga-data',
  _listeners: [],
  load() {
    let raw = null;
    if (Native.has) raw = Native.call('loadData');
    if (!raw) { try { raw = localStorage.getItem(this.key); } catch (e) { raw = null; } }
    let data = null;
    if (raw) { try { data = JSON.parse(raw); } catch (e) { console.error('Daten defekt', e); } }
    S = this.migrate(data || defaultData());
    return S;
  },
  migrate(d) {
    const def = defaultData();
    for (const k of Object.keys(def)) if (d[k] === undefined) d[k] = def[k];
    const oldVersion = d.version || 1;
    d.settings = { ...def.settings, ...d.settings, remind: { ...def.settings.remind, ...(d.settings || {}).remind } };
    if (oldVersion < 2 && !d.settings.school) d.settings.school = DEFAULT_SCHOOL;
    if (oldVersion < 3) { d.settings.remind.on = true; d.settings.remind.lessons = true; }
    if (d.team) {
      const t = d.team;
      ['acks', 'absences', 'posts', 'subs', 'classes', 'members', 'duties', 'rooms', 'bookings', 'polls', 'votes'].forEach((k) => { if (!Array.isArray(t[k])) t[k] = []; });
      ['delSig', 'removed', 'deleted'].forEach((k) => { if (!t[k] || typeof t[k] !== 'object') t[k] = {}; });
    }
    d.version = DATA_VERSION;
    return d;
  },
  serialize() { return JSON.stringify(S); },
  _write() {
    const json = this.serialize();
    let ok = false;
    if (Native.has) ok = !!Native.call('saveData', json);
    if (!ok) { try { localStorage.setItem(this.key, json); ok = true; } catch (e) { console.error(e); } }
    if (!ok && typeof UI !== 'undefined') UI.toast('Speichern fehlgeschlagen!', { type: 'err' });
    this._listeners.forEach((f) => f());
  },
  save: null,
  replace(data) {
    S = this.migrate(data);
    this.save.flush();
  },
  onSave(fn) { this._listeners.push(fn); },
};
Store.save = debounce(() => Store._write(), 250);
const save = () => Store.save();

// ------------------------------------------------------------------ Entitäten
const byId = (coll, id) => (id ? S[coll].find((x) => x.id === id) : null);
const cls = (id) => byId('classes', id);
const stu = (id) => byId('students', id);
const subj = (id) => byId('subjects', id);
const cat = (id) => byId('categories', id);
function removeById(coll, id) { const i = S[coll].findIndex((x) => x.id === id); if (i >= 0) return S[coll].splice(i, 1)[0]; return null; }
function upsert(coll, obj) {
  if (!obj.id) obj.id = uid();
  const i = S[coll].findIndex((x) => x.id === obj.id);
  if (i >= 0) { S[coll][i] = { ...S[coll][i], ...obj }; return S[coll][i]; }
  S[coll].push(obj);
  return obj;
}
const activeClasses = () => S.classes.filter((c) => !c.archived).sort((a, b) => cmpStr(a.name, b.name));
const studentsOf = (classId) => S.students.filter((s) => s.classId === classId)
  .sort((a, b) => cmpStr(a.lastName, b.lastName) || cmpStr(a.firstName, b.firstName));
const sName = (s) => (s ? `${s.firstName || ''} ${s.lastName || ''}`.trim() : '–');
const sNameRev = (s) => (s ? (s.lastName ? `${s.lastName}, ${s.firstName || ''}` : s.firstName || '') : '–');
const sShort = (s) => (s ? `${s.firstName || ''} ${s.lastName ? s.lastName[0] + '.' : ''}`.trim() : '–');
const cName = (id) => (cls(id) ? cls(id).name : '–');
const subName = (id) => (subj(id) ? subj(id).name : '');
const subShort = (id) => (subj(id) ? (subj(id).short || subj(id).name.slice(0, 3)) : '');
function classColor(c) {
  if (!c) return '#64748b';
  return c.color || (c.subjects && subj(c.subjects[0]) ? subj(c.subjects[0]).color : null) || '#64748b';
}
function subjectColor(id, fallbackClassId) {
  const s = subj(id);
  if (s && s.color) return s.color;
  return classColor(cls(fallbackClassId));
}
const subjectsOf = (classId) => { const c = cls(classId); return c ? (c.subjects || []).map(subj).filter(Boolean) : []; };
function classOptions(withEmpty) {
  const o = activeClasses().map((c) => ({ v: c.id, l: c.name }));
  return withEmpty ? [{ v: '', l: withEmpty === true ? '– keine –' : withEmpty }, ...o] : o;
}
function subjectOptions(withEmpty) {
  const o = [...S.subjects].sort((a, b) => cmpStr(a.name, b.name)).map((s) => ({ v: s.id, l: s.name }));
  return withEmpty ? [{ v: '', l: withEmpty === true ? '– kein Fach –' : withEmpty }, ...o] : o;
}

// ------------------------------------------------------------------ Schuljahr / Halbjahr
function termRange(term) {
  const st = S.settings;
  if (term === '1') return [st.yearStart, addDays(st.hj2, -1)];
  if (term === '2') return [st.hj2, st.yearEnd];
  if (term === 'all') return [null, null];
  return [st.yearStart, st.yearEnd];
}
function currentTerm() { return today() >= S.settings.hj2 ? '2' : '1'; }

// ------------------------------------------------------------------ Ferien / Stundenplan
function holidayOn(date) {
  return S.events.find((e) => (e.type === 'ferien' || e.type === 'feiertag') && date >= e.date && date <= (e.end || e.date)) || null;
}
function weekType(date) {
  if (!S.settings.abWeeks) return null;
  const diff = Math.round(daysBetween(weekStart(S.settings.abRef), weekStart(date)) / 7);
  return ((diff % 2) + 2) % 2 === 0 ? 'A' : 'B';
}
function periodTime(p) { return S.settings.periods[p] || null; }
/** Stundenplan-Einträge an einem Datum inkl. Änderungen */
function lessonsOn(date) {
  const d = dow(date);
  if (d >= S.settings.days) return [];
  const wt = weekType(date);
  const hol = holidayOn(date);
  let list = S.timetable.filter((t) => t.day === d && (!t.week || t.week === 'all' || !wt || t.week === wt))
    .map((t) => ({ ...t, date, src: 'tt' }));
  const changes = S.changes.filter((c) => c.date === date);
  for (const ch of changes) {
    if (ch.type === 'ausfall' || ch.type === 'raum' || ch.type === 'verlegung') {
      const l = list.find((x) => x.period === ch.period && (!ch.classId || x.classId === ch.classId));
      if (l) {
        if (ch.type === 'ausfall') l.cancelled = ch;
        if (ch.type === 'raum') { l.roomChange = ch.room; l.change = ch; }
        if (ch.type === 'verlegung') { l.cancelled = ch; }
      }
    }
  }
  for (const ch of S.changes) {
    if ((ch.type === 'vertretung' || ch.type === 'zusatz') && ch.date === date) {
      list.push({ id: 'ch-' + ch.id, day: d, period: ch.period, classId: ch.classId, subjectId: ch.subjectId, room: ch.room, date, src: 'change', change: ch, extra: true });
    }
    if (ch.type === 'verlegung' && ch.toDate === date && ch.toPeriod != null) {
      const orig = S.timetable.find((t) => t.day === dow(ch.date) && t.period === ch.period && (!ch.classId || t.classId === ch.classId));
      list.push({ id: 'mv-' + ch.id, day: d, period: ch.toPeriod, classId: ch.classId || (orig && orig.classId), subjectId: ch.subjectId || (orig && orig.subjectId), room: ch.room || (orig && orig.room), date, src: 'change', change: ch, extra: true });
    }
  }
  // Vertretungen aus dem Schulteam
  if (S.team && S.team.id) {
    const me = S.team.me;
    S.team.subs.filter((x) => x.date === date).forEach((x) => {
      if (x.sub === me) {
        const lc = S.classes.find((c) => c.name.toLowerCase() === String(x.className || '').toLowerCase());
        list.push({ id: 'ts-' + x.id, day: d, period: Number(x.period), classId: lc ? lc.id : '', subjectId: '', room: x.room, date, src: 'team', extra: true, teamSub: x,
          change: { type: 'vertretung', note: `Vertretung ${x.className || ''}${x.subject ? ' · ' + x.subject : ''}${x.absent ? ' für ' + teamMemberName(x.absent, true) : ''}` } });
      }
      if (x.absent === me) {
        const l = list.find((y) => y.period === Number(x.period) && !y.extra);
        if (l) { l.cancelled = { id: 'ts-' + x.id, note: x.sub ? `Vertretung durch ${teamMemberName(x.sub)}` : 'Du bist als abwesend eingetragen' }; l.teamSub = x; }
      }
    });
  }
  if (hol) list.forEach((l) => { l.holiday = hol; });
  return list.sort((a, b) => a.period - b.period);
}
function lessonAt(date, period) {
  return lessonsOn(date).find((l) => l.period === period) || null;
}
/** Nächste Stunde einer Klasse nach einem Datum (für Hausaufgaben-Fälligkeit) */
function nextLessonDate(classId, after, subjectId) {
  for (let i = 1; i <= 28; i++) {
    const d = addDays(after, i);
    if (holidayOn(d)) continue;
    const l = lessonsOn(d).find((x) => x.classId === classId && !x.cancelled && (!subjectId || !x.subjectId || x.subjectId === subjectId));
    if (l) return d;
  }
  return addDays(after, 7);
}
function prevLessonEntry(classId, before, subjectId) {
  return sortBy(S.lessons.filter((l) => l.classId === classId && l.date < before && (!subjectId || !l.subjectId || l.subjectId === subjectId) && (l.topic || l.content)), (l) => l.date + pad2(l.period ?? 0)).pop() || null;
}
function lessonEntry(classId, date, period) {
  return S.lessons.find((l) => l.classId === classId && l.date === date && (l.period ?? null) === (period ?? null))
    || S.lessons.find((l) => l.classId === classId && l.date === date && period != null && l.period == null) || null;
}

// ------------------------------------------------------------------ Noten
const GRADE_SYSTEMS = {
  noten: {
    id: 'noten', label: 'Noten 1–6', min: 0.7, max: 6, low: true,
    buttons: ['1+', '1', '1-', '2+', '2', '2-', '3+', '3', '3-', '4+', '4', '4-', '5+', '5', '5-', '6'],
    parse(str) {
      if (str == null) return null;
      let t = String(str).trim().replace(/\s/g, '').replace(',', '.').replace('–', '-');
      if (!t) return null;
      let m = t.match(/^([1-6])([+-]?)$/);
      if (m) {
        const n = Number(m[1]);
        if (m[2] === '+') return n === 1 ? 0.7 : n - 0.3;
        if (m[2] === '-') return n === 6 ? 6 : n + 0.3;
        return n;
      }
      m = t.match(/^([1-5])-([2-6])$/); // z. B. 2-3
      if (m && Number(m[2]) === Number(m[1]) + 1) return Number(m[1]) + 0.5;
      const n = Number(t);
      if (!isNaN(n) && n >= 0.7 && n <= 6) return n;
      return null;
    },
    format(v) {
      if (v == null) return '';
      const r = Math.round(v);
      const diff = round(v - r, 2);
      if (Math.abs(diff) < 0.02) return String(r);
      if (Math.abs(diff + 0.3) < 0.02) return r + '+';
      if (Math.abs(diff - 0.3) < 0.02) return r + '-';
      if (Math.abs(v - Math.floor(v) - 0.5) < 0.02) return `${Math.floor(v)}-${Math.floor(v) + 1}`;
      return fmtNumShort(v, 2);
    },
    level(v) { if (v == null) return 0; if (v < 1.5) return 1; if (v < 2.5) return 2; if (v < 3.5) return 3; if (v < 4.5) return 4; if (v < 5.5) return 5; return 6; },
    whole(v) { return clamp(Math.round(v), 1, 6); },
    buckets: [1, 2, 3, 4, 5, 6],
    failing(v) { return v != null && v >= 4.5; },
  },
  punkte: {
    id: 'punkte', label: 'Punkte 0–15', min: 0, max: 15, low: false,
    buttons: ['15', '14', '13', '12', '11', '10', '9', '8', '7', '6', '5', '4', '3', '2', '1', '0'],
    parse(str) {
      if (str == null) return null;
      const t = String(str).trim().replace(',', '.');
      if (!t) return null;
      const n = Number(t);
      if (!isNaN(n) && n >= 0 && n <= 15) return n;
      return null;
    },
    format(v) { if (v == null) return ''; return Number.isInteger(v) ? String(v) : fmtNumShort(v, 1); },
    level(v) { if (v == null) return 0; if (v >= 12.5) return 1; if (v >= 9.5) return 2; if (v >= 6.5) return 3; if (v >= 3.5) return 4; if (v >= 0.5) return 5; return 6; },
    whole(v) { return clamp(Math.round(v), 0, 15); },
    buckets: [15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
    failing(v) { return v != null && v < 4.5; },
  },
};
const LEVEL_COLORS = ['var(--muted)', '#15803d', '#4d7c0f', '#a16207', '#c2410c', '#dc2626', '#991b1b'];
function gsOf(classId) {
  const c = cls(classId);
  return GRADE_SYSTEMS[(c && c.gradeSystem) || S.settings.gradeSystem] || GRADE_SYSTEMS.noten;
}
function gradeColor(gs, v) { return LEVEL_COLORS[gs.level(v)]; }
function gradeBadge(gs, v, extra = '') {
  if (v == null) return '<span class="gb gb-empty">–</span>';
  return `<span class="gb gb-l${gs.level(v)} ${extra}">${esc(gs.format(v))}</span>`;
}
function avgBadge(gs, v) {
  if (v == null) return '<span class="gb gb-empty">–</span>';
  return `<span class="gb gb-l${gs.level(v)}">${fmtNum(v, gs.id === 'punkte' ? 1 : 2)}</span>`;
}

/** Note aus Prozent nach Notenschlüssel */
function gradeFromPercent(gs, pct, key) {
  const st = S.settings;
  if (gs.id === 'punkte') {
    const k = key || st.keyPunkte;
    for (let i = 0; i < k.length; i++) if (pct >= k[i] - 1e-9) return 15 - i;
    return 0;
  }
  const k = key || st.keyNoten;
  const sorted = [...k].sort((a, b) => a.g - b.g);
  for (let i = 0; i < sorted.length; i++) {
    const row = sorted[i];
    if (pct >= row.min - 1e-9) {
      const g = row.g;
      if (!st.tendencies || g === 6) return g;
      const upper = i === 0 ? 100 : sorted[i - 1].min;
      const span = upper - row.min;
      if (span <= 0) return g;
      const pos = (pct - row.min) / span;
      if (pos >= 2 / 3) return g === 1 ? 0.7 : g - 0.3;
      if (pos < 1 / 3) return g + 0.3;
      return g;
    }
  }
  return 6;
}
/** Punktgrenzen für eine Klassenarbeit */
function keyTable(gs, maxPoints, key, step = 0.5) {
  const rows = [];
  const st = S.settings;
  const roundUp = (x) => Math.ceil(x / step - 1e-9) * step;
  if (gs.id === 'punkte') {
    const k = key || st.keyPunkte;
    for (let i = 0; i < k.length; i++) {
      const from = roundUp((k[i] / 100) * maxPoints);
      const to = i === 0 ? maxPoints : roundUp((k[i - 1] / 100) * maxPoints) - step;
      rows.push({ grade: String(15 - i), from, to, pct: k[i] });
    }
    return rows;
  }
  const sorted = [...(key || st.keyNoten)].sort((a, b) => a.g - b.g);
  sorted.forEach((r, i) => {
    const from = roundUp((r.min / 100) * maxPoints);
    const to = i === 0 ? maxPoints : roundUp((sorted[i - 1].min / 100) * maxPoints) - step;
    rows.push({ grade: String(r.g), from, to, pct: r.min });
  });
  return rows;
}
function assessmentGrade(a, sid) {
  const g = a.grades && a.grades[sid];
  if (!g) return null;
  if (g.v != null) return g.v;
  return null;
}
function assessmentsOf(classId, { subjectId, from, to } = {}) {
  return S.assessments.filter((a) => a.classId === classId && (!subjectId || a.subjectId === subjectId)
    && (a.date ? inRange(a.date, from, to) : true));
}
function catWeight(c, classId) {
  const k = cls(classId);
  if (k && k.catWeights && k.catWeights[c.id] != null && k.catWeights[c.id] !== '') return Number(k.catWeights[c.id]);
  return Number(c.weight) || 0;
}
/** Gewichteter Durchschnitt eines Schülers */
function studentAverage(sid, classId, opts = {}) {
  const list = assessmentsOf(classId, opts);
  const byCat = {};
  for (const a of list) {
    const v = assessmentGrade(a, sid);
    if (v == null) continue;
    const w = Number(a.weight) || 1;
    (byCat[a.catId] = byCat[a.catId] || { s: 0, w: 0, n: 0 });
    byCat[a.catId].s += v * w; byCat[a.catId].w += w; byCat[a.catId].n++;
  }
  let tot = 0, tw = 0, n = 0;
  const cats = {};
  for (const [cid, o] of Object.entries(byCat)) {
    const c = cat(cid) || { id: cid, weight: 1 };
    const cav = o.s / o.w;
    cats[cid] = { avg: cav, n: o.n };
    const w = catWeight(c, classId);
    tot += cav * w; tw += w; n += o.n;
  }
  // Falls alle Gewichte 0: einfacher Mittelwert
  if (tw === 0 && Object.keys(cats).length) {
    const vals = Object.values(cats).map((x) => x.avg);
    return { avg: avg(vals), cats, n };
  }
  return { avg: tw ? tot / tw : null, cats, n };
}
function assessmentStats(a) {
  const gs = gsOf(a.classId);
  const vals = studentsOf(a.classId).map((s) => assessmentGrade(a, s.id)).filter((v) => v != null);
  const dist = {};
  gs.buckets.forEach((b) => { dist[b] = 0; });
  vals.forEach((v) => { dist[gs.whole(v)] = (dist[gs.whole(v)] || 0) + 1; });
  const failing = vals.filter((v) => gs.failing(v)).length;
  return { gs, vals, n: vals.length, avg: avg(vals), dist, failing, best: vals.length ? (gs.low ? Math.min(...vals) : Math.max(...vals)) : null, worst: vals.length ? (gs.low ? Math.max(...vals) : Math.min(...vals)) : null };
}

// ------------------------------------------------------------------ Anwesenheit
function attRecord(classId, date, period) {
  return S.attendance.find((r) => r.classId === classId && r.date === date && (r.period ?? null) === (period ?? null)) || null;
}
function attStats(sid, opts = {}) {
  const s = stu(sid);
  if (!s) return { recs: 0, f: 0, e: 0, v: 0, b: 0, absent: 0, pct: null, minutes: 0 };
  const recs = S.attendance.filter((r) => r.classId === s.classId && inRange(r.date, opts.from, opts.to));
  const out = { recs: recs.length, f: 0, e: 0, v: 0, b: 0, minutes: 0 };
  for (const r of recs) {
    const e = r.e && r.e[sid];
    if (!e) continue;
    out[e.s] = (out[e.s] || 0) + 1;
    if (e.s === 'v' && e.m) out.minutes += Number(e.m) || 0;
  }
  out.absent = out.f + out.e;
  out.pct = out.recs ? (100 * (out.recs - out.absent)) / out.recs : null;
  return out;
}
function absentOn(classId, date) {
  const ids = new Set();
  S.attendance.filter((r) => r.classId === classId && r.date === date).forEach((r) => {
    Object.entries(r.e || {}).forEach(([sid, e]) => { if (e.s === 'f' || e.s === 'e' || e.s === 'b') ids.add(sid); });
  });
  return ids;
}

// ------------------------------------------------------------------ Beobachtungen
function obsCounts(sid, opts = {}) {
  const out = {};
  Object.keys(OBS_KINDS).forEach((k) => { out[k] = 0; });
  S.observations.filter((o) => o.studentId === sid && inRange(o.date, opts.from, opts.to)).forEach((o) => { out[o.kind] = (out[o.kind] || 0) + 1; });
  return out;
}

// ------------------------------------------------------------------ CSV
function toCSV(rows) {
  const q = (v) => {
    const s = v == null ? '' : String(v);
    return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return '﻿' + rows.map((r) => r.map(q).join(';')).join('\r\n');
}
function parseCSV(text) {
  text = text.replace(/^﻿/, '');
  const firstLine = text.split(/\r?\n/)[0] || '';
  const sep = (firstLine.match(/;/g) || []).length >= (firstLine.match(/,/g) || []).length ? (firstLine.includes(';') ? ';' : (firstLine.includes('\t') ? '\t' : ',')) : ',';
  const rows = [];
  let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c;
    } else if (c === '"') q = true;
    else if (c === sep) { row.push(cur); cur = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cur); rows.push(row); row = []; cur = '';
    } else cur += c;
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim() !== ''));
}
