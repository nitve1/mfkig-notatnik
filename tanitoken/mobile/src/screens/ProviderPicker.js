import { useMemo, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { GATEWAYS, PLATFORMS, platformOf } from '../../../core/pricing.js';
import { t as tr } from '../../../core/i18n.js';
import { Pill, T, MAX_FONT_SCALE } from '../ui';
import Icon from '../icons';
import { font, radius, space, useTheme } from '../theme';

const PLATFORM_NOTE = { OpenRouter: 'platform.openrouter', 'Vercel AI Gateway': 'platform.vercel', Requesty: 'platform.requesty', 'fal.ai': 'platform.fal' };

// Ulubieni: platformy (konto obejmuje wszystkie ich oferty) i pojedynczy dostawcy.
export default function ProviderPicker({ snapshot, selected, onToggle, pro = true, limit = 16 }) {
  const t = useTheme();
  const [q, setQ] = useState('');
  const { platforms, gateways, providers } = useMemo(() => {
    const perPlatform = Object.fromEntries(PLATFORMS.map((p) => [p, 0]));
    const count = new Map();
    for (const m of snapshot?.models ?? []) {
      for (const o of m.offers) {
        const platform = platformOf(o);
        if (platform) perPlatform[platform]++;
        // Oferty platform (Vercel, Requesty, fal, bramki) nie są osobnymi dostawcami.
        if (o.src !== 'openrouter' && platform) continue;
        count.set(o.provider, (count.get(o.provider) ?? 0) + 1);
      }
    }
    return {
      platforms: PLATFORMS.filter((name) => !GATEWAYS.includes(name)).map((name) => ({ name, offers: perPlatform[name] })),
      gateways: GATEWAYS.filter((name) => perPlatform[name] > 0).sort((a, b) => perPlatform[b] - perPlatform[a])
        .map((name) => ({ name, offers: perPlatform[name] })),
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
      <T kind="small" color="ink2">{tr('picker.platforms')}</T>
      <View style={{ gap: space[2] }}>
        {platforms.map((p) => {
          const on = selected.includes(p.name);
          return (
            <View key={p.name} style={[s.platform, { borderColor: on ? t.text : t.line, backgroundColor: on ? t.infoSoft : 'rgba(0,0,0,0.18)' }]}>
              <View style={{ flex: 1 }}>
                <T kind="strong">{p.name}</T>
                <T kind="tiny" color="ink2">{tr(PLATFORM_NOTE[p.name])}, {tr('common.offers', { n: p.offers })}</T>
              </View>
              <Pill label={tr(on ? 'picker.have' : 'picker.add')} on={on} color={t.text} icon={on ? 'check' : 'plus'} onPress={() => onToggle(p.name)} />
            </View>
          );
        })}
      </View>

      {gateways.length ? (
        <>
          <T kind="small" color="ink2" style={{ marginTop: space[1] }}>{tr('picker.gateways')}</T>
          <View style={s.wrap}>
            {gateways.map((g) => (
              <Pill key={g.name} label={`${g.name} · ${g.offers}`} on={selected.includes(g.name)} color={t.text} onPress={() => onToggle(g.name)} />
            ))}
          </View>
        </>
      ) : null}

      {!pro ? (
        <T kind="small" color="ink2">{tr('picker.proHint')}</T>
      ) : null}
      {pro ? <>
      <T kind="small" color="ink2" style={{ marginTop: space[2] }}>{tr('picker.direct')}</T>
      <View style={[s.search, { borderColor: t.glassLine, backgroundColor: 'rgba(0,0,0,0.25)' }]}>
        <Icon name="search" size={18} color={t.ink2} />
        <TextInput
          maxFontSizeMultiplier={MAX_FONT_SCALE}
          value={q}
          onChangeText={setQ}
          placeholder={tr('picker.searchPh', { n: providers.length })}
          placeholderTextColor={t.ink3}
          autoCorrect={false}
          autoCapitalize="none"
          accessibilityLabel={tr('picker.searchA11y')}
          style={[s.input, { color: t.ink }]}
        />
      </View>
      <View style={s.wrap}>
        {shown.map((p) => (
          <Pill key={p} label={p} on={selected.includes(p)} onPress={() => onToggle(p)} />
        ))}
        {!shown.length ? <T color="ink2">{tr('picker.none')}</T> : null}
      </View>
      </> : null}
      {selected.length ? <T kind="small" color="ink2">{tr('picker.selected', { list: selected.join(', ') })}</T> : null}
    </View>
  );
}

const s = StyleSheet.create({
  platform: { flexDirection: 'row', alignItems: 'center', gap: space[3], borderWidth: 1, borderRadius: radius.md, padding: 12 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1.5, borderRadius: radius.sm, paddingHorizontal: 12 },
  input: { flex: 1, paddingVertical: 10, fontSize: 16, fontFamily: font.textMedium },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
});
