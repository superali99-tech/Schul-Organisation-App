/* Elterngespräche & Kontakte */
'use strict';

function talkItem(t) {
  const s = stu(t.studentId);
  const due = t.followUp && !t.followUpDone;
  return `<div class="li" data-act="talk-edit" data-id="${t.id}">
    <div class="li-ic">${icon(t.kind === 'telefon' ? 'phone' : t.kind === 'email' ? 'mail' : 'handshake')}</div>
    <div class="li-main"><div class="li-t">${esc(t.topic || TALK_KINDS[t.kind] || 'Gespräch')}</div>
    <div class="li-s">${fmtD(t.date)} · ${esc(s ? sName(s) : '–')}${t.with ? ' · mit ' + esc(t.with) : ''}</div></div>
    <div class="li-end">${due ? `<span class="badge ${t.followUp <= today() ? 'red' : 'acc'}">${icon('alarm-clock')}${fmtDS(t.followUp)}</span>` : ''}</div>
  </div>`;
}

App.def('/talks', () => {
  const fc = App.talkClass || '';
  const list = sortBy(S.talks.filter((t) => { const s = stu(t.studentId); return !fc || (s && s.classId === fc); }), 'date').reverse();
  const open = S.talks.filter((t) => t.followUp && !t.followUpDone);
  let h = '';
  if (activeClasses().length > 1) h += UI.chips(activeClasses().map((c) => ({ v: c.id, l: c.name, c: classColor(c) })), fc, 'talk-class', { all: 'Alle Klassen' });
  if (open.length) h += `<div class="section-title">${icon('alarm-clock')}Offene Wiedervorlagen</div><div class="card pad0"><div class="list">${sortBy(open, 'followUp').map(talkItem).join('')}</div></div>`;
  if (!list.length) h += UI.empty('handshake', 'Dokumentiere Elterngespräche, Telefonate und Vereinbarungen – rechtssicher mit Datum.');
  else h += `<div class="section-title">Alle Gespräche</div><div class="card pad0"><div class="list">${list.map(talkItem).join('')}</div></div>`;
  return { title: 'Elterngespräche', tab: 'more', html: h, fab: { act: 'talk-add' } };
});
A['talk-class'] = (el) => { App.talkClass = el.dataset.v; App.refresh(); };
A['talk-add'] = async (el) => {
  let sid = el && el.dataset && el.dataset.sid;
  if (!sid) {
    const cid = await UI.pickClass('Klasse wählen');
    if (!cid) return;
    sid = await UI.menu('Schüler:in wählen', studentsOf(cid).map((s) => ({ l: sName(s), v: s.id, i: 'user' })));
    if (!sid) return;
  }
  editTalk(null, sid);
};
A['talk-edit'] = (el) => { const t = byId('talks', el.dataset.id); editTalk(t, t.studentId); };

function editTalk(t, sid) {
  const isNew = !t;
  const s = stu(sid);
  UI.form({
    title: isNew ? `Gespräch: ${sShort(s)}` : 'Gesprächsnotiz',
    fields: [
      { k: 'date', label: 'Datum', type: 'date', half: true },
      { k: 'kind', label: 'Art', type: 'select', half: true, opts: Object.entries(TALK_KINDS).map(([v, l]) => ({ v, l })) },
      { k: 'with', label: 'Teilnehmende', ph: s && s.parentName ? s.parentName : 'z. B. Mutter, Schulsozialarbeit' },
      { k: 'topic', label: 'Anlass / Thema', ph: 'z. B. Leistungsabfall, Verhalten, Förderung' },
      { k: 'notes', label: 'Gesprächsinhalt', type: 'textarea', rows: 5 },
      { k: 'agreements', label: 'Vereinbarungen', type: 'textarea', rows: 3 },
      { k: 'followUp', label: 'Wiedervorlage am', type: 'date', half: true },
      { k: 'followUpDone', label: 'Wiedervorlage erledigt', type: 'switch' },
    ],
    values: t ? { ...t } : { date: today(), kind: 'gespraech', with: s ? s.parentName : '' },
    onSave: (v) => { upsert('talks', { ...(t || {}), ...v, studentId: sid }); save(); App.refresh(); UI.toast('Gespeichert'); },
    onDelete: isNew ? null : () => deleteWithUndo('talks', t.id, 'Gesprächsnotiz', { confirm: false }),
    extraFoot: !isNew ? `<button class="btn btn-ghost" data-act="talk-print" data-id="${t.id}">${icon('printer')}</button>` : '',
  });
}
A['talk-print'] = (el) => {
  const t = byId('talks', el.dataset.id);
  const s = stu(t.studentId);
  const h = `<table><tr><th style="width:150px">Schüler:in</th><td>${esc(sName(s))} (${esc(cName(s && s.classId))})</td></tr>
    <tr><th>Datum</th><td>${fmtD(t.date)}</td></tr><tr><th>Art</th><td>${esc(TALK_KINDS[t.kind] || '')}</td></tr>
    <tr><th>Teilnehmende</th><td>${esc(t.with || '')}</td></tr><tr><th>Anlass</th><td>${esc(t.topic || '')}</td></tr>
    <tr><th>Inhalt</th><td>${nl2br(t.notes || '')}</td></tr><tr><th>Vereinbarungen</th><td>${nl2br(t.agreements || '')}</td></tr>
    ${t.followUp ? `<tr><th>Wiedervorlage</th><td>${fmtD(t.followUp)}</td></tr>` : ''}</table>
    <br><br><table><tr><td style="height:50px;width:50%">Unterschrift Lehrkraft</td><td>Unterschrift Erziehungsberechtigte</td></tr></table>`;
  Print.show('Gesprächsprotokoll', h);
};
