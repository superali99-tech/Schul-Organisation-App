/* Schulplan – Oberfläche: Router, Dialoge, Formulare, Hilfskomponenten */
'use strict';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const A = {}; // Aktionen (data-act)

function icon(name, cls = '') {
  const p = ICONS[name] || ICONS['circle'];
  return `<svg class="i ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
}
function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function shiftHue(hex, deg, dl = 0) {
  let [r, g, b] = hexToRgb(hex).map((x) => x / 255);
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  let h = 0, s = 0, l = (mx + mn) / 2;
  if (mx !== mn) {
    const d = mx - mn;
    s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h *= 60;
  }
  h = (h + deg + 360) % 360; l = clamp(l + dl, 0, 1);
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
  const [r1, g1, b1] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return '#' + [r1, g1, b1].map((v) => Math.round((v + m) * 255).toString(16).padStart(2, '0')).join('');
}
const rgba = (hex, a) => { const [r, g, b] = hexToRgb(hex || '#64748b'); return `rgba(${r},${g},${b},${a})`; };
function attrs(o) { return Object.entries(o).filter(([, v]) => v != null && v !== false).map(([k, v]) => (v === true ? k : `${k}="${esc(v)}"`)).join(' '); }

// ------------------------------------------------------------------ Router / App
const App = {
  routes: [],
  stack: [],
  view: null,
  editMode: {},
  def(pattern, fn) {
    const keys = [];
    const re = new RegExp('^' + pattern.replace(/\/:(\w+)(\?)?/g, (_, k, opt) => { keys.push(k); return opt ? '(?:/([^/]+))?' : '/([^/]+)'; }) + '/?$');
    this.routes.push({ re, keys, fn, pattern });
  },
  match(path) {
    for (const r of this.routes) {
      const m = path.match(r.re);
      if (m) {
        const p = {};
        r.keys.forEach((k, i) => { p[k] = m[i + 1] != null ? decodeURIComponent(m[i + 1]) : undefined; });
        return { r, p };
      }
    }
    return null;
  },
  get path() { return this.stack[this.stack.length - 1] || '/today'; },
  navigate(path, opts = {}) {
    if (!path) return;
    this._dir = opts.root ? 'tab' : 'fwd';
    if (opts.root) this.stack = [path];
    else if (opts.replace && this.stack.length) this.stack[this.stack.length - 1] = path;
    else if (this.path !== path) this.stack.push(path);
    if (this.stack.length > 40) this.stack.splice(1, this.stack.length - 40);
    this.render(true);
  },
  back() {
    if (UI.stack.length) { UI.closeTop(); return true; }
    if (this.stack.length > 1) { this.stack.pop(); this.render(true, true); return true; }
    const start = S.settings.startTab || '/today';
    if (this.path !== start) { this.navigate(start, { root: true }); return true; }
    return false;
  },
  handleBack() {
    if (Lock.active) return false;
    return this.back();
  },
  refresh() { this.render(false); },
  render(scrollTop = true, restore = false) {
    const path = this.path;
    try { history.replaceState(null, '', '#' + path); } catch (e) { /* ignore */ }
    const m = this.match(path);
    const main = $('#view');
    const prevScroll = main.scrollTop;
    let v;
    try {
      v = m ? m.r.fn(m.p) : { title: 'Nicht gefunden', html: UI.empty('circle-help', 'Diese Seite gibt es nicht.') };
    } catch (e) {
      console.error(e);
      v = { title: 'Fehler', html: `<div class="banner warn">${icon('triangle-alert')}<div>Beim Anzeigen ist ein Fehler aufgetreten.<br><small>${esc(e.message)}</small></div></div>` };
    }
    if (!v) return;
    if (this.view && this.view.unmount) { try { this.view.unmount(); } catch (e) { console.error(e); } }
    this.view = v;
    // Kopfzeile
    const showBack = this.stack.length > 1 || v.back;
    $('#topbar').innerHTML = `
      ${showBack ? `<button class="tb-btn" data-act="app-back" aria-label="Zurück">${icon('arrow-left')}</button>` : `<div class="tb-logo">${icon(v.icon || 'graduation-cap')}</div>`}
      <div class="tb-title"><h1>${esc(v.title || '')}</h1>${v.sub ? `<div class="tb-sub">${esc(v.sub)}</div>` : ''}</div>
      <div class="tb-actions">${typeof Leader !== 'undefined' && Leader.active() && !String(App.path || '').startsWith('/leader') ? `<button class="tb-btn tb-lead" data-nav="/leader" aria-label="Schulleitungs-Cockpit" title="Schulleitungs-Cockpit">${icon('crown')}</button>` : ''}${(v.actions || []).map((a) => `<button class="tb-btn" ${attrs({ 'data-act': a.act, 'data-nav': a.nav, 'data-id': a.id, 'aria-label': a.label, title: a.label })}>${icon(a.icon)}</button>`).join('')}</div>`;
    $('#topbar').classList.toggle('root', !showBack);
    main.className = 'view ' + (v.cls || '');
    main.dataset.dir = restore ? 'back' : (this._dir || 'tab');
    this._dir = '';
    if (typeof navBadges === 'function') { try { navBadges(); } catch (e) { /* egal */ } }
    main.innerHTML = v.html || '';
    // FAB
    const fab = $('#fab');
    if (v.fab) {
      fab.innerHTML = icon(v.fab.icon || 'plus') + (v.fab.label ? `<span>${esc(v.fab.label)}</span>` : '');
      fab.className = 'fab' + (v.fab.label ? ' fab-ext' : '');
      fab.dataset.act = v.fab.act || '';
      fab.dataset.id = v.fab.id || '';
      fab.hidden = false;
    } else fab.hidden = true;
    // Navigation
    const tab = v.tab || (path.split('/')[1] || 'today');
    $$('#bottomnav [data-tab]').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
    navPill();
    if (scrollTop) { void main.offsetWidth; main.classList.add('enter'); }
    $('#topbar').classList.toggle('scrolled', main.scrollTop > 4);
    if (scrollTop && !restore) main.scrollTop = 0;
    else if (restore && this._scroll && this._scroll[path] != null) main.scrollTop = this._scroll[path];
    else main.scrollTop = prevScroll;
    if (v.mount) { try { v.mount(main); } catch (e) { console.error(e); } }
  },
  _scroll: {},
  rememberScroll() { this._scroll[this.path] = $('#view').scrollTop; },
};

// ------------------------------------------------------------------ Dialoge
const UI = {
  stack: [],
  open({ title = '', body = '', foot = '', cls = '', onClose, onMount, full = false, noHead = false }) {
    const wrap = document.createElement('div');
    wrap.className = 'modal ' + cls + (full ? ' modal-full' : '');
    wrap.innerHTML = `<div class="modal-bg"></div>
      <div class="sheet" role="dialog" aria-modal="true">
        ${noHead ? '' : `<div class="sheet-h"><div class="sheet-grip"></div><h2>${esc(title)}</h2><button class="tb-btn sheet-x" aria-label="Schließen">${icon('x')}</button></div>`}
        <div class="sheet-b">${body}</div>
        ${foot ? `<div class="sheet-f">${foot}</div>` : ''}
      </div>`;
    $('#modals').appendChild(wrap);
    const m = {
      el: wrap,
      closed: false,
      close: (val) => {
        if (m.closed) return;
        m.closed = true;
        const i = UI.stack.indexOf(m);
        if (i >= 0) UI.stack.splice(i, 1);
        wrap.classList.remove('show');
        setTimeout(() => wrap.remove(), 220);
        if (onClose) onClose(val);
      },
    };
    wrap.querySelector('.modal-bg').addEventListener('click', () => m.close());
    const x = wrap.querySelector('.sheet-x');
    if (x) x.addEventListener('click', () => m.close());
    UI.stack.push(m);
    requestAnimationFrame(() => wrap.classList.add('show'));
    if (onMount) onMount(wrap.querySelector('.sheet'), m);
    return m;
  },
  closeTop() { const m = UI.stack[UI.stack.length - 1]; if (m) m.close(); },
  closeAll() { [...UI.stack].forEach((m) => m.close()); },

  toast(msg, { undo, type = '', ms = 3200 } = {}) {
    const t = document.createElement('div');
    t.className = 'toast ' + type;
    t.innerHTML = `<span>${esc(msg)}</span>${undo ? '<button class="toast-btn">Rückgängig</button>' : ''}`;
    $('#toasts').appendChild(t);
    requestAnimationFrame(() => t.classList.add('show'));
    const close = () => { t.classList.remove('show'); setTimeout(() => t.remove(), 250); };
    if (undo) t.querySelector('.toast-btn').addEventListener('click', () => { undo(); close(); });
    setTimeout(close, undo ? Math.max(ms, 5000) : ms);
  },

  confirm(text, { title = 'Bitte bestätigen', ok = 'OK', cancel = 'Abbrechen', danger = false } = {}) {
    return new Promise((res) => {
      let result = false;
      const m = UI.open({
        title, cls: 'modal-dialog',
        body: `<p class="dlg-text">${text}</p>`,
        foot: `<button class="btn btn-ghost" data-r="0">${esc(cancel)}</button><button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-r="1">${esc(ok)}</button>`,
        onClose: () => res(result),
        onMount: (el) => {
          el.querySelectorAll('[data-r]').forEach((b) => b.addEventListener('click', () => { result = b.dataset.r === '1'; m.close(); }));
        },
      });
    });
  },

  prompt(title, { value = '', ph = '', type = 'text', label = '', ok = 'OK', multiline = false } = {}) {
    return new Promise((res) => {
      let result = null;
      const input = multiline
        ? `<textarea class="inp" rows="5" placeholder="${esc(ph)}">${esc(value)}</textarea>`
        : `<input class="inp" type="${type}" value="${esc(value)}" placeholder="${esc(ph)}">`;
      const m = UI.open({
        title, cls: 'modal-dialog',
        body: `<label class="field">${label ? `<span>${esc(label)}</span>` : ''}${input}</label>`,
        foot: `<button class="btn btn-ghost" data-r="0">Abbrechen</button><button class="btn btn-primary" data-r="1">${esc(ok)}</button>`,
        onClose: () => res(result),
        onMount: (el) => {
          const inp = el.querySelector('.inp');
          setTimeout(() => inp.focus(), 250);
          const done = () => { result = inp.value; m.close(); };
          if (!multiline) inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') done(); });
          el.querySelector('[data-r="1"]').addEventListener('click', done);
          el.querySelector('[data-r="0"]').addEventListener('click', () => m.close());
        },
      });
    });
  },

  menu(title, items) {
    return new Promise((res) => {
      let chosen = null;
      const m = UI.open({
        title, cls: 'modal-menu',
        body: `<div class="menu">${items.filter(Boolean).map((it, i) => it.sep ? '<div class="menu-sep"></div>' : `<button class="menu-it ${it.danger ? 'danger' : ''}" data-i="${i}">${it.i ? `<span class="menu-ic" ${it.c ? `style="color:${it.c}"` : ''}>${icon(it.i)}</span>` : ''}<span class="menu-l">${esc(it.l)}${it.s ? `<small>${esc(it.s)}</small>` : ''}</span>${it.on ? icon('check', 'menu-check') : ''}</button>`).join('')}</div>`,
        onClose: () => { if (chosen && chosen.fn) chosen.fn(); res(chosen ? (chosen.v !== undefined ? chosen.v : chosen) : null); },
        onMount: (el) => {
          el.querySelectorAll('[data-i]').forEach((b) => b.addEventListener('click', () => { chosen = items.filter(Boolean)[Number(b.dataset.i)]; m.close(); }));
        },
      });
    });
  },

  async pickClass(title = 'Klasse wählen') {
    const cl = activeClasses();
    if (!cl.length) { UI.toast('Bitte zuerst eine Klasse anlegen'); return null; }
    if (cl.length === 1) return cl[0].id;
    return UI.menu(title, cl.map((c) => ({ l: c.name, s: plural(studentsOf(c.id).length, 'Schüler:in', 'Schüler:innen'), i: 'users', c: classColor(c), v: c.id })));
  },

  empty(ic, text, btn = '') {
    return `<div class="empty">${icon(ic)}<p>${text}</p>${btn}</div>`;
  },

  seg(items, active, act, extra = '') {
    return `<div class="seg" ${extra}>${items.map((it) => `<button class="${it.v === active ? 'on' : ''}" data-act="${act}" data-v="${esc(it.v)}">${it.i ? icon(it.i) : ''}${esc(it.l)}</button>`).join('')}</div>`;
  },

  chips(items, active, act, { all } = {}) {
    const list = all ? [{ v: '', l: all }, ...items] : items;
    return `<div class="chips">${list.map((it) => `<button class="chip ${it.v === active ? 'on' : ''}" data-act="${act}" data-v="${esc(it.v)}" ${it.c ? `style="--cc:${it.c}"` : ''}>${it.c ? '<i class="dot" style="background:var(--cc)"></i>' : ''}${esc(it.l)}</button>`).join('')}</div>`;
  },

  avatar(s, size = '') {
    if (!s) return `<span class="av ${size}">?</span>`;
    if (s.photo) return `<span class="av ${size}"><img src="${s.photo}" alt=""></span>`;
    const hue = hashInt(s.id || sName(s)) % 360;
    return `<span class="av ${size}" style="--h:${hue}">${esc(initials(sName(s)))}</span>`;
  },

  stats(items) {
    return `<div class="stats">${items.map((s) => `<div class="stat" ${s.nav ? `data-nav="${s.nav}"` : ''}><div class="stat-v" ${s.c ? `style="color:${s.c}"` : ''}>${s.v}</div><div class="stat-l">${esc(s.l)}</div></div>`).join('')}</div>`;
  },

  // ---------------------------------------------------------------- Formular
  form(cfg) {
    const { title, fields, values = {}, submit = 'Speichern', onSave, onDelete, deleteLabel = 'Löschen', extraFoot = '' } = cfg;
    let html = '';
    let inRow = 0; // Anzahl halber Felder in der offenen Zeile
    fields.forEach((f, i) => {
      if (!f) return;
      if (!f.half && inRow) { html += '</div>'; inRow = 0; }
      if (f.half && !inRow) html += '<div class="frow">';
      html += UI.field(f, values[f.k], i);
      if (f.half) { inRow++; if (inRow === 2) { html += '</div>'; inRow = 0; } }
    });
    if (inRow) html += '</div>';
    const foot = `${onDelete ? `<button class="btn btn-ghost btn-icon danger" data-f="del" aria-label="${esc(deleteLabel)}" title="${esc(deleteLabel)}">${icon('trash-2')}</button>` : ''}${extraFoot}<span class="sp"></span><button class="btn btn-ghost" data-f="cancel">Abbrechen</button><button class="btn btn-primary" data-f="save">${esc(submit)}</button>`;
    const m = UI.open({
      title, body: `<form class="form" autocomplete="off" onsubmit="return false">${html}</form>`, foot, cls: cfg.cls || '',
      onMount: (el, modal) => {
        const form = el.querySelector('form');
        el.querySelector('[data-f="cancel"]').addEventListener('click', () => modal.close());
        const doSave = async () => {
          const vals = UI.collect(form, fields);
          for (const f of fields) {
            if (f && f.req) {
              const v = vals[f.k];
              if (v == null || v === '' || (Array.isArray(v) && !v.length)) {
                UI.toast(`Bitte „${f.label}" ausfüllen`, { type: 'err' });
                const inp = form.querySelector(`[name="${f.k}"]`);
                if (inp) { inp.focus(); inp.classList.add('invalid'); }
                return;
              }
            }
          }
          const r = await onSave(vals, modal);
          if (r !== false) modal.close();
        };
        el.querySelector('[data-f="save"]').addEventListener('click', doSave);
        form.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' && e.target.tagName === 'INPUT' && e.target.type !== 'checkbox') { e.preventDefault(); doSave(); }
        });
        const del = el.querySelector('[data-f="del"]');
        if (del) del.addEventListener('click', async () => { const r = await onDelete(modal); if (r !== false) modal.close(); });
        // Multi-Auswahl: alle / keine
        el.querySelectorAll('[data-multi]').forEach((b) => b.addEventListener('click', () => {
          const box = b.closest('.field').querySelectorAll('input[type=checkbox]');
          box.forEach((c) => { c.checked = b.dataset.multi === 'all'; });
        }));
        if (cfg.onMount) cfg.onMount(el, modal);
        const first = form.querySelector('input:not([type=hidden]):not([type=checkbox]):not([type=radio]),textarea');
        if (first && cfg.autofocus !== false && !first.value) setTimeout(() => first.focus(), 280);
      },
    });
    return m;
  },

  field(f, value, i) {
    const v = value === undefined ? (f.def !== undefined ? f.def : '') : value;
    const id = 'f' + i + '_' + (f.k || '');
    const lab = f.label ? `<span>${esc(f.label)}${f.req ? ' *' : ''}</span>` : '';
    const hint = f.hint ? `<small class="hint">${esc(f.hint)}</small>` : '';
    switch (f.type) {
      case 'section':
        return `<div class="f-section">${f.i ? icon(f.i) : ''}${esc(f.label)}</div>`;
      case 'html':
        return f.html;
      case 'hidden':
        return `<input type="hidden" name="${f.k}" value="${esc(v)}">`;
      case 'textarea':
        return `<label class="field">${lab}<textarea name="${f.k}" id="${id}" rows="${f.rows || 3}" placeholder="${esc(f.ph || '')}">${esc(v)}</textarea>${hint}</label>`;
      case 'select':
        return `<label class="field">${lab}<select name="${f.k}" id="${id}">${(f.opts || []).map((o) => `<option value="${esc(o.v)}" ${String(o.v) === String(v ?? '') ? 'selected' : ''}>${esc(o.l)}</option>`).join('')}</select>${hint}</label>`;
      case 'switch':
        return `<label class="field field-switch"><span class="sw-l">${esc(f.label)}${f.hint ? `<small>${esc(f.hint)}</small>` : ''}</span><input type="checkbox" name="${f.k}" class="switch" ${v ? 'checked' : ''}></label>`;
      case 'color': {
        const list = f.colors || COLORS;
        return `<div class="field">${lab}<div class="swatches">${list.map((c) => `<label class="swatch" style="--sc:${c || 'var(--card)'}"><input type="radio" name="${f.k}" value="${c}" ${String(c) === String(v || (f.allowEmpty ? '' : list[0])) ? 'checked' : ''}><span>${c ? '' : icon('ban')}</span></label>`).join('')}</div></div>`;
      }
      case 'themes':
        return `<div class="field">${lab}<div class="themes">${(f.opts || []).map((o) => `<label class="theme-o"><input type="radio" name="${f.k}" value="${esc(o.v)}" ${String(o.v) === String(v ?? '') ? 'checked' : ''}><span style="--ta:${o.a};--tb:${o.b}">${icon('check')}</span><small>${esc(o.l)}</small></label>`).join('')}</div>${hint}</div>`;
      case 'chips':
      case 'seg': {
        return `<div class="field">${lab}<div class="${f.type === 'seg' ? 'seg seg-form' : 'chips chips-wrap'}">${(f.opts || []).map((o) => `<label class="${f.type === 'seg' ? 'seg-o' : 'chip'}"><input type="radio" name="${f.k}" value="${esc(o.v)}" ${String(o.v) === String(v ?? '') ? 'checked' : ''}><span>${o.i ? icon(o.i) : ''}${esc(o.l)}</span></label>`).join('')}</div>${hint}</div>`;
      }
      case 'multi': {
        const sel = new Set(v || []);
        return `<div class="field">${lab ? `<div class="multi-h">${lab}<span class="sp"></span><button type="button" class="btn btn-sm btn-ghost" data-multi="all">Alle</button><button type="button" class="btn btn-sm btn-ghost" data-multi="none">Keine</button></div>` : ''}<div class="multi">${(f.opts || []).map((o) => `<label class="multi-o"><input type="checkbox" name="${f.k}" value="${esc(o.v)}" ${sel.has(o.v) ? 'checked' : ''}><span>${esc(o.l)}</span></label>`).join('') || '<div class="muted small">Keine Einträge vorhanden</div>'}</div>${hint}</div>`;
      }
      case 'file':
        return `<label class="field">${lab}<input type="file" name="${f.k}" accept="${esc(f.accept || '')}"></label>`;
      default: {
        const type = f.type || 'text';
        const extra = attrs({ min: f.min, max: f.max, step: f.step, inputmode: f.inputmode, maxlength: f.maxlength, list: f.list });
        return `<label class="field">${lab}<input type="${type}" name="${f.k}" id="${id}" value="${esc(v ?? '')}" placeholder="${esc(f.ph || '')}" ${extra}>${hint}</label>`;
      }
    }
  },

  collect(form, fields) {
    const out = {};
    for (const f of fields) {
      if (!f || !f.k) continue;
      if (f.type === 'multi') { out[f.k] = $$(`input[name="${f.k}"]:checked`, form).map((x) => x.value); continue; }
      if (f.type === 'switch') { out[f.k] = !!$(`input[name="${f.k}"]`, form).checked; continue; }
      if (f.type === 'color' || f.type === 'chips' || f.type === 'seg' || f.type === 'themes') { const c = $(`input[name="${f.k}"]:checked`, form); out[f.k] = c ? c.value : ''; continue; }
      if (f.type === 'file') { out[f.k] = $(`input[name="${f.k}"]`, form).files[0] || null; continue; }
      const el = $(`[name="${f.k}"]`, form);
      if (!el) continue;
      let val = el.value;
      if (f.type === 'number') val = parseNum(val);
      else if (typeof val === 'string' && f.type !== 'textarea') val = val.trim();
      out[f.k] = val;
    }
    return out;
  },
};

