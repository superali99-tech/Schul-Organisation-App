/* Klassenbuch & Unterrichtsplanung (Stunden, Unterrichtsreihen) */
'use strict';

function lessonEntryItem(l) {
  const c = cls(l.classId);
  const st = l.status || 'gehalten';
  const badge = st === 'ausgefallen' ? '<span class="badge red">Ausgefallen</span>' : st === 'geplant' ? '<span class="badge acc">Geplant</span>' : st === 'vertreten' ? '<span class="badge orange">Vertreten</span>' : '';
  return `<div class="li" data-act="lesson-edit" data-id="${l.id}">
    <div class="li-ic" style="background:${rgba(classColor(c), .14)};color:${classColor(c)};flex-direction:column;line-height:1.05;font-size:.72rem">${fmtDS(l.date)}<small>${l.period != null ? l.period + 1 + '.' : ''}</small></div>
    <div class="li-main"><div class="li-t wrap">${esc(l.topic || '(ohne Thema)')}</div>
      <div class="li-s wrap">${esc(c ? c.name : '')}${l.subjectId ? ' · ' + esc(subName(l.subjectId)) : ''}${l.homework ? ' · HA: ' + esc(l.homework) : ''}</div></div>
    <div class="li-end">${badge}</div></div>`;
}

function classBookTab(c) {
  const sub = App.bookTab || 'entries';
  let h = UI.seg([{ v: 'entries', l: 'Stunden', i: 'notebook-pen' }, { v: 'units', l: 'Unterrichtsreihen', i: 'layers' }], sub, 'book-tab');
  if (sub === 'units') return h + unitsHTML(c.id);
  const list = sortBy(S.lessons.filter((l) => l.classId === c.id), 'date', (l) => l.period ?? -1).reverse();
  if (!list.length) return h + UI.empty('notebook-pen', 'Noch keine Klassenbucheinträge. Öffne eine Stunde im Stundenplan oder lege einen Eintrag an.', `<button class="btn btn-primary" data-act="lesson-add" data-id="${c.id}">${icon('plus')}Eintrag</button>`);
  const planned = list.filter((l) => l.date > today() || l.status === 'geplant').reverse();
  const past = list.filter((l) => !(l.date > today() || l.status === 'geplant'));
  if (planned.length) h += `<div class="section-title">${icon('calendar-clock')}Geplant</div><div class="card pad0"><div class="list">${planned.map(lessonEntryItem).join('')}</div></div>`;
  h += `<div class="section-title">${icon('history')}Gehaltene Stunden (${past.filter((l) => l.status !== 'ausgefallen').length})</div><div class="card pad0"><div class="list">${past.map(lessonEntryItem).join('')}</div></div>`;
  h += `<div class="btn-row"><button class="btn" data-act="book-print" data-id="${c.id}">${icon('printer')}Klassenbuch drucken</button><button class="btn" data-act="book-export" data-id="${c.id}">${icon('file-spreadsheet')}CSV</button></div>`;
  return h;
}
A['book-tab'] = (el) => { App.bookTab = el.dataset.v; App.refresh(); };

App.def('/planning', () => {
  const fc = App.planClass || '';
  const sub = App.planTab || 'entries';
  let h = UI.seg([{ v: 'entries', l: 'Klassenbuch', i: 'notebook-pen' }, { v: 'units', l: 'Unterrichtsreihen', i: 'layers' }], sub, 'plan-tab');
  if (activeClasses().length) h += UI.chips(activeClasses().map((c) => ({ v: c.id, l: c.name, c: classColor(c) })), fc, 'plan-class', { all: 'Alle' });
  if (sub === 'units') {
    h += unitsHTML(fc);
  } else {
    const list = sortBy(S.lessons.filter((l) => !fc || l.classId === fc), 'date', (l) => l.period ?? -1).reverse();
    if (!list.length) h += UI.empty('notebook-pen', 'Noch keine Einträge. Trage Themen direkt in der Stunde (Stundenplan → Stunde antippen) oder hier ein.');
    else {
      const byMonth = groupBy(list.slice(0, 200), (l) => l.date.slice(0, 7));
      for (const [mth, ls] of byMonth) {
        const d = pd(mth + '-01');
        h += `<div class="section-title">${MONTHS[d.getMonth()]} ${d.getFullYear()}</div><div class="card pad0"><div class="list">${ls.map(lessonEntryItem).join('')}</div></div>`;
      }
    }
  }
  return { title: 'Klassenbuch & Planung', tab: 'more', html: h, fab: { act: sub === 'units' ? 'unit-add' : 'lesson-add', id: fc } };
});
A['plan-tab'] = (el) => { App.planTab = el.dataset.v; App.refresh(); };
A['plan-class'] = (el) => { App.planClass = el.dataset.v; App.refresh(); };
A['lesson-add'] = (el) => editLessonEntry(null, { classId: (el && el.dataset.id) || '' });
A['lesson-edit'] = (el) => editLessonEntry(byId('lessons', el.dataset.id));

