// Kierunek "Kolorowe kategorie" w wersji "Nocne szkło": każda kategoria ma swój kolor, który świeci
// spod przydymionych, półprzezroczystych paneli. Jeden motyw, ciemny (decyzja z 2026-10-13).
import { createContext, useContext } from 'react';

const night = {
  dark: true,
  bg: '#0b0a12',
  card: 'rgba(11,10,18,0.55)', // równe przyciemnienie pod połyskiem: tekst min. 4,5:1 (WCAG AA) na każdym miejscu tła
  cardRaised: 'rgba(38,35,56,0.82)', // ważniejsza sekcja: jaśniejsza powierzchnia (Material: wyżej = jaśniej)
  cardSolid: '#1a1730', // tam, gdzie pod spodem nie ma tła (np. stopka kreatora)
  ink: '#f3f1fb',
  ink2: '#c9c5dd', // 7,8:1 w najgorszym miejscu
  ink3: '#a29eba', // 5,1:1 w najgorszym miejscu
  line: 'rgba(255,255,255,0.10)',
  seg: 'rgba(255,255,255,0.06)',
  hero: 'rgba(255,255,255,0.10)', // kafel "Wszystkie promocje"
  heroInk: '#ffffff',
  onInk: '#100e1b', // tekst na jasnych przyciskach
  text: '#8aa2ff',
  coding: '#a875ff',
  image: '#ff6fa3',
  video: '#ffa23a',
  deal: '#ff5c63',
  dealSoft: 'rgba(255,92,99,0.16)',
  save: '#33cf95',
  saveSoft: 'rgba(51,207,149,0.14)',
  infoSoft: 'rgba(109,140,255,0.16)',
  glassTint: 'rgba(11,10,18,0.62)', // pasek: mocniej przyciemniony, bo pod nim przewija się tekst
  glassLine: 'rgba(255,255,255,0.16)',
  glassLineStrong: 'rgba(255,255,255,0.24)',
  glassActive: 'rgba(255,255,255,0.16)',
  // Wykresy: para sprawdzona walidatorem palety (tryb ciemny, daltonizm, kontrast 3:1).
  chartBest: '#6a86f5',
  chartMine: '#d27818',
  chartGrid: 'rgba(255,255,255,0.08)',
};

export const THEMES = { night };

// Kafle kategorii: pełne, ciemniejsze tony, biały tekst ma na nich 5,2–5,9:1.
export const TILE = { text: '#4a63d8', coding: '#7a3fe0', image: '#c2185b', video: '#a8530a', all: null };
export const tileColor = (cat) => TILE[cat];

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
// Rogi bliżej kwadratu niż pigułki (uwaga użytkownika z 2026-10-13). Element w środku innego ma promień
// zewnętrzny minus odstęp, żeby łuki szły równolegle (np. pasek 18 i zakładka 14 przy odstępie 4).
export const radius = { xs: 8, sm: 10, md: 12, lg: 14, xl: 18 };

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
