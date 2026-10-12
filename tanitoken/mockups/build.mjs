// Generator makiet: 5 kierunków wizualnych apki na prawdziwych danych ze snapshotu.
//   node tanitoken/mockups/build.mjs            -> tanitoken/mockups/*.html
//   node tanitoken/mockups/build.mjs --png      -> dodatkowo PNG (Playwright + /opt/pw-browsers/chromium)
// Makiety to statyczny HTML, nie kod apki. Służą do wyboru kierunku przed przebudową.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  collectDeals, offerCost, sortOffers, priceBeforeDiscount, isFreeOffer, formatUsd, formatContext,
  promoAgeDays, CATEGORIES,
} from '../core/pricing.js';

const DIR = dirname(fileURLToPath(import.meta.url));
const snap = JSON.parse(readFileSync(join(DIR, '..', 'data', 'snapshot.json'), 'utf8'));
const byId = new Map(snap.models.map((m) => [m.id, m]));
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const short = (name) => name.replace(/^[^:]+:\s*/, '');
const money = (v) => formatUsd(v).replace(' $', '');

// ---------- dane wspólne dla wszystkich makiet ----------
const deals = collectDeals(snap);
const discountDeals = deals.filter((d) => d.type === 'discount');
const counts = {
  cats: Object.fromEntries(CATEGORIES.map((c) => [c.key, discountDeals.filter((d) => c.key === 'all' || d.model.cats.includes(c.key)).length])),
  discount: discountDeals.length,
  drop: deals.filter((d) => d.type === 'drop').length,
  free: deals.filter((d) => d.type === 'free').length,
};
const CAT = { text: 'Tekst', coding: 'Kod', image: 'Obraz', video: 'Wideo', all: 'Wszystko' };
const mainCat = (m) => (m.cats.includes('video') ? 'video' : m.cats.includes('image') ? 'image' : m.cats.includes('coding') ? 'coding' : 'text');
const dealList = discountDeals.slice(0, 7).map((d) => {
  const before = priceBeforeDiscount(d.offer);
  return {
    name: short(d.model.name), author: d.model.author, provider: d.offer.provider, cat: mainCat(d.model),
    pct: d.pct, inP: d.offer.in, outP: d.offer.out, beforeIn: before?.in, beforeOut: before?.out,
    days: Math.max(1, Math.round(promoAgeDays(d))), ctx: formatContext(d.model.context),
  };
});

const usage = { token: { in: 10, out: 2 } };
const glm = byId.get('z-ai/glm-5.2');
const glmOffers = sortOffers(glm, usage)
  .filter((o) => o.unit === 'token' && !isFreeOffer(o))
  .filter((o, i, all) => all.findIndex((x) => x.provider === o.provider) === i); // jeden wiersz na dostawcę
const glmPromos = Object.values(snap.promos).filter((p) => p.modelId === glm.id);
const offerRows = glmOffers.slice(0, 5).map((o) => {
  const promo = glmPromos.find((p) => p.key === `${o.src}:${o.tag ?? o.provider}`);
  const b = priceBeforeDiscount(o);
  return { provider: o.provider, src: { openrouter: 'OpenRouter', vercel: 'Vercel', requesty: 'Requesty', direct: 'Bezpośrednio' }[o.src], inP: o.in, outP: o.out, beforeIn: b?.in, beforeOut: b?.out, cost: offerCost(o, usage), pct: promo?.pct ?? 0, uptime: o.uptime, quant: o.quant };
});
const worstCost = offerCost(glmOffers[glmOffers.length - 1], usage);
const model = {
  name: short(glm.name), author: 'Z.ai', id: glm.id, ctx: formatContext(glm.context), cats: glm.cats.map((c) => CAT[c]),
  offers: offerRows, count: glm.offers.length, best: offerRows[0], save: worstCost - offerRows[0].cost,
};
const novita = glmOffers.find((o) => o.provider === 'Novita');
const mine = {
  savings: 41.3,
  using: [
    { name: 'GLM 5.2', provider: 'Novita', price: novita ? `${money(novita.in)} / ${money(novita.out)}` : '0.65 / 2.02', pct: 54, state: 'aging', days: 6, typical: 7, cheaper: { provider: 'DeepInfra', pct: 13 } },
    { name: 'DeepSeek V4.1 Flash', provider: 'StreamLake', price: '0.300 / 1.20', pct: 0, state: 'ended', endedAgo: '2 h', cheaper: { provider: 'DeepInfra', pct: 47 } },
    { name: 'Kimi K3', provider: 'Moonshot AI', price: '0.60 / 2.50', pct: 0, state: 'ok' },
  ],
  alerts: [
    { kind: 'Koniec promocji', urgent: true, title: 'DeepSeek V4.1 Flash', body: 'Zniżka −51% u StreamLake zniknęła', ago: '2 h' },
    { kind: 'Kończy się', urgent: true, title: 'GLM 5.2 u Novita', body: 'Trwa 6 dni, zwykle 7', ago: '5 h' },
    { kind: 'Nowa promocja', title: 'Qwen3 235B', body: '−75% u GMICloud', ago: '1 d' },
  ],
  watching: [
    { name: 'Claude Opus 5.5', provider: 'Anthropic', price: '4.00 / 20.00', pct: 0 },
    { name: 'GLM 5.3 Flash', provider: 'StreamLake', price: '0.043 / 0.145', pct: 71 },
    { name: 'FLUX.3 Image', provider: 'Vercel', price: '0.024 za obraz', pct: 0 },
  ],
};

// ---------- ikony ----------
const ICON = {
  tag: '<path d="M3 8.5 8.5 3H21v18H8.5L3 15.5z"/><circle cx="8.5" cy="12" r="1.6"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/>',
  star: '<path d="m12 3 2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 16.8l-5.4 2.9 1.1-6.1-4.5-4.2 6.1-.8z"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.2-4 4.3-6 8-6s6.8 2 8 6"/>',
  bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  back: '<path d="m15 5-7 7 7 7"/>',
  text: '<path d="M5 6h14M5 12h14M5 18h9"/>',
  code: '<path d="m8 7-5 5 5 5M16 7l5 5-5 5"/>',
  coding: '<path d="m8 7-5 5 5 5M16 7l5 5-5 5"/>',
  image: '<rect x="3.5" y="5" width="17" height="14" rx="2"/><circle cx="9" cy="10" r="1.8"/><path d="m4 18 5.5-5 4 3.5 2.5-2 4 3.5"/>',
  video: '<rect x="3" y="6" width="13" height="12" rx="2"/><path d="m16 10 5-3v10l-5-3z"/>',
  all: '<rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/>',
  warn: '<path d="M12 4 2.5 20h19z"/><path d="M12 10v4.5M12 17.2v.3"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  arrowDown: '<path d="M12 5v14M6 13l6 6 6-6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
};
const ic = (name, size = 20, sw = 2) => `<svg class="ic" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[name]}</svg>`;

