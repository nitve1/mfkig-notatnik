import {
  collectDeals, searchModels, cheapest, blended, usageCost, priceBeforeDiscount,
  liveSnapshot, liveEndpoints, formatUsd, formatContext, timeAgo,
} from '../core/pricing.js';

// Świeży snapshot z gałęzi danych (Actions co 15 min), potem kopia w repo, na końcu OpenRouter na żywo.
const SNAPSHOT_URLS = [
  'https://raw.githubusercontent.com/nitve1/mfkig-notatnik/tanitoken-data/snapshot.json',
  '../data/snapshot.json',
];
const REFRESH_MS = 5 * 60 * 1000;
const PAGE = 12;

const $ = (sel) => document.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const price = (p) => `${formatUsd(p.in)} / ${formatUsd(p.out)}`;

let snapshot = null;
let deals = [];
let filter = 'discount';
let shown = PAGE;

async function fetchSnapshot() {
  for (const url of SNAPSHOT_URLS) {
    try {
      const r = await fetch(`${url}?t=${Math.floor(Date.now() / 60000)}`);
      if (r.ok) return await r.json();
    } catch { /* następne źródło */ }
  }
  return liveSnapshot();
}

async function load() {
  try {
    snapshot = await fetchSnapshot();
  } catch {
    if (!snapshot) $('#updated').textContent = 'Nie udało się pobrać cen. Spróbuj odświeżyć stronę.';
    return;
  }
  deals = collectDeals(snapshot);
  renderStats();
  renderDeals();
  renderPhone();
}

function renderStats() {
  const offers = snapshot.models.reduce((n, m) => n + m.endpoints.length, 0);
  $('#stat-models').textContent = snapshot.models.length;
  $('#stat-offers').textContent = offers;
  $('#stat-deals').textContent = deals.filter((d) => d.type !== 'free').length;
  $('#stat-free').textContent = deals.filter((d) => d.type === 'free').length;
  updateClock();
}

function updateClock() {
  if (snapshot) $('#updated').textContent = `Ceny zaktualizowane ${timeAgo(snapshot.generatedAt)}`;
}

function dealCard(d) {
  const m = d.model;
  let badge;
  let body;
  if (d.type === 'free') {
    badge = '<span class="badge gold">DARMOWY</span>';
    body = `<div class="prov">wariant <code>${esc(d.model.freeId)}</code></div>`;
  } else {
    const before = d.type === 'drop' ? d.from : priceBeforeDiscount(d.endpoint);
    badge = `<span class="badge">−${d.pct}%${d.type === 'drop' ? ' obniżka' : ''}</span>`;
    body = `<div class="prov">${esc(d.endpoint.provider)}${d.endpoint.quant ? ` · ${esc(d.endpoint.quant)}` : ''}</div>
      <div class="price">${before ? `<span class="old">${price(before)}</span>` : ''}<strong>${price(d.endpoint)}</strong></div>`;
  }
  return `<button class="deal" data-model="${esc(m.id)}">
    <div class="top"><span class="prov">${esc(m.author)}</span>${badge}</div>
    <div class="name">${esc(m.name)}</div>${body}</button>`;
}

function renderDeals() {
  const list = deals.filter((d) => d.type === filter);
  $('#deals').innerHTML = list.length
    ? list.slice(0, shown).map(dealCard).join('')
    : `<p class="empty">${filter === 'drop' ? 'Brak obniżek w ostatnich 7 dniach. Zajrzyj później.' : 'Brak pozycji.'}</p>`;
  $('#more-deals').hidden = list.length <= shown;
}

function renderPhone() {
  $('#phone-screen').innerHTML = deals.filter((d) => d.type === 'discount').slice(0, 5).map(dealCard).join('');
}

document.querySelectorAll('.chip').forEach((chip) =>
  chip.addEventListener('click', () => {
    document.querySelectorAll('.chip').forEach((c) => c.classList.toggle('active', c === chip));
    filter = chip.dataset.filter;
    shown = PAGE;
    renderDeals();
  }),
);
$('#more-deals').addEventListener('click', () => { shown += PAGE; renderDeals(); });
$('#deals').addEventListener('click', (e) => {
  const card = e.target.closest('.deal');
  if (card) openModel(card.dataset.model, true);
});

