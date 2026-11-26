/* Noten: Übersicht, Leistungsnachweise, Notenspiegel, Notenschlüssel */
'use strict';

function gradeFilter(c) {
  App.gf = App.gf || {};
  const f = App.gf[c.id] || {};
  const subs = subjectsOf(c.id);
  if (f.subject === undefined) f.subject = subs.length > 1 ? subs[0].id : '';
  if (!f.term) f.term = 'year';
  App.gf[c.id] = f;
  return f;
}
function finalKey(c, f) { return `${c.id}|${f.subject || ''}|${f.term}`; }

function classGradesTab(c) {
  const f = gradeFilter(c);
  const subs = subjectsOf(c.id);
  const gs = gsOf(c.id);
  const [from, to] = termRange(f.term === 'year' ? null : f.term);
  const studs = studentsOf(c.id);
  const list = sortBy(assessmentsOf(c.id, { subjectId: f.subject || undefined, from, to }), (a) => a.date || '9999', 'title');
  let h = '';
  if (subs.length > 1) h += UI.chips(subs.map((s) => ({ v: s.id, l: s.name, c: s.color })), f.subject, 'gf-subject', { all: 'Alle Fächer' });
  h += UI.seg([{ v: 'year', l: 'Schuljahr' }, { v: '1', l: '1. Halbjahr' }, { v: '2', l: '2. Halbjahr' }, { v: 'all', l: 'Alle' }], f.term, 'gf-term');

  if (!studs.length) return h + UI.empty('users', 'Füge zuerst Schüler:innen hinzu.');
  if (!list.length) {
    return h + UI.empty('award', 'Noch keine Leistungsnachweise in diesem Zeitraum.', `<button class="btn btn-primary" data-act="assess-add" data-id="${c.id}">${icon('plus')}Leistungsnachweis anlegen</button>`);
  }
  const finals = (S.finals || {})[finalKey(c, f)] || {};
  const opts = { subjectId: f.subject || undefined, from, to };
  // Tabelle
  h += `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Name</th>${list.map((a) => `<th class="rot" data-nav="/assessment/${a.id}"><div><i class="dot" style="background:${(cat(a.catId) || {}).color || '#888'}"></i> ${esc(a.title)}${a.date ? ' · ' + fmtDS(a.date) : ''}</div></th>`).join('')}<th>Ø</th><th>Note</th></tr></thead><tbody>`;
  for (const s of studs) {
    const av = studentAverage(s.id, c.id, opts).avg;
    const fin = finals[s.id];
    h += `<tr><td data-nav="/student/${s.id}">${esc(sShort(s))}</td>${list.map((a) => `<td class="tap" data-act="grade-cell" data-a="${a.id}" data-s="${s.id}">${a.grades && a.grades[s.id] && a.grades[s.id].v != null ? gradeBadge(gs, a.grades[s.id].v) : '<span class="muted">·</span>'}</td>`).join('')}
      <td class="avg-col">${avgBadge(gs, av)}</td>
      <td class="tap" data-act="final-cell" data-c="${c.id}" data-s="${s.id}">${fin != null ? `<b style="text-decoration:underline">${esc(gs.format(fin))}</b>` : av != null ? `<span class="muted">${gs.whole(av)}</span>` : '·'}</td></tr>`;
  }
  const colAvgs = list.map((a) => assessmentStats(a).avg);
  const allAvgs = studs.map((s) => studentAverage(s.id, c.id, opts).avg).filter((v) => v != null);
  h += `</tbody><tfoot><tr><td>Ø Klasse</td>${colAvgs.map((v) => `<td>${v != null ? fmtNum(v) : ''}</td>`).join('')}<td>${allAvgs.length ? fmtNum(avg(allAvgs)) : ''}</td><td></td></tr></tfoot></table></div>`;
  h += `<p class="muted small" style="margin:-4px 4px 12px">Tippe auf eine Zelle für die schnelle Noteneingabe. „Note" zeigt die gerundete Empfehlung – tippe darauf, um eine Zeugnisnote festzulegen.</p>`;

  // Liste der Leistungsnachweise
  h += `<div class="section-title">${icon('file-text')}Leistungsnachweise</div><div class="card pad0"><div class="list">${[...list].reverse().map((a) => assessmentItem(a)).join('')}</div></div>`;
  h += `<div class="btn-row"><button class="btn" data-act="grades-export" data-id="${c.id}">${icon('file-spreadsheet')}CSV-Export</button><button class="btn" data-act="grades-print" data-id="${c.id}">${icon('printer')}Drucken</button></div>`;
  return h;
}
function assessmentItem(a) {
  const st = assessmentStats(a);
  const k = cat(a.catId) || { name: '', color: '#888' };
  const total = studentsOf(a.classId).length;
  return `<div class="li" data-nav="/assessment/${a.id}"><div class="li-ic" style="background:${rgba(k.color, .14)};color:${k.color}">${icon(k.exam ? 'file-text' : 'pen-line')}</div>
    <div class="li-main"><div class="li-t">${esc(a.title)}</div><div class="li-s">${a.date ? fmtD(a.date) + ' · ' : ''}${esc(k.name)}${Number(a.weight) !== 1 && a.weight ? ` · ×${fmtNumShort(a.weight)}` : ''} · ${st.n}/${total} bewertet</div></div>
    <div class="li-end">${st.avg != null ? avgBadge(st.gs, st.avg) : (a.date && a.date >= today() ? `<span class="badge acc">${relDay(a.date)}</span>` : '')}</div></div>`;
}
A['gf-subject'] = (el) => { const id = App.path.split('/')[2]; gradeFilter(cls(id)).subject = el.dataset.v; App.refresh(); };
A['gf-term'] = (el) => { const id = App.path.split('/')[2]; gradeFilter(cls(id)).term = el.dataset.v; App.refresh(); };
A['assess-add'] = (el) => {
  const c = cls(el.dataset.id);
  const f = c ? gradeFilter(c) : {};
  editAssessment(null, { classId: el.dataset.id, subjectId: f.subject || (subjectsOf(el.dataset.id)[0] || {}).id || '' });
};
A['grade-cell'] = (el) => gradeSheet(byId('assessments', el.dataset.a), el.dataset.s);
A['final-cell'] = async (el) => {
  const c = cls(el.dataset.c);
  const f = gradeFilter(c);
  const gs = gsOf(c.id);
  const s = stu(el.dataset.s);
  const key = finalKey(c, f);
  S.finals = S.finals || {};
  const av = studentAverage(s.id, c.id, { subjectId: f.subject || undefined, from: termRange(f.term === 'year' ? null : f.term)[0], to: termRange(f.term === 'year' ? null : f.term)[1] }).avg;
  const v = await UI.menu(`Zeugnisnote: ${sShort(s)}`, [
    { l: av != null ? `Empfehlung: ${gs.whole(av)} (Ø ${fmtNum(av)})` : 'Keine Noten vorhanden', i: 'info', v: '__none' },
    ...gs.buckets.map((b) => ({ l: String(b), v: b, on: S.finals[key] && S.finals[key][s.id] === b })),
    { l: 'Festlegung entfernen', i: 'x', v: '__clear' },
  ]);
  if (v == null || v === '__none') return;
  S.finals[key] = S.finals[key] || {};
  if (v === '__clear') delete S.finals[key][s.id]; else S.finals[key][s.id] = v;
  save(); App.refresh();
};

