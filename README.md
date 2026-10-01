# Mesh Chat – czat Bluetooth mesh bez internetu (Android)

Zdecentralizowany czat peer-to-peer. Każdy telefon jest węzłem sieci **Bluetooth Low Energy mesh**:
jednocześnie **Central** (skanuje i łączy się) i **Peripheral** (rozgłasza się i przyjmuje połączenia).
Wiadomości są przekazywane przez pośrednie telefony (multi-hop), więc docierają też do osób poza
bezpośrednim zasięgiem Bluetooth.

- React Native 0.86 + Expo SDK 57 (CNG / prebuild, własny moduł natywny w Kotlinie), TypeScript
- `react-native-ble-plx`: rola Central
- `modules/mesh-peripheral`: lokalny moduł Expo (Kotlin), rola Peripheral (GATT server + advertising) i foreground service
- Zustand (stan), expo-sqlite (historia wiadomości, klucz-wartość), React Native Paper (UI, Material 3), Expo Router

---

## Budowanie

Wymagania: Node 20+, JDK 17+, Android SDK (API 36) i **fizyczne urządzenia** z Androidem 8.0+ (API 26).
Emulator nie ma Bluetooth, a do testu meshu potrzebne są co najmniej 2–3 telefony.

```bash
npm install --legacy-peer-deps      # react-dom jest opcjonalnym peerem expo; flaga omija konflikt npm
npx expo prebuild --platform android --clean
npx expo run:android                # debug build + instalacja na podłączonym urządzeniu
npm start                           # dev server (dev client) przy kolejnych uruchomieniach
```

Release APK: `npx expo run:android --variant release` albo EAS: `npx eas-cli@latest build -p android`.

> Katalog `android/` jest generowany (Continuous Native Generation). Nie edytuj go ręcznie:
> konfiguracja jest w `app.json`, a kod natywny w `modules/mesh-peripheral`.
> Aplikacja **nie działa w Expo Go**, bo zawiera własny kod natywny.

Kontrola jakości: `npm run typecheck`, `npm run lint`, `npx expo-doctor`.

---

## Uprawnienia

Przy pierwszym uruchomieniu aplikacja od razu pokazuje **systemowe dialogi Androida**. Nie da się
przejść dalej, dopóki wymagane uprawnienia nie zostaną nadane (guardy w `src/app/_layout.tsx`).
Po nadaniu pojawia się toast z potwierdzeniem. Jeśli użytkownik wybierze „Nie pytaj ponownie”,
ekran wyjaśnia sytuację i otwiera ustawienia systemowe aplikacji. Po powrocie uprawnienia są
sprawdzane ponownie automatycznie.

| Uprawnienie | Typ | Android | Po co |
|---|---|---|---|
| `BLUETOOTH_SCAN` | runtime | 12+ | wyszukiwanie węzłów |
| `BLUETOOTH_CONNECT` | runtime | 12+ | połączenia GATT (obie role) |
| `BLUETOOTH_ADVERTISE` | runtime | 12+ | rozgłaszanie własnego węzła |
| `ACCESS_FINE_LOCATION` / `ACCESS_COARSE_LOCATION` | runtime | wszystkie | wyniki skanu BLE (wymóg systemu, GPS nie jest używany) |
| `POST_NOTIFICATIONS` | runtime | 13+ | powiadomienie usługi działającej w tle |
| `BLUETOOTH`, `BLUETOOTH_ADMIN` | przy instalacji | ≤ 11 | Bluetooth na starszych systemach (`maxSdkVersion=30`) |
| `FOREGROUND_SERVICE` | przy instalacji | wszystkie | usługa w tle |
| `FOREGROUND_SERVICE_CONNECTED_DEVICE` | przy instalacji | 14+ | typ usługi `connectedDevice` |

Uprawnienia „przy instalacji” to *normal permissions*. System nadaje je automatycznie
i nie ma dla nich dialogu, więc ekran uprawnień pokazuje je tylko informacyjnie. Deklaracje są
w `modules/mesh-peripheral/android/src/main/AndroidManifest.xml` i w `app.json`.

---

## Architektura

