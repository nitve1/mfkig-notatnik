import { useMemo, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { Pill, T } from '../ui';
import { font, radius, space, useTheme } from '../theme';

// Lista dostawców z aktualnego zestawienia, od tych z największą liczbą ofert.
export default function ProviderPicker({ snapshot, selected, onToggle, limit = 24 }) {
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
  const shown = query ? providers.filter((p) => p.toLowerCase().includes(query)).slice(0, limit) : [
    ...selected,
    ...providers.filter((p) => !selected.includes(p)).slice(0, Math.max(0, limit - selected.length)),
  ];

  return (
    <View>
      <TextInput
        value={q}
        onChangeText={setQ}
        placeholder={`Szukaj wśród ${providers.length} dostawców`}
        placeholderTextColor={t.ink3}
        autoCorrect={false}
        autoCapitalize="none"
        style={[s.input, { borderColor: t.rule, color: t.ink, backgroundColor: t.sheet }]}
      />
      <View style={s.wrap}>
        {shown.map((p) => (
          <Pill key={p} label={p} on={selected.includes(p)} onPress={() => onToggle(p)} />
        ))}
        {!shown.length ? <T color="ink3">Nie ma takiego dostawcy w zestawieniu.</T> : null}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  input: { borderWidth: 1.5, borderRadius: radius.ui, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, fontFamily: font.text },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2], marginTop: space[3], marginBottom: space[3] },
});
