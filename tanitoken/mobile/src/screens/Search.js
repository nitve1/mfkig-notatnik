import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { CATEGORIES, cheapest, formatContext, formatOfferPrice, searchModels, unitPrice } from '../../../core/pricing.js';
import { Empty, Row, Segmented, T } from '../ui';
import { Header, catsText } from '../parts';
import { font, radius, space, useTheme } from '../theme';
import { useProfile } from '../profile';

const SORTS = [
  { value: 'new', label: 'Najnowsze' },
  { value: 'cheap', label: 'Najtańsze' },
  { value: 'offers', label: 'Najwięcej ofert' },
];

export default function Search({ snapshot, onOpen }) {
  const t = useTheme();
  const { profile } = useProfile();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState(profile.cats.length === 1 ? profile.cats[0] : 'all');
  const [sort, setSort] = useState('new');
  const watched = useMemo(() => new Set(profile.watchlist.map((w) => w.modelId)), [profile.watchlist]);
  const favs = profile.onlyFavorites && profile.providers.length ? new Set(profile.providers) : null;

  const rows = useMemo(() => {
    let models = snapshot.models.filter((m) => cat === 'all' || m.cats.includes(cat));
    models = searchModels(models, q).map((m) => {
      const best = cheapest(m, profile.usage, favs ? (o) => favs.has(o.provider) : null);
      const promo = Math.max(0, ...m.offers.map((o) => o.discount ?? 0));
      return { m, best, promo };
    });
    if (favs) models = models.filter((r) => r.best || r.m.freeId);
    if (!q.trim()) {
      if (sort === 'cheap') models.sort((a, b) => (unitPrice(a.best) ?? Infinity) - (unitPrice(b.best) ?? Infinity));
      if (sort === 'offers') models.sort((a, b) => b.m.offers.length - a.m.offers.length);
    }
    return models;
  }, [snapshot, q, cat, sort, profile.usage, favs]);

  return (
    <FlatList
      data={rows}
      keyExtractor={(r) => r.m.id}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      contentContainerStyle={{ padding: space[4], paddingBottom: space[6] }}
      initialNumToRender={20}
      ListHeaderComponent={
        <View style={{ gap: space[3], marginBottom: space[2] }}>
          <Header title="Szukaj" sub={`${snapshot.models.length} modeli u wielu dostawców`} />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="np. deepseek, claude, flux, veo"
            placeholderTextColor={t.ink3}
            autoCorrect={false}
            autoCapitalize="none"
            clearButtonMode="while-editing"
            returnKeyType="search"
            accessibilityLabel="Szukaj modelu"
            style={[s.input, { backgroundColor: t.sheet, borderColor: t.ink, color: t.ink }]}
          />
          <Segmented options={CATEGORIES.map((c) => ({ value: c.key, label: c.label }))} value={cat} onChange={setCat} />
          {!q.trim() ? <Segmented options={SORTS} value={sort} onChange={setSort} /> : null}
        </View>
      }
      ListEmptyComponent={<Empty title="Nie znaleźliśmy takiego modelu" body="Spróbuj krótszej nazwy albo innej kategorii." />}
      renderItem={({ item: { m, best, promo } }) => (
        <Pressable
          onPress={() => onOpen(m.id)}
          accessibilityRole="button"
          style={({ pressed }) => [s.row, { borderBottomColor: t.rule, backgroundColor: pressed ? t.sheet : 'transparent' }]}
        >
          <View style={{ flex: 1, gap: 2 }}>
            <T kind="strong" numberOfLines={1}>
              {watched.has(m.id) ? <T kind="strong" style={{ color: t.ink3 }}>★ </T> : null}
              {m.name}
            </T>
            <T kind="small" color="ink3" numberOfLines={1}>
              {[catsText(m), m.context ? `kontekst ${formatContext(m.context)}` : null, `${m.offers.length} ofert`].filter(Boolean).join(', ')}
            </T>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 2, maxWidth: '45%' }}>
            <T kind="price" style={{ fontSize: 18 }} numberOfLines={1}>
              {best ? formatOfferPrice(best) : m.freeId ? '0 $' : '–'}
            </T>
            <Row style={{ gap: 6 }}>
              {promo > 0 ? <T kind="tiny" style={{ color: t.promo }}>−{Math.round(promo * 100)}%</T> : null}
              <T kind="tiny" color="ink3" numberOfLines={1}>{best ? best.provider : m.freeId ? 'darmowy' : ''}</T>
            </Row>
          </View>
        </Pressable>
      )}
    />
  );
}

const s = StyleSheet.create({
  input: { borderWidth: 1.5, borderRadius: radius.ui, paddingHorizontal: 14, paddingVertical: 12, fontSize: 17, fontFamily: font.textMedium },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[3], paddingVertical: space[3], paddingHorizontal: space[1], borderBottomWidth: StyleSheet.hairlineWidth },
});
