/* Schulplan – Website: Menü, Geräteerkennung für Downloads, Prüfsummen kopieren */
(function () {
  'use strict';
  var BASE = 'https://raw.githubusercontent.com/superali99-tech/Schul-Organisation-App/HEAD/release/';
  var DL = {
    android: { url: BASE + 'Schulplan.apk', label: 'Für Android herunterladen', sub: 'Version 2.4.0 · 1,8 MB' },
    windows: { url: BASE + 'Schulplan-Setup.exe', label: 'Für Windows herunterladen', sub: 'Version 2.4.0 · 76 MB' },
    macArm: { url: BASE + 'Schulplan-Mac-AppleSilicon.zip', label: 'Für Mac herunterladen', sub: 'Apple Silicon · Version 2.4.0 · 96 MB' },
    macIntel: { url: BASE + 'Schulplan-Mac-Intel.zip', label: 'Für Mac herunterladen', sub: 'Intel · Version 2.4.0 · 101 MB' },
    linux: { url: BASE + 'Schulplan-Linux.deb', label: 'Für Linux herunterladen', sub: '.deb für Ubuntu, Mint, Debian · Version 2.4.0 · 70 MB' },
    linuxAppImage: { url: BASE + 'Schulplan-Linux.AppImage', label: 'Für Linux herunterladen', sub: 'AppImage · Version 2.4.0 · 78 MB' },
    web: { url: 'app/', label: 'Web-App öffnen', sub: 'Läuft im Browser, auch offline' },
    ios: { url: 'app/', label: 'Für iPhone öffnen', sub: 'In Safari → Teilen → Zum Home-Bildschirm' }
  };

  // Menü auf kleinen Bildschirmen
  var btn = document.querySelector('.menu-btn');
  var nav = document.querySelector('.nav');
  if (btn && nav) {
    btn.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    nav.addEventListener('click', function (e) { if (e.target.closest('a')) { nav.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); } });
  }

  // Gerät erkennen
  var ua = navigator.userAgent || '';
  var plat = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || '';
  var os = 'unknown';
  if (/android/i.test(ua)) os = 'android';
  else if (/iphone|ipad|ipod/i.test(ua) || (/mac/i.test(plat) && navigator.maxTouchPoints > 1)) os = 'ios';
  else if (/win/i.test(plat) || /windows/i.test(ua)) os = 'windows';
  else if (/mac/i.test(plat) || /mac os x/i.test(ua)) os = 'mac';
  else if (/cros/i.test(ua)) os = 'web';
  else if (/linux/i.test(plat) || /linux|x11/i.test(ua)) os = 'linux';

  // Linux: Fedora, openSUSE, Arch & Co. bekommen das AppImage zuerst, Ubuntu/Mint/Debian das .deb
  var linuxPkg = /fedora|red hat|suse|arch|manjaro/i.test(ua) ? 'appimage' : 'deb';

  var macChip = 'arm';
  if (os === 'mac') {
    try {
      var gl = document.createElement('canvas').getContext('webgl');
      var ext = gl && gl.getExtension('WEBGL_debug_renderer_info');
      var r = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : '';
      if (/intel|amd|radeon|nvidia/i.test(r) && !/apple/i.test(r)) macChip = 'intel';
    } catch (e) { /* Standard: Apple Silicon */ }
  }

  var key = os === 'mac' ? (macChip === 'intel' ? 'macIntel' : 'macArm') : os === 'linux' && linuxPkg === 'appimage' ? 'linuxAppImage' : os;
  var card = document.querySelector('[data-platform="' + (os === 'mac' ? 'mac' : os) + '"]');
  if (os === 'ios') { var ih = document.getElementById('ios-note'); if (ih) ih.remove(); }
  if (card) {
    card.classList.add('recommended');
    var b = document.createElement('span');
    b.className = 'badge';
    b.textContent = 'Für dein Gerät';
    card.prepend(b);
  }
  if (os === 'mac') {
    var first = document.querySelector('[data-mac="' + macChip + '"]');
    if (first) { first.classList.remove('btn-ghost'); first.classList.add('btn-primary'); }
    var other = document.querySelector('[data-mac="' + (macChip === 'arm' ? 'intel' : 'arm') + '"]');
    if (other) { other.classList.remove('btn-primary'); other.classList.add('btn-ghost'); }
  }

  if (os === 'linux' && linuxPkg === 'appimage') {
    var ai = document.querySelector('[data-linux="appimage"]');
    var deb = document.querySelector('[data-linux="deb"]');
    if (ai && deb) { ai.classList.replace('btn-ghost', 'btn-primary'); deb.classList.replace('btn-primary', 'btn-ghost'); }
  }

  var hero = document.getElementById('hero-dl');
  if (hero && DL[key]) {
    hero.href = DL[key].url;
    hero.querySelector('[data-l]').textContent = DL[key].label;
    hero.querySelector('[data-s]').textContent = DL[key].sub;
  }
  var ios = document.getElementById('ios-note');
  if (ios && os === 'ios') ios.hidden = false;

  // Prüfsummen kopieren
  document.addEventListener('click', function (e) {
    var c = e.target.closest('.copy');
    if (!c) return;
    var code = c.parentElement.querySelector('code');
    var text = code ? code.textContent : '';
    var done = function () { c.textContent = 'Kopiert'; setTimeout(function () { c.textContent = 'Kopieren'; }, 1600); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { select(code); });
    } else select(code);
  });
  function select(el) {
    if (!el) return;
    var range = document.createRange();
    range.selectNodeContents(el);
    var s = window.getSelection();
    s.removeAllRanges();
    s.addRange(range);
  }
})();
