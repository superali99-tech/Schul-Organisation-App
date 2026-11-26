/* Kollegium / Schulteam: Einladungen, Pinnwand, Kollegium, Termine, Vertretungen, Klassenlisten, Synchronisierung */
'use strict';

// ------------------------------------------------------------------ Kodierung & Verschlüsselung (AES-GCM)
function concatBytes(...parts) {
  const arrs = parts.map((p) => (p instanceof Uint8Array ? p : new Uint8Array(p)));
  const out = new Uint8Array(arrs.reduce((n, a) => n + a.length, 0));
  let o = 0;
  arrs.forEach((a) => { out.set(a, o); o += a.length; });
  return out;
}
const Codec = {
  enc: new TextEncoder(),
  dec: new TextDecoder(),
  b64u(bytes) {
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  },
  unb64u(str) {
    let s = str.replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    const bin = atob(s);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  },
  async _pipe(bytes, stream) {
    const s = new Blob([bytes]).stream().pipeThrough(stream);
    return new Uint8Array(await new Response(s).arrayBuffer());
  },
  async pack(obj) {
    const raw = this.enc.encode(JSON.stringify(obj));
    if (window.CompressionStream) {
      try { return concatBytes([1], await this._pipe(raw, new CompressionStream('deflate-raw'))); } catch (e) { /* unkomprimiert */ }
    }
    return concatBytes([0], raw);
  },
  async unpack(bytes) {
    let body = bytes.subarray(1);
    if (bytes[0] === 1) body = await this._pipe(body, new DecompressionStream('deflate-raw'));
    return JSON.parse(this.dec.decode(body));
  },
  random(n) { const a = new Uint8Array(n); crypto.getRandomValues(a); return a; },
  async aesKey(b64) { return crypto.subtle.importKey('raw', this.unb64u(b64), 'AES-GCM', false, ['encrypt', 'decrypt']); },
  async pinKey(pin, salt) {
    const base = await crypto.subtle.importKey('raw', this.enc.encode(pin), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 120000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  },
  async encrypt(key, bytes) {
    const iv = this.random(12);
    return concatBytes(iv, new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, bytes)));
  },
  async decrypt(key, bytes) {
    return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.subarray(0, 12) }, key, bytes.subarray(12)));
  },
};

function loadScript(src) {
  return new Promise((res, rej) => {
    if (document.querySelector(`script[src="${src}"]`)) { res(); return; }
    const s = document.createElement('script');
    s.src = src; s.onload = res; s.onerror = rej;
    document.head.appendChild(s);
  });
}
function qrSVG(text) {
  const qr = qrcode(0, 'L');
  qr.addData(text, 'Byte');
  qr.make();
  return qr.createSvgTag({ cellSize: 4, margin: 3, scalable: true });
}

const TEAM_ROLES = ['Lehrkraft', 'Klassenleitung', 'Fachbereichsleitung', 'Schulleitung', 'Stellv. Schulleitung', 'Vertretungsplanung', 'Sekretariat', 'Schulsozialarbeit', 'Referendar:in'];

function teamMemberName(id, short = false) {
  const m = S.team && S.team.members.find((x) => x.id === id);
  if (!m) return 'Unbekannt';
  const n = [m.title, m.name].filter(Boolean).join(' ');
  if (short) return m.short || n;
  return n + (m.short ? ` (${m.short})` : '');
}

