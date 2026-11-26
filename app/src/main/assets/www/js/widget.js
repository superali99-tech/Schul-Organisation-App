/* Desktop-Widget (Windows & Mac): nächste Stunde, heutige Stunden, Aufgaben, nächste Prüfung */
'use strict';

function wIcon(name) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ''}</svg>`;
}
if (typeof teamMemberName === 'undefined') {
  window.teamMemberName = (id, short) => {
    const m = S.team && S.team.members.find((x) => x.id === id);
    return m ? (short ? m.short || m.name : [m.title, m.name].filter(Boolean).join(' ')) : '?';
  };
}
function wLabel(l) {
  const c = cls(l.classId);
  const parts = [c ? c.name : (l.change && l.change.note) || l.note || 'Stunde'];
  if (subName(l.subjectId)) parts.push(subName(l.subjectId));
  return parts.join(' · ');
}
function wRoom(l) { return l.roomChange || l.room || (cls(l.classId) || {}).room || ''; }
const open = (route) => Native.call('openRoute', route);

let pinned = false;
function render() {
  Store.load();
  const dark = S.settings.theme === 'dark' || (S.settings.theme !== 'light' && Native.call('isSystemDark'));
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.documentElement.style.setProperty('--accent', dark ? '#8f97ff' : (S.settings.accent || '#4f46e5'));
  const td = today();
  const nm = nowMin();
  const d = pd(td);
  document.getElementById('title').innerHTML = `Schulplan<small>${WDS[dow(td)]}, ${d.getDate()}.${d.getMonth() + 1}.</small>`;
  const ls = lessonsOn(td).filter((l) => !l.holiday);
  const active = ls.filter((l) => !l.cancelled);
  let h = '';
  // Jetzt / Als Nächstes
  let cur = null, next = null;
  for (const l of active) {
    const p = periodTime(l.period);
    if (!p) continue;
    const s = tmin(p.s), e = tmin(p.e);
    if (nm >= s && nm < e) cur = { l, s, e };
    else if (nm < s && !next) next = { l, s, e };
  }
  const hol = holidayOn(td);
  if (cur) {
    h += `<div class="now" data-r="/lesson/${td}/${cur.l.period}"><div class="l">Jetzt · ${cur.l.period + 1}. Stunde</div><div class="t">${esc(wLabel(cur.l))}</div>
      <div class="m">${wRoom(cur.l) ? 'Raum ' + esc(wRoom(cur.l)) + ' · ' : ''}noch ${cur.e - nm} Min.</div><div class="bar"><i style="width:${Math.round(100 * (nm - cur.s) / (cur.e - cur.s))}%"></i></div></div>`;
  } else if (next) {
    const mins = next.s - nm;
    h += `<div class="now" data-r="/lesson/${td}/${next.l.period}"><div class="l">Als Nächstes · ${mins < 60 ? 'in ' + mins + ' Min.' : mint(next.s) + ' Uhr'}</div><div class="t">${esc(wLabel(next.l))}</div>
      <div class="m">${wRoom(next.l) ? 'Raum ' + esc(wRoom(next.l)) + ' · ' : ''}${mint(next.s)}–${mint(next.e)}</div></div>`;
  } else if (hol) {
    h += `<div class="now"><div class="l">Frei</div><div class="t">${esc(hol.title)}</div><div class="m">Schöne freie Zeit!</div></div>`;
  } else {
    // Nächster Schultag
    let nd = null, first = null;
    for (let i = 1; i < 14 && !nd; i++) { const x = addDays(td, i); const a = lessonsOn(x).filter((l) => !l.cancelled && !l.holiday); if (a.length) { nd = x; first = a[0]; } }
    if (nd) h += `<div class="now" data-r="/lesson/${nd}/${first.period}"><div class="l">${relDay(nd)} · ${first.period + 1}. Stunde</div><div class="t">${esc(wLabel(first))}</div><div class="m">${(periodTime(first.period) || {}).s || ''} Uhr${wRoom(first) ? ' · Raum ' + esc(wRoom(first)) : ''}</div></div>`;
    else h += `<div class="now" data-r="/timetable"><div class="l">Stundenplan</div><div class="t">Keine Stunden</div><div class="m">Trage deinen Stundenplan ein</div></div>`;
  }
  // Heute
  const dayOver = ls.length && ls.every((l) => tmin((periodTime(l.period) || {}).e) <= nm);
  if (ls.length && !dayOver) {
    h += `<div class="sec">Heute</div><div>${ls.map((l) => {
      const p = periodTime(l.period) || {};
      const past = tmin(p.e) <= nm;
      return `<div class="row ${past ? 'past' : ''} ${l.cancelled ? 'cancel' : ''}" data-r="/lesson/${td}/${l.period}"><span class="n">${l.period + 1}.</span><span class="c" style="background:${subjectColor(l.subjectId, l.classId)}"></span><span class="x"><b>${esc(wLabel(l))}</b><span>${l.cancelled ? 'Entfällt' : esc([wRoom(l) ? 'Raum ' + wRoom(l) : '', p.s ? p.s + '–' + p.e : ''].filter(Boolean).join(' · '))}</span></span></div>`;
    }).join('')}</div>`;
  }
  // Aufgaben
  const tasks = sortBy(S.tasks.filter((t) => !t.done), (t) => t.due || '9999', (t) => -(t.prio || 0));
  h += `<div class="sec">Aufgaben · ${tasks.length} offen</div><div>${tasks.slice(0, 4).map((t) => {
    const over = t.due && t.due < td;
    return `<div class="row" data-r="/tasks"><span class="n">${t.prio === 2 ? '!!' : t.prio === 1 ? '!' : '○'}</span><span class="x"><b>${esc(t.title)}</b>${t.cat ? `<span>${esc(t.cat)}</span>` : ''}</span>${t.due ? `<span class="pill ${over ? 'red' : ''}">${relDay(t.due)}</span>` : ''}</div>`;
  }).join('') || '<div class="empty">Alles erledigt 🎉</div>'}</div>`;
  // Nächste Prüfung
  const exam = sortBy(S.assessments.filter((a) => a.date && a.date >= td && (cat(a.catId) || {}).exam), 'date')[0];
  if (exam) h += `<div class="sec">Nächste Prüfung</div><div class="row" data-r="/assessment/${exam.id}"><span class="x"><b>${esc(exam.title)}</b><span>${esc(cName(exam.classId))}</span></span><span class="pill ${daysBetween(td, exam.date) <= 2 ? 'red' : ''}">${relDay(exam.date)}</span></div>`;
  document.getElementById('body').innerHTML = h;
}

document.getElementById('logo').innerHTML = wIcon('graduation-cap');
document.getElementById('open').innerHTML = wIcon('external-link');
document.getElementById('close').innerHTML = wIcon('x');
const pinBtn = document.getElementById('pin');
const drawPin = () => { pinBtn.innerHTML = wIcon(pinned ? 'pin' : 'pin-off'); pinBtn.classList.toggle('on', pinned); pinBtn.title = pinned ? 'Nicht mehr im Vordergrund' : 'Immer im Vordergrund'; };
pinned = location.hash.includes('pinned');
drawPin();
pinBtn.addEventListener('click', () => { pinned = !pinned; drawPin(); Native.call('widgetPin', pinned); });
document.getElementById('open').addEventListener('click', () => open('/today'));
document.getElementById('close').addEventListener('click', () => Native.call('widgetClose'));
document.getElementById('body').addEventListener('click', (e) => { const r = e.target.closest('[data-r]'); if (r) open(r.dataset.r); });
window.addEventListener('message', (e) => { if (e.data && e.data.schulplanRefresh) render(); });
render();
setInterval(render, 30000);
