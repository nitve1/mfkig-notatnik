import {
  CATEGORIES, DEFAULT_USAGE, UNIT_LABEL, collectDeals, searchModels, cheapest, sortOffers, offerCost, offerKey,
  priceBeforeDiscount, liveSnapshot, liveOpenrouterOffers, formatUsd, formatOfferPrice, formatContext,
  promoAgeText, timeAgo, isFreeOffer, platformOf,
} from '../core/pricing.js';
import { setLanguage, t } from '../core/i18n.js';
import { offerLink } from '../core/affiliates.js';
import { dayOf, priceSeries } from '../core/history.js';

setLanguage('pl');

// Zestawienie z gałęzi danych (GitHub Actions co 15 min), potem kopia w repo, na końcu OpenRouter na żywo.
const DATA = [
  'https://raw.githubusercontent.com/nitve1/mfkig-notatnik/tanitoken-data/',
  '../data/',
];
const REFRESH_MS = 5 * 60 * 1000;
const PAGE = 12;
const TILE_CATS = ['text', 'coding', 'image', 'video'];
const CAT_COLOR = { text: '#8aa2ff', coding: '#a875ff', image: '#ff6fa3', video: '#ffa23a' };

const $ = (sel) => document.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const plural = (n, one, few, many) => {
  if (n === 1) return one;
  const d = n % 10;
  const h = n % 100;
  return d >= 2 && d <= 4 && (h < 12 || h > 14) ? few : many;
};
const mainCat = (m) => (m.cats.includes('video') ? 'video' : m.cats.includes('image') ? 'image' : m.cats.includes('coding') ? 'coding' : 'text');
const where = (o) => platformOf(o) ?? o.provider;
// Gdzie kupisz i przez kogo, np. "OpenRouter, przez Baidu".
const whereVia = (o) => (where(o) !== o.provider ? `${where(o)}, przez ${o.provider}` : where(o));
// Nazwa bez prefiksu twórcy ("DeepSeek: DeepSeek V4" -> "DeepSeek V4").
const shortName = (name) => name.replace(/^[^:]{1,40}:\s*/, '');

const state = { snapshot: null, history: null, deals: [], cat: null, type: 'discount', shown: PAGE, usage: structuredClone(DEFAULT_USAGE) };

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
      $('#status').lastChild.textContent = 'Nie udało się pobrać cen. Sprawdź połączenie i odśwież stronę.';
    }
    return;
  }
  state.deals = collectDeals(state.snapshot);
  renderStatus();
  renderTiles();
  renderDeals();
  renderPopular();
  renderHero();
  // Historia cen jest większa, więc dociągamy ją po wyświetleniu reszty.
  state.history ??= await getJson('history.json', (h) => h.v === 1);
  renderHero();
  const fromHash = new URLSearchParams(location.hash.slice(1)).get('model');
  if (fromHash && !$('#model').dataset.model) openModel(fromHash, false);
}

function renderStatus() {
  const s = state.snapshot;
  const discounts = state.deals.filter((d) => d.type !== 'free').length;
  const free = state.deals.filter((d) => d.type === 'free').length;
  const providers = new Set(s.models.flatMap((m) => m.offers.map((o) => o.provider))).size;
  document.querySelectorAll('[data-stat="providers"]').forEach((el) => { el.textContent = `${providers}`; });
  $('#status').classList.remove('error');
  $('#status').lastChild.textContent = s.partial
    ? 'Pokazuję ceny podstawowe z OpenRouter, pełne zestawienie chwilowo nie odpowiada.'
    : `Ceny sprawdzone ${timeAgo(s.updatedAt ?? s.generatedAt)}. Teraz ${discounts} ${plural(discounts, 'promocja', 'promocje', 'promocji')} i ${free} ${plural(free, 'darmowy model', 'darmowe modele', 'darmowych modeli')}.`;
}

function priceParts(o) {
  if (o.unit === 'token') return { main: formatUsd(o.in), unit: 'za 1M tokenów wejścia', short: '/ 1M wej.', extra: `wyjście ${formatUsd(o.out)}` };
  return { main: formatUsd(o.price), unit: o.unit === 'image' ? 'za obraz' : 'za sekundę wideo', short: o.unit === 'image' ? 'za obraz' : 'za s', extra: '' };
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
  return `<svg viewBox="0 0 300 56" preserveAspectRatio="none" role="img" aria-label="Najniższa cena z 30 dni"><path d="${d}" fill="none" stroke="#6a86f5" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>`;
}

