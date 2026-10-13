import { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { cheapest, collectDeals, formatUsd, PLATFORMS, unitPrice } from '../../../core/pricing.js';
import { t as tr } from '../../../core/i18n.js';
import { isPro, viewFilter } from '../filters';
import { Button, Empty, Segmented, T } from '../ui';
import Icon from '../icons';
import { BellButton, catLabel, DealCard, Header, PriceStatus, priceParts, styles } from '../parts';
import { radius, space, useBottomSpace, useTheme } from '../theme';
import { useProfile } from '../profile';

const TYPES = ['discount', 'drop', 'free', 'cheapest'];
// Kolejność jednostek w "Najtaniej": w obrazach najpierw cena za obraz, w wideo za sekundę.
const UNIT_ORDER = {
  image: { image: 0, token: 1, second: 2 },
  video: { second: 0, image: 1, token: 2 },
  other: { token: 0, image: 1, second: 2 },
};
const byPrice = (cat) => {
  const order = UNIT_ORDER[cat] ?? UNIT_ORDER.other;
  return (a, b) => order[a.offer.unit] - order[b.offer.unit] || unitPrice(a.offer) - unitPrice(b.offer);
};

// "Najtaniej": każdy model z kategorii z najtańszą ofertą (także bez promocji, np. obrazy i wideo).
function cheapestDeals(snapshot, filter) {
  const out = [];
  for (const m of snapshot.models) {
    const offer = cheapest(m, undefined, filter);
    if (!offer) continue;
    const n = m.offers.filter((o) => o.unit === m.unit && (!filter || filter(o))).length;
    out.push({ model: m, modelId: m.id, offer, key: `${offer.src}:${offer.tag ?? offer.provider}`, type: 'cheapest', pct: 0, count: n });
  }
  return out.sort(byPrice('other'));
}

function Tile({ cat, count, best, type, on, dim, onPress, wide }) {
  const t = useTheme();
  const bg = cat === 'all' ? t.hero : t[cat];
  const note = type === 'cheapest'
    ? (count ? tr('tile.from', { price: best }) : tr('tile.noModels'))
    : count === 0
      ? tr(type === 'free' ? 'tile.noneFree' : 'tile.none')
      : type === 'free' ? tr('tile.freeModels') : tr('tile.upTo', { pct: best });
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      accessibilityLabel={`${catLabel(cat)}, ${count}, ${note}`}
      style={({ pressed }) => [
        s.tile,
        wide && s.wide,
        { backgroundColor: bg, opacity: dim ? 0.45 : pressed ? 0.85 : 1, borderColor: on ? t.ink : 'transparent' },
      ]}
    >
      {wide ? (
        <>
          <View style={{ flex: 1 }}>
            <T kind="small" style={s.tileTxt}>{tr(type === 'cheapest' ? 'tile.allModels' : 'tile.all')}</T>
            <T kind="big" style={s.tileTxt}>{count}</T>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <T kind="small" style={s.tileTxt}>{tr(type === 'free' ? 'deal.free' : type === 'cheapest' ? 'tile.sellers' : 'tile.biggest')}</T>
            <T kind="big" style={s.tileTxt}>{type === 'free' ? formatUsd(0) : type === 'cheapest' ? best : count ? `−${best}%` : '–'}</T>
          </View>
        </>
      ) : (
        <>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Icon name={cat} size={22} color="#fff" />
            <T kind="big" style={s.tileTxt}>{count}</T>
          </View>
          <View>
            <T kind="strong" style={s.tileTxt}>{catLabel(cat)}</T>
            <T kind="tiny" style={[s.tileTxt, { opacity: 0.9 }]}>{note}</T>
          </View>
        </>
      )}
      {on && !wide ? <View style={[s.check, { backgroundColor: '#fff' }]}><Icon name="check" size={13} color={bg} width={3} /></View> : null}
    </Pressable>
  );
}

