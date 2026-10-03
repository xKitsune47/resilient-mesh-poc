import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Dialog, Icon, Portal, Surface, Text, useTheme } from 'react-native-paper';
import { useShallow } from 'zustand/react/shallow';

import { PrimaryButton } from '../components/PrimaryButton';
import { QrScanner } from '../components/QrScanner';
import { TrustBadge } from '../components/TrustBadge';
import { nodeIdFromIdentityQr } from '../services/crypto/cert';
import { fingerprint } from '../services/crypto/keys';
import { MeshService } from '../services/mesh/MeshService';
import { useChatStore } from '../store/chatStore';
import { authorityName, trustLevel, useContactsStore } from '../store/contactsStore';
import { radius } from '../theme';
import { formatDate } from '../utils/time';

type ScanState = 'idle' | 'scanning' | 'match' | 'mismatch' | 'not_a_key';

/**
 * Confirms that a conversation's node id belongs to the person standing in front of the user.
 * The route parameter only selects which existing conversation is checked – marking it verified
 * always takes a scan of the matching key or an explicit confirmation on this screen.
 */
export default function VerifyContactScreen() {
  const theme = useTheme();
  const { id: peerId } = useLocalSearchParams<{ id: string }>();
  const conversation = useChatStore((s) => s.conversations.find((c) => c.peerId === peerId));
  const trust = useContactsStore(useShallow((s) => ({ contacts: s.contacts, authorities: s.authorities })));
  const [scan, setScan] = useState<ScanState>('idle');
  const [confirmManual, setConfirmManual] = useState(false);

  if (!conversation || !peerId) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
        <Text variant="bodyLarge" style={{ color: theme.colors.onSurfaceVariant, textAlign: 'center' }}>
          Nie ma takiej rozmowy. Otwórz czat z osobą, której klucz chcesz sprawdzić.
        </Text>
      </View>
    );
  }

  const level = trustLevel(trust, peerId);
  const office = authorityName(trust, peerId);
  const verifiedAt = trust.contacts[peerId]?.verifiedAt;

  const onScan = (text: string) => {
    const scanned = nodeIdFromIdentityQr(text);
    if (!scanned) return setScan('not_a_key');
    if (scanned !== peerId) return setScan('mismatch');
    MeshService.markVerified(peerId);
    setScan('match');
  };

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
          <Text variant="titleLarge">{conversation.title}</Text>
          <TrustBadge level={level} />
          {office && (
            <Text variant="bodyMedium">
              To konto ma certyfikat urzędowy wystawiony dla: {office}. Certyfikat podpisał klucz główny wszyty w
              aplikację – nie da się go uzyskać, podając się za urząd w nicku.
            </Text>
          )}
          {verifiedAt && <Text variant="bodyMedium">Klucz zweryfikowany przez Ciebie {formatDate(verifiedAt)}.</Text>}
          <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 8 }}>
            Odcisk klucza tej osoby
          </Text>
          <Text variant="bodyLarge" selectable style={styles.mono}>
            {fingerprint(peerId)}
          </Text>
        </View>

        {scan === 'scanning' && <QrScanner onScan={onScan} />}

        {scan === 'match' && (
          <Surface style={[styles.result, { backgroundColor: theme.colors.primaryContainer }]} elevation={0}>
            <Icon source="shield-check-outline" size={22} color={theme.colors.onPrimaryContainer} />
            <Text variant="bodyMedium" style={{ color: theme.colors.onPrimaryContainer, flex: 1 }}>
              Zgadza się. Ten czat prowadzisz z urządzeniem, którego kod właśnie zeskanowano.
            </Text>
          </Surface>
        )}
        {(scan === 'mismatch' || scan === 'not_a_key') && (
          <Surface style={[styles.result, { backgroundColor: theme.colors.errorContainer }]} elevation={0}>
            <Icon source="alert" size={22} color={theme.colors.onErrorContainer} />
            <Text variant="bodyMedium" style={{ color: theme.colors.onErrorContainer, flex: 1 }}>
              {scan === 'mismatch'
                ? 'To NIE jest klucz tej rozmowy. Osoba, której kod zeskanowano, to inne urządzenie niż to, z którym tu piszesz. Nie ufaj tej rozmowie.'
                : 'To nie jest kod klucza Mesh Chat. Poproś rozmówcę o otwarcie: Ustawienia → Mój klucz.'}
            </Text>
          </Surface>
        )}

        <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
          Poproś rozmówcę, żeby otworzył Ustawienia → Mój klucz, i zeskanuj kod z jego ekranu. Rób to osobiście – kod
          przesłany zdjęciem przez inną osobę niczego nie dowodzi.
        </Text>
        <Button mode="text" onPress={() => router.push('/my-key')} style={styles.link}>
          Pokaż mój kod
        </Button>
        {level === 'unverified' && (
          <Button mode="text" onPress={() => setConfirmManual(true)} style={styles.link}>
            Porównaliśmy odciski na głos
          </Button>
        )}
      </ScrollView>

      <View style={styles.actions}>
        <PrimaryButton icon="qrcode-scan" onPress={() => setScan('scanning')} disabled={scan === 'scanning'}>
          {scan === 'idle' ? 'Skanuj kod rozmówcy' : 'Skanuj ponownie'}
        </PrimaryButton>
      </View>

      <Portal>
        <Dialog visible={confirmManual} onDismiss={() => setConfirmManual(false)}>
          <Dialog.Title>Odciski się zgadzają?</Dialog.Title>
          <Dialog.Content>
            <Text>
              Potwierdź tylko wtedy, gdy rozmówca osobiście odczytał swój odcisk z ekranu „Mój klucz” i wszystkie 8 grup
              jest identycznych z odciskiem powyżej.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setConfirmManual(false)}>Anuluj</Button>
            <Button
              onPress={() => {
                MeshService.markVerified(peerId);
                setConfirmManual(false);
                setScan('idle');
              }}
            >
              Zgadzają się
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  content: { padding: 16, gap: 12 },
  card: { padding: 16, borderRadius: radius.lg, gap: 8, elevation: 1 },
  mono: { fontFamily: 'monospace' },
  result: { flexDirection: 'row', gap: 12, padding: 16, borderRadius: radius.lg },
  link: { alignSelf: 'flex-start' },
  actions: { padding: 16 },
});
