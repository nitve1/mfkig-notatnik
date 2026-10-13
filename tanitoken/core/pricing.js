// Wspólna logika cen LightTokenz: skrypt snapshotu, landing page i apka mobilna.
// Czysty ESM bez zależności (Node, przeglądarka, React Native).
export {
  OPENROUTER_API, SOURCES, CATEGORIES, modelKey, baseId, perMillion, liveSnapshot, liveOpenrouterOffers,
} from './sources.js';

// Domyślne zużycie miesięczne do porównań, osobno dla każdej jednostki.
export const DEFAULT_USAGE = {
  token: { in: 10, out: 2 }, // mln tokenów
  image: { count: 500 }, // obrazów
  second: { count: 300 }, // sekund wideo
};

// Opis jednostki ceny w bieżącym języku (np. "USD za 1M tokenów (wejście / wyjście)").
export const UNIT_LABEL = {
  get token() { return t('unitLabel.token'); },
  get image() { return t('unitLabel.image'); },
  get second() { return t('unitLabel.second'); },
};

import { formatNumber, money, t } from './i18n.js';

const DAY = 86400 * 1000;
export const MIN_PROMO_SAMPLES = 3;

export function offerKey(o) {
  return `${o.src}:${o.tag ?? o.provider}`;
}

export function isFreeOffer(o) {
  return o.unit === 'token' ? o.in === 0 && o.out === 0 : o.price === 0;
}

// Cena jednostkowa do sortowania (dla tokenów średnia ważona 3:1).
export function unitPrice(o) {
  if (!o) return null;
  if (o.unit === 'token') return o.in == null || o.out == null ? null : (o.in * 3 + o.out) / 4;
  return o.price ?? null;
}

// Koszt miesięczny przy zadanym zużyciu (USD).
export function offerCost(o, usage = DEFAULT_USAGE) {
  if (!o) return null;
  if (o.unit === 'token') {
    const u = usage.token ?? DEFAULT_USAGE.token;
    return o.in * u.in + o.out * u.out;
  }
  const u = usage[o.unit] ?? DEFAULT_USAGE[o.unit];
  return o.price * u.count;
}

// Oferty w głównej jednostce modelu od najtańszej, potem pozostałe (np. inna jednostka).
export function sortOffers(model, usage = DEFAULT_USAGE, filter = null) {
  const list = filter ? model.offers.filter(filter) : model.offers;
  const main = list.filter((o) => o.unit === model.unit).sort((a, b) => offerCost(a, usage) - offerCost(b, usage));
  const rest = list.filter((o) => o.unit !== model.unit);
  return [...main, ...rest];
}

// Najtańsza płatna oferta (darmowe warianty z limitami pomijamy).
export function cheapest(model, usage = DEFAULT_USAGE, filter = null) {
  return sortOffers(model, usage, filter).find((o) => o.unit === model.unit && !isFreeOffer(o)) ?? null;
}

export function priceBeforeDiscount(o) {
  if (!o?.discount || o.discount >= 1) return null;
  const k = 1 / (1 - o.discount);
  return o.unit === 'token' ? { ...o, in: o.in * k, out: o.out * k } : { ...o, price: o.price * k };
}

// ---------- historia promocji (liczone w skrypcie snapshotu) ----------

// Porównanie z poprzednim snapshotem: obniżki cen u tego samego providera.
export function detectDrops(prevModels, nextModels, now = new Date().toISOString()) {
  const prev = new Map();
  for (const m of prevModels ?? []) for (const o of m.offers ?? []) prev.set(`${m.id}|${offerKey(o)}`, o);
  const drops = [];
  for (const m of nextModels) {
    for (const o of m.offers) {
      const p = prev.get(`${m.id}|${offerKey(o)}`);
      if (!p || p.unit !== o.unit) continue;
      const before = unitPrice(p);
      const after = unitPrice(o);
      if (before > 0 && after < before * 0.98) {
        drops.push({
          modelId: m.id,
          key: offerKey(o),
          provider: o.provider,
          src: o.src,
          from: o.unit === 'token' ? { in: p.in, out: p.out } : { price: p.price },
          pct: Math.round((1 - after / before) * 100),
          at: now,
        });
      }
    }
  }
  return drops;
}

