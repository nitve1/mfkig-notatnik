// Historia ceny w karcie modelu (wariant B z makiety mockups/history.png, wybór z 2026-10-14):
// dwie linie schodkowe, najtaniej gdziekolwiek i u Ciebie, legenda, zakres 7 / 30 / 90 dni, dymek po dotknięciu,
// pod wykresem ile przepłacasz. Dane: core/history.js (zapis na telefonie + historia z serwera).
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { DEFAULT_USAGE, formatUsd, offerKey, platformOf } from '../../core/pricing.js';
import { dayOf, historyStart, priceSeries } from '../../core/history.js';
import { formatNumber, getLanguage, t as tr } from '../../core/i18n.js';
import { Card, Row, Segmented, T } from './ui';
import { font, radius, useTheme } from './theme';
import { useHistory } from './history';

const H = 140;
const PL = 40; // miejsce na podpisy osi
const PR = 8;
const PT = 10;
const PB = 22;
const DAY = 86400 * 1000;

function niceTop(max) {
  if (!(max > 0)) return 1;
  const pow = 10 ** Math.floor(Math.log10(max));
  for (const k of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (k * pow >= max * 1.1) return k * pow;
  return 10 * pow;
}

const dayLabel = (day) => {
  try {
    return new Date(day * DAY).toLocaleDateString(getLanguage(), { day: 'numeric', month: 'short', timeZone: 'UTC' });
  } catch {
    const d = new Date(day * DAY);
    return `${d.getUTCDate()}.${d.getUTCMonth() + 1}`;
  }
};

// Linia schodkowa: każdy dzień ma swój odcinek [x(i), x(i + 1)], więc zmiana ceny dziś też jest widoczna.
// Przerwa tam, gdzie brak danych.
function stepPath(points, key, x, y) {
  let d = '';
  let prev = null;
  points.forEach((p, i) => {
    const v = p[key];
    if (v == null) { prev = null; return; }
    d += prev == null ? `M${x(i)},${y(v)}` : `V${y(v)}`;
    d += `H${x(i + 1)}`;
    prev = v;
  });
  return d;
}

export default function PriceChart({ model, usage = DEFAULT_USAGE, used = null, isFav = null, favCount = 0, allow = null, pro = false }) {
  const t = useTheme();
  const history = useHistory();
  const [days, setDays] = useState(30);
  const [w, setW] = useState(0);
  const [pick, setPick] = useState(null);

  const byKey = useMemo(() => new Map(model.offers.map((o) => [offerKey(o), o])), [model]);
  const usedKey = used ? offerKey(used) : null;
  const mine = usedKey ? (k) => k === usedKey : favCount && isFav ? (k) => { const o = byKey.get(k); return !!o && isFav(o); } : null;
  const mineLabel = used ? (pro ? used.provider : platformOf(used) ?? used.provider) : mine ? tr('history.yourFavs') : null;
  const allowKey = allow ? (k) => { const o = byKey.get(k); return o ? allow(o) : true; } : null;

  const today = dayOf(Date.now());
  const start = history ? historyStart(history, model.id) : null;
  const points = useMemo(
    () => (history ? priceSeries(history, model, { days, today, usage, mine, allow: allowKey }) : []),
    [history, model, days, today, usage, usedKey, favCount, allow], // eslint-disable-line react-hooks/exhaustive-deps
  );

  if (!history) return null;
  const known = points.filter((p) => p.best != null).length;
  // Za mało danych na wykres (np. tuż po instalacji, zanim serwer doda swoją historię).
  if (start == null || today - start < 1 || known < 2) {
    return (
      <Card>
        <T kind="strong">{tr('history.title')}</T>
        <T kind="small" color="ink2" style={{ marginTop: 4 }}>{tr('history.collecting')}</T>
      </Card>
    );
  }

  const vals = points.flatMap((p) => [p.best, p.mine]).filter((v) => v != null);
  const top = niceTop(Math.max(...vals));
  const dec = top < 0.1 ? 3 : top < 10 ? 2 : 0;
  const W = w || 300;
  const x = (i) => PL + (i / points.length) * (W - PL - PR);
  const y = (v) => PT + (1 - v / top) * (H - PT - PB);
  const last = points[points.length - 1];
  const hasMine = !!mine && points.some((p) => p.mine != null);

  const name = (k) => {
    const o = k && byKey.get(k);
    if (o) return pro ? o.provider : platformOf(o) ?? o.provider;
    return k ? k.slice(k.indexOf(':') + 1).split('/')[0] : '';
  };
  const unitTxt = tr(`history.per.${model.unit}`);
  const per = model.unit === 'token' ? (usage.token?.in ?? 0) + (usage.token?.out ?? 0) : usage[model.unit]?.count ?? 0;
  const diff = hasMine && last.mine != null && last.best != null ? last.mine - last.best : null;

  const onTouch = (e) => {
    const lx = e.nativeEvent.locationX;
    const i = Math.floor(((lx - PL) / (W - PL - PR)) * points.length);
    setPick(Math.max(0, Math.min(points.length - 1, i)));
  };
  const p = pick != null ? points[pick] : null;
  const px = pick != null ? x(pick + 0.5) : 0; // środek dnia

  // Etykiety cen na końcu linii: wyższa cena nad swoją linią, niższa pod (albo nad, gdy brak miejsca przy osi).
  const LH = 18;
  const bottom = H - PB;
  const hiMine = hasMine && last.mine != null && (last.best == null || last.mine >= last.best);
  const place = (v, above) => {
    const yl = y(v);
    return above || yl + 2 + LH > bottom ? yl - LH - 2 : yl + 2;
  };
  let yMine = hasMine && last.mine != null ? place(last.mine, hiMine) : null;
  let yBest = last.best != null ? place(last.best, !hiMine && hasMine) : null;
  if (yMine != null && yBest != null && Math.abs(yMine - yBest) < LH) {
    // Za blisko: rozsuwamy, wyższa cena wyżej.
    const mid = (yMine + yBest) / 2;
    if (hiMine) { yMine = mid - LH / 2 - 1; yBest = mid + LH / 2 + 1; } else { yBest = mid - LH / 2 - 1; yMine = mid + LH / 2 + 1; }
  }

  return (
    <Card>
      <T kind="strong">{tr('history.title')}</T>
      <T kind="tiny" color="ink3" style={{ marginTop: 2, marginBottom: 8 }}>{unitTxt}</T>
      <Segmented
        value={days}
        onChange={(v) => { setDays(v); setPick(null); }}
        options={[7, 30, 90].map((n) => ({ value: n, label: tr('history.days', { n }) }))}
      />
      {hasMine ? (
        <Row style={{ gap: 14, marginTop: 10, flexWrap: 'wrap' }}>
          <Row style={{ gap: 6 }}><View style={[s.key, { backgroundColor: t.chartBest }]} /><T kind="tiny" color="ink2">{tr('history.best')}</T></Row>
          <Row style={{ gap: 6 }}><View style={[s.key, { backgroundColor: t.chartMine }]} /><T kind="tiny" color="ink2">{tr('history.mine', { name: mineLabel })}</T></Row>
        </Row>
      ) : null}
      <View
        style={{ height: H, marginTop: 8 }}
        onLayout={(e) => setW(e.nativeEvent.layout.width)}
        onStartShouldSetResponder={() => true}
        onResponderGrant={onTouch}
        onResponderMove={onTouch}
        onResponderTerminationRequest={() => true}
        accessible
        accessibilityRole="image"
        accessibilityLabel={tr('history.a11y', { n: days, now: formatUsd(last.best), min: formatUsd(Math.min(...points.map((q) => q.best ?? Infinity))) })}
      >
        {w ? (
          <Svg width={W} height={H}>
            {[0, top / 2, top].map((v) => <Line key={v} x1={PL} x2={W - PR} y1={y(v)} y2={y(v)} stroke={t.chartGrid} strokeWidth={1} />)}
            {hasMine ? <Path d={stepPath(points, 'mine', x, y)} stroke={t.chartMine} strokeWidth={2} fill="none" /> : null}
            <Path d={stepPath(points, 'best', x, y)} stroke={t.chartBest} strokeWidth={2} fill="none" />
            {p ? (
              <>
                <Line x1={px} x2={px} y1={PT} y2={H - PB} stroke="rgba(255,255,255,0.35)" strokeDasharray="3 3" />
                {p.mine != null && hasMine ? <Circle cx={px} cy={y(p.mine)} r={4.5} fill={t.chartMine} stroke={t.bg} strokeWidth={2} /> : null}
                {p.best != null ? <Circle cx={px} cy={y(p.best)} r={4.5} fill={t.chartBest} stroke={t.bg} strokeWidth={2} /> : null}
              </>
            ) : null}
          </Svg>
        ) : null}
        {w ? [0, top / 2, top].map((v) => (
          <T key={v} kind="tiny" color="ink3" style={[s.axis, { top: y(v) - 8, width: PL - 6 }]}>{formatNumber(v, dec)}</T>
        )) : null}
        {w ? (
          <>
            <T kind="tiny" color="ink3" style={[s.date, { left: PL }]}>{dayLabel(points[0].day)}</T>
            <T kind="tiny" color="ink3" style={[s.date, { right: PR }]}>{tr('history.today')}</T>
            {yMine != null ? <T kind="tiny" style={[s.end, { top: yMine, right: PR }]}>{formatUsd(last.mine)}</T> : null}
            {yBest != null ? <T kind="tiny" style={[s.end, { top: yBest, right: PR }]}>{formatUsd(last.best)}</T> : null}
          </>
        ) : null}
        {p && w ? (
          <View pointerEvents="none" style={[s.tip, { backgroundColor: t.cardSolid, borderColor: t.glassLine, left: Math.max(0, Math.min(W - 176, px + (px > W / 2 ? -184 : 8))) }]}>
            <T kind="tiny">{dayLabel(p.day)}</T>
            <T kind="tiny" color="ink2">{tr('history.tipBest', { price: formatUsd(p.best), name: name(p.bestKey) })}</T>
            {hasMine ? <T kind="tiny" color="ink2">{p.mine != null ? tr('history.tipMine', { price: formatUsd(p.mine) }) : tr('history.tipNoMine')}</T> : null}
          </View>
        ) : null}
      </View>
      {diff != null ? (
        <T kind="small" color="ink2" style={{ marginTop: 6 }}>
          {diff > 0.0000001
            ? tr('history.overpay', { diff: formatUsd(diff), unit: tr(`history.unitShort.${model.unit}`), month: formatUsd(diff * per) })
            : tr('history.bestAlready')}
        </T>
      ) : !mine ? (
        <T kind="tiny" color="ink3" style={{ marginTop: 6 }}>{tr('history.pickHint')}</T>
      ) : null}
    </Card>
  );
}

const s = StyleSheet.create({
  key: { width: 14, height: 3, borderRadius: 2 },
  axis: { position: 'absolute', left: 0, textAlign: 'right' },
  date: { position: 'absolute', bottom: 0 },
  end: { position: 'absolute', fontFamily: font.textBold },
  tip: { position: 'absolute', top: 0, width: 176, borderWidth: 1, borderRadius: radius.xs, paddingHorizontal: 8, paddingVertical: 6 },
});
