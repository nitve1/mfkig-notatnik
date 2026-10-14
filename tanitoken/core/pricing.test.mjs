// node --test tanitoken/core/pricing.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  perMillion, modelKey, offerKey, offerCost, cheapest, sortOffers, priceBeforeDiscount,
  detectDrops, trackPromos, promoStats, collectDeals, computeAlerts, watchStatus, promoSavings, onePerProvider, favoriteMatcher, onePerPlatform,
} from './pricing.js';
import { openrouterModels, openrouterOffers, vercelEntries, requestyEntries, parseFalPrice, falEntries, mediaKey } from './sources.js';
import { platformOf } from './pricing.js';

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

test('onePerPlatform: tryb Zwykły', () => {
  const list = [tok('openrouter', 'Decart', 1, 1), tok('openrouter', 'Novita', 2, 2), tok('direct', 'Groq', 0.5, 0.5), tok('vercel', 'Vercel AI Gateway', 3, 3)];
  assert.deepEqual(onePerPlatform(list).map((o) => o.provider), ['Decart', 'Vercel AI Gateway']);
  assert.deepEqual(onePerPlatform(list, 'openrouter:openrouter/Novita').map((o) => o.provider), ['Decart', 'Novita', 'Vercel AI Gateway']);
});

test('typowa długość promocji tylko z wiarygodnej próbki', () => {
  const o = tok('openrouter', 'P', 0.5, 1, { discount: 0.5 });
  const model = { id: 'a/x', name: 'X', unit: 'token', offers: [o] };
  const promo = { modelId: 'a/x', key: offerKey(o), provider: 'P', type: 'discount', pct: 50, since: new Date().toISOString(), sinceKnown: true };
  const item = { modelId: 'a/x', mode: 'use', offerKey: offerKey(o) };
  const snap = (stats) => ({ models: [model], promos: { x: promo }, ended: [], promoStats: stats });
  assert.equal(watchStatus(snap({ P: { n: 1, avgDays: 0.2 } }), item).typicalDays, null);
  assert.equal(watchStatus(snap({ P: { n: 2, avgDays: 6 } }), item).typicalDays, null);
  assert.equal(watchStatus(snap({ P: { n: 4, avgDays: 6 } }), item).typicalDays, 6);
});

test('fal: cena z opisu (obraz, sekunda wideo, tokeny pomijane)', () => {
  assert.deepEqual(parseFalPrice('Your request will cost **$0.15** per image. For **$1.00**, you can run this model **7** times.', 'image'), { unit: 'image', price: 0.15 });
  assert.deepEqual(parseFalPrice('For every second of video you generate you will be charged **$0.10** without audio or **$0.15** with audio for 720p.', 'video'), { unit: 'second', price: 0.1 });
  assert.deepEqual(parseFalPrice('For **5s** video your request will cost **$0.35**. For every aditional second you will be charged **$0.07.**', 'video'), { unit: 'second', price: 0.07 });
  assert.equal(parseFalPrice('Text tokens (per 1M): **$5.00** input, **$10.00** output.', 'image'), null);
  assert.equal(parseFalPrice('', 'image'), null);
});

test('fal: łączenie z modelami z innych źródeł po nazwie', () => {
  assert.equal(mediaKey('Veo 3.1 Fast Generate'), mediaKey('Veo 3.1 Fast'));
  assert.equal(mediaKey('Kling v2.6 Text-to-Video'), mediaKey('Kling Video v2.6'));
  const [e] = falEntries([{ id: 'fal-ai/veo3.1/fast', title: 'Veo 3.1 Fast', category: 'text-to-video', modelLab: 'Google', pricingInfoOverride: 'charged **$0.10** per second' }]);
  assert.equal(e.offer.src, 'fal');
  assert.equal(e.offer.unit, 'second');
  assert.equal(e.key, mediaKey('Veo 3.1 Fast Generate'));
});

test('platformy: bramki z models.dev, fal, bez zwykłych dostawców', () => {
  assert.equal(platformOf(tok('fal', 'fal.ai', 1, 1)), 'fal.ai');
  assert.equal(platformOf(tok('direct', 'Kilo Gateway', 1, 1)), 'Kilo Gateway');
  assert.equal(platformOf(tok('direct', 'Groq', 1, 1)), null);
});

