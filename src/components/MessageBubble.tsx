import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Icon, Text, useTheme } from 'react-native-paper';

import type { ChatMessage } from '../store/types';
import { statusColors } from '../theme';
import { formatTime } from '../utils/time';

interface Props {
  message: ChatMessage;
  showSender: boolean;
  isGroup: boolean;
  onRetry?: (id: string) => void;
}

const STATUS_ICON: Record<ChatMessage['status'], { icon: string; label: string }> = {
  sending: { icon: 'clock-outline', label: 'Wysyłanie' },
  sent: { icon: 'check', label: 'Wysłana' },
  delivered: { icon: 'check-all', label: 'Dostarczona' },
  failed: { icon: 'alert-circle-outline', label: 'Nieudana – dotknij, aby ponowić' },
};

function MessageBubbleImpl({ message, showSender, isGroup, onRetry }: Props) {
  const theme = useTheme();
  const mine = message.direction === 'out';
  const status = STATUS_ICON[message.status];
  const failed = mine && message.status === 'failed';

  const bubbleColor = mine ? theme.colors.primaryContainer : theme.colors.surface;
  const textColor = mine ? theme.colors.onPrimaryContainer : theme.colors.onSurface;
  const metaColor = theme.colors.onSurfaceVariant;

  return (
    <View style={[styles.row, mine ? styles.rowMine : styles.rowTheirs]}>
      <Pressable
        disabled={!failed}
        onPress={() => onRetry?.(message.id)}
        accessibilityLabel={mine ? `Twoja wiadomość, ${status.label}` : `Wiadomość od ${message.senderNick}`}
        style={[
          styles.bubble,
          { backgroundColor: bubbleColor, borderColor: failed ? statusColors.error : 'transparent' },
          mine ? styles.bubbleMine : styles.bubbleTheirs,
        ]}
      >
        {showSender && !mine && (
          <Text variant="labelMedium" style={{ color: theme.colors.primary, marginBottom: 2 }}>
            {message.senderNick}
          </Text>
        )}
        <Text variant="bodyLarge" style={{ color: textColor }} selectable>
          {message.text}
        </Text>
        <View style={styles.meta}>
          {!mine && message.hops !== null && message.hops > 1 && (
            <Text variant="labelSmall" style={{ color: metaColor }}>
              {message.hops} skoki ·{' '}
            </Text>
          )}
          <Text variant="labelSmall" style={{ color: metaColor }}>
            {formatTime(message.timestamp)}
          </Text>
          {mine && (
            <>
              {isGroup && message.deliveredCount > 0 && (
                <Text variant="labelSmall" style={{ color: metaColor, marginLeft: 4 }}>
                  {message.deliveredCount}
                </Text>
              )}
              <View style={{ marginLeft: 3 }}>
                <Icon
                  source={status.icon}
                  size={15}
                  color={
                    message.status === 'failed'
                      ? statusColors.error
                      : message.status === 'delivered'
                        ? theme.colors.primary
                        : metaColor
                  }
                />
              </View>
            </>
          )}
        </View>
        {failed && (
          <Text variant="labelSmall" style={{ color: statusColors.error, marginTop: 2 }}>
            Nie dostarczono · dotknij, aby ponowić
          </Text>
        )}
      </Pressable>
    </View>
  );
}

export const MessageBubble = memo(MessageBubbleImpl);

const styles = StyleSheet.create({
  row: { paddingHorizontal: 12, marginVertical: 2, flexDirection: 'row' },
  rowMine: { justifyContent: 'flex-end' },
  rowTheirs: { justifyContent: 'flex-start' },
  bubble: {
    maxWidth: '82%',
    paddingHorizontal: 12,
    paddingTop: 7,
    paddingBottom: 5,
    borderRadius: 16,
    borderWidth: 1,
    elevation: 1,
  },
  bubbleMine: { borderBottomRightRadius: 4 },
  bubbleTheirs: { borderBottomLeftRadius: 4 },
  meta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 2 },
});
