/* Aufträge der Schulleitung: Aufgaben mit Frist an einzelne Lehrkräfte oder das ganze Kollegium,
   mit Rückmeldung „erledigt“ und Übersicht, wer schon fertig ist. Läuft über den Team-Abgleich. */
'use strict';

function jobsAll() { return Team.on() ? teamArr('jobs') : []; }
function jobFor(j, member) { return j.to === 'all' || (Array.isArray(j.to) && j.to.includes(member)); }
function jobRecipients(j) { return teamMembersAlive().filter((m) => jobFor(j, m.id) && m.id !== j.by); }
function jobDoneBy(j, member) { return teamArr('jobDone').find((x) => x.job === j.id && x.by === member && x.done); }
function jobStats(j) {
  const rec = jobRecipients(j);
  const done = rec.filter((m) => jobDoneBy(j, m.id));
  return { rec, done, open: rec.filter((m) => !jobDoneBy(j, m.id)) };
}
function openJobsForMe() {
  if (!Team.on()) return [];
  const me = S.team.me;
  return sortBy(jobsAll().filter((j) => j.by !== me && jobFor(j, me) && !jobDoneBy(j, me)), (j) => j.due || '9999');
}
function jobDueLabel(j) { return j.due ? `bis ${['heute', 'morgen'].includes(relDay(j.due).toLowerCase()) ? relDay(j.due).toLowerCase() : fmtDW(j.due)}${j.time ? ', ' + j.time + ' Uhr' : ''}` : 'ohne Frist'; }

function jobItem(j) {
  const me = S.team.me;
  const mine = j.by === me;
  const overdue = j.due && j.due < today();
  let end;
  if (mine || Leader.isTeamLeader()) {
    const s = jobStats(j);
    end = `<span class="badge ${s.open.length ? (overdue ? 'red' : 'acc') : 'green'}">${s.done.length}/${s.rec.length}</span>`;
  } else {
    end = jobDoneBy(j, me) ? `<span class="badge green">${icon('check')}erledigt</span>` : `<span class="badge ${overdue ? 'red' : 'orange'}">${esc(j.due ? relDay(j.due) : 'offen')}</span>`;
  }
  return `<div class="li" data-act="job-open" data-id="${j.id}"><div class="li-ic ${j.official ? 'lead-ic' : ''}">${icon(j.official ? 'crown' : 'clipboard-check')}</div>
    <div class="li-main"><div class="li-t">${esc(j.title)}</div><div class="li-s">${esc(jobDueLabel(j))} · ${mine ? (j.to === 'all' ? 'an alle' : plural(jobRecipients(j).length, 'Person', 'Personen')) : 'von ' + esc(teamMemberName(j.by, true))}</div></div>
    <div class="li-end">${end}</div></div>`;
}

function teamJobs() {
  const me = S.team.me;
  let h = `<p class="muted small" style="margin:0 4px 10px">Aufträge mit Frist – zum Beispiel „Zeugnisnoten eintragen bis Freitag“. Alle sehen ihre Aufträge auf der Startseite und melden mit einem Tipp „erledigt“.</p>`;
  const forMe = openJobsForMe();
  const mine = sortBy(jobsAll().filter((j) => j.by === me), (j) => (jobStats(j).open.length ? 0 : 1), (j) => j.due || '9999');
  const doneForMe = jobsAll().filter((j) => j.by !== me && jobFor(j, me) && jobDoneBy(j, me));
  if (!forMe.length && !mine.length && !doneForMe.length) {
    return h + UI.empty('clipboard-check', 'Noch keine Aufträge.', canPlanSchool() ? `<button class="btn btn-primary" data-act="job-add">${icon('plus')}Auftrag erteilen</button>` : '');
  }
  if (forMe.length) h += `<div class="section-title">Für dich offen</div><div class="card pad0"><div class="list">${forMe.map(jobItem).join('')}</div></div>`;
  if (mine.length) h += `<div class="section-title">Von dir erteilt</div><div class="card pad0"><div class="list">${mine.slice(0, 30).map(jobItem).join('')}</div></div>`;
  if (doneForMe.length) h += `<div class="section-title">Erledigt</div><div class="card pad0"><div class="list">${doneForMe.slice(0, 20).map(jobItem).join('')}</div></div>`;
  return h;
}

