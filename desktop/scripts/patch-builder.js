// electron-builder benötigt unter Linux normalerweise Wine, um das Deinstallationsprogramm
// aus dem NSIS-Installer zu lösen. Der eingebaute JavaScript-Leser (UninstallerReader,
// sonst nur für macOS genutzt) kann das ohne Wine – diesen Weg aktivieren wir hier.
const fs = require('fs');
const path = require('path');
const f = path.join(__dirname, '..', 'node_modules', 'app-builder-lib', 'out', 'targets', 'nsis', 'NsisTarget.js');
let s = fs.readFileSync(f, 'utf8');
const from = 'if ((0, macosVersion_1.isMacOsCatalina)()) {';
if (s.includes(from)) {
  s = s.replace(from, 'if (process.platform !== "win32" || (0, macosVersion_1.isMacOsCatalina)()) { // gepatcht: ohne Wine');
  fs.writeFileSync(f, s);
  console.log('electron-builder gepatcht (Deinstaller ohne Wine)');
} else {
  console.log('electron-builder bereits gepatcht');
}
