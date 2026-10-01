import Constants from 'expo-constants';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, ToastAndroid, View } from 'react-native';
import { Button, Dialog, Divider, HelperText, List, Portal, Text, TextInput, useTheme } from 'react-native-paper';

import { openAppSettings } from '../services/permissions/permissions';
import { MeshService } from '../services/mesh/MeshService';
import { PROTOCOL_VERSION } from '../services/mesh/packet';
import { NICK_MAX, useIdentityStore, validateNick } from '../store/identityStore';
import { useMeshStore } from '../store/meshStore';

export default function SettingsScreen() {
  const theme = useTheme();
  const nodeId = useIdentityStore((s) => s.nodeId);
  const nick = useIdentityStore((s) => s.nick) ?? '';
  const radio = useMeshStore((s) => s.radio);
  const [editNick, setEditNick] = useState(false);
  const [draft, setDraft] = useState(nick);
  const [confirmClear, setConfirmClear] = useState(false);
  const [stats, setStats] = useState(MeshService.getStats());

  useEffect(() => {
    const t = setInterval(() => {
      const current = MeshService.getStats();
      setStats(current ? { ...current } : undefined);
    }, 2000);
    return () => clearInterval(t);
  }, []);

  const nickError = validateNick(draft);

  const saveNick = () => {
    if (nickError) return;
    MeshService.setNick(draft);
    setEditNick(false);
    ToastAndroid.show('Nick zmieniony i rozgłoszony w sieci', ToastAndroid.SHORT);
  };

  return (
    <ScrollView style={{ backgroundColor: theme.colors.background }}>
      <List.Section>
        <List.Subheader>Profil</List.Subheader>
        <List.Item
          title="Nick"
          description={nick}
          left={(p) => <List.Icon {...p} icon="account" />}
          right={(p) => <List.Icon {...p} icon="pencil" />}
          onPress={() => {
            setDraft(nick);
            setEditNick(true);
          }}
        />
        <List.Item
          title="ID urządzenia"
          description={nodeId}
          descriptionNumberOfLines={2}
          descriptionStyle={{ fontFamily: 'monospace' }}
          left={(p) => <List.Icon {...p} icon="identifier" />}
        />
      </List.Section>
      <Divider />

      <List.Section>
        <List.Subheader>Dane</List.Subheader>
        <List.Item
          title="Wyczyść historię"
          description="Usuwa wszystkie rozmowy i wiadomości z tego urządzenia"
          titleStyle={{ color: theme.colors.error }}
          left={(p) => <List.Icon {...p} color={theme.colors.error} icon="delete-sweep" />}
          onPress={() => setConfirmClear(true)}
        />
        <List.Item
          title="Uprawnienia systemowe"
          description="Otwórz ustawienia aplikacji w systemie"
          left={(p) => <List.Icon {...p} icon="shield-key" />}
          onPress={openAppSettings}
        />
      </List.Section>
      <Divider />

      <List.Section>
        <List.Subheader>Sieć (diagnostyka)</List.Subheader>
        <View style={styles.diag}>
          <Row label="Bluetooth" value={radio.bluetooth} />
          <Row label="Tryb Peripheral" value={radio.peripheralSupported ? 'obsługiwany' : 'nieobsługiwany'} />
          <Row label="Rozgłaszanie" value={radio.advertising ? 'aktywne' : 'nieaktywne'} />
          <Row label="Pakiety odebrane" value={String(stats?.received ?? 0)} />
          <Row label="Pakiety przekazane (relay)" value={String(stats?.relayed ?? 0)} />
          <Row label="Duplikaty odrzucone" value={String(stats?.duplicates ?? 0)} />
          <Row label="Odrzucone (limit/błąd)" value={String(stats?.dropped ?? 0)} />
        </View>
      </List.Section>
      <Divider />

      <List.Section>
        <List.Subheader>O aplikacji</List.Subheader>
        <View style={styles.about}>
          <Text variant="titleMedium">Mesh Chat {Constants.expoConfig?.version ?? ''}</Text>
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
            Czat peer-to-peer przez Bluetooth Low Energy, bez internetu. Każdy telefon jest jednocześnie klientem
            (Central) i serwerem (Peripheral), a wiadomości są przekazywane przez sąsiednie urządzenia
            (flooding z TTL i deduplikacją oraz trasowanie wsteczne z ogłoszeń).
          </Text>
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
            Protokół mesh v{PROTOCOL_VERSION} · wiadomości nie są szyfrowane end-to-end.
          </Text>
        </View>
      </List.Section>

      <Portal>
        <Dialog visible={editNick} onDismiss={() => setEditNick(false)}>
          <Dialog.Title>Zmień nick</Dialog.Title>
          <Dialog.Content>
            <TextInput mode="outlined" value={draft} onChangeText={setDraft} maxLength={NICK_MAX} autoFocus />
            <HelperText type="error" visible={!!nickError}>
              {nickError}
            </HelperText>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setEditNick(false)}>Anuluj</Button>
            <Button onPress={saveNick} disabled={!!nickError}>
              Zapisz
            </Button>
          </Dialog.Actions>
        </Dialog>
        <Dialog visible={confirmClear} onDismiss={() => setConfirmClear(false)}>
          <Dialog.Title>Wyczyścić historię?</Dialog.Title>
          <Dialog.Content>
            <Text>Wszystkie rozmowy i wiadomości zostaną trwale usunięte z tego urządzenia.</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setConfirmClear(false)}>Anuluj</Button>
            <Button
              textColor={theme.colors.error}
              onPress={async () => {
                await MeshService.clearHistory();
                setConfirmClear(false);
                ToastAndroid.show('Historia wyczyszczona', ToastAndroid.SHORT);
              }}
            >
              Wyczyść
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </ScrollView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return (
    <View style={styles.row}>
      <Text variant="bodyMedium">{label}</Text>
      <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  diag: { paddingHorizontal: 16, gap: 6 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  about: { paddingHorizontal: 16, gap: 8, paddingBottom: 32 },
});
