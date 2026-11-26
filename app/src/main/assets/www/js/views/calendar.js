/* Kalender & Termine */
'use strict';

function eventItem(e) {
  const t = EVENT_TYPES[e.type] || EVENT_TYPES.termin;
  const multi = e.end && e.end !== e.date;
  return `<div class="li" data-act="event-edit" data-id="${e.id}">
    <div class="li-ic" style="background:${rgba(t.c, .14)};color:${t.c}">${icon(t.i)}</div>
    <div class="li-main"><div class="li-t">${esc(e.title)}</div>
    <div class="li-s">${esc(t.l)}${e.time ? ' · ' + esc(e.time) + (e.endTime ? '–' + esc(e.endTime) : '') + ' Uhr' : ''}${e.place ? ' · ' + esc(e.place) : ''}${e.classId ? ' · ' + esc(cName(e.classId)) : ''}${multi ? ` · bis ${fmtDS(e.end)}` : ''}</div></div>
    <div class="li-end">${relDay(e.date) && e.date >= today() ? `<span class="badge">${e.date === today() ? 'Heute' : fmtDW(e.date)}</span>` : ''}${e.remind !== '' && e.remind != null ? icon('bell') : ''}</div>
  </div>`;
}

/** Alle Einträge eines Tages für den Kalender */
function dayItems(date) {
  const out = [];
  const md = date.slice(5);
  S.events.forEach((e) => {
    if (date >= e.date && date <= (e.end || e.date)) {
      const t = EVENT_TYPES[e.type] || EVENT_TYPES.termin;
      out.push({ k: 'event', c: t.c, html: eventItem(e), sort: e.time || '00:00', hol: e.type === 'ferien' || e.type === 'feiertag' });
    }
  });
  S.assessments.forEach((a) => {
    if (a.date === date) {
      const k = cat(a.catId) || { color: '#888', name: '' };
      out.push({ k: 'exam', c: k.color, sort: '00:01', html: `<div class="li" data-nav="/assessment/${a.id}"><div class="li-ic" style="background:${rgba(k.color, .14)};color:${k.color}">${icon('file-text')}</div><div class="li-main"><div class="li-t">${esc(a.title)}</div><div class="li-s">${esc(k.name)} · ${esc(cName(a.classId))}</div></div></div>` });
    }
  });
  S.homework.forEach((h) => {
    if (h.due === date) out.push({ k: 'hw', c: '#0891b2', sort: '00:02', html: hwItem(h) });
  });
  S.tasks.forEach((t) => {
    if (t.due === date) out.push({ k: 'task', c: '#64748b', sort: t.time || '00:03', html: taskItem(t) });
  });
  S.talks.forEach((t) => {
    if (t.followUp === date && !t.followUpDone) out.push({ k: 'talk', c: '#db2777', sort: '00:04', html: `<div class="li" data-act="talk-edit" data-id="${t.id}"><div class="li-ic">${icon('handshake')}</div><div class="li-main"><div class="li-t">Wiedervorlage: ${esc(sName(stu(t.studentId)))}</div><div class="li-s">${esc(t.topic || '')}</div></div></div>` });
  });
  S.changes.forEach((c) => {
    if (c.date === date) out.push({ k: 'change', c: (CHANGE_TYPES[c.type] || {}).c || '#888', sort: '00:05', html: changeItem(c) });
  });
  S.students.forEach((s) => {
    if (s.birthday && s.birthday.slice(5) === md && cls(s.classId) && !cls(s.classId).archived) {
      out.push({ k: 'bday', c: '#f59e0b', sort: '00:00', html: `<div class="li" data-nav="/student/${s.id}">${UI.avatar(s, 'sm')}<div class="li-main"><div class="li-t">🎂 ${esc(sName(s))}</div><div class="li-s">${esc(cName(s.classId))} · wird ${age(s.birthday, date)}</div></div></div>` });
    }
  });
  return out.sort((a, b) => (a.sort < b.sort ? -1 : 1));
}

