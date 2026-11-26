/* Stundenplan & Stundenplan-Änderungen */
'use strict';

function periodOptions() {
  return S.settings.periods.map((p, i) => ({ v: i, l: `${i + 1}. Stunde (${p.s}–${p.e})` }));
}
function dayOptions() {
  return WD.slice(0, S.settings.days).map((d, i) => ({ v: i, l: d }));
}

App.def('/timetable/:week?', (p) => {
  const st = S.settings;
  const ws = p.week && /^\d{4}-\d\d-\d\d$/.test(p.week) ? weekStart(p.week) : weekStart(today());
  const edit = !!App.editMode.tt;
  const days = st.days;
  const td = today();
  const nm = nowMin();
  const wt = weekType(ws);
  const dates = Array.from({ length: days }, (_, i) => addDays(ws, i));
  const cols = `38px repeat(${days}, minmax(0, 1fr))`;
  let html = '';

  if (!S.classes.length) {
    html += `<div class="banner">${icon('info')}<div>Tipp: Lege zuerst deine <a data-nav="/classes">Klassen</a> an, dann kannst du sie im Stundenplan auswählen.</div></div>`;
  }

  html += `<div class="tt-nav">
    <button class="btn btn-icon" data-nav="/timetable/${addDays(ws, -7)}" data-root aria-label="Vorherige Woche">${icon('chevron-left')}</button>
    <div class="tt-week">KW ${isoWeek(ws)}${wt ? ` · ${wt}-Woche` : ''}<small>${fmtDS(ws)} – ${fmtD(addDays(ws, days - 1))}</small></div>
    ${ws !== weekStart(td) ? `<button class="btn btn-sm btn-soft" data-nav="/timetable" data-root>Heute</button>` : ''}
    <button class="btn btn-icon" data-nav="/timetable/${addDays(ws, 7)}" data-root aria-label="Nächste Woche">${icon('chevron-right')}</button>
  </div>`;

  if (edit) {
    html += `<div class="banner">${icon('pencil')}<div class="edit-hint"><b>Bearbeiten-Modus</b><br>Tippe auf ein Feld, um eine Stunde anzulegen oder zu ändern. ${st.abWeeks ? 'A/B-Wochen werden mit kleinem Buchstaben angezeigt.' : ''}</div></div>`;
  }

  html += `<div class="tt" style="grid-template-columns:${cols}"><div></div>`;
  dates.forEach((d, i) => {
    const hol = holidayOn(d);
    html += `<div class="tt-h ${d === td ? 'today' : ''}" ${hol ? `title="${esc(hol.title)}"` : ''}>${WDS[i]}<b>${fmtDS(d)}</b></div>`;
  });

  st.periods.forEach((per, pi) => {
    html += `<div class="tt-p"><b>${pi + 1}</b>${esc(per.s)}</div>`;
    dates.forEach((d, di) => {
      const hol = holidayOn(d);
      if (edit) {
        const entries = S.timetable.filter((t) => t.day === di && t.period === pi);
        if (!entries.length) {
          html += `<div class="tt-c" data-act="tt-add" data-day="${di}" data-period="${pi}">${icon('plus')}</div>`;
        } else {
          const t = entries[0];
          const c = cls(t.classId);
          const col = subjectColor(t.subjectId, t.classId);
          html += `<div class="tt-c has" data-act="tt-edit" data-id="${t.id}" style="--cc:${col};--cc-soft:${rgba(col, .16)}">
            ${entries.length > 1 || (t.week && t.week !== 'all') ? `<span class="tt-badge">${entries.map((e) => e.week && e.week !== 'all' ? e.week : '').join('/')}</span>` : ''}
            <b>${esc(c ? c.name : subShort(t.subjectId) || (t.note || '•'))}</b>
            <span class="tt-room">${esc(subShort(t.subjectId))}${t.room ? ' · ' + esc(t.room) : ''}</span></div>`;
        }
        return;
      }
      if (hol) {
        html += `<div class="tt-c holiday" data-act="tt-holiday" data-id="${hol.id}">${pi === 0 ? `<span class="tt-room" style="color:#0d9488">${icon('umbrella')}</span>` : ''}</div>`;
        return;
      }
      const ls = lessonsOn(d).filter((l) => l.period === pi);
      if (!ls.length) {
        html += `<div class="tt-c" data-act="tt-add" data-day="${di}" data-period="${pi}"></div>`;
        return;
      }
      const l = ls.find((x) => !x.cancelled) || ls[0];
      const c = cls(l.classId);
      const col = subjectColor(l.subjectId, l.classId);
      const isNow = d === td && nm >= tmin(per.s) && nm < tmin(per.e);
      const entry = lessonEntry(l.classId, d, pi);
      const room = l.roomChange || l.room || (c && c.room) || '';
      html += `<div class="tt-c has ${d === td ? 'today' : ''} ${isNow ? 'now' : ''} ${l.cancelled ? 'cancel' : ''}" data-nav="/lesson/${d}/${pi}" style="--cc:${col};--cc-soft:${rgba(col, .16)}">
        ${l.extra || l.roomChange ? '<span class="tt-badge">!</span>' : ''}
        <b>${esc(c ? c.name : l.note || (l.change && l.change.note) || subShort(l.subjectId) || '•')}</b>
        <span class="tt-room">${esc(subShort(l.subjectId))}${room ? ' · ' + esc(room) : ''}</span>
        ${entry && entry.topic ? `<span class="tt-done">${icon('check')}</span>` : ''}
      </div>`;
    });
  });
  html += '</div>';

  // Änderungen dieser Woche
  const ch = sortBy(S.changes.filter((c) => c.date >= ws && c.date <= addDays(ws, 6)), 'date', 'period');
  if (ch.length) {
    html += `<div class="section-title">${icon('replace')}Änderungen diese Woche</div><div class="card pad0"><div class="list">${ch.map(changeItem).join('')}</div></div>`;
  }
  const hols = S.events.filter((e) => e.type === 'ferien' && (e.end || e.date) >= ws && e.date <= addDays(ws, 6));
  if (hols.length) html += hols.map((h) => `<div class="banner ok mt">${icon('umbrella')}<div><b>${esc(h.title)}</b><br>${fmtD(h.date)} – ${fmtD(h.end || h.date)}</div></div>`).join('');

  if (!S.timetable.length && !edit) {
    html += `<div class="empty">${icon('calendar-days')}<p>Noch kein Stundenplan. Tippe auf ein leeres Feld oder auf den Stift oben, um Stunden einzutragen.</p>
      <button class="btn btn-primary" data-act="tt-toggle-edit">${icon('pencil')}Stundenplan eintragen</button></div>`;
  }

  return {
    title: 'Stundenplan', sub: st.abWeeks ? 'mit A/B-Wochen' : '', tab: 'timetable', icon: 'calendar-days',
    actions: [
      { icon: edit ? 'check' : 'pencil', act: 'tt-toggle-edit', label: edit ? 'Fertig' : 'Bearbeiten' },
      { icon: 'ellipsis', act: 'tt-menu', label: 'Mehr' },
    ],
    html,
  };
});

