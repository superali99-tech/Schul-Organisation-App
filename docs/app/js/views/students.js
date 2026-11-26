/* Schüler:innen: Liste, Profil, Formulare, Import, Mitarbeit */
'use strict';

function studentTags(s) {
  return (s.tags || '').split(',').map((t) => t.trim()).filter(Boolean);
}

function classStudentsTab(c) {
  const studs = studentsOf(c.id);
  const gs = gsOf(c.id);
  if (!studs.length) {
    return UI.empty('user-plus', 'Noch keine Schüler:innen in dieser Klasse.', `<div class="btn-row" style="justify-content:center">
      <button class="btn btn-primary" data-act="student-add" data-id="${c.id}">${icon('user-plus')}Einzeln</button>
      <button class="btn btn-soft" data-act="student-bulk" data-id="${c.id}">${icon('list')}Als Liste</button>
      <button class="btn btn-soft" data-act="student-csv" data-id="${c.id}">${icon('file-up')}CSV</button></div>`);
  }
  const sort = App.stuSort || 'last';
  let list = studs;
  if (sort === 'first') list = [...studs].sort((a, b) => cmpStr(a.firstName, b.firstName));
  const rows = list.map((s) => ({ s, a: studentAverage(s.id, c.id).avg, at: attStats(s.id) }));
  if (sort === 'grade') rows.sort((x, y) => (x.a == null) - (y.a == null) || (gs.low ? x.a - y.a : y.a - x.a));
  const m = studs.filter((s) => s.gender === 'm').length, w = studs.filter((s) => s.gender === 'w').length;
  return `<div class="search">${icon('search')}<input placeholder="Schüler:in suchen …" data-input="stu-filter"></div>
    <div class="row" style="margin-bottom:10px"><span class="muted small sp">${plural(studs.length, 'Schüler:in', 'Schüler:innen')}${m || w ? ` · ${w} w, ${m} m` : ''}</span>
    ${UI.seg([{ v: 'last', l: 'Name' }, { v: 'first', l: 'Vorname' }, { v: 'grade', l: 'Note' }], sort, 'stu-sort', 'style="margin:0"')}</div>
    <div class="card pad0"><div class="list" id="stu-list">${rows.map(({ s, a, at }) => `
      <div class="li" data-nav="/student/${s.id}" data-name="${esc((sName(s) + ' ' + (s.tags || '')).toLowerCase())}">${UI.avatar(s)}
        <div class="li-main"><div class="li-t">${esc(sort === 'first' ? sName(s) : sNameRev(s))}</div>
        <div class="li-s">${studentTags(s).map((t) => `<span class="badge orange">${esc(t)}</span>`).join(' ')}${at.absent ? ` ${at.absent} Fehlst.` : ''}${s.birthday ? ` · ${age(s.birthday)} J.` : ''}</div></div>
        <div class="li-end">${avgBadge(gs, a)}</div></div>`).join('')}</div></div>
    <div class="btn-row"><button class="btn" data-act="student-bulk" data-id="${c.id}">${icon('list')}Liste einfügen</button><button class="btn" data-act="student-csv" data-id="${c.id}">${icon('file-up')}CSV-Import</button></div>`;
}
A['stu-sort'] = (el) => { App.stuSort = el.dataset.v; App.refresh(); };
A['stu-filter'] = (el) => {
  const q = el.value.trim().toLowerCase();
  $$('#stu-list .li').forEach((li) => { li.style.display = !q || li.dataset.name.includes(q) ? '' : 'none'; });
};
A['student-add'] = (el) => editStudent(null, el.dataset.id);
A['student-bulk'] = (el) => bulkAddStudents(cls(el.dataset.id));
A['student-csv'] = (el) => importStudentsCSV(cls(el.dataset.id));

