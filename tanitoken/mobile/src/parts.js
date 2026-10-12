import { Pressable, StyleSheet, View } from 'react-native';
import { CATEGORIES, SOURCES, formatUsd, promoAgeText } from '../../core/pricing.js';
import { MiniTag, T } from './ui';
import { space, useTheme } from './theme';

export const CAT_LABEL = Object.fromEntries(CATEGORIES.map((c) => [c.key, c.label]));

export function priceParts(o) {
  if (!o) return { main: '–', unit: '' };
  if (o.unit === 'token') return { main: formatUsd(o.in).replace(' $', ''), unit: '$ / 1M wej.' };
  return { main: formatUsd(o.price).replace(' $', ''), unit: o.unit === 'image' ? '$ / obraz' : '$ / s' };
}

export function catsText(m) {
  return m.cats.filter((c) => c !== 'text' || m.cats.length === 1).map((c) => CAT_LABEL[c]).join(', ');
}

// Wiersz promocji w listach (Promocje, Moje).
export function DealRow({ deal, onPress, watched }) {
  const t = useTheme();
  const m = deal.model;
  const p = priceParts(deal.offer);
  const meta = deal.type === 'free'
    ? `${m.author}, ${catsText(m)}. Darmowy wariant ${promoAgeText(deal).replace('aktywna', 'dostępny')}.`
    : `${deal.offer.provider} w ${SOURCES[deal.offer.src]?.name}, ${catsText(m)}. ${deal.type === 'drop' ? 'Obniżka' : 'Zniżka'} ${promoAgeText(deal)}.`;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [s.row, { borderBottomColor: t.rule, backgroundColor: pressed ? t.sheet : 'transparent' }]}
    >
      <T kind="strong">
        {watched ? <T kind="strong" style={{ color: t.ink3 }}>★ </T> : null}
        {m.name}
      </T>
      <T kind="small" color="ink3">{meta}</T>
      <View style={{ marginTop: space[2] }}>
        {deal.type === 'free' ? <MiniTag free /> : <MiniTag pct={deal.pct} price={p.main} unit={p.unit} />}
      </View>
    </Pressable>
  );
}

export function Header({ title, sub, right }) {
  return (
    <View style={s.header}>
      <View style={{ flex: 1 }}>
        <T kind="h1">{title}</T>
        {sub ? <T kind="small" color="ink3" style={{ marginTop: 2 }}>{sub}</T> : null}
      </View>
      {right}
    </View>
  );
}

const s = StyleSheet.create({
  row: { paddingVertical: space[3], paddingHorizontal: space[1], borderBottomWidth: StyleSheet.hairlineWidth, gap: 2 },
  header: { flexDirection: 'row', alignItems: 'flex-end', gap: space[3], marginBottom: space[4] },
});
