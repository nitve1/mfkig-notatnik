// Adaptery źródeł cen. Każde źródło zwraca znormalizowane oferty:
// { src, provider, tag, unit, in, out, cacheRead, price, variants, discount, context, quant, uptime, url }
//   unit 'token'  -> in / out w USD za 1M tokenów
//   unit 'image'  -> price w USD za obraz (variants: rozmiary)
//   unit 'second' -> price w USD za sekundę wideo (variants: rozdzielczości)
// Wszystkie API poniżej są publiczne i nie wymagają klucza.

import { t } from './i18n.js';

export const OPENROUTER_API = 'https://openrouter.ai/api/v1';
export const VERCEL_API = 'https://ai-gateway.vercel.sh/v1/models';
export const REQUESTY_API = 'https://router.requesty.ai/v1/models';
export const MODELS_DEV_API = 'https://models.dev/api.json';
export const FAL_API = 'https://fal.ai/api/models';
// Kategorie fal.ai, które porównujemy (generowanie obrazów i wideo). 40 modeli na stronę.
export const FAL_CATEGORIES = ['text-to-image', 'text-to-video', 'image-to-video'];
export const FAL_PAGE_SIZE = 40;

export const SOURCES = {
  openrouter: { name: 'OpenRouter', kind: 'gateway', live: true },
  vercel: { name: 'Vercel AI Gateway', kind: 'gateway', live: true },
  requesty: { name: 'Requesty', kind: 'gateway', live: true },
  fal: { name: 'fal.ai', kind: 'gateway', live: true },
  direct: { get name() { return t('src.directLong'); }, kind: 'direct', live: false },
};

const M = 1e6;

export function perMillion(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null; // "-1" = cena dynamiczna
  return Math.round(n * M * 1e6) / 1e6;
}

