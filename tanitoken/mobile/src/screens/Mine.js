import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { formatDays, formatOfferPrice, formatUsd, promoAgeDays, promoAgeText, timeAgo, watchStatus } from '../../../core/pricing.js';
import { Button, Empty, MiniTag, Row, T } from '../ui';
import { Header, priceParts } from '../parts';
import { radius, space, useTheme } from '../theme';
import { useProfile } from '../profile';
import { favoritesFilter } from '../alerts';

const KIND_LABEL = {
  'promo-start': 'Nowa promocja',
  'promo-end': 'Koniec promocji',
  'promo-aging': 'Promocja może się kończyć',
  cheaper: 'Taniej gdzie indziej',
  expires: 'Model znika',
};

// Karta modelu, którego używam: czy jestem w promocji, ile przepłacam, co się skończyło.
function UsingCard({ status, item, onOpen }) {
  const t = useTheme();
  const { profile } = useProfile();
  const { model, used, usedPromo, best, overpayPct, usedCost, bestCost, typicalDays, ended } = status;
  const lastEnd = ended.find((e) => e.key === item.offerKey);
  const aging = usedPromo && typicalDays && promoAgeDays(usedPromo) >= typicalDays * 0.8;
  let line;
  let tone = 'ink2';
  if (!used) {
    line = 'Ten dostawca nie sprzedaje już modelu. Wybierz innego.';
    tone = 'promo';
  } else if (usedPromo) {
    line = `Jesteś w promocji −${usedPromo.pct}%, ${promoAgeText(usedPromo)}.`;
    if (aging) {
      line += ` U ${usedPromo.provider} zniżki trwają zwykle ok. ${formatDays(typicalDays)}, może się zaraz skończyć.`;
      tone = 'promo';
    } else if (typicalDays) line += ` Zwykle trwają ok. ${formatDays(typicalDays)}.`;
  } else if (lastEnd) {
    line = `Promocja skończyła się ${timeAgo(lastEnd.endedAt)}. Płacisz pełną cenę.`;
    tone = 'promo';
  } else {
    line = 'Płacisz cenę regularną.';
  }
  return (
    <Pressable onPress={() => onOpen(model.id)} accessibilityRole="button" style={[s.card, { backgroundColor: t.sheet, borderColor: aging || lastEnd ? t.promo : t.rule }]}>
      <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <T kind="h3">{model.name}</T>
          <T kind="small" color="ink3">u {used?.provider ?? 'nieznanego dostawcy'}</T>
        </View>
        {used ? <MiniTag pct={usedPromo?.pct} price={priceParts(used).main} unit={priceParts(used).unit} /> : null}
      </Row>
      <T kind="small" color={tone} style={{ marginTop: space[2] }}>{line}</T>
      {used && best && overpayPct >= 5 ? (
        <T kind="small" style={{ marginTop: space[1], color: t.save }}>
          {best.provider} jest tańszy o {overpayPct}%{profile.providers.length ? ' (wśród ulubionych)' : ''}: {formatUsd(bestCost)} zamiast {formatUsd(usedCost)} miesięcznie.
        </T>
      ) : used && best ? (
        <T kind="small" color="ink3" style={{ marginTop: space[1] }}>To najtańsza oferta dla Twojego zużycia.</T>
      ) : null}
    </Pressable>
  );
}

