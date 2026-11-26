/* Schulorganisation im Kollegium: Pausenaufsicht, Räume & Buchungen, Umfragen, Statistik der Schulleitung */
'use strict';

const DUTY_SLOTS = ['Vor Unterrichtsbeginn', '1. große Pause', '2. große Pause', 'Mittagspause', 'Nach Unterrichtsende', 'Busaufsicht'];
const DUTY_PLACES = ['Schulhof', 'Pausenhalle', 'Mensa', 'Flur Erdgeschoss', 'Flur 1. OG', 'Bushaltestelle', 'Sporthalle', 'Bibliothek'];
const ROOM_KINDS = ['Fachraum', 'Computerraum', 'Aula', 'Sporthalle', 'Bibliothek', 'Besprechungsraum', 'Sonstiges'];

function teamArr(k) { const t = S.team; if (!Array.isArray(t[k])) t[k] = []; return t[k]; }
// Ohne eingetragene Schulleitung darf jede Lehrkraft planen, sonst nur die Schulleitung
function canPlanSchool() { return Team.on() && (!S.team.leader || Leader.isTeamLeader()); }
async function signSchoolItem(obj) { if (Leader.isTeamLeader()) { obj.official = true; await Leader.signItem(obj); } return obj; }
async function removeSchoolItem(key, item) {
  S.team[key] = teamArr(key).filter((x) => x.id !== item.id);
  if (Leader.isTeamLeader() && (item.official || key === 'duties' || key === 'rooms')) await Leader.signDelete(item.id); else Team.markDeleted(item.id);
  Team.changed();
}
function memberOptions(withEmpty = '– wählen –') {
  return [{ v: '', l: withEmpty }, ...sortBy(teamMembersAlive(), (m) => m.name || '').map((m) => ({ v: m.id, l: teamMemberName(m.id) + (m.id === S.team.me ? ' (ich)' : '') }))];
}

// ================================================================== Pausenaufsicht
/** Alle Aufsichten eines Tages: Wochenplan minus vertretene + einmalige Vertretungsaufsichten */
function dutiesOn(date) {
  if (!Team.on() || holidayOn(date)) return [];
  const d = dow(date);
  if (d > 4) return [];
  const all = teamArr('duties');
  const once = all.filter((x) => x.date === date);
  const replaced = new Set(once.map((x) => x.replaces).filter(Boolean));
  return sortBy([...all.filter((x) => !x.date && Number(x.day) === d && !replaced.has(x.id)), ...once], 'start');
}
function myDutiesOn(date) { return Team.on() ? dutiesOn(date).filter((x) => x.member === S.team.me) : []; }
function dutyLine(x) { return `${x.start || ''}${x.end ? '–' + x.end : ''} · ${x.slot || 'Aufsicht'}${x.place ? ' · ' + x.place : ''}`; }

