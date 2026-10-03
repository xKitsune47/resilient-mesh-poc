import Constants from 'expo-constants';
import { router } from 'expo-router';
import { type ReactNode, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, ToastAndroid, View } from 'react-native';
import {
  Button,
  Dialog,
  HelperText,
  List,
  Portal,
  SegmentedButtons,
  Text,
  TextInput,
  useTheme,
} from 'react-native-paper';

import { AlertBanner } from '../components/AlertBanner';
import { fingerprint } from '../services/crypto/keys';
import { openAppSettings } from '../services/permissions/permissions';
import { MeshService } from '../services/mesh/MeshService';
import { PROTOCOL_VERSION } from '../services/mesh/packet';
import { type ThemePreference, useAppearanceStore } from '../store/appearanceStore';
import { NICK_MAX, selectIsAuthority, useIdentityStore, validateNick } from '../store/identityStore';
import { useMeshStore } from '../store/meshStore';
import { radius } from '../theme';
import { formatDate } from '../utils/time';

export default function SettingsScreen() {
  const theme = useTheme();
  const nodeId = useIdentityStore((s) => s.nodeId);
  const nick = useIdentityStore((s) => s.nick) ?? '';
  const authority = useIdentityStore((s) => s.authority);
  const isAuthority = useIdentityStore((s) => selectIsAuthority(s));
  const radio = useMeshStore((s) => s.radio);
  const themePref = useAppearanceStore((s) => s.theme);
  const setTheme = useAppearanceStore((s) => s.setTheme);
  const [editNick, setEditNick] = useState(false);
  const [draft, setDraft] = useState(nick);
  const [confirmClear, setConfirmClear] = useState(false);
  const [confirmRemoveCert, setConfirmRemoveCert] = useState(false);
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
    <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      <AlertBanner />
      <ScrollView contentContainerStyle={styles.content}>
        <Section title="Profil">
          <List.Item
            title="Nick"
            description={nick}
            left={(p) => <List.Icon {...p} icon="account-outline" />}
            right={(p) => <List.Icon {...p} icon="pencil-outline" />}
            onPress={() => {
              setDraft(nick);
              setEditNick(true);
            }}
          />
          <List.Item
            title="Mój klucz"
            description={fingerprint(nodeId)}
            descriptionNumberOfLines={2}
            descriptionStyle={{ fontFamily: 'monospace' }}
            left={(p) => <List.Icon {...p} icon="qrcode" />}
            right={(p) => <List.Icon {...p} icon="chevron-right" />}
            onPress={() => router.push('/my-key')}
          />
        </Section>

        <Section title="Bezpieczeństwo">
          <List.Item
            title="Stan zabezpieczeń"
            description="Co chroni Twoje rozmowy, a czego aplikacja nie chroni"
            descriptionNumberOfLines={2}
            left={(p) => <List.Icon {...p} icon="shield-lock-outline" />}
            right={(p) => <List.Icon {...p} icon="chevron-right" />}
            onPress={() => router.push('/security')}
          />
          <List.Item
            title="Komunikaty urzędowe"
            description="Aktywne i zakończone alerty"
            left={(p) => <List.Icon {...p} icon="alert-octagon-outline" />}
            right={(p) => <List.Icon {...p} icon="chevron-right" />}
            onPress={() => router.push('/alerts')}
          />
        </Section>

        <Section title="Konto urzędowe">
          {authority ? (
            <>
              <List.Item
                title={authority.name}
                description={
                  isAuthority
                    ? `Certyfikat ważny do ${formatDate(authority.exp)}`
                    : `Certyfikat wygasł ${formatDate(authority.exp)} – poproś o nowy`
                }
                descriptionStyle={isAuthority ? undefined : { color: theme.colors.error }}
                left={(p) => <List.Icon {...p} icon="shield-star-outline" />}
              />
              {isAuthority && (
                <List.Item
                  title="Nadaj alert"
                  description="Pilny komunikat do wszystkich w sieci"
                  left={(p) => <List.Icon {...p} icon="bullhorn-outline" />}
                  right={(p) => <List.Icon {...p} icon="chevron-right" />}
                  onPress={() => router.push('/compose-alert')}
                />
              )}
              <List.Item
                title="Wczytaj nowy certyfikat"
                left={(p) => <List.Icon {...p} icon="qrcode-scan" />}
                onPress={() => router.push('/install-cert')}
              />
              <List.Item
                title="Usuń certyfikat"
                titleStyle={{ color: theme.colors.error }}
                left={(p) => <List.Icon {...p} color={theme.colors.error} icon="shield-off-outline" />}
                onPress={() => setConfirmRemoveCert(true)}
              />
            </>
          ) : (
            <List.Item
              title="Wczytaj certyfikat urzędowy"
              description="Dla upoważnionych pracowników urzędów. Certyfikat wydaje operator po sprawdzeniu tożsamości."
              descriptionNumberOfLines={3}
              left={(p) => <List.Icon {...p} icon="qrcode-scan" />}
              right={(p) => <List.Icon {...p} icon="chevron-right" />}
              onPress={() => router.push('/install-cert')}
            />
          )}
        </Section>

        <Section title="Wygląd">
          <View style={styles.padded}>
            <SegmentedButtons
              value={themePref}
              onValueChange={(v) => setTheme(v as ThemePreference)}
              buttons={[
                { value: 'light', label: 'Jasny', icon: 'white-balance-sunny' },
                { value: 'dark', label: 'Ciemny', icon: 'weather-night' },
                { value: 'system', label: 'Systemowy', icon: 'theme-light-dark' },
              ]}
            />
          </View>
        </Section>

        <Section title="Dane">
          <List.Item
            title="Wyczyść historię"
            description="Usuwa wszystkie rozmowy i wiadomości z tego urządzenia"
            titleStyle={{ color: theme.colors.error }}
            left={(p) => <List.Icon {...p} color={theme.colors.error} icon="delete-sweep-outline" />}
            onPress={() => setConfirmClear(true)}
          />
          <List.Item
            title="Uprawnienia systemowe"
            description="Otwórz ustawienia aplikacji w systemie"
            left={(p) => <List.Icon {...p} icon="shield-key-outline" />}
            onPress={openAppSettings}
          />
        </Section>

        <Section title="Sieć (diagnostyka)">
          <View style={[styles.padded, styles.diag]}>
            <Row label="Bluetooth" value={radio.bluetooth} />
            <Row label="Tryb Peripheral" value={radio.peripheralSupported ? 'obsługiwany' : 'nieobsługiwany'} />
            <Row label="Rozgłaszanie" value={radio.advertising ? 'aktywne' : 'nieaktywne'} />
            <Row label="Pakiety odebrane" value={String(stats?.received ?? 0)} />
            <Row label="Pakiety przekazane (relay)" value={String(stats?.relayed ?? 0)} />
            <Row label="Duplikaty odrzucone" value={String(stats?.duplicates ?? 0)} />
            <Row label="Odrzucone (limit/błąd)" value={String(stats?.dropped ?? 0)} />
            <Row label="Sfałszowane pakiety" value={String(stats?.forged ?? 0)} />
            <Row
              label="Śr. czas weryfikacji podpisu"
              value={stats?.verified ? `${(stats.verifyMs / stats.verified).toFixed(1)} ms` : '–'}
            />
          </View>
        </Section>

        <Section title="O aplikacji">
          <View style={[styles.padded, styles.about]}>
            <Text variant="titleMedium">Mesh Chat {Constants.expoConfig?.version ?? ''}</Text>
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
              Czat peer-to-peer przez Bluetooth Low Energy, bez internetu. Każdy telefon jest jednocześnie klientem
              (Central) i serwerem (Peripheral), a wiadomości są przekazywane przez sąsiednie urządzenia
              (flooding z TTL i deduplikacją oraz trasowanie wsteczne z ogłoszeń).
            </Text>
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
              Protokół mesh v{PROTOCOL_VERSION} · rozmowy są szyfrowane end-to-end, każdy pakiet jest podpisany.
            </Text>
          </View>
        </Section>
      </ScrollView>

      <Portal>
        <Dialog visible={editNick} onDismiss={() => setEditNick(false)}>
          <Dialog.Title>Zmień nick</Dialog.Title>
          <Dialog.Content>
            <TextInput mode="outlined" outlineStyle={{ borderRadius: radius.md }} value={draft} onChangeText={setDraft} maxLength={NICK_MAX} autoFocus />
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
        <Dialog visible={confirmRemoveCert} onDismiss={() => setConfirmRemoveCert(false)}>
          <Dialog.Title>Usunąć certyfikat?</Dialog.Title>
          <Dialog.Content>
            <Text>
              To urządzenie przestanie być kontem urzędowym i nie będzie mogło nadawać alertów. Żeby to cofnąć,
              trzeba ponownie wczytać certyfikat od operatora.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setConfirmRemoveCert(false)}>Anuluj</Button>
            <Button
              textColor={theme.colors.error}
              onPress={() => {
                MeshService.removeCert();
                setConfirmRemoveCert(false);
              }}
            >
              Usuń
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

/** Section heading + one white card holding its rows. */
function Section({ title, children }: { title: string; children: ReactNode }) {
  const theme = useTheme();
  return (
    <View style={styles.section}>
      <Text variant="titleLarge">{title}</Text>
      <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>{children}</View>
    </View>
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
  screen: { flex: 1 },
  content: { paddingHorizontal: 16, paddingBottom: 32 },
  section: { marginTop: 24, gap: 12 },
  card: { borderRadius: radius.lg, elevation: 1, overflow: 'hidden' },
  padded: { padding: 16 },
  diag: { gap: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  about: { gap: 8 },
});