// ------------------------------------------------------------------ Schnelleingabe
function gradeSheet(a, sid) {
  if (!a) return;
  const gs = gsOf(a.classId);
  const studs = studentsOf(a.classId);
  let cur = sid;
  const m = UI.open({ title: a.title, body: '<div id="gs-body"></div>', cls: 'grade-sheet' });
  const body = m.el.querySelector('#gs-body');
  const draw = () => {
    const s = stu(cur);
    const g = (a.grades && a.grades[cur]) || {};
    body.innerHTML = `<div class="row" style="margin-bottom:12px">${UI.avatar(s)}<div class="sp"><div class="b">${esc(sName(s))}</div><div class="muted small">${esc(cName(a.classId))} · ${a.date ? fmtD(a.date) : ''}</div></div>${g.v != null ? gradeBadge(gs, g.v, 'big') : ''}</div>
      ${a.maxPoints ? `<label class="field"><span>Punkte (max. ${fmtNumShort(a.maxPoints)})</span><input class="inp" id="gs-p" type="number" inputmode="decimal" step="0.5" min="0" max="${a.maxPoints}" value="${g.p ?? ''}"></label><div style="height:10px"></div>` : ''}
      <div class="grade-pad">${gs.buttons.map((b) => { const v = gs.parse(b); return `<button class="gb-l${gs.level(v)}" data-g="${b}">${b}</button>`; }).join('')}</div>
      <label class="field mt"><span>Bemerkung</span><input class="inp" id="gs-n" value="${esc(g.note || '')}" placeholder="optional"></label>
      <div class="btn-row mt"><button class="btn" data-x="prev">${icon('chevron-left')}</button><button class="btn danger" data-x="clear">${icon('trash-2')}Entfernen</button><button class="btn" data-x="next">${icon('chevron-right')}</button></div>
      <button class="btn btn-primary btn-block mt" data-x="done">Fertig</button>`;
    const pin = body.querySelector('#gs-p');
    if (pin) {
      pin.addEventListener('change', () => {
        const p = parseNum(pin.value);
        setG(cur, p == null ? null : gradeFromPercent(gs, (100 * p) / a.maxPoints, a.key), p);
        draw();
      });
    }
    body.querySelectorAll('[data-g]').forEach((b) => b.addEventListener('click', () => { setG(cur, gs.parse(b.dataset.g)); next(); }));
    body.querySelector('[data-x="clear"]').addEventListener('click', () => { if (a.grades) delete a.grades[cur]; save(); draw(); });
    body.querySelector('[data-x="prev"]').addEventListener('click', () => { const i = studs.findIndex((x) => x.id === cur); cur = studs[(i - 1 + studs.length) % studs.length].id; draw(); });
    body.querySelector('[data-x="next"]').addEventListener('click', () => { const i = studs.findIndex((x) => x.id === cur); cur = studs[(i + 1) % studs.length].id; draw(); });
    body.querySelector('[data-x="done"]').addEventListener('click', () => m.close());
    body.querySelector('#gs-n').addEventListener('change', (e) => { a.grades = a.grades || {}; a.grades[cur] = { ...(a.grades[cur] || {}), note: e.target.value }; save(); });
  };
  const setG = (id, v, p) => {
    a.grades = a.grades || {};
    const old = a.grades[id] || {};
    const note = (body.querySelector('#gs-n') || {}).value ?? old.note;
    a.grades[id] = { ...old, v, note };
    if (p !== undefined) a.grades[id].p = p;
    save();
  };
  const next = () => {
    const i = studs.findIndex((x) => x.id === cur);
    const rest = [...studs.slice(i + 1), ...studs.slice(0, i)];
    const n = rest.find((x) => !a.grades || !a.grades[x.id] || a.grades[x.id].v == null);
    if (!n) { m.close(); UI.toast('Alle bewertet ✓'); return; }
    cur = n.id; draw();
  };
  const origClose = m.close;
  m.close = (v) => { origClose(v); App.refresh(); };
  draw();
}

