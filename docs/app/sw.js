/* Schulplan Web-App – Offline-Speicher. Automatisch erzeugt (tools/build-webapp.js), Version 2.2.0 */
const CACHE = 'schulplan-2.2.0';
const FILES = ["./","css/app.css","fonts/inter.woff2","icon.png","icons/apple-touch-icon.png","icons/icon-192.png","icons/icon-512.png","icons/maskable-512.png","index.html","js/app.js","js/core.js","js/demo.js","js/festive.js","js/icons.js","js/ui.js","js/views/assistant.js","js/views/attendance.js","js/views/calendar.js","js/views/chat.js","js/views/classes.js","js/views/grades.js","js/views/homework.js","js/views/leader.js","js/views/lesson.js","js/views/more.js","js/views/notes.js","js/views/planning.js","js/views/school.js","js/views/seating.js","js/views/settings.js","js/views/students.js","js/views/talks.js","js/views/tasks.js","js/views/team.js","js/views/timetable.js","js/views/today.js","js/views/tools.js","js/views/update.js","js/widget.js","manifest.webmanifest","media/vertretung.jpg","media/vertretung.mp4","media/vertretung.webm","vendor/anthropic-sdk.js","vendor/jsQR.js","vendor/qrcode.js","widget.html"];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('schulplan-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  // Zuerst aus dem Speicher (schnell & offline), im Hintergrund aktualisieren
  e.respondWith(caches.open(CACHE).then((c) => c.match(req, { ignoreSearch: true }).then((hit) => {
    const net = fetch(req).then((res) => { if (res && res.ok) c.put(req, res.clone()); return res; }).catch(() => hit);
    return hit || net;
  })));
});
