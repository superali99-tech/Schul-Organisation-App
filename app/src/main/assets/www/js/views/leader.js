/* Schulleitermodus: Anmeldung, digitale Unterschrift der Schulleitung, Cockpit, Jahresplanung,
   Kollegium verwalten, Abwesenheiten & Lesebestätigungen */
'use strict';

// Standard-Zugangsdaten: Name „Schulleitung", Passwort nur als salzter PBKDF2-Hash hinterlegt.
// Nach der ersten Anmeldung unter Einstellungen → Schulleitermodus ändern.
const LEADER_DEFAULT = { name: 'Schulleitung', salt: 'KkfeKUNPhfOZELfvJmttfw', hash: 'WZWt-yrJW43b_yHHSa6ZVSoACtw8iCnKNWwV8anxreI', iter: 150000 };

const ABS_KINDS = {
  krank: { l: 'Krank', i: 'thermometer', c: '#dc2626' },
  fortbildung: { l: 'Fortbildung', i: 'lightbulb', c: '#0891b2' },
  fahrt: { l: 'Klassenfahrt / Ausflug', i: 'bus', c: '#16a34a' },
  dienst: { l: 'Dienstlich unterwegs', i: 'briefcase', c: '#9333ea' },
  sonstiges: { l: 'Sonstiges', i: 'calendar', c: '#64748b' },
};

// ------------------------------------------------------------------ Digitale Unterschrift (ECDSA P-256)
const Sig = {
  canon(o) {
    if (typeof o === 'string') return o;
    const skip = new Set(['sig', 'team', 'remind']);
    const walk = (v) => {
      if (Array.isArray(v)) return v.map(walk);
      if (v && typeof v === 'object') {
        const out = {};
        Object.keys(v).sort().forEach((k) => { if (!skip.has(k) && k[0] !== '_' && v[k] !== undefined) out[k] = walk(v[k]); });
        return out;
      }
      return v;
    };
    return JSON.stringify(walk(o));
  },
  pubOnly(jwk) { return { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y }; },
  samePub(a, b) { return !!(a && b && a.x === b.x && a.y === b.y); },
  async genKeys() {
    const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
    return { priv: await crypto.subtle.exportKey('jwk', kp.privateKey), pub: Sig.pubOnly(await crypto.subtle.exportKey('jwk', kp.publicKey)) };
  },
  async sign(obj, privJwk) {
    const k = await crypto.subtle.importKey('jwk', privJwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
    return Codec.b64u(new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, k, Codec.enc.encode(Sig.canon(obj)))));
  },
  async verify(obj, sig, pubJwk) {
    if (!sig || !pubJwk) return false;
    try {
      const k = await crypto.subtle.importKey('jwk', Sig.pubOnly(pubJwk), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
      return await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, k, Codec.unb64u(sig), Codec.enc.encode(Sig.canon(obj)));
    } catch (e) { return false; }
  },
  // Kurzes Sicherheitsmerkmal zum Vergleichen (z. B. „K7QF-2MXA")
  async fingerprint(pub) {
    if (!pub) return '';
    const h = new Uint8Array(await crypto.subtle.digest('SHA-256', Codec.enc.encode(pub.x + '.' + pub.y)));
    const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let s = '';
    for (let i = 0; i < 8; i++) s += abc[h[i] % abc.length];
    return s.slice(0, 4) + '-' + s.slice(4);
  },
};

