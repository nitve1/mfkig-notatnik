// Szkło "Nocne szkło".
//
// Backdrop: nieruchome tło apki, ciemne ze świecącymi plamami kolorów kategorii (SVG, rysowane raz).
// GlassFx: wykończenie panelu (połysk górnej połowy i 1 px jasnej krawędzi), tanie, bez rozmycia.
//   Panele leżą na nieruchomym, już rozmytym tle, więc półprzezroczysty odcień + połysk wygląda jak
//   matowe szkło, a nie kosztuje rozmycia na każdej karcie listy.
// Glass: prawdziwe szkło dla elementów nad przewijaną treścią (pasek zakładek).
//   Web (Chromium): filtr SVG feTurbulence + feDisplacementMap w backdrop-filter razem z blur, czyli
//   tło się ugina. Safari nie obsługuje url() w backdrop-filter, więc tam samo rozmycie.
//   Android/iOS: expo-blur (Android 12+ przez BlurTargetView i RenderEffect). React Native nie daje
//   pikseli spod widoku, więc natywnie bez ugięcia.
import { forwardRef, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';
import { BlurTargetView, BlurView } from 'expo-blur';
import Svg, { Circle, Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';
import { useTheme } from './theme';

export { BlurTargetView };

const FILTER_ID = 'lt-glass';

function ensureWebFilter() {
  if (typeof document === 'undefined' || document.getElementById(FILTER_ID)) return;
  const wrap = document.createElement('div');
  wrap.setAttribute('aria-hidden', 'true');
  wrap.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
  wrap.innerHTML = `<svg width="0" height="0"><filter id="${FILTER_ID}" x="0%" y="0%" width="100%" height="100%" color-interpolation-filters="sRGB">
    <feTurbulence type="fractalNoise" baseFrequency="0.011 0.017" numOctaves="2" seed="11" result="noise"/>
    <feGaussianBlur in="noise" stdDeviation="2" result="soft"/>
    <feDisplacementMap in="SourceGraphic" in2="soft" scale="34" xChannelSelector="R" yChannelSelector="G"/>
  </filter></svg>`;
  document.body.appendChild(wrap);
}

const canRefract = () =>
  typeof navigator !== 'undefined' && /Chrome|Chromium|Edg\//.test(navigator.userAgent) && !/Firefox/.test(navigator.userAgent);

// Ciepłe plamy w tle (pomarańcz i róż kategorii wideo i obrazu); bez typowego gradientu fiolet-niebieski.
const BLOBS = [
  ['video', '92%', '6%', '46%', 0.42],
  ['image', '4%', '78%', '46%', 0.36],
  ['video', '100%', '62%', '30%', 0.18],
  ['text', '0%', '30%', '30%', 0.14],
];

export function Backdrop() {
  const t = useTheme();
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: t.bg }]} pointerEvents="none">
      <Svg width="100%" height="100%">
        <Defs>
          {BLOBS.map(([c, , , , o], i) => (
            <RadialGradient key={i} id={`blob${i}`} cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={t[c]} stopOpacity={o} />
              <Stop offset="0.55" stopColor={t[c]} stopOpacity={o * 0.35} />
              <Stop offset="1" stopColor={t[c]} stopOpacity={0} />
            </RadialGradient>
          ))}
        </Defs>
        {BLOBS.map(([, cx, cy, r], i) => <Circle key={i} cx={cx} cy={cy} r={r} fill={`url(#blob${i})`} />)}
      </Svg>
    </View>
  );
}

// Wykończenie szklanego panelu (pierwsze dziecko widoku z borderRadius i overflow hidden).
// Bez ostrych linii: łagodny, ukośny odblask światła, który zanika w głąb tafli.
// Web (Chromium): dodatkowo prawdziwe szkło, czyli tło pod panelem rozmyte i ugięte filtrem SVG.
export function GlassFx({ radius = 14, backdrop = true }) {
  const ref = useRef(null);
  useEffect(() => {
    if (Platform.OS !== 'web' || !ref.current || !backdrop) return;
    ensureWebFilter();
    const v = canRefract() ? `blur(12px) url(#${FILTER_ID}) saturate(1.6)` : 'blur(12px) saturate(1.6)';
    ref.current.style.backdropFilter = v;
    ref.current.style.webkitBackdropFilter = 'blur(12px) saturate(1.6)';
  }, []);
  return (
    <>
      {Platform.OS === 'web' && backdrop ? <View ref={ref} pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: radius, zIndex: -1 }]} /> : null}
      <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <LinearGradient id="lt-sheen" x1="0" y1="0" x2="0.75" y2="1">
            <Stop offset="0" stopColor="#ffffff" stopOpacity={0.09} />
            <Stop offset="0.55" stopColor="#ffffff" stopOpacity={0.015} />
            <Stop offset="1" stopColor="#ffffff" stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" rx={radius} ry={radius} fill="url(#lt-sheen)" />
      </Svg>
    </>
  );
}

// Wspólny styl ramki szklanego panelu.
export const glassFrame = (t, radius = 14) => ({
  borderRadius: radius,
  overflow: 'hidden',
  borderWidth: StyleSheet.hairlineWidth,
  borderColor: t.glassLine,
});

export const Glass = forwardRef(function Glass({ style, radius = 16, blurTarget, intensity = 40, children, ...rest }, outerRef) {
  const t = useTheme();
  const webRef = useRef(null);

  useEffect(() => {
    if (Platform.OS !== 'web' || !webRef.current) return;
    ensureWebFilter();
    const el = webRef.current;
    const base = 'blur(18px) saturate(1.8) brightness(0.9)';
    el.style.backdropFilter = canRefract() ? `blur(18px) url(#${FILTER_ID}) saturate(1.8) brightness(0.9)` : base;
    el.style.webkitBackdropFilter = base;
    el.style.boxShadow = '0 10px 30px rgba(0,0,0,.45)';
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

// Obracająca się, świecąca krawędź (jak "premium glow border"): za kartą kręci się pas gradientu,
// a karta przykrywa środek, więc widać tylko świecący brzeg. CSS robi to przez @property i
// conic-gradient; w React Native obracamy kwadrat z gradientem liniowym (natywny driver animacji).
export function GlowBorder({ radius = 14, width = 1.5, colors = ['#ffa23a', '#ff6fa3'], duration = 4000, style, innerStyle, children }) {
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
                <Stop offset="0" stopColor={colors[0]} stopOpacity={0} />
                <Stop offset="0.35" stopColor={colors[0]} stopOpacity={0.15} />
                <Stop offset="0.5" stopColor="#ffffff" stopOpacity={0.95} />
                <Stop offset="0.65" stopColor={colors[1]} stopOpacity={0.15} />
                <Stop offset="1" stopColor={colors[1]} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#lt-glow)" />
          </Svg>
        </Animated.View>
      ) : null}
      <View style={[{ borderRadius: radius - width, overflow: 'hidden', backgroundColor: '#15122a' }, innerStyle]}>{children}</View>
    </View>
  );
}
