// Kierunek "Kolorowe kategorie": każda kategoria ma swój kolor, reszta spokojna.
// Motyw: systemowy, jasny albo ciemny (ustawienie w Profilu).
import { createContext, useContext } from 'react';
import { useColorScheme } from 'react-native';

const light = {
  dark: false,
  bg: '#f7f7fb',
  card: '#ffffff',
  ink: '#1a1530',
  ink2: '#6b6880',
  ink3: '#9a97ad',
  line: '#ebeaf2',
  seg: '#ecebf3',
  hero: '#1a1530', // kafel "Wszystkie promocje"
  heroInk: '#ffffff',
  onInk: '#ffffff', // tekst na przyciskach w kolorze ink
  text: '#3d63ff',
  coding: '#8b3dff',
  image: '#ff4f8b',
  video: '#ff8a00',
  deal: '#e8333a',
  dealSoft: '#fde7e8',
  save: '#0f9b6c',
  saveSoft: '#e2f5ee',
  infoSoft: '#e9edff',
};

const dark = {
  dark: true,
  bg: '#100e1b',
  card: '#1b1829',
  ink: '#f3f1fb',
  ink2: '#aaa6c0',
  ink3: '#77738f',
  line: '#2b2741',
  seg: '#24203a',
  hero: '#2c2750',
  heroInk: '#ffffff',
  onInk: '#100e1b',
  text: '#6d8cff',
  coding: '#a875ff',
  image: '#ff6fa3',
  video: '#ffa23a',
  deal: '#ff5c63',
  dealSoft: '#3a1c25',
  save: '#33cf95',
  saveSoft: '#13302a',
  infoSoft: '#232a4d',
};

export const THEMES = { light, dark };

export const font = {
  display: 'BricolageGrotesque_800ExtraBold',
  displayBold: 'BricolageGrotesque_700Bold',
  text: 'Figtree_400Regular',
  textMedium: 'Figtree_500Medium',
  textSemi: 'Figtree_600SemiBold',
  textBold: 'Figtree_700Bold',
};

export const space = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 24, 6: 32, 7: 48 };
export const radius = { sm: 10, md: 14, lg: 18, xl: 22 };

// Kolor kategorii modelu (pierwsza "najmocniejsza" kategoria).
export function mainCat(model) {
  if (model.cats.includes('video')) return 'video';
  if (model.cats.includes('image')) return 'image';
  if (model.cats.includes('coding')) return 'coding';
  return 'text';
}

export const ThemeContext = createContext('system');

// mode: 'system' | 'light' | 'dark'
export function useResolvedTheme(mode) {
  const system = useColorScheme();
  const name = mode === 'light' || mode === 'dark' ? mode : system === 'dark' ? 'dark' : 'light';
  return THEMES[name];
}

export function useTheme() {
  const mode = useContext(ThemeContext);
  return useResolvedTheme(mode);
}
