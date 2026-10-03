import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, ToastAndroid, View } from 'react-native';
import { Button, Dialog, Icon, Portal, Text, useTheme } from 'react-native-paper';

import { PrimaryButton } from '../components/PrimaryButton';
import type { StoredAlert } from '../services/mesh/alertPolicy';
import { MeshService } from '../services/mesh/MeshService';
import { alertKey, useActiveAlerts, useAlertStore } from '../store/alertStore';
import { selectIsAuthority, useIdentityStore } from '../store/identityStore';
import { radius } from '../theme';
import { formatDateTime } from '../utils/time';

/** Every alert this device holds: the active ones in full, then the ended ones. */
export default function AlertsScreen() {
  const theme = useTheme();
  const all = useAlertStore((s) => s.alerts);
  const active = useActiveAlerts();
  const nodeId = useIdentityStore((s) => s.nodeId);
  const isAuthority = useIdentityStore((s) => selectIsAuthority(s));
  const [toCancel, setToCancel] = useState<StoredAlert | null>(null);

  const ended = useMemo(() => {
    const activeKeys = new Set(active.map(alertKey));
    return all.filter((a) => !activeKeys.has(alertKey(a))).sort((a, b) => b.timestamp - a.timestamp);
  }, [all, active]);

  const cancel = async () => {
    const alert = toCancel;
    setToCancel(null);
    if (!alert) return;
    const res = await MeshService.cancelAlert(alert.id);
    ToastAndroid.show(
      res.ok
        ? 'Alert odwołany'
        : res.reason === 'not_confirmed'
          ? 'Nie potwierdzono tożsamości – alert nadal aktywny'
          : 'Nie udało się odwołać alertu',
      ToastAndroid.SHORT
    );
  };

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
          Komunikaty do wszystkich mogą nadawać wyłącznie konta urzędowe z certyfikatem. Każdy jest podpisany – nie
          da się go podrobić ani zmienić po drodze.
        </Text>

        {active.length === 0 && (
          <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
            <Text variant="bodyLarge">Brak aktywnych komunikatów.</Text>
          </View>
        )}
        {active.map((a) => (
          <View key={alertKey(a)} style={[styles.card, styles.active, { backgroundColor: theme.colors.surface, borderColor: theme.colors.error }]}>
            <View style={styles.label}>
              <Icon source="alert-octagon-outline" size={18} color={theme.colors.error} />
              <Text variant="labelMedium" style={{ color: theme.colors.error, flex: 1 }}>
                PILNE · {a.authority}
              </Text>
            </View>
            <Text variant="titleLarge">{a.headline}</Text>
            {!!a.text && (
              <Text variant="bodyLarge" selectable>
                {a.text}
              </Text>
            )}
            <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
              Nadano {formatDateTime(a.timestamp)} · ważny do {formatDateTime(Math.min(a.exp, a.certExp))}
            </Text>
            {a.origin === nodeId && (
              <Button mode="outlined" textColor={theme.colors.error} onPress={() => setToCancel(a)} style={styles.cancel}>
                Odwołaj alert
              </Button>
            )}
          </View>
        ))}

        {ended.length > 0 && <Text variant="titleLarge">Zakończone</Text>}
        {ended.map((a) => (
          <View key={alertKey(a)} style={[styles.card, { backgroundColor: theme.colors.surface }]}>
            <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>
              {a.cancelled ? 'Odwołany' : 'Wygasł'} · {a.authority}
            </Text>
            <Text variant="titleMedium" style={{ color: theme.colors.onSurfaceVariant }}>
              {a.headline}
            </Text>
            {!!a.text && (
              <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                {a.text}
              </Text>
            )}
            <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
              {formatDateTime(a.timestamp)}
            </Text>
          </View>
        ))}
      </ScrollView>

      {isAuthority && (
        <View style={styles.actions}>
          <PrimaryButton icon="bullhorn-outline" onPress={() => router.push('/compose-alert')}>
            Nowy alert
          </PrimaryButton>
        </View>
      )}

      <Portal>
        <Dialog visible={!!toCancel} onDismiss={() => setToCancel(null)}>
          <Dialog.Title>Odwołać alert?</Dialog.Title>
          <Dialog.Content>
            <Text>
              „{toCancel?.headline}” zniknie u wszystkich, do których dotrze odwołanie. Tej operacji nie da się cofnąć –
              w razie pomyłki trzeba nadać nowy alert.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setToCancel(null)}>Anuluj</Button>
            <Button textColor={theme.colors.error} onPress={cancel}>
              Odwołaj
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 16, gap: 12 },
  card: { padding: 16, borderRadius: radius.lg, gap: 8, elevation: 1 },
  active: { borderWidth: 1 },
  label: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cancel: { alignSelf: 'flex-start', borderRadius: radius.full },
  actions: { padding: 16 },
});