const tabs = (active, cls = '') => `<nav class="tabs ${cls}">${[['tag', 'Promocje'], ['search', 'Szukaj'], ['star', 'Moje'], ['user', 'Profil']]
  .map(([i, l]) => `<span class="tab ${l === active ? 'on' : ''}">${ic(i, 22)}<b>${l}</b></span>`).join('')}</nav>`;

// Schodkowy wykres ceny: regularna cena, potem spadek w dniu startu zniżki (to wiemy z danych).
function stepChart(d, w = 92, h = 34, color = 'currentColor') {
  const total = 14;
  const x0 = ((total - Math.min(d.days, total - 1)) / total) * w;
  const hi = 6;
  const lo = h - 6 - (h - 12) * Math.min(0.9, d.pct / 100);
  return `<svg class="spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true"><path d="M0 ${hi} H${x0.toFixed(1)} V${lo.toFixed(1)} H${w}" fill="none" stroke="${color}" stroke-width="2"/><circle cx="${w - 1.5}" cy="${lo.toFixed(1)}" r="2.5" fill="${color}"/></svg>`;
}

// ---------- kierunki ----------
const DIRECTIONS = [];

// 1. Gazetka 2.0: ewolucja obecnej etykiety, ale przyjazna i czytelna.
DIRECTIONS.push({
  key: 'gazetka',
  name: 'Gazetka promocyjna',
  pitch: 'Ewolucja obecnego stylu. Żółta etykieta zostaje jako znak rozpoznawczy, ale wokół niej są zaokrąglone karty, większa cena i krótkie etykiety zamiast zdań. Najbardziej „okazyjny” charakter.',
  fonts: 'family=Archivo:wdth,wght@62..125,400..800',
  css: `
  :root{--bg:#f6f6f2;--card:#fff;--ink:#16161d;--ink2:#5d5d6b;--line:#e7e6df;--yellow:#ffd400;--red:#e0262f;--green:#12805c}
  .phone{background:var(--bg);color:var(--ink);font-family:Archivo,sans-serif;font-stretch:100%}
  h1{font-size:30px;font-weight:800;font-stretch:80%;letter-spacing:-.01em;margin:0}
  .sub{color:var(--ink2);font-size:13px}
  .seg{display:flex;background:#ebeae3;border-radius:14px;padding:4px;gap:4px}
  .seg span{flex:1;text-align:center;padding:8px 0;border-radius:10px;font-size:13px;font-weight:600;color:var(--ink2)}
  .seg span.on{background:var(--card);color:var(--ink);box-shadow:0 1px 3px #0002}
  .seg small{display:block;font-size:11px;font-weight:500;color:var(--ink2)}
  .cats{display:grid;grid-template-columns:repeat(5,1fr);gap:6px}
  .cats span{display:flex;flex-direction:column;align-items:center;gap:3px;padding:9px 0 7px;border-radius:14px;background:var(--card);font-size:11.5px;font-weight:600;border:1.5px solid transparent}
  .cats span.on{border-color:var(--ink);background:var(--yellow)}
  .cats em{font-style:normal;font-weight:500;color:var(--ink2);font-size:10.5px}
  .card{background:var(--card);border-radius:18px;padding:14px;display:grid;grid-template-columns:1fr auto;gap:4px 12px;box-shadow:0 1px 0 var(--line)}
  .card .nm{font-weight:700;font-size:16px}
  .chips{display:flex;gap:6px;flex-wrap:wrap;align-self:start;align-items:center}
  .chip{font-size:11.5px;font-weight:600;padding:3px 8px;border-radius:99px;background:#f0efe8;color:var(--ink2)}
  .price{grid-row:span 2;text-align:right;align-self:center}
  .tagp{display:inline-flex;align-items:baseline;gap:6px;background:var(--yellow);padding:4px 10px 4px 14px;border-radius:6px;clip-path:polygon(8px 0,100% 0,100% 100%,8px 100%,0 50%)}
  .tagp b{font-size:24px;font-weight:800;font-stretch:75%}
  .pct{background:var(--red);color:#fff;font-weight:800;font-size:13px;padding:2px 7px;border-radius:6px}
  .old{font-size:12px;color:var(--ink2);text-decoration:line-through}
  .meta{font-size:12px;color:var(--ink2);display:flex;gap:4px;align-items:center}
  .tabs{background:var(--card);border-top:1px solid var(--line)}
  .tab.on{color:var(--ink)} .tab.on .ic{color:var(--ink);fill:var(--yellow)}
  .hero{background:var(--yellow);border-radius:20px;padding:16px}
  .hero b{font-size:44px;font-weight:800;font-stretch:72%;line-height:1}
  .btn{flex:1;text-align:center;padding:12px;border-radius:14px;font-weight:700;font-size:14px;background:var(--ink);color:#fff}
  .btn.ghost{background:var(--card);color:var(--ink);border:1.5px solid var(--ink)}
  .row{background:var(--card);border-radius:14px;padding:12px;display:grid;grid-template-columns:22px 1fr auto;gap:2px 10px;align-items:center}
  .rank{font-weight:800;font-stretch:75%;font-size:20px;color:var(--ink2)}
  .row.best{outline:2.5px solid var(--yellow)}
  .cost{font-weight:800;font-stretch:75%;font-size:20px}
  .stat{border-radius:18px;padding:14px;background:var(--ink);color:#fff}
  .stat b{font-size:34px;font-weight:800;font-stretch:72%;color:var(--yellow)}
  .use{background:var(--card);border-radius:18px;padding:14px;border-left:6px solid var(--line)}
  .use.aging{border-left-color:var(--red)} .use.ended{border-left-color:var(--red)} .use.ok{border-left-color:var(--green)}
  .badge{font-size:11.5px;font-weight:700;padding:3px 8px;border-radius:99px}
  .badge.red{background:#fde5e6;color:var(--red)} .badge.green{background:#dff3ea;color:var(--green)}
  .bar{height:6px;border-radius:9px;background:#eee;overflow:hidden} .bar i{display:block;height:100%;background:var(--red)}
  .save{color:var(--green);font-weight:600;font-size:13px}
  `,
  home: () => `
    <div class="top"><div><h1>Promocje</h1><div class="sub">Cześć Ola, ceny sprzed 4 min</div></div><span class="bell">${ic('bell', 22)}<i></i></span></div>
    <div class="cats">${['all', 'text', 'coding', 'image', 'video'].map((c, i) => `<span class="${i === 0 ? 'on' : ''}">${ic(c, 20)}${CAT[c]}<em>${counts.cats[c]}</em></span>`).join('')}</div>
    <div class="seg"><span class="on">Zniżki<small>${counts.discount}</small></span><span>Obniżki<small>${counts.drop}</small></span><span>Darmowe<small>${counts.free}</small></span></div>
    <div class="list">${dealList.slice(0, 5).map((d) => `
      <div class="card"><div class="nm">${esc(d.name)}</div>
        <div class="price"><span class="pct">−${d.pct}%</span><br><span class="tagp"><b>${money(d.inP)}</b><small>$/1M</small></span><br><span class="old">było ${money(d.beforeIn)}</span></div>
        <div class="chips"><span class="chip">${esc(d.provider)}</span><span class="chip">${CAT[d.cat]}</span></div>
        <div class="meta">${ic('clock', 13)} trwa ${d.days} d</div></div>`).join('')}</div>
    ${tabs('Promocje')}`,
  model: () => `
    <div class="top"><span class="backb">${ic('back', 22)}</span><span class="bell">${ic('star', 22)}</span></div>
    <div><h1>${esc(model.name)}</h1><div class="chips" style="margin-top:6px"><span class="chip">${model.author}</span>${model.cats.map((c) => `<span class="chip">${c}</span>`).join('')}<span class="chip">${model.ctx} kontekstu</span></div></div>
    <div class="hero"><div class="sub" style="color:#16161d">Najtaniej przy 10M / 2M tokenów</div><b>${formatUsd(model.best.cost)}</b><span style="font-weight:700"> / mies.</span><div style="font-weight:600;margin-top:4px">${esc(model.best.provider)} · oszczędzasz ${formatUsd(model.save)}</div></div>
    <div style="display:flex;gap:8px"><span class="btn">Używam</span><span class="btn ghost">Obserwuj</span></div>
    <div class="seg"><span class="on">Wszyscy ${model.count}</span><span>Ulubieni 4</span><span>Promocje ${glmPromos.length}</span></div>
    <div class="list">${model.offers.slice(0, 4).map((o, i) => `
      <div class="row ${i === 0 ? 'best' : ''}"><span class="rank">${i + 1}</span><b>${esc(o.provider)}</b><span class="cost">${formatUsd(o.cost)}</span>
      <span></span><span class="sub">${o.pct ? `<span class="pct" style="font-size:11px">−${o.pct}%</span> ` : ''}${money(o.inP)} / ${money(o.outP)} $</span><span class="sub">${o.src}</span></div>`).join('')}</div>
    ${tabs('Szukaj')}`,
  mine: () => `
    <div class="top"><div><h1>Moje</h1><div class="sub">3 używane, 3 obserwowane</div></div></div>
    <div class="stat"><div style="font-size:13px;opacity:.8">Dzięki promocjom oszczędzasz</div><b>${formatUsd(mine.savings)}</b> <span>/ miesiąc</span></div>
    ${mine.using.map((u) => `
      <div class="use ${u.state}"><div style="display:flex;justify-content:space-between;align-items:center"><b style="font-size:16px">${u.name}</b>
      ${u.state === 'aging' ? '<span class="badge red">Kończy się</span>' : u.state === 'ended' ? '<span class="badge red">Promocja minęła</span>' : '<span class="badge green">Najtaniej</span>'}</div>
      <div class="sub">u ${u.provider} · ${u.price} $${u.pct ? ` · −${u.pct}%` : ''}</div>
      ${u.state === 'aging' ? `<div class="bar" style="margin:8px 0 4px"><i style="width:${(u.days / u.typical) * 100}%"></i></div><div class="sub">dzień ${u.days} z ~${u.typical} typowych</div>` : ''}
      ${u.cheaper ? `<div class="save" style="margin-top:6px">${u.cheaper.provider} taniej o ${u.cheaper.pct}%</div>` : ''}</div>`).join('')}
    ${tabs('Moje')}`,
});

