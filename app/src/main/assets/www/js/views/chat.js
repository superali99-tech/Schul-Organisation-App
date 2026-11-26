/* Kollegium-Chat: Ende-zu-Ende verschlüsselt (pro Mitglied ein ECDH-Schlüssel), Einzel- und Gruppenchats,
   Emojis, Reaktionen, Bilder, Sprachnachrichten, Storys (24 h), Anrufen und Videoanruf-Link.
   Zustellung über den Team-Abgleich (Cloud-Datei oder Team-Datei) – ohne eigenen Server. */
'use strict';

const CHAT_KEEP_DAYS = 30;
const STORY_MS = 24 * 3600 * 1000;
const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];
const EMOJI_SETS = {
  'Smileys': '😀 😃 😄 😁 😆 😅 🤣 😂 🙂 😉 😊 😇 🥰 😍 🤩 😘 😋 😜 🤪 🤗 🤭 🤫 🤔 🤐 😐 😑 😶 🙄 😏 😬 😌 😔 😪 😴 😷 🤒 🥳 😎 🤓 🧐 😕 😟 🙁 😮 😲 😳 🥺 😢 😭 😱 😤 😡 🤯 😵 🥱'.split(' '),
  'Gesten': '👍 👎 👌 ✌️ 🤞 🤟 🤙 👋 👏 🙌 🙏 💪 ✍️ 🤝 👀 🧠 🫶 ☝️ 👉 👈 👆 👇 ✋ 🖐️'.split(' '),
  'Schule': '📚 📖 📝 ✏️ 🖊️ 📐 📏 🧮 🎒 🏫 👩‍🏫 👨‍🏫 🧑‍🎓 🎓 📅 🗓️ ⏰ 🔔 📌 📎 🖇️ 📋 🗂️ 💻 🖨️ 📊 🧪 🔬 🌍 🎨 🎵 ⚽ 🏀 🚌 🍎 ☕'.split(' '),
  'Herzen': '❤️ 🧡 💛 💚 💙 💜 🤍 🖤 💖 💗 💓 💞 💕 💯 ✨ ⭐ 🌟 🔥 🎉 🎊 🎁 🏆 🥇 ✅ ❌ ⚠️ ❗ ❓ 💡 🆗 🆒'.split(' '),
  'Natur & Essen': '☀️ 🌤️ ⛅ 🌧️ ⛈️ ❄️ 🌈 🌸 🌻 🌳 🍀 🍂 🐶 🐱 🐻 🐼 🦊 🐸 🍕 🍔 🍟 🥨 🍰 🎂 🍪 🍫 🍦 🍓 🍌 🥤 🍵'.split(' '),
};
const STORY_BGS = ['#4f46e5', '#db2777', '#0d9488', '#ea580c', '#7c3aed', '#0369a1', '#16a34a', '#111827'];

// ------------------------------------------------------------------ Hilfen
function chatArr(k) { const t = S.team; if (!Array.isArray(t[k])) t[k] = []; return t[k]; }
function memberById(id) { return S.team.members.find((m) => m.id === id); }
function chatTime(ms) {
  const d = new Date(ms);
  const day = iso(d);
  const hm = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  if (day === today()) return hm;
  if (day === addDays(today(), -1)) return 'Gestern';
  return daysBetween(day, today()) < 7 ? WDS[dow(day)] : fmtDS(day);
}
function chatMembers(c) { return c.id === 'all' ? teamMembersAlive().map((m) => m.id) : (c.members || []).filter((id) => !(S.team.removed || {})[id]); }
function chatsForMe() {
  const t = S.team;
  const list = chatArr('chats').filter((c) => !c.left && (c.members || []).includes(t.me));
  if (!list.some((c) => c.id === 'all')) list.unshift({ id: 'all', kind: 'group', name: 'Ganzes Kollegium', emoji: '🏫', color: '#4f46e5', members: [] });
  return list;
}
function chatById(id) { return id === 'all' ? chatsForMe().find((c) => c.id === 'all') : chatArr('chats').find((c) => c.id === id); }
function chatTitle(c) {
  if (c.kind === 'direct') { const other = (c.members || []).find((id) => id !== S.team.me); return teamMemberName(other); }
  return c.name || 'Gruppe';
}
function chatAvatar(c, size = '') {
  if (c.kind === 'direct') return memberAvatar(memberById((c.members || []).find((id) => id !== S.team.me)), size);
  return `<span class="av ${size} chat-grp" style="--gc:${c.color || '#4f46e5'}">${esc(c.emoji || '👥')}</span>`;
}
function chatMsgs(chatId) { return sortBy(chatArr('msgs').filter((m) => m.chat === chatId), 'at'); }
function chatUnread(c) {
  const read = (S.team.chatRead || {})[c.id] || 0;
  return chatArr('msgs').filter((m) => m.chat === c.id && m.by !== S.team.me && m.at > read && !m.del).length;
}
function chatUnreadTotal() { return Team.on() ? chatsForMe().reduce((n, c) => n + chatUnread(c), 0) : 0; }
function markChatRead(id) { const t = S.team; t.chatRead = t.chatRead || {}; t.chatRead[id] = Date.now(); save(); }

