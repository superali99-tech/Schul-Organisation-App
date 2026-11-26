/* Klassen: Übersicht & Detailseite */
'use strict';

const CLASS_TABS = [
  { v: 'students', l: 'Schüler', i: 'users' },
  { v: 'grades', l: 'Noten', i: 'award' },
  { v: 'attendance', l: 'Anwesenheit', i: 'user-check' },
  { v: 'behavior', l: 'Mitarbeit', i: 'thumbs-up' },
  { v: 'homework', l: 'Hausaufgaben', i: 'book-open' },
  { v: 'book', l: 'Klassenbuch', i: 'notebook-pen' },
  { v: 'seating', l: 'Sitzplan', i: 'armchair' },
  { v: 'info', l: 'Info', i: 'info' },
];

function classAvg(c) {
  const vals = studentsOf(c.id).map((s) => studentAverage(s.id, c.id, {}).avg).filter((v) => v != null);
  return avg(vals);
}

function classCard(c) {
  const n = studentsOf(c.id).length;
  const gs = gsOf(c.id);
  const a = classAvg(c);
  const col = classColor(c);
  const subs = subjectsOf(c.id).map((s) => s.name).join(', ');
  return `<div class="li" data-nav="/class/${c.id}">
    <div class="li-bar" style="background:${col}"></div>
    <div class="li-ic" style="background:${rgba(col, .15)};color:${col}">${esc(c.name.slice(0, 4))}</div>
    <div class="li-main"><div class="li-t">${esc(c.name)} ${c.isOwn ? '<span class="badge acc">Klassenleitung</span>' : ''}</div>
      <div class="li-s">${esc(subs || 'Kein Fach zugeordnet')} · ${plural(n, 'Schüler:in', 'Schüler:innen')}${c.room ? ' · R. ' + esc(c.room) : ''}</div></div>
    <div class="li-end">${a != null ? avgBadge(gs, a) : ''}${icon('chevron-right', 'chev')}</div>
  </div>`;
}

App.def('/classes', () => {
  const act = activeClasses();
  const arch = S.classes.filter((c) => c.archived).sort((a, b) => cmpStr(a.name, b.name));
  let html = '';
  if (!S.classes.length) {
    html = UI.empty('users', 'Noch keine Klassen. Lege deine erste Klasse oder deinen ersten Kurs an.', `<button class="btn btn-primary" data-act="class-add">${icon('plus')}Klasse anlegen</button>`);
  } else {
    html += UI.stats([
      { v: act.length, l: 'Klassen' },
      { v: act.reduce((n, c) => n + studentsOf(c.id).length, 0), l: 'Schüler:innen' },
      { v: S.subjects.length, l: 'Fächer', nav: '/settings/subjects' },
    ]);
    html += `<div class="card pad0"><div class="list">${act.map(classCard).join('')}</div></div>`;
    if (arch.length) html += `<div class="section-title">${icon('archive')}Archiviert</div><div class="card pad0"><div class="list">${arch.map(classCard).join('')}</div></div>`;
  }
  return {
    title: 'Klassen & Kurse', tab: 'classes', icon: 'users', html,
    actions: [{ icon: 'search', nav: '/search', label: 'Suche' }, { icon: 'book', nav: '/settings/subjects', label: 'Fächer' }],
    fab: S.classes.length ? { act: 'class-add', label: 'Klasse' } : null,
  };
});

