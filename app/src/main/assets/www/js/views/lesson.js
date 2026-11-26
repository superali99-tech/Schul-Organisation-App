/* Einzelne Unterrichtsstunde: Klassenbuch, Anwesenheit, Mitarbeit, Hausaufgaben */
'use strict';

function ensureLessonEntry(classId, subjectId, date, period) {
  let e = S.lessons.find((x) => x.classId === classId && x.date === date && (x.period ?? null) === (period ?? null));
  if (!e) {
    e = { id: uid(), classId, subjectId: subjectId || '', date, period, topic: '', content: '', homework: '', notes: '', materials: '', status: 'gehalten', unitId: '' };
    S.lessons.push(e);
  }
  return e;
}

App.def('/lesson/:date/:period', (p) => {
  const date = p.date;
  const period = Number(p.period);
  const l = lessonAt(date, period);
  const per = periodTime(period) || { s: '', e: '' };
  if (!l) {
    return {
      title: `${period + 1}. Stunde`, sub: fmtDL(date), tab: 'timetable',
      html: UI.empty('calendar-x', 'An diesem Termin ist keine Stunde eingetragen.', `<button class="btn btn-primary" data-act="tt-add" data-day="${dow(date)}" data-period="${period}">${icon('plus')}Stunde eintragen</button>`),
    };
  }
  const c = cls(l.classId);
  const entry = c ? lessonEntry(c.id, date, period) : null;
  const room = l.roomChange || l.room || (c && c.room) || '';
  let h = '';

  // Kopf
  const col = subjectColor(l.subjectId, l.classId);
  h += `<div class="card" style="border-left:5px solid ${col}">
    <div class="row"><div class="sp"><div class="b" style="font-size:1.15rem">${esc(lessonLabel(l))}</div>
    <div class="muted small">${fmtDW(date)} · ${period + 1}. Stunde · ${esc(per.s)}–${esc(per.e)}${room ? ' · Raum ' + esc(room) : ''}${l.roomChange ? ' (geändert)' : ''}</div></div>
    ${c ? `<button class="btn btn-icon btn-soft" data-nav="/class/${c.id}" aria-label="Klasse öffnen">${icon('users')}</button>` : ''}</div>
    ${l.cancelled ? `<div class="banner err mt" style="margin-bottom:0">${icon('ban')}<div><b>Diese Stunde entfällt.</b>${l.cancelled.note ? '<br>' + esc(l.cancelled.note) : ''}</div></div>` : ''}
    ${l.extra ? `<div class="banner mt" style="margin-bottom:0">${icon('replace')}<div><b>${esc(CHANGE_TYPES[l.change.type].l)}</b>${l.change.note ? '<br>' + esc(l.change.note) : ''}</div></div>` : ''}
    ${l.holiday ? `<div class="banner ok mt" style="margin-bottom:0">${icon('umbrella')}<div>${esc(l.holiday.title)} – unterrichtsfrei</div></div>` : ''}
  </div>`;

  if (!c) {
    h += `<div class="card"><p class="text2">${esc(l.note || 'Termin ohne Klasse')}</p></div>`;
    return { title: lessonLabel(l), sub: fmtDW(date), tab: 'timetable', html: h };
  }

  // Letzte Stunde
  const prev = prevLessonEntry(c.id, date, l.subjectId);
  if (prev) {
    h += `<div class="banner">${icon('history')}<div><b>Letzte Stunde (${fmtDW(prev.date)}):</b> ${esc(prev.topic || '–')}${prev.homework ? `<br><span class="text2">HA: ${esc(prev.homework)}</span>` : ''}</div></div>`;
  }
  // Reihe
  const unit = S.units.find((u) => u.classId === c.id && u.start && u.start <= date && (!u.end || u.end >= date));
  // Prüfung
  const exam = sortBy(S.assessments.filter((a) => a.classId === c.id && a.date && a.date >= date && (cat(a.catId) || {}).exam), 'date')[0];
  if (exam) {
    const dd = daysBetween(date, exam.date);
    h += `<div class="banner ${dd <= 3 ? 'warn' : ''}" data-nav="/assessment/${exam.id}">${icon('file-text')}<div><b>${esc(exam.title)}</b> ${dd === 0 ? 'heute' : `in ${plural(dd, 'Tag', 'Tagen')}`} (${fmtDW(exam.date)})</div></div>`;
  }

  // Klassenbuch
  const e = entry || { topic: '', content: '', homework: '', notes: '', status: 'gehalten' };
  h += `<div class="card"><div class="card-h"><h3>${icon('notebook-pen')}Klassenbuch</h3>${unit ? `<span class="badge acc">${icon('layers')}${esc(unit.title)}</span>` : ''}</div>
    <div class="col">
      <label class="field"><span>Thema der Stunde</span><input class="inline-input" data-input="lesson-field" data-k="topic" data-c="${c.id}" data-s="${l.subjectId || ''}" data-d="${date}" data-p="${period}" value="${esc(e.topic)}" placeholder="z. B. Einführung Bruchrechnung"></label>
      <label class="field"><span>Inhalt / Verlauf / Notizen</span><textarea class="inline-input" data-input="lesson-field" data-k="content" data-c="${c.id}" data-s="${l.subjectId || ''}" data-d="${date}" data-p="${period}" placeholder="Was wurde gemacht? Besonderheiten?">${esc(e.content)}</textarea></label>
      <div class="field"><span>Status</span>${UI.seg(Object.entries(LESSON_STATUS).map(([v, t]) => ({ v, l: t })), e.status || 'gehalten', 'lesson-status', `data-c="${c.id}" data-s="${l.subjectId || ''}" data-d="${date}" data-p="${period}"`)}</div>
    </div>
  </div>`;

  // Hausaufgabe aufgeben
  const hw = entry && entry.hwId ? byId('homework', entry.hwId) : null;
  const nextD = nextLessonDate(c.id, date, l.subjectId);
  h += `<div class="card"><div class="card-h"><h3>${icon('book-open')}Hausaufgabe aufgeben</h3></div>
    ${hw ? `<div class="li tap" data-act="hw-edit" data-id="${hw.id}" style="margin:0 -14px;border-top:1px solid var(--line)"><div class="li-ic">${icon('check')}</div><div class="li-main"><div class="li-t">${esc(hw.title)}</div><div class="li-s">fällig ${fmtDW(hw.due)} (${relDay(hw.due)})</div></div>${icon('chevron-right', 'chev')}</div>` : `
    <div class="col">
      <textarea class="inline-input" id="hw-text" placeholder="z. B. S. 45, Nr. 3–5">${esc(e.homework || '')}</textarea>
      <div class="row"><label class="field sp"><span>Fällig am</span><input type="date" class="inline-input" id="hw-due" value="${nextD}"></label>
      <button class="btn btn-primary" style="align-self:flex-end" data-act="lesson-hw" data-c="${c.id}" data-s="${l.subjectId || ''}" data-d="${date}" data-p="${period}">${icon('plus')}Aufgeben</button></div>
      <small class="muted">Standard: nächste Stunde dieser Klasse (${fmtDW(nextD)})</small>
    </div>`}
  </div>`;

  // Fällige HA
  const due = S.homework.filter((x) => x.classId === c.id && x.due === date);
  if (due.length) {
    h += `<div class="card"><div class="card-h"><h3>${icon('clipboard-check')}Heute fällige Hausaufgaben</h3></div><div class="list">${due.map((x) => {
      const missing = S.observations.filter((o) => o.kind === 'ha' && o.hwId === x.id).length;
      return `<div class="li"><div class="li-main"><div class="li-t wrap">${esc(x.title)}</div><div class="li-s">${missing ? `${missing} × nicht gemacht` : 'Noch nicht kontrolliert'}</div></div><button class="btn btn-sm btn-soft" data-act="hw-check" data-id="${x.id}">${icon('user-x')}Kontrolle</button></div>`;
    }).join('')}</div></div>`;
  }

  // Anwesenheit
  const rec = attRecord(c.id, date, period) || attRecord(c.id, date, null);
  const studs = studentsOf(c.id);
  const absent = rec ? Object.values(rec.e || {}).filter((x) => x.s === 'f' || x.s === 'e').length : 0;
  const late = rec ? Object.values(rec.e || {}).filter((x) => x.s === 'v').length : 0;
  h += `<div class="card"><div class="card-h"><h3>${icon('user-check')}Anwesenheit</h3><button class="link" data-nav="/attendance/${c.id}/${date}/${period}">${rec ? 'Bearbeiten' : 'Erfassen'}</button></div>
    ${rec ? UI.stats([{ v: studs.length - absent, l: 'anwesend', c: 'var(--ok)' }, { v: absent, l: 'fehlen', c: absent ? 'var(--danger)' : '' }, { v: late, l: 'verspätet', c: late ? 'var(--warn)' : '' }])
    : `<button class="btn btn-block btn-soft" data-act="att-all-present" data-c="${c.id}" data-d="${date}" data-p="${period}">${icon('circle-check')}Alle anwesend</button>`}
  </div>`;

  // Mitarbeit
  if (studs.length) {
    const ab = absentOn(c.id, date);
    h += `<div class="card"><div class="card-h"><h3>${icon('thumbs-up')}Mitarbeit & Beobachtungen</h3><button class="link" data-nav="/tool/random/${c.id}">${icon('shuffle')}</button></div>
      <div class="list">${studs.map((s) => {
        const today_ = S.observations.filter((o) => o.studentId === s.id && o.date === date);
        const plus = today_.filter((o) => o.kind === 'plus').length;
        const minus = today_.filter((o) => o.kind === 'minus').length;
        const other = today_.filter((o) => o.kind !== 'plus' && o.kind !== 'minus');
        return `<div class="li" style="${ab.has(s.id) ? 'opacity:.45' : ''}">${UI.avatar(s, 'sm')}
          <div class="li-main" data-nav="/student/${s.id}"><div class="li-t">${esc(sName(s))}</div>${other.length ? `<div class="li-s">${other.map((o) => esc(OBS_KINDS[o.kind].l)).join(', ')}</div>` : ''}</div>
          <div class="obs-btns">
            <button class="obs-btn plus" data-act="obs-quick" data-k="plus" data-sid="${s.id}" data-d="${date}">${icon('plus')}${plus ? `<sup>${plus}</sup>` : ''}</button>
            <button class="obs-btn minus" data-act="obs-quick" data-k="minus" data-sid="${s.id}" data-d="${date}">${icon('minus')}${minus ? `<sup>${minus}</sup>` : ''}</button>
            <button class="obs-btn" data-act="obs-more" data-sid="${s.id}" data-d="${date}">${icon('ellipsis')}</button>
          </div></div>`;
      }).join('')}</div></div>`;
  }

  return {
    title: lessonLabel(l), sub: `${fmtDW(date)} · ${period + 1}. Std.`, tab: 'timetable', html: h,
    actions: [{ icon: 'ellipsis', act: 'lesson-menu', id: `${date}|${period}` }],
  };
});

