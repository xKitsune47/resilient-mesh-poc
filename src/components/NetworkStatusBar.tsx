import { Pressable, StyleSheet, View } from 'react-native';
import { Button, Icon, Text, useTheme } from 'react-native-paper';

import MeshPeripheral from '../../modules/mesh-peripheral';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { CLOCK_SKEW_WARN_MS } from '../services/mesh/MeshRouter';
import { useMeshStore } from '../store/meshStore';
import { statusColors } from '../theme';

interface Props {
  onPress?: () => void;
}

/** Compact mesh status strip: connection state, neighbours, reachable nodes. */
export function NetworkStatusBar({ onPress }: Props) {
  const theme = useTheme();
  const { status, linkCount, nodeCount, radio } = useNetworkStatus();
  const clockSkewMs = useMeshStore((s) => s.clockSkewMs);
  const skewMinutes = clockSkewMs === null ? 0 : Math.round(Math.abs(clockSkewMs) / 60_000);

  const { color, label } = (() => {
    switch (status) {
      case 'bluetooth_off':
        return { color: statusColors.error, label: 'Bluetooth wyłączony' };
      case 'offline':
        return { color: statusColors.offline, label: 'Mesh zatrzymany' };
      case 'searching':
        return { color: statusColors.searching, label: 'Szukam węzłów w pobliżu…' };
      case 'connected':
        return {
          color: statusColors.connected,
          label: `Połączono · ${linkCount} bezpośr. · ${nodeCount} w sieci`,
        };
    }
  })();

  return (
    <View style={{ backgroundColor: theme.colors.surfaceVariant }}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`Status sieci: ${label}`}
        style={styles.bar}
      >
        <View style={[styles.dot, { backgroundColor: color }]} />
        <Text variant="labelMedium" style={[styles.label, { color: theme.colors.onSurfaceVariant }]} numberOfLines={1}>
          {label}
        </Text>
        {status === 'bluetooth_off' ? (
          <Button compact mode="contained-tonal" onPress={() => MeshPeripheral.requestEnableBluetooth()}>
            Włącz
          </Button>
        ) : radio.scanning ? (
          <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
            skanuję
          </Text>
        ) : null}
      </Pressable>
      {/* Packets stamped too far from the receiver's clock are dropped (replay protection). */}
      {clockSkewMs !== null && Math.abs(clockSkewMs) > CLOCK_SKEW_WARN_MS && (
        <View style={styles.bar} accessibilityRole="alert">
          <Icon source="clock-alert-outline" size={16} color={statusColors.searching} />
          <Text variant="labelMedium" style={[styles.label, { color: theme.colors.onSurfaceVariant }]}>
            Zegar telefonu różni się od sąsiadów o ok. {skewMinutes} min – wiadomości mogą być odrzucane. Ustaw
            poprawną godzinę.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    minHeight: 32,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  label: { flex: 1 },
});
