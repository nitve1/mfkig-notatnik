// Silnik zestawienia cen: ten sam kod w skrypcie (GitHub Actions) i w apce na telefonie.
// getJson(url) -> Promise<json> dostarcza wywołujący (Node: fetch z ponowieniami, apka: fetch).
import {
  OPENROUTER_API, VERCEL_API, REQUESTY_API, MODELS_DEV_API,
  openrouterModels, openrouterOffers, vercelEntries, requestyEntries, modelsDevEntries, baseId,
} from './sources.js';
import { detectDrops, trackPromos, promoStats, offerKey, offerCost } from './pricing.js';

const HISTORY_MAX = 400;
const DROP_TTL_MS = 7 * 86400 * 1000;

async function settle(name, status, fn) {
  try {
    const value = await fn();
    status[name] = { ok: true };
    return value;
  } catch (e) {
    status[name] = { ok: false, error: e.message };
    return null;
  }
}

async function pool(items, concurrency, fn) {
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      await fn(items[i], i);
    }
  }));
}

// Pełne zestawienie. includeDirect=false: cenniki bezpośrednie (models.dev, 5 MB) bierzemy z `base`.
export async function buildSnapshot({
  getJson, prev = null, base = null, includeDirect = true, concurrency = 12,
  now = new Date().toISOString(), onProgress = null, minOpenrouterSuccess = 0.8,
}) {
  const status = {};
  const [orAll, orCoding, vercel, requesty, modelsDev] = await Promise.all([
    settle('openrouter', status, () => getJson(`${OPENROUTER_API}/models?output_modalities=all`)),
    settle('openrouter-coding', status, () => getJson(`${OPENROUTER_API}/models?category=programming`)),
    settle('vercel', status, () => getJson(VERCEL_API)),
    settle('requesty', status, () => getJson(REQUESTY_API)),
    includeDirect ? settle('direct', status, () => getJson(MODELS_DEV_API)) : Promise.resolve(null),
  ]);
  if (!orAll) throw new Error(`OpenRouter: ${status.openrouter?.error ?? 'brak danych'}`);

  // 1. Katalog OpenRouter + oferty wszystkich dostawców (wideo OpenRouter nie wycenia w API).
  const codingIds = new Set((orCoding?.data ?? []).map((m) => baseId(m.id)));
  const models = openrouterModels(orAll.data, codingIds);
  const prevById = new Map((prev?.models ?? []).map((m) => [m.id, m]));
  const withEndpoints = models.filter((m) => m.unit === 'token');
  let done = 0;
  let failed = 0;
  await pool(withEndpoints, concurrency, async (m) => {
    try {
      const json = await getJson(`${OPENROUTER_API}/models/${m.id}/endpoints`);
      m.offers.push(...openrouterOffers(json.data?.endpoints, m));
    } catch {
      failed++;
      m.offers.push(...(prevById.get(m.id)?.offers ?? []).filter((o) => o.src === 'openrouter'));
    }
    done++;
    onProgress?.(done / withEndpoints.length);
  });
  if (withEndpoints.length && failed > withEndpoints.length * (1 - minOpenrouterSuccess)) {
    throw new Error(`OpenRouter: ${failed}/${withEndpoints.length} zapytań nieudanych`);
  }

  const byKey = new Map();
  for (const m of models) if (!byKey.has(m.key)) byKey.set(m.key, m);

  // 2. Vercel: oferty i modele, których OpenRouter nie ma (np. wideo za sekundę).
  for (const e of vercelEntries(vercel?.data)) {
    let m = byKey.get(e.key);
    if (!m) {
      m = {
        id: e.id, key: e.key, name: e.name, author: e.author, created: e.created, context: e.context,
        cats: e.cats, unit: e.offer.unit, freeId: null, expires: null, listPrice: null, offers: [],
      };
      models.push(m);
      byKey.set(e.key, m);
    }
    m.offers.push(e.offer);
  }

  // 3. Requesty i cenniki bezpośrednie tylko dla modeli z katalogu.
  const attach = (offersByKey) => {
    for (const { key, offer } of offersByKey) {
      const m = byKey.get(key);
      if (!m || m.offers.some((o) => offerKey(o) === offerKey(offer))) continue;
      m.offers.push(offer);
    }
  };
  attach(requestyEntries(requesty?.data));
  if (modelsDev) {
    attach(modelsDevEntries(modelsDev));
  } else {
    // Bez pobierania models.dev: bierzemy cenniki bezpośrednie z ostatniego pełnego zestawienia.
    const kept = [];
    for (const m of [...(base?.models ?? []), ...(prev?.models ?? [])]) {
      for (const o of m.offers) if (o.src === 'direct') kept.push({ key: m.key, offer: o });
    }
    attach(kept);
    status.direct = { ok: kept.length > 0, kept: true };
  }

  // 4. Jednostka główna i porządek ofert.
  const catalog = [];
  for (const m of models) {
    if (m.cats.includes('image') && !m.cats.includes('text') && m.offers.some((o) => o.unit === 'image')) m.unit = 'image';
    if (m.cats.includes('video')) m.unit = 'second';
    if (!m.offers.some((o) => o.unit === m.unit) && !m.freeId) continue;
    sortModelOffers(m);
    delete m.listPrice;
    catalog.push(m);
  }
  catalog.sort((a, b) => (b.created ?? 0) - (a.created ?? 0));
  return finalize(prev, catalog, now, status);
}

