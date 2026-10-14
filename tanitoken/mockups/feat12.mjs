// Makiety do wyboru: 1) historia ceny w karcie modelu (A–D), 2) gotowe profile zużycia (1–3).
//   node tanitoken/mockups/feat12.mjs -> mockups/history.png, mockups/usage.png
// Kolory serii sprawdzone walidatorem (tryb ciemny, powierzchnia #17141f): #6a86f5 + #d27818.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const DIR = dirname(fileURLToPath(import.meta.url));
const M = join(DIR, '../mobile');
const b64 = (p) => readFileSync(join(M, p)).toString('base64');
const fontFace = (w, f) => `@font-face{font-family:A;font-weight:${w};src:url(data:font/ttf;base64,${b64(`node_modules/@expo-google-fonts/archivo/${f}/Archivo_${f}.ttf`)})}`;
const BG = `data:image/jpeg;base64,${b64('assets/backdrop.jpg')}`;
const BLUE = '#6a86f5', ORANGE = '#d27818';

const css = `${fontFace(400, '400Regular')}${fontFace(500, '500Medium')}${fontFace(600, '600SemiBold')}${fontFace(700, '700Bold')}${fontFace(800, '800ExtraBold')}
*{box-sizing:border-box;margin:0}body{background:#0b0a12;font-family:A;color:#f3f1fb;padding:28px;display:flex;gap:22px;flex-wrap:wrap;width:822px}
.col{width:372px}.vt{font:800 22px A;margin-bottom:4px}.vn{font:400 14px/1.4 A;color:#c9c5dd;margin-bottom:12px;min-height:40px}
.ph{width:372px;border-radius:22px;padding:16px;background:#0b0a12 url(${BG}) center/cover;border:1px solid #2a2638}
.card{border-radius:14px;border:1px solid rgba(255,255,255,.16);background:linear-gradient(180deg,rgba(255,255,255,.12),rgba(255,255,255,.05) 40%,rgba(255,255,255,.03)),rgba(11,10,18,.55);padding:14px;margin-bottom:10px}
.h{font:800 22px A;margin-bottom:2px}.k{font:400 13px A;color:#a29eba;margin-bottom:12px}.sec{font:700 16px A;margin-bottom:8px}
.i2{color:#c9c5dd;font-size:13.5px}.i3{color:#a29eba;font-size:12.5px}.row{display:flex;justify-content:space-between;align-items:center;gap:8px}
.seg{display:flex;background:rgba(255,255,255,.06);border-radius:10px;padding:3px;margin-bottom:10px}.seg span{flex:1;text-align:center;font:600 13px A;color:#c9c5dd;padding:8px 0;border-radius:8px}.seg .on{background:rgba(255,255,255,.16);color:#fff}
.big{font:800 30px A}.save{color:#33cf95;font-weight:700}.deal{color:#ff5c63;font-weight:700}
.leg{display:flex;gap:14px;font:500 12.5px A;color:#c9c5dd;margin:4px 0 6px}.leg i{display:inline-block;width:14px;height:3px;border-radius:2px;vertical-align:middle;margin-right:6px}
.tip{position:absolute;background:#1a1730;border:1px solid rgba(255,255,255,.2);border-radius:8px;padding:6px 8px;font:500 12px A;color:#f3f1fb;white-space:nowrap}
.chips{display:flex;flex-wrap:wrap;gap:8px}.chip{border:1px solid rgba(255,255,255,.16);border-radius:10px;padding:10px 12px;font:600 13.5px A;color:#c9c5dd;background:rgba(255,255,255,.04)}.chip.on{background:rgba(255,255,255,.16);color:#fff;border-color:rgba(255,255,255,.35)}
.tiles{display:grid;grid-template-columns:1fr 1fr;gap:8px}.tl{border:1px solid rgba(255,255,255,.16);border-radius:12px;padding:10px;background:rgba(255,255,255,.04)}.tl.on{background:rgba(255,255,255,.14);border-color:rgba(255,255,255,.4)}
.tl b{display:block;font:700 14.5px A}.tl small{display:block;color:#a29eba;font-size:12px;margin:3px 0 6px}.tl em{font:700 14px A;font-style:normal;color:#f3f1fb}
.sent{font:500 17px/1.6 A;color:#c9c5dd}.sent u{text-decoration:none;color:#fff;border-bottom:2px dashed rgba(255,255,255,.4);font-weight:700}
.btn{margin-top:10px;background:#f3f1fb;color:#100e1b;border-radius:12px;text-align:center;font:700 14px A;padding:12px}
.note{font:400 13px/1.45 A;color:#a29eba;margin-top:14px;max-width:1200px}`;