// 2. Portfel: spokojny fintech, liczby jak saldo konta.
DIRECTIONS.push({
  key: 'portfel',
  name: 'Portfel',
  pitch: 'Spokojny styl aplikacji bankowej. Na górze zawsze jedna liczba (ile oszczędzasz albo ile zapłacisz), niżej czyste karty z ikoną dostawcy. Najlepsza czytelność, najmniej „krzykliwy”.',
  fonts: 'family=Manrope:wght@400..800',
  css: `
  :root{--bg:#f2f4f7;--card:#fff;--ink:#101828;--ink2:#667085;--line:#e4e7ec;--brand:#0b6b63;--brand2:#e3f3f1;--hot:#ef4a3c;--hot2:#fdecea}
  .phone{background:var(--bg);color:var(--ink);font-family:Manrope,sans-serif}
  h1{font-size:26px;font-weight:800;margin:0;letter-spacing:-.02em}
  .sub{color:var(--ink2);font-size:13px}
  .seg{display:flex;background:var(--card);border-radius:99px;padding:4px;border:1px solid var(--line)}
  .seg span{flex:1;text-align:center;padding:9px 0;border-radius:99px;font-size:13px;font-weight:700;color:var(--ink2)}
  .seg span.on{background:var(--brand);color:#fff}
  .cats{display:flex;gap:6px}
  .cats span{flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;font-size:11.5px;font-weight:700;color:var(--ink2)}
  .cats span i{width:48px;height:48px;border-radius:16px;background:var(--card);display:grid;place-items:center;border:1px solid var(--line)}
  .cats span.on{color:var(--brand)} .cats span.on i{background:var(--brand);color:#fff;border-color:var(--brand)}
  .summary{background:var(--brand);color:#fff;border-radius:22px;padding:16px}
  .summary b{font-size:32px;font-weight:800;letter-spacing:-.02em}
  .group{background:var(--card);border-radius:20px;padding:4px 14px}
  .item{display:grid;grid-template-columns:40px 1fr auto;gap:2px 12px;align-items:center;padding:12px 0;border-bottom:1px solid var(--line)}
  .item:last-child{border:0}
  .av{grid-row:span 2;width:40px;height:40px;border-radius:12px;display:grid;place-items:center;font-weight:800;font-size:15px;background:var(--brand2);color:var(--brand)}
  .nm{font-weight:700;font-size:15px}
  .pr{text-align:right;font-weight:800;font-size:16px}
  .pct{display:inline-block;font-size:12px;font-weight:800;color:var(--hot);background:var(--hot2);padding:2px 7px;border-radius:99px}
  .tabs{background:var(--card);border-top:1px solid var(--line)} .tab.on{color:var(--brand)}
  .btn{flex:1;text-align:center;padding:13px;border-radius:14px;font-weight:800;font-size:14px;background:var(--brand);color:#fff}
  .btn.ghost{background:var(--card);color:var(--ink);border:1px solid var(--line)}
  .kv{display:flex;justify-content:space-between;font-size:13px;color:var(--ink2);padding:2px 0}
  .kv b{color:var(--ink)}
  .status{font-size:12px;font-weight:700;padding:3px 9px;border-radius:99px}
  .s-red{background:var(--hot2);color:var(--hot)} .s-green{background:var(--brand2);color:var(--brand)}
  .meter{height:8px;border-radius:9px;background:var(--line);margin-top:8px;overflow:hidden} .meter i{display:block;height:100%;background:var(--hot);border-radius:9px}
  .h2{font-size:15px;font-weight:800;margin:4px 2px 0}
  `,
  home: () => `
    <div class="top"><div><div class="sub">Cześć Ola 👋</div><h1>Dzisiejsze okazje</h1></div><span class="bell">${ic('bell', 22)}<i></i></span></div>
    <div class="summary"><div style="font-size:13px;opacity:.85">Aktywnych zniżek teraz</div><b>${counts.discount}</b><div style="font-size:13px;opacity:.85">największa −${dealList[0].pct}% · aktualizacja 4 min temu</div></div>
    <div class="cats">${['all', 'text', 'coding', 'image', 'video'].map((c, i) => `<span class="${i === 0 ? 'on' : ''}"><i>${ic(c, 22)}</i>${CAT[c]}</span>`).join('')}</div>
    <div class="seg"><span class="on">Zniżki</span><span>Obniżki</span><span>Darmowe</span></div>
    <div class="group">${dealList.slice(0, 4).map((d) => `
      <div class="item"><span class="av">${esc(d.author[0].toUpperCase())}</span><span class="nm">${esc(d.name)}</span><span class="pr">${money(d.inP)} $</span>
      <span class="sub">${esc(d.provider)} · ${CAT[d.cat]}</span><span style="text-align:right"><span class="pct">−${d.pct}%</span></span></div>`).join('')}</div>
    ${tabs('Promocje')}`,
  model: () => `
    <div class="top"><span class="backb">${ic('back', 22)}</span><span class="bell">${ic('star', 22)}</span></div>
    <div style="display:flex;gap:12px;align-items:center"><span class="av" style="width:52px;height:52px;font-size:20px">Z</span><div><h1 style="font-size:24px">${esc(model.name)}</h1><div class="sub">${model.cats.join(', ')} · ${model.ctx} kontekstu · ${model.count} ofert</div></div></div>
    <div class="summary"><div style="font-size:13px;opacity:.85">Zapłacisz najmniej u ${esc(model.best.provider)}</div><b>${formatUsd(model.best.cost)}</b> <span style="opacity:.85">miesięcznie</span>
      <div style="display:flex;gap:8px;margin-top:10px"><span style="flex:1;background:#ffffff22;border-radius:12px;padding:8px;font-size:12px">Wejście<br><b style="font-size:16px">10M</b></span><span style="flex:1;background:#ffffff22;border-radius:12px;padding:8px;font-size:12px">Wyjście<br><b style="font-size:16px">2M</b></span><span style="flex:1;background:#ffffff22;border-radius:12px;padding:8px;font-size:12px">Oszczędność<br><b style="font-size:16px">${money(model.save)} $</b></span></div></div>
    <div style="display:flex;gap:8px"><span class="btn">Używam</span><span class="btn ghost">Obserwuj</span></div>
    <div class="group">${model.offers.slice(0, 4).map((o) => `
      <div class="item"><span class="av">${esc(o.provider[0])}</span><span class="nm">${esc(o.provider)}</span><span class="pr">${formatUsd(o.cost)}</span>
      <span class="sub">${money(o.inP)} / ${money(o.outP)} $ · ${o.src}</span><span style="text-align:right">${o.pct ? `<span class="pct">−${o.pct}%</span>` : ''}</span></div>`).join('')}</div>
    ${tabs('Szukaj')}`,
  mine: () => `
    <div class="top"><div><h1>Moje modele</h1><div class="sub">3 używane, 3 obserwowane</div></div></div>
    <div class="summary"><div style="font-size:13px;opacity:.85">Oszczędzasz dzięki promocjom</div><b>${formatUsd(mine.savings)}</b> <span style="opacity:.85">/ miesiąc</span></div>
    <div class="h2">Używam</div>
    ${mine.using.slice(0, 2).map((u) => `
      <div class="group" style="padding:14px"><div style="display:flex;justify-content:space-between;align-items:center"><span class="nm">${u.name}</span>
      ${u.state === 'aging' ? '<span class="status s-red">Kończy się</span>' : u.state === 'ended' ? '<span class="status s-red">Promocja minęła</span>' : '<span class="status s-green">OK</span>'}</div>
      <div class="kv"><span>Dostawca</span><b>${u.provider}</b></div><div class="kv"><span>Cena /1M</span><b>${u.price} $</b></div>
      ${u.state === 'aging' ? `<div class="meter"><i style="width:${(u.days / u.typical) * 100}%"></i></div><div class="kv"><span>Dzień ${u.days}</span><span>zwykle ~${u.typical} dni</span></div>` : ''}
      ${u.cheaper ? `<div class="kv" style="color:var(--brand);font-weight:700"><span>${u.cheaper.provider}</span><span>taniej o ${u.cheaper.pct}%</span></div>` : ''}</div>`).join('')}
    ${tabs('Moje')}`,
});