// ------------------------------------------------------------------ Schulleitermodus
const Leader = {
  fails: 0,
  blockedUntil: 0,
  conf() { if (!S.leader) S.leader = {}; return S.leader; },
  name() { return (S.leader && S.leader.name) || LEADER_DEFAULT.name; },
  active() { return !!(S.leader && S.leader.active); },
  usesDefault() { return !(S.leader && S.leader.hash); },
  async derive(pw, salt, iter) {
    const base = await crypto.subtle.importKey('raw', Codec.enc.encode(pw), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: Codec.unb64u(salt), iterations: iter, hash: 'SHA-256' }, base, 256);
    return Codec.b64u(new Uint8Array(bits));
  },
  async check(name, pw) {
    const ref = Leader.usesDefault() ? LEADER_DEFAULT : S.leader;
    const okName = String(name || '').trim().toLowerCase() === Leader.name().trim().toLowerCase();
    const h = await Leader.derive(String(pw || ''), ref.salt, ref.iter || 150000);
    let diff = h.length ^ ref.hash.length;
    for (let i = 0; i < Math.min(h.length, ref.hash.length); i++) diff |= h.charCodeAt(i) ^ ref.hash.charCodeAt(i);
    return okName && diff === 0;
  },
  async setCredentials(name, pw) {
    const salt = Codec.b64u(Codec.random(16));
    const iter = 150000;
    const hash = await Leader.derive(pw, salt, iter);
    Object.assign(Leader.conf(), { name: name.trim(), salt, iter, hash, changed: new Date().toISOString() });
    save();
  },
  login() { Object.assign(Leader.conf(), { active: true, since: new Date().toISOString() }); save(); applyLeaderClass(); },
  logout() { Leader.conf().active = false; save(); applyLeaderClass(); },

  // ---- Schulleitung im Kollegium
  teamKeys() { return Team.on() && S.leader && S.leader.keys ? S.leader.keys[S.team.id] : null; },
  teamLeader() { return Team.on() ? S.team.leader || null : null; },
  isTeamLeader() { const l = Leader.teamLeader(); return Leader.active() && !!l && l.member === S.team.me && !!Leader.teamKeys() && Sig.samePub(l.pub, Leader.teamKeys().pub); },
  handoverToMe() { const l = Leader.teamLeader(); return !!(l && l.handover && l.handover.to === S.team.me && l.member !== S.team.me); },
  canClaim() { return Leader.active() && Team.on() && (!Leader.teamLeader() || Leader.handoverToMe()); },
  leaderName() { const l = Leader.teamLeader(); return l ? teamMemberName(l.member) : ''; },
  async claim() {
    const t = S.team;
    const keys = await Sig.genKeys();
    Leader.conf().keys = { ...(S.leader.keys || {}), [t.id]: keys };
    const old = t.leader;
    const prev = old && old.handover && old.handover.to === t.me ? { pub: old.pub, at: old.handover.at, sig: old.handover.sig } : null;
    const rec = { member: t.me, name: teamMemberName(t.me), pub: keys.pub, since: new Date().toISOString(), updatedAt: Date.now(), handover: null, prev };
    rec.sig = await Sig.sign(rec, keys.priv);
    t.leader = rec;
    const me = Team.me();
    if (me && me.role !== 'Schulleitung') { me.role = 'Schulleitung'; me.updatedAt = Date.now(); }
    // Bestehenden Aufsichtsplan und Räume ab jetzt als Schulleitung unterschreiben
    for (const k of ['duties', 'rooms', 'jobs']) for (const x of (t[k] || [])) { x.official = true; Team.touch(x); await Leader.signItem(x); }
    Team.changed();
  },
  async handover(toId) {
    const t = S.team;
    const k = Leader.teamKeys();
    const at = Date.now();
    const rec = { ...t.leader, handover: { to: toId, at, sig: await Sig.sign(`handover:${toId}:${at}`, k.priv) }, updatedAt: at };
    delete rec.sig;
    rec.sig = await Sig.sign(rec, k.priv);
    t.leader = rec;
    Team.changed();
  },
  // Einträge der Schulleitung unterschreiben (auch wenn „offiziell" wieder abgeschaltet wurde)
  async signItem(obj) {
    const k = Leader.teamKeys();
    if (!k) return obj;
    delete obj.sig;
    obj.sig = await Sig.sign(obj, k.priv);
    return obj;
  },
  async signDelete(id) {
    const t = S.team;
    const k = Leader.teamKeys();
    const ts = Date.now();
    t.deleted[id] = ts;
    if (k) { t.delSig = t.delSig || {}; t.delSig[id] = await Sig.sign(`del:${id}:${ts}`, k.priv); }
  },
  async removeMember(id) {
    const t = S.team;
    const k = Leader.teamKeys();
    const at = Date.now();
    t.removed = t.removed || {};
    t.removed[id] = { at, sig: await Sig.sign(`remove:${id}:${at}`, k.priv) };
    t.members = t.members.filter((m) => m.id !== id);
    Team.changed();
  },

  // ---- Eingehende Team-Daten prüfen: nur echte Einträge der Schulleitung dürfen „offiziell" sein
  async verifyIncoming(d) {
    const t = S.team;
    d = { ...d };
    let leader = t.leader || null;
    const inc = d.leader;
    delete d.leader;
    if (inc && inc.pub && inc.member && await Sig.verify(inc, inc.sig, inc.pub)) {
      if (!leader) leader = inc;
      else if (Sig.samePub(leader.pub, inc.pub)) { if ((inc.updatedAt || 0) > (leader.updatedAt || 0)) leader = inc; }
      else if (inc.prev && Sig.samePub(inc.prev.pub, leader.pub) && await Sig.verify(`handover:${inc.member}:${inc.prev.at}`, inc.prev.sig, leader.pub)) leader = inc;
      if (leader !== t.leader) d.leader = leader;
    }
    const pub = leader && leader.pub;
    const ok = async (s, sig) => !!pub && Sig.verify(s, sig, pub);
    const localOf = { events: S.events.filter((e) => e.team === t.id), posts: t.posts, duties: t.duties || [], rooms: t.rooms || [], polls: t.polls || [], jobs: t.jobs || [] };
    for (const key of ['events', 'posts', 'duties', 'rooms', 'polls', 'jobs']) {
      if (!Array.isArray(d[key])) continue;
      const local = new Map(localOf[key].map((x) => [x.id, x]));
      // Aufsichtsplan und Räume legt allein die Schulleitung fest, sobald es eine gibt
      const strict = (key === 'duties' || key === 'rooms' || key === 'jobs') && !!pub;
      const out = [];
      for (const it of d[key]) {
        if (!it || !it.id) continue;
        const cur = local.get(it.id);
        if (!strict && !it.official && !(cur && cur.official)) { out.push(it); continue; }
        if (await ok(it, it.sig)) out.push(it);
      }
      d[key] = out;
    }
    if (d.school && (d.school.official || (t.school && t.school.official)) && !(await ok(d.school, d.school.sig))) delete d.school;
    // Löschungen offizieller Einträge nur mit Unterschrift der Schulleitung
    if (d.deleted) {
      const officialIds = new Set([...localOf.events, ...localOf.posts, ...localOf.polls].filter((x) => x.official).map((x) => x.id));
      if (pub) [...localOf.duties, ...localOf.rooms, ...localOf.jobs].forEach((x) => officialIds.add(x.id));
      const del = {};
      const sigs = {};
      for (const [id, ts] of Object.entries(d.deleted)) {
        if (!officialIds.has(id)) { del[id] = ts; continue; }
        const s = d.delSig && d.delSig[id];
        if (s && await ok(`del:${id}:${ts}`, s)) { del[id] = ts; sigs[id] = s; }
      }
      d.deleted = del;
      d.delSig = { ...sigs, ...Object.fromEntries(Object.entries(d.delSig || {}).filter(([id]) => !officialIds.has(id))) };
    }
    if (d.removed) {
      const rem = {};
      for (const [id, r] of Object.entries(d.removed)) if (r && await ok(`remove:${id}:${r.at}`, r.sig)) rem[id] = r;
      d.removed = rem;
    }
    return d;
  },
};

function applyLeaderClass() { document.body.classList.toggle('leader-mode', Leader.active()); }