A['lesson-field'] = (el) => {
  const e = ensureLessonEntry(el.dataset.c, el.dataset.s, el.dataset.d, Number(el.dataset.p));
  e[el.dataset.k] = el.value;
  save();
};
A['lesson-status'] = (el) => {
  const box = el.closest('.seg');
  const e = ensureLessonEntry(box.dataset.c, box.dataset.s, box.dataset.d, Number(box.dataset.p));
  e.status = el.dataset.v;
  save();
  App.refresh();
};
A['lesson-hw'] = (el) => {
  const text = $('#hw-text').value.trim();
  const due = $('#hw-due').value;
  if (!text) { UI.toast('Bitte die Hausaufgabe eingeben', { type: 'err' }); return; }
  const e = ensureLessonEntry(el.dataset.c, el.dataset.s, el.dataset.d, Number(el.dataset.p));
  const hw = upsert('homework', { classId: el.dataset.c, subjectId: el.dataset.s, title: text, desc: '', given: el.dataset.d, due, done: false });
  e.homework = text;
  e.hwId = hw.id;
  save();
  App.refresh();
  UI.toast('Hausaufgabe gespeichert');
};
A['att-all-present'] = (el) => {
  const p = el.dataset.p === '' || el.dataset.p == null ? null : Number(el.dataset.p);
  upsert('attendance', { classId: el.dataset.c, date: el.dataset.d, period: p, e: {} });
  save();
  App.refresh();
  UI.toast('Alle anwesend gespeichert');
};
A['lesson-menu'] = (el) => {
  const [date, per] = el.dataset.id.split('|');
  const period = Number(per);
  const l = lessonAt(date, period);
  UI.menu('Stunde', [
    l && l.cancelled ? { l: 'Ausfall zurücknehmen', i: 'rotate-ccw', fn: () => { removeById('changes', l.cancelled.id); save(); App.refresh(); } }
      : { l: 'Ausfall eintragen', i: 'ban', fn: () => { upsert('changes', { type: 'ausfall', date, period, classId: l ? l.classId : '', note: '' }); save(); App.refresh(); UI.toast('Als Ausfall markiert'); } },
    { l: 'Raumänderung', i: 'door-open', fn: () => editChange(null, { type: 'raum', date, period, classId: l ? l.classId : '' }) },
    { l: 'Verlegen / tauschen', i: 'arrow-right-left', fn: () => editChange(null, { type: 'verlegung', date, period, classId: l ? l.classId : '' }) },
    l && l.classId ? { l: 'Notiz zur Klasse', i: 'sticky-note', fn: () => editNote(null, { classId: l.classId }) } : null,
    l && l.classId ? { l: 'Leistungsnachweis anlegen', i: 'file-text', fn: () => editAssessment(null, { classId: l.classId, subjectId: l.subjectId, date }) } : null,
    { l: 'Stundenplan-Eintrag bearbeiten', i: 'pencil', fn: () => { const t = S.timetable.find((x) => x.day === dow(date) && x.period === period); if (t) editTimetable(t); else UI.toast('Kein regulärer Eintrag'); } },
  ]);
};

