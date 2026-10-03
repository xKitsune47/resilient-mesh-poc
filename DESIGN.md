---
version: alpha
name: Mesh Chat
description: >
  Komunikator mesh (BLE) działający bez infrastruktury, w języku wizualnym
  inspirowanym aplikacją mObywatel: urzędowy błękit, chłodne jasne tło,
  białe karty, pastylkowe akcenty.
colors:
  # Marka
  primary: "#0052A5"
  on-primary: "#FFFFFF"
  primary-container: "#D6E6F8"
  on-primary-container: "#0A2A52"
  secondary: "#D4213D"
  on-secondary: "#FFFFFF"
  # Powierzchnie (jasny)
  background: "#F2F5FA"
  on-background: "#1A2233"
  surface: "#FFFFFF"
  on-surface: "#1A2233"
  surface-variant: "#E8EEF6"
  on-surface-variant: "#5B6577"
  outline: "#8A94A6"
  outline-variant: "#DDE3EC"
  # Powierzchnie (ciemny)
  primary-dark: "#4A9EF0"
  on-primary-dark: "#06213F"
  primary-container-dark: "#17406E"
  on-primary-container-dark: "#D6E6F8"
  background-dark: "#15171B"
  on-background-dark: "#F1F3F6"
  surface-dark: "#23262B"
  on-surface-dark: "#F1F3F6"
  surface-variant-dark: "#2D3137"
  on-surface-variant-dark: "#A4ACB9"
  outline-dark: "#6B7482"
  outline-variant-dark: "#343941"
  # Statusy
  connected: "#22A06B"
  searching: "#E2A400"
  offline: "#8A8F8E"
  error: "#D32F2F"
typography:
  display:
    fontFamily: System
    fontSize: 32px
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: -0.01em
  title-lg:
    fontFamily: System
    fontSize: 20px
    fontWeight: 600
    lineHeight: 1.3
  title-md:
    fontFamily: System
    fontSize: 17px
    fontWeight: 600
    lineHeight: 1.35
  body-lg:
    fontFamily: System
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.45
  body-md:
    fontFamily: System
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.45
  label-md:
    fontFamily: System
    fontSize: 13px
    fontWeight: 500
    lineHeight: 1.3
  label-sm:
    fontFamily: System
    fontSize: 11px
    fontWeight: 500
    lineHeight: 1.3
rounded:
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  full: 9999px
spacing:
  base: 8px
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
  gutter: 16px
components:
  app-bar:
    backgroundColor: "{colors.background}"
    textColor: "{colors.primary}"
    typography: "{typography.title-md}"
    height: 56px
  tab-bar:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface-variant}"
    typography: "{typography.label-sm}"
    height: 64px
  tab-bar-item-active:
    backgroundColor: "{colors.primary-container}"
    textColor: "{colors.primary}"
    rounded: "{rounded.full}"
  list-row:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface}"
    typography: "{typography.body-lg}"
    rounded: "{rounded.md}"
    padding: 16px
    height: 64px
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.lg}"
    padding: 16px
  chip:
    backgroundColor: "{colors.primary-container}"
    textColor: "{colors.primary}"
    typography: "{typography.label-md}"
    rounded: "{rounded.full}"
    padding: 8px
    height: 32px
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.title-md}"
    rounded: "{rounded.full}"
    padding: 16px
    height: 48px
  button-primary-disabled:
    backgroundColor: "{colors.surface-variant}"
    textColor: "{colors.outline}"
  button-destructive:
    backgroundColor: "{colors.error}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.full}"
    height: 48px
  message-bubble-out:
    backgroundColor: "{colors.primary-container}"
    textColor: "{colors.on-primary-container}"
    typography: "{typography.body-lg}"
    rounded: "{rounded.lg}"
    padding: 12px
  message-bubble-in:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface}"
    typography: "{typography.body-lg}"
    rounded: "{rounded.lg}"
    padding: 12px
  message-meta:
    textColor: "{colors.on-surface-variant}"
    typography: "{typography.label-sm}"
  message-input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface}"
    typography: "{typography.body-lg}"
    rounded: "{rounded.full}"
    padding: 12px
    height: 44px
  send-button:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.full}"
    size: 44px
  avatar:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.label-md}"
    rounded: "{rounded.full}"
    size: 40px
  unread-badge:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.label-sm}"
    rounded: "{rounded.full}"
    height: 20px
  network-status-bar:
    backgroundColor: "{colors.surface-variant}"
    textColor: "{colors.on-surface-variant}"
    typography: "{typography.label-md}"
    padding: 8px
    height: 32px
  alert-banner:
    backgroundColor: "{colors.error}"
    textColor: "{colors.on-primary}"
    typography: "{typography.title-md}"
    padding: 8px
  message-bubble-official:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface}"
    typography: "{typography.body-lg}"
    rounded: "{rounded.lg}"
    padding: 12px
  trust-badge-official:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.label-sm}"
    rounded: "{rounded.full}"
    height: 20px
  trust-badge-verified:
    backgroundColor: "{colors.primary-container}"
    textColor: "{colors.on-primary-container}"
    typography: "{typography.label-sm}"
    rounded: "{rounded.full}"
    height: 20px
  trust-badge-unverified:
    backgroundColor: "{colors.surface-variant}"
    textColor: "{colors.on-surface-variant}"
    typography: "{typography.label-sm}"
    rounded: "{rounded.full}"
    height: 20px
