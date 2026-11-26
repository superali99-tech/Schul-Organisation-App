// Setzt Symbol und Versionsinfos der Schulplan.exe (ohne Wine, rein in JavaScript).
const fs = require('fs');
const path = require('path');
const ResEdit = require('resedit');

// Linux-AppImage: Startskript vor das Programm setzen. Im AppImage kann der Chromium-Sandbox-Helfer
// nicht mit Root-Rechten laufen; wo User-Namespaces gesperrt sind (z. B. Ubuntu 24.04), würde die
// App sonst gar nicht starten. Dort – und nur dort – startet Schulplan deshalb ohne Sandbox
// (es lädt ausschließlich eigene, lokale Inhalte). Das .deb-Paket braucht das nicht.
function linuxAppImageLauncher(context) {
  const exe = path.join(context.appOutDir, context.packager.executableName);
  const bin = exe + '-bin';
  if (fs.existsSync(bin)) return;
  fs.renameSync(exe, bin);
  fs.writeFileSync(exe, `#!/bin/sh
HERE="$(dirname "$(readlink -f "$0")")"
NOSANDBOX=""
if [ "$(cat /proc/sys/kernel/apparmor_restrict_unprivileged_userns 2>/dev/null)" = "1" ] || ! unshare --user true >/dev/null 2>&1; then
  NOSANDBOX="--no-sandbox"
fi
exec "$HERE/${path.basename(bin)}" $NOSANDBOX "$@"
`, { mode: 0o755 });
  console.log('  • AppImage-Startskript gesetzt');
}

exports.default = async function afterPack(context) {
  if (context.electronPlatformName === 'linux') {
    if (process.env.SCHULPLAN_APPIMAGE) linuxAppImageLauncher(context);
    return;
  }
  if (context.electronPlatformName !== 'win32') return;
  const exe = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.exe`);
  const ico = path.join(__dirname, '..', 'build', 'icon.ico');
  const version = context.packager.appInfo.version;
  const exeObj = ResEdit.NtExecutable.from(fs.readFileSync(exe), { ignoreCert: true });
  const res = ResEdit.NtExecutableResource.from(exeObj);
  const iconFile = ResEdit.Data.IconFile.from(fs.readFileSync(ico));
  const groups = ResEdit.Resource.IconGroupEntry.fromEntries(res.entries);
  const target = groups[0] || { id: 1, lang: 1033 };
  ResEdit.Resource.IconGroupEntry.replaceIconsForResource(res.entries, target.id, target.lang, iconFile.icons.map((i) => i.data));
  const vis = ResEdit.Resource.VersionInfo.fromEntries(res.entries);
  const vi = vis[0] || ResEdit.Resource.VersionInfo.createEmpty();
  const [a, b, c] = version.split('.').map((x) => parseInt(x, 10) || 0);
  vi.setFileVersion(a, b, c, 0, 1033);
  vi.setProductVersion(a, b, c, 0, 1033);
  const langs = vi.getAllLanguagesForStringValues();
  const lang = langs[0] || { lang: 1033, codepage: 1200 };
  vi.setStringValues(lang, {
    FileDescription: 'Schulplan',
    ProductName: 'Schulplan',
    CompanyName: 'Astrid Lindgren Schule',
    LegalCopyright: 'Astrid Lindgren Schule',
    OriginalFilename: 'Schulplan.exe',
    InternalName: 'Schulplan',
    FileVersion: version,
    ProductVersion: version,
  });
  vi.outputToResourceEntries(res.entries);
  res.outputResource(exeObj);
  fs.writeFileSync(exe, Buffer.from(exeObj.generate()));
  console.log('  • Symbol & Versionsinfo gesetzt:', path.basename(exe));
};