App.def('/class/:id/:tab?', (p) => {
  const c = cls(p.id);
  if (!c) return { title: 'Klasse', html: UI.empty('users', 'Klasse nicht gefunden.') };
  const tab = p.tab || App.lastClassTab || 'students';
  App.lastClassTab = tab;
  let body = '';
  let fab = null;
  const actions = [{ icon: 'pencil', act: 'class-edit', id: c.id, label: 'Bearbeiten' }, { icon: 'ellipsis', act: 'class-menu', id: c.id, label: 'Mehr' }];
  switch (tab) {
    case 'students': body = classStudentsTab(c); fab = { act: 'student-add', id: c.id, icon: 'user-plus' }; break;
    case 'grades': body = classGradesTab(c); fab = { act: 'assess-add', id: c.id, label: 'Leistung' }; break;
    case 'attendance': body = classAttendanceTab(c); fab = { act: 'att-new', id: c.id, icon: 'user-check', label: 'Erfassen' }; break;
    case 'behavior': body = classBehaviorTab(c); break;
    case 'homework': body = classHomeworkTab(c); fab = { act: 'hw-add', id: c.id }; break;
    case 'book': body = classBookTab(c); fab = { act: 'lesson-add', id: c.id }; break;
    case 'seating': body = classSeatingTab(c); break;
    default: body = classInfoTab(c);
  }
  const tabs = `<div class="tabs">${CLASS_TABS.map((t) => `<button class="${t.v === tab ? 'on' : ''}" data-nav="/class/${c.id}/${t.v}" data-replace>${icon(t.i)}${t.l}</button>`).join('')}</div>`;
  const subs = subjectsOf(c.id).map((s) => s.name).join(', ');
  return {
    title: c.name, sub: [subs, plural(studentsOf(c.id).length, 'Schüler:in', 'Schüler:innen')].filter(Boolean).join(' · '),
    tab: 'classes', html: tabs + body, actions, fab,
    mount: (el) => {
      const on = el.querySelector('.tabs .on');
      if (on) on.scrollIntoView({ inline: 'center', block: 'nearest' });
      if (tab === 'seating') seatingMount(el, c);
    },
  };
});
// Tabs ersetzen den aktuellen Eintrag in der Verlaufsliste
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-replace][data-nav]');
  if (b) { e.stopImmediatePropagation(); e.preventDefault(); App.navigate(b.dataset.nav, { replace: true }); }
}, true);

function classInfoTab(c) {
  const studs = studentsOf(c.id);
  const gs = gsOf(c.id);
  const notes = S.notes.filter((n) => n.classId === c.id);
  let h = `<div class="card"><dl class="kv">
    <dt>Name</dt><dd>${esc(c.name)}</dd>
    <dt>Fächer</dt><dd>${esc(subjectsOf(c.id).map((s) => s.name).join(', ') || '–')}</dd>
    <dt>Raum</dt><dd>${esc(c.room || '–')}</dd>
    <dt>Notensystem</dt><dd>${esc(gs.label)}</dd>
    <dt>Klassenleitung</dt><dd>${c.isOwn ? 'Ja' : 'Nein'}</dd>
    ${c.notes ? `<dt>Notizen</dt><dd>${nl2br(c.notes)}</dd>` : ''}
  </dl></div>`;
  // Statistik
  const avgs = studs.map((s) => studentAverage(s.id, c.id).avg).filter((v) => v != null);
  const att = studs.map((s) => attStats(s.id));
  const absent = sum(att.map((a) => a.absent));
  const recs = S.attendance.filter((r) => r.classId === c.id).length;
  h += UI.stats([
    { v: studs.length, l: 'Schüler:innen' },
    { v: avgs.length ? fmtNum(avg(avgs)) : '–', l: 'Ø Leistung' },
    { v: S.assessments.filter((a) => a.classId === c.id).length, l: 'Leistungsnachw.' },
    { v: recs, l: 'Erfasste Stunden' },
    { v: absent, l: 'Fehlstunden ges.' },
  ]);
  // Gewichtung
  h += `<div class="card"><div class="card-h"><h3>${icon('sliders-horizontal')}Gewichtung der Noten</h3><button class="link" data-act="class-weights" data-id="${c.id}">Ändern</button></div>
    <div class="list">${S.categories.map((k) => `<div class="li"><i class="dot" style="background:${k.color}"></i><div class="li-main"><div class="li-t">${esc(k.name)}</div></div><div class="li-end b">${catWeight(k, c.id)} %${c.catWeights && c.catWeights[k.id] != null && c.catWeights[k.id] !== '' ? ' <span class="badge acc">eigene</span>' : ''}</div></div>`).join('')}</div></div>`;
  // Notizen
  h += `<div class="card"><div class="card-h"><h3>${icon('sticky-note')}Notizen zur Klasse</h3><button class="link" data-act="note-new" data-class="${c.id}">Neu</button></div>
    ${notes.length ? `<div class="list">${notes.map((n) => `<div class="li" data-act="note-open" data-id="${n.id}"><div class="li-main"><div class="li-t">${esc(n.title || 'Notiz')}</div><div class="li-s">${esc((n.body || '').slice(0, 80))}</div></div></div>`).join('')}</div>` : '<p class="muted small" style="margin:0">Keine Notizen.</p>'}</div>`;
  // Reihen
  h += `<div class="btn-row"><button class="btn" data-act="class-print-list" data-id="${c.id}">${icon('printer')}Klassenliste drucken</button><button class="btn" data-act="class-export" data-id="${c.id}">${icon('file-spreadsheet')}Export (CSV)</button></div>`;
  return h;
}