// Aktywne promocje (zniżka providera albo świeża obniżka) z datą startu oraz te, które się skończyły.
export function trackPromos(prev, models, drops, now = new Date().toISOString(), keepMs = 14 * DAY) {
  const prevPromos = prev?.promos ?? {};
  const firstRun = !prev?.promos;
  const promos = {};
  const offerIndex = new Map();
  for (const m of models) {
    for (const o of m.offers) {
      offerIndex.set(`${m.id}|${offerKey(o)}`, { m, o });
      if (o.discount > 0) {
        const id = `${m.id}|${offerKey(o)}`;
        const old = prevPromos[id];
        promos[id] = {
          modelId: m.id,
          key: offerKey(o),
          provider: o.provider,
          src: o.src,
          type: 'discount',
          pct: Math.round(o.discount * 100),
          since: old?.since ?? now,
          sinceKnown: old ? old.sinceKnown : !firstRun,
        };
      }
    }
    if (m.freeId) {
      const id = `${m.id}|free`;
      const old = prevPromos[id];
      promos[id] = {
        modelId: m.id, key: 'free', provider: 'OpenRouter', src: 'openrouter', type: 'free', pct: 100,
        since: old?.since ?? now, sinceKnown: old ? old.sinceKnown : !firstRun,
      };
    }
  }
  for (const d of drops ?? []) {
    const id = `${d.modelId}|${d.key}`;
    if (promos[id]) continue;
    const cur = offerIndex.get(id);
    const before = d.from.price ?? (d.from.in * 3 + d.from.out) / 4;
    if (!cur || unitPrice(cur.o) > before * 0.98) continue; // cena już wróciła
    promos[id] = {
      modelId: d.modelId, key: d.key, provider: d.provider, src: d.src, type: 'drop', pct: d.pct,
      since: prevPromos[id]?.since ?? d.at, sinceKnown: true, from: d.from,
    };
  }
  const ended = (prev?.ended ?? []).filter((e) => Date.parse(now) - Date.parse(e.endedAt) < keepMs);
  for (const [id, p] of Object.entries(prevPromos)) {
    if (promos[id]) continue;
    const cur = offerIndex.get(id)?.o ?? null;
    ended.unshift({
      ...p,
      endedAt: now,
      now: cur ? (cur.unit === 'token' ? { in: cur.in, out: cur.out } : { price: cur.price }) : null,
    });
  }
  return { promos, ended };
}

// Średni czas trwania zakończonych promocji per provider (tylko z pewną datą startu).
export function promoStats(history) {
  const acc = {};
  for (const e of history ?? []) {
    if (!e.sinceKnown || e.type === 'free') continue;
    const days = (Date.parse(e.endedAt) - Date.parse(e.since)) / DAY;
    const a = (acc[e.provider] ??= { n: 0, sum: 0 });
    a.n++;
    a.sum += days;
  }
  return Object.fromEntries(Object.entries(acc).map(([k, v]) => [k, { n: v.n, avgDays: Math.round((v.sum / v.n) * 10) / 10 }]));
}

// ---------- okazje i alerty (apka, landing) ----------