// ------------------------------------------------------------------ Hilfen für Abwesenheiten & Mitteilungen
function teamMembersAlive() { return Team.on() ? S.team.members.filter((m) => !(S.team.removed || {})[m.id]) : []; }
function absencesOn(date) {
  if (!Team.on()) return [];
  return (S.team.absences || []).filter((a) => a.from <= date && date <= (a.to || a.from) && !(S.team.removed || {})[a.member]);
}
function absenceRange(a) { return a.to && a.to !== a.from ? `${fmtDS(a.from)}–${fmtDS(a.to)}` : fmtDW(a.from); }
function lessonCovered(a, l) {
  return S.team.subs.find((s) => s.date === l.date && Number(s.period) === Number(l.period) && s.absent === a.member && (s.className || '').toLowerCase() === (l.className || '').toLowerCase());
}
function absenceItem(a) {
  const k = ABS_KINDS[a.kind] || ABS_KINDS.sonstiges;
  const m = S.team.members.find((x) => x.id === a.member);
  const ls = a.lessons || [];
  const open = ls.filter((l) => l.date >= today() && !lessonCovered(a, l)).length;
  return `<div class="li" data-act="absence-open" data-id="${a.id}">${memberAvatar(m)}
    <div class="li-main"><div class="li-t">${esc(teamMemberName(a.member))}</div>
    <div class="li-s"><span style="color:${k.c}">${icon(k.i)}</span> ${esc(k.l)} · ${absenceRange(a)}${ls.length ? ` · ${plural(ls.length, 'Stunde', 'Stunden')}` : ''}</div></div>
    <div class="li-end">${open ? `<span class="badge red">${open} offen</span>` : ls.length ? `<span class="badge green">${icon('check')}versorgt</span>` : ''}</div></div>`;
}
function postAcks(p) { return (S.team.acks || []).filter((a) => a.post === p.id); }
function ackedByMe(p) { return postAcks(p).some((a) => a.by === S.team.me); }
function ackStats(p) {
  const others = teamMembersAlive().filter((m) => m.id !== p.by);
  const done = new Set(postAcks(p).map((a) => a.by));
  return { n: others.filter((m) => done.has(m.id)).length, total: others.length, missing: others.filter((m) => !done.has(m.id)) };
}
function unreadOfficial() {
  if (!Team.on()) return [];
  return S.team.posts.filter((p) => p.official && p.by !== S.team.me && (p.requireAck ? !ackedByMe(p) : (p.updatedAt || 0) > (S.team.seenPosts || 0)));
}

// ------------------------------------------------------------------ Anmeldung
App.def('/leader', () => {
  if (!Leader.active()) {
    return {
      title: 'Schulleitermodus', tab: 'more', icon: 'crown',
      html: `<div class="lead-login">
        <div class="lead-login-ic">${icon('crown')}</div>
        <h2>Schulleitermodus</h2>
        <p class="text2">Mehr Kontrolle für die Schulleitung: verbindliche Termine und Mitteilungen für das ganze Kollegium, Abwesenheiten, Vertretungen, Schulvorgaben und Jahresplanung.</p>
        <form class="form" onsubmit="return false" autocomplete="on">
          <label class="field"><span>Name</span><input id="lead-name" autocomplete="username" value="${esc(Leader.name())}"></label>
          <label class="field"><span>Passwort</span><input id="lead-pw" type="password" autocomplete="current-password" placeholder="Passwort"></label>
          <div id="lead-err" class="inv-err" hidden></div>
          <button type="submit" class="btn btn-primary btn-block btn-lg" data-act="leader-login">${icon('key')}Anmelden</button>
        </form>
        <p class="muted small center">Die Zugangsdaten änderst du nach der Anmeldung unter <b>Einstellungen → Schulleitermodus</b>.</p>
      </div>`,
      mount: (el) => {
        const pw = el.querySelector('#lead-pw');
        if (pw) setTimeout(() => pw.focus(), 250);
        el.querySelector('form').addEventListener('submit', () => A['leader-login']());
      },
    };
  }
  return { title: 'Schulleitung', sub: S.settings.school || '', tab: 'more', icon: 'crown', html: leaderCockpit(), actions: [{ icon: 'settings', nav: '/settings/leader', label: 'Schulleitermodus-Einstellungen' }] };
});

A['leader-login'] = async () => {
  const err = $('#lead-err');
  const show = (m) => { if (err) { err.hidden = false; err.innerHTML = `${icon('triangle-alert')} ${m}`; } };
  const wait = Leader.blockedUntil - Date.now();
  if (wait > 0) { show(`Zu viele Versuche – bitte ${Math.ceil(wait / 1000)} Sekunden warten.`); return; }
  const name = ($('#lead-name') || {}).value || '';
  const pw = ($('#lead-pw') || {}).value || '';
  if (!pw) { show('Bitte das Passwort eingeben.'); return; }
  const btn = $('[data-act="leader-login"]');
  if (btn) btn.disabled = true;
  const ok = await Leader.check(name, pw);
  if (btn) btn.disabled = false;
  if (!ok) {
    Leader.fails++;
    if (Leader.fails >= 3) Leader.blockedUntil = Date.now() + Math.min(60000, 2000 * 2 ** (Leader.fails - 3));
    show('Name oder Passwort stimmt nicht.');
    const p = $('#lead-pw'); if (p) { p.value = ''; p.focus(); }
    return;
  }
  Leader.fails = 0;
  Leader.login();
  App.refresh();
  UI.toast(Leader.usesDefault() ? 'Angemeldet – bitte ändere jetzt das Standard-Passwort' : 'Willkommen im Schulleitermodus', { ms: 4000 });
};
A['leader-logout'] = async () => {
  if (!(await UI.confirm('Schulleitermodus auf diesem Gerät beenden? Du kannst dich jederzeit wieder anmelden.', { ok: 'Abmelden' }))) return;
  Leader.logout();
  App.navigate('/today', { root: true });
  UI.toast('Abgemeldet – zurück im Lehrermodus');
};