function teamDuties() {
  const t = S.team;
  const all = teamArr('duties').filter((x) => !x.date);
  const mine = all.filter((x) => x.member === t.me);
  const plan = canPlanSchool();
  let h = `<p class="muted small" style="margin:0 4px 10px">${plan ? 'Plane hier die Pausenaufsichten für die ganze Woche. Jede Lehrkraft sieht ihre Aufsichten auf der Startseite und wird 5 Minuten vorher erinnert.' : 'Den Aufsichtsplan legt die Schulleitung fest. Deine Aufsichten erscheinen auf der Startseite, du wirst 5 Minuten vorher erinnert.'}</p>`;
  if (mine.length) h += `<div class="banner">${icon('eye')}<div><b>Deine Aufsichten: ${plural(mine.length, 'Termin', 'Termine')} pro Woche</b><br><span class="text2">${sortBy(mine, (x) => Number(x.day), 'start').map((x) => `${WDS[x.day]} ${x.start}`).join(' · ')}</span></div></div>`;
  if (!all.length) return h + UI.empty('eye', plan ? 'Noch kein Aufsichtsplan. Lege die erste Aufsicht an.' : 'Noch kein Aufsichtsplan vorhanden.', plan ? `<button class="btn btn-primary" data-act="duty-add">${icon('plus')}Aufsicht planen</button>` : '');
  const td = today();
  for (let d = 0; d < 5; d++) {
    const list = sortBy(all.filter((x) => Number(x.day) === d), 'start');
    const isToday = dow(td) === d;
    h += `<div class="section-title">${WD[d]}${isToday ? ' <span class="badge acc">heute</span>' : ''}</div>`;
    h += list.length ? `<div class="card pad0"><div class="list">${list.map((x) => `<div class="li ${x.member === t.me ? 'li-hl' : ''}" data-act="duty-edit" data-id="${x.id}">
      <div class="li-ic" style="flex-direction:column;line-height:1.05;font-size:.74rem">${esc(x.start || '')}<small>${esc(x.end || '')}</small></div>
      <div class="li-main"><div class="li-t">${esc(x.slot || 'Aufsicht')}${x.place ? ' · ' + esc(x.place) : ''}</div><div class="li-s">${esc(teamMemberName(x.member))}${absencesOn(td).some((a) => a.member === x.member) && isToday ? ' · <b style="color:var(--danger)">heute abwesend</b>' : ''}</div></div>
      ${x.member === t.me ? '<span class="badge acc">Du</span>' : ''}</div>`).join('')}</div></div>` : '<div class="card"><p class="muted small" style="margin:0">Keine Aufsicht eingetragen.</p></div>';
  }
  return h;
}
function editDuty(x, preset = {}) {
  const isNew = !x;
  if (!canPlanSchool()) {
    if (x) UI.open({ title: x.slot || 'Aufsicht', body: `<div class="row mb" style="gap:12px"><div class="li-ic">${icon('eye')}</div><div><b>${esc(x.date ? fmtDW(x.date) : WD[x.day])} · ${esc(x.start)}–${esc(x.end)}</b><div class="muted small">${esc(x.place || '')}</div></div></div><p>Aufsicht: <b>${esc(teamMemberName(x.member))}</b></p><p class="muted small">Den Aufsichtsplan ändert die Schulleitung.</p>` });
    return;
  }
  UI.form({
    title: isNew ? (preset.replaces ? 'Aufsicht vertreten' : 'Aufsicht planen') : 'Aufsicht',
    fields: [
      preset.replaces || (x && x.date) ? { type: 'html', html: `<div class="banner">${icon('replace')}<div>Nur am <b>${fmtDW((x && x.date) || preset.date)}</b> – der Wochenplan bleibt unverändert.</div></div>` }
        : isNew ? { k: 'days', label: 'Wochentage', type: 'multi', opts: WD.slice(0, 5).map((d, i) => ({ v: String(i), l: d })) } : { k: 'day', label: 'Wochentag', type: 'select', opts: WD.slice(0, 5).map((d, i) => ({ v: i, l: d })) },
      { k: 'slot', label: 'Pause', type: 'select', opts: DUTY_SLOTS.map((s) => ({ v: s, l: s })) },
      { k: 'start', label: 'Von', type: 'time', req: true, half: true },
      { k: 'end', label: 'Bis', type: 'time', req: true, half: true },
      { k: 'place', label: 'Ort', list: 'dl-places', ph: 'z. B. Schulhof' },
      { k: 'member', label: 'Lehrkraft', type: 'select', req: true, opts: memberOptions() },
      { type: 'html', html: `<datalist id="dl-places">${DUTY_PLACES.map((p) => `<option value="${esc(p)}">`).join('')}</datalist>` },
    ],
    values: x ? { ...x, day: String(x.day) } : { days: [String(Math.min(4, dow(today())))], slot: '1. große Pause', start: '09:35', end: '09:55', place: 'Schulhof', member: '', ...preset },
    onSave: async (v) => {
      if (!v.member) { UI.toast('Bitte eine Lehrkraft wählen', { type: 'err' }); return false; }
      if (v.end && v.start && v.end <= v.start) { UI.toast('„Bis" muss nach „Von" liegen', { type: 'err' }); return false; }
      const base = { slot: v.slot, start: v.start, end: v.end, place: v.place || '', member: v.member };
      if (isNew && preset.replaces) {
        teamArr('duties').push(await signSchoolItem(Team.touch({ id: uid(), date: preset.date, replaces: preset.replaces, day: dow(preset.date), ...base })));
      } else if (isNew) {
        const days = (v.days || []).map(Number);
        if (!days.length) { UI.toast('Bitte mindestens einen Wochentag wählen', { type: 'err' }); return false; }
        for (const d of days) teamArr('duties').push(await signSchoolItem(Team.touch({ id: uid(), day: d, ...base })));
      } else {
        Object.assign(x, base, x.date ? {} : { day: Number(v.day) }, Team.touch({}));
        await signSchoolItem(x);
      }
      Team.changed(); App.refresh(); UI.toast('Aufsichtsplan gespeichert – wird beim nächsten Abgleich verteilt');
    },
    onDelete: isNew ? null : async () => {
      if (!(await UI.confirm('Diese Aufsicht löschen?', { danger: true, ok: 'Löschen' }))) return false;
      await removeSchoolItem('duties', x); App.refresh();
    },
  });
}
A['duty-add'] = () => editDuty();
A['duty-edit'] = (el) => editDuty(teamArr('duties').find((x) => x.id === el.dataset.id));
A['duty-cover'] = (el) => {
  const x = teamArr('duties').find((y) => y.id === el.dataset.id);
  if (x) editDuty(null, { replaces: x.id, date: today(), slot: x.slot, start: x.start, end: x.end, place: x.place, member: '' });
};