// ------------------------------------------------------------------ Löschen mit Rückgängig
// Abhaken mit Rückfrage (Aufgaben & Hausaufgaben): erst erscheint der Haken,
// dann: Erledigt · Nicht geschafft (verschieben) · Bearbeiten · Löschen · Haken entfernen
async function checkFlow(el, { title, later, laterSub, done, postpone, edit, remove }) {
  const btn = el && el.closest ? el.closest('.check') || el : el;
  if (btn && btn.classList) { btn.classList.add('on', 'popping'); }
  Native.call('vibrate', 12);
  await new Promise((r) => setTimeout(r, 260));
  const v = await UI.menu(title, [
    { v: 'done', l: 'Erledigt', s: 'Abhaken – verschwindet aus der Liste', i: 'circle-check', c: '#16a34a' },
    { v: 'later', l: 'Nicht geschafft', s: laterSub, i: 'calendar-clock', c: '#f59e0b' },
    { v: 'edit', l: 'Bearbeiten', i: 'pencil' },
    { v: 'delete', l: 'Löschen', i: 'trash-2', danger: true },
    { sep: true },
    { v: 'undo', l: 'Haken wieder entfernen', i: 'rotate-ccw' },
  ]);
  if (btn && btn.classList) btn.classList.remove('popping');
  if (v === 'done') return done();
  if (v === 'later') { if (btn && btn.classList) btn.classList.remove('on'); return postpone(); }
  if (v === 'edit') { if (btn && btn.classList) btn.classList.remove('on'); return edit(); }
  if (v === 'delete') { if (btn && btn.classList) btn.classList.remove('on'); return remove(); }
  // Haken entfernen oder Menü einfach geschlossen
  if (btn && btn.classList) btn.classList.remove('on');
}

