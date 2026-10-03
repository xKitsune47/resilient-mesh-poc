import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, ToastAndroid } from 'react-native';
import { Button, Icon, Surface, Text, TextInput, useTheme } from 'react-native-paper';

import { PrimaryButton } from '../components/PrimaryButton';
import { QrScanner } from '../components/QrScanner';
import { nodeIdFromIdentityQr } from '../services/crypto/cert';
import { type InstallCertResult, MeshService } from '../services/mesh/MeshService';
import { radius } from '../theme';

const FAILURES: Record<Exclude<InstallCertResult, { ok: true }>['reason'], string> = {
  format: 'To nie jest certyfikat Mesh Chat.',
  signature: 'Certyfikat nie jest podpisany kluczem głównym, któremu ufa ta aplikacja.',
  subject: 'Ten certyfikat wystawiono dla innego urządzenia. Certyfikat działa tylko na telefonie, którego klucz podano operatorowi.',
  not_yet_valid: 'Certyfikat nie jest jeszcze ważny. Sprawdź datę i godzinę w telefonie.',
  expired: 'Certyfikat już wygasł. Poproś operatora o nowy.',
  revoked: 'Ten certyfikat został unieważniony.',
  no_device_lock:
    'Ustaw blokadę ekranu (PIN, wzór lub odcisk palca) i spróbuj ponownie. Bez niej każdy, kto weźmie ten telefon do ręki, mógłby nadawać alerty.',
};

/**
 * Installs an authority certificate handed over by the issuing operator (QR code or text).
 * The certificate comes only from the camera or the text field on this screen – never from a link.
 */
export default function InstallCertScreen() {
  const theme = useTheme();
  const [scanning, setScanning] = useState(true);
  const [scanKey, setScanKey] = useState(0);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const install = async (cert: string) => {
    setBusy(true);
    setError(null);
    const value = cert.trim();
    const res = nodeIdFromIdentityQr(value)
      ? null // someone's identity code, most likely the user's own "Mój klucz" screen
      : await MeshService.installCert(value);
    setBusy(false);
    if (res?.ok) {
      ToastAndroid.show(`Certyfikat zainstalowany: ${res.name}`, ToastAndroid.LONG);
      return router.back();
    }
    setError(res ? FAILURES[res.reason] : 'To jest kod klucza, a nie certyfikat. Zeskanuj kod wydany przez operatora.');
    setScanning(false);
  };

  return (
    <ScrollView
      style={{ backgroundColor: theme.colors.background }}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
        Certyfikat konta urzędowego wydaje operator po sprawdzeniu Twojej tożsamości i klucza (Ustawienia → Mój klucz).
        Zeskanuj kod QR z jego ekranu albo wklej certyfikat jako tekst.
      </Text>

      {scanning ? (
        <QrScanner key={scanKey} onScan={(data) => void install(data)} />
      ) : (
        <PrimaryButton
          icon="qrcode-scan"
          onPress={() => {
            setError(null);
            setScanKey((k) => k + 1);
            setScanning(true);
          }}
        >
          Skanuj ponownie
        </PrimaryButton>
      )}

      {error && (
        <Surface style={[styles.result, { backgroundColor: theme.colors.errorContainer }]} elevation={0}>
          <Icon source="alert" size={22} color={theme.colors.onErrorContainer} />
          <Text variant="bodyMedium" style={{ color: theme.colors.onErrorContainer, flex: 1 }}>
            {error}
          </Text>
        </Surface>
      )}

      <Text variant="titleMedium">Albo wklej tekst</Text>
      <TextInput
        mode="outlined"
        outlineStyle={{ borderRadius: radius.md }}
        placeholder="MC1:CERT:…"
        value={text}
        onChangeText={setText}
        multiline
        autoCapitalize="none"
        autoCorrect={false}
      />
      <Button
        mode="contained-tonal"
        onPress={() => void install(text)}
        disabled={!text.trim() || busy}
        loading={busy}
        style={styles.paste}
      >
        Zainstaluj z tekstu
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 16 },
  result: { flexDirection: 'row', gap: 12, padding: 16, borderRadius: radius.lg },
  paste: { alignSelf: 'flex-start', borderRadius: radius.full },
});
