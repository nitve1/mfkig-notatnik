import {
  DEFAULT_USAGE, UNIT_LABEL, collectDeals, searchModels, cheapest, sortOffers, offerCost, offerKey,
  priceBeforeDiscount, liveSnapshot, liveOpenrouterOffers, formatUsd, formatOfferPrice, formatContext,
  promoAgeText, timeAgo, isFreeOffer, platformOf,
} from '../core/pricing.js';
import { LANGUAGES, setLanguage, t } from '../core/i18n.js';
import { offerLink } from '../core/affiliates.js';
import { dayOf, priceSeries } from '../core/history.js';
import { L, setPageLang } from './i18n.js';

// Zestawienie z gałęzi danych (GitHub Actions co 15 min), potem kopia w repo, na końcu OpenRouter na żywo.
const DATA = [
  'https://raw.githubusercontent.com/nitve1/mfkig-notatnik/tanitoken-data/',
  '../data/',
];
const REFRESH_MS = 5 * 60 * 1000;
const PAGE = 12;
const TILE_CATS = ['text', 'coding', 'image', 'video'];
const CAT_COLOR = { text: '#8aa2ff', coding: '#a875ff', image: '#ff6fa3', video: '#ffa23a' };
const TINT = { text: '74,99,216', coding: '122,63,224', image: '194,24,91', video: '168,83,10' };
const LANG_KEY = 'lighttokenz:lang';

const $ = (sel) => document.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const mainCat = (m) => (m.cats.includes('video') ? 'video' : m.cats.includes('image') ? 'image' : m.cats.includes('coding') ? 'coding' : 'text');
const where = (o) => platformOf(o) ?? o.provider;
// Gdzie kupisz i przez kogo, np. "OpenRouter, via Baidu".
const whereVia = (o) => (where(o) !== o.provider ? L('via', { where: where(o), provider: o.provider }) : where(o));
// Nazwa bez prefiksu twórcy ("DeepSeek: DeepSeek V4" -> "DeepSeek V4").
const shortName = (name) => name.replace(/^[^:]{1,40}:\s*/, '');

const state = { snapshot: null, history: null, deals: [], cat: null, type: 'discount', shown: PAGE, usage: structuredClone(DEFAULT_USAGE) };

// ---------- język: domyślnie angielski, wybór zapamiętany w przeglądarce ----------
function savedLang() {
  try { return localStorage.getItem(LANG_KEY); } catch { return null; }
}
function applyLang(code) {
  const lang = setPageLang(code);
  setLanguage(lang);
  document.documentElement.lang = lang;
  document.title = L('meta.title');
  document.querySelector('meta[name="description"]')?.setAttribute('content', L('meta.description'));
  document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = L(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-aria]').forEach((el) => el.setAttribute('aria-label', L(el.dataset.i18nAria)));
  document.querySelectorAll('[data-i18n-alt]').forEach((el) => el.setAttribute('alt', L(el.dataset.i18nAlt)));
  document.querySelectorAll('[data-i18n-ph]').forEach((el) => el.setAttribute('placeholder', L(el.dataset.i18nPh)));
  $('#lang').value = lang;
  renderLead();
  if (state.snapshot) renderAll();
}
$('#lang').innerHTML = LANGUAGES.map((l) => `<option value="${l.code}">${esc(l.name)}</option>`).join('');
$('#lang').addEventListener('change', (e) => {
  try { localStorage.setItem(LANG_KEY, e.target.value); } catch { /* bez zapamiętania */ }
  applyLang(e.target.value);
});

function providerCount() {
  return state.snapshot ? new Set(state.snapshot.models.flatMap((m) => m.offers.map((o) => o.provider))).size : 200;
}
function renderLead() {
  $('#hero-lead').innerHTML = esc(L('hero.lead', { n: '\u0000' })).replace('\u0000', `<span data-stat="providers">${providerCount()}</span>`);
}

// ---------- dane ----------
async function getJson(file, check) {
  for (const base of DATA) {
    try {
      const r = await fetch(`${base}${file}?t=${Math.floor(Date.now() / 60000)}`);
      if (!r.ok) continue;
      const json = await r.json();
      if (check(json)) return json;
    } catch { /* następne źródło */ }
  }
  return null;
}

