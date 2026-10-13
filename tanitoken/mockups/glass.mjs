// Makiety "szkło wszędzie": 3 warianty x 3 ekrany na prawdziwych danych ze snapshotu.
//   node tanitoken/mockups/glass.mjs [ścieżka do vercel /v1/models json] [--png]
// Szkło jest prawdziwe (Chromium): filtr SVG feTurbulence + feDisplacementMap w backdrop-filter
// razem z blur, czyli tło pod panelem się ugina, plus 1 px jasnej krawędzi od światła.
// To statyczny HTML do wyboru kierunku, nie kod apki.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { collectDeals, cheapest, sortOffers, isFreeOffer, offerCost, formatUsd, modelKey, priceBeforeDiscount } from '../core/pricing.js';
import { setLanguage } from '../core/i18n.js';

setLanguage('pl');
const DIR = dirname(fileURLToPath(import.meta.url));
const snap = JSON.parse(readFileSync(join(DIR, '..', 'data', 'snapshot.json'), 'utf8'));
const vercelPath = process.argv.find((a) => a.endsWith('.json'));
const vercel = vercelPath && existsSync(vercelPath) ? JSON.parse(readFileSync(vercelPath, 'utf8')).data : [];
const vByKey = new Map(vercel.map((m) => [modelKey(m.id), m]));
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const short = (n) => n.replace(/^[^:]+:\s*/, '');
const mainCat = (m) => (m.cats.includes('video') ? 'video' : m.cats.includes('image') ? 'image' : m.cats.includes('coding') ? 'coding' : 'text');
const CAT = { text: 'Tekst', coding: 'Kod', image: 'Obraz', video: 'Wideo' };
const fontUrl = (fam, w) => pathToFileURL(join(DIR, '..', 'mobile', 'node_modules', '@expo-google-fonts', fam, w, `${fam === 'figtree' ? 'Figtree' : 'BricolageGrotesque'}_${w}.ttf`)).href;

// ---------- dane ----------
const deals = collectDeals(snap).filter((d) => d.type === 'discount');
const dealRows = deals.slice(0, 6).map((d) => ({
  name: short(d.model.name), cat: mainCat(d.model), pct: d.pct, price: formatUsd(d.offer.in),
  via: d.offer.src === 'openrouter' ? `OpenRouter, przez ${d.offer.provider}` : d.offer.provider,
}));
const catCount = (c) => deals.filter((d) => d.model.cats.includes(c)).length;
const best = (c) => deals.filter((d) => d.model.cats.includes(c)).reduce((m, d) => Math.max(m, d.pct), 0);
const cheapIn = (c) => {
  const list = snap.models.filter((m) => m.cats.includes(c)).map((m) => ({ m, o: cheapest(m) })).filter((x) => x.o && x.o.unit === (c === 'video' ? 'second' : 'image'));
  return list.sort((a, b) => a.o.price - b.o.price);
};
const videos = cheapIn('video').slice(0, 7).map(({ m, o }) => ({ name: short(m.name), price: formatUsd(o.price), via: o.provider, n: m.offers.filter((x) => x.unit === 'second').length }));

const glm = snap.models.find((m) => m.id === 'z-ai/glm-5') ?? snap.models.find((m) => m.cats.includes('text') && m.offers.length > 10);
const glmDesc = vByKey.get(glm.key)?.description ?? 'Brak opisu w źródłach.';
const usage = { token: { in: 10, out: 2 } };
const glmOffers = sortOffers(glm, usage).filter((o) => o.unit === 'token' && !isFreeOffer(o))
  .filter((o, i, a) => a.findIndex((x) => x.provider === o.provider) === i).slice(0, 4);
const glmPromo = (o) => Object.values(snap.promos).find((p) => p.modelId === glm.id && p.key === `${o.src}:${o.tag ?? o.provider}`);
const offerRows = glmOffers.map((o) => ({ provider: o.provider, src: o.src === 'openrouter' ? 'OpenRouter' : o.src === 'direct' ? 'bezpośrednio' : o.provider, cost: formatUsd(offerCost(o, usage)), price: `${formatUsd(o.in)} / ${formatUsd(o.out)}`, pct: glmPromo(o)?.pct ?? 0, before: priceBeforeDiscount(o) }));
const ctxM = !glm.context ? '–' : glm.context >= 1e6 ? `${Math.round(glm.context / 1e5) / 10}M` : `${Math.round(glm.context / 1000)}K`;

