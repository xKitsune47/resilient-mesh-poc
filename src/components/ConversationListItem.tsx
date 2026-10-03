import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Badge, Text, TouchableRipple, useTheme } from 'react-native-paper';

import type { TrustLevel } from '../store/contactsStore';
import type { Conversation } from '../store/types';
import { radius, statusColors } from '../theme';
import { formatRelative } from '../utils/time';
import { Avatar } from './Avatar';
import { TrustBadge } from './TrustBadge';

interface Props {
  conversation: Conversation;
  online: boolean;
  trust: TrustLevel;
  onPress: (id: string) => void;
  onLongPress?: (c: Conversation) => void;
}

function ConversationListItemImpl({ conversation: c, online, trust, onPress, onLongPress }: Props) {
  const theme = useTheme();
  const official = trust === 'official';
  return (
    <TouchableRipple
      borderless
      onPress={() => onPress(c.id)}
      onLongPress={() => onLongPress?.(c)}
      style={[styles.card, { backgroundColor: theme.colors.surface }]}
    >
      <View style={styles.row}>
        <View>
          <Avatar id={c.id} label={c.title} icon={official ? 'bank-outline' : undefined} />
          {online && <View style={[styles.online, { borderColor: theme.colors.surface }]} />}
        </View>
        <View style={styles.body}>
          <View style={styles.top}>
            <Text variant="titleMedium" numberOfLines={1} style={styles.title}>
              {c.title}
            </Text>
            {c.lastMessageAt > 0 && (
              <Text
                variant="labelSmall"
                style={{ color: c.unread ? theme.colors.primary : theme.colors.onSurfaceVariant }}
              >
                {formatRelative(c.lastMessageAt)}
              </Text>
            )}
          </View>
          <View style={styles.top}>
            <Text
              variant="bodyMedium"
              numberOfLines={1}
              style={[styles.preview, { color: official ? theme.colors.error : theme.colors.onSurfaceVariant }]}
            >
              {official && c.lastMessagePreview ? 'PILNE · ' : ''}
              {c.lastMessagePreview || 'Brak wiadomości'}
            </Text>
            {c.unread > 0 && (
              <Badge style={{ backgroundColor: theme.colors.primary, color: theme.colors.onPrimary }}>{c.unread}</Badge>
            )}
          </View>
          <TrustBadge level={trust} />
        </View>
      </View>
    </TouchableRipple>
  );
}

export const ConversationListItem = memo(ConversationListItemImpl);

const styles = StyleSheet.create({
  card: { marginHorizontal: 16, borderRadius: radius.md, elevation: 1 },
  row: { flexDirection: 'row', padding: 12, gap: 12, alignItems: 'center', minHeight: 64 },
  body: { flex: 1, gap: 2 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flex: 1 },
  preview: { flex: 1 },
  online: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: statusColors.connected,
    borderWidth: 2,
  },
});
