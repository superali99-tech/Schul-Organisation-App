/* Aufgaben / To-dos */
'use strict';

const PRIO = [{ v: 0, l: 'Normal', c: '' }, { v: 1, l: 'Wichtig', c: '#ea580c' }, { v: 2, l: 'Dringend', c: '#dc2626' }];

function taskItem(t) {
  const overdue = !t.done && t.due && t.due < today();
  const sub = [t.cat, t.classId ? cName(t.classId) : '', t.notes ? t.notes.split('\n')[0] : ''].filter(Boolean).join(' · ');
  const p = PRIO[t.prio || 0];
  return `<div class="li ${t.done ? 'done' : ''}">
    <button class="check ${t.done ? 'on' : ''}" data-act="task-toggle" data-id="${t.id}" style="${p.c && !t.done ? `border-color:${p.c}` : ''}" aria-label="Erledigt">${icon('check')}</button>
    <div class="li-main" data-act="task-edit" data-id="${t.id}"><div class="li-t wrap">${p.v ? `<span style="color:${p.c}">${'!'.repeat(p.v)}</span> ` : ''}${esc(t.title)}</div>${sub ? `<div class="li-s">${esc(sub)}</div>` : ''}</div>
    <div class="li-end">${t.due ? `<span class="badge ${overdue ? 'red' : t.due === today() ? 'orange' : ''}">${relDay(t.due)}${t.time ? ' ' + esc(t.time) : ''}</span>` : ''}${t.remind ? icon('bell') : ''}</div>
  </div>`;
}

App.def('/tasks', () => {
  const mode = App.taskMode || 'open';
  const fcat = App.taskCat || '';
  const td = today();
  const list = S.tasks.filter((t) => (mode === 'open' ? !t.done : t.done) && (!fcat || t.cat === fcat));
  let h = `<div class="search" style="margin-bottom:10px">${icon('plus')}<input id="task-quick" placeholder="Neue Aufgabe … (Enter)" data-act="noop"></div>`;
  h += UI.seg([{ v: 'open', l: `Offen (${S.tasks.filter((t) => !t.done).length})` }, { v: 'done', l: 'Erledigt' }], mode, 'task-mode');
  const cats = [...new Set(S.tasks.map((t) => t.cat).filter(Boolean))];
  if (cats.length) h += UI.chips(cats.map((c) => ({ v: c, l: c })), fcat, 'task-cat', { all: 'Alle' });
  if (!list.length) h += UI.empty('list-todo', mode === 'open' ? 'Alles erledigt! 🎉' : 'Noch keine erledigten Aufgaben.');
  else if (mode === 'open') {
    const eow = addDays(weekStart(td), 6);
    const groups = [
      ['Überfällig', (t) => t.due && t.due < td],
      ['Heute', (t) => t.due === td],
      ['Diese Woche', (t) => t.due > td && t.due <= eow],
      ['Später', (t) => t.due > eow],
      ['Ohne Datum', (t) => !t.due],
    ];
    for (const [label, fn] of groups) {
      const g = sortBy(list.filter(fn), (t) => t.due || '', (t) => -(t.prio || 0), (t) => t.time || '');
      if (g.length) h += `<div class="section-title">${label} <span class="badge">${g.length}</span></div><div class="card pad0"><div class="list">${g.map(taskItem).join('')}</div></div>`;
    }
  } else {
    h += `<div class="card pad0"><div class="list">${sortBy(list, (t) => t.doneAt || '').reverse().slice(0, 100).map(taskItem).join('')}</div></div>`;
    h += `<button class="btn btn-ghost danger" data-act="task-clear-done">${icon('trash-2')}Erledigte löschen</button>`;
  }
  return {
    title: 'Aufgaben', tab: 'more', html: h, fab: { act: 'task-add' },
    mount: (el) => {
      const q = el.querySelector('#task-quick');
      q.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && q.value.trim()) {
          upsert('tasks', { title: q.value.trim(), done: false, prio: 0, created: today() });
          save(); App.refresh();
          setTimeout(() => { const n = $('#task-quick'); if (n) n.focus(); }, 30);
        }
      });
    },
  };
});
A['task-mode'] = (el) => { App.taskMode = el.dataset.v; App.refresh(); };
A['task-cat'] = (el) => { App.taskCat = el.dataset.v; App.refresh(); };
A['task-add'] = () => editTask();
A['task-edit'] = (el) => editTask(byId('tasks', el.dataset.id));
A['task-toggle'] = (el) => {
  const t = byId('tasks', el.dataset.id);
  if (!t) return;
  if (t.done) { t.done = false; t.doneAt = null; save(); App.refresh(); return; }
  const later = t.due && t.due > today() ? addDays(t.due, 1) : addDays(today(), 1);
  checkFlow(el, {
    title: t.title,
    laterSub: `Auf ${relDay(later)} (${fmtDS(later)}) verschieben`,
    done: () => taskDone(t),
    postpone: () => { const old = t.due; t.due = later; save(); App.refresh(); UI.toast(`Verschoben auf ${relDay(later)}`, { undo: () => { t.due = old; save(); App.refresh(); } }); },
    edit: () => editTask(t),
    remove: () => deleteWithUndo('tasks', t.id, t.title, { confirm: false }),
  });
};
function taskDone(t) {
  t.done = !t.done;
  t.doneAt = t.done ? new Date().toISOString() : null;
  // Wiederkehrende Aufgabe
  if (t.done && t.repeat && t.due) {
    const next = t.repeat === 'daily' ? addDays(t.due, 1) : t.repeat === 'weekly' ? addDays(t.due, 7) : addMonthsKeep(t.due, 1);
    S.tasks.push({ ...t, id: uid(), done: false, doneAt: null, due: next });
  }
  save(); App.refresh();
  Native.call('vibrate', 15);
  if (t.done) UI.toast('Erledigt ✓', { undo: () => { t.done = false; save(); App.refresh(); } });
}
A['task-clear-done'] = async () => {
  if (!(await UI.confirm('Alle erledigten Aufgaben löschen?', { danger: true, ok: 'Löschen' }))) return;
  const old = S.tasks;
  S.tasks = S.tasks.filter((t) => !t.done);
  save(); App.refresh();
  UI.toast('Gelöscht', { undo: () => { S.tasks = old; save(); App.refresh(); } });
};

