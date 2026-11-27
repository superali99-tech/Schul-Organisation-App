/* Fest-Animationen: kurze Begrüßung beim Eintragen von Ferien und Festtagen
   (Sommer = Sonne, Frühling = Blumen, Herbst = Blätter, Halloween, Weihnachten).
   Alles mit CSS und SVG – keine Bilder, läuft auf der Grafikkarte. Abschaltbar in den Einstellungen. */
'use strict';

const FESTIVE = {
  summer: { l: 'Sommer', msg: 'Schöne Sommerferien!' },
  spring: { l: 'Frühling', msg: 'Schöne Frühlingsferien!' },
  autumn: { l: 'Herbst', msg: 'Schöne Herbstferien!' },
  halloween: { l: 'Halloween', msg: 'Happy Halloween!' },
  winter: { l: 'Weihnachten', msg: 'Frohe Weihnachten!' },
};

const fxR = (a, b) => a + Math.random() * (b - a);
const fxPick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const fxPct = (n) => n.toFixed(1) + '%';

// Fallende Teilchen (Blätter, Blüten, Schnee): außen fallen, innen pendeln
function fxFall(n, inner, opts = {}) {
  let h = '';
  for (let i = 0; i < n; i++) {
    const d = fxR(opts.min || 3.8, opts.max || 6.5);
    const s = fxR(opts.smin || .6, opts.smax || 1.25);
    h += `<i class="fx-p" style="--x:${fxPct(fxR(-4, 100))};--d:${d.toFixed(2)}s;--delay:${(-fxR(0, d * .7)).toFixed(2)}s;--sw:${Math.round(fxR(14, 46))}px;--r:${Math.round(fxR(-320, 320))}deg;--s:${s.toFixed(2)}"><b>${inner(i)}</b></i>`;
  }
  return h;
}

const FX_LEAF = (c) => `<svg viewBox="0 0 24 26" width="30" height="32"><path fill="${c}" d="M12 1l2.2 5.2 4.3-2-1.2 5.2 5.2 1-4.3 3.3 2.2 3.4-5.3-1.2-.9 4.9h-2.4l-.9-4.9-5.3 1.2 2.2-3.4L1.5 10.4l5.2-1-1.2-5.2 4.3 2z"/><path d="M12 9v16" stroke="rgba(0,0,0,.25)" stroke-width="1.2"/></svg>`;
const FX_OAK = (c) => `<svg viewBox="0 0 20 30" width="22" height="33"><path fill="${c}" d="M10 1C4 7 3 15 10 24c7-9 6-17 0-23z"/><path d="M10 6v23" stroke="rgba(0,0,0,.22)" stroke-width="1.1"/></svg>`;
const FX_PETAL = (c) => `<svg viewBox="0 0 16 20" width="16" height="20"><path fill="${c}" d="M8 1C2 6 2 13 8 19c6-6 6-13 0-18z"/></svg>`;
const FX_FLAKE = () => `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"><path d="M12 2v20M3.3 7l17.4 10M3.3 17L20.7 7M12 2l-2.5 2.5M12 2l2.5 2.5M12 22l-2.5-2.5M12 22l2.5-2.5"/></svg>`;

