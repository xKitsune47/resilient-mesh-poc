import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Dialog, Icon, Portal, Surface, Text, useTheme } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '../components/PrimaryButton';
import { resetDatabase } from '../services/storage/db';
import { useIdentityStore } from '../store/identityStore';
import { useMeshStore } from '../store/meshStore';
import { radius } from '../theme';

interface Props {
  /** 'identity': the key seed cannot be read; 'database': the database key is gone or wrong. */
  kind: 'identity' | 'database';
}

const COPY = {
  identity: {
    title: 'Nie można odczytać kluczy',
    body:
      'Klucze tego urządzenia były zapisane w bezpiecznym magazynie systemu, ale nie da się ich już odczytać. ' +
      'Zdarza się to po przeniesieniu aplikacji na inny telefon albo po wyczyszczeniu danych uwierzytelniających w systemie.',
    consequence:
      'Nowa tożsamość oznacza nowe ID urządzenia: rozmówcy zobaczą Cię jako nową osobę, weryfikacje kluczy i certyfikat urzędowy przepadną, a historia rozmów zostanie usunięta.',
    action: 'Utwórz nową tożsamość',
  },
  database: {
    title: 'Nie można otworzyć historii',
    body:
      'Historia rozmów jest zaszyfrowana kluczem z bezpiecznego magazynu systemu, a ten klucz zaginął lub nie pasuje. ' +
      'Twoja tożsamość w sieci jest nienaruszona.',
    consequence:
      'Usunięcie zaszyfrowanej bazy skasuje z tego telefonu rozmowy, zweryfikowane kontakty i zapisane komunikaty urzędowe. Tej operacji nie da się cofnąć.',
    action: 'Usuń historię i zacznij od nowa',
  },
} as const;

/**
 * Shown instead of the app when secrets kept in SecureStore are gone. The app never repairs this
 * silently: replacing an identity or deleting the database is the user's explicit decision.
 */
export default function RecoveryScreen({ kind }: Props) {
  const theme = useTheme();
  const copy = COPY[kind];
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const reset = async () => {
    setConfirm(false);
    setBusy(true);
    setFailed(false);
    try {
      if (kind === 'identity') await useIdentityStore.getState().reset();
      else await resetDatabase();
      useMeshStore.getState().set({ storageError: false });
    } catch (e) {
      console.error('Recovery failed', e);
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Icon source="shield-alert-outline" size={64} color={theme.colors.error} />
          <Text variant="headlineLarge" style={styles.center}>
            {copy.title}
          </Text>
          <Text variant="bodyLarge" style={[styles.center, { color: theme.colors.onSurfaceVariant }]}>
            {copy.body}
          </Text>
        </View>
        <Surface style={[styles.alert, { backgroundColor: theme.colors.errorContainer }]} elevation={0}>
          <Icon source="alert" size={22} color={theme.colors.onErrorContainer} />
          <Text variant="bodyMedium" style={{ color: theme.colors.onErrorContainer, flex: 1 }}>
            {copy.consequence}
          </Text>
        </Surface>
        {failed && (
          <Text variant="bodyMedium" style={{ color: theme.colors.error }}>
            Nie udało się. Sprawdź, czy telefon ma ustawioną blokadę ekranu, i spróbuj ponownie.
          </Text>
        )}
      </ScrollView>
      <View style={styles.actions}>
        <PrimaryButton
          buttonColor={theme.colors.error}
          textColor={theme.colors.onError}
          onPress={() => setConfirm(true)}
          loading={busy}
          disabled={busy}
        >
          {copy.action}
        </PrimaryButton>
      </View>
      <Portal>
        <Dialog visible={confirm} onDismiss={() => setConfirm(false)}>
          <Dialog.Title>Na pewno?</Dialog.Title>
          <Dialog.Content>
            <Text>{copy.consequence}</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setConfirm(false)}>Anuluj</Button>
            <Button textColor={theme.colors.error} onPress={reset}>
              {kind === 'identity' ? 'Utwórz nową' : 'Usuń'}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 16, gap: 16 },
  hero: { alignItems: 'center', gap: 12, marginVertical: 24 },
  center: { textAlign: 'center' },
  alert: { flexDirection: 'row', gap: 12, padding: 16, borderRadius: radius.lg },
  actions: { padding: 16 },
});
