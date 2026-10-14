// Archivo w 4 wariantach (oś szerokości wdth 62–125 i grubości), proste próbki.
//   node tanitoken/mockups/fonts3.mjs -> mockups/fonts3.png
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const DIR = dirname(fileURLToPath(import.meta.url));
// [nazwa, nagłówek {wdth, wght}, ceny {wdth, wght}, tekst {wdth}, opis]
const V = [
  ['A. Archivo klasyczne', [100, 800], [100, 700], 100, 'Jedna szerokość wszędzie. Spokojne, solidne, czytelne.'],
  ['B. Szerokie nagłówki', [125, 800], [112, 700], 100, 'Nagłówki i ceny rozciągnięte, tekst normalny. Najwięcej charakteru.'],
  ['C. Wąskie nagłówki', [62, 800], [75, 700], 100, 'Wąskie, wysokie nagłówki i ceny jak w tabeli notowań, tekst normalny.'],
  ['D. Black + wąskie ceny', [110, 900], [70, 600], 95, 'Bardzo grube nagłówki, wąskie ceny, lekko ściśnięty tekst.'],
];
const f = (w) => `font-family:'Archivo';font-stretch:${w[0]}%;font-weight:${w[1]}`;
const card = ([name, h, n, t, note]) => `<div class="c">
  <div class="meta"><b>${name}</b> · nagłówki ${h[0]}% / ${h[1]}, ceny ${n[0]}% / ${n[1]}</div>
  <div class="h" style="${f(h)}">Co dziś tanieje?</div>
  <div class="row" style="font-stretch:${t}%"><div><div class="nm">GLM 5.2 – zażółć gęślą</div><div class="sub">Kod · OpenRouter, przez Decart</div></div>
  <div class="pr" style="${f(n)}">0,273 $<span>−58%</span></div></div>
  <div class="tiles"><div style="background:#6d8cffd9"><b style="${f(h)}">Tekst</b><i style="${f(n)}">90</i></div><div style="background:#ffa23ad9"><b style="${f(h)}">Wideo</b><i style="${f(n)}">100</i></div></div>
  <div class="note" style="font-stretch:${t}%">${note}</div></div>`;
const html = `<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,100..900&display=block"><style>
body{margin:0;padding:20px;background:#0c0a17;background-image:radial-gradient(circle at 10% 20%,#3d63ff55,transparent 40%),radial-gradient(circle at 90% 60%,#8b3dff55,transparent 40%);color:#f3f1fb;font-family:'Archivo';width:1160px}
.g{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.c{background:rgba(30,26,52,.55);border:1px solid rgba(255,255,255,.1);box-shadow:inset 0 1px 0 rgba(255,255,255,.3);border-radius:14px;padding:16px 18px}
.meta{font-size:12px;color:#b4b0cc;margin-bottom:8px}.meta b{color:#fff}
.h{font-size:36px;line-height:1.05;margin-bottom:12px}
.row{display:flex;justify-content:space-between;align-items:center;background:rgba(255,255,255,.05);border-radius:12px;padding:10px 12px;border-left:4px solid #a875ff}
.nm{font-size:16px;font-weight:700}.sub{font-size:13px;color:#b4b0cc;margin-top:2px}
.pr{font-size:24px;white-space:nowrap}.pr span{font:700 12px Archivo;font-stretch:100%;color:#fff;background:#ff5c63;border-radius:6px;padding:2px 6px;margin-left:8px;vertical-align:middle}
.tiles{display:flex;gap:8px;margin-top:10px}.tiles div{flex:1;border-radius:12px;padding:10px 12px;display:flex;justify-content:space-between;align-items:center}.tiles b{font-size:16px}.tiles i{font-style:normal;font-size:24px}
.note{font-size:14px;color:#b4b0cc;margin-top:10px}
</style><div class="g">${V.map(card).join('')}</div>`;
const file = join(DIR, 'fonts3.html');
writeFileSync(file, html);
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await b.newPage({ viewport: { width: 1200, height: 600 }, deviceScaleFactor: 1.5 });
await p.goto(pathToFileURL(file).href, { waitUntil: 'networkidle' });
await p.evaluate(() => document.fonts.ready);
await p.waitForTimeout(300);
await p.screenshot({ path: file.replace('.html', '.png'), fullPage: true });
await b.close();
