import { router } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, SectionList, StyleSheet, View } from 'react-native';
import { Chip, Icon, List, Surface, Text, useTheme } from 'react-native-paper';
import { useShallow } from 'zustand/react/shallow';

import { Avatar } from '../components/Avatar';
import { NetworkStatusBar } from '../components/NetworkStatusBar';
import { SignalBars } from '../components/SignalBars';
import type { NearbyDevice } from '../services/ble/LinkManager';
import type { MeshNode } from '../services/mesh/MeshRouter';
import { MeshService } from '../services/mesh/MeshService';
import { useMeshStore } from '../store/meshStore';
import { formatRelative } from '../utils/time';

type Row = { kind: 'nearby'; item: NearbyDevice } | { kind: 'node'; item: MeshNode };

export default function NetworkScreen() {
  const theme = useTheme();
  const { radio, links, nearby, nodes } = useMeshStore(
    useShallow((s) => ({ radio: s.radio, links: s.links, nearby: s.nearby, nodes: s.nodes }))
  );
  const [refreshing, setRefreshing] = useState(false);

  const openDm = async (nodeId: string, nick: string) => {
    const id = await MeshService.openDirectConversation(nodeId, nick);
    router.push({ pathname: '/chat/[id]', params: { id } });
  };

  const refresh = () => {
    setRefreshing(true);
    MeshService.rescan();
    setTimeout(() => setRefreshing(false), 1500);
  };

  const sections: { title: string; subtitle: string; data: Row[] }[] = [
    {
      title: 'W zasięgu Bluetooth',
      subtitle: 'Urządzenia wykryte bezpośrednio przez skanowanie BLE',
      data: nearby.map((item) => ({ kind: 'nearby' as const, item })),
    },
    {
      title: 'Węzły w sieci mesh',
      subtitle: 'Wszyscy osiągalni, także przez inne telefony',
      data: nodes.map((item) => ({ kind: 'node' as const, item })),
    },
  ];

  const nodeById = new Map(nodes.map((n) => [n.nodeId, n]));

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <NetworkStatusBar />
      <SectionList
        sections={sections}
        keyExtractor={(row) => (row.kind === 'nearby' ? `n:${row.item.shortId}` : `m:${row.item.nodeId}`)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
        ListHeaderComponent={
          <Surface style={styles.card} elevation={1}>
            <View style={styles.stats}>
              <Stat label="Połączenia" value={links.length} />
              <Stat label="W zasięgu" value={nearby.length} />
              <Stat label="Węzły w mesh" value={nodes.length} />
            </View>
            <View style={styles.chips}>
              <Chip compact icon={radio.scanning ? 'radar' : 'pause-circle-outline'}>
                {radio.scanning ? 'Skanowanie' : 'Pauza skanu'}
              </Chip>
              <Chip compact icon={radio.advertising ? 'broadcast' : 'broadcast-off'}>
                {radio.advertising ? 'Rozgłaszanie' : 'Brak rozgłaszania'}
              </Chip>
              <Chip compact icon="swap-horizontal">
                Central + {radio.peripheralSupported ? 'Peripheral' : 'bez Peripheral'}
              </Chip>
            </View>
            {radio.error && (
              <Text variant="bodySmall" style={{ color: theme.colors.error }}>
                {radio.error}
              </Text>
            )}
          </Surface>
        }
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Text variant="titleSmall" style={{ color: theme.colors.primary }}>
              {section.title}
            </Text>
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
              {section.data.length === 0
                ? section.title.startsWith('W zasięgu')
                  ? 'Nikogo w pobliżu – poczekaj chwilę lub przeciągnij w dół.'
                  : 'Brak znanych węzłów.'
                : section.subtitle}
            </Text>
          </View>
        )}
        renderItem={({ item: row }) => {
          if (row.kind === 'nearby') {
            const d = row.item;
            const node = d.nodeId ? nodeById.get(d.nodeId) : undefined;
            const name = d.nick || node?.nick || `Węzeł ${d.shortId}`;
            return (
              <List.Item
                title={name}
                description={
                  d.linkId
                    ? `Połączono (${d.linkId.startsWith('c:') ? 'central' : 'peripheral'})`
                    : `Widziany ${formatRelative(d.lastSeen)}`
                }
                left={() => <Avatar id={d.nodeId ?? d.shortId} label={name} size={40} />}
                right={() => (
                  <View style={styles.right}>
                    {d.linkId && <Icon source="link-variant" size={18} color={theme.colors.primary} />}
                    <SignalBars rssi={d.rssi} />
                  </View>
                )}
                onPress={d.nodeId ? () => openDm(d.nodeId!, name) : undefined}
                style={styles.item}
              />
            );
          }
          const n = row.item;
          return (
            <List.Item
              title={n.nick}
              description={n.hops <= 1 ? 'Bezpośrednio · dotknij, aby napisać' : `${n.hops} skoki · przez mesh`}
              left={() => <Avatar id={n.nodeId} label={n.nick} size={40} />}
              right={() => (
                <View style={styles.right}>
                  <Chip compact>{n.hops <= 1 ? '1 skok' : `${n.hops} skoki`}</Chip>
                </View>
              )}
              onPress={() => openDm(n.nodeId, n.nick)}
              style={styles.item}
            />
          );
        }}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={{ paddingBottom: 24 }}
      />
    </View>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  const theme = useTheme();
  return (
    <View style={styles.stat}>
      <Text variant="headlineMedium" style={{ color: theme.colors.primary }}>
        {value}
      </Text>
      <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  card: { margin: 16, marginBottom: 4, padding: 16, borderRadius: 16, gap: 12 },
  stats: { flexDirection: 'row', justifyContent: 'space-around' },
  stat: { alignItems: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  sectionHeader: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 4 },
  item: { paddingLeft: 16 },
  right: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
