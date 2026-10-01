import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, HelperText, Text, TextInput, useTheme } from 'react-native-paper';

import { MeshService } from '../services/mesh/MeshService';

export default function NewGroupScreen() {
  const theme = useTheme();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const clean = name.trim().replace(/^#/, '');
  const valid = clean.length >= 2 && clean.length <= 24;

  const create = async () => {
    if (!valid) return;
    setBusy(true);
    try {
      const id = await MeshService.createGroup(clean);
      router.replace({ pathname: '/chat/[id]', params: { id } });
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
        Grupa to kanał rozgłoszeniowy w sieci mesh. Każdy, do kogo dotrze pierwsza wiadomość, automatycznie
        zobaczy grupę na swojej liście rozmów.
      </Text>
      <TextInput
        mode="outlined"
        label="Nazwa grupy"
        value={name}
        onChangeText={setName}
        left={<TextInput.Affix text="#" />}
        maxLength={25}
        autoFocus
        onSubmitEditing={create}
      />
      <HelperText type="error" visible={name.length > 0 && !valid}>
        Nazwa musi mieć od 2 do 24 znaków.
      </HelperText>
      <Button mode="contained" icon="account-group" onPress={create} disabled={!valid || busy} loading={busy}>
        Utwórz grupę
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, gap: 12 },
});