---

## Overview

Mesh Chat to komunikator awaryjny: wiadomości skaczą między telefonami po
Bluetooth, gdy nie ma sieci komórkowej ani internetu. Interfejs ma budzić to
samo zaufanie co aplikacja państwowa — spokojny, czytelny, przewidywalny —
dlatego czerpie z języka wizualnego mObywatela: jeden urzędowy błękit, chłodne
bardzo jasne tło, białe karty z miękkim cieniem i pastylkowe elementy akcji.

Charakter: **rzeczowy, opanowany, obywatelski.** Żadnych ozdobników ani
gradientów w tle. Użytkownik może być w stresie, na zewnątrz, z jedną wolną
ręką — liczy się kontrast, duże cele dotykowe i stan sieci widoczny na pierwszy
rzut oka.

To jest stylistyka *inspirowana* mObywatelem, nie jego kopia: nie używamy godła,
nazwy ani logotypów mObywatela i nie sugerujemy, że to aplikacja rządowa.

## Colors

Paleta jest niemal monochromatyczna: błękit + chłodne szarości. Kolor poza
błękitem zawsze coś znaczy (status, błąd).

- **Primary (#0052A5):** urzędowy błękit. Przyciski główne, aktywna zakładka,
  linki, tytuł w pasku nawigacji, awatary, licznik nieprzeczytanych, ikona
  „dostarczono".
- **Primary container (#D6E6F8):** bladoniebieskie pastylki — chipy
  („Wszystkie"), podświetlenie aktywnej zakładki, **dymek wysłanej wiadomości**.
  Tekst na nim: on-primary-container (#0A2A52).
- **Secondary (#D4213D):** karmazyn z flagi. Wyłącznie drobny akcent tożsamości
  (np. znak aplikacji w onboardingu). Nigdy jako kolor akcji — żeby nie mylił
  się z błędem.
- **Background (#F2F5FA):** chłodne, lekko niebieskawe tło ekranów. To ono
  sprawia, że białe karty i dymki „odklejają się" bez obramowań.
- **Surface (#FFFFFF):** karty, wiersze list, dymki odebrane, pole wpisywania,
  dolny pasek zakładek.
- **Surface variant (#E8EEF6):** tła drugiego planu — pasek stanu sieci,
  wyłączone przyciski, placeholdery.
- **On-surface (#1A2233) / on-surface-variant (#5B6577):** granatowo-grafitowy
  tekst główny i szary tekst pomocniczy (godzina, „3 skoki", podtytuły).
- **Outline variant (#DDE3EC):** jedyny dopuszczalny separator; cienka linia
  1px, używana oszczędnie.

Statusy sieci mesh (zawsze z ikoną lub etykietą, nigdy samym kolorem):

- **Connected (#22A06B):** są sąsiedzi, wiadomości idą.
- **Searching (#E2A400):** skanowanie, brak węzłów.
- **Offline (#8A8F8E):** Bluetooth wyłączony / mesh zatrzymany.
- **Error (#D32F2F):** niedostarczona wiadomość, akcje usuwające, **pilny
  komunikat konta urzędowego**. W tej ostatniej roli zawsze z ikoną
  ośmiokąta i słowem „PILNE" — sam kolor nie wystarcza.

**Tryb ciemny** używa tokenów z sufiksem `-dark`: grafitowe tło (#15171B),
jaśniejsze karty (#23262B) i rozjaśniony błękit (#4A9EF0) jako primary. Dymek
wysłany to primary-container-dark (#17406E) z jasnym tekstem. Kolory statusów
pozostają bez zmian.

## Typography

Krój systemowy (San Francisco na iOS, Roboto na Androidzie) — bez ładowania
fontów, bo aplikacja ma działać offline i startować natychmiast. Hierarchię
buduje waga i rozmiar, nie kolor.

- **display (32/700):** duży tytuł ekranu w stylu „Dokumenty" — onboarding,
  puste stany.
- **title-lg (20/600):** nagłówki sekcji („Czaty", „Węzły w zasięgu").
- **title-md (17/600):** tytuł w pasku nawigacji, nazwa rozmowy na liście,
  etykieta przycisku głównego.
- **body-lg (16/400):** treść wiadomości i wierszy list. Nie schodzić poniżej
  16px dla treści czatu.
- **body-md (14/400):** podgląd ostatniej wiadomości, opisy ustawień.
- **label-md (13/500):** chipy, etykieta „PILNE · urząd", pasek stanu sieci.
- **label-sm (11/500):** godzina, liczba skoków, etykiety zakładek.

Tytuły pisane zwykłą kapitalizacją zdania, bez wersalików. Teksty UI po polsku.

## Layout

Jedna kolumna, mobile-first. Siatka 8px (4px dla drobnych odstępów wewnątrz
komponentów).

- Margines boczny ekranu: **16px** (`gutter`).
- Odstęp między kartami/wierszami listy: **8px**; między sekcjami: **24px**.
- Nagłówek sekcji po lewej, pastylkowa akcja (chip) po prawej w tej samej
  linii — wzorzec „Dokumenty · Wszystkie".
- Wiersze list to osobne białe karty z odstępem, nie ciągła lista z
  separatorami.
- Minimalny cel dotykowy: **44×44px**.
- Czat: dymki max **82%** szerokości, wysłane do prawej, odebrane do lewej,
  2px odstępu w ramach jednego nadawcy, 12px margines boczny. Pole wpisywania
  przyklejone do dołu nad klawiaturą, z poszanowaniem safe area.
- Dolny pasek: 4 zakładki (Czaty, Sieć, Informacje, Ustawienia), ikona + podpis.

## Elevation & Depth

Głębia jest płytka i wynika głównie z kontrastu biała karta / chłodne tło.

- **Poziom 0:** tło ekranu, pasek nawigacji (zlewa się z tłem, bez cienia).
- **Poziom 1:** karty, wiersze list, dymki — bardzo miękki cień
  (y 1px, blur 3px, czerń ~8%) lub `elevation: 1` na Androidzie.
- **Poziom 2:** dolny pasek zakładek i pole wpisywania — cienka linia
  outline-variant od góry zamiast cienia.
- **Poziom 3:** dialogi i bottom sheety — cień y 8px, blur 24px, ~16% +
  przyciemnienie tła.

W trybie ciemnym cienie znikają; poziomy odróżnia jaśniejsza powierzchnia.

## Shapes

Kształty są miękkie, ale nie zabawkowe.

- **md (12px):** wiersze list, pola formularzy.
- **lg (16px):** karty, dymki wiadomości. Dymek ma „ogonek": róg przy nadawcy
  (prawy dolny dla wysłanych, lewy dolny dla odebranych) zmniejszony do
  **xs (4px)**.
- **full:** wszystko, co jest akcją lub znacznikiem — przyciski, chipy, pole
  wpisywania, awatary, liczniki, podświetlenie aktywnej zakładki.
- **sm (8px):** kwadratowe kafelki ikon.

Ikony: konturowe, kreska ~2px (MaterialCommunityIcons w wariantach `-outline`),
w kolorze primary lub on-surface-variant.

## Components

- **App bar:** tło równe tłu ekranu, bez cienia. Tytuł wyśrodkowany, w kolorze
  primary (jak „Dokumenty" w mObywatelu). Akcje po bokach jako ikony konturowe.
  W czacie: awatar + nazwa rozmowy + pod spodem liczba węzłów / skoków.
- **Tab bar:** biały, z linią outline-variant u góry. Aktywna zakładka: ikona i
  podpis w primary, pod ikoną pastylka primary-container. Nieaktywne:
  on-surface-variant.
- **List row (rozmowa, węzeł, ustawienie):** biała karta 12px, awatar/ikona po
  lewej, tytuł title-md + podgląd body-md, po prawej godzina label-sm i licznik
  nieprzeczytanych albo szewron.
- **Chip:** bladoniebieska pastylka z tekstem primary; do filtrów i akcji
  drugorzędnych przy nagłówkach sekcji.
- **Button primary:** pełna pastylka w primary, biały tekst, na całą szerokość
  u dołu ekranu („Skanuj kod rozmówcy", „Dalej"). Jeden na ekran.
- **Button destructive:** jak primary, w kolorze error; tylko dla akcji
  nieodwracalnych, zawsze z potwierdzeniem.
- **Message bubble (out):** primary-container, tekst on-primary-container.
  W stopce godzina + ikona statusu: zegar (wysyłanie), ptaszek (wysłana),
  podwójny ptaszek w primary (dostarczona).
- **Message bubble (in):** biały. W stopce „N skoki · godzina", gdy wiadomość
  przeszła więcej niż jeden skok.
- **Message bubble (official):** wiadomość od konta urzędowego. Obramowanie 1px
  error, nad treścią ikona ośmiokąta + „PILNE · nazwa urzędu" (label-md, error).
  Nazwa pochodzi z certyfikatu, nigdy z nicku.
- **Message bubble (failed):** obramowanie 1px error, ikona alertu i podpis
  „Nie dostarczono · dotknij, aby ponowić" w kolorze error.
- **Message input:** biała pastylka 44px na tle surface, obok okrągły przycisk
  wysyłania 44px w primary; nieaktywny, gdy pole puste.
- **Avatar:** koło 40px, tło primary, białe inicjały — jak „AA"/„JK" w
  mObywatelu. Dla rozróżnienia rozmówców dopuszczalne stonowane odcienie z tej
  samej rodziny chłodnych barw.
- **Network status bar:** wąski pasek pod app barem: kropka w kolorze statusu +
  tekst („Połączono · 4 węzły", „Szukam węzłów…", „Bluetooth wyłączony").
- **Signal bars:** 4 słupki; aktywne w kolorze connected, nieaktywne w
  outline-variant.
- **Alert banner:** pasek w kolorze error nad paskiem stanu sieci, na każdym
  głównym ekranie. Ikona ośmiokąta, „PILNE · nazwa urzędu", nagłówek (title-md),
  do 3 linii treści. Nie da się go zamknąć, dopóki alert jest aktywny — tylko
  zwinąć do jednej linii strzałką; nowszy alert rozwija go ponownie. Dotknięcie
  otwiera listę komunikatów.
- **Trust badge:** pastylka 20px z ikoną tarczy, trzy wyraźnie różne stany:
  „Konto urzędowe" (pełny primary, biały tekst — tylko z certyfikatu),
  „Klucz zweryfikowany" (primary-container), „Niezweryfikowany"
  (surface-variant). Konto urzędowe ma też awatar z ikoną budynku zamiast
  inicjałów.
- **Security notice:** blok surface-variant z kłódką na początku rozmowy
  („Rozmowa szyfrowana end-to-end…"); w kolorze error-container, gdy nazwa
  rozmówcy pokrywa się ze zweryfikowanym kontaktem innego urządzenia.

## Do's and Don'ts

**Do**

- Używaj błękitu primary dla jednej, najważniejszej akcji na ekranie.
- Układaj treść w białych kartach na tle background; oddzielaj odstępem.
- Pokazuj stan sieci mesh zawsze i wszędzie tam, gdzie wpływa na wysyłkę.
- Łącz kolor statusu z ikoną lub tekstem (dostępność, daltonizm).
- Trzymaj kontrast tekstu min. 4.5:1 i cele dotykowe min. 44px.
- Sprawdzaj każdy ekran w trybie jasnym i ciemnym.

**Don't**

- Nie używaj czerwieni (secondary) do przycisków ani linków — czerwień w akcji
  znaczy błąd lub usunięcie.
- Nie dodawaj gradientów, ilustracji w tle ani dodatkowych kolorów akcentu.
- Nie rysuj separatorów między wierszami, które są już osobnymi kartami.
- Nie używaj godła, nazwy ani logotypów mObywatela; nie podszywaj się pod
  aplikację rządową. Oznaczenie „Konto urzędowe" i styl „PILNE" przysługują
  wyłącznie nadawcom z ważnym certyfikatem — nigdy na podstawie nicku, i bez
  godła ani barw państwowych.
- Nie pokazuj stanu zabezpieczeń „na sztywno": ekran Bezpieczeństwo ma
  odzwierciedlać faktyczny stan urządzenia, razem z tym, czego aplikacja nie
  chroni.
- Nie polegaj na fontach ani zasobach pobieranych z sieci — aplikacja działa
  offline.
- Nie zmniejszaj treści wiadomości poniżej 16px.