function editTask(t, preset = {}) {
  const isNew = !t;
  UI.form({
    title: isNew ? 'Neue Aufgabe' : 'Aufgabe bearbeiten',
    fields: [
      { k: 'title', label: 'Aufgabe', req: true, ph: 'z. B. Klassenarbeit 7a korrigieren' },
      { k: 'due', label: 'Fällig am', type: 'date', half: true },
      { k: 'time', label: 'Uhrzeit', type: 'time', half: true },
      { k: 'prio', label: 'Priorität', type: 'seg', opts: PRIO.map((p) => ({ v: p.v, l: p.l })) },
      { k: 'cat', label: 'Kategorie', type: 'select', half: true, opts: [{ v: '', l: '–' }, ...TASK_CATS.map((c) => ({ v: c, l: c }))] },
      { k: 'classId', label: 'Klasse', type: 'select', half: true, opts: classOptions(true) },
      { k: 'repeat', label: 'Wiederholen', type: 'select', opts: [{ v: '', l: 'Nicht wiederholen' }, { v: 'daily', l: 'Täglich' }, { v: 'weekly', l: 'Wöchentlich' }, { v: 'monthly', l: 'Monatlich' }] },
      { k: 'remind', label: 'Erinnern', type: 'switch', hint: 'Benachrichtigung zum Fälligkeitstermin' },
      { k: 'notes', label: 'Notizen', type: 'textarea', rows: 3 },
    ],
    values: t ? { ...t } : { prio: 0, ...preset },
    onSave: (v) => {
      v.prio = Number(v.prio || 0);
      if (v.remind && !S.settings.remind.on) { S.settings.remind.on = true; requestNotifPermission(); }
      upsert('tasks', { ...(t || { done: false, created: today() }), ...v });
      save(); App.refresh();
    },
    onDelete: isNew ? null : () => deleteWithUndo('tasks', t.id, t.title, { confirm: false }),
  });
}