function editStudent(s, classId) {
  const isNew = !s;
  UI.form({
    title: isNew ? 'Schüler:in hinzufügen' : 'Schüler:in bearbeiten',
    fields: [
      { k: 'firstName', label: 'Vorname', req: true, half: true },
      { k: 'lastName', label: 'Nachname', half: true },
      { k: 'birthday', label: 'Geburtstag', type: 'date', half: true },
      { k: 'gender', label: 'Geschlecht', type: 'select', half: true, opts: [{ v: '', l: '–' }, { v: 'w', l: 'weiblich' }, { v: 'm', l: 'männlich' }, { v: 'd', l: 'divers' }] },
      { k: 'classId', label: 'Klasse', type: 'select', opts: classOptions() },
      { k: 'tags', label: 'Merkmale (mit Komma getrennt)', ph: 'z. B. LRS, Nachteilsausgleich, Förderbedarf, Allergie' },
      { type: 'section', label: 'Kontakt Schüler:in', i: 'phone' },
      { k: 'email', label: 'E-Mail', type: 'email', half: true },
      { k: 'phone', label: 'Telefon', type: 'tel', half: true },
      { type: 'section', label: 'Erziehungsberechtigte', i: 'users' },
      { k: 'parentName', label: 'Name', ph: 'z. B. Frau Müller (Mutter)' },
      { k: 'parentPhone', label: 'Telefon', type: 'tel', half: true },
      { k: 'parentEmail', label: 'E-Mail', type: 'email', half: true },
      { k: 'parent2Name', label: 'Weitere Person', ph: 'z. B. Herr Müller (Vater)' },
      { k: 'parent2Phone', label: 'Telefon', type: 'tel', half: true },
      { k: 'parent2Email', label: 'E-Mail', type: 'email', half: true },
      { k: 'address', label: 'Adresse', type: 'textarea', rows: 2 },
      { type: 'section', label: 'Sonstiges', i: 'info' },
      { k: 'notes', label: 'Notizen', type: 'textarea', rows: 3 },
      { k: 'photo', label: 'Foto (optional)', type: 'file', accept: 'image/*' },
    ],
    values: s ? { ...s, photo: '' } : { classId: classId || (activeClasses()[0] || {}).id },
    onSave: async (v, modal) => {
      const photoFile = v.photo;
      delete v.photo;
      const obj = { ...(s || {}), ...v };
      if (photoFile) { try { obj.photo = await Files.readImage(photoFile, 240); } catch (e) { UI.toast('Foto konnte nicht geladen werden'); } }
      upsert('students', obj);
      save(); App.refresh();
      UI.toast(isNew ? `${sName(obj)} hinzugefügt` : 'Gespeichert');
      if (isNew) {
        // Schnell weitere hinzufügen
        modal.close();
        setTimeout(async () => { if (await UI.confirm('Weitere Person hinzufügen?', { ok: 'Ja', cancel: 'Fertig', title: 'Gespeichert' })) editStudent(null, obj.classId); }, 250);
      }
    },
    onDelete: isNew ? null : () => deleteStudent(s),
    extraFoot: s && s.photo ? `<button class="btn btn-ghost" data-act="student-rm-photo" data-id="${s.id}">${icon('x')}Foto entfernen</button>` : '',
  });
}
A['student-rm-photo'] = (el) => { const s = stu(el.dataset.id); delete s.photo; save(); UI.closeTop(); App.refresh(); };

async function deleteStudent(s) {
  if (!(await UI.confirm(`${esc(sName(s))} mit allen Noten, Beobachtungen und Gesprächsnotizen löschen?`, { danger: true, ok: 'Löschen' }))) return false;
  const snap = deepCopy(S);
  removeById('students', s.id);
  S.observations = S.observations.filter((o) => o.studentId !== s.id);
  S.talks = S.talks.filter((t) => t.studentId !== s.id);
  S.assessments.forEach((a) => { if (a.grades) delete a.grades[s.id]; });
  S.attendance.forEach((r) => { if (r.e) delete r.e[s.id]; });
  Object.values(S.seating).forEach((p) => { Object.keys(p.seats || {}).forEach((k) => { if (p.seats[k] === s.id) delete p.seats[k]; }); });
  save();
  if (App.path.startsWith('/student/')) App.back(); else App.refresh();
  UI.toast('Gelöscht', { undo: () => { Store.replace(snap); App.refresh(); } });
  return true;
}

function parseNameLine(line) {
  line = line.trim().replace(/\s+/g, ' ');
  if (!line) return null;
  if (line.includes(',')) {
    const [last, first] = line.split(',').map((x) => x.trim());
    return { firstName: first || last, lastName: first ? last : '' };
  }
  const parts = line.split(' ');
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return { firstName: parts.slice(0, -1).join(' '), lastName: parts[parts.length - 1] };
}