// Wischen in Listen: nach rechts = erledigt, nach links = nicht geschafft (neuer Termin)
(function swipeLists() {
  let st = null;
  const reset = (li) => {
    li.style.transition = 'transform .28s cubic-bezier(.2, .8, .2, 1)'; li.style.transform = '';
    setTimeout(() => { li.style.transition = ''; li.classList.remove('swiping', 'sw-r', 'sw-l'); const l = li.closest('.list'); if (l) l.classList.remove('swipe-clip'); }, 300);
  };
  document.addEventListener('touchstart', (e) => {
    st = null;
    if (e.touches.length !== 1) return;
    const li = e.target.closest && e.target.closest('.li');
    if (!li) return;
    const chk = li.querySelector('.check[data-act="task-toggle"]:not(.on), .check[data-act="hw-toggle"]:not(.on)');
    if (!chk) return;
    st = { li, chk, x: e.touches[0].clientX, y: e.touches[0].clientY, dx: 0, lock: null, buzz: false };
  }, { passive: true });
  document.addEventListener('touchmove', (e) => {
    if (!st) return;
    const t = e.touches[0];
    const dx = t.clientX - st.x, dy = t.clientY - st.y;
    if (!st.lock) {
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
      st.lock = Math.abs(dx) > Math.abs(dy) * 1.4 ? 'x' : 'y';
      if (st.lock === 'y') { st = null; return; }
      st.li.classList.add('swiping');
      const l = st.li.closest('.list'); if (l) l.classList.add('swipe-clip');
    }
    e.preventDefault();
    st.dx = Math.max(-150, Math.min(150, dx));
    st.li.style.transform = `translateX(${st.dx}px)`;
    const r = st.dx > 80, l = st.dx < -80;
    if ((r || l) && !st.buzz) { st.buzz = true; Native.call('vibrate', 10); } else if (!r && !l) st.buzz = false;
    st.li.classList.toggle('sw-r', r); st.li.classList.toggle('sw-l', l);
  }, { passive: false });
  const end = () => {
    if (!st) return;
    const { li, chk, dx, lock } = st; st = null;
    if (lock !== 'x') return;
    reset(li);
    const id = chk.dataset.id, task = chk.dataset.act === 'task-toggle';
    const item = task ? byId('tasks', id) : byId('homework', id);
    if (!item) return;
    if (dx > 80) setTimeout(() => (task ? taskDone(item) : hwDone(item)), 120);
    else if (dx < -80) setTimeout(() => (task ? postponeTask(item) : postponeHomework(item)), 120);
  };
  document.addEventListener('touchend', end, { passive: true });
  document.addEventListener('touchcancel', () => { if (st) { const li = st.li; st = null; reset(li); } }, { passive: true });
})();