// 3. Giełda: każda oferta jak notowanie, wykres pokazuje moment zniżki.
DIRECTIONS.push({
  key: 'gielda',
  name: 'Notowania',
  pitch: 'Ceny jak kursy na giełdzie: przy każdej promocji mały wykres pokazuje, kiedy cena spadła, a zielone i czerwone zmiany od razu mówią, co tanieje. Wymaga zapisywania historii cen w snapshocie (do zrobienia).',
  fonts: 'family=Geist:wght@400..800&family=Geist+Mono:wght@400..700',
  css: `
  :root{--bg:#fbfbfc;--card:#fff;--ink:#0d1117;--ink2:#6a7280;--line:#eceef2;--up:#d33a2c;--down:#0f9d58;--down2:#e6f6ee;--accent:#2b59ff}
  .phone{background:var(--bg);color:var(--ink);font-family:Geist,sans-serif}
  .mono{font-family:'Geist Mono',monospace;font-variant-numeric:tabular-nums}
  h1{font-size:28px;font-weight:700;margin:0;letter-spacing:-.03em}
  .sub{color:var(--ink2);font-size:13px}
  .seg{display:flex;border-bottom:1px solid var(--line)}
  .seg span{flex:1;text-align:center;padding:10px 0;font-size:13.5px;font-weight:600;color:var(--ink2);border-bottom:2px solid transparent}
  .seg span.on{color:var(--ink);border-color:var(--ink)}
  .cats{display:flex;gap:6px}
  .cats span{flex:1;text-align:center;padding:8px 0;border-radius:10px;font-size:12.5px;font-weight:600;background:#f1f2f5;color:var(--ink2)}
  .cats span.on{background:var(--ink);color:#fff}
  .tick{display:grid;grid-template-columns:1fr 92px 86px;gap:2px 10px;align-items:center;padding:12px 2px;border-bottom:1px solid var(--line)}
  .nm{font-weight:650;font-size:15px}
  .chg{grid-row:span 2;text-align:right}
  .chg .p{font-size:16px;font-weight:600}
  .down{display:inline-block;background:var(--down2);color:var(--down);font-weight:700;font-size:12.5px;border-radius:6px;padding:2px 6px;margin-top:3px}
  .spark{grid-row:span 2;color:var(--down)}
  .tabs{background:var(--card);border-top:1px solid var(--line)} .tab.on{color:var(--ink)}
  .big{font-size:40px;font-weight:700;letter-spacing:-.03em}
  .btn{flex:1;text-align:center;padding:12px;border-radius:12px;font-weight:700;font-size:14px;background:var(--ink);color:#fff}
  .btn.ghost{background:var(--card);color:var(--ink);border:1px solid var(--line)}
  .tbl{width:100%;border-collapse:collapse;font-size:13px}
  .tbl td{padding:9px 2px;border-bottom:1px solid var(--line)} .tbl td:last-child{text-align:right}
  .tbl tr.best td{background:#f3f6ff}
  .badge{font-size:12px;font-weight:700;border-radius:6px;padding:2px 6px}
  .b-up{background:#fdeceb;color:var(--up)} .b-down{background:var(--down2);color:var(--down)}
  .pill{display:flex;justify-content:space-between;align-items:center;padding:12px 2px;border-bottom:1px solid var(--line)}
  .chart{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:10px}
  `,
  home: () => `
    <div class="top"><div><h1>Rynek</h1><div class="sub">Ola · ${counts.discount} zniżek · 4 min temu</div></div><span class="bell">${ic('bell', 22)}<i></i></span></div>
    <div class="cats">${['all', 'text', 'coding', 'image', 'video'].map((c, i) => `<span class="${i === 0 ? 'on' : ''}">${CAT[c]}</span>`).join('')}</div>
    <div class="seg"><span class="on">Zniżki ${counts.discount}</span><span>Obniżki ${counts.drop}</span><span>Darmowe ${counts.free}</span></div>
    <div class="list" style="gap:0">${dealList.slice(0, 6).map((d) => `
      <div class="tick"><span class="nm">${esc(d.name)}</span>${stepChart(d)}<span class="chg"><span class="p mono">${money(d.inP)}</span><br><span class="down mono">▼ ${d.pct}%</span></span>
      <span class="sub">${esc(d.provider)} · ${d.days} d</span></div>`).join('')}</div>
    ${tabs('Promocje')}`,
  model: () => `
    <div class="top"><span class="backb">${ic('back', 22)}</span><span class="bell">${ic('star', 22)}</span></div>
    <div><div class="sub">${model.author} · ${model.cats.join(', ')} · ${model.ctx}</div><h1>${esc(model.name)}</h1></div>
    <div><span class="big mono">${formatUsd(model.best.cost)}</span> <span class="sub">/ mies. u ${esc(model.best.provider)}</span><br><span class="badge b-down mono">▼ ${formatUsd(model.save)} vs najdroższy</span></div>
    <div class="chart">${stepChart({ days: 5, pct: 60 }, 322, 70, '#0f9d58')}<div class="sub" style="display:flex;justify-content:space-between"><span>14 dni temu</span><span>zniżka −60% od 5 dni</span><span>dziś</span></div></div>
    <div style="display:flex;gap:8px"><span class="btn">Używam</span><span class="btn ghost">Obserwuj</span></div>
    <table class="tbl mono">${model.offers.slice(0, 4).map((o, i) => `<tr class="${i ? '' : 'best'}"><td style="font-family:Geist;font-weight:600">${esc(o.provider)}</td><td>${money(o.inP)}/${money(o.outP)}</td><td>${o.pct ? `<span class="badge b-down">−${o.pct}%</span>` : ''}</td><td><b>${formatUsd(o.cost)}</b></td></tr>`).join('')}</table>
    ${tabs('Szukaj')}`,
  mine: () => `
    <div class="top"><div><h1>Portfolio</h1><div class="sub">3 używane · 3 obserwowane</div></div></div>
    <div><span class="sub">Oszczędność miesięczna</span><br><span class="big mono" style="color:var(--down)">${formatUsd(mine.savings)}</span></div>
    <div class="seg"><span class="on">Używam</span><span>Obserwuję</span><span>Alerty 3</span></div>
    <div>${mine.using.map((u) => `
      <div class="pill"><div><div style="font-weight:650">${u.name}</div><div class="sub">${u.provider} · <span class="mono">${u.price}</span></div></div>
      <div style="text-align:right">${u.state === 'aging' ? `<span class="badge b-up">kończy się · ${u.days}/${u.typical} d</span>` : u.state === 'ended' ? '<span class="badge b-up">▲ koniec promocji</span>' : '<span class="badge b-down">najtaniej</span>'}${u.cheaper ? `<div class="sub" style="margin-top:4px">${u.cheaper.provider} −${u.cheaper.pct}%</div>` : ''}</div></div>`).join('')}</div>
    ${tabs('Moje')}`,
});

