/* Heute – Startseite */
'use strict';

function greeting() {
  const h = now().getHours();
  if (h < 5) return 'Gute Nacht';
  if (h < 11) return 'Guten Morgen';
  if (h < 17) return 'Guten Tag';
  return 'Guten Abend';
}
function holidayCountdown(d, hol) {
  if (hol) return '';
  const next = sortBy(S.events.filter((e) => e.type === 'ferien' && e.date > d), 'date')[0];
  if (!next) return '';
  const n = daysBetween(d, next.date);
  if (n > 70) return '';
  const name = /ferien$/i.test(next.title || '') ? `zu den ${esc(next.title)}` : `: ${esc(next.title || 'Ferien')}`;
  return `<div class="th-count">${icon('umbrella')}${n === 1 ? 'Morgen beginnen die Ferien!' : `Noch ${n} Tage bis ${name}`}</div>`;
}
function teacherName() {
  const st = S.settings;
  return [st.title, st.teacher].filter(Boolean).join(' ');
}

function lessonLabel(l) {
  const c = cls(l.classId);
  const parts = [c ? c.name : (l.change && l.change.note) || 'Stunde'];
  const sn = subName(l.subjectId);
  if (sn) parts.push(sn);
  return parts.join(' · ');
}
function lessonRoom(l) { return l.roomChange || l.room || (cls(l.classId) || {}).room || ''; }

/** Aktuelle / nächste Stunde ermitteln */
function nowNext() {
  const d = today();
  const nm = nowMin();
  const list = lessonsOn(d).filter((l) => !l.cancelled && !l.holiday);
  let cur = null, next = null;
  for (const l of list) {
    const p = periodTime(l.period);
    if (!p) continue;
    const s = tmin(p.s), e = tmin(p.e);
    if (nm >= s && nm < e) cur = { l, s, e };
    else if (nm < s && !next) next = { l, s, e };
  }
  return { cur, next, list };
}

function timelineHTML(date, { compact = false } = {}) {
  const list = lessonsOn(date);
  if (!list.length) return '';
  const isToday = date === today();
  const nm = nowMin();
  return `<div class="tl">${list.map((l) => {
    const p = periodTime(l.period) || {};
    const s = tmin(p.s), e = tmin(p.e);
    const state = isToday ? (nm >= e ? 'past' : nm >= s ? 'now' : '') : '';
    const c = subjectColor(l.subjectId, l.classId);
    const entry = lessonEntry(l.classId, date, l.period);
    const badges = [];
    if (l.cancelled) badges.push(`<span class="badge red">${icon('ban')}Entfällt</span>`);
    if (l.roomChange) badges.push(`<span class="badge orange">${icon('door-open')}${esc(l.roomChange)}</span>`);
    if (l.extra) badges.push(`<span class="badge acc">${esc(CHANGE_TYPES[l.change.type].l.split(' ')[0])}</span>`);
    if (entry && entry.topic) badges.push(`<span class="badge green">${icon('check')}Eingetragen</span>`);
    return `<div class="tl-it ${state} ${l.cancelled ? 'cancel' : ''}" data-nav="/lesson/${date}/${l.period}">
      <div class="tl-time"><b>${l.period + 1}.</b>${esc(p.s || '')}</div>
      <div class="tl-box" style="--c:${c}">
        <div class="tl-t">${esc(lessonLabel(l))}</div>
        <div class="tl-s">${esc([lessonRoom(l) ? 'Raum ' + lessonRoom(l) : '', p.s ? `${p.s}–${p.e}` : ''].filter(Boolean).join(' · '))}${!compact && entry && entry.topic ? ' · ' + esc(entry.topic) : ''}</div>
        ${badges.length ? `<div class="row row-wrap" style="gap:4px;margin-top:4px">${badges.join('')}</div>` : ''}
      </div>
    </div>`;
  }).join('')}</div>`;
}