// Schnellsuche am Computer: Strg+K / Cmd+K (oder „/“ außerhalb von Eingabefeldern)
document.addEventListener('keydown', (e) => {
  const inField = e.target && e.target.matches && e.target.matches('input, textarea, select, [contenteditable]');
  if (((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) || (e.key === '/' && !inField && !e.ctrlKey && !e.metaKey && !e.altKey)) {
    if (typeof Lock !== 'undefined' && Lock.active) return;
    e.preventDefault();
    UI.closeAll();
    App.navigate('/search');
    setTimeout(() => { const i = document.querySelector('.view input[type="search"], .view .search input'); if (i) i.focus(); }, 80);
  }
});

// „Nicht geschafft“: neues Datum, Uhrzeit, Erinnerung und Notiz wählen
function postponeForm({ item, quick, withRemind, apply }) {
  UI.form({
    title: 'Nicht geschafft – neuer Termin',
    submit: 'Verschieben',
    fields: [
      { type: 'html', html: `<p class="text2" style="margin:0 0 2px">„${esc(item.title)}“ – bis wann schaffst du es?</p>` },
      { k: 'quick', label: 'Schnell wählen', type: 'chips', opts: quick.map((q, i) => ({ v: String(i), l: q.l })) },
      { k: 'due', label: 'Neues Datum', type: 'date', req: true, half: true },
      { k: 'time', label: 'Uhrzeit (optional)', type: 'time', half: true },
      withRemind ? { k: 'remind', label: 'Erinnern', type: 'switch', hint: 'Benachrichtigung zum neuen Termin' } : null,
      { k: 'note', label: 'Notiz (optional)', ph: 'z. B. Kopierer war kaputt' },
    ],
    values: { quick: '0', due: quick[0].d, time: quick[0].t !== undefined ? quick[0].t : (item.time || ''), remind: !!item.remind },
    autofocus: false,
    onMount: (el) => {
      const due = el.querySelector('[name=due]');
      const time = el.querySelector('[name=time]');
      const radios = [...el.querySelectorAll('input[name=quick]')];
      radios.forEach((r) => r.addEventListener('change', () => { const q = quick[Number(r.value)]; due.value = q.d; if (q.t !== undefined) time.value = q.t; }));
      due.addEventListener('input', () => radios.forEach((r) => { r.checked = quick[Number(r.value)].d === due.value; }));
    },
    onSave: (v) => {
      if (!v.due) { UI.toast('Bitte ein Datum wählen', { type: 'err' }); return false; }
      if (v.due < today()) { UI.toast('Das Datum liegt in der Vergangenheit', { type: 'err' }); return false; }
      if (v.remind && !S.settings.remind.on) { S.settings.remind.on = true; requestNotifPermission(); }
      apply(v);
    },
  });
}
// Notiz „Nicht geschafft“ an einen Text anhängen
function notDoneNote(text, note) {
  if (!note || !String(note).trim()) return text || '';
  return (text ? text + '\n' : '') + `Nicht geschafft (${fmtDS(today())}): ${String(note).trim()}`;
}

async function deleteWithUndo(coll, id, label, { confirm = true, after } = {}) {
  if (confirm && !(await UI.confirm(`„${esc(label)}" wirklich löschen?`, { ok: 'Löschen', danger: true }))) return false;
  const idx = S[coll].findIndex((x) => x.id === id);
  if (idx < 0) return false;
  const item = S[coll][idx];
  S[coll].splice(idx, 1);
  save();
  if (after) after();
  App.refresh();
  UI.toast('Gelöscht', { undo: () => { S[coll].splice(idx, 0, item); save(); App.refresh(); } });
  return true;
}

// ------------------------------------------------------------------ Dateien, Teilen, Drucken
const Files = {
  save(filename, mime, content, isB64 = false) {
    if (Native.has) { Native.call('saveFile', filename, mime, content, isB64); return; }
    let blob;
    if (isB64) {
      const bin = atob(content);
      const arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      blob = new Blob([arr], { type: mime });
    } else blob = new Blob([content], { type: mime });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    UI.toast('Datei heruntergeladen');
  },
  csv(filename, rows) { this.save(filename, 'text/csv', toCSV(rows)); },
  shareFile(filename, mime, content, text = '') {
    if (Native.has) { Native.call('shareFile', filename, mime, content, text); return; }
    // Web-App: am Handy über das Teilen-Menü (Datei + Nachricht), sonst Datei laden und Nachricht kopieren
    try {
      const file = new File([content], filename, { type: mime });
      if (navigator.canShare && navigator.canShare({ files: [file] })) { navigator.share({ files: [file], text: text || undefined }).catch(() => {}); return; }
    } catch (e) { /* weiter mit Download */ }
    this.save(filename, mime, content);
    if (text) setTimeout(() => this.copy(text), 600);
  },
  share(title, text) {
    if (Native.has) { Native.call('shareText', title, text); return; }
    if (navigator.share) { navigator.share({ title, text }).catch(() => {}); return; }
    this.copy(text);
  },
  copy(text) {
    const done = () => UI.toast('In die Zwischenablage kopiert');
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, () => this._copyFallback(text, done));
    else this._copyFallback(text, done);
  },
  _copyFallback(text, done) {
    const t = document.createElement('textarea');
    t.value = text; document.body.appendChild(t); t.select();
    try { document.execCommand('copy'); done(); } catch (e) { UI.toast('Kopieren nicht möglich'); }
    t.remove();
  },
  pick(accept = '') {
    return new Promise((res) => {
      const inp = document.createElement('input');
      inp.type = 'file';
      if (accept) inp.accept = accept;
      inp.style.display = 'none';
      inp.addEventListener('change', () => { res(inp.files[0] || null); inp.remove(); });
      document.body.appendChild(inp);
      inp.click();
    });
  },
  readText(file) {
    return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsText(file, 'utf-8'); });
  },
  readImage(file, maxSize = 256) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onerror = rej;
      r.onload = () => {
        const img = new Image();
        img.onload = () => {
          const sc = Math.min(1, maxSize / Math.max(img.width, img.height));
          const c = document.createElement('canvas');
          const side = Math.round(Math.min(img.width, img.height) * sc);
          c.width = side; c.height = side;
          const ctx = c.getContext('2d');
          const sw = Math.min(img.width, img.height);
          ctx.drawImage(img, (img.width - sw) / 2, (img.height - sw) / 2, sw, sw, 0, 0, side, side);
          res(c.toDataURL('image/jpeg', 0.82));
        };
        img.onerror = rej;
        img.src = r.result;
      };
      r.readAsDataURL(file);
    });
  },
};

