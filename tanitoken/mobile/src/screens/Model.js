import { useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import {
  formatContext, formatOfferPrice, formatUsd, isFreeOffer, liveOpenrouterOffers, offerCost,
  favoriteMatcher, offerKey, onePerPlatform, onePerProvider, platformOf, priceBeforeDiscount, sortOffers,
} from '../../../core/pricing.js';
import { isPro, modeFilter } from '../filters';
import { offerLink } from '../../../core/affiliates.js';
import { Button, Card, CatChip, IconButton, PctBadge, Row, Segmented, StatusBadge, T, MAX_FONT_SCALE } from '../ui';
import Icon from '../icons';
import { catLabel, authorName, daysLabel, shortName } from '../parts';
import { t as tr } from '../../../core/i18n.js';
import { font, mainCat, radius, space, tileColor, useBottomSpace, useTheme } from '../theme';
import { useProfile } from '../profile';
import PriceChart from '../PriceChart';

const LIVE_MS = 60 * 1000;
const srcShort = (o) => ({ openrouter: 'OpenRouter', vercel: 'Vercel', requesty: 'Requesty', fal: 'fal.ai' }[o.src] ?? (platformOf(o) ? tr('platform.gateway') : tr('src.direct')));

function UsageInput({ label, value, onChange }) {
  const t = useTheme();
  const [text, setText] = useState(String(value));
  return (
    <View style={{ flex: 1 }}>
      <T kind="tiny" color="ink2" style={{ marginBottom: space[2] }}>{label}</T>
      <TextInput
          maxFontSizeMultiplier={MAX_FONT_SCALE}
        value={text}
        onChangeText={(v) => {
          setText(v);
          const n = Number(v.replace(',', '.'));
          // Puste pole albo 0 nie zeruje wszystkich kosztów: czekamy na sensowną liczbę.
          if (v.trim() !== '' && Number.isFinite(n) && n > 0 && n < 1e7) onChange(n);
        }}
        keyboardType="decimal-pad"
        accessibilityLabel={label}
        style={[s.input, { borderColor: t.glassLine, color: t.ink, backgroundColor: 'rgba(0,0,0,0.25)' }]}
      />
    </View>
  );
}

// Do czego się nada: przetłumaczone etykiety z kategorii i możliwości modelu (dane z OpenRouter).
function modelUses(model) {
  const c = model.caps ?? {};
  const uses = [];
  if (model.cats.includes('video')) uses.push(['video', 'use.videoGen']);
  if (model.cats.includes('image')) uses.push(['image', 'use.imageGen']);
  if (model.cats.includes('coding')) uses.push(['coding', 'use.coding']);
  if (c.tools) uses.push(['spark', 'use.agents']);
  if (c.reasoning) uses.push(['check', 'use.reasoning']);
  if (model.context >= 200000) uses.push(['text', 'use.longDocs', { ctx: formatContext(model.context) }]);
  if (c.vision) uses.push(['image', 'use.vision']);
  if (c.json) uses.push(['all', 'use.json']);
  if (model.cats.includes('text') && !model.cats.includes('coding')) uses.unshift(['text', 'use.chat']);
  return uses.slice(0, 6);
}

function exampleKey(model) {
  if (model.cats.includes('video')) return 'example.video';
  if (model.cats.includes('image') && !model.cats.includes('text')) return 'example.image';
  if (model.cats.includes('coding')) return 'example.coding';
  if (model.caps?.tools) return 'example.agents';
  return 'example.text';
}

// Opisy wczytujemy dopiero przy pierwszym otwarciu karty modelu (szybszy start apki).
let DESCS = null;
const descOf = (id) => {
  if (!DESCS) DESCS = require('../../../data/descriptions.json');
  return DESCS[id] ?? null;
};

function About({ model: base }) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  const model = { ...base, desc: base.desc ?? descOf(base.id) };
  const uses = modelUses(model);
  if (!model.desc && !uses.length) return null;
  return (
    <View style={{ gap: space[2] }}>
      <T kind="h2" style={{ marginTop: space[5] }}>{tr('model.about')}</T>
      {model.desc ? (
        <Card level="flat">
          <T numberOfLines={open ? undefined : 4}>{model.desc}</T>
          <Row style={{ marginTop: space[3], justifyContent: 'space-between' }}>
            <T kind="tiny" color="ink3" style={{ flex: 1 }}>{tr('model.descNote')}</T>
            {model.desc.length > 180 ? (
              <Pressable onPress={() => setOpen(!open)} hitSlop={10} accessibilityRole="button">
                <T kind="tiny" style={{ color: t.text }}>{tr(open ? 'model.less' : 'model.more')}</T>
              </Pressable>
            ) : null}
          </Row>
        </Card>
      ) : null}
      {uses.length ? (
        <>
          <T kind="strong" style={{ marginTop: space[4] }}>{tr('model.uses')}</T>
          <View style={s.uses}>
            {uses.map(([icon, key, vars]) => (
              <View key={key} style={s.use}>
                <Icon name={icon} size={15} color={t.ink3} />
                <T kind="small" color="ink2">{tr(key, vars)}</T>
              </View>
            ))}
          </View>
          <Card level="flat">
            <T kind="small" color="ink2"><T kind="small" style={{ fontFamily: font.textBold }}>{tr('model.example')}: </T>{tr(exampleKey(model))}</T>
          </Card>
        </>
      ) : null}
    </View>
  );
}

