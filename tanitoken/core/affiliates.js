// Linki wyjściowe do providerów i programy partnerskie.
//
// Jak zarabiać: zapisz się do programu (pole `apply`), po akceptacji wklej swój link w `link`.
// Od tej chwili apka i landing kierują tam ruch i oznaczają ofertę jako "link partnerski"
// (oznaczenie jest wymagane prawem, m.in. przez dyrektywę UCPD i wytyczne UOKiK).
// Programy sprawdzone w październiku 2026, warunki mogą się zmienić.

import { t } from './i18n.js';

export const AFFILIATES = {
  'Novita': {
    program: '10% od wydatków poleconych przez 180 dni',
    apply: 'https://novita.ai/affiliate',
    link: null,
    sponsor: { cats: ['text', 'coding', 'image', 'video'], color: '#23b26d', logo: 'N', name: 'Novita AI', tagline: 'ad.novita' },
  },
  'CometAPI': {
    program: '20% od każdego doładowania poleconego (Tolt)',
    apply: 'https://www.cometapi.com/',
    link: null,
    sponsor: { cats: ['text', 'coding'], color: '#3d63ff', logo: 'C', name: 'CometAPI', tagline: 'ad.comet' },
  },
  'WaveSpeedAI': {
    program: '10% od płatności w pierwszych 30 dniach (Tolt)',
    apply: 'https://wavespeed.ai/',
    link: null,
    sponsor: { cats: ['image', 'video'], color: '#7b4dff', logo: 'W', name: 'WaveSpeedAI', tagline: 'ad.wavespeed' },
  },
  'AI/ML API': {
    program: '30% cyklicznie (Rewardful), warunki do potwierdzenia',
    apply: 'https://aimlapi.com/',
    link: null,
    sponsor: { cats: ['text', 'coding', 'image', 'video'], color: '#ff8a00', logo: 'AI', name: 'AI/ML API', tagline: 'ad.aiml' },
  },
  'GMICloud': {
    program: 'Ambasador GMI Cloud: 20% prowizji (na zaproszenie)',
    apply: 'https://www.gmicloud.ai/en/company/ambassador-program',
    link: null,
  },
  'fal': {
    program: 'Brak publicznego programu (sprawdzone 2026-10)',
    apply: null,
    link: null,
  },
};

// Karty "Sponsorowane" w listach: tylko partnerzy z wklejonym linkiem, pasujący do kategorii.
// Zasady (docs/afiliacje-2026-10.md): oznaczone, najwyżej co SPONSOR_EVERY pozycji, nigdy na pierwszym
// miejscu i nigdy nie zmieniają kolejności cen.
export const SPONSOR_EVERY = 10;

export function sponsorsFor(cat = 'all') {
  return Object.values(AFFILIATES)
    .filter((a) => a.link && a.sponsor && (cat === 'all' || a.sponsor.cats.includes(cat)))
    .map((a) => ({ ...a.sponsor, url: withTracking(a.link) }));
}

// Wstawia karty sponsorów do listy co SPONSOR_EVERY pozycji (po pozycji 10, 20...).
export function withSponsors(items, cat = 'all') {
  const ads = sponsorsFor(cat);
  if (!ads.length || items.length < SPONSOR_EVERY) return items;
  const out = [];
  let n = 0;
  items.forEach((it, i) => {
    out.push(it);
    if ((i + 1) % SPONSOR_EVERY === 0 && i + 1 < items.length) out.push({ type: 'sponsor', sponsor: ads[n++ % ads.length], key: `ad-${i}` });
  });
  return out;
}

// Nazwy providerów różnią się między źródłami ("GMICloud", "GMI Cloud").
const ALIASES = { 'GMI Cloud': 'GMICloud', 'Novita AI': 'Novita', 'fal.ai': 'fal', 'AIMLAPI': 'AI/ML API', 'WaveSpeed': 'WaveSpeedAI' };

const UTM = { utm_source: 'lighttokenz', utm_medium: 'referral', utm_campaign: 'lighttokenz' };

export function withTracking(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    for (const [k, v] of Object.entries(UTM)) if (!u.searchParams.has(k)) u.searchParams.set(k, v);
    return u.toString();
  } catch {
    return url;
  }
}

export function affiliateFor(providerName) {
  const name = String(providerName ?? '').replace(/^Requesty \((.*)\)$/, '$1');
  const a = AFFILIATES[ALIASES[name] ?? name];
  return a?.link ? a : null;
}

// Gdzie kierujemy po kliknięciu oferty. sponsored = link partnerski (pokazujemy oznaczenie).
export function offerLink(model, offer) {
  const aff = offer ? affiliateFor(offer.provider) : null;
  if (aff) return { url: aff.link, sponsored: true, label: t('link.goTo', { name: offer.provider }) };
  let url;
  let label;
  switch (offer?.src) {
    case 'vercel':
      url = 'https://vercel.com/ai-gateway/models';
      label = t('link.open', { name: 'Vercel AI Gateway' });
      break;
    case 'requesty':
      url = 'https://www.requesty.ai/';
      label = t('link.open', { name: 'Requesty' });
      break;
    case 'fal':
    case 'direct':
      url = offer.url;
      label = t('link.open', { name: offer.provider });
      break;
    default:
      url = model.id.includes('/') && model.offers?.some((o) => o.src === 'openrouter') ? `https://openrouter.ai/${model.id}` : null;
      label = t('link.open', { name: 'OpenRouter' });
  }
  return url ? { url: withTracking(url), sponsored: false, label } : null;
}
