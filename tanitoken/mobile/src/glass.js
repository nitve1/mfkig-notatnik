// Szkło LightTokenz (wybory użytkownika z 2026-10-14, makiety w mockups/bg, panels, glow):
//
// Backdrop: tło "Kolory kategorii" stonowane do 40% (czytelność, audyt docs/czytelnosc-2026-10.md),
//   jeden obrazek JPG zamiast SVG.
// GlassFx / glassFrame: szkło "Połysk" na równym przyciemnieniu 55%. Rozmycia na kartach nie ma (lista
//   przewija się szybciej), prawdziwe rozmycie tylko na pasku zakładek (Glass).
// Glass: pasek nad przewijaną treścią; natywnie expo-blur (Android 12+), na webie backdrop-filter.
// GlowBorder: obracająca się świecąca krawędź w kolorach kategorii (kafel podsumowania).
import { forwardRef, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, Platform, StyleSheet, View } from 'react-native';
import { BlurTargetView, BlurView } from 'expo-blur';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useTheme } from './theme';

export { BlurTargetView };

// Tło jako jeden obrazek (scripts/backdrop.mjs): siatka gradientów kategorii stonowana do 40%.
const BACKDROP = require('../assets/backdrop.jpg');

export function Backdrop() {
  const t = useTheme();
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: t.bg }]} pointerEvents="none">
      <Image source={BACKDROP} style={StyleSheet.absoluteFill} resizeMode="cover" fadeDuration={0} />
    </View>
  );
}

const WEB_BLUR = 'blur(16px) saturate(1.5)';

// Połysk "C": płynnie od góry 0.12 → 0.05 → 0.03, bez ostrej linii.
// Telefon: natywny gradient w stylu widoku (experimental_backgroundImage, nowa architektura RN), bez
// dodatkowych warstw. Web: react-native-web go nie zna, więc tam rysuje go SVG w GlassFx.
export const GLOSS = 'linear-gradient(180deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.05) 40%, rgba(255,255,255,0.03) 100%)';
const nativeGloss = Platform.OS === 'web' ? null : { experimental_backgroundImage: GLOSS };

export function GlassFx({ radius = 14, backdrop = false }) {
  const ref = useRef(null);
  useEffect(() => {
    if (Platform.OS !== 'web' || !ref.current || !backdrop) return;
    ref.current.style.backdropFilter = WEB_BLUR;
    ref.current.style.webkitBackdropFilter = WEB_BLUR;
  }, [backdrop]);
  if (Platform.OS !== 'web') return null;
  return (
    <>
      {backdrop ? <View ref={ref} pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: radius, zIndex: -1 }]} /> : null}
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <LinearGradient id="lt-gloss" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#ffffff" stopOpacity={0.12} />
            <Stop offset="0.4" stopColor="#ffffff" stopOpacity={0.05} />
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
  ...nativeGloss,
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
