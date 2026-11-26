/* Sitzplan */
'use strict';

function seatPlan(classId) {
  if (!S.seating[classId]) S.seating[classId] = { rows: 5, cols: 6, seats: {}, off: {}, front: 'top' };
  const p = S.seating[classId];
  p.seats = p.seats || {};
  p.off = p.off || {};
  return p;
}

function classSeatingTab(c) {
  const p = seatPlan(c.id);
  const studs = studentsOf(c.id);
  const placed = new Set(Object.values(p.seats));
  const pool = studs.filter((s) => !placed.has(s.id));
  const sel = App.seatSel && App.seatSel.cid === c.id ? App.seatSel : null;
  const editOff = !!App.seatOff;
  const absent = absentOn(c.id, today());
  const board = `<div class="board">TAFEL / LEHRERPULT</div>`;
  let h = `<div class="row row-wrap mb" style="gap:6px">
    <span class="small muted">Reihen</span><button class="btn btn-icon sm" data-act="seat-dim" data-id="${c.id}" data-k="rows" data-d="-1">${icon('minus')}</button><b>${p.rows}</b><button class="btn btn-icon sm" data-act="seat-dim" data-id="${c.id}" data-k="rows" data-d="1">${icon('plus')}</button>
    <span class="small muted" style="margin-left:8px">Plätze</span><button class="btn btn-icon sm" data-act="seat-dim" data-id="${c.id}" data-k="cols" data-d="-1">${icon('minus')}</button><b>${p.cols}</b><button class="btn btn-icon sm" data-act="seat-dim" data-id="${c.id}" data-k="cols" data-d="1">${icon('plus')}</button>
  </div>
  <div class="row row-wrap mb" style="gap:6px">
    <button class="btn btn-sm" data-act="seat-shuffle" data-id="${c.id}">${icon('shuffle')}Zufällig</button>
    <button class="btn btn-sm ${editOff ? 'btn-primary' : ''}" data-act="seat-offmode">${icon('grid-3x3')}${editOff ? 'Fertig' : 'Gänge'}</button>
    <button class="btn btn-sm" data-act="seat-front" data-id="${c.id}">${icon('arrow-up-down')}Tafel</button>
    <button class="btn btn-sm" data-act="seat-print" data-id="${c.id}">${icon('printer')}</button>
    <button class="btn btn-sm" data-act="seat-clear" data-id="${c.id}">${icon('trash-2')}</button>
  </div>`;
  if (editOff) h += `<div class="banner">${icon('info')}<div>Tippe auf Plätze, um sie als Gang/Lücke zu markieren oder wieder zu aktivieren.</div></div>`;
  else h += `<p class="muted small" style="margin:0 4px 8px">Tippe eine Person unten an und dann einen Platz. Zwei Plätze nacheinander antippen tauscht sie.</p>`;
  h += '<div class="seat-wrap">';
  if (p.front === 'top') h += board;
  h += `<div class="seat-grid" style="grid-template-columns:repeat(${p.cols}, minmax(52px, 1fr))">`;
  for (let r = 0; r < p.rows; r++) {
    for (let col = 0; col < p.cols; col++) {
      const key = `${r}_${col}`;
      const off = p.off[key];
      const s = stu(p.seats[key]);
      const isSel = sel && sel.key === key;
      if (off && !editOff) { h += '<div class="seat off"></div>'; continue; }
      h += `<div class="seat ${s ? 'has' : ''} ${isSel ? 'sel' : ''} ${s && absent.has(s.id) ? 'absent' : ''}" style="${off ? 'opacity:.3;border-style:dotted' : ''}" data-act="seat-tap" data-id="${c.id}" data-k="${key}">${s ? `${UI.avatar(s, 'sm')}<span>${esc(s.firstName)}</span><span class="muted" style="font-weight:400">${esc((s.lastName || '').slice(0, 10))}</span>` : off ? icon('x') : ''}</div>`;
    }
  }
  h += '</div>';
  if (p.front !== 'top') h += board;
  h += '</div>';
  h += `<div class="section-title">Ohne Platz (${pool.length})</div>`;
  h += pool.length ? `<div class="pool">${pool.map((s) => `<button class="chip ${sel && sel.sid === s.id ? 'sel' : ''}" data-act="seat-pool" data-id="${c.id}" data-s="${s.id}">${esc(sShort(s))}</button>`).join('')}</div>` : '<p class="muted small">Alle haben einen Platz. ✓</p>';
  return h;
}
function seatingMount() { /* keine zusätzliche Logik nötig */ }

