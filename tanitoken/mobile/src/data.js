// Ceny w apce. Źródła, od najświeższego:
// 1. sprawdzenie na telefonie (OpenRouter, Vercel, Requesty) przy otwarciu i co 30 min,
// 2. zestawienie z GitHub (raz na kilka godzin: cenniki bezpośrednie i dłuższa historia promocji),
// 3. zapis na telefonie z poprzedniego razu,
// 4. zestawienie wbudowane w apkę (z dnia buildu), gdy nie ma internetu przy pierwszym starcie.
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Network from 'expo-network';
import { buildSnapshot, refreshModels } from '../../core/snapshot.js';
import { readMeta, readSnapshot, writeMeta, writeSnapshot } from './store';

const DEFAULT_URLS = [
  'https://raw.githubusercontent.com/nitve1/mfkig-notatnik/tanitoken-data/snapshot.json',
  'https://raw.githubusercontent.com/nitve1/mfkig-notatnik/claude/hopeful-gauss-8su545/tanitoken/data/snapshot.json',
  'https://nitve1.github.io/mfkig-notatnik/tanitoken/data/snapshot.json',
];
// Podgląd web (scripts/web-preview.mjs) ma snapshot obok strony i nie może pytać innych serwerów.
const SNAPSHOT_URLS = [
  ...(Platform.OS === 'web' ? ['snapshot.json'] : []),
  ...(Constants.expoConfig?.extra?.snapshotUrls ?? DEFAULT_URLS),
];
const BUNDLED = require('../../data/snapshot.json');

export const LIVE_EVERY_MS = 30 * 60 * 1000;
const REMOTE_EVERY_MS = 6 * 60 * 60 * 1000;
const PARTIAL_EVERY_MS = 5 * 60 * 1000;
const TICK_MS = 60 * 1000;
// Web: tylko lokalny podgląd do testów (opublikowana strona nie może pytać innych serwerów).
const CAN_LIVE = Platform.OS !== 'web' || (typeof location !== 'undefined' && location.hostname === 'localhost');

