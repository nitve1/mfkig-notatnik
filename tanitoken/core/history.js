// Historia cen: najniższa cena dziennie dla każdej oferty, 90 dni.
// Ten sam kod w skrypcie (GitHub Actions, data/history.json) i w apce (zapis na telefonie).
//
// Format (zapisujemy tylko zmiany ceny, więc stała cena przez 90 dni to jeden wpis):
//   { v: 1, m: { [modelId]: { [offerKey]: [[dzień, in, out] | [dzień, cena] | [dzień]] } } }
// dzień = liczba dni od 1970-01-01 (UTC). [dzień] bez ceny: oferta zniknęła.
import { DEFAULT_USAGE, isFreeOffer, offerCost, offerKey } from './pricing.js';

export const HISTORY_DAYS = 90;
const DAY = 86400 * 1000;

export const dayOf = (iso) => Math.floor((typeof iso === 'number' ? iso : Date.parse(iso)) / DAY);
export const emptyHistory = () => ({ v: 1, m: {} });

const round = (v) => (v == null ? null : Math.round(v * 1e6) / 1e6);
const point = (day, o) => (o.unit === 'token' ? [day, round(o.in), round(o.out)] : [day, round(o.price)]);
const gone = (p) => p.length === 1;
// Porównanie dwóch cen tej samej oferty: tokeny po średniej 3:1 wej./wyj.
const weight = (p) => (gone(p) ? Infinity : p.length === 3 ? (p[1] * 3 + p[2]) / 4 : p[1]);
const same = (a, b) => a.length === b.length && a.every((v, i) => i === 0 || v === b[i]);

export function isHistory(h) {
  return h?.v === 1 && h.m && typeof h.m === 'object';
}

// Dopisuje ceny z zestawienia. W ciągu dnia zostaje najniższa cena.
export function recordPrices(history, snapshot, now = snapshot?.updatedAt ?? snapshot?.generatedAt) {
  const h = isHistory(history) ? history : emptyHistory();
  const day = dayOf(now);
  if (!Number.isFinite(day) || !snapshot?.models) return h;
  const seen = new Set();
  for (const m of snapshot.models) {
    seen.add(m.id);
    const series = (h.m[m.id] ??= {});
    const keys = new Set();
    for (const o of m.offers) {
      if (isFreeOffer(o) || (o.unit === 'token' ? o.in == null || o.out == null : o.price == null)) continue;
      const k = offerKey(o);
      if (keys.has(k)) continue;
      keys.add(k);
      add((series[k] ??= []), point(day, o));
    }
    for (const [k, s] of Object.entries(series)) if (!keys.has(k)) add(s, [day]);
  }
  // Model zniknął z katalogu: wszystkie jego oferty zamykamy.
  for (const [id, series] of Object.entries(h.m)) {
    if (seen.has(id)) continue;
    for (const s of Object.values(series)) add(s, [day]);
  }
  return pruneHistory(h, day);
}

function add(s, p) {
  const last = s[s.length - 1];
  if (!last) {
    if (!gone(p)) s.push(p);
    return;
  }
  if (last[0] === p[0]) {
    // Ten sam dzień: zostaje niższa cena (zniknięcie oferty w ciągu dnia nie kasuje jej ceny z tego dnia).
    if (gone(last) || (!gone(p) && weight(p) < weight(last))) s[s.length - 1] = p;
    const prev = s[s.length - 2];
    if (prev && same(prev, s[s.length - 1])) s.pop();
    return;
  }
  if (!same(last, p)) s.push(p);
}

// Zostawia ostatnie 90 dni; cena sprzed granicy przechodzi na pierwszy dzień okna.
export function pruneHistory(h, today = dayOf(Date.now())) {
  const from = today - HISTORY_DAYS + 1;
  for (const [id, series] of Object.entries(h.m)) {
    for (const [k, s] of Object.entries(series)) {
      let i = 0;
      while (i + 1 < s.length && s[i + 1][0] <= from) i++;
      if (i > 0) s.splice(0, i);
      if (s.length && s[0][0] < from) s[0] = [from, ...s[0].slice(1)];
      if (!s.length || (s.length === 1 && gone(s[0]))) delete series[k];
    }
    if (!Object.keys(series).length) delete h.m[id];
  }
  return h;
}

