import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, TextInput, View } from 'react-native';
import { cheapest, formatContext, formatUsd, searchModels, unitPrice } from '../../../core/pricing.js';
import { viewFilter } from '../filters';
import { t as tr } from '../../../core/i18n.js';
import { Card, CatChip, Empty, PctBadge, Row, Segmented, T, MAX_FONT_SCALE } from '../ui';
import Icon from '../icons';
import { catLabel, Header, priceParts, shortName, styles } from '../parts';
import { font, mainCat, radius, space, useBottomSpace, useTheme } from '../theme';
import { useProfile } from '../profile';

const CATS = [
  { value: 'all' },
  { value: 'text', icon: 'text' },
  { value: 'coding', icon: 'coding' },
  { value: 'image', icon: 'image' },
  { value: 'video', icon: 'video' },
];
const SORTS = ['new', 'cheap', 'offers'];

export default function Search({ snapshot, onOpen }) {
  const t = useTheme();
  const bottomSpace = useBottomSpace();
  const { profile } = useProfile();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState(profile.cats.length === 1 && profile.cats[0] !== 'all' ? profile.cats[0] : 'all');
  const [sort, setSort] = useState('new');
  const watched = useMemo(() => new Set(profile.watchlist.map((w) => w.modelId)), [profile.watchlist]);
  const favs = useMemo(
    () => viewFilter(profile),
    [profile.mode, profile.onlyFavorites, profile.providers], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const rows = useMemo(() => {
    let models = snapshot.models.filter((m) => cat === 'all' || m.cats.includes(cat));
    models = searchModels(models, q).map((m) => {
      const best = cheapest(m, profile.usage, favs);
      const offers = favs ? m.offers.filter(favs) : m.offers;
      const promo = Math.round(Math.max(0, ...offers.map((o) => o.discount ?? 0)) * 100);
      return { m, best, promo, count: offers.length };
    });
    if (favs) models = models.filter((r) => r.best || r.m.freeId);
    if (!q.trim()) {
      if (sort === 'cheap') models.sort((a, b) => (unitPrice(a.best) ?? Infinity) - (unitPrice(b.best) ?? Infinity));
      if (sort === 'offers') models.sort((a, b) => b.count - a.count);
    }
    return models;
  }, [snapshot, q, cat, sort, profile.usage, favs]);

  const header = (
    <View style={{ gap: space[3], marginBottom: space[1] }}>
      <Header kicker={tr('search.kicker', { n: snapshot.models.length, match: rows.length })} title={tr('search.title')} />
      <View style={[s.search, { backgroundColor: t.card, borderColor: q ? t.text : t.line }]}>
        <Icon name="search" size={20} color={t.ink2} />
        <TextInput
          maxFontSizeMultiplier={MAX_FONT_SCALE}
          value={q}
          onChangeText={setQ}
          placeholder="deepseek, claude, flux, veo…"
          placeholderTextColor={t.ink3}
          autoCorrect={false}
          autoCapitalize="none"
          clearButtonMode="while-editing"
          returnKeyType="search"
          accessibilityLabel={tr('search.a11y')}
          style={[s.input, { color: t.ink }]}
        />
      </View>
      <Segmented options={CATS.map((c) => ({ value: c.value, icon: c.icon, label: c.icon ? '' : catLabel(c.value), a11y: catLabel(c.value) }))} value={cat} onChange={setCat} />
      {!q.trim() ? <Segmented options={SORTS.map((x) => ({ value: x, label: tr(`sort.${x}`) }))} value={sort} onChange={setSort} /> : null}
    </View>
  );

  return (
    <FlatList
      data={rows}
      keyExtractor={(r) => r.m.id}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      contentContainerStyle={[styles.list, { paddingBottom: bottomSpace }]}
      initialNumToRender={14}
      ListHeaderComponent={header}
      ListEmptyComponent={<Empty title={tr('search.empty')} body={tr('search.emptyBody')} />}
      renderItem={({ item: { m, best, promo, count } }) => {
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
                <CatChip cat={c} label={catLabel(c)} extra={[m.context ? formatContext(m.context) : null, tr('common.offers', { n: count })].filter(Boolean).join(', ')} />
              </View>
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <T kind="num" style={!best && m.freeId ? { color: t.save } : null}>{best ? p.main : m.freeId ? formatUsd(0) : '–'}</T>
                {promo > 0 ? <PctBadge pct={promo} /> : <T kind="tiny" color="ink3">{best ? p.unit : ''}</T>}
              </View>
            </Row>
            {best ? <T kind="tiny" color="ink3" style={{ marginTop: 6 }}>{best.unit === 'token' ? tr('search.cheapestOut', { provider: best.provider, out: formatUsd(best.out) }) : tr('search.cheapest', { provider: best.provider })}</T> : null}
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