A['class-add'] = () => editClass();
A['class-edit'] = (el) => editClass(cls(el.dataset.id));

function editClass(c) {
  const isNew = !c;
  UI.form({
    title: isNew ? 'Neue Klasse / neuer Kurs' : 'Klasse bearbeiten',
    fields: [
      { k: 'name', label: 'Name', req: true, ph: 'z. B. 7a, Q1 Mathe GK' },
      { k: 'subjects', label: 'Meine Fächer in dieser Klasse', type: 'multi', opts: subjectOptions() },
      { k: 'newSubject', label: 'Neues Fach anlegen (optional)', ph: 'z. B. Mathematik', hint: 'Wird angelegt und dieser Klasse zugeordnet' },
      { k: 'room', label: 'Raum', half: true },
      { k: 'gradeSystem', label: 'Notensystem', type: 'select', half: true, opts: [{ v: '', l: `Standard (${GRADE_SYSTEMS[S.settings.gradeSystem].label})` }, { v: 'noten', l: 'Noten 1–6' }, { v: 'punkte', l: 'Punkte 0–15' }] },
      { k: 'color', label: 'Farbe', type: 'color', allowEmpty: true, colors: ['', ...COLORS] },
      { k: 'isOwn', label: 'Ich bin Klassenleitung', type: 'switch' },
      { k: 'notes', label: 'Notizen', type: 'textarea', rows: 2 },
    ],
    values: c ? { ...c } : { subjects: [], color: '' },
    onSave: (v) => {
      if (v.newSubject) {
        const ex = S.subjects.find((s) => s.name.toLowerCase() === v.newSubject.toLowerCase());
        const s = ex || upsert('subjects', { name: v.newSubject, short: v.newSubject.slice(0, 3), color: COLORS[S.subjects.length % COLORS.length] });
        if (!v.subjects.includes(s.id)) v.subjects.push(s.id);
      }
      delete v.newSubject;
      const obj = upsert('classes', { ...(c || { archived: false, catWeights: {} }), ...v });
      save();
      if (isNew) App.navigate('/class/' + obj.id + '/students');
      else App.refresh();
      UI.toast(isNew ? 'Klasse angelegt' : 'Gespeichert');
    },
  });
}

A['class-weights'] = (el) => {
  const c = cls(el.dataset.id);
  UI.form({
    title: `Gewichtung – ${c.name}`,
    fields: [
      { type: 'html', html: '<p class="muted small" style="margin:0">Leer lassen = Standard aus den Einstellungen. Die Gewichte werden relativ zueinander verrechnet (z. B. 50/50 oder 60/40).</p>' },
      ...S.categories.map((k) => ({ k: k.id, label: `${k.name} (Standard ${k.weight} %)`, type: 'number', inputmode: 'decimal', ph: String(k.weight) })),
    ],
    values: { ...(c.catWeights || {}) },
    onSave: (v) => {
      c.catWeights = {};
      Object.entries(v).forEach(([k, x]) => { if (x != null && x !== '') c.catWeights[k] = x; });
      save(); App.refresh();
    },
  });
};

