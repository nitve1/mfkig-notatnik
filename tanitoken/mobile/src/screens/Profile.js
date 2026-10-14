import { Alert, Linking, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { LANGUAGES, t as tr } from '../../../core/i18n.js';
import { Button, Pill, Row, Section, Segmented, T, ToggleRow, MAX_FONT_SCALE } from '../ui';
import { Header, PriceStatus } from '../parts';
import { font, radius, space, useBottomSpace, useTheme } from '../theme';
import { exportProfile, importProfile, useProfile } from '../profile';
import { disableBackground, enableNotifications } from '../alerts';
import ProviderPicker from './ProviderPicker';

const PRIVACY_URL = 'https://nitve1.github.io/mfkig-notatnik/tanitoken/landing/prywatnosc.html';
const CATS = ['text', 'coding', 'image', 'video'];

export const modeOptions = () => [
  { value: 'simple', label: tr('mode.simple') },
  { value: 'pro', label: tr('mode.pro') },
];
export const modeNote = (mode) => tr(mode === 'pro' ? 'mode.proNote' : 'mode.simpleNote');
// Wybór języka: systemowy + 6 języków.
export function LanguagePicker({ value, onChange }) {
  return (
    <View style={s.wrap}>
      <Pill label={tr('lang.system')} on={!value || value === 'system'} onPress={() => onChange('system')} />
      {LANGUAGES.map((l) => (
        <Pill key={l.code} label={l.name} on={value === l.code} onPress={() => onChange(l.code)} />
      ))}
    </View>
  );
}

export default function Profile({ snapshot, priceStatus, onRefresh }) {
  const t = useTheme();
  const bottomSpace = useBottomSpace();
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
      Alert.alert(tr('notif.deniedTitle'), tr('notif.deniedBody'), [
        { text: tr('common.cancel'), style: 'cancel' },
        { text: tr('notif.openSettings'), onPress: () => Linking.openSettings() },
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
        Alert.alert(tr('backup.importedTitle'), tr('backup.importedBody', { n: p.watchlist.length }));
      }
    } catch (e) {
      Alert.alert(tr('backup.importFailed'), e.message);
    }
  };

  const onReset = () =>
    Alert.alert(tr('about.resetTitle'), tr('about.resetBody'), [
      { text: tr('common.cancel'), style: 'cancel' },
      { text: tr('about.reset'), style: 'destructive', onPress: () => { disableBackground(); reset(); } },
    ]);

  return (
    <ScrollView contentContainerStyle={{ padding: space[4], paddingBottom: bottomSpace }} keyboardShouldPersistTaps="handled">
      <Header kicker={tr('profile.kicker')} title={tr('nav.profile')} />

      <Section title={tr('profile.language')}>
        <View style={{ paddingVertical: space[3] }}>
          <LanguagePicker value={profile.language} onChange={(language) => update({ language })} />
        </View>
      </Section>

      <Section title={tr('refresh.title')}>
        <View style={{ paddingVertical: space[3] }}>
          <PriceStatus snapshot={snapshot} status={priceStatus} onRefresh={onRefresh} />
        </View>
        <ToggleRow
          title={tr('refresh.wifiOnly')}
          body={tr('refresh.wifiOnlyBody')}
          value={profile.refresh?.wifiOnly ?? false}
          onChange={(wifiOnly) => update({ refresh: { ...profile.refresh, wifiOnly } })}
          last
        />
      </Section>

      <Section title={tr('profile.mode')}>
        <View style={{ paddingVertical: space[3], gap: space[2] }}>
          <Segmented options={modeOptions()} value={profile.mode ?? 'simple'} onChange={(mode) => update({ mode })} />
          <T kind="small" color="ink2">{modeNote(profile.mode)}</T>
        </View>
      </Section>

      <Section title={tr('profile.about')}>
        <View style={{ paddingVertical: space[3], gap: space[2] }}>
          <T kind="small" color="ink2">{tr('profile.name')}</T>
          <TextInput
            maxFontSizeMultiplier={MAX_FONT_SCALE}
            value={profile.name}
            onChangeText={(name) => update({ name })}
            placeholder={tr('common.optional')}
            placeholderTextColor={t.ink3}
            style={[s.input, { borderColor: t.glassLine, color: t.ink, backgroundColor: 'rgba(0,0,0,0.25)' }]}
          />
          <T kind="small" color="ink2" style={{ marginTop: space[2] }}>{tr('profile.startCats')}</T>
          <View style={s.wrap}>
            {CATS.map((c) => (
              <Pill key={c} label={tr(`cat.${c}`)} icon={c} color={t[c]} on={profile.cats.includes(c)} onPress={() => toggleCat(c)} />
            ))}
          </View>
        </View>
      </Section>

      <Section title={tr('profile.accounts')}>
        <View style={{ paddingTop: space[3] }}>
          <ProviderPicker snapshot={snapshot} selected={profile.providers} onToggle={toggleProvider} pro={profile.mode === 'pro'} />
        </View>
        <ToggleRow
          last
          title={tr('profile.onlyFav')}
          body={tr(profile.providers.length ? 'profile.onlyFavBody' : 'profile.onlyFavEmpty')}
          value={profile.onlyFavorites && profile.providers.length > 0}
          onChange={(onlyFavorites) => update({ onlyFavorites })}
        />
      </Section>

      <Section title={tr('notif.title')}>
        <ToggleRow last={!n.enabled} title={tr('notif.title')} body={tr('notif.masterBody')} value={n.enabled} onChange={onMaster} />
        {n.enabled ? (
          <>
            <ToggleRow title={tr('alert.end')} body={tr('notif.endBody')} value={n.promoEnd} onChange={(v) => setNotify({ promoEnd: v })} />
            <ToggleRow title={tr('alert.aging')} body={tr('notif.agingBody')} value={n.aging} onChange={(v) => setNotify({ aging: v })} />
            <ToggleRow title={tr('alert.start')} body={tr('notif.startBody')} value={n.promoStart} onChange={(v) => setNotify({ promoStart: v })} />
            <ToggleRow title={tr('alert.cheaper')} body={tr('notif.cheaperBody')} value={n.cheaper} onChange={(v) => setNotify({ cheaper: v })} />
            <ToggleRow last title={tr('alert.expires')} body={tr('notif.expiresBody')} value={n.expires} onChange={(v) => setNotify({ expires: v })} />
          </>
        ) : null}
      </Section>

      <Section title={tr('backup.title')}>
        {Platform.OS === 'ios' ? (
          <ToggleRow
            title={tr('backup.keep')}
            body={tr('backup.keepBody')}
            value={profile.keepAfterUninstall}
            onChange={(keepAfterUninstall) => update({ keepAfterUninstall })}
          />
        ) : (
          <T kind="small" color="ink2" style={{ paddingVertical: space[3] }}>{tr('backup.android')}</T>
        )}
        <Row style={{ paddingVertical: space[3], gap: space[2] }}>
          <Button kind="line" label={tr('backup.export')} onPress={() => exportProfile(profile).catch((e) => Alert.alert(tr('backup.exportFailed'), e.message))} />
          <Button kind="line" label={tr('backup.import')} onPress={onImport} />
        </Row>
      </Section>

      <Section title={tr('about.title')}>
        <T kind="small" color="ink2" style={{ paddingTop: space[3] }}>{tr('about.body')}</T>
        <Row style={{ paddingVertical: space[3], gap: space[2] }}>
          <Button kind="line" label={tr('about.privacy')} onPress={() => Linking.openURL(PRIVACY_URL)} />
          <Button kind="line" label={tr('about.reset')} onPress={onReset} />
        </Row>
      </Section>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  input: { minHeight: 44, borderWidth: 1.5, borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, fontFamily: font.textMedium },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
});
