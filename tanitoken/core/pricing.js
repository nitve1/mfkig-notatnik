// Wspólna logika cen TaniToken: używana przez skrypt snapshotu, landing page i apkę mobilną.
// Czysty ESM bez zależności, działa w Node, przeglądarce i React Native.

export const OPENROUTER_API = 'https://openrouter.ai/api/v1';

// Domyślny stosunek tokenów wejście:wyjście do ceny "mieszanej" (typowy czat / agent).
export const DEFAULT_RATIO = { in: 3, out: 1 };

const M = 1e6;

// Cena z API to string w USD za 1 token; zwracamy USD za 1M tokenów albo null.
export function perMillion(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null; // "-1" = cena dynamiczna (np. openrouter/auto)
  return Math.round(n * M * 1e6) / 1e6;
}

export function blended(price, ratio = DEFAULT_RATIO) {
  if (!price || price.in == null || price.out == null) return null;
  return (price.in * ratio.in + price.out * ratio.out) / (ratio.in + ratio.out);
}

// Koszt w USD dla zadanej liczby tokenów (np. miesięczne zużycie).
export function usageCost(price, inTokens, outTokens) {
  if (!price || price.in == null || price.out == null) return null;
  return (price.in * inTokens + price.out * outTokens) / M;
}

export function isFree(price) {
  return !!price && price.in === 0 && price.out === 0;
}

export function baseId(id) {
  return id.split(':')[0];
}

function author(id) {
  return id.split('/')[0];
}

// /models -> lista modeli (warianty ":free" sklejone z modelem bazowym, inne warianty pominięte).
export function modelsFromApi(apiData) {
  const byId = new Map();
  const make = (m, id, paid) => ({
    id,
    name: (m.name ?? id).replace(/\s*\(free\)\s*$/i, ''),
    author: author(id),
    created: m.created ?? null,
    context: m.context_length ?? null,
    modality: m.architecture?.modality ?? null,
    listPrice: paid
      ? { in: perMillion(m.pricing?.prompt), out: perMillion(m.pricing?.completion) }
      : { in: null, out: null },
    freeId: null,
    endpoints: [],
  });
  for (const m of apiData) {
    if (!m.id.includes(':')) byId.set(m.id, make(m, m.id, true));
  }
  for (const m of apiData) {
    if (!m.id.endsWith(':free')) continue;
    const id = baseId(m.id);
    if (!byId.has(id)) byId.set(id, make(m, id, false)); // model dostępny tylko jako :free
    byId.get(id).freeId = m.id;
  }
  return [...byId.values()];
}

// /models/{id}/endpoints -> uproszczone oferty providerów, od najtańszej.
export function endpointsFromApi(apiEndpoints, ratio = DEFAULT_RATIO) {
  const seen = new Set();
  const list = [];
  for (const e of apiEndpoints ?? []) {
    const key = e.tag ?? e.name;
    if (seen.has(key)) continue;
    seen.add(key);
    const price = { in: perMillion(e.pricing?.prompt), out: perMillion(e.pricing?.completion) };
    if (price.in == null || price.out == null) continue;
    const discount = Number(e.pricing?.discount) || 0;
    list.push({
      provider: e.provider_name,
      tag: e.tag ?? null,
      quant: e.quantization && e.quantization !== 'unknown' ? e.quantization : null,
      in: price.in,
      out: price.out,
      cacheRead: perMillion(e.pricing?.input_cache_read),
      // Ceny z API są już po zniżce; discount to ułamek zniżki (0.3 = -30%). Ujemny = narzut, nie promocja.
      discount: discount > 0 ? Math.round(discount * 1000) / 1000 : 0,
      context: e.context_length ?? null,
      uptime: e.uptime_last_1d != null ? Math.round(e.uptime_last_1d * 10) / 10 : null,
      status: e.status ?? 0,
    });
  }
  return sortEndpoints(list, ratio);
}

export function sortEndpoints(list, ratio = DEFAULT_RATIO) {
  return [...list].sort((a, b) => blended(a, ratio) - blended(b, ratio));
}

// Cena przed zniżką (do przekreślenia w UI).
export function priceBeforeDiscount(ep) {
  if (!ep.discount || ep.discount >= 1) return null;
  const k = 1 / (1 - ep.discount);
  return { in: ep.in * k, out: ep.out * k };
}

// Najtańsza płatna oferta modelu (ignoruje warianty darmowe z limitami).
export function cheapest(model, ratio = DEFAULT_RATIO) {
  const eps = model.endpoints?.length ? sortEndpoints(model.endpoints, ratio) : [];
  const paid = eps.find((e) => !isFree(e));
  if (paid) return paid;
  if (model.listPrice?.in != null && !isFree(model.listPrice)) {
    return { provider: 'OpenRouter', tag: null, ...model.listPrice, discount: 0 };
  }
  return null;
}