function editJob(preset = {}) {
  if (!canPlanSchool()) { UI.toast('Aufträge erteilt die Schulleitung', { type: 'err' }); return; }
  const others = teamMembersAlive().filter((m) => m.id !== S.team.me);
  UI.form({
    title: 'Auftrag erteilen',
    fields: [
      { k: 'title', label: 'Auftrag', req: true, ph: 'z. B. Zeugnisnoten eintragen' },
      { k: 'notes', label: 'Details (optional)', type: 'textarea', rows: 3, ph: 'Was genau, wo, wie …' },
      { k: 'due', label: 'Frist', type: 'date', half: true },
      { k: 'time', label: 'Uhrzeit (optional)', type: 'time', half: true },
      { k: 'audience', label: 'An wen?', type: 'seg', opts: [{ v: 'all', l: 'Ganzes Kollegium' }, { v: 'some', l: 'Bestimmte Personen' }] },
      { k: 'to', label: 'Personen', type: 'multi', opts: others.map((m) => ({ v: m.id, l: teamMemberName(m.id) })) },
    ],
    values: { audience: 'all', due: addDays(today(), 7), to: [], ...preset },
    submit: 'Erteilen',
    onMount: (el) => {
      const box = el.querySelector('[name="to"]') ? el.querySelector('[name="to"]').closest('.field') : null;
      const upd = () => { if (box) box.hidden = (el.querySelector('input[name="audience"]:checked') || {}).value !== 'some'; };
      el.querySelectorAll('input[name="audience"]').forEach((r) => r.addEventListener('change', upd));
      upd();
    },
    onSave: async (v) => {
      const to = v.audience === 'some' ? (v.to || []) : 'all';
      if (to !== 'all' && !to.length) { UI.toast('Bitte mindestens eine Person wählen', { type: 'err' }); return false; }
      const j = Team.touch({ id: uid(), title: v.title.trim(), notes: (v.notes || '').trim(), due: v.due || '', time: v.time || '', to, created: new Date().toISOString() });
      await signSchoolItem(j);
      teamArr('jobs').push(j);
      Team.changed(); App.navigate('/team/jobs', { root: true });
      UI.toast('Auftrag erteilt – wird beim nächsten Abgleich verteilt');
    },
  });
}
A['job-add'] = () => { if (Team.on()) editJob(); else App.navigate('/team'); };

function setJobDone(j, done, note = '') {
  const id = `${j.id}:${S.team.me}`;
  const arr = teamArr('jobDone');
  let x = arr.find((y) => y.id === id);
  if (!x) { x = { id, job: j.id }; arr.push(x); }
  Object.assign(x, { done, note, at: new Date().toISOString() });
  Team.touch(x);
  Team.changed(); save(); App.refresh();
}