// ================================================================== Räume & Buchungen
function bookingsFor(roomId, date, period) {
  return sortBy(teamArr('bookings').filter((b) => b.room === roomId && b.date === date && Number(b.period) === Number(period)), (b) => b.created || '');
}
function myBookingsOn(date) { return Team.on() ? sortBy(teamArr('bookings').filter((b) => b.by === S.team.me && b.date === date), (b) => Number(b.period)) : []; }
function roomName(id) { const r = teamArr('rooms').find((x) => x.id === id); return r ? r.name : 'Raum'; }

function teamRooms() {
  const rooms = sortBy(teamArr('rooms'), (r) => r.name.toLowerCase());
  const td = today();
  const plan = canPlanSchool();
  let h = `<p class="muted small" style="margin:0 4px 10px">Computerraum, Aula oder Sporthalle für eine Stunde buchen – alle sehen sofort, wann ein Raum frei ist.</p>`;
  const mine = sortBy(teamArr('bookings').filter((b) => b.by === S.team.me && b.date >= td), 'date', (b) => Number(b.period));
  if (mine.length) h += `<div class="section-title">${icon('bookmark')}Deine Buchungen</div><div class="card pad0"><div class="list">${mine.slice(0, 8).map((b) => `<div class="li" data-nav="/room/${b.room}/${weekStart(b.date)}"><div class="li-ic" style="flex-direction:column;line-height:1.05;font-size:.72rem">${fmtDS(b.date)}<small>${Number(b.period) + 1}.</small></div><div class="li-main"><div class="li-t">${esc(roomName(b.room))}</div><div class="li-s">${esc(fmtDW(b.date))} · ${Number(b.period) + 1}. Stunde${b.note ? ' · ' + esc(b.note) : ''}</div></div>${icon('chevron-right', 'chev')}</div>`).join('')}</div></div>`;
  if (!rooms.length) return h + UI.empty('door-open', plan ? 'Noch keine Räume angelegt. Lege buchbare Räume an, z. B. Computerraum oder Aula.' : 'Die Schulleitung hat noch keine buchbaren Räume angelegt.', plan ? `<button class="btn btn-primary" data-act="room-add">${icon('plus')}Raum anlegen</button>` : '');
  h += `<div class="section-title">${icon('door-open')}Räume</div><div class="card pad0"><div class="list">${rooms.map((r) => {
    const busy = S.settings.periods.filter((p, i) => bookingsFor(r.id, td, i).length).length;
    return `<div class="li" data-nav="/room/${r.id}/${weekStart(td)}"><div class="li-ic">${icon(r.kind === 'Computerraum' ? 'presentation' : r.kind === 'Sporthalle' ? 'activity' : r.kind === 'Aula' ? 'megaphone' : 'door-open')}</div>
      <div class="li-main"><div class="li-t">${esc(r.name)}</div><div class="li-s">${esc([r.kind, r.capacity ? r.capacity + ' Plätze' : ''].filter(Boolean).join(' · '))}</div></div>
      <div class="li-end"><span class="badge ${busy ? 'orange' : 'green'}">${busy ? `heute ${busy}× belegt` : 'heute frei'}</span></div></div>`;
  }).join('')}</div></div>`;
  return h;
}
function editRoom(r) {
  const isNew = !r;
  UI.form({
    title: isNew ? 'Raum anlegen' : 'Raum bearbeiten',
    fields: [
      { k: 'name', label: 'Name', req: true, ph: 'z. B. Computerraum 1' },
      { k: 'kind', label: 'Art', type: 'select', half: true, opts: ROOM_KINDS.map((k) => ({ v: k, l: k })) },
      { k: 'capacity', label: 'Plätze', type: 'number', half: true, min: 0 },
      { k: 'note', label: 'Hinweis', ph: 'z. B. Schlüssel im Sekretariat' },
    ],
    values: r || { kind: 'Computerraum' },
    onSave: async (v) => {
      const obj = isNew ? Team.touch({ id: uid(), ...v }) : Object.assign(r, v, Team.touch({}));
      await signSchoolItem(obj);
      if (isNew) teamArr('rooms').push(obj);
      Team.changed(); App.refresh(); UI.toast('Gespeichert');
    },
    onDelete: isNew ? null : async () => {
      if (!(await UI.confirm(`„${esc(r.name)}" und alle Buchungen löschen?`, { danger: true, ok: 'Löschen' }))) return false;
      await removeSchoolItem('rooms', r);
      S.team.bookings = teamArr('bookings').filter((b) => { if (b.room === r.id) { Team.markDeleted(b.id); return false; } return true; });
      Team.changed(); App.navigate('/team/rooms', { root: true });
    },
  });
}
A['room-add'] = () => { if (canPlanSchool()) editRoom(); };
A['room-edit'] = (el) => { const r = teamArr('rooms').find((x) => x.id === el.dataset.id); if (r && canPlanSchool()) editRoom(r); };

