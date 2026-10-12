import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, BackHandler, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import { useFonts } from 'expo-font';
import { Barlow_400Regular, Barlow_500Medium, Barlow_600SemiBold } from '@expo-google-fonts/barlow';
import { BarlowCondensed_600SemiBold, BarlowCondensed_700Bold } from '@expo-google-fonts/barlow-condensed';
import Svg, { Circle, Path } from 'react-native-svg';
import Deals from './src/screens/Deals';
import Search from './src/screens/Search';
import Mine from './src/screens/Mine';
import Profile from './src/screens/Profile';
import Model from './src/screens/Model';
import Intro from './src/screens/Intro';
import Onboarding from './src/screens/Onboarding';
import { Button, T } from './src/ui';
import { useSnapshot } from './src/data';
import { ProfileProvider, useProfile } from './src/profile';
import { checkAndNotify } from './src/alerts';
import { space, useTheme } from './src/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

function Icon({ name, color }) {
  const p = { stroke: color, strokeWidth: 2, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' };
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24">
      {name === 'deals' ? (<><Path d="M3 8.5 8.5 3H21v18H8.5L3 15.5z" {...p} /><Circle cx={8.5} cy={12} r={1.6} {...p} /></>) : null}
      {name === 'search' ? (<><Circle cx={10.5} cy={10.5} r={6.5} {...p} /><Path d="m15.5 15.5 5 5" {...p} /></>) : null}
      {name === 'mine' ? <Path d="m12 3 2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 16.8l-5.4 2.9 1.1-6.1-4.5-4.2 6.1-.8z" {...p} /> : null}
      {name === 'profile' ? (<><Circle cx={12} cy={8} r={4} {...p} /><Path d="M4 21c1.2-4 4.3-6 8-6s6.8 2 8 6" {...p} /></>) : null}
    </Svg>
  );
}

const TABS = [
  { key: 'deals', label: 'Promocje' },
  { key: 'search', label: 'Szukaj' },
  { key: 'mine', label: 'Moje' },
  { key: 'profile', label: 'Profil' },
];

function TabBar({ tab, onChange, bottom, badge }) {
  const t = useTheme();
  return (
    <View style={[s.tabbar, { backgroundColor: t.sheet, borderTopColor: t.rule, paddingBottom: bottom + 6 }]} accessibilityRole="tablist">
      {TABS.map((x) => {
        const on = x.key === tab;
        const color = on ? t.ink : t.ink3;
        return (
          <Pressable key={x.key} onPress={() => onChange(x.key)} style={s.tab} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={x.label}>
            <View>
              <Icon name={x.key} color={color} />
              {x.key === 'mine' && badge ? <View style={[s.badge, { backgroundColor: t.promo }]} /> : null}
            </View>
            <T kind="tiny" style={{ color }}>{x.label}</T>
            <View style={[s.tabMark, { backgroundColor: on ? t.tag : 'transparent' }]} />
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
  const [seenAlerts, setSeenAlerts] = useState(0);
  const ready = profile && snapshot;

  useEffect(() => {
    if (profile) SplashScreen.hideAsync().catch(() => {});
  }, [profile]);

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

  let body = null;
  if (!profile || (!snapshot && !error)) {
    body = <View style={s.center}><ActivityIndicator color={t.ink} size="large" /></View>;
  } else if (!snapshot) {
    body = (
      <View style={[s.center, { padding: space[5] }]}>
        <T kind="h2" style={{ textAlign: 'center' }}>Nie udało się pobrać cen</T>
        <T color="ink2" style={{ textAlign: 'center', marginVertical: space[3] }}>Sprawdź połączenie z internetem. Szczegóły: {error}</T>
        <Button label="Spróbuj ponownie" onPress={refresh} />
      </View>
    );
  } else if (!profile.onboarded) {
    return (
      <View style={{ flex: 1, backgroundColor: t.paper }}>
        <StatusBar style={t.dark ? 'light' : 'dark'} />
        <Onboarding snapshot={snapshot} insets={insets} />
        {intro ? <Intro onDone={() => setIntro(false)} /> : null}
      </View>
    );
  } else {
    const model = openId ? snapshot.models.find((m) => m.id === openId) : null;
    const common = { snapshot, refreshing, onRefresh: refresh, onOpen: setOpenId };
    if (model) body = <Model key={model.id} model={model} snapshot={snapshot} onBack={() => setOpenId(null)} />;
    else if (tab === 'deals') body = <Deals {...common} />;
    else if (tab === 'search') body = <Search {...common} />;
    else if (tab === 'mine') body = <Mine {...common} onGoSearch={() => changeTab('search')} onGoProfile={() => changeTab('profile')} />;
    else body = <Profile snapshot={snapshot} />;
  }

  return (
    <View style={[s.root, { backgroundColor: t.paper, paddingTop: insets.top }]}>
      <StatusBar style={t.dark ? 'light' : 'dark'} />
      <View style={{ flex: 1 }}>{body}</View>
      {ready && profile.onboarded ? (
        <TabBar tab={tab} onChange={changeTab} bottom={insets.bottom} badge={(profile.alerts.length ?? 0) > seenAlerts && tab !== 'mine'} />
      ) : null}
      {intro && profile ? <Intro onDone={() => setIntro(false)} /> : null}
    </View>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    Barlow_400Regular, Barlow_500Medium, Barlow_600SemiBold, BarlowCondensed_600SemiBold, BarlowCondensed_700Bold,
  });
  if (!fontsLoaded) return null;
  return (
    <SafeAreaProvider>
      <ProfileProvider>
        <Main />
      </ProfileProvider>
    </SafeAreaProvider>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tabbar: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 8 },
  tab: { flex: 1, alignItems: 'center', gap: 2 },
  tabMark: { width: 22, height: 3, borderRadius: 2, marginTop: 3 },
  badge: { position: 'absolute', right: -3, top: -2, width: 9, height: 9, borderRadius: 5 },
});
