import { useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { CATEGORIES } from '../../../core/pricing.js';
import { Button, Pill, Row, T, ToggleRow } from '../ui';
import { font, radius, space, useTheme } from '../theme';
import { importProfile, useProfile } from '../profile';
import { enableNotifications } from '../alerts';
import ProviderPicker from './ProviderPicker';

const STEPS = 4;

export default function Onboarding({ snapshot, insets }) {
  const t = useTheme();
  const { profile, update } = useProfile();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState(() => ({ ...profile, cats: profile.cats.filter((c) => c !== 'all') }));
  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));

  const finish = () => update({ ...draft, cats: draft.cats.length ? draft.cats : ['all'], onboarded: true });

  const onImport = async () => {
    try {
      const p = await importProfile();
      if (p) update(p);
    } catch (e) {
      Alert.alert('Nie udało się wczytać profilu', e.message);
    }
  };

  const onNotify = async (on) => {
    if (!on) return set({ notify: { ...draft.notify, enabled: false } });
    const ok = await enableNotifications();
    set({ notify: { ...draft.notify, enabled: ok } });
    if (!ok) Alert.alert('Powiadomienia wyłączone', 'Możesz je włączyć później w ustawieniach telefonu i w zakładce Profil.');
  };

  const cats = useMemo(() => CATEGORIES.filter((c) => c.key !== 'all'), []);

  let body;
  if (step === 0) {
    body = (
      <>
        <T kind="display">Cześć! Pilnujmy razem cen za tokeny.</T>
        <T color="ink2" style={{ marginTop: space[3] }}>
          Pokażemy, gdzie dziś najtaniej użyjesz danego modelu, i ostrzeżemy, zanim skończy się promocja, z której korzystasz.
        </T>
        <T kind="strong" style={{ marginTop: space[6] }}>Jak mamy się do Ciebie zwracać?</T>
        <TextInput
          value={draft.name}
          onChangeText={(name) => set({ name })}
          placeholder="Imię lub pseudonim, opcjonalnie"
          placeholderTextColor={t.ink3}
          autoCapitalize="words"
          returnKeyType="next"
          onSubmitEditing={() => setStep(1)}
          style={[s.input, { borderColor: t.ink, color: t.ink, backgroundColor: t.sheet }]}
        />
        <T kind="small" color="ink3" style={{ marginTop: space[2] }}>Zostaje tylko na tym telefonie. Nie zakładamy kont.</T>
        <Button kind="line" label="Mam plik profilu" onPress={onImport} style={{ marginTop: space[6], alignSelf: 'flex-start' }} />
      </>
    );
  } else if (step === 1) {
    body = (
      <>
        <T kind="h1">Co Cię interesuje?</T>
        <T color="ink2" style={{ marginTop: space[2] }}>Ustawimy te kategorie na start. Zawsze możesz przełączyć na wszystkie.</T>
        <View style={s.wrap}>
          {cats.map((c) => (
            <Pill
              key={c.key}
              label={c.label}
              on={draft.cats.includes(c.key)}
              onPress={() => set({ cats: draft.cats.includes(c.key) ? draft.cats.filter((x) => x !== c.key) : [...draft.cats, c.key] })}
            />
          ))}
        </View>
        <T kind="small" color="ink3" style={{ marginTop: space[3] }}>Tekst to czat i pisanie treści, Kod to modele do programowania.</T>
      </>
    );
  } else if (step === 2) {
    body = (
      <>
        <T kind="h1">U kogo masz konto?</T>
        <T color="ink2" style={{ marginTop: space[2], marginBottom: space[4] }}>
          Zaznacz ulubionych dostawców. Wyróżnimy ich oferty i pozwolimy filtrować tylko do nich.
        </T>
        <ProviderPicker snapshot={snapshot} selected={draft.providers} onToggle={(name) =>
          set({ providers: draft.providers.includes(name) ? draft.providers.filter((x) => x !== name) : [...draft.providers, name] })}
        />
        <ToggleRow
          title="Pokazuj tylko ich oferty"
          body="Promocje i ceny tylko od zaznaczonych dostawców."
          value={draft.onlyFavorites}
          onChange={(onlyFavorites) => set({ onlyFavorites })}
        />
      </>
    );
  } else {
    body = (
      <>
        <T kind="h1">Powiadomienia i kopia</T>
        <ToggleRow
          title="Powiadamiaj o zmianach cen"
          body="Nowa zniżka na obserwowany model, koniec promocji, z której korzystasz, tańsza oferta."
          value={draft.notify.enabled}
          onChange={onNotify}
        />
        {Platform.OS === 'ios' ? (
          <ToggleRow
            title="Zachowaj profil po odinstalowaniu"
            body="Kopia w pęku kluczy iOS na tym telefonie. Po ponownej instalacji wszystko wróci."
            value={draft.keepAfterUninstall}
            onChange={(keepAfterUninstall) => set({ keepAfterUninstall })}
          />
        ) : (
          <T kind="small" color="ink2" style={{ marginTop: space[3] }}>
            Android robi kopię danych apki na Twoim koncie Google i odtworzy je po ponownej instalacji. Możesz to wyłączyć w ustawieniach kopii zapasowej telefonu.
          </T>
        )}
        <T kind="small" color="ink3" style={{ marginTop: space[4] }}>
          Profil możesz też wyeksportować do pliku w zakładce Profil. Nic nie trafia na nasze serwery, bo ich nie mamy.
        </T>
      </>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: t.paper }}>
      <ScrollView contentContainerStyle={[s.page, { paddingTop: insets.top + space[5] }]} keyboardShouldPersistTaps="handled">
        <Row style={{ marginBottom: space[6] }}>
          {Array.from({ length: STEPS }, (_, i) => (
            <View key={i} style={[s.step, { backgroundColor: i <= step ? t.ink : t.rule }]} />
          ))}
          <T kind="tiny" color="ink3">Krok {step + 1} z {STEPS}</T>
        </Row>
        {body}
      </ScrollView>
      <Row style={[s.footer, { paddingBottom: insets.bottom + space[4], borderTopColor: t.rule, backgroundColor: t.paper }]}>
        {step > 0 ? <Button kind="line" label="Wstecz" onPress={() => setStep(step - 1)} /> : <View />}
        <Button
          label={step === STEPS - 1 ? 'Zaczynamy' : step === 2 && !draft.providers.length ? 'Pomiń' : 'Dalej'}
          onPress={() => (step === STEPS - 1 ? finish() : setStep(step + 1))}
          style={{ flex: 1 }}
        />
      </Row>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  page: { padding: space[4], paddingBottom: space[7] },
  input: { marginTop: space[2], borderWidth: 1.5, borderRadius: radius.ui, paddingHorizontal: 14, paddingVertical: 12, fontSize: 17, fontFamily: font.textMedium },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2], marginTop: space[5] },
  step: { width: 28, height: 4, borderRadius: 2 },
  footer: { paddingHorizontal: space[4], paddingTop: space[3], borderTopWidth: StyleSheet.hairlineWidth },
});
