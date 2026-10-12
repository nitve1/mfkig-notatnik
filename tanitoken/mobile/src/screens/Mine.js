import { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { formatDays, formatOfferPrice, formatUsd, promoAgeDays, promoSavings, timeAgo, watchStatus } from '../../../core/pricing.js';
import { Button, Card, CatChip, Empty, PctBadge, Progress, Row, Stat, StatusBadge, T } from '../ui';
import Icon from '../icons';
import { CAT_LABEL, Header, priceParts, shortName } from '../parts';
import { mainCat, space, useTheme } from '../theme';
import { useProfile } from '../profile';
import { compareFilter, modeFilter } from '../filters';

const KIND = {
  'promo-start': { label: 'Nowa promocja', icon: 'tag', tone: 'info' },
  'promo-end': { label: 'Koniec promocji', icon: 'warn', tone: 'deal' },
  'promo-aging': { label: 'Kończy się', icon: 'clock', tone: 'deal' },
  cheaper: { label: 'Taniej gdzie indziej', icon: 'tag', tone: 'save' },
  expires: { label: 'Model znika', icon: 'warn', tone: 'deal' },
};

// Stan używanego modelu jako jedna odznaka + opcjonalny pasek postępu promocji.
function usingState(st) {
  const lastEnd = st.ended[0]; // już przefiltrowane do używanej oferty
  if (!st.used) return { tone: 'deal', label: 'Dostawca zniknął', stripe: 'deal' };
  if (st.usedPromo) {
    const age = promoAgeDays(st.usedPromo);
    const aging = st.typicalDays && age >= st.typicalDays * 0.8;
    return {
      tone: aging ? 'deal' : 'save',
      label: aging ? 'Kończy się' : `Promocja −${st.usedPromo.pct}%`,
      stripe: aging ? 'deal' : 'save',
      progress: st.typicalDays ? Math.min(1, age / st.typicalDays) : null,
      progressText: st.typicalDays ? `dzień ${Math.max(1, Math.round(age))} z ~${Math.round(st.typicalDays)} typowych` : null,
    };
  }
  if (lastEnd) return { tone: 'deal', label: 'Promocja minęła', stripe: 'deal' };
  if (st.overpayPct >= 5) return { tone: 'info', label: `Taniej o ${st.overpayPct}% gdzie indziej`, stripe: 'text' };
  return { tone: 'save', label: 'Najtaniej', stripe: 'save' };
}

export default function Mine({ snapshot, onOpen, onGoSearch, onGoProfile }) {
  const t = useTheme();
  const { profile } = useProfile();
  const filter = compareFilter(profile);
  const rows = useMemo(
    () => profile.watchlist
      .map((item) => {
        let st = watchStatus(snapshot, item, profile.usage, filter);
        // Ulubieni nie sprzedają tego modelu: pokaż najtańszą ofertę ogólnie.
        if (filter && !st.best) st = watchStatus(snapshot, item, profile.usage, modeFilter(profile));
        if (!st.best) st = watchStatus(snapshot, item, profile.usage);
        return { item, st: { ...st, usedKey: item.offerKey, ended: (st.ended ?? []).filter((e) => e.key === item.offerKey) } };
      })
      .filter((x) => x.st.model),
    [snapshot, profile.watchlist, profile.usage, filter],
  );
  const using = rows.filter((r) => r.item.mode === 'use');
  const watching = rows.filter((r) => r.item.mode !== 'use');
  const savings = using.reduce((sum, r) => sum + promoSavings(r.st, profile.usage), 0);
  const toCheck = using.filter((r) => ['deal', 'info'].includes(usingState(r.st).tone)).length;
  const alerts = profile.alerts.slice(0, 4);

  if (!profile.watchlist.length) {
    return (
      <ScrollView contentContainerStyle={{ padding: space[4], gap: space[3] }}>
        <Header title="Moje" />
        <Empty
          icon="star"
          title="Nic jeszcze nie obserwujesz"
          body="Otwórz model i dotknij gwiazdki. Jeśli już z niego korzystasz, wybierz „Używam” i wskaż dostawcę, a ostrzeżemy Cię, zanim skończy się promocja."
          action={<Button label="Znajdź model" icon="search" onPress={onGoSearch} style={{ flex: 0 }} />}
        />
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: space[4], paddingBottom: space[7], gap: space[2] }}>
      <Header kicker={`${using.length} używane, ${watching.length} obserwowane`} title="Moje" />

      <Row style={{ alignItems: 'stretch', gap: space[2] }}>
        <Stat label="Oszczędzasz" value={formatUsd(savings)} sub="na miesiąc z promocji" color={t.save} />
        <Stat label="Do sprawdzenia" value={String(toCheck)} sub={toCheck === 1 ? 'model wymaga uwagi' : 'modele wymagają uwagi'} color={toCheck ? t.deal : t.ink} />
      </Row>

      {!profile.notify.enabled ? (
        <Card stripe={t.video} onPress={onGoProfile} accessibilityLabel="Włącz powiadomienia">
          <Row>
            <Icon name="bell" size={20} color={t.video} />
            <View style={{ flex: 1 }}>
              <T kind="strong">Powiadomienia są wyłączone</T>
              <T kind="small" color="ink2">Włącz, żeby nie przegapić końca promocji.</T>
            </View>
          </Row>
        </Card>
      ) : null}

      {using.length ? <T kind="h2" style={s.h2}>Używam</T> : null}
      {using.map(({ item, st }) => {
        const state = usingState(st);
        const c = mainCat(st.model);
        return (
          <Card key={item.modelId} stripe={t[state.stripe]} onPress={() => onOpen(st.model.id)} accessibilityLabel={`${st.model.name}, ${state.label}`}>
            <Row style={{ alignItems: 'flex-start' }}>
              <View style={{ flex: 1, gap: 4 }}>
                <T kind="strong">{shortName(st.model.name)}</T>
                <CatChip cat={c} label={CAT_LABEL[c]} extra={st.used ? `u ${st.used.provider}` : ''} />
              </View>
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <T kind="num">{st.used ? priceParts(st.used).main : '–'}</T>
                {st.usedPromo ? <PctBadge pct={st.usedPromo.pct} /> : null}
              </View>
            </Row>
            <View style={{ marginTop: 10, gap: 6 }}>
              <StatusBadge tone={state.tone} label={state.label} icon={state.tone === 'deal' ? 'warn' : 'check'} />
              {state.progress != null ? (
                <>
                  <Progress value={state.progress} color={state.tone === 'deal' ? t.deal : t.save} />
                  <T kind="tiny" color="ink2">{state.progressText}</T>
                </>
              ) : null}
              {st.best && st.overpayPct >= 5 && st.used ? (
                <T kind="small" style={{ color: t.save }}>
                  {st.best.provider}: {formatUsd(st.bestCost)} zamiast {formatUsd(st.usedCost)} miesięcznie
                </T>
              ) : null}
            </View>
          </Card>
        );
      })}

      {alerts.length ? <T kind="h2" style={s.h2}>Ostatnie alerty</T> : null}
      {alerts.map((a) => {
        const k = KIND[a.kind] ?? KIND['promo-start'];
        const fg = k.tone === 'deal' ? t.deal : k.tone === 'save' ? t.save : t.text;
        const bg = k.tone === 'deal' ? t.dealSoft : k.tone === 'save' ? t.saveSoft : t.infoSoft;
        return (
          <Card key={a.id} onPress={() => onOpen(a.modelId)} accessibilityLabel={`${k.label}: ${a.title}`}>
            <Row style={{ alignItems: 'flex-start' }}>
              <View style={[s.alertIcon, { backgroundColor: bg }]}><Icon name={k.icon} size={18} color={fg} /></View>
              <View style={{ flex: 1, gap: 1 }}>
                <T kind="tiny" style={{ color: fg }}>{k.label}</T>
                <T kind="strong">{a.title}</T>
                <T kind="small" color="ink2">{a.body}</T>
              </View>
              <T kind="tiny" color="ink3">{timeAgo(a.at).replace(' temu', '')}</T>
            </Row>
          </Card>
        );
      })}

      {watching.length ? <T kind="h2" style={s.h2}>Obserwuję</T> : null}
      {watching.map(({ item, st }) => {
        const promo = st.promos.filter((p) => p.type !== 'free').sort((a, b) => b.pct - a.pct)[0];
        const c = mainCat(st.model);
        return (
          <Card key={item.modelId} stripe={t[c]} onPress={() => onOpen(st.model.id)} accessibilityLabel={st.model.name}>
            <Row style={{ alignItems: 'flex-start' }}>
              <View style={{ flex: 1, gap: 4 }}>
                <T kind="strong" numberOfLines={1}>{shortName(st.model.name)}</T>
                <CatChip cat={c} label={CAT_LABEL[c]} extra={promo ? `promocja u ${promo.provider}` : st.model.freeId ? 'darmowy wariant' : st.best?.provider} />
              </View>
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <T kind="num">{st.best ? priceParts(st.best).main : '–'}</T>
                {promo ? <PctBadge pct={promo.pct} /> : null}
              </View>
            </Row>
            {promo && st.typicalDays == null && promoAgeDays(promo) > 3 ? (
              <T kind="tiny" color="ink3" style={{ marginTop: 6 }}>promocja trwa {formatDays(promoAgeDays(promo))}</T>
            ) : null}
            {st.best ? <T kind="tiny" color="ink3" style={{ marginTop: 6 }}>{formatOfferPrice(st.best)}</T> : null}
          </Card>
        );
      })}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  h2: { marginTop: space[3] },
  alertIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
});
