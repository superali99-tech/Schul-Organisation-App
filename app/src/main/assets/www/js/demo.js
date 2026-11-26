/* Beispieldaten & Ersteinrichtung */
'use strict';

function buildDemoData() {
  const d = defaultData();
  const prev = S;
  S = d; // Hilfsfunktionen (Stundenplan, Notenschlüssel) arbeiten auf den neuen Daten
  try { fillDemo(d); } finally { S = prev; }
  return d;
}
function fillDemo(d) {
  const td = today();
  const ws = weekStart(td);
  d.settings = { ...d.settings, teacher: 'Schneider', title: 'Frau', school: 'Goethe-Gymnasium', onboarded: true, lastBackup: new Date().toISOString() };
  const sub = (name, short, color) => { const s = { id: uid(), name, short, color }; d.subjects.push(s); return s; };
  const M = sub('Mathematik', 'M', '#2563eb');
  const P = sub('Physik', 'Ph', '#0891b2');
  const I = sub('Informatik', 'If', '#9333ea');
  const mk = (name, subjects, room, isOwn, gradeSystem = '') => { const c = { id: uid(), name, subjects: subjects.map((s) => s.id), room, color: '', isOwn, gradeSystem, archived: false, catWeights: {}, notes: '' }; d.classes.push(c); return c; };
  const c7a = mk('7a', [M, P], '204', true);
  const c9b = mk('9b', [M], '112', false);
  const cQ1 = mk('Q1 Mathe LK', [M], '301', false, 'punkte');
  const c6c = mk('6c', [I], 'PC-Raum', false);
  const first = ['Mia', 'Ben', 'Emma', 'Paul', 'Hannah', 'Leon', 'Sophia', 'Finn', 'Lea', 'Jonas', 'Marie', 'Elias', 'Lina', 'Noah', 'Clara', 'Luca', 'Ella', 'Felix', 'Emilia', 'Anton', 'Lena', 'Maximilian', 'Amelie', 'David', 'Johanna', 'Tim', 'Ida', 'Moritz'];
  const gender = ['w', 'm', 'w', 'm', 'w', 'm', 'w', 'm', 'w', 'm', 'w', 'm', 'w', 'm', 'w', 'm', 'w', 'm', 'w', 'm', 'w', 'm', 'w', 'm', 'w', 'm', 'w', 'm'];
  const last = ['Müller', 'Schmidt', 'Schneider', 'Fischer', 'Weber', 'Meyer', 'Wagner', 'Becker', 'Schulz', 'Hoffmann', 'Koch', 'Bauer', 'Richter', 'Klein', 'Wolf', 'Schröder', 'Neumann', 'Schwarz', 'Zimmermann', 'Braun', 'Krüger', 'Hofmann', 'Hartmann', 'Lange', 'Schmitt', 'Werner', 'Krause', 'Meier'];
  const tags = ['', '', '', '', 'LRS', '', '', 'Nachteilsausgleich', '', '', '', 'Allergie (Nüsse)', '', '', '', '', '', 'Förderbedarf Lernen', '', '', '', '', '', '', '', '', '', ''];
  const addStudents = (c, n, offset, birthYear) => {
    for (let i = 0; i < n; i++) {
      const k = (i + offset) % first.length;
      const by = birthYear + (i % 3 === 0 ? -1 : 0);
      const bd = `${by}-${pad2(((i * 5 + offset) % 12) + 1)}-${pad2(((i * 7 + offset) % 27) + 1)}`;
      d.students.push({
        id: uid(), classId: c.id, firstName: first[k], lastName: last[(i * 3 + offset) % last.length], gender: gender[k], birthday: bd,
        parentName: `Fam. ${last[(i * 3 + offset) % last.length]}`, parentPhone: `0151 ${String(2000000 + i * 1373 + offset * 7).slice(0, 7)}`,
        parentEmail: `${last[(i * 3 + offset) % last.length].toLowerCase().replace(/[äöüß]/g, (x) => ({ ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss' }[x]))}@beispiel.de`,
        tags: tags[(i + offset) % tags.length], notes: '',
      });
    }
  };
  const yr = Number(td.slice(0, 4));
  addStudents(c7a, 26, 0, yr - 13);
  addStudents(c9b, 24, 5, yr - 15);
  addStudents(cQ1, 18, 11, yr - 17);
  addStudents(c6c, 22, 3, yr - 12);
  // Geburtstag in den nächsten Tagen
  const sb = d.students[2];
  sb.birthday = `${yr - 13}-${addDays(td, 2).slice(5)}`;

  // Stundenplan
  const tt = (day, period, c, s, room) => d.timetable.push({ id: uid(), day, period, classId: c ? c.id : '', subjectId: s ? s.id : '', room: room || (c ? c.room : ''), week: 'all', note: c ? '' : 'Pausenaufsicht' });
  [[0, 0, c7a, M], [0, 1, c7a, M], [0, 3, cQ1, M], [0, 4, cQ1, M], [1, 1, c9b, M], [1, 2, c6c, I], [1, 4, c7a, P],
    [2, 0, cQ1, M], [2, 2, c7a, M], [2, 3, c9b, M], [2, 5, c6c, I], [3, 1, c9b, M], [3, 2, cQ1, M], [3, 3, cQ1, M], [3, 4, c7a, P],
    [4, 0, c7a, M], [4, 2, c9b, M], [4, 3, c6c, I]].forEach(([a, b, c, s]) => tt(a, b, c, s));
  d.timetable.push({ id: uid(), day: 1, period: 3, classId: '', subjectId: '', room: 'Schulhof', week: 'all', note: 'Pausenaufsicht' });

  // Leistungsnachweise
  const g7 = d.students.filter((s) => s.classId === c7a.id);
  const g9 = d.students.filter((s) => s.classId === c9b.id);
  const gQ = d.students.filter((s) => s.classId === cQ1.id);
  const rnd = (seed) => { const x = Math.sin(seed * 9301 + 49297) * 233280; return x - Math.floor(x); };
  const notenGrades = ['1', '1-', '2+', '2', '2-', '3+', '3', '3-', '4+', '4', '4-', '5'];
  const addAssess = (c, s, title, date, catId, students, opts = {}) => {
    const a = { id: uid(), classId: c.id, subjectId: s.id, title, date, catId, weight: 1, maxPoints: opts.max || null, grades: {}, notes: opts.notes || '' };
    if (date <= td && !opts.empty) {
      students.forEach((st, i) => {
        const r = Math.pow(rnd(i * 13 + title.length * 7 + (opts.seed || 0)), 1.25);
        if (opts.max) {
          const p = Math.round((0.98 - 0.6 * r) * opts.max * 2) / 2;
          a.grades[st.id] = { p, v: gradeFromPercent(GRADE_SYSTEMS[c.gradeSystem || 'noten'], (100 * p) / opts.max) };
        } else if (c.gradeSystem === 'punkte') {
          a.grades[st.id] = { v: Math.round(15 - r * 11) };
        } else {
          a.grades[st.id] = { v: GRADE_SYSTEMS.noten.parse(notenGrades[Math.floor(r * notenGrades.length)]) };
        }
      });
    }
    d.assessments.push(a);
    return a;
  };
  // Datumshelfer: relativ zu heute, aber nicht vor Schuljahresbeginn
  const rel = (n) => { const x = addDays(td, n); return x < d.settings.yearStart ? addDays(d.settings.yearStart, 10 + Math.abs(n) % 20) : x; };
  addAssess(c7a, M, '1. Klassenarbeit: Rationale Zahlen', rel(-35), 'cat-ka', g7, { max: 48, seed: 1 });
  addAssess(c7a, M, 'Test: Terme', rel(-12), 'cat-test', g7, { seed: 2 });
  addAssess(c7a, M, 'Mündlich Sept./Okt.', rel(-20), 'cat-muendl', g7, { seed: 3 });
  addAssess(c7a, M, '2. Klassenarbeit: Gleichungen', addDays(td, 6), 'cat-ka', g7, { notes: 'Lineare Gleichungen, Termumformungen, Textaufgaben' });
  addAssess(c7a, P, 'Test: Optik', rel(-9), 'cat-test', g7, { seed: 5 });
  addAssess(c9b, M, '1. Klassenarbeit: Quadratische Funktionen', rel(-28), 'cat-ka', g9, { max: 60, seed: 7 });
  addAssess(c9b, M, 'Referat', rel(-15), 'cat-sonst', g9.slice(0, 8), { seed: 8 });
  addAssess(c9b, M, 'Vokabeltest Fachbegriffe', addDays(td, 2), 'cat-test', g9, {});
  addAssess(cQ1, M, '1. Klausur: Analysis', rel(-30), 'cat-ka', gQ, { max: 90, seed: 9 });
  addAssess(cQ1, M, 'Mündliche Note Quartal 1', rel(-6), 'cat-muendl', gQ, { seed: 10 });
  addAssess(cQ1, M, '2. Klausur: Integralrechnung', addDays(td, 13), 'cat-ka', gQ, {});

  // Anwesenheit (letzte Tage)
  for (let i = 1; i <= 10; i++) {
    const day = addDays(td, -i);
    if (dow(day) > 4 || day < d.settings.yearStart) continue;
    const e = {};
    g7.forEach((s, k) => { const r = rnd(k * 31 + i * 17); if (r < 0.05) e[s.id] = { s: 'e' }; else if (r < 0.07) e[s.id] = { s: 'f' }; else if (r < 0.1) e[s.id] = { s: 'v', m: 5 }; });
    d.attendance.push({ id: uid(), classId: c7a.id, date: day, period: null, e });
  }
  // Beobachtungen
  g7.forEach((s, k) => {
    const n = Math.floor(rnd(k * 7) * 6);
    for (let j = 0; j < n; j++) d.observations.push({ id: uid(), studentId: s.id, classId: c7a.id, date: addDays(td, -Math.floor(rnd(k + j) * 20)), kind: rnd(k * 3 + j) > 0.3 ? 'plus' : 'minus', text: '' });
    if (rnd(k * 11) > 0.8) d.observations.push({ id: uid(), studentId: s.id, classId: c7a.id, date: addDays(td, -3), kind: 'ha', text: 'Buch S. 45' });
  });
  d.observations.push({ id: uid(), studentId: g7[4].id, classId: c7a.id, date: addDays(td, -2), kind: 'note', text: 'Wirkt in letzter Zeit unkonzentriert, Gespräch suchen.' });

  // Klassenbuch
  const topics7 = ['Wiederholung: Terme vereinfachen', 'Ausmultiplizieren und Ausklammern', 'Einführung Gleichungen', 'Äquivalenzumformungen', 'Übungsstunde Gleichungen'];
  topics7.forEach((t, i) => d.lessons.push({ id: uid(), classId: c7a.id, subjectId: M.id, date: addDays(td, -(topics7.length - i) * 2 - 1), period: 0, topic: t, content: '', homework: i === 4 ? 'AB Gleichungen Nr. 1–6' : '', status: 'gehalten', unitId: '' }));
  d.units.push({ id: uid(), classId: c7a.id, title: 'Terme und Gleichungen', start: addDays(td, -21), end: addDays(td, 14), lessons: 16, goals: 'Terme aufstellen und umformen, lineare Gleichungen lösen', plan: '', notes: '', color: '' });
  d.units.push({ id: uid(), classId: cQ1.id, title: 'Integralrechnung', start: addDays(td, -7), end: addDays(td, 35), lessons: 20, goals: 'Stammfunktionen, Hauptsatz, Flächenberechnung', plan: '', notes: '', color: '' });

  // Hausaufgaben
  d.homework.push({ id: uid(), classId: c7a.id, subjectId: M.id, title: 'AB Gleichungen Nr. 1–6', desc: '', given: addDays(td, -1), due: nextLessonDate(c7a.id, addDays(td, -1)), done: false });
  d.homework.push({ id: uid(), classId: c9b.id, subjectId: M.id, title: 'Buch S. 112 Nr. 4, 5, 7', desc: '', given: addDays(td, -2), due: addDays(td, 1), done: false });
  d.homework.push({ id: uid(), classId: cQ1.id, subjectId: M.id, title: 'Stammfunktionen Übungsblatt 2', desc: '', given: addDays(td, -3), due: addDays(td, 3), done: false });

  // Aufgaben
  d.tasks.push({ id: uid(), title: 'Klausur Q1 korrigieren', due: addDays(td, 2), prio: 2, cat: 'Korrektur', classId: cQ1.id, done: false, remind: false });
  d.tasks.push({ id: uid(), title: 'Elternbrief Wandertag schreiben', due: td, prio: 1, cat: 'Klassenleitung', classId: c7a.id, done: false });
  d.tasks.push({ id: uid(), title: 'Arbeitsblätter für Optik kopieren', due: addDays(td, 1), prio: 0, cat: 'Vorbereitung', done: false });
  d.tasks.push({ id: uid(), title: 'Noten in Schulverwaltung übertragen', due: addDays(td, 10), prio: 0, cat: 'Verwaltung', done: false });
  d.tasks.push({ id: uid(), title: 'Fachkonferenz vorbereiten', prio: 0, cat: 'Vorbereitung', done: false });

  // Termine
  d.events.push({ id: uid(), title: 'Zeugniskonferenz', type: 'konferenz', date: addDays(td, 9), time: '14:30', place: 'Lehrerzimmer', remind: '60', notes: '' });
  d.events.push({ id: uid(), title: 'Elternabend 7a', type: 'elternabend', date: addDays(td, 4), time: '19:00', place: 'Raum 204', classId: c7a.id, remind: '1440', notes: 'Themen: Wandertag, Klassenfahrt, Handyregeln' });
  d.events.push({ id: uid(), title: 'Wandertag 7a', type: 'ausflug', date: addDays(td, 16), classId: c7a.id, remind: '', notes: 'Ziel: Kletterpark' });
  d.events.push({ id: uid(), title: 'Pausenaufsicht Hof', type: 'aufsicht', date: addDays(td, 1), time: '09:35', endTime: '09:55', remind: '15' });
  d.events.push({ id: uid(), title: 'Weihnachtsferien', type: 'ferien', date: `${yr}-12-23`, end: `${yr + 1}-01-06` });
  // Notizen
  d.notes.push({ id: uid(), title: 'Ideen Projektwoche', body: '- [ ] Escape-Room Mathe\n- [ ] Physik-Experimente Grundschule\n- [x] Raum anfragen', color: '#fde68a', pinned: true, classId: '', updated: new Date().toISOString() });
  d.notes.push({ id: uid(), title: 'Absprache Fachschaft', body: 'Parallelarbeit 9er am gleichen Tag schreiben. Bewertungsraster teilen.', color: '#bfdbfe', pinned: false, classId: c9b.id, updated: new Date().toISOString() });
  // Gespräche
  d.talks.push({ id: uid(), studentId: g7[4].id, date: addDays(td, -14), kind: 'telefon', with: 'Mutter', topic: 'Leistungsabfall in Mathe', notes: 'Familiäre Belastung, Nachhilfe wird organisiert.', agreements: 'Wöchentliche Rückmeldung per Mail.', followUp: addDays(td, 1), followUpDone: false });
  // Vertretung
  d.changes.push({ id: uid(), type: 'vertretung', date: addDays(td, 1), period: 5, classId: c9b.id, subjectId: M.id, room: '115', note: 'für Herrn Weber' });
  // Sitzplan 7a
  const seats = {};
  g7.forEach((s, i) => { const r = Math.floor(i / 6), c = i % 6; if (r < 5) seats[`${r}_${c}`] = s.id; });
  d.seating[c7a.id] = { rows: 5, cols: 6, seats, off: {}, front: 'top' };
}