export default function Model({ model: base, snapshot, onBack }) {
  const t = useTheme();
  const bottomSpace = useBottomSpace();
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
    // Nowe ceny ze zestawienia (np. po odświeżeniu) od razu w otwartej karcie, także bez ofert OpenRouter.
    setModel(base);
    setLive(false);
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

  const cat = mainCat(model);
  const tint = tileColor(cat) ?? t.text;
  const bestCost = best ? offerCost(best, usage) : null;
  const saving = best && worst ? offerCost(worst, usage) - bestCost : null;

  return (
    <ScrollView contentContainerStyle={{ padding: space[4], paddingBottom: bottomSpace, gap: space[3] }} keyboardShouldPersistTaps="handled">
      {/* Nagłówek w kolorze kategorii z ceną: jedyny wyróżniony element ekranu (wariant B, mockups/model-layout.png). */}
      <View style={s.head}>
        <Svg width="100%" height="100%" style={StyleSheet.absoluteFill} pointerEvents="none">
          <Defs>
            <LinearGradient id="lt-head" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={tint} stopOpacity={0.6} />
              <Stop offset="1" stopColor={tint} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#lt-head)" />
        </Svg>
        <Row style={{ justifyContent: 'space-between' }}>
          <View style={{ marginLeft: -10 }}><IconButton name="back" label={tr('common.back')} onPress={onBack} /></View>
          <IconButton name="star" label={tr(item ? 'model.unwatch' : 'model.watch')} active={!!item} onPress={() => toggleWatch(model.id)} />
        </Row>
        <View style={{ gap: 4, marginTop: space[2] }}>
          <Row style={{ gap: space[3] }}>
            {cats.map((c) => <CatChip key={c} cat={c} label={catLabel(c)} />)}
          </Row>
          <T kind="display">{shortName(model.name)}</T>
          <T kind="small" color="ink2">
            {[authorName(model), model.context ? tr('model.context', { ctx: formatContext(model.context) }) : null, tr('common.offers', { n: modeOnly ? model.offers.filter(modeOnly).length : model.offers.length })].filter(Boolean).join(' · ')}
          </T>
          {model.freeId ? <StatusBadge tone="save" icon="check" label={tr('model.freeVariant', { id: model.freeId })} /> : null}
          {model.expires ? <StatusBadge tone="deal" icon="warn" label={tr('model.expires', { date: model.expires })} /> : null}
        </View>
        <Row style={{ marginTop: space[4], justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <View style={{ flexShrink: 1 }}>
            <T kind="small" color="ink2">{tr('model.cheapestMonthly')}</T>
            <T kind="display" style={{ fontSize: 34, lineHeight: 40 }} numberOfLines={1} adjustsFontSizeToFit>{bestCost != null ? formatUsd(bestCost) : '–'}</T>
            {best ? <T kind="small" color="ink2" numberOfLines={1}>{pro ? best.provider : platformOf(best) ?? best.provider}</T> : null}
          </View>
          {saving ? (
            <View style={{ alignItems: 'flex-end', marginLeft: space[3] }}>
              <T kind="small" color="ink2">{tr('common.youSave')}</T>
              <T kind="num" style={{ color: t.save, fontSize: 22, lineHeight: 28 }}>{formatUsd(saving)}</T>
              <T kind="tiny" color="ink2">{tr('model.vsWorst')}</T>
            </View>
          ) : null}
        </Row>
      </View>

      <Row style={{ gap: space[2] }}>
        <Button
          label={tr(item?.mode === 'use' ? 'model.using' : 'model.useEllipsis')}
          icon={item?.mode === 'use' ? 'check' : null}
          kind={item?.mode === 'use' || !item ? 'ink' : 'line'}
          onPress={() => setPicking(!picking)}
        />
        <Button label={tr(item ? 'model.watching' : 'model.watch')} icon="star" kind={item && item.mode !== 'use' ? 'ink' : 'line'} onPress={() => toggleWatch(model.id)} />
      </Row>
      {used && !picking ? (
        <Card stripe={t.text} style={{ paddingVertical: 10 }}>
          <T kind="small">{tr('model.payingAt', { provider: pro ? used.provider : platformOf(used) ?? used.provider, price: formatOfferPrice(used) })}</T>
        </Card>
      ) : null}
      {picking ? (
        <Card stripe={t.video}>
          <T kind="strong">{tr('model.pickTitle')}</T>
          <T kind="small" color="ink2">{tr('model.pickBody')}</T>
          {item?.mode === 'use' ? (
            <Pressable onPress={() => { setUsing(model.id, null); setPicking(false); }} accessibilityRole="button" style={{ marginTop: 6 }}>
              <T kind="small" style={{ color: t.text, fontFamily: font.textBold }}>{tr('model.stopUsing')}</T>
            </Pressable>
          ) : null}
        </Card>
      ) : null}

      {/* Oferty: ważniejsza sekcja, jaśniejsza powierzchnia; w środku lista wierszy zamiast osobnych kart. */}
      <Card level="raised" style={{ paddingVertical: space[3] }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <T kind="h2">{tr('model.offers')}</T>
          <T kind="tiny" color="ink3">{tr(live ? 'model.live' : 'model.fromSnapshot')}</T>
        </Row>
        <Segmented
          style={{ marginTop: space[2] }}
          value={scope}
          onChange={setScope}
          options={[
            { value: 'all', label: tr('model.scopeAll') },
            { value: 'fav', label: tr('model.scopeFav'), count: favCount ? model.offers.filter((o) => isFav(o) && (!modeOnly || modeOnly(o))).length : null },
            { value: 'promo', label: tr('model.scopePromo'), count: promos.filter((p) => p.type !== 'free').length },
          ]}
        />
        <T kind="tiny" color="ink3" style={{ marginTop: space[3], marginBottom: space[1] }}>{tr(`unitLabel.${model.unit}`)} · {tr('model.monthlyAtUsage')}</T>
        {offers.map((o, i) => {
          const k = offerKey(o);
          const promo = promos.find((p) => p.key === k);
          const before = priceBeforeDiscount(o);
          const link = offerLink(model, o);
          const isBest = o === best;
          const isUsed = item?.offerKey === k;
          const other = o.unit !== model.unit;
          const canPick = picking && !other;
          const body = (
            <>
              <Row style={{ alignItems: 'flex-start' }}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Row style={{ gap: 6 }}>
                    {canPick ? <Icon name={isUsed ? 'check' : 'plus'} size={16} color={t.text} /> : null}
                    {isBest ? <Icon name="trophy" size={16} color={t.save} /> : null}
                    {isUsed && !canPick ? <Icon name="check" size={16} color={t.text} /> : null}
                    <T kind="strong" numberOfLines={1} style={{ flexShrink: 1 }}>{pro ? o.provider : platformOf(o)}</T>
                    {isFav(o) ? <Icon name="star" size={14} color={t.video} fill={t.video} /> : null}
                    {promo && promo.type !== 'free' ? <PctBadge pct={promo.pct} /> : null}
                  </Row>
                  <T kind="small" color="ink2">
                    {before ? <T kind="small" color="ink3" style={{ textDecorationLine: 'line-through' }}>{formatOfferPrice(before)}  </T> : null}
                    {formatOfferPrice(o)}
                  </T>
                </View>
                <T kind="num" style={{ fontSize: 18 }}>{other ? '' : formatUsd(offerCost(o, usage))}</T>
              </Row>
              <Row style={{ marginTop: 2, justifyContent: 'space-between' }}>
                <T kind="tiny" color="ink3" style={{ flex: 1 }} numberOfLines={1}>
                  {[pro ? srcShort(o) : o.provider !== platformOf(o) ? tr('offer.viaShort', { provider: o.provider }) : null, o.quant, o.uptime != null ? tr('offer.uptime', { pct: o.uptime }) : null, promo ? tr('offer.promoSince', { since: daysLabel(promo) }) : null, other ? tr('offer.otherUnit') : null, isUsed ? tr('offer.youUse') : null].filter(Boolean).join(' · ')}
                </T>
                {!picking && link ? (
                  <Pressable onPress={() => Linking.openURL(link.url)} accessibilityRole="link" hitSlop={8} style={s.link}>
                    <T kind="tiny" style={{ color: t.text }}>{tr(link.sponsored ? 'offer.partner' : 'offer.open')}</T>
                    <Icon name="external" size={13} color={t.text} />
                  </Pressable>
                ) : null}
              </Row>
            </>
          );
          const rowStyle = [s.offer, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.glassLine }, (isUsed || isBest) && { borderLeftWidth: 3, borderLeftColor: isUsed ? t.text : t.save, paddingLeft: 10 }];
          return canPick ? (
            <Pressable
              key={k}
              onPress={() => { setUsing(model.id, k); setPicking(false); }}
              accessibilityRole="button"
              accessibilityLabel={tr('model.useA11y', { name: pro ? o.provider : platformOf(o) })}
              style={({ pressed }) => [...rowStyle, pressed && { opacity: 0.8 }]}
            >
              {body}
            </Pressable>
          ) : (
            <View key={k} style={rowStyle}>{body}</View>
          );
        })}
        {!offers.length ? (
          <T color="ink2" style={{ marginTop: space[2] }}>{tr(scope === 'fav' ? 'model.noFav' : 'model.noPromo')}</T>
        ) : null}
      </Card>

      <Card level="flat">
        <T kind="strong" style={{ marginBottom: space[3] }}>{tr('model.usage')}</T>
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

      <PriceChart model={model} usage={usage} used={used} isFav={isFav} favCount={favCount} allow={modeOnly} pro={pro} level="flat" />

      <About model={model} />

      <T kind="tiny" color="ink3" style={{ marginTop: space[3] }}>
        {tr('model.footnote')}
      </T>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  uses: { flexDirection: 'row', flexWrap: 'wrap', columnGap: space[4], rowGap: space[1] },
  use: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingRight: 10, paddingVertical: 4 },
  head: { marginHorizontal: -space[4], marginTop: -space[4], paddingHorizontal: space[4], paddingTop: space[4], paddingBottom: space[2] },
  offer: { paddingVertical: space[3] },
  input: { minHeight: 44, borderWidth: 1.5, borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 9, fontSize: 17, fontFamily: font.textBold },
  link: { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 8, minHeight: 44, paddingHorizontal: 8 },
});
