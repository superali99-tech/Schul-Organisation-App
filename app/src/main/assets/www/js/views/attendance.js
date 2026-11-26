/* Anwesenheit / Fehlzeiten */
'use strict';

App.def('/attendance/:classId/:date/:period?', (p) => {
  const c = cls(p.classId);
  if (!c) return { title: 'Anwesenheit', html: UI.empty('user-check', 'Klasse nicht gefunden.') };
  const date = p.date;
  const period = p.period != null && p.period !== '' && p.period !== 'tag' ? Number(p.period) : null;
  const studs = studentsOf(c.id);
  const rec = attRecord(c.id, date, period);
  const e = (rec && rec.e) || {};
  const absent = Object.values(e).filter((x) => x.s === 'f' || x.s === 'e').length;
  const per = period != null ? periodTime(period) : null;
  // Stunden dieses Tages für Auswahl
  const dayLessons = lessonsOn(date).filter((l) => l.classId === c.id);
  let h = `<div class="tt-nav">
    <button class="btn btn-icon" data-nav="/attendance/${c.id}/${addDays(date, -1)}" data-replace>${icon('chevron-left')}</button>
    <div class="tt-week">${fmtDW(date)}<small>${period != null ? `${period + 1}. Stunde${per ? ` (${per.s}–${per.e})` : ''}` : 'Ganzer Tag'}</small></div>
    <button class="btn btn-icon" data-nav="/attendance/${c.id}/${addDays(date, 1)}" data-replace>${icon('chevron-right')}</button>
  </div>`;
  h += `<div class="chips"><button class="chip ${period == null ? 'on' : ''}" data-nav="/attendance/${c.id}/${date}/tag" data-replace>Ganzer Tag</button>${(dayLessons.length ? dayLessons.map((l) => l.period) : []).map((pp) => `<button class="chip ${period === pp ? 'on' : ''}" data-nav="/attendance/${c.id}/${date}/${pp}" data-replace>${pp + 1}. Std.</button>`).join('')}<button class="chip" data-act="att-pick-date" data-c="${c.id}">${icon('calendar')}Datum</button></div>`;
  if (!studs.length) return { title: `Anwesenheit ${c.name}`, tab: 'classes', html: h + UI.empty('users', 'Keine Schüler:innen in dieser Klasse.') };

  h += UI.stats([{ v: studs.length - absent, l: 'anwesend', c: 'var(--ok)' }, { v: absent, l: 'fehlen', c: absent ? 'var(--danger)' : '' }, { v: Object.values(e).filter((x) => x.s === 'v').length, l: 'verspätet' }]);
  if (!rec) h += `<div class="banner">${icon('info')}<div>Noch nicht erfasst. Alle gelten als anwesend – tippe nur bei Abwesenden auf den Status. <b>Speichern</b> passiert automatisch.</div></div>`;
  h += `<div class="card pad0"><div class="list">${studs.map((s) => {
    const x = e[s.id];
    const st = x ? x.s : 'a';
    return `<div class="li" style="flex-wrap:wrap">${UI.avatar(s, 'sm')}<div class="li-main" data-act="att-note" data-c="${c.id}" data-d="${date}" data-p="${period ?? ''}" data-s="${s.id}"><div class="li-t">${esc(sName(s))}</div>${x && (x.n || x.m) ? `<div class="li-s">${x.m ? x.m + ' Min. ' : ''}${esc(x.n || '')}</div>` : ''}</div>
      <div class="att-btns">
        <button class="att-btn present ${st === 'a' ? 'on' : ''}" data-act="att-set" data-v="a" data-c="${c.id}" data-d="${date}" data-p="${period ?? ''}" data-s="${s.id}" title="anwesend">${icon('check')}</button>
        ${Object.entries(ATT_STATES).map(([k, a]) => `<button class="att-btn ${st === k ? 'on' : ''}" style="--ac:${a.c}" data-act="att-set" data-v="${k}" data-c="${c.id}" data-d="${date}" data-p="${period ?? ''}" data-s="${s.id}" title="${a.l}">${a.s}</button>`).join('')}
      </div></div>`;
  }).join('')}</div></div>
  <p class="muted small" style="margin:0 4px">U = unentschuldigt · E = entschuldigt · V = verspätet · B = beurlaubt/Schulveranstaltung. Tippe auf einen Namen für Minuten/Notiz.</p>
  ${rec ? `<button class="btn btn-ghost danger mt" data-act="att-delete" data-id="${rec.id}">${icon('trash-2')}Erfassung löschen</button>` : `<button class="btn btn-primary btn-block mt" data-act="att-save-all" data-c="${c.id}" data-d="${date}" data-p="${period ?? ''}">${icon('circle-check')}Alle anwesend – speichern</button>`}`;
  return { title: `Anwesenheit ${c.name}`, sub: fmtDL(date), tab: 'classes', html: h };
});

