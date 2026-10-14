// Krok 1: 6 teł z prawdziwymi, płynnymi gradientami + ta sama szklana karta na każdym.
//   node tanitoken/mockups/bg.mjs -> mockups/bg.png
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const DIR = dirname(fileURLToPath(import.meta.url));
const B = [
  ['1. Zorza', 'Miękkie smugi zieleni i turkusu nad granatem, jak zorza polarna.',
    'radial-gradient(120% 60% at 10% 0%,#0f766e 0%,transparent 60%),radial-gradient(90% 50% at 100% 30%,#155e75 0%,transparent 65%),radial-gradient(100% 60% at 50% 100%,#1e1b4b 0%,transparent 70%),linear-gradient(180deg,#05070f,#0b1020)'],
  ['2. Zachód słońca', 'Ciepłe przejście od bursztynu przez koral do głębokiej śliwki.',
    'radial-gradient(110% 55% at 85% 0%,#f59e0b 0%,transparent 55%),radial-gradient(90% 60% at 0% 45%,#e11d48aa 0%,transparent 65%),radial-gradient(120% 70% at 60% 100%,#3b0a2a 0%,transparent 70%),linear-gradient(170deg,#1a0b14,#0a0610)'],
  ['3. Grafit i miedź', 'Prawie czarny grafit z jednym miedzianym poblaskiem. Najbardziej powściągliwe.',
    'radial-gradient(90% 55% at 100% 0%,#b45309cc 0%,transparent 60%),radial-gradient(80% 50% at 0% 100%,#78350f88 0%,transparent 65%),linear-gradient(160deg,#121212,#0a0a0a 60%,#14100c)'],
  ['4. Głębia oceanu', 'Od turkusu u góry do prawie czarnego granatu na dole, jak zejście pod wodę.',
    'radial-gradient(120% 50% at 50% -10%,#0891b2 0%,transparent 60%),radial-gradient(80% 50% at 100% 60%,#0e7490aa 0%,transparent 60%),linear-gradient(180deg,#062530,#03121a 55%,#020a10)'],
  ['5. Neon miasta', 'Ciemne tło z dwiema silnymi plamami: limonka i magenta. Energetycznie.',
    'radial-gradient(70% 45% at 0% 10%,#84cc16aa 0%,transparent 60%),radial-gradient(70% 45% at 100% 85%,#db2777aa 0%,transparent 60%),linear-gradient(160deg,#0a0a0f,#101018)'],
  ['6. Kolory kategorii', 'Cztery kolory kategorii płynnie przenikające się (siatka gradientów), bez ostrych granic.',
    'radial-gradient(70% 40% at 0% 0%,#3d63ffaa 0%,transparent 60%),radial-gradient(70% 40% at 100% 25%,#ff8a00aa 0%,transparent 60%),radial-gradient(70% 45% at 0% 75%,#ff4f8baa 0%,transparent 60%),radial-gradient(70% 40% at 100% 100%,#8b3dff88 0%,transparent 60%),linear-gradient(180deg,#0b0a12,#0b0a12)'],
];
const phone = ([name, note, bg]) => `<div><div class="ph" style="background:${bg}">
  <div class="h">Co dziś tanieje?</div>
  <div class="card"><div class="r"><div><b>GLM 5.2</b><small>OpenRouter, przez Decart</small></div><div class="p">0,273 $<span>−58%</span></div></div></div>
  <div class="card"><div class="r"><div><b>Veo 3.1 Fast</b><small>fal.ai</small></div><div class="p">0,10 $</div></div></div>
  <div class="nav"><i class="on">Promocje</i><i>◎</i><i>☆</i><i>◯</i></div></div>
  <p class="n"><b>${name}</b><br>${note}</p></div>`;
const html = `<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;600;700;800&display=block"><style>
body{margin:0;padding:18px;background:#e7e5ee;font-family:Archivo;width:1180px}
.g{display:grid;grid-template-columns:repeat(6,1fr);gap:14px}
.ph{height:420px;border-radius:24px;padding:16px 12px;position:relative;overflow:hidden;color:#f5f3fb}
.h{font:800 21px Archivo;margin:8px 4px 12px}
.card{border-radius:14px;padding:10px 11px;margin-bottom:8px;background:rgba(255,255,255,.07);backdrop-filter:blur(18px) saturate(1.5);border:1px solid rgba(255,255,255,.12)}
.r{display:flex;justify-content:space-between;align-items:center;gap:6px}
b{font-weight:700;font-size:13px;display:block}small{font-size:10.5px;opacity:.7}
.p{font:800 15px Archivo;text-align:right;white-space:nowrap}.p span{display:block;font-size:10px;background:#ff5c63;border-radius:5px;padding:1px 4px;margin-top:3px}
.nav{position:absolute;left:10px;right:10px;bottom:12px;height:44px;border-radius:16px;display:flex;align-items:center;gap:3px;padding:4px;background:rgba(255,255,255,.06);backdrop-filter:blur(18px);border:1px solid rgba(255,255,255,.12)}
.nav i{font-style:normal;font-size:11px;width:30px;text-align:center;opacity:.75}.nav i.on{flex:1;height:100%;border-radius:12px;background:rgba(255,255,255,.14);display:grid;place-items:center;opacity:1;font-weight:700}
.n{font-size:12px;color:#3a3750;margin:8px 2px 0}.n b{display:inline;font-size:13px}
</style><div class="g">${B.map(phone).join('')}</div>`;
const file = join(DIR, 'bg.html');
writeFileSync(file, html);
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await b.newPage({ viewport: { width: 1216, height: 560 }, deviceScaleFactor: 1.5 });
await p.goto(pathToFileURL(file).href, { waitUntil: 'networkidle' });
await p.evaluate(() => document.fonts.ready);
await p.screenshot({ path: file.replace('.html', '.png'), fullPage: true });
await b.close();