function bulkAddStudents(c) {
  UI.form({
    title: `Liste einfügen – ${c.name}`,
    fields: [
      { type: 'html', html: '<p class="muted small" style="margin:0">Eine Person pro Zeile, entweder „Vorname Nachname" oder „Nachname, Vorname". Du kannst die Liste z. B. aus Excel oder einer E-Mail kopieren.</p>' },
      { k: 'list', label: 'Namen', type: 'textarea', rows: 10, ph: 'Max Mustermann\nMustermann, Erika\n…' },
    ],
    submit: 'Hinzufügen',
    onSave: (v) => {
      const names = (v.list || '').split(/\r?\n/).map(parseNameLine).filter(Boolean);
      if (!names.length) { UI.toast('Keine Namen erkannt', { type: 'err' }); return false; }
      names.forEach((n) => upsert('students', { ...n, classId: c.id }));
      save(); App.refresh();
      UI.toast(`${names.length} Schüler:innen hinzugefügt`);
    },
  });
}

async function importStudentsCSV(c) {
  const f = await Files.pick('.csv,text/csv,text/plain,text/comma-separated-values,application/vnd.ms-excel');
  if (!f) return;
  const rows = parseCSV(await Files.readText(f));
  if (rows.length < 1) { UI.toast('Datei ist leer'); return; }
  const head = rows[0].map((h) => h.toLowerCase().trim());
  const find = (...keys) => head.findIndex((h) => keys.some((k) => h.includes(k)));
  let iFirst = find('vorname', 'first'), iLast = find('nachname', 'familienname', 'last', 'surname');
  const iName = find('name');
  const hasHeader = iFirst >= 0 || iLast >= 0 || iName >= 0 || find('geburt') >= 0;
  const data = hasHeader ? rows.slice(1) : rows;
  const iBday = find('geburt', 'birth'), iMail = head.findIndex((h) => (h.includes('mail')) && !h.includes('eltern') && !h.includes('parent'));
  const iPMail = find('eltern-mail', 'mail eltern', 'e-mail eltern', 'parent email', 'elternmail');
  const iPhone = head.findIndex((h) => (h.includes('telefon') || h.includes('phone') || h.includes('handy')) && !h.includes('eltern') && !h.includes('parent'));
  const iPPhone = find('telefon eltern', 'eltern telefon', 'parent phone');
  const iParent = head.findIndex((h) => (h.includes('erziehungsb') || h === 'eltern' || h.includes('parent name')));
  const iGender = find('geschlecht', 'gender');
  const iTags = find('merkmal', 'tags', 'bemerkung');
  const parseDate = (x) => {
    if (!x) return '';
    let m = x.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);
    if (m) { let y = Number(m[3]); if (y < 100) y += y > 30 ? 1900 : 2000; return `${y}-${pad2(m[2])}-${pad2(m[1])}`; }
    m = x.match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? `${m[1]}-${m[2]}-${m[3]}` : '';
  };
  const list = [];
  for (const r of data) {
    let n;
    if (iFirst >= 0 || iLast >= 0) n = { firstName: (r[iFirst] || '').trim(), lastName: (r[iLast] || '').trim() };
    else if (iName >= 0) n = parseNameLine(r[iName] || '');
    else n = r.length >= 2 ? { lastName: r[0].trim(), firstName: r[1].trim() } : parseNameLine(r[0] || '');
    if (!n || (!n.firstName && !n.lastName)) continue;
    if (!n.firstName) { n.firstName = n.lastName; n.lastName = ''; }
    const g = iGender >= 0 ? (r[iGender] || '').toLowerCase()[0] : '';
    list.push({
      ...n, classId: c.id,
      birthday: iBday >= 0 ? parseDate((r[iBday] || '').trim()) : '',
      email: iMail >= 0 ? r[iMail] : '', phone: iPhone >= 0 ? r[iPhone] : '',
      parentEmail: iPMail >= 0 ? r[iPMail] : '', parentPhone: iPPhone >= 0 ? r[iPPhone] : '', parentName: iParent >= 0 ? r[iParent] : '',
      gender: g === 'w' || g === 'f' ? 'w' : g === 'm' ? 'm' : g === 'd' ? 'd' : '',
      tags: iTags >= 0 ? r[iTags] : '',
    });
  }
  if (!list.length) { UI.toast('Keine Schüler:innen erkannt', { type: 'err' }); return; }
  const preview = list.slice(0, 5).map((s) => esc(sName(s))).join(', ');
  if (!(await UI.confirm(`${list.length} Schüler:innen gefunden (${preview}${list.length > 5 ? ', …' : ''}). In „${esc(c.name)}" importieren?`, { ok: 'Importieren', title: 'CSV-Import' }))) return;
  list.forEach((s) => upsert('students', s));
  save(); App.refresh();
  UI.toast(`${list.length} importiert`);
}