App.def('/room/:id/:week?', (p) => {
  if (!Team.on()) return { title: 'Raum', html: UI.empty('door-open', 'Kein Schulteam.') };
  const r = teamArr('rooms').find((x) => x.id === p.id);
  if (!r) return { title: 'Raum', html: UI.empty('door-open', 'Dieser Raum existiert nicht mehr.') };
  const ws = p.week || weekStart(today());
  const days = Array.from({ length: 5 }, (_, i) => addDays(ws, i));
  const td = today();
  const periods = S.settings.periods;
  let h = `<div class="tt-nav"><button class="btn btn-icon btn-ghost" data-nav="/room/${r.id}/${addDays(ws, -7)}" data-replace aria-label="Vorige Woche">${icon('chevron-left')}</button>
    <div class="tt-week">KW ${isoWeek(ws)}<small>${fmtDS(ws)} – ${fmtD(addDays(ws, 4))}</small></div>
    <button class="btn btn-icon btn-ghost" data-nav="/room/${r.id}/${addDays(ws, 7)}" data-replace aria-label="Nächste Woche">${icon('chevron-right')}</button></div>`;
  if (r.note) h += `<div class="banner">${icon('info')}<div>${esc(r.note)}</div></div>`;
  h += `<div class="rb-grid" style="--cols:${days.length}"><div></div>${days.map((d) => `<div class="rb-h ${d === td ? 'today' : ''}">${WDS[dow(d)]}<b>${fmtDS(d)}</b></div>`).join('')}`;
  periods.forEach((per, i) => {
    h += `<div class="rb-p"><b>${i + 1}</b><small>${per.s}</small></div>`;
    days.forEach((d) => {
      const bs = bookingsFor(r.id, d, i);
      const past = d < td;
      const hol = holidayOn(d);
      if (bs.length) {
        const b = bs[0];
        const mine = b.by === S.team.me;
        h += `<button class="rb-c busy ${mine ? 'mine' : ''} ${bs.length > 1 ? 'conflict' : ''}" data-act="booking-open" data-id="${b.id}">${esc(teamMemberName(b.by, true))}${b.note ? `<small>${esc(b.note)}</small>` : ''}${bs.length > 1 ? '<small>doppelt!</small>' : ''}</button>`;
      } else if (hol) h += '<div class="rb-c off"></div>';
      else h += `<button class="rb-c free" ${past ? 'disabled' : `data-act="booking-add" data-room="${r.id}" data-d="${d}" data-p="${i}"`}>${past ? '' : icon('plus')}</button>`;
    });
  });
  h += '</div><p class="muted small center mt">Tippe auf ein freies Feld, um den Raum zu buchen. Eigene Buchungen kannst du wieder freigeben.</p>';
  return { title: r.name, sub: [r.kind, r.capacity ? r.capacity + ' Plätze' : ''].filter(Boolean).join(' · '), tab: 'more', html: h, actions: canPlanSchool() ? [{ icon: 'pencil', act: 'room-edit', id: r.id, label: 'Raum bearbeiten' }] : [] };
});
A['booking-add'] = (el) => {
  const { room, d, p } = el.dataset;
  UI.form({
    title: `${roomName(room)} buchen`,
    fields: [
      { type: 'html', html: `<div class="banner">${icon('calendar-clock')}<div><b>${fmtDW(d)} · ${Number(p) + 1}. Stunde</b><br><span class="text2">${esc(S.settings.periods[Number(p)].s)}–${esc(S.settings.periods[Number(p)].e)} Uhr</span></div></div>` },
      { k: 'note', label: 'Wofür? (optional)', ph: 'z. B. 8c Recherche' },
    ],
    submit: 'Buchen',
    onSave: (v) => {
      if (bookingsFor(room, d, p).length) { UI.toast('Gerade schon gebucht – bitte eine andere Stunde wählen', { type: 'err' }); App.refresh(); return; }
      teamArr('bookings').push(Team.touch({ id: uid(), room, date: d, period: Number(p), note: v.note || '', created: new Date().toISOString() }));
      Team.changed(); App.refresh(); UI.toast('Gebucht ✓ – alle sehen es nach dem nächsten Abgleich');
    },
  });
};
A['booking-open'] = async (el) => {
  const b = teamArr('bookings').find((x) => x.id === el.dataset.id);
  if (!b) return;
  const mine = b.by === S.team.me;
  const can = mine || canPlanSchool();
  const others = bookingsFor(b.room, b.date, b.period).filter((x) => x.id !== b.id);
  const info = `<b>${esc(roomName(b.room))}</b> · ${fmtDW(b.date)} · ${Number(b.period) + 1}. Stunde<br>Gebucht von <b>${esc(teamMemberName(b.by))}</b>${b.note ? ` – ${esc(b.note)}` : ''}${others.length ? `<br><br><b style="color:var(--danger)">Doppelt gebucht</b> (auch von ${others.map((o) => esc(teamMemberName(o.by, true))).join(', ')}). Die frühere Buchung gilt.` : ''}`;
  if (!can) { UI.open({ title: 'Buchung', body: `<p class="dlg-text">${info}</p>` }); return; }
  const ok = await UI.confirm(`${info}<br><br>Buchung freigeben?`, { danger: true, ok: 'Freigeben', cancel: 'Behalten' });
  if (ok) { S.team.bookings = teamArr('bookings').filter((x) => x.id !== b.id); Team.markDeleted(b.id); Team.changed(); App.refresh(); UI.toast('Freigegeben'); }
};