const Print = {
  show(title, html, { landscape = false } = {}) {
    const st = S.settings;
    const el = $('#print-area');
    el.className = landscape ? 'landscape' : '';
    el.innerHTML = `<div class="p-head"><div class="p-title">${esc(title)}</div><div class="p-meta">${esc([st.school, st.teacher, 'Stand: ' + fmtD(today())].filter(Boolean).join(' · '))}</div></div>${html}`;
    if (Native.has) Native.call('print', 'Schulplan – ' + title);
    else { setTimeout(() => window.print(), 50); }
  },
  done() { $('#print-area').innerHTML = ''; },
};

// ------------------------------------------------------------------ Theme
function systemDark() {
  if (Native.has) { const v = Native.call('isSystemDark'); if (v != null) return !!v; }
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
}
// Gleitende Markierung in der Navigation (Design 3.0)
function navPill() {
  const nav = $('#bottomnav');
  if (!nav) return;
  let pill = nav.querySelector('.nav-pill');
  if (!pill) { pill = document.createElement('span'); pill.className = 'nav-pill'; pill.setAttribute('aria-hidden', 'true'); nav.prepend(pill); }
  const on = nav.querySelector('button.on');
  if (!on || !nav.offsetWidth) { pill.style.opacity = '0'; return; }
  const first = pill.dataset.ready !== '1';
  if (first) pill.style.transition = 'none';
  pill.style.transform = `translate3d(${on.offsetLeft}px, ${on.offsetTop}px, 0)`;
  pill.style.width = on.offsetWidth + 'px';
  pill.style.height = on.offsetHeight + 'px';
  pill.style.opacity = '1';
  if (first) { void pill.offsetWidth; pill.style.transition = ''; pill.dataset.ready = '1'; }
}
window.addEventListener('resize', () => { const p = $('#bottomnav .nav-pill'); if (p) p.dataset.ready = ''; navPill(); }, { passive: true });

