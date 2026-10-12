import { useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import {
  formatContext, formatOfferPrice, formatUsd, isFreeOffer, liveOpenrouterOffers, offerCost,
  favoriteMatcher, offerKey, onePerPlatform, onePerProvider, platformOf, priceBeforeDiscount, sortOffers,
} from '../../../core/pricing.js';
import { isPro, modeFilter } from '../filters';
import { offerLink } from '../../../core/affiliates.js';
import { Button, Card, CatChip, IconButton, PctBadge, Row, Segmented, Stat, StatusBadge, T, MAX_FONT_SCALE } from '../ui';
import Icon from '../icons';
import { catLabel, authorName, daysLabel, shortName } from '../parts';
import { t as tr } from '../../../core/i18n.js';
import { font, radius, space, useTheme } from '../theme';
import { useProfile } from '../profile';

const LIVE_MS = 60 * 1000;
const srcShort = (src) => ({ openrouter: 'OpenRouter', vercel: 'Vercel', requesty: 'Requesty' }[src] ?? tr('src.direct'));

function UsageInput({ label, value, onChange }) {
  const t = useTheme();
  const [text, setText] = useState(String(value));
  return (
    <View style={{ flex: 1 }}>
      <T kind="tiny" color="ink2" style={{ marginBottom: 4 }}>{label}</T>
      <TextInput
          maxFontSizeMultiplier={MAX_FONT_SCALE}
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
  const pro = isPro(profile);
  const modeOnly = modeFilter(profile); // tryb Zwykły: tylko platformy
  const scoped = scope === 'fav' ? isFav : scope === 'promo' ? (o) => promoKeys.has(offerKey(o)) : null;
  const filter = modeOnly && scoped ? (o) => modeOnly(o) && scoped(o) : modeOnly ?? scoped;
  const offers = useMemo(
    () => (pro ? onePerProvider : onePerPlatform)(sortOffers(model, usage, filter), item?.offerKey),
    [model, usage, scope, isFav, pro, item?.offerKey], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const allPaid = sortOffers(model, usage, modeOnly).filter((o) => o.unit === model.unit && !isFreeOffer(o));
  const best = allPaid[0];
  const worst = allPaid[allPaid.length - 1];
  const used = item?.offerKey ? model.offers.find((o) => offerKey(o) === item.offerKey) : null;
  const cats = model.cats.length > 1 ? model.cats.filter((c) => c !== 'text') : model.cats;
  const setUsage = (patch) => update({ usage: { ...usage, [model.unit]: { ...usage[model.unit], ...patch } } });

  return (
    <ScrollView contentContainerStyle={{ padding: space[4], paddingBottom: space[7], gap: space[3] }} keyboardShouldPersistTaps="handled">
      <Row style={{ justifyContent: 'space-between' }}>
        <View style={{ marginLeft: -10 }}><IconButton name="back" label={tr('common.back')} onPress={onBack} /></View>
        <IconButton name="star" label={tr(item ? 'model.unwatch' : 'model.watch')} active={!!item} onPress={() => toggleWatch(model.id)} />
      </Row>

      <View style={{ gap: 4 }}>
        <Row style={{ gap: space[3] }}>
          {cats.map((c) => <CatChip key={c} cat={c} label={catLabel(c)} />)}
        </Row>
        <T kind="display">{shortName(model.name)}</T>
        <T kind="small" color="ink2">
          {[authorName(model), model.context ? tr('model.context', { ctx: formatContext(model.context) }) : null, tr('common.offers', { n: modeOnly ? model.offers.filter(modeOnly).length : model.offers.length })].filter(Boolean).join(', ')}
        </T>
        {model.freeId ? <StatusBadge tone="save" icon="check" label={tr('model.freeVariant', { id: model.freeId })} /> : null}
        {model.expires ? <StatusBadge tone="deal" icon="warn" label={tr('model.expires', { date: model.expires })} /> : null}
      </View>

      <Row style={{ alignItems: 'stretch', gap: space[2] }}>
        <Stat label={tr('model.cheapestMonthly')} value={best ? formatUsd(offerCost(best, usage)) : '–'} sub={best?.provider} />
        <Stat
          label={tr('common.youSave')}
          value={best && worst ? formatUsd(offerCost(worst, usage) - offerCost(best, usage)) : '–'}
          sub={tr('model.vsWorst')}
          color={t.save}
        />
      </Row>

      <Row style={{ gap: space[2] }}>
        <Button
          label={tr(item?.mode === 'use' ? 'model.using' : 'model.useEllipsis')}
          icon={item?.mode === 'use' ? 'check' : null}
          kind={item?.mode === 'use' ? 'ink' : 'line'}
          onPress={() => setPicking(!picking)}
        />
        <Button label={tr(item ? 'model.watching' : 'model.watch')} icon="star" kind={item ? 'ink' : 'line'} onPress={() => toggleWatch(model.id)} />
      </Row>
      {used && !picking ? (
        <Card stripe={t.text} style={{ paddingVertical: 10 }}>
          <T kind="small">{tr('model.payingAt', { provider: pro ? used.provider : platformOf(used) ?? used.provider, price: formatOfferPrice(used) })}</T>
        </Card>
      ) : null}
      {picking ? (
        <Card stripe={t.video} style={{ backgroundColor: t.dark ? t.card : '#fff4e6' }}>
          <T kind="strong">{tr('model.pickTitle')}</T>
          <T kind="small" color="ink2">{tr('model.pickBody')}</T>
          {item?.mode === 'use' ? (
            <Pressable onPress={() => { setUsing(model.id, null); setPicking(false); }} accessibilityRole="button" style={{ marginTop: 6 }}>
              <T kind="small" style={{ color: t.text, fontFamily: font.textBold }}>{tr('model.stopUsing')}</T>
            </Pressable>
          ) : null}
        </Card>
      ) : null}

      <Card>
        <T kind="strong" style={{ marginBottom: space[2] }}>{tr('model.usage')}</T>
        <Row>
          {model.unit === 'token' ? (
            <>
              <UsageInput label={tr('model.inTokens')} value={usage.token.in} onChange={(v) => setUsage({ in: v })} />
              <UsageInput label={tr('model.outTokens')} value={usage.token.out} onChange={(v) => setUsage({ out: v })} />
            </>
          ) : (
            <UsageInput label={tr(model.unit === 'image' ? 'model.images' : 'model.seconds')} value={usage[model.unit].count} onChange={(v) => setUsage({ count: v })} />
          )}
        </Row>
      </Card>

      <View style={{ gap: space[2], marginTop: space[2] }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <T kind="h2">{tr('model.offers')}</T>
          <T kind="tiny" color="ink3">{tr(live ? 'model.live' : 'model.fromSnapshot')}</T>
        </Row>
        <Segmented
          value={scope}
          onChange={setScope}
          options={[
            { value: 'all', label: tr('model.scopeAll') },
            { value: 'fav', label: tr('model.scopeFav'), count: favCount ? model.offers.filter((o) => isFav(o) && (!modeOnly || modeOnly(o))).length : null },
            { value: 'promo', label: tr('model.scopePromo'), count: promos.filter((p) => p.type !== 'free').length },
          ]}
        />
        <T kind="tiny" color="ink3">{tr(`unitLabel.${model.unit}`)}</T>
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
            accessibilityLabel={picking ? tr('model.useA11y', { name: pro ? o.provider : platformOf(o) }) : undefined}
          >
            <Row style={{ alignItems: 'flex-start' }}>
              <View style={{ flex: 1, gap: 2 }}>
                <Row style={{ gap: 6 }}>
                  {picking && !other ? <Icon name={isUsed ? 'check' : 'plus'} size={16} color={t.text} /> : null}
                  {isBest ? <Icon name="trophy" size={16} color={t.save} /> : null}
                  <T kind="strong" numberOfLines={1} style={{ flexShrink: 1 }}>{pro ? o.provider : platformOf(o)}</T>
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
                {[pro ? srcShort(o.src) : o.provider !== platformOf(o) ? tr('offer.viaShort', { provider: o.provider }) : null, o.quant, o.uptime != null ? tr('offer.uptime', { pct: o.uptime }) : null, promo ? tr('offer.promoSince', { since: daysLabel(promo) }) : null, other ? tr('offer.otherUnit') : null, isUsed ? tr('offer.youUse') : null].filter(Boolean).join(' · ')}
              </T>
              {!picking && link ? (
                <Pressable onPress={() => Linking.openURL(link.url)} accessibilityRole="link" hitSlop={10} style={s.link}>
                  <T kind="tiny" style={{ color: t.text }}>{tr(link.sponsored ? 'offer.partner' : 'offer.open')}</T>
                  <Icon name="external" size={13} color={t.text} />
                </Pressable>
              ) : null}
            </Row>
          </Card>
        );
      })}
      {!offers.length ? (
        <T color="ink2">{tr(scope === 'fav' ? 'model.noFav' : 'model.noPromo')}</T>
      ) : null}
      <T kind="tiny" color="ink3">
        {tr('model.footnote')}
      </T>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  input: { borderWidth: 1.5, borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 9, fontSize: 17, fontFamily: font.textBold },
  link: { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 8 },
});