// ---------- ikony ----------
const ICON = {
  tag: '<path d="M3 8.5 8.5 3H21v18H8.5L3 15.5z"/><circle cx="8.5" cy="12" r="1.6"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/>',
  star: '<path d="m12 3 2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 16.8l-5.4 2.9 1.1-6.1-4.5-4.2 6.1-.8z"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
  bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
  back: '<path d="m15 5-7 7 7 7"/>',
  text: '<path d="M5 7h14M5 12h14M5 17h9"/>',
  coding: '<path d="m9 7-5 5 5 5M15 7l5 5-5 5"/>',
  image: '<rect x="3.5" y="5" width="17" height="14" rx="3"/><circle cx="9" cy="10" r="1.6"/><path d="m4 17 5-4 4 3 3-2 4 3"/>',
  video: '<rect x="3.5" y="6" width="12" height="12" rx="3"/><path d="m15.5 10 5-3v10l-5-3"/>',
  spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>',
  ext: '<path d="M14 4h6v6M20 4l-9 9M18 14v5H5V6h5"/>',
  check: '<path d="m5 12 5 5 9-10"/>',
};
const ic = (n, size = 20, extra = '') => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${extra}>${ICON[n]}</svg>`;

// ---------- warianty ----------
const VARIANTS = [
  {
    file: 'g1-szron', name: 'A. Szron', note: 'Jasne, mleczne szkło na pastelowych plamach kategorii. Najbliżej obecnej apki.',
    vars: { bg: '#eef0f8', ink: '#1a1530', ink2: '#5d5a73', ink3: '#8d8aa3', tint: 'rgba(255,255,255,.42)', tintStrong: 'rgba(255,255,255,.62)', edge: 'rgba(255,255,255,.95)', line: 'rgba(255,255,255,.55)', shadow: 'rgba(40,30,90,.14)', blob: .55, pattern: 'rgba(26,21,48,.06)', hero: 'rgba(26,21,48,.78)', heroInk: '#fff', active: 'rgba(255,255,255,.75)' },
  },
  {
    file: 'g2-noc', name: 'B. Nocne szkło', note: 'Ciemne, przydymione szkło na świecących kolorach. Kategorie świecą przez panele.',
    vars: { bg: '#0c0a17', ink: '#f3f1fb', ink2: '#b4b0cc', ink3: '#7e7a98', tint: 'rgba(30,26,52,.38)', tintStrong: 'rgba(30,26,52,.6)', edge: 'rgba(255,255,255,.32)', line: 'rgba(255,255,255,.10)', shadow: 'rgba(0,0,0,.5)', blob: .75, pattern: 'rgba(255,255,255,.05)', hero: 'rgba(255,255,255,.10)', heroInk: '#fff', active: 'rgba(255,255,255,.16)' },
  },
  {
    file: 'g3-witraz', name: 'C. Witraż', note: 'Każdy panel to szkło zabarwione kolorem swojej kategorii, na jasnym, spokojnym tle.',
    vars: { bg: '#f4f2f9', ink: '#1a1530', ink2: '#5d5a73', ink3: '#8d8aa3', tint: 'rgba(255,255,255,.36)', tintStrong: 'rgba(255,255,255,.58)', edge: 'rgba(255,255,255,.95)', line: 'rgba(255,255,255,.6)', shadow: 'rgba(40,30,90,.12)', blob: .38, pattern: 'rgba(26,21,48,.07)', hero: 'rgba(61,99,255,.80)', heroInk: '#fff', active: 'rgba(255,255,255,.8)', tinted: true },
  },
];
const COLORS = { text: '#3d63ff', coding: '#8b3dff', image: '#ff4f8b', video: '#ff8a00', deal: '#e8333a', save: '#0f9b6c' };

function css(v) {
  return `