// 4. Kantor: tablica kursów, wejście i wyjście jak kupno i sprzedaż.
DIRECTIONS.push({
  key: 'kantor',
  name: 'Kantor',
  pitch: 'Tablica kursów z kantoru: dla każdego modelu dwie kolumny, wejście i wyjście, jak kupno i sprzedaż. Ciemne tło, bursztynowe cyfry. Bardzo charakterystyczny, gęsty, dobrze się skanuje wzrokiem.',
  fonts: 'family=Sora:wght@400..800&family=Azeret+Mono:wght@500..800',
  css: `
  :root{--bg:#0d231c;--card:#12302626;--panel:#163a2f;--ink:#eef5f1;--ink2:#9fb8ad;--line:#24493d;--amber:#ffb627;--red:#ff6b5b;--green:#5fe3a1}
  .phone{background:var(--bg);color:var(--ink);font-family:Sora,sans-serif}
  .mono{font-family:'Azeret Mono',monospace;font-variant-numeric:tabular-nums}
  h1{font-size:26px;font-weight:800;margin:0;letter-spacing:-.02em}
  .sub{color:var(--ink2);font-size:12.5px}
  .seg{display:flex;gap:6px}
  .seg span{flex:1;text-align:center;padding:9px 0;border-radius:10px;font-size:13px;font-weight:700;background:var(--panel);color:var(--ink2)}
  .seg span.on{background:var(--amber);color:#1b1300}
  .board{background:#081a14;border:1px solid var(--line);border-radius:14px;overflow:hidden}
  .bh,.br{display:grid;grid-template-columns:1fr 66px 66px;gap:8px;align-items:center;padding:10px 12px}
  .bh{font-size:11px;color:var(--ink2);border-bottom:1px solid var(--line);font-weight:600}
  .bh span:not(:first-child),.br .d{text-align:right}
  .br{border-bottom:1px solid #ffffff10}
  .d{color:var(--amber);font-size:16px;font-weight:700}
  .nm{font-weight:700;font-size:14.5px}
  .pct{color:var(--red);font-weight:800;font-size:12px}
  .tabs{background:#081a14;border-top:1px solid var(--line)} .tab.on{color:var(--amber)}
  .big{font-size:38px;font-weight:800;color:var(--amber)}
  .btn{flex:1;text-align:center;padding:12px;border-radius:12px;font-weight:800;font-size:14px;background:var(--amber);color:#1b1300}
  .btn.ghost{background:transparent;color:var(--ink);border:1.5px solid var(--line)}
  .card{background:var(--panel);border-radius:14px;padding:14px}
  .warn{color:var(--red);font-weight:700;font-size:12.5px} .ok{color:var(--green);font-weight:700;font-size:12.5px}
  .digits{display:inline-flex;gap:3px} .digits i{font-style:normal;background:#081a14;border:1px solid var(--line);border-radius:5px;padding:2px 4px;color:var(--amber);font-family:'Azeret Mono';font-weight:800;font-size:26px}
  `,
  home: () => `
    <div class="top"><div><h1>Kantor tokenów</h1><div class="sub">Kurs z 14:05 · Ola</div></div><span class="bell">${ic('bell', 22)}<i></i></span></div>
    <div class="seg">${['all', 'text', 'coding', 'image', 'video'].map((c, i) => `<span class="${i === 0 ? 'on' : ''}">${CAT[c]}</span>`).join('')}</div>
    <div class="seg"><span class="on">Zniżki ${counts.discount}</span><span>Obniżki ${counts.drop}</span><span>Darmowe ${counts.free}</span></div>
    <div class="board"><div class="bh"><span>Model / dostawca</span><span>Wejście</span><span>Wyjście</span></div>${dealList.slice(0, 7).map((d) => `
      <div class="br"><div><div class="nm">${esc(d.name)}</div><div class="sub">${esc(d.provider)} <span class="pct">−${d.pct}%</span></div></div><span class="d mono">${money(d.inP)}</span><span class="d mono">${money(d.outP)}</span></div>`).join('')}</div>
    <div class="sub" style="text-align:center">USD za 1M tokenów</div>
    ${tabs('Promocje')}`,
  model: () => `
    <div class="top"><span class="backb">${ic('back', 22)}</span><span class="bell">${ic('star', 22)}</span></div>
    <div><h1>${esc(model.name)}</h1><div class="sub">${model.author} · ${model.cats.join(', ')} · ${model.ctx}</div></div>
    <div class="card"><div class="sub">Najlepszy kurs, 10M wej. + 2M wyj.</div><div class="digits">${formatUsd(model.best.cost).replace(' $', '').split('').map((c) => `<i>${c}</i>`).join('')}<i>$</i></div><div class="ok" style="margin-top:6px">${esc(model.best.provider)} · taniej o ${formatUsd(model.save)}</div></div>
    <div style="display:flex;gap:8px"><span class="btn">Używam</span><span class="btn ghost">Obserwuj</span></div>
    <div class="board"><div class="bh"><span>Dostawca</span><span>Wejście</span><span>Wyjście</span></div>${model.offers.slice(0, 5).map((o) => `
      <div class="br"><div><div class="nm">${esc(o.provider)}</div><div class="sub">${o.src}${o.pct ? ` <span class="pct">−${o.pct}%</span>` : ''}</div></div><span class="d mono">${money(o.inP)}</span><span class="d mono">${money(o.outP)}</span></div>`).join('')}</div>
    ${tabs('Szukaj')}`,
  mine: () => `
    <div class="top"><div><h1>Moje kursy</h1><div class="sub">3 używane · 3 obserwowane</div></div></div>
    <div class="card"><div class="sub">Oszczędność miesięczna</div><span class="big mono">${formatUsd(mine.savings)}</span></div>
    ${mine.using.map((u) => `
      <div class="card"><div style="display:flex;justify-content:space-between"><b>${u.name}</b><span class="mono" style="color:var(--amber);font-weight:700">${u.price}</span></div>
      <div class="sub">u ${u.provider}</div>
      <div style="margin-top:6px">${u.state === 'aging' ? `<span class="warn">⚠ Promocja −${u.pct}%: dzień ${u.days} z ~${u.typical}</span>` : u.state === 'ended' ? '<span class="warn">⚠ Promocja skończyła się 2 h temu</span>' : '<span class="ok">✓ Najlepszy kurs</span>'}</div>
      ${u.cheaper ? `<div class="ok">${u.cheaper.provider} taniej o ${u.cheaper.pct}%</div>` : ''}</div>`).join('')}
    ${tabs('Moje')}`,
});

