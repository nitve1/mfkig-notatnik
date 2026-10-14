// Powiadomienia lokalne: porównanie cen z listą obserwowanych, bez serwera push.
// W tle: expo-background-task (system uruchamia zadanie co ~30+ min, gdy uzna za stosowne).
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import * as BackgroundTask from 'expo-background-task';
import { ALERT_QUIET_MS, computeAlerts } from '../../core/pricing.js';
import { setLanguage, t as tr } from '../../core/i18n.js';
import { deviceLanguage } from './lang';
import { compareFilter } from './filters';
import { refreshPrices } from './data';
import { flushProfile, mergeAlerts, readProfile, writeProfile } from './profile';

export const TASK = 'tanitoken-price-check';
const PREF = { 'promo-start': 'promoStart', 'promo-end': 'promoEnd', 'promo-aging': 'aging', cheaper: 'cheaper', expires: 'expires' };
const MAX_PER_RUN = 4;

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
});


const sentRecently = (iso, now) => iso && now - Date.parse(iso) < ALERT_QUIET_MS;

export function newAlerts(snapshot, profile, now = Date.now()) {
  if (!snapshot || !profile) return [];
  return computeAlerts(snapshot, profile.watchlist, profile.usage, { filter: compareFilter(profile) }).filter(
    (a) => !sentRecently(profile.sent[a.id], now) && profile.notify[PREF[a.kind]] !== false,
  );
}

// Jeden przebieg alertów naraz (apka i zadanie w tle działają w tym samym środowisku JS).
let running = null;

// Liczy alerty na świeżym profilu z dysku, NAJPIERW zapisuje je jako wysłane, potem pokazuje powiadomienia,
// więc dwa przebiegi (apka + tło, dwa zestawienia) nie wyślą tego samego dwa razy. Zwraca zapisany profil.
export function runAlerts(snapshot) {
  if (running) return running;
  running = (async () => {
    await flushProfile();
    const profile = await readProfile();
    if (!profile.onboarded || !profile.watchlist.length) return null;
    const fresh = newAlerts(snapshot, profile);
    if (!fresh.length) return null;
    const now = new Date().toISOString();
    const sent = { ...profile.sent };
    for (const a of fresh) sent[a.id] = now;
    const saved = await writeProfile({ ...profile, sent, alerts: mergeAlerts(fresh.map((a) => ({ ...a, at: now })), profile.alerts) });
    if (profile.notify.enabled) await showNotifications(fresh);
    return saved;
  })().finally(() => { running = null; });
  return running;
}

async function showNotifications(fresh) {
  const sorted = [...fresh].sort((a, b) => (b.urgent ? 1 : 0) - (a.urgent ? 1 : 0));
  for (const a of sorted.slice(0, MAX_PER_RUN)) {
    await Notifications.scheduleNotificationAsync({
      content: { title: a.title, body: a.body, data: { modelId: a.modelId } },
      trigger: Platform.OS === 'android' ? { channelId: a.urgent ? 'urgent' : 'deals' } : null,
    }).catch(() => {});
  }
  if (sorted.length > MAX_PER_RUN) {
    await Notifications.scheduleNotificationAsync({
      content: { title: tr('notif.more', { n: sorted.length - MAX_PER_RUN }), body: tr('notif.moreBody') },
      trigger: Platform.OS === 'android' ? { channelId: 'deals' } : null,
    }).catch(() => {});
  }
}

TaskManager.defineTask(TASK, async () => {
  try {
    const profile = await readProfile();
    setLanguage(deviceLanguage(profile.language));
    if (!profile.notify.enabled || !profile.watchlist.length) return BackgroundTask.BackgroundTaskResult.Success;
    // Ceny obserwowanych modeli (kilka zapytań), a co 30 min pełne sprawdzenie, jeśli wolno (Wi-Fi).
    const { snapshot } = await refreshPrices(null, {
      wifiOnly: profile.refresh?.wifiOnly,
      watchIds: profile.watchlist.map((w) => w.modelId),
    });
    await runAlerts(snapshot);
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

export async function enableNotifications() {
  try {
    return await enableNotificationsUnsafe();
  } catch {
    return false; // np. podgląd web bez powiadomień
  }
}

async function ensureChannels() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('urgent', {
      name: tr('alert.end'),
      description: tr('notif.channelUrgent'),
      importance: Notifications.AndroidImportance.HIGH,
    });
    await Notifications.setNotificationChannelAsync('deals', {
      name: tr('notif.channelDeals'),
      description: tr('notif.channelDealsBody'),
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
}

async function ensureTask() {
  try {
    if (!(await TaskManager.isTaskRegisteredAsync(TASK))) await BackgroundTask.registerTaskAsync(TASK, { minimumInterval: 30 });
  } catch {
    // np. Expo Go: tło niedostępne, alerty i tak sprawdzamy przy każdym otwarciu apki
  }
}

// Przy starcie: "włączone" w profilu musi oznaczać prawdziwą zgodę systemu, kanały i zadanie w tle
// (po przywróceniu kopii, imporcie profilu albo cofnięciu zgody w ustawieniach telefonu bywa inaczej).
// Zwraca true, gdy powiadomienia działają.
export async function syncNotifications(enabled) {
  if (!enabled) return false;
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return false;
    await ensureChannels();
    await ensureTask();
    return true;
  } catch {
    return false;
  }
}

async function enableNotificationsUnsafe() {
  await ensureChannels();
  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') ({ status } = await Notifications.requestPermissionsAsync());
  if (status !== 'granted') return false;
  await ensureTask();
  return true;
}

export async function disableBackground() {
  try {
    if (await TaskManager.isTaskRegisteredAsync(TASK)) await BackgroundTask.unregisterTaskAsync(TASK);
  } catch {
    // brak zadania
  }
}
