import { Alert, Linking, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { CATEGORIES } from '../../../core/pricing.js';
import { Button, Pill, Row, Rule, T, ToggleRow } from '../ui';
import { Header } from '../parts';
import { font, radius, space, useTheme } from '../theme';
import { exportProfile, importProfile, useProfile } from '../profile';
import { disableBackground, enableNotifications } from '../alerts';
import ProviderPicker from './ProviderPicker';

const PRIVACY_URL = 'https://nitve1.github.io/mfkig-notatnik/tanitoken/landing/prywatnosc.html';

function Section({ title, children }) {
  return (
    <View style={{ marginTop: space[6] }}>
      <T kind="h2" style={{ marginBottom: space[2] }}>{title}</T>
      <Rule />
      <View style={{ paddingTop: space[2] }}>{children}</View>
    </View>
  );
}

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
      <Header title="Profil" sub="Zapisany tylko na tym telefonie" />

      <T kind="strong">Imię lub pseudonim</T>
      <TextInput
        value={profile.name}
        onChangeText={(name) => update({ name })}
        placeholder="Opcjonalnie"
        placeholderTextColor={t.ink3}
        style={[s.input, { borderColor: t.rule, color: t.ink, backgroundColor: t.sheet }]}
      />

      <Section title="Kategorie na start">
        <View style={s.wrap}>
          {CATEGORIES.filter((c) => c.key !== 'all').map((c) => (
            <Pill key={c.key} label={c.label} on={profile.cats.includes(c.key)} onPress={() => toggleCat(c.key)} />
          ))}
        </View>
        <T kind="small" color="ink3">Bez zaznaczenia pokazujemy wszystkie kategorie.</T>
      </Section>

      <Section title="Ulubieni dostawcy">
        <ProviderPicker snapshot={snapshot} selected={profile.providers} onToggle={toggleProvider} />
        <ToggleRow
          title="Pokazuj tylko ich oferty"
          body={profile.providers.length ? `Zaznaczonych: ${profile.providers.length}.` : 'Najpierw zaznacz dostawców powyżej.'}
          value={profile.onlyFavorites && profile.providers.length > 0}
          onChange={(onlyFavorites) => update({ onlyFavorites })}
        />
      </Section>

      <Section title="Powiadomienia">
        <ToggleRow title="Powiadomienia" body="Sprawdzamy ceny w tle mniej więcej co 30 minut i przy każdym otwarciu apki." value={n.enabled} onChange={onMaster} />
        {n.enabled ? (
          <>
            <ToggleRow title="Koniec promocji" body="Zniżka na model, którego używasz albo obserwujesz, zniknęła." value={n.promoEnd} onChange={(v) => setNotify({ promoEnd: v })} />
            <ToggleRow title="Promocja może się kończyć" body="Trwa już prawie tyle, ile zwykle u tego dostawcy." value={n.aging} onChange={(v) => setNotify({ aging: v })} />
            <ToggleRow title="Nowe promocje" body="Zniżka lub darmowy wariant obserwowanego modelu." value={n.promoStart} onChange={(v) => setNotify({ promoStart: v })} />
            <ToggleRow title="Taniej gdzie indziej" body="Inny dostawca jest tańszy o co najmniej 20% niż ten, którego używasz." value={n.cheaper} onChange={(v) => setNotify({ cheaper: v })} />
            <ToggleRow title="Wycofanie modelu" body="Model zniknie z oferty w ciągu 14 dni." value={n.expires} onChange={(v) => setNotify({ expires: v })} />
          </>
        ) : null}
      </Section>

      <Section title="Kopia profilu">
        {Platform.OS === 'ios' ? (
          <ToggleRow
            title="Zachowaj po odinstalowaniu"
            body="Profil trafia też do pęku kluczy iOS na tym telefonie i wraca po ponownej instalacji."
            value={profile.keepAfterUninstall}
            onChange={(keepAfterUninstall) => update({ keepAfterUninstall })}
          />
        ) : (
          <T kind="small" color="ink2" style={{ paddingVertical: space[2] }}>
            Android zapisuje dane apki w kopii zapasowej Twojego konta Google i odtwarza je po ponownej instalacji. Wyłączysz to w ustawieniach kopii zapasowej telefonu.
          </T>
        )}
        <Row style={{ flexWrap: 'wrap', marginTop: space[3] }}>
          <Button kind="line" label="Eksportuj do pliku" onPress={() => exportProfile(profile).catch((e) => Alert.alert('Eksport nie powiódł się', e.message))} />
          <Button kind="line" label="Wczytaj z pliku" onPress={onImport} />
        </Row>
      </Section>

      <Section title="O aplikacji">
        <T kind="small" color="ink2">
          Ceny z OpenRouter, Vercel AI Gateway, Requesty i katalogu models.dev, odświeżane co 15 minut. Część linków do dostawców może być partnerska. Oznaczamy je, a kolejność ofert zależy wyłącznie od ceny.
        </T>
        <Row style={{ flexWrap: 'wrap', marginTop: space[3] }}>
          <Button kind="line" label="Prywatność" onPress={() => Linking.openURL(PRIVACY_URL)} />
          <Button kind="line" label="Usuń profil" onPress={onReset} />
        </Row>
      </Section>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  input: { marginTop: space[2], borderWidth: 1.5, borderRadius: radius.ui, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, fontFamily: font.text },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2], marginBottom: space[2] },
});
