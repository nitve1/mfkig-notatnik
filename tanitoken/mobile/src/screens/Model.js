import { useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import {
  SOURCES, UNIT_LABEL, formatContext, formatOfferPrice, formatUsd, isFreeOffer, liveOpenrouterOffers, offerCost,
  offerKey, priceBeforeDiscount, promoAgeText, sortOffers,
} from '../../../core/pricing.js';
import { offerLink } from '../../../core/affiliates.js';
import { Button, Row, Segmented, T } from '../ui';
import { CAT_LABEL } from '../parts';
import { font, radius, space, useTheme } from '../theme';
import { useProfile } from '../profile';

const LIVE_MS = 60 * 1000;

function UsageInput({ label, value, onChange }) {
  const t = useTheme();
  const [text, setText] = useState(String(value));
  return (
    <View style={{ flex: 1 }}>
      <T kind="tiny" color="ink3" style={{ marginBottom: 4 }}>{label}</T>
      <TextInput
        value={text}
        onChangeText={(v) => {
          setText(v);
          const n = Number(v.replace(',', '.'));
          if (Number.isFinite(n) && n >= 0) onChange(n);
        }}
        keyboardType="decimal-pad"
        accessibilityLabel={label}
        style={[s.input, { borderColor: t.rule, color: t.ink, backgroundColor: t.paper }]}
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
  const favs = new Set(profile.providers);

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

  const filter = scope === 'fav' && favs.size ? (o) => favs.has(o.provider) : null;
  const offers = useMemo(() => sortOffers(model, usage, filter), [model, usage, scope, profile.providers]);
  const paid = offers.filter((o) => o.unit === model.unit && !isFreeOffer(o));
  const best = paid[0];
  const worst = paid[paid.length - 1];
  const promos = Object.values(snapshot.promos ?? {}).filter((p) => p.modelId === model.id);
  const used = item?.offerKey ? model.offers.find((o) => offerKey(o) === item.offerKey) : null;

  const setUsage = (patch) => update({ usage: { ...usage, [model.unit]: { ...usage[model.unit], ...patch } } });

  return (
    <ScrollView contentContainerStyle={{ padding: space[4], paddingBottom: space[7] }} keyboardShouldPersistTaps="handled">
      <Pressable onPress={onBack} hitSlop={12} accessibilityRole="button" accessibilityLabel="Wróć" style={{ alignSelf: 'flex-start', marginBottom: space[3] }}>
        <T kind="strong">‹ Wróć</T>
      </Pressable>

      <T kind="h1">{model.name}</T>
      <T kind="small" color="ink3" selectable style={{ marginTop: 2 }}>
        {model.id}{model.context ? `, kontekst ${formatContext(model.context)}` : ''}
      </T>
      <Row style={{ flexWrap: 'wrap', gap: 6, marginTop: space[2] }}>
        {model.cats.map((c) => (
          <View key={c} style={[s.chip, { borderColor: t.rule }]}><T kind="tiny" color="ink2">{CAT_LABEL[c]}</T></View>
        ))}
      </Row>
      {model.freeId ? (
        <T kind="small" style={{ marginTop: space[3], color: t.save }} selectable>
          Darmowy wariant: {model.freeId}. Zwykle z limitami zapytań.
        </T>
      ) : null}
      {model.expires ? <T kind="small" style={{ marginTop: space[2], color: t.promo }}>Model zostanie wycofany {model.expires}.</T> : null}

      <Row style={{ marginTop: space[4], flexWrap: 'wrap' }}>
        <Button
          kind={item ? 'ink' : 'line'}
          label={item ? '★ Obserwujesz' : '☆ Obserwuj'}
          onPress={() => { toggleWatch(model.id); setPicking(false); }}
          accessibilityHint="Dodaje model do zakładki Moje"
        />
        <Button kind={item?.mode === 'use' ? 'ink' : 'line'} label={item?.mode === 'use' ? 'Używam' : 'Używam…'} onPress={() => setPicking(!picking)} />
      </Row>
      {item?.mode === 'use' && used && !picking ? (
        <T kind="small" color="ink2" style={{ marginTop: space[2] }}>
          Płacisz u {used.provider}, {formatOfferPrice(used)}. Ostrzeżemy Cię, gdy ta cena się zmieni.
        </T>
      ) : null}
      {picking ? (
        <View style={[s.pickNote, { backgroundColor: t.tag }]}>
          <T kind="strong" style={{ color: t.tagInk }}>Wybierz dostawcę, u którego płacisz za ten model.</T>
          {item?.mode === 'use' ? (
            <Pressable onPress={() => { setUsing(model.id, null); setPicking(false); }} accessibilityRole="button">
              <T kind="small" style={{ color: t.tagInk, textDecorationLine: 'underline', marginTop: 4 }}>Już nie używam, tylko obserwuję</T>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <View style={[s.calc, { backgroundColor: t.sheet, borderColor: t.rule }]}>
        <T kind="strong" style={{ marginBottom: space[2] }}>Twoje zużycie miesięcznie</T>
        <Row>
          {model.unit === 'token' ? (
            <>
              <UsageInput label="Wejście, mln tokenów" value={usage.token.in} onChange={(v) => setUsage({ in: v })} />
              <UsageInput label="Wyjście, mln tokenów" value={usage.token.out} onChange={(v) => setUsage({ out: v })} />
            </>
          ) : (
            <UsageInput
              label={model.unit === 'image' ? 'Obrazów' : 'Sekund wideo'}
              value={usage[model.unit].count}
              onChange={(v) => setUsage({ count: v })}
            />
          )}
        </Row>
        {best ? (
          <T style={{ marginTop: space[3] }}>
            Najtaniej: <T kind="strong">{best.provider}</T>, {formatUsd(offerCost(best, usage))} miesięcznie.
            {worst && offerCost(worst, usage) > offerCost(best, usage) ? (
              <T style={{ color: t.save }}>{` Oszczędzasz ${formatUsd(offerCost(worst, usage) - offerCost(best, usage))} względem najdroższej oferty.`}</T>
            ) : null}
          </T>
        ) : null}
      </View>

      <Row style={{ justifyContent: 'space-between', marginTop: space[5], marginBottom: space[2] }}>
        <T kind="h2">Oferty</T>
        {favs.size ? (
          <Segmented scroll={false} value={scope} onChange={setScope} options={[{ value: 'all', label: 'Wszyscy' }, { value: 'fav', label: 'Ulubieni' }]} />
        ) : null}
      </Row>
      <T kind="tiny" color="ink3" style={{ marginBottom: space[2] }}>
        USD {UNIT_LABEL[model.unit]}. {live ? 'Oferty OpenRouter pobrane przed chwilą.' : 'Z ostatniej aktualizacji.'}
      </T>

      {offers.map((o) => {
        const k = offerKey(o);
        const promo = promos.find((p) => p.key === k);
        const before = priceBeforeDiscount(o);
        const link = offerLink(model, o);
        const isBest = o === best;
        const isUsed = item?.offerKey === k;
        const other = o.unit !== model.unit;
        const Wrap = picking && !other ? Pressable : View;
        return (
          <Wrap
            key={k}
            onPress={picking ? () => { setUsing(model.id, k); setPicking(false); } : undefined}
            accessibilityRole={picking ? 'radio' : undefined}
            accessibilityState={picking ? { checked: isUsed } : undefined}
            style={[s.offer, { borderColor: isUsed ? t.ink : isBest ? t.tag : t.rule, backgroundColor: isBest ? `${t.tag}30` : t.sheet, borderWidth: isUsed || isBest ? 2 : 1 }]}
          >
            <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View style={{ flex: 1 }}>
                <T kind="strong">
                  {picking && !other ? (isUsed ? '◉ ' : '○ ') : ''}{o.provider}
                  {favs.has(o.provider) ? <T kind="strong" style={{ color: t.ink3 }}> ★</T> : null}
                </T>
                <T kind="tiny" color="ink3">
                  {[SOURCES[o.src]?.name, o.quant, o.uptime != null ? `dostępność ${o.uptime}%` : null, isBest ? 'najtaniej' : null, isUsed ? 'używasz' : null].filter(Boolean).join(', ')}
                </T>
              </View>
              <T kind="price" style={{ fontSize: 19 }}>{other ? '' : `${formatUsd(offerCost(o, usage))}`}</T>
            </Row>
            <Row style={{ marginTop: 4, flexWrap: 'wrap', gap: space[2] }}>
              {before ? <T kind="small" color="ink3" style={{ textDecorationLine: 'line-through' }}>{formatOfferPrice(before)}</T> : null}
              <T kind="small" style={{ fontFamily: font.textSemi, fontVariant: ['tabular-nums'] }}>{formatOfferPrice(o)}</T>
              {promo ? <T kind="small" style={{ color: t.promo, fontFamily: font.textSemi }}>−{promo.pct}%, {promoAgeText(promo)}</T> : null}
              {other ? <T kind="tiny" color="ink3">inna jednostka</T> : null}
            </Row>
            {!picking && link ? (
              <Row style={{ marginTop: space[2] }}>
                <Pressable onPress={() => Linking.openURL(link.url)} accessibilityRole="link" hitSlop={8}>
                  <T kind="small" style={{ textDecorationLine: 'underline', fontFamily: font.textMedium }}>{link.label}</T>
                </Pressable>
                {link.sponsored ? <T kind="tiny" color="ink3">link partnerski</T> : null}
              </Row>
            ) : null}
          </Wrap>
        );
      })}
      {!offers.length ? <T color="ink2">Żaden z ulubionych dostawców nie sprzedaje tego modelu.</T> : null}
      <T kind="tiny" color="ink3" style={{ marginTop: space[3] }}>
        Cenniki bezpośrednie pochodzą z katalogu models.dev i mogą być nieaktualne. Sprawdź cenę u dostawcy przed zakupem.
      </T>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  chip: { borderWidth: 1, borderRadius: 99, paddingHorizontal: 8, paddingVertical: 2 },
  pickNote: { borderRadius: radius.tag, padding: space[3], marginTop: space[3] },
  calc: { borderWidth: 1, borderRadius: radius.ui, padding: space[4], marginTop: space[5] },
  input: { borderWidth: 1.5, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 8, fontSize: 17, fontFamily: font.textSemi },
  offer: { borderRadius: radius.ui, padding: space[3], marginBottom: space[2] },
});
