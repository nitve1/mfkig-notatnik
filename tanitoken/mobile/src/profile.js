// Profil użytkownika: tylko na urządzeniu, bez konta i serwera.
// Kopia: Android Auto Backup (konto Google, automatycznie), iOS Keychain (opcja), eksport/import pliku.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import { DEFAULT_USAGE } from '../../core/pricing.js';

export const PROFILE_KEY = 'tanitoken:profile:v1';
const KEYCHAIN_KEY = 'tanitoken.profile';
const MAX_SENT = 300;

export const DEFAULT_PROFILE = {
  version: 1,
  onboarded: false,
  name: '',
  cats: ['all'],
  providers: [], // ulubieni dostawcy (nazwy jak w ofertach)
  onlyFavorites: false,
  usage: DEFAULT_USAGE,
  keepAfterUninstall: false, // iOS: lustrzana kopia w Keychain
  notify: { enabled: false, promoStart: true, promoEnd: true, aging: true, cheaper: true, expires: true },
  watchlist: [], // { modelId, mode: 'watch' | 'use', offerKey, since }
  sent: {}, // id alertu -> data wysłania
  alerts: [], // ostatnie alerty do wyświetlenia w apce
};

function merge(raw) {
  const p = { ...DEFAULT_PROFILE, ...raw };
  p.notify = { ...DEFAULT_PROFILE.notify, ...(raw?.notify ?? {}) };
  p.usage = { ...DEFAULT_USAGE, ...(raw?.usage ?? {}) };
  return p;
}

export async function readProfile() {
  try {
    const raw = await AsyncStorage.getItem(PROFILE_KEY);
    if (raw) return merge(JSON.parse(raw));
  } catch {
    // uszkodzony zapis -> spróbuj z Keychain
  }
  if (Platform.OS === 'ios') {
    try {
      const raw = await SecureStore.getItemAsync(KEYCHAIN_KEY);
      if (raw) return merge(JSON.parse(raw));
    } catch {
      // brak kopii
    }
  }
  return merge(null);
}

export async function writeProfile(p) {
  const trimmed = { ...p, sent: trimSent(p.sent), alerts: p.alerts.slice(0, 50) };
  const json = JSON.stringify(trimmed);
  await AsyncStorage.setItem(PROFILE_KEY, json);
  if (Platform.OS === 'ios') {
    // Keychain przeżywa odinstalowanie apki; trzymamy tam profil bez historii alertów.
    if (p.keepAfterUninstall) {
      const { sent: _s, alerts: _a, ...core } = trimmed;
      await SecureStore.setItemAsync(KEYCHAIN_KEY, JSON.stringify(core)).catch(() => {});
    } else {
      await SecureStore.deleteItemAsync(KEYCHAIN_KEY).catch(() => {});
    }
  }
  return trimmed;
}

function trimSent(sent) {
  const entries = Object.entries(sent ?? {});
  if (entries.length <= MAX_SENT) return sent ?? {};
  return Object.fromEntries(entries.sort((a, b) => b[1].localeCompare(a[1])).slice(0, MAX_SENT));
}

export async function exportProfile(p) {
  const { sent: _s, alerts: _a, ...core } = p;
  const file = new File(Paths.cache, `tanitoken-profil-${new Date().toISOString().slice(0, 10)}.json`);
  if (file.exists) file.delete();
  file.create();
  file.write(JSON.stringify({ app: 'tanitoken', exportedAt: new Date().toISOString(), profile: core }, null, 2));
  await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Zapisz profil TaniToken' });
}

export async function importProfile() {
  const res = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/plain', '*/*'], copyToCacheDirectory: true });
  if (res.canceled || !res.assets?.length) return null;
  const json = JSON.parse(await new File(res.assets[0].uri).text());
  if (json?.app !== 'tanitoken' || !json.profile) throw new Error('To nie jest plik profilu TaniToken.');
  return merge({ ...json.profile, onboarded: true });
}

const Ctx = createContext(null);

export function ProfileProvider({ children }) {
  const [profile, setProfile] = useState(null);
  const latest = useRef(null);

  useEffect(() => {
    const load = () =>
      readProfile().then((p) => {
        latest.current = p;
        setProfile(p);
      });
    load();
    // Zadanie w tle mogło dopisać alerty do zapisu, więc po powrocie do apki czytamy go ponownie.
    const sub = AppState.addEventListener('change', (st) => st === 'active' && load());
    return () => sub.remove();
  }, []);

  const update = useCallback((patch) => {
    const base = latest.current ?? DEFAULT_PROFILE;
    const next = typeof patch === 'function' ? patch(base) : { ...base, ...patch };
    latest.current = next;
    setProfile(next);
    writeProfile(next).catch(() => {});
    return next;
  }, []);

  const api = useMemo(() => {
    const find = (id) => profile?.watchlist.find((w) => w.modelId === id) ?? null;
    return {
      profile,
      update,
      watchItem: find,
      // Obserwuj / przestań obserwować.
      toggleWatch: (modelId) =>
        update((p) => {
          const has = p.watchlist.some((w) => w.modelId === modelId);
          return {
            ...p,
            watchlist: has
              ? p.watchlist.filter((w) => w.modelId !== modelId)
              : [...p.watchlist, { modelId, mode: 'watch', offerKey: null, since: new Date().toISOString() }],
          };
        }),
      // Używam modelu u konkretnego dostawcy (offerKey) albo null = tylko obserwuję.
      setUsing: (modelId, offerKey) =>
        update((p) => {
          const rest = p.watchlist.filter((w) => w.modelId !== modelId);
          const item = { modelId, mode: offerKey ? 'use' : 'watch', offerKey: offerKey ?? null, since: new Date().toISOString() };
          return { ...p, watchlist: [...rest, item] };
        }),
      toggleProvider: (name) =>
        update((p) => ({
          ...p,
          providers: p.providers.includes(name) ? p.providers.filter((x) => x !== name) : [...p.providers, name],
        })),
      replace: (p) => update(() => p),
      reset: () => update(() => ({ ...DEFAULT_PROFILE })),
    };
  }, [profile, update]);

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useProfile() {
  return useContext(Ctx);
}
