# TaniToken – changelog i stan projektu

Jedno miejsce z historią zmian, decyzjami i otwartymi zadaniami. Aktualizowane przy każdej zmianie,
żeby nowa sesja mogła kontynuować bez kontekstu rozmowy. Najnowsze wpisy na górze.

## Jak zacząć w nowej sesji

1. Przeczytaj ten plik i `tanitoken/README.md`.
2. Gałąź robocza: `claude/hopeful-gauss-8su545` (repo `nitve1/mfkig-notatnik`).
3. Testy: `node --test tanitoken/core/pricing.test.mjs`. Snapshot: `node tanitoken/scripts/build-snapshot.mjs`.
4. Apka: `cd tanitoken/mobile && npm install && npx expo-doctor && npx expo export --platform android`.
5. Podgląd UI bez telefonu: kopia `mobile/` do scratchpada, `npx expo install react-dom react-native-web`,
   `npx expo export --platform web`, serwer statyczny + Playwright (`/opt/pw-browsers/chromium`).
   Snapshot podstawiaj przez `page.route` z nagłówkiem `access-control-allow-origin: *`.
6. Skill do wyglądu: `.claude/skills/frontend-design/SKILL.md`.

## Otwarte zadania

| Priorytet | Zadanie | Status |
| --- | --- | --- |
| 1 | Test APK 0.1.1 na Motoroli Razr 60 (szkło, Najtaniej, fal.ai, powrót z modelu, ekran startowy) | u użytkownika |
| 2 | Historia cen w snapshocie (np. 30 punktów na ofertę) pod wykresy w karcie modelu | pomysł |
| 3 | Landing w stylu „Kolorowe kategorie” + wersje językowe | na końcu |
| 4 | Linki partnerskie: zgłoszenie do Novita / GMI Cloud, wklejenie linków w `core/affiliates.js` | po stronie użytkownika |
| 5 | Po merge'u: ręczne uruchomienie workflow „TaniToken snapshot” (tworzy gałąź `tanitoken-data`) | po merge'u |
| 6 | Klucz release (keystore) do Google Play; obecny APK jest podpisany kluczem debug | przed publikacją |

## 2026-10-13 – sesja 6: makiety szkła, opisy modeli, dłuższy ekran startowy

- Ekran startowy: animacja trwa 2 s dłużej (`Animated.delay(2450)`), żeby dało się przeczytać hasło.
- Makiety „szkło wszędzie” (`mockups/glass.mjs`, PNG `mockups/g1-szron`, `g2-noc`, `g3-witraz`), 3 ekrany na
  wariant: Promocje z reklamą partnerską w liście, karta modelu z opisem i zastosowaniami, Najtaniej wideo.
  Uwagi użytkownika w makietach: pasek ~15% bardziej przezroczysty, rogi 22 px jak reszta kart,
  aktywna zakładka to zaokrąglony kształt obejmujący ikonę i podpis (zamiast kwadratu za ikoną).
- Opisy modeli: OpenRouter `/models` ucina opisy (568 z 659 kończy się „...”), Vercel `/v1/models` ma pełne,
  często z „Typical uses include…”. Plan: opis z Vercel, w drugiej kolejności OpenRouter (do ostatniego
  pełnego zdania), dla fal `shortDescription`; zastosowania jako przetłumaczone etykiety z możliwości modelu
  (narzędzia, rozumowanie, obraz na wejściu, długi kontekst, kategorie).
- Afiliacja: raport w `docs/afiliacje-2026-10.md` (w toku).
- Czeka na decyzję użytkownika: wybór wariantu A/B/C, potem wdrożenie w apce.

## 2026-10-13 – sesja 5: poprawki po teście na Motoroli Razr 60, więcej platform, szkło (APK 0.1.1)

Uwagi użytkownika po pierwszym teście APK i co z nimi zrobione:

- Animacja startowa była pod paskiem zakładek. Teraz `Intro` to osobny, pierwszy pełny ekran (App.js zwraca
  sam ekran powitalny, bez kolumny i paska), a nie nakładka.
- Powrót z karty modelu wracał do „Zniżek”. Teraz lista zostaje zamontowana pod kartą modelu
  (`display: none`), więc wraca się do tej samej listy: typ, kategoria i przewinięcie zostają.