```
src/
  app/                    Expo Router: trasy i guardy (cienkie pliki re-eksportujące ekrany)
  screens/                Permissions, Onboarding, Conversations, Network, Chat, NewGroup, Settings
  components/             NetworkStatusBar, MessageBubble, MessageInput, SignalBars, Avatar…
  hooks/                  useMeshLifecycle, useNetworkStatus
  store/                  Zustand: identity, permissions, mesh, chat (+ typy domenowe)
  services/
    ble/                  LinkManager (fizyczne łącza), PeripheralRole, fragmenter, stałe
    mesh/                 packet (format ramki), MeshRouter (routing), SeenCache, MeshService (czat)
    permissions/          dialogi systemowe, „nie pytaj ponownie”, ustawienia
    storage/              SQLite (migracje, repozytorium czatu), kv-store (tożsamość)
  utils/                  base64/UTF-8/UUID, token bucket, emitter, logger
modules/mesh-peripheral/  Kotlin: MeshGattServer, MeshForegroundService, MeshPeripheralModule
```

Warstwy (od dołu):

```
┌──────────────────────────────────────────────────────────────┐
│ UI (Paper)  ←→  Zustand stores                               │
├──────────────────────────────────────────────────────────────┤
│ MeshService   czat: ACK, retry, statusy, grupy, SQLite       │
├──────────────────────────────────────────────────────────────┤
│ MeshRouter    flooding + dedup + TTL + trasy + rate limit    │
├──────────────────────────────────────────────────────────────┤
│ LinkManager   linki BLE, fragmentacja, duty-cycle, reconnect │
├───────────────────────────────┬──────────────────────────────┤
│ ble-plx (Central)             │ MeshPeripheral (Kotlin)      │
│ skan, connect, write, notify↓ │ GATT server, adv, FGS        │
└───────────────────────────────┴──────────────────────────────┘
```

### Dlaczego własny moduł natywny?

`react-native-ble-plx` obsługuje tylko rolę **Central**. Prawdziwy mesh wymaga, żeby każdy telefon
dał się też znaleźć i do niego podłączyć (**Peripheral**). Dostępne biblioteki peripheral dla RN są
porzucone albo nie obsługują GATT servera z notyfikacjami, dlatego `modules/mesh-peripheral`
implementuje:

- **GATT service** `7a3f0001-…` z dwiema charakterystykami:
  - `RX` (write): centrale zapisują do nas ramki,
  - `TX` (notify): wysyłamy ramki do subskrybujących central (kolejka per urządzenie, bo Android
    pozwala na jedną notyfikację naraz; czeka na `onNotificationSent` albo timeout),
- **advertising**: UUID usługi + manufacturer data `0xFFFF` z 4-bajtowym skrótem ID węzła (31 B limit),
- **foreground service** typu `connectedDevice`, który trzyma proces (JS + BLE) przy życiu w tle,
- prośbę o włączenie Bluetooth (systemowy dialog).

---

## Jak działa mesh

### 1. Łącza (LinkManager)

- Każdy węzeł **rozgłasza się i skanuje** jednocześnie (dual role).
- **Tie-break**: z pary A–B łączy się tylko węzeł o mniejszym skrócie ID, więc powstaje jedno
  łącze zamiast dwóch. Jeśli drugi węzeł nie połączy się w ciągu 20 s (np. nie umie być Peripheral),
  łączymy się sami. Ewentualne duplikaty są usuwane po handshake'u HELLO według tej samej
  deterministycznej reguły po obu stronach.
- Limit: 4 łącza wychodzące i 7 łącznie (limit stosu BLE Androida). W tłumie powstaje więc
  częściowa siatka, a zasięg zapewnia relaying.
- **Fragmentacja**: pakiet dzielony jest na ramki `[streamId][index][count][dane]` dopasowane do MTU
  (wynegocjowane 517 B, domyślnie 23 B) i składany po drugiej stronie.
- **Reconnect**: po rozłączeniu węzeł wraca do kandydatów, a kolejne próby mają wykładniczy
  backoff (2 s → 60 s).

### 2. Routing (MeshRouter): *controlled flooding + reverse-path routes*

Format pakietu (nagłówek 59 B, big-endian):

```
version | type | ttl | hops | flags | packetId(8) | origin(16) | destination(16) | seq(4) | timestamp(8) | len(2) | payload(JSON)
```

Relay przetwarza pakiet tak:

1. **Rate limit per łącze** (token bucket 60/25 s⁻¹), sprawdzany przed parsowaniem.
2. **Deduplikacja** po `packetId` (LRU 4096 wpisów, 10 min). Każdy węzeł przekazuje dany pakiet
   najwyżej raz, więc pętle są niemożliwe nawet przy cyklach w topologii.