// ------------------------------------------------------------------ Cockpit
function leaderCockpit() {
  const d = today();
  const dd = pd(d);
  const st = S.settings;
  const team = Team.on();
  const t = S.team;
  const members = teamMembersAlive();
  const absent = absencesOn(d);
  const openSubs = team ? t.subs.filter((x) => !x.sub && x.date >= d) : [];
  const upcoming = sortBy(S.events.filter((e) => e.team && team && e.team === t.id && (e.end || e.date) >= d && e.date <= addDays(d, 30)), 'date', 'time');
  const official = team ? sortBy(t.posts.filter((p) => p.official), (p) => -(p.updatedAt || 0)) : [];
  const stat = (ic, n, l, nav) => `<div ${nav ? `data-nav="${nav}"` : ''}><span class="ls-ic">${icon(ic)}</span><b>${n}</b><span>${l}</span></div>`;
  let h = `<div class="lead-hero">
    <div class="lead-top"><span class="lead-chip">${icon('crown')}Schulleitermodus</span><span class="sp"></span><button class="btn btn-glass btn-sm" data-act="leader-logout">${icon('log-out')}Abmelden</button></div>
    <div class="th-date">${WD[dow(d)]}, ${dd.getDate()}. ${MONTHS[dd.getMonth()]} · KW ${isoWeek(d)}</div>
    <h2>${greeting()}${teacherName() ? ', ' + esc(teacherName()) : ''}!</h2>
    <div class="th-sub">${esc(st.school || '')}${st.year ? ' · Schuljahr ' + esc(st.year) : ''}</div>
    <div class="lead-stats">
      ${stat('users', members.length, 'Kollegium', team ? '/leader/members' : '')}
      ${stat('thermometer', absent.length, 'heute abwesend', '')}
      ${stat('replace', openSubs.length, 'offene Vertretungen', team ? '/team/subs' : '')}
      ${stat('calendar', upcoming.length, 'Termine (30 Tage)', '/leader/year')}
    </div>
  </div>`;

  if (Leader.usesDefault()) h += `<div class="banner warn" data-nav="/settings/leader">${icon('key')}<div><b>Standard-Passwort aktiv</b><br><span class="text2">Lege jetzt eigene Zugangsdaten fest, damit nur du den Schulleitermodus öffnen kannst.</span></div></div>`;
  if (!team) {
    h += `<div class="banner">${icon('users')}<div><b>Noch kein Schulteam</b><br><span class="text2">Gründe das Schulteam und lade das Kollegium ein. Danach erreichen deine Termine, Mitteilungen und Schulvorgaben alle Lehrkräfte.</span><div class="btn-row mt"><button class="btn btn-sm btn-primary" data-act="team-create">${icon('plus')}Schulteam gründen</button><button class="btn btn-sm" data-act="team-accept">${icon('scan-line')}Einladung annehmen</button></div></div></div>`;
  } else if (Leader.canClaim()) {
    h += `<div class="banner lead-banner">${icon('crown')}<div><b>${Leader.handoverToMe() ? 'Dir wurde die Schulleitung übergeben' : 'Als Schulleitung im Kollegium eintragen'}</b><br><span class="text2">Danach sind deine Termine, Mitteilungen und Schulvorgaben digital unterschrieben: Nur du kannst sie ändern oder löschen, und niemand kann sie fälschen.</span><div class="btn-row mt"><button class="btn btn-sm btn-primary" data-act="leader-claim">${icon('shield-check')}${Leader.handoverToMe() ? 'Schulleitung übernehmen' : 'Jetzt eintragen'}</button></div></div></div>`;
  } else if (!Leader.isTeamLeader()) {
    h += `<div class="banner warn">${icon('shield')}<div><b>${esc(Leader.leaderName())} ist im Kollegium als Schulleitung eingetragen.</b><br><span class="text2">Verbindliche Einträge kann nur das Gerät der eingetragenen Schulleitung unterschreiben. Eine Übergabe startet die bisherige Schulleitung im Cockpit.</span></div></div>`;
  }

  const qa = (act, ic, label, c, extra = '') => `<button class="tile" ${act.startsWith('/') ? `data-nav="${act}"` : `data-act="${act}"`} ${extra} style="--tc:${c};--tc-soft:${rgba(c, .13)}"><span class="tile-ic">${icon(ic)}</span>${label}</button>`;
  h += `<div class="section-title">${icon('zap')}Schnellaktionen</div><div class="tiles">
    ${qa('lead-event', 'calendar-plus', 'Termin für alle', '#4f46e5')}
    ${qa('lead-post', 'megaphone', 'Mitteilung an alle', '#db2777')}
    ${qa('lead-holiday', 'umbrella', 'Ferien & freie Tage', '#0d9488')}
    ${qa('lead-sub', 'replace', 'Vertretung planen', '#9333ea')}
    ${qa('lead-absence', 'thermometer', 'Abwesenheit eintragen', '#dc2626')}
    ${qa('lead-school', 'school', 'Schulvorgaben', '#ca8a04')}
    ${qa(team ? '/team/duties' : 'team-create', 'eye', 'Aufsichtsplan', '#0d9488')}
    ${qa(team ? 'job-add' : 'team-create', 'clipboard-check', 'Auftrag erteilen', '#ea580c')}
    ${qa(team ? 'poll-add' : 'team-create', 'chart-column', 'Umfrage starten', '#7c3aed')}
    ${qa(team ? '/team/rooms' : 'team-create', 'door-open', 'Räume', '#0369a1')}
    ${qa(team ? '/leader/stats' : 'team-create', 'gauge', 'Statistik', '#e11d48')}
    ${qa('/leader/year', 'calendar-range', 'Jahresplanung', '#2563eb')}
    ${qa(team ? '/leader/members' : 'team-create', 'users', 'Kollegium verwalten', '#0891b2')}
    ${team ? qa('team-invite', 'user-plus', 'Einladen', '#16a34a') : ''}
  </div>`;

  if (team) {
    h += `<div class="section-title">${icon('thermometer')}Heute abwesend</div>`;
    h += absent.length ? `<div class="card pad0"><div class="list">${absent.map(absenceItem).join('')}</div></div>` : `<div class="card"><p class="muted small" style="margin:0">${icon('circle-check')} Heute sind alle da – keine Abwesenheit gemeldet.</p></div>`;
    const later = sortBy((t.absences || []).filter((a) => a.from > d && !(t.removed || {})[a.member]), 'from').slice(0, 5);
    if (later.length) h += `<div class="section-title">${icon('calendar-clock')}Demnächst abwesend</div><div class="card pad0"><div class="list">${later.map(absenceItem).join('')}</div></div>`;
    const uncovered = dutiesOn(d).filter((x) => absent.some((a) => a.member === x.member));
    if (uncovered.length) h += `<div class="section-title">${icon('eye')}Aufsichten ohne Lehrkraft</div><div class="card pad0"><div class="list">${uncovered.map((x) => `<div class="li"><div class="li-ic" style="background:rgba(220,38,38,.12);color:#dc2626">${icon('eye')}</div><div class="li-main"><div class="li-t">${esc(x.slot || 'Aufsicht')} · ${esc(x.start)}–${esc(x.end)}</div><div class="li-s">${esc(x.place || '')} · ${esc(teamMemberName(x.member))} ist abwesend</div></div><div class="li-end"><button class="btn btn-sm btn-primary" data-act="duty-cover" data-id="${x.id}">Vertreten</button></div></div>`).join('')}</div></div>`;
    const myJobs = sortBy((t.jobs || []).filter((j) => j.by === t.me && jobStats(j).open.length), (j) => j.due || '9999');
    if (myJobs.length) h += `<div class="section-title">${icon('clipboard-check')}Offene Aufträge</div><div class="card pad0"><div class="list">${myJobs.slice(0, 8).map(jobItem).join('')}</div></div>`;
    const openPolls = (t.polls || []).filter((p) => pollOpen(p) && p.by === t.me);
    if (openPolls.length) h += `<div class="section-title">${icon('chart-column')}Deine laufenden Umfragen</div><div class="card pad0"><div class="list">${openPolls.map(pollItem).join('')}</div></div>`;
    if (openSubs.length) h += `<div class="section-title">${icon('replace')}Offene Vertretungen</div><div class="card pad0"><div class="list">${sortBy(openSubs, 'date', (x) => Number(x.period)).slice(0, 8).map(subItem).join('')}</div></div>`;
    h += `<div class="section-title">${icon('megaphone')}Mitteilungen der Schulleitung</div>`;
    h += official.length ? `<div class="card pad0"><div class="list">${official.slice(0, 6).map((p) => {
      const s = ackStats(p);
      return `<div class="li" data-act="post-open" data-id="${p.id}"><div class="li-ic lead-ic">${icon('megaphone')}</div><div class="li-main"><div class="li-t">${esc(p.title || (p.text || '').slice(0, 60))}</div><div class="li-s">${relTime(p.created || p.updatedAt)}${p.requireAck ? ` · gelesen von ${s.n} / ${s.total}` : ''}</div></div>${p.requireAck ? `<div class="li-end"><span class="badge ${s.n >= s.total ? 'green' : 'acc'}">${s.total ? Math.round((s.n * 100) / s.total) : 100} %</span></div>` : ''}</div>`;
    }).join('')}</div></div>` : `<div class="card"><p class="muted small" style="margin:0">Noch keine Mitteilungen. Über „Mitteilung an alle" erreichst du das ganze Kollegium – auf Wunsch mit Lesebestätigung.</p></div>`;
  }
  h += `<div class="section-title">${icon('calendar')}Nächste Schultermine</div>`;
  h += upcoming.length ? `<div class="card pad0"><div class="list">${upcoming.slice(0, 8).map(eventItem).join('')}</div></div>` : `<div class="card"><p class="muted small" style="margin:0">Keine gemeinsamen Termine in den nächsten 30 Tagen.</p></div>`;
  return h;
}