// 5. Kolory kategorii: każda kategoria ma kolor, start od kafli na całą szerokość.
DIRECTIONS.push({
  key: 'kategorie',
  name: 'Kolorowe kategorie',
  pitch: 'Każda kategoria ma własny kolor (Tekst, Kod, Obraz, Wideo) i kafel na ekranie głównym z liczbą promocji i najlepszą okazją. Karty mają kolorowy pasek, więc od razu widać, czego dotyczą. Najbardziej przyjazny, „konsumencki”.',
  fonts: 'family=Bricolage+Grotesque:opsz,wght@12..96,500..800&family=Figtree:wght@400..700',
  css: `
  :root{--bg:#f7f7fb;--card:#fff;--ink:#1a1530;--ink2:#6b6880;--line:#ebeaf2;--text:#3d63ff;--coding:#8b3dff;--image:#ff4f8b;--video:#ff8a00;--all:#1a1530;--deal:#e8333a;--save:#0f9b6c}
  .phone{background:var(--bg);color:var(--ink);font-family:Figtree,sans-serif}
  h1,.disp{font-family:'Bricolage Grotesque',sans-serif;font-weight:800;letter-spacing:-.02em}
  h1{font-size:28px;margin:0}
  .sub{color:var(--ink2);font-size:13px}
  .tiles{display:grid;grid-template-columns:1fr 1fr;gap:8px}
  .tile{border-radius:18px;padding:12px;color:#fff;min-height:74px;display:flex;flex-direction:column;justify-content:space-between}
  .tile b{font-family:'Bricolage Grotesque';font-size:22px} .tile small{font-size:12px;opacity:.9}
  .tile.wide{grid-column:span 2;flex-direction:row;align-items:center;min-height:0}
  .seg{display:flex;background:#ecebf3;border-radius:12px;padding:3px}
  .seg span{flex:1;text-align:center;padding:8px 0;border-radius:9px;font-size:13px;font-weight:700;color:var(--ink2)}
  .seg span.on{background:var(--card);color:var(--ink);box-shadow:0 1px 2px #0001}
  .card{background:var(--card);border-radius:16px;padding:12px 14px 12px 18px;position:relative;display:grid;grid-template-columns:1fr auto;gap:3px 10px;overflow:hidden}
  .card:before{content:'';position:absolute;left:0;top:0;bottom:0;width:6px;background:var(--c)}
  .nm{font-weight:700;font-size:15.5px}
  .p{text-align:right;font-family:'Bricolage Grotesque';font-weight:800;font-size:20px}
  .pct{display:inline-block;background:var(--deal);color:#fff;font-weight:800;font-size:12px;padding:2px 7px;border-radius:7px}
  .chip{display:inline-flex;align-items:center;gap:4px;font-size:12px;font-weight:600;color:var(--c)}
  .tabs{background:var(--card);border-top:1px solid var(--line)} .tab.on{color:var(--ink)}
  .btn{flex:1;text-align:center;padding:12px;border-radius:14px;font-weight:700;font-size:14px;background:var(--ink);color:#fff}
  .btn.ghost{background:var(--card);color:var(--ink);border:1.5px solid var(--line)}
  .hero{border-radius:20px;padding:16px;background:linear-gradient(0deg,#fff,#fff);border:2px solid var(--text)}
  .stat{display:grid;grid-template-columns:1fr 1fr;gap:8px}
  .stat div{background:var(--card);border-radius:16px;padding:12px}
  .stat b{font-family:'Bricolage Grotesque';font-size:24px}
  .alert{display:flex;gap:10px;align-items:flex-start;background:var(--card);border-radius:14px;padding:12px}
  .alert .dot{width:30px;height:30px;border-radius:10px;display:grid;place-items:center;flex:none}
  `,
  home: () => {
    const tile = (c, wide) => {
      const best = dealList.find((d) => c === 'all' || d.cat === c);
      return `<div class="tile ${wide ? 'wide' : ''}" style="background:var(--${c})">${wide ? `<div style="flex:1"><small>Wszystkie promocje</small><br><b>${counts.cats[c]}</b></div><div style="text-align:right"><small>największa</small><br><b>−${dealList[0].pct}%</b></div>` : `<div style="display:flex;justify-content:space-between">${ic(c, 20)}<b>${counts.cats[c]}</b></div><small>${CAT[c]}${best ? `, do −${best.pct}%` : ''}</small>`}</div>`;
    };
    return `
    <div class="top"><div><div class="sub">Cześć Ola</div><h1>Co dziś tanieje?</h1></div><span class="bell">${ic('bell', 22)}<i></i></span></div>
    <div class="tiles">${tile('all', true)}${['text', 'coding', 'image', 'video'].map((c) => tile(c)).join('')}</div>
    <div class="seg"><span class="on">Zniżki</span><span>Obniżki</span><span>Darmowe</span></div>
    <div class="list">${dealList.slice(0, 4).map((d) => `
      <div class="card" style="--c:var(--${d.cat})"><span class="nm">${esc(d.name)}</span><span class="p">${money(d.inP)} $</span>
      <span class="chip">${ic(d.cat, 14)} ${CAT[d.cat]} · ${esc(d.provider)}</span><span style="text-align:right"><span class="pct">−${d.pct}%</span></span></div>`).join('')}</div>
    ${tabs('Promocje')}`;
  },
  model: () => `
    <div class="top"><span class="backb">${ic('back', 22)}</span><span class="bell">${ic('star', 22)}</span></div>
    <div><span class="chip" style="--c:var(--text)">${ic('text', 14)} Tekst</span> <span class="chip" style="--c:var(--coding)">${ic('code', 14)} Kod</span><h1 style="margin-top:4px">${esc(model.name)}</h1><div class="sub">${model.author} · ${model.ctx} kontekstu · ${model.count} ofert</div></div>
    <div class="stat"><div><span class="sub">Najtaniej / mies.</span><br><b>${formatUsd(model.best.cost)}</b><br><span class="sub">${esc(model.best.provider)}</span></div><div><span class="sub">Oszczędzasz</span><br><b style="color:var(--save)">${formatUsd(model.save)}</b><br><span class="sub">vs najdroższy</span></div></div>
    <div style="display:flex;gap:8px"><span class="btn">Używam</span><span class="btn ghost">Obserwuj</span></div>
    <div class="seg"><span class="on">Wszyscy</span><span>Ulubieni</span><span>Z promocją</span></div>
    <div class="list">${model.offers.slice(0, 4).map((o, i) => `
      <div class="card" style="--c:${i ? 'var(--line)' : 'var(--save)'}"><span class="nm">${i ? '' : '🏆 '}${esc(o.provider)}</span><span class="p">${formatUsd(o.cost)}</span>
      <span class="sub">${money(o.inP)} / ${money(o.outP)} $ · ${o.src}</span><span style="text-align:right">${o.pct ? `<span class="pct">−${o.pct}%</span>` : ''}</span></div>`).join('')}</div>
    ${tabs('Szukaj')}`,
  mine: () => `
    <div class="top"><div><h1>Moje</h1><div class="sub">3 używane, 3 obserwowane</div></div></div>
    <div class="stat"><div><span class="sub">Oszczędzasz</span><br><b style="color:var(--save)">${formatUsd(mine.savings)}</b><br><span class="sub">miesięcznie</span></div><div><span class="sub">Do sprawdzenia</span><br><b style="color:var(--deal)">2</b><br><span class="sub">promocje się kończą</span></div></div>
    ${mine.alerts.map((a) => `
      <div class="alert"><span class="dot" style="background:${a.urgent ? '#fde7e8' : '#e9edff'};color:${a.urgent ? 'var(--deal)' : 'var(--text)'}">${ic(a.urgent ? 'warn' : 'tag', 18)}</span><div style="flex:1"><div class="sub" style="color:${a.urgent ? 'var(--deal)' : 'var(--text)'};font-weight:700">${a.kind}</div><b>${a.title}</b><div class="sub">${a.body}</div></div><span class="sub">${a.ago}</span></div>`).join('')}
    <div class="list">${mine.using.slice(0, 2).map((u) => `
      <div class="card" style="--c:${u.state === 'ok' ? 'var(--save)' : 'var(--deal)'}"><span class="nm">${u.name}</span><span class="p" style="font-size:16px">${u.price}</span><span class="sub">u ${u.provider}</span><span></span></div>`).join('')}</div>
    ${tabs('Moje')}`,
});