function sortModelOffers(m) {
  m.offers.sort((a, b) => (a.unit === m.unit ? 0 : 1) - (b.unit === m.unit ? 0 : 1) || offerCost(a) - offerCost(b));
}

// Promocje, obniżki, zakończone promocje i statystyki na podstawie poprzedniego zestawienia.
export function finalize(prev, catalog, now, sources) {
  const freshDrops = detectDrops(prev?.models, catalog, now);
  const keptDrops = (prev?.drops ?? []).filter(
    (d) => Date.parse(now) - Date.parse(d.at) < DROP_TTL_MS && !freshDrops.some((f) => f.modelId === d.modelId && f.key === d.key),
  );
  const drops = [...freshDrops, ...keptDrops];
  const { promos, ended } = trackPromos(prev, catalog, drops, now);
  const newlyEnded = ended.filter((e) => e.endedAt === now);
  const history = [...newlyEnded.map(({ now: _n, from: _f, ...e }) => e), ...(prev?.history ?? [])].slice(0, HISTORY_MAX);
  return {
    v: 2,
    generatedAt: now,
    sources,
    models: catalog,
    promos,
    ended,
    drops,
    history,
    promoStats: promoStats(history),
  };
}

// Szybkie odświeżenie kilku modeli (np. obserwowanych, w tle): tylko ich oferty OpenRouter.
export async function refreshModels(snapshot, ids, { getJson, now = new Date().toISOString() }) {
  const wanted = new Set(ids);
  const models = snapshot.models.map((m) => (wanted.has(m.id) ? { ...m, offers: [...m.offers] } : m));
  const status = { ...(snapshot.sources ?? {}), partial: { ok: true, models: ids.length } };
  await pool(models.filter((m) => wanted.has(m.id) && m.offers.some((o) => o.src === 'openrouter')), 4, async (m) => {
    try {
      const json = await getJson(`${OPENROUTER_API}/models/${baseId(m.id)}/endpoints`);
      const fresh = openrouterOffers(json.data?.endpoints, m);
      if (!fresh.length) return;
      m.offers = [...fresh, ...m.offers.filter((o) => o.src !== 'openrouter')];
      sortModelOffers(m);
    } catch {
      // zostają poprzednie oferty
    }
  });
  const next = finalize(snapshot, models, now, status);
  // Pełne zestawienie zostaje "pełne": zapamiętujemy, kiedy był ostatni pełny przebieg.
  next.fullAt = snapshot.fullAt ?? snapshot.generatedAt;
  return next;
}

export function snapshotSummary(s) {
  const bySrc = {};
  for (const m of s.models) for (const o of m.offers) bySrc[o.src] = (bySrc[o.src] ?? 0) + 1;
  const cats = {};
  for (const m of s.models) for (const c of m.cats) cats[c] = (cats[c] ?? 0) + 1;
  return { models: s.models.length, offers: Object.values(bySrc).reduce((a, b) => a + b, 0), bySrc, cats, promos: Object.keys(s.promos).length };
}
