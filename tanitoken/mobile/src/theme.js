import { useColorScheme } from 'react-native';

// Kierunek "półka z promocjami": papier, granatowy atrament, żółta etykieta cenowa.
const light = {
  dark: false,
  ink: '#172036',
  ink2: '#4a5470',
  ink3: '#6b7490',
  paper: '#f1f3f6',
  sheet: '#ffffff',
  rule: '#d9dde5',
  tag: '#ffd60a',
  tagInk: '#172036',
  tagPromo: '#c41e33', // czerwień na żółtej etykiecie, taka sama w obu motywach
  promo: '#d7263d',
  save: '#1e7f4a',
  focus: '#2f5bea',
};
const dark = {
  dark: true,
  ink: '#e9ecf3',
  ink2: '#b4bccd',
  ink3: '#8a93a8',
  paper: '#121a2b',
  sheet: '#18223a',
  rule: '#2a3550',
  tag: '#ffd60a',
  tagInk: '#172036',
  tagPromo: '#c41e33',
  promo: '#ff6b7d',
  save: '#4cc38a',
  focus: '#8aa6ff',
};

export const font = {
  sign: 'BarlowCondensed_700Bold',
  signSemi: 'BarlowCondensed_600SemiBold',
  text: 'Barlow_400Regular',
  textMedium: 'Barlow_500Medium',
  textSemi: 'Barlow_600SemiBold',
};

export const space = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 24, 6: 32, 7: 48 };
export const radius = { tag: 3, ui: 8 };

export function useTheme() {
  return useColorScheme() === 'dark' ? dark : light;
}
