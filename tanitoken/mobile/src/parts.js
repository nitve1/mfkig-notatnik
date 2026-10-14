import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { formatUsd, platformOf, promoAgeDays, timeAgo } from '../../core/pricing.js';
import { t as tr } from '../../core/i18n.js';
import { Card, CatChip, IconButton, PctBadge, Progress, Row, T } from './ui';
import { font, mainCat, radius, space, useTheme } from './theme';
import { GlassFx, glassFrame } from './glass';

export const catLabel = (c) => tr(`cat.${c}`);
export const CAT_ICON = { all: 'all', text: 'text', coding: 'coding', image: 'image', video: 'video' };

export const shortName = (name) => name.replace(/^[^:]+:\s*/, '');
// Ładna nazwa twórcy: "Z.ai: GLM 5.2" -> "Z.ai", w ostateczności id autora.
export const authorName = (m) => (m.name.includes(':') ? m.name.split(':')[0].trim() : m.author);

// Cena "do pokazania" i jednostka.
export function priceParts(o) {
  if (!o) return { main: '–', unit: '' };
  // Darmowe wejście i płatne wyjście (np. modele obrazów liczone w tokenach): pokazujemy cenę wyjścia.
  if (o.unit === 'token' && o.in === 0 && o.out > 0) return { main: formatUsd(o.out), unit: tr('unit.perMOut'), unitShort: '' };
  if (o.unit === 'token') return { main: formatUsd(o.in), unit: tr('unit.perMIn'), unitShort: '' };
  return {
    main: formatUsd(o.price),
    unit: tr(o.unit === 'image' ? 'unit.perImage' : 'unit.perSecond'),
    unitShort: o.unit === 'second' ? '/s' : '',
  };
}

export function daysLabel(p) {
  const d = promoAgeDays(p);
  if (!p.sinceKnown && d < 1) return tr('promo.sinceStart');
  if (d < 1) return tr('promo.sinceHours', { n: Math.max(1, Math.round(d * 24)) });
  return tr('promo.sinceDays', { n: Math.round(d) });
}

// Karta promocji: pasek w kolorze kategorii, nazwa, cena, kategoria i dostawca, zniżka.
export function DealCard({ deal, onPress, watched, pro = true }) {
  const t = useTheme();
  const m = deal.model;
  const cat = mainCat(m);
  const p = priceParts(deal.offer);
  return (
    <Card stripe={t[cat]} onPress={onPress} accessibilityLabel={`${m.name}, ${deal.type === 'free' ? tr('deal.free') : deal.type === 'cheapest' ? `${p.main} ${p.unit}` : `−${deal.pct}%`}`}>
      <Row style={{ alignItems: 'flex-start' }}>
        <View style={{ flex: 1, gap: 4 }}>
          <T kind="strong" numberOfLines={2}>
            {shortName(m.name)}
            {watched ? <T kind="strong" style={{ color: t.video }}> ★</T> : null}
          </T>
          <CatChip cat={cat} label={catLabel(cat)} extra={deal.type === 'free' ? m.author : pro || platformOf(deal.offer) === deal.offer.provider ? deal.offer.provider : tr('offer.via', { platform: platformOf(deal.offer), provider: deal.offer.provider })} />
        </View>
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          {deal.type === 'free' ? (
            <T kind="num" style={{ color: t.save }}>{formatUsd(0)}</T>
          ) : (
            <T kind="num">{p.main}</T>
          )}
          {deal.type === 'free' ? (
            <T kind="tiny" color="save">{tr('deal.free')}</T>
          ) : deal.type === 'cheapest' ? (
            <T kind="tiny" color="ink2">{tr('deal.offers', { n: deal.count })}</T>
          ) : (
            <PctBadge pct={deal.pct} />
          )}
        </View>
      </Row>
      <T kind="tiny" color="ink3" style={{ marginTop: 6 }}>
        {deal.type === 'free' ? tr('deal.variant', { id: m.freeId }) : deal.type === 'cheapest' ? tr('deal.cheapestLine', { unit: p.unit }) : tr(deal.type === 'drop' ? 'deal.dropLine' : 'deal.discountLine', { unit: p.unit, since: daysLabel(deal) })}
      </T>
    </Card>
  );
}

