import { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { blended, cheapest, formatContext, formatUsd, searchModels } from '../../core/pricing.js';
import { Badge } from './components';
import { useTheme } from './theme';

const SORTS = { newest: 'Najnowsze', cheapest: 'Najtańsze' };

export default function ModelsScreen({ snapshot, refreshing, onRefresh, onOpen, favorites, onlyFavorites }) {
  const t = useTheme();
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('newest');

  const rows = useMemo(() => {
    let models = snapshot.models;
    if (onlyFavorites) models = models.filter((m) => favorites.includes(m.id));
    models = searchModels(models, query).map((m) => {
      const best = cheapest(m);
      return { model: m, best, price: best ? blended(best) : null, discount: Math.max(0, ...m.endpoints.map((e) => e.discount)) };
    });
    if (sort === 'cheapest') models.sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));
    return models;
  }, [snapshot, query, sort, favorites, onlyFavorites]);

  return (
    <FlatList
      data={rows}
      keyExtractor={(r) => r.model.id}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={s.list}
      initialNumToRender={20}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.accent} colors={[t.accent]} />}
      ListHeaderComponent={
        <View>
          <Text style={[s.h1, { color: t.text }]}>{onlyFavorites ? 'Ulubione' : 'Modele'}</Text>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Szukaj: deepseek, claude, llama…"
            placeholderTextColor={t.muted}
            autoCorrect={false}
            autoCapitalize="none"
            clearButtonMode="while-editing"
            style={[s.input, { backgroundColor: t.surface, borderColor: t.line, color: t.text }]}
          />
          <View style={s.sorts}>
            {Object.entries(SORTS).map(([k, label]) => (
              <Pressable key={k} onPress={() => setSort(k)}>
                <Text style={{ color: sort === k ? t.accent : t.muted, fontWeight: '700' }}>{label}</Text>
              </Pressable>
            ))}
            <Text style={{ color: t.muted, marginLeft: 'auto', fontSize: 12 }}>cena mieszana 3:1 / 1M</Text>
          </View>
        </View>
      }
      ListEmptyComponent={
        <Text style={{ color: t.muted, paddingVertical: 24 }}>
          {onlyFavorites && !favorites.length ? 'Dodaj modele gwiazdką na ich stronie.' : 'Nic nie znaleziono.'}
        </Text>
      }
      renderItem={({ item: { model, best, price, discount } }) => (
        <Pressable
          onPress={() => onOpen(model.id)}
          style={({ pressed }) => [s.row, { borderBottomColor: t.line, backgroundColor: pressed ? t.surface2 : 'transparent' }]}
        >
          <View style={{ flex: 1 }}>
            <Text style={{ color: t.text, fontWeight: '600', fontSize: 15 }} numberOfLines={1}>
              {model.name}
            </Text>
            <Text style={{ color: t.muted, fontSize: 12 }} numberOfLines={1}>
              {best ? best.provider : '—'} · {formatContext(model.context)} · {model.endpoints.length} ofert
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 3 }}>
            <Text style={{ color: t.text, fontWeight: '700', fontVariant: ['tabular-nums'] }}>
              {price != null ? formatUsd(price) : model.freeId ? '0 $' : '—'}
            </Text>
            {discount > 0 ? <Badge label={`−${Math.round(discount * 100)}%`} /> : model.freeId ? <Badge label="FREE" tone="gold" /> : null}
          </View>
        </Pressable>
      )}
    />
  );
}

const s = StyleSheet.create({
  list: { padding: 16, paddingBottom: 24 },
  h1: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5, marginBottom: 12 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  sorts: { flexDirection: 'row', gap: 16, alignItems: 'center', marginVertical: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 4, borderBottomWidth: StyleSheet.hairlineWidth },
});
