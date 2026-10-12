import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, BackHandler, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import { useFonts } from 'expo-font';
import { BricolageGrotesque_700Bold, BricolageGrotesque_800ExtraBold } from '@expo-google-fonts/bricolage-grotesque';
import { Figtree_400Regular, Figtree_500Medium, Figtree_600SemiBold, Figtree_700Bold } from '@expo-google-fonts/figtree';
import Deals from './src/screens/Deals';
import Search from './src/screens/Search';
import Mine from './src/screens/Mine';
import Profile from './src/screens/Profile';
import Model from './src/screens/Model';
import Intro from './src/screens/Intro';
import Onboarding from './src/screens/Onboarding';
import { Button, T } from './src/ui';
import Icon from './src/icons';
import { useSnapshot } from './src/data';
import { ProfileProvider, useProfile } from './src/profile';
import { checkAndNotify } from './src/alerts';
import { ThemeContext, space, useTheme } from './src/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

const TABS = [
  { key: 'deals', label: 'Promocje', icon: 'tag' },
  { key: 'search', label: 'Szukaj', icon: 'search' },
  { key: 'mine', label: 'Moje', icon: 'star' },
  { key: 'profile', label: 'Profil', icon: 'user' },
];

function TabBar({ tab, onChange, bottom, badge }) {
  const t = useTheme();
  return (
    <View style={[s.tabbar, { backgroundColor: t.card, borderTopColor: t.line, paddingBottom: bottom + 6 }]} accessibilityRole="tablist">
      {TABS.map((x) => {
        const on = x.key === tab;
        const color = on ? t.ink : t.ink3;
        return (
          <Pressable key={x.key} onPress={() => onChange(x.key)} style={s.tab} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={x.label}>
            <View style={[s.tabIcon, on && { backgroundColor: t.seg }]}>
              <Icon name={x.icon} size={22} color={color} width={on ? 2.3 : 2} />
              {x.key === 'mine' && badge ? <View style={[s.badge, { backgroundColor: t.deal, borderColor: t.card }]} /> : null}
            </View>
            <T kind="tiny" style={{ color }}>{x.label}</T>
          </Pressable>
        );
      })}
    </View>
  );
}

function Main() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { profile, update } = useProfile();
  const { snapshot, error, refreshing, refresh } = useSnapshot();
  const [intro, setIntro] = useState(true);
  const [tab, setTab] = useState('deals');
  const [openId, setOpenId] = useState(null);
  const [seenAlerts, setSeenAlerts] = useState(null);
  const ready = profile && snapshot;
  const endIntro = useCallback(() => setIntro(false), []);

  useEffect(() => {
    if (profile) SplashScreen.hideAsync().catch(() => {});
    if (profile && seenAlerts == null) setSeenAlerts(profile.alerts.length);
  }, [profile, seenAlerts]);

  // Alerty przy każdym nowym zestawieniu cen (w tle robi to zadanie z alerts.js).
  useEffect(() => {
    if (!ready || snapshot.partial || !profile.onboarded || !profile.watchlist.length) return;
    checkAndNotify(snapshot, profile).then((next) => {
      if (next !== profile) update((cur) => ({ ...cur, sent: next.sent, alerts: next.alerts }));
    });
  }, [snapshot?.generatedAt, profile?.watchlist, profile?.onboarded]); // eslint-disable-line react-hooks/exhaustive-deps

  // Dotknięcie powiadomienia otwiera model (także gdy apka startuje z powiadomienia).
  useEffect(() => {
    const open = (response) => {
      const id = response?.notification?.request?.content?.data?.modelId;
      if (id) {
        setTab('mine');
        setOpenId(id);
      }
    };
    let sub;
    try {
      Notifications.getLastNotificationResponseAsync().then(open).catch(() => {});
      sub = Notifications.addNotificationResponseReceivedListener(open);
    } catch {
      // platforma bez powiadomień (np. podgląd web)
    }
    return () => sub?.remove();
  }, []);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (openId) { setOpenId(null); return true; }
      if (tab !== 'deals') { setTab('deals'); return true; }
      return false;
    });
    return () => sub.remove();
  }, [openId, tab]);

  const changeTab = useCallback((k) => {
    setOpenId(null);
    setTab(k);
    if (k === 'mine') setSeenAlerts(profile?.alerts.length ?? 0);
  }, [profile?.alerts.length]);
  const newAlerts = (profile?.alerts.length ?? 0) > (seenAlerts ?? 0);

  const onboarding = !!(profile && snapshot && !profile.onboarded);
  let body = null;
  if (!profile || (!snapshot && !error)) {
    body = <View style={s.center}><ActivityIndicator color={t.text} size="large" /></View>;
  } else if (!snapshot) {
    body = (
      <View style={[s.center, { padding: space[5], gap: space[3] }]}>
        <T kind="h2" style={{ textAlign: 'center' }}>Nie udało się pobrać cen</T>
        <T color="ink2" style={{ textAlign: 'center' }}>Sprawdź połączenie z internetem i spróbuj ponownie.</T>
        <Button label="Spróbuj ponownie" onPress={refresh} style={{ flex: 0 }} />
      </View>
    );
  } else if (!profile.onboarded) {
    body = <Onboarding snapshot={snapshot} insets={insets} />;
  } else {
    const model = openId ? snapshot.models.find((m) => m.id === openId) : null;
    const common = { snapshot, refreshing, onRefresh: refresh, onOpen: setOpenId };
    if (model) body = <Model key={model.id} model={model} snapshot={snapshot} onBack={() => setOpenId(null)} />;
    else if (tab === 'deals') body = <Deals {...common} onBell={() => changeTab('mine')} bellDot={newAlerts} />;
    else if (tab === 'search') body = <Search {...common} />;
    else if (tab === 'mine') body = <Mine {...common} onGoSearch={() => changeTab('search')} onGoProfile={() => changeTab('profile')} />;
    else body = <Profile snapshot={snapshot} />;
  }

  return (
    <View style={[s.root, { backgroundColor: t.bg, paddingTop: onboarding ? 0 : insets.top }]}>
      <StatusBar style={t.dark ? 'light' : 'dark'} />
      {/* Stała kolumna: na telefonie pełna szerokość, na tablecie i w przeglądarce max 600 px pośrodku. */}
      <View style={s.column}>
        <View style={{ flex: 1 }}>{body}</View>
        {ready && profile.onboarded ? <TabBar tab={tab} onChange={changeTab} bottom={insets.bottom} badge={newAlerts && tab !== 'mine'} /> : null}
      </View>
      {intro && profile ? <Intro onDone={endIntro} /> : null}
    </View>
  );
}

function Themed() {
  const { profile } = useProfile();
  return (
    <ThemeContext.Provider value={profile?.theme ?? 'system'}>
      <Main />
    </ThemeContext.Provider>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    BricolageGrotesque_700Bold, BricolageGrotesque_800ExtraBold,
    Figtree_400Regular, Figtree_500Medium, Figtree_600SemiBold, Figtree_700Bold,
  });
  if (!fontsLoaded) return null;
  return (
    <SafeAreaProvider>
      <ProfileProvider>
        <Themed />
      </ProfileProvider>
    </SafeAreaProvider>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', overflow: 'hidden' },
  column: { flex: 1, width: '100%', maxWidth: 600 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tabbar: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 6 },
  tab: { flex: 1, alignItems: 'center', gap: 2 },
  tabIcon: { width: 56, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', right: 12, top: 2, width: 10, height: 10, borderRadius: 5, borderWidth: 2 },
});
