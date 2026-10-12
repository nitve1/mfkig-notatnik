import { useMemo, useState } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';
import { CATEGORIES, collectDeals, timeAgo } from '../../../core/pricing.js';
import { Button, Empty, Segmented, T } from '../ui';
import { DealRow, Header } from '../parts';
import { space, useTheme } from '../theme';
import { useProfile } from '../profile';

const TYPES = [
  { value: 'discount', label: 'Zniżki' },
  { value: 'drop', label: 'Obniżki cen' },
  { value: 'free', label: 'Darmowe' },
];

export default function Deals({ snapshot, refreshing, onRefresh, onOpen }) {
  const t = useTheme();
  const { profile, update } = useProfile();
  const [cat, setCat] = useState(profile.cats.length === 1 ? profile.cats[0] : 'all');
  const [type, setType] = useState('discount');
  const favs = profile.onlyFavorites && profile.providers.length ? new Set(profile.providers) : null;
  const watched = useMemo(() => new Set(profile.watchlist.map((w) => w.modelId)), [profile.watchlist]);

  const deals = useMemo(() => collectDeals(snapshot), [snapshot]);
  const visible = useMemo(
    () => deals.filter((d) => !favs || d.type === 'free' || favs.has(d.provider)),
    [deals, favs],
  );
  const inCat = (d, c) => c === 'all' || d.model.cats.includes(c);
  const list = visible.filter((d) => d.type === type && inCat(d, cat));
  const cats = CATEGORIES.filter((c) => c.key === 'all' || profile.cats.includes('all') || profile.cats.includes(c.key) || c.key === cat)
    .map((c) => ({ value: c.key, label: c.label, count: visible.filter((d) => d.type === type && inCat(d, c.key)).length }));
  const hello = profile.name ? `${profile.name}, ` : '';

  return (
    <FlatList
      data={list}
      keyExtractor={(d) => `${d.modelId}|${d.key}|${d.type}`}
      renderItem={({ item }) => <DealRow deal={item} watched={watched.has(item.modelId)} onPress={() => onOpen(item.modelId)} />}
      contentContainerStyle={{ padding: space[4], paddingBottom: space[6] }}
      initialNumToRender={14}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.ink} colors={[t.ink]} />}
      ListHeaderComponent={
        <View style={{ gap: space[3], marginBottom: space[3] }}>
          <Header
            title="Promocje"
            sub={snapshot.partial
              ? 'Ceny bazowe z OpenRouter, pełne zestawienie chwilowo niedostępne'
              : `${hello}ceny sprzed ${timeAgo(snapshot.generatedAt).replace(' temu', '')}`}
          />
          <Segmented options={cats} value={cat} onChange={setCat} />
          <Segmented options={TYPES} value={type} onChange={setType} />
          {favs ? <T kind="small" color="ink3">Tylko ulubieni dostawcy ({favs.size}).</T> : null}
        </View>
      }
      ListEmptyComponent={
        favs && deals.some((d) => d.type === type && inCat(d, cat)) ? (
          <Empty
            title="U ulubionych dostawców nic teraz nie ma"
            body="Inni dostawcy mają promocje w tej kategorii."
            action={<Button kind="line" label="Pokaż wszystkich dostawców" onPress={() => update({ onlyFavorites: false })} />}
          />
        ) : (
          <Empty
            title={type === 'drop' ? 'Nikt ostatnio nie obniżył cen' : 'Brak promocji w tej kategorii'}
            body={type === 'drop' ? 'Obniżki wykrywamy co 15 minut i pokazujemy przez 7 dni.' : 'Wybierz inną kategorię albo rodzaj promocji.'}
          />
        )
      }
    />
  );
}
