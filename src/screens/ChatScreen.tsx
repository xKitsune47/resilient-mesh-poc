import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, KeyboardAvoidingView, StyleSheet, View } from 'react-native';
import { Snackbar, Text, useTheme } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MessageBubble } from '../components/MessageBubble';
import { MessageInput } from '../components/MessageInput';
import { MeshService } from '../services/mesh/MeshService';
import { useChatStore } from '../store/chatStore';
import { useMeshStore } from '../store/meshStore';
import type { ChatMessage } from '../store/types';

const EMPTY: ChatMessage[] = [];

export default function ChatScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const conversation = useChatStore((s) => s.conversations.find((c) => c.id === id));
  const messages = useChatStore((s) => s.messages[id] ?? EMPTY);
  const node = useMeshStore((s) => (conversation?.peerId ? s.nodes.find((n) => n.nodeId === conversation.peerId) : undefined));
  const linkCount = useMeshStore((s) => s.links.length);
  const [snack, setSnack] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const store = useChatStore.getState();
    store.setActive(id);
    void store.loadMessages(id);
    void MeshService.markRead(id);
    return () => useChatStore.getState().setActive(null);
  }, [id]);

  // Mark read while the screen stays open and new messages arrive.
  useEffect(() => {
    if (id && conversation?.unread) void MeshService.markRead(id);
  }, [id, conversation?.unread]);

  const isGroup = conversation?.type === 'group';
  const subtitle = isGroup
    ? `Grupa · broadcast do ${linkCount > 0 ? 'całej sieci' : 'nikogo (brak połączeń)'}`
    : node
      ? node.hops <= 1
        ? 'W zasięgu · bezpośrednio'
        : `Osiągalny przez mesh · ${node.hops} skoki`
      : 'Poza zasięgiem – wiadomość może nie dotrzeć';

  const reversed = useMemo(() => [...messages].reverse(), [messages]);

  const send = useCallback(
    async (text: string) => {
      const res = await MeshService.sendMessage(id, text);
      if (res.ok) return true;
      if (res.reason === 'rate_limited') {
        setSnack(`Zwolnij – ochrona przed floodem. Spróbuj za ${Math.ceil((res.retryInMs ?? 1000) / 1000)} s.`);
      } else if (res.reason === 'too_long') {
        setSnack('Wiadomość jest za długa.');
      }
      return false;
    },
    [id]
  );

  const retry = useCallback((messageId: string) => void MeshService.resend(messageId), []);

  const renderItem = useCallback(
    ({ item, index }: { item: ChatMessage; index: number }) => {
      // List is inverted: the "previous" message is at index + 1.
      const prev = reversed[index + 1];
      const showSender = isGroup && (!prev || prev.senderId !== item.senderId);
      return <MessageBubble message={item} showSender={showSender} isGroup={isGroup} onRetry={retry} />;
    },
    [reversed, isGroup, retry]
  );

  return (
    <SafeAreaView edges={['bottom']} style={[styles.flex, { backgroundColor: theme.colors.background }]}>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <View>
              <Text variant="titleMedium" numberOfLines={1}>
                {conversation?.title ?? 'Czat'}
              </Text>
              <Text variant="labelSmall" numberOfLines={1} style={{ color: theme.colors.onSurfaceVariant }}>
                {subtitle}
              </Text>
            </View>
          ),
        }}
      />
      <KeyboardAvoidingView style={styles.flex} behavior="height">
        <FlatList
          data={reversed}
          inverted
          keyExtractor={(m) => m.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, textAlign: 'center' }}>
                {isGroup
                  ? 'Wiadomości w tej grupie trafią do każdego węzła w sieci mesh.'
                  : 'Napisz pierwszą wiadomość. Zostanie przekazana przez sieć mesh.'}
              </Text>
            </View>
          }
        />
        <MessageInput onSend={send} disabled={!conversation} />
      </KeyboardAvoidingView>
      <Snackbar visible={!!snack} onDismiss={() => setSnack(null)} duration={3000}>
        {snack}
      </Snackbar>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { paddingVertical: 8, flexGrow: 1 },
  // Inverted list: flip the empty state back.
  empty: { flex: 1, justifyContent: 'center', padding: 32, transform: [{ scaleY: -1 }] },
});
