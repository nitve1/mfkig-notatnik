import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { liveSnapshot } from '../../core/pricing.js';

const DEFAULT_URLS = [
  'https://raw.githubusercontent.com/nitve1/mfkig-notatnik/tanitoken-data/snapshot.json',
  'https://nitve1.github.io/mfkig-notatnik/tanitoken/data/snapshot.json',
];
// Podgląd web (scripts/web-preview.mjs) ma snapshot obok strony.
const SNAPSHOT_URLS = [
  ...(Platform.OS === 'web' ? ['snapshot.json'] : []),
  ...(Constants.expoConfig?.extra?.snapshotUrls ?? DEFAULT_URLS),
];
const CACHE_KEY = 'tanitoken:snapshot:v2';
const REFRESH_MS = 5 * 60 * 1000;

// Gałąź danych (świeża) -> GitHub Pages (kopia z repo) -> OpenRouter na żywo (tylko ceny bazowe).
export async function fetchSnapshot() {
  for (const url of SNAPSHOT_URLS) {
    try {
      const r = await fetch(`${url}?t=${Math.floor(Date.now() / 60000)}`);
      if (!r.ok) continue;
      const s = await r.json();
      if (s.v === 2) return s;
    } catch {
      // następne źródło
    }
  }
  return liveSnapshot();
}

export async function cachedSnapshot() {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// Snapshot cen: od razu z cache, potem z sieci; odświeżanie co 5 min i po powrocie do apki.
export function useSnapshot() {
  const [snapshot, setSnapshot] = useState(null);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const busy = useRef(false);

  const refresh = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setRefreshing(true);
    try {
      const s = await fetchSnapshot();
      setSnapshot(s);
      setError(null);
      if (!s.partial) AsyncStorage.setItem(CACHE_KEY, JSON.stringify(s)).catch(() => {});
    } catch (e) {
      setError(e.message);
    } finally {
      busy.current = false;
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    cachedSnapshot().then((s) => s && setSnapshot((cur) => cur ?? s));
    refresh();
    const timer = setInterval(refresh, REFRESH_MS);
    const sub = AppState.addEventListener('change', (st) => st === 'active' && refresh());
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [refresh]);

  return { snapshot, error, refreshing, refresh };
}
