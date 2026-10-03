import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { IconButton, Text, useTheme } from 'react-native-paper';

import { MAX_MESSAGE_LENGTH } from '../services/mesh/MeshService';
import { radius } from '../theme';

interface Props {
  onSend: (text: string) => Promise<boolean>;
  disabled?: boolean;
}

export function MessageInput({ onSend, disabled }: Props) {
  const theme = useTheme();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const remaining = MAX_MESSAGE_LENGTH - text.length;
  const canSend = text.trim().length > 0 && remaining >= 0 && !busy && !disabled;

  const send = async () => {
    if (!canSend) return;
    setBusy(true);
    try {
      if (await onSend(text)) setText('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.wrap, { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.outlineVariant }]}>
      <View style={[styles.field, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant }]}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Wiadomość"
          placeholderTextColor={theme.colors.onSurfaceVariant}
          style={[styles.input, { color: theme.colors.onSurface }]}
          multiline
          maxLength={MAX_MESSAGE_LENGTH + 50}
          accessibilityLabel="Treść wiadomości"
        />
        {remaining < 60 && (
          <Text variant="labelSmall" style={{ color: remaining < 0 ? theme.colors.error : theme.colors.onSurfaceVariant }}>
            {remaining}
          </Text>
        )}
      </View>
      <IconButton
        icon="send"
        mode="contained"
        size={22}
        containerColor={theme.colors.primary}
        iconColor={theme.colors.onPrimary}
        style={styles.send}
        disabled={!canSend}
        onPress={send}
        accessibilityLabel="Wyślij"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    borderTopWidth: 1,
  },
  field: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 16,
    minHeight: 44,
  },
  input: { flex: 1, fontSize: 16, maxHeight: 120, paddingVertical: 8 },
  send: { width: 44, height: 44, margin: 0, borderRadius: radius.full },
});
