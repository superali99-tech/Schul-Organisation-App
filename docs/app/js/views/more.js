/* Mehr-Menü & Suche */
'use strict';

App.def('/more', () => {
  const td = today();
  const openTasks = S.tasks.filter((t) => !t.done).length;
  const overdue = S.tasks.filter((t) => !t.done && t.due && t.due < td).length;
  const openHw = S.homework.filter((h) => !h.done).length;
  const fu = S.talks.filter((t) => t.followUp && !t.followUpDone && t.followUp <= td).length;
  const tile = (nav, ic, label, c, badge) => `<button class="tile" data-nav="${nav}" style="--tc:${c};--tc-soft:${rgba(c, .13)}">${badge ? `<span class="badge ${badge.cls || ''}">${badge.v}</span>` : ''}<span class="tile-ic">${icon(ic)}</span>${label}</button>`;
  const h = `<div class="search" data-nav="/search">${icon('search')}<input placeholder="Suchen: Schüler, Klassen, Notizen …" readonly></div>
  <div class="team-tile" data-nav="/team">
    <div class="team-logo">${icon('users')}</div>
    <div class="sp"><b>Kollegium</b><span>${Team.on() ? esc(S.team.name) + ' · ' + plural(S.team.members.length, 'Mitglied', 'Mitglieder') : 'Kolleg:innen einladen & zusammenarbeiten'}</span></div>
    ${Team.on() && S.team.posts.some((x) => x.by !== S.team.me && (x.updatedAt || 0) > (S.team.seenPosts || 0)) ? '<span class="badge red">Neu</span>' : ''}${icon('chevron-right')}
  </div>
  <div class="team-tile lead-tile ${Leader.active() ? 'on' : ''}" data-nav="/leader">
    <div class="team-logo">${icon('crown')}</div>
    <div class="sp"><b>${Leader.active() ? 'Schulleitung · Cockpit' : 'Schulleitermodus'}</b><span>${Leader.active() ? 'Termine & Mitteilungen für alle, Abwesenheiten, Jahresplanung' : 'Anmelden für die Schulleitung'}</span></div>
    ${Leader.active() ? '<span class="badge lead">Aktiv</span>' : ''}${icon('chevron-right')}
  </div>
  <div class="section-title">Organisation</div>
  <div class="tiles">
    ${tile('/tasks', 'list-todo', 'Aufgaben', '#4f46e5', openTasks ? { v: openTasks, cls: overdue ? 'red' : 'acc' } : null)}
    ${tile('/homework', 'book-open', 'Hausaufgaben', '#0891b2', openHw ? { v: openHw, cls: 'acc' } : null)}
    ${tile('/notes', 'sticky-note', 'Notizen', '#ca8a04')}
    ${tile('/planning', 'notebook-pen', 'Klassenbuch & Planung', '#16a34a')}
    ${tile('/talks', 'handshake', 'Eltern&shy;gespräche', '#db2777', fu ? { v: fu, cls: 'red' } : null)}
    ${tile('/changes', 'replace', 'Vertretungen', '#9333ea')}
    ${tile('/overview/exams', 'file-text', 'Prüfungen', '#dc2626')}
    ${tile('/overview/stats', 'chart-column', 'Statistik', '#0d9488')}
    ${tile('/holidays', 'umbrella', 'Ferien', '#0d9488')}
  </div>
  <div class="section-title">Werkzeuge für den Unterricht</div>
  <div class="tiles">${TOOLS.map((t) => tile('/tool/' + t.id, t.i, esc(t.l), t.c)).join('')}</div>
  <div class="section-title">App</div>
  <div class="tiles">
    ${tile('/update', 'refresh-cw', 'App-Updates', '#8b5cf6', Update.info ? { v: 'Neu', cls: 'red' } : null)}
    ${tile('/settings', 'settings', 'Einstellungen', '#64748b')}
    ${tile('/settings/backup', 'database', 'Datensicherung', '#2563eb', !S.settings.lastBackup && S.students.length ? { v: '!', cls: 'red' } : null)}
    ${tile('/about', 'info', 'Über die App', '#64748b')}
  </div>`;
  return { title: 'Mehr', tab: 'more', icon: 'layout-grid', html: h };
});