A['leader-claim'] = async () => {
  if (!Leader.canClaim()) return;
  const msg = Leader.handoverToMe()
    ? 'Die Schulleitung im Kollegium übernehmen? Ab jetzt unterschreibt dieses Gerät die verbindlichen Einträge.'
    : `Dich im Team „${esc(S.team.name)}" als Schulleitung eintragen? Dieses Gerät erhält eine digitale Unterschrift. Es kann immer nur eine Schulleitung geben – eine spätere Übergabe startest du hier im Cockpit.`;
  if (!(await UI.confirm(msg, { ok: 'Eintragen' }))) return;
  await Leader.claim();
  App.refresh();
  UI.toast('Du bist jetzt als Schulleitung eingetragen – wird beim nächsten Abgleich an alle verteilt', { ms: 4500 });
};

function requireTeamLeader() {
  if (!Team.on()) { UI.toast('Gründe zuerst ein Schulteam oder tritt einem bei', { type: 'err' }); return false; }
  if (!Leader.isTeamLeader()) { UI.toast(Leader.canClaim() ? 'Trage dich zuerst als Schulleitung ein (Banner oben)' : 'Nur die eingetragene Schulleitung kann das', { type: 'err', ms: 4000 }); return false; }
  return true;
}
A['lead-event'] = () => { if (requireTeamLeader()) editEvent(null, { shared: true, official: true, type: 'konferenz' }); };
A['lead-holiday'] = () => { if (requireTeamLeader()) editEvent(null, { shared: true, official: true, type: 'ferien' }); };
A['lead-post'] = () => { if (requireTeamLeader()) editPost(null, { official: true, requireAck: true, pinned: true }); };
A['lead-sub'] = () => { if (Team.on()) editSub(); else UI.toast('Gründe zuerst ein Schulteam', { type: 'err' }); };
A['lead-absence'] = () => { if (Team.on()) editAbsence(null, { member: '' }); else UI.toast('Gründe zuerst ein Schulteam', { type: 'err' }); };
A['lead-school'] = async () => {
  if (!requireTeamLeader()) return;
  const st = S.settings;
  if (!(await UI.confirm(`Deine Einstellungen als <b>verbindliche Schulvorgaben</b> an alle verteilen?<br><br>Schuljahr ${esc(st.year)} · ${st.periods.length} Stunden · ${st.days} Tage${st.abWeeks ? ' · A/B-Wochen' : ''} · ${plural(S.subjects.length, 'Fach', 'Fächer')}.<br><br>Die Geräte im Kollegium übernehmen sie beim nächsten Abgleich automatisch. Ferien legst du über „Ferien & freie Tage" fest.`, { ok: 'Verteilen' }))) return;
  const sc = Team.schoolSnapshot();
  sc.official = true;
  S.team.school = await Leader.signItem(sc);
  S.team.schoolApplied = sc.updatedAt;
  Team.changed();
  UI.toast('Schulvorgaben werden beim nächsten Abgleich an alle verteilt');
};

