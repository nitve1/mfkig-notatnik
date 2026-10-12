// Tłumaczenia TaniToken: EN (domyślny), PL, ES, FR, IT, DE.
// Jeden moduł dla apki i tekstów w core (alerty, formaty). Klucze w locales/<język>.js.
import en from './locales/en.js';
import pl from './locales/pl.js';
import es from './locales/es.js';
import fr from './locales/fr.js';
import it from './locales/it.js';
import de from './locales/de.js';

export const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'pl', name: 'Polski' },
  { code: 'es', name: 'Español' },
  { code: 'fr', name: 'Français' },
  { code: 'it', name: 'Italiano' },
  { code: 'de', name: 'Deutsch' },
];
const DICTS = { en, pl, es, fr, it, de };

let current = 'en';

export function setLanguage(code) {
  current = DICTS[code] ? code : 'en';
  return current;
}

export function getLanguage() {
  return current;
}

// "system" -> język telefonu, jeśli go obsługujemy, inaczej angielski.
export function resolveLanguage(setting, deviceCodes = []) {
  if (setting && setting !== 'system' && DICTS[setting]) return setting;
  for (const c of deviceCodes) {
    const code = String(c ?? '').toLowerCase().slice(0, 2);
    if (DICTS[code]) return code;
  }
  return 'en';
}

// Odmiana liczebników: one / few / many / other (polski ma "1 dzień, 2 dni, 5 dni").
export function pluralForm(n, lang = current) {
  const abs = Math.abs(n);
  if (lang === 'pl') {
    if (abs === 1) return 'one';
    const d = abs % 10;
    const h = abs % 100;
    if (d >= 2 && d <= 4 && (h < 12 || h > 14)) return 'few';
    return 'many';
  }
  if (lang === 'fr') return abs < 2 ? 'one' : 'other';
  return abs === 1 ? 'one' : 'other';
}

function lookup(key, lang) {
  return DICTS[lang]?.[key] ?? DICTS.en[key];
}

// t('deals.count', { n: 5 }) -> wartość może być tekstem albo { one, few, many, other }.
export function t(key, vars = {}, lang = current) {
  let v = lookup(key, lang);
  if (v == null) return key;
  if (typeof v === 'object') {
    const form = pluralForm(vars.n ?? 0, lang);
    v = v[form] ?? v.other ?? v.many ?? v.one;
  }
  return v.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? `{${k}}`));
}

// Liczby: EN "1,234.5", reszta "1 234,5". Ceny: EN "$5.10", reszta "5,10 $".
export function formatNumber(value, decimals) {
  const fixed = decimals == null ? String(value) : value.toFixed(decimals);
  if (current === 'en') return fixed.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const [int, frac] = fixed.split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return frac != null ? `${grouped},${frac}` : grouped;
}

export function money(text) {
  return current === 'en' ? `$${text}` : `${text} $`;
}
