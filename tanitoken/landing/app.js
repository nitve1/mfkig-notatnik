import {
  CATEGORIES, DEFAULT_USAGE, UNIT_LABEL, SOURCES, collectDeals, searchModels, cheapest, sortOffers, offerCost, offerKey,
  unitPrice, priceBeforeDiscount, liveSnapshot, liveOpenrouterOffers, formatUsd, formatOfferPrice, formatContext,
  formatDays, promoAgeDays, promoAgeText, timeAgo, isFreeOffer,
} from '../core/pricing.js';
import { offerLink } from '../core/affiliates.js';

// Świeży snapshot z gałęzi danych (Actions co 15 min), potem kopia w repo, na końcu OpenRouter na żywo.
const SNAPSHOT_URLS = [
  'https://raw.githubusercontent.com/nitve1/mfkig-notatnik/tanitoken-data/snapshot.json',
  '../data/snapshot.json',
];
const REFRESH_MS = 5 * 60 * 1000;
const PAGE = 15;
const CAT_LABEL = Object.fromEntries(CATEGORIES.map((c) => [c.key, c.label]));

const $ = (sel) => document.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const plural = (n, one, few, many) => {
  if (n === 1) return one;
  const d = n % 10;
  const t = n % 100;
  return d >= 2 && d <= 4 && (t < 12 || t > 14) ? few : many;
};

const state = { snapshot: null, deals: [], cat: 'all', type: 'discount', shown: PAGE, usage: structuredClone(DEFAULT_USAGE), sources: new Set(Object.keys(SOURCES)) };

async function fetchSnapshot() {
  for (const url of SNAPSHOT_URLS) {
    try {
      const r = await fetch(`${url}?t=${Math.floor(Date.now() / 60000)}`);
      if (!r.ok) continue;
      const s = await r.json();
      if (s.v === 2) return s;
    } catch { /* następne źródło */ }
  }
  return liveSnapshot();
}

async function load() {
  try {
    state.snapshot = await fetchSnapshot();
  } catch {
    if (!state.snapshot) {
      $('#status').classList.add('error');
      $('#status').lastChild.textContent = 'Nie udało się pobrać cen. Sprawdź połączenie i odśwież stronę.';
    }
    return;
  }
  state.deals = collectDeals(state.snapshot);
  renderStatus();
  renderHero();
  renderCats();
  renderDeals();
  renderPopular();
  renderNotifs();
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
    ? `Pokazuję ceny bazowe z OpenRouter (pełne zestawienie chwilowo niedostępne).`
    : `Ceny sprzed ${timeAgo(s.generatedAt).replace(' temu', '')}. Teraz ${discounts} ${plural(discounts, 'promocja', 'promocje', 'promocji')} i ${free} ${plural(free, 'darmowy model', 'darmowe modele', 'darmowych modeli')}.`;
}

function priceParts(o) {
  if (o.unit === 'token') return { main: formatUsd(o.in).replace(' $', ''), unit: '$ / 1M wejścia', extra: `wyjście ${formatUsd(o.out)}` };
  return { main: formatUsd(o.price).replace(' $', ''), unit: o.unit === 'image' ? '$ za obraz' : '$ za sekundę', extra: '' };
}

function renderHero() {
  const top = state.deals.find((d) => d.type === 'discount' && d.model.cats.includes('text')) ?? state.deals.find((d) => d.offer);
  const el = $('#hero-tag');
  if (!top) {
    el.innerHTML = '<span class="tag-hole" aria-hidden="true"></span><span class="tag-skeleton">Brak aktywnych zniżek w tej chwili.</span>';
    return;
  }
  const before = top.type === 'drop' ? { ...top.offer, ...top.from } : priceBeforeDiscount(top.offer);
  const p = priceParts(top.offer);
  el.innerHTML = `<span class="tag-hole" aria-hidden="true"></span>
    <div>
      <p class="tag-model">${esc(top.model.name)}</p>
      <p class="tag-provider">u ${esc(top.offer.provider)}, ${esc(SOURCES[top.offer.src]?.name ?? '')}</p>
    </div>
    <p class="tag-price">${esc(p.main)}<small>${esc(p.unit)}</small></p>
    <div class="tag-row">
      <span class="tag-old">${before ? `było ${esc(formatOfferPrice(before))}` : esc(p.extra)}</span>
      <span class="tag-pct">−${top.pct}%</span>
    </div>`;
  el.classList.remove('reveal');
  void el.offsetWidth;
  el.classList.add('reveal');
  el.style.cursor = 'pointer';
  el.onclick = () => openModel(top.model.id, true);
  $('#hero-caption').textContent = `Największa zniżka na model tekstowy. Promocja ${promoAgeText(top)}.`;
}

