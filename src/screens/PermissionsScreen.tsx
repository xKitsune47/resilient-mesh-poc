import { useEffect, useRef } from 'react';
import { AppState, ScrollView, StyleSheet, ToastAndroid, View } from 'react-native';
import { Button, Icon, Surface, Text, useTheme } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import { openAppSettings, PERMISSIONS, PermissionState } from '../services/permissions/permissions';
import { useIdentityStore } from '../store/identityStore';
import { usePermissionStore } from '../store/permissionStore';
import { statusColors } from '../theme';

const STATE_UI: Record<PermissionState, { icon: string; color: string; label: string }> = {
  granted: { icon: 'check-circle', color: statusColors.connected, label: 'Nadane' },
  denied: { icon: 'close-circle-outline', color: statusColors.searching, label: 'Brak' },
  blocked: { icon: 'block-helper', color: statusColors.error, label: 'Zablokowane' },
  install_time: { icon: 'check-circle-outline', color: statusColors.connected, label: 'Przy instalacji' },
  not_applicable: { icon: 'minus-circle-outline', color: statusColors.offline, label: 'Nie dotyczy' },
};

/**
 * First-run gate. The Android system permission dialogs are shown automatically on the first
 * launch; the app cannot continue (see guards in app/_layout.tsx) until every required
 * runtime permission is granted.
 */
export default function PermissionsScreen() {
  const theme = useTheme();
  const { snapshot, blocked, requesting, request, check } = usePermissionStore();
  const acknowledged = useIdentityStore((s) => s.permissionsAcknowledged);
  const setAcknowledged = useIdentityStore((s) => s.setPermissionsAcknowledged);
  const autoRequested = useRef(false);

  const onGranted = () => {
    ToastAndroid.show('Uprawnienia zostały nadane pomyślnie ✓', ToastAndroid.LONG);
    setAcknowledged();
  };

  const ask = async () => {
    const res = await request();
    if (res.granted) onGranted();
  };

  // First launch → go straight to the system dialogs.
  useEffect(() => {
    if (!acknowledged && !autoRequested.current) {
      autoRequested.current = true;
      void ask();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Coming back from system Settings: re-check.
  useEffect(() => {
    const sub = AppState.addEventListener('change', async (s) => {
      if (s === 'active' && (await check())) onGranted();
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [check]);

  const anyDenied = Object.values(snapshot).some((s) => s === 'denied' || s === 'blocked');

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Icon source="bluetooth-connect" size={64} color={theme.colors.primary} />
          <Text variant="headlineMedium" style={styles.center}>
            Uprawnienia
          </Text>
          <Text variant="bodyLarge" style={[styles.center, { color: theme.colors.onSurfaceVariant }]}>
            Mesh Chat łączy telefony przez Bluetooth, bez internetu. Aby działać, potrzebuje poniższych
            uprawnień systemowych.
          </Text>
        </View>

        {anyDenied && (
          <Surface style={[styles.alert, { backgroundColor: theme.colors.errorContainer }]} elevation={0}>
            <Icon source="alert" size={22} color={theme.colors.onErrorContainer} />
            <Text variant="bodyMedium" style={{ color: theme.colors.onErrorContainer, flex: 1 }}>
              {blocked
                ? 'Część uprawnień została odrzucona na stałe. Otwórz ustawienia aplikacji, wejdź w „Uprawnienia” i zezwól na Bluetooth (urządzenia w pobliżu), lokalizację i powiadomienia.'
                : 'Bez tych uprawnień aplikacja nie może wyszukiwać urządzeń ani przesyłać wiadomości. Nadaj je, aby kontynuować.'}
            </Text>
          </Surface>
        )}

        <Surface style={styles.list} elevation={1}>
          {PERMISSIONS.filter((p) => snapshot[p.name] !== 'not_applicable').map((p) => {
            const state = snapshot[p.name] ?? 'denied';
            const ui = STATE_UI[state];
            return (
              <View key={p.name} style={styles.item}>
                <Icon source={ui.icon} size={22} color={ui.color} />
                <View style={{ flex: 1 }}>
                  <Text variant="titleSmall">{p.label}</Text>
                  <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                    {p.reason}
                  </Text>
                </View>
                <Text variant="labelSmall" style={{ color: ui.color }}>
                  {ui.label}
                </Text>
              </View>
            );
          })}
        </Surface>
      </ScrollView>

      <View style={styles.actions}>
        {blocked ? (
          <>
            <Button mode="contained" icon="cog" onPress={openAppSettings}>
              Otwórz ustawienia systemowe
            </Button>
            <Button mode="text" onPress={ask} loading={requesting}>
              Spróbuj ponownie
            </Button>
          </>
        ) : (
          <Button mode="contained" icon="shield-check" onPress={ask} loading={requesting} disabled={requesting}>
            Nadaj uprawnienia
          </Button>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 20, gap: 16 },
  hero: { alignItems: 'center', gap: 10, marginTop: 12, marginBottom: 4 },
  center: { textAlign: 'center' },
  alert: { flexDirection: 'row', gap: 10, padding: 14, borderRadius: 12, alignItems: 'flex-start' },
  list: { borderRadius: 16, paddingVertical: 4 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10 },
  actions: { padding: 20, gap: 8 },
});
