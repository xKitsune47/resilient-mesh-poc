App created for HackYeah's 2026 "Defence" category. 99% vibecoded, the functionalities (as we've tested with a few Android devices) work as intended. Bluetooth communication range measured was ~150 meters (with Bluetooth 4.2 bottleneck, I suspect it could be more but we were limited by space available and time left to submit the project).

<a id="polski"></a>

# Mesh Chat – czat Bluetooth mesh bez internetu (Android)

**Polski** · [English](#english)

Zdecentralizowany czat peer-to-peer. Każdy telefon jest węzłem sieci **Bluetooth Low Energy mesh**:
jednocześnie **Central** (skanuje i łączy się) i **Peripheral** (rozgłasza się i przyjmuje połączenia).
Wiadomości są przekazywane przez pośrednie telefony (multi-hop), więc docierają też do osób poza
bezpośrednim zasięgiem Bluetooth.

- React Native 0.86 + Expo SDK 57 (CNG / prebuild, własny moduł natywny w Kotlinie), TypeScript
- `react-native-ble-plx`: rola Central
- `modules/mesh-peripheral`: lokalny moduł Expo (Kotlin), rola Peripheral (GATT server + advertising) i foreground service
- Zustand (stan), expo-sqlite z SQLCipher (zaszyfrowana historia), expo-secure-store (klucze), React Native Paper (UI, Material 3), Expo Router
- `tweetnacl`: podpisy Ed25519 każdego pakietu i szyfrowanie end-to-end (X25519 + XSalsa20-Poly1305)

Aplikacja ma dwa rodzaje ruchu: **rozmowy 1:1 szyfrowane end-to-end** oraz **alerty kont urzędowych** –
publiczne, podpisane komunikaty, które może nadać tylko urządzenie z certyfikatem. Grup nie ma: zwykły
użytkownik nie może rozgłaszać treści do całej sieci. Model bezpieczeństwa opisuje sekcja
[Bezpieczeństwo](#bezpieczeństwo).

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

Kontrola jakości: `npm run typecheck`, `npm run lint`, `npm test`, `npx expo-doctor`.

`npm test` (Jest) sprawdza warstwę protokołu bez telefonu: podpisy pakietów, szyfrowanie, certyfikaty,
handshake, reguły alertów, router na symulowanych łączach (fałszerstwa, powtórzenia, rozchodzenie
alertów) oraz kilka kompletnych węzłów naraz (wiadomość przez przekaźnik, wzajemna weryfikacja jednym
skanem i próby jej nadużycia, alert i wiadomość konta urzędowego). Radia BLE, magazynu kluczy i szyfrowania bazy nie da się sprawdzić inaczej niż na urządzeniach.

> Po zmianie wtyczek w `app.json` (SQLCipher, aparat, SecureStore) potrzebny jest nowy `prebuild`
> i nowy build – sam dev server nie wystarczy.

---

## Uprawnienia

Przy pierwszym uruchomieniu aplikacja od razu pokazuje **systemowe dialogi Androida**. Nie da się
przejść dalej, dopóki wymagane uprawnienia nie zostaną nadane (guardy w `src/app/_layout.tsx`).
Po nadaniu pojawia się toast z potwierdzeniem. Jeśli użytkownik wybierze „Nie pytaj ponownie”,
ekran wyjaśnia sytuację i otwiera ustawienia systemowe aplikacji. Po powrocie uprawnienia są
sprawdzane ponownie automatycznie.

| Uprawnienie                                       | Typ             | Android   | Po co                                                  |
| ------------------------------------------------- | --------------- | --------- | ------------------------------------------------------ |
| `BLUETOOTH_SCAN`                                  | runtime         | 12+       | wyszukiwanie węzłów                                    |
| `BLUETOOTH_CONNECT`                               | runtime         | 12+       | połączenia GATT (obie role)                            |
| `BLUETOOTH_ADVERTISE`                             | runtime         | 12+       | rozgłaszanie własnego węzła                            |
| `ACCESS_FINE_LOCATION` / `ACCESS_COARSE_LOCATION` | runtime         | wszystkie | wyniki skanu BLE (wymóg systemu, GPS nie jest używany) |
| `POST_NOTIFICATIONS`                              | runtime         | 13+       | powiadomienie usługi działającej w tle                 |
| `BLUETOOTH`, `BLUETOOTH_ADMIN`                    | przy instalacji | ≤ 11      | Bluetooth na starszych systemach (`maxSdkVersion=30`)  |
| `FOREGROUND_SERVICE`                              | przy instalacji | wszystkie | usługa w tle                                           |
| `FOREGROUND_SERVICE_CONNECTED_DEVICE`             | przy instalacji | 14+       | typ usługi `connectedDevice`                           |

Uprawnienia „przy instalacji” to _normal permissions_. System nadaje je automatycznie
i nie ma dla nich dialogu, więc ekran uprawnień pokazuje je tylko informacyjnie. Deklaracje są
w `modules/mesh-peripheral/android/src/main/AndroidManifest.xml` i w `app.json`.

---

## Architektura

```
src/
  app/                    Expo Router: trasy i guardy (cienkie pliki re-eksportujące ekrany)
  screens/                Permissions, Onboarding, Conversations, Network, Chat, Settings,
                          Alerts, ComposeAlert, Security, MyKey, VerifyContact, InstallCert, Recovery
  components/             AlertBanner, TrustBadge, QrScanner, NetworkStatusBar, MessageBubble…
  hooks/                  useMeshLifecycle, useNetworkStatus
  store/                  Zustand: identity, contacts, alerts, permissions, mesh, chat (+ typy domenowe)
  services/
    ble/                  LinkManager (fizyczne łącza), PeripheralRole, fragmenter, stałe
    crypto/               keys + identity (klucze urządzenia), box + e2e (szyfrowanie 1:1),
                          cert + authorities + trustAnchors (certyfikaty kont urzędowych)
    mesh/                 packet (format i podpis), handshake (HELLO), MeshRouter (routing),
                          alertPolicy (reguły alertów), SeenCache, MeshService (czat i alerty)
    permissions/          dialogi systemowe, „nie pytaj ponownie”, ustawienia
    security/             blokada ekranu i potwierdzenie biometrią
    storage/              SQLCipher (migracje, repozytoria czatu, kontaktów, alertów), kv-store (flagi)
  utils/                  base64/UTF-8/UUID, losowość, nicki, token bucket, emitter, logger
modules/mesh-peripheral/  Kotlin: MeshGattServer, MeshForegroundService, MeshPeripheralModule
scripts/authority-ca.js   offline'owe narzędzie wydające certyfikaty kont urzędowych
__tests__/                testy protokołu (Jest)
```

Warstwy (od dołu):

```
┌──────────────────────────────────────────────────────────────┐
│ UI (Paper)  ←→  Zustand stores                               │
├──────────────────────────────────────────────────────────────┤
│ MeshService   czat 1:1 (E2E, ACK, retry), alerty, SQLCipher  │
├──────────────────────────────────────────────────────────────┤
│ MeshRouter    podpisy + flooding + dedup + TTL + trasy       │
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
- **Handshake z wyzwaniem**: po zestawieniu łącza obie strony wymieniają podpisane `HELLO` z losowym
  wyzwaniem; łącze zostaje przypisane do węzła dopiero, gdy ten odeśle `HELLO` z echem naszego wyzwania,
  zaadresowane do nas. Nagranego `HELLO` nie da się więc odtworzyć na innym łączu. Do tego momentu
  łączem płynie wyłącznie `HELLO`; brak odpowiedzi w 15 s zamyka łącze. Rozgłoszenie BLE niesie numer
  wersji protokołu – węzły w innej wersji są ignorowane.
- Limit: 4 łącza wychodzące i 7 łącznie (limit stosu BLE Androida). W tłumie powstaje więc
  częściowa siatka, a zasięg zapewnia relaying.
- **Fragmentacja**: pakiet dzielony jest na ramki `[streamId][index][count][dane]` dopasowane do MTU
  (wynegocjowane 517 B, domyślnie 23 B) i składany po drugiej stronie. Ramka ma najwyżej 512 B
  niezależnie od MTU – tyle wynosi limit wartości atrybutu GATT, a Android 13+ odrzuca dłuższe.
- **Reconnect**: po rozłączeniu węzeł wraca do kandydatów, a kolejne próby mają wykładniczy
  backoff (2 s → 60 s).

### 2. Routing (MeshRouter): _controlled flooding + reverse-path routes_

Format pakietu v2 (nagłówek 59 B, big-endian, na końcu klucz i podpis autora):

```
version | type | ttl | hops | flags | packetId(8) | origin(16) | destination(16) | seq(4) | timestamp(8) | len(2) | payload(JSON) | signPk(32) | sig(64)
```

`origin` to skrót klucza `signPk`, a `sig` to podpis Ed25519 nad nagłówkiem (bez `ttl`/`hops` – tylko
te dwa bajty wolno zmienić przekaźnikowi) i payloadem. Każdy węzeł może więc sam sprawdzić każdy pakiet.

Relay przetwarza pakiet tak:

1. **Rate limit per łącze** (token bucket 60/25 s⁻¹), sprawdzany przed parsowaniem.
2. **Deduplikacja** po `origin + packetId` (LRU 16 384 wpisy, 25 min). Każdy węzeł przekazuje dany pakiet
   najwyżej raz, więc pętle są niemożliwe nawet przy cyklach w topologii.
3. **Tanie testy przed kryptografią**: łącze uwierzytelnione, `ttl + hops` w granicach typu, dozwolony
   adresat (rozgłaszać wolno tylko `ANNOUNCE` i `ALERT`), czas pakietu w oknie ±10 min, `ANNOUNCE` nie
   starszy niż ostatnio widziany, alert nowszy niż zapisany.
4. **Podpis**: klucz musi dawać `origin`, a podpis musi się zgadzać. Dopiero wtedy pakiet trafia do
   pamięci widzianych. Sfałszowany pakiet może pochodzić tylko od sąsiada, który go przysłał (uczciwy
   przekaźnik by go nie przepuścił), więc po 3 takich łącze jest zamykane na minutę.
5. **Rate limit per nadawca** (czat/ACK 15 szt. + 1/s, ANNOUNCE 2 szt. + 0,2/s, alerty osobno). Nadmiar
   nie jest ani doręczany, ani przekazywany dalej. Limit liczony jest po uwierzytelnionym nadawcy.
6. **Uczenie tras**: pakiet od X przyszedł łączem L po `hops` skokach, więc zapisujemy trasę
   „X przez L, koszt hops+1”, jeśli jest lepsza, świeższa albo stara wygasła.
7. Doręczenie lokalne, jeśli `destination` to my.
8. **Relay**, jeśli `ttl > 1`: TTL maleje, `hops` rośnie.
   - `ANNOUNCE` idzie do wszystkich łączy poza źródłowym, z losowym opóźnieniem 15–90 ms
     przeciw kolizjom (broadcast storm),
   - pakiet kierowany idzie do sąsiada docelowego, jeśli jest bezpośrednio połączony; w przeciwnym
     razie do next-hop z tablicy tras, a bez znanej trasy albo z flagą `ForceFlood` floodem
     (ponowienie zalewa także wtedy, gdy adresat wygląda na sąsiada).

Typy pakietów:

| Typ        | TTL | Opis                                                                                                                                                    |
| ---------- | --- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `HELLO`    | 1   | handshake z wyzwaniem na nowym łączu, nigdy nie jest przekazywany                                                                                       |
| `ANNOUNCE` | 5   | co 30 s (w tle co 60 s) i po każdym nowym łączu; buduje tablicę tras i listę węzłów; konto urzędowe dołącza certyfikat po nowym łączu i do co czwartego |
| `CHAT`     | 7   | wiadomość 1:1, kierowana, szyfrowana end-to-end                                                                                                         |
| `ACK`      | 7   | potwierdzenie doręczenia, kierowane do autora, szyfrowane                                                                                               |
| `ALERT`    | 1   | komunikat konta urzędowego; rozchodzi się „od magazynu do magazynu” (patrz niżej)                                                                       |

### 3. Czat (MeshService)

- Wiadomość ma **UUID** (klucz idempotencji), **ID nadawcy** i **timestamp**. `INSERT OR IGNORE`
  w SQLite eliminuje duplikaty, nawet gdy ta sama wiadomość przyjdzie kilkoma ścieżkami.
- Statusy: `sending` (wysyłanie), **wysłana** (przekazana ≥1 sąsiadowi), **czeka** (na zasięg odbiorcy),
  **dostarczona** (przyszedł ACK), **nieudana**.
  Bez ACK następują ponowienia po 4, 10 i 20 s z `ForceFlood` (trasa mogła się zdezaktualizować).
  Potem wiadomość **czeka na telefonie nadawcy do 24 h** – także po restarcie aplikacji – i wychodzi sama,
  gdy odbiorca pojawi się na liście węzłów (oraz co 60 s, dopóki na niej jest); spóźniony ACK nadal się
  liczy. Wysłana z opóźnieniem niesie w szyfrogramie czas napisania. Po 24 h status „nieudana”; dotknięcie
  takiego dymka ponawia wysyłkę.
- Odbiorca **zawsze** odsyła ACK, także na duplikat (poprzedni ACK mógł zaginąć). ACK jest szyfrowany
  tak jak wiadomość i liczy się tylko wtedy, gdy przyszedł od rozmówcy.
- **Każda rozmowa jest szyfrowana end-to-end** (NaCl box: X25519 + XSalsa20-Poly1305,
  `services/crypto/box.ts`). Węzły pośrednie widzą tylko nagłówek pakietu (nadawca, odbiorca, czas),
  bez treści i nicku. Jawny tekst zawiera pola `from` i `to`, sprawdzane z podpisanym nagłówkiem –
  bez tego przekaźnik mógłby przypisać sobie cudzy szyfrogram.
- **Anty-spam po stronie nadawcy**: 5 wiadomości od razu, potem 1/s. Treść ma max 500 znaków,
  a nick max 24 znaki (oczyszczany ze znaków sterujących, niewidocznych i zmieniających kierunek tekstu).

### 4. Alerty kont urzędowych

- Alert to publiczny, podpisany komunikat (nagłówek, treść, termin ważności do 72 h) z dołączonym
  certyfikatem nadawcy. Aplikacja pokazuje aktywne alerty na **przypiętym pasku u góry każdego ekranu**;
  paska nie da się zamknąć, tylko zwinąć do jednej linii.
- **Rozchodzenie**: alert zawsze leci tylko do sąsiada. Węzeł zapisuje go i podaje dalej wyłącznie wtedy,
  gdy był dla niego nowością. To obsługuje pierwszy zalew sieci, **spóźnionych** (przy zestawieniu łącza
  węzły porównują skróty swoich zbiorów alertów i dosyłają różnicę) oraz łączenie się rozdzielonych wysp.
- Jeden rekord na `(nadawca, id)`: wygrywa nowszy podpisany czas, przy remisie odwołanie. Odwołanie
  zostaje w pamięci do terminu ważności alertu, więc stary pakiet nie „wskrzesi” odwołanego komunikatu.
- Najwyżej 5 alertów na urząd (zawsze najnowsze); jeden urząd nie może wypchnąć alertów innego.
- Przekaźnik nie odrzuca alertu z powodu własnego zegara (chyba że wygasł ponad dobę temu) – o tym,
  czy alert jest wyświetlany, decyduje ścisła reguła po stronie odbiorcy.
- Wiadomości 1:1 od konta urzędowego są oznaczane „PILNE · nazwa urzędu”, a rozmowa z urzędem jest
  przypięta na górze listy.

### 5. Bateria i praca w tle

| Profil                | Skan | Pauza | Tryb skanu | Advertising |
| --------------------- | ---- | ----- | ---------- | ----------- |
| brak łączy (szukanie) | 8 s  | 2 s   | LowLatency | Balanced    |
| połączony, na ekranie | 6 s  | 4 s   | Balanced   | Balanced    |
| w tle                 | 5 s  | 40 s  | LowPower   | LowPower    |

- Skanowanie tylko z filtrem UUID usługi (działa też przy wyłączonym ekranie).
- Android ogranicza start skanu do 5 razy na 30 s; cykle są dłuższe, więc limit nie jest przekraczany.
- Foreground service (stałe powiadomienie „Połączenia: X · węzły w sieci: Y”) utrzymuje połączenia
  po zminimalizowaniu aplikacji.

---

## Bezpieczeństwo

Aplikacja pokazuje użytkownikowi ten sam obraz, co poniżej: Ustawienia → Bezpieczeństwo wylicza stan
zabezpieczeń **z faktycznego stanu urządzenia** (czy baza jest zaszyfrowana, czy jest blokada ekranu,
czy zegar zgadza się z sąsiadami, ile kontaktów zweryfikowano) i listę tego, czego aplikacja nie chroni.

### Przed kim chronimy

| Przeciwnik                   | Co potrafi                                                        |
| ---------------------------- | ----------------------------------------------------------------- |
| Podsłuchujący w eterze       | odbiera ruch BLE, nic nie wysyła                                  |
| Złośliwy węzeł / przekaźnik  | zmodyfikowana aplikacja w sieci: fałszuje, powtarza, gubi, zalewa |
| Podszywający się pod urząd   | chce wyświetlić ludziom fałszywy „pilny komunikat”                |
| Znalazca / złodziej telefonu | ma urządzenie w ręku                                              |

Poza modelem: zagłuszanie radiowe, przejęty system Android (root, malware), przymus wobec użytkownika.

### Zagrożenia i zabezpieczenia

| Zagrożenie                                          | Zabezpieczenie                                                                                                                                |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Odczyt treści rozmowy przez przekaźnik lub podsłuch | NaCl box; przekaźnik widzi tylko nagłówek                                                                                                     |
| Podszycie pod innego użytkownika                    | ID węzła = skrót klucza podpisującego; każdy pakiet podpisany Ed25519 i sprawdzany na każdym skoku                                            |
| Podmiana klucza szyfrującego ofiary                 | klucz szyfrujący przyjmowany tylko z pakietu podpisanego przez tę tożsamość                                                                   |
| Przypisanie sobie cudzego szyfrogramu               | pola `from`/`to` wewnątrz szyfrogramu, porównywane z podpisanym nagłówkiem                                                                    |
| Zmiana nagłówka (czas, adresat) w drodze            | podpis obejmuje cały nagłówek poza `ttl`/`hops`                                                                                               |
| Powtórzenie nagranego pakietu                       | podpisany `packetId`, pamięć widzianych, okno czasu ±10 min, trwała deduplikacja po ID wiadomości                                             |
| Przejęcie łącza powtórzonym `HELLO`                 | handshake z wyzwaniem; odpowiedź adresowana do pytającego                                                                                     |
| Fałszywe potwierdzenia doręczenia                   | ACK podpisany, szyfrowany, przyjmowany tylko od rozmówcy                                                                                      |
| Zalew sieci treścią                                 | rozgłaszać mogą tylko konta z certyfikatem; limity po uwierzytelnionym nadawcy; łącze zamykane po 3 fałszerstwach                             |
| Fałszywy „urząd”                                    | status urzędowy wyłącznie z certyfikatu podpisanego kluczem głównym; nazwa urzędu z certyfikatu, nigdy z nicku                                |
| Mylące nicki                                        | trzy różne oznaczenia (konto urzędowe / klucz zweryfikowany / niezweryfikowany), ostrzeżenie przy nazwie zbieżnej ze zweryfikowanym kontaktem |
| Podstawiony rozmówca przy pierwszym kontakcie       | weryfikacja klucza kodem QR lub porównaniem odcisku na głos                                                                                   |
| Podglądacz przy weryfikacji (zdjęcie kodu z ekranu) | jednorazowy kod przypisany do jednej rozmowy; ten sam kod z drugiego urządzenia = ostrzeżenie i cofnięcie                                     |
| Odczyt danych z przejętego telefonu                 | ziarno kluczy i klucz bazy w SecureStore (szyfrowane kluczem z Android Keystore), baza SQLCipher, backup Androida wyłączony                   |
| Nadanie alertu z cudzego, odblokowanego telefonu    | biometria lub kod blokady przed każdym alertem; certyfikat instaluje się tylko na telefonie z blokadą ekranu                                  |

### Tożsamość i weryfikacja kluczy

- Urządzenie ma jedno 32-bajtowe ziarno. Z niego powstaje para Ed25519 (podpisy) i para X25519
  (szyfrowanie). ID węzła to pierwsze 16 bajtów SHA-512 klucza podpisującego.
- **Odcisk klucza** to pełne 128 bitów ID w 8 grupach po 4 znaki (Ustawienia → Mój klucz, razem z kodem QR).
- W czacie ikona tarczy otwiera weryfikację. **Wystarczy jeden skan, żeby zweryfikowali się oboje:**
  jedna osoba wybiera „Pokaż mój kod”, druga skanuje.
  - Skanujący ufa pokazującemu, bo zeskanowany klucz daje ID tej rozmowy.
  - Pokazujący ufa skanującemu, bo kod zawiera jednorazowy token, a telefon skanującego odsyła go
    zaszyfrowany. Token jest **przypisany do rozmowy, z której otwarto kod** – przyjmowany jest tylko
    od tego jednego węzła, żyje 2 minuty, tylko w pamięci, i znika po wyjściu z aplikacji.
  - Ten sam token od innego urządzenia oznacza, że ktoś podejrzał ekran albo rozmowa nie jest z osobą,
    która stoi obok. Wtedy **ten kod nie weryfikuje nikogo na telefonie pokazującego**: to, co nadał
    w ostatniej minucie, jest cofane (wcześniejsza, własna weryfikacja kontaktu zostaje), a na ekranie
    weryfikacji tej rozmowy pojawia się ostrzeżenie z odciskiem obcego urządzenia. Skanujący zachowuje
    to, co sam sprawdził aparatem.
  - Żeby osoba stojąca obok zawsze zdążyła wywołać to ostrzeżenie, kod zostaje na ekranie jeszcze
    przez chwilę po przyjęciu, a telefon skanujący wysyła dowód także wtedy, gdy klucz **nie** pasuje
    do jego rozmowy (czyli gdy ktoś siedzi pośrodku). Wyścig z podglądaczem kończy się więc
    ostrzeżeniem i powtórką, a nie fałszywą plakietką. Ceną jest to, że podglądacz może w ciągu minuty
    unieważnić cudzą weryfikację tym kodem – wtedy obie osoby skanują ponownie.
  - Kod z ekranu Ustawienia → Mój klucz to sam klucz publiczny (bez tokenu): jego skan weryfikuje
    tylko jedną stronę. Tak samo porównanie odcisków na głos.
  - Weryfikację można cofnąć na ekranie weryfikacji; cofnięcie jest ostateczne (spóźniony dowód ani
    spóźniony konflikt już niczego nie zmienią).
- Utrata kluczy (np. przeniesienie aplikacji na inny telefon) nigdy nie kończy się cichym
  wygenerowaniem nowej tożsamości – aplikacja pokazuje ekran odzyskiwania i czeka na decyzję użytkownika.
  To samo dotyczy klucza bazy danych.

### Konta urzędowe – jak powstają i dlaczego nie da się pod nie podszyć

1. **Klucz główny (root)** powstaje raz, na komputerze bez sieci: `node scripts/authority-ca.js init`.
   Sekret jest szyfrowany hasłem (scrypt + secretbox) i zapisywany w `ca/root.key` (ignorowany przez git).
   Do aplikacji trafia tylko klucz publiczny (`src/services/crypto/authority-roots.json`) – po `init`
   trzeba zbudować aplikację ponownie.
2. **Urzędnik** instaluje zwykłą aplikację. Jego klucz powstaje na jego telefonie i go nie opuszcza.
3. **Wydanie certyfikatu, osobiście.** Operator sprawdza tożsamość i upoważnienie, po czym uruchamia:
   ```bash
   node scripts/authority-ca.js issue --key "<klucz z ekranu Mój klucz>" --name "Urząd Miasta – WZK" --days 30
   ```
   Narzędzie pokazuje odcisk klucza – operator porównuje **wszystkie grupy** z ekranem telefonu.
4. Narzędzie drukuje certyfikat jako tekst i kod QR. Urzędnik skanuje go w Ustawienia → Konto urzędowe.
   Telefon przyjmie certyfikat tylko wtedy, gdy podpisał go klucz główny i gdy dotyczy on klucza tego
   właśnie telefonu.
5. Każdy alert i każda wiadomość urzędnika niesie certyfikat, więc odbiorca sprawdza wszystko
   z jednego pakietu, bez internetu. Do `ANNOUNCE` urzędnik dołącza certyfikat tylko po zestawieniu
   łącza i co czwarty raz (z certyfikatem pakiet nie mieści się w jednej ramce BLE), a do `HELLO` wcale –
   odbiorca zapamiętuje certyfikat raz zobaczony.

Podrobienie konta urzędowego wymagałoby klucza głównego (offline, pod hasłem) albo telefonu urzędnika
razem z jego odciskiem palca lub kodem blokady. Sam certyfikat jest publiczny – skopiowany z eteru nic
nie daje, bo bez klucza prywatnego nie da się podpisać pakietu.

Urząd **nie ma** wglądu w prywatne rozmowy: nie istnieje depozyt kluczy ani uprawnienia moderacyjne.

> W PoC klucz główny to klucz deweloperski. We wdrożeniu produkcyjnym potrzebna jest procedura
> organizacyjna: kto go przechowuje, sprzętowy moduł kluczy lub podział klucza, rotacja. Repozytorium
> zawiera pustą listę kluczy głównych – dopóki nie wykonasz `init`, żadne konto urzędowe nie jest uznawane.

## Ograniczenia i dalszy rozwój

- **Metadane są jawne**: przekaźniki widzą, kto do kogo pisze, kiedy i jak długą wiadomość.
- **Brak forward secrecy**: klucze są długoterminowe (bez ratchetu jak w Noise/Signal). Kto nagra
  szyfrogramy, a później zdobędzie klucz z telefonu, odczyta dawne rozmowy.
- **Unieważnienie certyfikatu = jego wygaśnięcie.** Lista zablokowanych numerów i kluczy jest wszyta
  w aplikację (`authority-roots.json`), więc dociera tylko z aktualizacją. Dlatego certyfikaty są
  krótkie (domyślnie 30 dni, najwyżej 90).
- **Alerty są publiczne**: podpisane, ale nieszyfrowane.
- **Złośliwy przekaźnik może gubić i opóźniać pakiety** oraz zaniżać ich zasięg (obniżając `ttl`); nie
  może ich czytać, zmieniać ani podrabiać. Handshake nie wyklucza węzła, który przezroczyście przekazuje
  ruch między dwoma telefonami – „bezpośredni sąsiad” to wskazówka dla routingu, nie dowód.
- Węzeł, który dołączył do sieci przez przekaźnik, może do 2 min (do 4 min, gdy aplikacja urzędu działa
  w tle) widzieć konto urzędowe jako zwykły węzeł – do najbliższego `ANNOUNCE` z certyfikatem. Alerty
  i wiadomości urzędu niosą certyfikat zawsze.
- **Zegar**: pakiety z czasem różniącym się o ponad 10 minut są odrzucane. Aplikacja porównuje zegar
  z sąsiadami i ostrzega, ale nie potrafi go poprawić.
- Klucze w trakcie pracy są w pamięci aplikacji; SecureStore i SQLCipher chronią dane w spoczynku.
  Potwierdzenie biometrią przed alertem to bramka w interfejsie, nie zabezpieczenie kryptograficzne.
- Koszt weryfikacji podpisów w czystym JavaScripcie nie został zmierzony na telefonie. Ustawienia →
  Sieć (diagnostyka) pokazują średni czas weryfikacji – jeśli przekracza ok. 10 ms, trzeba dodać budżet
  weryfikacji na łącze albo natywną implementację Ed25519.
- Brak powiadomień systemowych o alertach, gdy aplikacja jest w tle.
- Brak store-and-forward dla wiadomości 1:1: niedostarczona wiadomość czeka tylko na telefonie nadawcy
  (do 24 h), inne telefony jej nie przechowują – dotrze, gdy nadawca i odbiorca znajdą się w jednej sieci.
- Protokół v2 nie jest zgodny z v1: po aktualizacji urządzenie dostaje nowe ID, a stara,
  niezaszyfrowana baza jest usuwana.
- Po ubiciu procesu przez system (np. agresywne oszczędzanie baterii producenta) mesh się zatrzymuje.
  Warto wyłączyć optymalizację baterii dla aplikacji.
- iOS nie jest wspierany (projekt Android-only; moduł natywny ma tylko implementację Kotlin).

---

<a id="english"></a>

# Mesh Chat – Bluetooth mesh chat without internet (Android)

[Polski](#polski) · **English**

A decentralised peer-to-peer chat. Every phone is a node of a **Bluetooth Low Energy mesh** network:
both a **Central** (it scans and connects) and a **Peripheral** (it advertises and accepts connections)
at the same time. Messages are relayed by the phones in between (multi-hop), so they also reach people
outside direct Bluetooth range.

- React Native 0.86 + Expo SDK 57 (CNG / prebuild, a custom native module in Kotlin), TypeScript
- `react-native-ble-plx`: the Central role
- `modules/mesh-peripheral`: a local Expo module (Kotlin), the Peripheral role (GATT server + advertising) and a foreground service
- Zustand (state), expo-sqlite with SQLCipher (encrypted history), expo-secure-store (keys), React Native Paper (UI, Material 3), Expo Router
- `tweetnacl`: Ed25519 signatures on every packet and end-to-end encryption (X25519 + XSalsa20-Poly1305)

The app carries two kinds of traffic: **end-to-end encrypted 1:1 conversations** and **alerts from
authority accounts** – public, signed announcements that only a device holding a certificate can send.
There are no groups: an ordinary user cannot broadcast content to the whole network. The security model
is described in the [Security](#security) section.

The user interface is in Polish. Screen and menu names below are given in English, with the Polish
label in brackets where it helps to find them in the app.

---

## Building

Requirements: Node 20+, JDK 17+, the Android SDK (API 36) and **physical devices** running Android 8.0+
(API 26). The emulator has no Bluetooth, and testing the mesh takes at least 2–3 phones.

```bash
npm install --legacy-peer-deps      # react-dom is an optional peer of expo; the flag works around the npm conflict
npx expo prebuild --platform android --clean
npx expo run:android                # debug build + install on the connected device
npm start                           # dev server (dev client) for later runs
```

Release APK: `npx expo run:android --variant release`, or EAS: `npx eas-cli@latest build -p android`.

> The `android/` directory is generated (Continuous Native Generation). Do not edit it by hand:
> configuration lives in `app.json` and native code in `modules/mesh-peripheral`.
> The app **does not run in Expo Go**, because it contains its own native code.

Quality checks: `npm run typecheck`, `npm run lint`, `npm test`, `npx expo-doctor`.

`npm test` (Jest) exercises the protocol layer without a phone: packet signatures, encryption,
certificates, the handshake, alert rules, the router on simulated links (forgeries, replays, alert
propagation) and several complete nodes at once (a message through a relay, mutual verification with
one scan and attempts to abuse it, an alert and a message from an authority account). The BLE radio,
the key store and database encryption cannot be checked anywhere but on devices.

> After changing plugins in `app.json` (SQLCipher, camera, SecureStore) a new `prebuild` and a new
> build are needed – the dev server alone is not enough.

---

## Permissions

On first launch the app shows the **Android system dialogs** straight away. It is not possible to go
further until the required permissions have been granted (guards in `src/app/_layout.tsx`).
Once they are granted, a toast confirms it. If the user picks "Don't ask again", the screen explains
the situation and opens the app's system settings. On return, permissions are checked again
automatically.

| Permission                                        | Type         | Android | Purpose                                                  |
| ------------------------------------------------- | ------------ | ------- | -------------------------------------------------------- |
| `BLUETOOTH_SCAN`                                  | runtime      | 12+     | finding nodes                                            |
| `BLUETOOTH_CONNECT`                               | runtime      | 12+     | GATT connections (both roles)                            |
| `BLUETOOTH_ADVERTISE`                             | runtime      | 12+     | advertising this node                                    |
| `ACCESS_FINE_LOCATION` / `ACCESS_COARSE_LOCATION` | runtime      | all     | BLE scan results (a system requirement; GPS is not used) |
| `POST_NOTIFICATIONS`                              | runtime      | 13+     | the notification of the background service               |
| `BLUETOOTH`, `BLUETOOTH_ADMIN`                    | install-time | ≤ 11    | Bluetooth on older systems (`maxSdkVersion=30`)          |
| `FOREGROUND_SERVICE`                              | install-time | all     | the background service                                   |
| `FOREGROUND_SERVICE_CONNECTED_DEVICE`             | install-time | 14+     | the `connectedDevice` service type                       |

"Install-time" permissions are _normal permissions_. The system grants them automatically and shows
no dialog for them, so the permissions screen lists them for information only. They are declared in
`modules/mesh-peripheral/android/src/main/AndroidManifest.xml` and in `app.json`.

---

## Architecture

```
src/
  app/                    Expo Router: routes and guards (thin files re-exporting screens)
  screens/                Permissions, Onboarding, Conversations, Network, Chat, Settings,
                          Alerts, ComposeAlert, Security, MyKey, VerifyContact, InstallCert, Recovery
  components/             AlertBanner, TrustBadge, QrScanner, NetworkStatusBar, MessageBubble…
  hooks/                  useMeshLifecycle, useNetworkStatus
  store/                  Zustand: identity, contacts, alerts, permissions, mesh, chat (+ domain types)
  services/
    ble/                  LinkManager (physical links), PeripheralRole, fragmenter, constants
    crypto/               keys + identity (device keys), box + e2e (1:1 encryption),
                          cert + authorities + trustAnchors (authority account certificates)
    mesh/                 packet (format and signature), handshake (HELLO), MeshRouter (routing),
                          alertPolicy (alert rules), SeenCache, MeshService (chat and alerts)
    permissions/          system dialogs, "don't ask again", settings
    security/             screen lock and biometric confirmation
    storage/              SQLCipher (migrations; chat, contact and alert repositories), kv-store (flags)
  utils/                  base64/UTF-8/UUID, randomness, nicknames, token bucket, emitter, logger
modules/mesh-peripheral/  Kotlin: MeshGattServer, MeshForegroundService, MeshPeripheralModule
scripts/authority-ca.js   offline tool that issues authority account certificates
__tests__/                protocol tests (Jest)
```

Layers (bottom up):

```
┌──────────────────────────────────────────────────────────────┐
│ UI (Paper)  ←→  Zustand stores                               │
├──────────────────────────────────────────────────────────────┤
│ MeshService   1:1 chat (E2E, ACK, retry), alerts, SQLCipher  │
├──────────────────────────────────────────────────────────────┤
│ MeshRouter    signatures + flooding + dedup + TTL + routes   │
├──────────────────────────────────────────────────────────────┤
│ LinkManager   BLE links, fragmentation, duty cycle, reconnect│
├───────────────────────────────┬──────────────────────────────┤
│ ble-plx (Central)             │ MeshPeripheral (Kotlin)      │
│ scan, connect, write, notify↓ │ GATT server, adv, FGS        │
└───────────────────────────────┴──────────────────────────────┘
```

### Why a custom native module?

`react-native-ble-plx` supports the **Central** role only. A real mesh needs every phone to be
discoverable and connectable as well (**Peripheral**). The peripheral libraries available for RN are
abandoned or do not support a GATT server with notifications, so `modules/mesh-peripheral` implements:

- a **GATT service** `7a3f0001-…` with two characteristics:
  - `RX` (write): centrals write frames to us,
  - `TX` (notify): we send frames to subscribed centrals (one queue per device, because Android
    allows one notification at a time; it waits for `onNotificationSent` or a timeout),
- **advertising**: the service UUID + manufacturer data `0xFFFF` with a 4-byte digest of the node ID (31 B limit),
- a **foreground service** of type `connectedDevice` that keeps the process (JS + BLE) alive in the background,
- the request to turn Bluetooth on (a system dialog).

---

## How the mesh works

### 1. Links (LinkManager)

- Every node **advertises and scans** at the same time (dual role).
- **Tie-break**: of a pair A–B only the node with the smaller ID digest connects, so one link is
  created instead of two. If the other node does not connect within 20 s (for example because it
  cannot act as a Peripheral), we connect ourselves. Any duplicates are removed after the HELLO
  handshake by the same deterministic rule on both sides.
- **Challenge handshake**: once a link is up, both sides exchange a signed `HELLO` carrying a random
  challenge; the link is bound to a node only when that node sends back a `HELLO` echoing our
  challenge and addressed to us. A recorded `HELLO` therefore cannot be replayed on another link.
  Until then only `HELLO` travels over the link; no answer within 15 s closes it. The BLE
  advertisement carries the protocol version number – nodes on another version are ignored.
- Limits: 4 outgoing links and 7 in total (the limit of Android's BLE stack). In a crowd this gives
  a partial mesh, and relaying provides the reach.
- **Fragmentation**: a packet is split into frames `[streamId][index][count][data]` sized to the MTU
  (517 B negotiated, 23 B by default) and reassembled on the other side. A frame is at most 512 B
  whatever the MTU – that is the limit of a GATT attribute value, and Android 13+ rejects longer ones.
- **Reconnect**: after a disconnect the node goes back to the candidates, and further attempts use
  exponential backoff (2 s → 60 s).

### 2. Routing (MeshRouter): _controlled flooding + reverse-path routes_

Packet format v2 (59 B header, big-endian, the author's key and signature at the end):

```
version | type | ttl | hops | flags | packetId(8) | origin(16) | destination(16) | seq(4) | timestamp(8) | len(2) | payload(JSON) | signPk(32) | sig(64)
```

`origin` is a digest of the `signPk` key, and `sig` is an Ed25519 signature over the header (without
`ttl`/`hops` – the only two bytes a relay may change) and the payload. Every node can therefore check
every packet by itself.

A relay processes a packet as follows:

1. **Per-link rate limit** (token bucket 60/25 s⁻¹), checked before parsing.
2. **Deduplication** by `origin + packetId` (LRU, 16,384 entries, 25 min). Each node forwards a given
   packet at most once, so loops are impossible even when the topology has cycles.
3. **Cheap checks before cryptography**: the link is authenticated, `ttl + hops` is within the limit
   for the type, the destination is allowed (only `ANNOUNCE` and `ALERT` may be broadcast), the packet
   time is within a ±10 min window, an `ANNOUNCE` is not older than the last one seen, an alert is
   newer than the stored one.
4. **Signature**: the key must yield `origin`, and the signature must verify. Only then does the
   packet enter the seen cache. A forged packet can only come from the neighbour that sent it (an
   honest relay would not have let it through), so after 3 of them the link is closed for a minute.
5. **Per-sender rate limit** (chat/ACK: burst of 15 + 1/s, ANNOUNCE: burst of 2 + 0.2/s, alerts
   separately). The excess is neither delivered nor relayed. The limit is counted per authenticated
   sender.
6. **Route learning**: a packet from X arrived over link L after `hops` hops, so we store the route
   "X via L, cost hops+1" if it is better or fresher, or if the old one has expired.
7. Local delivery, if `destination` is us.
8. **Relay**, if `ttl > 1`: the TTL goes down, `hops` goes up.
   - `ANNOUNCE` goes to all links except the one it came from, after a random 15–90 ms delay
     against collisions (broadcast storm),
   - a routed packet goes to the destination neighbour if it is directly connected; otherwise to the
     next hop from the routing table, and with no known route or with the `ForceFlood` flag it is
     flooded (a retry floods even when the recipient looks like a neighbour).

Packet types:

| Type       | TTL | Description                                                                                                                                                                                           |
| ---------- | --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `HELLO`    | 1   | challenge handshake on a new link, never relayed                                                                                                                                                      |
| `ANNOUNCE` | 5   | every 30 s (every 60 s in the background) and after each new link; builds the routing table and the node list; an authority account attaches its certificate after a new link and to every fourth one |
| `CHAT`     | 7   | a 1:1 message, routed, end-to-end encrypted                                                                                                                                                           |
| `ACK`      | 7   | delivery receipt, routed to the author, encrypted                                                                                                                                                     |
| `ALERT`    | 1   | an authority account announcement; spreads "store to store" (see below)                                                                                                                               |

### 3. Chat (MeshService)

- A message has a **UUID** (the idempotency key), a **sender ID** and a **timestamp**. `INSERT OR IGNORE`
  in SQLite removes duplicates even when the same message arrives over several paths.
- Statuses: `sending`, **sent** (handed to ≥1 neighbour), **waiting** (for the recipient to come into
  range), **delivered** (the ACK arrived), **failed**.
  Without an ACK, retries follow after 4, 10 and 20 s with `ForceFlood` (the route may have gone
  stale). After that the message **waits on the sender's phone for up to 24 h** – also across an app
  restart – and goes out by itself when the recipient appears on the node list (and every 60 s for
  as long as it stays there); a late ACK still counts. A message sent with a delay carries the time
  it was written inside the ciphertext. After 24 h the status becomes "failed"; tapping such a bubble
  sends it again.
- The recipient **always** sends an ACK, also for a duplicate (the previous ACK may have been lost).
  The ACK is encrypted like a message and counts only when it came from the other party.
- **Every conversation is end-to-end encrypted** (NaCl box: X25519 + XSalsa20-Poly1305,
  `services/crypto/box.ts`). Intermediate nodes see only the packet header (sender, recipient, time),
  without the content or the nickname. The plaintext contains `from` and `to` fields that are checked
  against the signed header – without this a relay could claim someone else's ciphertext as its own.
- **Sender-side anti-spam**: 5 messages at once, then 1/s. The text is at most 500 characters and the
  nickname at most 24 (stripped of control, invisible and text-direction characters).

### 4. Authority account alerts

- An alert is a public, signed announcement (title, body, expiry of up to 72 h) with the sender's
  certificate attached. The app shows active alerts in a **bar pinned to the top of every screen**;
  the bar cannot be dismissed, only collapsed to one line.
- **Propagation**: an alert always travels to a neighbour only. A node stores it and passes it on
  only if it was news to that node. This covers the first flood of the network, **latecomers** (when
  a link comes up, nodes compare digests of their alert sets and send the difference) and the merging
  of separated islands.
- One record per `(sender, id)`: the newer signed time wins, and on a tie the cancellation does.
  A cancellation stays in the store until the alert's expiry time, so an old packet cannot "revive"
  a cancelled announcement.
- At most 5 alerts per authority (always the newest); one authority cannot push out another's alerts.
- A relay does not reject an alert because of its own clock (unless it expired more than a day ago) –
  whether an alert is displayed is decided by a strict rule on the recipient's side.
- 1:1 messages from an authority account are marked "PILNE · authority name" (urgent), and the
  conversation with the authority is pinned to the top of the list.

### 5. Battery and background operation

| Profile              | Scan | Pause | Scan mode  | Advertising |
| -------------------- | ---- | ----- | ---------- | ----------- |
| no links (searching) | 8 s  | 2 s   | LowLatency | Balanced    |
| connected, on screen | 6 s  | 4 s   | Balanced   | Balanced    |
| in the background    | 5 s  | 40 s  | LowPower   | LowPower    |

- Scanning always uses a service UUID filter (it also works with the screen off).
- Android limits scan starts to 5 per 30 s; the cycles are longer, so the limit is not exceeded.
- The foreground service (a permanent notification with the number of connections and of nodes in
  the network) keeps the connections up after the app is minimised.

---

## Security

The app shows the user the same picture as below: Settings → Security (Ustawienia → Bezpieczeństwo)
derives the state of the protections **from the actual state of the device** (whether the database is
encrypted, whether there is a screen lock, whether the clock agrees with the neighbours, how many
contacts have been verified) and lists what the app does not protect against.

### Who we defend against

| Adversary                   | Capabilities                                                  |
| --------------------------- | ------------------------------------------------------------- |
| Eavesdropper on the air     | receives BLE traffic, sends nothing                           |
| Malicious node / relay      | a modified app in the network: forges, replays, drops, floods |
| Authority impersonator      | wants to show people a fake "urgent announcement"             |
| Finder / thief of the phone | has the device in hand                                        |

Out of scope: radio jamming, a compromised Android system (root, malware), coercion of the user.

### Threats and protections

| Threat                                                                   | Protection                                                                                                                                        |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| A relay or eavesdropper reading a conversation                           | NaCl box; a relay sees the header only                                                                                                            |
| Impersonating another user                                               | node ID = digest of the signing key; every packet is signed with Ed25519 and checked at every hop                                                 |
| Swapping the victim's encryption key                                     | the encryption key is accepted only from a packet signed by that identity                                                                         |
| Claiming someone else's ciphertext                                       | `from`/`to` fields inside the ciphertext, compared with the signed header                                                                         |
| Changing the header (time, recipient) in transit                         | the signature covers the whole header except `ttl`/`hops`                                                                                         |
| Replaying a recorded packet                                              | signed `packetId`, the seen cache, a ±10 min time window, durable deduplication by message ID                                                     |
| Hijacking a link with a replayed `HELLO`                                 | challenge handshake; the answer is addressed to the asker                                                                                         |
| Fake delivery receipts                                                   | the ACK is signed, encrypted and accepted only from the other party                                                                               |
| Flooding the network with content                                        | only accounts with a certificate may broadcast; limits per authenticated sender; a link is closed after 3 forgeries                               |
| A fake "authority"                                                       | authority status comes only from a certificate signed by the root key; the authority's name comes from the certificate, never from the nickname   |
| Misleading nicknames                                                     | three distinct markings (authority account / verified key / unverified), a warning when a name matches a verified contact                         |
| A substituted party at first contact                                     | key verification by QR code or by comparing the fingerprint aloud                                                                                 |
| Someone watching during verification (a photo of the code on the screen) | a one-time code bound to one conversation; the same code from a second device = a warning and a rollback                                          |
| Reading data from a seized phone                                         | the key seed and the database key in SecureStore (encrypted with a key from the Android Keystore), an SQLCipher database, Android backup disabled |
| Sending an alert from someone else's unlocked phone                      | biometrics or the lock code before every alert; a certificate installs only on a phone with a screen lock                                         |

### Identity and key verification

- A device has one 32-byte seed. From it come an Ed25519 pair (signatures) and an X25519 pair
  (encryption). The node ID is the first 16 bytes of the SHA-512 of the signing key.
- The **key fingerprint** is the full 128 bits of the ID in 8 groups of 4 characters (Settings →
  My key / Ustawienia → Mój klucz, together with a QR code).
- In a chat the shield icon opens verification. **One scan is enough for both people to verify each
  other:** one person chooses "Show my code" (Pokaż mój kod), the other scans it.
  - The scanner trusts the shower because the scanned key yields the ID of this conversation.
  - The shower trusts the scanner because the code contains a one-time token, and the scanner's
    phone sends it back encrypted. The token is **bound to the conversation the code was opened
    from** – it is accepted from that one node only, lives for 2 minutes, in memory only, and is
    gone once the app is closed.
  - The same token from another device means that someone peeked at the screen, or that the
    conversation is not with the person standing next to you. In that case **the code verifies
    nobody on the shower's phone**: whatever it granted in the last minute is rolled back (an
    earlier verification of the contact made by the user themselves stays), and the verification
    screen of that conversation shows a warning with the fingerprint of the foreign device. The
    scanner keeps what they checked with their own camera.
  - So that the person standing next to you always has time to trigger this warning, the code stays
    on the screen for a moment after it has been accepted, and the scanning phone sends the proof
    also when the key does **not** match its conversation (that is, when someone sits in the
    middle). A race against an onlooker therefore ends in a warning and a repeat, not in a false
    badge. The price is that an onlooker can, within a minute, invalidate someone else's
    verification with that code – then both people scan again.
  - The code on the Settings → My key screen is the bare public key (no token): scanning it verifies
    one side only. The same goes for comparing fingerprints aloud.
  - A verification can be revoked on the verification screen; the revocation is final (neither a
    late proof nor a late conflict will change anything afterwards).
- Losing the keys (for example after moving the app to another phone) never ends in a new identity
  being generated silently – the app shows a recovery screen and waits for the user's decision.
  The same applies to the database key.

### Authority accounts – how they are created and why they cannot be impersonated

1. The **root key** is created once, on a computer without a network: `node scripts/authority-ca.js init`.
   The secret is encrypted with a password (scrypt + secretbox) and stored in `ca/root.key` (ignored
   by git). Only the public key goes into the app (`src/services/crypto/authority-roots.json`) –
   after `init` the app has to be built again.
2. The **official** installs the ordinary app. Their key is created on their phone and never leaves it.
3. **Issuing the certificate, in person.** The operator checks identity and authorisation, then runs:
   ```bash
   node scripts/authority-ca.js issue --key "<key from the My key screen>" --name "Urząd Miasta – WZK" --days 30
   ```
   The tool shows the key fingerprint – the operator compares **all groups** with the phone screen.
4. The tool prints the certificate as text and as a QR code. The official scans it in Settings →
   Authority account (Ustawienia → Konto urzędowe). The phone accepts the certificate only if it was
   signed by the root key and concerns the key of that very phone.
5. Every alert and every message from the official carries the certificate, so the recipient checks
   everything from a single packet, without internet. The official attaches the certificate to
   `ANNOUNCE` only after a link comes up and every fourth time (with the certificate the packet does
   not fit in one BLE frame), and never to `HELLO` – a recipient remembers a certificate once seen.

Forging an authority account would take the root key (offline, behind a password) or the official's
phone together with their fingerprint or lock code. The certificate itself is public – copied off the
air it is worth nothing, because without the private key a packet cannot be signed.

An authority has **no** insight into private conversations: there is no key escrow and there are no
moderation privileges.

> In the PoC the root key is a developer key. A production deployment needs an organisational
> procedure: who holds it, a hardware key module or key splitting, rotation. The repository contains
> an empty list of root keys – until you run `init`, no authority account is recognised.

## Limitations and further development

- **Metadata is in the clear**: relays see who writes to whom, when, and how long the message is.
- **No forward secrecy**: keys are long-term (no ratchet as in Noise/Signal). Whoever records the
  ciphertexts and later obtains the key from the phone can read past conversations.
- **Revoking a certificate = letting it expire.** The list of blocked serial numbers and keys is
  built into the app (`authority-roots.json`), so it only arrives with an update. That is why
  certificates are short-lived (30 days by default, 90 at most).
- **Alerts are public**: signed, but not encrypted.
- **A malicious relay can drop and delay packets** and shorten their reach (by lowering `ttl`); it
  cannot read, change or forge them. The handshake does not rule out a node that transparently
  relays traffic between two phones – "direct neighbour" is a hint for routing, not a proof.
- A node that joined the network through a relay may, for up to 2 min (up to 4 min when the
  authority's app runs in the background), see an authority account as an ordinary node – until the
  next `ANNOUNCE` with the certificate. Alerts and messages from the authority always carry it.
- **Clock**: packets whose time differs by more than 10 minutes are rejected. The app compares the
  clock with its neighbours and warns, but cannot correct it.
- While the app is running, keys are in its memory; SecureStore and SQLCipher protect data at rest.
  The biometric confirmation before an alert is a gate in the interface, not a cryptographic
  protection.
- The cost of verifying signatures in pure JavaScript has not been measured on a phone. Settings →
  Network (diagnostics) shows the average verification time – if it exceeds about 10 ms, a per-link
  verification budget or a native Ed25519 implementation has to be added.
- No system notifications about alerts while the app is in the background.
- No store-and-forward for 1:1 messages: an undelivered message waits only on the sender's phone (up
  to 24 h), other phones do not hold it – it arrives once the sender and the recipient are in the
  same network.
- Protocol v2 is not compatible with v1: after the update the device gets a new ID, and the old,
  unencrypted database is deleted.
- Once the system kills the process (for example a manufacturer's aggressive battery saving), the
  mesh stops. It is worth turning off battery optimisation for the app.
- iOS is not supported (an Android-only project; the native module has a Kotlin implementation only).
