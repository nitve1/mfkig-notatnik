import { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { collectDeals, formatUsd } from '../../../core/pricing.js';
import { t as tr } from '../../../core/i18n.js';
import { isPro, viewFilter } from '../filters';
import { Button, Empty, Segmented, T } from '../ui';
import Icon from '../icons';
import { BellButton, catLabel, DealCard, Header, PriceStatus, styles } from '../parts';
import { radius, space, useTheme } from '../theme';
import { useProfile } from '../profile';

const TYPES = ['discount', 'drop', 'free'];

function Tile({ cat, count, best, type, on, dim, onPress, wide }) {
  const t = useTheme();
  const bg = cat === 'all' ? t.hero : t[cat];
  const note = count === 0
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
            <T kind="small" style={s.tileTxt}>{tr('tile.all')}</T>
            <T kind="big" style={s.tileTxt}>{count}</T>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <T kind="small" style={s.tileTxt}>{tr(type === 'free' ? 'deal.free' : 'tile.biggest')}</T>
            <T kind="big" style={s.tileTxt}>{type === 'free' ? formatUsd(0) : count ? `−${best}%` : '–'}</T>
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
  const { profile, update } = useProfile();
  const [cat, setCat] = useState(profile.cats.length === 1 && profile.cats[0] !== 'all' ? profile.cats[0] : 'all');
  const [type, setType] = useState('discount');
  const favs = useMemo(
    () => viewFilter(profile),
    [profile.mode, profile.onlyFavorites, profile.providers], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const watched = useMemo(() => new Set(profile.watchlist.map((w) => w.modelId)), [profile.watchlist]);

  const all = useMemo(() => collectDeals(snapshot), [snapshot]);
  const visible = useMemo(() => all.filter((d) => !favs || d.type === 'free' || favs(d.offer)), [all, favs]);
  const ofType = visible.filter((d) => d.type === type);
  const inCat = (d, c) => c === 'all' || d.model.cats.includes(c);
  const stat = (c) => {
    const list = ofType.filter((d) => inCat(d, c));
    return { count: list.length, best: list.reduce((m, d) => Math.max(m, d.pct), 0) };
  };
  const list = ofType.filter((d) => inCat(d, cat));
  const typeCounts = Object.fromEntries(TYPES.map((x) => [x, visible.filter((d) => d.type === x).length]));
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
        <T kind="small" color="ink2">{tr('deals.simpleNote')}</T>
      ) : null}
    </View>
  );

  return (
    <FlatList
      data={list}
      keyExtractor={(d) => `${d.modelId}|${d.key}|${d.type}`}
      renderItem={({ item }) => <DealCard deal={item} pro={isPro(profile)} watched={watched.has(item.modelId)} onPress={() => onOpen(item.modelId)} />}
      contentContainerStyle={styles.list}
      initialNumToRender={10}
      refreshControl={<RefreshControl refreshing={false} onRefresh={onRefresh} tintColor={t.ink2} colors={[t.text]} />}
      ListHeaderComponent={header}
      ListEmptyComponent={
        profile.onlyFavorites && all.some((d) => d.type === type && inCat(d, cat)) ? (
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