// Karta partnera między ofertami: wyraźnie oznaczona, osobny wygląd (nie udaje wiersza cennika).
export function SponsorCard({ sponsor }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={() => Linking.openURL(sponsor.url)}
      accessibilityRole="link"
      accessibilityLabel={`${tr('ad.label')}: ${sponsor.name}`}
      style={({ pressed }) => [glassFrame(t, radius.lg), { backgroundColor: t.card, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, opacity: pressed ? 0.85 : 1 }]}
    >
      <GlassFx radius={radius.lg} />
      <View style={{ width: 44, height: 44, borderRadius: radius.sm, backgroundColor: sponsor.color, alignItems: 'center', justifyContent: 'center' }}>
        <T kind="h2" style={{ color: '#fff' }}>{sponsor.logo}</T>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <T kind="tiny" color="ink3" style={{ letterSpacing: 0.5, textTransform: 'uppercase' }}>{tr('ad.label')}</T>
        <T kind="strong">{sponsor.name}</T>
        <T kind="small" color="ink2" numberOfLines={2}>{tr(sponsor.tagline)}</T>
      </View>
      <View style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.xs, backgroundColor: t.glassActive }}>
        <T kind="small" style={{ fontFamily: font.textBold }}>{tr('ad.cta')}</T>
      </View>
    </Pressable>
  );
}

export function Header({ kicker, title, right }) {
  return (
    <Row style={{ alignItems: 'flex-start', marginBottom: space[3] }}>
      <View style={{ flex: 1 }}>
        <T kind="h1">{title}</T>
        {/* Dopisek pod tytułem, nie nad nim (bez "eyebrow" typowego dla stron z AI). */}
        {kicker ? <T kind="small" color="ink2" style={{ marginTop: 2 }}>{kicker}</T> : null}
      </View>
      {right}
    </Row>
  );
}

export function BellButton({ onPress, dot }) {
  return <IconButton name="bell" label={tr('nav.alerts')} onPress={onPress} dot={dot} />;
}

// Stan cen: trwa sprawdzanie / kiedy ostatnio / czemu nie sprawdzamy. Dotknięcie = sprawdź teraz.
export function PriceStatus({ snapshot, status, onRefresh }) {
  const t = useTheme();
  const { refreshing, progress, error } = status ?? {};
  const age = snapshot ? timeAgo(snapshot.generatedAt) : '';
  let text;
  let color = t.save;
  if (refreshing) {
    text = progress != null ? tr('status.checkingPct', { pct: Math.round(progress * 100) }) : tr('status.checking');
    color = t.text;
  } else if (error === 'wifi-only') {
    text = tr('status.waitWifi', { age });
    color = t.video;
  } else if (error) {
    text = tr('status.offline', { age });
    color = t.deal;
  } else {
    text = tr('status.checked', { age });
  }
  return (
    <Pressable onPress={onRefresh} disabled={refreshing} accessibilityRole="button" accessibilityHint={tr('status.hint')} style={[{ gap: 6, paddingVertical: 10, paddingHorizontal: 14, backgroundColor: t.card }, glassFrame(t, radius.md)]}>
      <GlassFx radius={radius.md} />
      <Row style={{ gap: 8 }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
        <T kind="small" color="ink2" style={{ flex: 1 }}>{text}</T>
        {!refreshing ? <T kind="small" style={{ color: t.text }}>{tr('status.refresh')}</T> : null}
      </Row>
      {refreshing && progress != null ? <Progress value={progress} color={t.text} /> : null}
    </Pressable>
  );
}

export const styles = StyleSheet.create({
  list: { padding: space[4], gap: space[2] },
});