// ------------------------------------------------------------------ Jahresplanung
App.def('/leader/year', () => {
  const st = S.settings;
  const from = st.yearStart || today();
  const to = st.yearEnd || addDays(today(), 365);
  const list = sortBy(S.events.filter((e) => (e.team || e.type === 'ferien' || e.type === 'feiertag') && (e.end || e.date) >= from && e.date <= to), 'date', 'time');
  const byMonth = new Map();
  list.forEach((e) => { const k = e.date.slice(0, 7); if (!byMonth.has(k)) byMonth.set(k, []); byMonth.get(k).push(e); });
  const counts = {};
  list.forEach((e) => { counts[e.type] = (counts[e.type] || 0) + 1; });
  let h = `<div class="card"><div class="row" style="gap:12px;align-items:flex-start"><div class="li-ic lead-ic">${icon('calendar-range')}</div><div class="sp"><b>Schuljahr ${esc(st.year || '')}</b><div class="muted small">${fmtD(from)} – ${fmtD(to)} · ${plural(list.length, 'Termin', 'Termine')}</div>
    <div class="row row-wrap mt" style="gap:6px">${Object.entries(counts).map(([k, n]) => { const t = EVENT_TYPES[k] || EVENT_TYPES.termin; return `<span class="badge" style="background:${rgba(t.c, .12)};color:${t.c}">${n}× ${esc(t.l)}</span>`; }).join('')}</div></div></div>
    <div class="btn-row mt"><button class="btn btn-soft" data-act="export-ics">${icon('download')}Als Kalenderdatei (.ics)</button>${Leader.isTeamLeader() ? `<button class="btn btn-soft" data-act="lead-holiday">${icon('umbrella')}Ferien</button>` : ''}</div></div>`;
  if (!list.length) h += UI.empty('calendar-range', 'Noch keine Schultermine in diesem Schuljahr. Plane Konferenzen, Elternsprechtage, Ferien und Fristen – sie erscheinen bei allen im Kalender.');
  for (const [k, items] of byMonth) {
    const [y, m] = k.split('-').map(Number);
    h += `<div class="section-title">${MONTHS[m - 1]} ${y}</div><div class="card pad0"><div class="list">${items.map((e) => eventItem(e).replace('<div class="li-end">', `<div class="li-end"><span class="badge">${fmtDS(e.date)}</span>`)).join('')}</div></div>`;
  }
  return { title: 'Jahresplanung', sub: st.year ? 'Schuljahr ' + st.year : '', tab: 'more', html: h, fab: Leader.isTeamLeader() ? { act: 'lead-event', label: 'Termin' } : null };
});

// ------------------------------------------------------------------ Kollegium verwalten
App.def('/leader/members', () => {
  if (!Team.on()) return { title: 'Kollegium verwalten', tab: 'more', html: UI.empty('users', 'Noch kein Schulteam.', `<button class="btn btn-primary" data-act="team-create">${icon('plus')}Schulteam gründen</button>`) };
  const t = S.team;
  const lead = Leader.teamLeader();
  const yearStart = S.settings.yearStart || '0000';
  const officialAck = t.posts.filter((p) => p.official && p.requireAck);
  const list = sortBy(teamMembersAlive(), (m) => (lead && m.id === lead.member ? 0 : 1), (m) => (m.name || '').toLowerCase());
  const roles = {};
  list.forEach((m) => { roles[m.role || 'Lehrkraft'] = (roles[m.role || 'Lehrkraft'] || 0) + 1; });
  let h = `<div class="card"><div class="row row-wrap" style="gap:6px">${Object.entries(roles).map(([r, n]) => `<span class="badge acc">${n}× ${esc(r)}</span>`).join('')}</div>
    ${lead ? `<p class="muted small" style="margin:10px 0 0">${icon('crown')} Schulleitung: <b>${esc(teamMemberName(lead.member))}</b> · Sicherheitsmerkmal <code id="lead-fp">…</code></p>` : `<p class="muted small" style="margin:10px 0 0">Noch keine Schulleitung eingetragen.</p>`}</div>`;
  h += `<div class="card pad0"><div class="list">${list.map((m) => {
    const abs = (t.absences || []).filter((a) => a.member === m.id && a.from >= yearStart).length;
    const acks = officialAck.filter((p) => p.by !== m.id);
    const read = acks.filter((p) => postAcks(p).some((a) => a.by === m.id)).length;
    const isLead = lead && m.id === lead.member;
    return `<div class="li" data-act="lead-member" data-id="${m.id}">${memberAvatar(m)}<div class="li-main"><div class="li-t">${esc([m.title, m.name].filter(Boolean).join(' '))}${isLead ? ` <span class="badge lead">${icon('crown')}Schulleitung</span>` : ''}${m.id === t.me ? ' <span class="badge acc">Du</span>' : ''}</div>
      <div class="li-s">${esc([m.short, m.role, m.subjects].filter(Boolean).join(' · '))}</div>
      <div class="li-s">${abs ? `${plural(abs, 'Abwesenheit', 'Abwesenheiten')} im Schuljahr` : 'Keine Abwesenheit'}${acks.length ? ` · ${read}/${acks.length} Mitteilungen bestätigt` : ''}</div></div>${icon('chevron-right', 'chev')}</div>`;
  }).join('')}</div></div>
  <button class="btn btn-block btn-soft mt" data-act="team-invite">${icon('user-plus')}Kolleg:innen einladen</button>`;
  return {
    title: 'Kollegium verwalten', sub: plural(list.length, 'Mitglied', 'Mitglieder'), tab: 'more', html: h,
    mount: (el) => { const fp = el.querySelector('#lead-fp'); if (fp && lead) Sig.fingerprint(lead.pub).then((x) => { fp.textContent = x; }); },
  };
});
A['lead-member'] = async (el) => {
  const t = S.team;
  const m = t.members.find((x) => x.id === el.dataset.id);
  if (!m) return;
  const isMe = m.id === t.me;
  const leader = Leader.isTeamLeader();
  const r = await UI.menu(teamMemberName(m.id), [
    { l: 'Profil ansehen', i: 'user', v: 'profile' },
    { l: 'Abwesenheit eintragen', i: 'thermometer', v: 'absence' },
    { l: 'Vertretung für diese Person planen', i: 'replace', v: 'sub' },
    leader && !isMe ? { sep: true } : null,
    leader && !isMe ? { l: 'Schulleitung übergeben', i: 'crown', s: 'Die Person übernimmt danach im eigenen Schulleitermodus', v: 'handover' } : null,
    leader && !isMe ? { l: 'Aus dem Kollegium entfernen', i: 'user-minus', danger: true, v: 'remove' } : null,
  ].filter(Boolean));
  if (r === 'profile') A['member-open']({ dataset: { id: m.id } });
  if (r === 'absence') editAbsence(null, { member: m.id });
  if (r === 'sub') editSub(null, { absent: m.id });
  if (r === 'handover') {
    if (!(await UI.confirm(`Die Schulleitung an <b>${esc(teamMemberName(m.id))}</b> übergeben? Die Person muss danach in ihrem Schulleitermodus „Schulleitung übernehmen" tippen. Bis dahin bleibst du Schulleitung.`, { ok: 'Übergeben' }))) return;
    await Leader.handover(m.id); App.refresh(); UI.toast('Übergabe vorbereitet – wird beim nächsten Abgleich verteilt');
  }
  if (r === 'remove') {
    if (!(await UI.confirm(`<b>${esc(teamMemberName(m.id))}</b> aus dem Kollegium entfernen? Die Person verschwindet auf allen Geräten aus der Mitgliederliste. Entziehe ihr zusätzlich den Zugriff auf die gemeinsame Cloud-Datei, damit sie keine neuen Team-Daten mehr bekommt.`, { danger: true, ok: 'Entfernen' }))) return;
    await Leader.removeMember(m.id); App.refresh(); UI.toast('Entfernt – wird beim nächsten Abgleich verteilt');
  }
};