// ------------------------------------------------------------------ Prüfungsübersicht
App.def('/overview/exams', () => {
  const td = today();
  const list = S.assessments.filter((a) => (cat(a.catId) || {}).exam);
  const up = sortBy(list.filter((a) => a.date && a.date >= td), 'date');
  const past = sortBy(list.filter((a) => !a.date || a.date < td), 'date').reverse();
  const toGrade = past.filter((a) => { const st = assessmentStats(a); return st.n < studentsOf(a.classId).length; });
  let h = '';
  if (!list.length) h = UI.empty('file-text', 'Noch keine Prüfungen geplant.', `<button class="btn btn-primary" data-act="exam-add">${icon('plus')}Prüfung planen</button>`);
  if (up.length) h += `<div class="section-title">${icon('calendar-clock')}Anstehend</div><div class="card pad0"><div class="list">${up.map((a) => assessmentItem(a).replace('<div class="li-main"><div class="li-t">', `<div class="li-main"><div class="li-t">${esc(cName(a.classId))}: `)).join('')}</div></div>`;
  if (toGrade.length) h += `<div class="section-title">${icon('pen-line')}Noch nicht vollständig bewertet</div><div class="card pad0"><div class="list">${toGrade.map((a) => assessmentItem(a).replace('<div class="li-main"><div class="li-t">', `<div class="li-main"><div class="li-t">${esc(cName(a.classId))}: `)).join('')}</div></div>`;
  const doneList = past.filter((a) => !toGrade.includes(a));
  if (doneList.length) h += `<div class="section-title">${icon('circle-check')}Abgeschlossen</div><div class="card pad0"><div class="list">${doneList.slice(0, 40).map((a) => assessmentItem(a).replace('<div class="li-main"><div class="li-t">', `<div class="li-main"><div class="li-t">${esc(cName(a.classId))}: `)).join('')}</div></div>`;
  return { title: 'Prüfungen', tab: 'more', html: h, fab: { act: 'exam-add', label: 'Prüfung' } };
});
A['exam-add'] = async () => {
  const cid = await UI.pickClass();
  if (!cid) return;
  editAssessment(null, { classId: cid, subjectId: (subjectsOf(cid)[0] || {}).id || '', catId: (S.categories.find((c) => c.exam) || S.categories[0] || {}).id, date: addDays(today(), 7) });
};

// ------------------------------------------------------------------ Statistik
App.def('/overview/stats', () => {
  const cl = activeClasses();
  if (!cl.length) return { title: 'Statistik', tab: 'more', html: UI.empty('chart-column', 'Noch keine Daten.') };
  const td = today();
  const lessonsHeld = S.lessons.filter((l) => l.status === 'gehalten' && l.date <= td).length;
  let h = UI.stats([
    { v: cl.length, l: 'Klassen' },
    { v: S.students.filter((s) => cl.some((c) => c.id === s.classId)).length, l: 'Schüler:innen' },
    { v: S.assessments.length, l: 'Leistungsnachw.' },
    { v: sum(S.assessments.map((a) => Object.values(a.grades || {}).filter((g) => g.v != null).length)), l: 'Noten erfasst' },
    { v: lessonsHeld, l: 'Stunden dokumentiert' },
    { v: S.timetable.filter((t) => t.classId).length, l: 'Wochenstunden' },
  ]);
  h += `<div class="section-title">${icon('award')}Leistung je Klasse</div><div class="card pad0"><div class="list">${cl.map((c) => {
    const gs = gsOf(c.id);
    const a = classAvg(c);
    const studs = studentsOf(c.id);
    const fail = studs.filter((s) => gs.failing(studentAverage(s.id, c.id).avg)).length;
    return `<div class="li" data-nav="/class/${c.id}/grades"><i class="dot" style="background:${classColor(c)};width:12px;height:12px"></i><div class="li-main"><div class="li-t">${esc(c.name)}</div><div class="li-s">${studs.length} Schüler:innen${fail ? ` · <span class="danger">${fail} gefährdet</span>` : ''}</div></div>${avgBadge(gs, a)}</div>`;
  }).join('')}</div></div>`;
  // Gefährdete Schüler:innen
  const risk = [];
  cl.forEach((c) => studentsOf(c.id).forEach((s) => {
    const gs = gsOf(c.id);
    const a = studentAverage(s.id, c.id).avg;
    const at = attStats(s.id);
    if (gs.failing(a) || at.f >= 3 || at.absent >= 15) risk.push({ s, c, a, at, gs });
  }));
  if (risk.length) {
    h += `<div class="section-title">${icon('triangle-alert')}Auffälligkeiten</div><div class="card pad0"><div class="list">${risk.map(({ s, c, a, at, gs }) => `<div class="li" data-nav="/student/${s.id}">${UI.avatar(s, 'sm')}<div class="li-main"><div class="li-t">${esc(sName(s))}</div><div class="li-s">${esc(c.name)}${gs.failing(a) ? ' · Note gefährdet' : ''}${at.f >= 3 ? ` · ${at.f} unentsch. Fehlst.` : ''}${at.absent >= 15 ? ` · ${at.absent} Fehlst.` : ''}</div></div>${avgBadge(gs, a)}</div>`).join('')}</div></div>`;
  }
  // Anwesenheit
  h += `<div class="section-title">${icon('user-check')}Anwesenheit je Klasse</div><div class="card">${cl.map((c) => {
    const studs = studentsOf(c.id);
    const recs = S.attendance.filter((r) => r.classId === c.id);
    const slots = recs.length * studs.length;
    const absent = sum(recs.map((r) => Object.values(r.e || {}).filter((x) => x.s === 'f' || x.s === 'e').length));
    const pct = slots ? (100 * (slots - absent)) / slots : null;
    return `<div class="row" style="margin-bottom:10px"><span style="width:70px" class="b ellip">${esc(c.name)}</span><div class="progress sp" style="height:10px"><i style="width:${pct ?? 0}%;background:${pct == null ? 'var(--line)' : pct > 95 ? 'var(--ok)' : pct > 90 ? 'var(--warn)' : 'var(--danger)'}"></i></div><span class="small" style="width:52px;text-align:right">${pct != null ? fmtNumShort(pct, 1) + ' %' : '–'}</span></div>`;
  }).join('')}</div>`;
  return { title: 'Statistik', tab: 'more', html: h };
});

