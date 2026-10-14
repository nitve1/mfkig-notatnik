// Krok 3: gdzie dać obracającą się świecącą krawędź i w jakich kolorach (tło: kolory kategorii, szkło: połysk).
//   node tanitoken/mockups/glow.mjs -> mockups/glow.png (+ glow.html z prawdziwą animacją)
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const DIR = dirname(fileURLToPath(import.meta.url));
const BG = 'radial-gradient(70% 40% at 0% 0%,#3d63ffaa 0%,transparent 60%),radial-gradient(70% 40% at 100% 25%,#ff8a00aa 0%,transparent 60%),radial-gradient(70% 45% at 0% 75%,#ff4f8baa 0%,transparent 60%),radial-gradient(70% 40% at 100% 100%,#8b3dff88 0%,transparent 60%),linear-gradient(180deg,#0b0a12,#0b0a12)';
const COL = {
  rainbow: '#6d8cff,#a875ff,#ff6fa3,#ffa23a,#6d8cff',
  cat: '#ffa23a33 0deg,#ffa23a 90deg,#fff 150deg,#ffa23a 210deg,#ffa23a33 300deg,#ffa23a33 360deg',
  silver: '#ffffff22 0deg,#cfd6ff 90deg,#ffffff 150deg,#cfd6ff 210deg,#ffffff22 300deg,#ffffff22 360deg',
  sunset: '#ff6fa333 0deg,#ff6fa3 80deg,#ffa23a 150deg,#fff 180deg,#ffa23a 220deg,#ff6fa333 300deg,#ff6fa333 360deg',
};
// [nazwa, opis, który element świeci]
const WHERE = [
  ['1. Kafel „Wszystkie promocje”', 'Świeci tylko podsumowanie na górze. Jeden mocny akcent na ekranie.', 'hero'],
  ['2. Największa zniżka', 'Świeci pierwsza karta na liście (najlepsza okazja teraz).', 'top'],
  ['3. Model, którego używasz', 'Świeci karta „Używam” w zakładce Moje, gdy promocja trwa.', 'mine'],
  ['4. Aktywna zakładka menu', 'Świeci podświetlona zakładka w pasku na dole.', 'nav'],
];
const COLORS = [
  ['a. Kolory kategorii', 'niebieski, fiolet, róż, pomarańcz', 'rainbow'],
  ['b. Kolor elementu', 'np. pomarańcz dla wideo', 'cat'],
  ['c. Srebrne światło', 'biały błysk, bez koloru', 'silver'],
  ['d. Róż i pomarańcz', 'ciepły, „zachód słońca”', 'sunset'],
];
const glow = (on, col = 'rainbow') => (on ? `glow" style="--g:${COL[col]}` : '');
const phone = ([name, note, k]) => `<div><div class="ph">
  <div class="h">Co dziś tanieje?</div>
  <div class="wrap ${glow(k === 'hero')}"><div class="hero gl"><div><small>Wszystkie promocje</small><b class="big">92</b></div><div style="text-align:right"><small>największa</small><b class="big">−80%</b></div></div></div>
  <div class="wrap ${glow(k === 'top' || k === 'mine')}"><div class="card gl"><div class="r"><div><b>${k === 'mine' ? 'Używasz: GLM 5.2' : 'Mercury 2.5'}</b><small>${k === 'mine' ? 'promocja trwa 3 dni' : 'OpenRouter, przez Inception'}</small></div><div class="p">${k === 'mine' ? '0,273 $' : '0,04 $'}<span>−${k === 'mine' ? 58 : 80}%</span></div></div></div></div>
  <div class="wrap"><div class="card gl"><div class="r"><div><b>Veo 3.1 Fast</b><small>fal.ai</small></div><div class="p">0,10 $</div></div></div></div>
  <div class="nav gl"><div class="wrap navw ${glow(k === 'nav')}"><i class="on">Promocje</i></div><i>◎</i><i>☆</i><i>◯</i></div></div>
  <p class="n"><b>${name}</b><br>${note}</p></div>`;
