import { useColorScheme } from 'react-native';

const light = {
  bg: '#f6f8f7', surface: '#ffffff', surface2: '#eef3f1', text: '#0f1a16', muted: '#5b6b65',
  line: '#dde5e1', accent: '#0f9d58', accentInk: '#ffffff', accentSoft: 'rgba(15,157,88,0.12)',
  gold: '#b7791f', goldSoft: 'rgba(183,121,31,0.14)', red: '#c0392b', dark: false,
};
const dark = {
  bg: '#0b1210', surface: '#121c19', surface2: '#182622', text: '#e8f1ed', muted: '#8fa39b',
  line: '#22332e', accent: '#3ee08f', accentInk: '#062014', accentSoft: 'rgba(62,224,143,0.14)',
  gold: '#ffd166', goldSoft: 'rgba(255,209,102,0.14)', red: '#ff7a6b', dark: true,
};

export function useTheme() {
  return useColorScheme() === 'dark' ? dark : light;
}