A['tt-toggle-edit'] = () => { App.editMode.tt = !App.editMode.tt; App.refresh(); };
A['tt-holiday'] = (el) => { const e = byId('events', el.dataset.id); if (e) editEvent(e); };
A['tt-menu'] = () => UI.menu('Stundenplan', [
  { l: 'Zeiten & Stundenraster', i: 'clock', fn: () => App.navigate('/settings/periods') },
  { l: 'Vertretungen & Änderungen', i: 'replace', fn: () => App.navigate('/changes') },
  { l: 'Änderung eintragen', i: 'plus', fn: () => editChange() },
  { l: 'Stundenplan drucken', i: 'printer', fn: printTimetable },
  { sep: true },
  { l: 'Stundenplan leeren', i: 'trash-2', danger: true, fn: async () => {
    if (!(await UI.confirm('Alle Einträge im Stundenplan löschen?', { danger: true, ok: 'Leeren' }))) return;
    const old = S.timetable; S.timetable = []; save(); App.refresh();
    UI.toast('Stundenplan geleert', { undo: () => { S.timetable = old; save(); App.refresh(); } });
  } },
]);

A['tt-add'] = (el) => editTimetable(null, Number(el.dataset.day), Number(el.dataset.period));
A['tt-edit'] = (el) => editTimetable(byId('timetable', el.dataset.id));