@font-face{font-family:Bric;src:url(${fontUrl('bricolage-grotesque', '800ExtraBold')})}
@font-face{font-family:BricB;src:url(${fontUrl('bricolage-grotesque', '700Bold')})}
@font-face{font-family:Fig;src:url(${fontUrl('figtree', '400Regular')});font-weight:400}
@font-face{font-family:Fig;src:url(${fontUrl('figtree', '600SemiBold')});font-weight:600}
@font-face{font-family:Fig;src:url(${fontUrl('figtree', '700Bold')});font-weight:700}
*{box-sizing:border-box;margin:0;padding:0}
body{background:#d9d7e3;font-family:Fig,sans-serif;padding:28px;color:${v.ink}}
h1.v{font:800 30px Bric;color:#1a1530;margin-bottom:4px} p.v{color:#4d4a63;margin-bottom:18px;font-size:15px}
.row{display:flex;gap:28px;align-items:flex-start}
.cap{font:600 13px Fig;color:#4d4a63;margin:10px 4px 0}
.phone{width:390px;height:844px;border-radius:44px;overflow:hidden;position:relative;background:${v.bg};box-shadow:0 30px 60px rgba(20,16,40,.25)}
.scene{position:absolute;inset:0;overflow:hidden}
.blob{position:absolute;border-radius:50%;filter:blur(38px);opacity:${v.blob}}
.pattern{position:absolute;inset:0;background-image:radial-gradient(${v.pattern} 1.4px,transparent 1.6px);background-size:16px 16px}
.content{position:absolute;inset:0;padding:54px 16px 120px;display:flex;flex-direction:column;gap:10px}
.content>*{flex:none}
.content{bottom:96px;overflow:hidden;padding-bottom:16px;-webkit-mask-image:linear-gradient(#000 calc(100% - 70px),transparent);mask-image:linear-gradient(#000 calc(100% - 70px),transparent)}
.glass{position:relative;border-radius:22px;background:${v.tint};
  backdrop-filter:blur(16px) url(#lens) saturate(1.8);-webkit-backdrop-filter:blur(16px) saturate(1.8);
  box-shadow:inset 0 1px 0 ${v.edge},inset 0 0 0 1px ${v.line},inset 0 -1px 0 rgba(0,0,0,.06),0 10px 28px ${v.shadow}}
.glass::before{content:"";position:absolute;inset:0;border-radius:inherit;pointer-events:none;
  background:linear-gradient(180deg,rgba(255,255,255,${v.tinted ? .38 : v.bg === '#0c0a17' ? .10 : .45}) 0%,rgba(255,255,255,0) 46%,rgba(255,255,255,${v.bg === '#0c0a17' ? .03 : .12}) 100%)}
.glass.strong{background:${v.tintStrong}}
.hdr{display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:2px}
.kick{font-size:13px;color:${v.ink2}} .h1{font:800 30px/1.05 Bric;letter-spacing:-.5px}
.iconbtn{width:44px;height:44px;border-radius:16px;display:grid;place-items:center;color:${v.ink}}
.status{display:flex;align-items:center;gap:8px;padding:10px 14px;font-size:13px;color:${v.ink2};border-radius:16px}
.status b{margin-left:auto;color:${COLORS.text};font-weight:600}
.dot{width:8px;height:8px;border-radius:4px;background:${COLORS.save}}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.tile{padding:12px;min-height:84px;display:flex;flex-direction:column;justify-content:space-between;color:#fff}
.tile .t{display:flex;justify-content:space-between;align-items:center}
.tile .n{font:800 26px Bric} .tile .l{font:700 15px Fig} .tile .s{font-size:11.5px;opacity:.9}
.wide{grid-column:1/-1;flex-direction:row;align-items:center;min-height:0;padding:12px 14px;background:${v.hero};color:${v.heroInk}}
.seg{display:flex;padding:4px;border-radius:16px;gap:2px}
.seg div{flex:1;text-align:center;font:600 13px Fig;padding:8px 0;border-radius:12px;color:${v.ink2}}
.seg .on{background:${v.active};color:${v.ink};box-shadow:inset 0 1px 0 ${v.edge},0 2px 8px ${v.shadow}}
.seg i{font-style:normal;color:${v.ink3};font-weight:600}
.card{padding:13px 14px 12px 18px;overflow:hidden}
.card .stripe{position:absolute;left:0;top:12px;bottom:12px;width:4px;border-radius:0 4px 4px 0}
.card .r{display:flex;justify-content:space-between;gap:10px}
.card .nm{font:700 16px Fig} .card .num{font:800 20px Bric;white-space:nowrap}
.chip{display:inline-flex;align-items:center;gap:4px;font-size:13px;color:${v.ink2};margin-top:3px}
.chip b{font-weight:600}
.pct{display:inline-block;background:${COLORS.deal};color:#fff;font:700 12px Fig;padding:2px 7px;border-radius:8px;margin-top:4px;box-shadow:inset 0 1px 0 rgba(255,255,255,.4)}
.sub{font-size:11.5px;color:${v.ink3};margin-top:6px}
.sponsor{padding:14px;display:flex;gap:12px;align-items:center}
.sponsor .logo{width:44px;height:44px;border-radius:14px;display:grid;place-items:center;font:800 18px Bric;color:#fff;flex:none;box-shadow:inset 0 1px 0 rgba(255,255,255,.5)}
.ad{font:700 10.5px Fig;letter-spacing:.6px;text-transform:uppercase;color:${v.ink3}}
.cta{margin-left:auto;font:700 13px Fig;padding:9px 12px;border-radius:12px;background:${v.active};white-space:nowrap;box-shadow:inset 0 1px 0 ${v.edge}}
.nav{position:absolute;left:12px;right:12px;bottom:22px;height:66px;border-radius:22px;display:flex;align-items:center;padding:0 6px;
  background:${v.tint.replace(/,\.(\d+)\)$/, (m, a) => `,${(Number(`0.${a}`) * 0.85).toFixed(2)})`)}}
.nav .tb{flex:1;display:flex;flex-direction:column;align-items:center;gap:2px;font:600 11.5px Fig;color:${v.ink2};padding:7px 0 6px;border-radius:16px;margin:0 2px}
.nav .tb.on{background:${v.active};color:${v.ink};box-shadow:inset 0 1px 0 ${v.edge},inset 0 0 0 1px ${v.line},0 4px 14px ${v.shadow}}
.sec{font:800 18px Bric;margin:6px 2px 0}
.desc{padding:14px;font-size:14px;line-height:1.45;color:${v.ink}}
.src{font-size:11.5px;color:${v.ink3};margin-top:8px}
.uses{display:flex;flex-wrap:wrap;gap:6px;padding:12px}
.use{display:flex;align-items:center;gap:6px;font:600 13px Fig;padding:8px 11px;border-radius:14px;background:${v.active};box-shadow:inset 0 1px 0 ${v.edge}}
.ex{padding:12px 14px;font-size:13.5px;line-height:1.4;color:${v.ink2}}
.ex b{color:${v.ink};font-weight:600}
.facts{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.fact{padding:10px 12px} .fact .k{font-size:11.5px;color:${v.ink3}} .fact .v{font:800 18px Bric}
.offer{padding:12px 14px;display:flex;justify-content:space-between;align-items:center}
.offer .p{font:700 15px Fig} .offer .s{font-size:12px;color:${v.ink3}} .offer .c{font:800 18px Bric;text-align:right}
`;
}

const blobs = (v) => `
  <div class="blob" style="width:300px;height:300px;left:-90px;top:120px;background:${COLORS.text}"></div>
  <div class="blob" style="width:260px;height:260px;right:-80px;top:300px;background:${COLORS.coding}"></div>
  <div class="blob" style="width:280px;height:280px;left:-40px;top:560px;background:${COLORS.image}"></div>
  <div class="blob" style="width:240px;height:240px;right:-60px;top:690px;background:${COLORS.video}"></div>
  <div class="blob" style="width:200px;height:200px;right:30px;top:-60px;background:${COLORS.video};opacity:${v.blob * 0.6}"></div>
  <div class="pattern"></div>`;

const tint = (v, cat, a = 0.22) => (v.tinted ? `style="background:linear-gradient(135deg,${COLORS[cat]}${Math.round(a * 255).toString(16)} ,rgba(255,255,255,.34))"` : '');

function nav(v, on) {
  const tabs = [['tag', 'Promocje'], ['search', 'Szukaj'], ['star', 'Moje'], ['user', 'Profil']];
  return `<div class="nav glass">${tabs.map(([i, l], k) => `<div class="tb ${k === on ? 'on' : ''}">${ic(i, 22)}<span>${l}</span></div>`).join('')}</div>`;
}

function dealCard(v, d) {
  return `<div class="glass card" ${tint(v, d.cat, 0.16)}><div class="stripe" style="background:${COLORS[d.cat]}"></div>
    <div class="r"><div><div class="nm">${esc(d.name)}</div><div class="chip"><b style="color:${COLORS[d.cat]}">${CAT[d.cat]}</b> ${esc(d.via)}</div></div>
    <div style="text-align:right"><div class="num">${esc(d.price)}</div><span class="pct">−${d.pct}%</span></div></div>
    <div class="sub">/ 1M tokenów wejścia · zniżka od startu pomiarów</div></div>`;
}

function sponsor(v, { logo, color, name, text, cta }) {
  return `<div class="glass sponsor strong"><div class="logo" style="background:${color}">${logo}</div>
    <div style="min-width:0"><div class="ad">Reklama · link partnerski</div><div style="font:700 15px Fig">${esc(name)}</div><div style="font-size:12.5px;color:${v.ink2}">${esc(text)}</div></div>
    <div class="cta">${esc(cta)}</div></div>`;
}

function screenDeals(v) {
  const tile = (c, wide) => wide
    ? `<div class="glass tile wide"><div style="flex:1"><div style="font-size:13px;opacity:.85">Wszystkie promocje</div><div class="n">${deals.length}</div></div><div style="text-align:right"><div style="font-size:13px;opacity:.85">największa</div><div class="n">−${best('text')}%</div></div></div>`
    : `<div class="glass tile" style="background:linear-gradient(150deg,${COLORS[c]}e6,${COLORS[c]}a6)"><div class="t">${ic(c, 22)}<span class="n">${catCount(c)}</span></div><div><div class="l">${CAT[c]}</div><div class="s">${catCount(c) ? `do −${best(c)}%` : 'brak zniżek'}</div></div></div>`;
  return `<div class="phone"><div class="scene">${blobs(v)}</div><div class="content">
    <div class="hdr"><div><div class="kick">Cześć, Ania</div><div class="h1">Co dziś tanieje?</div></div><div class="iconbtn glass">${ic('bell', 22)}</div></div>
    <div class="glass status"><span class="dot"></span>Ceny sprawdzone 2 min temu<b>Odśwież</b></div>
    <div class="grid">${tile('all', true)}${['text', 'coding', 'image', 'video'].map((c) => tile(c)).join('')}</div>
    <div class="glass seg"><div class="on">Zniżki <i>${deals.length}</i></div><div>Obniżki</div><div>Darmowe</div><div>Najtaniej</div></div>
    ${dealCard(v, dealRows[0])}${dealCard(v, dealRows[1])}
    ${sponsor(v, { logo: 'N', color: '#23b26d', name: 'Novita AI', text: 'Te same modele open source, płacisz za użycie', cta: 'Sprawdź' })}
    ${dealCard(v, dealRows[2])}
  </div>${nav(v, 0)}</div>`;
}

function screenModel(v) {
  const uses = [['coding', 'Programowanie całych projektów'], ['spark', 'Agenci i narzędzia'], ['text', `Długie dokumenty (${ctxM} tokenów)`], ['check', 'Rozumowanie krok po kroku']];
  return `<div class="phone"><div class="scene">${blobs(v)}</div><div class="content" style="gap:10px">
    <div class="hdr"><div class="iconbtn glass">${ic('back', 22)}</div><div class="iconbtn glass">${ic('star', 22)}</div></div>
    <div><div class="chip" style="margin:0"><b style="color:${COLORS.text}">Tekst</b> · <b style="color:${COLORS.coding}">Kod</b> · Z.ai</div><div class="h1" style="font-size:32px">${esc(short(glm.name))}</div></div>
    <div class="glass desc strong">${esc(glmDesc.split('. ')[0])}.<div class="src">Opis twórcy (EN, przez Vercel AI Gateway / OpenRouter) · Pokaż całość</div></div>
    <div class="sec">Do czego się nada</div>
    <div class="glass uses">${uses.map(([i, l]) => `<div class="use">${ic(i, 16)}${esc(l)}</div>`).join('')}</div>
    <div class="glass ex"><b>Przykład:</b> „Przejrzyj repozytorium, znajdź przyczynę błędu w płatnościach i przygotuj poprawkę z testami.”</div>
    <div class="facts"><div class="glass fact"><div class="k">Kontekst</div><div class="v">${ctxM}</div></div><div class="glass fact"><div class="k">Oferty</div><div class="v">${glm.offers.length}</div></div><div class="glass fact"><div class="k">Najtaniej / mies.</div><div class="v">${offerRows[0]?.cost ?? '–'}</div></div></div>
    <div class="sec">Gdzie najtaniej</div>
    ${offerRows.slice(0, 2).map((o) => `<div class="glass offer"><div><div class="p">${esc(o.provider)} ${o.pct ? `<span class="pct" style="margin:0 0 0 4px">−${o.pct}%</span>` : ''}</div><div class="s">${esc(o.src)} · ${esc(o.price)} za 1M</div></div><div class="c">${esc(o.cost)}<div class="s">miesięcznie</div></div></div>`).join('')}
  </div>${nav(v, 1)}</div>`;
}

function screenVideo(v) {
  return `<div class="phone"><div class="scene">${blobs(v)}</div><div class="content">
    <div class="hdr"><div><div class="kick">Najtaniej teraz</div><div class="h1">Wideo</div></div><div class="iconbtn glass">${ic('bell', 22)}</div></div>
    <div class="glass seg"><div>Zniżki</div><div>Obniżki</div><div>Darmowe</div><div class="on">Najtaniej</div></div>
    ${videos.slice(0, 3).map((x) => `<div class="glass card" ${tint(v, 'video', 0.2)}><div class="stripe" style="background:${COLORS.video}"></div><div class="r"><div><div class="nm">${esc(x.name)}</div><div class="chip"><b style="color:${COLORS.video}">Wideo</b> ${esc(x.via)}</div></div><div style="text-align:right"><div class="num">${esc(x.price)}</div><div class="sub" style="margin:2px 0 0">za sekundę</div></div></div></div>`).join('')}
    ${sponsor(v, { logo: 'fal', color: '#5b3df5', name: 'fal.ai', text: 'Veo, Kling, Seedance w jednym API', cta: 'Wypróbuj' })}
    ${videos.slice(3, 7).map((x) => `<div class="glass card" ${tint(v, 'video', 0.2)}><div class="stripe" style="background:${COLORS.video}"></div><div class="r"><div><div class="nm">${esc(x.name)}</div><div class="chip"><b style="color:${COLORS.video}">Wideo</b> ${esc(x.via)}</div></div><div style="text-align:right"><div class="num">${esc(x.price)}</div><div class="sub" style="margin:2px 0 0">za sekundę</div></div></div></div>`).join('')}
  </div>${nav(v, 0)}</div>`;
}

const LENS = `<svg width="0" height="0" style="position:absolute"><filter id="lens" x="0%" y="0%" width="100%" height="100%" color-interpolation-filters="sRGB">
  <feTurbulence type="fractalNoise" baseFrequency="0.011 0.017" numOctaves="2" seed="11" result="noise"/>
  <feGaussianBlur in="noise" stdDeviation="2" result="soft"/>
  <feDisplacementMap in="SourceGraphic" in2="soft" scale="38" xChannelSelector="R" yChannelSelector="G"/></filter></svg>`;

const outputs = [];
for (const V of VARIANTS) {
  const html = `<!doctype html><meta charset="utf-8"><title>TaniToken – ${V.name}</title><style>${css(V.vars)}</style>${LENS}
  <h1 class="v">${V.name}</h1><p class="v">${V.note}</p>
  <div class="row"><div>${screenDeals(V.vars)}<div class="cap">Promocje: szkło na kaflach, liście i pasku; reklama co kilka ofert</div></div>
  <div>${screenModel(V.vars)}<div class="cap">Model: opis twórcy, zastosowania, przykład, ceny</div></div>
  <div>${screenVideo(V.vars)}<div class="cap">Najtaniej w wideo; aktywna zakładka obejmuje ikonę i podpis</div></div></div>`;
  const file = join(DIR, `${V.file}.html`);
  writeFileSync(file, html);
  outputs.push(file);
}
console.log(outputs.join('\n'));

if (process.argv.includes('--png')) {
  const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--allow-file-access-from-files'] });
  const p = await b.newPage({ viewport: { width: 1290, height: 1010 }, deviceScaleFactor: 2 });
  for (const f of outputs) {
    await p.goto(pathToFileURL(f).href);
    await p.waitForTimeout(600);
    await p.screenshot({ path: f.replace(/\.html$/, '.png'), fullPage: true });
  }
  await b.close();
}
