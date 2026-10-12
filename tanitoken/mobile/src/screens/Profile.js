import { Alert, Linking, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Button, Pill, Row, Section, Segmented, T, ToggleRow } from '../ui';
import { Header } from '../parts';
import { font, radius, space, useTheme } from '../theme';
import { exportProfile, importProfile, useProfile } from '../profile';
import { disableBackground, enableNotifications } from '../alerts';
import ProviderPicker from './ProviderPicker';

const PRIVACY_URL = 'https://nitve1.github.io/mfkig-notatnik/tanitoken/landing/prywatnosc.html';
const CATS = [
  { key: 'text', label: 'Tekst', icon: 'text' },
  { key: 'coding', label: 'Kod', icon: 'coding' },
  { key: 'image', label: 'Obraz', icon: 'image' },
  { key: 'video', label: 'Wideo', icon: 'video' },
];
export const THEME_OPTIONS = [
  { value: 'system', label: 'Systemowy', icon: 'phone' },
  { value: 'light', label: 'Jasny', icon: 'sun' },
  { value: 'dark', label: 'Ciemny', icon: 'moon' },
];

export default function Profile({ snapshot }) {
  const t = useTheme();
  const { profile, update, toggleProvider, replace, reset } = useProfile();
  const n = profile.notify;
  const setNotify = (patch) => update({ notify: { ...n, ...patch } });

  const onMaster = async (on) => {
    if (!on) {
      setNotify({ enabled: false });
      await disableBackground();
      return;
    }
    const ok = await enableNotifications();
    setNotify({ enabled: ok });
    if (!ok) {
      Alert.alert('Brak zgody na powiadomienia', 'Włącz je dla TaniToken w ustawieniach telefonu.', [
        { text: 'Anuluj', style: 'cancel' },
        { text: 'Otwórz ustawienia', onPress: () => Linking.openSettings() },
      ]);
    }
  };

  const toggleCat = (key) => {
    const cur = profile.cats.filter((c) => c !== 'all');
    const next = cur.includes(key) ? cur.filter((c) => c !== key) : [...cur, key];
    update({ cats: next.length ? next : ['all'] });
  };

  const onImport = async () => {
    try {
      const p = await importProfile();
      if (p) {
        replace({ ...p, sent: profile.sent, alerts: profile.alerts });
        Alert.alert('Profil wczytany', `Obserwowane modele: ${p.watchlist.length}.`);
      }
    } catch (e) {
      Alert.alert('Nie udało się wczytać profilu', e.message);
    }
  };

  const onReset = () =>
    Alert.alert('Usunąć profil?', 'Znikną obserwowane modele, ulubieni dostawcy i ustawienia. Tego nie da się cofnąć.', [
      { text: 'Anuluj', style: 'cancel' },
      { text: 'Usuń profil', style: 'destructive', onPress: () => { disableBackground(); reset(); } },
    ]);

  return (
    <ScrollView contentContainerStyle={{ padding: space[4], paddingBottom: space[7] }} keyboardShouldPersistTaps="handled">
      <Header kicker="Zapisany tylko na tym telefonie" title="Profil" />

      <Section title="Wygląd">
        <View style={{ paddingVertical: space[3], gap: space[2] }}>
          <Segmented options={THEME_OPTIONS} value={profile.theme ?? 'system'} onChange={(theme) => update({ theme })} />
          <T kind="small" color="ink2">Systemowy przełącza się razem z trybem nocnym telefonu.</T>
        </View>
      </Section>

      <Section title="O Tobie">
        <View style={{ paddingVertical: space[3], gap: space[2] }}>
          <T kind="small" color="ink2">Imię lub pseudonim</T>
          <TextInput
            value={profile.name}
            onChangeText={(name) => update({ name })}
            placeholder="Opcjonalnie"
            placeholderTextColor={t.ink3}
            style={[s.input, { borderColor: t.line, color: t.ink, backgroundColor: t.bg }]}
          />
          <T kind="small" color="ink2" style={{ marginTop: space[2] }}>Kategorie na start</T>
          <View style={s.wrap}>
            {CATS.map((c) => (
              <Pill key={c.key} label={c.label} icon={c.icon} color={t[c.key]} on={profile.cats.includes(c.key)} onPress={() => toggleCat(c.key)} />
            ))}
          </View>
        </View>
      </Section>

      <Section title="Ulubieni dostawcy">
        <View style={{ paddingTop: space[3] }}>
          <ProviderPicker snapshot={snapshot} selected={profile.providers} onToggle={toggleProvider} />
        </View>
        <ToggleRow
          last
          title="Pokazuj tylko ich oferty"
          body={profile.providers.length ? `Zaznaczonych: ${profile.providers.length}. Alerty „taniej” też porównują tylko z nimi.` : 'Najpierw zaznacz dostawców powyżej.'}
          value={profile.onlyFavorites && profile.providers.length > 0}
          onChange={(onlyFavorites) => update({ onlyFavorites })}
        />
      </Section>

      <Section title="Powiadomienia">
        <ToggleRow last={!n.enabled} title="Powiadomienia" body="Sprawdzamy ceny w tle mniej więcej co 30 minut i przy każdym otwarciu apki." value={n.enabled} onChange={onMaster} />
        {n.enabled ? (
          <>
            <ToggleRow title="Koniec promocji" body="Zniżka na model, którego używasz albo obserwujesz, zniknęła." value={n.promoEnd} onChange={(v) => setNotify({ promoEnd: v })} />
            <ToggleRow title="Promocja się kończy" body="Trwa prawie tyle, ile zwykle u tego dostawcy." value={n.aging} onChange={(v) => setNotify({ aging: v })} />
            <ToggleRow title="Nowe promocje" body="Zniżka lub darmowy wariant obserwowanego modelu." value={n.promoStart} onChange={(v) => setNotify({ promoStart: v })} />
            <ToggleRow title="Taniej gdzie indziej" body="Ktoś jest tańszy o co najmniej 20% niż Twój dostawca." value={n.cheaper} onChange={(v) => setNotify({ cheaper: v })} />
            <ToggleRow last title="Wycofanie modelu" body="Model zniknie z oferty w ciągu 14 dni." value={n.expires} onChange={(v) => setNotify({ expires: v })} />
          </>
        ) : null}
      </Section>

      <Section title="Kopia profilu">
        {Platform.OS === 'ios' ? (
          <ToggleRow
            title="Zachowaj po odinstalowaniu"
            body="Kopia w pęku kluczy iOS na tym telefonie. Wraca po ponownej instalacji."
            value={profile.keepAfterUninstall}
            onChange={(keepAfterUninstall) => update({ keepAfterUninstall })}
          />
        ) : (
          <T kind="small" color="ink2" style={{ paddingVertical: space[3] }}>
            Android zapisuje dane apki w kopii zapasowej Twojego konta Google i odtwarza je po ponownej instalacji.
          </T>
        )}
        <Row style={{ paddingVertical: space[3], gap: space[2] }}>
          <Button kind="line" label="Eksportuj" onPress={() => exportProfile(profile).catch((e) => Alert.alert('Eksport nie powiódł się', e.message))} />
          <Button kind="line" label="Wczytaj" onPress={onImport} />
        </Row>
      </Section>

      <Section title="O aplikacji">
        <T kind="small" color="ink2" style={{ paddingTop: space[3] }}>
          Ceny z OpenRouter, Vercel AI Gateway, Requesty i katalogu models.dev, odświeżane co 15 minut. Linki „Partner” są partnerskie, a kolejność ofert zależy wyłącznie od ceny.
        </T>
        <Row style={{ paddingVertical: space[3], gap: space[2] }}>
          <Button kind="line" label="Prywatność" onPress={() => Linking.openURL(PRIVACY_URL)} />
          <Button kind="line" label="Usuń profil" onPress={onReset} />
        </Row>
      </Section>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  input: { borderWidth: 1.5, borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, fontFamily: font.textMedium },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
});
