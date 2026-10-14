// node --test tanitoken/core/history.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HISTORY_DAYS, dayOf, historyStart, mergeHistory, priceSeries, recordPrices } from './history.js';

const DAY = 86400 * 1000;
const iso = (d, h = 12) => new Date(d * DAY + h * 3600 * 1000).toISOString();
const tok = (provider, inP, outP) => ({ src: 'openrouter', provider, tag: provider, unit: 'token', in: inP, out: outP });
const snap = (d, offers, h) => ({ updatedAt: iso(d, h), models: [{ id: 'm', unit: 'token', offers }] });
const model = { id: 'm', unit: 'token', offers: [] };
const usage = { token: { in: 3, out: 1 } };

test('recordPrices: zapisuje tylko zmiany, w ciągu dnia najniższa cena', () => {
  let h = recordPrices(null, snap(100, [tok('a', 1, 1), tok('b', 2, 2)]));
  h = recordPrices(h, snap(101, [tok('a', 1, 1), tok('b', 2, 2)])); // bez zmian: brak nowych wpisów
  assert.deepEqual(h.m.m['openrouter:a'], [[100, 1, 1]]);
  h = recordPrices(h, snap(102, [tok('a', 0.5, 0.5), tok('b', 2, 2)], 8));
  h = recordPrices(h, snap(102, [tok('a', 0.8, 0.8), tok('b', 2, 2)], 20)); // drożej tego samego dnia: zostaje 0.5
  assert.deepEqual(h.m.m['openrouter:a'], [[100, 1, 1], [102, 0.5, 0.5]]);
  h = recordPrices(h, snap(103, [tok('a', 1, 1)])); // b zniknęło
  assert.deepEqual(h.m.m['openrouter:b'], [[100, 2, 2], [103]]);
  assert.equal(historyStart(h, 'm'), 100);
});

test('recordPrices: darmowe oferty pomijane, 90 dni okna', () => {
  let h = recordPrices(null, snap(0, [tok('a', 1, 1), tok('free', 0, 0)]));
  assert.equal(h.m.m['openrouter:free'], undefined);
  h = recordPrices(h, snap(5, [tok('a', 2, 2)]));
  h = recordPrices(h, snap(200, [tok('a', 2, 2)]));
  // Cena sprzed okna przechodzi na pierwszy dzień okna.
  assert.deepEqual(h.m.m['openrouter:a'], [[200 - HISTORY_DAYS + 1, 2, 2]]);
});

test('mergeHistory: oba źródła po kolei, ten sam dzień niższa cena', () => {
  const server = recordPrices(recordPrices(null, snap(100, [tok('a', 1, 1)])), snap(105, [tok('a', 2, 2)]));
  const phone = recordPrices(recordPrices(null, snap(103, [tok('a', 0.5, 0.5)])), snap(105, [tok('a', 1.5, 1.5)]));
  const h = mergeHistory(server, phone);
  assert.deepEqual(h.m.m['openrouter:a'], [[100, 1, 1], [103, 0.5, 0.5], [105, 1.5, 1.5]]);
});

test('priceSeries: najtaniej i Twoja oferta dzień po dniu, cena za 1M przy Twoich proporcjach', () => {
  let h = recordPrices(null, snap(100, [tok('a', 1, 1), tok('b', 2, 6)]));
  h = recordPrices(h, snap(102, [tok('a', 4, 4), tok('b', 2, 6)]));
  const pts = priceSeries(h, model, { days: 4, today: 102, usage, mine: (k) => k === 'openrouter:b' });
  assert.deepEqual(pts.map((p) => p.day), [99, 100, 101, 102]);
  assert.equal(pts[0].best, null); // przed początkiem historii
  assert.equal(pts[1].best, 1);
  assert.equal(pts[1].bestKey, 'openrouter:a');
  assert.equal(pts[3].best, 3); // b: (2*3 + 6*1) / 4
  assert.equal(pts[3].bestKey, 'openrouter:b');
  assert.equal(pts[3].mine, 3);
  const only = priceSeries(h, model, { days: 1, today: 102, usage, allow: (k) => k === 'openrouter:a' });
  assert.equal(only[0].best, 4);
  assert.equal(dayOf(iso(102)), 102);
});