function num(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

const round = (n, d = 1) => (n == null ? null : Math.round(n * 10 ** d) / 10 ** d);

// Klucz do łączenia tego samego modelu między źródłami:
// "anthropic/claude-opus-5.5-20261001" i "bedrock/claude-opus-5-5@eu" -> "claudeopus55".
export function modelKey(id) {
  let s = String(id).split(':')[0].split('@')[0].split('/').pop().toLowerCase();
  s = s.replace(/[-_. ](\d{8}|\d{4}-\d{2}-\d{2}|\d{6})$/, '');
  s = s.replace(/(instruct|-it$|latest|-maas|-fp8|-hf$)/g, '');
  return s.replace(/[^a-z0-9]/g, '');
}

export function baseId(id) {
  return String(id).split(':')[0];
}

// Klucz dla modeli obrazów i wideo po nazwie, bo każde źródło nazywa je inaczej:
// "Veo 3.1 Fast Generate" (Vercel) i "Veo 3.1 Fast" (fal) -> "veo31fast".
export function mediaKey(name) {
  return String(name ?? '')
    .toLowerCase()
    .replace(/^[^:]+:\s*/, '')
    .replace(/\[(.*?)\]/g, ' $1 ')
    .replace(/\b(text|image|reference|audio)[- ]to[- ](video|image)\b/g, ' ')
    .replace(/\b(t2v|i2v|r2v|t2i|api|generate|preview|model|video)\b/g, ' ')
    .replace(/\b0\d\d\b/g, ' ')
    .replace(/\bv(?=\d)/g, '')
    .replace(/(\d)\.0\b/g, '$1')
    .replace(/[^a-z0-9]/g, '');
}

// ---------- kategorie ----------

// Etykiety w bieżącym języku (core/i18n.js).
export const CATEGORIES = ['all', 'text', 'coding', 'image', 'video'].map((key) => ({
  key,
  get label() { return t(`cat.${key}`); },
}));

const CODING_RE = /(coder|codestral|devstral|codex|code-|-code\b|swe-|starcoder|codegemma|codellama|deepcoder|kimi-dev)/i;

export function categorize({ id, name, outputs = [], tags = [], codingIds }) {
  const cats = new Set();
  if (outputs.includes('video')) cats.add('video');
  if (outputs.includes('image')) cats.add('image');
  if (outputs.includes('text') || outputs.length === 0) {
    cats.add('text');
    if (CODING_RE.test(id) || CODING_RE.test(name ?? '') || codingIds?.has(baseId(id))) cats.add('coding');
  }
  if (tags.includes('image-generation')) cats.add('image');
  if (tags.includes('video-generation')) cats.add('video');
  return [...cats];
}

// ---------- OpenRouter ----------

const OR_OUTPUTS = new Set(['text', 'image', 'video']);

// /models?output_modalities=all -> katalog (warianty ":free" sklejone z bazowym).
export function openrouterModels(apiData, codingIds = new Set()) {
  const byId = new Map();
  const relevant = (m) => (m.architecture?.output_modalities ?? ['text']).some((o) => OR_OUTPUTS.has(o));
  const make = (m, id, paid) => {
    const outputs = m.architecture?.output_modalities ?? ['text'];
    const cats = categorize({ id, name: m.name, outputs, codingIds });
    const unit = cats.includes('video') ? 'second' : 'token';
    let listPrice = null;
    if (paid && unit === 'token') {
      const p = { in: perMillion(m.pricing?.prompt), out: perMillion(m.pricing?.completion) };
      const img = perMillion(m.pricing?.image_output);
      if (cats.includes('image') && img > 0) p.out = img; // modele obrazkowe liczą wyjście w tokenach obrazu
      // OpenRouter nie podaje cen wideo i części obrazów (0/0) - to nie znaczy "za darmo".
      if (p.in != null && p.out != null && !(p.in === 0 && p.out === 0 && !cats.includes('text'))) listPrice = p;
      if (cats.includes('image') && !cats.includes('text') && !(img > 0)) listPrice = null;
    }
    return {
      id,
      key: modelKey(id),
      name: (m.name ?? id).replace(/\s*\(free\)\s*$/i, ''),
      author: id.split('/')[0],
      created: m.created ?? null,
      context: m.context_length || null,
      cats,
      unit,
      freeId: null,
      expires: m.expiration_date ?? null,
      listPrice,
      offers: [],
    };
  };
  for (const m of apiData) if (!m.id.includes(':') && relevant(m)) byId.set(m.id, make(m, m.id, true));
  for (const m of apiData) {
    if (!m.id.endsWith(':free') || !relevant(m)) continue;
    const id = baseId(m.id);
    if (!byId.has(id)) byId.set(id, make(m, id, false));
    byId.get(id).freeId = m.id;
  }
  return [...byId.values()];
}

// /models/{id}/endpoints -> oferty providerów w OpenRouter.
export function openrouterOffers(apiEndpoints, model) {
  const seen = new Set();
  const list = [];
  const imageOnly = model?.cats?.includes('image') && !model.cats.includes('text');
  for (const e of apiEndpoints ?? []) {
    const tag = e.tag ?? e.name;
    if (seen.has(tag)) continue;
    seen.add(tag);
    let inP = perMillion(e.pricing?.prompt);
    let outP = perMillion(e.pricing?.completion);
    const img = perMillion(e.pricing?.image_output);
    if (model?.cats?.includes('image') && img > 0) outP = img;
    if (inP == null || outP == null) continue;
    if (imageOnly && !(img > 0)) continue; // brak ceny obrazu w API
    const discount = Number(e.pricing?.discount) || 0;
    list.push({
      src: 'openrouter',
      provider: e.provider_name,
      tag,
      unit: 'token',
      in: inP,
      out: outP,
      cacheRead: perMillion(e.pricing?.input_cache_read),
      // Cena w API jest już po zniżce, discount to ułamek (0.3 = -30%). Ujemny = narzut, nie promocja.
      discount: discount > 0 ? Math.round(discount * 1000) / 1000 : 0,
      context: e.context_length || null,
      quant: e.quantization && e.quantization !== 'unknown' ? e.quantization : null,
      uptime: round(e.uptime_last_1d),
    });
  }
  return list;
}

// ---------- Vercel AI Gateway ----------

export function vercelEntries(apiData) {
  const out = [];
  for (const m of apiData ?? []) {
    if (!['language', 'image', 'video'].includes(m.type)) continue;
    const p = m.pricing ?? {};
    const outputs = m.type === 'language' ? m.modalities?.output ?? ['text'] : [m.type];
    const cats = categorize({ id: m.id, name: m.name, outputs, tags: m.tags ?? [] });
    let offer = null;
    if (p.video_duration_pricing?.length) {
      const variants = p.video_duration_pricing
        .map((v) => ({ label: v.resolution, price: num(v.cost_per_second) }))
        .filter((v) => v.price != null);
      const pick = variants.find((v) => v.label === '720p') ?? variants[0];
      if (pick) offer = { unit: 'second', price: pick.price, variants };
    } else if (m.type === 'image' && (p.image || p.image_dimension_quality_pricing?.length)) {
      const variants = (p.image_dimension_quality_pricing ?? [])
        .map((v) => ({ label: [v.size, v.quality].filter(Boolean).join(' '), price: num(v.cost) }))
        .filter((v) => v.price != null);
      const price = num(p.image) ?? variants.find((v) => v.label.startsWith('1024x1024'))?.price ?? variants[0]?.price;
      if (price != null) offer = { unit: 'image', price, variants };
    } else if (p.input != null && p.output != null) {
      offer = { unit: 'token', in: perMillion(p.input), out: perMillion(p.output), cacheRead: perMillion(p.input_cache_read) };
      if (offer.in == null || offer.out == null) offer = null;
    }
    if (!offer) continue;
    out.push({
      id: m.id,
      key: modelKey(m.id),
      name: m.name ?? m.id,
      author: m.owned_by ?? m.id.split('/')[0],
      created: m.released ?? m.created ?? null,
      context: m.context_window || null,
      cats,
      offer: {
        src: 'vercel',
        provider: 'Vercel AI Gateway',
        tag: `vercel/${m.id}`,
        discount: 0,
        context: m.context_window || null,
        ...offer,
      },
    });
  }
  return out;
}

// ---------- Requesty ----------

export function requestyEntries(apiData) {
  // Ten sam model w wielu regionach (@eu-west-1...) -> zostaje najtańszy region.
  const best = new Map();
  for (const m of apiData ?? []) {
    const inP = perMillion(m.input_price);
    const outP = perMillion(m.output_price);
    if (inP == null || outP == null || (inP === 0 && outP === 0)) continue;
    const [upstream] = m.id.split('/');
    const tag = `requesty/${m.id.split('@')[0]}`;
    const entry = {
      key: modelKey(m.id),
      offer: {
        src: 'requesty',
        provider: `Requesty (${upstream})`,
        tag,
        unit: 'token',
        in: inP,
        out: outP,
        cacheRead: perMillion(m.cached_price) || null,
        discount: 0,
        context: m.context_window || null,
      },
    };
    const cur = best.get(tag);
    if (!cur || inP * 3 + outP < cur.offer.in * 3 + cur.offer.out) best.set(tag, entry);
  }
  return [...best.values()];
}

// ---------- fal.ai (obrazy i wideo) ----------

// fal podaje cenę opisem, np. "Your request will cost **$0.15** per image" albo
// "For every second of video you generate you will be charged **$0.10** ... for 720p".
// Bierzemy cenę za obraz albo za sekundę (720p, jeśli opis ją wymienia); opisy w tokenach pomijamy.
export function parseFalPrice(text, kind) {
  const plain = String(text ?? '').replace(/\*\*/g, '').replace(/\s+/g, ' ');
  if (!plain || /per 1M|tokens? \(|per 1,?000 tokens/i.test(plain.slice(0, 160))) return null;
  const hits = [];
  const re = /\$\s*(\d+(?:\.\d+)?)/g;
  let m;
  while ((m = re.exec(plain))) {
    const price = Number(m[1]);
    const before = plain.slice(Math.max(0, m.index - 60), m.index);
    const rest = plain.slice(m.index + m[0].length);
    const end = rest.search(/\$|\. |;|$/);
    const after = rest.slice(0, end < 0 ? 80 : Math.min(end, 120));
    hits.push({ price, before, after, around: `${before} ${after}` });
  }
  const valid = hits.filter((h) => h.price > 0 && !/token|1,?000|per 1M|additional|extra|each additional/i.test(h.after));
  if (kind === 'video') {
    const perSec = valid.filter((h) => /second|\/s\b|\/sec/i.test(h.after) || /\b(every|per|each)\b[^$]{0,25}\bsecond/i.test(h.before));
    // Pierwsza stawka w opisie to zwykle podstawowa (najniższa rozdzielczość, bez dźwięku): cena "od".
    return perSec[0] ? { unit: 'second', price: perSec[0].price } : null;
  }
  const img = valid.filter((h) => !/second/i.test(h.after));
  const pick = img.find((h) => /image|megapixel|\bMP\b|1K/i.test(h.around)) ?? img[0];
  return pick ? { unit: 'image', price: pick.price } : null;
}

const FAL_STRIP = /\s*(text[- ]to[- ](image|video)|image[- ]to[- ]video|api)\b/gi;

export function falEntries(items) {
  const best = new Map();
  for (const it of items ?? []) {
    if (it.removed || it.deprecated || it.hidePricing || !it.pricingInfoOverride) continue;
    const kind = String(it.category).endsWith('video') ? 'video' : 'image';
    const p = parseFalPrice(it.pricingInfoOverride, kind);
    if (!p) continue;
    const name = it.title.replace(FAL_STRIP, '').replace(/\s{2,}/g, ' ').trim();
    const key = mediaKey(name);
    if (!/[a-z]{3}/.test(key)) continue; // sama wersja ("V2.6") bez nazwy modelu
    const entry = {
      fresh: true,
      id: `fal/${it.id}`,
      key,
      name: it.modelLab ? `${it.modelLab}: ${name}` : name,
      author: (it.modelLab ?? it.id.split('/')[0]).toLowerCase(),
      created: it.publishedAt ? Math.floor(Date.parse(it.publishedAt) / 1000) : null,
      cats: [kind],
      offer: {
        src: 'fal',
        provider: 'fal.ai',
        tag: `fal/${it.id}`,
        unit: p.unit,
        price: p.price,
        discount: 0,
        context: null,
        url: `https://fal.ai/models/${it.id}`,
        promoNote: /promotional|limited[- ]time|launch pric/i.test(it.pricingInfoOverride) || undefined,
      },
    };
    // Ten sam model bywa w kilku wariantach (tekst->wideo, obraz->wideo): zostaje najtańszy.
    const cur = best.get(key);
    if (!cur || p.price < cur.offer.price) best.set(key, entry);
  }
  return [...best.values()];
}

// ---------- models.dev (cenniki bezpośrednie providerów, aktualizowane przez społeczność) ----------

const SKIP_PROVIDERS = /^(openrouter|vercel|requesty)$|plan|github-copilot|opencode/;

export function modelsDevEntries(api) {
  const out = [];
  for (const [pid, p] of Object.entries(api ?? {})) {
    if (SKIP_PROVIDERS.test(pid)) continue;
    for (const [mid, m] of Object.entries(p.models ?? {})) {
      const inP = num(m.cost?.input);
      const outP = num(m.cost?.output);
      if (inP == null || outP == null || (inP === 0 && outP === 0)) continue;
      out.push({
        key: modelKey(mid),
        offer: {
          src: 'direct',
          provider: p.name ?? pid,
          tag: `${pid}/${mid}`,
          unit: 'token',
          in: inP,
          out: outP,
          cacheRead: num(m.cost?.cache_read),
          discount: 0,
          context: m.limit?.context || null,
          url: p.doc ?? null,
        },
      });
    }
  }
  return out;
}

// ---------- tryb awaryjny w apce / na stronie ----------

export async function liveSnapshot(fetchImpl = fetch) {
  const r = await fetchImpl(`${OPENROUTER_API}/models`);
  if (!r.ok) throw new Error(`OpenRouter /models: HTTP ${r.status}`);
  const json = await r.json();
  const models = openrouterModels(json.data);
  for (const m of models) {
    if (m.listPrice) m.offers = [{ src: 'openrouter', provider: 'OpenRouter', tag: null, unit: 'token', ...m.listPrice, discount: 0 }];
  }
  return { v: 2, generatedAt: new Date().toISOString(), partial: true, models, promos: {}, ended: [], drops: [] };
}

// Oferty OpenRouter dla jednego modelu na żywo (pozostałe źródła zostają ze snapshotu).
export async function liveOpenrouterOffers(model, fetchImpl = fetch) {
  const r = await fetchImpl(`${OPENROUTER_API}/models/${baseId(model.id)}/endpoints`);
  if (!r.ok) throw new Error(`OpenRouter endpoints: HTTP ${r.status}`);
  const json = await r.json();
  return openrouterOffers(json.data?.endpoints, model);
}