export function collectDeals(snapshot) {
  const models = new Map(snapshot.models.map((m) => [m.id, m]));
  const deals = [];
  for (const p of Object.values(snapshot.promos ?? {})) {
    const m = models.get(p.modelId);
    if (!m) continue;
    const offer = p.type === 'free' ? null : m.offers.find((o) => offerKey(o) === p.key);
    if (p.type !== 'free' && !offer) continue;
    deals.push({ ...p, model: m, offer, score: p.type === 'free' ? 0 : p.pct / 100 });
  }
  deals.sort((a, b) => b.score - a.score || Date.parse(b.since) - Date.parse(a.since));
  // Ten sam dostawca w kilku wariantach (np. "upstage" i "upstage/zdr") -> jedna pozycja.
  const seen = new Set();
  return deals.filter((d) => {
    const k = `${d.modelId}|${d.type}|${d.provider}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function promoAgeDays(p, now = Date.now()) {
  return (now - Date.parse(p.since)) / DAY;
}

// Stan obserwowanego modelu: czy jestem w promocji, ile przepłacam, co się skończyło.
export function watchStatus(snapshot, item, usage = DEFAULT_USAGE, filter = null) {
  const model = snapshot.models.find((m) => m.id === item.modelId);
  if (!model) return { model: null, missing: true };
  const best = cheapest(model, usage, filter);
  const used = item.offerKey ? model.offers.find((o) => offerKey(o) === item.offerKey) ?? null : null;
  const promos = Object.values(snapshot.promos ?? {}).filter((p) => p.modelId === model.id);
  const usedPromo = used ? promos.find((p) => p.key === item.offerKey) ?? null : null;
  const ended = (snapshot.ended ?? []).filter((e) => e.modelId === model.id && (!item.offerKey || e.key === item.offerKey || e.key === 'free'));
  const usedCost = used ? offerCost(used, usage) : null;
  const bestCost = best ? offerCost(best, usage) : null;
  const overpayPct = usedCost && bestCost != null && usedCost > 0 ? Math.round((1 - bestCost / usedCost) * 100) : 0;
  const stats = snapshot.promoStats ?? {};
  // Typowa długość tylko z sensownej próbki: min. 3 zakończone promocje i średnio ponad dobę.
  const st = usedPromo ? stats[usedPromo.provider] : null;
  const typical = st && st.n >= MIN_PROMO_SAMPLES && st.avgDays >= 1 ? st.avgDays : null;
  return { model, best, used, usedPromo, promos, ended, usedCost, bestCost, overpayPct, typicalDays: typical };
}

// Platformy, na których zakłada się konto i kupuje dostęp do wielu modeli naraz.
// Platformy = jedno konto i jeden klucz API do modeli wielu firm.
// Pierwsze cztery sprawdzamy na żywo, pozostałe bramki mają cenniki z models.dev (zestawienie z GitHub).
const SRC_PLATFORM = { openrouter: 'OpenRouter', vercel: 'Vercel AI Gateway', requesty: 'Requesty', fal: 'fal.ai' };
export const GATEWAYS = [
  'Kilo Gateway', 'NanoGPT', 'LLM Gateway', 'Eden AI', 'AIHubMix', 'ZenMux', '302.AI', 'Helicone',
  'Cloudflare AI Gateway', 'FastRouter', 'Poe', 'Hugging Face',
];
export const PLATFORMS = [...Object.values(SRC_PLATFORM), ...GATEWAYS];
const GATEWAY_SET = new Set(GATEWAYS);

export function platformOf(o) {
  if (!o) return null;
  if (o.src === 'direct') return GATEWAY_SET.has(o.provider) ? o.provider : null;
  return SRC_PLATFORM[o.src] ?? null;
}

// Filtr ofert "u ulubionych": pasuje dostawca (np. Novita) albo platforma, przez którą idzie oferta (np. OpenRouter).
export function favoriteMatcher(names) {
  if (!names?.length) return null;
  const set = new Set(names);
  return (o) => set.has(o.provider) || set.has(platformOf(o));
}

// Tryb Zwykły: tylko oferty z platform. Jeden wiersz na platformę (najtańszy, oferty muszą być posortowane).
export function isPlatformOffer(o) {
  return platformOf(o) != null;
}

export function onePerPlatform(offers, keepKey = null) {
  const seen = new Set();
  return offers.filter((o) => {
    const p = platformOf(o);
    if (!p) return false;
    if (offerKey(o) === keepKey) return true;
    const k = `${o.unit}|${p}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

// Ile miesięcznie oszczędzam dzięki promocji u dostawcy, którego używam (0 gdy brak promocji).
export function promoSavings(status, usage = DEFAULT_USAGE) {
  const { used, usedPromo } = status ?? {};
  if (!used || !usedPromo) return 0;
  const before = usedPromo.type === 'drop' && usedPromo.from ? { ...used, ...usedPromo.from } : priceBeforeDiscount(used);
  if (!before) return 0;
  return Math.max(0, offerCost(before, usage) - offerCost(used, usage));
}

// Jeden wiersz na dostawcę: zostaje najtańszy wariant (np. "upstage" i "upstage/zdr"), plus wybrany przez użytkownika.
export function onePerProvider(offers, keepKey = null) {
  const seen = new Set();
  return offers.filter((o) => {
    const k = `${o.unit}|${o.provider}`;
    if (offerKey(o) === keepKey) return true;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

// Zdarzenia do powiadomień. Id jest stabilne, apka pamięta już wysłane.
// filter: ograniczenie porównań (np. do ulubionych dostawców).
export function computeAlerts(snapshot, watchlist, usage = DEFAULT_USAGE, { now = Date.now(), filter = null } = {}) {
  const alerts = [];
  for (const item of watchlist) {
    const s = watchStatus(snapshot, item, usage, filter);
    if (!s.model) continue;
    const name = s.model.name;
    const watchedSince = item.since ? Date.parse(item.since) : 0;
    for (const p of s.promos) {
      if (item.offerKey && p.key !== item.offerKey && p.type !== 'free') continue;
      if (!p.sinceKnown || Date.parse(p.since) < watchedSince) continue; // trwała już wcześniej, widać ją w apce
      alerts.push({
        id: `start|${p.modelId}|${p.key}|${p.since}`,
        kind: 'promo-start',
        modelId: s.model.id,
        title: p.type === 'free' ? t('alertText.freeTitle', { name }) : t('alertText.startTitle', { name, pct: p.pct, provider: p.provider }),
        body: p.type === 'free' ? t('alertText.freeBody', { id: s.model.freeId }) : t('alertText.startBody', { age: promoAgeText(p, now) }),
      });
    }
    for (const e of s.ended) {
      if (Date.parse(e.endedAt) < watchedSince) continue;
      alerts.push({
        id: `end|${e.modelId}|${e.key}|${e.endedAt}`,
        kind: 'promo-end',
        modelId: s.model.id,
        urgent: item.mode === 'use',
        title: e.type === 'free' ? t('alertText.freeEndTitle', { name }) : t('alertText.endTitle', { name, provider: e.provider }),
        body: s.best
          ? t('alertText.endBody', { provider: s.best.provider, price: formatOfferPrice(s.best) })
          : t('alertText.endBodyNone'),
      });
    }
    if (s.usedPromo && s.typicalDays && promoAgeDays(s.usedPromo, now) >= s.typicalDays * 0.8) {
      alerts.push({
        id: `aging|${s.model.id}|${s.usedPromo.key}|${s.usedPromo.since}`,
        kind: 'promo-aging',
        modelId: s.model.id,
        urgent: true,
        title: t('alertText.agingTitle', { name }),
        body: t('alertText.agingBody', { age: formatDays(promoAgeDays(s.usedPromo, now)), provider: s.usedPromo.provider, typical: formatDays(s.typicalDays) }),
      });
    }
    if (item.mode === 'use' && s.used && s.overpayPct >= 20 && s.best) {
      alerts.push({
        id: `cheaper|${s.model.id}|${offerKey(s.best)}|${Math.round(unitPrice(s.best) * 1e4)}`,
        kind: 'cheaper',
        modelId: s.model.id,
        title: t('alertText.cheaperTitle', { name, pct: s.overpayPct }),
        body: t('alertText.cheaperBody', { provider: s.best.provider, price: formatOfferPrice(s.best) }),
      });
    }
    if (s.model.expires) {
      const days = (Date.parse(s.model.expires) - now) / DAY;
      if (days <= 14) {
        alerts.push({
          id: `expires|${s.model.id}|${s.model.expires}`,
          kind: 'expires',
          modelId: s.model.id,
          urgent: item.mode === 'use',
          title: t('alertText.expiresTitle', { name }),
          body: t('alertText.expiresBody', { date: s.model.expires }),
        });
      }
    }
  }
  return alerts;
}

// Wyszukiwanie: wszystkie słowa muszą pasować; dokładne i krótsze nazwy wyżej.
export function searchModels(models, query) {
  const q = query.trim().toLowerCase();
  if (!q) return models;
  const words = q.split(/\s+/);
  const scored = [];
  for (const m of models) {
    const name = m.name.toLowerCase().replace(/^[^:]+:\s*/, '');
    const hay = `${m.id} ${m.name}`.toLowerCase();
    if (!words.every((w) => hay.includes(w))) continue;
    let score = name.length;
    if (name === q) score -= 1000;
    else if (name.startsWith(q)) score -= 500;
    score -= Math.min(m.offers?.length ?? 0, 50);
    scored.push([score, m]);
  }
  return scored.sort((a, b) => a[0] - b[0]).map(([, m]) => m);
}

// Opis wieku promocji. Dla promocji zastanych przy pierwszym pomiarze nie znamy startu.
export function promoAgeText(p, now = Date.now()) {
  const age = formatDays(promoAgeDays(p, now));
  if (p.sinceKnown) return t('age.lasts', { age });
  return promoAgeDays(p, now) < 1 / 24 ? t('age.fromFirst') : t('age.atLeast', { age });
}

// ---------- formatowanie ----------

// Ceny w USD, zapis zależny od języka (EN "$5.10", inne "5,10 $").
export function formatUsd(v) {
  if (v == null) return '–';
  if (v === 0) return money('0');
  if (v < 0.01) return money(formatNumber(+v.toFixed(4)));
  if (v < 1) return money(formatNumber(+v.toFixed(3)));
  if (v < 100) return money(formatNumber(v, 2));
  return money(formatNumber(Math.round(v)));
}

export function formatOfferPrice(o) {
  if (!o) return '–';
  if (o.unit === 'token') return `${formatUsd(o.in)} / ${formatUsd(o.out)}`;
  return `${formatUsd(o.price)} ${t(o.unit === 'image' ? 'unit.perImage' : 'unit.perSecond')}`;
}

export function formatContext(n) {
  if (!n) return '–';
  if (n >= 1e6) return `${+(n / 1e6).toFixed(1)}M`;
  return `${Math.round(n / 1000)}K`;
}

export function formatDays(d) {
  if (d < 1 / 24) return t('days.lessThanHour');
  if (d < 1) return t('days.hours', { n: Math.round(d * 24) });
  return t('days.days', { n: Math.round(d) });
}

export function timeAgo(iso, now = Date.now()) {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return t('ago.s', { n: s });
  if (s < 3600) return t('ago.min', { n: Math.round(s / 60) });
  if (s < 86400) return t('ago.h', { n: Math.round(s / 3600) });
  return t('ago.d', { n: Math.round(s / 86400) });
}
