import { useMemo, useState } from 'react';
import { FlatList, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { collectDeals, timeAgo } from '../../core/pricing.js';
import { Chip, DealCard } from './components';
import { useTheme } from './theme';

const FILTERS = [
  { key: 'discount', label: 'Zniżki' },
  { key: 'drop', label: 'Obniżki cen' },
  { key: 'free', label: 'Darmowe' },
];

export default function DealsScreen({ snapshot, refreshing, onRefresh, onOpen }) {
  const t = useTheme();
  const [filter, setFilter] = useState('discount');
  const deals = useMemo(() => collectDeals(snapshot), [snapshot]);
  const list = useMemo(() => deals.filter((d) => d.type === filter), [deals, filter]);
  const counts = useMemo(
    () => Object.fromEntries(FILTERS.map((f) => [f.key, deals.filter((d) => d.type === f.key).length])),
    [deals],
  );

  return (
    <FlatList
      data={list}
      keyExtractor={(d) => `${d.type}|${d.model.id}|${d.endpoint?.tag ?? d.endpoint?.provider ?? ''}`}
      renderItem={({ item }) => <DealCard deal={item} onPress={() => onOpen(item.model.id)} />}
      contentContainerStyle={s.list}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.accent} colors={[t.accent]} />}
      initialNumToRender={12}
      ListHeaderComponent={
        <View>
          <Text style={[s.h1, { color: t.text }]}>Gdzie dziś najtaniej?</Text>
          <Text style={{ color: t.muted, marginBottom: 14 }}>
            ● {snapshot.partial ? 'ceny bazowe na żywo' : `ceny z ${timeAgo(snapshot.generatedAt)}`} · {snapshot.models.length} modeli
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
            {FILTERS.map((f) => (
              <Chip key={f.key} label={`${f.label} ${counts[f.key]}`} active={filter === f.key} onPress={() => setFilter(f.key)} />
            ))}
          </ScrollView>
        </View>
      }
      ListEmptyComponent={
        <Text style={{ color: t.muted, paddingVertical: 24 }}>
          {filter === 'drop' ? 'Brak obniżek w ostatnich 7 dniach.' : 'Brak pozycji.'}
        </Text>
      }
    />
  );
}

const s = StyleSheet.create({
  list: { padding: 16, paddingBottom: 24 },
  h1: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5, marginBottom: 4 },
});