A['grade-quick-student'] = async (el) => {
  const s = stu(el.dataset.id);
  const list = sortBy(S.assessments.filter((a) => a.classId === s.classId), 'date').reverse();
  const choice = await UI.menu('Leistungsnachweis wählen', [
    { l: 'Neuer Leistungsnachweis …', i: 'plus', v: '__new' },
    ...list.slice(0, 15).map((a) => ({ l: a.title, s: (a.date ? fmtD(a.date) : '') + ' · ' + ((cat(a.catId) || {}).name || ''), v: a.id, i: 'file-text' })),
  ]);
  if (!choice) return;
  if (choice === '__new') editAssessment(null, { classId: s.classId, subjectId: (subjectsOf(s.classId)[0] || {}).id || '', catId: 'cat-muendl' }, (a) => gradeSheet(a, s.id));
  else gradeSheet(byId('assessments', choice), s.id);
};

// ------------------------------------------------------------------ Formular
function editAssessment(a, preset = {}, after) {
  const isNew = !a;
  const classId = a ? a.classId : preset.classId;
  UI.form({
    title: isNew ? 'Neuer Leistungsnachweis' : 'Leistungsnachweis bearbeiten',
    fields: [
      { k: 'title', label: 'Bezeichnung', req: true, ph: 'z. B. 2. Klassenarbeit, Vokabeltest, Referat' },
      { k: 'classId', label: 'Klasse', type: 'select', opts: classOptions(), half: true },
      { k: 'subjectId', label: 'Fach', type: 'select', opts: subjectOptions(true), half: true },
      { k: 'catId', label: 'Art / Kategorie', type: 'select', opts: S.categories.map((k) => ({ v: k.id, l: `${k.name} (${k.weight} %)` })) },
      { k: 'date', label: 'Datum', type: 'date', half: true },
      { k: 'weight', label: 'Gewicht in Kategorie', type: 'number', step: '0.5', min: '0', inputmode: 'decimal', half: true, hint: 'Standard 1' },
      { k: 'maxPoints', label: 'Maximale Punktzahl (optional)', type: 'number', step: '0.5', min: '0', inputmode: 'decimal', hint: 'Dann gibst du Punkte ein und die Note wird über den Notenschlüssel berechnet.' },
      { k: 'notes', label: 'Themen / Inhalte / Notizen', type: 'textarea', rows: 3 },
    ],
    values: a ? { ...a } : { date: today(), weight: 1, catId: S.categories[0] ? S.categories[0].id : '', ...preset },
    onMount: (el) => {
      const c = el.querySelector('[name=classId]');
      const s = el.querySelector('[name=subjectId]');
      c.addEventListener('change', () => { const subs = subjectsOf(c.value); if (subs.length && !subs.some((x) => x.id === s.value)) s.value = subs[0].id; });
      if (!classId && c.value) c.dispatchEvent(new Event('change'));
    },
    onSave: (v) => {
      const obj = upsert('assessments', { ...(a || { grades: {} }), ...v, weight: v.weight == null ? 1 : v.weight });
      save();
      if (after) { App.refresh(); after(obj); return; }
      if (isNew) App.navigate('/assessment/' + obj.id); else App.refresh();
    },
    onDelete: isNew ? null : () => deleteAssessment(a),
  });
}
async function deleteAssessment(a) {
  const n = Object.values(a.grades || {}).filter((g) => g.v != null).length;
  if (!(await UI.confirm(`„${esc(a.title)}"${n ? ` mit ${n} Noten` : ''} löschen?`, { danger: true, ok: 'Löschen' }))) return false;
  const idx = S.assessments.indexOf(a);
  S.assessments.splice(idx, 1);
  save();
  if (App.path.startsWith('/assessment/')) App.back(); else App.refresh();
  UI.toast('Gelöscht', { undo: () => { S.assessments.splice(idx, 0, a); save(); App.refresh(); } });
  return true;
}

