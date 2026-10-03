import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Icon, Text, useTheme } from 'react-native-paper';

import type { ChatMessage } from '../store/types';
import { radius, statusColors } from '../theme';
import { formatTime } from '../utils/time';

interface Props {
  message: ChatMessage;
  onRetry?: (id: string) => void;
}

const STATUS_ICON: Record<ChatMessage['status'], { icon: string; label: string }> = {
  sending: { icon: 'clock-outline', label: 'Wysyłanie' },
  sent: { icon: 'check', label: 'Wysłana' },
  delivered: { icon: 'check-all', label: 'Dostarczona' },
  failed: { icon: 'alert-circle-outline', label: 'Nieudana – dotknij, aby ponowić' },
};

function MessageBubbleImpl({ message, onRetry }: Props) {
  const theme = useTheme();
  const mine = message.direction === 'out';
  const status = STATUS_ICON[message.status];
  const failed = mine && message.status === 'failed';
  // Set only when the sender held a valid authority certificate – such messages are always urgent.
  const official = message.authority;

  const bubbleColor = mine ? theme.colors.primaryContainer : theme.colors.surface;
  const textColor = mine ? theme.colors.onPrimaryContainer : theme.colors.onSurface;
  const metaColor = theme.colors.onSurfaceVariant;

  return (
    <View style={[styles.row, mine ? styles.rowMine : styles.rowTheirs]}>
      <Pressable
        disabled={!failed}
        onPress={() => onRetry?.(message.id)}
        accessibilityLabel={
          mine
            ? `Twoja wiadomość, ${status.label}`
            : official
              ? `Pilna wiadomość od konta urzędowego ${official}`
              : `Wiadomość od ${message.senderNick}`
        }
        style={[
          styles.bubble,
          {
            backgroundColor: bubbleColor,
            borderColor: failed ? statusColors.error : official ? theme.colors.error : 'transparent',
          },
          mine ? styles.bubbleMine : styles.bubbleTheirs,
        ]}
      >
        {official && (
          <View style={styles.official}>
            <Icon source="alert-octagon-outline" size={15} color={theme.colors.error} />
            <Text variant="labelMedium" numberOfLines={2} style={{ color: theme.colors.error, flexShrink: 1 }}>
              PILNE · {official}
            </Text>
          </View>
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
    paddingTop: 8,
    paddingBottom: 6,
    borderRadius: radius.lg,
    borderWidth: 1,
    elevation: 1,
  },
  bubbleMine: { borderBottomRightRadius: radius.xs },
  bubbleTheirs: { borderBottomLeftRadius: radius.xs },
  official: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 },
  meta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 2 },
});
