// Czytelność: 4 poziomy stonowania tła "Kolory kategorii" + poprawki tekstu (makieta do wyboru).
//   node tanitoken/mockups/tone.mjs -> mockups/tone.png
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const DIR = dirname(fileURLToPath(import.meta.url));
const mesh = (a, top = false) => {
  const h = (x) => Math.round(x * 255).toString(16).padStart(2, '0');
  const k = h(a); const k2 = h(a * 0.8);
  return top
    ? `radial-gradient(90% 30% at 0% 0%,#3d63ff${k} 0%,transparent 70%),radial-gradient(90% 30% at 100% 0%,#ff8a00${k} 0%,transparent 70%),radial-gradient(80% 25% at 0% 100%,#ff4f8b${h(a * 0.5)} 0%,transparent 70%),radial-gradient(80% 25% at 100% 100%,#8b3dff${h(a * 0.5)} 0%,transparent 70%),#0b0a12`
    : `radial-gradient(70% 40% at 0% 0%,#3d63ff${k} 0%,transparent 60%),radial-gradient(70% 40% at 100% 25%,#ff8a00${k} 0%,transparent 60%),radial-gradient(70% 45% at 0% 75%,#ff4f8b${k} 0%,transparent 60%),radial-gradient(70% 40% at 100% 100%,#8b3dff${k2} 0%,transparent 60%),#0b0a12`;
};
// [nazwa, opis, tło, poprawki tekstu?, najgorszy kontrast ink2/ink3 (policzony)]
const V = [
  ['0. Obecne', 'Plamy 67%. Pod kartą na pomarańczu szary tekst ma 2,8:1, jasnoszary 1,4:1.', mesh(0.67), false, '2,8 / 1,4'],
  ['1. Stonowane', 'Plamy 40% + poprawki tekstu. Każdy tekst min. 4,5:1 (norma WCAG AA).', mesh(0.40), true, '7,8 / 5,1'],
  ['2. Delikatne', 'Plamy 25% + poprawki. Kolor nadal czuć, tekst bez problemu.', mesh(0.25), true, '8,9 / 5,8'],
  ['3. Kolor tylko na brzegach', 'Plamy 45% tylko przy górnej i dolnej krawędzi, środek z listą ciemny.', mesh(0.45, true), true, 'ok. 10 / 7 przy liście'],
];
const phone = ([name, note, bg, fix, cr]) => `<div><div class="ph ${fix ? 'fix' : ''}" style="background:${bg}">
  <div class="h">Co dziś tanieje?</div><div class="sub">Cześć, Ania</div>
  <div class="tiles"><div class="t t1"><b>92</b><span>Tekst</span><small>do −80%</small></div><div class="t t4"><b>0</b><span>Wideo</span><small>brak zniżek</small></div></div>
  <div class="card"><div class="r"><div><b class="nm">Mercury 2.5</b><span class="cat">Tekst</span> <span class="i2">OpenRouter, przez Inception</span></div><div class="p">0,04 $<em>−80%</em></div></div><div class="i3">/ 1M tokenów wejścia · zniżka od 2 dni</div></div>
  <div class="card"><div class="r"><div><b class="nm">Veo 3.1 Fast</b><span class="cat v">Wideo</span> <span class="i2">fal.ai</span></div><div class="p">0,10 $</div></div><div class="i3">najniższa cena, za sekundę</div></div>
  <div class="card"><div class="r"><div><b class="nm">FLUX.2 Pro</b><span class="cat im">Obraz</span> <span class="i2">Vercel AI Gateway</span></div><div class="p">0,03 $</div></div><div class="i3">najniższa cena, za obraz</div></div>
  </div><p class="n"><b>${name}</b> · najgorszy kontrast szarego/jasnoszarego: <b>${cr}</b><br>${note}</p></div>`;
const html = `<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700;800&display=block"><style>
body{margin:0;padding:18px;background:#e7e5ee;font-family:Archivo;width:1180px}
.g{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}
.ph{height:520px;border-radius:24px;overflow:hidden;padding:18px 12px;color:#f3f1fb;box-sizing:border-box}
.h{font:800 22px Archivo}.sub{font-size:13px;color:#b4b0cc;margin:2px 0 12px}
.tiles{display:flex;gap:8px;margin-bottom:8px}.t{flex:1;border-radius:14px;padding:10px;color:#fff;display:grid}.t b{font:800 22px Archivo;justify-self:end}.t span{font-weight:700;font-size:14px}.t small{font-size:11.5px}
.t1{background:#6d8cffd9}.t4{background:#ffa23ad9}
.card{border-radius:14px;padding:10px 12px;margin-top:8px;border:1px solid rgba(255,255,255,.16);background:linear-gradient(180deg,rgba(255,255,255,.16),rgba(255,255,255,.06) 40%,rgba(255,255,255,.03)),rgba(11,10,18,.22);backdrop-filter:blur(16px) saturate(1.5)}
.r{display:flex;justify-content:space-between;gap:6px}.nm{display:block;font-size:15px}
.cat{font-size:13px;font-weight:600;color:#6d8cff}.cat.v{color:#ffa23a}.cat.im{color:#ff6fa3}.i2{font-size:13px;color:#b4b0cc}
.i3{font-size:11.5px;color:#7e7a98;margin-top:5px}
.p{font:800 18px Archivo;text-align:right;white-space:nowrap}.p em{display:block;font:700 11px Archivo;background:#ff5c63;border-radius:6px;padding:1px 5px;margin-top:3px;font-style:normal}
/* poprawki czytelności */
.fix .card{background:linear-gradient(180deg,rgba(255,255,255,.12),rgba(255,255,255,.05) 40%,rgba(255,255,255,.03)),rgba(11,10,18,.55)}
.fix .i2,.fix .sub{color:#c9c5dd}.fix .i3{color:#a29eba;font-size:12.5px}.fix .t small{font-size:12.5px;font-weight:600}
.fix .cat:not(.v):not(.im){color:#8aa2ff}.fix .t1{background:#4a63d8}.fix .t4{background:#a8530a}
.n{font-size:12px;color:#3a3750;margin:8px 2px 0}.n b{font-size:13px}
</style><div class="g">${V.map(phone).join('')}</div>`;
const file = join(DIR, 'tone.html');
writeFileSync(file, html);
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await b.newPage({ viewport: { width: 1216, height: 640 }, deviceScaleFactor: 1.5 });
await p.goto(pathToFileURL(file).href, { waitUntil: 'networkidle' });
await p.evaluate(() => document.fonts.ready);
await p.screenshot({ path: file.replace('.html', '.png'), fullPage: true });
await b.close();