// ------------------------------------------------------------------ Team-Logik
const Team = {
  on() { return !!(S.team && S.team.id); },
  me() { return Team.on() ? S.team.members.find((m) => m.id === S.team.me) : null; },
  touch(o) { o.updatedAt = Date.now(); o.by = S.team.me; return o; },
  markDeleted(id) { S.team.deleted[id] = Date.now(); },
  changed() { save(); Team.scheduleSync(); },
  scheduleSync: debounce(() => { if (Sync.connected() && S.team && S.team.autoSync !== false) Sync.run(true); }, 6000),

  schoolSnapshot() {
    const st = S.settings;
    return {
      school: st.school, year: st.year, yearStart: st.yearStart, hj2: st.hj2, yearEnd: st.yearEnd,
      periods: deepCopy(st.periods), days: st.days, abWeeks: st.abWeeks, abRef: st.abRef,
      subjects: S.subjects.map(({ name, short, color }) => ({ name, short, color })),
      updatedAt: Date.now(), by: S.team ? S.team.me : null,
    };
  },
  applySchool(sc) {
    if (!sc) return;
    const st = S.settings;
    ['school', 'year', 'yearStart', 'hj2', 'yearEnd', 'days', 'abWeeks', 'abRef'].forEach((k) => { if (sc[k] != null && sc[k] !== '') st[k] = sc[k]; });
    if (sc.periods && sc.periods.length) st.periods = deepCopy(sc.periods);
    (sc.subjects || []).forEach((x) => {
      if (!S.subjects.some((s) => s.name.toLowerCase() === x.name.toLowerCase())) S.subjects.push({ id: uid(), name: x.name, short: x.short, color: x.color || COLORS[S.subjects.length % COLORS.length] });
    });
    S.team.schoolApplied = sc.updatedAt;
  },
  collect() {
    const t = S.team;
    return deepCopy({ members: t.members, events: S.events.filter((e) => e.team === t.id), posts: t.posts, subs: t.subs, classes: t.classes, school: t.school, deleted: t.deleted });
  },
  merge(d) {
    const t = S.team;
    const sum = { posts: 0, members: 0, events: 0, subs: 0, classes: 0, school: false, n: 0 };
    Object.entries(d.deleted || {}).forEach(([id, ts]) => { if (!t.deleted[id] || t.deleted[id] < ts) t.deleted[id] = ts; });
    const alive = (it) => !(t.deleted[it.id] && t.deleted[it.id] >= (it.updatedAt || 0));
    const mergeList = (local, incoming, key) => {
      const map = new Map(local.map((x) => [x.id, x]));
      for (const it of incoming || []) {
        if (!it || !it.id || !alive(it)) continue;
        const cur = map.get(it.id);
        if (!cur) { map.set(it.id, it); if (it.by !== t.me && it.id !== t.me) sum[key]++; }
        else if ((it.updatedAt || 0) > (cur.updatedAt || 0)) map.set(it.id, it);
      }
      return [...map.values()].filter(alive);
    };
    t.members = mergeList(t.members, d.members, 'members');
    t.posts = mergeList(t.posts, d.posts, 'posts');
    t.subs = mergeList(t.subs, d.subs, 'subs');
    t.classes = mergeList(t.classes, d.classes, 'classes');
    const own = S.events.filter((e) => e.team !== t.id);
    const mine = S.events.filter((e) => e.team === t.id);
    S.events = [...own, ...mergeList(mine, (d.events || []).map((e) => ({ ...e, team: t.id })), 'events')];
    if (d.school && (!t.school || (d.school.updatedAt || 0) > (t.school.updatedAt || 0))) {
      t.school = d.school;
      if (d.school.by !== t.me) sum.school = true;
    }
    sum.n = sum.posts + sum.members + sum.events + sum.subs + sum.classes;
    return sum;
  },
  newTeam(name, key, id) {
    return { id: id || uid(), name, key, me: uid(), created: new Date().toISOString(), members: [], posts: [], subs: [], classes: [], school: null, deleted: {}, lastSync: null, seenPosts: Date.now(), autoSync: true };
  },
  memberFromForm(v, id) {
    return { id, title: v.title || '', name: v.name || '', short: (v.short || '').toUpperCase(), role: v.role || 'Lehrkraft', subjects: v.subjects || '', classes: v.classes || '', email: v.email || '', phone: v.phone || '', updatedAt: Date.now(), by: id };
  },

  // ---------------------------------------------------------------- Einladung
  async buildInvite(minimal) {
    const t = S.team;
    const payload = { k: 'invite', v: 1, team: { id: t.id, name: t.name, key: t.key }, from: t.me };
    if (minimal) Object.assign(payload, { members: t.members, school: t.school, events: S.events.filter((e) => e.team === t.id && (e.type === 'ferien' || e.type === 'feiertag')) });
    else Object.assign(payload, Team.collect());
    return 'SO1I.' + Codec.b64u(await Codec.pack(payload));
  },
  async protect(plain, pin) {
    const salt = Codec.random(16);
    const key = await Codec.pinKey(pin, salt);
    return 'SO1J.' + Codec.b64u(concatBytes(salt, await Codec.encrypt(key, Codec.unb64u(plain.slice(5)))));
  },
  async parseInvite(str, givenPin) {
    const m = String(str).match(/SO1([IJ])\.([A-Za-z0-9_-]+)/);
    if (!m) return null;
    let bytes = Codec.unb64u(m[2]);
    if (m[1] === 'J') {
      let pin = givenPin;
      if (!pin) pin = await UI.prompt('Einladungs-PIN', { type: 'tel', label: 'Die 4-stellige PIN hat dir die einladende Person persönlich gesagt.', ph: 'z. B. 2489' });
      if (!pin) return null;
      try {
        const key = await Codec.pinKey(String(pin).trim(), bytes.subarray(0, 16));
        bytes = await Codec.decrypt(key, bytes.subarray(16));
      } catch (e) {
        if (givenPin) throw new Error('PIN');
        UI.toast('Die PIN passt nicht zu dieser Einladung', { type: 'err' }); return null;
      }
    }
    const inv = await Codec.unpack(bytes);
    return inv && inv.k === 'invite' && inv.team ? inv : null;
  },
  async acceptInvite(str, inv0) {
    let inv = inv0;
    if (!inv) {
      try { inv = await Team.parseInvite(str); } catch (e) { UI.toast('Einladung beschädigt oder unvollständig', { type: 'err' }); return; }
    }
    if (!inv) return;
    if (Team.on() && S.team.id === inv.team.id) {
      const sum = Team.merge(inv);
      save(); App.navigate('/team', { root: true });
      UI.toast(`Du bist bereits in diesem Team${sum.n ? ` – ${sum.n} Neuigkeiten übernommen` : ''}`);
      return;
    }
    if (Team.on() && !(await UI.confirm(`Du bist bereits im Schulteam „${esc(S.team.name)}". Möchtest du stattdessen „${esc(inv.team.name)}" beitreten? Deine eigenen Daten bleiben erhalten.`, { ok: 'Wechseln' }))) return;
    Team.joinForm(inv);
  },
  joinForm(inv) {
    const inviter = (inv.members || []).find((m) => m.id === inv.from);
    const st = S.settings;
    UI.form({
      title: 'Schulteam beitreten',
      fields: [
        { type: 'html', html: `<div class="join-hero">${icon('school')}<div><b>${esc(inv.team.name)}</b><br><span class="muted small">Eingeladen von ${esc(inviter ? [inviter.title, inviter.name].filter(Boolean).join(' ') : 'einer Kollegin / einem Kollegen')} · ${plural((inv.members || []).length, 'Mitglied', 'Mitglieder')}</span></div></div>` },
        { type: 'section', label: 'Dein Profil im Kollegium', i: 'user' },
        { k: 'title', label: 'Anrede', type: 'select', half: true, opts: [{ v: '', l: '–' }, { v: 'Frau', l: 'Frau' }, { v: 'Herr', l: 'Herr' }] },
        { k: 'name', label: 'Name', req: true, half: true },
        { k: 'short', label: 'Kürzel', half: true, ph: 'z. B. MÜL', maxlength: 6 },
        { k: 'role', label: 'Funktion', type: 'select', half: true, opts: TEAM_ROLES.map((r) => ({ v: r, l: r })) },
        { k: 'subjects', label: 'Fächer', ph: 'z. B. Deutsch, Geschichte' },
        { k: 'email', label: 'Dienstliche E-Mail (optional)', type: 'email', half: true },
        { k: 'phone', label: 'Telefon (optional)', type: 'tel', half: true },
        inv.school ? { k: 'applySchool', label: 'Schulvorgaben übernehmen', type: 'switch', hint: 'Schuljahr, Stundenraster, Fächer und Ferien der Schule' } : null,
      ],
      values: { title: st.title, name: st.teacher, short: st.short || '', role: 'Lehrkraft', subjects: S.subjects.map((s) => s.name).join(', '), email: st.email || '', applySchool: true },
      submit: 'Beitreten',
      onSave: (v) => {
        S.team = Team.newTeam(inv.team.name, inv.team.key, inv.team.id);
        const me = Team.memberFromForm(v, S.team.me);
        S.team.members = [me];
        Team.merge(inv);
        if (v.applySchool && S.team.school) Team.applySchool(S.team.school);
        Object.assign(st, { title: v.title, teacher: v.name, short: me.short });
        st.onboarded = true;
        save(); applyTheme();
        App.navigate('/team', { root: true });
        setTimeout(() => Team.afterJoin(), 350);
      },
    });
  },
  async afterJoin() {
    const r = await UI.menu(`Willkommen im Team „${S.team.name}" 🎉`, [
      { l: 'Antwort an die einladende Person senden', s: 'Damit das Kollegium dich sieht (Datei per WhatsApp, E-Mail …)', i: 'send', v: 'share' },
      Native.has ? { l: 'Gemeinsame Cloud-Datei verbinden', s: 'Automatisch synchronisieren über Nextcloud, Google Drive …', i: 'refresh-cw', v: 'sync' } : null,
      { l: 'Später', i: 'x', v: 'later' },
    ]);
    if (r === 'share') Team.shareUpdate();
    if (r === 'sync') App.navigate('/team/sync');
  },
  createForm() {
    const st = S.settings;
    UI.form({
      title: 'Schulteam gründen',
      fields: [
        { type: 'html', html: '<p class="muted small" style="margin:0">Du gründest das Team deiner Schule und lädst danach Kolleg:innen ein. Alles bleibt verschlüsselt und läuft ohne fremden Server.</p>' },
        { k: 'team', label: 'Name des Teams / der Schule', req: true, ph: 'z. B. Astrid Lindgren Schule' },
        { type: 'section', label: 'Dein Profil im Kollegium', i: 'user' },
        { k: 'title', label: 'Anrede', type: 'select', half: true, opts: [{ v: '', l: '–' }, { v: 'Frau', l: 'Frau' }, { v: 'Herr', l: 'Herr' }] },
        { k: 'name', label: 'Name', req: true, half: true },
        { k: 'short', label: 'Kürzel', half: true, maxlength: 6, ph: 'z. B. MÜL' },
        { k: 'role', label: 'Funktion', type: 'select', half: true, opts: TEAM_ROLES.map((r) => ({ v: r, l: r })) },
        { k: 'subjects', label: 'Fächer' },
        { k: 'email', label: 'Dienstliche E-Mail (optional)', type: 'email', half: true },
        { k: 'phone', label: 'Telefon (optional)', type: 'tel', half: true },
        { k: 'shareSchool', label: 'Meine Schulvorgaben teilen', type: 'switch', hint: 'Schuljahr, Stundenraster, Fächer und Ferien werden für neue Mitglieder übernommen' },
      ],
      values: { team: st.school, title: st.title, name: st.teacher, short: st.short || '', role: 'Lehrkraft', subjects: S.subjects.map((s) => s.name).join(', '), email: st.email || '', shareSchool: true },
      submit: 'Team gründen',
      onSave: (v) => {
        S.team = Team.newTeam(v.team, Codec.b64u(Codec.random(32)));
        S.team.members = [Team.memberFromForm(v, S.team.me)];
        if (v.shareSchool) {
          S.team.school = Team.schoolSnapshot();
          S.events.forEach((e) => { if (e.type === 'ferien' || e.type === 'feiertag') { e.team = S.team.id; Team.touch(e); } });
        }
        Object.assign(st, { title: v.title, teacher: v.name, short: (v.short || '').toUpperCase(), school: st.school || v.team });
        save();
        App.navigate('/team', { root: true });
        setTimeout(() => Team.inviteSheet(), 350);
      },
    });
  },

  async inviteSheet() {
    const t = S.team;
    let qrHtml = '';
    try {
      const mini = await Team.buildInvite(true);
      qrHtml = qrSVG('schulorga://join/' + mini);
    } catch (e) { qrHtml = `<p class="muted small">QR-Code zu groß – bitte per Nachricht einladen.</p>`; }
    const pin = String(1000 + Math.floor(Math.random() * 9000));
    UI.open({
      title: 'Kolleg:innen einladen',
      body: `<div class="invite">
        <div class="seg" id="inv-seg"><button class="on" data-m="qr">${icon('qr-code')}QR-Code</button><button data-m="msg">${icon('message-circle')}Nachricht</button><button data-m="app">${icon('download')}App</button></div>
        <div data-p="qr"><div class="qr-box">${qrHtml}</div>
          <p class="center small text2">Im Lehrerzimmer: Deine Kollegin oder dein Kollege öffnet Schulplan → <b>Kollegium</b> → <b>Einladung annehmen</b> → <b>QR-Code scannen</b>.</p></div>
        <div data-p="msg" hidden>
          <div class="pin-show"><span class="muted small">Einladungs-PIN</span><b>${pin}</b><span class="muted small">Sag die PIN persönlich oder am Telefon – nicht in derselben Nachricht.</span></div>
          <button class="btn btn-primary btn-block btn-lg" data-x="share">${icon('share-2')}Einladung senden (WhatsApp, E-Mail …)</button>
          <div class="btn-row mt"><button class="btn" data-x="file">${icon('file-text')}Als Datei</button><button class="btn" data-x="copy">${icon('copy')}Code kopieren</button></div>
          <p class="muted small mt">Die Einladung ist mit der PIN verschlüsselt. Sie enthält den Team-Schlüssel, die Mitgliederliste, Termine, Pinnwand und geteilte Klassenlisten.</p>
        </div>
        <div data-p="app" hidden>
          <div class="banner">${icon('info')}<div>${window.SCHULPLAN_DESKTOP ? 'Kopiere den Download-Link für Schulplan (Windows, Mac, Linux, Android) und schicke ihn an deine Kolleg:innen.' : 'Schulplan ist nicht im Play Store.'} Gib die App einfach weiter – per Nearby Share, Bluetooth, E-Mail oder Messenger.</div></div>
          <button class="btn btn-primary btn-block btn-lg" data-x="apk" ${Native.has ? '' : 'disabled'}>${window.SCHULPLAN_DESKTOP ? icon('copy') + 'Download-Link kopieren' : icon('share-2') + 'App-Datei (APK) teilen'}</button>
          ${Native.has ? '' : '<p class="muted small">Nur in der Android-App verfügbar.</p>'}
        </div>
      </div>`,
      onMount: (el) => {
        el.querySelectorAll('#inv-seg button').forEach((b) => b.addEventListener('click', () => {
          el.querySelectorAll('#inv-seg button').forEach((x) => x.classList.toggle('on', x === b));
          el.querySelectorAll('[data-p]').forEach((p) => { p.hidden = p.dataset.p !== b.dataset.m; });
        }));
        let code = null;
        const getCode = async () => { if (!code) code = await Team.protect(await Team.buildInvite(false), pin); return code; };
        const msg = (c) => `Hallo! 👋\nIch lade dich in unser Schulteam „${t.name}" in der App Schulplan ein.\n\nSo geht's:\n1. Diese GANZE Nachricht kopieren (lange drücken → Kopieren)\n2. Schulplan öffnen → Mehr → Kollegium → „Einladung annehmen" → „Einladungs-Nachricht einfügen"\n3. Einfügen und die 4-stellige PIN eingeben – die sage ich dir persönlich.\n\nEinladungscode:\n${c}`;
        el.querySelector('[data-x="share"]').addEventListener('click', async () => Files.share('Einladung Schulplan', msg(await getCode())));
        el.querySelector('[data-x="copy"]').addEventListener('click', async () => Files.copy(msg(await getCode())));
        el.querySelector('[data-x="file"]').addEventListener('click', async () => Files.shareFile('Schulplan-Einladung.json', 'application/json', JSON.stringify({ schulorga: 'team-invite', team: t.name, code: await getCode() }), `Einladung in das Schulteam „${t.name}" (Schulplan). Die PIN bekommst du persönlich.`));
        el.querySelector('[data-x="apk"]').addEventListener('click', () => Native.call('shareApk'));
      },
    });
  },

  acceptMenu() {
    UI.menu('Einladung annehmen', [
      { l: 'QR-Code scannen', s: 'Im Lehrerzimmer am Handy der Kollegin/des Kollegen', i: 'scan-line', fn: () => Team.scan() },
      { l: 'Einladungs-Nachricht einfügen', s: 'Aus WhatsApp, E-Mail oder SMS – mit PIN', i: 'copy', fn: () => Team.acceptForm() },
      { l: 'Datei öffnen', s: 'Schulplan-Einladung.json', i: 'file-text', fn: async () => {
        const f = await Files.pick();
        if (f) App.onIncoming(await Files.readText(f));
      } },
    ]);
  },

  /** Formular: Einladungs-Nachricht und PIN auf einen Blick */
  acceptForm(prefill = '', hint = '') {
    UI.open({
      title: 'Einladung annehmen',
      body: `<div class="col">
        ${hint ? `<div class="banner warn" style="margin:0">${icon('info')}<div>${hint}</div></div>` : ''}
        <ol class="accept-steps">
          <li>Öffne die Einladung in WhatsApp, E-Mail oder SMS und <b>kopiere die ganze Nachricht</b> (lange drücken → Kopieren).</li>
          <li>Füge sie unten ein.</li>
          <li>Gib die <b>4-stellige PIN</b> ein, die dir die einladende Person persönlich gesagt hat.</li>
        </ol>
        <label class="field"><span>1 · Einladungs-Nachricht</span>
          <textarea class="inp" id="inv-text" rows="4" placeholder="Hier die ganze Nachricht einfügen – sie enthält einen langen Code, der mit SO1 beginnt">${esc(prefill)}</textarea></label>
        <button class="btn btn-soft" type="button" id="inv-paste">${icon('copy')}Aus der Zwischenablage einfügen</button>
        <label class="field" id="inv-pin-field"><span>2 · PIN</span>
          <input class="inp" id="inv-pin" type="tel" inputmode="numeric" maxlength="6" autocomplete="off" placeholder="z. B. 2489" style="font-size:1.4rem;letter-spacing:.3em;text-align:center"></label>
        <div class="inv-err danger small" id="inv-err" hidden></div>
      </div>`,
      foot: `<span class="sp"></span><button class="btn btn-ghost" data-x="cancel">Abbrechen</button><button class="btn btn-primary" data-x="ok">${icon('user-check')}Beitreten</button>`,
      onMount: (el, m) => {
        const txt = el.querySelector('#inv-text');
        const pin = el.querySelector('#inv-pin');
        const err = el.querySelector('#inv-err');
        const show = (msg, focus) => { err.innerHTML = msg; err.hidden = !msg; if (focus) focus.focus(); };
        const check = () => {
          const t = txt.value.trim();
          // Nur Ziffern im Nachrichtenfeld? Das ist die PIN – automatisch verschieben
          if (/^\d{4,6}$/.test(t)) { pin.value = t; txt.value = ''; show('Das war die <b>PIN</b> – sie steht jetzt unten. Füge oben bitte noch die <b>ganze Einladungs-Nachricht</b> ein.', txt); return; }
          const isOpen = /SO1I\./.test(t);
          el.querySelector('#inv-pin-field').style.opacity = isOpen ? '.45' : '1';
          if (t && !/SO1[IJ]\./.test(t)) show('In diesem Text ist keine Einladung. Kopiere die <b>komplette</b> Nachricht – mit dem langen Code, der mit „SO1“ beginnt.');
          else show('');
        };
        txt.addEventListener('input', check);
        el.querySelector('#inv-paste').addEventListener('click', async () => {
          try {
            const t = await navigator.clipboard.readText();
            if (t) { txt.value = t; check(); if (/SO1J\./.test(t) && !pin.value) pin.focus(); } else show('Die Zwischenablage ist leer. Kopiere zuerst die Einladungs-Nachricht.');
          } catch (e) { txt.focus(); show('Einfügen bitte von Hand: lange in das obere Feld drücken → <b>Einfügen</b>.'); }
        });
        el.querySelector('[data-x="cancel"]').addEventListener('click', () => m.close());
        el.querySelector('[data-x="ok"]').addEventListener('click', async () => {
          const t = txt.value.trim();
          const p = pin.value.trim();
          if (!t) { show(p ? 'Die PIN allein reicht nicht – füge oben bitte die <b>ganze Einladungs-Nachricht</b> ein.' : 'Bitte zuerst die Einladungs-Nachricht einfügen.', txt); return; }
          if (/^\d{4,6}$/.test(t)) { check(); return; }
          if (!/SO1[IJ]\./.test(t)) { show('In diesem Text ist keine Einladung. Kopiere die <b>komplette</b> Nachricht.', txt); return; }
          if (/SO1J\./.test(t) && !/^\d{4,6}$/.test(p)) { show('Bitte die 4-stellige <b>PIN</b> eingeben.', pin); return; }
          let inv;
          try { inv = await Team.parseInvite(t, p); } catch (e) {
            show(e.message === 'PIN' ? 'Die <b>PIN passt nicht</b>. Frag die einladende Person noch einmal nach der PIN – jede Einladung hat ihre eigene.' : 'Die Einladung ist unvollständig. Kopiere die Nachricht bitte noch einmal ganz.', e.message === 'PIN' ? pin : txt);
            return;
          }
          if (!inv) { show('Die Einladung konnte nicht gelesen werden. Kopiere die Nachricht bitte noch einmal ganz.', txt); return; }
          m.close();
          setTimeout(() => Team.acceptInvite(t, inv), 250);
        });
        if (prefill) check();
        setTimeout(() => (prefill ? pin : txt).focus(), 300);
      },
    });
  },

  async scan() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { UI.toast('Kamera nicht verfügbar – bitte „Code einfügen" nutzen', { type: 'err' }); return; }
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false }); } catch (e) { UI.toast('Kein Kamerazugriff – bitte Berechtigung erlauben', { type: 'err' }); return; }
    const detector = 'BarcodeDetector' in window ? (() => { try { return new BarcodeDetector({ formats: ['qr_code'] }); } catch (e) { return null; } })() : null;
    if (!detector) { try { await loadScript('vendor/jsQR.js'); } catch (e) { /* ignoriert */ } }
    let raf = 0, done = false;
    const stop = () => { done = true; cancelAnimationFrame(raf); stream.getTracks().forEach((tr) => tr.stop()); };
    const m = UI.open({
      title: 'QR-Code scannen', full: true, cls: 'scan-modal',
      body: `<div class="scan"><video playsinline muted></video><div class="scan-frame"></div><p>Halte die Kamera auf den Einladungs-QR-Code.</p></div><canvas hidden></canvas>`,
      onClose: stop,
      onMount: (el) => {
        const video = el.querySelector('video');
        const canvas = el.querySelector('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        video.srcObject = stream;
        video.play().catch(() => {});
        const found = (text) => {
          if (done) return;
          stop(); Native.call('vibrate', 60);
          m.close();
          setTimeout(() => App.onIncoming(text), 250);
        };
        const tick = async () => {
          if (done) return;
          if (video.readyState >= 2) {
            try {
              if (detector) {
                const codes = await detector.detect(video);
                if (codes.length) { found(codes[0].rawValue); return; }
              } else if (window.jsQR) {
                const w = Math.min(720, video.videoWidth), h = Math.round(video.videoHeight * (w / video.videoWidth));
                canvas.width = w; canvas.height = h;
                ctx.drawImage(video, 0, 0, w, h);
                const r = jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: 'dontInvert' });
                if (r && r.data) { found(r.data); return; }
              }
            } catch (e) { /* weiter versuchen */ }
          }
          raf = requestAnimationFrame(tick);
        };
        tick();
      },
    });
  },

  // ---------------------------------------------------------------- Aktualisierungen
  async buildUpdate() {
    const t = S.team;
    const key = await Codec.aesKey(t.key);
    const ct = await Codec.encrypt(key, await Codec.pack({ k: 'update', v: 1, from: t.me, data: Team.collect() }));
    return JSON.stringify({ schulorga: 'team-update', v: 1, team: t.id, name: t.name, from: teamMemberName(t.me), date: new Date().toISOString(), data: Codec.b64u(ct) });
  },
  async readUpdate(obj) {
    const key = await Codec.aesKey(S.team.key);
    const p = await Codec.unpack(await Codec.decrypt(key, Codec.unb64u(obj.data)));
    return p.data;
  },
  async shareUpdate() {
    const json = await Team.buildUpdate();
    S.team.lastShared = new Date().toISOString();
    save();
    Files.shareFile(`Schulplan-Team-${today()}.json`, 'application/json', json, `Neuigkeiten aus dem Schulteam „${S.team.name}" – Datei in Schulplan öffnen.`);
  },
  async importUpdate(obj) {
    if (!Team.on()) { UI.toast('Du bist noch in keinem Schulteam. Bitte zuerst eine Einladung annehmen.', { type: 'err', ms: 5000 }); return; }
    if (obj.team !== S.team.id) { UI.toast(`Diese Datei gehört zum Team „${obj.name || '?'}"`, { type: 'err' }); return; }
    let data;
    try { data = await Team.readUpdate(obj); } catch (e) { UI.toast('Datei konnte nicht entschlüsselt werden', { type: 'err' }); return; }
    const sum = Team.merge(data);
    save();
    App.navigate('/team', { root: true });
    UI.toast(sum.n || sum.school ? `Übernommen: ${Team.summaryText(sum)}` : 'Alles ist bereits aktuell ✓', { ms: 4500 });
  },
  summaryText(sum) {
    const p = [];
    if (sum.members) p.push(plural(sum.members, 'neues Mitglied', 'neue Mitglieder'));
    if (sum.posts) p.push(plural(sum.posts, 'Beitrag', 'Beiträge'));
    if (sum.events) p.push(plural(sum.events, 'Termin', 'Termine'));
    if (sum.subs) p.push(plural(sum.subs, 'Vertretung', 'Vertretungen'));
    if (sum.classes) p.push(plural(sum.classes, 'Klassenliste', 'Klassenlisten'));
    if (sum.school) p.push('neue Schulvorgaben');
    return p.join(', ');
  },
  async leave() {
    if (!(await UI.confirm(`Das Schulteam „${esc(S.team.name)}" auf diesem Gerät verlassen? Pinnwand, Kollegium und Vertretungen werden entfernt. Deine eigenen Klassen und Daten bleiben erhalten.`, { danger: true, ok: 'Verlassen' }))) return;
    const id = S.team.id;
    S.events.forEach((e) => { if (e.team === id) { delete e.team; delete e.by; } });
    S.team = null;
    if (Native.has) Native.call('syncClear');
    save();
    App.navigate('/team', { root: true });
    UI.toast('Team verlassen');
  },
};