// ---------- składanie stron ----------
const BASE = `
  *{box-sizing:border-box} body{margin:0;background:#d9dbe1;font-family:system-ui,sans-serif;color:#111}
  .sheet{padding:28px 32px 36px}
  .sheet h2{font:800 30px/1.1 system-ui;margin:0 0 6px} .sheet p.pitch{max-width:900px;margin:0 0 22px;color:#333;font-size:16px;line-height:1.5}
  .phones{display:flex;gap:28px;align-items:flex-start}
  .phone{width:390px;height:844px;border-radius:44px;overflow:hidden;position:relative;display:flex;flex-direction:column;box-shadow:0 30px 60px -30px #0007,0 0 0 10px #111}
  .status{height:44px;flex:none;display:flex;justify-content:space-between;align-items:center;padding:0 28px;font-weight:600;font-size:14px}
  .scr{flex:1;overflow:hidden;padding:4px 16px 0;display:flex;flex-direction:column;gap:12px}
  .top{display:flex;justify-content:space-between;align-items:flex-end}
  .bell{position:relative;width:40px;height:40px;border-radius:12px;display:grid;place-items:center}
  .bell i{position:absolute;right:9px;top:8px;width:8px;height:8px;border-radius:9px;background:#e8333a}
  .backb{width:40px;height:40px;display:grid;place-items:center;margin-left:-8px}
  .list{display:flex;flex-direction:column;gap:8px}
  .tabs{position:absolute;left:0;right:0;bottom:0;display:flex;padding:8px 0 26px}
  .tab{flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;opacity:.55} .tab.on{opacity:1}
  .tab b{font-size:11px;font-weight:600}
  .caption{text-align:center;font:600 14px system-ui;color:#333;margin-top:14px}
`;