const FX_SCENES = {
  summer() {
    let rays = '';
    for (let i = 0; i < 12; i++) rays += `<rect x="95" y="4" width="10" height="30" rx="5" transform="rotate(${i * 30} 100 100)"/>`;
    let sparks = '';
    for (let i = 0; i < 12; i++) sparks += `<i class="fx-spark" style="--x:${fxPct(fxR(6, 94))};--y:${fxPct(fxR(8, 70))};--delay:${fxR(.3, 2.4).toFixed(2)}s;--s:${fxR(.6, 1.3).toFixed(2)}"></i>`;
    const wave = (c, o) => `<svg viewBox="0 0 2400 120" preserveAspectRatio="none"><path fill="${c}" opacity="${o}" d="M0 50Q150 10 300 50T600 50T900 50T1200 50T1500 50T1800 50T2100 50T2400 50V120H0Z"/></svg>`;
    return `<div class="fx-glow"></div>
      <div class="fx-sun"><svg viewBox="0 0 200 200">
        <defs><radialGradient id="fxSunG" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#fff9c4"/><stop offset=".5" stop-color="#fcd34d"/><stop offset="1" stop-color="#f59e0b"/></radialGradient></defs>
        <g class="fx-rays" fill="#fbbf24">${rays}</g>
        <circle cx="100" cy="100" r="56" fill="url(#fxSunG)"/>
        <g fill="#1e293b"><rect x="60" y="82" width="34" height="22" rx="10"/><rect x="106" y="82" width="34" height="22" rx="10"/><rect x="92" y="87" width="16" height="5" rx="2.5"/></g>
        <rect x="67" y="86" width="11" height="4" rx="2" fill="#fff" opacity=".6"/><rect x="113" y="86" width="11" height="4" rx="2" fill="#fff" opacity=".6"/>
        <circle cx="68" cy="118" r="7" fill="#fb923c" opacity=".45"/><circle cx="132" cy="118" r="7" fill="#fb923c" opacity=".45"/>
        <path d="M78 120q22 20 44 0" stroke="#b45309" stroke-width="5.5" fill="none" stroke-linecap="round"/>
      </svg></div>
      ${sparks}
      <div class="fx-waves w2">${wave('#0ea5e9', '.45')}</div><div class="fx-waves">${wave('#38bdf8', '.6')}</div>`;
  },

  spring() {
    const cols = ['#f472b6', '#facc15', '#a78bfa', '#fb7185', '#ffffff', '#60a5fa', '#f9a8d4'];
    let flowers = '';
    const n = 7;
    for (let i = 0; i < n; i++) {
      const c = cols[i % cols.length];
      const x = 6 + i * (88 / (n - 1)) + fxR(-3, 3);
      let petals = '';
      for (let p = 0; p < 6; p++) petals += `<ellipse cx="20" cy="9" rx="6.5" ry="9.5" transform="rotate(${p * 60} 20 20)"/>`;
      flowers += `<div class="fx-flower" style="--x:${fxPct(x)};--h:${Math.round(fxR(16, 34))}vh;--delay:${(.1 + i * .12).toFixed(2)}s">
        <span class="fx-stem"><em class="fx-lf l"></em><em class="fx-lf r"></em></span>
        <svg class="fx-head" viewBox="0 0 40 40"><g fill="${c}" stroke="rgba(0,0,0,.06)">${petals}</g><circle cx="20" cy="20" r="6.5" fill="${c === '#facc15' ? '#f97316' : '#facc15'}"/></svg></div>`;
    }
    let bflies = '';
    ['#f472b6', '#60a5fa', '#facc15'].forEach((c, i) => {
      bflies += `<div class="fx-bfly" style="--y:${Math.round(18 + i * 16)}%;--d:${(5.5 + i * .8).toFixed(1)}s;--delay:${(i * .5).toFixed(1)}s"><svg viewBox="-20 -16 40 32" width="46" height="38">
        <g class="w"><path fill="${c}" d="M0 0C4-12 16-14 17-6 18 1 9 3 0 0z"/><path fill="${c}" opacity=".8" d="M0 1C8 3 13 9 9 13 5 16 1 9 0 1z"/></g>
        <g transform="scale(-1 1)"><g class="w"><path fill="${c}" d="M0 0C4-12 16-14 17-6 18 1 9 3 0 0z"/><path fill="${c}" opacity=".8" d="M0 1C8 3 13 9 9 13 5 16 1 9 0 1z"/></g></g>
        <rect x="-1.4" y="-8" width="2.8" height="18" rx="1.4" fill="#3f3f46"/></svg></div>`;
    });
    return `<div class="fx-sky spring"></div>
      ${fxFall(14, (i) => FX_PETAL(fxPick(['#fbcfe8', '#f9a8d4', '#fde68a', '#ffffff'])), { smin: .7, smax: 1.2, min: 4.5, max: 7 })}
      ${bflies}${flowers}
      <div class="fx-grass"><svg viewBox="0 0 400 60" preserveAspectRatio="none"><path fill="#22c55e" d="M0 60V34l8-20 6 22 8-30 7 28 9-18 5 18 10-26 6 26 8-16 7 16 9-30 6 30 8-20 8 20 9-24 6 24 10-18 6 18 8-28 8 28 9-20 6 20 10-26 7 26 8-16 8 16 9-30 6 30 8-22 9 22 8-18 7 18 9-26 7 26 8-20 8 20 10-28 6 28 8-18 8 18 9-24 7 24 8-16 9 16 8-26 6 26 9-20 8 20 7-30 8 30 9-22 7 22V60z"/><rect y="46" width="400" height="14" fill="#16a34a"/></svg></div>`;
  },

  autumn() {
    const cols = ['#ea580c', '#f97316', '#dc2626', '#facc15', '#b45309', '#f59e0b', '#9a3412'];
    return `<div class="fx-sky autumn"></div>
      ${fxFall(32, (i) => (i % 3 ? FX_LEAF(fxPick(cols)) : FX_OAK(fxPick(cols))), { min: 4, max: 7.5, smin: 1, smax: 2.1 })}`;
  },

  halloween() {
    let bats = '';
    for (let i = 0; i < 7; i++) {
      bats += `<div class="fx-bat" style="--y:${Math.round(fxR(8, 48))}%;--d:${fxR(3.2, 5).toFixed(2)}s;--delay:${fxR(0, 1.6).toFixed(2)}s;--s:${fxR(.6, 1.2).toFixed(2)}"><svg viewBox="-28 -14 56 28" width="64" height="32">
        <g class="w"><path d="M1-2C7-9 16-11 27-6 23-3 22 1 23 5 19 2 15 3 13 7 11 3 7 3 3 6z"/></g>
        <g transform="scale(-1 1)"><g class="w"><path d="M1-2C7-9 16-11 27-6 23-3 22 1 23 5 19 2 15 3 13 7 11 3 7 3 3 6z"/></g></g>
        <ellipse rx="4" ry="6"/><path d="M-3.5-4l-1-5 3 3zM3.5-4l1-5-3 3z"/></svg></div>`;
    }
    const pumpkin = (x, s, delay) => `<div class="fx-pump" style="--x:${x};--s:${s};--delay:${delay}s"><svg viewBox="0 0 120 100">
      <path d="M58 22c0-8 3-14 9-18l5 4c-5 3-7 8-7 14z" fill="#4d7c0f"/>
      <ellipse cx="38" cy="58" rx="30" ry="36" fill="#ea580c"/><ellipse cx="82" cy="58" rx="30" ry="36" fill="#ea580c"/><ellipse cx="60" cy="58" rx="30" ry="38" fill="#f97316"/>
      <g class="fx-face" fill="#fde047"><path d="M38 46l12 0-6-12z"/><path d="M70 46l12 0-6-12z"/><path d="M58 52l4 0-2 8z"/><path d="M32 66q28 22 56 0l-6 4-5-5-6 6-5-6-6 6-6-6-5 5z"/></g></svg></div>`;
    return `<div class="fx-sky halloween"></div>
      <div class="fx-moon"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" fill="#fef3c7"/><circle cx="34" cy="38" r="8" fill="#fde68a"/><circle cx="62" cy="62" r="11" fill="#fde68a"/><circle cx="64" cy="30" r="5" fill="#fde68a"/></svg></div>
      ${bats}
      <div class="fx-ghost"><svg viewBox="0 0 60 70"><path fill="#f8fafc" d="M4 66V30a26 26 0 0 1 52 0v36l-8-7-7 7-7-7-7 7-7-7-7 7-9-7z"/><ellipse cx="22" cy="30" rx="4.5" ry="6.5" fill="#1e1b4b"/><ellipse cx="38" cy="30" rx="4.5" ry="6.5" fill="#1e1b4b"/><ellipse cx="30" cy="44" rx="5" ry="4" fill="#1e1b4b"/></svg></div>
      ${pumpkin('8%', 1, .25)}${pumpkin('70%', 1.25, .45)}${pumpkin('40%', .8, .6)}`;
  },

  winter() {
    let lights = '';
    const pts = [[80, 52], [66, 78], [94, 74], [56, 104], [80, 100], [104, 106], [46, 136], [70, 132], [92, 138], [116, 134], [38, 166], [60, 162], [84, 168], [108, 162], [128, 168]];
    pts.forEach(([x, y], i) => { lights += `<circle cx="${x}" cy="${y}" r="4.2" fill="${['#ef4444', '#facc15', '#38bdf8', '#f472b6'][i % 4]}" style="animation-delay:${(i * .17).toFixed(2)}s"/>`; });
    const gift = (x, w, h, c, r, delay) => `<g class="fx-gift" style="animation-delay:${delay}s"><rect x="${x}" y="${222 - h}" width="${w}" height="${h}" rx="3" fill="${c}"/><rect x="${x + w / 2 - 3}" y="${222 - h}" width="6" height="${h}" fill="${r}"/><rect x="${x}" y="${222 - h + h / 2 - 3}" width="${w}" height="6" fill="${r}"/><path d="M${x + w / 2} ${222 - h}c-8-10-14-2-8 0zM${x + w / 2} ${222 - h}c8-10 14-2 8 0z" fill="${r}"/></g>`;
    return `<div class="fx-sky winter"></div>
      ${fxFall(36, (i) => (i % 5 === 0 ? FX_FLAKE() : '<span class="fx-dot"></span>'), { min: 4.5, max: 8, smin: .5, smax: 1.3 })}
      <div class="fx-tree"><svg viewBox="0 0 160 230">
        <rect x="70" y="188" width="20" height="26" rx="3" fill="#92400e"/>
        <path d="M80 150L18 196h124z" fill="#15803d"/><path d="M80 110L28 160h104z" fill="#16a34a"/><path d="M80 70L38 124h84z" fill="#22c55e"/><path d="M80 34L50 88h60z" fill="#4ade80"/>
        <path d="M50 92q30 14 62-6M40 128q40 16 82-8M30 164q50 18 100-8" stroke="#fde68a" stroke-width="2" fill="none" opacity=".8"/>
        <g class="fx-lights">${lights}</g>
        <path class="fx-star" d="M80 12l5.3 10.8 11.9 1.7-8.6 8.4 2 11.8L80 39.1l-10.6 5.6 2-11.8-8.6-8.4 11.9-1.7z" fill="#fde047"/>
        ${gift(18, 34, 26, '#ef4444', '#fde047', .7)}${gift(108, 36, 30, '#3b82f6', '#f8fafc', .85)}${gift(58, 22, 18, '#a855f7', '#fde047', 1)}
      </svg></div>
      <div class="fx-snowbank"></div>`;
  },
};

