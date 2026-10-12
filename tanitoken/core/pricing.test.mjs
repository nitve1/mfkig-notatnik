// node --test tanitoken/core/pricing.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  perMillion, modelKey, offerKey, offerCost, cheapest, sortOffers, priceBeforeDiscount,
  detectDrops, trackPromos, promoStats, collectDeals, computeAlerts, watchStatus, promoSavings, onePerProvider, favoriteMatcher,
} from './pricing.js';
import { openrouterModels, openrouterOffers, vercelEntries, requestyEntries } from './sources.js';

const tok = (src, provider, inP, outP, extra = {}) => ({ src, provider, tag: `${src}/${provider}`, unit: 'token', in: inP, out: outP, discount: 0, ...extra });

test('perMillion i modelKey', () => {
  assert.equal(perMillion('0.00000025'), 0.25);
  assert.equal(perMillion('-1'), null);
  assert.equal(modelKey('anthropic/claude-opus-5.5'), modelKey('bedrock/claude-opus-5-5@eu-west-1'));
  assert.equal(modelKey('qwen/qwen3-14b'), modelKey('alibaba/qwen3-14b-instruct'));
});

test('openrouterModels: warianty :free, kategorie, wideo bez ceny nie jest darmowe', () => {
  const models = openrouterModels(
    [
      { id: 'a/x', name: 'X', pricing: { prompt: '0.000001', completion: '0.000002' }, architecture: { output_modalities: ['text'] } },
      { id: 'a/x:free', name: 'X (free)', pricing: { prompt: '0', completion: '0' }, architecture: { output_modalities: ['text'] } },
      { id: 'a/x-coder', name: 'X Coder', pricing: { prompt: '0.000001', completion: '0.000002' }, architecture: { output_modalities: ['text'] } },
      { id: 'v/vid', name: 'Vid', pricing: { prompt: '0', completion: '0' }, architecture: { output_modalities: ['video'] } },
      { id: 'e/emb', name: 'Emb', pricing: { prompt: '0.0000001', completion: '0' }, architecture: { output_modalities: ['embeddings'] } },
    ],
    new Set(),
  );
  assert.deepEqual(models.map((m) => m.id), ['a/x', 'a/x-coder', 'v/vid']);
  assert.equal(models[0].freeId, 'a/x:free');
  assert.ok(models[1].cats.includes('coding'));
  assert.equal(models[2].unit, 'second');
  assert.equal(models[2].listPrice, null);
});

test('openrouterOffers: deduplikacja i ujemny discount to nie promocja', () => {
  const offers = openrouterOffers([
    { provider_name: 'Drogi', tag: 'd', pricing: { prompt: '0.000002', completion: '0.000004', discount: -0.2 } },
    { provider_name: 'Tani', tag: 't', pricing: { prompt: '0.0000005', completion: '0.000001', discount: 0.5 } },
    { provider_name: 'Tani', tag: 't', pricing: { prompt: '0.0000005', completion: '0.000001', discount: 0.5 } },
  ]);
  assert.deepEqual(offers.map((o) => [o.provider, o.discount]), [['Drogi', 0], ['Tani', 0.5]]);
  assert.equal(priceBeforeDiscount(offers[1]).in, 1);
});

test('vercelEntries: wideo za sekundę (720p), obraz za sztukę', () => {
  const [video, image] = vercelEntries([
    { id: 'a/vid', type: 'video', pricing: { video_duration_pricing: [{ resolution: '480p', cost_per_second: '0.05' }, { resolution: '720p', cost_per_second: '0.1' }] } },
    { id: 'b/img', type: 'image', pricing: { image: '0.04' } },
  ]);
  assert.equal(video.offer.unit, 'second');
  assert.equal(video.offer.price, 0.1);
  assert.equal(image.offer.unit, 'image');
  assert.equal(image.offer.price, 0.04);
});

test('requestyEntries: najtańszy region', () => {
  const e = requestyEntries([
    { id: 'bedrock/m@eu-1', input_price: 0.000002, output_price: 0.000004 },
    { id: 'bedrock/m@us-1', input_price: 0.000001, output_price: 0.000002 },
  ]);
  assert.equal(e.length, 1);
  assert.equal(e[0].offer.in, 1);
});