function editTimetable(t, day = 0, period = 0) {
  const isNew = !t;
  const st = S.settings;
  const fields = [
    { k: 'classId', label: 'Klasse / Kurs', type: 'select', opts: classOptions('– ohne Klasse (z. B. Aufsicht, AG) –') },
    { k: 'subjectId', label: 'Fach', type: 'select', opts: subjectOptions(true) },
    { k: 'day', label: 'Tag', type: 'select', opts: dayOptions(), half: true },
    { k: 'period', label: 'Stunde', type: 'select', opts: periodOptions(), half: true },
    { k: 'room', label: 'Raum', ph: 'z. B. 204', half: true },
    { k: 'note', label: 'Bezeichnung (optional)', ph: 'z. B. Pausenaufsicht', half: true },
    st.abWeeks ? { k: 'week', label: 'Rhythmus', type: 'seg', opts: [{ v: 'all', l: 'Jede Woche' }, { v: 'A', l: 'A-Woche' }, { v: 'B', l: 'B-Woche' }] } : null,
    isNew ? { k: 'double', label: 'Doppelstunde', type: 'switch', hint: 'Auch die folgende Stunde eintragen' } : null,
  ];
  UI.form({
    title: isNew ? 'Stunde eintragen' : 'Stunde bearbeiten',
    fields,
    values: t ? { ...t, week: t.week || 'all' } : { day, period, week: 'all', classId: '', subjectId: '' },
    onMount: (el) => {
      const c = el.querySelector('[name=classId]');
      const s = el.querySelector('[name=subjectId]');
      const r = el.querySelector('[name=room]');
      c.addEventListener('change', () => {
        const k = cls(c.value);
        if (k && k.subjects && k.subjects.length && !s.value) s.value = k.subjects[0];
        if (k && k.room && !r.value) r.value = k.room;
      });
    },
    onSave: (v) => {
      if (!v.classId && !v.subjectId && !v.note) { UI.toast('Bitte Klasse, Fach oder Bezeichnung angeben', { type: 'err' }); return false; }
      const entry = { classId: v.classId, subjectId: v.subjectId, day: Number(v.day), period: Number(v.period), room: v.room, note: v.note, week: v.week || 'all' };
      const place = (e) => {
        // Gleicher Platz + gleicher Rhythmus wird ersetzt
        S.timetable = S.timetable.filter((x) => !(x.id !== e.id && x.day === e.day && x.period === e.period && ((x.week || 'all') === e.week || e.week === 'all' || (x.week || 'all') === 'all')));
        upsert('timetable', e);
      };
      if (isNew) {
        place({ ...entry, id: uid() });
        if (v.double && entry.period + 1 < S.settings.periods.length) place({ ...entry, id: uid(), period: entry.period + 1 });
      } else place({ ...t, ...entry });
      save();
      App.refresh();
    },
    onDelete: isNew ? null : () => deleteWithUndo('timetable', t.id, 'Stunde', { confirm: false }),
  });
}

function printTimetable() {
  const st = S.settings;
  const days = st.days;
  let h = `<table class="p-tt"><tr><th style="width:70px">Stunde</th>${WD.slice(0, days).map((d) => `<th>${d}</th>`).join('')}</tr>`;
  st.periods.forEach((p, pi) => {
    h += `<tr><td><b>${pi + 1}.</b><br><span class="p-small">${p.s}–${p.e}</span></td>`;
    for (let d = 0; d < days; d++) {
      const es = S.timetable.filter((t) => t.day === d && t.period === pi);
      h += `<td>${es.map((t) => `<b>${esc(cName(t.classId) !== '–' ? cName(t.classId) : (t.note || ''))}</b> ${esc(subShort(t.subjectId))}${t.room ? `<br><span class="p-small">Raum ${esc(t.room)}</span>` : ''}${t.week && t.week !== 'all' ? ` <span class="p-small">(${t.week})</span>` : ''}`).join('<hr>')}</td>`;
    }
    h += '</tr>';
  });
  h += '</table>';
  Print.show('Stundenplan ' + (st.year || ''), h);
}