// ------------------------------------------------------------------ Detailseite
function assessStatsHTML(a) {
  const st = assessmentStats(a);
  const total = studentsOf(a.classId).length;
  const gs = st.gs;
  const maxD = Math.max(1, ...Object.values(st.dist));
  const share = st.n ? st.failing / st.n : 0;
  let h = UI.stats([
    { v: st.avg != null ? fmtNum(st.avg) : '–', l: 'Durchschnitt', c: st.avg != null ? gradeColor(gs, st.avg) : '' },
    { v: `${st.n}/${total}`, l: 'bewertet' },
    { v: st.best != null ? gs.format(st.best) : '–', l: 'beste Note' },
    { v: st.n ? Math.round(share * 100) + ' %' : '–', l: gs.id === 'punkte' ? 'unter 5 P.' : '5 und 6', c: share > 1 / 3 ? 'var(--danger)' : '' },
  ]);
  if (st.n) {
    const buckets = gs.id === 'punkte' ? [[15, 13, '1'], [12, 10, '2'], [9, 7, '3'], [6, 4, '4'], [3, 1, '5'], [0, 0, '6']] : null;
    h += `<div class="card"><div class="card-h"><h3>${icon('chart-column')}Notenspiegel</h3><button class="link" data-act="assess-share" data-id="${a.id}">${icon('share-2')}</button></div><div class="bars">${
      (buckets || gs.buckets.map((b) => [b, b, String(b)])).map(([hi, lo, lab]) => {
        let n = 0;
        for (let x = Math.min(hi, lo); x <= Math.max(hi, lo); x++) n += st.dist[x] || 0;
        const lvl = gs.id === 'punkte' ? gs.level(hi) : gs.level(hi);
        return `<div class="bar"><i data-v="${n}" style="height:${(n / maxD) * 100}%;--bc:${LEVEL_COLORS[lvl]}"></i><span>${lab}</span></div>`;
      }).join('')}</div>
      ${gs.id === 'punkte' ? `<div class="muted small center mt">${gs.buckets.filter((b) => st.dist[b]).map((b) => `${b} P.: ${st.dist[b]}`).join(' · ')}</div>` : ''}
    </div>`;
    if (share > 1 / 3 && (cat(a.catId) || {}).exam) {
      h += `<div class="banner warn">${icon('triangle-alert')}<div>Mehr als ein Drittel der Arbeiten ist ${gs.id === 'punkte' ? 'unter 5 Punkten' : 'mangelhaft oder ungenügend'}. Je nach Bundesland ist eine Genehmigung durch die Schulleitung nötig.</div></div>`;
    }
  }
  return h;
}

