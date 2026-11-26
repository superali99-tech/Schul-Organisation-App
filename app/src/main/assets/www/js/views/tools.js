/* Werkzeuge für den Unterricht */
'use strict';

const TOOLS = [
  { id: 'random', l: 'Zufallsauswahl', i: 'shuffle', c: '#4f46e5', d: 'Wer ist dran?' },
  { id: 'groups', l: 'Gruppen bilden', i: 'users-round', c: '#0891b2', d: 'Zufällige Gruppen' },
  { id: 'timer', l: 'Timer & Stoppuhr', i: 'timer', c: '#ea580c', d: 'Arbeitsphasen' },
  { id: 'noise', l: 'Lautstärke-Ampel', i: 'mic', c: '#dc2626', d: 'Geräuschpegel messen' },
  { id: 'ampel', l: 'Ampel', i: 'traffic-cone', c: '#16a34a', d: 'Arbeitsphasen anzeigen' },
  { id: 'key', l: 'Notenschlüssel', i: 'table', c: '#9333ea', d: 'Punkte → Noten' },
  { id: 'average', l: 'Notenrechner', i: 'calculator', c: '#2563eb', d: 'Durchschnitt & Gewichtung' },
  { id: 'dice', l: 'Würfel & Münze', i: 'dices', c: '#ca8a04', d: 'Zufallszahlen' },
  { id: 'clock', l: 'Stundenuhr', i: 'clock', c: '#0d9488', d: 'Restzeit der Stunde' },
];

App.def('/tools', () => ({
  title: 'Werkzeuge', tab: 'more', icon: 'sparkles',
  html: `<div class="tiles">${TOOLS.map((t) => `<button class="tile" data-nav="/tool/${t.id}" style="--tc:${t.c};--tc-soft:${rgba(t.c, .13)}"><span class="tile-ic">${icon(t.i)}</span>${esc(t.l)}<small class="muted" style="font-weight:400">${esc(t.d)}</small></button>`).join('')}</div>`,
}));

App.def('/tool/:name/:arg?', (p) => {
  const t = TOOLS.find((x) => x.id === p.name);
  if (!t) return { title: 'Werkzeug', html: UI.empty('circle-help', 'Unbekanntes Werkzeug.') };
  const fn = { random: toolRandom, groups: toolGroups, timer: toolTimer, noise: toolNoise, ampel: toolAmpel, key: toolKey, average: toolAverage, dice: toolDice, clock: toolClock }[t.id];
  const v = fn(p.arg);
  return { title: t.l, tab: 'more', ...v };
});

function classSelect(id, value, act) {
  return `<select class="inline-input" id="${id}" data-change="${act}">${activeClasses().map((c) => `<option value="${c.id}" ${c.id === value ? 'selected' : ''}>${esc(c.name)} (${studentsOf(c.id).length})</option>`).join('')}</select>`;
}
function needClasses() {
  return activeClasses().some((c) => studentsOf(c.id).length) ? '' : UI.empty('users', 'Lege zuerst eine Klasse mit Schüler:innen an.', '<button class="btn btn-primary" data-nav="/classes">Zu den Klassen</button>');
}