// ------------------------------------------------------------------ Verschlüsselung (ECDH P-256 + AES-GCM)
const ChatCrypto = {
  shared: new Map(),
  plain: new Map(),
  async ensureKeys() {
    if (!Team.on()) return false;
    const t = S.team;
    const me = Team.me();
    if (!me) return false;
    if (t.myKeys && t.myKeys.ecdh && me.encPub && me.encPub.x === t.myKeys.pub.x) return true;
    if (!t.myKeys || !t.myKeys.ecdh) {
      const kp = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey']);
      const priv = await crypto.subtle.exportKey('jwk', kp.privateKey);
      const pub = await crypto.subtle.exportKey('jwk', kp.publicKey);
      t.myKeys = { ecdh: priv, pub: { kty: pub.kty, crv: pub.crv, x: pub.x, y: pub.y } };
    }
    me.encPub = t.myKeys.pub;
    me.updatedAt = Date.now();
    Team.changed();
    return true;
  },
  async sharedKey(pub) {
    const id = pub.x + pub.y;
    if (this.shared.has(id)) return this.shared.get(id);
    const priv = await crypto.subtle.importKey('jwk', S.team.myKeys.ecdh, { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveKey']);
    const other = await crypto.subtle.importKey('jwk', { kty: 'EC', crv: 'P-256', x: pub.x, y: pub.y }, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
    const k = await crypto.subtle.deriveKey({ name: 'ECDH', public: other }, priv, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    this.shared.set(id, k);
    return k;
  },
  async encrypt(memberIds, payload) {
    const raw = Codec.random(32);
    const ck = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt']);
    const body = await Codec.encrypt(ck, await Codec.pack(payload));
    const keys = {};
    const missing = [];
    for (const id of memberIds) {
      const m = memberById(id);
      if (!m || !m.encPub) { missing.push(id); continue; }
      keys[id] = Codec.b64u(await Codec.encrypt(await this.sharedKey(m.encPub), raw));
    }
    return { enc: { ct: Codec.b64u(body), keys, spub: S.team.myKeys.pub }, missing };
  },
  async decrypt(msg) {
    if (this.plain.has(msg.id + msg.updatedAt)) return this.plain.get(msg.id + msg.updatedAt);
    let out = null;
    try {
      const wk = msg.enc && msg.enc.keys && msg.enc.keys[S.team.me];
      if (wk && S.team.myKeys) {
        const raw = await Codec.decrypt(await this.sharedKey(msg.enc.spub), Codec.unb64u(wk));
        const ck = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['decrypt']);
        out = await Codec.unpack(await Codec.decrypt(ck, Codec.unb64u(msg.enc.ct)));
        const sender = memberById(msg.by);
        out._verified = !!(sender && sender.encPub && sender.encPub.x === msg.enc.spub.x && sender.encPub.y === msg.enc.spub.y);
      }
    } catch (e) { out = null; }
    this.plain.set(msg.id + msg.updatedAt, out);
    return out;
  },
  async decryptChat(chatId) { for (const m of chatMsgs(chatId)) if (!m.del) await this.decrypt(m); },
};

// ------------------------------------------------------------------ Senden
const Chat = {
  open: null,
  timer: null,
  async send(chatId, payload) {
    if (!(await ChatCrypto.ensureKeys())) { UI.toast('Kein Schulteam', { type: 'err' }); return false; }
    const c = chatById(chatId);
    const members = chatMembers(c);
    const { enc, missing } = await ChatCrypto.encrypt(members, payload);
    if (!Object.keys(enc.keys).some((id) => id !== S.team.me)) { UI.toast('Die Empfänger haben noch keinen Chat-Schlüssel – sie müssen Schulplan 1.8 öffnen und einmal abgleichen', { type: 'err', ms: 6000 }); return false; }
    if (c.id !== 'all' && !chatArr('chats').some((x) => x.id === c.id)) chatArr('chats').push(Team.touch({ ...c }));
    const msg = Team.touch({ id: uid(), chat: chatId, at: Date.now(), enc });
    chatArr('msgs').push(msg);
    ChatCrypto.plain.set(msg.id + msg.updatedAt, { ...payload, _verified: true });
    markChatRead(chatId);
    Team.changed();
    if (Sync.connected()) setTimeout(() => Sync.run(true), 600);
    if (missing.length) UI.toast(`${missing.map((id) => teamMemberName(id, true)).join(', ')} ${missing.length === 1 ? 'hat' : 'haben'} noch keinen Chat-Schlüssel (älteres Schulplan) und kann diese Nachricht nicht lesen.`, { ms: 5000 });
    return true;
  },
  startPolling() {
    Chat.stopPolling();
    if (Sync.connected()) Chat.timer = setInterval(() => { if (!document.hidden && App.path.startsWith('/chat')) Sync.run(true); else Chat.stopPolling(); }, 15000);
  },
  stopPolling() { if (Chat.timer) clearInterval(Chat.timer); Chat.timer = null; },
  // Nach einem Abgleich: neue Nachrichten melden (Inhalt bleibt privat – nur Absender wird genannt)
  async notifyNew(newMsgs) {
    if (!newMsgs.length) return;
    const byChat = {};
    newMsgs.forEach((m) => { (byChat[m.chat] = byChat[m.chat] || []).push(m); });
    for (const [cid, ms] of Object.entries(byChat)) {
      if (Chat.open === cid && !document.hidden) continue;
      const c = chatById(cid);
      if (!c) continue;
      const by = ms[ms.length - 1].by;
      const who = (typeof memberFull === 'function' && memberFull(by)) || teamMemberName(by, true);
      const title = c.kind === 'direct' ? who : `${chatTitle(c)}`;
      const text = ms.length > 1 ? `${ms.length} neue Nachrichten` : (c.kind === 'direct' ? 'Neue Nachricht' : `Neue Nachricht von ${who}`);
      notifyNow(title, text, '/chat/' + cid);
    }
  },
};
function notifyNow(title, text, route) {
  if (Native.has) { Native.call('notifyNow', title, text, route); return; }
  try { if ('Notification' in window && Notification.permission === 'granted' && document.hidden) new Notification(title, { body: text, icon: 'icons/icon-192.png' }); } catch (e) { /* egal */ }
}

// ------------------------------------------------------------------ Chat-Liste & Storys
function activeStories() {
  const now0 = Date.now();
  const list = chatArr('stories').filter((s) => s.exp > now0 && !(S.team.removed || {})[s.by]);
  const by = new Map();
  sortBy(list, 'at').forEach((s) => { if (!by.has(s.by)) by.set(s.by, []); by.get(s.by).push(s); });
  return by;
}
App.def('/chat', () => {
  if (!Team.on()) return { title: 'Chat', tab: 'more', icon: 'message-circle', html: UI.empty('message-circle', 'Der Chat ist für dein Kollegium. Gründe zuerst ein Schulteam oder nimm eine Einladung an.', `<button class="btn btn-primary" data-nav="/team">${icon('users')}Zum Kollegium</button>`) };
  const t = S.team;
  Chat.open = null;
  const stories = activeStories();
  const seenSt = t.storySeen || {};
  const mine = stories.get(t.me) || [];
  let h = `<div class="story-row"><button class="story-c me" data-act="${mine.length ? 'story-view' : 'story-add'}" data-id="${t.me}"><span class="story-ring ${mine.length ? '' : 'add'}">${memberAvatar(Team.me(), 'lg')}${mine.length ? '' : `<b>${icon('plus')}</b>`}</span><small>Deine Story</small></button>
    ${[...stories.entries()].filter(([id]) => id !== t.me).map(([id, list]) => `<button class="story-c" data-act="story-view" data-id="${id}"><span class="story-ring ${list.every((s) => seenSt[s.id]) ? 'seen' : ''}">${memberAvatar(memberById(id), 'lg')}</span><small>${esc(teamMemberName(id, true))}</small></button>`).join('')}
    ${mine.length ? `<button class="story-c" data-act="story-add"><span class="story-ring add">${icon('plus')}</span><small>Neue Story</small></button>` : ''}</div>`;
  if (!Sync.connected()) h += `<div class="banner">${icon('refresh-cw')}<div>Nachrichten kommen über den <b>Team-Abgleich</b> an. Für automatische Zustellung die gemeinsame Cloud-Datei verbinden – oder Neuigkeiten mit „Senden“ teilen.<div class="btn-row mt"><button class="btn btn-sm btn-primary" data-act="team-share">${icon('send')}Senden</button><button class="btn btn-sm" data-nav="/team/sync">${icon('link')}Cloud-Datei</button></div></div></div>`;
  const chats = sortBy(chatsForMe(), (c) => -(chatMsgs(c.id).slice(-1)[0] || { at: c.created ? new Date(c.created).getTime() : 0 }).at);
  h += `<div class="card pad0"><div class="list">${chats.map((c) => {
    const last = chatMsgs(c.id).slice(-1)[0];
    const n = chatUnread(c);
    const pl = last && !last.del ? ChatCrypto.plain.get(last.id + last.updatedAt) : null;
    const prev = !last ? (c.id === 'all' ? 'Nachricht an alle Kolleg:innen' : 'Noch keine Nachrichten') : last.del ? 'Nachricht gelöscht' : pl ? previewOf(pl) : '🔒 Verschlüsselte Nachricht';
    return `<div class="li chat-li" data-nav="/chat/${c.id}">${chatAvatar(c)}<div class="li-main"><div class="li-t">${esc(chatTitle(c))}</div><div class="li-s ${n ? 'b' : ''}">${last && last.by === t.me ? 'Du: ' : last && c.kind === 'group' ? esc(teamMemberName(last.by, true)) + ': ' : ''}${esc(prev)}</div></div>
      <div class="li-end chat-end"><small>${last ? chatTime(last.at) : ''}</small>${n ? `<span class="chat-badge">${n}</span>` : ''}</div></div>`;
  }).join('')}</div></div>
  <p class="muted small center">${icon('lock')} Ende-zu-Ende verschlüsselt – nur die Mitglieder eines Chats können ihn lesen. Nachrichten werden nach ${CHAT_KEEP_DAYS} Tagen gelöscht.</p>`;
  return {
    title: 'Chat', sub: t.name, tab: 'more', icon: 'message-circle', html: h, fab: { act: 'chat-new', icon: 'square-pen', label: 'Neuer Chat' },
    mount: () => {
      ChatCrypto.ensureKeys();
      Chat.startPolling();
      // Vorschauen entschlüsseln und einmal neu zeichnen
      Promise.all(chatsForMe().map((c) => { const l = chatMsgs(c.id).slice(-1)[0]; return l && !l.del && !ChatCrypto.plain.has(l.id + l.updatedAt) ? ChatCrypto.decrypt(l) : null; }))
        .then((r) => { if (r.some(Boolean) && App.path === '/chat' && !UI.stack.length) App.refresh(); });
    },
    unmount: () => {},
  };
});
function previewOf(p) {
  if (p.kind === 'image') return '📷 Foto' + (p.t ? ': ' + p.t : '');
  if (p.kind === 'voice') return `🎤 Sprachnachricht (${p.dur || 0} s)`;
  if (p.kind === 'call') return '🎥 Videoanruf';
  return p.t || '';
}

A['chat-new'] = async () => {
  if (!(await ChatCrypto.ensureKeys())) return;
  const r = await UI.menu('Neuer Chat', [
    { l: 'Nachricht an …', s: 'Einzelchat mit einer Kollegin oder einem Kollegen', i: 'user', v: 'dm' },
    { l: 'Neue Gruppe', s: 'z. B. Fachschaft, Jahrgangsteam, Klassenfahrt', i: 'users-round', v: 'group' },
    { l: 'Story posten', s: 'Für alle sichtbar, verschwindet nach 24 Stunden', i: 'sparkles', v: 'story' },
  ]);
  if (r === 'dm') {
    const others = sortBy(teamMembersAlive().filter((m) => m.id !== S.team.me), (m) => m.name || '');
    if (!others.length) { UI.toast('Noch keine Kolleg:innen im Team – lade sie zuerst ein'); return; }
    const who = await UI.menu('Nachricht an …', others.map((m) => ({ l: teamMemberName(m.id), s: [m.role, m.subjects].filter(Boolean).join(' · '), i: 'user', v: m.id })));
    if (!who) return;
    const id = 'dm-' + [S.team.me, who].sort().join('-');
    if (!chatArr('chats').some((c) => c.id === id)) chatArr('chats').push(Team.touch({ id, kind: 'direct', members: [S.team.me, who], created: new Date().toISOString() }));
    save();
    App.navigate('/chat/' + id);
  }
  if (r === 'group') editGroup();
  if (r === 'story') A['story-add']();
};
function editGroup(c) {
  const isNew = !c;
  const opts = sortBy(teamMembersAlive().filter((m) => m.id !== S.team.me), (m) => m.name || '').map((m) => ({ v: m.id, l: teamMemberName(m.id) }));
  UI.form({
    title: isNew ? 'Neue Gruppe' : 'Gruppe bearbeiten',
    fields: [
      { k: 'name', label: 'Name', req: true, ph: 'z. B. Fachschaft Mathe' },
      { k: 'emoji', label: 'Symbol', type: 'chips', opts: ['👥', '📚', '🧮', '🔬', '🌍', '🎨', '⚽', '🎵', '🚌', '🎉', '🏫', '💬'].map((e) => ({ v: e, l: e })) },
      { k: 'members', label: 'Mitglieder', type: 'multi', opts },
    ],
    values: c ? { ...c, members: (c.members || []).filter((id) => id !== S.team.me) } : { emoji: '👥', members: [] },
    submit: isNew ? 'Erstellen' : 'Speichern',
    onSave: (v) => {
      if (!(v.members || []).length) { UI.toast('Bitte mindestens eine Person auswählen', { type: 'err' }); return false; }
      const members = [S.team.me, ...v.members];
      if (isNew) {
        const id = uid();
        chatArr('chats').push(Team.touch({ id, kind: 'group', name: v.name.trim(), emoji: v.emoji || '👥', color: STORY_BGS[hashInt(id) % STORY_BGS.length], members, admins: [S.team.me], created: new Date().toISOString() }));
        Team.changed(); App.navigate('/chat/' + id);
      } else {
        Object.assign(c, { name: v.name.trim(), emoji: v.emoji || c.emoji, members }, Team.touch({}));
        Team.changed(); App.refresh();
      }
    },
  });
}

// ------------------------------------------------------------------ Chat-Verlauf
App.def('/chat/:id', (p) => {
  if (!Team.on()) return { title: 'Chat', html: '' };
  const t = S.team;
  const c = chatById(p.id);
  if (!c || (c.id !== 'all' && !(c.members || []).includes(t.me))) return { title: 'Chat', html: UI.empty('message-circle', 'Diesen Chat gibt es nicht mehr.') };
  Chat.open = c.id;
  const msgs = chatMsgs(c.id);
  const needs = msgs.some((m) => !m.del && !ChatCrypto.plain.has(m.id + m.updatedAt));
  const reacts = chatArr('reacts');
  let lastDay = '';
  const body = msgs.map((m) => {
    const day = iso(new Date(m.at));
    const sep = day !== lastDay ? `<div class="chat-day">${day === today() ? 'Heute' : day === addDays(today(), -1) ? 'Gestern' : fmtDW(day)}</div>` : '';
    lastDay = day;
    const mine = m.by === t.me;
    const pl = m.del ? null : ChatCrypto.plain.get(m.id + m.updatedAt);
    let content;
    if (m.del) content = `<i class="muted">${icon('ban')} Nachricht gelöscht</i>`;
    else if (pl === undefined) content = '<i class="muted">Wird entschlüsselt …</i>';
    else if (!pl) content = `<i class="muted">${icon('lock')} Diese Nachricht kannst du nicht lesen (vor deinem Beitritt oder an ein anderes Gerät).</i>`;
    else if (pl.kind === 'image') content = `<img class="chat-img" src="${pl.img}" alt="Foto" data-act="chat-img" data-id="${m.id}">${pl.t ? `<div>${linkify(pl.t)}</div>` : ''}`;
    else if (pl.kind === 'voice') content = `<div class="chat-voice">${icon('mic')}<audio controls preload="metadata" src="${pl.audio}"></audio><small>${pl.dur || 0} s</small></div>`;
    else if (pl.kind === 'call') content = `<div class="chat-call">${icon('presentation')}<div><b>Videoanruf</b><br><small>${esc(pl.url.replace(/^https?:\/\//, ''))}</small></div><a class="btn btn-sm btn-primary" href="${esc(pl.url)}" target="_blank" rel="noopener">Beitreten</a></div>`;
    else content = linkify(pl.t || '');
    const rs = reacts.filter((r) => r.msg === m.id && r.e);
    const groups = {};
    rs.forEach((r) => { groups[r.e] = (groups[r.e] || 0) + 1; });
    return `${sep}<div class="chat-row ${mine ? 'mine' : ''}">${!mine && c.kind === 'group' ? memberAvatar(memberById(m.by), 'sm') : ''}
      <div class="chat-bubble ${pl && pl.kind === 'image' ? 'media' : ''}" data-act="chat-msg" data-id="${m.id}">
        ${!mine && c.kind === 'group' ? `<b class="chat-from" style="color:hsl(${hashInt(m.by) % 360} 55% 45%)">${esc(teamMemberName(m.by, true))}</b>` : ''}
        ${pl && pl._verified === false ? `<small class="chat-warn">${icon('triangle-alert')} Absender nicht bestätigt</small>` : ''}
        <div class="chat-text">${content}</div><small class="chat-time">${pad2(new Date(m.at).getHours())}:${pad2(new Date(m.at).getMinutes())}</small>
        ${Object.keys(groups).length ? `<div class="chat-reacts">${Object.entries(groups).map(([e, n]) => `<span>${e}${n > 1 ? n : ''}</span>`).join('')}</div>` : ''}
      </div></div>`;
  }).join('');
  const other = c.kind === 'direct' ? memberById((c.members || []).find((id) => id !== t.me)) : null;
  const actions = [];
  if (other && other.phone) actions.push({ icon: 'phone', act: 'chat-phone', id: c.id, label: 'Anrufen' });
  actions.push({ icon: 'presentation', act: 'chat-video', id: c.id, label: 'Videoanruf starten' });
  if (c.kind === 'group' && c.id !== 'all') actions.push({ icon: 'ellipsis', act: 'chat-info', id: c.id, label: 'Gruppe' });
  const noKey = chatMembers(c).filter((id) => { const m = memberById(id); return id !== t.me && m && !m.encPub; });
  return {
    title: chatTitle(c), sub: c.kind === 'group' ? plural(chatMembers(c).length, 'Mitglied', 'Mitglieder') : (other ? [other.role, other.subjects].filter(Boolean).join(' · ') : ''), tab: 'more', cls: 'chat-view',
    actions,
    html: `<div class="chat-log" id="chat-log">${body || `<div class="chat-empty">${chatAvatar(c, 'lg')}<p>Schreib die erste Nachricht an ${esc(chatTitle(c))}.</p><p class="muted small">${icon('lock')} Ende-zu-Ende verschlüsselt</p></div>`}</div>
      ${noKey.length ? `<div class="chat-hint">${icon('info')} ${esc(noKey.map((id) => teamMemberName(id, true)).join(', '))} ${noKey.length === 1 ? 'kann' : 'können'} noch nicht mitlesen – Schulplan 1.8 öffnen und abgleichen.</div>` : ''}
      <div class="emoji-panel" id="emoji-panel" hidden>${Object.entries(EMOJI_SETS).map(([k, list]) => `<div class="ep-h">${esc(k)}</div><div class="ep-g">${list.map((e) => `<button type="button" data-e="${e}">${e}</button>`).join('')}</div>`).join('')}</div>
      <form class="chat-input" id="chat-form" onsubmit="return false">
        <button type="button" class="ci-btn" id="ci-emoji" aria-label="Emojis">${icon('smile')}</button>
        <button type="button" class="ci-btn" id="ci-img" aria-label="Foto senden">${icon('upload')}</button>
        <textarea id="chat-text" rows="1" placeholder="Nachricht"></textarea>
        <button type="button" class="ci-btn ci-mic" id="ci-mic" aria-label="Sprachnachricht">${icon('mic')}</button>
        <button type="submit" class="ci-send" id="ci-send" aria-label="Senden">${icon('send')}</button>
        <input type="file" id="ci-file" accept="image/*" hidden>
      </form>`,
    mount: (el) => {
      markChatRead(c.id);
      navBadges();
      Chat.startPolling();
      const log = el.querySelector('#chat-log');
      const v = $('#view');
      const toBottom = () => { if (v) v.scrollTop = v.scrollHeight; if (log) log.scrollTop = log.scrollHeight; };
      toBottom();
      setTimeout(toBottom, 60);
      if (needs) ChatCrypto.decryptChat(c.id).then(() => { if (App.path === '/chat/' + c.id && !UI.stack.length) App.refresh(); });
      const ta = el.querySelector('#chat-text');
      const form = el.querySelector('#chat-form');
      const grow = () => { ta.style.height = 'auto'; ta.style.height = Math.min(140, ta.scrollHeight) + 'px'; form.classList.toggle('has-text', !!ta.value.trim()); };
      ta.addEventListener('input', grow);
      ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && window.innerWidth > 700) { e.preventDefault(); form.requestSubmit(); } });
      form.addEventListener('submit', async () => {
        const text = ta.value.trim();
        if (!text) return;
        ta.value = ''; grow();
        if (await Chat.send(c.id, { kind: 'text', t: text.slice(0, 4000) })) App.refresh();
      });
      const panel = el.querySelector('#emoji-panel');
      el.querySelector('#ci-emoji').addEventListener('click', () => { panel.hidden = !panel.hidden; });
      panel.addEventListener('click', (e) => { const b = e.target.closest('[data-e]'); if (!b) return; const pos = ta.selectionStart ?? ta.value.length; ta.value = ta.value.slice(0, pos) + b.dataset.e + ta.value.slice(pos); grow(); ta.focus(); });
      const file = el.querySelector('#ci-file');
      el.querySelector('#ci-img').addEventListener('click', () => file.click());
      file.addEventListener('change', async () => {
        const f = file.files[0]; file.value = '';
        if (!f) return;
        try {
          UI.toast('Foto wird verkleinert …');
          const img = await compressImage(f, 1280, 0.72);
          const caption = ta.value.trim(); ta.value = ''; grow();
          if (await Chat.send(c.id, { kind: 'image', img, t: caption.slice(0, 500) })) App.refresh();
        } catch (e) { UI.toast('Dieses Bild konnte nicht gelesen werden', { type: 'err' }); }
      });
      el.querySelector('#ci-mic').addEventListener('click', () => recordVoice(c.id));
    },
    unmount: () => { Chat.open = null; },
  };
});