async function load() {
  try {
    state.snapshot = (await getJson('snapshot.json', (s) => s.v === 2)) ?? (await liveSnapshot());
  } catch {
    if (!state.snapshot) {
      $('#status').classList.add('error');
      $('#status').lastChild.textContent = L('status.error');
    }
    return;
  }
  state.deals = collectDeals(state.snapshot);
  renderAll();
  // Historia cen jest większa, więc dociągamy ją po wyświetleniu reszty.
  state.history ??= await getJson('history.json', (h) => h.v === 1);
  renderHero();
  const fromHash = new URLSearchParams(location.hash.slice(1)).get('model');
  if (fromHash && !$('#model').dataset.model) openModel(fromHash, false);
}

function renderAll() {
  renderLead();
  renderStatus();
  renderTiles();
  renderDeals();
  renderPopular();
  renderHero();
  const id = $('#model').dataset.model;
  const m = id && state.snapshot.models.find((x) => x.id === id);
  if (m) renderModel(m);
}

function renderStatus() {
  const s = state.snapshot;
  const discounts = state.deals.filter((d) => d.type !== 'free').length;
  const free = state.deals.filter((d) => d.type === 'free').length;
  $('#status').classList.remove('error');
  $('#status').lastChild.textContent = s.partial
    ? L('status.partial')
    : L('status.ok', { age: timeAgo(s.updatedAt ?? s.generatedAt), promos: L('count.promos', { n: discounts }), free: L('count.free', { n: free }) });
}

function priceParts(o) {
  if (o.unit === 'token') return { main: formatUsd(o.in), unit: L('unit.in'), short: L('unit.inShort'), extra: L('unit.out', { price: formatUsd(o.out) }) };
  return { main: formatUsd(o.price), unit: L(o.unit === 'image' ? 'unit.image' : 'unit.second'), short: L(o.unit === 'image' ? 'unit.image' : 'unit.secondShort'), extra: '' };
}

// Mała linia ceny z 30 dni (najtaniej w ogóle), gdy jest historia z serwera.
function sparkline(model) {
  if (!state.history) return '';
  const pts = priceSeries(state.history, model, { days: 30, today: dayOf(Date.now()), usage: state.usage });
  const vals = pts.map((p) => p.best).filter((v) => v != null);
  if (vals.length < 2) return '';
  const max = Math.max(...vals) * 1.1;
  const min = Math.min(...vals) * 0.9;
  const x = (i) => (i / pts.length) * 300;
  const y = (v) => 50 - ((v - min) / (max - min || 1)) * 44;
  let d = '';
  let prev = null;
  pts.forEach((p, i) => {
    if (p.best == null) { prev = null; return; }
    d += prev == null ? `M${x(i)},${y(p.best)}` : `V${y(p.best)}`;
    d += `H${x(i + 1)}`;
    prev = p.best;
  });
  return `<svg viewBox="0 0 300 56" preserveAspectRatio="none" aria-hidden="true"><path d="${d}" fill="none" stroke="#6a86f5" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>`;
}

function renderHero() {
  const top = state.deals.find((d) => d.type === 'discount' && d.model.cats.includes('text')) ?? state.deals.find((d) => d.offer);
  const el = $('#hero-card');
  if (!top) {
    el.innerHTML = `<p class="skeleton">${esc(L('hero.none'))}</p>`;
    return;
  }
  const before = top.type === 'drop' ? { ...top.offer, ...top.from } : priceBeforeDiscount(top.offer);
  const p = priceParts(top.offer);
  const cat = mainCat(top.model);
  el.innerHTML = `
    <p class="cat" style="color:${CAT_COLOR[cat]}">${esc(t(`cat.${cat}`))}</p>
    <p class="name">${esc(shortName(top.model.name))}</p>
    <p class="prov">${esc(whereVia(top.offer))}</p>
    <p class="price"><b>${esc(p.main)}</b><small>${esc(p.unit)}</small></p>
    <div class="row"><span>${before ? `<span class="old">${esc(formatOfferPrice(before))}</span>` : esc(p.extra)}</span><span class="pct">−${top.pct}%</span></div>
    ${sparkline(top.model)}`;
  el.onclick = () => openModel(top.model.id, true);
  $('#hero-caption').textContent = L('hero.caption', { age: promoAgeText(top) });
}