function attEnsure(classId, date, period) {
  let r = attRecord(classId, date, period);
  if (!r) { r = { id: uid(), classId, date, period, e: {} }; S.attendance.push(r); }
  return r;
}
const pnum = (v) => (v === '' || v == null ? null : Number(v));
A['att-set'] = (el) => {
  const r = attEnsure(el.dataset.c, el.dataset.d, pnum(el.dataset.p));
  const v = el.dataset.v;
  if (v === 'a') delete r.e[el.dataset.s];
  else r.e[el.dataset.s] = { ...(r.e[el.dataset.s] || {}), s: v };
  save();
  App.refresh();
};
A['att-save-all'] = (el) => { attEnsure(el.dataset.c, el.dataset.d, pnum(el.dataset.p)); save(); App.refresh(); UI.toast('Gespeichert'); };
A['att-delete'] = (el) => deleteWithUndo('attendance', el.dataset.id, 'Anwesenheitserfassung');
A['att-pick-date'] = async (el) => {
  const d = await UI.prompt('Datum wählen', { type: 'date', value: today() });
  if (d) App.navigate(`/attendance/${el.dataset.c}/${d}/tag`, { replace: true });
};
A['att-note'] = (el) => {
  const s = stu(el.dataset.s);
  const r = attRecord(el.dataset.c, el.dataset.d, pnum(el.dataset.p));
  const x = (r && r.e[s.id]) || { s: 'a' };
  UI.form({
    title: sName(s),
    fields: [
      { k: 's', label: 'Status', type: 'select', opts: [{ v: 'a', l: 'Anwesend' }, ...Object.entries(ATT_STATES).map(([v, a]) => ({ v, l: a.l }))] },
      { k: 'm', label: 'Minuten (bei Verspätung)', type: 'number', inputmode: 'numeric' },
      { k: 'n', label: 'Notiz', ph: 'z. B. Attest liegt vor, Arzttermin' },
    ],
    values: x,
    onSave: (v) => {
      const rec = attEnsure(el.dataset.c, el.dataset.d, pnum(el.dataset.p));
      if (v.s === 'a' && !v.n) delete rec.e[s.id];
      else rec.e[s.id] = { s: v.s === 'a' ? 'a' : v.s, m: v.m, n: v.n };
      if (rec.e[s.id] && rec.e[s.id].s === 'a') delete rec.e[s.id];
      save(); App.refresh();
    },
  });
};
A['att-new'] = (el) => {
  const c = cls(el.dataset.id);
  const d = today();
  const l = lessonsOn(d).find((x) => x.classId === c.id && !x.cancelled);
  App.navigate(`/attendance/${c.id}/${d}/${l ? l.period : 'tag'}`);
};

