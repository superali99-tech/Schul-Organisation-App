/* Notizen */
'use strict';

App.def('/notes', () => {
  const q = (App.noteQ || '').toLowerCase();
  const fc = App.noteClass || '';
  let list = S.notes.filter((n) => (!fc || n.classId === fc) && (!q || (n.title + ' ' + n.body).toLowerCase().includes(q)));
  list = sortBy(list, (n) => (n.pinned ? 0 : 1), (n) => -(new Date(n.updated || 0).getTime()));
  let h = `<div class="search">${icon('search')}<input placeholder="Notizen durchsuchen …" value="${esc(App.noteQ || '')}" data-input="note-search"></div>`;
  const used = activeClasses().filter((c) => S.notes.some((n) => n.classId === c.id));
  if (used.length) h += UI.chips(used.map((c) => ({ v: c.id, l: c.name, c: classColor(c) })), fc, 'note-class', { all: 'Alle' });
  if (!list.length) h += UI.empty('sticky-note', q ? 'Keine Treffer.' : 'Noch keine Notizen. Halte Ideen, Absprachen und To-dos fest.');
  else h += `<div class="notes-grid">${list.map((n) => `
    <div class="note-card ${n.color ? 'colored' : ''}" style="${n.color ? `--nc:${n.color}` : ''}" data-act="note-open" data-id="${n.id}">
      ${n.pinned ? icon('pin', 'pin') : ''}
      ${n.title ? `<h4>${esc(n.title)}</h4>` : ''}
      <div class="body">${renderNoteBody(n.body || '')}</div>
      <div class="meta">${n.classId ? esc(cName(n.classId)) + ' · ' : ''}${n.updated ? fmtD(n.updated.slice(0, 10)) : ''}</div>
    </div>`).join('')}</div>`;
  return {
    title: 'Notizen', tab: 'more', html: h, fab: { act: 'note-new' },
    mount: (el) => { if (App.noteQ) { const i = el.querySelector('.search input'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); } },
  };
});
function renderNoteBody(t) {
  return esc(t.length > 400 ? t.slice(0, 400) + '…' : t)
    .replace(/^- \[x\] (.*)$/gim, '☑ <s>$1</s>')
    .replace(/^- \[ \] (.*)$/gim, '☐ $1');
}
A['note-search'] = debounce((el) => { App.noteQ = el.value; App.refresh(); }, 250);
A['note-class'] = (el) => { App.noteClass = el.dataset.v; App.refresh(); };
A['note-new'] = (el) => editNote(null, { classId: (el && el.dataset && el.dataset.class) || '' });
A['note-open'] = (el) => editNote(byId('notes', el.dataset.id));

function editNote(n, preset = {}) {
  const isNew = !n;
  const note = n || { id: uid(), title: '', body: '', color: '', pinned: false, classId: preset.classId || '', updated: new Date().toISOString() };
  let created = !isNew;
  const m = UI.open({
    title: isNew ? 'Neue Notiz' : 'Notiz',
    full: true,
    body: `<div class="col" style="height:100%">
      <input class="inline-input" id="nt-title" placeholder="Titel" value="${esc(note.title)}" style="font-size:1.15rem;font-weight:650">
      <textarea class="inline-input" id="nt-body" placeholder="Notiz schreiben …&#10;Tipp: „- [ ] Punkt" ergibt eine Checkliste." style="flex:1;min-height:45vh">${esc(note.body)}</textarea>
      <div class="row row-wrap">
        <select class="inline-input" id="nt-class" style="width:auto;flex:1">${classOptions('Keine Klasse').map((o) => `<option value="${o.v}" ${o.v === note.classId ? 'selected' : ''}>${esc(o.l)}</option>`).join('')}</select>
        <button class="btn ${note.pinned ? 'btn-soft' : ''}" id="nt-pin">${icon(note.pinned ? 'pin' : 'pin-off')}${note.pinned ? 'Angeheftet' : 'Anheften'}</button>
      </div>
      <div class="swatches" id="nt-colors">${NOTE_COLORS.map((c) => `<label class="swatch" style="--sc:${c || 'var(--card)'}"><input type="radio" name="ntc" value="${c}" ${c === (note.color || '') ? 'checked' : ''}><span>${c ? '' : icon('ban')}</span></label>`).join('')}</div>
    </div>`,
    foot: `${!isNew ? `<button class="btn btn-ghost danger" id="nt-del">${icon('trash-2')}Löschen</button>` : ''}<button class="btn btn-ghost" id="nt-share">${icon('share-2')}Teilen</button><span class="sp"></span><button class="btn btn-primary" id="nt-done">Fertig</button>`,
    onClose: () => {
      if (!note.title.trim() && !note.body.trim()) {
        if (created) { removeById('notes', note.id); save(); }
      }
      App.refresh();
    },
    onMount: (el, modal) => {
      const t = el.querySelector('#nt-title');
      const b = el.querySelector('#nt-body');
      const persist = () => {
        note.title = t.value; note.body = b.value; note.updated = new Date().toISOString();
        if (!created && (note.title.trim() || note.body.trim())) { S.notes.push(note); created = true; }
        save();
      };
      t.addEventListener('input', persist);
      b.addEventListener('input', persist);
      el.querySelector('#nt-class').addEventListener('change', (e) => { note.classId = e.target.value; persist(); });
      el.querySelector('#nt-pin').addEventListener('click', (e) => {
        note.pinned = !note.pinned; persist();
        e.currentTarget.className = 'btn ' + (note.pinned ? 'btn-soft' : '');
        e.currentTarget.innerHTML = icon(note.pinned ? 'pin' : 'pin-off') + (note.pinned ? 'Angeheftet' : 'Anheften');
      });
      el.querySelectorAll('input[name=ntc]').forEach((r) => r.addEventListener('change', () => { note.color = r.value; persist(); }));
      el.querySelector('#nt-done').addEventListener('click', () => modal.close());
      el.querySelector('#nt-share').addEventListener('click', () => Files.share(note.title || 'Notiz', (note.title ? note.title + '\n\n' : '') + note.body));
      const del = el.querySelector('#nt-del');
      if (del) del.addEventListener('click', async () => { modal.close(); setTimeout(() => deleteWithUndo('notes', note.id, note.title || 'Notiz'), 250); });
      if (isNew) setTimeout(() => (note.classId || preset.focusBody ? b : t).focus(), 280);
    },
  });
  return m;
}