function renderTiles() {
  const discounts = state.deals.filter((d) => d.type === 'discount');
  $('#tiles').innerHTML = TILE_CATS.map((c) => {
    const list = discounts.filter((d) => d.model.cats.includes(c));
    const best = list[0];
    return `<button class="tile" data-cat="${c}" aria-pressed="${state.cat === c}">
      <b>${list.length}</b><span>${esc(t(`cat.${c}`))}</span><small>${best ? esc(L('tile.upTo', { pct: best.pct })) : esc(L('tile.none'))}</small></button>`;
  }).join('');
}
$('#tiles').addEventListener('click', (e) => {
  const b = e.target.closest('[data-cat]');
  if (!b) return;
  state.cat = state.cat === b.dataset.cat ? null : b.dataset.cat;
  state.shown = PAGE;
  renderTiles();
  renderDeals();
  $('#deals-section').scrollIntoView();
});

function dealRow(d) {
  const m = d.model;
  const cat = mainCat(m);
  const dot = `<span class="dot" style="background:${CAT_COLOR[cat]}" aria-hidden="true"></span>`;
  if (d.type === 'free') {
    return `<li class="deal"><button data-model="${esc(m.id)}"><span><p class="deal-name">${esc(shortName(m.name))}</p>
      <p class="deal-meta">${dot}${esc(t(`cat.${cat}`))}, ${esc(L('deal.free', { age: promoAgeText(d) }))}</p></span>
      <span class="deal-price"><b>${esc(formatUsd(0))}</b><small>${esc(L('deal.limits'))}</small></span></button></li>`;
  }
  const p = priceParts(d.offer);
  return `<li class="deal"><button data-model="${esc(m.id)}"><span><p class="deal-name">${esc(shortName(m.name))}</p>
    <p class="deal-meta">${dot}${esc(whereVia(d.offer))}, ${esc(L(d.type === 'drop' ? 'deal.drop' : 'deal.discount', { age: promoAgeText(d) }))}</p></span>
    <span class="deal-price"><span class="top"><span class="pct">−${d.pct}%</span><b>${esc(p.main)}</b></span><small>${esc(p.short)}</small></span></button></li>`;
}

function renderDeals() {
  const list = state.deals.filter((d) => d.type === state.type && (!state.cat || d.model.cats.includes(state.cat)));
  const count = L({ discount: 'count.discount', drop: 'count.drop', free: 'count.free2' }[state.type], { n: list.length });
  $('#promo-summary').textContent = list.length ? [count, state.cat ? t(`cat.${state.cat}`) : null, L('deals.biggest')].filter(Boolean).join(', ') : '';
  $('#deals').innerHTML = list.length
    ? list.slice(0, state.shown).map(dealRow).join('')
    : `<li class="empty">${esc(L(state.type === 'drop' ? 'deals.emptyDrop' : 'deals.empty'))}</li>`;
  $('#more-deals').hidden = list.length <= state.shown;
}

document.querySelector('.toolbar').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-value]');
  if (!b) return;
  state.type = b.dataset.value;
  state.shown = PAGE;
  b.parentElement.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  renderDeals();
});
$('#more-deals').addEventListener('click', () => { state.shown += PAGE; renderDeals(); });
$('#deals').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-model]');
  if (b) openModel(b.dataset.model, true);
});

