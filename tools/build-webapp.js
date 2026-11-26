// Baut die Web-App (installierbar über Edge/Chrome/Safari) nach docs/app.
// Aufruf: node tools/build-webapp.js
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const src = path.join(root, 'app', 'src', 'main', 'assets', 'www');
const dst = path.join(root, 'docs', 'app');
const gradle = fs.readFileSync(path.join(root, 'app', 'build.gradle'), 'utf8');
const version = (gradle.match(/versionName '([^']+)'/) || [])[1] || 'dev';

fs.rmSync(dst, { recursive: true, force: true });
fs.cpSync(src, dst, { recursive: true });

const files = [];
(function walk(dir) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) walk(p);
    else files.push(path.relative(dst, p).split(path.sep).join('/'));
  }
})(dst);
const list = ['./', ...files.filter((f) => f !== 'sw.js')];

const sw = `/* Schulplan Web-App – Offline-Speicher. Automatisch erzeugt (tools/build-webapp.js), Version ${version} */
const CACHE = 'schulplan-${version}';
const FILES = ${JSON.stringify(list, null, 0)};
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
`;
fs.writeFileSync(path.join(dst, 'sw.js'), sw);
console.log(`Web-App ${version} nach docs/app gebaut (${list.length} Dateien im Offline-Speicher)`);
