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
  },
  'GMICloud': {
    program: 'Ambasador GMI Cloud: 20% prowizji',
    apply: 'https://www.gmicloud.ai/en/company/ambassador-program',
    link: null,
  },
  'fal': {
    program: 'Program fal (warunki niepotwierdzone, cookie 60 dni)',
    apply: 'https://openaffiliate.dev/programs/fal',
    link: null,
  },
};

// Nazwy providerów różnią się między źródłami ("GMICloud", "GMI Cloud").
const ALIASES = { 'GMI Cloud': 'GMICloud', 'Novita AI': 'Novita', 'fal.ai': 'fal' };

const UTM = { utm_source: 'tanitoken', utm_medium: 'referral', utm_campaign: 'porownywarka' };

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
