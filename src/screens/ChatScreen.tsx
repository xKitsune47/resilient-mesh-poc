import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Pressable, StyleSheet, View } from 'react-native';
import { Icon, IconButton, Snackbar, Text, useTheme } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useShallow } from 'zustand/react/shallow';

import { AlertBanner } from '../components/AlertBanner';
import { Avatar } from '../components/Avatar';
import { MessageBubble } from '../components/MessageBubble';
import { MessageInput } from '../components/MessageInput';
import { TrustBadge } from '../components/TrustBadge';
import { MeshService } from '../services/mesh/MeshService';
import { useChatStore } from '../store/chatStore';
import { authorityName, trustLevel, useContactsStore } from '../store/contactsStore';
import { useMeshStore } from '../store/meshStore';
import type { ChatMessage } from '../store/types';
import { radius } from '../theme';
import { nickSkeleton } from '../utils/nick';

const EMPTY: ChatMessage[] = [];

export default function ChatScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const conversation = useChatStore((s) => s.conversations.find((c) => c.id === id));
  const messages = useChatStore((s) => s.messages[id] ?? EMPTY);
  const peerId = conversation?.peerId;
  const node = useMeshStore((s) => (peerId ? s.nodes.find((n) => n.nodeId === peerId) : undefined));
  const trust = useContactsStore(useShallow((s) => ({ contacts: s.contacts, authorities: s.authorities })));
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

  const level = trustLevel(trust, peerId);
  const office = authorityName(trust, peerId);
  const title = conversation?.title ?? 'Czat';
  // A stranger using the name of someone the user verified in person is the classic impersonation.
  const lookalike = useMemo(() => {
    if (level !== 'unverified' || !peerId) return false;
    const skeleton = nickSkeleton(title);
    return Object.values(trust.contacts).some(
      (c) => c.nodeId !== peerId && !!c.verifiedAt && nickSkeleton(c.nick) === skeleton
    );
  }, [level, peerId, title, trust.contacts]);

  const subtitle = node
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
    ({ item }: { item: ChatMessage }) => <MessageBubble message={item} onRetry={retry} />,
    [retry]
  );

  const verify = () => peerId && router.push({ pathname: '/verify/[id]', params: { id: peerId } });

  // Security notice at the start of the conversation (the list is inverted: footer = top).
  const notice = (
    <Pressable
      onPress={verify}
      accessibilityRole="button"
      style={[styles.notice, { backgroundColor: lookalike ? theme.colors.errorContainer : theme.colors.surfaceVariant }]}
    >
      <Icon
        source={lookalike ? 'alert' : 'lock-outline'}
        size={18}
        color={lookalike ? theme.colors.onErrorContainer : theme.colors.onSurfaceVariant}
      />
      <View style={styles.flex}>
        <Text
          variant="bodyMedium"
          style={{ color: lookalike ? theme.colors.onErrorContainer : theme.colors.onSurfaceVariant }}
        >
          {lookalike
            ? 'Uwaga: ktoś o tej samej nazwie jest na liście Twoich zweryfikowanych kontaktów, ale to jest inne urządzenie. Sprawdź klucz, zanim zaufasz tej rozmowie.'
            : office
              ? `Rozmowa szyfrowana end-to-end. Nadawca ma certyfikat konta urzędowego: ${office}.`
              : level === 'verified'
                ? 'Rozmowa szyfrowana end-to-end. Klucz tej osoby został przez Ciebie zweryfikowany.'
                : 'Rozmowa szyfrowana end-to-end. Klucz tej osoby nie jest zweryfikowany – dotknij, aby sprawdzić, z kim rozmawiasz.'}
        </Text>
        <TrustBadge level={level} />
      </View>
    </Pressable>
  );

  return (
    <SafeAreaView edges={['bottom']} style={[styles.flex, { backgroundColor: theme.colors.background }]}>
      <Stack.Screen
        options={{
          headerTitleAlign: 'left',
          headerTitle: () => (
            <View style={styles.header}>
              <Avatar id={id} label={title} size={36} icon={office ? 'bank-outline' : undefined} />
              <View style={styles.flex}>
                <Text variant="titleMedium" numberOfLines={1} style={{ color: theme.colors.primary }}>
                  {title}
                </Text>
                <Text variant="labelSmall" numberOfLines={1} style={{ color: theme.colors.onSurfaceVariant }}>
                  {subtitle}
                </Text>
              </View>
            </View>
          ),
          headerRight: () => (
            <IconButton
              icon={level === 'unverified' ? 'shield-alert-outline' : 'shield-check-outline'}
              iconColor={theme.colors.primary}
              accessibilityLabel="Weryfikacja klucza rozmówcy"
              onPress={verify}
            />
          ),
        }}
      />
      <AlertBanner />
      <KeyboardAvoidingView style={styles.flex} behavior="height">
        <FlatList
          data={reversed}
          inverted
          keyExtractor={(m) => m.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ListFooterComponent={notice}
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
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, marginRight: 16 },
  list: { paddingVertical: 8, flexGrow: 1 },
  notice: {
    flexDirection: 'row',
    gap: 8,
    marginHorizontal: 12,
    marginVertical: 8,
    padding: 12,
    borderRadius: radius.md,
  },
});