3. **Rate limit per nadawca** (czat/ACK 15 szt. + 1/s, ANNOUNCE 2 szt. + 0,2/s). Nadmiar nie jest
   ani doręczany, ani przekazywany dalej, więc jeden spamer nie zaleje sieci.
4. **Uczenie tras**: pakiet od X przyszedł łączem L po `hops` skokach, więc zapisujemy trasę
   „X przez L, koszt hops+1”, jeśli jest lepsza, świeższa albo stara wygasła.
   **Numery sekwencyjne** (`seq`, rosnące per nadawca) odrzucają stare ANNOUNCE.
5. Doręczenie lokalne, jeśli `destination` to my albo broadcast.
6. **Relay**, jeśli `ttl > 1`: TTL maleje, `hops` rośnie.
   - broadcast idzie do wszystkich łączy poza źródłowym, z losowym opóźnieniem 15–90 ms
     przeciw kolizjom (broadcast storm),
   - pakiet kierowany idzie do sąsiada docelowego, jeśli jest bezpośrednio połączony; w przeciwnym
     razie do next-hop z tablicy tras, a bez znanej trasy (albo z flagą `ForceFlood`) floodem.

Typy pakietów:

| Typ | TTL | Opis |
|---|---|---|
| `HELLO` | 1 | handshake na nowym łączu (nick + ID), nigdy nie jest przekazywany |
| `ANNOUNCE` | 5 | co 30 s (w tle co 60 s) i po każdym nowym łączu; buduje tablicę tras i listę węzłów |
| `CHAT` | 7 | wiadomość: 1:1 = kierowana, grupa = broadcast z ID grupy |
| `ACK` | 7 | potwierdzenie doręczenia, kierowane do autora |

### 3. Czat (MeshService)

- Wiadomość ma **UUID** (klucz idempotencji), **ID nadawcy** i **timestamp**. `INSERT OR IGNORE`
  w SQLite eliminuje duplikaty, nawet gdy ta sama wiadomość przyjdzie kilkoma ścieżkami.
- Statusy: `sending` (wysyłanie), **wysłana** (przekazana ≥1 sąsiadowi), **dostarczona**
  (przyszedł ACK), **nieudana**.
  - 1:1: bez ACK następują ponowienia po 4, 10 i 20 s z `ForceFlood` (trasa mogła się zdezaktualizować),
    a potem status „nieudana”. Dotknięcie dymka ponawia wysyłkę.
  - Grupa: każdy odbiorca odsyła ACK, a UI pokazuje liczbę potwierdzeń.
- Odbiorca **zawsze** odsyła ACK, także na duplikat (poprzedni ACK mógł zaginąć).
- **Grupy** to kanały broadcast. `#ogólny` istnieje zawsze, a nowe grupy dostają UUID. Kto odbierze
  wiadomość grupy, automatycznie ją zobaczy.
- **Anty-spam po stronie nadawcy**: 5 wiadomości od razu, potem 1/s. Treść ma max 500 znaków,
  a nick max 24 znaki (oczyszczany z niedozwolonych znaków).

### 4. Bateria i praca w tle

| Profil | Skan | Pauza | Tryb skanu | Advertising |
|---|---|---|---|---|
| brak łączy (szukanie) | 8 s | 4 s | LowLatency | Balanced |
| połączony, na ekranie | 6 s | 14 s | Balanced | Balanced |
| w tle | 5 s | 40 s | LowPower | LowPower |

- Skanowanie tylko z filtrem UUID usługi (działa też przy wyłączonym ekranie).
- Android ogranicza start skanu do 5 razy na 30 s; cykle są dłuższe, więc limit nie jest przekraczany.
- Foreground service (stałe powiadomienie „Połączenia: X · węzły w sieci: Y”) utrzymuje połączenia
  po zminimalizowaniu aplikacji.

---

## Ograniczenia i dalszy rozwój

- **Brak szyfrowania end-to-end i podpisów**: każdy węzeł po drodze widzi treść, a ID nadawcy
  można podrobić. Następny krok to klucze Ed25519/X25519 w ANNOUNCE i szyfrowanie DM (np. Noise).
- Brak store-and-forward dla odbiorców offline dłużej niż okno ponowień (~35 s).
- Po ubiciu procesu przez system (np. agresywne oszczędzanie baterii producenta) mesh się zatrzymuje.
  Warto wyłączyć optymalizację baterii dla aplikacji.
- iOS nie jest wspierany (projekt Android-only; moduł natywny ma tylko implementację Kotlin).
