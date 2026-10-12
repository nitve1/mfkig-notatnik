// Powiadomienia lokalne: porównanie cen z listą obserwowanych, bez serwera push.
// W tle: expo-background-task (system uruchamia zadanie co ~30+ min, gdy uzna za stosowne).
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import * as BackgroundTask from 'expo-background-task';
import { computeAlerts } from '../../core/pricing.js';
import { fetchSnapshot } from './data';
import { readProfile, writeProfile } from './profile';

export const TASK = 'tanitoken-price-check';
const PREF = { 'promo-start': 'promoStart', 'promo-end': 'promoEnd', 'promo-aging': 'aging', cheaper: 'cheaper', expires: 'expires' };
const MAX_PER_RUN = 4;

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
});

// Przy ustawionych ulubionych dostawcach porównujemy ceny tylko z nimi.
export function favoritesFilter(profile) {
  if (!profile?.providers?.length) return null;
  const favs = new Set(profile.providers);
  return (o) => favs.has(o.provider);
}

export function newAlerts(snapshot, profile) {
  if (!snapshot || !profile) return [];
  return computeAlerts(snapshot, profile.watchlist, profile.usage, { filter: favoritesFilter(profile) }).filter(
    (a) => !profile.sent[a.id] && profile.notify[PREF[a.kind]] !== false,
  );
}

// Zwraca profil z dopisanymi alertami; powiadomienia systemowe tylko gdy włączone.
export async function checkAndNotify(snapshot, profile) {
  const fresh = newAlerts(snapshot, profile);
  if (!fresh.length) return profile;
  const now = new Date().toISOString();
  if (profile.notify.enabled) {
    const sorted = [...fresh].sort((a, b) => (b.urgent ? 1 : 0) - (a.urgent ? 1 : 0));
    for (const a of sorted.slice(0, MAX_PER_RUN)) {
      await Notifications.scheduleNotificationAsync({
        content: { title: a.title, body: a.body, data: { modelId: a.modelId } },
        trigger: Platform.OS === 'android' ? { channelId: a.urgent ? 'urgent' : 'deals' } : null,
      }).catch(() => {});
    }
    if (sorted.length > MAX_PER_RUN) {
      await Notifications.scheduleNotificationAsync({
        content: { title: `Jeszcze ${sorted.length - MAX_PER_RUN} zmian cen`, body: 'Otwórz zakładkę Moje, żeby zobaczyć wszystkie.' },
        trigger: Platform.OS === 'android' ? { channelId: 'deals' } : null,
      }).catch(() => {});
    }
  }
  const sent = { ...profile.sent };
  for (const a of fresh) sent[a.id] = now;
  return { ...profile, sent, alerts: [...fresh.map((a) => ({ ...a, at: now })), ...profile.alerts].slice(0, 50) };
}

TaskManager.defineTask(TASK, async () => {
  try {
    const profile = await readProfile();
    if (!profile.notify.enabled || !profile.watchlist.length) return BackgroundTask.BackgroundTaskResult.Success;
    const snapshot = await fetchSnapshot();
    const next = await checkAndNotify(snapshot, profile);
    if (next !== profile) await writeProfile(next);
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

export async function enableNotifications() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('urgent', {
      name: 'Koniec promocji',
      description: 'Promocja na model, którego używasz, kończy się albo skończyła.',
      importance: Notifications.AndroidImportance.HIGH,
    });
    await Notifications.setNotificationChannelAsync('deals', {
      name: 'Nowe okazje',
      description: 'Zniżki i tańsze oferty na obserwowane modele.',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') ({ status } = await Notifications.requestPermissionsAsync());
  if (status !== 'granted') return false;
  try {
    await BackgroundTask.registerTaskAsync(TASK, { minimumInterval: 30 });
  } catch {
    // np. Expo Go: tło niedostępne, alerty i tak sprawdzamy przy każdym otwarciu apki
  }
  return true;
}

export async function disableBackground() {
  try {
    if (await TaskManager.isTaskRegisteredAsync(TASK)) await BackgroundTask.unregisterTaskAsync(TASK);
  } catch {
    // brak zadania
  }
}
