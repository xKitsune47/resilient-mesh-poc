import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, ToastAndroid, View } from 'react-native';
import { Button, Dialog, HelperText, Icon, Portal, SegmentedButtons, Surface, Text, TextInput, useTheme } from 'react-native-paper';

import { PrimaryButton } from '../components/PrimaryButton';
import { ALERT_HEADLINE_MAX, ALERT_TEXT_MAX } from '../services/mesh/alertPolicy';
import { CLOCK_SKEW_WARN_MS } from '../services/mesh/MeshRouter';
import { type AlertResult, MeshService } from '../services/mesh/MeshService';
import { selectIsAuthority, useIdentityStore } from '../store/identityStore';
import { useMeshStore } from '../store/meshStore';
import { radius } from '../theme';

const HOUR_MS = 3_600_000;
const LIFETIMES = [
  { value: '1', label: '1 h' },
  { value: '6', label: '6 h' },
  { value: '24', label: '24 h' },
  { value: '72', label: '72 h' },
];

const FAILURES: Record<Exclude<AlertResult, { ok: true }>['reason'], string> = {
  not_authority: 'To urządzenie nie ma ważnego certyfikatu konta urzędowego.',
  not_confirmed: 'Nie potwierdzono tożsamości – alert nie został nadany.',
  invalid: 'Alert został odrzucony. Sprawdź treść i ważność certyfikatu.',
  offline: 'Sieć mesh jest zatrzymana – włącz Bluetooth i spróbuj ponownie.',
};

/** Broadcast form for authority accounts. Everything here is typed by the user – nothing is prefilled. */
export default function ComposeAlertScreen() {
  const theme = useTheme();
  const authority = useIdentityStore((s) => s.authority);
  const isAuthority = useIdentityStore((s) => selectIsAuthority(s));
  const linkCount = useMeshStore((s) => s.links.length);
  const clockSkewMs = useMeshStore((s) => s.clockSkewMs);
  const [headline, setHeadline] = useState('');
  const [text, setText] = useState('');
  const [hours, setHours] = useState('6');
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isAuthority || !authority) {
    return (
      <View style={[styles.screen, styles.center, { backgroundColor: theme.colors.background }]}>
        <Icon source="shield-off-outline" size={48} color={theme.colors.onSurfaceVariant} />
        <Text variant="bodyLarge" style={{ color: theme.colors.onSurfaceVariant, textAlign: 'center' }}>
          Alerty mogą nadawać tylko konta urzędowe z ważnym certyfikatem.
        </Text>
      </View>
    );
  }

  const valid = headline.trim().length > 0 && text.length <= ALERT_TEXT_MAX;
  const clockOff = clockSkewMs !== null && Math.abs(clockSkewMs) > CLOCK_SKEW_WARN_MS;

  const send = async () => {
    setConfirm(false);
    setBusy(true);
    setError(null);
    const res = await MeshService.sendAlert(headline, text, Number(hours) * HOUR_MS);
    setBusy(false);
    if (!res.ok) return setError(FAILURES[res.reason]);
    ToastAndroid.show('Alert nadany', ToastAndroid.SHORT);
    router.back();
  };

  return (
    <KeyboardAvoidingView style={[styles.screen, { backgroundColor: theme.colors.background }]} behavior="height">
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
          Nadajesz jako <Text style={{ fontWeight: '600' }}>{authority.name}</Text>. Alert zobaczy każdy w zasięgu sieci,
          przypięty na górze aplikacji, i będzie on przekazywany dalej także osobom, które dołączą później.
        </Text>

        {(clockOff || linkCount === 0) && (
          <Surface style={[styles.warning, { backgroundColor: theme.colors.errorContainer }]} elevation={0}>
            <Icon source="alert" size={22} color={theme.colors.onErrorContainer} />
            <Text variant="bodyMedium" style={{ color: theme.colors.onErrorContainer, flex: 1 }}>
              {clockOff
                ? 'Zegar tego telefonu różni się od sąsiadów. Alert z błędnym czasem może nie być wyświetlany – ustaw poprawną godzinę przed nadaniem.'
                : 'Brak połączeń z innymi urządzeniami. Alert zostanie zapisany i przekazany pierwszemu urządzeniu, które się połączy.'}
            </Text>
          </Surface>
        )}

        <TextInput
          mode="outlined"
          outlineStyle={{ borderRadius: radius.md }}
          label="Nagłówek"
          value={headline}
          onChangeText={setHeadline}
          maxLength={ALERT_HEADLINE_MAX}
          right={<TextInput.Affix text={`${headline.length}/${ALERT_HEADLINE_MAX}`} />}
        />
        <TextInput
          mode="outlined"
          outlineStyle={{ borderRadius: radius.md }}
          label="Treść"
          value={text}
          onChangeText={setText}
          multiline
          numberOfLines={5}
          maxLength={ALERT_TEXT_MAX}
        />
        <HelperText type="info" visible>
          {text.length}/{ALERT_TEXT_MAX} · pisz krótko: co się dzieje, gdzie, co robić.
        </HelperText>

        <Text variant="titleMedium">Ważność</Text>
        <SegmentedButtons value={hours} onValueChange={setHours} buttons={LIFETIMES} />

        {error && (
          <Text variant="bodyMedium" style={{ color: theme.colors.error }}>
            {error}
          </Text>
        )}
      </ScrollView>
      <View style={styles.actions}>
        <PrimaryButton icon="bullhorn-outline" onPress={() => setConfirm(true)} disabled={!valid || busy} loading={busy}>
          Nadaj do wszystkich
        </PrimaryButton>
      </View>

      <Portal>
        <Dialog visible={confirm} onDismiss={() => setConfirm(false)}>
          <Dialog.Title>Nadać alert?</Dialog.Title>
          <Dialog.Content>
            <Text variant="titleMedium">{headline.trim()}</Text>
            <Text>
              Nadawca: {authority.name}. Ważny {hours} h. Po potwierdzeniu poprosimy o odcisk palca lub kod blokady
              telefonu.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setConfirm(false)}>Anuluj</Button>
            <Button onPress={send}>Nadaj</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },
  content: { padding: 16, gap: 12 },
  warning: { flexDirection: 'row', gap: 12, padding: 16, borderRadius: radius.lg },
  actions: { padding: 16 },
});