function renderHero() {
  const top = state.deals.find((d) => d.type === 'discount' && d.model.cats.includes('text')) ?? state.deals.find((d) => d.offer);
  const el = $('#hero-card');
  if (!top) {
    el.innerHTML = '<p class="skeleton">Teraz nikt nie daje zniżki. Zajrzyj za kilkanaście minut.</p>';
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
  $('#hero-caption').textContent = `Największa zniżka na model tekstowy, promocja ${promoAgeText(top)}.`;
}

function renderTiles() {
  const discounts = state.deals.filter((d) => d.type === 'discount');
  $('#tiles').innerHTML = TILE_CATS.map((c) => {
    const list = discounts.filter((d) => d.model.cats.includes(c));
    const best = list[0];
    return `<button class="tile" data-cat="${c}" aria-pressed="${state.cat === c}">
      <b>${list.length}</b><span>${esc(t(`cat.${c}`))}</span><small>${best ? `do −${best.pct}%` : 'brak zniżek'}</small></button>`;
  }).join('');
}
$('#tiles').addEventListener('click', (e) => {
  const b = e.target.closest('[data-cat]');
  if (!b) return;
  state.cat = state.cat === b.dataset.cat ? null : b.dataset.cat;
  state.shown = PAGE;
  renderTiles();
  renderDeals();
  $('#promocje').scrollIntoView();
});

function dealRow(d) {
  const m = d.model;
  const cat = mainCat(m);
  const dot = `<span class="dot" style="background:${CAT_COLOR[cat]}" aria-hidden="true"></span>`;
  if (d.type === 'free') {
    return `<li class="deal"><button data-model="${esc(m.id)}"><span><p class="deal-name">${esc(shortName(m.name))}</p>
      <p class="deal-meta">${dot}${esc(t(`cat.${cat}`))}, darmowy wariant ${esc(promoAgeText(d).replace('aktywna', 'dostępny'))}</p></span>
      <span class="deal-price"><b>0 $</b><small>z limitami</small></span></button></li>`;
  }
  const p = priceParts(d.offer);
  return `<li class="deal"><button data-model="${esc(m.id)}"><span><p class="deal-name">${esc(shortName(m.name))}</p>
    <p class="deal-meta">${dot}${esc(whereVia(d.offer))}, ${d.type === 'drop' ? 'obniżka' : 'zniżka'} ${esc(promoAgeText(d))}</p></span>
    <span class="deal-price"><span class="top"><span class="pct">−${d.pct}%</span><b>${esc(p.main)}</b></span><small>${esc(p.short)}</small></span></button></li>`;
}

function renderDeals() {
  const list = state.deals.filter((d) => d.type === state.type && (!state.cat || d.model.cats.includes(state.cat)));
  const typeName = { discount: plural(list.length, 'zniżka', 'zniżki', 'zniżek'), drop: plural(list.length, 'obniżka', 'obniżki', 'obniżek'), free: plural(list.length, 'darmowy model', 'darmowe modele', 'darmowych modeli') }[state.type];
  $('#promo-summary').textContent = list.length ? `${list.length} ${typeName}${state.cat ? `, ${t(`cat.${state.cat}`).toLowerCase()}` : ''}, od największej` : '';
  $('#deals').innerHTML = list.length
    ? list.slice(0, state.shown).map(dealRow).join('')
    : `<li class="empty">${state.type === 'drop'
      ? 'Przez ostatnie 7 dni nikt nie obniżył cen. Sprawdzamy to co 15 minut.'
      : 'W tej kategorii nic teraz nie ma. Wybierz inną kategorię albo rodzaj promocji.'}</li>`;
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
      return `<li role="option" id="opt-${i}" aria-selected="${i === 0}" data-model="${esc(m.id)}"><span>${esc(m.name)}</span><small>${c ? `od ${esc(formatOfferPrice(c))}` : m.freeId ? 'za darmo' : ''}</small></li>`;
    }).join('')
    : '<li aria-disabled="true">Nie ma takiego modelu. Spróbuj krótszej nazwy.</li>';
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
  $('#popular').innerHTML = `Najwięcej ofert: ${picks.map((m) => `<button data-model="${esc(m.id)}">${esc(m.name.replace(/^[^:]+:\s*/, ''))}</button>`).join('')}`;
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
  if (scroll) $('#porownaj').scrollIntoView();
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
    return `<label>Wejście, mln tokenów miesięcznie<input type="number" min="0" step="0.5" data-u="in" value="${state.usage.token.in}" inputmode="decimal"></label>
      <label>Wyjście, mln tokenów miesięcznie<input type="number" min="0" step="0.5" data-u="out" value="${state.usage.token.out}" inputmode="decimal"></label>`;
  }
  const label = unit === 'image' ? 'Obrazów miesięcznie' : 'Sekund wideo miesięcznie';
  return `<label>${label}<input type="number" min="0" step="10" data-u="count" value="${state.usage[unit].count}" inputmode="numeric"></label>`;
}

