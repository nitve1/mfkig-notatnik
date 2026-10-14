import { useEffect, useState } from 'react';
import { Alert, BackHandler, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Button, Row, Section, Segmented, T, ToggleRow, MAX_FONT_SCALE } from '../ui';
import Icon from '../icons';
import { ThemeContext, font, radius, space, useTheme } from '../theme';
import { importProfile, useProfile } from '../profile';
import { enableNotifications } from '../alerts';
import ProviderPicker from './ProviderPicker';
import { LanguagePicker, modeNote, modeOptions } from './Profile';
import { TILE } from '../theme';
import { GlassFx, glassFrame } from '../glass';
import { t as tr } from '../../../core/i18n.js';

const STEPS = 4;
const CATS = ['text', 'coding', 'image', 'video'].map((key) => ({ key }));

function Body({ snapshot, insets, draft, set, step, setStep, finish }) {
  const t = useTheme();
  const { profile, update } = useProfile();

  const onImport = async () => {
    try {
      const p = await importProfile();
      if (p) finish(p);
    } catch (e) {
      Alert.alert(tr('backup.importFailed'), e.message);
    }
  };

  const onNotify = async (on) => {
    if (!on) return set({ notify: { ...draft.notify, enabled: false } });
    const ok = await enableNotifications();
    set({ notify: { ...draft.notify, enabled: ok } });
    if (!ok) Alert.alert(tr('onb.notifOffTitle'), tr('onb.notifOffBody'));
  };

  let body;
  if (step === 0) {
    body = (
      <>
        <View style={{ marginBottom: space[4] }}>
          <LanguagePicker value={profile.language} onChange={(language) => update({ language })} />
        </View>
        <T kind="display">{tr('onb.title')}</T>
        <T color="ink2" style={{ marginTop: space[2] }}>{tr('onb.intro')}</T>
        <View style={[s.card, glassFrame(t, 14), { backgroundColor: t.card, marginTop: space[5] }]}>
          <GlassFx />
          <T kind="strong">{tr('onb.nameQ')}</T>
          <TextInput
          maxFontSizeMultiplier={MAX_FONT_SCALE}
            value={draft.name}
            onChangeText={(name) => set({ name })}
            placeholder={tr('onb.namePh')}
            placeholderTextColor={t.ink3}
            autoCapitalize="words"
            returnKeyType="next"
            onSubmitEditing={() => setStep(1)}
            style={[s.input, { borderColor: t.glassLine, color: t.ink, backgroundColor: 'rgba(0,0,0,0.25)' }]}
          />
          <T kind="small" color="ink2">{tr('onb.nameNote')}</T>
        </View>
        <Pressable onPress={onImport} accessibilityRole="button" hitSlop={8} style={{ marginTop: space[3], alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' }}>
          <T kind="small" style={{ color: t.text, fontFamily: font.textBold }}>{tr('onb.haveFile')}</T>
        </Pressable>
      </>
    );
  } else if (step === 1) {
    body = (
      <>
        <T kind="display">{tr('onb.catsTitle')}</T>
        <T color="ink2" style={{ marginTop: space[2] }}>{tr('onb.catsBody')}</T>
        <View style={s.grid}>
          {CATS.map((c) => {
            const on = draft.cats.includes(c.key);
            return (
              <Pressable
                key={c.key}
                onPress={() => set({ cats: on ? draft.cats.filter((x) => x !== c.key) : [...draft.cats, c.key] })}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                style={[s.tile, { backgroundColor: on ? TILE[c.key] : t.card, borderColor: t[c.key] }]}
              >
                <Row style={{ justifyContent: 'space-between' }}>
                  <Icon name={c.key} size={26} color={on ? '#fff' : t[c.key]} />
                  <View style={[s.check, { borderColor: on ? '#fff' : t.line, backgroundColor: on ? '#fff' : 'transparent' }]}>
                    {on ? <Icon name="check" size={13} color={t[c.key]} width={3} /> : null}
                  </View>
                </Row>
                <View>
                  <T kind="h2" style={{ color: on ? '#fff' : t.ink }}>{tr(`cat.${c.key}`)}</T>
                  <T kind="small" style={{ color: on ? '#ffffffd9' : t.ink2 }}>{tr(`catNote.${c.key}`)}</T>
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
        <T kind="display">{tr('onb.accTitle')}</T>
        <T color="ink2" style={{ marginTop: space[2] }}>{tr('onb.accBody')}</T>
        <View style={[s.card, glassFrame(t, 14), { backgroundColor: t.card, marginTop: space[4] }]}>
          <GlassFx />
          <Segmented options={modeOptions()} value={draft.mode ?? 'simple'} onChange={(mode) => set({ mode })} />
          <T kind="small" color="ink2" style={{ marginBottom: space[2] }}>{modeNote(draft.mode)}</T>
          <ProviderPicker
            pro={draft.mode === 'pro'}
            snapshot={snapshot}
            selected={draft.providers}
            onToggle={(name) => set({ providers: draft.providers.includes(name) ? draft.providers.filter((x) => x !== name) : [...draft.providers, name] })}
          />
          <ToggleRow last title={tr('profile.onlyFav')} value={draft.onlyFavorites} onChange={(onlyFavorites) => set({ onlyFavorites })} />
        </View>
      </>
    );
  } else {
    body = (
      <>
        <T kind="display">{tr('onb.lastTitle')}</T>
        <Section title={tr('notif.title')}>
          <ToggleRow
            last
            title={tr('onb.notif')}
            body={tr('onb.notifBody')}
            value={draft.notify.enabled}
            onChange={onNotify}
          />
        </Section>
        <Section title={tr('backup.title')}>
          {Platform.OS === 'ios' ? (
            <ToggleRow
              last
              title={tr('backup.keep')}
              body={tr('backup.keepBody')}
              value={draft.keepAfterUninstall}
              onChange={(keepAfterUninstall) => set({ keepAfterUninstall })}
            />
          ) : (
            <T kind="small" color="ink2" style={{ paddingVertical: space[3] }}>
              {tr('backup.androidOnb')}
            </T>
          )}
        </Section>
      </>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={[s.page, { paddingTop: insets.top + space[4] }]} keyboardShouldPersistTaps="handled">
        <Row style={{ gap: 6, marginBottom: space[5] }}>
          {Array.from({ length: STEPS }, (_, i) => (
            <View key={i} style={[s.step, { backgroundColor: i <= step ? t[['text', 'coding', 'image', 'video'][i]] : t.seg }]} />
          ))}
        </Row>
        {body}
      </ScrollView>
      <Row style={[s.footer, { paddingBottom: insets.bottom + space[3], backgroundColor: 'rgba(12,10,23,0.88)', borderTopWidth: 1, borderTopColor: t.glassLine }]}>
        {step > 0 ? <Button kind="line" label={tr('common.back')} onPress={() => setStep(step - 1)} style={{ flex: 0, minWidth: 116 }} /> : null}
        <Button
          label={tr(step === STEPS - 1 ? 'onb.start' : step === 2 && !draft.providers.length ? 'onb.skip' : 'onb.next')}
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
  // Język wybrany w 1. kroku jest już zapisany w profilu (zmienia się od razu), więc nie nadpisujemy go
  // kopią z chwili otwarcia kreatora.
  const finish = (imported) => {
    if (imported) return update(imported);
    const { language: _lang, ...rest } = draft;
    return update({ ...rest, cats: draft.cats.length ? draft.cats : ['all'], onboarded: true });
  };

  // Wstecz na Androidzie cofa krok kreatora zamiast zamykać apkę.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (step > 0) { setStep(step - 1); return true; }
      return false;
    });
    return () => sub.remove();
  }, [step]);

  // Wybrany w kroku 4 motyw widać od razu.
  return (
    <ThemeContext.Provider value={draft.theme ?? 'system'}>
      <Body snapshot={snapshot} insets={insets} draft={draft} set={set} step={step} setStep={setStep} finish={finish} />
    </ThemeContext.Provider>
  );
}

const s = StyleSheet.create({
  page: { padding: space[4], paddingBottom: space[7] },
  card: { padding: space[4], gap: space[2] },
  input: { minHeight: 44, borderWidth: 1.5, borderRadius: radius.sm, paddingHorizontal: 14, paddingVertical: 12, fontSize: 17, fontFamily: font.textMedium },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: space[5] },
  tile: { width: '48.4%', minHeight: 130, borderRadius: radius.lg, padding: 14, justifyContent: 'space-between', borderWidth: 2 },
  check: { width: 22, height: 22, borderRadius: 7, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  step: { flex: 1, height: 5, borderRadius: 3 },
  footer: { paddingHorizontal: space[4], paddingTop: space[3], gap: space[2] },
});
