import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Text, useTheme } from 'react-native-paper';

import { openAppSettings } from '../services/permissions/permissions';
import { radius } from '../theme';

interface Props {
  /** Called once with the text of the first QR code seen; remount (change `key`) to scan again. */
  onScan: (text: string) => void;
}

/**
 * QR scanner used for key verification and certificate installation. The camera permission is
 * asked for here, on demand – it is not one of the permissions the mesh needs to run.
 */
export function QrScanner({ onScan }: Props) {
  const theme = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const done = useRef(false);

  if (!permission) return <View style={[styles.frame, { backgroundColor: theme.colors.surfaceVariant }]} />;

  if (!permission.granted) {
    return (
      <View style={[styles.frame, styles.prompt, { backgroundColor: theme.colors.surfaceVariant }]}>
        <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, textAlign: 'center' }}>
          Do zeskanowania kodu QR potrzebny jest dostęp do aparatu. Obraz nie jest zapisywany ani wysyłany.
        </Text>
        {permission.canAskAgain ? (
          <Button mode="contained-tonal" onPress={requestPermission}>
            Zezwól na aparat
          </Button>
        ) : (
          <Button mode="contained-tonal" onPress={openAppSettings}>
            Otwórz ustawienia
          </Button>
        )}
      </View>
    );
  }

  return (
    <View style={styles.frame}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={({ data }) => {
          // The callback keeps firing while the code is in view – act on the first hit only.
          if (done.current) return;
          done.current = true;
          onScan(data);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { aspectRatio: 1, borderRadius: radius.lg, overflow: 'hidden' },
  prompt: { alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
});
