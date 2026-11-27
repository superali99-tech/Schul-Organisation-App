/* Hausaufgaben */
'use strict';

function hwItem(h) {
  const c = cls(h.classId);
  const col = classColor(c);
  const overdue = !h.done && h.due && h.due < today();
  const missing = S.observations.filter((o) => o.kind === 'ha' && o.hwId === h.id).length;
  return `<div class="li ${h.done ? 'done' : ''}">
    <button class="check round ${h.done ? 'on' : ''}" data-act="hw-toggle" data-id="${h.id}" aria-label="Erledigt">${icon('check')}</button>
    <div class="li-main" data-act="hw-edit" data-id="${h.id}"><div class="li-t wrap">${esc(h.title)}</div>
      <div class="li-s"><i class="dot" style="background:${col}"></i> ${esc(c ? c.name : '–')}${h.subjectId ? ' · ' + esc(subName(h.subjectId)) : ''}${missing ? ` · ${missing}× vergessen` : ''}</div></div>
    <div class="li-end">${h.due ? `<span class="badge ${overdue ? 'red' : h.due === today() ? 'orange' : ''}">${relDay(h.due)}${h.time ? ' ' + esc(h.time) : ''}</span>` : ''}</div>
  </div>`;
}

App.def('/homework', () => {
  const mode = App.hwMode || 'open';
  const fc = App.hwClass || '';
  const td = today();
  let list = S.homework.filter((h) => (mode === 'open' ? !h.done : h.done) && (!fc || h.classId === fc));
  let h = UI.seg([{ v: 'open', l: `Offen (${S.homework.filter((x) => !x.done).length})` }, { v: 'done', l: 'Erledigt' }], mode, 'hw-mode');
  if (activeClasses().length > 1) h += UI.chips(activeClasses().map((c) => ({ v: c.id, l: c.name, c: classColor(c) })), fc, 'hw-class', { all: 'Alle Klassen' });
  if (!list.length) {
    h += UI.empty('book-open', mode === 'open' ? 'Keine offenen Hausaufgaben.' : 'Noch nichts erledigt.', mode === 'open' ? `<button class="btn btn-primary" data-act="hw-add">${icon('plus')}Hausaufgabe eintragen</button>` : '');
  } else if (mode === 'open') {
    const groups = [
      ['Überfällig', (x) => x.due && x.due < td],
      ['Heute', (x) => x.due === td],
      ['Morgen', (x) => x.due === addDays(td, 1)],
      ['Diese Woche', (x) => x.due > addDays(td, 1) && x.due <= addDays(weekStart(td), 6)],
      ['Später', (x) => x.due > addDays(weekStart(td), 6)],
      ['Ohne Datum', (x) => !x.due],
    ];
    for (const [label, fn] of groups) {
      const g = sortBy(list.filter(fn), 'due');
      if (g.length) h += `<div class="section-title">${label} <span class="badge">${g.length}</span></div><div class="card pad0"><div class="list">${g.map(hwItem).join('')}</div></div>`;
    }
  } else {
    h += `<div class="card pad0"><div class="list">${sortBy(list, 'due').reverse().slice(0, 100).map(hwItem).join('')}</div></div>`;
  }
  return { title: 'Hausaufgaben', tab: 'more', html: h, fab: { act: 'hw-add' } };
});
A['hw-mode'] = (el) => { App.hwMode = el.dataset.v; App.refresh(); };
A['hw-class'] = (el) => { App.hwClass = el.dataset.v; App.refresh(); };
A['hw-add'] = (el) => editHomework(null, { classId: (el && el.dataset && el.dataset.id) || App.hwClass || '' });
A['hw-edit'] = (el) => editHomework(byId('homework', el.dataset.id));
A['hw-toggle'] = (el) => {
  const h = byId('homework', el.dataset.id);
  if (!h) return;
  if (h.done) { h.done = false; save(); App.refresh(); return; }
  checkFlow(el, {
    title: h.title,
    laterSub: 'Neues Datum und Uhrzeit wählen',
    done: () => { h.done = true; save(); App.refresh(); UI.toast('Erledigt ✓', { undo: () => { h.done = false; save(); App.refresh(); } }); },
    postpone: () => postponeHomework(h),
    edit: () => editHomework(h),
    remove: () => deleteWithUndo('homework', h.id, h.title, { confirm: false }),
  });
};

function postponeHomework(h) {
  const d0 = today();
  const from = h.due && h.due > d0 ? h.due : d0;
  const quick = [];
  if (h.classId) {
    const n1 = nextLessonDate(h.classId, from, h.subjectId);
    const n2 = nextLessonDate(h.classId, n1, h.subjectId);
    quick.push({ l: `Nächste Stunde · ${fmtDW(n1)}`, d: n1 }, { l: `Übernächste Stunde · ${fmtDW(n2)}`, d: n2 });
  }
  quick.push({ l: `Morgen · ${fmtDW(addDays(d0, 1))}`, d: addDays(d0, 1) }, { l: `In einer Woche · ${fmtDS(addDays(from, 7))}`, d: addDays(from, 7) });
  postponeForm({
    item: h, quick, withRemind: false,
    apply: (v) => {
      const old = { due: h.due, time: h.time, desc: h.desc };
      h.due = v.due; h.time = v.time || ''; h.desc = notDoneNote(h.desc, v.note);
      save(); App.refresh();
      UI.toast(`Verschoben auf ${fmtDW(h.due)}${h.time ? ', ' + h.time + ' Uhr' : ''}`, { undo: () => { Object.assign(h, old); save(); App.refresh(); } });
    },
  });
}