App.def('/assessment/:id', (p) => {
  const a = byId('assessments', p.id);
  if (!a) return { title: 'Leistungsnachweis', html: UI.empty('file-text', 'Nicht gefunden.') };
  const c = cls(a.classId);
  const gs = gsOf(a.classId);
  const k = cat(a.catId) || { name: '', color: '#888' };
  const studs = studentsOf(a.classId);
  let h = `<div class="card" style="border-left:5px solid ${k.color}"><div class="row"><div class="sp">
    <div class="b" style="font-size:1.1rem">${esc(a.title)}</div>
    <div class="muted small">${esc(c ? c.name : '')}${a.subjectId ? ' · ' + esc(subName(a.subjectId)) : ''} · ${a.date ? fmtDW(a.date) : 'ohne Datum'}</div>
    <div class="row row-wrap mt" style="gap:6px"><span class="badge" style="background:${rgba(k.color, .14)};color:${k.color}">${esc(k.name)}</span>${a.weight && Number(a.weight) !== 1 ? `<span class="badge">Gewicht ×${fmtNumShort(a.weight)}</span>` : ''}${a.maxPoints ? `<span class="badge acc">max. ${fmtNumShort(a.maxPoints)} Punkte</span>` : ''}</div>
  </div></div>${a.notes ? `<p class="text2 small" style="margin:10px 0 0">${nl2br(a.notes)}</p>` : ''}</div>`;
  h += `<div id="as-stats">${assessStatsHTML(a)}</div>`;

  if (a.maxPoints) {
    const rows = keyTable(gs, Number(a.maxPoints), a.key);
    h += `<details class="card"><summary class="b" style="cursor:pointer">${icon('table')} Notenschlüssel (${fmtNumShort(a.maxPoints)} Punkte)</summary>
      <table class="tbl key-tbl mt"><tr><th>Note</th><th>ab Punkte</th><th>bis</th><th>ab %</th></tr>${rows.map((r) => `<tr><td><b>${r.grade}</b></td><td>${fmtNumShort(Math.max(0, r.from), 1)}</td><td>${fmtNumShort(Math.max(0, r.to), 1)}</td><td>${r.pct} %</td></tr>`).join('')}</table>
      <button class="btn btn-sm btn-soft mt" data-act="assess-key" data-id="${a.id}">${icon('sliders-horizontal')}Schlüssel für diese Arbeit anpassen</button>
      ${a.key ? `<button class="btn btn-sm btn-ghost mt" data-act="assess-key-reset" data-id="${a.id}">Standard verwenden</button>` : ''}
    </details>`;
  }

  if (!studs.length) h += UI.empty('users', 'Diese Klasse hat noch keine Schüler:innen.');
  else {
    h += `<div class="section-title">${icon('pen-line')}Bewertung eingeben</div>
      <p class="muted small" style="margin:-4px 4px 10px">${a.maxPoints ? 'Punkte eingeben – die Note wird automatisch berechnet (überschreibbar).' : `Note eintippen, z. B. ${gs.id === 'punkte' ? '11' : '2-, 3+, 2,5'} – oder auf die Zeile tippen.`}</p>
      <div class="card pad0"><div class="list">${studs.map((s) => {
        const g = (a.grades && a.grades[s.id]) || {};
        return `<div class="li" id="row-${s.id}">${UI.avatar(s, 'sm')}<div class="li-main" data-act="grade-cell" data-a="${a.id}" data-s="${s.id}"><div class="li-t">${esc(sName(s))}</div>${g.note ? `<div class="li-s">${esc(g.note)}</div>` : ''}</div>
          ${a.maxPoints ? `<input class="gin" type="number" inputmode="decimal" step="0.5" min="0" max="${a.maxPoints}" placeholder="P." value="${g.p ?? ''}" data-change="as-points" data-a="${a.id}" data-s="${s.id}">` : ''}
          <input class="gin" inputmode="${gs.id === 'punkte' ? 'numeric' : 'text'}" placeholder="Note" value="${esc(g.v != null ? gs.format(g.v) : '')}" data-change="as-grade" data-a="${a.id}" data-s="${s.id}" style="width:58px">
        </div>`;
      }).join('')}</div></div>`;
  }
  return {
    title: a.title, sub: c ? c.name : '', tab: 'classes', html: h,
    actions: [{ icon: 'pencil', act: 'assess-edit', id: a.id, label: 'Bearbeiten' }, { icon: 'ellipsis', act: 'assess-menu', id: a.id }],
  };
});
A['assess-edit'] = (el) => editAssessment(byId('assessments', el.dataset.id));
A['as-points'] = (el) => {
  const a = byId('assessments', el.dataset.a);
  const gs = gsOf(a.classId);
  const p = parseNum(el.value);
  if (p != null && (p < 0 || p > Number(a.maxPoints))) { el.classList.add('invalid'); UI.toast(`Punkte zwischen 0 und ${a.maxPoints}`, { type: 'err' }); return; }
  el.classList.remove('invalid');
  a.grades = a.grades || {};
  const old = a.grades[el.dataset.s] || {};
  if (p == null) { a.grades[el.dataset.s] = { ...old, p: null, v: null }; } else {
    const v = gradeFromPercent(gs, (100 * p) / Number(a.maxPoints), a.key);
    a.grades[el.dataset.s] = { ...old, p, v };
  }
  const g = a.grades[el.dataset.s];
  const gi = el.parentElement.querySelector('[data-change="as-grade"]');
  if (gi) gi.value = g.v != null ? gs.format(g.v) : '';
  save();
  $('#as-stats').innerHTML = assessStatsHTML(a);
};
A['as-grade'] = (el) => {
  const a = byId('assessments', el.dataset.a);
  const gs = gsOf(a.classId);
  const raw = el.value.trim();
  const v = gs.parse(raw);
  if (raw && v == null) { el.classList.add('invalid'); UI.toast('Ungültige Note', { type: 'err' }); return; }
  el.classList.remove('invalid');
  a.grades = a.grades || {};
  a.grades[el.dataset.s] = { ...(a.grades[el.dataset.s] || {}), v };
  el.value = v != null ? gs.format(v) : '';
  save();
  $('#as-stats').innerHTML = assessStatsHTML(a);
};
A['assess-key'] = (el) => {
  const a = byId('assessments', el.dataset.id);
  const gs = gsOf(a.classId);
  if (gs.id === 'punkte') {
    const k = a.key || S.settings.keyPunkte;
    UI.form({
      title: 'Notenschlüssel (Prozent)',
      fields: k.map((v, i) => ({ k: 'p' + i, label: `${15 - i} Punkte ab %`, type: 'number', inputmode: 'decimal', half: true })),
      values: Object.fromEntries(k.map((v, i) => ['p' + i, v])),
      onSave: (v) => { a.key = k.map((x, i) => Number(v['p' + i] ?? x)); save(); App.refresh(); },
    });
  } else {
    const k = a.key || S.settings.keyNoten;
    UI.form({
      title: 'Notenschlüssel (Prozent)',
      fields: k.map((r) => ({ k: 'g' + r.g, label: `Note ${r.g} ab %`, type: 'number', inputmode: 'decimal', half: true })),
      values: Object.fromEntries(k.map((r) => ['g' + r.g, r.min])),
      onSave: (v) => {
        a.key = k.map((r) => ({ g: r.g, min: Number(v['g' + r.g] ?? r.min) }));
        recalcPoints(a); save(); App.refresh();
      },
    });
  }
};
A['assess-key-reset'] = (el) => { const a = byId('assessments', el.dataset.id); delete a.key; recalcPoints(a); save(); App.refresh(); };
function recalcPoints(a) {
  if (!a.maxPoints) return;
  const gs = gsOf(a.classId);
  Object.values(a.grades || {}).forEach((g) => { if (g.p != null) g.v = gradeFromPercent(gs, (100 * g.p) / Number(a.maxPoints), a.key); });
}
function distText(a) {
  const st = assessmentStats(a);
  return `${a.title} – ${cName(a.classId)}${a.date ? ', ' + fmtD(a.date) : ''}\n` +
    st.gs.buckets.map((b) => `${b}: ${st.dist[b] || 0}`).join(' | ') +
    `\nDurchschnitt: ${st.avg != null ? fmtNum(st.avg) : '–'} (${st.n} Bewertungen)`;
}
A['assess-share'] = (el) => Files.share('Notenspiegel', distText(byId('assessments', el.dataset.id)));
A['assess-menu'] = (el) => {
  const a = byId('assessments', el.dataset.id);
  UI.menu(a.title, [
    { l: 'Bearbeiten', i: 'pencil', fn: () => editAssessment(a) },
    { l: 'Notenspiegel teilen', i: 'share-2', fn: () => Files.share('Notenspiegel', distText(a)) },
    { l: 'Notenliste drucken', i: 'printer', fn: () => printAssessment(a) },
    { l: 'Für andere Klasse kopieren', i: 'copy', fn: async () => {
      const id = await UI.menu('Kopieren nach', activeClasses().filter((c) => c.id !== a.classId).map((c) => ({ l: c.name, v: c.id, i: 'users' })));
      if (!id) return;
      const copy = { ...deepCopy(a), id: uid(), classId: id, grades: {} };
      S.assessments.push(copy); save(); App.navigate('/assessment/' + copy.id); UI.toast('Kopiert');
    } },
    { sep: true },
    { l: 'Löschen', i: 'trash-2', danger: true, fn: () => deleteAssessment(a) },
  ]);
};
function printAssessment(a) {
  const gs = gsOf(a.classId);
  const studs = studentsOf(a.classId);
  let h = `<p>${esc(cName(a.classId))}${a.subjectId ? ' · ' + esc(subName(a.subjectId)) : ''} · ${a.date ? fmtD(a.date) : ''} · ${esc((cat(a.catId) || {}).name || '')}</p>`;
  h += `<table><tr><th>#</th><th>Name</th>${a.maxPoints ? `<th>Punkte (/${fmtNumShort(a.maxPoints)})</th>` : ''}<th>Note</th><th>Bemerkung</th></tr>${studs.map((s, i) => { const g = (a.grades || {})[s.id] || {}; return `<tr><td>${i + 1}</td><td>${esc(sNameRev(s))}</td>${a.maxPoints ? `<td>${g.p != null ? fmtNumShort(g.p, 1) : ''}</td>` : ''}<td><b>${g.v != null ? esc(gs.format(g.v)) : ''}</b></td><td>${esc(g.note || '')}</td></tr>`; }).join('')}</table>`;
  h += `<h3>Notenspiegel</h3><pre>${esc(distText(a))}</pre>`;
  if (a.maxPoints) h += `<h3>Notenschlüssel</h3><table><tr><th>Note</th><th>Punkte</th></tr>${keyTable(gs, Number(a.maxPoints), a.key).map((r) => `<tr><td>${r.grade}</td><td>${fmtNumShort(Math.max(0, r.from), 1)} – ${fmtNumShort(Math.max(0, r.to), 1)}</td></tr>`).join('')}</table>`;
  Print.show(a.title, h);
}

