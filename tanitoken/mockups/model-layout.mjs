// Czytelność karty modelu: 3 warianty hierarchii (makieta do wyboru, 2026-10-14).
//   node tanitoken/mockups/model-layout.mjs -> mockups/model-layout.png
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const DIR = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(DIR, 'feat12.mjs'), 'utf8');
// Wspólne style z makiety historii (fonty, tło, szkło).
const pre = src.slice(src.indexOf('const M ='), src.indexOf('// 30 dni cen'));
const { css, BLUE, ORANGE } = new Function('readFileSync', 'join', 'DIR', `${pre}; return { css, BLUE, ORANGE };`)(readFileSync, join, DIR);
const CAT = '#4a63d8';
const extra = `
.ph{height:760px;overflow:hidden;position:relative}
.cat{font:600 12.5px A;color:#8aa2ff}.name{font:800 28px A;margin:2px 0}.meta{font:500 13px A;color:#c9c5dd}
.hero{border-radius:16px;padding:14px;margin:12px 0 10px;border:1px solid rgba(138,162,255,.45);background:linear-gradient(180deg,rgba(74,99,216,.42),rgba(74,99,216,.18));}
.hero .lab{font:600 12.5px A;color:#dfe4ff}.hero .val{font:800 34px A;line-height:1.1}.hero .sub{font:500 13px A;color:#dfe4ff}
.btns{display:flex;gap:8px;margin:10px 0}.b{flex:1;text-align:center;border-radius:12px;padding:11px 0;font:700 14px A;border:1px solid rgba(255,255,255,.22)}.b.p{background:#f3f1fb;color:#100e1b;border-color:#f3f1fb}
.flat{padding:4px 2px 12px}.flat p{font:400 14px/1.45 A;color:#c9c5dd}.tags{font:500 13px/1.7 A;color:#a29eba}
.offer{display:flex;justify-content:space-between;align-items:center;padding:11px 0;border-bottom:1px solid rgba(255,255,255,.08)}.offer b{font:700 15px A}.offer .pr{font:800 17px A}
.hd{font:700 13px A;color:#a29eba;letter-spacing:.2px;margin:16px 0 6px;text-transform:none}
.mini{height:46px;margin:6px 0 2px}
.pill{display:inline-block;font:700 12px A;padding:3px 7px;border-radius:7px;background:rgba(255,92,99,.16);color:#ff8a8f;margin-left:6px}
.tabs{display:flex;gap:18px;border-bottom:1px solid rgba(255,255,255,.12);margin:12px 0 10px}.tabs span{font:700 14px A;color:#a29eba;padding:10px 0}.tabs .on{color:#fff;box-shadow:inset 0 -2px 0 ${CAT === '#4a63d8' ? '#8aa2ff' : '#fff'}}
.lvl2{background:rgba(255,255,255,.07);border-radius:14px;padding:14px;margin-bottom:10px;border:1px solid rgba(255,255,255,.10)}
.lvl1{border-radius:14px;padding:12px 14px;margin-bottom:10px;background:rgba(11,10,18,.45)}
.fade{position:absolute;left:0;right:0;bottom:0;height:60px;background:linear-gradient(transparent,#0b0a12)}`;
const spark = `<svg class="mini" width="300" height="46"><path d="M0,30H80V22H170V34H240V38H300" fill="none" stroke="${BLUE}" stroke-width="2"/><path d="M0,14H200V20H300" fill="none" stroke="${ORANGE}" stroke-width="2"/></svg>`;
const head = `<div class="cat">● Tekst</div><div class="name">Mercury 2.5</div><div class="meta">Inception · 260K kontekstu · 3 oferty</div>`;
const offers = `<div class="offer"><div><b>OpenRouter</b><span class="pill">−80%</span><div class="i3">0,04 / 0,15 $ za 1M</div></div><div class="pr">0,70 $</div></div>
<div class="offer"><div><b>Vercel AI Gateway</b><div class="i3">0,04 / 0,15 $ za 1M</div></div><div class="pr">0,70 $</div></div>
<div class="offer"><div><b>Kilo Gateway</b><div class="i3">0,20 / 0,75 $ za 1M</div></div><div class="pr">3,50 $</div></div>`;

