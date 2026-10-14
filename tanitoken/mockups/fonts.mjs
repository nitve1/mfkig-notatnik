// 5 propozycji kroju pisma na makiecie "Nocne szkło" (g2-noc.html z glass.mjs).
//   node tanitoken/mockups/fonts.mjs [--png]   (najpierw: node tanitoken/mockups/glass.mjs)
// Fonty z Google Fonts (wszystkie mają polskie znaki i paczki @expo-google-fonts do apki).
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const DIR = dirname(fileURLToPath(import.meta.url));
const base = readFileSync(join(DIR, 'g2-noc.html'), 'utf8');

const FONTS = [
  {
    file: 'f1-gielda', name: '1. Giełda', pair: 'Big Shoulders Display + Barlow',
    note: 'Wąskie, wysokie nagłówki i ceny jak na tablicy notowań. Dużo liczb mieści się w jednej linii.',
    gf: 'family=Big+Shoulders+Display:wght@600;700;800&family=Barlow:wght@400;500;600;700',
    display: "'Big Shoulders Display'", dw: 800, text: "'Barlow'", num: "'Big Shoulders Display'", nw: 700, numSize: 1.15,
  },
  {
    file: 'f2-redakcja', name: '2. Redakcja', pair: 'Young Serif + Instrument Sans',
    note: 'Szeryfowe nagłówki jak w magazynie finansowym, spokojny bezszeryfowy tekst. Poważnie, nie „startupowo”.',
    gf: 'family=Young+Serif&family=Instrument+Sans:wght@400;500;600;700',
    display: "'Young Serif'", dw: 400, text: "'Instrument Sans'", num: "'Instrument Sans'", nw: 700, numSize: 1,
  },
  {
    file: 'f3-terminal', name: '3. Terminal', pair: 'Chivo + Chivo Mono',
    note: 'Jedna rodzina: grotesk do treści, mono do cen i liczb, więc kolumny cen równo się układają.',
    gf: 'family=Chivo:wght@400;500;600;700;800;900&family=Chivo+Mono:wght@400;500;600;700',
    display: "'Chivo'", dw: 900, text: "'Chivo'", num: "'Chivo Mono'", nw: 600, numSize: 0.95,
  },
  {
    file: 'f4-sygnal', name: '4. Sygnał', pair: 'Anybody (szeroki) + Atkinson Hyperlegible Next',
    note: 'Szerokie, mocne nagłówki z charakterem i tekst zaprojektowany pod maksymalną czytelność.',
    gf: 'family=Anybody:wdth,wght@50..150,400..900&family=Atkinson+Hyperlegible+Next:wght@400;500;600;700',
    display: "'Anybody'", dw: 800, stretch: '125%', text: "'Atkinson Hyperlegible Next'", num: "'Anybody'", nw: 700, numStretch: '110%', numSize: 0.95,
  },
  {
    file: 'f5-kantor', name: '5. Kantor', pair: 'Gloock + Familjen Grotesk + Azeret Mono',
    note: 'Kontrastowy szeryf w nagłówkach, ciepły grotesk w tekście i techniczne mono w cenach.',
    gf: 'family=Gloock&family=Familjen+Grotesk:wght@400;500;600;700&family=Azeret+Mono:wght@400;500;600',
    display: "'Gloock'", dw: 400, text: "'Familjen Grotesk'", num: "'Azeret Mono'", nw: 500, numSize: 0.88,
  },
];

const outputs = [];
for (const F of FONTS) {
  let html = base
    .replace(/@font-face\{[^}]*\}\n?/g, '')
    .replace(/<title>[^<]*<\/title>/, `<title>LightTokenz – ${F.name}</title><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?${F.gf}&display=block" rel="stylesheet">`)
    .replace(/font:(\d+) ([\d.]+px(?:\/[\d.]+)?) BricB?/g, (m, w, size) => `font:${F.dw} ${size} ${F.display}`)
    .replace(/font:(\d+) ([\d.]+px(?:\/[\d.]+)?) Fig/g, (m, w, size) => `font:${w} ${size} ${F.text}`)
    .replace(/font-family:Fig,sans-serif/, `font-family:${F.text},sans-serif`)
    .replace(/<h1 class="v">[^<]*<\/h1><p class="v">[^<]*<\/p>/, `<h1 class="v">${F.name} <span style="font:500 18px ${F.text};color:#4d4a63">${F.pair}</span></h1><p class="v">${F.note}</p>`);
  const css = `
  .h1,.sec,.tile .l{font-family:${F.display};font-weight:${F.dw};${F.stretch ? `font-stretch:${F.stretch};` : ''}letter-spacing:${F.dw < 500 ? '-.2px' : '-.4px'}}
  .card .num,.offer .c,.fact .v,.tile .n,.wide .n{font-family:${F.num};font-weight:${F.nw};font-variant-numeric:tabular-nums;${F.numStretch ? `font-stretch:${F.numStretch};` : ''}}
  .card .num{font-size:${20 * F.numSize}px} .tile .n{font-size:${26 * F.numSize}px} .offer .c,.fact .v{font-size:${18 * F.numSize}px}
  h1.v{font-family:${F.display};font-weight:${F.dw};${F.stretch ? `font-stretch:${F.stretch};` : ''}}
  `;
  html = html.replace('</style>', `${css}</style>`);
  const file = join(DIR, `${F.file}.html`);
  writeFileSync(file, html);
  outputs.push(file);
}
console.log(outputs.join('\n'));

if (process.argv.includes('--png')) {
  const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--allow-file-access-from-files'] });
  const p = await b.newPage({ viewport: { width: 1290, height: 1010 }, deviceScaleFactor: 2 });
  for (const f of outputs) {
    await p.goto(pathToFileURL(f).href, { waitUntil: 'networkidle' });
    await p.evaluate(() => document.fonts.ready);
    await p.waitForTimeout(500);
    await p.screenshot({ path: f.replace(/\.html$/, '.png'), fullPage: true });
  }
  await b.close();
}
