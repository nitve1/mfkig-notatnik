import { useEffect, useRef, useState } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import Icon from './icons';
import { font, radius, space, useTheme } from './theme';
import { GlassFx, glassFrame } from './glass';

const KINDS = StyleSheet.create({
  display: { fontFamily: font.display, fontSize: 30, lineHeight: 34, letterSpacing: -0.6 },
  h1: { fontFamily: font.display, fontSize: 28, lineHeight: 32, letterSpacing: -0.5 },
  h2: { fontFamily: font.displayBold, fontSize: 20, lineHeight: 24, letterSpacing: -0.3 },
  num: { fontFamily: font.display, fontSize: 20, lineHeight: 24, letterSpacing: -0.3, fontVariant: ['tabular-nums'] },
  big: { fontFamily: font.display, fontSize: 26, lineHeight: 30, letterSpacing: -0.5, fontVariant: ['tabular-nums'] },
  body: { fontFamily: font.text, fontSize: 15, lineHeight: 21 },
  strong: { fontFamily: font.textBold, fontSize: 15.5, lineHeight: 21 },
  small: { fontFamily: font.textMedium, fontSize: 13, lineHeight: 18 },
  tiny: { fontFamily: font.textSemi, fontSize: 12.5, lineHeight: 16 }, // min. rozmiar tekstu (audyt czytelności)
});

// Duży tekst systemowy (Dynamic Type) skaluje się, ale najwyżej 1,3x, żeby nie rozsadzić układu.
export const MAX_FONT_SCALE = 1.3;

export function T({ style, kind = 'body', color, ...rest }) {
  const t = useTheme();
  return <Text maxFontSizeMultiplier={MAX_FONT_SCALE} {...rest} style={[KINDS[kind], { color: color ? t[color] ?? color : t.ink }, style]} />;
}

export function Button({ label, onPress, kind = 'ink', icon, disabled, style, accessibilityHint }) {
  const t = useTheme();
  const solid = kind === 'ink';
  const fg = solid ? t.onInk : t.ink;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [
        s.btn,
        solid ? { backgroundColor: t.ink, borderColor: t.ink } : { ...glassFrame(t, radius.lg), backgroundColor: t.card },
        { opacity: disabled ? 0.4 : pressed ? 0.8 : 1 },
        style,
      ]}
    >
      {!solid ? <GlassFx radius={radius.lg} /> : null}
      {icon ? <Icon name={icon} size={18} color={fg} fill={icon === 'star' && solid ? fg : 'none'} /> : null}
      <T kind="strong" style={{ color: fg }}>{label}</T>
    </Pressable>
  );
}

// Przełącznik na całą szerokość (równe segmenty). Podświetlenie aktywnego przesuwa się płynnie
// i jest odrobinę mniejsze niż segment.
const SEG_PAD = 3;
const SEG_INSET = 2;

