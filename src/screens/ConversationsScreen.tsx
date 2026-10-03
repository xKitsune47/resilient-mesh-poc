import { router, useIsFocused } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { Button, Dialog, FAB, Portal, Text, useTheme } from 'react-native-paper';
import { useShallow } from 'zustand/react/shallow';

import { AlertBanner } from '../components/AlertBanner';
import { ConversationListItem } from '../components/ConversationListItem';
import { NetworkStatusBar } from '../components/NetworkStatusBar';
import { MeshService } from '../services/mesh/MeshService';
import { useChatStore } from '../store/chatStore';
import { trustLevel, useContactsStore } from '../store/contactsStore';
import { selectIsAuthority, useIdentityStore } from '../store/identityStore';
import { useMeshStore } from '../store/meshStore';
import type { Conversation } from '../store/types';

export default function ConversationsScreen() {
  const theme = useTheme();
  const isFocused = useIsFocused();
  const conversations = useChatStore((s) => s.conversations);
  const nodes = useMeshStore((s) => s.nodes);
  const trust = useContactsStore(useShallow((s) => ({ contacts: s.contacts, authorities: s.authorities })));
  const isAuthority = useIdentityStore((s) => selectIsAuthority(s));
  const [fabOpen, setFabOpen] = useState(false);
  const [toDelete, setToDelete] = useState<Conversation | null>(null);

  const reachable = useMemo(() => new Set(nodes.map((n) => n.nodeId)), [nodes]);

  // Conversations with certified authority accounts stay on top; the store keeps the rest by recency.
  const rows = useMemo(() => {
    const withTrust = conversations.map((c) => ({ c, level: trustLevel(trust, c.peerId) }));
    return [...withTrust.filter((r) => r.level === 'official'), ...withTrust.filter((r) => r.level !== 'official')];
  }, [conversations, trust]);

  const open = useCallback((id: string) => {
    router.push({ pathname: '/chat/[id]', params: { id } });
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <AlertBanner />
      <NetworkStatusBar onPress={() => router.navigate('/network')} />
      <FlatList
        data={rows}
        keyExtractor={(r) => r.c.id}
        renderItem={({ item }) => (
          <ConversationListItem
            conversation={item.c}
            online={!!item.c.peerId && reachable.has(item.c.peerId)}
            trust={item.level}
            onPress={open}
            onLongPress={setToDelete}
          />
        )}
        ItemSeparatorComponent={() => <View style={styles.gap} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text variant="bodyLarge" style={{ color: theme.colors.onSurfaceVariant, textAlign: 'center' }}>
              Brak rozmów. Otwórz zakładkę „Sieć”, aby napisać do kogoś w pobliżu.
            </Text>
          </View>
        }
        contentContainerStyle={styles.list}
      />

      {!isAuthority && (
        <FAB
          icon="message-plus"
          accessibilityLabel="Nowa rozmowa"
          onPress={() => router.navigate('/network')}
          style={styles.fab}
        />
      )}

      <Portal>
        {isAuthority && (
          <FAB.Group
            open={fabOpen && isFocused}
            visible={isFocused}
            icon={fabOpen ? 'close' : 'plus'}
            onStateChange={({ open: o }) => setFabOpen(o)}
            actions={[
              { icon: 'alert-octagon-outline', label: 'Nowy alert', onPress: () => router.push('/compose-alert') },
              { icon: 'account-search', label: 'Nowa rozmowa', onPress: () => router.navigate('/network') },
            ]}
            style={{ paddingBottom: 72 }}
          />
        )}
        <Dialog visible={!!toDelete} onDismiss={() => setToDelete(null)}>
          <Dialog.Title>Usunąć rozmowę?</Dialog.Title>
          <Dialog.Content>
            <Text>Historia „{toDelete?.title}” zostanie usunięta z tego urządzenia.</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setToDelete(null)}>Anuluj</Button>
            <Button
              textColor={theme.colors.error}
              onPress={async () => {
                if (toDelete) await MeshService.deleteConversation(toDelete.id);
                setToDelete(null);
              }}
            >
              Usuń
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { paddingTop: 12, paddingBottom: 96 },
  gap: { height: 8 },
  empty: { padding: 32 },
  fab: { position: 'absolute', right: 16, bottom: 16 },
});