function editLessonEntry(l, preset = {}) {
  const isNew = !l;
  const cid = (l && l.classId) || preset.classId || (activeClasses()[0] || {}).id || '';
  const unitOpts = (classId) => [{ v: '', l: '– keine Reihe –' }, ...S.units.filter((u) => u.classId === classId).map((u) => ({ v: u.id, l: u.title }))];
  UI.form({
    title: isNew ? 'Stunde planen / eintragen' : 'Klassenbucheintrag',
    fields: [
      { k: 'classId', label: 'Klasse', type: 'select', opts: classOptions(), half: true },
      { k: 'subjectId', label: 'Fach', type: 'select', opts: subjectOptions(true), half: true },
      { k: 'date', label: 'Datum', type: 'date', req: true, half: true },
      { k: 'period', label: 'Stunde', type: 'select', opts: [{ v: '', l: '–' }, ...periodOptions()], half: true },
      { k: 'topic', label: 'Thema', ph: 'z. B. Einführung Prozentrechnung' },
      { k: 'goals', label: 'Lernziele / Kompetenzen', type: 'textarea', rows: 2 },
      { k: 'content', label: 'Verlauf / Inhalt / Phasen', type: 'textarea', rows: 4, ph: 'Einstieg …\nErarbeitung …\nSicherung …' },
      { k: 'materials', label: 'Material / Medien', ph: 'z. B. AB 3, Beamer, Buch S. 45' },
      { k: 'homework', label: 'Hausaufgabe', ph: 'optional' },
      { k: 'unitId', label: 'Unterrichtsreihe', type: 'select', opts: unitOpts(cid) },
      { k: 'status', label: 'Status', type: 'seg', opts: Object.entries(LESSON_STATUS).map(([v, t]) => ({ v, l: t })) },
      { k: 'notes', label: 'Reflexion / Notizen', type: 'textarea', rows: 2 },
    ],
    values: l ? { ...l, period: l.period ?? '' } : { classId: cid, subjectId: (subjectsOf(cid)[0] || {}).id || '', date: today(), period: '', status: 'geplant', ...preset, ...(preset.classId ? {} : { classId: cid }) },
    onMount: (el) => {
      const c = el.querySelector('[name=classId]');
      const u = el.querySelector('[name=unitId]');
      const s = el.querySelector('[name=subjectId]');
      c.addEventListener('change', () => {
        u.innerHTML = unitOpts(c.value).map((o) => `<option value="${o.v}">${esc(o.l)}</option>`).join('');
        const subs = subjectsOf(c.value); if (subs.length) s.value = subs[0].id;
      });
    },
    onSave: (v) => {
      v.period = v.period === '' ? null : Number(v.period);
      upsert('lessons', { ...(l || {}), ...v });
      save(); App.refresh(); UI.toast('Gespeichert');
    },
    onDelete: isNew ? null : () => deleteWithUndo('lessons', l.id, l.topic || 'Eintrag', { confirm: false }),
  });
}