// ---------- wyszukiwarka (combobox) ----------
let active = -1;
function renderResults() {
  const q = $('#q').value;
  const box = $('#results');
  if (!state.snapshot || !q.trim()) { box.innerHTML = ''; $('#q').setAttribute('aria-expanded', 'false'); return; }
  const found = searchModels(state.snapshot.models, q).slice(0, 8);
  active = found.length ? 0 : -1;
  box.innerHTML = found.length
    ? found.map((m, i) => {
      const c = cheapest(m);
      return `<li role="option" id="opt-${i}" aria-selected="${i === 0}" data-model="${esc(m.id)}"><span>${esc(m.name)}</span><small>${c ? esc(L('cmp.from', { price: formatOfferPrice(c) })) : m.freeId ? esc(L('cmp.free')) : ''}</small></li>`;
    }).join('')
    : `<li aria-disabled="true">${esc(L('cmp.none'))}</li>`;
  $('#q').setAttribute('aria-expanded', 'true');
}
function moveActive(delta) {
  const opts = [...document.querySelectorAll('#results [role="option"]')];
  if (!opts.length) return;
  active = (active + delta + opts.length) % opts.length;
  opts.forEach((o, i) => o.setAttribute('aria-selected', String(i === active)));
  $('#q').setAttribute('aria-activedescendant', `opt-${active}`);
}
function pick(id) {
  $('#results').innerHTML = '';
  $('#q').value = '';
  $('#q').setAttribute('aria-expanded', 'false');
  openModel(id, false);
}
$('#q').addEventListener('input', renderResults);
$('#q').addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown') { e.preventDefault(); moveActive(1); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); moveActive(-1); }
  else if (e.key === 'Enter') {
    const opt = document.querySelector('#results [aria-selected="true"]');
    if (opt) { e.preventDefault(); pick(opt.dataset.model); }
  } else if (e.key === 'Escape') { $('#results').innerHTML = ''; }
});
$('#results').addEventListener('click', (e) => {
  const li = e.target.closest('[data-model]');
  if (li) pick(li.dataset.model);
});
document.addEventListener('click', (e) => { if (!e.target.closest('.search')) $('#results').innerHTML = ''; });

function renderPopular() {
  const picks = [...state.snapshot.models].sort((a, b) => b.offers.length - a.offers.length).slice(0, 5);
  $('#popular').innerHTML = `${esc(L('cmp.popular'))} ${picks.map((m) => `<button data-model="${esc(m.id)}">${esc(shortName(m.name))}</button>`).join('')}`;
}
$('#popular').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-model]');
  if (b) openModel(b.dataset.model, false);
});

// ---------- karta modelu (jak w apce: nagłówek w kolorze kategorii, cena na górze) ----------
async function openModel(id, scroll) {
  const m = state.snapshot.models.find((x) => x.id === id);
  if (!m) return;
  history.replaceState(null, '', `#model=${encodeURIComponent(id)}`);
  const box = $('#model');
  box.hidden = false;
  box.dataset.model = id;
  box.dataset.live = '';
  renderModel(m);
  if (scroll) $('#compare').scrollIntoView();
  if (!m.offers.some((o) => o.src === 'openrouter')) return;
  try {
    const live = await liveOpenrouterOffers(m);
    if (!live.length || box.dataset.model !== id) return;
    m.offers = [...live, ...m.offers.filter((o) => o.src !== 'openrouter')];
    box.dataset.live = '1';
    renderModel(m);
  } catch { /* zostają ceny z zestawienia */ }
}

function usageInputs(unit) {
  if (unit === 'token') {
    return `<label>${esc(L('model.in'))}<input id="use-in" type="number" min="0" step="0.5" data-u="in" value="${state.usage.token.in}" inputmode="decimal"></label>
      <label>${esc(L('model.out'))}<input id="use-out" type="number" min="0" step="0.5" data-u="out" value="${state.usage.token.out}" inputmode="decimal"></label>`;
  }
  return `<label>${esc(L(unit === 'image' ? 'model.images' : 'model.seconds'))}<input id="use-count" type="number" min="0" step="10" data-u="count" value="${state.usage[unit].count}" inputmode="numeric"></label>`;
}