test('karty partnerów: tylko z linkiem, co 10 pozycji, nigdy na początku', async () => {
  const { AFFILIATES, withSponsors } = await import('./affiliates.js');
  const items = Array.from({ length: 25 }, (_, i) => ({ i }));
  assert.equal(withSponsors(items).length, 25); // brak linków = brak kart
  AFFILIATES.Novita.link = 'https://example.com/ref';
  try {
    const out = withSponsors(items, 'video');
    assert.equal(out.length, 27);
    assert.equal(out[10].type, 'sponsor');
    assert.notEqual(out[0].type, 'sponsor');
    assert.equal(withSponsors(items.slice(0, 5)).length, 5);
  } finally {
    AFFILIATES.Novita.link = null;
  }
});

test('awaria Vercel/Requesty przy sprawdzaniu: oferty i modele z poprzedniego zestawienia zostają', async () => {
  const { buildSnapshot } = await import('./snapshot.js');
  const or = { data: [{ id: 'a/x', name: 'A: X', architecture: { output_modalities: ['text'] }, pricing: { prompt: '0.000001', completion: '0.000002' } }] };
  const ep = { data: { endpoints: [{ provider_name: 'P', tag: 'p', pricing: { prompt: '0.000001', completion: '0.000002' } }] } };
  const vid = { id: 'v/vid', key: 'vid', name: 'Vid', author: 'v', cats: ['video'], unit: 'second', offers: [{ src: 'vercel', provider: 'Vercel AI Gateway', tag: 'vercel/v/vid', unit: 'second', price: 0.1, discount: 0 }] };
  const x = { id: 'a/x', key: 'x', name: 'A: X', cats: ['text'], unit: 'token', offers: [{ src: 'requesty', provider: 'Requesty (p)', tag: 'requesty/p/x', unit: 'token', in: 1, out: 2, discount: 0 }] };
  const prev = { v: 2, generatedAt: '2026-10-01T00:00:00Z', models: [x, vid], promos: {}, ended: [], drops: [], history: [] };
  const getJson = async (url) => {
    if (url.includes('/endpoints')) return ep;
    if (url.includes('openrouter.ai')) return or;
    throw new Error('down');
  };
  const s = await buildSnapshot({ getJson, prev, includeDirect: false, now: '2026-10-02T00:00:00Z' });
  assert.ok(s.models.find((m) => m.id === 'v/vid')?.offers.some((o) => o.src === 'vercel'));
  assert.ok(s.models.find((m) => m.id === 'a/x').offers.some((o) => o.src === 'requesty'));
});

test('odświeżenie obserwowanych nie udaje pełnego sprawdzenia', async () => {
  const { refreshModels } = await import('./snapshot.js');
  const snap = { v: 2, generatedAt: '2026-10-01T00:00:00Z', models: [], promos: {}, ended: [], drops: [], history: [] };
  const next = await refreshModels(snap, [], { getJson: async () => ({}), now: '2026-10-01T05:00:00Z' });
  assert.equal(next.generatedAt, '2026-10-01T00:00:00Z');
  assert.equal(next.partialAt, '2026-10-01T05:00:00Z');
  assert.equal(next.updatedAt, '2026-10-01T05:00:00Z');
});

test('id alertów bez dat i cen (ta sama promocja z telefonu i z serwera to jeden alert)', () => {
  const o = tok('openrouter', 'P', 0.5, 1, { discount: 0.5 });
  const model = { id: 'a/x', name: 'X', unit: 'token', cats: ['text'], offers: [o] };
  const promo = (since) => ({ modelId: 'a/x', key: offerKey(o), provider: 'P', type: 'discount', pct: 50, since, sinceKnown: true });
  const ids = (since) => computeAlerts({ models: [model], promos: { p: promo(since) }, ended: [], promoStats: {} }, [{ modelId: 'a/x', mode: 'watch', since: '2026-01-01T00:00:00Z' }]).map((a) => a.id);
  assert.deepEqual(ids('2026-10-01T22:30:00Z'), ids('2026-10-01T23:00:00Z'));
});