A['class-menu'] = (el) => {
  const c = cls(el.dataset.id);
  UI.menu(c.name, [
    { l: 'Bearbeiten', i: 'pencil', fn: () => editClass(c) },
    { l: 'Notengewichtung', i: 'sliders-horizontal', fn: () => A['class-weights']({ dataset: { id: c.id } }) },
    { l: 'Schüler:innen als Liste hinzufügen', i: 'list', fn: () => bulkAddStudents(c) },
    { l: 'Schüler:innen importieren (CSV)', i: 'file-up', fn: () => importStudentsCSV(c) },
    { l: 'Klassenliste drucken', i: 'printer', fn: () => printClassList(c) },
    { l: 'Klassendaten exportieren (CSV)', i: 'file-spreadsheet', fn: () => exportClassCSV(c) },
    { l: 'E-Mail an alle Eltern', i: 'mail', fn: () => mailParents(c) },
    { sep: true },
    { l: c.archived ? 'Aus Archiv holen' : 'Archivieren', i: 'archive', fn: () => { c.archived = !c.archived; save(); App.refresh(); UI.toast(c.archived ? 'Archiviert' : 'Wiederhergestellt'); } },
    { l: 'Klasse löschen', i: 'trash-2', danger: true, fn: () => deleteClass(c) },
  ]);
};
A['class-print-list'] = (el) => printClassList(cls(el.dataset.id));
A['class-export'] = (el) => exportClassCSV(cls(el.dataset.id));

async function deleteClass(c) {
  const n = studentsOf(c.id).length;
  if (!(await UI.confirm(`Klasse „${esc(c.name)}" mit ${n} Schüler:innen und <b>allen zugehörigen Noten, Anwesenheiten, Hausaufgaben und Klassenbucheinträgen</b> löschen? Tipp: Archivieren behält alle Daten.`, { danger: true, ok: 'Endgültig löschen' }))) return;
  const snapshot = deepCopy(S);
  const sids = new Set(studentsOf(c.id).map((s) => s.id));
  S.classes = S.classes.filter((x) => x.id !== c.id);
  S.students = S.students.filter((s) => s.classId !== c.id);
  ['assessments', 'attendance', 'homework', 'lessons', 'units', 'timetable', 'changes'].forEach((k) => { S[k] = S[k].filter((x) => x.classId !== c.id); });
  S.observations = S.observations.filter((o) => !sids.has(o.studentId));
  S.talks = S.talks.filter((t) => !sids.has(t.studentId));
  S.notes.forEach((nn) => { if (nn.classId === c.id) nn.classId = ''; });
  delete S.seating[c.id];
  save();
  App.navigate('/classes', { root: true });
  UI.toast('Klasse gelöscht', { undo: () => { Store.replace(snapshot); App.navigate('/class/' + c.id, { root: true }); } });
}

function printClassList(c) {
  const studs = studentsOf(c.id);
  const cols = 8;
  let h = `<table><tr><th style="width:24px">#</th><th>Name</th><th>Geburtstag</th>${Array.from({ length: cols }, () => '<th style="width:34px"></th>').join('')}</tr>`;
  studs.forEach((s, i) => { h += `<tr><td>${i + 1}</td><td>${esc(sNameRev(s))}</td><td>${s.birthday ? fmtD(s.birthday) : ''}</td>${Array.from({ length: cols }, () => '<td></td>').join('')}</tr>`; });
  h += '</table>';
  Print.show(`Klassenliste ${c.name}`, h);
}
function exportClassCSV(c) {
  const studs = studentsOf(c.id);
  const rows = [['Nachname', 'Vorname', 'Geburtstag', 'E-Mail', 'Telefon', 'Erziehungsberechtigte', 'Telefon Eltern', 'E-Mail Eltern', 'Adresse', 'Ø Note', 'Fehlstunden', 'davon unentschuldigt', 'Verspätungen', 'Notizen']];
  studs.forEach((s) => {
    const a = studentAverage(s.id, c.id).avg;
    const at = attStats(s.id);
    rows.push([s.lastName, s.firstName, s.birthday ? fmtD(s.birthday) : '', s.email, s.phone, s.parentName, s.parentPhone, s.parentEmail, s.address, a != null ? fmtNum(a) : '', at.absent, at.f, at.v, s.notes]);
  });
  Files.csv(`Klasse_${c.name.replace(/\W+/g, '_')}_${today()}.csv`, rows);
}
function mailParents(c) {
  const mails = studentsOf(c.id).map((s) => s.parentEmail).filter(Boolean);
  if (!mails.length) { UI.toast('Keine Eltern-E-Mail-Adressen hinterlegt'); return; }
  window.location.href = `mailto:?bcc=${encodeURIComponent(mails.join(','))}&subject=${encodeURIComponent('Klasse ' + c.name)}`;
}