test('koszt i sortowanie wg zużycia', () => {
  const model = { id: 'a/x', unit: 'token', offers: [tok('openrouter', 'A', 1, 10), tok('openrouter', 'B', 3, 1), tok('direct', 'Free', 0, 0)] };
  assert.equal(offerCost(model.offers[0], { token: { in: 10, out: 2 } }), 30);
  assert.equal(cheapest(model).provider, 'A'); // 30 $ vs 32 $
  assert.equal(cheapest(model, { token: { in: 0, out: 1 } }).provider, 'B');
  assert.equal(cheapest(model, { token: { in: 10, out: 0 } }).provider, 'A');
  assert.equal(sortOffers(model)[0].provider, 'Free');
});

test('trackPromos: start, koniec i statystyki czasu trwania', () => {
  const t0 = '2026-01-01T00:00:00.000Z';
  const t1 = '2026-01-04T00:00:00.000Z';
  const promoOffer = tok('openrouter', 'P', 0.5, 1, { discount: 0.5 });
  const m0 = [{ id: 'a/x', offers: [promoOffer], freeId: null }];
  const first = trackPromos({ promos: {} }, m0, [], t0);
  assert.equal(Object.keys(first.promos).length, 1);
  const m1 = [{ id: 'a/x', offers: [tok('openrouter', 'P', 1, 2)], freeId: null }];
  const second = trackPromos({ promos: first.promos, ended: [] }, m1, [], t1);
  assert.equal(Object.keys(second.promos).length, 0);
  assert.equal(second.ended.length, 1);
  assert.deepEqual(second.ended[0].now, { in: 1, out: 2 });
  assert.deepEqual(promoStats(second.ended), { P: { n: 1, avgDays: 3 } });
});

test('detectDrops + collectDeals + alerty dla obserwowanych', () => {
  const prev = [{ id: 'a/x', offers: [tok('openrouter', 'P', 1, 2)] }];
  const next = [{ id: 'a/x', name: 'X', unit: 'token', freeId: null, offers: [tok('openrouter', 'P', 0.5, 1), tok('direct', 'D', 2, 4)] }];
  const drops = detectDrops(prev, next, '2026-01-01T00:00:00Z');
  assert.equal(drops[0].pct, 50);
  const { promos } = trackPromos({ promos: {} }, next, drops, '2026-01-01T00:00:00Z');
  const snap = { models: next, promos, ended: [] };
  assert.equal(collectDeals(snap)[0].type, 'drop');

  const used = { modelId: 'a/x', mode: 'use', offerKey: offerKey(next[0].offers[1]) };
  const status = watchStatus(snap, used);
  assert.equal(status.best.provider, 'P');
  assert.equal(status.overpayPct, 75);
  const kinds = computeAlerts(snap, [used]).map((a) => a.kind);
  assert.ok(kinds.includes('cheaper'));
});

test('promoSavings i onePerProvider', () => {
  const o = tok('openrouter', 'P', 0.5, 1, { discount: 0.5 });
  const status = { used: o, usedPromo: { type: 'discount', pct: 50 } };
  assert.equal(promoSavings(status, { token: { in: 10, out: 2 } }), 7); // 14 $ przed, 7 $ teraz
  assert.equal(promoSavings({ used: o, usedPromo: null }), 0);
  const list = [tok('openrouter', 'A', 1, 1), { ...tok('openrouter', 'A', 2, 2), tag: 'a/zdr' }, tok('direct', 'B', 3, 3)];
  assert.deepEqual(onePerProvider(list).map((x) => x.provider), ['A', 'B']);
  assert.equal(onePerProvider(list, 'openrouter:a/zdr').length, 3);
});

test('favoriteMatcher: dostawca albo platforma', () => {
  const match = favoriteMatcher(['OpenRouter', 'Groq']);
  assert.equal(match(tok('openrouter', 'Novita', 1, 1)), true); // przez OpenRouter
  assert.equal(match(tok('direct', 'Groq', 1, 1)), true);
  assert.equal(match(tok('direct', 'Novita', 1, 1)), false);
  assert.equal(match({ ...tok('requesty', 'Requesty (bedrock)', 1, 1) }), false);
  assert.equal(favoriteMatcher(['Requesty'])(tok('requesty', 'Requesty (bedrock)', 1, 1)), true);
  assert.equal(favoriteMatcher([]), null);
});