// 30 dni cen (USD / 1M tokenów wejścia).
const days = 30;
const low = Array.from({ length: days }, (_, d) => (d >= 7 && d < 12 ? 0.14 : d >= 22 ? 0.2 : 0.28));
const yours = Array.from({ length: days }, (_, d) => (d >= 18 ? 0.3 : 0.35));
const promos = [[7, 12, 'Promo DeepInfra'], [22, 30, 'Promo Novita']];
const W = 306, H = 130, PL = 34, PB = 18, PT = 8;
const x = (d) => PL + (d / (days - 1)) * (W - PL - 6);
const y = (v) => PT + (1 - v / 0.4) * (H - PT - PB);
const zl = (v) => v.toFixed(2).replace('.', ',');
const axes = () => [0, 0.2, 0.4].map((v) => `<line x1="${PL}" x2="${W - 6}" y1="${y(v)}" y2="${y(v)}" stroke="rgba(255,255,255,.08)"/><text x="${PL - 6}" y="${y(v) + 4}" text-anchor="end" fill="#a29eba" font-size="11">${zl(v)}</text>`).join('')
  + [[0, '15 wrz'], [14, '29 wrz'], [29, 'dziś']].map(([d, l], i) => `<text x="${x(d)}" y="${H - 3}" text-anchor="${i === 0 ? 'start' : i === 2 ? 'end' : 'middle'}" fill="#a29eba" font-size="11">${l}</text>`).join('');
const step = (s) => s.map((v, d) => (d === 0 ? `M${x(d)},${y(v)}` : `H${x(d)}V${y(v)}`)).join('') + `H${x(days - 1)}`;
const svg = (inner, h = H) => `<svg width="${W}" height="${h}" font-family="A">${inner}</svg>`;
const cross = (d, v, label) => `<line x1="${x(d)}" x2="${x(d)}" y1="${PT}" y2="${H - PB}" stroke="rgba(255,255,255,.35)" stroke-dasharray="3 3"/><circle cx="${x(d)}" cy="${y(v)}" r="4.5" fill="${BLUE}" stroke="#17141f" stroke-width="2"/>`;

const head = `<div class="h">DeepSeek V4</div><div class="k">Tekst · 6 dostawców</div>`;
const seg = `<div class="seg"><span>7 dni</span><span class="on">30 dni</span><span>90 dni</span></div>`;

const A = `${head}<div class="card"><div class="sec">Najniższa cena, 30 dni</div>${seg}
<div style="position:relative">${svg(`${axes()}${promos.map(([a, b]) => `<rect x="${x(a)}" y="${PT}" width="${x(Math.min(b, 29)) - x(a)}" height="${H - PT - PB}" fill="rgba(51,207,149,.10)"/>`).join('')}
<path d="${step(low)}" fill="none" stroke="${BLUE}" stroke-width="2"/>${cross(9, 0.14)}
<text x="${x(29) - 2}" y="${y(0.2) + 16}" text-anchor="end" fill="#f3f1fb" font-size="12" font-weight="700">0,20 $</text>`)}
<div class="tip" style="left:${x(9) + 8}px;top:20px">2 paź · 0,14 $ · DeepInfra<br><span class="save">promocja −50%</span></div></div>
<div class="i3" style="margin-top:6px">Zielone pasy: promocje. Dotknij wykresu, by zobaczyć dzień.</div></div>`;

