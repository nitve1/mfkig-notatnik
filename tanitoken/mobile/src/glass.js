// Szkło LightTokenz (wybory użytkownika z 2026-10-14, makiety w mockups/bg, panels, glow):
//
// Backdrop: tło "Kolory kategorii", siatka czterech eliptycznych gradientów (tekst u góry z lewej,
//   wideo z prawej, obraz z lewej niżej, kod na dole z prawej) na #0b0a12, płynnie, bez granic.
// GlassFx: szkło "Połysk", połysk od góry płynnie zanikający w dół (0.16 → 0.06 → 0.03), bez ostrej
//   linii. Web: pod panelem prawdziwe rozmycie tła (backdrop-filter blur + saturate).
// Glass: pasek nad przewijaną treścią; natywnie expo-blur (Android 12+), na webie backdrop-filter.
// GlowBorder: obracająca się świecąca krawędź w kolorach kategorii (kafel podsumowania).
import { forwardRef, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';
import { BlurTargetView, BlurView } from 'expo-blur';
import Svg, { Defs, Ellipse, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';
import { useTheme } from './theme';

export { BlurTargetView };

// [kategoria, środek x, środek y, promień x, promień y, krycie]; jak CSS radial-gradient(70% 40% at x y).
const MESH = [
  ['text', '0%', '0%', '70%', '40%', 0.67],
  ['video', '100%', '25%', '70%', '40%', 0.67],
  ['image', '0%', '75%', '70%', '45%', 0.67],
  ['coding', '100%', '100%', '70%', '40%', 0.53],
];
const MESH_COLORS = { text: '#3d63ff', video: '#ff8a00', image: '#ff4f8b', coding: '#8b3dff' };

export function Backdrop() {
  const t = useTheme();
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: t.bg }]} pointerEvents="none">
      <Svg width="100%" height="100%">
        <Defs>
          {MESH.map(([c, , , , , o], i) => (
            <RadialGradient key={i} id={`mesh${i}`} cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={MESH_COLORS[c]} stopOpacity={o} />
              <Stop offset="0.6" stopColor={MESH_COLORS[c]} stopOpacity={0} />
            </RadialGradient>
          ))}
        </Defs>
        {MESH.map(([, cx, cy, rx, ry], i) => <Ellipse key={i} cx={cx} cy={cy} rx={rx} ry={ry} fill={`url(#mesh${i})`} />)}
      </Svg>
    </View>
  );
}

const WEB_BLUR = 'blur(16px) saturate(1.5)';

// Połysk panelu: pierwsze dziecko widoku z borderRadius i overflow hidden.
export function GlassFx({ radius = 14, backdrop = true }) {
  const ref = useRef(null);
  useEffect(() => {
    if (Platform.OS !== 'web' || !ref.current || !backdrop) return;
    ref.current.style.backdropFilter = WEB_BLUR;
    ref.current.style.webkitBackdropFilter = WEB_BLUR;
  }, [backdrop]);
  return (
    <>
      {Platform.OS === 'web' && backdrop ? <View ref={ref} pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: radius, zIndex: -1 }]} /> : null}
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <LinearGradient id="lt-gloss" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#ffffff" stopOpacity={0.16} />
            <Stop offset="0.4" stopColor="#ffffff" stopOpacity={0.06} />
            <Stop offset="1" stopColor="#ffffff" stopOpacity={0.03} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" rx={radius} ry={radius} fill="url(#lt-gloss)" />
      </Svg>
    </>
  );
}

// Wspólny styl ramki szklanego panelu: 1 px jasnej ramki dookoła (bez osobnej linii u góry).
export const glassFrame = (t, radius = 14) => ({
  borderRadius: radius,
  overflow: 'hidden',
  borderWidth: 1,
  borderColor: t.glassLine,
});

export const Glass = forwardRef(function Glass({ style, radius = 18, blurTarget, intensity = 40, children, ...rest }, outerRef) {
  const t = useTheme();
  const webRef = useRef(null);

  useEffect(() => {
    if (Platform.OS !== 'web' || !webRef.current) return;
    const el = webRef.current;
    el.style.backdropFilter = WEB_BLUR;
    el.style.webkitBackdropFilter = WEB_BLUR;
    el.style.boxShadow = 'inset 0 1px 12px rgba(255,255,255,.07), 0 10px 26px rgba(0,0,0,.4)';
  }, []);

  const frame = [style, glassFrame(t, radius)];

  if (Platform.OS === 'web') {
    return (
      <View
        ref={(el) => { webRef.current = el; if (typeof outerRef === 'function') outerRef(el); else if (outerRef) outerRef.current = el; }}
        style={[frame, { backgroundColor: t.glassTint }]}
        {...rest}
      >
        <GlassFx radius={radius} backdrop={false} />
        {children}
      </View>
    );
  }

  return (
    <View ref={outerRef} style={frame} {...rest}>
      <BlurView
        blurTarget={blurTarget}
        blurMethod="dimezisBlurViewSdk31Plus"
        intensity={intensity}
        tint="dark"
        style={StyleSheet.absoluteFill}
      />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: t.glassTint }]} pointerEvents="none" />
      <GlassFx radius={radius} backdrop={false} />
      {children}
    </View>
  );
});

// Obracająca się świecąca krawędź: za kartą kręci się kwadrat z gradientem w kolorach kategorii, karta
// przykrywa środek, widać tylko brzeg. CSS robi to przez @property + conic-gradient; tu obracamy
// gradient liniowy (natywny driver animacji).
const GLOW_COLORS = ['#6d8cff', '#a875ff', '#ff6fa3', '#ffa23a', '#6d8cff'];

export function GlowBorder({ radius = 14, width = 1.5, colors = GLOW_COLORS, duration = 4000, style, innerStyle, children }) {
  const [size, setSize] = useState(null);
  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(spin, { toValue: 1, duration, easing: Easing.linear, useNativeDriver: Platform.OS !== 'web' }));
    loop.start();
    return () => loop.stop();
  }, [spin, duration]);
  const side = size ? Math.ceil(Math.hypot(size.w, size.h)) : 0;
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  return (
    <View
      style={[{ borderRadius: radius, overflow: 'hidden', padding: width }, style]}
      onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
    >
      {size ? (
        <Animated.View pointerEvents="none" style={{ position: 'absolute', width: side, height: side, left: (size.w - side) / 2, top: (size.h - side) / 2, transform: [{ rotate }] }}>
          <Svg width="100%" height="100%">
            <Defs>
              <LinearGradient id="lt-glow" x1="0" y1="0" x2="1" y2="0">
                {colors.map((c, i) => <Stop key={i} offset={i / (colors.length - 1)} stopColor={c} stopOpacity={1} />)}
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#lt-glow)" />
          </Svg>
        </Animated.View>
      ) : null}
      <View style={[{ borderRadius: radius - width, overflow: 'hidden', backgroundColor: '#16131f' }, innerStyle]}>{children}</View>
    </View>
  );
}