// ------------------------------------------------------------------ Änderungen / Vertretungen
function changeItem(c) {
  const t = CHANGE_TYPES[c.type] || CHANGE_TYPES.ausfall;
  const per = c.period != null ? `${Number(c.period) + 1}. Std.` : '';
  return `<div class="li" data-act="change-edit" data-id="${c.id}">
    <div class="li-ic" style="background:${rgba(t.c, .14)};color:${t.c}">${icon(t.i)}</div>
    <div class="li-main"><div class="li-t">${esc(t.l)}${c.classId ? ' · ' + esc(cName(c.classId)) : ''}</div>
    <div class="li-s">${fmtDW(c.date)} · ${per}${c.room ? ' · Raum ' + esc(c.room) : ''}${c.type === 'verlegung' && c.toDate ? ` → ${fmtDW(c.toDate)} ${c.toPeriod != null ? Number(c.toPeriod) + 1 + '. Std.' : ''}` : ''}${c.note ? ' · ' + esc(c.note) : ''}</div></div>
  </div>`;
}

App.def('/changes', () => {
  const td = today();
  const up = sortBy(S.changes.filter((c) => c.date >= td), 'date', 'period');
  const past = sortBy(S.changes.filter((c) => c.date < td), 'date', 'period').reverse();
  let html = `<p class="muted small" style="margin:0 4px 12px">Trage Ausfälle, Raumänderungen, eigene Vertretungsstunden oder Verlegungen ein. Sie erscheinen automatisch im Stundenplan und auf der Startseite.</p>`;
  if (!S.changes.length) html += UI.empty('replace', 'Keine Änderungen eingetragen.');
  if (up.length) html += `<div class="section-title">Anstehend</div><div class="card pad0"><div class="list">${up.map(changeItem).join('')}</div></div>`;
  if (past.length) html += `<div class="section-title">Vergangen</div><div class="card pad0"><div class="list">${past.slice(0, 50).map(changeItem).join('')}</div></div>`;
  return { title: 'Vertretungen & Änderungen', tab: 'timetable', html, fab: { act: 'change-add' } };
});
A['change-add'] = () => editChange();
A['change-edit'] = (el) => editChange(byId('changes', el.dataset.id));

function editChange(c, preset = {}) {
  const isNew = !c;
  UI.form({
    title: isNew ? 'Änderung eintragen' : 'Änderung bearbeiten',
    fields: [
      { k: 'type', label: 'Art', type: 'select', opts: Object.entries(CHANGE_TYPES).map(([v, t]) => ({ v, l: t.l })) },
      { k: 'date', label: 'Datum', type: 'date', req: true, half: true },
      { k: 'period', label: 'Stunde', type: 'select', opts: periodOptions(), half: true },
      { k: 'classId', label: 'Klasse', type: 'select', opts: classOptions(true) },
      { k: 'subjectId', label: 'Fach', type: 'select', opts: subjectOptions(true), half: true },
      { k: 'room', label: 'Raum', half: true },
      { type: 'section', label: 'Nur bei Verlegung' },
      { k: 'toDate', label: 'Neues Datum', type: 'date', half: true },
      { k: 'toPeriod', label: 'Neue Stunde', type: 'select', opts: [{ v: '', l: '–' }, ...periodOptions()], half: true },
      { k: 'note', label: 'Notiz', ph: 'z. B. für Herrn Meier, Aufgaben im Kursraum' },
    ],
    values: c ? { ...c } : { type: 'ausfall', date: today(), period: 0, ...preset },
    onSave: (v) => {
      upsert('changes', { ...(c || {}), ...v, period: Number(v.period), toPeriod: v.toPeriod === '' ? null : Number(v.toPeriod) });
      save(); App.refresh(); UI.toast('Gespeichert');
    },
    onDelete: isNew ? null : () => deleteWithUndo('changes', c.id, 'Änderung', { confirm: false }),
  });
}
