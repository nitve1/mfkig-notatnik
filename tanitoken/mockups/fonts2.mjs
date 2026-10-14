// 10 kolejnych par krojów jako proste próbki (jedna grafika), bez pełnych makiet.
//   node tanitoken/mockups/fonts2.mjs  -> mockups/fonts2.html + fonts2.png
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const DIR = dirname(fileURLToPath(import.meta.url));
const P = [
  ['Tablica LED', 'Doto', 'Reddit Sans', 'Doto', 'Ceny jak na świecącej tablicy z kropek.'],
  ['Moda', 'Zalando Sans Expanded', 'Zalando Sans', 'Zalando Sans Expanded', 'Szeroki, pewny siebie grotesk w jednej rodzinie.'],
  ['Piksel', 'Bitcount Prop Single', 'Host Grotesk', 'Bitcount Prop Single', 'Cyfrowe, pikselowe nagłówki i ceny, czysty tekst.'],
  ['Mozilla', 'Mozilla Headline', 'Mozilla Text', 'Mozilla Headline', 'Nowa, techniczna rodzina z ostrym rytmem.'],
  ['Gazeta', 'Darker Grotesque', 'Darker Grotesque', 'Spline Sans Mono', 'Ściśnięty, gazetowy grotesk i mono w cenach.'],
  ['Techno', 'Tomorrow', 'Tomorrow', 'Kode Mono', 'Ścięte kąty jak w sprzęcie, mono do liczb.'],
  ['Luksus', 'Bodoni Moda', 'Red Hat Text', 'Reddit Mono', 'Kontrastowy Bodoni z chłodnym mono w cenach.'],
  ['Pas startowy', 'Michroma', 'Red Hat Text', 'Michroma', 'Bardzo szeroki, „lotniczy” krój w nagłówkach.'],
  ['Miękki kod', 'Parkinsans', 'Parkinsans', 'Google Sans Code', 'Zaokrąglony, przyjazny tekst i czytelne mono.'],
  ['Retro CRT', 'Sixtyfour', 'Afacad Flux', 'Sixtyfour', 'Ekran starego monitora w nagłówkach i cenach.'],
];
const fams = [...new Set(P.flatMap((p) => [p[1], p[2], p[3]]))];

async function cssFor(f) {
  for (const axis of [':wght@400..900', ':wght@400;700', '']) {
    const url = `https://fonts.googleapis.com/css2?family=${f.replace(/ /g, '+')}${axis}&display=block`;
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 Chrome/141' } });
    if (r.ok) return url;
  }
  throw new Error(`brak ${f}`);
}
const links = (await Promise.all(fams.map(cssFor))).map((u) => `<link rel="stylesheet" href="${u}">`).join('');

const card = ([name, d, t, n, note], i) => `<div class="c">
  <div class="meta"><b>${i + 1}. ${name}</b> · ${d}${t !== d ? ` + ${t}` : ''}${n !== d && n !== t ? ` + ${n}` : ''}</div>
  <div class="h" style="font-family:'${d}'">Co dziś tanieje?</div>
  <div class="row"><div><div class="nm" style="font-family:'${t}'">GLM 5.2 – zażółć gęślą</div><div class="sub" style="font-family:'${t}'">Kod · OpenRouter, przez Decart</div></div>
  <div class="pr" style="font-family:'${n}'">0,273 $<span>−58%</span></div></div>
  <div class="note" style="font-family:'${t}'">${note}</div></div>`;

const html = `<!doctype html><meta charset="utf-8">${links}<style>
body{margin:0;padding:20px;background:#0c0a17;background-image:radial-gradient(circle at 10% 20%,#3d63ff55,transparent 40%),radial-gradient(circle at 90% 60%,#8b3dff55,transparent 40%),radial-gradient(circle at 30% 95%,#ff8a0044,transparent 40%);color:#f3f1fb;font-family:sans-serif;width:1160px}
.g{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.c{background:rgba(30,26,52,.55);border:1px solid rgba(255,255,255,.1);box-shadow:inset 0 1px 0 rgba(255,255,255,.3);border-radius:14px;padding:16px 18px}
.meta{font:12px sans-serif;color:#b4b0cc;margin-bottom:8px}.meta b{color:#fff}
.h{font-size:34px;font-weight:800;line-height:1.05;margin-bottom:12px}
.row{display:flex;justify-content:space-between;align-items:center;background:rgba(255,255,255,.05);border-radius:12px;padding:10px 12px;border-left:4px solid #a875ff}
.nm{font-size:16px;font-weight:700}.sub{font-size:13px;color:#b4b0cc;margin-top:2px}
.pr{font-size:24px;font-weight:700;text-align:right;white-space:nowrap}.pr span{display:block;font:700 12px sans-serif;color:#fff;background:#ff5c63;border-radius:6px;padding:2px 6px;margin-top:4px;display:inline-block;margin-left:8px;vertical-align:middle}
.note{font-size:14px;color:#b4b0cc;margin-top:10px}
</style><div class="g">${P.map(card).join('')}</div>`;
const file = join(DIR, 'fonts2.html');
writeFileSync(file, html);
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await b.newPage({ viewport: { width: 1200, height: 800 }, deviceScaleFactor: 1.5 });
await p.goto(pathToFileURL(file).href, { waitUntil: 'networkidle' });
await p.evaluate(() => document.fonts.ready);
await p.waitForTimeout(400);
await p.screenshot({ path: file.replace('.html', '.png'), fullPage: true });
await b.close();
console.log('ok');
