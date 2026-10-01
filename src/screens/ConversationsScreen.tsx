import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { Button, Dialog, Divider, FAB, Portal, Text, useTheme } from 'react-native-paper';

import { ConversationListItem } from '../components/ConversationListItem';
import { NetworkStatusBar } from '../components/NetworkStatusBar';
import { MeshService } from '../services/mesh/MeshService';
import { useChatStore } from '../store/chatStore';
import { useMeshStore } from '../store/meshStore';
import { Conversation, GENERAL_CONVERSATION_ID } from '../store/types';

export default function ConversationsScreen() {
  const theme = useTheme();
  const conversations = useChatStore((s) => s.conversations);
  const nodes = useMeshStore((s) => s.nodes);
  const [fabOpen, setFabOpen] = useState(false);
  const [toDelete, setToDelete] = useState<Conversation | null>(null);

  const reachable = useMemo(() => new Set(nodes.map((n) => n.nodeId)), [nodes]);

  const open = useCallback((id: string) => {
    router.push({ pathname: '/chat/[id]', params: { id } });
  }, []);

  const onLongPress = useCallback((c: Conversation) => {
    if (c.id !== GENERAL_CONVERSATION_ID) setToDelete(c);
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <NetworkStatusBar onPress={() => router.navigate('/network')} />
      <FlatList
        data={conversations}
        keyExtractor={(c) => c.id}
        renderItem={({ item }) => (
          <ConversationListItem
            conversation={item}
            online={!!item.peerId && reachable.has(item.peerId)}
            onPress={open}
            onLongPress={onLongPress}
          />
        )}
        ItemSeparatorComponent={() => <Divider style={{ marginLeft: 74 }} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text variant="bodyLarge" style={{ color: theme.colors.onSurfaceVariant, textAlign: 'center' }}>
              Brak rozmów. Otwórz zakładkę „Sieć”, aby napisać do kogoś w pobliżu.
            </Text>
          </View>
        }
        contentContainerStyle={{ paddingBottom: 96 }}
      />

      <Portal>
        <FAB.Group
          open={fabOpen}
          visible
          icon={fabOpen ? 'close' : 'message-plus'}
          onStateChange={({ open: o }) => setFabOpen(o)}
          actions={[
            { icon: 'account-group', label: 'Nowa grupa', onPress: () => router.push('/new-group') },
            { icon: 'account-search', label: 'Nowa rozmowa 1:1', onPress: () => router.navigate('/network') },
          ]}
          style={{ paddingBottom: 72 }}
        />
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
  empty: { padding: 32 },
});
