import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Badge, Text, TouchableRipple, useTheme } from 'react-native-paper';

import type { Conversation } from '../store/types';
import { formatRelative } from '../utils/time';
import { Avatar } from './Avatar';

interface Props {
  conversation: Conversation;
  online: boolean;
  onPress: (id: string) => void;
  onLongPress?: (c: Conversation) => void;
}

function ConversationListItemImpl({ conversation: c, online, onPress, onLongPress }: Props) {
  const theme = useTheme();
  const isGroup = c.type === 'group';
  return (
    <TouchableRipple onPress={() => onPress(c.id)} onLongPress={() => onLongPress?.(c)}>
      <View style={styles.row}>
        <View>
          <Avatar id={c.id} label={c.title} icon={isGroup ? 'account-group' : undefined} />
          {!isGroup && online && <View style={[styles.online, { borderColor: theme.colors.background }]} />}
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
              style={[styles.preview, { color: theme.colors.onSurfaceVariant }]}
            >
              {c.lastMessagePreview || (isGroup ? 'Czat grupowy · broadcast w mesh' : 'Brak wiadomości')}
            </Text>
            {c.unread > 0 && <Badge style={{ backgroundColor: theme.colors.primary }}>{c.unread}</Badge>}
          </View>
        </View>
      </View>
    </TouchableRipple>
  );
}

export const ConversationListItem = memo(ConversationListItemImpl);

const styles = StyleSheet.create({
  row: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 12, gap: 14, alignItems: 'center' },
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
    backgroundColor: '#22A06B',
    borderWidth: 2,
  },
});