App.def('/today', () => {
  const st = S.settings;
  const d = today();
  const hol = holidayOn(d);
  const wt = weekType(d);
  const out = [];

  const lessonsToday = lessonsOn(d).filter((l) => !l.cancelled && !l.holiday).length;
  const openTasks = S.tasks.filter((t) => !t.done && (!t.due || t.due <= addDays(d, 2))).length;
  const examsWeek = S.assessments.filter((a) => a.date && a.date >= d && a.date <= addDays(d, 7) && (cat(a.catId) || {}).exam).length;
  const dd = pd(d);
  const tdl = lessonsOn(d).filter((l) => !l.cancelled && !l.holiday);
  const nmNow = nowMin();
  const doneL = tdl.filter((l) => { const p = periodTime(l.period); return p && tmin(p.e) <= nmNow; }).length;
  const ring = tdl.length ? (() => {
    const pct = doneL / tdl.length;
    const c = 2 * Math.PI * 25;
    return `<div class="th-ring" data-nav="/timetable" data-root title="Heute ${doneL} von ${tdl.length} Stunden geschafft"><svg viewBox="0 0 60 60"><circle cx="30" cy="30" r="25" class="r-bg"/><circle cx="30" cy="30" r="25" class="r-fg" stroke-dasharray="${(c * pct).toFixed(1)} ${c.toFixed(1)}"/></svg><div class="th-ring-t"><b>${doneL}/${tdl.length}</b><span>geschafft</span></div></div>`;
  })() : '';
  const hr = now().getHours();
  out.push(`<div class="today-hero">
    <div class="th-top"><div class="sp">
    <div class="th-date">${icon(hr >= 18 || hr < 5 ? 'moon' : 'sun')}${WD[dow(d)]}, ${dd.getDate()}. ${MONTHS[dd.getMonth()]}</div>
    <h2>${greeting()}${teacherName() ? ', ' + esc(teacherName()) : ''}!</h2>
    <div class="th-sub">KW ${isoWeek(d)}${wt ? ` · ${wt}-Woche` : ''}${st.school ? ' · ' + esc(st.school) : ''}</div>
    ${holidayCountdown(d, hol)}
    </div>${ring}</div>
    <div class="th-stats">
      <div data-nav="/timetable" data-root><b>${lessonsToday}</b><span>${lessonsToday === 1 ? 'Stunde' : 'Stunden'} heute</span></div>
      <div data-nav="/tasks"><b>${openTasks}</b><span>Aufgaben fällig</span></div>
      <div data-nav="/overview/exams"><b>${examsWeek}</b><span>Prüfungen</span></div>
    </div></div>`);

  if (Leader.active()) {
    const abs = absencesOn(d).length;
    const open = Team.on() ? S.team.subs.filter((x) => !x.sub && x.date >= d).length : 0;
    out.push(`<div class="lead-strip" data-nav="/leader"><div class="lead-strip-ic">${icon('crown')}</div><div class="sp"><b>Schulleitung</b><span>${Team.on() ? `${abs} heute abwesend · ${open} offene ${open === 1 ? 'Vertretung' : 'Vertretungen'}` : 'Cockpit öffnen – Schulteam gründen'}</span></div>${icon('chevron-right')}</div>`);
  }
  unreadOfficial().slice(0, 2).forEach((p) => {
    const txt = (p.text || '').replace(/\s+/g, ' ');
    out.push(`<div class="banner lead-banner" data-act="post-open" data-id="${p.id}">${icon('megaphone')}<div><b>Mitteilung der Schulleitung${p.title ? ': ' + esc(p.title) : ''}</b><br><span class="text2">${esc(txt.slice(0, 140))}${txt.length > 140 ? ' …' : ''}</span>${p.requireAck ? '<div class="mt"><span class="badge red">Bitte lesen & bestätigen</span></div>' : ''}</div></div>`);
  });
  const chatN = Team.on() ? chatUnreadTotal() : 0;
  if (chatN) out.push(`<div class="banner sub-banner" data-nav="/chat">${icon('message-circle')}<div><b>${plural(chatN, 'neue Chat-Nachricht', 'neue Chat-Nachrichten')}</b><br><span class="text2">Tippe hier, um den Chat zu öffnen.</span></div></div>`);
  const subN = Team.on() ? SubNotice.pending() : [];
  if (subN.length) out.push(`<div class="banner sub-banner" data-act="sub-notice">${icon('replace')}<div><b>${subN.length === 1 ? 'Neue Vertretung für dich' : subN.length + ' neue Vertretungen für dich'}</b><br><span class="text2">${esc(SubNotice.when(subN[0]))} · ${esc(SubNotice.what(subN[0]))}</span><div class="mt"><span class="badge acc">Tippen zum Bestätigen</span></div></div></div>`);
  if (Team.on()) {
    // Aufsicht und Raumbuchungen heute
    const md = myDutiesOn(d);
    const mb = myBookingsOn(d);
    if (md.length || mb.length) {
      out.push(`<div class="card tone-amber"><div class="card-h"><h3>${icon('eye')}Heute außerdem</h3><button class="link" data-nav="/team/duties">Aufsichtsplan</button></div><div class="list">
        ${md.map((x) => `<div class="li" data-nav="/team/duties"><div class="li-ic" style="flex-direction:column;line-height:1.05;font-size:.74rem">${esc(x.start || '')}<small>${esc(x.end || '')}</small></div><div class="li-main"><div class="li-t">Aufsicht · ${esc(x.slot || '')}</div><div class="li-s">${esc(x.place || '')}${x.date ? ' · Vertretung' : ''}</div></div></div>`).join('')}
        ${mb.map((b) => `<div class="li" data-nav="/room/${b.room}"><div class="li-ic">${icon('door-open')}</div><div class="li-main"><div class="li-t">${esc(roomName(b.room))} gebucht</div><div class="li-s">${Number(b.period) + 1}. Stunde${b.note ? ' · ' + esc(b.note) : ''}</div></div></div>`).join('')}
      </div></div>`);
    }
    openPollsForMe().slice(0, 2).forEach((p) => {
      out.push(`<div class="banner ${p.official ? 'lead-banner' : 'sub-banner'}" data-act="poll-open" data-id="${p.id}">${icon('chart-column')}<div><b>${p.official ? 'Umfrage der Schulleitung' : 'Umfrage'}: ${esc(p.question)}</b><br><span class="text2">von ${esc(teamMemberName(p.by, true))}${p.deadline ? ' · bis ' + fmtDW(p.deadline) : ''}</span><div class="mt"><span class="badge acc">Jetzt abstimmen</span></div></div></div>`);
    });
  }
  const myAbs = Team.on() ? absencesOn(d).find((a) => a.member === S.team.me) : null;
  if (myAbs) {
    const k = ABS_KINDS[myAbs.kind] || ABS_KINDS.sonstiges;
    out.push(`<div class="banner" data-act="absence-open" data-id="${myAbs.id}">${icon(k.i)}<div><b>Du bist heute als abwesend gemeldet</b> (${esc(k.l)}${myAbs.to && myAbs.to !== myAbs.from ? ', bis ' + fmtDW(myAbs.to) : ''}).<br><span class="text2">${myAbs.kind === 'krank' ? 'Gute Besserung! ' : ''}Tippe hier, um die Meldung zu sehen oder zu ändern.</span></div></div>`);
  }

  if (Update.info) {
    out.push(`<div class="promo" data-act="upd-open"><div class="promo-ic">${icon('download')}</div><div class="sp"><b>Neue Version ${esc(Update.info.versionName || '')} verfügbar</b><span>Tippe hier – mit einem Tipp aktualisiert, deine Daten bleiben erhalten.</span></div><button class="btn btn-sm btn-white" data-act="upd-open">Update</button></div>`);
  }
  const empty = !S.classes.length && !S.timetable.length;
  if (empty) {
    out.push(`<div class="card">
      <div class="card-h"><h3>${icon('sparkles')}Willkommen bei Schulplan</h3></div>
      <p class="text2">Richte die App in wenigen Schritten ein – oder schau dir zuerst die Beispieldaten an.</p>
      <div class="list">
        <div class="li" data-nav="/classes">${'<div class="li-ic">1</div>'}<div class="li-main"><div class="li-t">Klassen & Fächer anlegen</div><div class="li-s">Klassen, Kurse und deine Fächer</div></div>${icon('chevron-right', 'chev')}</div>
        <div class="li" data-nav="/timetable"><div class="li-ic">2</div><div class="li-main"><div class="li-t">Stundenplan eintragen</div><div class="li-s">Zeiten und Stunden deiner Woche</div></div>${icon('chevron-right', 'chev')}</div>
        <div class="li" data-nav="/classes"><div class="li-ic">3</div><div class="li-main"><div class="li-t">Schüler:innen hinzufügen</div><div class="li-s">Einzeln, als Liste oder per CSV-Import</div></div>${icon('chevron-right', 'chev')}</div>
      </div>
      <div class="btn-row mt"><button class="btn btn-soft" data-act="demo-load">${icon('sparkles')}Beispieldaten laden</button></div>
    </div>`);
  }

  if (hol) {
    out.push(`<div class="banner ok">${icon('umbrella')}<div><b>${esc(hol.title)}</b>${hol.end && hol.end !== hol.date ? ` – bis ${fmtDW(hol.end)}` : ''}<br><span class="muted">Schönen freien Tag!</span></div></div>`);
  }

  // Sicherungs-Erinnerung
  const hasData = S.students.length > 0 || S.assessments.length > 0;
  const lb = st.lastBackup;
  if (hasData && (!lb || daysBetween(lb.slice(0, 10), d) > 30)) {
    out.push(`<div class="banner warn" data-nav="/settings/backup">${icon('database')}<div><b>Datensicherung empfohlen</b><br><span class="text2">${lb ? `Letzte Sicherung vor ${daysBetween(lb.slice(0, 10), d)} Tagen.` : 'Du hast noch keine Sicherung exportiert.'} Tippe hier, um deine Daten zu sichern.</span></div></div>`);
  }

  // Jetzt / Als Nächstes
  const { cur, next, list } = nowNext();
  if (cur) {
    const p = (nowMin() - cur.s) / (cur.e - cur.s);
    out.push(`<div class="now-card">
      <div class="lbl">Jetzt · ${cur.l.period + 1}. Stunde</div>
      <div class="big">${esc(lessonLabel(cur.l))}</div>
      <div class="meta">${lessonRoom(cur.l) ? 'Raum ' + esc(lessonRoom(cur.l)) + ' · ' : ''}bis ${mint(cur.e)} (noch ${cur.e - nowMin()} Min.)</div>
      <div class="progress"><i style="width:${Math.round(p * 100)}%"></i></div>
      <div class="btn-row mt"><button class="btn btn-sm" data-nav="/lesson/${d}/${cur.l.period}">${icon('notebook-pen')}Stunde öffnen</button>
      <button class="btn btn-sm" data-nav="/tool/random/${cur.l.classId || ''}">${icon('shuffle')}Zufall</button>
      <button class="btn btn-sm" data-nav="/attendance/${cur.l.classId}/${d}/${cur.l.period}">${icon('user-check')}Anwesenheit</button></div>
    </div>`);
  } else if (next) {
    const mins = next.s - nowMin();
    out.push(`<div class="now-card">
      <div class="lbl">Als Nächstes · ${next.l.period + 1}. Stunde</div>
      <div class="big">${esc(lessonLabel(next.l))}</div>
      <div class="meta">${mint(next.s)} Uhr${lessonRoom(next.l) ? ' · Raum ' + esc(lessonRoom(next.l)) : ''} · in ${mins >= 60 ? Math.floor(mins / 60) + ' Std. ' + (mins % 60) + ' Min.' : mins + ' Min.'}</div>
      <div class="btn-row mt"><button class="btn btn-sm" data-nav="/lesson/${d}/${next.l.period}">${icon('notebook-pen')}Vorbereiten</button></div>
    </div>`);
  } else if (list.length) {
    out.push(`<div class="banner ok">${icon('circle-check')}<div><b>Unterricht für heute geschafft!</b><br><span class="text2">${plural(list.length, 'Stunde', 'Stunden')} gehalten.</span></div></div>`);
  }

  // Schnellaktionen
  const q = (attr, ic, label, c) => `<button ${attr}><span class="q-ic" style="--qc:${c}">${icon(ic)}</span>${label}</button>`;
  out.push(`<div class="quick2">
    ${q('data-nav="/assistant"', 'sparkles', 'Assistent', '#8b5cf6')}
    ${q('data-nav="/chat"', 'message-circle', 'Chat', '#0ea5e9')}
    ${q('data-nav="/tool/random"', 'shuffle', 'Zufall', '#6366f1')}
    ${q('data-nav="/tool/timer"', 'timer', 'Timer', '#f97316')}
    ${q('data-act="task-add"', 'list-todo', 'Aufgabe', '#0ea5e9')}
    ${q('data-act="note-new"', 'sticky-note', 'Notiz', '#eab308')}
    ${q('data-act="hw-add"', 'book-open', 'Hausaufg.', '#14b8a6')}
    ${q('data-nav="/tool/groups"', 'users-round', 'Gruppen', '#ec4899')}
    ${q('data-nav="/team"', 'users', 'Kollegium', '#8b5cf6')}
  </div>`);

  out.push('<div class="two-col"><div>');
  // Stundenplan heute
  const tl = timelineHTML(d);
  if (tl) {
    out.push(`<div class="card tone-acc"><div class="card-h"><h3>${icon('clock')}Heute</h3><button class="link" data-nav="/timetable" data-root>Woche</button></div>${tl}</div>`);
  } else if (S.timetable.length) {
    // Nächster Unterrichtstag
    let nd = null;
    for (let i = 1; i < 21; i++) { const x = addDays(d, i); if (lessonsOn(x).some((l) => !l.holiday)) { nd = x; break; } }
    if (nd) out.push(`<div class="card tone-acc"><div class="card-h"><h3>${icon('clock')}${relDay(nd)}, ${fmtDS(nd)}</h3><button class="link" data-nav="/timetable" data-root>Woche</button></div>${timelineHTML(nd, { compact: true })}</div>`);
  }

  // Aufgaben
  const tasks = S.tasks.filter((t) => !t.done && t.due && t.due <= addDays(d, 2));
  const prio = S.tasks.filter((t) => !t.done && !t.due && t.prio === 2);
  const tl2 = sortBy([...tasks, ...prio], (t) => t.due || '9999', (t) => -(t.prio || 0));
  if (tl2.length) {
    out.push(`<div class="card tone-blue"><div class="card-h"><h3>${icon('list-todo')}Aufgaben</h3><button class="link" data-nav="/tasks">Alle</button></div><div class="list">${tl2.slice(0, 6).map(taskItem).join('')}</div></div>`);
  }

  // Hausaufgaben
  const hw = sortBy(S.homework.filter((h) => !h.done && h.due && h.due >= d && h.due <= addDays(d, 2)), 'due');
  if (hw.length) {
    out.push(`<div class="card tone-teal"><div class="card-h"><h3>${icon('book-open')}Fällige Hausaufgaben</h3><button class="link" data-nav="/homework">Alle</button></div><div class="list">${hw.map(hwItem).join('')}</div></div>`);
  }
  out.push('</div><div>');

  // Prüfungen
  const exams = sortBy(S.assessments.filter((a) => a.date && a.date >= d && a.date <= addDays(d, 21) && (cat(a.catId) || {}).exam), 'date');
  if (exams.length) {
    out.push(`<div class="card tone-red"><div class="card-h"><h3>${icon('file-text')}Anstehende Prüfungen</h3></div><div class="list">${exams.map((a) => `
      <div class="li" data-nav="/assessment/${a.id}"><div class="li-ic" style="background:${rgba(classColor(cls(a.classId)), .15)};color:${classColor(cls(a.classId))}">${icon('file-text')}</div>
      <div class="li-main"><div class="li-t">${esc(a.title)}</div><div class="li-s">${esc(cName(a.classId))}${a.subjectId ? ' · ' + esc(subName(a.subjectId)) : ''}</div></div>
      <div class="li-end"><span class="badge ${daysBetween(d, a.date) <= 2 ? 'red' : 'acc'}">${relDay(a.date)}</span></div></div>`).join('')}</div></div>`);
  }

  // Termine
  const evs = sortBy(S.events.filter((e) => e.type !== 'ferien' && e.date <= addDays(d, 7) && (e.end || e.date) >= d), 'date', 'time');
  if (evs.length) {
    out.push(`<div class="card tone-violet"><div class="card-h"><h3>${icon('calendar')}Termine (7 Tage)</h3><button class="link" data-nav="/calendar" data-root>Kalender</button></div><div class="list">${evs.map(eventItem).join('')}</div></div>`);
  }

  // Wiedervorlagen Elterngespräche
  const fu = sortBy(S.talks.filter((t) => t.followUp && !t.followUpDone && t.followUp <= addDays(d, 3)), 'followUp');
  if (fu.length) {
    out.push(`<div class="card tone-pink"><div class="card-h"><h3>${icon('handshake')}Wiedervorlagen</h3></div><div class="list">${fu.map((t) => `
      <div class="li" data-act="talk-edit" data-id="${t.id}"><div class="li-ic">${icon('handshake')}</div><div class="li-main"><div class="li-t">${esc(sName(stu(t.studentId)))}: ${esc(t.topic || 'Gespräch')}</div><div class="li-s">Wiedervorlage ${relDay(t.followUp)}</div></div></div>`).join('')}</div></div>`);
  }

  // Geburtstage
  const bd = sortBy(S.students.filter((s) => s.birthday && cls(s.classId) && !cls(s.classId).archived).map((s) => ({ s, n: nextBirthday(s.birthday, d) }))
    .filter((x) => daysBetween(d, x.n) <= 7), 'n');
  if (bd.length) {
    out.push(`<div class="card tone-amber"><div class="card-h"><h3>${icon('cake')}Geburtstage</h3></div><div class="list">${bd.map(({ s, n }) => `
      <div class="li" data-nav="/student/${s.id}">${UI.avatar(s)}<div class="li-main"><div class="li-t">${esc(sName(s))}</div><div class="li-s">${esc(cName(s.classId))} · wird ${age(s.birthday, n)}</div></div>
      <div class="li-end"><span class="badge ${n === d ? 'green' : ''}">${n === d ? '🎉 Heute' : relDay(n)}</span></div></div>`).join('')}</div></div>`);
  }
  out.push('</div></div>');

  // Kollegium
  if (Team.on()) {
    const t = S.team;
    const unread = sortBy(t.posts.filter((x) => x.by !== t.me && (x.updatedAt || 0) > (t.seenPosts || 0)), (x) => -(x.updatedAt || 0));
    const mySubs = sortBy(t.subs.filter((x) => x.sub === t.me && x.date >= d && x.date <= addDays(d, 7)), 'date', (x) => Number(x.period));
    const open = t.subs.filter((x) => !x.sub && x.date >= d).length;
    if (unread.length || mySubs.length || open) {
      out.push(`<div class="card team-card tone-acc"><div class="card-h"><h3>${icon('users')}Kollegium · ${esc(t.name)}</h3><button class="link" data-nav="/team">Öffnen</button></div>
        ${unread.slice(0, 3).map((x) => `<div class="mini-post" data-nav="/team/board"><b>${esc(teamMemberName(x.by, true))}:</b> ${esc(x.title || (x.text || '').slice(0, 80))}</div>`).join('')}
        ${mySubs.map((x) => `<div class="mini-post" data-nav="/lesson/${x.date}/${x.period}">${icon('replace')} <b>Vertretung ${relDay(x.date)}, ${Number(x.period) + 1}. Std.:</b> ${esc(x.className)}${x.room ? ' · Raum ' + esc(x.room) : ''}</div>`).join('')}
        ${open ? `<div class="mini-post" data-nav="/team/subs">${icon('triangle-alert')} ${plural(open, 'offene Vertretung', 'offene Vertretungen')} im Team</div>` : ''}
      </div>`);
    }
  } else if (!st.teamPromoHidden && S.classes.length) {
    out.push(`<div class="promo"><button class="promo-x" data-act="team-promo-hide" aria-label="Ausblenden">${icon('x')}</button>
      <div class="promo-ic">${icon('users')}</div><div class="sp"><b>Arbeite mit deinem Kollegium</b><span>Lade Kolleg:innen ein und teilt Termine, Vertretungen & Klassenlisten.</span></div>
      <button class="btn btn-sm btn-white" data-nav="/team">Los</button></div>`);
  }

  return {
    title: 'Schulplan', sub: st.school || 'Dein Schulplaner', tab: 'today', icon: 'graduation-cap',
    actions: [{ icon: 'search', nav: '/search', label: 'Suche' }],
    html: out.join(''),
  };
});

A['team-promo-hide'] = () => { S.settings.teamPromoHidden = true; save(); App.refresh(); };