// ================================================================== Umfragen
function pollVotes(p) { return teamArr('votes').filter((v) => v.poll === p.id && (v.choices || []).length); }
function myVote(p) { return teamArr('votes').find((v) => v.poll === p.id && v.by === S.team.me); }
function pollOpen(p) { return !p.closed && (!p.deadline || p.deadline >= today()); }
function openPollsForMe() {
  if (!Team.on()) return [];
  return teamArr('polls').filter((p) => pollOpen(p) && p.by !== S.team.me && !(myVote(p) && myVote(p).choices.length));
}
function pollResults(p) {
  const votes = pollVotes(p);
  const counts = Object.fromEntries((p.options || []).map((o) => [o.id, []]));
  votes.forEach((v) => v.choices.forEach((c) => { if (counts[c]) counts[c].push(v.by); }));
  return { votes, counts, total: votes.length, members: teamMembersAlive().length };
}
function pollItem(p) {
  const r = pollResults(p);
  const mv = myVote(p);
  const open = pollOpen(p);
  return `<div class="li" data-act="poll-open" data-id="${p.id}"><div class="li-ic ${p.official ? 'lead-ic' : ''}">${icon(p.official ? 'crown' : 'chart-column')}</div>
    <div class="li-main"><div class="li-t">${esc(p.question)}</div><div class="li-s">${r.total} von ${r.members} abgestimmt · ${esc(teamMemberName(p.by, true))}${p.deadline ? ' · bis ' + fmtDS(p.deadline) : ''}${p.anonymous ? ' · anonym' : ''}</div></div>
    <div class="li-end">${!open ? '<span class="badge">beendet</span>' : mv && mv.choices.length ? `<span class="badge green">${icon('check')}abgestimmt</span>` : p.by === S.team.me ? '<span class="badge acc">von dir</span>' : '<span class="badge red">abstimmen</span>'}</div></div>`;
}
function teamPolls() {
  const polls = sortBy(teamArr('polls'), (p) => (pollOpen(p) ? 0 : 1), (p) => -(new Date(p.created || 0).getTime()));
  let h = `<p class="muted small" style="margin:0 4px 10px">Kurz abstimmen statt lange Mails: Termine finden, Teilnahme abfragen, Meinungen einholen.</p>`;
  if (!polls.length) return h + UI.empty('chart-column', 'Noch keine Umfragen.', `<button class="btn btn-primary" data-act="poll-add">${icon('plus')}Umfrage starten</button>`);
  const open = polls.filter(pollOpen);
  const done = polls.filter((p) => !pollOpen(p));
  if (open.length) h += `<div class="section-title">Laufend</div><div class="card pad0"><div class="list">${open.map(pollItem).join('')}</div></div>`;
  if (done.length) h += `<div class="section-title">Beendet</div><div class="card pad0"><div class="list">${done.slice(0, 20).map(pollItem).join('')}</div></div>`;
  return h;
}
function editPoll(preset = {}) {
  const leader = Leader.isTeamLeader();
  UI.form({
    title: 'Umfrage starten',
    fields: [
      { k: 'question', label: 'Frage', req: true, ph: 'z. B. Wer hilft beim Sommerfest mit?' },
      { k: 'options', label: 'Antworten (eine pro Zeile)', type: 'textarea', rows: 4, req: true, ph: 'Ja\nNein\nVielleicht' },
      { k: 'deadline', label: 'Abstimmen bis (optional)', type: 'date', half: true },
      { k: 'multi', label: 'Mehrere Antworten', type: 'switch', half: true },
      { k: 'anonymous', label: 'Namen nicht anzeigen', type: 'switch', hint: 'Ergebnisse erscheinen nur als Zahlen' },
      leader ? { k: 'official', label: 'Umfrage der Schulleitung', type: 'switch', hint: 'Hervorgehoben und digital unterschrieben' } : null,
    ],
    values: { options: 'Ja\nNein', official: leader, ...preset },
    submit: 'Starten',
    onSave: async (v) => {
      const opts = String(v.options || '').split('\n').map((x) => x.trim()).filter(Boolean).slice(0, 12);
      if (opts.length < 2) { UI.toast('Bitte mindestens zwei Antworten eingeben', { type: 'err' }); return false; }
      const p = Team.touch({ id: uid(), question: v.question.trim(), options: opts.map((t) => ({ id: uid(), t })), multi: !!v.multi, anonymous: !!v.anonymous, deadline: v.deadline || '', created: new Date().toISOString() });
      if (leader && v.official) await signSchoolItem(p);
      teamArr('polls').push(p);
      Team.changed(); App.navigate('/team/polls', { root: true });
      UI.toast('Umfrage gestartet – wird beim nächsten Abgleich verteilt');
    },
  });
}
A['poll-add'] = () => { if (Team.on()) editPoll(); };
A['poll-open'] = (el) => {
  const t = S.team;
  const p = teamArr('polls').find((x) => x.id === el.dataset.id);
  if (!p) return;
  const open = pollOpen(p);
  const mv = myVote(p);
  const r = pollResults(p);
  const canManage = p.by === t.me || Leader.isTeamLeader();
  const max = Math.max(1, ...Object.values(r.counts).map((x) => x.length));
  const voted = new Set(r.votes.map((v) => v.by));
  const missing = teamMembersAlive().filter((m) => !voted.has(m.id));
  UI.open({
    title: p.official ? 'Umfrage der Schulleitung' : 'Umfrage',
    body: `<h3 style="margin:0 0 4px">${esc(p.question)}</h3>
      <p class="muted small" style="margin:0 0 12px">${esc(teamMemberName(p.by))} · ${r.total} von ${r.members} abgestimmt${p.deadline ? ' · bis ' + fmtDW(p.deadline) : ''}${p.multi ? ' · mehrere Antworten möglich' : ''}</p>
      <div class="poll-opts">${(p.options || []).map((o) => {
        const n = r.counts[o.id].length;
        const sel = mv && mv.choices.includes(o.id);
        return `<label class="poll-o ${sel ? 'sel' : ''}">${open ? `<input type="${p.multi ? 'checkbox' : 'radio'}" name="poll" value="${o.id}" ${sel ? 'checked' : ''}>` : ''}
          <span class="poll-bar" style="width:${Math.round((n / max) * 100)}%"></span><span class="poll-t">${esc(o.t)}</span><b>${n}</b>
          ${!p.anonymous && n ? `<small>${r.counts[o.id].map((id) => esc(teamMemberName(id, true))).join(', ')}</small>` : ''}</label>`;
      }).join('')}</div>
      ${canManage && missing.length && open ? `<p class="muted small">Noch nicht abgestimmt: ${missing.map((m) => esc(teamMemberName(m.id, true))).join(', ')}</p>` : ''}`,
    foot: `${canManage ? `<button class="btn btn-ghost" data-x="manage">${icon('ellipsis')}</button>` : ''}<span class="sp"></span>${open ? `<button class="btn btn-primary" data-x="vote">${icon('check')}${mv && mv.choices.length ? 'Stimme ändern' : 'Abstimmen'}</button>` : '<button class="btn" data-x="close">Schließen</button>'}`,
    onMount: (box, m) => {
      const v = box.querySelector('[data-x="vote"]');
      if (v) v.addEventListener('click', () => {
        const choices = [...box.querySelectorAll('input[name="poll"]:checked')].map((x) => x.value);
        if (!choices.length) { UI.toast('Bitte eine Antwort wählen', { type: 'err' }); return; }
        const id = `${p.id}:${t.me}`;
        const cur = teamArr('votes').find((x) => x.id === id);
        if (cur) Object.assign(cur, { choices }, Team.touch({})); else teamArr('votes').push(Team.touch({ id, poll: p.id, choices }));
        Team.changed(); m.close(); App.refresh(); UI.toast('Abgestimmt ✓');
      });
      const c = box.querySelector('[data-x="close"]'); if (c) c.addEventListener('click', () => m.close());
      const g = box.querySelector('[data-x="manage"]');
      if (g) g.addEventListener('click', async () => {
        const res = await UI.menu(p.question, [
          open ? { l: 'Umfrage beenden', i: 'circle-check', v: 'end' } : { l: 'Wieder öffnen', i: 'rotate-ccw', v: 'reopen' },
          { l: 'Ergebnis teilen', i: 'share-2', v: 'share' },
          { l: 'Löschen', i: 'trash-2', danger: true, v: 'del' },
        ]);
        if (res === 'end' || res === 'reopen') { p.closed = res === 'end'; Team.touch(p); if (p.official) await Leader.signItem(p); Team.changed(); m.close(); App.refresh(); }
        if (res === 'share') Files.share('Umfrage', `Umfrage: ${p.question}\n${(p.options || []).map((o) => `• ${o.t}: ${r.counts[o.id].length}`).join('\n')}\n(${r.total} von ${r.members} abgestimmt)`);
        if (res === 'del' && (await UI.confirm('Umfrage für alle löschen?', { danger: true, ok: 'Löschen' }))) { await removeSchoolItem('polls', p); m.close(); App.refresh(); }
      });
    },
  });
};