export function Segmented({ options, value, onChange, style }) {
  const t = useTheme();
  const [w, setW] = useState(0);
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  const stacked = options.length >= 4 && options.some((o) => o.count != null);
  const segW = w ? (w - SEG_PAD * 2) / options.length : 0;
  const x = useRef(new Animated.Value(0)).current;
  const ready = useRef(false);
  useEffect(() => {
    if (!segW) return;
    const to = index * segW;
    if (!ready.current) { x.setValue(to); ready.current = true; return; }
    Animated.spring(x, { toValue: to, useNativeDriver: Platform.OS !== 'web', speed: 18, bounciness: 4 }).start();
  }, [index, segW, x]);
  return (
    <View
      style={[s.seg, glassFrame(t, radius.lg), { backgroundColor: t.card }, style]}
      accessibilityRole="tablist"
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
    >
      <GlassFx radius={radius.lg} />
      {segW ? (
        <Animated.View
          pointerEvents="none"
          style={[s.segPill, { width: segW - SEG_INSET * 2, backgroundColor: t.glassActive, transform: [{ translateX: x }] }]}
        />
      ) : null}
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="tab"
            accessibilityLabel={o.a11y ?? o.label}
            accessibilityState={{ selected: on }}
            style={s.segItem}
          >
            {o.icon ? <Icon name={o.icon} size={15} color={on ? t.ink : t.ink2} /> : null}
            {o.label && stacked ? (
              // Cztery i więcej opcji: liczba pod etykietą, żeby dłuższe słowa (np. po niemiecku) się mieściły.
              <View style={{ alignItems: 'center' }}>
                <T kind="small" numberOfLines={1} style={{ color: on ? t.ink : t.ink2, fontFamily: font.textBold }}>{o.label}</T>
                {o.count != null ? <T kind="tiny" style={{ color: t.ink3, lineHeight: 14 }}>{o.count}</T> : null}
              </View>
            ) : o.label ? <T kind="small" numberOfLines={1} style={{ color: on ? t.ink : t.ink2, fontFamily: font.textBold }}>
              {o.label}
              {o.count != null ? <T kind="small" style={{ color: t.ink3, fontFamily: font.textSemi }}>{` ${o.count}`}</T> : null}
            </T> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

// Karta z kolorowym paskiem po lewej.
// level: 'raised' = ważniejsza sekcja (jaśniejsza powierzchnia, jak wyższe piętro w ciemnym motywie),
// 'flat' = drugorzędna (bez połysku i ramki). Domyślnie zwykłe szkło.
export function Card({ stripe, children, onPress, style, accessibilityLabel, level }) {
  const t = useTheme();
  const body = (
    <>
      {level === 'flat' ? null : <GlassFx radius={radius.lg} />}
      {stripe ? <View style={[s.stripe, { backgroundColor: stripe }]} /> : null}
      {children}
    </>
  );
  const surface = level === 'raised'
    ? [glassFrame(t, radius.lg), { backgroundColor: t.cardRaised, borderColor: t.glassLineStrong }]
    : level === 'flat'
      ? { borderRadius: radius.lg, overflow: 'hidden', backgroundColor: t.card, borderWidth: 1, borderColor: t.line }
      : [glassFrame(t, radius.lg), { backgroundColor: t.card }];
  const base = [s.card, surface, { paddingLeft: stripe ? 18 : 14 }, style];
  if (!onPress) return <View style={base}>{body}</View>;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel} style={({ pressed }) => [...base, pressed && { opacity: 0.85 }]}>
      {body}
    </Pressable>
  );
}

export function PctBadge({ pct, style }) {
  const t = useTheme();
  return (
    <View style={[s.badge, { backgroundColor: t.deal }, style]}>
      <T kind="tiny" style={{ color: '#fff', fontFamily: font.textBold }}>−{pct}%</T>
    </View>
  );
}

// Odznaka stanu: tone = deal | save | info | muted
export function StatusBadge({ label, tone = 'muted', icon }) {
  const t = useTheme();
  const map = {
    deal: [t.dealSoft, t.deal],
    save: [t.saveSoft, t.save],
    info: [t.infoSoft, t.text],
    muted: [t.seg, t.ink2],
  };
  const [bg, fg] = map[tone];
  return (
    <View style={[s.status, { backgroundColor: bg }]}>
      {icon ? <Icon name={icon} size={12} color={fg} width={2.4} /> : null}
      <T kind="tiny" style={{ color: fg, fontFamily: font.textBold }}>{label}</T>
    </View>
  );
}

// Kolorowa etykieta kategorii z ikoną.
export function CatChip({ cat, label, extra }) {
  const t = useTheme();
  return (
    <View style={s.catChip}>
      <Icon name={cat} size={14} color={t[cat]} width={2.2} />
      <T kind="small" numberOfLines={1} style={{ color: t[cat], fontFamily: font.textSemi, flexShrink: 1 }}>
        {label}
        {extra ? <T kind="small" style={{ color: t.ink2 }}>{`  ${extra}`}</T> : null}
      </T>
    </View>
  );
}

export function Stat({ label, value, sub, color, style }) {
  const t = useTheme();
  return (
    <View style={[s.stat, glassFrame(t, radius.lg), { backgroundColor: t.card }, style]}>
      <GlassFx radius={radius.lg} />
      <T kind="small" color="ink2">{label}</T>
      <T kind="big" style={{ color: color ?? t.ink, marginTop: 2 }} numberOfLines={1} adjustsFontSizeToFit>{value}</T>
      {sub ? <T kind="small" color="ink2" numberOfLines={2}>{sub}</T> : null}
    </View>
  );
}

export function Progress({ value, color }) {
  const t = useTheme();
  return (
    <View style={[s.progress, { backgroundColor: t.seg }]}>
      <View style={{ width: `${Math.min(100, Math.max(4, value * 100))}%`, backgroundColor: color ?? t.deal, height: '100%', borderRadius: 9 }} />
    </View>
  );
}

export function Pill({ label, on, onPress, color, icon }) {
  const t = useTheme();
  const c = color ?? t.ink;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: on }}
      style={[s.pill, { borderColor: on ? c : t.glassLine, backgroundColor: on ? c : t.card }]}
    >
      {!on ? <GlassFx radius={radius.md} /> : null}
      {icon ? <Icon name={icon} size={15} color={on ? '#fff' : c} /> : null}
      <T kind="small" style={{ color: on ? (color ? '#fff' : t.onInk) : t.ink, fontFamily: font.textSemi }}>{label}</T>
    </Pressable>
  );
}

