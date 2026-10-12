import { useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import {
  SOURCES, UNIT_LABEL, formatContext, formatOfferPrice, formatUsd, isFreeOffer, liveOpenrouterOffers, offerCost,
  favoriteMatcher, offerKey, onePerProvider, priceBeforeDiscount, sortOffers,
} from '../../../core/pricing.js';
import { offerLink } from '../../../core/affiliates.js';
import { Button, Card, CatChip, IconButton, PctBadge, Row, Segmented, Stat, StatusBadge, T } from '../ui';
import Icon from '../icons';
import { CAT_LABEL, authorName, daysLabel, shortName } from '../parts';
import { font, radius, space, useTheme } from '../theme';
import { useProfile } from '../profile';

const LIVE_MS = 60 * 1000;
const SRC_SHORT = { openrouter: 'OpenRouter', vercel: 'Vercel', requesty: 'Requesty', direct: 'bezpośrednio' };

function UsageInput({ label, value, onChange }) {
  const t = useTheme();
  const [text, setText] = useState(String(value));
  return (
    <View style={{ flex: 1 }}>
      <T kind="tiny" color="ink2" style={{ marginBottom: 4 }}>{label}</T>
      <TextInput
        value={text}
        onChangeText={(v) => {
          setText(v);
          const n = Number(v.replace(',', '.'));
          if (Number.isFinite(n) && n >= 0) onChange(n);
        }}
        keyboardType="decimal-pad"
        accessibilityLabel={label}
        style={[s.input, { borderColor: t.line, color: t.ink, backgroundColor: t.bg }]}
      />
    </View>
  );
}

export default function Model({ model: base, snapshot, onBack }) {
  const t = useTheme();
  const { profile, update, watchItem, toggleWatch, setUsing } = useProfile();
  const [model, setModel] = useState(base);
  const [live, setLive] = useState(false);
  const [picking, setPicking] = useState(false);
  const [scope, setScope] = useState(profile.onlyFavorites && profile.providers.length ? 'fav' : 'all');
  const item = watchItem(base.id);
  const usage = profile.usage;
  const isFav = useMemo(() => favoriteMatcher(profile.providers) ?? (() => false), [profile.providers]);
  const favCount = profile.providers.length;

  // Oferty OpenRouter na żywo, co minutę; reszta źródeł ze snapshotu.
  useEffect(() => {
    if (!base.offers.some((o) => o.src === 'openrouter')) return undefined;
    let alive = true;
    const load = () =>
      liveOpenrouterOffers(base)
        .then((offers) => {
          if (!alive || !offers.length) return;
          setModel({ ...base, offers: [...offers, ...base.offers.filter((o) => o.src !== 'openrouter')] });
          setLive(true);
        })
        .catch(() => {});
    load();
    const timer = setInterval(load, LIVE_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [base]);

  const promos = Object.values(snapshot.promos ?? {}).filter((p) => p.modelId === model.id);
  const promoKeys = new Set(promos.map((p) => p.key));
  const filter = scope === 'fav' ? isFav : scope === 'promo' ? (o) => promoKeys.has(offerKey(o)) : null;
  const offers = useMemo(
    () => onePerProvider(sortOffers(model, usage, filter), item?.offerKey),
    [model, usage, scope, isFav, item?.offerKey], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const allPaid = sortOffers(model, usage).filter((o) => o.unit === model.unit && !isFreeOffer(o));
  const best = allPaid[0];
  const worst = allPaid[allPaid.length - 1];
  const used = item?.offerKey ? model.offers.find((o) => offerKey(o) === item.offerKey) : null;
  const cats = model.cats.length > 1 ? model.cats.filter((c) => c !== 'text') : model.cats;
  const setUsage = (patch) => update({ usage: { ...usage, [model.unit]: { ...usage[model.unit], ...patch } } });

  return (
    <ScrollView contentContainerStyle={{ padding: space[4], paddingBottom: space[7], gap: space[3] }} keyboardShouldPersistTaps="handled">
      <Row style={{ justifyContent: 'space-between' }}>
        <View style={{ marginLeft: -10 }}><IconButton name="back" label="Wróć" onPress={onBack} /></View>
        <IconButton name="star" label={item ? 'Przestań obserwować' : 'Obserwuj'} active={!!item} onPress={() => toggleWatch(model.id)} />
      </Row>

      <View style={{ gap: 4 }}>
        <Row style={{ gap: space[3] }}>
          {cats.map((c) => <CatChip key={c} cat={c} label={CAT_LABEL[c]} />)}
        </Row>
        <T kind="display">{shortName(model.name)}</T>
        <T kind="small" color="ink2">
          {[authorName(model), model.context ? `${formatContext(model.context)} kontekstu` : null, `${model.offers.length} ofert`].filter(Boolean).join(', ')}
        </T>
        {model.freeId ? <StatusBadge tone="save" icon="check" label={`Darmowy wariant: ${model.freeId}`} /> : null}
        {model.expires ? <StatusBadge tone="deal" icon="warn" label={`Wycofanie ${model.expires}`} /> : null}
      </View>

      <Row style={{ alignItems: 'stretch', gap: space[2] }}>
        <Stat label="Najtaniej miesięcznie" value={best ? formatUsd(offerCost(best, usage)) : '–'} sub={best?.provider} />
        <Stat
          label="Oszczędzasz"
          value={best && worst ? formatUsd(offerCost(worst, usage) - offerCost(best, usage)) : '–'}
          sub="względem najdroższej"
          color={t.save}
        />
      </Row>

      <Row style={{ gap: space[2] }}>
        <Button
          label={item?.mode === 'use' ? 'Używam' : 'Używam…'}
          icon={item?.mode === 'use' ? 'check' : null}
          kind={item?.mode === 'use' ? 'ink' : 'line'}
          onPress={() => setPicking(!picking)}
        />
        <Button label={item ? 'Obserwujesz' : 'Obserwuj'} icon="star" kind={item ? 'ink' : 'line'} onPress={() => toggleWatch(model.id)} />
      </Row>
      {used && !picking ? (
        <Card stripe={t.text} style={{ paddingVertical: 10 }}>
          <T kind="small">Płacisz u <T kind="small" style={{ fontFamily: font.textBold }}>{used.provider}</T>, {formatOfferPrice(used)}. Ostrzeżemy Cię, gdy cena się zmieni.</T>
        </Card>
      ) : null}
      {picking ? (
        <Card stripe={t.video} style={{ backgroundColor: t.dark ? t.card : '#fff4e6' }}>
          <T kind="strong">Wybierz dostawcę, u którego płacisz</T>
          <T kind="small" color="ink2">Dotknij oferty poniżej.</T>
          {item?.mode === 'use' ? (
            <Pressable onPress={() => { setUsing(model.id, null); setPicking(false); }} accessibilityRole="button" style={{ marginTop: 6 }}>
              <T kind="small" style={{ color: t.text, fontFamily: font.textBold }}>Już nie używam, tylko obserwuję</T>
            </Pressable>
          ) : null}
        </Card>
      ) : null}

      <Card>
        <T kind="strong" style={{ marginBottom: space[2] }}>Twoje zużycie miesięcznie</T>
        <Row>
          {model.unit === 'token' ? (
            <>
              <UsageInput label="Wejście, mln tokenów" value={usage.token.in} onChange={(v) => setUsage({ in: v })} />
              <UsageInput label="Wyjście, mln tokenów" value={usage.token.out} onChange={(v) => setUsage({ out: v })} />
            </>
          ) : (
            <UsageInput label={model.unit === 'image' ? 'Obrazów' : 'Sekund wideo'} value={usage[model.unit].count} onChange={(v) => setUsage({ count: v })} />
          )}
        </Row>
      </Card>

      <View style={{ gap: space[2], marginTop: space[2] }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <T kind="h2">Oferty</T>
          <T kind="tiny" color="ink3">{live ? 'OpenRouter na żywo' : 'z ostatniej aktualizacji'}</T>
        </Row>
        <Segmented
          value={scope}
          onChange={setScope}
          options={[
            { value: 'all', label: 'Wszyscy' },
            { value: 'fav', label: 'Ulubieni', count: favCount ? model.offers.filter(isFav).length : null },
            { value: 'promo', label: 'Z promocją', count: promos.filter((p) => p.type !== 'free').length },
          ]}
        />
        <T kind="tiny" color="ink3">USD {UNIT_LABEL[model.unit]}</T>
      </View>

      {offers.map((o) => {
        const k = offerKey(o);
        const promo = promos.find((p) => p.key === k);
        const before = priceBeforeDiscount(o);
        const link = offerLink(model, o);
        const isBest = o === best;
        const isUsed = item?.offerKey === k;
        const other = o.unit !== model.unit;
        return (
          <Card
            key={k}
            stripe={isUsed ? t.text : isBest ? t.save : t.line}
            onPress={picking && !other ? () => { setUsing(model.id, k); setPicking(false); } : undefined}
            accessibilityLabel={picking ? `Używam ${o.provider}` : undefined}
          >
            <Row style={{ alignItems: 'flex-start' }}>
              <View style={{ flex: 1, gap: 2 }}>
                <Row style={{ gap: 6 }}>
                  {picking && !other ? <Icon name={isUsed ? 'check' : 'plus'} size={16} color={t.text} /> : null}
                  {isBest ? <Icon name="trophy" size={16} color={t.save} /> : null}
                  <T kind="strong" numberOfLines={1} style={{ flexShrink: 1 }}>{o.provider}</T>
                  {isFav(o) ? <Icon name="star" size={14} color={t.video} fill={t.video} /> : null}
                </Row>
                <T kind="small" color="ink2">
                  {before ? <T kind="small" color="ink3" style={{ textDecorationLine: 'line-through' }}>{formatOfferPrice(before)}  </T> : null}
                  {formatOfferPrice(o)}
                </T>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <T kind="num">{other ? '' : formatUsd(offerCost(o, usage))}</T>
                {promo && promo.type !== 'free' ? <PctBadge pct={promo.pct} /> : null}
              </View>
            </Row>
            <Row style={{ marginTop: 8, justifyContent: 'space-between' }}>
              <T kind="tiny" color="ink3" style={{ flex: 1 }} numberOfLines={1}>
                {[SRC_SHORT[o.src] ?? SOURCES[o.src]?.name, o.quant, o.uptime != null ? `dostępność ${o.uptime}%` : null, promo ? `promocja ${daysLabel(promo)}` : null, other ? 'inna jednostka' : null, isUsed ? 'używasz' : null].filter(Boolean).join(' · ')}
              </T>
              {!picking && link ? (
                <Pressable onPress={() => Linking.openURL(link.url)} accessibilityRole="link" hitSlop={10} style={s.link}>
                  <T kind="tiny" style={{ color: t.text }}>{link.sponsored ? 'Partner' : 'Otwórz'}</T>
                  <Icon name="external" size={13} color={t.text} />
                </Pressable>
              ) : null}
            </Row>
          </Card>
        );
      })}
      {!offers.length ? (
        <T color="ink2">{scope === 'fav' ? 'Żaden z ulubionych dostawców nie sprzedaje tego modelu.' : 'Brak ofert z promocją.'}</T>
      ) : null}
      <T kind="tiny" color="ink3">
        Cenniki „bezpośrednio” pochodzą z katalogu models.dev i mogą być nieaktualne. Linki „Partner” są partnerskie, kolejność zależy tylko od ceny.
      </T>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  input: { borderWidth: 1.5, borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 9, fontSize: 17, fontFamily: font.textBold },
  link: { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 8 },
});