const B = `${head}<div class="card"><div class="sec">Cena, 30 dni</div>${seg}
<div class="leg"><span><i style="background:${BLUE}"></i>Najtaniej gdziekolwiek</span><span><i style="background:${ORANGE}"></i>Twój: OpenRouter</span></div>
<div style="position:relative">${svg(`${axes()}<path d="${step(yours)}" fill="none" stroke="${ORANGE}" stroke-width="2"/><path d="${step(low)}" fill="none" stroke="${BLUE}" stroke-width="2"/>
<path d="${step(low)}V${y(0)}H${x(0)}Z" fill="${BLUE}" opacity=".10"/>
<text x="${x(29) - 2}" y="${y(0.3) - 7}" text-anchor="end" fill="#f3f1fb" font-size="12" font-weight="700">0,30</text><text x="${x(29) - 2}" y="${y(0.2) + 16}" text-anchor="end" fill="#f3f1fb" font-size="12" font-weight="700">0,20</text>`)}</div>
<div class="i2" style="margin-top:6px">Przepłacasz <b style="color:#fff">0,10 $</b> za 1M tokenów, przy Twoim zużyciu ok. <b style="color:#fff">3 $ / mies.</b></div></div>`;

const spark = (s) => { const sx = (d) => (d / 29) * 150, sy = (v) => 6 + (1 - v / 0.4) * 40; return `<svg width="150" height="50"><path d="${s.map((v, d) => (d ? `H${sx(d)}V${sy(v)}` : `M0,${sy(v)}`)).join('')}H150" fill="none" stroke="${BLUE}" stroke-width="2"/><circle cx="150" cy="${sy(s[29])}" r="4" fill="${BLUE}" stroke="#17141f" stroke-width="2"/></svg>`; };
const C = `${head}<div class="card"><div class="row"><div><div class="i3">Najtaniej teraz</div><div class="big">0,20 $</div><div class="i2"><span class="save">−29%</span> vs średnia 30 dni</div></div>${spark(low)}</div>
<div style="height:1px;background:rgba(255,255,255,.10);margin:12px 0"></div>
<div class="row i2"><span>Najniżej w 30 dni</span><b style="color:#fff">0,14 $ · 2 paź</b></div>
<div class="row i2" style="margin-top:6px"><span>Najwyżej w 30 dni</span><b style="color:#fff">0,28 $</b></div>
<div class="row i2" style="margin-top:6px"><span>Promocje w 30 dni</span><b style="color:#fff">2</b></div></div>
<div class="i3">Pełny wykres po dotknięciu kafla.</div>`;

const prov = [['DeepInfra', [[7, 12, '−50%']]], ['Novita', [[22, 30, '−29%']]], ['OpenRouter', [[18, 30, '−14%']]], ['Together', []], ['Fireworks', [[2, 5, '−20%']]]];
const tx = (d) => 92 + (d / 30) * 210;
const D = `${head}<div class="card"><div class="sec">Promocje, 30 dni</div>${seg}
${svg(prov.map(([n, ps], i) => { const yy = 6 + i * 28; return `<text x="0" y="${yy + 15}" fill="#c9c5dd" font-size="12.5">${n}</text><rect x="92" y="${yy + 4}" width="210" height="16" rx="4" fill="rgba(255,255,255,.06)"/>${ps.map(([a, b, l]) => `<rect x="${tx(a)}" y="${yy + 4}" width="${tx(b) - tx(a)}" height="16" rx="4" fill="${BLUE}"/><text x="${tx(b) - tx(a) < 40 ? tx(b) + 6 : tx(a) + 6}" y="${yy + 16}" fill="#fff" font-size="11.5" font-weight="700">${l}</text>`).join('')}`; }).join('') + `<text x="92" y="160" fill="#a29eba" font-size="11">15 wrz</text><text x="302" y="160" text-anchor="end" fill="#a29eba" font-size="11">dziś</text>`, 166)}
<div class="i3" style="margin-top:4px">Kto i kiedy dawał zniżki. Dobre, by zgadnąć następną promocję.</div></div>`;

const HIST = [
  ['A. Linia najniższej ceny', 'Jedna linia schodkowa, pasy promocji, etykieta ceny na końcu, dymek po dotknięciu.', A],
  ['B. Najtaniej vs Twój dostawca', 'Dwie linie z legendą. Pod wykresem ile przepłacasz przy swoim zużyciu.', B],
  ['C. Kafel z liczbami', 'Bez osi: cena teraz, zmiana vs 30 dni, mini wykres i rekordy. Najmniej miejsca.', C],
  ['D. Oś promocji', 'Paski: który dostawca kiedy miał zniżkę. Mniej o cenie, więcej o promocjach.', D],
];

