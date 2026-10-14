// Zbiera ceny ze wszystkich źródeł i zapisuje data/snapshot.json.
// Uruchamiane co 15 min przez GitHub Actions (.github/workflows/tanitoken-snapshot.yml).
// Ten sam silnik (core/snapshot.js) działa w apce na telefonie.
//   node tanitoken/scripts/build-snapshot.mjs
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSnapshot, snapshotSummary } from '../core/snapshot.js';

const DATA_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'data');
const OUT = join(DATA_DIR, 'snapshot.json');
const DESC = join(DATA_DIR, 'descriptions.json'); // opisy modeli osobno: apka wczytuje je dopiero w karcie modelu

async function getJson(url, tries = 3) {
  for (let i = 1; ; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': 'LightTokenz snapshot (github.com/nitve1/mfkig-notatnik)' } });
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
const prev = await readPrevious();
let snapshot;
try {
  snapshot = await buildSnapshot({ getJson, prev });
} catch (e) {
  console.error(`Nie nadpisuję snapshotu: ${e.message}`);
  process.exit(1);
}
for (const [name, st] of Object.entries(snapshot.sources)) if (!st.ok) console.warn(`! ${name}: ${st.error}`);

await mkdir(DATA_DIR, { recursive: true });
let descs = {};
try { descs = JSON.parse(await readFile(DESC, 'utf8')); } catch { /* pierwszy raz */ }
for (const m of snapshot.models) {
  if (m.desc) descs[m.id] = m.desc;
  delete m.desc;
}
const keep = new Set(snapshot.models.map((m) => m.id));
for (const id of Object.keys(descs)) if (!keep.has(id)) delete descs[id];
await writeFile(DESC, JSON.stringify(descs));
const body = JSON.stringify(snapshot);
await writeFile(OUT, body);

const sum = snapshotSummary(snapshot);
const ended = snapshot.ended.filter((e) => e.endedAt === snapshot.generatedAt).length;
console.log(
  `OK ${sum.models} modeli, ${sum.offers} ofert ${JSON.stringify(sum.bySrc)}, kategorie ${JSON.stringify(sum.cats)}, ` +
    `${sum.promos} promocji, ${ended} zakończonych, ${(body.length / 1024).toFixed(0)} KB, ${Date.now() - started} ms`,
);