App.def('/calendar/:month?', (p) => {
  const mode = App.calMode || 'month';
  const td = today();
  const sel = App.calSel || td;
  const m = p.month && /^\d{4}-\d\d/.test(p.month) ? p.month.slice(0, 7) + '-01' : sel.slice(0, 7) + '-01';
  let h = UI.seg([{ v: 'month', l: 'Monat', i: 'calendar-days' }, { v: 'list', l: 'Liste', i: 'list' }], mode, 'cal-mode');
  if (mode === 'month') {
    const d0 = pd(m);
    h += `<div class="cal-head"><button class="btn btn-icon" data-nav="/calendar/${addMonths(m, -1)}" data-root>${icon('chevron-left')}</button>
      <h3>${MONTHS[d0.getMonth()]} ${d0.getFullYear()}</h3>
      ${m !== td.slice(0, 7) + '-01' ? `<button class="btn btn-sm btn-soft" data-act="cal-today">Heute</button>` : ''}
      <button class="btn btn-icon" data-nav="/calendar/${addMonths(m, 1)}" data-root>${icon('chevron-right')}</button></div>`;
    h += `<div class="cal">${WDS.map((w) => `<div class="cal-wd">${w}</div>`).join('')}`;
    const start = weekStart(m);
    const endM = addDays(addMonths(m, 1), -1);
    const end = addDays(weekStart(endM), 6);
    for (let d = start; d <= end; d = addDays(d, 1)) {
      const items = dayItems(d);
      const hol = items.some((x) => x.hol);
      const dots = [...new Set(items.filter((x) => !x.hol).map((x) => x.c))].slice(0, 4);
      h += `<button class="cal-d ${d.slice(0, 7) !== m.slice(0, 7) ? 'out' : ''} ${dow(d) >= 5 ? 'we' : ''} ${hol ? 'hol' : ''} ${d === td ? 'today' : ''} ${d === sel ? 'sel' : ''}" data-act="cal-sel" data-d="${d}"><span class="n">${pd(d).getDate()}</span><span class="cal-dots">${dots.map((c) => `<i style="background:${c}"></i>`).join('')}</span></button>`;
    }
    h += '</div>';
    // Tagesansicht
    const items = dayItems(sel);
    const lessons = lessonsOn(sel).filter((l) => !l.holiday);
    h += `<div class="card pad0"><div class="card-h"><h3>${icon('calendar')}${fmtDL(sel)}</h3><button class="link" data-act="event-add" data-d="${sel}">${icon('plus')}</button></div>
      ${lessons.length ? `<div class="li" data-nav="/timetable/${weekStart(sel)}" data-root><div class="li-ic">${icon('clock')}</div><div class="li-main"><div class="li-t">${plural(lessons.filter((l) => !l.cancelled).length, 'Unterrichtsstunde', 'Unterrichtsstunden')}</div><div class="li-s">${esc(lessons.map((l) => `${l.period + 1}. ${cName(l.classId) !== '–' ? cName(l.classId) : (l.note || '')}`).join(' · '))}</div></div>${icon('chevron-right', 'chev')}</div>` : ''}
      <div class="list">${items.map((x) => x.html).join('') || (lessons.length ? '' : '<div class="li"><div class="li-main muted">Keine Einträge</div></div>')}</div></div>`;
  } else {
    // Liste der nächsten 90 Tage
    let any = false;
    for (let i = 0; i < 90; i++) {
      const d = addDays(td, i);
      const items = dayItems(d).filter((x) => !(x.hol && i > 0 && dayItems(addDays(d, -1)).some((y) => y.hol)));
      if (!items.length) continue;
      any = true;
      h += `<div class="section-title">${i === 0 ? 'Heute' : i === 1 ? 'Morgen' : ''} ${fmtDW(d)}</div><div class="card pad0"><div class="list">${items.map((x) => x.html).join('')}</div></div>`;
    }
    if (!any) h += UI.empty('calendar', 'Keine Einträge in den nächsten 90 Tagen.');
  }
  return {
    title: 'Kalender', tab: 'calendar', icon: 'calendar', html: h,
    actions: [{ icon: 'ellipsis', act: 'cal-menu', label: 'Mehr' }],
    fab: { act: 'event-add', label: 'Termin' },
  };
});
A['cal-mode'] = (el) => { App.calMode = el.dataset.v; App.refresh(); };
A['cal-sel'] = (el) => {
  App.calSel = el.dataset.d;
  const m = el.dataset.d.slice(0, 7) + '-01';
  App.navigate('/calendar/' + m, { root: true });
};
A['cal-today'] = () => { App.calSel = today(); App.navigate('/calendar', { root: true }); };
A['cal-menu'] = () => UI.menu('Kalender', [
  { l: 'Ferien eintragen', i: 'umbrella', fn: () => editEvent(null, { type: 'ferien' }) },
  { l: 'Feiertag / unterrichtsfrei', i: 'flag', fn: () => editEvent(null, { type: 'feiertag' }) },
  { l: 'Alle Ferien & freien Tage', i: 'list', fn: () => App.navigate('/holidays') },
  { l: 'Als Kalenderdatei (.ics) exportieren', i: 'download', s: 'Termine und Prüfungen für Google/Outlook', fn: exportICS },
]);
A['event-add'] = (el) => editEvent(null, { date: (el && el.dataset && el.dataset.d) || App.calSel || today() });
A['event-edit'] = (el) => editEvent(byId('events', el.dataset.id));