// ------------------------------------------------------------------ Töne
const Sound = {
  ctx: null,
  beep(freq = 880, dur = 0.18, delay = 0, vol = 0.35) {
    try {
      this.ctx = this.ctx || new (window.AudioContext || window.webkitAudioContext)();
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'sine';
      o.frequency.value = freq;
      const t0 = this.ctx.currentTime + delay;
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(vol, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      o.connect(g); g.connect(this.ctx.destination);
      o.start(t0); o.stop(t0 + dur + 0.05);
    } catch (e) { /* kein Audio */ }
  },
  alarm() { [0, 0.25, 0.5, 1.0, 1.25, 1.5].forEach((d, i) => this.beep(i % 3 === 2 ? 1320 : 990, 0.2, d)); Native.call('vibrate', 800); },
  tick() { this.beep(1200, 0.05, 0, 0.15); },
  gong() { this.beep(660, 0.9, 0, 0.4); this.beep(523, 1.2, 0.5, 0.35); },
};

// ------------------------------------------------------------------ Zufallsauswahl
const Picker = { used: {}, history: [] };
function toolRandom(arg) {
  const need = needClasses();
  if (need) return { html: need };
  const classes = activeClasses().filter((c) => studentsOf(c.id).length);
  const cid = (arg && cls(arg) ? arg : null) || Picker.cid || (classes[0] || {}).id;
  Picker.cid = cid;
  const opts = Picker.opts || (Picker.opts = { noRepeat: true, noAbsent: true });
  const pool = pickerPool(cid);
  return {
    html: `<div class="card"><div class="col">
      ${classSelect('pk-class', cid, 'pk-class')}
      <label class="field-switch field"><span class="sw-l">Ohne Wiederholung<small>Jede:r kommt einmal dran</small></span><input type="checkbox" class="switch" data-change="pk-opt" data-k="noRepeat" ${opts.noRepeat ? 'checked' : ''}></label>
      <label class="field-switch field"><span class="sw-l">Abwesende überspringen<small>laut heutiger Anwesenheit</small></span><input type="checkbox" class="switch" data-change="pk-opt" data-k="noAbsent" ${opts.noAbsent ? 'checked' : ''}></label>
    </div></div>
    <div class="card pick-stage"><div class="pick-name" id="pk-name">${Picker.last && Picker.last.cid === cid ? esc(sName(stu(Picker.last.sid))) : '?'}</div>
      <div class="muted small" id="pk-left">${pool.length} von ${studentsOf(cid).length} im Topf</div>
      <button class="btn btn-primary btn-lg mt" data-act="pk-go" style="min-width:200px">${icon('shuffle')}Auslosen</button>
      <div class="btn-row mt" id="pk-fb" style="justify-content:center;${Picker.last && Picker.last.cid === cid ? '' : 'display:none'}">
        <button class="btn btn-sm" style="color:var(--ok)" data-act="pk-fb" data-k="plus">${icon('thumbs-up')}+</button>
        <button class="btn btn-sm" style="color:var(--danger)" data-act="pk-fb" data-k="minus">${icon('thumbs-down')}–</button>
        <button class="btn btn-sm" data-act="pk-reset">${icon('rotate-ccw')}Topf zurücksetzen</button>
      </div>
    </div>
    ${Picker.history.length ? `<div class="section-title">Zuletzt gezogen</div><div class="card pad0"><div class="list">${Picker.history.slice(0, 10).map((x) => `<div class="li"><div class="li-main"><div class="li-t">${esc(sName(stu(x.sid)))}</div><div class="li-s">${esc(cName(x.cid))} · ${x.t}</div></div></div>`).join('')}</div></div>` : ''}`,
  };
}
function pickerPool(cid) {
  const used = new Set(Picker.used[cid] || []);
  const absent = Picker.opts.noAbsent ? absentOn(cid, today()) : new Set();
  let pool = studentsOf(cid).filter((s) => !absent.has(s.id));
  if (Picker.opts.noRepeat) pool = pool.filter((s) => !used.has(s.id));
  return pool;
}
A['pk-class'] = (el) => { Picker.cid = el.value; App.navigate('/tool/random/' + el.value, { replace: true }); };
A['pk-opt'] = (el) => { Picker.opts[el.dataset.k] = el.checked; App.refresh(); };
A['pk-reset'] = () => { Picker.used[Picker.cid] = []; Picker.last = null; App.refresh(); };
A['pk-go'] = (el) => {
  const cid = Picker.cid;
  let pool = pickerPool(cid);
  if (!pool.length) {
    if (Picker.opts.noRepeat && studentsOf(cid).length) { Picker.used[cid] = []; pool = pickerPool(cid); UI.toast('Alle waren dran – der Topf ist wieder voll'); }
    if (!pool.length) { UI.toast('Niemand verfügbar'); return; }
  }
  const winner = pool[Math.floor(Math.random() * pool.length)];
  const nameEl = $('#pk-name');
  el.disabled = true;
  nameEl.className = 'pick-name rolling';
  let n = 0;
  const steps = 18;
  const roll = () => {
    if (!nameEl.isConnected) { el.disabled = false; return; }
    const s = pool[Math.floor(Math.random() * pool.length)];
    nameEl.textContent = sName(s);
    Sound.tick();
    n++;
    if (n < steps) setTimeout(roll, 40 + n * 9);
    else {
      nameEl.textContent = sName(winner);
      nameEl.className = 'pick-name final';
      Sound.beep(1046, 0.25);
      Native.call('vibrate', 40);
      (Picker.used[cid] = Picker.used[cid] || []).push(winner.id);
      Picker.last = { cid, sid: winner.id };
      Picker.history.unshift({ cid, sid: winner.id, t: mint(nowMin()) });
      el.disabled = false;
      const left = $('#pk-left'), fb = $('#pk-fb');
      if (left) left.textContent = `${pickerPool(cid).length} von ${studentsOf(cid).length} im Topf`;
      if (fb) fb.style.display = '';
    }
  };
  roll();
};
A['pk-fb'] = (el) => {
  if (!Picker.last) return;
  const s = stu(Picker.last.sid);
  upsert('observations', { studentId: s.id, classId: s.classId, date: today(), kind: el.dataset.k, text: 'Zufallsauswahl' });
  save();
  UI.toast(`${OBS_KINDS[el.dataset.k].l}: ${sShort(s)}`);
};

// ------------------------------------------------------------------ Gruppen
const Grouper = { mode: 'count', n: 4, balance: false, noAbsent: true, groups: null };
function toolGroups(arg) {
  const need = needClasses();
  if (need) return { html: need };
  const classes = activeClasses().filter((c) => studentsOf(c.id).length);
  const cid = (arg && cls(arg) ? arg : null) || Grouper.cid || (classes[0] || {}).id;
  Grouper.cid = cid;
  const G = Grouper;
  const gcols = ['#4f46e5', '#0891b2', '#16a34a', '#ea580c', '#db2777', '#9333ea', '#ca8a04', '#dc2626', '#0d9488', '#64748b', '#2563eb', '#65a30d'];
  return {
    html: `<div class="card"><div class="col">
      ${classSelect('gr-class', cid, 'gr-class')}
      ${UI.seg([{ v: 'count', l: 'Anzahl Gruppen' }, { v: 'size', l: 'Personen pro Gruppe' }], G.mode, 'gr-mode', 'style="margin:0"')}
      <div class="row" style="justify-content:center;gap:16px"><button class="btn btn-icon" data-act="gr-n" data-d="-1">${icon('minus')}</button><b style="font-size:1.8rem;min-width:40px;text-align:center">${G.n}</b><button class="btn btn-icon" data-act="gr-n" data-d="1">${icon('plus')}</button></div>
      <label class="field-switch field"><span class="sw-l">Abwesende ausschließen</span><input type="checkbox" class="switch" data-change="gr-opt" data-k="noAbsent" ${G.noAbsent ? 'checked' : ''}></label>
      <label class="field-switch field"><span class="sw-l">Mädchen/Jungen mischen<small>Nur wenn Geschlecht hinterlegt ist</small></span><input type="checkbox" class="switch" data-change="gr-opt" data-k="balance" ${G.balance ? 'checked' : ''}></label>
      <button class="btn btn-primary btn-lg" data-act="gr-go">${icon('shuffle')}Gruppen bilden</button>
    </div></div>
    ${G.groups && G.groups.cid === cid ? `<div class="row mb"><b class="sp">${G.groups.list.length} Gruppen</b><button class="btn btn-sm" data-act="gr-share">${icon('share-2')}Teilen</button><button class="btn btn-sm" data-act="gr-print">${icon('printer')}</button></div>
      <div class="groups">${G.groups.list.map((g, i) => `<div class="group" style="--gc:${gcols[i % gcols.length]}"><h4>Gruppe ${i + 1} <small class="muted">(${g.length})</small></h4>${g.map((sid) => `<div>${esc(sName(stu(sid)))}</div>`).join('')}</div>`).join('')}</div>` : ''}`,
  };
}
A['gr-class'] = (el) => { Grouper.cid = el.value; Grouper.groups = null; App.navigate('/tool/groups/' + el.value, { replace: true }); };
A['gr-mode'] = (el) => { Grouper.mode = el.dataset.v; App.refresh(); };
A['gr-n'] = (el) => { Grouper.n = clamp(Grouper.n + Number(el.dataset.d), 1, 30); App.refresh(); };
A['gr-opt'] = (el) => { Grouper[el.dataset.k] = el.checked; };
A['gr-go'] = () => {
  const G = Grouper;
  const absent = G.noAbsent ? absentOn(G.cid, today()) : new Set();
  let studs = shuffle(studentsOf(G.cid).filter((s) => !absent.has(s.id)));
  if (!studs.length) return;
  const count = G.mode === 'count' ? Math.min(G.n, studs.length) : Math.max(1, Math.round(studs.length / G.n));
  if (G.balance) {
    const w = studs.filter((s) => s.gender === 'w'), m = studs.filter((s) => s.gender === 'm'), o = studs.filter((s) => s.gender !== 'w' && s.gender !== 'm');
    studs = [...w, ...m, ...o];
  }
  const list = Array.from({ length: count }, () => []);
  studs.forEach((s, i) => list[i % count].push(s.id));
  G.groups = { cid: G.cid, list: shuffle(list) };
  Sound.beep(880, 0.15);
  App.refresh();
};
function groupsText() {
  const G = Grouper.groups;
  return `Gruppen ${cName(G.cid)} (${fmtD(today())})\n\n` + G.list.map((g, i) => `Gruppe ${i + 1}: ${g.map((sid) => sName(stu(sid))).join(', ')}`).join('\n');
}
A['gr-share'] = () => Files.share('Gruppeneinteilung', groupsText());
A['gr-print'] = () => {
  const G = Grouper.groups;
  Print.show(`Gruppen ${cName(G.cid)}`, G.list.map((g, i) => `<h3>Gruppe ${i + 1}</h3><p>${g.map((sid) => esc(sName(stu(sid)))).join('<br>')}</p>`).join(''));
};

// ------------------------------------------------------------------ Timer & Stoppuhr
const Timer = {
  total: 300, left: 300, running: false, endAt: 0, iv: null, done: false,
  sw: { running: false, start: 0, acc: 0, laps: [] },
  start() {
    if (this.left <= 0) this.left = this.total;
    this.running = true; this.done = false;
    this.endAt = Date.now() + this.left * 1000;
    Native.call('keepScreenOn', true);
    this.loop();
  },
  pause() { if (!this.running) return; this.left = Math.max(0, Math.round((this.endAt - Date.now()) / 1000)); this.running = false; Native.call('keepScreenOn', false); },
  reset() { this.running = false; this.left = this.total; this.done = false; Native.call('keepScreenOn', false); this.draw(); },
  set(sec) { this.total = sec; this.left = sec; this.running = false; this.done = false; this.draw(); },
  loop() {
    clearInterval(this.iv);
    this.iv = setInterval(() => {
      if (this.running) {
        this.left = Math.max(0, Math.ceil((this.endAt - Date.now()) / 1000));
        if (this.left <= 0) {
          this.running = false; this.done = true; Native.call('keepScreenOn', false);
          Sound.alarm();
          if (!App.path.startsWith('/tool/timer')) UI.toast('⏰ Timer abgelaufen!', { ms: 6000 });
        }
      }
      if (this.sw.running) this.drawSW();
      this.draw();
    }, 200);
  },
  fmt(s) { const m = Math.floor(s / 60); return `${pad2(m)}:${pad2(s % 60)}`; },
  draw() {
    const t = $('#tm-time');
    if (!t) return;
    t.textContent = this.fmt(this.left);
    const ring = $('#tm-ring');
    const frac = this.total ? this.left / this.total : 0;
    if (ring) ring.style.strokeDashoffset = String(2 * Math.PI * 45 * (1 - frac));
    $('#tm-wrap').classList.toggle('done', this.done);
    const b = $('#tm-toggle');
    if (b) b.innerHTML = this.running ? `${icon('pause')}Pause` : `${icon('play')}Start`;
  },
  swTime() { return this.sw.acc + (this.sw.running ? Date.now() - this.sw.start : 0); },
  fmtMs(ms) { const s = Math.floor(ms / 1000); return `${pad2(Math.floor(s / 60))}:${pad2(s % 60)},${Math.floor((ms % 1000) / 100)}`; },
  drawSW() { const e = $('#sw-time'); if (e) e.textContent = this.fmtMs(this.swTime()); },
};
function toolTimer() {
  const mode = App.timerMode || 'timer';
  let h = UI.seg([{ v: 'timer', l: 'Timer', i: 'timer' }, { v: 'sw', l: 'Stoppuhr', i: 'alarm-clock' }], mode, 'tm-mode');
  if (mode === 'timer') {
    const C = 2 * Math.PI * 45;
    h += `<div class="timer-ring" id="tm-wrap"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="45" fill="none" stroke="var(--card2)" stroke-width="6"/><circle id="tm-ring" cx="50" cy="50" r="45" fill="none" stroke="var(--accent)" stroke-width="6" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="0" style="transition:stroke-dashoffset .25s linear"/></svg>
      <div class="t"><b id="tm-time">${Timer.fmt(Timer.left)}</b><span class="muted small">von ${Timer.fmt(Timer.total)}</span></div></div>
      <div class="btn-row" style="max-width:420px;margin:0 auto"><button class="btn btn-primary btn-lg" id="tm-toggle" data-act="tm-toggle"></button><button class="btn btn-lg" data-act="tm-reset">${icon('rotate-ccw')}</button></div>
      <div class="section-title">Schnellwahl</div>
      <div class="chips chips-wrap">${[1, 2, 3, 5, 10, 15, 20, 25, 30, 45].map((m) => `<button class="chip ${Timer.total === m * 60 ? 'on' : ''}" data-act="tm-set" data-s="${m * 60}">${m} Min.</button>`).join('')}<button class="chip" data-act="tm-custom">${icon('pencil')}Eigene</button></div>`;
  } else {
    h += `<div class="big-clock" id="sw-time">${Timer.fmtMs(Timer.swTime())}</div>
      <div class="btn-row" style="max-width:420px;margin:0 auto"><button class="btn btn-primary btn-lg" data-act="sw-toggle">${Timer.sw.running ? icon('pause') + 'Stopp' : icon('play') + 'Start'}</button><button class="btn btn-lg" data-act="sw-lap" ${Timer.sw.running ? '' : 'disabled'}>${icon('flag')}Runde</button><button class="btn btn-lg" data-act="sw-reset">${icon('rotate-ccw')}</button></div>
      ${Timer.sw.laps.length ? `<div class="card pad0 mt"><div class="list">${Timer.sw.laps.map((l, i) => `<div class="li"><div class="li-main">Runde ${Timer.sw.laps.length - i}</div><b>${Timer.fmtMs(l)}</b></div>`).join('')}</div></div>` : ''}`;
  }
  return { html: h, mount: () => { Timer.loop(); Timer.draw(); } };
}
A['tm-mode'] = (el) => { App.timerMode = el.dataset.v; App.refresh(); };
A['tm-toggle'] = () => { if (Timer.running) Timer.pause(); else Timer.start(); Timer.draw(); };
A['tm-reset'] = () => Timer.reset();
A['tm-set'] = (el) => { Timer.set(Number(el.dataset.s)); App.refresh(); };
A['tm-custom'] = async () => {
  const v = await UI.prompt('Eigene Zeit', { label: 'Minuten (z. B. 7 oder 2,5)', type: 'text', value: '' });
  const n = parseNum(v);
  if (n && n > 0) { Timer.set(Math.round(n * 60)); App.refresh(); }
};
A['sw-toggle'] = () => {
  const sw = Timer.sw;
  if (sw.running) { sw.acc += Date.now() - sw.start; sw.running = false; } else { sw.start = Date.now(); sw.running = true; Timer.loop(); }
  App.refresh();
};
A['sw-lap'] = () => { Timer.sw.laps.unshift(Timer.swTime()); App.refresh(); };
A['sw-reset'] = () => { Timer.sw = { running: false, start: 0, acc: 0, laps: [] }; App.refresh(); };

// ------------------------------------------------------------------ Lautstärke
const Noise = { stream: null, ctx: null, raf: 0, thr: 60, alarms: 0, lastRed: 0, sound: false };
function toolNoise() {
  return {
    html: `<div class="card center">
      <p class="text2" style="margin-top:0">Misst den Geräuschpegel über das Mikrofon. Es wird nichts aufgenommen oder gespeichert.</p>
      <div class="ampel" style="flex-direction:row;width:auto;border-radius:30px;padding:14px;justify-content:center;max-width:300px">
        <i class="r" id="nz-r" style="width:64px;height:64px"></i><i class="y" id="nz-y" style="width:64px;height:64px"></i><i class="g on" id="nz-g" style="width:64px;height:64px"></i></div>
      <div class="meter mt"><i id="nz-bar" style="width:0%"></i><b id="nz-thr" style="left:${Noise.thr}%"></b></div>
      <div class="row mt"><span class="small muted">leise</span><span class="sp"></span><span class="small muted">laut</span></div>
      <label class="field mt"><span>Grenze (rote Ampel): <b id="nz-thr-l">${Noise.thr}</b></span><input type="range" min="15" max="95" value="${Noise.thr}" data-input="nz-thr"></label>
      <label class="field-switch field"><span class="sw-l">Warnton bei Rot</span><input type="checkbox" class="switch" data-change="nz-sound" ${Noise.sound ? 'checked' : ''}></label>
      <div class="muted small" id="nz-count">${Noise.alarms ? `${Noise.alarms}× zu laut` : ''}</div>
      <button class="btn btn-primary btn-lg mt" data-act="nz-toggle" id="nz-btn">${Noise.stream ? icon('square') + 'Stopp' : icon('mic') + 'Messung starten'}</button>
    </div>`,
    unmount: () => noiseStop(),
  };
}
A['nz-thr'] = (el) => { Noise.thr = Number(el.value); $('#nz-thr').style.left = Noise.thr + '%'; $('#nz-thr-l').textContent = Noise.thr; };
A['nz-sound'] = (el) => { Noise.sound = el.checked; };
A['nz-toggle'] = async () => {
  if (Noise.stream) { noiseStop(); App.refresh(); return; }
  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('nicht unterstützt');
    Noise.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
  } catch (e) {
    UI.toast('Mikrofon nicht verfügbar – bitte Berechtigung erlauben', { type: 'err' });
    return;
  }
  Noise.ctx = new (window.AudioContext || window.webkitAudioContext)();
  const src = Noise.ctx.createMediaStreamSource(Noise.stream);
  const an = Noise.ctx.createAnalyser();
  an.fftSize = 1024;
  src.connect(an);
  const buf = new Float32Array(an.fftSize);
  let smooth = 0;
  Native.call('keepScreenOn', true);
  const loop = () => {
    an.getFloatTimeDomainData(buf);
    let s = 0;
    for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
    const rms = Math.sqrt(s / buf.length);
    const db = 20 * Math.log10(rms + 1e-8); // ca. -100 … 0
    const lvl = clamp((db + 70) * (100 / 60), 0, 100);
    smooth = smooth * 0.85 + lvl * 0.15;
    const bar = $('#nz-bar');
    if (!bar) return;
    bar.style.width = smooth + '%';
    const state = smooth >= Noise.thr ? 'r' : smooth >= Noise.thr * 0.75 ? 'y' : 'g';
    ['r', 'y', 'g'].forEach((k) => $('#nz-' + k).classList.toggle('on', k === state));
    if (state === 'r' && Date.now() - Noise.lastRed > 3000) {
      Noise.lastRed = Date.now(); Noise.alarms++;
      $('#nz-count').textContent = `${Noise.alarms}× zu laut`;
      if (Noise.sound) Sound.gong();
    }
    Noise.raf = requestAnimationFrame(loop);
  };
  $('#nz-btn').innerHTML = icon('square') + 'Stopp';
  loop();
};
function noiseStop() {
  cancelAnimationFrame(Noise.raf);
  if (Noise.stream) Noise.stream.getTracks().forEach((t) => t.stop());
  if (Noise.ctx) Noise.ctx.close().catch(() => {});
  Noise.stream = null; Noise.ctx = null;
  Native.call('keepScreenOn', false);
}