// ------------------------------------------------------------------ Profil
App.def('/student/:id', (p) => {
  const s = stu(p.id);
  if (!s) return { title: 'Schüler:in', html: UI.empty('user', 'Nicht gefunden.') };
  const c = cls(s.classId);
  const gs = gsOf(s.classId);
  let h = '';
  // Kopf
  h += `<div class="card"><div class="profile">${UI.avatar(s, 'lg')}<div class="sp" style="min-width:0">
    <h2>${esc(sName(s))}</h2>
    <div class="muted">${c ? `<a data-nav="/class/${c.id}">${esc(c.name)}</a>` : '–'}${s.birthday ? ` · ${fmtD(s.birthday)} (${age(s.birthday)} J.)` : ''}</div>
    ${studentTags(s).length ? `<div class="row row-wrap mt" style="gap:4px">${studentTags(s).map((t) => `<span class="badge orange">${esc(t)}</span>`).join('')}</div>` : ''}
  </div></div>
  <div class="btn-row mt">
    ${s.parentPhone ? `<a class="btn btn-soft" href="tel:${esc(s.parentPhone.replace(/\s/g, ''))}">${icon('phone')}Eltern</a>` : ''}
    ${s.parentEmail ? `<a class="btn btn-soft" href="mailto:${esc(s.parentEmail)}">${icon('mail')}E-Mail</a>` : ''}
    <button class="btn btn-soft" data-act="obs-add" data-id="${s.id}">${icon('plus')}Beobachtung</button>
    <button class="btn btn-soft" data-act="talk-add" data-sid="${s.id}">${icon('handshake')}Gespräch</button>
  </div></div>`;

  // Kennzahlen
  const sa = c ? studentAverage(s.id, c.id) : { avg: null };
  const at = attStats(s.id);
  const oc = obsCounts(s.id);
  h += UI.stats([
    { v: sa.avg != null ? fmtNum(sa.avg, gs.id === 'punkte' ? 1 : 2) : '–', l: 'Ø Gesamt', c: sa.avg != null ? gradeColor(gs, sa.avg) : '' },
    { v: at.absent, l: 'Fehlstunden', c: at.absent ? 'var(--danger)' : '' },
    { v: at.f, l: 'unentschuldigt', c: at.f ? 'var(--danger)' : '' },
    { v: `<span style="color:var(--ok)">${oc.plus}</span>/<span style="color:var(--danger)">${oc.minus}</span>`, l: 'Mitarbeit +/–' },
    { v: oc.ha, l: 'HA vergessen', c: oc.ha ? 'var(--warn)' : '' },
  ]);

  h += '<div class="two-col"><div>';
  // Noten
  if (c) {
    const subs = subjectsOf(c.id);
    const groups = subs.length > 1 ? subs.map((x) => ({ id: x.id, name: x.name })) : [{ id: null, name: subs[0] ? subs[0].name : 'Noten' }];
    h += `<div class="card"><div class="card-h"><h3>${icon('award')}Noten</h3><button class="link" data-nav="/class/${c.id}/grades">Klasse</button></div>`;
    for (const g of groups) {
      const list = sortBy(assessmentsOf(c.id, { subjectId: g.id || undefined }).filter((a) => assessmentGrade(a, s.id) != null), 'date');
      const av = studentAverage(s.id, c.id, { subjectId: g.id || undefined });
      h += `<div class="row" style="margin:8px 0 6px"><b class="sp">${esc(g.name)}</b>${avgBadge(gs, av.avg)}</div>`;
      if (!list.length) { h += '<p class="muted small" style="margin:0 0 8px">Noch keine Noten.</p>'; continue; }
      // Kategorie-Mittel
      h += `<div class="row row-wrap" style="gap:6px;margin-bottom:6px">${Object.entries(av.cats).map(([cid, o]) => `<span class="badge">${esc((cat(cid) || { name: '?' }).name.split(' ')[0])}: ${fmtNum(o.avg)}</span>`).join('')}</div>`;
      h += `<div class="list" style="margin:0 -14px 6px">${list.map((a) => {
        const g2 = a.grades[s.id];
        return `<div class="li" data-nav="/assessment/${a.id}"><i class="dot" style="background:${(cat(a.catId) || {}).color || '#888'}"></i><div class="li-main"><div class="li-t">${esc(a.title)}</div><div class="li-s">${a.date ? fmtD(a.date) : ''} · ${esc((cat(a.catId) || {}).name || '')}${g2.p != null ? ` · ${fmtNumShort(g2.p, 1)}/${fmtNumShort(a.maxPoints, 1)} P.` : ''}${g2.note ? ' · ' + esc(g2.note) : ''}</div></div>${gradeBadge(gs, g2.v)}</div>`;
      }).join('')}</div>`;
    }
    h += `<button class="btn btn-sm btn-soft" data-act="grade-quick-student" data-id="${s.id}">${icon('plus')}Note eintragen</button></div>`;
  }

  // Anwesenheit
  const absList = sortBy(S.attendance.filter((r) => r.e && r.e[s.id]), 'date').reverse();
  h += `<div class="card"><div class="card-h"><h3>${icon('user-check')}Anwesenheit</h3></div>
    ${UI.stats([{ v: at.e, l: 'entschuldigt' }, { v: at.f, l: 'unentsch.' }, { v: at.v, l: 'verspätet' }, { v: at.pct != null ? Math.round(at.pct) + ' %' : '–', l: 'Quote' }])}
    ${absList.length ? `<div class="list">${absList.slice(0, 15).map((r) => {
      const e = r.e[s.id];
      const st = ATT_STATES[e.s];
      return `<div class="li" data-nav="/attendance/${r.classId}/${r.date}${r.period != null ? '/' + r.period : ''}"><span class="gb" style="background:${rgba(st.c, .15)};color:${st.c}">${st.s}</span><div class="li-main"><div class="li-t">${st.l}</div><div class="li-s">${fmtDW(r.date)}${r.period != null ? ` · ${r.period + 1}. Std.` : ''}${e.m ? ` · ${e.m} Min.` : ''}${e.n ? ' · ' + esc(e.n) : ''}</div></div></div>`;
    }).join('')}</div>` : '<p class="muted small" style="margin:0">Keine Fehlzeiten erfasst.</p>'}
  </div>`;
  h += '</div><div>';

  // Beobachtungen
  const obs = sortBy(S.observations.filter((o) => o.studentId === s.id), 'date').reverse();
  h += `<div class="card"><div class="card-h"><h3>${icon('thumbs-up')}Beobachtungen</h3><button class="link" data-act="obs-add" data-id="${s.id}">Neu</button></div>
    <div class="row row-wrap" style="gap:6px;margin-bottom:8px">${Object.entries(OBS_KINDS).filter(([k]) => oc[k]).map(([k, o]) => `<span class="badge" style="background:${rgba(o.c, .13)};color:${o.c}">${icon(o.i)}${oc[k]}× ${esc(o.l)}</span>`).join('') || '<span class="muted small">Noch keine Einträge.</span>'}</div>
    ${obs.length ? `<div class="list">${obs.slice(0, 25).map((o) => { const k = OBS_KINDS[o.kind] || OBS_KINDS.note; return `<div class="li" data-act="obs-edit" data-id="${o.id}"><span class="li-ic" style="background:${rgba(k.c, .13)};color:${k.c};width:32px;height:32px">${icon(k.i)}</span><div class="li-main"><div class="li-t">${esc(k.l)}</div><div class="li-s wrap">${fmtDW(o.date)}${o.text ? ' · ' + esc(o.text) : ''}</div></div></div>`; }).join('')}</div>` : ''}
  </div>`;

  // Gespräche
  const talks = sortBy(S.talks.filter((t) => t.studentId === s.id), 'date').reverse();
  h += `<div class="card"><div class="card-h"><h3>${icon('handshake')}Elterngespräche & Kontakte</h3><button class="link" data-act="talk-add" data-sid="${s.id}">Neu</button></div>
    ${talks.length ? `<div class="list">${talks.map(talkItem).join('')}</div>` : '<p class="muted small" style="margin:0">Noch keine Gespräche dokumentiert.</p>'}</div>`;

  // Kontakt
  const link = (v, type) => (v ? `<a href="${type}:${esc(type === 'tel' ? v.replace(/\s/g, '') : v)}">${esc(v)}</a>` : '–');
  h += `<div class="card"><div class="card-h"><h3>${icon('phone')}Kontakt</h3><button class="link" data-act="student-edit" data-id="${s.id}">Bearbeiten</button></div><dl class="kv">
    <dt>E-Mail</dt><dd>${link(s.email, 'mailto')}</dd><dt>Telefon</dt><dd>${link(s.phone, 'tel')}</dd>
    <dt>Eltern</dt><dd>${esc(s.parentName || '–')}</dd><dt>Tel. Eltern</dt><dd>${link(s.parentPhone, 'tel')}</dd><dt>Mail Eltern</dt><dd>${link(s.parentEmail, 'mailto')}</dd>
    ${s.parent2Name || s.parent2Phone ? `<dt>Weitere</dt><dd>${esc(s.parent2Name || '')} ${link(s.parent2Phone, 'tel')} ${s.parent2Email ? link(s.parent2Email, 'mailto') : ''}</dd>` : ''}
    <dt>Adresse</dt><dd>${nl2br(s.address || '–')}</dd>
  </dl>${s.notes ? `<div class="banner mt" style="margin-bottom:0">${icon('sticky-note')}<div>${nl2br(s.notes)}</div></div>` : ''}</div>`;
  h += '</div></div>';

  return {
    title: sName(s), sub: c ? c.name : '', tab: 'classes', html: h,
    actions: [{ icon: 'pencil', act: 'student-edit', id: s.id, label: 'Bearbeiten' }, { icon: 'ellipsis', act: 'student-menu', id: s.id }],
  };
});
A['student-edit'] = (el) => editStudent(stu(el.dataset.id));
A['obs-add'] = (el) => addObservation(stu(el.dataset.id), 'note');
A['obs-edit'] = (el) => { const o = byId('observations', el.dataset.id); addObservation(stu(o.studentId), o.kind, o.date, o); };
A['student-menu'] = (el) => {
  const s = stu(el.dataset.id);
  UI.menu(sName(s), [
    { l: 'Bearbeiten', i: 'pencil', fn: () => editStudent(s) },
    { l: 'Schülerbericht drucken', i: 'printer', s: 'z. B. für den Elternsprechtag', fn: () => printStudentReport(s) },
    { l: 'In andere Klasse verschieben', i: 'arrow-right-left', fn: async () => {
      const id = await UI.menu('Neue Klasse', activeClasses().filter((c) => c.id !== s.classId).map((c) => ({ l: c.name, v: c.id, i: 'users' })));
      if (id) { s.classId = id; save(); App.refresh(); UI.toast('Verschoben'); }
    } },
    { sep: true },
    { l: 'Löschen', i: 'trash-2', danger: true, fn: () => deleteStudent(s) },
  ]);
};