// ------------------------------------------------------------------ Synchronisierung über gemeinsame Cloud-Datei
const Sync = {
  busy: false,
  waits: {},
  info() {
    if (!Native.has) return null;
    const r = Native.call('syncInfo');
    try { return r ? JSON.parse(r) : null; } catch (e) { return null; }
  },
  connected() { return !!this.info(); },
  _req(method, ...args) {
    return new Promise((res) => {
      const id = uid();
      this.waits[id] = res;
      Native.call(method, id, ...args);
      setTimeout(() => { if (this.waits[id]) { delete this.waits[id]; res({ ok: false, content: 'Zeitüberschreitung' }); } }, 45000);
    });
  },
  async run(silent = false) {
    if (!Team.on() || !this.connected() || this.busy) return;
    this.busy = true;
    try {
      const r = await this._req('syncRead');
      if (!r.ok) throw new Error('Datei konnte nicht gelesen werden');
      let sum = null;
      if (r.content && r.content.trim()) {
        let obj;
        try { obj = JSON.parse(r.content); } catch (e) { throw new Error('Datei ist keine Team-Datei'); }
        if (obj.schulorga !== 'team-update') throw new Error('Datei ist keine Team-Datei');
        if (obj.team !== S.team.id) throw new Error(`Datei gehört zum Team „${obj.name || '?'}"`);
        sum = Team.merge(await Team.readUpdate(obj));
      }
      const w = await this._req('syncWrite', await Team.buildUpdate());
      if (!w.ok) throw new Error('Datei konnte nicht gespeichert werden');
      S.team.lastSync = new Date().toISOString();
      S.team.syncError = null;
      save();
      if (!silent || (sum && (sum.n || sum.school))) UI.toast(sum && (sum.n || sum.school) ? `Synchronisiert – ${Team.summaryText(sum)}` : 'Synchronisiert ✓');
      if (!UI.stack.length && (App.path.startsWith('/team') || App.path === '/today')) App.refresh();
    } catch (e) {
      if (S.team) { S.team.syncError = e.message; save(); }
      if (!silent) UI.toast('Synchronisierung: ' + e.message, { type: 'err', ms: 5000 });
      if (!UI.stack.length && App.path.startsWith('/team')) App.refresh();
    } finally { this.busy = false; }
  },
};
App.onSyncData = (id, ok, content) => { const f = Sync.waits[id]; if (f) { delete Sync.waits[id]; f({ ok, content }); } };
App.onSyncWritten = (id, ok) => { const f = Sync.waits[id]; if (f) { delete Sync.waits[id]; f({ ok }); } };
App.onSyncPicked = (ok, name) => {
  if (!ok) { UI.toast('Keine Datei gewählt'); return; }
  UI.toast(`Verbunden mit „${name}"`);
  Sync.run(false).then(() => App.refresh());
};