// ------------------------------------------------------------------ Abwesenheit melden
function lessonsBetween(from, to) {
  const out = [];
  let d = from;
  for (let i = 0; i < 31 && d <= to; i++, d = addDays(d, 1)) {
    lessonsOn(d).filter((l) => !l.cancelled && !l.holiday).forEach((l) => {
      out.push({ date: d, period: l.period, className: cName(l.classId) || '', subject: (subj(l.subjectId) || {}).name || '', room: l.roomChange || l.room || (cls(l.classId) || {}).room || '' });
    });
  }
  return out;
}
function editAbsence(a, preset = {}) {
  const t = S.team;
  const isNew = !a;
  const leader = Leader.isTeamLeader();
  const memberOpts = sortBy(teamMembersAlive(), (m) => m.name || '').map((m) => ({ v: m.id, l: teamMemberName(m.id) + (m.id === t.me ? ' (ich)' : '') }));
  const forOther = leader || (a && a.member !== t.me) || (preset.member !== undefined && preset.member !== t.me);
  UI.form({
    title: isNew ? 'Abwesenheit melden' : 'Abwesenheit',
    fields: [
      forOther ? { k: 'member', label: 'Wer fehlt?', type: 'select', req: true, opts: [{ v: '', l: '– wählen –' }, ...memberOpts] } : null,
      { k: 'kind', label: 'Grund', type: 'chips', opts: Object.entries(ABS_KINDS).map(([v, k]) => ({ v, l: k.l, i: k.i })) },
      { k: 'from', label: 'Von', type: 'date', req: true, half: true },
      { k: 'to', label: 'Bis', type: 'date', half: true },
      { k: 'note', label: 'Hinweis für die Vertretung', type: 'textarea', rows: 3, ph: 'z. B. Aufgaben für 7b liegen im Fach, Klassenarbeit verschieben …' },
      { type: 'html', html: `<p class="muted small" style="margin:0">${icon('info')} Der Grund ist nur für das Kollegium sichtbar. Bei eigener Abwesenheit werden deine betroffenen Stunden aus deinem Stundenplan automatisch für die Vertretungsplanung mitgeschickt.</p>` },
    ],
    values: a || { member: preset.member === '' ? '' : (preset.member || t.me), kind: 'krank', from: today(), to: today(), note: '' },
    submit: isNew ? 'Melden' : 'Speichern',
    onSave: (v) => {
      const member = forOther ? v.member : (a ? a.member : t.me);
      if (!member) { UI.toast('Bitte auswählen, wer fehlt', { type: 'err' }); return false; }
      if (v.to && v.to < v.from) { UI.toast('„Bis" liegt vor „Von"', { type: 'err' }); return false; }
      const to = v.to || v.from;
      if (daysBetween(v.from, to) > 30) { UI.toast('Bitte höchstens 31 Tage am Stück melden', { type: 'err' }); return false; }
      const lessons = member === t.me ? lessonsBetween(v.from, to) : (a && a.member === member ? a.lessons || [] : []);
      const obj = { ...(a || { id: uid(), created: new Date().toISOString() }), member, kind: v.kind || 'sonstiges', from: v.from, to, note: v.note || '', lessons };
      Team.touch(obj);
      t.absences = t.absences || [];
      const i = t.absences.findIndex((x) => x.id === obj.id);
      if (i >= 0) t.absences[i] = obj; else t.absences.push(obj);
      Team.changed(); App.refresh();
      const msg = member === t.me
        ? `Gemeldet${lessons.length ? ` – ${plural(lessons.length, 'Stunde geht', 'Stunden gehen')} an die Vertretungsplanung` : ''}.${v.kind === 'krank' ? ' Gute Besserung!' : ''}`
        : 'Abwesenheit eingetragen';
      UI.toast(msg, { ms: 4000 });
    },
    onDelete: isNew || !(a.by === t.me || a.member === t.me || leader) ? null : async () => {
      if (!(await UI.confirm('Diese Abwesenheit für alle löschen?', { danger: true, ok: 'Löschen' }))) return false;
      t.absences = t.absences.filter((x) => x.id !== a.id); Team.markDeleted(a.id); Team.changed(); App.refresh();
    },
  });
}
A['absence-add'] = () => { if (Team.on()) editAbsence(); };
A['absence-open'] = (el) => {
  const t = S.team;
  const a = (t.absences || []).find((x) => x.id === el.dataset.id);
  if (!a) return;
  const k = ABS_KINDS[a.kind] || ABS_KINDS.sonstiges;
  const ls = sortBy(a.lessons || [], 'date', (l) => Number(l.period));
  const canEdit = a.by === t.me || a.member === t.me || Leader.isTeamLeader();
  UI.open({
    title: teamMemberName(a.member),
    body: `<div class="row mb" style="gap:12px">${memberAvatar(t.members.find((m) => m.id === a.member), 'lg')}<div><b>${esc(k.l)}</b><div class="muted small">${absenceRange(a)}${a.by !== a.member ? ` · eingetragen von ${esc(teamMemberName(a.by, true))}` : ''}</div></div></div>
      ${a.note ? `<div class="banner">${icon('message-square-text')}<div>${nl2br(a.note)}</div></div>` : ''}
      <div class="f-section">${icon('replace')}Betroffene Stunden</div>
      ${ls.length ? `<div class="list">${ls.map((l, i) => {
        const cov = lessonCovered(a, l);
        return `<div class="li"><div class="li-ic" style="flex-direction:column;line-height:1.05;font-size:.72rem">${fmtDS(l.date)}<small>${Number(l.period) + 1}.</small></div><div class="li-main"><div class="li-t">${esc(l.className || 'Klasse ?')}${l.subject ? ' · ' + esc(l.subject) : ''}</div><div class="li-s">${l.room ? 'Raum ' + esc(l.room) + ' · ' : ''}${cov ? (cov.sub ? 'Vertretung: ' + esc(teamMemberName(cov.sub, true)) : 'Vertretung offen') : 'noch nicht geplant'}</div></div>
        <div class="li-end">${cov && cov.sub ? `<span class="badge green">${icon('check')}</span>` : `<button class="btn btn-sm btn-soft" data-x="plan" data-i="${i}">${cov ? 'Zuweisen' : 'Planen'}</button>`}</div></div>`;
      }).join('')}</div>` : `<p class="muted small">Keine Stunden übermittelt${a.member !== t.me ? ' – die Lehrkraft kann die Abwesenheit selbst melden, dann kommen ihre Stunden automatisch mit. Vertretungen kannst du auch direkt eintragen.' : '.'}</p>`}
      <div class="btn-row mt"><button class="btn btn-soft" data-x="sub">${icon('plus')}Vertretung eintragen</button>${canEdit ? `<button class="btn" data-x="edit">${icon('pencil')}Bearbeiten</button>` : ''}</div>`,
    onMount: (box, m) => {
      box.querySelectorAll('[data-x="plan"]').forEach((b) => b.addEventListener('click', () => {
        const l = ls[Number(b.dataset.i)];
        const cov = lessonCovered(a, l);
        m.close();
        if (cov) editSub(cov); else editSub(null, { date: l.date, period: Number(l.period), className: l.className, subject: l.subject, room: l.room, absent: a.member, note: a.note ? a.note.slice(0, 80) : '' });
      }));
      const s = box.querySelector('[data-x="sub"]'); if (s) s.addEventListener('click', () => { m.close(); editSub(null, { date: a.from >= today() ? a.from : today(), absent: a.member }); });
      const e = box.querySelector('[data-x="edit"]'); if (e) e.addEventListener('click', () => { m.close(); editAbsence(a); });
    },
  });
};

