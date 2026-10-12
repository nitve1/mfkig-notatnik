import { useMemo, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { PLATFORMS, platformOf } from '../../../core/pricing.js';
import { Pill, T, MAX_FONT_SCALE } from '../ui';
import Icon from '../icons';
import { font, radius, space, useTheme } from '../theme';

const PLATFORM_NOTE = {
  OpenRouter: 'jedno konto, setki modeli',
  'Vercel AI Gateway': 'tekst, obraz i wideo',
  Requesty: 'Bedrock, Vertex, Azure',
};

// Ulubieni: platformy (konto obejmuje wszystkie ich oferty) i pojedynczy dostawcy.
export default function ProviderPicker({ snapshot, selected, onToggle, pro = true, limit = 16 }) {
  const t = useTheme();
  const [q, setQ] = useState('');
  const { platforms, providers } = useMemo(() => {
    const perPlatform = Object.fromEntries(PLATFORMS.map((p) => [p, 0]));
    const count = new Map();
    for (const m of snapshot?.models ?? []) {
      for (const o of m.offers) {
        const platform = platformOf(o);
        if (platform) perPlatform[platform]++;
        // Oferty Vercel i Requesty mają w nazwie platformę, nie osobnego dostawcę.
        if (o.src === 'vercel' || o.src === 'requesty') continue;
        count.set(o.provider, (count.get(o.provider) ?? 0) + 1);
      }
    }
    return {
      platforms: PLATFORMS.map((name) => ({ name, offers: perPlatform[name] })),
      providers: [...count.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name),
    };
  }, [snapshot]);

  const query = q.trim().toLowerCase();
  const chosen = selected.filter((p) => !PLATFORMS.includes(p));
  const shown = query
    ? providers.filter((p) => p.toLowerCase().includes(query)).slice(0, limit)
    : [...chosen, ...providers.filter((p) => !chosen.includes(p)).slice(0, Math.max(0, limit - chosen.length))];

  return (
    <View style={{ gap: space[3] }}>
      <T kind="small" color="ink2">Platformy: jedno konto obejmuje wszystkie ich oferty</T>
      <View style={{ gap: space[2] }}>
        {platforms.map((p) => {
          const on = selected.includes(p.name);
          return (
            <View key={p.name} style={[s.platform, { borderColor: on ? t.text : t.line, backgroundColor: on ? t.infoSoft : t.bg }]}>
              <View style={{ flex: 1 }}>
                <T kind="strong">{p.name}</T>
                <T kind="tiny" color="ink2">{PLATFORM_NOTE[p.name]}, {p.offers} ofert</T>
              </View>
              <Pill label={on ? 'Mam konto' : 'Dodaj'} on={on} color={t.text} icon={on ? 'check' : 'plus'} onPress={() => onToggle(p.name)} />
            </View>
          );
        })}
      </View>

      {!pro ? (
        <T kind="small" color="ink2">Tryb Pro dodaje ~200 dostawców, u których można kupować bezpośrednio.</T>
      ) : null}
      {pro ? <>
      <T kind="small" color="ink2" style={{ marginTop: space[2] }}>Dostawcy, u których kupujesz bezpośrednio</T>
      <View style={[s.search, { borderColor: t.line, backgroundColor: t.bg }]}>
        <Icon name="search" size={18} color={t.ink2} />
        <TextInput
          maxFontSizeMultiplier={MAX_FONT_SCALE}
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
      </> : null}
      {selected.length ? <T kind="small" color="ink2">Zaznaczone: {selected.join(', ')}</T> : null}
    </View>
  );
}

const s = StyleSheet.create({
  platform: { flexDirection: 'row', alignItems: 'center', gap: space[3], borderWidth: 1.5, borderRadius: radius.md, padding: 12 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1.5, borderRadius: radius.sm, paddingHorizontal: 12 },
  input: { flex: 1, paddingVertical: 10, fontSize: 16, fontFamily: font.textMedium },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
});
