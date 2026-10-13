// Ekran powitalny: cztery kafle kategorii wskakują po kolei i składają się w znak TaniToken.
import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from 'react-native';
import { T } from '../ui';
import { t as tr } from '../../../core/i18n.js';
import Icon from '../icons';
import { useTheme } from '../theme';

const TILES = ['text', 'coding', 'image', 'video'];

export default function Intro({ onDone }) {
  const t = useTheme();
  const done = useRef(onDone);
  done.current = onDone;
  const anims = useRef(TILES.map(() => new Animated.Value(0))).current;
  const word = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (cancelled) return;
      if (reduce) {
        anims.forEach((a) => a.setValue(1));
        word.setValue(1);
        setTimeout(() => done.current(), 600);
        return;
      }
      Animated.sequence([
        Animated.stagger(110, anims.map((a) => Animated.spring(a, { toValue: 1, friction: 6, tension: 120, useNativeDriver: true }))),
        Animated.timing(word, { toValue: 1, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.delay(450),
        Animated.timing(fade, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start(({ finished }) => finished && !cancelled && done.current());
    });
    return () => {
      cancelled = true;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- animacja startuje raz

  return (
    <Animated.View style={[s.wrap, { backgroundColor: t.bg, opacity: fade }]} accessible accessibilityLabel="TaniToken">
      <View style={s.grid}>
        {TILES.map((c, i) => (
          <Animated.View
            key={c}
            style={[s.tile, { backgroundColor: t[c], opacity: anims[i], transform: [{ scale: anims[i].interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) }] }]}
          >
            <Icon name={c} size={30} color="#fff" width={2.4} />
          </Animated.View>
        ))}
      </View>
      <Animated.View style={{ opacity: word, transform: [{ translateY: word.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }], alignItems: 'center' }}>
        <T kind="display" style={{ fontSize: 40, lineHeight: 44, marginTop: 28 }}>TaniToken</T>
        <T color="ink2">{tr('intro.tagline')}</T>
      </Animated.View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  grid: { width: 172, flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  tile: { width: 80, height: 80, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
});