function linkify(s) {
  return esc(s).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>').replace(/\n/g, '<br>');
}
async function compressImage(file, max, quality) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const cv = document.createElement('canvas');
    cv.width = Math.round(img.naturalWidth * scale); cv.height = Math.round(img.naturalHeight * scale);
    cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
    let q = quality, out = cv.toDataURL('image/jpeg', q);
    while (out.length > 420000 && q > 0.4) { q -= 0.1; out = cv.toDataURL('image/jpeg', q); }
    return out;
  } finally { URL.revokeObjectURL(url); }
}

// Sprachnachricht: tippen zum Starten, nochmal tippen zum Senden (max. 2 Minuten)
async function recordVoice(chatId) {
  if (!navigator.mediaDevices || !window.MediaRecorder) { UI.toast('Sprachnachrichten werden auf diesem Gerät nicht unterstützt', { type: 'err' }); return; }
  let stream;
  try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch (e) { UI.toast('Bitte erlaube den Zugriff auf das Mikrofon', { type: 'err' }); return; }
  const type = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4', 'audio/webm'].find((x) => MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(x)) || '';
  const rec = new MediaRecorder(stream, type ? { mimeType: type, audioBitsPerSecond: 24000 } : { audioBitsPerSecond: 24000 });
  const chunks = [];
  const t0 = Date.now();
  let cancelled = false;
  rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
  const m = UI.open({
    title: 'Sprachnachricht',
    body: `<div class="rec-box"><span class="rec-dot"></span><b id="rec-t">0:00</b><p class="muted small">Sprich jetzt – höchstens 2 Minuten.</p></div>`,
    foot: `<button class="btn btn-ghost" data-x="cancel">${icon('trash-2')}Verwerfen</button><span class="sp"></span><button class="btn btn-primary" data-x="send">${icon('send')}Senden</button>`,
    onMount: (el, modal) => {
      el.querySelector('[data-x="cancel"]').addEventListener('click', () => { cancelled = true; modal.close(); });
      el.querySelector('[data-x="send"]').addEventListener('click', () => modal.close());
    },
    onClose: () => { if (rec.state !== 'inactive') rec.stop(); },
  });
  const tick = setInterval(() => {
    const s = Math.floor((Date.now() - t0) / 1000);
    const te = document.getElementById('rec-t');
    if (te) te.textContent = `${Math.floor(s / 60)}:${pad2(s % 60)}`;
    if (s >= 120 && m && m.close) m.close();
  }, 250);
  rec.onstop = async () => {
    clearInterval(tick);
    stream.getTracks().forEach((tr) => tr.stop());
    if (cancelled || !chunks.length) return;
    const blob = new Blob(chunks, { type: rec.mimeType || type || 'audio/webm' });
    const audio = await new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(blob); });
    if (await Chat.send(chatId, { kind: 'voice', audio, dur: Math.max(1, Math.round((Date.now() - t0) / 1000)) })) App.refresh();
  };
  rec.start(500);
}