// ------------------------------------------------------------------ Eingehende Inhalte (Links, Dateien, geteilter Text)
App.onIncoming = async (text) => {
  text = String(text || '').trim();
  if (!text) return;
  if (Lock.active) { setTimeout(() => App.onIncoming(text), 1500); return; }
  UI.closeAll();
  if (/SO1J\./.test(text)) { Team.acceptForm(text); return; }
  if (/SO1I\./.test(text)) { Team.acceptInvite(text); return; }
  if (/^\d{4,6}$/.test(text)) { Team.acceptForm('', `„${esc(text)}" ist die <b>PIN</b>. Für den Beitritt brauchst du zusätzlich die Einladungs-Nachricht.`); return; }
  let obj = null;
  try { obj = JSON.parse(text); } catch (e) { obj = null; }
  if (obj && obj.schulorga === 'team-invite' && obj.code) { Team.acceptForm(obj.code); return; }
  if (obj && obj.schulorga === 'team-update') { Team.importUpdate(obj); return; }
  if (obj && validBackup(obj)) {
    if (await UI.confirm(`Diese Datei ist eine Schulplan-Sicherung (${obj.classes.length} Klassen, ${obj.students.length} Schüler:innen). Wiederherstellen? <b>Alle aktuellen Daten werden ersetzt.</b>`, { danger: true, ok: 'Wiederherstellen' })) {
      Store.replace(obj); applyTheme(); App.navigate('/today', { root: true }); UI.toast('Sicherung wiederhergestellt ✓');
    }
    return;
  }
  UI.toast('Dieser Inhalt konnte nicht erkannt werden', { type: 'err' });
};

