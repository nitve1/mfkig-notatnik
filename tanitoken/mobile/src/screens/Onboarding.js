import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Button, Row, Section, Segmented, T, ToggleRow } from '../ui';
import Icon from '../icons';
import { ThemeContext, font, radius, space, useTheme } from '../theme';
import { importProfile, useProfile } from '../profile';
import { enableNotifications } from '../alerts';
import ProviderPicker from './ProviderPicker';
import { THEME_OPTIONS } from './Profile';

const STEPS = 4;
const CATS = [
  { key: 'text', label: 'Tekst', note: 'czat, pisanie, analiza' },
  { key: 'coding', label: 'Kod', note: 'programowanie, agenci' },
  { key: 'image', label: 'Obraz', note: 'generowanie grafik' },
  { key: 'video', label: 'Wideo', note: 'generowanie filmów' },
];

function Body({ snapshot, insets, draft, set, step, setStep, finish }) {
  const t = useTheme();

  const onImport = async () => {
    try {
      const p = await importProfile();
      if (p) finish(p);
    } catch (e) {
      Alert.alert('Nie udało się wczytać profilu', e.message);
    }
  };

  const onNotify = async (on) => {
    if (!on) return set({ notify: { ...draft.notify, enabled: false } });
    const ok = await enableNotifications();
    set({ notify: { ...draft.notify, enabled: ok } });
    if (!ok) Alert.alert('Powiadomienia wyłączone', 'Możesz je włączyć później w Profilu.');
  };

  let body;
  if (step === 0) {
    body = (
      <>
        <T kind="display">Co dziś tanieje w AI?</T>
        <T color="ink2" style={{ marginTop: space[2] }}>
          Porównujemy ceny modeli u ponad 200 dostawców i ostrzegamy, zanim skończy się promocja, z której korzystasz.
        </T>
        <View style={[s.card, { backgroundColor: t.card, marginTop: space[5] }]}>
          <T kind="strong">Jak mamy się do Ciebie zwracać?</T>
          <TextInput
            value={draft.name}
            onChangeText={(name) => set({ name })}
            placeholder="Imię lub pseudonim, opcjonalnie"
            placeholderTextColor={t.ink3}
            autoCapitalize="words"
            returnKeyType="next"
            onSubmitEditing={() => setStep(1)}
            style={[s.input, { borderColor: t.line, color: t.ink, backgroundColor: t.bg }]}
          />
          <T kind="small" color="ink2">Zostaje tylko na tym telefonie. Bez konta i logowania.</T>
        </View>
        <Pressable onPress={onImport} accessibilityRole="button" style={{ marginTop: space[4], alignSelf: 'flex-start' }}>
          <T kind="small" style={{ color: t.text, fontFamily: font.textBold }}>Mam plik profilu z innego telefonu</T>
        </Pressable>
      </>
    );
  } else if (step === 1) {
    body = (
      <>
        <T kind="display">Co Cię interesuje?</T>
        <T color="ink2" style={{ marginTop: space[2] }}>Te kategorie pokażemy na start. Zawsze możesz przełączyć na wszystkie.</T>
        <View style={s.grid}>
          {CATS.map((c) => {
            const on = draft.cats.includes(c.key);
            return (
              <Pressable
                key={c.key}
                onPress={() => set({ cats: on ? draft.cats.filter((x) => x !== c.key) : [...draft.cats, c.key] })}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                style={[s.tile, { backgroundColor: on ? t[c.key] : t.card, borderColor: t[c.key] }]}
              >
                <Row style={{ justifyContent: 'space-between' }}>
                  <Icon name={c.key} size={26} color={on ? '#fff' : t[c.key]} />
                  <View style={[s.check, { borderColor: on ? '#fff' : t.line, backgroundColor: on ? '#fff' : 'transparent' }]}>
                    {on ? <Icon name="check" size={13} color={t[c.key]} width={3} /> : null}
                  </View>
                </Row>
                <View>
                  <T kind="h2" style={{ color: on ? '#fff' : t.ink }}>{c.label}</T>
                  <T kind="small" style={{ color: on ? '#ffffffd9' : t.ink2 }}>{c.note}</T>
                </View>
              </Pressable>
            );
          })}
        </View>
      </>
    );
  } else if (step === 2) {
    body = (
      <>
        <T kind="display">U kogo masz konto?</T>
        <T color="ink2" style={{ marginTop: space[2] }}>Ulubionych dostawców wyróżnimy i pozwolimy filtrować oferty tylko do nich.</T>
        <View style={[s.card, { backgroundColor: t.card, marginTop: space[4] }]}>
          <ProviderPicker
            snapshot={snapshot}
            selected={draft.providers}
            onToggle={(name) => set({ providers: draft.providers.includes(name) ? draft.providers.filter((x) => x !== name) : [...draft.providers, name] })}
          />
          <ToggleRow last title="Pokazuj tylko ich oferty" value={draft.onlyFavorites} onChange={(onlyFavorites) => set({ onlyFavorites })} />
        </View>
      </>
    );
  } else {
    body = (
      <>
        <T kind="display">Ostatnie szczegóły</T>
        <Section title="Wygląd">
          <View style={{ paddingVertical: space[3] }}>
            <Segmented options={THEME_OPTIONS} value={draft.theme} onChange={(theme) => set({ theme })} />
          </View>
        </Section>
        <Section title="Powiadomienia">
          <ToggleRow
            last
            title="Powiadamiaj o zmianach cen"
            body="Koniec promocji, z której korzystasz, nowa zniżka na obserwowany model, tańsza oferta."
            value={draft.notify.enabled}
            onChange={onNotify}
          />
        </Section>
        <Section title="Kopia profilu">
          {Platform.OS === 'ios' ? (
            <ToggleRow
              last
              title="Zachowaj po odinstalowaniu"
              body="Kopia w pęku kluczy iOS. Wraca po ponownej instalacji."
              value={draft.keepAfterUninstall}
              onChange={(keepAfterUninstall) => set({ keepAfterUninstall })}
            />
          ) : (
            <T kind="small" color="ink2" style={{ paddingVertical: space[3] }}>
              Android robi kopię na Twoim koncie Google i odtworzy profil po ponownej instalacji. Nic nie trafia na nasze serwery, bo ich nie mamy.
            </T>
          )}
        </Section>
      </>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView contentContainerStyle={[s.page, { paddingTop: insets.top + space[4] }]} keyboardShouldPersistTaps="handled">
        <Row style={{ gap: 6, marginBottom: space[5] }}>
          {Array.from({ length: STEPS }, (_, i) => (
            <View key={i} style={[s.step, { backgroundColor: i <= step ? t[['text', 'coding', 'image', 'video'][i]] : t.seg }]} />
          ))}
        </Row>
        {body}
      </ScrollView>
      <Row style={[s.footer, { paddingBottom: insets.bottom + space[3], backgroundColor: t.bg }]}>
        {step > 0 ? <Button kind="line" label="Wstecz" onPress={() => setStep(step - 1)} style={{ flex: 0, minWidth: 116 }} /> : null}
        <Button
          label={step === STEPS - 1 ? 'Zaczynamy' : step === 2 && !draft.providers.length ? 'Pomiń' : 'Dalej'}
          onPress={() => (step === STEPS - 1 ? finish() : setStep(step + 1))}
        />
      </Row>
    </KeyboardAvoidingView>
  );
}

export default function Onboarding({ snapshot, insets }) {
  const { profile, update } = useProfile();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState(() => ({ ...profile, cats: profile.cats.filter((c) => c !== 'all') }));
  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));
  const finish = (imported) =>
    update(imported ?? { ...draft, cats: draft.cats.length ? draft.cats : ['all'], onboarded: true });

  // Wybrany w kroku 4 motyw widać od razu.
  return (
    <ThemeContext.Provider value={draft.theme ?? 'system'}>
      <Body snapshot={snapshot} insets={insets} draft={draft} set={set} step={step} setStep={setStep} finish={finish} />
    </ThemeContext.Provider>
  );
}

const s = StyleSheet.create({
  page: { padding: space[4], paddingBottom: space[7] },
  card: { borderRadius: radius.lg, padding: space[4], gap: space[2] },
  input: { borderWidth: 1.5, borderRadius: radius.sm, paddingHorizontal: 14, paddingVertical: 12, fontSize: 17, fontFamily: font.textMedium },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: space[5] },
  tile: { width: '48.4%', minHeight: 130, borderRadius: radius.lg, padding: 14, justifyContent: 'space-between', borderWidth: 2 },
  check: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  step: { flex: 1, height: 5, borderRadius: 3 },
  footer: { paddingHorizontal: space[4], paddingTop: space[3], gap: space[2] },
});
