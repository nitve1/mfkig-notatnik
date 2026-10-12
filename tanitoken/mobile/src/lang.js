// Język apki: ustawienie z profilu albo język telefonu (EN, gdy nie obsługujemy).
import * as Localization from 'expo-localization';
import { resolveLanguage } from '../../core/i18n.js';

export function deviceLanguage(setting) {
  let codes = [];
  try {
    codes = Localization.getLocales().map((l) => l.languageCode);
  } catch {
    // brak informacji o języku
  }
  return resolveLanguage(setting, codes);
}