// ------------------------------------------------------------------ Ampel
function toolAmpel() {
  const st = App.ampel || 'g';
  const labels = { r: 'Stillarbeit – bitte leise!', y: 'Flüstern / Partnerarbeit', g: 'Gruppenarbeit / Gespräch erlaubt' };
  return {
    html: `<div class="ampel">${['r', 'y', 'g'].map((k) => `<i class="${k} ${st === k ? 'on' : ''}" data-act="ampel" data-v="${k}"></i>`).join('')}</div>
      <h2 class="center mt" style="font-size:1.4rem">${labels[st]}</h2><p class="muted center small">Tippe auf eine Farbe.</p>`,
  };
}
A['ampel'] = (el) => { App.ampel = el.dataset.v; Native.call('vibrate', 20); App.refresh(); };

// ------------------------------------------------------------------ Notenschlüssel
function toolKey() {
  const k = App.keyTool || (App.keyTool = { max: 40, sys: S.settings.gradeSystem, step: 0.5, pts: '' });
  const gs = GRADE_SYSTEMS[k.sys];
  const rows = k.max > 0 ? keyTable(gs, k.max, null, k.step) : [];
  const p = parseNum(k.pts);
  const g = p != null && k.max ? gradeFromPercent(gs, (100 * p) / k.max) : null;
  return {
    html: `<div class="card"><div class="col">
      <div class="frow"><label class="field"><span>Maximale Punkte</span><input class="inline-input" type="number" inputmode="decimal" value="${k.max}" data-change="key-max"></label>
      <label class="field"><span>Schritte</span><select class="inline-input" data-change="key-step"><option value="1" ${k.step === 1 ? 'selected' : ''}>ganze Punkte</option><option value="0.5" ${k.step === 0.5 ? 'selected' : ''}>halbe Punkte</option><option value="0.25" ${k.step === 0.25 ? 'selected' : ''}>Viertelpunkte</option></select></label></div>
      ${UI.seg([{ v: 'noten', l: 'Noten 1–6' }, { v: 'punkte', l: 'Punkte 0–15' }], k.sys, 'key-sys', 'style="margin:0"')}
      <label class="field"><span>Erreichte Punkte → Note</span><input class="inline-input" type="number" inputmode="decimal" placeholder="z. B. 31,5" value="${esc(k.pts)}" data-change="key-pts"></label>
      ${g != null ? `<div class="row"><span class="sp">${fmtNumShort((100 * p) / k.max, 1)} % erreicht</span>${gradeBadge(gs, g, 'big')}</div>` : ''}
    </div></div>
    ${rows.length ? `<div class="tbl-wrap"><table class="tbl key-tbl"><tr><th>Note</th><th>Punkte</th><th>ab %</th></tr>${rows.map((r) => `<tr><td>${gradeBadge(gs, Number(r.grade))}</td><td><b>${fmtNumShort(Math.max(0, r.from), 2)} – ${fmtNumShort(Math.max(0, r.to), 2)}</b></td><td>${r.pct} %</td></tr>`).join('')}</table></div>` : ''}
    <p class="muted small">Prozentgrenzen änderst du unter <a data-nav="/settings/key">Einstellungen → Notenschlüssel</a>.</p>`,
  };
}
A['key-max'] = (el) => { App.keyTool.max = parseNum(el.value) || 0; App.refresh(); };
A['key-step'] = (el) => { App.keyTool.step = Number(el.value); App.refresh(); };
A['key-sys'] = (el) => { App.keyTool.sys = el.dataset.v; App.refresh(); };
A['key-pts'] = (el) => { App.keyTool.pts = el.value; App.refresh(); };

