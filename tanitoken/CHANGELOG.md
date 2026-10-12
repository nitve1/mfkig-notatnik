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
| 1 | Wybór kierunku wizualnego z 5 makiet (`tanitoken/mockups/`) | czeka na decyzję użytkownika |
| 2 | Przebudowa apki według wybranej makiety: czytelność, mniej tekstu ciągłego, filtry na całą szerokość, nowe fonty | po wyborze |
| 3 | Języki: EN (domyślny), PL, ES, FR, IT, DE. Wykrywanie języka telefonu, przełącznik w Profilu, teksty alertów w `core` też tłumaczone | po przebudowie (teksty i tak się zmienią) |
| 4 | Landing w wybranym kierunku + wersje językowe | na końcu |
| 5 | Linki partnerskie: zgłoszenie do Novita / GMI Cloud, wklejenie linków w `core/affiliates.js` | po stronie użytkownika |
| 6 | Po merge'u: ręczne uruchomienie workflow „TaniToken snapshot” (tworzy gałąź `tanitoken-data`) | po merge'u |
| 7 | Test na prawdziwym telefonie (build EAS), szczególnie zadania w tle i powiadomienia | przed publikacją |

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
- Kolejność prac (ustalona z użytkownikiem): makiety apki → przebudowa apki → języki → landing.