const now = `${head}<div class="card" style="margin-top:12px"><p class="i2" style="font-size:14px;line-height:1.45">Mercury 2.5 is Inception's diffusion-based reasoning model for chat, agents, and structured workflows…</p></div>
<div class="sec">Do czego się nada</div><div class="chips" style="margin-bottom:10px">${['Czat i pisanie', 'Agenci i narzędzia', 'Rozumowanie', 'Długie dokumenty'].map((c) => `<span class="chip">${c}</span>`).join('')}</div>
<div class="card"><span class="i2"><b>Przykład:</b> „Sprawdź dzisiejsze zamówienia w API sklepu…”</span></div>
<div class="row" style="align-items:stretch"><div class="card" style="flex:1"><div class="i2">Najtaniej miesięcznie</div><div class="big">0,7 $</div></div><div class="card" style="flex:1"><div class="i2">Oszczędzasz</div><div class="big save">2,80 $</div></div></div><div class="fade"></div>`;

const A = `${head}
<div class="hero"><div class="lab">Najtaniej przy Twoim zużyciu</div><div class="val">0,70 $ <span style="font:600 15px A">/ mies.</span></div><div class="sub">OpenRouter · o 2,80 $ taniej niż najdroższa oferta</div></div>
<div class="btns"><div class="b p">Używam…</div><div class="b">☆ Obserwuj</div></div>
<div class="hd">Oferty</div>${offers}
<div class="hd">Historia ceny, 30 dni</div>${spark}
<div class="hd">O modelu</div><div class="flat"><p>Model rozumujący do czatu, agentów i pracy z danymi. 260K kontekstu…</p><div class="tags">Czat · Agenci · Rozumowanie · Długie dokumenty · JSON</div></div><div class="fade"></div>`;

const B = `<div style="margin:-16px -16px 0;padding:16px;background:linear-gradient(180deg,rgba(74,99,216,.55),rgba(74,99,216,0))">${head}
<div class="row" style="margin-top:14px;align-items:flex-end"><div><div class="i2">Najtaniej / mies.</div><div class="val" style="font:800 34px A">0,70 $</div></div><div style="text-align:right"><div class="i2">Oszczędzasz</div><div style="font:800 22px A;color:#33cf95">2,80 $</div></div></div></div>
<div class="btns"><div class="b p">Używam…</div><div class="b">☆ Obserwuj</div></div>
<div class="lvl2"><div class="sec">Oferty</div>${offers}</div>
<div class="lvl1"><div class="sec" style="font-size:14.5px">Historia ceny</div>${spark}</div>
<div class="lvl1"><div class="sec" style="font-size:14.5px">O modelu</div><p class="i2">Model rozumujący do czatu, agentów i pracy z danymi…</p></div><div class="fade"></div>`;

const C = `${head}
<div class="hero"><div class="lab">Najtaniej przy Twoim zużyciu</div><div class="val">0,70 $ <span style="font:600 15px A">/ mies.</span></div><div class="sub">OpenRouter · oszczędzasz 2,80 $</div></div>
<div class="btns"><div class="b p">Używam…</div><div class="b">☆ Obserwuj</div></div>
<div class="tabs"><span class="on">Oferty 3</span><span>Historia</span><span>O modelu</span></div>${offers}
<div class="i3" style="margin-top:10px">Linki „Partner” są partnerskie, kolejność zależy tylko od ceny.</div>`;

const V = [
  ['0. Teraz', 'Wszystko w takich samych kartach, cena dopiero po opisie i chipach. Nic nie dominuje.', now],
  ['A. Cena na górze, reszta lżej', 'Jeden wyróżniony panel w kolorze kategorii. Oferty jako lista bez kart. Opis i zastosowania na dole, jako tekst.', A],
  ['B. Kolor w nagłówku, 2 poziomy', 'Nagłówek podświetlony kolorem kategorii. Oferty na jaśniejszej karcie (ważne), historia i opis ciemniej.', B],
  ['C. Cena na górze + zakładki', 'Jak A, ale oferty, historia i opis w zakładkach. Najkrótszy ekran, mniej przewijania.', C],
];
const html = `<!doctype html><meta charset="utf-8"><style>${css}${extra}</style><body>${V.map(([t, n, h]) => `<div class="col"><div class="vt">${t}</div><div class="vn">${n}</div><div class="ph">${h}</div></div>`).join('')}
<div class="note" style="flex-basis:100%">Zasady: jeden dominujący element na ekran, maks. 3 poziomy wyróżnienia, ważniejsze = jaśniejsza powierzchnia, kolor tylko jako akcent, nie wszystko w kartach (grupowanie odstępem). Dane przykładowe.</div></body>`;
const f = join(DIR, 'model-layout.html');
writeFileSync(f, html);
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await br.newPage({ viewport: { width: 880, height: 600 }, deviceScaleFactor: 1.5 });
await p.goto(pathToFileURL(f).href); await p.evaluate(() => document.fonts.ready);
await p.screenshot({ path: join(DIR, 'model-layout.png'), fullPage: true });
await br.close();
