import { Pressable, StyleSheet, View } from 'react-native';
import { Button, Text, useTheme } from 'react-native-paper';

import MeshPeripheral from '../../modules/mesh-peripheral';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { statusColors } from '../theme';

interface Props {
  onPress?: () => void;
}

/** Compact mesh status strip: connection state, neighbours, reachable nodes. */
export function NetworkStatusBar({ onPress }: Props) {
  const theme = useTheme();
  const { status, linkCount, nodeCount, radio } = useNetworkStatus();

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
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Status sieci: ${label}`}
      style={[styles.bar, { backgroundColor: theme.colors.surfaceVariant }]}
    >
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text variant="labelLarge" style={styles.label} numberOfLines={1}>
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
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    minHeight: 48,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  label: { flex: 1 },
});