export async function getJson(url) {
  const r = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

// Opisy modeli są w osobnym pliku (data/descriptions.json), nie w zestawieniu cen.
function stripDesc(s) {
  for (const m of s.models) delete m.desc;
  return s;
}

// Porównanie świeżości po ostatnim PEŁNYM sprawdzeniu (częściowe odświeżenie nie udaje pełnego).
const newer = (a, b) => !b || (a && Date.parse(a.generatedAt) > Date.parse(b.generatedAt));
const stamp = (s) => Date.parse(s?.updatedAt ?? s?.generatedAt) || 0;

export async function fetchRemoteSnapshot() {
  for (const url of SNAPSHOT_URLS) {
    try {
      const s = await getJson(`${url}?t=${Math.floor(Date.now() / 60000)}`);
      if (s?.v === 2) return s;
    } catch {
      // następne źródło
    }
  }
  return null;
}

// Stan sieci: czy jest internet i czy to Wi-Fi (albo kabel).
export async function networkState() {
  if (!CAN_LIVE) return { online: false, wifi: false };
  try {
    const st = await Network.getNetworkStateAsync();
    const online = st.isConnected !== false && st.isInternetReachable !== false;
    const wifi = st.type === Network.NetworkStateType.WIFI || st.type === Network.NetworkStateType.ETHERNET;
    return { online, wifi };
  } catch {
    return { online: true, wifi: false };
  }
}

// Zgodność ze starszym kodem: czy wolno zrobić pełne sprawdzenie.
export async function liveAllowed(wifiOnly) {
  const n = await networkState();
  return n.online && (!wifiOnly || n.wifi);
}

// Jeden krok odświeżenia, wspólny dla apki i zadania w tle.
// Pełne sprawdzenie (ok. 430 zapytań, 3 MB) przy ustawieniu "tylko Wi-Fi" czeka na Wi-Fi; obserwowane
// modele (kilka kB) sprawdzamy też na danych komórkowych.
export async function refreshPrices(current, { force = false, wifiOnly = true, onProgress, watchIds = null } = {}) {
  const meta = await readMeta();
  const now = Date.now();
  let snap = current;
  // Zadanie w tle mogło zapisać nowsze ceny, niż mamy w pamięci: wtedy bierzemy plik z dysku.
  if (!snap || (meta.snapAt && meta.snapAt > stamp(snap))) snap = (await readSnapshot()) ?? snap;
  snap = snap ?? BUNDLED;
  if (newer(BUNDLED, snap)) snap = BUNDLED;
  let changed = false;
  let error = null;

  const net = await networkState();
  const canFull = net.online && (!wifiOnly || net.wifi);
  const canPartial = net.online;

  // Zestawienie z GitHub: na start bez danych, potem co kilka godzin albo gdy nie wolno sprawdzać samemu.
  const remoteDue = !meta.remoteAt || now - meta.remoteAt > REMOTE_EVERY_MS || !canFull;
  if (net.online && remoteDue && (force || !meta.remoteAt || now - (meta.remoteTryAt ?? 0) > 15 * 60 * 1000)) {
    await writeMeta({ remoteTryAt: now });
    const remote = await fetchRemoteSnapshot();
    if (remote) {
      await writeMeta({ remoteAt: now });
      if (newer(remote, snap)) {
        snap = remote;
        changed = true;
      }
    }
  }

  try {
    if (canFull && (force || !meta.liveAt || now - meta.liveAt > LIVE_EVERY_MS)) {
      snap = stripDesc(await buildSnapshot({ getJson, prev: snap, base: snap, includeDirect: false, concurrency: 8, onProgress }));
      snap.fullAt = snap.generatedAt;
      await writeMeta({ liveAt: now });
      changed = true;
    } else if (canPartial && watchIds?.length && (force || !meta.partialAt || now - meta.partialAt > PARTIAL_EVERY_MS)) {
      // Między pełnymi sprawdzeniami i na danych komórkowych: tylko obserwowane modele (kilka zapytań).
      snap = await refreshModels(snap, watchIds, { getJson });
      await writeMeta({ partialAt: now });
      changed = true;
    }
  } catch (e) {
    error = e.message;
  }
  if (!error && CAN_LIVE) {
    if (!net.online) error = 'offline';
    else if (!canFull) error = 'wifi-only';
  }

  if (changed) await writeSnapshot(snap);
  return { snapshot: snap, changed, error, live: canFull };
}

// Stan cen w apce: od razu z pamięci telefonu, potem odświeżanie.
export function useSnapshot({ wifiOnly = true, watchIds = [] } = {}) {
  const [snapshot, setSnapshot] = useState(null);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [progress, setProgress] = useState(null);
  const [meta, setMeta] = useState({});
  const busy = useRef(false);
  const current = useRef(null);
  const lastStep = useRef(-1);
  const opts = useRef({ wifiOnly, watchIds });
  opts.current = { wifiOnly, watchIds };

  const refresh = useCallback(async (force = false) => {
    if (busy.current) return;
    busy.current = true;
    lastStep.current = -1;
    setRefreshing(true);
    try {
      const res = await refreshPrices(current.current, {
        force,
        wifiOnly: opts.current.wifiOnly,
        watchIds: opts.current.watchIds,
        // Postęp co 5%, a nie przy każdym z ~430 zapytań (inaczej cały ekran przerysowuje się setki razy).
        onProgress: (p) => {
          const step = Math.floor(p * 20) / 20;
          if (step !== lastStep.current) { lastStep.current = step; setProgress(step); }
        },
      });
      if (res.changed || !current.current) {
        current.current = res.snapshot;
        setSnapshot(res.snapshot);
      }
      setError(res.error);
      setMeta(await readMeta());
    } finally {
      busy.current = false;
      setRefreshing(false);
      setProgress(null);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    readSnapshot().then((s) => {
      if (!alive) return;
      const start = newer(BUNDLED, s) ? BUNDLED : s;
      current.current = start;
      setSnapshot(start);
      readMeta().then(setMeta);
      refresh(false);
    });
    // Co minutę sprawdzamy, czy minęło 30 min od ostatniego pełnego sprawdzenia.
    const timer = setInterval(() => AppState.currentState === 'active' && refresh(false), TICK_MS);
    const sub = AppState.addEventListener('change', (st) => st === 'active' && refresh(false));
    return () => {
      alive = false;
      clearInterval(timer);
      sub.remove();
    };
  }, [refresh]);

  return { snapshot, error, refreshing, progress, meta, refresh: () => refresh(true) };
}