function applyTheme() {
  const st = S.settings;
  const dark = st.theme === 'dark' || (st.theme === 'auto' && systemDark());
  const root = document.documentElement;
  root.dataset.theme = dark ? 'dark' : 'light';
  root.style.background = dark ? '#0b0d13' : '#f3f4fa';
  try { localStorage.setItem('sp-theme', dark ? 'dark' : 'light'); } catch (e) { /* egal */ }
  const th = THEMES.find((t) => t.v === st.themeColor);
  const acc = th ? th.a : st.accent || '#4f46e5';
  root.style.setProperty('--accent', acc);
  root.style.setProperty('--accent-soft', rgba(acc, dark ? 0.24 : 0.12));
  root.style.setProperty('--accent-line', rgba(acc, dark ? 0.3 : 0.32));
  root.style.setProperty('--accent2', th ? th.b : shiftHue(acc, 32, 0.04));
  document.body.classList.toggle('plain-bg', st.bg === 'plain');
  root.style.fontSize = (16 * (st.fontScale || 1)) + 'px';
  const bar = dark ? '#0b0d13' : '#f3f4fa';
  Native.call('setBarColors', bar, bar, !dark);
  Native.call('setPageBackground', bar);
  const meta = document.querySelector('meta[name=theme-color]');
  if (meta) meta.content = bar;
}