// ------------------------------------------------------------------ Beobachtungen (schnell)
A['obs-quick'] = (el) => {
  const s = stu(el.dataset.sid);
  upsert('observations', { studentId: s.id, classId: s.classId, date: el.dataset.d || today(), kind: el.dataset.k, text: '' });
  save();
  Native.call('vibrate', 15);
  App.refresh();
};
A['obs-more'] = (el) => {
  const s = stu(el.dataset.sid);
  const date = el.dataset.d || today();
  UI.menu(sName(s), [
    ...Object.entries(OBS_KINDS).filter(([k]) => k !== 'plus' && k !== 'minus').map(([k, o]) => ({
      l: o.l, i: o.i, c: o.c, fn: () => {
        if (k === 'note') { addObservation(s, 'note', date); return; }
        upsert('observations', { studentId: s.id, classId: s.classId, date, kind: k, text: '' });
        save(); App.refresh(); UI.toast(`${o.l}: ${sShort(s)}`);
      },
    })),
    { sep: true },
    { l: 'Letzten Eintrag von heute löschen', i: 'rotate-ccw', fn: () => {
      const list = S.observations.filter((o) => o.studentId === s.id && o.date === date);
      const last = list[list.length - 1];
      if (last) { removeById('observations', last.id); save(); App.refresh(); UI.toast('Entfernt'); } else UI.toast('Kein Eintrag von heute');
    } },
    { l: 'Profil öffnen', i: 'user', fn: () => App.navigate('/student/' + s.id) },
  ]);
};
function addObservation(s, kind = 'note', date = today(), o = null) {
  UI.form({
    title: o ? 'Beobachtung bearbeiten' : `Beobachtung: ${sShort(s)}`,
    fields: [
      { k: 'kind', label: 'Art', type: 'select', opts: Object.entries(OBS_KINDS).map(([v, x]) => ({ v, l: x.l })) },
      { k: 'date', label: 'Datum', type: 'date' },
      { k: 'text', label: 'Text', type: 'textarea', ph: 'Was ist dir aufgefallen?' },
    ],
    values: o ? { ...o } : { kind, date, text: '' },
    onSave: (v) => { upsert('observations', { ...(o || {}), studentId: s.id, classId: s.classId, ...v }); save(); App.refresh(); },
    onDelete: o ? () => deleteWithUndo('observations', o.id, 'Beobachtung', { confirm: false }) : null,
  });
}
