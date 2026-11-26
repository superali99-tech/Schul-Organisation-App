// Erzeugt app/src/main/assets/www/js/icons.js aus dem Lucide-Iconset (ISC-Lizenz).
// Aufruf: node tools/build-icons.js <pfad-zu-lucide-static/icons>
const fs = require('fs');
const path = require('path');
const dir = process.argv[2];
const names = `house calendar calendar-days clock users user graduation-cap book-open notebook-pen clipboard-list
clipboard-check square-check list-todo sticky-note settings menu ellipsis layout-grid plus minus x check chevron-left
chevron-right chevron-down chevron-up arrow-left trash-2 pencil search star pin bell phone mail message-circle shuffle
dice-5 timer alarm-clock hourglass mic volume-2 calculator percent chart-column chart-pie download upload save printer
share-2 lock lock-open sun moon palette school building door-open map-pin briefcase award trophy thumbs-up thumbs-down
smile frown triangle-alert info circle-help file-text file-spreadsheet folder layers repeat refresh-cw rotate-ccw play
pause square skip-forward filter eye eye-off copy link cake heart flag target lightbulb armchair presentation user-plus
user-x user-check circle-check circle circle-dot coffee umbrella plane bus handshake messages-square book library
pen-line notebook sparkles zap gauge activity hash at-sign external-link database shield key history archive tag
bookmark inbox arrow-right-left replace calendar-clock calendar-check calendar-plus list list-checks traffic-cone siren
package backpack ban arrow-up-down move square-pen file-down file-up coins dices megaphone circle-x circle-minus
circle-plus users-round sliders-horizontal type alarm-clock-check badge-check pin-off grid-3x3 table timer-reset
notebook-text scroll-text send log-out qr-code scan-line cloud bell-ring arrow-right user-round message-square-text
crown shield-check calendar-range user-minus thermometer`.split(/\s+/).filter(Boolean);
const out = {};
for (const n of names) {
  const svg = fs.readFileSync(path.join(dir, n + '.svg'), 'utf8');
  const inner = svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>[\s\S]*$/, '')
    .replace(/\s*\n\s*/g, '').trim();
  out[n] = inner;
}
const js = '/* Icons: Lucide (https://lucide.dev), ISC-Lizenz. Automatisch erzeugt mit tools/build-icons.js */\n' +
  'const ICONS = ' + JSON.stringify(out, null, 0).replace(/","/g, '",\n"') + ';\n';
fs.writeFileSync('app/src/main/assets/www/js/icons.js', js);
console.log('icons:', names.length, 'bytes:', js.length);
