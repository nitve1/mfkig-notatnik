// Ekran powitalny po natywnym splashu: etykieta cenowa "wpada" na półkę i dostaje nową cenę.
import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { T } from '../ui';
import { font, useTheme } from '../theme';

export default function Intro({ onDone }) {
  const t = useTheme();
  const drop = useRef(new Animated.Value(0)).current;
  const stamp = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (cancelled) return;
      if (reduce) {
        drop.setValue(1);
        stamp.setValue(1);
        setTimeout(onDone, 600);
        return;
      }
      Animated.sequence([
        Animated.timing(drop, { toValue: 1, duration: 520, easing: Easing.out(Easing.back(1.6)), useNativeDriver: true }),
        Animated.timing(stamp, { toValue: 1, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.delay(420),
        Animated.timing(fade, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start(() => !cancelled && onDone());
    });
    return () => {
      cancelled = true;
    };
  }, [drop, stamp, fade, onDone]);

  const translateY = drop.interpolate({ inputRange: [0, 1], outputRange: [-140, 0] });
  const rotate = drop.interpolate({ inputRange: [0, 1], outputRange: ['-14deg', '-3deg'] });
  const scale = stamp.interpolate({ inputRange: [0, 1], outputRange: [1.6, 1] });

  return (
    <Animated.View style={[s.wrap, { backgroundColor: t.paper, opacity: fade }]} accessibilityLabel="TaniToken" accessible>
      <Animated.View style={{ transform: [{ translateY }, { rotate }] }}>
        <View style={s.tag}>
          <Svg width={230} height={130} viewBox="0 0 230 130" style={StyleSheet.absoluteFill}>
            <Path d="M0 24 24 0H230V130H24L0 106Z" fill={t.tag} />
            <Circle cx={22} cy={65} r={7} fill={t.paper} />
          </Svg>
          <Animated.Text style={[s.price, { color: t.tagInk, opacity: stamp, transform: [{ scale }] }]}>−80%</Animated.Text>
        </View>
      </Animated.View>
      <T kind="display" style={{ marginTop: 36, fontSize: 44, lineHeight: 46 }}>TaniToken</T>
      <T color="ink2" style={{ marginTop: 6 }}>Ceny API modeli AI, na bieżąco</T>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  wrap: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', zIndex: 10 },
  tag: { width: 230, height: 130, alignItems: 'center', justifyContent: 'center', paddingLeft: 30 },
  price: { fontFamily: font.sign, fontSize: 72, lineHeight: 76, fontVariant: ['tabular-nums'] },
});