A['chat-msg'] = async (el) => {
  const m = chatArr('msgs').find((x) => x.id === el.dataset.id);
  if (!m || m.del) return;
  const pl = ChatCrypto.plain.get(m.id + m.updatedAt);
  const mine = m.by === S.team.me;
  const r = await UI.menu(mine ? 'Deine Nachricht' : teamMemberName(m.by), [
    { l: QUICK_REACTIONS.join('  '), s: 'Reagieren', i: 'smile', v: 'react' },
    pl && pl.t ? { l: 'Text kopieren', i: 'copy', v: 'copy' } : null,
    mine ? { l: 'Für alle löschen', i: 'trash-2', danger: true, v: 'del' } : null,
  ].filter(Boolean));
  if (r === 'react') {
    const e = await UI.menu('Reaktion', [...QUICK_REACTIONS.map((x) => ({ l: x, v: x })), { l: 'Reaktion entfernen', i: 'x', v: '' }]);
    if (e === null || e === undefined) return;
    const id = m.id + ':' + S.team.me;
    const cur = chatArr('reacts').find((x) => x.id === id);
    if (cur) Object.assign(cur, { e }, Team.touch({})); else chatArr('reacts').push(Team.touch({ id, msg: m.id, chat: m.chat, e }));
    Team.changed(); if (Sync.connected()) setTimeout(() => Sync.run(true), 600); App.refresh();
  }
  if (r === 'copy') Files.copy(pl.t);
  if (r === 'del' && (await UI.confirm('Diese Nachricht für alle löschen?', { danger: true, ok: 'Löschen' }))) {
    Object.assign(m, { del: true, enc: null }, Team.touch({}));
    Team.changed(); App.refresh();
  }
};
A['chat-img'] = (el) => {
  const m = chatArr('msgs').find((x) => x.id === el.dataset.id);
  const pl = m && ChatCrypto.plain.get(m.id + m.updatedAt);
  if (pl && pl.img) UI.open({ title: 'Foto', body: `<img src="${pl.img}" alt="Foto" style="width:100%;border-radius:16px">${pl.t ? `<p>${linkify(pl.t)}</p>` : ''}` });
};
A['chat-phone'] = (el) => {
  const c = chatById(el.dataset.id);
  const other = c && memberById((c.members || []).find((id) => id !== S.team.me));
  if (other && other.phone) location.href = 'tel:' + other.phone.replace(/\s/g, '');
};
A['chat-video'] = async (el) => {
  const c = chatById(el.dataset.id);
  if (!c) return;
  const base = (S.settings.callBase || 'https://meet.jit.si/').replace(/\/?$/, '/');
  const room = 'Schulplan-' + Codec.b64u(Codec.random(12)).replace(/[-_]/g, 'x');
  const url = base + room;
  if (!(await UI.confirm(`Videoanruf starten? Schulplan schickt allen im Chat einen Link zu einem Videoraum bei <b>${esc(base.replace(/^https?:\/\//, '').replace(/\/$/, ''))}</b> und öffnet ihn. Der Videodienst ist ein externer Anbieter.`, { ok: 'Starten' }))) return;
  if (await Chat.send(c.id, { kind: 'call', url })) { App.refresh(); window.open(url, '_blank', 'noopener'); }
};
A['chat-info'] = async (el) => {
  const c = chatById(el.dataset.id);
  if (!c) return;
  const admin = (c.admins || []).includes(S.team.me);
  const r = await UI.menu(chatTitle(c), [
    { l: 'Mitglieder', s: chatMembers(c).map((id) => teamMemberName(id, true)).join(', '), i: 'users', v: 'members' },
    admin ? { l: 'Gruppe bearbeiten', i: 'pencil', v: 'edit' } : null,
    { l: 'Gruppe verlassen', i: 'log-out', danger: true, v: 'leave' },
    admin ? { l: 'Gruppe für alle löschen', i: 'trash-2', danger: true, v: 'delete' } : null,
  ].filter(Boolean));
  if (r === 'edit') editGroup(c);
  if (r === 'leave' && (await UI.confirm(`„${esc(chatTitle(c))}“ verlassen?`, { ok: 'Verlassen', danger: true }))) {
    c.members = (c.members || []).filter((id) => id !== S.team.me); Team.touch(c); Team.changed(); App.navigate('/chat', { root: true });
  }
  if (r === 'delete' && (await UI.confirm(`Die Gruppe „${esc(chatTitle(c))}“ mit allen Nachrichten für alle löschen?`, { danger: true, ok: 'Löschen' }))) {
    S.team.chats = chatArr('chats').filter((x) => x.id !== c.id); Team.markDeleted(c.id);
    S.team.msgs = chatArr('msgs').filter((m) => { if (m.chat === c.id) { Team.markDeleted(m.id); return false; } return true; });
    Team.changed(); App.navigate('/chat', { root: true });
  }
};

