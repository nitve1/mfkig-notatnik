import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { font, radius, space, useTheme } from './theme';

export function T({ style, kind = 'body', color, ...rest }) {
  const t = useTheme();
  const k = KINDS[kind];
  return <Text {...rest} style={[{ color: color ? t[color] ?? color : t.ink }, k, style]} />;
}

const KINDS = StyleSheet.create({
  display: { fontFamily: font.sign, fontSize: 40, lineHeight: 40, letterSpacing: -0.3 },
  h1: { fontFamily: font.sign, fontSize: 32, lineHeight: 34 },
  h2: { fontFamily: font.sign, fontSize: 24, lineHeight: 26 },
  h3: { fontFamily: font.signSemi, fontSize: 20, lineHeight: 22 },
  body: { fontFamily: font.text, fontSize: 16, lineHeight: 23 },
  strong: { fontFamily: font.textSemi, fontSize: 16, lineHeight: 22 },
  small: { fontFamily: font.text, fontSize: 14, lineHeight: 19 },
  tiny: { fontFamily: font.textMedium, fontSize: 12, lineHeight: 16 },
  price: { fontFamily: font.sign, fontSize: 22, lineHeight: 24, fontVariant: ['tabular-nums'] },
});

export function Button({ label, onPress, kind = 'ink', disabled, style, accessibilityHint }) {
  const t = useTheme();
  const ink = kind === 'ink';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [
        s.btn,
        { borderColor: t.ink, backgroundColor: ink ? t.ink : 'transparent', opacity: disabled ? 0.4 : pressed ? 0.75 : 1 },
        style,
      ]}
    >
      <T kind="strong" style={{ color: ink ? t.paper : t.ink }}>{label}</T>
    </Pressable>
  );
}

// Przełącznik segmentowy (kategorie, typ promocji).
export function Segmented({ options, value, onChange, scroll = true }) {
  const t = useTheme();
  const body = (
    <View style={[s.seg, { borderColor: t.ink }]}>
      {options.map((o, i) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            style={[s.segItem, { backgroundColor: on ? t.ink : 'transparent', borderLeftColor: t.ink, borderLeftWidth: i ? 1.5 : 0 }]}
          >
            <T kind="small" style={{ color: on ? t.paper : t.ink, fontFamily: font.textMedium }}>
              {o.label}
              {o.count != null ? <T kind="small" style={{ color: on ? t.paper : t.ink3 }}>{` ${o.count}`}</T> : null}
            </T>
          </Pressable>
        );
      })}
    </View>
  );
  return scroll ? (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: space[4] }}>
      {body}
    </ScrollView>
  ) : (
    body
  );
}

// Wybór wielu opcji (kategorie, dostawcy).
export function Pill({ label, on, onPress }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: on }}
      style={[s.pill, { borderColor: on ? t.ink : t.rule, backgroundColor: on ? t.ink : t.sheet }]}
    >
      <T kind="small" style={{ color: on ? t.paper : t.ink, fontFamily: font.textMedium }}>{label}</T>
    </Pressable>
  );
}

// Mała etykieta cenowa w listach.
export function MiniTag({ pct, price, unit, free }) {
  const t = useTheme();
  if (free) {
    return (
      <View style={[s.mini, { backgroundColor: t.sheet, borderWidth: 1.5, borderStyle: 'dashed', borderColor: t.ink3 }]}>
        <T kind="price" style={{ color: t.save }}>0 $</T>
        <T kind="tiny" color="ink2">wariant :free</T>
      </View>
    );
  }
  return (
    <View style={[s.mini, { backgroundColor: t.tag }]}>
      <View style={[s.miniNotch, { borderRightColor: t.tag }]} />
      {pct ? <T kind="price" style={{ color: t.tagPromo, fontSize: 18 }}>−{pct}%</T> : null}
      <T kind="price" style={{ color: t.tagInk }}>{price}</T>
      <T kind="tiny" style={{ color: t.tagInk }}>{unit}</T>
    </View>
  );
}

export function TagMark({ size = 28 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      <Path d="M3 9.5 9.5 3H29v26H9.5L3 22.5z" fill="#ffd60a" stroke="#172036" strokeWidth={1.6} />
      <Circle cx={10} cy={16} r={2.4} fill="#f1f3f6" stroke="#172036" strokeWidth={1.6} />
    </Svg>
  );
}

export function Row({ children, style }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap: space[3] }, style]}>{children}</View>;
}

export function Rule() {
  const t = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: t.rule }} />;
}

export function ToggleRow({ title, body, value, onChange }) {
  const t = useTheme();
  return (
    <Row style={{ paddingVertical: space[3], alignItems: 'flex-start' }}>
      <View style={{ flex: 1 }}>
        <T kind="strong">{title}</T>
        {body ? <T kind="small" color="ink3" style={{ marginTop: 2 }}>{body}</T> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: t.ink, false: t.rule }}
        thumbColor={value ? t.tag : t.sheet}
        accessibilityLabel={title}
      />
    </Row>
  );
}

export function Empty({ title, body, action }) {
  return (
    <View style={{ paddingVertical: space[6], gap: space[2] }}>
      <T kind="h3">{title}</T>
      {body ? <T color="ink2">{body}</T> : null}
      {action ? <View style={{ marginTop: space[3], alignSelf: 'flex-start' }}>{action}</View> : null}
    </View>
  );
}

const s = StyleSheet.create({
  btn: { minHeight: 46, paddingHorizontal: space[5], borderRadius: radius.ui, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  seg: { flexDirection: 'row', borderWidth: 1.5, borderRadius: radius.ui, overflow: 'hidden' },
  segItem: { paddingHorizontal: 13, paddingVertical: 8 },
  pill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 99, borderWidth: 1.5 },
  mini: { flexDirection: 'row', alignItems: 'baseline', gap: 6, paddingVertical: 5, paddingLeft: 14, paddingRight: 10, borderRadius: radius.tag, alignSelf: 'flex-start' },
  miniNotch: { position: 'absolute', left: -8, top: 0, bottom: 0, width: 0, borderTopWidth: 15, borderBottomWidth: 15, borderRightWidth: 8, borderTopColor: 'transparent', borderBottomColor: 'transparent' },
});
