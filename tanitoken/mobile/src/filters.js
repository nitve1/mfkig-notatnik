// Które oferty widzi użytkownik, zależnie od trybu (Zwykły / Pro) i ulubionych.
import { favoriteMatcher, isPlatformOffer } from '../../core/pricing.js';

export function isPro(profile) {
  return profile?.mode === 'pro';
}

function and(...filters) {
  const list = filters.filter(Boolean);
  if (!list.length) return null;
  return (o) => list.every((f) => f(o));
}

// Tryb Zwykły: tylko platformy (OpenRouter, Vercel AI Gateway, Requesty).
export function modeFilter(profile) {
  return isPro(profile) ? null : isPlatformOffer;
}

// Co pokazujemy na listach: tryb + opcjonalnie "tylko ulubieni".
export function viewFilter(profile) {
  return and(modeFilter(profile), profile?.onlyFavorites ? favoriteMatcher(profile.providers) : null);
}

// Z czym porównujemy przy alertach "taniej" i w Moje: tryb + ulubieni (jeśli są).
export function compareFilter(profile) {
  return and(modeFilter(profile), favoriteMatcher(profile?.providers));
}
