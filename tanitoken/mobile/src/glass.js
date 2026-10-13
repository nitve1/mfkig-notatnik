// Szkło: panel, który ugina i rozmywa to, co pod nim, z jasną krawędzią od światła.
//
// Web (Chromium): prawdziwe załamanie. Filtr SVG z szumem (feTurbulence) przesuwa każdy piksel tła
// (feDisplacementMap), a backdrop-filter łączy to z rozmyciem. Safari nie obsługuje url() w
// backdrop-filter, więc tam zostaje samo rozmycie.
// Android/iOS: React Native nie daje dostępu do pikseli pod widokiem, więc natywnie jest rozmycie
// tła (expo-blur; Android 12+ przez RenderEffect, wymaga BlurTargetView), półprzezroczysty odcień,
// połysk u góry i 1 px jasnej krawędzi, które dają wrażenie grubości.
import { forwardRef, useEffect, useRef } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { BlurTargetView, BlurView } from 'expo-blur';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useTheme } from './theme';

export { BlurTargetView };

const FILTER_ID = 'tt-glass';

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

// Połysk: jasny u góry, zanika do połowy wysokości (światło padające z góry na grubą taflę).
function Sheen({ radius, opacity }) {
  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <LinearGradient id="sheen" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#ffffff" stopOpacity={opacity} />
          <Stop offset="0.45" stopColor="#ffffff" stopOpacity={0} />
          <Stop offset="1" stopColor="#ffffff" stopOpacity={opacity * 0.25} />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" rx={radius} ry={radius} fill="url(#sheen)" />
    </Svg>
  );
}

export const Glass = forwardRef(function Glass({ style, radius = 24, blurTarget, intensity = 45, children, ...rest }, outerRef) {
  const t = useTheme();
  const webRef = useRef(null);

  useEffect(() => {
    if (Platform.OS !== 'web' || !webRef.current) return;
    ensureWebFilter();
    const el = webRef.current;
    const base = `blur(18px) saturate(1.8) brightness(${t.dark ? 0.9 : 1.06})`;
    const value = canRefract() ? `url(#${FILTER_ID}) ${base}` : base;
    el.style.backdropFilter = value;
    el.style.webkitBackdropFilter = base;
    el.style.boxShadow = t.dark
      ? 'inset 0 1px 0 rgba(255,255,255,.22), inset 0 -1px 0 rgba(0,0,0,.35), 0 10px 30px rgba(0,0,0,.45)'
      : 'inset 0 1px 0 rgba(255,255,255,.95), inset 0 -1px 0 rgba(26,21,48,.06), 0 10px 30px rgba(26,21,48,.14)';
  }, [t.dark]);

  const frame = [style, { borderRadius: radius, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: t.glassLine }];

  if (Platform.OS === 'web') {
    return (
      <View
        ref={(el) => { webRef.current = el; if (typeof outerRef === 'function') outerRef(el); else if (outerRef) outerRef.current = el; }}
        style={[frame, { backgroundColor: t.glassTint }]}
        {...rest}
      >
        <Sheen radius={radius} opacity={t.glassSheen * 0.6} />
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
        tint={t.dark ? 'dark' : 'light'}
        style={StyleSheet.absoluteFill}
      />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: t.glassTint }]} pointerEvents="none" />
      <Sheen radius={radius} opacity={t.glassSheen} />
      {/* 1 px jasnej krawędzi od światła: to ona robi z prostokąta taflę z grubością. */}
      <View pointerEvents="none" style={[s.edge, { left: radius * 0.6, right: radius * 0.6, backgroundColor: t.glassEdge }]} />
      {children}
    </View>
  );
});

const s = StyleSheet.create({
  edge: { position: 'absolute', top: 0, height: 1 },
});
