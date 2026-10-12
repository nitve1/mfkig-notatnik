// node --test tanitoken/core/pricing.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  perMillion, modelsFromApi, endpointsFromApi, priceBeforeDiscount, detectDrops, collectDeals, cheapest, usageCost,
} from './pricing.js';

test('perMillion przelicza cenę za token na 1M i odrzuca ceny dynamiczne', () => {
  assert.equal(perMillion('0.00000025'), 0.25);
  assert.equal(perMillion('0'), 0);
  assert.equal(perMillion('-1'), null);
  assert.equal(perMillion(undefined), null);
});

test('modelsFromApi skleja warianty :free i pomija inne warianty', () => {
  const models = modelsFromApi([
    { id: 'a/x', name: 'X', pricing: { prompt: '0.000001', completion: '0.000002' } },
    { id: 'a/x:free', name: 'X (free)', pricing: { prompt: '0', completion: '0' } },
    { id: 'a/x:thinking', name: 'X think', pricing: { prompt: '0.000003', completion: '0.000004' } },
    { id: 'b/only-free:free', name: 'Only (free)', pricing: { prompt: '0', completion: '0' } },
  ]);
  assert.deepEqual(models.map((m) => [m.id, m.freeId]), [['a/x', 'a/x:free'], ['b/only-free', 'b/only-free:free']]);
  assert.deepEqual(models[0].listPrice, { in: 1, out: 2 });
  assert.equal(models[1].name, 'Only');
  assert.equal(cheapest(models[1]), null);
});

test('endpointsFromApi sortuje od najtańszej, deduplikuje i traktuje ujemny discount jako brak promocji', () => {
  const eps = endpointsFromApi([
    { provider_name: 'Drogi', tag: 'd', pricing: { prompt: '0.000002', completion: '0.000004', discount: -0.2 } },
    { provider_name: 'Tani', tag: 't', pricing: { prompt: '0.0000005', completion: '0.000001', discount: 0.5 } },
    { provider_name: 'Tani', tag: 't', pricing: { prompt: '0.0000005', completion: '0.000001', discount: 0.5 } },
  ]);
  assert.deepEqual(eps.map((e) => [e.provider, e.discount]), [['Tani', 0.5], ['Drogi', 0]]);
  assert.deepEqual(priceBeforeDiscount(eps[0]), { in: 1, out: 2 });
  assert.equal(usageCost(eps[0], 10e6, 2e6), 7);
});

test('detectDrops i collectDeals', () => {
  const prev = [{ id: 'a/x', endpoints: [{ provider: 'P', tag: 'p', in: 1, out: 2 }] }];
  const next = [{ id: 'a/x', name: 'X', author: 'a', freeId: 'a/x:free', endpoints: [{ provider: 'P', tag: 'p', in: 0.5, out: 1, discount: 0 }] }];
  const drops = detectDrops(prev, next, '2026-01-01T00:00:00Z');
  assert.equal(drops.length, 1);
  assert.equal(drops[0].pct, 50);
  const deals = collectDeals({ models: next, drops });
  assert.deepEqual(deals.map((d) => d.type), ['drop', 'free']);
});