// Profile zużycia.
const P = [['Czat', '~0,5M / mies.', '0,14 $'], ['Agent kodujący', '~20M / mies.', '5,60 $'], ['RAG / dokumenty', '~8M / mies.', '2,24 $'], ['Tłumaczenia', '~3M / mies.', '0,84 $'], ['Obrazy', '~100 / mies.', '3,00 $'], ['Wideo', '~10 klipów / mies.', '4,00 $']];
const U1 = `<div class="h">Twoje zużycie</div><div class="k">Wybierz najbliższy profil</div><div class="card"><div class="tiles">${P.map(([n, e, c], i) => `<div class="tl ${i === 1 ? 'on' : ''}"><b>${n}</b><small>${e}</small><em>${c}</em><span class="i3"> / mies.</span></div>`).join('')}</div>
<div class="i3" style="margin-top:10px">Koszt przy najtańszej ofercie DeepSeek V4. Własne liczby: „Ustaw ręcznie”.</div></div>`;
const U2 = `<div class="h">Twoje zużycie</div><div class="k">Do czego i jak dużo</div><div class="card"><div class="sec">Do czego</div><div class="chips" style="margin-bottom:14px">${['Czat', 'Kodowanie', 'Dokumenty', 'Obrazy', 'Wideo'].map((c, i) => `<span class="chip ${i === 1 ? 'on' : ''}">${c}</span>`).join('')}</div>
<div class="sec">Ile</div><div class="seg"><span>Lekko</span><span class="on">Średnio</span><span>Dużo</span></div>
<div class="i2">Średnio przy kodowaniu to ok. <b style="color:#fff">20M tokenów</b> miesięcznie, czyli kilka godzin z agentem dziennie.</div>
<div class="row" style="margin-top:12px"><span class="i2">Najtaniej</span><span class="big" style="font-size:24px">5,60 $ <span class="i3" style="font-weight:400">/ mies.</span></span></div></div>`;
const U3 = `<div class="h">Do czego używasz AI?</div><div class="k">Krok 3 z 4 · możesz zmienić później</div><div class="card"><div class="sent">Używam AI do <u>kodowania</u> około <u>3 godzin</u> dziennie, głównie z <u>agentem</u>.</div>
<div style="height:1px;background:rgba(255,255,255,.10);margin:12px 0"></div><div class="i2">To ok. <b style="color:#fff">20M tokenów</b> miesięcznie. Ceny w apce pokażemy jako koszt na miesiąc.</div><div class="btn">Dalej</div></div>
<div class="i3">Dotknij podkreślonego słowa, by je zmienić.</div>`;
const USE = [
  ['1. Kafle profili', 'Gotowe profile z szacunkiem i kosztem na miesiąc. Jedno dotknięcie.', U1],
  ['2. Rodzaj + ile', 'Wybór zastosowania i poziomu Lekko / Średnio / Dużo, opis po ludzku.', U2],
  ['3. Zdanie w kreatorze', 'Pytanie przy pierwszym uruchomieniu, odpowiedź jako zdanie do uzupełnienia.', U3],
];

const page = (items, note) => `<!doctype html><meta charset="utf-8"><style>${css}</style><body>${items.map(([t, n, h]) => `<div class="col"><div class="vt">${t}</div><div class="vn">${n}</div><div class="ph">${h}</div></div>`).join('')}${note ? `<div class="note" style="flex-basis:100%">${note}</div>` : ''}</body>`;
const out = [
  ['history', page(HIST, 'Dane przykładowe. Prawdziwa historia wymaga zapisywania cen: najniższa cena dziennie na model i ofertę, 90 dni (kilkadziesiąt KB).')],
  ['usage', page(USE, 'Szacunki tokenów przykładowe, do dopracowania. Wybrany profil zastępuje pole „mln tokenów”, ręczne ustawienie zostaje.')],
];
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await br.newPage({ viewport: { width: 800, height: 600 }, deviceScaleFactor: 1.5 });
for (const [name, html] of out) {
  const f = join(DIR, `${name}.html`);
  writeFileSync(f, html);
  await p.goto(pathToFileURL(f).href);
  await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path: join(DIR, `${name}.png`), fullPage: true });
}
await br.close();