// ------------------------------------------------------------------ Notenrechner
function toolAverage() {
  const a = App.avgTool || (App.avgTool = { list: '', w: '', o: '', ratio: 50 });
  const gs = GRADE_SYSTEMS[S.settings.gradeSystem];
  const vals = a.list.split(/[\s;]+/).filter(Boolean).map((x) => gs.parse(x)).filter((v) => v != null);
  const av = avg(vals);
  const w = parseNum(a.w), o = parseNum(a.o);
  const fin = w != null && o != null ? (w * a.ratio + o * (100 - a.ratio)) / 100 : null;
  return {
    html: `<div class="card"><div class="card-h"><h3>${icon('calculator')}Durchschnitt berechnen</h3></div>
      <textarea class="inline-input" placeholder="Noten mit Leerzeichen getrennt, z. B. 2 3- 1+ 2,5 4" data-change="avg-list">${esc(a.list)}</textarea>
      ${vals.length ? `<div class="row mt"><span class="sp">${vals.length} Noten: ${vals.map((v) => esc(gs.format(v))).join(' · ')}</span>${avgBadge(gs, av)}</div>` : ''}
    </div>
    <div class="card"><div class="card-h"><h3>${icon('sliders-horizontal')}Schriftlich / Mündlich</h3></div>
      <div class="frow"><label class="field"><span>Ø schriftlich</span><input class="inline-input" inputmode="decimal" value="${esc(a.w)}" data-change="avg-w"></label><label class="field"><span>Ø mündlich</span><input class="inline-input" inputmode="decimal" value="${esc(a.o)}" data-change="avg-o"></label></div>
      <label class="field mt"><span>Gewichtung schriftlich: <b>${a.ratio} %</b> / mündlich: <b>${100 - a.ratio} %</b></span><input type="range" min="0" max="100" step="5" value="${a.ratio}" data-change="avg-ratio"></label>
      ${fin != null ? `<div class="row mt"><span class="sp">Gesamtnote</span>${avgBadge(gs, fin)} <span class="muted">→ ${gs.whole(fin)}</span></div>` : ''}
    </div>`,
  };
}
A['avg-list'] = (el) => { App.avgTool.list = el.value; App.refresh(); };
A['avg-w'] = (el) => { App.avgTool.w = el.value; App.refresh(); };
A['avg-o'] = (el) => { App.avgTool.o = el.value; App.refresh(); };
A['avg-ratio'] = (el) => { App.avgTool.ratio = Number(el.value); App.refresh(); };