export default function Deals({ snapshot, refreshing, onRefresh, onOpen, onBell, bellDot, priceStatus }) {
  const t = useTheme();
  const bottomSpace = useBottomSpace();
  const { profile, update } = useProfile();
  const [cat, setCat] = useState(profile.cats.length === 1 && profile.cats[0] !== 'all' ? profile.cats[0] : 'all');
  const [type, setType] = useState('discount');
  const favs = useMemo(
    () => viewFilter(profile),
    [profile.mode, profile.onlyFavorites, profile.providers], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const watched = useMemo(() => new Set(profile.watchlist.map((w) => w.modelId)), [profile.watchlist]);

  const all = useMemo(() => collectDeals(snapshot), [snapshot]);
  const cheap = useMemo(() => cheapestDeals(snapshot, favs), [snapshot, favs]);
  const visible = useMemo(() => all.filter((d) => !favs || d.type === 'free' || favs(d.offer)), [all, favs]);
  const ofType = type === 'cheapest' ? cheap : visible.filter((d) => d.type === type);
  const inCat = (d, c) => c === 'all' || d.model.cats.includes(c);
  const platformCount = useMemo(() => new Set(cheap.flatMap((d) => d.model.offers.filter((o) => !favs || favs(o)).map((o) => o.src === 'direct' ? o.provider : o.src))).size, [cheap, favs]);
  const stat = (c) => {
    const list = ofType.filter((d) => inCat(d, c));
    if (type === 'cheapest') {
      if (c === 'all') return { count: list.length, best: platformCount };
      const top = [...list].sort(byPrice(c))[0];
      return { count: list.length, best: top ? `${priceParts(top.offer).main}${priceParts(top.offer).unitShort}` : null };
    }
    return { count: list.length, best: list.reduce((m, d) => Math.max(m, d.pct), 0) };
  };
  const list = type === 'cheapest' ? ofType.filter((d) => inCat(d, cat)).sort(byPrice(cat)) : ofType.filter((d) => inCat(d, cat));
  const typeCounts = Object.fromEntries(TYPES.map((x) => [x, x === 'cheapest' ? null : visible.filter((d) => d.type === x).length]));
  const pick = (c) => setCat(cat === c ? 'all' : c);

  const header = (
    <View style={{ gap: space[3], marginBottom: space[1] }}>
      <Header
        kicker={profile.name ? tr('deals.hello', { name: profile.name }) : null}
        title={tr('deals.title')}
        right={<BellButton onPress={onBell} dot={bellDot} />}
      />
      <PriceStatus snapshot={snapshot} status={priceStatus} onRefresh={onRefresh} />
      <View style={s.grid}>
        <Tile wide cat="all" type={type} {...stat('all')} on={cat === 'all'} onPress={() => setCat('all')} />
        {['text', 'coding', 'image', 'video'].map((c) => (
          <Tile key={c} cat={c} type={type} {...stat(c)} on={cat === c} dim={cat !== 'all' && cat !== c} onPress={() => pick(c)} />
        ))}
      </View>
      <Segmented options={TYPES.map((x) => ({ value: x, label: tr(`type.${x}`), count: typeCounts[x] }))} value={type} onChange={setType} />
      {profile.onlyFavorites && profile.providers.length ? (
        <T kind="small" color="ink2">{tr('deals.onlyFav', { list: profile.providers.join(', ') })}</T>
      ) : !isPro(profile) ? (
        <T kind="small" color="ink2">{tr('deals.simpleNote', { n: PLATFORMS.length })}</T>
      ) : null}
    </View>
  );

  return (
    <FlatList
      data={list}
      keyExtractor={(d) => `${d.modelId}|${d.key}|${d.type}`}
      renderItem={({ item }) => <DealCard deal={item} pro={isPro(profile)} watched={watched.has(item.modelId)} onPress={() => onOpen(item.modelId)} />}
      contentContainerStyle={[styles.list, { paddingBottom: bottomSpace }]}
      initialNumToRender={10}
      refreshControl={<RefreshControl refreshing={false} onRefresh={onRefresh} tintColor={t.ink2} colors={[t.text]} />}
      ListHeaderComponent={header}
      ListEmptyComponent={
        type !== 'cheapest' && cheap.some((d) => inCat(d, cat)) && !all.some((d) => d.type === type && inCat(d, cat)) ? (
          <Empty
            icon={cat === 'all' ? 'tag' : cat}
            title={type === 'drop' ? tr('deals.noDrops') : tr('deals.none', { cat: catLabel(cat) })}
            body={tr('deals.tryCheapest')}
            action={<Button kind="line" label={tr('deals.showCheapest')} onPress={() => setType('cheapest')} />}
          />
        ) : profile.onlyFavorites && all.some((d) => d.type === type && inCat(d, cat)) ? (
          <Empty
            icon="star"
            title={tr('deals.favEmpty')}
            body={tr('deals.favEmptyBody')}
            action={<Button kind="line" label={tr('deals.showAll')} onPress={() => update({ onlyFavorites: false })} />}
          />
        ) : (
          <Empty
            icon="tag"
            title={type === 'drop' ? tr('deals.noDrops') : tr('deals.none', { cat: catLabel(cat) })}
            body={tr(type === 'drop' ? 'deals.noDropsBody' : 'deals.noneBody')}
          />
        )
      }
    />
  );
}

const s = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: { width: '48.8%', minHeight: 84, borderRadius: radius.lg, padding: 12, justifyContent: 'space-between', borderWidth: 2 },
  wide: { width: '100%', minHeight: 0, flexDirection: 'row', alignItems: 'center' },
  tileTxt: { color: '#fff' },
  check: { position: 'absolute', right: 8, bottom: 8, width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
});