A['job-open'] = (el) => {
  const j = jobsAll().find((x) => x.id === el.dataset.id);
  if (!j) return;
  const me = S.team.me;
  const mine = j.by === me;
  const manage = mine || Leader.isTeamLeader();
  const myDone = jobDoneBy(j, me);
  const forMe = !mine && jobFor(j, me);
  const s = jobStats(j);
  const doneList = s.done.map((m) => { const d = jobDoneBy(j, m.id); return `<div class="li"><div class="li-ic" style="background:rgba(22,163,74,.13);color:#16a34a">${icon('check')}</div><div class="li-main"><div class="li-t">${esc(teamMemberName(m.id))}</div><div class="li-s">${d.at ? fmtDS(d.at.slice(0, 10)) : ''}${d.note ? ' · ' + esc(d.note) : ''}</div></div></div>`; }).join('');
  const openList = s.open.map((m) => `<div class="li"><div class="li-ic">${icon('clock')}</div><div class="li-main"><div class="li-t">${esc(teamMemberName(m.id))}</div><div class="li-s">noch offen</div></div></div>`).join('');
  UI.open({
    title: j.official ? 'Auftrag der Schulleitung' : 'Auftrag',
    body: `<h3 style="margin:0 0 4px">${esc(j.title)}</h3>
      <p class="muted small" style="margin:0 0 10px">${esc(teamMemberName(j.by))} · ${esc(jobDueLabel(j))}</p>
      ${j.notes ? `<div class="banner">${icon('message-square-text')}<div>${nl2br(j.notes)}</div></div>` : ''}
      ${forMe && myDone ? `<div class="banner ok">${icon('circle-check')}<div><b>Du hast den Auftrag erledigt</b>${myDone.note ? '<br><span class="text2">' + esc(myDone.note) + '</span>' : ''}</div></div>` : ''}
      ${manage ? `<div class="f-section mt2">${icon('chart-column')}Stand: ${s.done.length} von ${s.rec.length} erledigt</div>
        <div class="progress mt" style="height:10px"><i style="width:${s.rec.length ? Math.round((s.done.length / s.rec.length) * 100) : 0}%"></i></div>
        ${openList || doneList ? `<div class="card pad0 mt"><div class="list">${openList}${doneList}</div></div>` : '<p class="muted small">Noch niemand im Kollegium außer dir.</p>'}` : ''}`,
    foot: `${manage ? `<button class="btn btn-ghost danger" data-x="del">${icon('trash-2')}</button>` : ''}<span class="sp"></span>
      ${manage && s.open.length ? `<button class="btn btn-soft" data-x="remind">${icon('bell-ring')}Erinnern</button>` : ''}
      ${forMe ? (myDone ? `<button class="btn btn-soft" data-x="undo">${icon('rotate-ccw')}Doch nicht erledigt</button>` : `<button class="btn btn-primary" data-x="done">${icon('check')}Erledigt melden</button>`) : ''}`,
    onMount: (box, m) => {
      const on = (k, fn) => { const b = box.querySelector(`[data-x="${k}"]`); if (b) b.addEventListener('click', fn); };
      on('done', async () => {
        m.close();
        const note = await UI.prompt('Erledigt melden', { label: 'Kurze Rückmeldung (optional)', value: '', ph: 'z. B. Noten sind eingetragen' });
        if (note === null) return;
        setJobDone(j, true, (note || '').trim());
        UI.toast('Erledigt gemeldet ✓ – die Schulleitung sieht es nach dem Abgleich');
      });
      on('undo', () => { m.close(); setJobDone(j, false); UI.toast('Wieder offen'); });
      on('remind', async () => {
        m.close();
        j.remindAt = new Date().toISOString(); Team.touch(j); await signSchoolItem(j); Team.changed(); App.refresh();
        UI.toast(`Erinnerung an ${plural(s.open.length, 'Person', 'Personen')} – kommt mit dem nächsten Abgleich`);
      });
      on('del', async () => {
        if (!(await UI.confirm(`Auftrag „${esc(j.title)}" für alle löschen?`, { danger: true, ok: 'Löschen' }))) return;
        m.close();
        await removeSchoolItem('jobs', j);
        App.refresh(); UI.toast('Gelöscht');
      });
    },
  });
};

// Neue Aufträge und Erinnerungen nach dem Abgleich melden
function jobsNotify(before) {
  const me = S.team.me;
  const fresh = jobsAll().filter((j) => j.by !== me && jobFor(j, me) && !jobDoneBy(j, me) && (!before[j.id] || (j.remindAt && j.remindAt !== before[j.id])));
  fresh.forEach((j) => {
    const again = before[j.id] && j.remindAt;
    if (typeof notifyNow === 'function') notifyNow(again ? 'Erinnerung: Auftrag der Schulleitung' : 'Neuer Auftrag', `${j.title} · ${jobDueLabel(j)}`, '/team/jobs');
  });
  return fresh.length;
}
