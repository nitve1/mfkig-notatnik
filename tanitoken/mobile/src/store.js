// Zapis zestawienia cen na urządzeniu. Plik w katalogu apki (AsyncStorage na Androidzie
// nie lubi wpisów > 2 MB), na webie localStorage przez AsyncStorage.
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { File, Paths } from 'expo-file-system';

const FILE_NAME = 'tanitoken-snapshot-v2.json';
const WEB_KEY = 'tanitoken:snapshot:v2';
const META_KEY = 'tanitoken:refresh-meta';

function file() {
  return new File(Paths.document, FILE_NAME);
}

export async function readSnapshot() {
  try {
    if (Platform.OS === 'web') {
      const raw = await AsyncStorage.getItem(WEB_KEY);
      return raw ? JSON.parse(raw) : null;
    }
    const f = file();
    if (!f.exists) return null;
    const s = JSON.parse(await f.text());
    return s?.v === 2 ? s : null;
  } catch {
    return null;
  }
}

export async function writeSnapshot(snapshot) {
  try {
    const json = JSON.stringify(snapshot);
    if (Platform.OS === 'web') {
      await AsyncStorage.setItem(WEB_KEY, json);
      await writeMeta({ snapAt: Date.parse(snapshot.updatedAt ?? snapshot.generatedAt) || Date.now() });
      return;
    }
    const f = file();
    if (!f.exists) f.create();
    f.write(json);
    // Znacznik dla apki: zadanie w tle zapisało nowsze ceny niż te w pamięci.
    await writeMeta({ snapAt: Date.parse(snapshot.updatedAt ?? snapshot.generatedAt) || Date.now() });
  } catch {
    // brak miejsca albo zapis zablokowany: apka działa dalej na danych w pamięci
  }
}

// Kiedy ostatnio pełne sprawdzenie na telefonie i pobranie zestawienia z GitHub.
export async function readMeta() {
  try {
    return JSON.parse((await AsyncStorage.getItem(META_KEY)) ?? '{}');
  } catch {
    return {};
  }
}

export async function writeMeta(patch) {
  const next = { ...(await readMeta()), ...patch };
  await AsyncStorage.setItem(META_KEY, JSON.stringify(next)).catch(() => {});
  return next;
}

// Historia cen (core/history.js): osobny plik, wczytywany dopiero w karcie modelu.
const HIST_FILE = 'lighttokenz-history-v1.json';
const HIST_WEB_KEY = 'lighttokenz:history:v1';

export async function readHistory() {
  try {
    if (Platform.OS === 'web') {
      const raw = await AsyncStorage.getItem(HIST_WEB_KEY);
      return raw ? JSON.parse(raw) : null;
    }
    const f = new File(Paths.document, HIST_FILE);
    return f.exists ? JSON.parse(await f.text()) : null;
  } catch {
    return null;
  }
}

export async function writeHistory(history) {
  try {
    const json = JSON.stringify(history);
    if (Platform.OS === 'web') return await AsyncStorage.setItem(HIST_WEB_KEY, json);
    const f = new File(Paths.document, HIST_FILE);
    if (!f.exists) f.create();
    f.write(json);
  } catch {
    // brak miejsca: historia poczeka do następnego zapisu
  }
}