// ------------------------------------------------------------------ Würfel
function toolDice() {
  const d = App.diceTool || (App.diceTool = { n: 1, vals: [6], coin: null, max: 30, num: null });
  return {
    html: `<div class="card center"><div class="row" style="justify-content:center;gap:14px"><button class="btn btn-icon" data-act="dice-n" data-d="-1">${icon('minus')}</button><b>${d.n} ${d.n === 1 ? 'Würfel' : 'Würfel'}</b><button class="btn btn-icon" data-act="dice-n" data-d="1">${icon('plus')}</button></div>
      <div class="dice" id="dice">${d.vals.map((v) => `<div class="die">${v}</div>`).join('')}</div>
      ${d.n > 1 ? `<div class="muted">Summe: <b>${sum(d.vals)}</b></div>` : ''}
      <button class="btn btn-primary btn-lg mt" data-act="dice-roll">${icon('dices')}Würfeln</button></div>
    <div class="card center"><div class="card-h"><h3>${icon('coins')}Münze</h3></div><div style="font-size:2rem;font-weight:800;min-height:48px" id="coin">${d.coin || '–'}</div><button class="btn btn-soft" data-act="coin">Werfen</button></div>
    <div class="card center"><div class="card-h"><h3>${icon('hash')}Zufallszahl</h3></div>
      <div class="row" style="justify-content:center">1 bis <input class="inline-input" style="width:90px;text-align:center" type="number" value="${d.max}" data-change="num-max"></div>
      <div style="font-size:2.4rem;font-weight:800;min-height:56px" id="num">${d.num ?? '–'}</div><button class="btn btn-soft" data-act="num-roll">Ziehen</button></div>`,
  };
}
A['dice-n'] = (el) => { const d = App.diceTool; d.n = clamp(d.n + Number(el.dataset.d), 1, 6); d.vals = Array.from({ length: d.n }, (_, i) => d.vals[i] || 1); App.refresh(); };
A['dice-roll'] = () => {
  const d = App.diceTool;
  d.vals = d.vals.map(() => 1 + Math.floor(Math.random() * 6));
  App.refresh();
  $$('.die').forEach((x) => x.classList.add('roll'));
  Sound.beep(700, 0.08); Native.call('vibrate', 30);
};
A['coin'] = () => { App.diceTool.coin = Math.random() < 0.5 ? 'Kopf' : 'Zahl'; App.refresh(); Sound.beep(1200, 0.06); };
A['num-max'] = (el) => { App.diceTool.max = Math.max(2, parseInt(el.value, 10) || 2); };
A['num-roll'] = () => { const d = App.diceTool; d.num = 1 + Math.floor(Math.random() * d.max); App.refresh(); Sound.beep(900, 0.08); };

