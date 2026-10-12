import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, TextInput, View } from 'react-native';
import { cheapest, favoriteMatcher, formatContext, formatUsd, searchModels, unitPrice } from '../../../core/pricing.js';
import { Card, CatChip, Empty, PctBadge, Row, Segmented, T } from '../ui';
import Icon from '../icons';
import { CAT_LABEL, Header, priceParts, shortName, styles } from '../parts';
import { font, mainCat, radius, space, useTheme } from '../theme';
import { useProfile } from '../profile';

const CATS = [
  { value: 'all', label: 'Wszystko' },
  { value: 'text', icon: 'text', label: 'Tekst' },
  { value: 'coding', icon: 'coding', label: 'Kod' },
  { value: 'image', icon: 'image', label: 'Obraz' },
  { value: 'video', icon: 'video', label: 'Wideo' },
];
const SORTS = [
  { value: 'new', label: 'Najnowsze' },
  { value: 'cheap', label: 'Najtańsze' },
  { value: 'offers', label: 'Najwięcej ofert' },
];

export default function Search({ snapshot, onOpen }) {
  const t = useTheme();
  const { profile } = useProfile();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState(profile.cats.length === 1 && profile.cats[0] !== 'all' ? profile.cats[0] : 'all');
  const [sort, setSort] = useState('new');
  const watched = useMemo(() => new Set(profile.watchlist.map((w) => w.modelId)), [profile.watchlist]);
  const favs = useMemo(
    () => (profile.onlyFavorites ? favoriteMatcher(profile.providers) : null),
    [profile.onlyFavorites, profile.providers],
  );

  const rows = useMemo(() => {
    let models = snapshot.models.filter((m) => cat === 'all' || m.cats.includes(cat));
    models = searchModels(models, q).map((m) => {
      const best = cheapest(m, profile.usage, favs);
      const promo = Math.round(Math.max(0, ...m.offers.map((o) => o.discount ?? 0)) * 100);
      return { m, best, promo };
    });
    if (favs) models = models.filter((r) => r.best || r.m.freeId);
    if (!q.trim()) {
      if (sort === 'cheap') models.sort((a, b) => (unitPrice(a.best) ?? Infinity) - (unitPrice(b.best) ?? Infinity));
      if (sort === 'offers') models.sort((a, b) => b.m.offers.length - a.m.offers.length);
    }
    return models;
  }, [snapshot, q, cat, sort, profile.usage, favs]);

  const header = (
    <View style={{ gap: space[3], marginBottom: space[1] }}>
      <Header kicker={`${snapshot.models.length} modeli, ${rows.length} pasuje`} title="Szukaj" />
      <View style={[s.search, { backgroundColor: t.card, borderColor: q ? t.text : t.line }]}>
        <Icon name="search" size={20} color={t.ink2} />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="deepseek, claude, flux, veo…"
          placeholderTextColor={t.ink3}
          autoCorrect={false}
          autoCapitalize="none"
          clearButtonMode="while-editing"
          returnKeyType="search"
          accessibilityLabel="Szukaj modelu"
          style={[s.input, { color: t.ink }]}
        />
      </View>
      <Segmented options={CATS.map((c) => ({ value: c.value, icon: c.icon, label: c.icon ? '' : c.label, a11y: c.label }))} value={cat} onChange={setCat} />
      {!q.trim() ? <Segmented options={SORTS} value={sort} onChange={setSort} /> : null}
    </View>
  );

  return (
    <FlatList
      data={rows}
      keyExtractor={(r) => r.m.id}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      contentContainerStyle={styles.list}
      initialNumToRender={14}
      ListHeaderComponent={header}
      ListEmptyComponent={<Empty title="Nie ma takiego modelu" body="Spróbuj krótszej nazwy albo innej kategorii." />}
      renderItem={({ item: { m, best, promo } }) => {
        const c = mainCat(m);
        const p = priceParts(best);
        return (
          <Card stripe={t[c]} onPress={() => onOpen(m.id)} accessibilityLabel={m.name}>
            <Row style={{ alignItems: 'flex-start' }}>
              <View style={{ flex: 1, gap: 4 }}>
                <T kind="strong" numberOfLines={1}>
                  {shortName(m.name)}
                  {watched.has(m.id) ? <T kind="strong" style={{ color: t.video }}> ★</T> : null}
                </T>
                <CatChip cat={c} label={CAT_LABEL[c]} extra={[m.context ? formatContext(m.context) : null, `${m.offers.length} ofert`].filter(Boolean).join(', ')} />
              </View>
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <T kind="num" style={!best && m.freeId ? { color: t.save } : null}>{best ? p.main : m.freeId ? '0 $' : '–'}</T>
                {promo > 0 ? <PctBadge pct={promo} /> : <T kind="tiny" color="ink3">{best ? p.unit : ''}</T>}
              </View>
            </Row>
            {best ? <T kind="tiny" color="ink3" style={{ marginTop: 6 }}>najtaniej u {best.provider}{best.unit === 'token' ? `, wyjście ${formatUsd(best.out)}` : ''}</T> : null}
          </Card>
        );
      }}
    />
  );
}

const s = StyleSheet.create({
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderRadius: radius.md, paddingHorizontal: 14 },
  input: { flex: 1, paddingVertical: 13, fontSize: 16, fontFamily: font.textMedium },
});