function classHomeworkTab(c) {
  const open = sortBy(S.homework.filter((h) => h.classId === c.id && !h.done), 'due');
  const done = sortBy(S.homework.filter((h) => h.classId === c.id && h.done), 'due').reverse();
  if (!open.length && !done.length) return UI.empty('book-open', 'Noch keine Hausaufgaben für diese Klasse.', `<button class="btn btn-primary" data-act="hw-add" data-id="${c.id}">${icon('plus')}Hausaufgabe</button>`);
  let h = '';
  if (open.length) h += `<div class="section-title">Offen</div><div class="card pad0"><div class="list">${open.map(hwItem).join('')}</div></div>`;
  if (done.length) h += `<div class="section-title">Erledigt</div><div class="card pad0"><div class="list">${done.slice(0, 30).map(hwItem).join('')}</div></div>`;
  return h;
}

function editHomework(h, preset = {}) {
  const isNew = !h;
  const cid = (h && h.classId) || preset.classId || (activeClasses()[0] || {}).id || '';
  UI.form({
    title: isNew ? 'Hausaufgabe' : 'Hausaufgabe bearbeiten',
    fields: [
      { k: 'title', label: 'Aufgabe', req: true, ph: 'z. B. Buch S. 45, Nr. 3–5' },
      { k: 'classId', label: 'Klasse', type: 'select', opts: classOptions(), half: true },
      { k: 'subjectId', label: 'Fach', type: 'select', opts: subjectOptions(true), half: true },
      { k: 'given', label: 'Aufgegeben am', type: 'date', half: true },
      { k: 'due', label: 'Fällig am', type: 'date', half: true },
      { k: 'time', label: 'Uhrzeit (optional)', type: 'time', half: true },
      { k: 'desc', label: 'Details', type: 'textarea', rows: 2 },
      !isNew ? { k: 'done', label: 'Erledigt / abgeschlossen', type: 'switch' } : null,
    ],
    values: h ? { ...h } : { classId: cid, subjectId: (subjectsOf(cid)[0] || {}).id || '', given: today(), due: cid ? nextLessonDate(cid, today()) : addDays(today(), 1), ...preset, ...(preset.classId ? {} : { classId: cid }) },
    onMount: (el) => {
      const c = el.querySelector('[name=classId]');
      const s = el.querySelector('[name=subjectId]');
      const d = el.querySelector('[name=due]');
      c.addEventListener('change', () => {
        const subs = subjectsOf(c.value);
        if (subs.length) s.value = subs[0].id;
        if (isNew) d.value = nextLessonDate(c.value, today(), s.value);
      });
    },
    onSave: (v) => { upsert('homework', { ...(h || { done: false }), ...v }); save(); App.refresh(); UI.toast('Gespeichert'); },
    onDelete: isNew ? null : () => deleteWithUndo('homework', h.id, h.title, { confirm: false }),
    extraFoot: !isNew ? `<button class="btn btn-ghost" data-act="hw-check" data-id="${h.id}">${icon('user-x')}Kontrolle</button>` : '',
  });
}

A['hw-check'] = (el) => {
  const h = byId('homework', el.dataset.id);
  UI.closeAll();
  const studs = studentsOf(h.classId);
  const missing = S.observations.filter((o) => o.kind === 'ha' && o.hwId === h.id).map((o) => o.studentId);
  setTimeout(() => UI.form({
    title: 'Wer hat die Hausaufgabe nicht?',
    fields: [
      { type: 'html', html: `<p class="muted small" style="margin:0">${esc(h.title)} – wird bei den Schüler:innen als „Hausaufgabe vergessen" vermerkt.</p>` },
      { k: 'missing', label: 'Nicht gemacht', type: 'multi', opts: studs.map((s) => ({ v: s.id, l: sName(s) })) },
    ],
    values: { missing },
    onSave: (v) => {
      const set = new Set(v.missing);
      S.observations = S.observations.filter((o) => !(o.kind === 'ha' && o.hwId === h.id && !set.has(o.studentId)));
      v.missing.forEach((sid) => {
        if (!S.observations.some((o) => o.kind === 'ha' && o.hwId === h.id && o.studentId === sid)) {
          S.observations.push({ id: uid(), studentId: sid, classId: h.classId, date: h.due || today(), kind: 'ha', text: h.title, hwId: h.id });
        }
      });
      save(); App.refresh();
      UI.toast(v.missing.length ? `${v.missing.length}× vermerkt` : 'Alle haben die Hausaufgabe');
    },
  }), 250);
};