function catCount(cat) {
  return state.deals.filter((d) => d.type === state.type && (cat === 'all' || d.model.cats.includes(cat))).length;
}

function renderCats() {
  $('[data-group="cat"]').innerHTML = CATEGORIES.map(
    (c) => `<button aria-pressed="${state.cat === c.key}" data-value="${c.key}">${c.label}<span class="count">${catCount(c.key)}</span></button>`,
  ).join('');
}

function dealRow(d) {
  const m = d.model;
  const cats = m.cats.filter((c) => c !== 'text' || m.cats.length === 1).map((c) => CAT_LABEL[c]).join(', ');
  let tag;
  let meta;
  if (d.type === 'free') {
    tag = `<span class="mini-tag free"><span class="p">0 $</span><span class="u">wariant :free</span></span>`;
    meta = `${esc(m.author)}, ${esc(cats)}. Darmowy wariant ${promoAgeText(d).replace('aktywna', 'dostępny')}.`;
  } else {
    const p = priceParts(d.offer);
    tag = `<span class="mini-tag"><span class="pct">−${d.pct}%</span><span class="p">${esc(p.main)}</span><span class="u">${esc(p.unit)}</span></span>`;
    meta = `${esc(d.offer.provider)} w ${esc(SOURCES[d.offer.src]?.name)}, <span class="cat">${esc(cats)}</span>. ${d.type === 'drop' ? 'Obniżka' : 'Zniżka'} ${promoAgeText(d)}.`;
  }
  return `<li class="deal"><button data-model="${esc(m.id)}">
    <span><p class="deal-name">${esc(m.name)}</p><p class="deal-meta">${meta}</p></span>${tag}</button></li>`;
}

function renderDeals() {
  const list = state.deals.filter((d) => d.type === state.type && (state.cat === 'all' || d.model.cats.includes(state.cat)));
  const typeName = { discount: 'zniżek', drop: 'obniżek cen', free: 'darmowych modeli' }[state.type];
  $('#promo-summary').textContent = list.length ? `${list.length} ${typeName}, od największej` : '';
  $('#deals').innerHTML = list.length
    ? list.slice(0, state.shown).map(dealRow).join('')
    : `<li class="empty">${state.type === 'drop'
      ? 'Nikt nie obniżył cen w ostatnich 7 dniach. Obniżki wykrywamy przy każdej aktualizacji, zajrzyj później.'
      : 'Brak pozycji w tej kategorii. Wybierz inną kategorię albo rodzaj promocji.'}</li>`;
  $('#more-deals').hidden = list.length <= state.shown;
}

document.querySelector('.toolbar').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-value]');
  if (!b) return;
  const group = b.parentElement.dataset.group;
  state[group] = b.dataset.value;
  state.shown = PAGE;
  b.parentElement.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  if (group === 'type') renderCats();
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
      return `<li role="option" id="opt-${i}" aria-selected="${i === 0}" data-model="${esc(m.id)}"><span>${esc(m.name)}</span><small>${c ? `od ${esc(formatOfferPrice(c))}` : m.freeId ? 'darmowy' : ''}</small></li>`;
    }).join('')
    : '<li aria-disabled="true">Nie znaleźliśmy takiego modelu. Spróbuj krótszej nazwy.</li>';
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

// ---------- karta modelu ----------
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
  } catch { /* zostają ceny ze snapshotu */ }
}

