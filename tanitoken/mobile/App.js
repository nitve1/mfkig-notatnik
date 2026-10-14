import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, LayoutAnimation, Platform, Pressable, StyleSheet, UIManager, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import { useFonts } from 'expo-font';
import { Archivo_400Regular, Archivo_500Medium, Archivo_600SemiBold, Archivo_700Bold, Archivo_800ExtraBold } from '@expo-google-fonts/archivo';
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
import { runAlerts, syncNotifications } from './src/alerts';
import { mergeAlerts } from './src/profile';
import { BottomSpaceContext, ThemeContext, font, radius, space, useTheme } from './src/theme';
import { Backdrop, BlurTargetView, Glass } from './src/glass';
import { setLanguage, t as tr } from '../core/i18n.js';
import { deviceLanguage } from './src/lang';

SplashScreen.preventAutoHideAsync().catch(() => {});
UIManager.setLayoutAnimationEnabledExperimental?.(true);

// Płynne przejście zakładki w pasku (rozwinięcie aktywnej, zwinięcie poprzedniej).
const TAB_ANIM = LayoutAnimation.create(240, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity);
const WEB_TRANSITION = Platform.OS === 'web' ? { transitionProperty: 'flex-grow, width, background-color', transitionDuration: '240ms', transitionTimingFunction: 'ease-in-out' } : null;

const TABS = [
  { key: 'deals', icon: 'tag' },
  { key: 'search', icon: 'search' },
  { key: 'mine', icon: 'star' },
  { key: 'profile', icon: 'user' },
];

// Pływający, kompaktowy pasek zakładek ze szkła: nieaktywne to same ikony, aktywna rozwija się
// w prostokąt z ikoną i nazwą. Lista przewija się pod nim i prześwituje.
const TABBAR_H = 60;