A['grades-export'] = (el) => {
  const c = cls(el.dataset.id);
  const f = gradeFilter(c);
  const gs = gsOf(c.id);
  const [from, to] = termRange(f.term === 'year' ? null : f.term);
  const list = sortBy(assessmentsOf(c.id, { subjectId: f.subject || undefined, from, to }), 'date');
  const finals = (S.finals || {})[finalKey(c, f)] || {};
  const rows = [['Nachname', 'Vorname', ...list.map((a) => `${a.title} (${a.date ? fmtD(a.date) : ''})`), 'Durchschnitt', 'Note']];
  studentsOf(c.id).forEach((s) => {
    const av = studentAverage(s.id, c.id, { subjectId: f.subject || undefined, from, to }).avg;
    rows.push([s.lastName, s.firstName, ...list.map((a) => { const g = (a.grades || {})[s.id]; return g && g.v != null ? gs.format(g.v) : ''; }), av != null ? fmtNum(av) : '', finals[s.id] != null ? gs.format(finals[s.id]) : (av != null ? gs.whole(av) : '')]);
  });
  Files.csv(`Noten_${c.name.replace(/\W+/g, '_')}_${today()}.csv`, rows);
};
A['grades-print'] = (el) => {
  const c = cls(el.dataset.id);
  const f = gradeFilter(c);
  const gs = gsOf(c.id);
  const [from, to] = termRange(f.term === 'year' ? null : f.term);
  const list = sortBy(assessmentsOf(c.id, { subjectId: f.subject || undefined, from, to }), 'date');
  const finals = (S.finals || {})[finalKey(c, f)] || {};
  let h = `<p>${f.subject ? esc(subName(f.subject)) + ' · ' : ''}${{ year: 'Schuljahr', 1: '1. Halbjahr', 2: '2. Halbjahr', all: 'Gesamter Zeitraum' }[f.term]}</p>`;
  h += `<table><tr><th>Name</th>${list.map((a) => `<th>${esc(a.title)}<br><span class="p-small">${a.date ? fmtDS(a.date) : ''}</span></th>`).join('')}<th>Ø</th><th>Note</th></tr>`;
  studentsOf(c.id).forEach((s) => {
    const av = studentAverage(s.id, c.id, { subjectId: f.subject || undefined, from, to }).avg;
    h += `<tr><td>${esc(sNameRev(s))}</td>${list.map((a) => { const g = (a.grades || {})[s.id]; return `<td>${g && g.v != null ? esc(gs.format(g.v)) : ''}</td>`; }).join('')}<td><b>${av != null ? fmtNum(av) : ''}</b></td><td><b>${finals[s.id] != null ? gs.format(finals[s.id]) : ''}</b></td></tr>`;
  });
  h += '</table>';
  Print.show(`Notenübersicht ${c.name}`, h);
};