function page(d) {
  const screens = [['Promocje', d.home()], ['Karta modelu', d.model()], ['Moje', d.mine()]];
  return `<!doctype html><html lang="pl"><head><meta charset="utf-8"><title>Makieta: ${d.name}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?${d.fonts}&display=swap">
<style>${BASE}${d.css}</style></head><body><div class="sheet">
<h2>${DIRECTIONS.indexOf(d) + 1}. ${d.name}</h2><p class="pitch">${d.pitch}</p>
<div class="phones">${screens.map(([label, html]) => `<div><div class="phone"><div class="status"><span>14:05</span><span>●●● ▮</span></div><div class="scr">${html}</div></div><div class="caption">${label}</div></div>`).join('')}</div>
</div></body></html>`;
}

for (const d of DIRECTIONS) writeFileSync(join(DIR, `${DIRECTIONS.indexOf(d) + 1}-${d.key}.html`), page(d));
writeFileSync(join(DIR, 'index.html'), `<!doctype html><html lang="pl"><head><meta charset="utf-8"><title>Makiety TaniToken</title></head><body style="font-family:system-ui;max-width:760px;margin:40px auto;padding:0 16px">
<h1>Makiety TaniToken</h1><p>5 kierunków, te same 3 ekrany, dane ze snapshotu z ${snap.generatedAt.slice(0, 16).replace('T', ' ')} UTC.</p><ol>${DIRECTIONS.map((d, i) => `<li><a href="${i + 1}-${d.key}.html">${d.name}</a>: ${d.pitch}</li>`).join('')}</ol></body></html>`);

if (process.argv.includes('--png')) {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  for (const d of DIRECTIONS) {
    const p = await browser.newPage({ viewport: { width: 1320, height: 1080 }, deviceScaleFactor: 1 });
    await p.goto(`file://${join(DIR, `${DIRECTIONS.indexOf(d) + 1}-${d.key}.html`)}`);
    await p.waitForTimeout(1200);
    await p.screenshot({ path: join(DIR, `${DIRECTIONS.indexOf(d) + 1}-${d.key}.png`), fullPage: true });
    await p.close();
  }
  await browser.close();
}
console.log(`OK ${DIRECTIONS.length} makiet w ${DIR}`);