function classAttendanceTab(c) {
  const studs = studentsOf(c.id);
  const term = App.attTerm || 'year';
  const [from, to] = termRange(term === 'year' ? null : term === 'all' ? 'all' : term);
  const recs = sortBy(S.attendance.filter((r) => r.classId === c.id && inRange(r.date, from, to)), 'date', (r) => r.period ?? -1).reverse();
  let h = `<div class="btn-row mb"><button class="btn btn-primary" data-act="att-new" data-id="${c.id}">${icon('user-check')}Heute erfassen</button><button class="btn" data-act="att-pick-date" data-c="${c.id}">${icon('calendar')}Anderes Datum</button></div>`;
  h += UI.seg([{ v: 'year', l: 'Schuljahr' }, { v: '1', l: '1. HJ' }, { v: '2', l: '2. HJ' }, { v: 'all', l: 'Alles' }], term, 'att-term');
  if (!studs.length) return h + UI.empty('users', 'Keine Schüler:innen.');
  // Statistik je Schüler:in
  const stats = studs.map((s) => ({ s, a: attStats(s.id, { from, to }) }));
  h += `<div class="section-title">${icon('chart-column')}Fehlzeiten (${recs.length} erfasste Termine)</div>`;
  h += `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Name</th><th>Fehlst.</th><th>E</th><th>U</th><th>V</th><th>Quote</th></tr></thead><tbody>${stats.map(({ s, a }) => `
    <tr data-nav="/student/${s.id}"><td>${esc(sShort(s))}</td><td><b class="${a.absent >= 10 ? 'danger' : ''}">${a.absent}</b></td><td>${a.e}</td><td class="${a.f ? 'danger' : ''}">${a.f}</td><td>${a.v}${a.minutes ? `<span class="muted small"> (${a.minutes}′)</span>` : ''}</td><td>${a.pct != null ? Math.round(a.pct) + ' %' : '–'}</td></tr>`).join('')}</tbody></table></div>`;
  h += `<div class="btn-row mb"><button class="btn" data-act="att-export" data-id="${c.id}">${icon('file-spreadsheet')}CSV-Export</button><button class="btn" data-act="att-print" data-id="${c.id}">${icon('printer')}Drucken</button></div>`;
  if (recs.length) {
    h += `<div class="section-title">${icon('history')}Erfasste Termine</div><div class="card pad0"><div class="list">${recs.slice(0, 40).map((r) => {
      const ab = Object.values(r.e || {}).filter((x) => x.s === 'f' || x.s === 'e').length;
      const names = Object.entries(r.e || {}).map(([sid, x]) => `${sShort(stu(sid))} (${ATT_STATES[x.s] ? ATT_STATES[x.s].s : '?'})`).join(', ');
      return `<div class="li" data-nav="/attendance/${c.id}/${r.date}/${r.period ?? 'tag'}"><div class="li-ic">${icon('calendar-check')}</div><div class="li-main"><div class="li-t">${fmtDW(r.date)}${r.period != null ? ` · ${r.period + 1}. Std.` : ' · ganzer Tag'}</div><div class="li-s">${names ? esc(names) : 'Alle anwesend'}</div></div><div class="li-end">${ab ? `<span class="badge red">${ab} fehlen</span>` : `<span class="badge green">${icon('check')}</span>`}</div></div>`;
    }).join('')}</div></div>`;
  }
  return h;
}
A['att-term'] = (el) => { App.attTerm = el.dataset.v; App.refresh(); };
A['att-export'] = (el) => {
  const c = cls(el.dataset.id);
  const term = App.attTerm || 'year';
  const [from, to] = termRange(term === 'year' ? null : term === 'all' ? 'all' : term);
  const recs = sortBy(S.attendance.filter((r) => r.classId === c.id && inRange(r.date, from, to)), 'date');
  const rows = [['Nachname', 'Vorname', 'Fehlstunden', 'entschuldigt', 'unentschuldigt', 'verspätet', 'Minuten zu spät', ...recs.map((r) => fmtD(r.date) + (r.period != null ? ` ${r.period + 1}.` : ''))]];
  studentsOf(c.id).forEach((s) => {
    const a = attStats(s.id, { from, to });
    rows.push([s.lastName, s.firstName, a.absent, a.e, a.f, a.v, a.minutes, ...recs.map((r) => (r.e[s.id] ? ATT_STATES[r.e[s.id].s].s : ''))]);
  });
  Files.csv(`Fehlzeiten_${c.name.replace(/\W+/g, '_')}_${today()}.csv`, rows);
};
A['att-print'] = (el) => {
  const c = cls(el.dataset.id);
  const term = App.attTerm || 'year';
  const [from, to] = termRange(term === 'year' ? null : term === 'all' ? 'all' : term);
  let h = `<table><tr><th>Name</th><th>Fehlstunden</th><th>entschuldigt</th><th>unentschuldigt</th><th>Verspätungen</th></tr>${studentsOf(c.id).map((s) => { const a = attStats(s.id, { from, to }); return `<tr><td>${esc(sNameRev(s))}</td><td>${a.absent}</td><td>${a.e}</td><td>${a.f}</td><td>${a.v}</td></tr>`; }).join('')}</table>`;
  Print.show(`Fehlzeiten ${c.name}`, h);
};