// ------------------------------------------------------------------ Ansichten
const TEAM_TABS = [
  { v: 'board', l: 'Pinnwand', i: 'megaphone' },
  { v: 'members', l: 'Kollegium', i: 'users' },
  { v: 'dates', l: 'Termine', i: 'calendar' },
  { v: 'subs', l: 'Vertretungen', i: 'replace' },
  { v: 'lists', l: 'Klassenlisten', i: 'clipboard-list' },
];

function memberAvatar(m, size = '') {
  const hue = hashInt(m ? m.id : '?') % 360;
  return `<span class="av ${size}" style="--h:${hue}">${esc(m ? (m.short || initials(m.name)).slice(0, 3) : '?')}</span>`;
}
function relTime(isoOrMs) {
  const t = typeof isoOrMs === 'number' ? isoOrMs : new Date(isoOrMs).getTime();
  const diff = (Date.now() - t) / 60000;
  if (diff < 1) return 'gerade eben';
  if (diff < 60) return `vor ${Math.round(diff)} Min.`;
  if (diff < 24 * 60) return `vor ${Math.round(diff / 60)} Std.`;
  return fmtD(iso(new Date(t)));
}

App.def('/team/:tab?', (p) => {
  if (!Team.on()) {
    return {
      title: 'Kollegium', tab: 'more', icon: 'users',
      html: `<div class="hero-card">
          <div class="hero-ic">${icon('users')}</div>
          <h2>Gemeinsam mit deinem Kollegium</h2>
          <p>Lade Kolleg:innen deiner Schule ein und teilt Termine, Ferien, Vertretungen, Klassenlisten und ein Schwarzes Brett.</p>
          <div class="hero-btns"><button class="btn btn-white btn-lg" data-act="team-create">${icon('plus')}Schulteam gründen</button>
          <button class="btn btn-glass btn-lg" data-act="team-accept">${icon('scan-line')}Einladung annehmen</button></div>
        </div>
        <div class="feature-list">
          <div>${icon('megaphone')}<span><b>Schwarzes Brett</b><small>Mitteilungen ans ganze Kollegium</small></span></div>
          <div>${icon('calendar')}<span><b>Schultermine & Ferien</b><small>Konferenzen, Elternsprechtage, Fristen</small></span></div>
          <div>${icon('replace')}<span><b>Vertretungsplan</b><small>Vertretungen erscheinen direkt im eigenen Stundenplan</small></span></div>
          <div>${icon('clipboard-list')}<span><b>Klassenlisten teilen</b><small>Klassenleitung legt die Liste einmal an, alle übernehmen sie</small></span></div>
          <div>${icon('shield')}<span><b>Verschlüsselt & ohne Server</b><small>Einladung per QR-Code oder Nachricht, Abgleich per Datei oder Schul-Cloud</small></span></div>
        </div>`,
    };
  }
  const t = S.team;
  const tab = p.tab === 'sync' ? 'board' : (p.tab || App.teamTab || 'board');
  App.teamTab = tab;
  const syncInfo = Sync.info();
  let h = `<div class="team-head">
    <div class="row"><div class="team-logo">${icon('school')}</div><div class="sp" style="min-width:0"><div class="team-name">${esc(t.name)}</div>
    <div class="team-sub">${plural(t.members.length, 'Mitglied', 'Mitglieder')} · ${syncInfo ? (t.syncError ? '<span class="warn-t">Sync-Fehler</span>' : t.lastSync ? 'synchronisiert ' + relTime(t.lastSync) : 'noch nicht synchronisiert') : t.lastShared ? 'zuletzt geteilt ' + relTime(t.lastShared) : 'Abgleich per Datei'}</div></div></div>
    <div class="btn-row mt"><button class="btn btn-white" data-act="team-invite">${icon('user-plus')}Einladen</button>
    ${syncInfo ? `<button class="btn btn-glass" data-act="team-sync">${icon('refresh-cw')}Sync</button>` : `<button class="btn btn-glass" data-act="team-share">${icon('share-2')}Senden</button><button class="btn btn-glass" data-act="team-receive">${icon('download')}Empfangen</button>`}</div>
  </div>`;
  if (t.school && t.schoolApplied !== t.school.updatedAt && t.school.by !== t.me) {
    h += `<div class="banner">${icon('school')}<div><b>Neue Schulvorgaben</b> (Stundenraster, Schuljahr, Fächer) von ${esc(teamMemberName(t.school.by))}.<div class="btn-row mt"><button class="btn btn-sm btn-primary" data-act="team-apply-school">Übernehmen</button><button class="btn btn-sm" data-act="team-ignore-school">Ignorieren</button></div></div></div>`;
  }
  h += `<div class="tabs">${TEAM_TABS.map((x) => `<button class="${x.v === tab ? 'on' : ''}" data-nav="/team/${x.v}" data-replace>${icon(x.i)}${x.l}</button>`).join('')}</div>`;
  let fab = null;
  if (tab === 'board') { h += teamBoard(); fab = { act: 'post-add', icon: 'pencil', label: 'Beitrag' }; t.seenPosts = Date.now(); }
  if (tab === 'members') h += teamMembers();
  if (tab === 'dates') { h += teamDates(); fab = { act: 'team-event-add', label: 'Termin' }; }
  if (tab === 'subs') { h += teamSubs(); fab = { act: 'sub-add', label: 'Vertretung' }; }
  if (tab === 'lists') { h += teamLists(); fab = { act: 'list-share', icon: 'share-2', label: 'Klasse teilen' }; }
  if (p.tab === 'sync') setTimeout(() => teamSyncSheet(), 50);
  return {
    title: 'Kollegium', sub: t.name, tab: 'more', icon: 'users', html: h, fab,
    actions: [{ icon: 'ellipsis', act: 'team-menu', label: 'Mehr' }],
    mount: (el) => { const on = el.querySelector('.tabs .on'); if (on) on.scrollIntoView({ inline: 'center', block: 'nearest' }); },
  };
});