function editEvent(e, preset = {}) {
  const isNew = !e;
  UI.form({
    title: isNew ? (preset.type === 'ferien' ? 'Ferien eintragen' : 'Neuer Termin') : 'Termin bearbeiten',
    fields: [
      { k: 'title', label: 'Titel', req: true, ph: preset.type === 'ferien' ? 'z. B. Herbstferien' : 'z. B. Zeugniskonferenz' },
      { k: 'type', label: 'Art', type: 'select', opts: Object.entries(EVENT_TYPES).map(([v, t]) => ({ v, l: t.l })) },
      { k: 'date', label: 'Datum (von)', type: 'date', req: true, half: true },
      { k: 'end', label: 'bis (optional)', type: 'date', half: true },
      { k: 'time', label: 'Beginn', type: 'time', half: true },
      { k: 'endTime', label: 'Ende', type: 'time', half: true },
      { k: 'place', label: 'Ort', ph: 'z. B. Lehrerzimmer, Aula' },
      { k: 'classId', label: 'Klasse (optional)', type: 'select', opts: classOptions(true) },
      { k: 'remind', label: 'Erinnerung', type: 'select', opts: [{ v: '', l: 'Keine' }, { v: '0', l: 'Zum Beginn' }, { v: '15', l: '15 Minuten vorher' }, { v: '30', l: '30 Minuten vorher' }, { v: '60', l: '1 Stunde vorher' }, { v: '1440', l: '1 Tag vorher' }, { v: '2880', l: '2 Tage vorher' }, { v: '10080', l: '1 Woche vorher' }] },
      { k: 'notes', label: 'Notizen', type: 'textarea', rows: 3 },
    ],
    values: e ? { ...e, remind: e.remind == null ? '' : String(e.remind) } : { type: 'termin', date: today(), remind: '', ...preset },
    onSave: (v) => {
      if (v.end && v.end < v.date) { UI.toast('„bis" liegt vor dem Startdatum', { type: 'err' }); return false; }
      if (v.remind !== '' && !S.settings.remind.on) { S.settings.remind.on = true; requestNotifPermission(); }
      upsert('events', { ...(e || {}), ...v });
      save(); App.refresh(); UI.toast('Gespeichert');
    },
    onDelete: isNew ? null : () => deleteWithUndo('events', e.id, e.title, { confirm: false }),
  });
}

App.def('/holidays', () => {
  const list = sortBy(S.events.filter((e) => e.type === 'ferien' || e.type === 'feiertag'), 'date');
  let h = `<p class="muted small" style="margin:0 4px 12px">In Ferien und an freien Tagen wird kein Unterricht im Stundenplan angezeigt. Trage hier die Ferientermine deines Bundeslandes ein.</p>`;
  h += list.length ? `<div class="card pad0"><div class="list">${list.map(eventItem).join('')}</div></div>` : UI.empty('umbrella', 'Noch keine Ferien eingetragen.');
  return { title: 'Ferien & freie Tage', tab: 'calendar', html: h, fab: { act: 'holiday-add', label: 'Ferien' } };
});
A['holiday-add'] = () => editEvent(null, { type: 'ferien' });

function icsDate(d, t) {
  const x = d.replace(/-/g, '');
  return t ? `${x}T${t.replace(':', '')}00` : x;
}
function exportICS() {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//SchulOrga//DE', 'CALSCALE:GREGORIAN'];
  const escI = (s) => String(s || '').replace(/[\\;,]/g, (c) => '\\' + c).replace(/\n/g, '\\n');
  const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
  const push = (id, title, date, end, time, endTime, desc, place) => {
    lines.push('BEGIN:VEVENT', `UID:${id}@schulorga`, `DTSTAMP:${stamp}`, `SUMMARY:${escI(title)}`);
    if (time) {
      lines.push(`DTSTART:${icsDate(date, time)}`, `DTEND:${icsDate(end || date, endTime || mint(tmin(time) + 60))}`);
    } else {
      lines.push(`DTSTART;VALUE=DATE:${icsDate(date)}`, `DTEND;VALUE=DATE:${icsDate(addDays(end || date, 1))}`);
    }
    if (desc) lines.push(`DESCRIPTION:${escI(desc)}`);
    if (place) lines.push(`LOCATION:${escI(place)}`);
    lines.push('END:VEVENT');
  };
  S.events.forEach((e) => push(e.id, e.title, e.date, e.end, e.time, e.endTime, e.notes, e.place));
  S.assessments.filter((a) => a.date).forEach((a) => push(a.id, `${a.title} (${cName(a.classId)})`, a.date, null, null, null, a.notes, ''));
  lines.push('END:VCALENDAR');
  Files.save(`SchulOrga_Termine_${today()}.ics`, 'text/calendar', lines.join('\r\n'));
}