export function Row({ children, style }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap: space[3] }, style]}>{children}</View>;
}

export function Section({ title, children, style }) {
  const t = useTheme();
  return (
    <View style={[{ marginTop: space[5] }, style]}>
      {title ? <T kind="h2" style={{ marginBottom: space[2] }}>{title}</T> : null}
      <View style={[s.section, glassFrame(t, radius.lg), { backgroundColor: t.card }]}>
        <GlassFx radius={radius.lg} />
        {children}
      </View>
    </View>
  );
}

// Cały wiersz przełącza (cel dotyku na pełną szerokość, nie tylko mały suwak).
export function ToggleRow({ title, body, value, onChange, last }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={() => onChange(!value)}
      accessibilityRole="switch"
      accessibilityState={{ checked: !!value }}
      accessibilityLabel={title}
      style={{ paddingVertical: space[3], minHeight: 56, flexDirection: 'row', alignItems: 'flex-start', gap: space[3], borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth, borderBottomColor: t.line }}
    >
      <View style={{ flex: 1 }}>
        <T kind="strong">{title}</T>
        {body ? <T kind="small" color="ink2" style={{ marginTop: 2 }}>{body}</T> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: t.text, false: t.seg }}
        thumbColor="#ffffff"
        importantForAccessibility="no"
      />
    </Pressable>
  );
}

export function IconButton({ name, onPress, label, dot, active }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} hitSlop={8} accessibilityRole="button" accessibilityLabel={label} style={[s.iconBtn, glassFrame(t, radius.lg), { backgroundColor: t.card, overflow: 'visible' }]}>
      <GlassFx radius={radius.lg} />
      <Icon name={name} size={23} color={active ? t.video : t.ink} fill={active ? t.video : 'none'} />
      {dot ? <View style={[s.dot, { backgroundColor: t.deal, borderColor: t.cardSolid }]} /> : null}
    </Pressable>
  );
}

export function Empty({ title, body, action, icon = 'search' }) {
  const t = useTheme();
  return (
    <View style={[s.empty, glassFrame(t, radius.lg), { backgroundColor: t.card }]}>
      <GlassFx radius={radius.lg} />
      <View style={[s.emptyIcon, { backgroundColor: t.infoSoft }]}><Icon name={icon} size={22} color={t.text} /></View>
      <T kind="h2" style={{ textAlign: 'center' }}>{title}</T>
      {body ? <T color="ink2" style={{ textAlign: 'center' }}>{body}</T> : null}
      {action ? <View style={{ marginTop: space[2] }}>{action}</View> : null}
    </View>
  );
}

const s = StyleSheet.create({
  btn: { flex: 1, minHeight: 48, paddingHorizontal: space[4], borderRadius: radius.lg, borderWidth: 1, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  seg: { flexDirection: 'row', padding: SEG_PAD },
  segPill: { position: 'absolute', top: SEG_PAD + SEG_INSET, bottom: SEG_PAD + SEG_INSET, left: SEG_PAD + SEG_INSET, borderRadius: radius.lg - SEG_PAD - SEG_INSET },
  segItem: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, minHeight: 44 }, // + odstęp 3 = 50 dp celu dotyku
  card: { padding: 14 },
  stripe: { position: 'absolute', left: 0, top: 12, bottom: 12, width: 4, borderTopRightRadius: 4, borderBottomRightRadius: 4 },
  badge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, alignSelf: 'flex-end' },
  status: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 7, alignSelf: 'flex-start' },
  catChip: { flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 1 },
  stat: { flex: 1, padding: 14 },
  progress: { height: 7, borderRadius: 9, overflow: 'hidden' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, minHeight: 44, borderRadius: radius.md, borderWidth: 1, overflow: 'hidden' },
  section: { paddingHorizontal: 14, paddingVertical: 4 },
  iconBtn: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  dot: { position: 'absolute', right: 7, top: 7, width: 10, height: 10, borderRadius: 5, borderWidth: 2 },
  empty: { padding: space[5], alignItems: 'center', gap: space[2] },
  emptyIcon: { width: 48, height: 48, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', marginBottom: space[1] },
});
