import { useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { formatContext, formatUsd, liveEndpoints, priceBeforeDiscount, usageCost } from '../../core/pricing.js';
import { Badge, PriceLine } from './components';
import { useTheme } from './theme';

const LIVE_MS = 60 * 1000;

export default function ModelScreen({ model, onBack, isFavorite, onToggleFavorite }) {
  const t = useTheme();
  const [endpoints, setEndpoints] = useState(model.endpoints);
  const [live, setLive] = useState(false);
  const [usage, setUsage] = useState({ in: '10', out: '2' }); // mln tokenów miesięcznie

  // Ceny na żywo dla otwartego modelu, odświeżane co minutę.
  useEffect(() => {
    let alive = true;
    const load = () =>
      liveEndpoints(model.id)
        .then((eps) => alive && eps.length && (setEndpoints(eps), setLive(true)))
        .catch(() => {});
    load();
    const timer = setInterval(load, LIVE_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [model.id]);

  const inTok = (Number(usage.in.replace(',', '.')) || 0) * 1e6;
  const outTok = (Number(usage.out.replace(',', '.')) || 0) * 1e6;
  const sorted = useMemo(
    () => [...endpoints].map((e) => ({ ...e, cost: usageCost(e, inTok, outTok) })).sort((a, b) => a.cost - b.cost),
    [endpoints, inTok, outTok],
  );
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];

  return (
    <ScrollView contentContainerStyle={s.wrap} keyboardShouldPersistTaps="handled">
      <View style={s.head}>
        <Pressable onPress={onBack} hitSlop={12}>
          <Text style={{ color: t.accent, fontSize: 16, fontWeight: '600' }}>‹ Wróć</Text>
        </Pressable>
        <Pressable onPress={onToggleFavorite} hitSlop={12} accessibilityLabel="Ulubione">
          <Text style={{ fontSize: 24, color: isFavorite ? t.gold : t.muted }}>{isFavorite ? '★' : '☆'}</Text>
        </Pressable>
      </View>

      <Text style={[s.h1, { color: t.text }]}>{model.name}</Text>
      <Text style={{ color: t.muted }} selectable>
        {model.id}
      </Text>
      <Text style={{ color: t.muted, marginTop: 4 }}>
        Kontekst {formatContext(model.context)} · {live ? '● ceny na żywo' : 'ceny ze snapshotu'}
      </Text>
      {model.freeId ? (
        <View style={[s.note, { backgroundColor: t.goldSoft }]}>
          <Text style={{ color: t.text }}>
            Darmowy wariant: <Text style={{ fontWeight: '700' }} selectable>{model.freeId}</Text> (z limitami zapytań)
          </Text>
        </View>
      ) : null}

      <View style={[s.calc, { backgroundColor: t.surface, borderColor: t.line }]}>
        <Text style={{ color: t.text, fontWeight: '700', marginBottom: 8 }}>Twoje zużycie miesięcznie</Text>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          {[
            ['in', 'Wejście (mln tok.)'],
            ['out', 'Wyjście (mln tok.)'],
          ].map(([k, label]) => (
            <View key={k} style={{ flex: 1 }}>
              <Text style={{ color: t.muted, fontSize: 12, marginBottom: 4 }}>{label}</Text>
              <TextInput
                value={usage[k]}
                onChangeText={(v) => setUsage((u) => ({ ...u, [k]: v }))}
                keyboardType="decimal-pad"
                style={[s.input, { borderColor: t.line, color: t.text, backgroundColor: t.bg }]}
              />
            </View>
          ))}
        </View>
        {best ? (
          <Text style={{ color: t.text, marginTop: 12 }}>
            Najtaniej: <Text style={{ fontWeight: '800', color: t.accent }}>{best.provider}</Text> za{' '}
            <Text style={{ fontWeight: '800' }}>{formatUsd(best.cost)}</Text>
            {worst && worst.cost > best.cost ? ` (oszczędzasz ${formatUsd(worst.cost - best.cost)} vs najdroższy)` : ''}
          </Text>
        ) : null}
      </View>

      <Text style={[s.h2, { color: t.text }]}>Providerzy ({sorted.length})</Text>
      <Text style={{ color: t.muted, fontSize: 12, marginBottom: 8 }}>USD za 1M tokenów: wejście / wyjście</Text>
      {sorted.map((e, i) => (
        <View
          key={e.tag ?? e.provider}
          style={[s.ep, { borderColor: i === 0 ? t.accent : t.line, backgroundColor: i === 0 ? t.accentSoft : t.surface }]}
        >
          <View style={s.row}>
            <Text style={{ color: t.text, fontWeight: '700', fontSize: 15, flexShrink: 1 }}>
              {i + 1}. {e.provider}
            </Text>
            <Text style={{ color: t.text, fontWeight: '800', fontVariant: ['tabular-nums'] }}>{formatUsd(e.cost)}/mies.</Text>
          </View>
          <View style={[s.row, { marginTop: 4 }]}>
            <PriceLine price={e} before={priceBeforeDiscount(e)} />
            {e.discount > 0 ? <Badge label={`−${Math.round(e.discount * 100)}%`} /> : null}
          </View>
          <Text style={{ color: t.muted, fontSize: 12, marginTop: 4 }}>
            {[
              e.context ? `kontekst ${formatContext(e.context)}` : null,
              e.quant,
              e.uptime != null ? `uptime ${e.uptime}%` : null,
              e.cacheRead != null ? `cache ${formatUsd(e.cacheRead)}` : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        </View>
      ))}

      <Pressable onPress={() => Linking.openURL(`https://openrouter.ai/${model.id}`)} style={[s.link, { borderColor: t.line }]}>
        <Text style={{ color: t.text, fontWeight: '600' }}>Otwórz w OpenRouter ↗</Text>
      </Pressable>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { padding: 16, paddingBottom: 32 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  h1: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  h2: { fontSize: 20, fontWeight: '800', marginTop: 20 },
  note: { borderRadius: 12, padding: 12, marginTop: 12 },
  calc: { borderWidth: 1, borderRadius: 14, padding: 14, marginTop: 16 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, fontSize: 16 },
  ep: { borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  link: { borderWidth: 1, borderRadius: 999, padding: 12, alignItems: 'center', marginTop: 12 },
});