// Wyszukiwarka
$('#q').addEventListener('input', () => {
  const q = $('#q').value;
  if (!snapshot || !q.trim()) { $('#results').innerHTML = ''; return; }
  $('#results').innerHTML = searchModels(snapshot.models, q).slice(0, 8).map((m) => {
    const c = cheapest(m);
    return `<button data-model="${esc(m.id)}"><span>${esc(m.name)}</span><small>${c ? `od ${formatUsd(blended(c))}` : m.freeId ? 'darmowy' : ''}</small></button>`;
  }).join('');
});
$('#results').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  $('#results').innerHTML = '';
  $('#q').value = '';
  openModel(b.dataset.model, false);
});
document.addEventListener('click', (e) => { if (!e.target.closest('.search')) $('#results').innerHTML = ''; });

const usage = { in: 10, out: 2 }; // mln tokenów miesięcznie

async function openModel(id, scroll) {
  const m = snapshot.models.find((x) => x.id === id);
  if (!m) return;
  const box = $('#model');
  box.hidden = false;
  renderModel(m, m.endpoints, true);
  if (scroll) $('#porownaj').scrollIntoView();
  try {
    const live = await liveEndpoints(m.id);
    if (live.length && $('#model').dataset.model === id) renderModel(m, live, false);
  } catch { /* zostaje snapshot */ }
}

function renderModel(m, endpoints, stale) {
  const box = $('#model');
  box.dataset.model = m.id;
  const cost = (e) => usageCost(e, usage.in * 1e6, usage.out * 1e6);
  const sorted = [...endpoints].sort((a, b) => cost(a) - cost(b));
  const rows = sorted.map((e, i) => {
    const before = priceBeforeDiscount(e);
    return `<tr class="${i === 0 ? 'best' : ''}">
      <td>${esc(e.provider)}${e.discount ? ` <span class="badge">−${Math.round(e.discount * 100)}%</span>` : ''}</td>
      <td>${before ? `<span class="old">${formatUsd(before.in)}</span>` : ''}${formatUsd(e.in)}</td>
      <td>${before ? `<span class="old">${formatUsd(before.out)}</span>` : ''}${formatUsd(e.out)}</td>
      <td class="cost">${formatUsd(cost(e))}</td>
      <td>${formatContext(e.context)}</td>
      <td>${esc(e.quant ?? '—')}</td>
      <td>${e.uptime != null ? `${e.uptime}%` : '—'}</td></tr>`;
  }).join('');
  box.innerHTML = `
    <h3>${esc(m.name)}</h3>
    <p class="meta"><code>${esc(m.id)}</code> · kontekst ${formatContext(m.context)}${m.freeId ? ` · darmowy wariant: <code>${esc(m.freeId)}</code>` : ''} · ${stale ? 'snapshot, pobieram ceny na żywo…' : 'ceny na żywo'}</p>
    <div class="calc">
      <label>Wejście (mln tokenów / mies.)<input id="u-in" type="number" min="0" step="0.5" value="${usage.in}"></label>
      <label>Wyjście (mln tokenów / mies.)<input id="u-out" type="number" min="0" step="0.5" value="${usage.out}"></label>
    </div>
    <div class="table-wrap"><table>
      <thead><tr><th>Provider</th><th>Wejście /1M</th><th>Wyjście /1M</th><th>Koszt / mies.</th><th>Kontekst</th><th>Kwant.</th><th>Uptime 24h</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="7">Brak płatnych ofert.</td></tr>'}</tbody>
    </table></div>`;
  for (const key of ['in', 'out']) {
    box.querySelector(`#u-${key}`).addEventListener('change', (e) => {
      usage[key] = Math.max(0, Number(e.target.value) || 0);
      renderModel(m, endpoints, stale);
    });
  }
}

load();
setInterval(load, REFRESH_MS);
setInterval(updateClock, 30 * 1000);