- „Nie ma modeli wideo i obrazów”. Modele były, ale bez promocji, a ekran pokazywał tylko promocje. Zmiany:
  - nowy rodzaj listy **Najtaniej** (`type.cheapest`): każdy model z kategorii z najtańszą ofertą, w obrazach
    najpierw cena za obraz, w wideo za sekundę; kafle pokazują „od 0,005 $/s”;
  - pusta kategoria promocji ma przycisk „Pokaż najtańsze”;
  - nowe źródło **fal.ai** (`falEntries`, `parseFalPrice`, `mediaKey` w `core/sources.js`): ok. 130 ofert
    obrazów i wideo; ceny z opisu cennika (za obraz, za sekundę; opisy w tokenach pomijane). Wideo: 32 → 100
    modeli, obrazy: 71 → 104. API fal nie ma CORS, więc na webie zostają oferty z ostatniego zestawienia.
- „Czy są tylko 3 platformy?”. Teraz 16: OpenRouter, Vercel AI Gateway, Requesty, fal.ai (na żywo) i 12 bramek
  z models.dev (`GATEWAYS` w `core/pricing.js`). W wyborze kont bramki są jako pigułki z liczbą ofert.
  Replicate, Together, WaveSpeed, Kie.ai wymagają klucza do cennika.
- Efekt szkła (`mobile/src/glass.js`), pływający pasek zakładek, pod którym przewija się lista:
  - web (Chromium): filtr SVG `feTurbulence` + `feDisplacementMap` w `backdrop-filter` razem z `blur`,
    czyli tło się ugina, a nie tylko rozmywa; Safari bez url() w backdrop-filter, więc tam samo rozmycie;
  - Android/iOS: React Native nie daje pikseli spod widoku, więc natywnie: `expo-blur` (Android 12+ przez
    `BlurTargetView` + `dimezisBlurViewSdk31Plus`), półprzezroczysty odcień, połysk SVG i 1 px jasnej
    krawędzi u góry. Prawdziwe ugięcie natywnie wymagałoby własnego shadera (AGSL/Metal).
  - `BottomSpaceContext` daje listom miejsce na dole, żeby ostatni element nie chował się pod paskiem.
- Wersja 0.1.1 (versionCode 3), ten sam klucz debug, więc instaluje się na poprzednią bez utraty danych.
  Numeracja (decyzja użytkownika): 0.x do testów, 1.0.0 dopiero przy wejściu do Google Play. Pierwszy
  APK nazywał się 1.0.0, a w praktyce był 0.1.0; versionCode tylko rośnie (1, 2, 3...).
- APK miał 30,07 MiB (limit wysyłki 30). Włączony R8 (`expo-build-properties`: minify + shrinkResources)
  z regułami keep dla modułów Expo, React Native, Hermes, BlurView, SVG, AsyncStorage: 25 MB. Brak KVM w
  środowisku, więc bez emulatora; pierwszy test R8 na telefonie użytkownika.
- Testy: 15/15 (nowe: parser fal, łączenie po nazwie, platformy).

## 2026-10-12 – sesja 4b: pierwszy APK (wtedy 1.0.0, od sesji 5 liczony jako 0.1.0)

- Zbudowany lokalnie (bez EAS) `TaniToken-1.0.0-arm64.apk` (30 MB, `pl.tanitoken.app`, versionCode 1,
  podpisany kluczem debug, bundle Hermes ze snapshotem cen z dnia buildu). Wysłany użytkownikowi.
- Wersja arm64 + armeabi-v7a ma 43 MB i nie mieści się w limicie wysyłki (30 MiB), dlatego
  `scripts/build-android-apk.sh` domyślnie buduje tylko arm64 (`ARCHS=...` zmienia).
- `npm run build:apk:local` w `mobile/` uruchamia ten skrypt.
- Problem w środowisku chmurowym: Maven Central przez proxy zwracał 429 (ktfmt, kotlin serialization).
  Obejście (poza repo): `~/.gradle/init.d/maven-mirror.gradle` z lustrem
  `https://maven-central.storage-download.googleapis.com/maven2/` dla pluginManagement i repozytoriów.
  Android SDK w `~/android-sdk` (cmdline-tools + licencje); NDK 27.1 i CMake 3.22.1 Gradle pobrał sam.
- Instalacja: plik na telefon → otwórz → zezwól na instalację z tego źródła. Albo przez USB:
  `adb install -r TaniToken-1.0.0-arm64.apk`. Przy aktualizacji tym samym kluczem debug dane zostają.

## 2026-10-12 – sesja 4: apka „od A do Z” (sprawdzanie cen na telefonie, 6 języków)