// ------------------------------------------------------------------ Einstellungen
App.def('/settings/leader', () => {
  const active = Leader.active();
  const team = Team.on();
  const lead = Leader.teamLeader();
  const h = `<div class="lead-set-hero ${active ? 'on' : ''}"><div class="lead-login-ic">${icon('crown')}</div><div class="sp"><b>${active ? 'Angemeldet als ' + esc(Leader.name()) : 'Nicht angemeldet'}</b><span>${active ? 'Schulleitermodus ist auf diesem Gerät aktiv' : 'Lehrermodus – melde dich an, um den Schulleitermodus zu öffnen'}</span></div></div>
    <div class="card pad0"><div class="list">
      ${active ? setItem('crown', 'Schulleitungs-Cockpit öffnen', 'Überblick, Termine, Abwesenheiten, Vertretungen', 'data-nav="/leader"') : setItem('key', 'Anmelden', 'Name und Passwort eingeben', 'data-nav="/leader"')}
      ${active ? setItem('user', 'Zugangsdaten ändern', `Name: ${Leader.name()} · ${Leader.usesDefault() ? 'Standard-Passwort – bitte ändern!' : 'eigenes Passwort'}`, 'data-act="lead-cred"') : ''}
      ${active ? setItem('log-out', 'Abmelden', 'Zurück in den Lehrermodus', 'data-act="leader-logout"') : ''}
    </div></div>
    ${active ? `<div class="section-title">Schulleitung im Kollegium</div><div class="card">${!team ? `<p class="muted small" style="margin:0">Noch kein Schulteam. Gründe es im Cockpit oder unter Mehr → Kollegium.</p>`
      : lead ? `<p style="margin:0">${icon('crown')} <b>${esc(teamMemberName(lead.member))}</b>${Leader.isTeamLeader() ? ' (du)' : ''} ist im Team „${esc(S.team.name)}" als Schulleitung eingetragen.</p><p class="muted small">Sicherheitsmerkmal: <code id="lead-fp">…</code> – auf allen Geräten gleich. So prüft das Kollegium, dass Einträge wirklich von der Schulleitung stammen.</p>${Leader.canClaim() ? `<button class="btn btn-primary mt" data-act="leader-claim">${icon('crown')}Schulleitung übernehmen</button>` : ''}`
      : `<p class="muted small" style="margin:0 0 10px">Im Team „${esc(S.team.name)}" ist noch keine Schulleitung eingetragen.</p><button class="btn btn-primary" data-act="leader-claim">${icon('shield-check')}Als Schulleitung eintragen</button>`}</div>` : ''}
    <div class="card"><p class="muted small" style="margin:0">${icon('info')} Die Zugangsdaten gelten für dieses Gerät und werden nur verschlüsselt (als Prüfwert) gespeichert. Verbindliche Einträge im Kollegium unterschreibt das Gerät der eingetragenen Schulleitung digital – andere Geräte können sie weder ändern noch fälschen.</p></div>`;
  return {
    title: 'Schulleitermodus', tab: 'more', html: h,
    mount: (el) => { const fp = el.querySelector('#lead-fp'); if (fp && lead) Sig.fingerprint(lead.pub).then((x) => { fp.textContent = x; }); },
  };
});
A['lead-cred'] = () => UI.form({
  title: 'Zugangsdaten ändern',
  fields: [
    { k: 'old', label: 'Aktuelles Passwort', type: 'password', req: true },
    { type: 'section', label: 'Neue Zugangsdaten', i: 'key' },
    { k: 'name', label: 'Name', req: true, hint: 'Wird bei der Anmeldung abgefragt' },
    { k: 'p1', label: 'Neues Passwort', type: 'password', req: true, hint: 'Mindestens 6 Zeichen' },
    { k: 'p2', label: 'Neues Passwort wiederholen', type: 'password', req: true },
  ],
  values: { name: Leader.name() },
  submit: 'Ändern',
  onSave: async (v) => {
    if (!(await Leader.check(Leader.name(), v.old))) { UI.toast('Das aktuelle Passwort stimmt nicht', { type: 'err' }); return false; }
    if (!(v.name || '').trim()) { UI.toast('Bitte einen Namen eingeben', { type: 'err' }); return false; }
    if ((v.p1 || '').length < 6) { UI.toast('Das neue Passwort braucht mindestens 6 Zeichen', { type: 'err' }); return false; }
    if (v.p1 !== v.p2) { UI.toast('Die neuen Passwörter stimmen nicht überein', { type: 'err' }); return false; }
    await Leader.setCredentials(v.name, v.p1);
    App.refresh();
    UI.toast('Zugangsdaten geändert – gut merken!');
  },
});