function printStudentReport(s) {
  const c = cls(s.classId);
  const gs = gsOf(s.classId);
  let h = `<table><tr><th>Name</th><td>${esc(sName(s))}</td><th>Klasse</th><td>${esc(c ? c.name : '')}</td></tr>
    <tr><th>Geburtstag</th><td>${s.birthday ? fmtD(s.birthday) : ''}</td><th>Eltern</th><td>${esc(s.parentName || '')} ${esc(s.parentPhone || '')}</td></tr></table>`;
  if (c) {
    for (const sub of subjectsOf(c.id).length ? subjectsOf(c.id) : [null]) {
      const list = sortBy(assessmentsOf(c.id, { subjectId: sub ? sub.id : undefined }).filter((a) => assessmentGrade(a, s.id) != null), 'date');
      const av = studentAverage(s.id, c.id, { subjectId: sub ? sub.id : undefined });
      h += `<h3>${esc(sub ? sub.name : 'Noten')} – Durchschnitt: ${av.avg != null ? fmtNum(av.avg) : '–'}</h3>`;
      if (list.length) h += `<table><tr><th>Datum</th><th>Leistung</th><th>Art</th><th>Note</th><th>Bemerkung</th></tr>${list.map((a) => `<tr><td>${a.date ? fmtD(a.date) : ''}</td><td>${esc(a.title)}</td><td>${esc((cat(a.catId) || {}).name || '')}</td><td><b>${esc(gs.format(a.grades[s.id].v))}</b></td><td>${esc(a.grades[s.id].note || '')}</td></tr>`).join('')}</table>`;
    }
  }
  const at = attStats(s.id);
  const oc = obsCounts(s.id);
  h += `<h3>Anwesenheit & Mitarbeit</h3><table><tr><th>Fehlstunden</th><td>${at.absent} (davon ${at.f} unentschuldigt)</td><th>Verspätungen</th><td>${at.v}</td></tr>
    <tr><th>Mitarbeit +</th><td>${oc.plus}</td><th>Mitarbeit –</th><td>${oc.minus}</td></tr><tr><th>HA vergessen</th><td>${oc.ha}</td><th>Material vergessen</th><td>${oc.mat}</td></tr></table>`;
  const obs = sortBy(S.observations.filter((o) => o.studentId === s.id && o.text), 'date');
  if (obs.length) h += `<h3>Beobachtungen</h3><table>${obs.map((o) => `<tr><td style="width:80px">${fmtD(o.date)}</td><td>${esc(OBS_KINDS[o.kind].l)}</td><td>${esc(o.text)}</td></tr>`).join('')}</table>`;
  const talks = sortBy(S.talks.filter((t) => t.studentId === s.id), 'date');
  if (talks.length) h += `<h3>Gespräche</h3><table>${talks.map((t) => `<tr><td style="width:80px">${fmtD(t.date)}</td><td><b>${esc(t.topic || '')}</b><br>${nl2br(t.notes || '')}${t.agreements ? `<br><i>Vereinbarungen:</i> ${nl2br(t.agreements)}` : ''}</td></tr>`).join('')}</table>`;
  h += '<h3>Notizen für das Gespräch</h3><div style="border:1px solid #888;height:160px"></div>';
  Print.show(`Schülerbericht – ${sName(s)}`, h);
}