// ================================================================== Statistik der Schulleitung
function weekdaysBetween(a, b) {
  let n = 0;
  for (let d = a; d <= b; d = addDays(d, 1)) if (dow(d) < 5 && !holidayOn(d)) n++;
  return n;
}
function schoolStats() {
  const t = S.team;
  const from = S.settings.yearStart || '0000-01-01';
  const to = S.settings.yearEnd || '9999-12-31';
  const subs = t.subs.filter((x) => x.date >= from && x.date <= to);
  const abs = (t.absences || []).filter((a) => a.from <= to && (a.to || a.from) >= from);
  const ackPosts = t.posts.filter((p) => p.official && p.requireAck);
  const rows = teamMembersAlive().map((m) => {
    const myAbs = abs.filter((a) => a.member === m.id);
    const days = myAbs.reduce((n, a) => n + weekdaysBetween(a.from < from ? from : a.from, (a.to || a.from) > to ? to : (a.to || a.from)), 0);
    const sick = myAbs.filter((a) => a.kind === 'krank').reduce((n, a) => n + weekdaysBetween(a.from < from ? from : a.from, (a.to || a.from) > to ? to : (a.to || a.from)), 0);
    const acks = ackPosts.filter((p) => p.by !== m.id);
    return {
      m, given: subs.filter((x) => x.sub === m.id).length, needed: subs.filter((x) => x.absent === m.id).length, days, sick,
      duties: teamArr('duties').filter((x) => !x.date && x.member === m.id).length,
      ack: acks.length ? Math.round((acks.filter((p) => postAcks(p).some((a) => a.by === m.id)).length * 100) / acks.length) : null,
    };
  });
  return { rows, subs, open: subs.filter((x) => !x.sub && x.date >= today()).length, from, to };
}
App.def('/leader/stats', () => {
  if (!Team.on()) return { title: 'Statistik', tab: 'more', html: UI.empty('chart-column', 'Noch kein Schulteam.') };
  const st = schoolStats();
  const maxGiven = Math.max(1, ...st.rows.map((r) => r.given));
  const sum = (k) => st.rows.reduce((n, r) => n + r[k], 0);
  let h = `<div class="stats stats-4">
    <div class="stat"><div class="stat-v">${st.subs.length}</div><div class="stat-l">Vertretungen im Schuljahr</div></div>
    <div class="stat"><div class="stat-v">${st.open}</div><div class="stat-l">noch offen</div></div>
    <div class="stat"><div class="stat-v">${sum('days')}</div><div class="stat-l">Abwesenheitstage</div></div>
    <div class="stat"><div class="stat-v">${sum('duties')}</div><div class="stat-l">Aufsichten pro Woche</div></div>
  </div>`;
  h += `<div class="section-title">${icon('replace')}Vertretungen übernommen</div><div class="card">${sortBy(st.rows, (r) => -r.given).map((r) => `<div class="bar-row"><span>${esc(teamMemberName(r.m.id, true))}</span><div class="bar"><i style="width:${Math.round((r.given / maxGiven) * 100)}%"></i></div><b>${r.given}</b></div>`).join('')}</div>`;
  h += `<div class="section-title">${icon('users')}Je Lehrkraft</div><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Name</th><th>Vertr. gehalten</th><th>Vertr. nötig</th><th>Abwesend (Tage)</th><th>davon krank</th><th>Aufsichten/Woche</th><th>Mitteilungen gelesen</th></tr></thead><tbody>
    ${sortBy(st.rows, (r) => r.m.name || '').map((r) => `<tr><td>${esc(teamMemberName(r.m.id))}</td><td>${r.given}</td><td>${r.needed}</td><td>${r.days}</td><td>${r.sick}</td><td>${r.duties}</td><td>${r.ack == null ? '–' : r.ack + ' %'}</td></tr>`).join('')}</tbody></table></div>
    <p class="muted small">Zeitraum: Schuljahr ${fmtD(st.from)} – ${fmtD(st.to)}. Abwesenheitstage zählen nur Schultage (ohne Wochenende und Ferien).</p>
    <button class="btn btn-soft" data-act="stats-csv">${icon('file-spreadsheet')}Als Tabelle exportieren (CSV)</button>`;
  return { title: 'Statistik', sub: 'Schuljahr ' + (S.settings.year || ''), tab: 'more', html: h };
});
A['stats-csv'] = () => {
  const st = schoolStats();
  Files.csv(`Schulplan_Statistik_${today()}.csv`, [['Name', 'Kürzel', 'Vertretungen gehalten', 'Vertretungen nötig', 'Abwesenheitstage', 'davon krank', 'Aufsichten pro Woche', 'Mitteilungen gelesen (%)'],
    ...st.rows.map((r) => [[r.m.title, r.m.name].filter(Boolean).join(' '), r.m.short || '', r.given, r.needed, r.days, r.sick, r.duties, r.ack == null ? '' : r.ack])]);
};