A['seat-dim'] = (el) => {
  const p = seatPlan(el.dataset.id);
  const k = el.dataset.k;
  p[k] = clamp(p[k] + Number(el.dataset.d), 1, 12);
  // Plätze außerhalb entfernen
  Object.keys(p.seats).forEach((key) => { const [r, c] = key.split('_').map(Number); if (r >= p.rows || c >= p.cols) delete p.seats[key]; });
  save(); App.refresh();
};
A['seat-offmode'] = () => { App.seatOff = !App.seatOff; App.seatSel = null; App.refresh(); };
A['seat-front'] = (el) => { const p = seatPlan(el.dataset.id); p.front = p.front === 'top' ? 'bottom' : 'top'; save(); App.refresh(); };
A['seat-clear'] = async (el) => {
  if (!(await UI.confirm('Alle Plätze leeren?', { ok: 'Leeren', danger: true }))) return;
  const p = seatPlan(el.dataset.id);
  const old = { ...p.seats };
  p.seats = {}; save(); App.refresh();
  UI.toast('Geleert', { undo: () => { p.seats = old; save(); App.refresh(); } });
};
A['seat-shuffle'] = async (el) => {
  const p = seatPlan(el.dataset.id);
  const studs = shuffle(studentsOf(el.dataset.id));
  const keys = [];
  for (let r = 0; r < p.rows; r++) for (let c = 0; c < p.cols; c++) if (!p.off[`${r}_${c}`]) keys.push(`${r}_${c}`);
  if (keys.length < studs.length && !(await UI.confirm(`Es gibt nur ${keys.length} Plätze für ${studs.length} Schüler:innen. Trotzdem verteilen?`))) return;
  const old = { ...p.seats };
  p.seats = {};
  studs.forEach((s, i) => { if (keys[i]) p.seats[keys[i]] = s.id; });
  save(); App.refresh();
  UI.toast('Neu verteilt', { undo: () => { p.seats = old; save(); App.refresh(); } });
};
A['seat-pool'] = (el) => {
  const cur = App.seatSel;
  App.seatSel = cur && cur.sid === el.dataset.s ? null : { cid: el.dataset.id, sid: el.dataset.s };
  App.refresh();
};
A['seat-tap'] = async (el) => {
  const cid = el.dataset.id;
  const key = el.dataset.k;
  const p = seatPlan(cid);
  if (App.seatOff) {
    if (p.off[key]) delete p.off[key]; else { p.off[key] = true; delete p.seats[key]; }
    save(); App.refresh(); return;
  }
  const sel = App.seatSel && App.seatSel.cid === cid ? App.seatSel : null;
  if (sel && sel.sid && !sel.key) {
    // Person aus Pool setzen
    Object.keys(p.seats).forEach((k) => { if (p.seats[k] === sel.sid) delete p.seats[k]; });
    p.seats[key] = sel.sid;
    App.seatSel = null; save(); App.refresh(); return;
  }
  if (sel && sel.key) {
    if (sel.key !== key) {
      const a = p.seats[sel.key], b = p.seats[key];
      if (b) p.seats[sel.key] = b; else delete p.seats[sel.key];
      if (a) p.seats[key] = a; else delete p.seats[key];
      save();
    }
    App.seatSel = null; App.refresh(); return;
  }
  if (p.seats[key]) {
    const s = stu(p.seats[key]);
    const choice = await UI.menu(sName(s), [
      { l: 'Platz tauschen / verschieben', i: 'move', v: 'move' },
      { l: 'Vom Platz entfernen', i: 'x', v: 'remove' },
      { l: 'Profil öffnen', i: 'user', v: 'profile' },
      { l: 'Mitarbeit +', i: 'thumbs-up', v: 'plus' },
      { l: 'Mitarbeit –', i: 'thumbs-down', v: 'minus' },
    ]);
    if (choice === 'move') { App.seatSel = { cid, key }; App.refresh(); }
    if (choice === 'remove') { delete p.seats[key]; save(); App.refresh(); }
    if (choice === 'profile') App.navigate('/student/' + s.id);
    if (choice === 'plus' || choice === 'minus') { upsert('observations', { studentId: s.id, classId: cid, date: today(), kind: choice, text: '' }); save(); UI.toast(`${OBS_KINDS[choice].l}: ${sShort(s)}`); }
    return;
  }
  // Leerer Platz: Person wählen
  const placed = new Set(Object.values(p.seats));
  const pool = studentsOf(cid).filter((s) => !placed.has(s.id));
  if (!pool.length) { UI.toast('Alle haben bereits einen Platz'); return; }
  const sid = await UI.menu('Wer sitzt hier?', pool.map((s) => ({ l: sName(s), v: s.id, i: 'user' })));
  if (sid) { p.seats[key] = sid; save(); App.refresh(); }
};
A['seat-print'] = (el) => {
  const c = cls(el.dataset.id);
  const p = seatPlan(c.id);
  let g = `<div class="p-seat" style="grid-template-columns:repeat(${p.cols},1fr)">`;
  for (let r = 0; r < p.rows; r++) for (let col = 0; col < p.cols; col++) {
    const key = `${r}_${col}`;
    const s = stu(p.seats[key]);
    g += p.off[key] ? '<div style="border:0"></div>' : `<div class="${s ? '' : 'empty'}">${s ? esc(sName(s)) : ''}</div>`;
  }
  g += '</div>';
  const board = '<div class="p-board">Tafel / Lehrerpult</div>';
  Print.show(`Sitzplan ${c.name}`, p.front === 'top' ? board + g : g + board);
};
