import { useState } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, View } from 'react-native';
import { HelperText, Icon, Text, TextInput, useTheme } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '../components/PrimaryButton';
import { fingerprint } from '../services/crypto/keys';
import { NICK_MAX, useIdentityStore, validateNick } from '../store/identityStore';
import { radius } from '../theme';

export default function OnboardingScreen() {
  const theme = useTheme();
  const nodeId = useIdentityStore((s) => s.nodeId);
  const setNick = useIdentityStore((s) => s.setNick);
  const [nick, setNickInput] = useState('');
  const [touched, setTouched] = useState(false);
  const error = validateNick(nick);

  const submit = () => {
    setTouched(true);
    if (!error) setNick(nick);
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]}>
      <KeyboardAvoidingView style={styles.safe} behavior="height">
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.hero}>
            <Icon source="access-point-network" size={72} color={theme.colors.primary} />
            <View style={[styles.accent, { backgroundColor: theme.colors.secondary }]} />
            <Text variant="headlineLarge" style={styles.center}>
              Witaj w Mesh Chat
            </Text>
            <Text variant="bodyLarge" style={[styles.center, { color: theme.colors.onSurfaceVariant }]}>
              Twój telefon stanie się węzłem sieci. Wiadomości przeskakują przez inne telefony, więc
              dotrą też do osób poza zasięgiem Bluetooth.
            </Text>
          </View>

          <TextInput
            mode="outlined"
            outlineStyle={{ borderRadius: radius.md }}
            label="Twój nick"
            value={nick}
            onChangeText={setNickInput}
            onBlur={() => setTouched(true)}
            maxLength={NICK_MAX}
            autoFocus
            autoCapitalize="none"
            returnKeyType="done"
            onSubmitEditing={submit}
            left={<TextInput.Icon icon="account" />}
            right={<TextInput.Affix text={`${nick.length}/${NICK_MAX}`} />}
          />
          <HelperText type={touched && error ? 'error' : 'info'} visible>
            {touched && error ? error : 'Nick jest widoczny dla wszystkich w sieci mesh. Możesz go zmienić później.'}
          </HelperText>

          <View style={[styles.idBox, { backgroundColor: theme.colors.surfaceVariant }]}>
            <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>
              Twoje bezpieczeństwo
            </Text>
            <Text variant="bodyMedium">
              Rozmowy są szyfrowane end-to-end, a każda wiadomość jest podpisana kluczem, który powstał na tym
              telefonie i nigdy go nie opuszcza. Komunikaty do wszystkich mogą nadawać tylko konta urzędowe z
              certyfikatem. Szczegóły znajdziesz w Ustawieniach → Bezpieczeństwo.
            </Text>
            <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 8 }}>
              Odcisk Twojego klucza
            </Text>
            <Text variant="bodySmall" selectable style={{ fontFamily: 'monospace' }}>
              {fingerprint(nodeId)}
            </Text>
          </View>
        </ScrollView>
        <View style={styles.actions}>
          <PrimaryButton icon="arrow-right" contentStyle={{ flexDirection: 'row-reverse' }} onPress={submit}>
            Dołącz do sieci
          </PrimaryButton>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 16, gap: 4 },
  hero: { alignItems: 'center', gap: 12, marginVertical: 24 },
  accent: { width: 32, height: 4, borderRadius: radius.full },
  center: { textAlign: 'center' },
  idBox: { padding: 12, borderRadius: radius.md, gap: 2, marginTop: 12 },
  actions: { padding: 16 },
});