// ------------------------------------------------------------------ Unterrichtsreihen
function unitsHTML(classId) {
  const list = sortBy(S.units.filter((u) => !classId || u.classId === classId), (u) => u.start || '9999');
  if (!list.length) return UI.empty('layers', 'Plane Unterrichtsreihen (Themenblöcke) mit Zeitraum, Zielen und Stundenanzahl.', `<button class="btn btn-primary" data-act="unit-add" data-id="${classId || ''}">${icon('plus')}Reihe anlegen</button>`);
  const td = today();
  return `<div class="card pad0"><div class="list">${list.map((u) => {
    const done = S.lessons.filter((l) => l.unitId === u.id && l.status !== 'ausgefallen' && l.date <= td).length;
    const total = Number(u.lessons) || 0;
    const active = u.start && u.start <= td && (!u.end || u.end >= td);
    const col = u.color || classColor(cls(u.classId));
    return `<div class="li" data-act="unit-edit" data-id="${u.id}"><div class="li-bar" style="background:${col}"></div><div class="li-ic" style="background:${rgba(col, .14)};color:${col}">${icon('layers')}</div>
      <div class="li-main"><div class="li-t">${esc(u.title)} ${active ? '<span class="badge green">aktuell</span>' : ''}</div>
      <div class="li-s">${esc(cName(u.classId))}${u.start ? ` · ${fmtDS(u.start)}–${u.end ? fmtDS(u.end) : '?'}` : ''} · ${done}${total ? '/' + total : ''} Stunden</div>
      ${total ? `<div class="progress" style="margin-top:5px"><i style="width:${Math.min(100, Math.round((100 * done) / total))}%;background:${col}"></i></div>` : ''}</div></div>`;
  }).join('')}</div></div>`;
}
A['unit-add'] = (el) => editUnit(null, { classId: (el && el.dataset.id) || App.planClass || '' });
A['unit-edit'] = (el) => editUnit(byId('units', el.dataset.id));
function editUnit(u, preset = {}) {
  const isNew = !u;
  UI.form({
    title: isNew ? 'Neue Unterrichtsreihe' : 'Unterrichtsreihe',
    fields: [
      { k: 'title', label: 'Thema der Reihe', req: true, ph: 'z. B. Bruchrechnung, Lyrik der Romantik' },
      { k: 'classId', label: 'Klasse', type: 'select', opts: classOptions() },
      { k: 'start', label: 'Beginn', type: 'date', half: true },
      { k: 'end', label: 'Ende', type: 'date', half: true },
      { k: 'lessons', label: 'Geplante Stunden', type: 'number', inputmode: 'numeric' },
      { k: 'goals', label: 'Kompetenzen / Ziele', type: 'textarea', rows: 3 },
      { k: 'plan', label: 'Stoffverteilung / Stundenfolge', type: 'textarea', rows: 6, ph: '1. Einstieg …\n2. …' },
      { k: 'notes', label: 'Material / Notizen', type: 'textarea', rows: 2 },
      { k: 'color', label: 'Farbe', type: 'color', allowEmpty: true, colors: ['', ...COLORS] },
    ],
    values: u ? { ...u } : { classId: preset.classId || (activeClasses()[0] || {}).id, start: today(), color: '' },
    onSave: (v) => { upsert('units', { ...(u || {}), ...v }); save(); App.refresh(); },
    onDelete: isNew ? null : () => deleteWithUndo('units', u.id, u.title, { confirm: false }),
  });
}

A['book-print'] = (el) => {
  const c = cls(el.dataset.id);
  const list = sortBy(S.lessons.filter((l) => l.classId === c.id), 'date', (l) => l.period ?? -1);
  const h = `<table><tr><th style="width:70px">Datum</th><th style="width:30px">Std.</th><th>Thema / Inhalt</th><th>Hausaufgabe</th><th style="width:60px">Status</th></tr>${list.map((l) => `<tr><td>${fmtD(l.date)}</td><td>${l.period != null ? l.period + 1 : ''}</td><td><b>${esc(l.topic || '')}</b>${l.content ? '<br>' + nl2br(l.content) : ''}</td><td>${esc(l.homework || '')}</td><td>${esc(LESSON_STATUS[l.status] || '')}</td></tr>`).join('')}</table>`;
  Print.show(`Klassenbuch ${c.name}`, h);
};
A['book-export'] = (el) => {
  const c = cls(el.dataset.id);
  const list = sortBy(S.lessons.filter((l) => l.classId === c.id), 'date', (l) => l.period ?? -1);
  Files.csv(`Klassenbuch_${c.name.replace(/\W+/g, '_')}.csv`, [['Datum', 'Stunde', 'Fach', 'Thema', 'Inhalt', 'Hausaufgabe', 'Material', 'Status'], ...list.map((l) => [fmtD(l.date), l.period != null ? l.period + 1 : '', subName(l.subjectId), l.topic, l.content, l.homework, l.materials, LESSON_STATUS[l.status] || ''])]);
};