// ------------------------------------------------------------------ Mitarbeit (Klasse)
function classBehaviorTab(c) {
  const studs = studentsOf(c.id);
  if (!studs.length) return UI.empty('users', 'Noch keine Schüler:innen.');
  const term = App.behTerm || 'year';
  const [from, to] = termRange(term === 'year' ? null : term === 'all' ? 'all' : term);
  const d = today();
  let h = UI.seg([{ v: 'year', l: 'Schuljahr' }, { v: '1', l: '1. HJ' }, { v: '2', l: '2. HJ' }, { v: 'all', l: 'Alles' }], term, 'beh-term');
  h += `<p class="muted small" style="margin:0 4px 10px">Tippe auf + oder –, um die Mitarbeit von heute zu notieren. „…" für weitere Beobachtungen.</p>`;
  h += `<div class="card pad0"><div class="list">${studs.map((s) => {
    const oc = obsCounts(s.id, { from, to });
    const tot = oc.plus + oc.minus;
    const ratio = tot ? oc.plus / tot : null;
    const tdy = S.observations.filter((o) => o.studentId === s.id && o.date === d);
    return `<div class="li">${UI.avatar(s, 'sm')}<div class="li-main" data-nav="/student/${s.id}"><div class="li-t">${esc(sName(s))}</div>
      <div class="li-s"><span style="color:var(--ok)">+${oc.plus}</span> / <span style="color:var(--danger)">–${oc.minus}</span>${oc.ha ? ` · HA ${oc.ha}` : ''}${oc.mat ? ` · Mat. ${oc.mat}` : ''}${oc.stoer ? ` · St. ${oc.stoer}` : ''}${oc.lob ? ` · ★${oc.lob}` : ''}</div>
      ${ratio != null ? `<div class="progress" style="margin-top:4px;max-width:160px"><i style="width:${Math.round(ratio * 100)}%;background:${ratio >= .6 ? 'var(--ok)' : ratio >= .4 ? 'var(--warn)' : 'var(--danger)'}"></i></div>` : ''}</div>
      <div class="obs-btns">
        <button class="obs-btn plus" data-act="obs-quick" data-k="plus" data-sid="${s.id}" data-d="${d}">${icon('plus')}${tdy.filter((o) => o.kind === 'plus').length ? `<sup>${tdy.filter((o) => o.kind === 'plus').length}</sup>` : ''}</button>
        <button class="obs-btn minus" data-act="obs-quick" data-k="minus" data-sid="${s.id}" data-d="${d}">${icon('minus')}${tdy.filter((o) => o.kind === 'minus').length ? `<sup>${tdy.filter((o) => o.kind === 'minus').length}</sup>` : ''}</button>
        <button class="obs-btn" data-act="obs-more" data-sid="${s.id}" data-d="${d}">${icon('ellipsis')}</button>
      </div></div>`;
  }).join('')}</div></div>`;
  return h;
}
A['beh-term'] = (el) => { App.behTerm = el.dataset.v; App.refresh(); };
