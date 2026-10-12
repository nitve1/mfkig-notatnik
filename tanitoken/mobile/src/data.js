import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { liveSnapshot } from '../../core/pricing.js';

const SNAPSHOT_URLS = Constants.expoConfig?.extra?.snapshotUrls ?? [];
const CACHE_KEY = 'tanitoken:snapshot';
const FAV_KEY = 'tanitoken:favorites';
const REFRESH_MS = 5 * 60 * 1000;

async function fetchSnapshot() {
  // Gałąź danych (świeża) -> GitHub Pages (kopia z repo) -> OpenRouter na żywo (tylko ceny bazowe).
  for (const url of SNAPSHOT_URLS) {
    try {
      const r = await fetch(`${url}?t=${Math.floor(Date.now() / 60000)}`);
      if (r.ok) return await r.json();
    } catch {
      // następne źródło
    }
  }
  return liveSnapshot();
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
      AsyncStorage.setItem(CACHE_KEY, JSON.stringify(s)).catch(() => {});
    } catch (e) {
      setError(e.message);
    } finally {
      busy.current = false;
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    AsyncStorage.getItem(CACHE_KEY)
      .then((raw) => raw && setSnapshot((cur) => cur ?? JSON.parse(raw)))
      .catch(() => {});
    refresh();
    const timer = setInterval(refresh, REFRESH_MS);
    const sub = AppState.addEventListener('change', (s) => s === 'active' && refresh());
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [refresh]);

  return { snapshot, error, refreshing, refresh };
}

export function useFavorites() {
  const [favorites, setFavorites] = useState([]);
  useEffect(() => {
    AsyncStorage.getItem(FAV_KEY)
      .then((raw) => raw && setFavorites(JSON.parse(raw)))
      .catch(() => {});
  }, []);
  const toggle = useCallback((id) => {
    setFavorites((cur) => {
      const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
      AsyncStorage.setItem(FAV_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);
  return { favorites, toggle };
}