function teamBoard() {
  const t = S.team;
  const posts = sortBy(t.posts, (x) => (x.pinned ? 0 : 1), (x) => -(x.updatedAt || 0));
  if (!posts.length) return UI.empty('megaphone', 'Noch keine Beiträge. Teile Infos, Erinnerungen oder Fragen mit dem ganzen Kollegium.');
  const seen = t.seenPosts || 0;
  return posts.map((x) => {
    const m = t.members.find((y) => y.id === x.by);
    const isNew = x.by !== t.me && (x.updatedAt || 0) > seen;
    return `<div class="post ${x.important ? 'important' : ''}" data-act="post-open" data-id="${x.id}">
      <div class="row">${memberAvatar(m, 'sm')}<div class="sp" style="min-width:0"><div class="b ellip">${esc(teamMemberName(x.by))}</div><div class="muted small">${relTime(x.created || x.updatedAt)}</div></div>
      ${x.pinned ? `<span class="badge acc">${icon('pin')}Angeheftet</span>` : ''}${isNew ? '<span class="badge green">Neu</span>' : ''}</div>
      ${x.title ? `<h4>${x.important ? icon('triangle-alert') : ''}${esc(x.title)}</h4>` : ''}
      <div class="post-text">${nl2br(x.text || '')}</div>
    </div>`;
  }).join('');
}

function teamMembers() {
  const t = S.team;
  const list = sortBy(t.members, (m) => (m.id === t.me ? 0 : 1), (m) => (m.name || '').toLowerCase());
  return `<div class="card pad0"><div class="list">${list.map((m) => `
    <div class="li" data-act="member-open" data-id="${m.id}">${memberAvatar(m)}<div class="li-main"><div class="li-t">${esc([m.title, m.name].filter(Boolean).join(' '))}${m.id === t.me ? ' <span class="badge acc">Du</span>' : ''}</div>
    <div class="li-s">${esc([m.short, m.role, m.subjects].filter(Boolean).join(' · '))}</div></div>${icon('chevron-right', 'chev')}</div>`).join('')}</div></div>
    <button class="btn btn-block btn-soft mt" data-act="team-invite">${icon('user-plus')}Weitere Kolleg:innen einladen</button>
    <p class="muted small center">Neue Mitglieder erscheinen hier, sobald sie ihre Antwort gesendet haben oder über die Cloud-Datei synchronisiert wurde.</p>`;
}

function teamDates() {
  const td = today();
  const list = S.events.filter((e) => e.team === S.team.id);
  const up = sortBy(list.filter((e) => (e.end || e.date) >= td), 'date', 'time');
  const past = sortBy(list.filter((e) => (e.end || e.date) < td), 'date').reverse();
  if (!list.length) return UI.empty('calendar', 'Noch keine gemeinsamen Termine. Konferenzen, Elternsprechtage oder Ferien hier eintragen – sie erscheinen bei allen im Kalender.');
  let h = '';
  if (up.length) h += `<div class="section-title">Anstehend</div><div class="card pad0"><div class="list">${up.map(eventItem).join('')}</div></div>`;
  if (past.length) h += `<div class="section-title">Vergangen</div><div class="card pad0"><div class="list">${past.slice(0, 20).map(eventItem).join('')}</div></div>`;
  return h;
}

function subItem(x) {
  const t = S.team;
  const mine = x.sub === t.me || x.absent === t.me;
  return `<div class="li ${mine ? 'li-hl' : ''}" data-act="sub-edit" data-id="${x.id}">
    <div class="li-ic" style="flex-direction:column;line-height:1.05;font-size:.72rem">${fmtDS(x.date)}<small>${Number(x.period) + 1}.</small></div>
    <div class="li-main"><div class="li-t">${esc(x.className || 'Klasse ?')}${x.subject ? ' · ' + esc(x.subject) : ''}${x.sub === t.me ? ' <span class="badge acc">Du vertrittst</span>' : ''}${!x.sub ? ' <span class="badge red">offen</span>' : ''}</div>
    <div class="li-s">für ${esc(teamMemberName(x.absent, true))}${x.sub ? ' → ' + esc(teamMemberName(x.sub, true)) : ''}${x.room ? ' · Raum ' + esc(x.room) : ''}${x.note ? ' · ' + esc(x.note) : ''}</div></div></div>`;
}
function teamSubs() {
  const td = today();
  const list = S.team.subs;
  const up = sortBy(list.filter((x) => x.date >= td), 'date', (x) => Number(x.period));
  const past = sortBy(list.filter((x) => x.date < td), 'date').reverse();
  let h = `<p class="muted small" style="margin:0 4px 10px">Vertretungen, die dich betreffen, erscheinen automatisch in deinem Stundenplan.</p>`;
  if (!list.length) return h + UI.empty('replace', 'Noch keine Vertretungen eingetragen.');
  if (up.length) h += `<div class="section-title">Anstehend</div><div class="card pad0"><div class="list">${up.map(subItem).join('')}</div></div>`;
  if (past.length) h += `<div class="section-title">Vergangen</div><div class="card pad0"><div class="list">${past.slice(0, 30).map(subItem).join('')}</div></div>`;
  return h;
}

function teamLists() {
  const t = S.team;
  let h = `<p class="muted small" style="margin:0 4px 10px">Die Klassenleitung teilt ihre Schülerliste einmal – Fachlehrkräfte übernehmen sie mit einem Tipp. Noten und Beobachtungen bleiben immer privat.</p>`;
  if (!t.classes.length) return h + UI.empty('clipboard-list', 'Noch keine Klassenlisten geteilt.', `<button class="btn btn-primary" data-act="list-share">${icon('share-2')}Eigene Klasse teilen</button>`);
  h += `<div class="card pad0"><div class="list">${sortBy(t.classes, (c) => c.name).map((tc) => {
    const local = S.classes.find((c) => c.teamCid === tc.id);
    const own = tc.by === t.me;
    let end;
    if (own) end = '<span class="badge acc">Von dir</span>';
    else if (local && (local.teamSync || 0) < (tc.updatedAt || 0)) end = `<button class="btn btn-sm btn-primary" data-act="list-adopt" data-id="${tc.id}">Aktualisieren</button>`;
    else if (local) end = `<span class="badge green">${icon('check')}Übernommen</span>`;
    else end = `<button class="btn btn-sm btn-soft" data-act="list-adopt" data-id="${tc.id}">Übernehmen</button>`;
    return `<div class="li"><div class="li-ic">${esc(tc.name.slice(0, 4))}</div><div class="li-main" data-act="list-open" data-id="${tc.id}"><div class="li-t">${esc(tc.name)}</div><div class="li-s">${plural(tc.students.length, 'Schüler:in', 'Schüler:innen')} · ${esc(teamMemberName(tc.by, true))} · ${relTime(tc.updatedAt)}</div></div>${end}</div>`;
  }).join('')}</div></div>`;
  return h;
}

// ------------------------------------------------------------------ Aktionen
A['team-create'] = () => Team.createForm();
A['team-accept'] = () => Team.acceptMenu();
A['team-invite'] = () => Team.inviteSheet();
A['team-share'] = () => Team.shareUpdate();
A['team-receive'] = async () => { const f = await Files.pick(); if (f) App.onIncoming(await Files.readText(f)); };
A['team-sync'] = () => Sync.run(false);
A['team-apply-school'] = async () => {
  if (!(await UI.confirm('Stundenraster, Schuljahr und Fächer aus den Schulvorgaben übernehmen? Deine Stundenplan-Einträge bleiben erhalten.', { ok: 'Übernehmen' }))) return;
  Team.applySchool(S.team.school); save(); applyTheme(); App.refresh(); UI.toast('Schulvorgaben übernommen');
};
A['team-ignore-school'] = () => { S.team.schoolApplied = S.team.school.updatedAt; save(); App.refresh(); };
A['team-menu'] = () => UI.menu(S.team.name, [
  { l: 'Kolleg:innen einladen', i: 'user-plus', fn: () => Team.inviteSheet() },
  { l: 'Synchronisieren & Teilen', i: 'refresh-cw', fn: () => teamSyncSheet() },
  { l: 'Mein Profil bearbeiten', i: 'user', fn: () => editMember(Team.me()) },
  { l: 'Meine Schulvorgaben teilen', i: 'school', s: 'Stundenraster, Schuljahr, Fächer für alle', fn: async () => {
    if (!(await UI.confirm('Deine Einstellungen (Stundenraster, Schuljahr, Fächer) als Vorgabe für das ganze Team teilen?', { ok: 'Teilen' }))) return;
    S.team.school = Team.schoolSnapshot(); S.team.schoolApplied = S.team.school.updatedAt; Team.changed(); UI.toast('Schulvorgaben werden beim nächsten Abgleich geteilt');
  } },
  { l: 'Team umbenennen', i: 'pencil', fn: async () => { const n = await UI.prompt('Name des Teams', { value: S.team.name }); if (n && n.trim()) { S.team.name = n.trim(); save(); App.refresh(); } } },
  { sep: true },
  { l: 'Team verlassen', i: 'log-out', danger: true, fn: () => Team.leave() },
]);

