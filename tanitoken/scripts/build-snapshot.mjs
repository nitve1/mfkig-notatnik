// Pobiera wszystkie modele i oferty providerów z OpenRouter i zapisuje data/snapshot.json.
// Uruchamiane co 15 min przez GitHub Actions (.github/workflows/tanitoken-snapshot.yml).
//   node tanitoken/scripts/build-snapshot.mjs
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { OPENROUTER_API, modelsFromApi, endpointsFromApi, detectDrops } from '../core/pricing.js';

const DATA_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'data');
const OUT = join(DATA_DIR, 'snapshot.json');
const CONCURRENCY = 12;
const DROP_TTL_MS = 7 * 24 * 3600 * 1000;

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
    return JSON.parse(await readFile(OUT, 'utf8'));
  } catch {
    return null;
  }
}

const started = Date.now();
const prev = await readPrevious();
const { data } = await getJson(`${OPENROUTER_API}/models`);
const models = modelsFromApi(data);

let next = 0;
let failed = 0;
async function worker() {
  while (next < models.length) {
    const m = models[next++];
    try {
      const json = await getJson(`${OPENROUTER_API}/models/${m.id}/endpoints`);
      m.endpoints = endpointsFromApi(json.data?.endpoints);
    } catch (e) {
      failed++;
      // Zachowaj ostatnie znane oferty zamiast zgubić model.
      m.endpoints = prev?.models?.find((p) => p.id === m.id)?.endpoints ?? [];
      console.warn(`! ${m.id}: ${e.message}`);
    }
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));

const now = new Date().toISOString();
const fresh = detectDrops(prev?.models, models, now);
const freshKeys = new Set(fresh.map((d) => `${d.modelId}|${d.tag ?? d.provider}`));
const kept = (prev?.drops ?? []).filter(
  (d) => Date.now() - new Date(d.at).getTime() < DROP_TTL_MS && !freshKeys.has(`${d.modelId}|${d.tag ?? d.provider}`),
);

models.sort((a, b) => (b.created ?? 0) - (a.created ?? 0));
const snapshot = {
  generatedAt: now,
  source: 'openrouter',
  models,
  drops: [...fresh, ...kept],
};

if (failed > models.length * 0.2) {
  console.error(`Za dużo błędów (${failed}/${models.length}), nie nadpisuję snapshotu.`);
  process.exit(1);
}

await mkdir(DATA_DIR, { recursive: true });
await writeFile(OUT, JSON.stringify(snapshot));
const endpoints = models.reduce((n, m) => n + m.endpoints.length, 0);
const discounts = models.reduce((n, m) => n + m.endpoints.filter((e) => e.discount > 0).length, 0);
console.log(
  `OK ${models.length} modeli, ${endpoints} ofert, ${discounts} zniżek, ${fresh.length} nowych obniżek, ${failed} błędów, ${Date.now() - started} ms`,
);