A['demo-load'] = async () => {
  const hasData = S.classes.length || S.students.length;
  if (hasData && !(await UI.confirm('Beispieldaten laden? <b>Deine aktuellen Daten werden ersetzt.</b> Exportiere vorher eine Sicherung, wenn du sie behalten möchtest.', { danger: true, ok: 'Ersetzen' }))) return;
  UI.closeAll();
  Store.replace(buildDemoData());
  applyTheme();
  App.navigate('/today', { root: true });
  UI.toast('Beispieldaten geladen – schau dich um!');
};

function showOnboarding() {
  const st = S.settings;
  UI.open({
    title: '', noHead: true, cls: 'onboarding',
    body: `<div class="ob"><div class="ob-logo">${icon('graduation-cap')}</div><h2>Willkommen bei SchulOrga</h2>
      <p class="muted">Dein digitaler Lehrerplaner – alles an einem Ort, offline & privat.</p>
      <div class="ob-feat">
        <div>${icon('calendar-days')}Stundenplan</div><div>${icon('users')}Klassen & Schüler</div>
        <div>${icon('award')}Noten & Notenspiegel</div><div>${icon('user-check')}Anwesenheit</div>
        <div>${icon('notebook-pen')}Klassenbuch</div><div>${icon('calendar')}Termine & Ferien</div>
        <div>${icon('shuffle')}Zufall & Gruppen</div><div>${icon('lock')}PIN & Datenschutz</div>
      </div></div>
      <form class="form" onsubmit="return false">
        <div class="frow"><label class="field"><span>Anrede</span><select name="title"><option value="">–</option><option ${st.title === 'Frau' ? 'selected' : ''}>Frau</option><option ${st.title === 'Herr' ? 'selected' : ''}>Herr</option></select></label>
        <label class="field"><span>Dein Name</span><input name="teacher" placeholder="z. B. Müller" value="${esc(st.teacher)}"></label></div>
        <label class="field"><span>Schule</span><input name="school" placeholder="z. B. Goethe-Gymnasium" value="${esc(st.school)}"></label>
        <div class="field"><span>Notensystem</span><div class="seg seg-form"><label class="seg-o"><input type="radio" name="gs" value="noten" checked><span>Noten 1–6</span></label><label class="seg-o"><input type="radio" name="gs" value="punkte"><span>Punkte 0–15</span></label></div></div>
      </form>`,
    foot: `<button class="btn btn-ghost" data-ob="demo">${icon('sparkles')}Beispieldaten</button><span class="sp"></span><button class="btn btn-primary" data-ob="start">Los geht's</button>`,
    onMount: (el, m) => {
      const read = () => {
        const f = el.querySelector('form');
        st.title = f.title.value; st.teacher = f.teacher.value.trim(); st.school = f.school.value.trim();
        st.gradeSystem = f.querySelector('input[name=gs]:checked').value;
      };
      el.querySelector('[data-ob="start"]').addEventListener('click', () => { read(); st.onboarded = true; save(); m.close(); App.refresh(); });
      el.querySelector('[data-ob="demo"]').addEventListener('click', () => { m.close(); Store.replace(buildDemoData()); applyTheme(); App.navigate('/today', { root: true }); UI.toast('Beispieldaten geladen – schau dich um!'); });
    },
    onClose: () => { if (!st.onboarded) { st.onboarded = true; save(); } },
  });
}