Prośba użytkownika: najpierw dokończyć całą apkę tak, żeby każda funkcja działała, a dopiero na końcu
zbudować APK. Build APK przerwany do czasu ukończenia apki.

Sprawdzanie cen bez serwera (wcześniej ceny zależały od GitHub Actions, które ruszą dopiero po merge'u):
- `core/snapshot.js`: `buildSnapshot`, `refreshModels`, `finalize`, `snapshotSummary`. Ten sam kod
  w `scripts/build-snapshot.mjs` (GitHub Actions) i w apce.
- Apka (`mobile/src/data.js`): przy otwarciu i co 30 min pełne sprawdzenie (OpenRouter + endpointy,
  Vercel, Requesty; ok. 6 s, ok. 430 zapytań, ok. 3 MB), między nimi co 5 min tylko obserwowane modele.
  Cenniki bezpośrednie (models.dev, 5 MB) i dłuższa historia promocji z zestawienia na GitHub co 6 h.
  Na start zestawienie wbudowane w apkę (`data/snapshot.json` przez Metro). Historia promocji
  (start, koniec, typowa długość) liczona też na telefonie.
- Zapis zestawienia w pliku (`mobile/src/store.js`, expo-file-system), bo AsyncStorage na Androidzie
  ma limit ok. 2 MB na wpis. Metadane odświeżania w AsyncStorage.
- Zadanie w tle (`alerts.js`): odświeża obserwowane modele (a co 30 min wszystko, jeśli wolno) i wysyła alerty.
- Ustawienie „Pełne sprawdzenie tylko przez Wi-Fi” (expo-network), status „Sprawdzam ceny… 45%” /
  „Ceny sprawdzone X temu” / „Czekam na Wi-Fi” / „Brak połączenia” na ekranie Promocji i w Profilu.
- Typowa długość promocji używana dopiero przy min. 3 zakończonych promocjach u dostawcy i średniej > 1 dnia
  (wcześniej jedna krótka promocja dawała „zwykle ok. 5 h”).

Języki:
- `core/i18n.js` + `core/locales/{en,pl,es,fr,it,de}.js` (253 klucze, komplet we wszystkich językach,
  zgodne zmienne). Odmiana liczebników (PL: one/few/many, FR: 0–1 = one). Ceny: EN „$5.10”, reszta „5,10 $”.
- Język: ustawienie „Język telefonu” (expo-localization) albo wybrany, przełącznik w Profilu i na
  pierwszym ekranie onboardingu. Teksty alertów i powiadomień w core też tłumaczone (zadanie w tle ustawia
  język z profilu). Domyślny EN, gdy język telefonu nie jest obsługiwany.
- Alerty zapisane w Moje zostają w języku, w którym powstały (świadome uproszczenie).
- Sprawdzone: cała ścieżka po angielsku bez ani jednego polskiego tekstu, przełączanie DE / FR / ES / IT / PL
  bez wychodzenia poza ekran.

Inne: `expo-system-ui` (motyw na Androidzie), aktualizacja paczek Expo (doctor 21/21), testy 12/12,
`scripts/build-android-apk.sh`, lokalny podgląd web na `localhost` też sprawdza ceny na żywo.

## 2026-10-12 – sesja 3e: sztywny układ i tryb Zwykły / Pro

Uwaga użytkownika: **nie publikować nowej wersji podglądu (artifact), dopóki nie poprosi.**
Na prośbę użytkownika opublikowana wersja 3 podglądu (świeży snapshot, sztywny układ, tryb Zwykły / Pro):
https://claude.ai/artifact/ChpcuMw9ReTwQSvRt4BsEe

Sztywny układ (feedback: w podglądzie na iPhonie można było „latać po bokach”):
- Przyczyna: Safari robi zoom przy fokusie na polu z czcionką < 16 px (wyszukiwarka dostawców miała 15 px)
  oraz pozwala na pinch-zoom i sprężynowanie strony. Sprawdzone: przy 320 / 375 / 430 px żaden element
  nie wychodzi poza ekran.
- Wszystkie pola tekstowe ≥ 16 px. Tekst i pola mają `maxFontSizeMultiplier` 1,3 (Dynamic Type nie
  rozsadza układu). Na tablecie i w szerokiej przeglądarce treść to kolumna max 600 px pośrodku.
- Podgląd web (`scripts/web-preview.mjs`): viewport `maximum-scale=1`, blokada gestów pinch,
  `overscroll-behavior: none`, `body` przypięte (`position: fixed`), `touch-action: pan-x pan-y`.

Tryb Zwykły / Pro (`profile.mode`, domyślnie `simple`):
- Zwykły: tylko oferty z platform (OpenRouter, Vercel AI Gateway, Requesty). W karcie modelu jeden wiersz
  na platformę (najtańsza oferta, dopisek „przez Decart”), karty promocji „OpenRouter, przez Baidu”,
  w wyborze ulubionych tylko platformy.
- Pro: wszystko jak wcześniej, z ~200 dostawcami bezpośrednimi i każdym wariantem osobno.
- Wybór w onboardingu (krok „U kogo masz konto?”) i w Profilu (sekcja Tryb).
- `mobile/src/filters.js`: `modeFilter`, `viewFilter` (tryb + „tylko ulubieni”), `compareFilter`
  (tryb + ulubieni, do alertów i Moje). `core/pricing.js`: `isPlatformOffer`, `onePerPlatform` (+ test, 11/11).

## 2026-10-12 – sesja 3d: platformy w ulubionych

- Pytanie użytkownika: czemu na liście dostawców nie ma OpenRouter. Powód: oferty z OpenRouter są
  podpisane firmą, która uruchamia model (DeepInfra, Novita…), a OpenRouter był tylko źródłem. Vercel i
  Requesty trafiały za to na listę jako „dostawcy”, co było niespójne.
- Wybór ulubionych (`ProviderPicker`) ma teraz dwie części: Platformy (OpenRouter, Vercel AI Gateway,
  Requesty, z liczbą ofert, przycisk „Mam konto”) i Dostawcy bezpośredni (bez Vercel / Requesty).
- `core/pricing.js`: `PLATFORMS`, `platformOf(offer)`, `favoriteMatcher(names)` – oferta pasuje, gdy
  zgadza się dostawca albo platforma, przez którą idzie. Używane w Promocjach, Szukaj, karcie modelu
  (filtr „Ulubieni”, gwiazdka) i alertach „taniej”. Test 10/10.
- Sekcja w Profilu: „Gdzie masz konto”. Podgląd web zaktualizowany pod tym samym linkiem.
- Opcje testów na iPhonie bez konta deweloperskiego (rozmowa): Expo Go (bez konta, wymaga komputera
  z `npx expo start`; tunel z chmury Claude zablokowany), Mac + Xcode + zwykłe Apple ID (7 dni),
  GitHub Actions macOS → niepodpisane .ipa → Sideloadly / AltStore z Apple ID (7 dni, bez Maca;
  workflow do zrobienia, jeśli użytkownik zechce).

## 2026-10-12 – sesja 3c: podgląd na telefonie przez przeglądarkę

- `mobile/scripts/web-preview.mjs`: buduje apkę na web (react-native-web) do jednego pliku
  `dist-web/index.html` (kod i 6 fontów jako data URI w środku) + `dist-web/snapshot.json`.
  Strona nie pobiera nic z zewnątrz, więc działa jako prywatny artifact na claude.ai.
- Opublikowane: https://claude.ai/artifact/ChpcuMw9ReTwQSvRt4BsEe (prywatne, tylko właściciel).
  Aktualizacja: `node scripts/web-preview.mjs`, potem ponowna publikacja tego samego pliku / URL.
- W podglądzie nie działają: powiadomienia, zadania w tle, eksport/import profilu, ceny OpenRouter na
  żywo (ceny ze snapshotu z chwili budowania). Profil zapisuje się w przeglądarce.
- `src/data.js`: na webie najpierw `snapshot.json` obok strony. `enableNotifications` nie rzuca błędu
  na platformach bez powiadomień. Dodane `react-dom` i `react-native-web` do zależności.
- GitHub Pages jako alternatywa: na darmowym planie strona jest zawsze publiczna, a Pages w tym repo
  publikuje z `main`. Do rozważenia po merge'u (np. `tanitoken/app/`), jeśli publiczny link wystarczy.

## 2026-10-12 – sesja 3b: apka w stylu „Kolorowe kategorie” + motyw

Decyzja użytkownika: kierunek 5 („Kolorowe kategorie”) z makiet + opcja zmiany motywu (dzienny / nocny).

- Nowy system wyglądu w apce (`mobile/src/theme.js`): tokeny jasne i ciemne, kolor na kategorię
  (Tekst `#3d63ff`, Kod `#8b3dff`, Obraz `#ff4f8b`, Wideo `#ff8a00`, w ciemnym motywie rozjaśnione),
  czerwień zniżek, zieleń oszczędności. Fonty: Bricolage Grotesque (nagłówki, liczby) + Figtree (tekst),
  paczki `@expo-google-fonts/*` (Barlow usunięty).
- Motyw: ustawienie `profile.theme` = `system` | `light` | `dark`. Przełącznik w Profilu (sekcja Wygląd)
  i w ostatnim kroku onboardingu (podgląd od razu). `ThemeContext` w `App.js`, `useTheme()` wszędzie.
- Nowe komponenty (`mobile/src/ui.js`): Card z kolorowym paskiem, Segmented na całą szerokość (też z
  ikonami), PctBadge, StatusBadge, CatChip, Stat, Progress, Section, IconButton z kropką, Empty z ikoną.
  Ikony SVG w `mobile/src/icons.js`, znak TaniToken = 4 kafle kategorii.
- Ekrany przepisane według makiety:
  - Promocje: kafel „Wszystkie promocje” + 4 kafle kategorii (liczba, „do −X%” albo „brak zniżek”),
    dotknięcie filtruje, przełącznik Zniżki / Obniżki / Darmowe z licznikami, karty z paskiem kategorii,
    dzwonek z kropką prowadzi do alertów.
  - Szukaj: pole z ikoną, kategorie jako ikony, sortowanie, karty z ceną i zniżką.
  - Karta modelu: dwa kafle (najtaniej / oszczędzasz), Używam / Obserwuj, zużycie, oferty z paskiem
    (zielony = najtaniej, niebieski = używasz), filtr Wszyscy / Ulubieni / Z promocją, jeden wiersz na
    dostawcę (`onePerProvider`), link „Otwórz” / „Partner”.
  - Moje: kafle „Oszczędzasz” (suma zniżek używanych ofert, `promoSavings`) i „Do sprawdzenia”, karty
    Używam z odznaką stanu i paskiem postępu promocji, alerty z ikonami, Obserwuję.
  - Profil: sekcje w kartach, Wygląd na górze.
  - Onboarding: kolorowe kafle kategorii, pasek kroków w kolorach kategorii.
  - Intro: 4 kafle wskakują po kolei, potem napis. Naprawione znikanie intro (remount przy zmianie gałęzi
    w `App.js`, callback tylko po `finished`).
- Ikona apki, adaptive icon, splash i ikona powiadomień w nowym znaku.
- `core/pricing.js`: `promoSavings`, `onePerProvider` (+ test, 9/9).
- Sprawdzone: eksport Android + iOS, expo-doctor 21/21, przejście całej ścieżki w podglądzie web w obu
  motywach (onboarding, promocje, filtr kategorii, szukaj, model, wybór dostawcy, Moje, Profil).

## 2026-10-12 – sesja 3: makiety i porządek

- Feedback użytkownika do v2: wygląd zbyt surowy i mało czytelny, informacje giną w ciągłym tekście,
  fonty (Barlow / Barlow Condensed) mało przyjemne, filtry zostawiają pustą przestrzeń po prawej,
  lepiej wypełniać całą szerokość.
- Dodany ten changelog.
- Dodane makiety 5 kierunków wizualnych apki: `tanitoken/mockups/` (generator `build.mjs`, HTML i PNG).
  Każdy kierunek pokazuje te same 3 ekrany (Promocje, Karta modelu, Moje) na prawdziwych danych ze snapshotu:
  1. Gazetka promocyjna (Archivo): ewolucja żółtej etykiety, zaokrąglone karty, kafle kategorii z ikonami.
  2. Portfel (Manrope): spokojny fintech, jedna duża liczba na górze, karty z inicjałem dostawcy.
  3. Notowania (Geist + Geist Mono): ceny jak kursy, wykres schodkowy momentu zniżki. Pełna wersja wymaga
     zapisywania historii cen w snapshocie.
  4. Kantor (Sora + Azeret Mono): ciemna tablica kursów, kolumny wejście/wyjście, bursztynowe cyfry.
  5. Kolorowe kategorie (Bricolage Grotesque + Figtree): kolor na kategorię, kafle na całą szerokość.
- Wspólne dla wszystkich makiet (odpowiedź na feedback): filtry rozciągnięte na całą szerokość,
  informacje w chipach, kolumnach i odznakach zamiast zdań, duża cena jako punkt zaczepienia,
  statusy „Kończy się / Promocja minęła / Najtaniej” jako kolorowe odznaki, pasek postępu promocji.
- Zauważone przy makietach, do zrobienia w apce: jeden wiersz na dostawcę w ofertach (ten sam dostawca
  bywa w kilku wariantach, np. NanoGPT), kafle kategorii pokazują 0, gdy brak zniżek (lepiej „brak zniżek”
  albo najtańsza oferta).
- PNG makiet generuje skrypt Playwright ze scratchpada (repo nie ma Playwrighta w zależnościach):
  `node build.mjs`, potem zrzut każdego `N-nazwa.html` w 1320 px szerokości.

## 2026-10-12 – sesja 2: v2 (commit f884b2a)

Dane:
- 4 źródła cen: OpenRouter (wszyscy dostawcy, pole `discount`), Vercel AI Gateway (też obraz za sztukę
  i wideo za sekundę), Requesty, cenniki bezpośrednie z models.dev. ~540 modeli, ~6800 ofert, ~240 dostawców.
- Łączenie modeli między źródłami po `modelKey` (znormalizowana nazwa).
- Kategorie: Wszystko, Tekst, Kod, Obraz, Wideo. Kod z OpenRouter `category=programming` + wzorce nazw.
- OpenRouter zwraca 0 za wideo: takie modele wyceniamy z Vercel, nigdy jako darmowe.
- Historia promocji w snapshocie: `promos` (z `since`), `ended` (14 dni), `history` (400), `promoStats`
  (średnia długość zniżki u dostawcy). Promocje zastane przy pierwszym pomiarze: `sinceKnown: false`.

Apka:
- Ekran powitalny (animowana etykieta), onboarding 4 kroki (imię, kategorie, ulubieni dostawcy,
  powiadomienia i kopia).
- Obserwuj / Używam (wybór dostawcy), zakładka Moje z kartami „Używam”, alertami i listą obserwowanych.
- Alerty: nowa promocja, koniec promocji, promocja może się kończyć (≥80% typowej długości), taniej
  gdzie indziej (≥20%, przy ulubionych tylko wśród nich), wycofanie modelu (≤14 dni).
- Powiadomienia lokalne (`expo-notifications`) + sprawdzanie w tle (`expo-background-task`, ~30 min).
  Bez serwera push.
- Profil lokalny: Android Auto Backup, iOS Keychain (opcja „Zachowaj po odinstalowaniu”), eksport/import JSON.
- Nowy wygląd „półka z promocjami” (skill frontend-design): żółta etykieta cenowa, Barlow.

Inne:
- `core/affiliates.js`: UTM na wszystkich linkach, miejsce na linki partnerskie z oznaczeniem.
  Research: Novita 10% przez 180 dni, GMI Cloud 20%, fal (niepotwierdzone), OpenRouter / Requesty /
  Vercel bez programu.
- Landing przebudowany + `landing/prywatnosc.html`.
- Skill `frontend-design` w repo (`.claude/skills/`), `.gitignore` przepuszcza `.claude/skills/`.
- Service worker notatnika MFKiG pomija ścieżki `/tanitoken/`.

## 2026-10-12 – sesja 1: v1 (commit 2d825d8)

- Projekt w osobnym folderze `tanitoken/`: wspólna logika cen (`core/`), skrypt snapshotu,
  landing, apka Expo (Android + iOS z jednego kodu).
- Dane tylko z OpenRouter (`/models` + `/endpoints`), zniżki z pola `discount`.
- Workflow GitHub Actions co 15 min publikuje snapshot na gałęzi `tanitoken-data`.

## Decyzje i ustalenia

- Jeden kod React Native (Expo) zamiast osobnych apek Android i iOS. Foldery natywne generuje `expo prebuild`.
- Brak własnego serwera: dane z GitHub (snapshot), profil na telefonie, powiadomienia lokalne. Dzięki temu
  minimum obowiązków RODO. Analityka, konta albo push z serwera to zmienią.
- Dostawcy nie podają dat końca promocji: ostrzeżenia opierają się na historii długości zniżek.
- Linki partnerskie zawsze oznaczone, kolejność ofert tylko według ceny.
- Wersje: 0.x.y w trakcie testów, 1.0.0 dopiero gdy użytkownik uzna, że czas na Google Play.
- Kolejność prac (ustalona z użytkownikiem): makiety apki → przebudowa apki → języki → landing.