const Festive = {
  on() { return S.settings.festive !== false; },
  // Welche Animation passt? Zuerst der Titel, bei Ferien sonst die Jahreszeit
  themeFor(ev) {
    if (!ev) return null;
    const t = String(ev.title || '').toLowerCase();
    const holiday = ev.type === 'ferien' || ev.type === 'feiertag';
    if (/hallo+ween|grusel/.test(t)) return 'halloween';
    if (/weihnacht|advent|nikolaus|silvester|x-?mas/.test(t)) return 'winter';
    // normale Termine nur bei Festen („Sommerfest“), nicht bei „Herbstkonferenz“
    if (!holiday && !/fest|feier|party/.test(t)) return null;
    if (/winter|neujahr/.test(t)) return 'winter';
    if (/sommer/.test(t)) return 'summer';
    if (/herbst/.test(t)) return 'autumn';
    if (/oster|frühling|frühjahr|fruehling|fruehjahr|pfingst/.test(t)) return 'spring';
    if (ev.type !== 'ferien' || !ev.date) return null;
    if (ev.date.slice(5) === '10-31') return 'halloween';
    const m = Number(ev.date.slice(5, 7));
    if (m === 12 || m <= 2) return 'winter';
    if (m <= 5) return 'spring';
    if (m <= 8) return 'summer';
    return 'autumn';
  },
  message(kind, ev) {
    const t = ev && String(ev.title || '').trim();
    if (kind === 'winter' && t && /weihnacht/i.test(t) && /ferien/i.test(t)) return 'Frohe Weihnachten & schöne Ferien!';
    if (kind !== 'halloween' && t && /ferien$/i.test(t)) return 'Schöne ' + t + '!';
    return FESTIVE[kind].msg;
  },
  forEvent(ev) {
    if (!this.on()) return;
    const k = this.themeFor(ev);
    if (k) setTimeout(() => this.play(k, ev), 250);
  },
  play(kind, ev, force = false) {
    if (!FX_SCENES[kind]) return;
    if (!force && window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const old = document.querySelector('.fx');
    if (old) old.remove();
    const el = document.createElement('div');
    el.className = 'fx fx-' + kind;
    el.setAttribute('role', 'presentation');
    const when = ev && ev.date ? fmtD(ev.date) + (ev.end && ev.end !== ev.date ? ' – ' + fmtD(ev.end) : '') : '';
    el.innerHTML = `<div class="fx-scene">${FX_SCENES[kind]()}</div>
      <div class="fx-msg"><b>${esc(this.message(kind, ev))}</b>${when ? `<span>${esc(when)}</span>` : ''}</div>`;
    document.body.appendChild(el);
    let done = false;
    const close = () => { if (done) return; done = true; el.classList.add('out'); setTimeout(() => el.remove(), 480); };
    el.addEventListener('click', close);
    setTimeout(close, 4800);
  },
};

// Kleine Symbole für die Vorschau in den Einstellungen
const FX_ICONS = {
  summer: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="5" fill="#fbbf24"/><g stroke="#f59e0b" stroke-width="2" stroke-linecap="round"><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/></g></svg>',
  spring: '<svg viewBox="0 0 40 40"><g fill="#f472b6"><ellipse cx="20" cy="9" rx="6.5" ry="9.5"/><ellipse cx="20" cy="9" rx="6.5" ry="9.5" transform="rotate(72 20 20)"/><ellipse cx="20" cy="9" rx="6.5" ry="9.5" transform="rotate(144 20 20)"/><ellipse cx="20" cy="9" rx="6.5" ry="9.5" transform="rotate(216 20 20)"/><ellipse cx="20" cy="9" rx="6.5" ry="9.5" transform="rotate(288 20 20)"/></g><circle cx="20" cy="20" r="6" fill="#facc15"/></svg>',
  autumn: FX_LEAF('#ea580c').replace('width="30" height="32"', ''),
  halloween: '<svg viewBox="0 0 120 100"><ellipse cx="38" cy="58" rx="30" ry="36" fill="#ea580c"/><ellipse cx="82" cy="58" rx="30" ry="36" fill="#ea580c"/><ellipse cx="60" cy="58" rx="30" ry="38" fill="#f97316"/><path d="M58 22c0-8 3-14 9-18l5 4c-5 3-7 8-7 14z" fill="#4d7c0f"/><g fill="#422006"><path d="M38 46h12l-6-12zM70 46h12l-6-12zM32 66q28 22 56 0l-6 4-5-5-6 6-5-6-6 6-6-6-5 5z"/></g></svg>',
  winter: '<svg viewBox="0 0 160 230"><rect x="70" y="188" width="20" height="26" rx="3" fill="#92400e"/><path d="M80 150L18 196h124z" fill="#15803d"/><path d="M80 110L28 160h104z" fill="#16a34a"/><path d="M80 70L38 124h84z" fill="#22c55e"/><path d="M80 34L50 88h60z" fill="#4ade80"/><path d="M80 12l5.3 10.8 11.9 1.7-8.6 8.4 2 11.8L80 39.1l-10.6 5.6 2-11.8-8.6-8.4 11.9-1.7z" fill="#fde047"/></svg>',
};

A['set-festive'] = () => {
  UI.open({
    title: 'Fest-Animationen',
    body: `<p class="text2" style="margin-top:0">Wenn du Ferien oder einen Festtag einträgst, erscheint kurz eine passende Animation – zum Beispiel eine Sonne bei den Sommerferien oder Schnee bei den Weihnachtsferien. Antippen beendet sie sofort.</p>
      <label class="field field-switch"><span class="sw-l">Animationen zeigen<small>Gilt für dieses Gerät – im Lehrer- und im Schulleitermodus</small></span><input type="checkbox" class="switch" id="fx-on" ${Festive.on() ? 'checked' : ''}></label>
      <div class="f-section mt2">${icon('play')}Vorschau</div>
      <div class="fx-prev">${Object.entries(FESTIVE).map(([k, t]) => `<button type="button" class="fx-prev-b" data-fx="${k}"><span>${FX_ICONS[k]}</span>${esc(t.l)}</button>`).join('')}</div>`,
    onMount: (el) => {
      el.querySelector('#fx-on').addEventListener('change', (ev) => { S.settings.festive = ev.target.checked; save(); App.refresh(); UI.toast(ev.target.checked ? 'Fest-Animationen an' : 'Fest-Animationen aus'); });
      el.querySelectorAll('[data-fx]').forEach((b) => b.addEventListener('click', () => Festive.play(b.dataset.fx, null, true)));
    },
  });
};