// ------------------------------------------------------------------ Stundenuhr
function toolClock() {
  let iv;
  const draw = () => {
    const el = $('#clk');
    if (!el) { clearInterval(iv); return; }
    const d = now();
    el.textContent = `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
    const { cur, next } = nowNext();
    const info = $('#clk-info');
    if (cur) {
      const left = cur.e * 60 - (d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds());
      info.innerHTML = `<div class="muted">${cur.l.period + 1}. Stunde · ${esc(lessonLabel(cur.l))}</div><div style="font-size:2rem;font-weight:800">noch ${Math.floor(left / 60)}:${pad2(left % 60)} Min.</div>
        <div class="progress mt" style="height:10px"><i style="width:${Math.round(100 * (1 - left / ((cur.e - cur.s) * 60)))}%"></i></div>`;
    } else if (next) {
      info.innerHTML = `<div class="muted">Nächste Stunde (${next.l.period + 1}.) um ${mint(next.s)}</div><div style="font-size:1.6rem;font-weight:700">${esc(lessonLabel(next.l))}</div>`;
    } else info.innerHTML = '<div class="muted">Gerade keine Unterrichtsstunde.</div>';
  };
  return {
    html: `<div class="card center"><div class="big-clock" id="clk"></div><div id="clk-info"></div></div>`,
    mount: () => { Native.call('keepScreenOn', true); draw(); iv = setInterval(draw, 1000); },
    unmount: () => { clearInterval(iv); Native.call('keepScreenOn', false); },
  };
}
