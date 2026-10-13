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
import { forwardRef, useEffect, useRef } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { BlurTargetView, BlurView } from 'expo-blur';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
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

// Świecące plamy kategorii: tekst u góry z lewej, kod z prawej, obraz niżej, wideo na dole i w rogu.
const BLOBS = [
  ['text', '8%', '20%', '48%', 0.55],
  ['coding', '98%', '40%', '42%', 0.5],
  ['image', '10%', '70%', '44%', 0.45],
  ['video', '96%', '92%', '40%', 0.5],
  ['video', '80%', '-4%', '30%', 0.32],
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

// Wykończenie szklanego panelu: wstaw jako pierwsze dziecko widoku z borderRadius i overflow hidden.
export function GlassFx({ radius = 14, edge = true }) {
  const t = useTheme();
  return (
    <>
      <View pointerEvents="none" style={[s.sheen, { borderTopLeftRadius: radius, borderTopRightRadius: radius, backgroundColor: t.glassSheen }]} />
      {edge ? <View pointerEvents="none" style={[s.edge, { left: radius * 0.6, right: radius * 0.6, backgroundColor: t.glassEdge }]} /> : null}
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
    el.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,.28), inset 0 -1px 0 rgba(0,0,0,.35), 0 10px 30px rgba(0,0,0,.45)';
  }, []);

  const frame = [style, glassFrame(t, radius)];

  if (Platform.OS === 'web') {
    return (
      <View
        ref={(el) => { webRef.current = el; if (typeof outerRef === 'function') outerRef(el); else if (outerRef) outerRef.current = el; }}
        style={[frame, { backgroundColor: t.glassTint }]}
        {...rest}
      >
        <GlassFx radius={radius} edge={false} />
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
      <GlassFx radius={radius} />
      {children}
    </View>
  );
});

const s = StyleSheet.create({
  sheen: { position: 'absolute', left: 0, right: 0, top: 0, height: '46%' },
  edge: { position: 'absolute', top: 0, height: 1 },
});
