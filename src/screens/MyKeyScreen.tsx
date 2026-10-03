import { ScrollView, Share, StyleSheet, View } from 'react-native';
import { Button, Text, useTheme } from 'react-native-paper';
import QRCode from 'react-native-qrcode-svg';

import { identityQr } from '../services/crypto/cert';
import { fingerprint } from '../services/crypto/keys';
import { useIdentityStore } from '../store/identityStore';
import { radius } from '../theme';
import { fromBase64, toHex } from '../utils/bytes';

/**
 * This device's public identity: the signing key as a QR code, its fingerprint, and a form that
 * can be typed (for the operator issuing an authority certificate). Nothing here is secret.
 */
export default function MyKeyScreen() {
  const theme = useTheme();
  const nodeId = useIdentityStore((s) => s.nodeId);
  const signPublicKey = useIdentityStore((s) => s.signPublicKey);
  const nick = useIdentityStore((s) => s.nick);
  const code = identityQr(signPublicKey);
  const hex = toHex(fromBase64(signPublicKey)).toUpperCase().match(/.{4}/g)?.join(' ') ?? '';

  return (
    <ScrollView style={{ backgroundColor: theme.colors.background }} contentContainerStyle={styles.content}>
      <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
        Pokaż ten kod osobie, z którą rozmawiasz – niech zeskanuje go w swojej aplikacji (czat z Tobą → ikona tarczy).
        Dzięki temu będzie mieć pewność, że pisze z Tobą, a nie z kimś, kto użył Twojego nicku.
      </Text>

      {/* Always dark-on-white, whatever the theme: scanners need the contrast. */}
      <View style={styles.qr}>
        <QRCode value={code} size={240} backgroundColor="#FFFFFF" color="#000000" />
      </View>
      <Text variant="titleMedium" style={styles.center}>
        {nick}
      </Text>

      <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
        <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>
          Odcisk klucza
        </Text>
        <Text variant="bodyLarge" selectable style={styles.mono}>
          {fingerprint(nodeId)}
        </Text>
        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
          Bez aparatu: porównajcie ten odcisk na głos z tym, co widzi rozmówca. Wszystkie 8 grup musi się zgadzać.
        </Text>
      </View>

      <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
        <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>
          Klucz publiczny (do przepisania przy wydawaniu certyfikatu)
        </Text>
        <Text variant="bodyMedium" selectable style={styles.mono}>
          {hex}
        </Text>
        <Button mode="text" icon="share-variant-outline" onPress={() => void Share.share({ message: code })} style={styles.share}>
          Udostępnij klucz jako tekst
        </Button>
      </View>

      <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
        To jest klucz publiczny – można go bezpiecznie pokazywać. Klucz prywatny nigdy nie opuszcza tego telefonu.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 16 },
  qr: { alignSelf: 'center', padding: 16, borderRadius: radius.lg, backgroundColor: '#FFFFFF' },
  center: { textAlign: 'center' },
  card: { padding: 16, borderRadius: radius.lg, gap: 8, elevation: 1 },
  mono: { fontFamily: 'monospace' },
  share: { alignSelf: 'flex-start' },
});
