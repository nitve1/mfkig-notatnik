import { useMemo, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { Pill, T } from '../ui';
import Icon from '../icons';
import { font, radius, space, useTheme } from '../theme';

// Dostawcy z aktualnego zestawienia, od tych z największą liczbą ofert. Zaznaczeni zawsze na początku.
export default function ProviderPicker({ snapshot, selected, onToggle, limit = 18 }) {
  const t = useTheme();
  const [q, setQ] = useState('');
  const providers = useMemo(() => {
    const count = new Map();
    for (const m of snapshot?.models ?? []) {
      for (const o of m.offers) count.set(o.provider, (count.get(o.provider) ?? 0) + 1);
    }
    return [...count.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name);
  }, [snapshot]);

  const query = q.trim().toLowerCase();
  const shown = query
    ? providers.filter((p) => p.toLowerCase().includes(query)).slice(0, limit)
    : [...selected, ...providers.filter((p) => !selected.includes(p)).slice(0, Math.max(0, limit - selected.length))];

  return (
    <View style={{ gap: space[3] }}>
      <View style={[s.search, { borderColor: t.line, backgroundColor: t.bg }]}>
        <Icon name="search" size={18} color={t.ink2} />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder={`Szukaj wśród ${providers.length} dostawców`}
          placeholderTextColor={t.ink3}
          autoCorrect={false}
          autoCapitalize="none"
          accessibilityLabel="Szukaj dostawcy"
          style={[s.input, { color: t.ink }]}
        />
      </View>
      <View style={s.wrap}>
        {shown.map((p) => (
          <Pill key={p} label={p} on={selected.includes(p)} onPress={() => onToggle(p)} />
        ))}
        {!shown.length ? <T color="ink2">Nie ma takiego dostawcy w zestawieniu.</T> : null}
      </View>
      {selected.length ? <T kind="small" color="ink2">Zaznaczonych: {selected.length}</T> : null}
    </View>
  );
}

const s = StyleSheet.create({
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1.5, borderRadius: radius.sm, paddingHorizontal: 12 },
  input: { flex: 1, paddingVertical: 10, fontSize: 15, fontFamily: font.textMedium },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
});
