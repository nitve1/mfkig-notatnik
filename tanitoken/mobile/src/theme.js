// Kierunek "Kolorowe kategorie" w wersji "Nocne szkło": każda kategoria ma swój kolor, który świeci
// spod przydymionych, półprzezroczystych paneli. Jeden motyw, ciemny (decyzja z 2026-10-13).
import { createContext, useContext } from 'react';

const night = {
  dark: true,
  bg: '#0c0a17',
  card: 'rgba(30,26,52,0.55)', // szkło paneli: tło prześwituje
  cardSolid: '#1a1730', // tam, gdzie pod spodem nie ma tła (np. stopka kreatora)
  ink: '#f3f1fb',
  ink2: '#b4b0cc',
  ink3: '#7e7a98',
  line: 'rgba(255,255,255,0.10)',
  seg: 'rgba(255,255,255,0.06)',
  hero: 'rgba(255,255,255,0.10)', // kafel "Wszystkie promocje"
  heroInk: '#ffffff',
  onInk: '#100e1b', // tekst na jasnych przyciskach
  text: '#6d8cff',
  coding: '#a875ff',
  image: '#ff6fa3',
  video: '#ffa23a',
  deal: '#ff5c63',
  dealSoft: 'rgba(255,92,99,0.16)',
  save: '#33cf95',
  saveSoft: 'rgba(51,207,149,0.14)',
  infoSoft: 'rgba(109,140,255,0.16)',
  glassTint: 'rgba(30,26,52,0.38)', // pasek zakładek: ok. 15% bardziej przezroczysty niż wcześniej
  glassEdge: 'rgba(255,255,255,0.32)', // 1 px jasnej krawędzi u góry: światło na grubej tafli
  glassLine: 'rgba(255,255,255,0.10)',
  glassSheen: 'rgba(255,255,255,0.045)', // połysk górnej połowy panelu
  glassActive: 'rgba(255,255,255,0.16)',
};

export const THEMES = { night };

// Kolory kategorii na kaflach: lekko przezroczyste, żeby świecące tło przebijało przez szkło.
export const tileColor = (c) => `${c}d9`;

export const font = {
  // Archivo (klasyczna szerokość) w całej apce, wybór użytkownika z 2026-10-14.
  display: 'Archivo_800ExtraBold',
  displayBold: 'Archivo_700Bold',
  text: 'Archivo_400Regular',
  textMedium: 'Archivo_500Medium',
  textSemi: 'Archivo_600SemiBold',
  textBold: 'Archivo_700Bold',
};

export const space = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 24, 6: 32, 7: 48 };
// Rogi bliżej kwadratu niż pigułki (uwaga użytkownika z 2026-10-13).
export const radius = { xs: 9, sm: 10, md: 12, lg: 14, xl: 16 };

// Kolor kategorii modelu (pierwsza "najmocniejsza" kategoria).
export function mainCat(model) {
  if (model.cats.includes('video')) return 'video';
  if (model.cats.includes('image')) return 'image';
  if (model.cats.includes('coding')) return 'coding';
  return 'text';
}

// Zostawione dla zgodności: dawniej przełącznik motywu, teraz zawsze nocny.
export const ThemeContext = createContext('night');

// Ile miejsca zostawić na dole list, żeby ostatni element nie chował się pod pływającym paskiem.
export const BottomSpaceContext = createContext(space[7]);
export const useBottomSpace = () => useContext(BottomSpaceContext);

export function useResolvedTheme() {
  return night;
}

export function useTheme() {
  return night;
}