function usageInputs(unit) {
  if (unit === 'token') {
    return `<label>Wejście, mln tokenów miesięcznie<input type="number" min="0" step="0.5" data-u="in" value="${state.usage.token.in}" inputmode="decimal"></label>
      <label>Wyjście, mln tokenów miesięcznie<input type="number" min="0" step="0.5" data-u="out" value="${state.usage.token.out}" inputmode="decimal"></label>`;
  }
  const label = unit === 'image' ? 'Obrazów miesięcznie' : 'Sekund wideo miesięcznie';
  return `<label>${label}<input type="number" min="0" step="10" data-u="count" value="${state.usage[unit].count}" inputmode="numeric"></label>`;
}

function renderModel(m) {
  const box = $('#model');
  const filter = (o) => state.sources.has(o.src);
  const offers = sortOffers(m, state.usage, filter);
  const main = offers.filter((o) => o.unit === m.unit);
  const paid = main.filter((o) => !isFreeOffer(o));
  const best = paid[0];
  const worst = paid[paid.length - 1];
  const cost = (o) => offerCost(o, state.usage);
  const promos = Object.values(state.snapshot.promos ?? {}).filter((p) => p.modelId === m.id);

  const rows = offers.map((o) => {
    const before = priceBeforeDiscount(o);
    const link = offerLink(m, o);
    const promo = promos.find((p) => p.key === offerKey(o));
    const other = o.unit !== m.unit;
    const price = o.unit === 'token'
      ? `${before ? `<span class="old">${formatUsd(before.in)}</span>` : ''}${formatUsd(o.in)}</td><td>${before ? `<span class="old">${formatUsd(before.out)}</span>` : ''}${formatUsd(o.out)}`
      : `${before ? `<span class="old">${formatUsd(before.price)}</span>` : ''}${formatUsd(o.price)} ${o.unit === 'image' ? 'za obraz' : 'za s'}</td><td>${o.variants?.length > 1 ? esc(o.variants.map((v) => `${v.label}: ${formatUsd(v.price)}`).join(', ')) : ''}`;
    return `<tr class="${o === best ? 'best' : ''} ${other ? 'other-unit' : ''}">
      <td class="prov">${esc(o.provider)}${promo ? `<span class="pct">−${promo.pct}%</span>` : ''}<span class="src">${esc(SOURCES[o.src]?.name)}${o.quant ? `, ${esc(o.quant)}` : ''}${promo ? `, promocja ${promoAgeText(promo)}` : ''}</span></td>
      <td>${price}</td>
      <td class="cost">${other ? '<span class="src">inna jednostka</span>' : formatUsd(cost(o))}</td>
      <td>${formatContext(o.context)}</td>
      <td>${o.uptime != null ? `${o.uptime}%` : '–'}</td>
      <td>${link ? `<a class="go" href="${esc(link.url)}" target="_blank" rel="noopener${link.sponsored ? ' sponsored' : ''}">${esc(link.label)}</a>${link.sponsored ? '<span class="sponsored">link partnerski</span>' : ''}` : ''}</td></tr>`;
  }).join('');

  const verdict = best
    ? `Najtaniej: <strong>${esc(best.provider)}</strong>, ${formatUsd(cost(best))} miesięcznie.${worst && cost(worst) > cost(best) ? ` <span class="save">Oszczędzasz ${formatUsd(cost(worst) - cost(best))} względem najdroższej oferty.</span>` : ''}`
    : m.freeId ? `Model dostępny za darmo jako <code>${esc(m.freeId)}</code>.` : 'Brak płatnych ofert przy wybranych źródłach.';
  const priceHead = m.unit === 'token' ? '<th scope="col">Wejście /1M</th><th scope="col">Wyjście /1M</th>' : '<th scope="col">Cena</th><th scope="col">Warianty</th>';
  const cats = m.cats.map((c) => `<span class="chip">${CAT_LABEL[c]}</span>`).join('');

  box.innerHTML = `
    <div class="model-head">
      <div>
        <h3>${esc(m.name)}</h3>
        <p class="model-id">${esc(m.id)}${m.context ? `, kontekst ${formatContext(m.context)}` : ''}${m.freeId ? `, darmowy wariant ${esc(m.freeId)}` : ''}</p>
        <div class="model-cats">${cats}</div>
      </div>
      <button class="btn btn-line" id="close-model">Zamknij</button>
    </div>
    <div class="calc">${usageInputs(m.unit)}<p class="verdict" aria-live="polite">${verdict}</p></div>
    <div class="src-filter" role="group" aria-label="Źródła">
      ${Object.entries(SOURCES).map(([k, s]) => `<label><input type="checkbox" data-src="${k}" ${state.sources.has(k) ? 'checked' : ''}> ${esc(s.name)}</label>`).join('')}
    </div>
    <div class="table-wrap"><table>
      <caption>Ceny w USD ${esc(UNIT_LABEL[m.unit])}. Koszt dla wpisanego zużycia.</caption>
      <thead><tr><th scope="col">Dostawca</th>${priceHead}<th scope="col">Koszt miesięcznie</th><th scope="col">Kontekst</th><th scope="col">Dostępność 24 h</th><th scope="col"><span class="sr-only">Link</span></th></tr></thead>
      <tbody>${rows || '<tr><td colspan="7">Żadne z zaznaczonych źródeł nie sprzedaje tego modelu.</td></tr>'}</tbody>
    </table></div>
    <p class="live-note">${box.dataset.live ? 'Oferty OpenRouter pobrane przed chwilą.' : 'Ceny z ostatniej aktualizacji. Oferty OpenRouter odświeżam na żywo…'} Cenniki bezpośrednie pochodzą z katalogu models.dev i mogą być nieaktualne.</p>`;

  box.querySelectorAll('[data-u]').forEach((input) => input.addEventListener('change', () => {
    const v = Math.max(0, Number(input.value) || 0);
    if (m.unit === 'token') state.usage.token[input.dataset.u] = v;
    else state.usage[m.unit].count = v;
    renderModel(m);
  }));
  box.querySelectorAll('[data-src]').forEach((cb) => cb.addEventListener('change', () => {
    if (cb.checked) state.sources.add(cb.dataset.src);
    else state.sources.delete(cb.dataset.src);
    renderModel(m);
  }));
  $('#close-model').addEventListener('click', () => {
    box.hidden = true;
    box.dataset.model = '';
    history.replaceState(null, '', location.pathname);
  });
}