// Porównanie cen między dwoma snapshotami -> obniżki cen u providerów.
export function detectDrops(prevModels, nextModels, now = new Date().toISOString()) {
  const prev = new Map();
  for (const m of prevModels ?? []) {
    for (const e of m.endpoints ?? []) prev.set(`${m.id}|${e.tag ?? e.provider}`, e);
  }
  const drops = [];
  for (const m of nextModels) {
    for (const e of m.endpoints ?? []) {
      const p = prev.get(`${m.id}|${e.tag ?? e.provider}`);
      if (!p) continue;
      const before = blended(p);
      const after = blended(e);
      if (before > 0 && after < before * 0.98) {
        drops.push({
          modelId: m.id,
          provider: e.provider,
          tag: e.tag,
          from: { in: p.in, out: p.out },
          to: { in: e.in, out: e.out },
          pct: Math.round((1 - after / before) * 100),
          at: now,
        });
      }
    }
  }
  return drops;
}

// Wszystkie aktualne okazje w jednej liście, od najmocniejszej.
export function collectDeals(snapshot, ratio = DEFAULT_RATIO) {
  const models = new Map(snapshot.models.map((m) => [m.id, m]));
  const deals = [];
  for (const m of snapshot.models) {
    for (const e of m.endpoints ?? []) {
      if (e.discount > 0 && !isFree(e)) {
        deals.push({ type: 'discount', model: m, endpoint: e, pct: Math.round(e.discount * 100), score: e.discount });
      }
    }
    if (m.freeId) {
      deals.push({ type: 'free', model: m, endpoint: null, pct: 100, score: 0 });
    }
  }
  for (const d of snapshot.drops ?? []) {
    const m = models.get(d.modelId);
    if (!m) continue;
    const e = m.endpoints?.find((x) => (x.tag ?? x.provider) === (d.tag ?? d.provider));
    if (!e || blended(e) > blended(d.to) * 1.001) continue; // cena już wróciła
    deals.push({ type: 'drop', model: m, endpoint: e, pct: d.pct, at: d.at, from: d.from, score: d.pct / 100 });
  }
  // Jedna najlepsza okazja na parę model+provider.
  const best = new Map();
  for (const d of deals) {
    const key = `${d.model.id}|${d.endpoint?.provider ?? 'free'}`;
    const cur = best.get(key);
    if (!cur || d.score > cur.score) best.set(key, d);
  }
  return [...best.values()].sort((a, b) => b.score - a.score || (blended(a.endpoint, ratio) ?? 0) - (blended(b.endpoint, ratio) ?? 0));
}

export function searchModels(models, query) {
  const q = query.trim().toLowerCase();
  if (!q) return models;
  const words = q.split(/\s+/);
  return models.filter((m) => {
    const hay = `${m.id} ${m.name}`.toLowerCase();
    return words.every((w) => hay.includes(w));
  });
}

export function formatUsd(v) {
  if (v == null) return '—';
  if (v === 0) return '0 $';
  if (v < 0.01) return `${v.toFixed(4)} $`;
  if (v < 1) return `${v.toFixed(3)} $`;
  if (v < 100) return `${v.toFixed(2)} $`;
  return `${Math.round(v)} $`;
}

export function formatContext(n) {
  if (!n) return '—';
  if (n >= 1e6) return `${+(n / 1e6).toFixed(1)}M`;
  return `${Math.round(n / 1000)}K`;
}

export function timeAgo(iso, now = Date.now()) {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s} s temu`;
  if (s < 3600) return `${Math.round(s / 60)} min temu`;
  if (s < 86400) return `${Math.round(s / 3600)} h temu`;
  return `${Math.round(s / 86400)} d temu`;
}

// Snapshot "awaryjny" zbudowany z samego /models (1 zapytanie) gdy gotowy plik jest niedostępny.
export async function liveSnapshot(fetchImpl = fetch) {
  const r = await fetchImpl(`${OPENROUTER_API}/models`);
  if (!r.ok) throw new Error(`OpenRouter /models: HTTP ${r.status}`);
  const json = await r.json();
  const models = modelsFromApi(json.data);
  for (const m of models) {
    if (m.listPrice.in != null) m.endpoints = [{ provider: 'OpenRouter (cena bazowa)', tag: null, ...m.listPrice, discount: 0 }];
  }
  return { generatedAt: new Date().toISOString(), source: 'openrouter-live', partial: true, models, drops: [] };
}

// Oferty providerów dla jednego modelu na żywo.
export async function liveEndpoints(modelId, fetchImpl = fetch) {
  const r = await fetchImpl(`${OPENROUTER_API}/models/${baseId(modelId)}/endpoints`);
  if (!r.ok) throw new Error(`OpenRouter endpoints: HTTP ${r.status}`);
  const json = await r.json();
  return endpointsFromApi(json.data?.endpoints);
}