const TINT = { text: '74,99,216', coding: '122,63,224', image: '194,24,91', video: '168,83,10' };

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
    const via = where(o) !== o.provider ? `przez ${esc(o.provider)}` : '';
    return `<tr class="${o === best ? 'best' : ''}">
      <td class="prov">${esc(where(o))}${promo && promo.type !== 'free' ? `<span class="pct">−${promo.pct}%</span>` : ''}<span class="src">${[via, o.quant ? esc(o.quant) : '', promo ? `promocja ${esc(promoAgeText(promo))}` : ''].filter(Boolean).join(', ')}</span></td>
      <td>${price}</td>
      <td class="cost">${other ? '<span class="src">inna jednostka</span>' : formatUsd(cost(o))}</td>
      <td>${formatContext(o.context)}</td>
      <td>${link ? `<a class="go" href="${esc(link.url)}" target="_blank" rel="noopener${link.sponsored ? ' sponsored' : ''}">${link.sponsored ? 'Partner' : 'Otwórz'}</a>${link.sponsored ? '<span class="sponsored">link partnerski</span>' : ''}` : ''}</td></tr>`;
  }).join('');

  const priceHead = m.unit === 'token' ? '<th scope="col">Wejście / 1M</th><th scope="col">Wyjście / 1M</th>' : '<th scope="col">Cena</th><th scope="col">Warianty</th>';
  const saving = best && worst ? cost(worst) - cost(best) : 0;

  box.innerHTML = `
    <div class="model-head" style="background:linear-gradient(180deg, rgba(${TINT[cat]},0.6), rgba(${TINT[cat]},0))">
      <div>
        <p class="cat" style="color:${CAT_COLOR[cat]};font-weight:600;font-size:13px">${esc(t(`cat.${cat}`))}</p>
        <h3>${esc(m.name)}</h3>
        <p class="model-id">${esc(m.author ?? '')}${m.context ? `, ${formatContext(m.context)} kontekstu` : ''}${m.freeId ? `, darmowy wariant ${esc(m.freeId)}` : ''}</p>
      </div>
      <button class="btn btn-line" id="close-model">Zamknij</button>
    </div>
    <div class="model-price">
      <div><span class="lab">Najtaniej miesięcznie</span><b>${best ? formatUsd(cost(best)) : m.freeId ? '0 $' : '–'}</b><span class="lab">${best ? esc(where(best)) : ''}</span></div>
      ${saving > 0 ? `<div class="save"><span class="lab">Oszczędzasz</span><b>${formatUsd(saving)}</b><span class="lab">względem najdroższej</span></div>` : ''}
    </div>
    <div class="calc">${usageInputs(m.unit)}</div>
    <div class="table-wrap"><table>
      <caption>Ceny w ${esc(UNIT_LABEL[m.unit])}. Koszt miesięczny przy wpisanym zużyciu.</caption>
      <thead><tr><th scope="col">Gdzie kupisz</th>${priceHead}<th scope="col">Miesięcznie</th><th scope="col">Kontekst</th><th scope="col"><span class="sr-only">Link</span></th></tr></thead>
      <tbody>${rows || '<tr><td colspan="6">Nikt teraz nie sprzedaje tego modelu.</td></tr>'}</tbody>
    </table></div>
    <p class="live-note">${box.dataset.live ? 'Oferty z OpenRouter pobrane przed chwilą.' : 'Ceny z ostatniego sprawdzenia. Oferty z OpenRouter odświeżam na bieżąco…'} Linki Partner są partnerskie, kolejność zależy tylko od ceny.</p>`;

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

load();
setInterval(load, REFRESH_MS);
setInterval(() => state.snapshot && renderStatus(), 30 * 1000);