function renderModel(m) {
  const box = $('#model');
  const offers = sortOffers(m, state.usage);
  const paid = offers.filter((o) => o.unit === m.unit && !isFreeOffer(o));
  const best = paid[0];
  const worst = paid[paid.length - 1];
  const cost = (o) => offerCost(o, state.usage);
  const promos = Object.values(state.snapshot.promos ?? {}).filter((p) => p.modelId === m.id);
  const cat = mainCat(m);

  const rows = offers.map((o) => {
    const before = priceBeforeDiscount(o);
    const link = offerLink(m, o);
    const promo = promos.find((p) => p.key === offerKey(o));
    const other = o.unit !== m.unit;
    const price = o.unit === 'token'
      ? `${before ? `<span class="old">${formatUsd(before.in)}</span>` : ''}${formatUsd(o.in)}</td><td>${before ? `<span class="old">${formatUsd(before.out)}</span>` : ''}${formatUsd(o.out)}`
      : `${before ? `<span class="old">${formatUsd(before.price)}</span>` : ''}${formatUsd(o.price)}</td><td>${o.variants?.length > 1 ? esc(o.variants.map((v) => `${v.label}: ${formatUsd(v.price)}`).join(', ')) : ''}`;
    const via = where(o) !== o.provider ? L('model.via', { provider: o.provider }) : '';
    return `<tr class="${o === best ? 'best' : ''}">
      <td class="prov">${esc(where(o))}${promo && promo.type !== 'free' ? `<span class="pct">−${promo.pct}%</span>` : ''}<span class="src">${[via, o.quant, promo ? L('model.promo', { age: promoAgeText(promo) }) : ''].filter(Boolean).map(esc).join(', ')}</span></td>
      <td>${price}</td>
      <td class="cost">${other ? `<span class="src">${esc(L('model.otherUnit'))}</span>` : formatUsd(cost(o))}</td>
      <td>${formatContext(o.context)}</td>
      <td>${link ? `<a class="go" href="${esc(link.url)}" target="_blank" rel="noopener${link.sponsored ? ' sponsored' : ''}">${esc(L(link.sponsored ? 'model.partner' : 'model.open'))}</a>${link.sponsored ? `<span class="sponsored">${esc(L('model.partnerLink'))}</span>` : ''}` : ''}</td></tr>`;
  }).join('');

  const priceHead = m.unit === 'token'
    ? `<th scope="col">${esc(L('model.colIn'))}</th><th scope="col">${esc(L('model.colOut'))}</th>`
    : `<th scope="col">${esc(L('model.colPrice'))}</th><th scope="col">${esc(L('model.colVariants'))}</th>`;
  const saving = best && worst ? cost(worst) - cost(best) : 0;
  const meta = [m.author, m.context ? L('model.context', { ctx: formatContext(m.context) }) : null, m.freeId ? L('model.freeVariant', { id: m.freeId }) : null].filter(Boolean).join(', ');

  box.innerHTML = `
    <div class="model-head" style="background:linear-gradient(180deg, rgba(${TINT[cat]},0.6), rgba(${TINT[cat]},0))">
      <div>
        <p class="cat" style="color:${CAT_COLOR[cat]}">${esc(t(`cat.${cat}`))}</p>
        <h3>${esc(shortName(m.name))}</h3>
        <p class="model-id">${esc(meta)}</p>
      </div>
      <button class="btn btn-line" id="close-model">${esc(L('model.close'))}</button>
    </div>
    <div class="model-price">
      <div><span class="lab">${esc(L('model.cheapest'))}</span><b>${best ? formatUsd(cost(best)) : m.freeId ? formatUsd(0) : '–'}</b><span class="lab">${best ? esc(where(best)) : ''}</span></div>
      ${saving > 0 ? `<div class="save"><span class="lab">${esc(L('model.save'))}</span><b>${formatUsd(saving)}</b><span class="lab">${esc(L('model.vsWorst'))}</span></div>` : ''}
    </div>
    <div class="calc">${usageInputs(m.unit)}</div>
    <div class="table-wrap"><table>
      <caption>${esc(L('model.caption', { unit: UNIT_LABEL[m.unit] }))}</caption>
      <thead><tr><th scope="col">${esc(L('model.where'))}</th>${priceHead}<th scope="col">${esc(L('model.colMonthly'))}</th><th scope="col">${esc(L('model.colContext'))}</th><th scope="col"><span class="sr-only">${esc(L('model.colLink'))}</span></th></tr></thead>
      <tbody>${rows || `<tr><td colspan="6">${esc(L('model.none'))}</td></tr>`}</tbody>
    </table></div>
    <p class="live-note">${esc(L(box.dataset.live ? 'model.liveDone' : 'model.liveLoading'))} ${esc(L('model.note'))}</p>`;

  box.querySelectorAll('[data-u]').forEach((input) => input.addEventListener('change', () => {
    const v = Math.max(0, Number(input.value) || 0);
    if (m.unit === 'token') state.usage.token[input.dataset.u] = v;
    else state.usage[m.unit].count = v;
    renderModel(m);
  }));
  $('#close-model').addEventListener('click', () => {
    box.hidden = true;
    box.dataset.model = '';
    history.replaceState(null, '', location.pathname);
  });
}

applyLang(savedLang() ?? 'en');
load();
setInterval(load, REFRESH_MS);
setInterval(() => state.snapshot && renderStatus(), 30 * 1000);