function TabBar({ tab, onChange, badge }) {
  const t = useTheme();
  return (
    <View style={s.tabbar} accessibilityRole="tablist">
      {TABS.map((x) => {
        const on = x.key === tab;
        const color = on ? t.ink : t.ink2;
        return (
          <Pressable
            key={x.key}
            onPress={() => { if (!on) LayoutAnimation.configureNext(TAB_ANIM); onChange(x.key); }}
            style={[s.tab, WEB_TRANSITION, on ? [s.tabOn, { backgroundColor: t.glassActive }] : s.tabOff]}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={tr(`nav.${x.key}`)}
          >
            <View>
              <Icon name={x.icon} size={22} color={color} width={on ? 2.3 : 2} />
              {x.key === 'mine' && badge ? <View style={[s.badge, { backgroundColor: t.deal, borderColor: t.cardSolid }]} /> : null}
            </View>
            {on ? <T kind="strong" numberOfLines={1} style={{ color, fontFamily: font.textBold, flexShrink: 1 }}>{tr(`nav.${x.key}`)}</T> : null}
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
  const watchIds = useMemo(() => profile?.watchlist.map((w) => w.modelId) ?? [], [profile?.watchlist]);
  const { snapshot, error, refreshing, progress, meta, refresh } = useSnapshot({ wifiOnly: profile?.refresh?.wifiOnly, watchIds });
  const priceStatus = { refreshing, progress, meta, error };
  const [intro, setIntro] = useState(true);
  const [tab, setTab] = useState('deals');
  const [openId, setOpenId] = useState(null);
  const blurTarget = useRef(null);
  const ready = profile && snapshot;
  const endIntro = useCallback(() => setIntro(false), []);

  useEffect(() => {
    if (profile) SplashScreen.hideAsync().catch(() => {});
  }, [profile]);

  // Raz po starcie: "powiadomienia włączone" musi oznaczać zgodę systemu, kanały i zadanie w tle.
  const synced = useRef(false);
  useEffect(() => {
    if (!profile || synced.current) return;
    synced.current = true;
    if (!profile.notify.enabled) return;
    syncNotifications(true).then((ok) => {
      if (!ok) update((cur) => ({ ...cur, notify: { ...cur.notify, enabled: false } }));
    });
  }, [profile]); // eslint-disable-line react-hooks/exhaustive-deps

  // Alerty przy każdej zmianie cen (także po odświeżeniu samych obserwowanych); w tle robi to zadanie z alerts.js.
  const priceStamp = snapshot?.updatedAt ?? snapshot?.generatedAt;
  useEffect(() => {
    if (!ready || !profile.onboarded || !profile.watchlist.length) return;
    runAlerts(snapshot).then((saved) => {
      if (saved) update((cur) => ({ ...cur, sent: { ...cur.sent, ...saved.sent }, alerts: mergeAlerts(saved.alerts, cur.alerts) }));
    });
  }, [priceStamp, profile?.watchlist, profile?.onboarded]); // eslint-disable-line react-hooks/exhaustive-deps


  // Dotknięcie powiadomienia otwiera model (także gdy apka startuje z powiadomienia).
  useEffect(() => {
    const open = (response) => {
      const id = response?.notification?.request?.content?.data?.modelId;
      if (id) {
        setTab('mine');
        setOpenId(id);
        Notifications.clearLastNotificationResponseAsync?.().catch(() => {});
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

  // Model z powiadomienia, którego nie ma w zestawieniu: nie trzymamy go "otwartego" (Wstecz nie znika w próżni).
  useEffect(() => {
    if (openId && snapshot && !snapshot.models.some((m) => m.id === openId)) setOpenId(null);
  }, [openId, snapshot]);

  const changeTab = useCallback((k) => {
    setOpenId(null);
    setTab(k);
    if (k === 'mine') update({ alertsSeenAt: new Date().toISOString() });
  }, [update]);
  // Kropka: najnowszy alert jest nowszy niż ostatnie wejście do Moje (działa też dla alertów z tła i po limicie 50).
  const newAlerts = !!profile?.alerts[0]?.at && profile.alerts[0].at > (profile.alertsSeenAt ?? '');

  const onboarding = !!(profile && snapshot && !profile.onboarded);
  let body = null;
  if (!profile || (!snapshot && !error)) {
    body = <View style={s.center}><ActivityIndicator color={t.text} size="large" /></View>;
  } else if (!snapshot) {
    body = (
      <View style={[s.center, { padding: space[5], gap: space[3] }]}>
        <T kind="h2" style={{ textAlign: 'center' }}>{tr('app.loadFailed')}</T>
        <T color="ink2" style={{ textAlign: 'center' }}>{tr('app.loadFailedBody')}</T>
        <Button label={tr('app.retry')} onPress={refresh} style={{ flex: 0 }} />
      </View>
    );
  } else if (!profile.onboarded) {
    body = <Onboarding snapshot={snapshot} insets={insets} />;
  } else {
    const model = openId ? snapshot.models.find((m) => m.id === openId) : null;
    const common = { snapshot, refreshing, onRefresh: refresh, onOpen: setOpenId, priceStatus };
    let screen;
    if (tab === 'deals') screen = <Deals {...common} onBell={() => changeTab('mine')} bellDot={newAlerts} />;
    else if (tab === 'search') screen = <Search {...common} />;
    else if (tab === 'mine') screen = <Mine {...common} onGoSearch={() => changeTab('search')} onGoProfile={() => changeTab('profile')} />;
    else screen = <Profile snapshot={snapshot} priceStatus={priceStatus} onRefresh={refresh} />;
    // Karta modelu leży nad listą, a lista zostaje zamontowana: powrót wraca do tego samego
    // widoku (typ, kategoria, przewinięcie), a nie do domyślnych "Promocji".
    body = (
      <>
        <View style={{ flex: 1, display: model ? 'none' : 'flex' }}>{screen}</View>
        {model ? <Model key={model.id} model={model} snapshot={snapshot} onBack={() => setOpenId(null)} /> : null}
      </>
    );
  }

  // Ekran powitalny to pierwszy pełny ekran po otwarciu, bez paska zakładek pod spodem.
  if (intro && profile) {
    return (
      <View style={[s.full, { backgroundColor: t.bg }]}>
        <StatusBar style="light" />
        <Intro onDone={endIntro} />
      </View>
    );
  }

  const showTabs = !!(ready && profile.onboarded);
  const tabGap = insets.bottom + 10;
  return (
    <View style={[s.root, { backgroundColor: t.bg, paddingTop: onboarding ? 0 : insets.top }]}>
      <StatusBar style="light" />
      {/* Stała kolumna: na telefonie pełna szerokość, na tablecie i w przeglądarce max 600 px pośrodku. */}
      <View style={s.column}>
        <BottomSpaceContext.Provider value={showTabs ? TABBAR_H + tabGap + space[5] : space[7]}>
          <BlurTargetView ref={blurTarget} style={{ flex: 1, backgroundColor: t.bg }}>
            <Backdrop />
            {body}
          </BlurTargetView>
        </BottomSpaceContext.Provider>
        {showTabs ? (
          <Glass blurTarget={blurTarget} radius={radius.xl} style={[s.floating, { bottom: tabGap }]}>
            <TabBar tab={tab} onChange={changeTab} badge={newAlerts && tab !== 'mine'} />
          </Glass>
        ) : null}
      </View>
    </View>
  );
}

function Themed() {
  const { profile } = useProfile();
  // Język ustawiamy przed renderem całego drzewa; zmiana w Profilu przerysowuje wszystko.
  setLanguage(deviceLanguage(profile?.language));
  return (
    <ThemeContext.Provider value={profile?.theme ?? 'system'}>
      <Main />
    </ThemeContext.Provider>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    Archivo_400Regular, Archivo_500Medium, Archivo_600SemiBold, Archivo_700Bold, Archivo_800ExtraBold,
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
  full: { flex: 1 },
  column: { flex: 1, width: '100%', maxWidth: 600 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  floating: { position: 'absolute', left: space[4], right: space[4], height: TABBAR_H },
  // Pasek: promień 18, odstęp 4, więc zakładka ma 14 jak karty i kafle (łuki równoległe).
  tabbar: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4, padding: 4 },
  tab: { height: TABBAR_H - 8, borderRadius: radius.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  tabOn: { flexGrow: 1, flexShrink: 1, flexBasis: 0, paddingHorizontal: 12 },
  tabOff: { width: 58, flexGrow: 0, flexShrink: 0 },
  badge: { position: 'absolute', right: -4, top: -3, width: 10, height: 10, borderRadius: 5, borderWidth: 2 },
});
