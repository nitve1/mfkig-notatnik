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
      return;
    }
    const f = file();
    if (!f.exists) f.create();
    f.write(json);
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