// ---------- przykładowe powiadomienia z prawdziwych danych ----------
function renderNotifs() {
  const icon = '<span class="notif-icon" aria-hidden="true"><svg viewBox="0 0 32 32"><path d="M3 9.5 9.5 3H29v26H9.5L3 22.5z" fill="none" stroke="#172036" stroke-width="2.4"/><circle cx="10" cy="16" r="2.4" fill="#172036"/></svg></span>';
  const discounts = state.deals.filter((d) => d.type === 'discount');
  const a = discounts[0];
  const b = discounts.find((d) => d.model.id !== a?.model.id && d.model.cats.includes('text'));
  if (!a || !b) return;
  const alt = sortOffers(b.model).find((o) => o.unit === b.model.unit && offerKey(o) !== offerKey(b.offer) && !isFreeOffer(o));
  $('#notif-1').innerHTML = `${icon}<span class="notif-app">TaniToken, teraz</span><span class="notif-title">${esc(a.model.name)}: −${a.pct}% u ${esc(a.offer.provider)}</span><span class="notif-body">Obserwujesz ten model. Nowa cena ${esc(formatOfferPrice(a.offer))}.</span>`;
  $('#notif-2').innerHTML = `${icon}<span class="notif-app">TaniToken, 2 h temu</span><span class="notif-title">${esc(b.model.name)}: promocja może się kończyć</span><span class="notif-body">Zniżka u ${esc(b.offer.provider)} ${promoAgeText(b)}.${alt ? ` Bez niej najtaniej: ${esc(alt.provider)}, ${esc(formatOfferPrice(alt))}.` : ''}</span>`;
}

load();
setInterval(load, REFRESH_MS);
setInterval(() => state.snapshot && renderStatus(), 30 * 1000);
