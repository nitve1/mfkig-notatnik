import { Pressable, StyleSheet, View } from 'react-native';
import { CATEGORIES, formatUsd, platformOf, promoAgeDays, timeAgo } from '../../core/pricing.js';
import { Card, CatChip, IconButton, PctBadge, Progress, Row, T } from './ui';
import { mainCat, space, useTheme } from './theme';

export const CAT_LABEL = Object.fromEntries(CATEGORIES.map((c) => [c.key, c.label]));
export const CAT_ICON = { all: 'all', text: 'text', coding: 'coding', image: 'image', video: 'video' };

export const shortName = (name) => name.replace(/^[^:]+:\s*/, '');
// Ładna nazwa twórcy: "Z.ai: GLM 5.2" -> "Z.ai", w ostateczności id autora.
export const authorName = (m) => (m.name.includes(':') ? m.name.split(':')[0].trim() : m.author);

// Cena "do pokazania" i jednostka.
export function priceParts(o) {
  if (!o) return { main: '–', unit: '' };
  if (o.unit === 'token') return { main: formatUsd(o.in), unit: '/ 1M wej.' };
  return { main: formatUsd(o.price), unit: o.unit === 'image' ? '/ obraz' : '/ s' };
}

export function daysLabel(p) {
  const d = promoAgeDays(p);
  if (!p.sinceKnown && d < 1) return 'od startu pomiarów';
  if (d < 1) return `od ${Math.max(1, Math.round(d * 24))} h`;
  return `od ${Math.round(d)} d`;
}

// Karta promocji: pasek w kolorze kategorii, nazwa, cena, kategoria i dostawca, zniżka.
export function DealCard({ deal, onPress, watched, pro = true }) {
  const t = useTheme();
  const m = deal.model;
  const cat = mainCat(m);
  const p = priceParts(deal.offer);
  return (
    <Card stripe={t[cat]} onPress={onPress} accessibilityLabel={`${m.name}, ${deal.type === 'free' ? 'darmowy' : `minus ${deal.pct} procent`}`}>
      <Row style={{ alignItems: 'flex-start' }}>
        <View style={{ flex: 1, gap: 4 }}>
          <T kind="strong" numberOfLines={2}>
            {shortName(m.name)}
            {watched ? <T kind="strong" style={{ color: t.video }}> ★</T> : null}
          </T>
          <CatChip cat={cat} label={CAT_LABEL[cat]} extra={deal.type === 'free' ? m.author : pro || platformOf(deal.offer) === deal.offer.provider ? deal.offer.provider : `${platformOf(deal.offer)}, przez ${deal.offer.provider}`} />
        </View>
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          {deal.type === 'free' ? (
            <T kind="num" style={{ color: t.save }}>0 $</T>
          ) : (
            <T kind="num">{p.main}</T>
          )}
          {deal.type === 'free' ? (
            <T kind="tiny" color="save">za darmo</T>
          ) : (
            <PctBadge pct={deal.pct} />
          )}
        </View>
      </Row>
      <T kind="tiny" color="ink3" style={{ marginTop: 6 }}>
        {deal.type === 'free' ? `wariant ${m.freeId}` : `${p.unit.replace('/ ', 'za ')}, ${deal.type === 'drop' ? 'obniżka' : 'zniżka'} ${daysLabel(deal)}`}
      </T>
    </Card>
  );
}

export function Header({ kicker, title, right }) {
  return (
    <Row style={{ alignItems: 'flex-end', marginBottom: space[3] }}>
      <View style={{ flex: 1 }}>
        {kicker ? <T kind="small" color="ink2">{kicker}</T> : null}
        <T kind="h1">{title}</T>
      </View>
      {right}
    </Row>
  );
}

export function BellButton({ onPress, dot }) {
  return <IconButton name="bell" label="Alerty" onPress={onPress} dot={dot} />;
}

// Stan cen: trwa sprawdzanie / kiedy ostatnio / czemu nie sprawdzamy. Dotknięcie = sprawdź teraz.
export function PriceStatus({ snapshot, status, onRefresh }) {
  const t = useTheme();
  const { refreshing, progress, error } = status ?? {};
  const age = snapshot ? timeAgo(snapshot.generatedAt) : '';
  let text;
  let color = t.save;
  if (refreshing) {
    text = progress != null ? `Sprawdzam ceny… ${Math.round(progress * 100)}%` : 'Sprawdzam ceny…';
    color = t.text;
  } else if (error === 'wifi-only') {
    text = `Czekam na Wi-Fi, ceny sprawdzone ${age}`;
    color = t.video;
  } else if (error) {
    text = `Brak połączenia, ceny sprawdzone ${age}`;
    color = t.deal;
  } else {
    text = `Ceny sprawdzone ${age}`;
  }
  return (
    <Pressable onPress={onRefresh} disabled={refreshing} accessibilityRole="button" accessibilityHint="Sprawdza ceny teraz" style={{ gap: 6 }}>
      <Row style={{ gap: 8 }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
        <T kind="small" color="ink2" style={{ flex: 1 }}>{text}</T>
        {!refreshing ? <T kind="small" style={{ color: t.text }}>Odśwież</T> : null}
      </Row>
      {refreshing && progress != null ? <Progress value={progress} color={t.text} /> : null}
    </Pressable>
  );
}

export const styles = StyleSheet.create({
  list: { padding: space[4], paddingBottom: space[7], gap: space[2] },
});
