import { useEffect, useState } from 'react';
import { ActivityIndicator, BackHandler, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import DealsScreen from './src/DealsScreen';
import ModelsScreen from './src/ModelsScreen';
import ModelScreen from './src/ModelScreen';
import { TabBar } from './src/components';
import { useFavorites, useSnapshot } from './src/data';
import { useTheme } from './src/theme';

function Main() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { snapshot, error, refreshing, refresh } = useSnapshot();
  const { favorites, toggle } = useFavorites();
  const [tab, setTab] = useState('deals');
  const [openId, setOpenId] = useState(null);

  // Androidowy przycisk "wstecz" zamyka szczegóły modelu.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!openId) return false;
      setOpenId(null);
      return true;
    });
    return () => sub.remove();
  }, [openId]);

  const model = openId && snapshot?.models.find((m) => m.id === openId);
  const common = { snapshot, refreshing, onRefresh: refresh, onOpen: setOpenId };

  let body;
  if (!snapshot) {
    body = (
      <View style={s.center}>
        {error ? (
          <>
            <Text style={{ color: t.text, marginBottom: 12 }}>Nie udało się pobrać cen: {error}</Text>
            <Pressable onPress={refresh} style={[s.btn, { backgroundColor: t.accent }]}>
              <Text style={{ color: t.accentInk, fontWeight: '700' }}>Spróbuj ponownie</Text>
            </Pressable>
          </>
        ) : (
          <ActivityIndicator color={t.accent} size="large" />
        )}
      </View>
    );
  } else if (model) {
    body = (
      <ModelScreen
        model={model}
        onBack={() => setOpenId(null)}
        isFavorite={favorites.includes(model.id)}
        onToggleFavorite={() => toggle(model.id)}
      />
    );
  } else if (tab === 'deals') {
    body = <DealsScreen {...common} />;
  } else {
    body = <ModelsScreen {...common} favorites={favorites} onlyFavorites={tab === 'favorites'} />;
  }

  return (
    <View style={[s.root, { backgroundColor: t.bg, paddingTop: insets.top }]}>
      <StatusBar style={t.dark ? 'light' : 'dark'} />
      <View style={{ flex: 1 }}>{body}</View>
      <TabBar
        tab={tab}
        bottomInset={insets.bottom}
        onChange={(k) => {
          setOpenId(null);
          setTab(k);
        }}
      />
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <Main />
    </SafeAreaProvider>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  btn: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 999 },
});