// Łączy historię z serwera z zapisaną na telefonie.
export function mergeHistory(a, b) {
  if (!isHistory(a)) return isHistory(b) ? b : emptyHistory();
  if (!isHistory(b)) return a;
  const out = emptyHistory();
  for (const id of new Set([...Object.keys(a.m), ...Object.keys(b.m)])) {
    const sa = a.m[id] ?? {};
    const sb = b.m[id] ?? {};
    const series = {};
    for (const k of new Set([...Object.keys(sa), ...Object.keys(sb)])) {
      const days = [...new Set([...(sa[k] ?? []), ...(sb[k] ?? [])].map((p) => p[0]))].sort((x, y) => x - y);
      const s = [];
      // Strumień zmian z obu źródeł po kolei; ten sam dzień w obu: niższa cena.
      for (const d of days) {
        const pa = sa[k]?.find((p) => p[0] === d);
        const pb = sb[k]?.find((p) => p[0] === d);
        add(s, !pa ? pb : !pb ? pa : weight(pb) < weight(pa) ? pb : pa);
      }
      if (s.length) series[k] = s;
    }
    if (Object.keys(series).length) out.m[id] = series;
  }
  return out;
}

// Cena oferty w danym dniu (ostatni wpis nie późniejszy niż dzień), null gdy jej nie było.
function at(s, day) {
  if (!s) return null;
  let found = null;
  for (const p of s) {
    if (p[0] > day) break;
    found = p;
  }
  return found;
}

// Od kiedy mamy dane dla modelu (pierwszy dzień z jakąkolwiek ceną).
export function historyStart(history, modelId) {
  const series = history?.m?.[modelId];
  if (!series) return null;
  let first = null;
  for (const s of Object.values(series)) if (s.length && (first == null || s[0][0] < first)) first = s[0][0];
  return first;
}

// Dzienne ceny do wykresu: najtańsza oferta w ogóle i najtańsza "Twoja" (mine(offerKey) -> bool).
// allow(offerKey) -> bool zawęża oferty (np. tryb Zwykły: tylko platformy).
// Wartość: cena za 1M tokenów przy Twoich proporcjach wejścia i wyjścia albo cena za obraz / sekundę.
export function priceSeries(history, model, { days = 30, today = dayOf(Date.now()), usage = DEFAULT_USAGE, mine = null, allow = null } = {}) {
  const series = history?.m?.[model.id] ?? {};
  const u = usage.token ?? DEFAULT_USAGE.token;
  const perUnit = (p) => {
    const o = p.length === 3 ? { unit: 'token', in: p[1], out: p[2] } : { unit: model.unit, price: p[1] };
    return o.unit === 'token' ? offerCost(o, usage) / (u.in + u.out || 1) : o.price;
  };
  // Tylko oferty w głównej jednostce modelu (tokeny albo obraz / sekunda).
  const entries = Object.entries(series).filter(([k, s]) => (!allow || allow(k)) && s.some((p) => !gone(p) && (p.length === 3) === (model.unit === 'token')));
  const start = today - days + 1;
  const out = [];
  for (let d = start; d <= today; d++) {
    let best = null;
    let bestKey = null;
    let own = null;
    let ownKey = null;
    for (const [k, s] of entries) {
      const p = at(s, d);
      if (!p || gone(p)) continue;
      const v = perUnit(p);
      if (best == null || v < best) { best = v; bestKey = k; }
      if (mine?.(k) && (own == null || v < own)) { own = v; ownKey = k; }
    }
    out.push({ day: d, best, bestKey, mine: own, mineKey: ownKey });
  }
  return out;
}
