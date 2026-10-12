// Zbiera ceny ze wszystkich źródeł i zapisuje data/snapshot.json.
// Uruchamiane co 15 min przez GitHub Actions (.github/workflows/tanitoken-snapshot.yml).
//   node tanitoken/scripts/build-snapshot.mjs
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  OPENROUTER_API, VERCEL_API, REQUESTY_API, MODELS_DEV_API,
  openrouterModels, openrouterOffers, vercelEntries, requestyEntries, modelsDevEntries, baseId,
} from '../core/sources.js';
import { detectDrops, trackPromos, promoStats, offerKey, offerCost } from '../core/pricing.js';

const DATA_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'data');
const OUT = join(DATA_DIR, 'snapshot.json');
const CONCURRENCY = 12;
const HISTORY_MAX = 400;

async function getJson(url, tries = 3) {
  for (let i = 1; ; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': 'TaniToken snapshot (github.com/nitve1/mfkig-notatnik)' } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    } catch (e) {
      if (i >= tries) throw new Error(`${url}: ${e.message}`);
      await new Promise((res) => setTimeout(res, 1000 * 2 ** i));
    }
  }
}

async function readPrevious() {
  try {
    const prev = JSON.parse(await readFile(OUT, 'utf8'));
    return prev.v === 2 ? prev : null; // stary format: zaczynamy historię od nowa
  } catch {
    return null;
  }
}

const started = Date.now();
const now = new Date().toISOString();
const prev = await readPrevious();
const status = {};

async function source(name, fn) {
  try {
    const value = await fn();
    status[name] = { ok: true };
    return value;
  } catch (e) {
    status[name] = { ok: false, error: e.message };
    console.warn(`! ${name}: ${e.message}`);
    return null;
  }
}

const [orAll, orCoding, vercel, requesty, modelsDev] = await Promise.all([
  source('openrouter', () => getJson(`${OPENROUTER_API}/models?output_modalities=all`)),
  source('openrouter-coding', () => getJson(`${OPENROUTER_API}/models?category=programming`)),
  source('vercel', () => getJson(VERCEL_API)),
  source('requesty', () => getJson(REQUESTY_API)),
  source('direct', () => getJson(MODELS_DEV_API)),
]);
if (!orAll) {
  console.error('Brak danych z OpenRouter, nie nadpisuję snapshotu.');
  process.exit(1);
}

// 1. Katalog z OpenRouter + oferty providerów (tekst i obraz; wideo OpenRouter nie wycenia w API).
const codingIds = new Set((orCoding?.data ?? []).map((m) => baseId(m.id)));
const models = openrouterModels(orAll.data, codingIds);
const prevById = new Map((prev?.models ?? []).map((m) => [m.id, m]));
let next = 0;
let failed = 0;
const withEndpoints = models.filter((m) => m.unit === 'token');
async function worker() {
  while (next < withEndpoints.length) {
    const m = withEndpoints[next++];
    try {
      const json = await getJson(`${OPENROUTER_API}/models/${m.id}/endpoints`);
      m.offers.push(...openrouterOffers(json.data?.endpoints, m));
    } catch (e) {
      failed++;
      m.offers.push(...(prevById.get(m.id)?.offers ?? []).filter((o) => o.src === 'openrouter'));
      console.warn(`! ${m.id}: ${e.message}`);
    }
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));
if (failed > withEndpoints.length * 0.2) {
  console.error(`Za dużo błędów OpenRouter (${failed}/${withEndpoints.length}), nie nadpisuję snapshotu.`);
  process.exit(1);
}

const byKey = new Map();
for (const m of models) if (!byKey.has(m.key)) byKey.set(m.key, m);

// 2. Vercel AI Gateway: dokłada oferty i modele, których OpenRouter nie ma (np. wideo z ceną za sekundę).
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

// 3. Requesty i cenniki bezpośrednie (models.dev) tylko dla modeli z katalogu.
const attach = (entries) => {
  for (const e of entries) {
    const m = byKey.get(e.key);
    if (!m || m.offers.some((o) => offerKey(o) === offerKey(e.offer))) continue;
    m.offers.push(e.offer);
  }
};
attach(requestyEntries(requesty?.data));
attach(modelsDevEntries(modelsDev));

// 4. Jednostka główna: obrazy liczymy "za obraz", jeśli ktoś tak sprzedaje; reszta wg katalogu.
const catalog = [];
for (const m of models) {
  if (m.cats.includes('image') && !m.cats.includes('text') && m.offers.some((o) => o.unit === 'image')) m.unit = 'image';
  if (m.cats.includes('video')) m.unit = 'second';
  if (!m.offers.some((o) => o.unit === m.unit) && !m.freeId) continue; // brak jakiejkolwiek ceny
  m.offers.sort((a, b) => (a.unit === m.unit ? 0 : 1) - (b.unit === m.unit ? 0 : 1) || offerCost(a) - offerCost(b));
  delete m.listPrice;
  catalog.push(m);
}
catalog.sort((a, b) => (b.created ?? 0) - (a.created ?? 0));

// 5. Promocje: obniżki, zniżki, darmowe warianty; co się skończyło i jak długo zwykle trwa.
const freshDrops = detectDrops(prev?.models, catalog, now);
const keptDrops = (prev?.drops ?? []).filter(
  (d) => Date.parse(now) - Date.parse(d.at) < 7 * 86400 * 1000 && !freshDrops.some((f) => f.modelId === d.modelId && f.key === d.key),
);
const drops = [...freshDrops, ...keptDrops];
const { promos, ended } = trackPromos(prev, catalog, drops, now);
const newlyEnded = ended.filter((e) => e.endedAt === now);
const history = [...newlyEnded.map(({ now: _n, from: _f, ...e }) => e), ...(prev?.history ?? [])].slice(0, HISTORY_MAX);

const snapshot = {
  v: 2,
  generatedAt: now,
  sources: status,
  models: catalog,
  promos,
  ended,
  drops,
  history,
  promoStats: promoStats(history),
};

await mkdir(DATA_DIR, { recursive: true });
const body = JSON.stringify(snapshot);
await writeFile(OUT, body);

const offers = catalog.reduce((n, m) => n + m.offers.length, 0);
const bySrc = {};
for (const m of catalog) for (const o of m.offers) bySrc[o.src] = (bySrc[o.src] ?? 0) + 1;
const cats = {};
for (const m of catalog) for (const c of m.cats) cats[c] = (cats[c] ?? 0) + 1;
console.log(
  `OK ${catalog.length} modeli, ${offers} ofert ${JSON.stringify(bySrc)}, kategorie ${JSON.stringify(cats)}, ` +
    `${Object.keys(promos).length} promocji, ${newlyEnded.length} zakończonych, ${(body.length / 1024).toFixed(0)} KB, ${Date.now() - started} ms`,
);
