import { Pressable, StyleSheet, Text, View } from 'react-native';
import { formatUsd, priceBeforeDiscount } from '../../core/pricing.js';
import { useTheme } from './theme';

export function Chip({ label, active, onPress }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[s.chip, { borderColor: active ? t.text : t.line, backgroundColor: active ? t.text : t.surface }]}
    >
      <Text style={{ color: active ? t.bg : t.text, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}

export function Badge({ label, tone = 'accent' }) {
  const t = useTheme();
  const gold = tone === 'gold';
  return (
    <View style={[s.badge, { backgroundColor: gold ? t.goldSoft : t.accentSoft }]}>
      <Text style={[s.badgeText, { color: gold ? t.gold : t.accent }]}>{label}</Text>
    </View>
  );
}

export function PriceLine({ price, before, style }) {
  const t = useTheme();
  return (
    <Text style={[{ color: t.text, fontVariant: ['tabular-nums'] }, style]}>
      {before ? (
        <Text style={{ color: t.muted, textDecorationLine: 'line-through' }}>
          {formatUsd(before.in)} / {formatUsd(before.out)}{'  '}
        </Text>
      ) : null}
      <Text style={{ fontWeight: '700' }}>
        {formatUsd(price.in)} / {formatUsd(price.out)}
      </Text>
    </Text>
  );
}

export function DealCard({ deal, onPress }) {
  const t = useTheme();
  const { model, endpoint } = deal;
  const before = deal.type === 'drop' ? deal.from : endpoint ? priceBeforeDiscount(endpoint) : null;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [s.card, { backgroundColor: t.surface, borderColor: pressed ? t.accent : t.line }]}
    >
      <View style={s.row}>
        <Text style={{ color: t.muted, fontSize: 13 }}>{model.author}</Text>
        {deal.type === 'free' ? (
          <Badge label="DARMOWY" tone="gold" />
        ) : (
          <Badge label={`−${deal.pct}%${deal.type === 'drop' ? ' obniżka' : ''}`} />
        )}
      </View>
      <Text style={[s.name, { color: t.text }]} numberOfLines={2}>
        {model.name}
      </Text>
      {endpoint ? (
        <>
          <Text style={{ color: t.muted, fontSize: 13 }}>
            {endpoint.provider}
            {endpoint.quant ? ` · ${endpoint.quant}` : ''}
          </Text>
          <PriceLine price={endpoint} before={before} style={{ marginTop: 4 }} />
        </>
      ) : (
        <Text style={{ color: t.muted, fontSize: 13 }}>{model.freeId}</Text>
      )}
    </Pressable>
  );
}

export const TABS = [
  { key: 'deals', label: 'Promocje', icon: '%' },
  { key: 'models', label: 'Modele', icon: '≡' },
  { key: 'favorites', label: 'Ulubione', icon: '★' },
];

export function TabBar({ tab, onChange, bottomInset }) {
  const t = useTheme();
  return (
    <View style={[s.tabbar, { backgroundColor: t.surface, borderTopColor: t.line, paddingBottom: bottomInset + 6 }]}>
      {TABS.map((x) => {
        const active = x.key === tab;
        return (
          <Pressable key={x.key} onPress={() => onChange(x.key)} style={s.tab} accessibilityRole="tab" accessibilityState={{ selected: active }}>
            <Text style={{ fontSize: 20, color: active ? t.accent : t.muted, fontWeight: '800' }}>{x.icon}</Text>
            <Text style={{ fontSize: 12, color: active ? t.accent : t.muted, fontWeight: '600' }}>{x.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, borderWidth: 1, marginRight: 8 },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  badgeText: { fontSize: 12, fontWeight: '800' },
  card: { borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 10, gap: 3 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { fontSize: 16, fontWeight: '700' },
  tabbar: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 6 },
  tab: { flex: 1, alignItems: 'center', gap: 2 },
});