function teamSyncSheet() {
  const info = Sync.info();
  const t = S.team;
  UI.open({
    title: 'Abgleich mit dem Kollegium',
    body: `<div class="col">
      <div class="f-section">${icon('share-2')}Per Datei (WhatsApp, E-Mail, Nearby Share)</div>
      <p class="muted small" style="margin:0">Sende deine Neuigkeiten als verschlüsselte Datei. Wer sie in Schulplan öffnet, bekommt alle Änderungen. ${t.lastShared ? `Zuletzt gesendet ${relTime(t.lastShared)}.` : ''}</p>
      <div class="btn-row"><button class="btn btn-primary" data-x="share">${icon('share-2')}Neuigkeiten senden</button><button class="btn" data-x="recv">${icon('download')}Datei öffnen</button></div>
      <div class="f-section mt">${icon('refresh-cw')}Gemeinsame Cloud-Datei</div>
      <p class="muted small" style="margin:0">Lege eine Team-Datei in einem freigegebenen Ordner an (z. B. Schul-Nextcloud, Google Drive, OneDrive). Alle verbinden dieselbe Datei – die App gleicht dann automatisch beim Öffnen ab. Die Datei ist verschlüsselt.</p>
      ${!Native.has ? '<div class="banner warn">' + icon('info') + '<div>Nur in der Android-App verfügbar.</div></div>' : info ? `
        <div class="banner ${t.syncError ? 'err' : 'ok'}">${icon(t.syncError ? 'triangle-alert' : 'circle-check')}<div><b>${esc(info.name)}</b><br>${t.syncError ? esc(t.syncError) : t.lastSync ? 'Zuletzt synchronisiert ' + relTime(t.lastSync) : 'Noch nicht synchronisiert'}</div></div>
        <label class="field-switch field"><span class="sw-l">Automatisch abgleichen<small>Beim Öffnen der App und nach Änderungen</small></span><input type="checkbox" class="switch" data-x="auto" ${t.autoSync !== false ? 'checked' : ''}></label>
        <div class="btn-row"><button class="btn btn-primary" data-x="sync">${icon('refresh-cw')}Jetzt abgleichen</button><button class="btn" data-x="off">${icon('x')}Trennen</button></div>`
      : `<div class="btn-row"><button class="btn btn-primary" data-x="create">${icon('plus')}Neue Team-Datei anlegen</button><button class="btn" data-x="open">${icon('link')}Vorhandene verbinden</button></div>`}
    </div>`,
    onMount: (el, m) => {
      const on = (x, fn) => { const b = el.querySelector(`[data-x="${x}"]`); if (b) b.addEventListener(b.type === 'checkbox' ? 'change' : 'click', () => fn(b)); };
      on('share', () => { m.close(); Team.shareUpdate(); });
      on('recv', () => { m.close(); A['team-receive'](); });
      on('create', () => { m.close(); Native.call('syncPick', true, `Schulplan-Team-${t.name.replace(/[^\wäöüÄÖÜß-]+/g, '_')}.json`); });
      on('open', () => { m.close(); Native.call('syncPick', false, ''); });
      on('sync', () => { m.close(); Sync.run(false); });
      on('off', () => { Native.call('syncClear'); m.close(); App.refresh(); UI.toast('Verbindung getrennt'); });
      on('auto', (b) => { t.autoSync = b.checked; save(); });
    },
  });
}

// Pinnwand
A['post-add'] = () => editPost();
A['post-open'] = (el) => {
  const x = S.team.posts.find((p) => p.id === el.dataset.id);
  if (!x) return;
  if (x.by === S.team.me) { editPost(x); return; }
  UI.open({
    title: x.title || 'Beitrag',
    body: `<div class="row mb">${memberAvatar(S.team.members.find((m) => m.id === x.by))}<div><b>${esc(teamMemberName(x.by))}</b><div class="muted small">${relTime(x.created || x.updatedAt)}</div></div></div><div class="post-text">${nl2br(x.text || '')}</div>`,
  });
};
function editPost(x) {
  const isNew = !x;
  UI.form({
    title: isNew ? 'Neuer Beitrag ans Kollegium' : 'Beitrag bearbeiten',
    fields: [
      { k: 'title', label: 'Überschrift', ph: 'z. B. Kopierer im 2. OG defekt' },
      { k: 'text', label: 'Text', type: 'textarea', rows: 6, req: true },
      { k: 'important', label: 'Wichtig', type: 'switch' },
      { k: 'pinned', label: 'Oben anheften', type: 'switch' },
    ],
    values: x || {},
    submit: isNew ? 'Veröffentlichen' : 'Speichern',
    onSave: (v) => {
      if (isNew) S.team.posts.push(Team.touch({ id: uid(), created: new Date().toISOString(), ...v }));
      else Object.assign(x, v, Team.touch({}));
      Team.changed(); App.refresh();
      UI.toast(isNew ? 'Veröffentlicht – wird beim nächsten Abgleich verteilt' : 'Gespeichert');
    },
    onDelete: isNew ? null : async () => {
      if (!(await UI.confirm('Beitrag für alle löschen?', { danger: true, ok: 'Löschen' }))) return false;
      S.team.posts = S.team.posts.filter((p) => p.id !== x.id); Team.markDeleted(x.id); Team.changed(); App.refresh();
    },
  });
}

// Kollegium
A['member-open'] = (el) => {
  const m = S.team.members.find((x) => x.id === el.dataset.id);
  if (!m) return;
  if (m.id === S.team.me) { editMember(m); return; }
  UI.open({
    title: [m.title, m.name].filter(Boolean).join(' '),
    body: `<div class="profile mb">${memberAvatar(m, 'lg')}<div><h2>${esc([m.title, m.name].filter(Boolean).join(' '))}</h2><div class="muted">${esc([m.short, m.role].filter(Boolean).join(' · '))}</div></div></div>
      <dl class="kv"><dt>Fächer</dt><dd>${esc(m.subjects || '–')}</dd>${m.classes ? `<dt>Klassenleitung</dt><dd>${esc(m.classes)}</dd>` : ''}<dt>E-Mail</dt><dd>${m.email ? `<a href="mailto:${esc(m.email)}">${esc(m.email)}</a>` : '–'}</dd><dt>Telefon</dt><dd>${m.phone ? `<a href="tel:${esc(m.phone.replace(/\s/g, ''))}">${esc(m.phone)}</a>` : '–'}</dd></dl>
      <div class="btn-row mt">${m.phone ? `<a class="btn btn-soft" href="tel:${esc(m.phone.replace(/\s/g, ''))}">${icon('phone')}Anrufen</a>` : ''}${m.email ? `<a class="btn btn-soft" href="mailto:${esc(m.email)}">${icon('mail')}E-Mail</a>` : ''}</div>`,
  });
};
function editMember(m) {
  UI.form({
    title: 'Mein Profil im Kollegium',
    fields: [
      { k: 'title', label: 'Anrede', type: 'select', half: true, opts: [{ v: '', l: '–' }, { v: 'Frau', l: 'Frau' }, { v: 'Herr', l: 'Herr' }] },
      { k: 'name', label: 'Name', req: true, half: true },
      { k: 'short', label: 'Kürzel', half: true, maxlength: 6 },
      { k: 'role', label: 'Funktion', type: 'select', half: true, opts: TEAM_ROLES.map((r) => ({ v: r, l: r })) },
      { k: 'subjects', label: 'Fächer' },
      { k: 'classes', label: 'Klassenleitung in', ph: 'z. B. 7a' },
      { k: 'email', label: 'Dienstliche E-Mail', type: 'email', half: true },
      { k: 'phone', label: 'Telefon', type: 'tel', half: true },
    ],
    values: m,
    onSave: (v) => { Object.assign(m, v, { short: (v.short || '').toUpperCase(), updatedAt: Date.now(), by: m.id }); Team.changed(); App.refresh(); },
  });
}

// Gemeinsame Termine
A['team-event-add'] = () => editEvent(null, { shared: true, type: 'konferenz' });