export default function Mine({ snapshot, onOpen, onGoSearch, onGoProfile }) {
  const t = useTheme();
  const { profile } = useProfile();
  const statuses = useMemo(
    () => profile.watchlist
      .map((item) => ({ item, status: watchStatus(snapshot, item, profile.usage, favoritesFilter(profile)) }))
      .filter((x) => x.status.model),
    [snapshot, profile.watchlist, profile.usage, profile.providers],
  );
  const using = statuses.filter((x) => x.item.mode === 'use');
  const watching = statuses.filter((x) => x.item.mode !== 'use');
  const alerts = profile.alerts.slice(0, 4);

  if (!profile.watchlist.length) {
    return (
      <ScrollView contentContainerStyle={{ padding: space[4] }}>
        <Header title="Moje" />
        <Empty
          title="Nic jeszcze nie obserwujesz"
          body="Otwórz model i dotknij Obserwuj, żeby widzieć jego promocje. Jeśli już z niego korzystasz, wybierz Używam i wskaż dostawcę. Wtedy ostrzeżemy Cię, zanim skończy się zniżka."
          action={<Button label="Znajdź model" onPress={onGoSearch} />}
        />
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: space[4], paddingBottom: space[7] }}>
      <Header title="Moje" sub={`${using.length} używanych, ${watching.length} obserwowanych`} />

      {!profile.notify.enabled ? (
        <View style={[s.note, { borderColor: t.ink }]}>
          <T kind="small">Powiadomienia są wyłączone. Alerty zobaczysz tylko tutaj, po otwarciu apki.</T>
          <Pressable onPress={onGoProfile} accessibilityRole="button">
            <T kind="small" style={{ textDecorationLine: 'underline', marginTop: 4 }}>Włącz powiadomienia</T>
          </Pressable>
        </View>
      ) : null}

      {using.length ? (
        <View style={{ marginBottom: space[5], gap: space[3] }}>
          <T kind="h2">Używam</T>
          {using.map(({ item, status }) => <UsingCard key={item.modelId} item={item} status={status} onOpen={onOpen} />)}
        </View>
      ) : null}

      {alerts.length ? (
        <View style={{ marginBottom: space[5] }}>
          <T kind="h2" style={{ marginBottom: space[2] }}>Ostatnie alerty</T>
          {alerts.map((a) => (
            <Pressable key={a.id} onPress={() => onOpen(a.modelId)} style={[s.alert, { borderBottomColor: t.rule }]} accessibilityRole="button">
              <Row style={{ justifyContent: 'space-between' }}>
                <T kind="tiny" style={{ color: a.urgent ? t.promo : t.ink3 }}>{KIND_LABEL[a.kind]}</T>
                <T kind="tiny" color="ink3">{timeAgo(a.at)}</T>
              </Row>
              <T kind="strong">{a.title}</T>
              <T kind="small" color="ink2">{a.body}</T>
            </Pressable>
          ))}
        </View>
      ) : null}

      {watching.length ? (
        <View>
          <T kind="h2" style={{ marginBottom: space[1] }}>Obserwuję</T>
          {watching.map(({ item, status }) => {
            const promo = status.promos.filter((p) => p.type !== 'free').sort((a, b) => b.pct - a.pct)[0];
            return (
              <Pressable key={item.modelId} onPress={() => onOpen(item.modelId)} style={[s.watch, { borderBottomColor: t.rule }]} accessibilityRole="button">
                <View style={{ flex: 1 }}>
                  <T kind="strong" numberOfLines={1}>{status.model.name}</T>
                  <T kind="small" color="ink3" numberOfLines={1}>
                    {promo ? `−${promo.pct}% u ${promo.provider}` : status.model.freeId ? 'Dostępny za darmo' : 'Bez promocji'}
                  </T>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <T kind="price" style={{ fontSize: 18 }}>{status.best ? formatOfferPrice(status.best) : '–'}</T>
                  <T kind="tiny" color="ink3">{status.best?.provider ?? ''}</T>
                </View>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  card: { borderWidth: 1.5, borderRadius: radius.ui, padding: space[4] },
  note: { borderWidth: 1.5, borderStyle: 'dashed', borderRadius: radius.ui, padding: space[3], marginBottom: space[5] },
  alert: { paddingVertical: space[3], borderBottomWidth: StyleSheet.hairlineWidth, gap: 2 },
  watch: { flexDirection: 'row', alignItems: 'center', gap: space[3], paddingVertical: space[3], borderBottomWidth: StyleSheet.hairlineWidth },
});
