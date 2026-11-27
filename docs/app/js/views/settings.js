/* Einstellungen, Datensicherung, Erinnerungen, Sicherheit */
'use strict';

const SET_COLORS = ['#6366f1', '#0ea5e9', '#8b5cf6', '#10b981', '#f59e0b', '#ec4899', '#ef4444', '#14b8a6', '#f97316', '#3b82f6'];
const SET_FIXED = { crown: '#f59e0b', palette: '#ec4899', bell: '#ef4444', sparkles: '#8b5cf6', user: '#6366f1', video: '#10b981', 'calendar-range': '#0ea5e9', clock: '#f97316', database: '#3b82f6', lock: '#64748b', shield: '#64748b' };
function setColor(ic) { if (SET_FIXED[ic]) return SET_FIXED[ic]; let h = 0; for (const ch of String(ic)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return SET_COLORS[h % SET_COLORS.length]; }
function setItem(ic, title, sub, attrs_, end = '') {
  return `<div class="li" ${attrs_}><div class="li-ic set-ic" style="--lc:${setColor(ic)}">${icon(ic)}</div><div class="li-main"><div class="li-t">${esc(title)}</div>${sub ? `<div class="li-s">${esc(sub)}</div>` : ''}</div>${end || icon('chevron-right', 'chev')}</div>`;
}

App.def('/settings', () => {
  const st = S.settings;
  const themeL = { auto: 'Wie System', light: 'Hell', dark: 'Dunkel' }[st.theme] + ' · ' + ((THEMES.find((t) => t.v === st.themeColor) || { l: st.themeColor === '' ? 'Eigene Farbe' : 'Indigo' }).l);
  const h = `
  <div class="section-title">Allgemein</div>
  <div class="card pad0"><div class="list">
    ${setItem('user', 'Profil & Schule', [teacherName(), st.school].filter(Boolean).join(' · ') || 'Name, Schule, Schuljahr', 'data-act="set-profile"')}
    ${setItem('calendar-range' in ICONS ? 'calendar-range' : 'calendar', 'Schuljahr & Halbjahre', `${st.year} · 2. Halbjahr ab ${fmtD(st.hj2)}`, 'data-act="set-year"')}
    ${setItem('sparkles', 'Assistent', Assist.aiReady() ? 'KI-Modus aktiv' : 'Offline-Modus · KI-Modus mit eigenem Schlüssel möglich', 'data-act="as-settings"')}
    ${setItem('presentation', 'Videoanrufe im Chat', (S.settings.callBase || 'https://meet.jit.si/').replace(/^https?:\/\//, ''), 'data-act="set-callbase"')}
    ${setItem('crown', 'Schulleitermodus', Leader.active() ? 'Angemeldet als ' + Leader.name() + ' · Zugangsdaten ändern' : 'Lehrermodus · Anmeldung für die Schulleitung', 'data-nav="/settings/leader"', Leader.active() ? '<span class="badge lead">Aktiv</span>' : '')}
    ${setItem('palette', 'Darstellung', `${themeL} · Schrift ${Math.round((st.fontScale || 1) * 100)} %`, 'data-act="set-look"')}
    ${setItem('sun', 'Fest-Animationen', st.festive !== false ? 'An · Sonne, Blätter, Schnee … beim Eintragen von Ferien' : 'Aus', 'data-act="set-festive"')}
    ${window.SCHULPLAN_DESKTOP ? setItem('layout-grid', 'Desktop-Widget', 'Nächste Stunde, heutige Stunden und Aufgaben immer auf dem Desktop', '', `<input type="checkbox" class="switch" data-change="desk-widget" ${Native.call('widgetEnabled') ? 'checked' : ''}>`) : ''}
    ${!Native.has && 'setAppBadge' in navigator ? setItem('bell', 'Zahl am App-Symbol', 'Fällige Aufgaben und Hausaufgaben am Symbol der installierten Web-App', '', `<input type="checkbox" class="switch" data-change="app-badge" ${st.appBadge !== false ? 'checked' : ''}>`) : ''}
  </div></div>
  <div class="section-title">Unterricht</div>
  <div class="card pad0"><div class="list">
    ${setItem('clock', 'Stundenraster & Zeiten', `${st.periods.length} Stunden · ${st.days} Tage${st.abWeeks ? ' · A/B-Wochen' : ''}`, 'data-nav="/settings/periods"')}
    ${setItem('book', 'Fächer', plural(S.subjects.length, 'Fach', 'Fächer'), 'data-nav="/settings/subjects"')}
    ${setItem('umbrella', 'Ferien & freie Tage', plural(S.events.filter((e) => e.type === 'ferien' || e.type === 'feiertag').length, 'Eintrag', 'Einträge'), 'data-nav="/holidays"')}
  </div></div>
  <div class="section-title">Noten</div>
  <div class="card pad0"><div class="list">
    ${setItem('award', 'Notensystem', GRADE_SYSTEMS[st.gradeSystem].label + (st.tendencies ? ' · mit Tendenzen' : ''), 'data-act="set-grades"')}
    ${setItem('sliders-horizontal', 'Kategorien & Gewichtung', S.categories.map((c) => `${c.name.split(' ')[0]} ${c.weight}%`).join(', '), 'data-nav="/settings/categories"')}
    ${setItem('table', 'Notenschlüssel', 'Prozentgrenzen für Punkte → Note', 'data-nav="/settings/key"')}
  </div></div>
  <div class="section-title">Erinnerungen & Sicherheit</div>
  <div class="card pad0"><div class="list">
    ${setItem('bell', 'Benachrichtigungen', st.remind.on ? 'Aktiv – Stunden, Termine, Aufgaben …' : 'Aus', 'data-nav="/settings/reminders"')}
    ${setItem('lock', 'App-Sperre (PIN)', st.pin ? 'Aktiv' : 'Aus', 'data-nav="/settings/security"')}
  </div></div>
  <div class="section-title">Daten</div>
  <div class="card pad0"><div class="list">
    ${setItem('database', 'Datensicherung', st.lastBackup ? 'Letzte Sicherung: ' + fmtD(st.lastBackup.slice(0, 10)) : 'Noch keine Sicherung', 'data-nav="/settings/backup"')}
    ${setItem('graduation-cap', 'Schuljahreswechsel', 'Neues Schuljahr vorbereiten', 'data-act="set-newyear"')}
    ${setItem('trash-2', 'Alle Daten löschen', 'App zurücksetzen', 'data-act="set-reset" style="color:var(--danger)"')}
  </div></div>
  <div class="section-title">Info</div>
  <div class="card pad0"><div class="list">${setItem('refresh-cw', 'App-Updates', Update.info ? 'Neue Version ' + Update.info.versionName + ' verfügbar!' : 'Version ' + Update.versionName(), 'data-nav="/update"', Update.info ? '<span class="badge red">Neu</span>' : '')}${setItem('info', 'Über Schulplan', 'Version, Datenschutz, Lizenzen', 'data-nav="/about"')}</div></div>`;
  return { title: 'Einstellungen', tab: 'more', icon: 'settings', html: h };
});

A['set-callbase'] = async () => {
  const v = await UI.prompt('Videoanruf-Dienst', { value: S.settings.callBase || 'https://meet.jit.si/', label: 'Adresse eines Jitsi-Servers (z. B. der Schule). Der Chat erzeugt dort für jeden Anruf einen neuen Raum.' });
  if (v === null) return;
  const u = v.trim();
  if (u && !/^https:\/\/[^\s]+$/.test(u)) { UI.toast('Bitte eine https-Adresse eingeben', { type: 'err' }); return; }
  S.settings.callBase = u || ''; save(); App.refresh();
};
A['set-profile'] = () => {
  const st = S.settings;
  UI.form({
    title: 'Profil & Schule',
    fields: [
      { k: 'title', label: 'Anrede', type: 'select', half: true, opts: [{ v: '', l: '–' }, { v: 'Frau', l: 'Frau' }, { v: 'Herr', l: 'Herr' }] },
      { k: 'teacher', label: 'Name', half: true, ph: 'z. B. Müller' },
      { k: 'school', label: 'Schule', ph: 'z. B. Astrid Lindgren Schule' },
      { k: 'short', label: 'Kürzel', ph: 'z. B. MÜL', half: true },
      { k: 'email', label: 'Dienst-E-Mail', type: 'email', half: true },
    ],
    values: st,
    onSave: (v) => { Object.assign(st, v); save(); App.refresh(); },
  });
};
A['set-year'] = () => {
  const st = S.settings;
  UI.form({
    title: 'Schuljahr',
    fields: [
      { k: 'year', label: 'Bezeichnung', ph: 'z. B. 2026/27' },
      { k: 'yearStart', label: 'Beginn', type: 'date', half: true },
      { k: 'yearEnd', label: 'Ende', type: 'date', half: true },
      { k: 'hj2', label: 'Beginn 2. Halbjahr', type: 'date', hint: 'Wird für die Halbjahres-Filter bei Noten und Fehlzeiten verwendet' },
    ],
    values: st,
    onSave: (v) => { Object.assign(st, v); save(); App.refresh(); },
  });
};
A['set-look'] = () => {
  const st = S.settings;
  UI.form({
    title: 'Darstellung',
    fields: [
      { k: 'theme', label: 'Design', type: 'seg', opts: [{ v: 'auto', l: 'System', i: 'sparkles' }, { v: 'light', l: 'Hell', i: 'sun' }, { v: 'dark', l: 'Dunkel', i: 'moon' }] },
      { k: 'themeColor', label: 'Farbthema', type: 'themes', opts: [...THEMES, { v: '', l: 'Eigene Farbe', a: st.accent || '#4f46e5', b: shiftHue(st.accent || '#4f46e5', 32, 0.04) }] },
      { k: 'accent', label: 'Eigene Farbe (bei „Eigene Farbe")', type: 'color' },
      { k: 'bg', label: 'Hintergrund', type: 'seg', opts: [{ v: 'gradient', l: 'Farbverlauf', i: 'sparkles' }, { v: 'plain', l: 'Schlicht', i: 'square' }] },
      { k: 'fontScale', label: 'Schriftgröße', type: 'seg', opts: [{ v: '0.9', l: 'Klein' }, { v: '1', l: 'Normal' }, { v: '1.1', l: 'Groß' }, { v: '1.2', l: 'Sehr groß' }] },
      { k: 'startTab', label: 'Startseite', type: 'select', opts: [{ v: '/today', l: 'Heute' }, { v: '/timetable', l: 'Stundenplan' }, { v: '/classes', l: 'Klassen' }, { v: '/calendar', l: 'Kalender' }] },
    ],
    values: { ...st, themeColor: st.themeColor ?? (st.accent && st.accent !== '#4f46e5' ? '' : 'indigo'), bg: st.bg || 'gradient', fontScale: String(st.fontScale || 1) },
    onSave: (v) => { Object.assign(st, v, { fontScale: Number(v.fontScale) || 1 }); save(); applyTheme(); App.refresh(); },
  });
};
A['set-grades'] = () => {
  const st = S.settings;
  UI.form({
    title: 'Notensystem',
    fields: [
      { k: 'gradeSystem', label: 'Standard-Notensystem', type: 'seg', opts: [{ v: 'noten', l: 'Noten 1–6' }, { v: 'punkte', l: 'Punkte 0–15' }], hint: 'Kann pro Klasse abweichend eingestellt werden (z. B. Oberstufe).' },
      { k: 'tendencies', label: 'Tendenzen (+/–) im Notenschlüssel', type: 'switch', hint: 'z. B. 2+, 2, 2- bei der automatischen Berechnung aus Punkten' },
    ],
    values: st,
    onSave: (v) => { Object.assign(st, v); save(); App.refresh(); },
  });
};

// ------------------------------------------------------------------ Stundenraster
App.def('/settings/periods', () => {
  const st = S.settings;
  let h = `<div class="card"><div class="col">
    ${UI.seg([{ v: '5', l: 'Mo–Fr' }, { v: '6', l: 'Mo–Sa' }], String(st.days), 'per-days', 'style="margin:0"')}
    <label class="field-switch field"><span class="sw-l">A/B-Wochen<small>Für Stunden, die nur jede zweite Woche stattfinden</small></span><input type="checkbox" class="switch" data-change="per-ab" ${st.abWeeks ? 'checked' : ''}></label>
    ${st.abWeeks ? `<label class="field"><span>Diese Woche ist eine …</span><select class="inline-input" data-change="per-abnow"><option value="A" ${weekType(today()) === 'A' ? 'selected' : ''}>A-Woche</option><option value="B" ${weekType(today()) === 'B' ? 'selected' : ''}>B-Woche</option></select></label>` : ''}
  </div></div>
  <div class="section-title">Stunden <span class="sp"></span><button class="btn btn-sm btn-soft" data-act="per-gen">${icon('sparkles')}Automatisch</button></div>
  <div class="card pad0"><div class="list">${st.periods.map((p, i) => `
    <div class="li"><div class="li-ic">${i + 1}</div>
      <input class="inline-input" type="time" value="${p.s}" data-change="per-time" data-i="${i}" data-k="s" style="width:auto;flex:1">
      <span class="muted">–</span>
      <input class="inline-input" type="time" value="${p.e}" data-change="per-time" data-i="${i}" data-k="e" style="width:auto;flex:1">
      <button class="btn btn-icon sm btn-ghost" data-act="per-del" data-i="${i}">${icon('trash-2')}</button></div>`).join('')}</div></div>
  <button class="btn btn-block btn-soft" data-act="per-add">${icon('plus')}Stunde hinzufügen</button>`;
  return { title: 'Stundenraster', tab: 'more', html: h };
});
A['per-days'] = (el) => { S.settings.days = Number(el.dataset.v); save(); App.refresh(); };
A['per-ab'] = (el) => { S.settings.abWeeks = el.checked; if (el.checked && !S.settings.abRef) S.settings.abRef = weekStart(today()); save(); App.refresh(); };
A['per-abnow'] = (el) => { S.settings.abRef = el.value === 'A' ? weekStart(today()) : addDays(weekStart(today()), -7); save(); App.refresh(); };
A['per-time'] = (el) => { S.settings.periods[Number(el.dataset.i)][el.dataset.k] = el.value; save(); };
A['per-del'] = async (el) => {
  const i = Number(el.dataset.i);
  const used = S.timetable.filter((t) => t.period === i).length;
  if (used && !(await UI.confirm(`In der ${i + 1}. Stunde sind ${used} Einträge. Wirklich entfernen? Die Einträge werden mitgelöscht, spätere Stunden rücken auf.`, { danger: true, ok: 'Entfernen' }))) return;
  S.settings.periods.splice(i, 1);
  S.timetable = S.timetable.filter((t) => t.period !== i).map((t) => (t.period > i ? { ...t, period: t.period - 1 } : t));
  save(); App.refresh();
};
A['per-add'] = () => {
  const ps = S.settings.periods;
  const last = ps[ps.length - 1];
  const s = last ? tmin(last.e) + 5 : 8 * 60;
  ps.push({ s: mint(s), e: mint(s + 45) });
  save(); App.refresh();
};
A['per-gen'] = () => UI.form({
  title: 'Stundenraster erzeugen',
  fields: [
    { k: 'start', label: 'Beginn 1. Stunde', type: 'time', half: true },
    { k: 'len', label: 'Dauer (Min.)', type: 'number', half: true },
    { k: 'count', label: 'Anzahl Stunden', type: 'number', half: true },
    { k: 'gap', label: 'Wechselzeit (Min.)', type: 'number', half: true },
    { k: 'b1', label: 'Große Pause nach Stunde', type: 'number', half: true },
    { k: 'b1l', label: 'Länge (Min.)', type: 'number', half: true },
    { k: 'b2', label: '2. Pause nach Stunde', type: 'number', half: true },
    { k: 'b2l', label: 'Länge (Min.)', type: 'number', half: true },
    { k: 'b3', label: 'Mittagspause nach Stunde', type: 'number', half: true },
    { k: 'b3l', label: 'Länge (Min.)', type: 'number', half: true },
  ],
  values: { start: '08:00', len: 45, count: 8, gap: 5, b1: 2, b1l: 20, b2: 4, b2l: 20, b3: 6, b3l: 35 },
  submit: 'Erzeugen',
  onSave: (v) => {
    const out = [];
    let t = tmin(v.start || '08:00');
    for (let i = 1; i <= (v.count || 8); i++) {
      out.push({ s: mint(t), e: mint(t + (v.len || 45)) });
      t += (v.len || 45);
      if (i === v.b1) t += v.b1l || 0; else if (i === v.b2) t += v.b2l || 0; else if (i === v.b3) t += v.b3l || 0; else t += v.gap || 0;
    }
    S.settings.periods = out;
    S.timetable = S.timetable.filter((x) => x.period < out.length);
    save(); App.refresh();
  },
});

// ------------------------------------------------------------------ Fächer
App.def('/settings/subjects', () => {
  const list = [...S.subjects].sort((a, b) => cmpStr(a.name, b.name));
  const h = list.length ? `<div class="card pad0"><div class="list">${list.map((s) => {
    const n = S.classes.filter((c) => (c.subjects || []).includes(s.id)).length;
    return `<div class="li" data-act="subject-edit" data-id="${s.id}"><div class="li-ic" style="background:${rgba(s.color, .15)};color:${s.color}">${esc(s.short || s.name.slice(0, 3))}</div><div class="li-main"><div class="li-t">${esc(s.name)}</div><div class="li-s">${plural(n, 'Klasse', 'Klassen')}</div></div></div>`;
  }).join('')}</div></div>` : UI.empty('book', 'Noch keine Fächer angelegt.');
  return { title: 'Fächer', tab: 'more', html: h, fab: { act: 'subject-add' } };
});
A['subject-add'] = () => editSubject();
A['subject-edit'] = (el) => editSubject(subj(el.dataset.id));
function editSubject(s) {
  const isNew = !s;
  UI.form({
    title: isNew ? 'Neues Fach' : 'Fach bearbeiten',
    fields: [
      { k: 'name', label: 'Name', req: true, ph: 'z. B. Mathematik' },
      { k: 'short', label: 'Kürzel', ph: 'z. B. M', maxlength: 6 },
      { k: 'color', label: 'Farbe', type: 'color' },
    ],
    values: s ? { ...s } : { color: COLORS[S.subjects.length % COLORS.length] },
    onSave: (v) => { if (!v.short) v.short = v.name.slice(0, 3); upsert('subjects', { ...(s || {}), ...v }); save(); App.refresh(); },
    onDelete: isNew ? null : async () => {
      const used = S.classes.filter((c) => (c.subjects || []).includes(s.id)).length + S.timetable.filter((t) => t.subjectId === s.id).length;
      if (used && !(await UI.confirm(`Das Fach wird noch verwendet (${used}×). Trotzdem löschen?`, { danger: true, ok: 'Löschen' }))) return false;
      removeById('subjects', s.id);
      S.classes.forEach((c) => { c.subjects = (c.subjects || []).filter((x) => x !== s.id); });
      save(); App.refresh();
    },
  });
}

// ------------------------------------------------------------------ Kategorien
App.def('/settings/categories', () => {
  const tot = sum(S.categories.map((c) => Number(c.weight) || 0));
  const h = `<p class="muted small" style="margin:0 4px 12px">Jede Note gehört zu einer Kategorie. Der Gesamtdurchschnitt wird aus den Kategorie-Durchschnitten gewichtet berechnet. Kategorien ohne Noten werden nicht mitgezählt. Pro Klasse kannst du die Gewichtung abweichend festlegen (Klasse → Info).</p>
    <div class="card pad0"><div class="list">${S.categories.map((c) => `<div class="li" data-act="cat-edit" data-id="${c.id}"><i class="dot" style="background:${c.color};width:14px;height:14px"></i><div class="li-main"><div class="li-t">${esc(c.name)}</div><div class="li-s">${c.exam ? 'Prüfung (erscheint im Kalender)' : 'laufende Leistung'}</div></div><div class="li-end b">${c.weight} %</div></div>`).join('')}</div></div>
    ${tot !== 100 ? `<div class="banner warn">${icon('info')}<div>Summe der Gewichte: ${tot} %. Das ist erlaubt – die Gewichte werden relativ verrechnet.</div></div>` : ''}`;
  return { title: 'Kategorien & Gewichtung', tab: 'more', html: h, fab: { act: 'cat-add' } };
});
A['cat-add'] = () => editCategory();
A['cat-edit'] = (el) => editCategory(cat(el.dataset.id));
function editCategory(c) {
  const isNew = !c;
  UI.form({
    title: isNew ? 'Neue Kategorie' : 'Kategorie bearbeiten',
    fields: [
      { k: 'name', label: 'Name', req: true, ph: 'z. B. Klassenarbeit' },
      { k: 'weight', label: 'Gewicht (%)', type: 'number', inputmode: 'decimal', req: true },
      { k: 'exam', label: 'Ist eine Prüfung', type: 'switch', hint: 'Erscheint im Kalender, auf der Startseite und bei Erinnerungen' },
      { k: 'color', label: 'Farbe', type: 'color' },
    ],
    values: c ? { ...c } : { weight: 10, color: COLORS[S.categories.length % COLORS.length] },
    onSave: (v) => { upsert('categories', { ...(c || {}), ...v }); save(); App.refresh(); },
    onDelete: isNew ? null : async () => {
      const used = S.assessments.filter((a) => a.catId === c.id).length;
      if (used) { UI.toast(`Wird von ${used} Leistungsnachweisen verwendet – bitte zuerst ändern.`, { type: 'err' }); return false; }
      removeById('categories', c.id); save(); App.refresh();
    },
  });
}

// ------------------------------------------------------------------ Notenschlüssel
App.def('/settings/key', () => {
  const st = S.settings;
  const h = `<p class="muted small" style="margin:0 4px 12px">Ab wie viel Prozent der maximalen Punktzahl gibt es welche Note? Wird bei Leistungsnachweisen mit Punkten verwendet (pro Arbeit anpassbar).</p>
    <div class="section-title">Noten 1–6</div>
    <div class="card"><div class="frow" style="flex-wrap:wrap">${[...st.keyNoten].sort((a, b) => a.g - b.g).map((r) => `<label class="field" style="min-width:90px"><span>Note ${r.g} ab %</span><input class="inline-input" type="number" inputmode="decimal" value="${r.min}" data-change="key-noten" data-g="${r.g}" ${r.g === 6 ? 'disabled' : ''}></label>`).join('')}</div>
    <label class="field-switch field mt"><span class="sw-l">Tendenzen (+/–)</span><input type="checkbox" class="switch" data-change="key-tend" ${st.tendencies ? 'checked' : ''}></label></div>
    <div class="section-title">Punkte 0–15 (Oberstufe)</div>
    <div class="card"><div class="frow" style="flex-wrap:wrap">${st.keyPunkte.map((v, i) => `<label class="field" style="min-width:76px;flex:0 0 22%"><span>${15 - i} P. ab %</span><input class="inline-input" type="number" inputmode="decimal" value="${v}" data-change="key-punkte" data-i="${i}" ${i === 15 ? 'disabled' : ''}></label>`).join('')}</div></div>
    <button class="btn btn-ghost" data-act="key-reset">${icon('rotate-ccw')}Auf Standard zurücksetzen</button>
    <button class="btn btn-soft" data-nav="/tool/key">${icon('calculator')}Zum Rechner</button>`;
  return { title: 'Notenschlüssel', tab: 'more', html: h };
});
A['key-noten'] = (el) => { const r = S.settings.keyNoten.find((x) => x.g === Number(el.dataset.g)); r.min = parseNum(el.value) ?? r.min; save(); };
A['key-punkte'] = (el) => { const i = Number(el.dataset.i); S.settings.keyPunkte[i] = parseNum(el.value) ?? S.settings.keyPunkte[i]; save(); };
A['key-tend'] = (el) => { S.settings.tendencies = el.checked; save(); };
A['key-reset'] = () => { const d = defaultData().settings; S.settings.keyNoten = d.keyNoten; S.settings.keyPunkte = d.keyPunkte; save(); App.refresh(); UI.toast('Zurückgesetzt'); };

// ------------------------------------------------------------------ Erinnerungen
function requestNotifPermission() {
  if (Native.has) Native.call('requestNotificationPermission');
  else if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission();
}
App.def('/settings/reminders', () => {
  const r = S.settings.remind;
  const allowed = Native.has ? Native.call('notificationsAllowed') : true;
  const list = buildReminders();
  const sw = (k, label, hint) => `<label class="field-switch field"><span class="sw-l">${label}${hint ? `<small>${hint}</small>` : ''}</span><input type="checkbox" class="switch" data-change="rem-set" data-k="${k}" ${r[k] ? 'checked' : ''}></label>`;
  const sel = (k, label, opts) => `<label class="field"><span>${label}</span><select class="inline-input" data-change="rem-set" data-k="${k}">${opts.map(([v, l]) => `<option value="${v}" ${String(r[k]) === String(v) ? 'selected' : ''}>${l}</option>`).join('')}</select></label>`;
  const time = (k, label) => `<label class="field"><span>${label}</span><input class="inline-input" type="time" value="${r[k] || ''}" data-change="rem-set" data-k="${k}"></label>`;
  const h = `${Native.has && r.on && !allowed ? `<div class="banner warn">${icon('triangle-alert')}<div>Benachrichtigungen sind für Schulplan nicht erlaubt. <a data-act="rem-perm">Jetzt erlauben</a></div></div>` : ''}
    <div class="card">${sw('on', 'Benachrichtigungen', 'Schulplan erinnert dich an alles, was du planst')}</div>
    <div class="${r.on ? '' : 'hidden'}">
    <div class="card"><div class="col">
      <div class="f-section">${icon('sun')}Morgen-Übersicht</div>
      ${sw('briefing', 'Tagesübersicht am Morgen', 'Stunden, Prüfungen, Termine und Aufgaben des Tages')}
      ${r.briefing ? time('briefingTime', 'Uhrzeit') : ''}
    </div></div>
    <div class="card"><div class="col">
      <div class="f-section">${icon('clock')}Unterricht</div>
      ${sw('lessons', 'Vor jeder Stunde', 'Mit Klasse, Raum und Thema – auch bei Vertretungen')}
      ${r.lessons ? sel('lessonMin', 'Wann', [[0, 'Zum Stundenbeginn'], [2, '2 Minuten vorher'], [5, '5 Minuten vorher'], [10, '10 Minuten vorher'], [15, '15 Minuten vorher']]) : ''}
      ${sw('lessonEnd', 'Vor Stundenende', 'Erinnerung an Hausaufgabe und Klassenbuch')}
      ${r.lessonEnd ? sel('lessonEndMin', 'Wann', [[0, 'Zum Stundenende'], [3, '3 Minuten vorher'], [5, '5 Minuten vorher'], [10, '10 Minuten vorher']]) : ''}
    </div></div>
    <div class="card"><div class="col">
      <div class="f-section">${icon('calendar')}Termine & Ferien</div>
      ${sw('events', 'Termine', 'Konferenzen, Elternabende, Ausflüge …')}
      ${r.events ? sw('eventStart', 'Bei Beginn', 'Ganztägige Termine morgens um 7 Uhr') + sw('eventEnd', 'Bei Ende', 'Wenn eine Endzeit eingetragen ist') : ''}
      ${sw('holidays', 'Ferien & freie Tage', 'Am Abend vorher')}
    </div></div>
    <div class="card"><div class="col">
      <div class="f-section">${icon('file-text')}Prüfungen</div>
      ${sel('examDays', 'Vorab erinnern', [[0, 'Nicht vorab'], [1, '1 Tag vorher'], [2, '2 Tage vorher'], [3, '3 Tage vorher'], [7, '1 Woche vorher']])}
      ${r.examDays > 0 ? time('time', 'Uhrzeit') : ''}
      ${sw('examMorning', 'Am Prüfungstag morgens')}
    </div></div>
    <div class="card"><div class="col">
      <div class="f-section">${icon('list-todo')}Aufgaben & Hausaufgaben</div>
      ${sw('tasks', 'Fällige Aufgaben', 'Zur eingetragenen Uhrzeit, sonst zur Standardzeit')}
      ${r.tasks ? time('taskTime', 'Standardzeit') : ''}
      ${sw('homework', 'Hausaufgaben-Kontrolle', 'Morgens am Fälligkeitstag')}
      ${sw('followUps', 'Wiedervorlagen (Elterngespräche)')}
      ${sw('birthdays', 'Geburtstage der Schüler:innen', 'Morgens um 7 Uhr')}
    </div></div>
    <button class="btn btn-soft btn-block" data-act="rem-test">${icon('bell')}Test-Benachrichtigung (in 5 Sek.)</button>
    <div class="section-title">Als Nächstes geplant (${list.length})</div><div class="card pad0"><div class="list">${list.slice(0, 15).map((x) => `<div class="li"><div class="li-ic">${icon('bell')}</div><div class="li-main"><div class="li-t">${esc(x.title)}</div><div class="li-s">${fmtDW(iso(new Date(x.time)))} ${mint(new Date(x.time).getHours() * 60 + new Date(x.time).getMinutes())} · ${esc(x.text)}</div></div></div>`).join('') || '<div class="li muted">Keine anstehenden Erinnerungen</div>'}</div></div>
    </div>
    ${!Native.has ? '<p class="muted small">Hinweis: Benachrichtigungen funktionieren in der installierten Android-App.</p>' : ''}`;
  return { title: 'Benachrichtigungen', tab: 'more', html: h };
});
A['rem-set'] = (el) => {
  const r = S.settings.remind;
  const k = el.dataset.k;
  if (el.type === 'checkbox') r[k] = el.checked;
  else if (['examDays', 'lessonMin', 'lessonEndMin'].includes(k)) r[k] = Number(el.value);
  else r[k] = el.value;
  if (k === 'on' && el.checked) requestNotifPermission();
  save(); App.refresh();
};
A['rem-perm'] = () => requestNotifPermission();
A['rem-test'] = () => {
  const list = buildReminders();
  list.push({ code: 1999999999, time: Date.now() + 5000, title: 'Schulplan', text: 'Test: Erinnerungen funktionieren! 🎉', route: '/settings/reminders' });
  if (Native.has) { Native.call('syncReminders', JSON.stringify(list)); lastReminderJSON = null; UI.toast('Benachrichtigung kommt in 5 Sekunden'); }
  else if ('Notification' in window && Notification.permission === 'granted') setTimeout(() => new Notification('Schulplan', { body: 'Test: Erinnerungen funktionieren!' }), 5000);
  else UI.toast('Nur in der Android-App verfügbar');
};

// ------------------------------------------------------------------ Sicherheit
App.def('/settings/security', () => {
  const st = S.settings;
  const h = `<div class="banner">${icon('shield')}<div>Alle Daten bleiben auf diesem Gerät. Das Internet wird für die Update-Prüfung genutzt – und nur, wenn du sie einschaltest, für den KI-Modus des Assistenten (Anthropic) und Videoanruf-Links im Chat. Schütze sensible Schülerdaten zusätzlich mit einer PIN.</div></div>
    <div class="card pad0"><div class="list">
      ${setItem('key', st.pin ? 'PIN ändern' : 'PIN festlegen', st.pin ? 'App ist mit PIN geschützt' : '4–6 Ziffern', 'data-act="pin-set"')}
      ${st.pin ? setItem('lock-open', 'PIN entfernen', '', 'data-act="pin-remove"') : ''}
    </div></div>
    ${st.pin ? `<div class="card"><label class="field"><span>Sperren nach Verlassen der App</span><select class="inline-input" data-change="lock-delay">${[[0, 'Sofort'], [1, 'Nach 1 Minute'], [5, 'Nach 5 Minuten'], [15, 'Nach 15 Minuten'], [60, 'Nach 1 Stunde']].map(([v, l]) => `<option value="${v}" ${(st.lockDelay ?? 1) === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <button class="btn btn-soft mt" data-act="lock-now">${icon('lock')}Jetzt sperren</button></div>` : ''}
    <div class="card"><label class="field-switch field"><span class="sw-l">Bildschirmfotos verhindern<small>Inhalt erscheint nicht in Screenshots und in der App-Übersicht</small></span><input type="checkbox" class="switch" data-change="secure" ${st.secure ? 'checked' : ''}></label></div>`;
  return { title: 'App-Sperre & Datenschutz', tab: 'more', html: h };
});
A['pin-set'] = () => UI.form({
  title: 'PIN festlegen',
  fields: [
    { k: 'p1', label: 'Neue PIN (4–6 Ziffern)', type: 'password', inputmode: 'numeric', maxlength: 6 },
    { k: 'p2', label: 'PIN wiederholen', type: 'password', inputmode: 'numeric', maxlength: 6 },
  ],
  onSave: (v) => {
    if (!/^\d{4,6}$/.test(v.p1 || '')) { UI.toast('Die PIN muss aus 4–6 Ziffern bestehen', { type: 'err' }); return false; }
    if (v.p1 !== v.p2) { UI.toast('Die PINs stimmen nicht überein', { type: 'err' }); return false; }
    S.settings.pin = hashPin(v.p1); Lock.unlockedOnce = true; save(); App.refresh();
    UI.toast('PIN gespeichert – merke sie dir gut!');
  },
});
A['pin-remove'] = async () => { if (await UI.confirm('PIN-Sperre entfernen?', { ok: 'Entfernen' })) { S.settings.pin = null; save(); App.refresh(); } };
A['lock-delay'] = (el) => { S.settings.lockDelay = Number(el.value); save(); };
A['lock-now'] = () => Lock.show();
A['secure'] = (el) => { S.settings.secure = el.checked; Native.call('setSecure', el.checked); save(); };

// ------------------------------------------------------------------ Datensicherung
App.def('/settings/backup', () => {
  const st = S.settings;
  const backups = Native.has ? JSON.parse(Native.call('listBackups') || '[]') : [];
  const size = new Blob([Store.serialize()]).size;
  const h = `<div class="banner ${st.lastBackup ? 'ok' : 'warn'}">${icon('database')}<div>${st.lastBackup ? `Letzte Sicherung: <b>${fmtD(st.lastBackup.slice(0, 10))}</b>` : '<b>Noch keine Sicherung exportiert.</b>'}<br><span class="text2">Speichere regelmäßig eine Sicherung, z. B. in deiner Cloud oder auf einem USB-Stick. So sind deine Daten bei Handywechsel oder Verlust sicher.</span></div></div>
    <div class="card"><div class="col">
      <button class="btn btn-primary btn-lg" data-act="backup-export">${icon('download')}Sicherung exportieren (.json)</button>
      <button class="btn btn-lg" data-act="backup-import">${icon('upload')}Sicherung wiederherstellen</button>
      <small class="muted center">Datenmenge: ${fmtNumShort(size / 1024, 0)} KB · ${S.students.length} Schüler:innen · ${S.assessments.length} Leistungsnachweise</small>
    </div></div>
    ${Native.has ? `<div class="section-title">${icon('history')}Automatische Sicherungen (auf dem Gerät)</div>
      <p class="muted small" style="margin:-4px 4px 8px">Die App legt täglich automatisch eine Sicherung an (die letzten 14 Tage).</p>
      <div class="card pad0"><div class="list">${backups.map((b) => `<div class="li" data-act="backup-restore-auto" data-n="${esc(b.name)}"><div class="li-ic">${icon('archive')}</div><div class="li-main"><div class="li-t">${fmtDL(b.name.replace('auto-', '').replace('.json', ''))}</div><div class="li-s">${fmtNumShort(b.size / 1024, 0)} KB</div></div>${icon('rotate-ccw', 'chev')}</div>`).join('') || '<div class="li muted">Noch keine automatischen Sicherungen</div>'}</div></div>` : ''}
    <div class="section-title">${icon('file-spreadsheet')}Exporte für Excel</div>
    <div class="card pad0"><div class="list">
      ${setItem('users', 'Alle Schüler:innen (CSV)', 'Mit Kontaktdaten, Ø-Note und Fehlzeiten', 'data-act="export-all-students"')}
      ${setItem('award', 'Alle Noten (CSV)', 'Jede Bewertung als Zeile', 'data-act="export-all-grades"')}
      ${setItem('calendar', 'Termine & Prüfungen (.ics)', 'Für Google Kalender, Outlook & Co.', 'data-act="export-ics"')}
    </div></div>`;
  return { title: 'Datensicherung', tab: 'more', html: h };
});
A['backup-export'] = () => {
  S.settings.lastBackup = new Date().toISOString();
  Store.save.flush();
  Files.save(`Schulplan-Sicherung-${today()}.json`, 'application/json', JSON.stringify(S, null, 1));
  setTimeout(() => App.refresh(), 400);
};
function validBackup(d) { return d && typeof d === 'object' && d.settings && Array.isArray(d.classes) && Array.isArray(d.students); }
A['backup-import'] = async () => {
  const f = await Files.pick();
  if (!f) return;
  let d;
  try { d = JSON.parse(await Files.readText(f)); } catch (e) { UI.toast('Keine gültige Sicherungsdatei', { type: 'err' }); return; }
  if (!validBackup(d)) { UI.toast('Keine gültige Schulplan-Sicherung', { type: 'err' }); return; }
  if (!(await UI.confirm(`Sicherung mit ${d.classes.length} Klassen und ${d.students.length} Schüler:innen wiederherstellen? <b>Alle aktuellen Daten werden ersetzt.</b>`, { danger: true, ok: 'Wiederherstellen' }))) return;
  Store.replace(d);
  applyTheme();
  App.navigate('/today', { root: true });
  UI.toast('Sicherung wiederhergestellt ✓');
};
A['backup-restore-auto'] = async (el) => {
  const raw = Native.call('readBackup', el.dataset.n);
  let d; try { d = JSON.parse(raw); } catch (e) { d = null; }
  if (!validBackup(d)) { UI.toast('Sicherung ist beschädigt', { type: 'err' }); return; }
  if (!(await UI.confirm(`Auf den Stand vom ${fmtD(el.dataset.n.replace('auto-', '').replace('.json', ''))} zurücksetzen? Aktuelle Änderungen gehen verloren.`, { danger: true, ok: 'Wiederherstellen' }))) return;
  Store.replace(d); applyTheme(); App.navigate('/today', { root: true }); UI.toast('Wiederhergestellt ✓');
};
A['export-ics'] = () => exportICS();
A['export-all-students'] = () => {
  const rows = [['Klasse', 'Nachname', 'Vorname', 'Geburtstag', 'Geschlecht', 'E-Mail', 'Telefon', 'Eltern', 'Tel. Eltern', 'Mail Eltern', 'Adresse', 'Merkmale', 'Ø Note', 'Fehlstunden', 'unentschuldigt']];
  activeClasses().forEach((c) => studentsOf(c.id).forEach((s) => {
    const a = studentAverage(s.id, c.id).avg;
    const at = attStats(s.id);
    rows.push([c.name, s.lastName, s.firstName, s.birthday ? fmtD(s.birthday) : '', s.gender, s.email, s.phone, s.parentName, s.parentPhone, s.parentEmail, s.address, s.tags, a != null ? fmtNum(a) : '', at.absent, at.f]);
  }));
  Files.csv(`Schulplan_Schueler_${today()}.csv`, rows);
};
A['export-all-grades'] = () => {
  const rows = [['Klasse', 'Fach', 'Datum', 'Leistungsnachweis', 'Kategorie', 'Gewicht', 'Nachname', 'Vorname', 'Punkte', 'Note', 'Bemerkung']];
  sortBy(S.assessments, 'date').forEach((a) => {
    const gs = gsOf(a.classId);
    studentsOf(a.classId).forEach((s) => {
      const g = (a.grades || {})[s.id];
      if (g && (g.v != null || g.p != null)) rows.push([cName(a.classId), subName(a.subjectId), a.date ? fmtD(a.date) : '', a.title, (cat(a.catId) || {}).name || '', a.weight, s.lastName, s.firstName, g.p ?? '', g.v != null ? gs.format(g.v) : '', g.note || '']);
    });
  });
  Files.csv(`Schulplan_Noten_${today()}.csv`, rows);
};

// ------------------------------------------------------------------ Schuljahreswechsel & Zurücksetzen
A['set-newyear'] = () => {
  const sy = schoolYearDefaults(addDays(S.settings.yearEnd || today(), 10));
  UI.form({
    title: 'Schuljahreswechsel',
    fields: [
      { type: 'html', html: `<div class="banner warn" style="margin:0">${icon('triangle-alert')}<div>Exportiere vorher eine <b>Sicherung</b> – dann kannst du jederzeit auf das alte Schuljahr zugreifen.</div></div>` },
      { k: 'year', label: 'Neues Schuljahr', half: true },
      { k: 'hj2', label: 'Beginn 2. Halbjahr', type: 'date', half: true },
      { k: 'yearStart', label: 'Beginn', type: 'date', half: true },
      { k: 'yearEnd', label: 'Ende', type: 'date', half: true },
      { type: 'section', label: 'Was soll gelöscht werden?' },
      { k: 'grades', label: 'Noten & Leistungsnachweise', type: 'switch' },
      { k: 'att', label: 'Anwesenheit', type: 'switch' },
      { k: 'book', label: 'Klassenbuch, Reihen & Hausaufgaben', type: 'switch' },
      { k: 'obs', label: 'Beobachtungen & Mitarbeit', type: 'switch' },
      { k: 'tt', label: 'Stundenplan & Änderungen', type: 'switch' },
      { k: 'oldEvents', label: 'Vergangene Termine', type: 'switch' },
      { type: 'section', label: 'Klassen' },
      { k: 'promote', label: 'Klassenstufe hochzählen (z. B. 7a → 8a)', type: 'switch' },
    ],
    values: { ...sy, grades: true, att: true, book: true, obs: true, tt: false, oldEvents: true, promote: false },
    submit: 'Neues Schuljahr starten',
    onSave: async (v) => {
      if (!(await UI.confirm('Ausgewählte Daten jetzt löschen und das neue Schuljahr starten?', { danger: true, ok: 'Starten' }))) return false;
      const snap = deepCopy(S);
      Object.assign(S.settings, { year: v.year, hj2: v.hj2, yearStart: v.yearStart, yearEnd: v.yearEnd });
      if (v.grades) { S.assessments = []; S.finals = {}; }
      if (v.att) S.attendance = [];
      if (v.book) { S.lessons = []; S.units = []; S.homework = []; }
      if (v.obs) S.observations = [];
      if (v.tt) { S.timetable = []; S.changes = []; }
      if (v.oldEvents) S.events = S.events.filter((e) => (e.end || e.date) >= v.yearStart);
      if (v.promote) S.classes.forEach((c) => { c.name = c.name.replace(/^(\d+)/, (m) => String(Number(m) + 1)); });
      save(); App.navigate('/today', { root: true });
      UI.toast('Neues Schuljahr gestartet', { undo: () => { Store.replace(snap); App.refresh(); } });
    },
  });
};
A['set-reset'] = async () => {
  if (!(await UI.confirm('<b>Alle Daten</b> (Klassen, Schüler:innen, Noten, Termine …) unwiderruflich löschen?', { danger: true, ok: 'Weiter' }))) return;
  const txt = await UI.prompt('Zur Bestätigung „LÖSCHEN" eintippen', { ph: 'LÖSCHEN' });
  if ((txt || '').trim().toUpperCase() !== 'LÖSCHEN') { UI.toast('Abgebrochen'); return; }
  Store.replace(defaultData());
  applyTheme();
  App.navigate('/today', { root: true });
  showOnboarding();
};

// ------------------------------------------------------------------ Über
App.def('/about', () => {
  const v = Native.has ? Native.call('appVersion') : 'Web';
  return {
    title: 'Über Schulplan', tab: 'more',
    html: `<div class="ob"><div class="ob-logo">${icon('graduation-cap')}</div><h2>Schulplan</h2><p class="muted">Der Organisations-Planer für Lehrkräfte · Version ${esc(v)}</p></div>
      <div class="card"><div class="card-h"><h3>${icon('shield')}Datenschutz</h3></div><p class="text2" style="margin:0">Schulplan speichert alle Daten ausschließlich lokal auf deinem Gerät. Die App nutzt das Internet, um nach Updates zu suchen – dabei werden keine Daten übertragen. Nur wenn du den <b>KI-Modus</b> des Assistenten einschaltest, gehen deine Fragen und die dafür nötigen Einträge an Anthropic (Claude); Videoanrufe im Chat laufen über den gewählten Videodienst. Chat-Nachrichten sind Ende-zu-Ende verschlüsselt. Es gibt keine Werbung, kein Tracking und kein Konto. Für die Datensicherung exportierst du selbst eine Datei. Bitte beachte die Vorgaben deines Bundeslandes zur Verarbeitung von Schülerdaten auf privaten Endgeräten.</p></div>
      <div class="card"><div class="card-h"><h3>${icon('sparkles')}Funktionen</h3></div><p class="text2 small" style="margin:0">Stundenplan mit A/B-Wochen & Vertretungen · Klassen & Schülerprofile · Noten mit Gewichtung, Notenschlüssel & Notenspiegel · Anwesenheit & Fehlzeiten · Mitarbeit & Beobachtungen · Hausaufgaben · Klassenbuch & Unterrichtsreihen · Sitzpläne · Kalender, Ferien & Termine · Aufgaben · Notizen · Elterngespräche · Kollegium mit Einladungen, Pinnwand, Vertretungsplan & geteilten Klassenlisten · Zufallsauswahl, Gruppen, Timer, Lautstärke-Ampel u. v. m. · Erinnerungen · PIN-Sperre · CSV/ICS-Export · Drucken/PDF</p></div>
      <div class="card"><div class="card-h"><h3>${icon('file-text')}Lizenzen</h3></div><p class="text2 small" style="margin:0">Symbole: Lucide Icons (ISC-Lizenz), © Lucide Contributors · Schrift: Inter (SIL Open Font License 1.1), © The Inter Project Authors · QR-Codes: qrcode-generator (MIT), © Kazuhiko Arase; jsQR (Apache License 2.0), © Cosmo Wolfe · KI-Modus: Anthropic TypeScript SDK (Apache License 2.0), © Anthropic, PBC.</p></div>`,
  };
});

A['desk-widget'] = (el) => { Native.call('toggleWidget', el.checked); UI.toast(el.checked ? 'Desktop-Widget eingeblendet' : 'Desktop-Widget ausgeblendet'); };
A['app-badge'] = (el) => {
  S.settings.appBadge = el.checked;
  save();
  if (el.checked && 'Notification' in window && Notification.permission === 'default') Notification.requestPermission().then(() => updateAppBadge());
  updateAppBadge();
};
App.onWidgetState = () => { if (App.path === '/settings') App.refresh(); };