// Vertretungen
A['sub-add'] = () => editSub();
A['sub-edit'] = (el) => editSub(S.team.subs.find((x) => x.id === el.dataset.id));
function editSub(x) {
  const isNew = !x;
  const memberOpts = sortBy(S.team.members, (m) => m.name || '').map((m) => ({ v: m.id, l: teamMemberName(m.id) }));
  UI.form({
    title: isNew ? 'Vertretung eintragen' : 'Vertretung',
    fields: [
      { k: 'date', label: 'Datum', type: 'date', req: true, half: true },
      { k: 'period', label: 'Stunde', type: 'select', opts: periodOptions(), half: true },
      { k: 'className', label: 'Klasse', req: true, half: true, ph: 'z. B. 7b', list: 'dl-classes' },
      { k: 'subject', label: 'Fach', half: true, list: 'dl-subjects' },
      { k: 'absent', label: 'Abwesende Lehrkraft', type: 'select', opts: [{ v: '', l: '– wählen –' }, ...memberOpts] },
      { k: 'sub', label: 'Vertretung durch', type: 'select', opts: [{ v: '', l: '– noch offen –' }, ...memberOpts] },
      { k: 'room', label: 'Raum', half: true },
      { k: 'note', label: 'Hinweis', half: true, ph: 'z. B. Aufgaben im Fach' },
      { type: 'html', html: `<datalist id="dl-classes">${S.classes.map((c) => `<option value="${esc(c.name)}">`).join('')}</datalist><datalist id="dl-subjects">${S.subjects.map((s) => `<option value="${esc(s.name)}">`).join('')}</datalist>` },
    ],
    values: x || { date: today(), period: 0, absent: '', sub: '' },
    onSave: (v) => {
      v.period = Number(v.period);
      if (isNew) S.team.subs.push(Team.touch({ id: uid(), ...v }));
      else Object.assign(x, v, Team.touch({}));
      Team.changed(); App.refresh(); UI.toast('Gespeichert');
    },
    onDelete: isNew ? null : async () => {
      S.team.subs = S.team.subs.filter((y) => y.id !== x.id); Team.markDeleted(x.id); Team.changed(); App.refresh();
    },
    extraFoot: isNew ? '' : `<button class="btn btn-ghost" data-act="sub-take" data-id="${x.id}">${icon('user-check')}Ich übernehme</button>`,
  });
}
A['sub-take'] = (el) => {
  const x = S.team.subs.find((y) => y.id === el.dataset.id);
  x.sub = S.team.me; Team.touch(x); Team.changed(); UI.closeAll(); App.refresh(); UI.toast('Du übernimmst diese Vertretung');
};

// Klassenlisten
A['list-share'] = () => {
  const cl = activeClasses().filter((c) => studentsOf(c.id).length);
  if (!cl.length) { UI.toast('Du hast noch keine Klasse mit Schüler:innen'); return; }
  UI.form({
    title: 'Klassenliste teilen',
    fields: [
      { k: 'classId', label: 'Klasse', type: 'select', opts: cl.map((c) => ({ v: c.id, l: `${c.name} (${studentsOf(c.id).length})` })) },
      { k: 'contacts', label: 'Elternkontakte mitteilen', type: 'switch', hint: 'Namen, Telefon und E-Mail der Erziehungsberechtigten' },
      { k: 'tags', label: 'Merkmale mitteilen', type: 'switch', hint: 'z. B. LRS, Nachteilsausgleich – nur wenn erlaubt' },
      { type: 'html', html: `<div class="banner" style="margin:0">${icon('shield')}<div class="small">Geteilt werden nur Namen, Geburtstage und (optional) Kontakte. Noten, Fehlzeiten und Beobachtungen bleiben privat.</div></div>` },
    ],
    values: { contacts: true, tags: false },
    submit: 'Teilen',
    onSave: (v) => {
      const c = cls(v.classId);
      c.teamCid = c.teamCid || uid();
      const studs = studentsOf(c.id).map((s) => {
        s.teamSid = s.teamSid || s.id;
        const o = { id: s.teamSid, firstName: s.firstName, lastName: s.lastName, birthday: s.birthday || '', gender: s.gender || '' };
        if (v.contacts) Object.assign(o, { parentName: s.parentName || '', parentPhone: s.parentPhone || '', parentEmail: s.parentEmail || '', parent2Name: s.parent2Name || '', parent2Phone: s.parent2Phone || '' });
        if (v.tags) o.tags = s.tags || '';
        return o;
      });
      const existing = S.team.classes.find((x) => x.id === c.teamCid);
      const tc = Team.touch({ id: c.teamCid, name: c.name, students: studs, contacts: v.contacts });
      if (existing) Object.assign(existing, tc); else S.team.classes.push(tc);
      c.teamSync = tc.updatedAt;
      Team.changed(); App.refresh(); UI.toast(`Klassenliste ${c.name} geteilt`);
    },
  });
};
A['list-open'] = (el) => {
  const tc = S.team.classes.find((x) => x.id === el.dataset.id);
  UI.open({
    title: `Klassenliste ${tc.name}`,
    body: `<p class="muted small" style="margin-top:0">Geteilt von ${esc(teamMemberName(tc.by))} · ${relTime(tc.updatedAt)}</p><div class="list" style="margin:0 -18px">${sortBy(tc.students, (s) => (s.lastName || '').toLowerCase()).map((s) => `<div class="li">${UI.avatar(s, 'sm')}<div class="li-main"><div class="li-t">${esc(sNameRev(s))}</div>${s.parentPhone || s.parentEmail ? `<div class="li-s">${esc([s.parentName, s.parentPhone, s.parentEmail].filter(Boolean).join(' · '))}</div>` : ''}</div></div>`).join('')}</div>`,
    foot: tc.by === S.team.me ? `<button class="btn btn-ghost danger" data-x="unshare">${icon('x')}Nicht mehr teilen</button>` : `<span class="sp"></span><button class="btn btn-primary" data-x="adopt">${S.classes.some((c) => c.teamCid === tc.id) ? 'Aktualisieren' : 'Als Klasse übernehmen'}</button>`,
    onMount: (box, m) => {
      const u = box.querySelector('[data-x="unshare"]');
      if (u) u.addEventListener('click', () => { S.team.classes = S.team.classes.filter((x) => x.id !== tc.id); Team.markDeleted(tc.id); Team.changed(); m.close(); App.refresh(); });
      const a = box.querySelector('[data-x="adopt"]');
      if (a) a.addEventListener('click', () => { m.close(); adoptList(tc); });
    },
  });
};
A['list-adopt'] = (el) => adoptList(S.team.classes.find((x) => x.id === el.dataset.id));
async function adoptList(tc) {
  let c = S.classes.find((x) => x.teamCid === tc.id);
  if (!c) {
    const same = S.classes.find((x) => x.name.toLowerCase() === tc.name.toLowerCase());
    if (same) {
      const r = await UI.menu(`Klasse „${tc.name}"`, [
        { l: `In meine bestehende Klasse „${same.name}" übernehmen`, s: 'Gleiche Namen werden zusammengeführt', i: 'users', v: 'merge' },
        { l: 'Als neue Klasse anlegen', i: 'plus', v: 'new' },
      ]);
      if (!r) return;
      if (r === 'merge') c = same;
    }
    if (!c) c = upsert('classes', { name: tc.name, subjects: [], room: '', color: '', isOwn: false, gradeSystem: '', archived: false, catWeights: {}, notes: '' });
    c.teamCid = tc.id;
  }
  let added = 0, updated = 0;
  for (const ts of tc.students) {
    let s = S.students.find((x) => x.classId === c.id && x.teamSid === ts.id)
      || S.students.find((x) => x.classId === c.id && !x.teamSid && (x.firstName || '').toLowerCase() === (ts.firstName || '').toLowerCase() && (x.lastName || '').toLowerCase() === (ts.lastName || '').toLowerCase());
    const data = { ...ts };
    delete data.id;
    Object.keys(data).forEach((k) => { if (data[k] === '' || data[k] == null) delete data[k]; });
    if (s) { Object.assign(s, data, { teamSid: ts.id }); updated++; }
    else { S.students.push({ id: uid(), classId: c.id, teamSid: ts.id, notes: '', ...data }); added++; }
  }
  c.teamSync = tc.updatedAt;
  save();
  App.navigate('/class/' + c.id + '/students');
  UI.toast(`${c.name}: ${added} neu${updated ? `, ${updated} aktualisiert` : ''}`);
}

// Automatischer Abgleich
App.onTeamResume = () => {
  if (Team.on() && S.team.autoSync !== false && Sync.connected()) {
    const last = S.team.lastSync ? new Date(S.team.lastSync).getTime() : 0;
    if (Date.now() - last > 3 * 60000) Sync.run(true);
  }
};