// ------------------------------------------------------------------ Suche
App.def('/search', () => ({
  title: 'Suche', tab: 'more',
  html: `<div class="search">${icon('search')}<input id="q" placeholder="Name, Klasse, Notiz, Aufgabe …" value="${esc(App.searchQ || '')}" data-input="search"></div><div id="results"></div>`,
  mount: (el) => { const q = el.querySelector('#q'); setTimeout(() => q.focus(), 50); runSearch(q.value); },
}));
A['search'] = (el) => { App.searchQ = el.value; runSearch(el.value); };
function runSearch(qs) {
  const box = $('#results');
  if (!box) return;
  const q = qs.trim().toLowerCase();
  if (q.length < 2) { box.innerHTML = '<p class="muted center small">Mindestens 2 Zeichen eingeben.</p>'; return; }
  const m = (s) => (s || '').toLowerCase().includes(q);
  const sec = (title, items) => (items.length ? `<div class="section-title">${title} <span class="badge">${items.length}</span></div><div class="card pad0"><div class="list">${items.slice(0, 30).join('')}</div></div>` : '');
  const studs = S.students.filter((s) => m(sName(s)) || m(s.tags) || m(s.parentName)).map((s) => `<div class="li" data-nav="/student/${s.id}">${UI.avatar(s, 'sm')}<div class="li-main"><div class="li-t">${esc(sName(s))}</div><div class="li-s">${esc(cName(s.classId))}</div></div></div>`);
  const classes = S.classes.filter((c) => m(c.name) || m(c.notes)).map(classCard);
  const notes = S.notes.filter((n) => m(n.title) || m(n.body)).map((n) => `<div class="li" data-act="note-open" data-id="${n.id}"><div class="li-ic">${icon('sticky-note')}</div><div class="li-main"><div class="li-t">${esc(n.title || 'Notiz')}</div><div class="li-s">${esc((n.body || '').slice(0, 80))}</div></div></div>`);
  const tasks = S.tasks.filter((t) => m(t.title) || m(t.notes)).map(taskItem);
  const events = S.events.filter((e) => m(e.title) || m(e.notes) || m(e.place)).map(eventItem);
  const lessons = S.lessons.filter((l) => m(l.topic) || m(l.content)).map(lessonEntryItem);
  const assessments = S.assessments.filter((a) => m(a.title) || m(a.notes)).map((a) => assessmentItem(a));
  const hw = S.homework.filter((x) => m(x.title) || m(x.desc)).map(hwItem);
  const html = sec('Schüler:innen', studs) + sec('Klassen', classes) + sec('Leistungsnachweise', assessments) + sec('Notizen', notes) + sec('Aufgaben', tasks) + sec('Termine', events) + sec('Klassenbuch', lessons) + sec('Hausaufgaben', hw);
  box.innerHTML = html || UI.empty('search', `Nichts gefunden für „${esc(qs)}".`);
}
