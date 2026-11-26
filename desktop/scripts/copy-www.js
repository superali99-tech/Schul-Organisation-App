// Kopiert die gemeinsame Oberfläche (aus der Android-App) in den Desktop-Ordner.
const fs = require('fs');
const path = require('path');
const src = path.join(__dirname, '..', '..', 'app', 'src', 'main', 'assets', 'www');
const dst = path.join(__dirname, '..', 'www');
fs.rmSync(dst, { recursive: true, force: true });
// WebM-Videos braucht nur die Web-App (Electron spielt MP4/H.264 ab) – spart Platz im Installer
fs.cpSync(src, dst, { recursive: true, filter: (p) => !p.endsWith('.webm') });
console.log('www kopiert:', dst);