// ------------------------------------------------------------------ App-Sperre
const Lock = {
  active: false,
  hiddenAt: 0,
  unlockedOnce: false,
  maybeLock(force = false) {
    if (!S.settings.pin) return;
    const delay = (S.settings.lockDelay ?? 1) * 60000;
    if (force || !this.unlockedOnce || (this.hiddenAt && Date.now() - this.hiddenAt >= delay)) this.show();
  },
  show() {
    if (this.active) return;
    this.active = true;
    let entered = '';
    const el = $('#lock');
    const st = S.settings;
    const draw = (err) => {
      el.innerHTML = `<div class="lock-box">
        <div class="lock-ic">${icon('lock')}</div>
        <h2>${esc(st.teacher ? 'Hallo ' + st.teacher : 'Schulplan')}</h2>
        <p class="muted">PIN eingeben</p>
        <div class="pin-dots ${err ? 'err' : ''}">${[0, 1, 2, 3, 4, 5].slice(0, Math.max(4, entered.length)).map((i) => `<i class="${i < entered.length ? 'on' : ''}"></i>`).join('')}</div>
        <div class="pin-pad">${['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'].map((k) => `<button data-k="${k}">${k}</button>`).join('')}</div>
      </div>`;
      el.querySelectorAll('[data-k]').forEach((b) => b.addEventListener('click', () => press(b.dataset.k)));
    };
    const press = (k) => {
      if (k === 'C') entered = '';
      else if (k === '⌫') entered = entered.slice(0, -1);
      else if (entered.length < 6) entered += k;
      if (entered.length >= 4 && hashPin(entered) === st.pin) { this.hide(); return; }
      if (entered.length === 6) { entered = ''; Native.call('vibrate', 200); draw(true); return; }
      draw(false);
    };
    draw(false);
    el.hidden = false;
  },
  hide() {
    this.active = false;
    this.unlockedOnce = true;
    const el = $('#lock');
    el.hidden = true;
    el.innerHTML = '';
  },
};

// ------------------------------------------------------------------ Ereignis-Delegation
document.addEventListener('click', (e) => {
  const nav = e.target.closest('[data-nav]');
  const act = e.target.closest('[data-act]');
  // Innerstes Element gewinnt
  if (act && (!nav || nav.contains(act))) {
    const fn = A[act.dataset.act];
    if (fn) { e.preventDefault(); fn(act, e); }
    return;
  }
  if (nav) {
    e.preventDefault();
    App.rememberScroll();
    App.navigate(nav.dataset.nav, { root: nav.hasAttribute('data-root') });
  }
});
document.addEventListener('change', (e) => {
  const el = e.target.closest('[data-change]');
  if (el && A[el.dataset.change]) A[el.dataset.change](el, e);
});
document.addEventListener('input', (e) => {
  const el = e.target.closest('[data-input]');
  if (el && A[el.dataset.input]) A[el.dataset.input](el, e);
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') App.back();
});

A['app-back'] = () => App.back();

// Für Aufrufe aus der nativen Hülle (Android/Windows): „window.App" muss existieren
window.App = App;
window.UI = UI;
A['noop'] = () => {};