// ------------------------------------------------------------------ Storys
A['story-add'] = async () => {
  if (!Team.on()) return;
  let img = '';
  UI.form({
    title: 'Neue Story',
    fields: [
      { type: 'html', html: `<p class="muted small" style="margin:0">Für das ganze Kollegium sichtbar und nach 24 Stunden automatisch weg – z. B. Fotos vom Schulfest, ein Gruß aus der Klassenfahrt oder eine kurze Info.</p>` },
      { k: 'text', label: 'Text', type: 'textarea', rows: 3, ph: 'z. B. Schönes Wochenende! ☀️' },
      { k: 'bg', label: 'Hintergrund', type: 'color', colors: STORY_BGS },
      { type: 'html', html: `<button type="button" class="btn btn-soft" id="st-img">${icon('upload')}Foto hinzufügen</button><input type="file" id="st-file" accept="image/*" hidden><div id="st-prev"></div>` },
    ],
    values: { bg: STORY_BGS[0] },
    submit: 'Posten',
    onMount: (el) => {
      const f = el.querySelector('#st-file');
      el.querySelector('#st-img').addEventListener('click', () => f.click());
      f.addEventListener('change', async () => {
        if (!f.files[0]) return;
        try { img = await compressImage(f.files[0], 1080, 0.7); el.querySelector('#st-prev').innerHTML = `<img src="${img}" alt="" style="width:100%;max-height:220px;object-fit:cover;border-radius:14px;margin-top:8px">`; } catch (e) { UI.toast('Bild konnte nicht gelesen werden', { type: 'err' }); }
      });
    },
    onSave: (v) => {
      if (!(v.text || '').trim() && !img) { UI.toast('Text oder Foto hinzufügen', { type: 'err' }); return false; }
      const at = Date.now();
      chatArr('stories').push(Team.touch({ id: uid(), at, exp: at + STORY_MS, text: (v.text || '').trim().slice(0, 300), bg: v.bg || STORY_BGS[0], img }));
      Team.changed(); if (Sync.connected()) setTimeout(() => Sync.run(true), 600);
      App.refresh(); UI.toast('Story gepostet – sichtbar für 24 Stunden');
    },
  });
};
A['story-view'] = (el) => {
  const list = activeStories().get(el.dataset.id) || [];
  if (!list.length) return;
  let i = 0, timer = null;
  const t = S.team;
  const ov = document.createElement('div');
  ov.className = 'story-view';
  document.body.appendChild(ov);
  const close = () => { clearTimeout(timer); ov.remove(); App.refresh(); };
  const show = () => {
    const s = list[i];
    t.storySeen = t.storySeen || {}; t.storySeen[s.id] = 1; save();
    ov.innerHTML = `<div class="sv-bars">${list.map((x, j) => `<i class="${j < i ? 'done' : j === i ? 'run' : ''}"></i>`).join('')}</div>
      <div class="sv-head">${memberAvatar(memberById(s.by), 'sm')}<b>${esc(teamMemberName(s.by, true))}</b><small>${chatTime(s.at)}</small><span class="sp"></span>${s.by === t.me ? `<button class="sv-x" data-sv="del">${icon('trash-2')}</button>` : ''}<button class="sv-x" data-sv="close">${icon('x')}</button></div>
      <div class="sv-body" style="background:${s.img ? '#000' : s.bg}">${s.img ? `<img src="${s.img}" alt="">` : ''}${s.text ? `<p class="${s.img ? 'over' : ''}">${esc(s.text)}</p>` : ''}</div>
      <button class="sv-nav prev" data-sv="prev" aria-label="Zurück"></button><button class="sv-nav next" data-sv="next" aria-label="Weiter"></button>`;
    clearTimeout(timer);
    timer = setTimeout(() => { if (i < list.length - 1) { i++; show(); } else close(); }, 5000);
  };
  ov.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-sv]');
    if (!b) return;
    const a = b.dataset.sv;
    if (a === 'close') close();
    if (a === 'next') { if (i < list.length - 1) { i++; show(); } else close(); }
    if (a === 'prev') { if (i > 0) i--; show(); }
    if (a === 'del') { const s = list[i]; t.stories = chatArr('stories').filter((x) => x.id !== s.id); Team.markDeleted(s.id); Team.changed(); close(); UI.toast('Story gelöscht'); }
  });
  show();
};

// ------------------------------------------------------------------ Abgleich: aufräumen & melden
function chatPrune(t) {
  const cut = Date.now() - CHAT_KEEP_DAYS * 86400000;
  const now0 = Date.now();
  if (Array.isArray(t.msgs)) t.msgs = t.msgs.filter((m) => m.at >= cut);
  if (Array.isArray(t.stories)) t.stories = t.stories.filter((s) => s.exp > now0);
  if (Array.isArray(t.reacts) && Array.isArray(t.msgs)) { const ids = new Set(t.msgs.map((m) => m.id)); t.reacts = t.reacts.filter((r) => ids.has(r.msg)); }
}