const swatch = ([name, note, c]) => `<div><div class="sw"><div class="wrap glow" style="--g:${COL[c]}"><div class="card gl"><div class="r"><div><b>Mercury 2.5</b><small>OpenRouter</small></div><div class="p">0,04 $<span>−80%</span></div></div></div></div></div><p class="n"><b>${name}</b><br>${note}</p></div>`;
const html = `<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;600;700;800&display=block"><style>
@property --a{syntax:"<angle>";initial-value:0deg;inherits:false}
@keyframes spin{to{--a:360deg}}
body{margin:0;padding:18px;background:#e7e5ee;font-family:Archivo;width:1180px;color:#f5f3fb}
h2{color:#1a1530;font:800 18px Archivo;margin:4px 0 10px}
.g4{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:18px}
.ph{height:400px;border-radius:24px;overflow:hidden;background:${BG};padding:16px 12px;position:relative;box-sizing:border-box}
.sw{border-radius:20px;background:${BG};padding:22px 14px}
.h{font:800 21px Archivo;margin:4px 4px 12px}
.gl{border-radius:14px;background:linear-gradient(180deg,rgba(255,255,255,.16) 0%,rgba(255,255,255,.06) 40%,rgba(255,255,255,.03) 100%);backdrop-filter:blur(16px) saturate(1.5);border:1px solid rgba(255,255,255,.16);box-shadow:inset 0 1px 12px rgba(255,255,255,.07),0 10px 26px rgba(0,0,0,.4)}
.wrap{border-radius:15.5px;margin-top:8px;position:relative}
.wrap.glow{padding:1.5px;background:conic-gradient(from var(--a),var(--g));animation:spin 4s linear infinite}
.wrap.glow::before{content:"";position:absolute;inset:-6px;border-radius:20px;background:inherit;filter:blur(12px);opacity:.55;z-index:-1}
.wrap.glow>.gl{background-color:#16131f;border-color:transparent}
.hero{display:flex;justify-content:space-between;padding:10px 12px}.big{font:800 22px Archivo}
.card{padding:10px 11px}.r{display:flex;justify-content:space-between;align-items:center;gap:6px}
b{font-weight:700;font-size:13px;display:block}small{font-size:10.5px;opacity:.75;display:block}
.p{font:800 15px Archivo;text-align:right;white-space:nowrap}.p span{display:block;font-size:10px;background:#ff5c63;border-radius:5px;padding:1px 4px;margin-top:3px}
.nav{position:absolute;left:10px;right:10px;bottom:12px;height:46px;border-radius:18px;display:flex;align-items:center;gap:3px;padding:4px;box-sizing:border-box}
.nav>i{font-style:normal;font-size:12px;width:34px;text-align:center;opacity:.75}
.navw{flex:1;height:100%;margin:0;border-radius:14px}.navw i{font-style:normal;display:grid;place-items:center;height:100%;border-radius:13px;background:rgba(255,255,255,.2);font-weight:700;font-size:12px}
.navw.glow i{background:#2a2438}
.n{font-size:12px;color:#3a3750;margin:8px 2px 0}.n b{display:inline;font-size:13px}
</style><h2>Gdzie? (kolory kategorii w przykładzie)</h2><div class="g4">${WHERE.map(phone).join('')}</div>
<h2>Jaki kolor?</h2><div class="g4">${COLORS.map(swatch).join('')}</div>`;
const file = join(DIR, 'glow.html');
writeFileSync(file, html);
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await b.newPage({ viewport: { width: 1216, height: 800 }, deviceScaleFactor: 1.5 });
await p.goto(pathToFileURL(file).href, { waitUntil: 'networkidle' });
await p.evaluate(() => document.fonts.ready);
await p.waitForTimeout(1400);
await p.screenshot({ path: file.replace('.html', '.png'), fullPage: true });
await b.close();
