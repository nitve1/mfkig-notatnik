# TaniToken

Gdzie dziś najtaniej korzystać z API danego modelu AI. Ceny z wielu źródeł, promocje i ostrzeżenia, zanim
promocja się skończy. Osobny projekt w tym repo, niezależny od notatnika MFKiG.

```
tanitoken/
├── core/
│   ├── sources.js          adaptery źródeł cen + kategorie (tekst, kod, obraz, wideo)
│   ├── pricing.js          koszty, promocje, historia promocji, alerty dla obserwowanych
│   ├── affiliates.js       linki wyjściowe, UTM, programy partnerskie
│   └── pricing.test.mjs    testy (node --test)
├── scripts/build-snapshot.mjs   zbiera wszystko do data/snapshot.json
├── data/snapshot.json      kopia startowa (fallback)
├── landing/                landing page + strona prywatności (statyczne, bez builda)
└── mobile/                 apka Android + iOS (Expo SDK 57 / React Native, jeden kod)
```

## Źródła danych

Wszystkie publiczne, bez klucza i bez opłat:

| Źródło | Co daje | Odświeżanie |
| --- | --- | --- |
| OpenRouter `/models?output_modalities=all` + `/models/{id}/endpoints` | katalog, oferty każdego providera, pole `discount` (zniżka), uptime, kwantyzacja | co 15 min, karta modelu na żywo |
| OpenRouter `/models?category=programming` | które modele są do kodu | co 15 min |
| Vercel AI Gateway `/v1/models` | ceny tekstu, obrazów (za obraz) i wideo (za sekundę) | co 15 min |
| Requesty `/v1/models` | ceny z Bedrock, Vertex, Azure i innych przez Requesty | co 15 min |
| models.dev `api.json` | cenniki bezpośrednie ~180 providerów (społeczność, mogą być nieaktualne) | co 15 min |

Ten sam model łączymy między źródłami po znormalizowanej nazwie (`modelKey`). Aktualnie: ~540 modeli,
~6800 ofert, ~240 dostawców. Snapshot ma ~1,4 MB, po kompresji ~130 KB.

OpenRouter nie podaje cen wideo (zwraca 0), więc te modele wyceniamy z Vercel. Nigdy nie oznaczamy ich jako darmowe.

## Promocje i ostrzeżenia o końcu

Dostawcy nie publikują dat końca promocji. Dlatego skrypt przy każdym przebiegu:

1. zapisuje, kiedy pojawiła się każda zniżka (`promos[*].since`),
2. wykrywa obniżki cen względem poprzedniego przebiegu (`drops`, trzymane 7 dni),
3. zapisuje zakończone promocje (`ended`, 14 dni) i historię (`history`, 400 ostatnich),
4. liczy, ile średnio trwają zniżki u danego dostawcy (`promoStats`).

Na tej podstawie apka ostrzega: „promocja trwa już prawie tyle, ile zwykle u tego dostawcy”, a gdy zniknie,
od razu podaje najtańszą alternatywę. Statystyki pojawią się po kilku dniach działania workflow. Promocje
zastane przy pierwszym pomiarze mają nieznaną datę startu i nie wchodzą do średnich.

## Apka mobilna

Ekrany: ekran powitalny (animowana etykieta), onboarding w 4 krokach, Promocje, Szukaj, Moje, Profil,
karta modelu.

- **Obserwuj**: model trafia do zakładki Moje, widać jego promocje i najtańszą ofertę.
- **Używam**: wskazujesz dostawcę, u którego płacisz. Apka pokazuje, czy jesteś w promocji, jak długo trwa,
  ile przepłacasz i kiedy zniżka może się skończyć.
- **Kategorie**: Wszystko, Tekst, Kod, Obraz, Wideo. Koszt liczony w jednostce modelu (tokeny, obraz, sekunda).
- **Ulubieni dostawcy**: wybór z ~240 dostawców, filtr „tylko ich oferty”, porównania i alerty tylko wśród nich.
- **Powiadomienia**: lokalne, bez serwera push. Sprawdzane przy otwarciu apki i w tle przez
  `expo-background-task` (system uruchamia je co ~30+ minut, według własnego uznania). Na Androidzie dwa
  kanały: „Koniec promocji” (wysoki priorytet) i „Nowe okazje”.

### Profil, kopia i RODO

Profil (imię, kategorie, ulubieni, obserwowane, zużycie) leży tylko na telefonie. Nie ma kont ani serwera.

| Platforma | Kopia | Po odinstalowaniu |
| --- | --- | --- |
| Android | Auto Backup na koncie Google użytkownika (`allowBackup: true`) | wraca po instalacji z kopią |
| iOS | opcja „Zachowaj po odinstalowaniu”: lustrzana kopia w Keychain | wraca po ponownej instalacji |
| obie | eksport/import pliku JSON | ręcznie |

Ponieważ nie przetwarzamy danych osobowych na własnych serwerach, nie potrzeba rejestracji, zgód cookie
ani umowy powierzenia. Sklepy i tak wymagają polityki prywatności: jest w `landing/prywatnosc.html`.
Dodanie analityki, kont, serwera push albo synchronizacji w chmurze zmieni tę sytuację.

### Uruchomienie i buildy

```
cd tanitoken/mobile
npm install
npx expo start          # podgląd w Expo Go (bez zadań w tle)
```

Zadania w tle i pełne powiadomienia działają w buildzie deweloperskim lub produkcyjnym (EAS, darmowy plan
wystarcza na start):

| Cel | Komenda |
| --- | --- |
| APK lokalnie, bez konta Expo | `npm run build:apk:local` (JDK 17+, Android SDK, `ANDROID_HOME`) |
| APK do testów na Androidzie (EAS) | `npm run build:android:apk` |
| Google Play (AAB) | `npm run build:android` |
| App Store / TestFlight | `npm run build:ios` (Apple Developer, 99 USD/rok) |
| Wysyłka do sklepów | `eas submit -p android` / `eas submit -p ios` |

## Afiliacja (stan na październik 2026)

| Program | Warunki | Status |
| --- | --- | --- |
| [Novita AI Affiliate](https://novita.ai/affiliate) | 10% wydatków poleconych przez 180 dni | publiczny, trzeba się zgłosić |
| [GMI Cloud Ambassador](https://www.gmicloud.ai/en/company/ambassador-program) | 20% prowizji | publiczny |
| [fal](https://openaffiliate.dev/programs/fal) | cookie 60 dni, wypłata od 50 USD | dane z katalogu, niepotwierdzone u źródła |
| OpenRouter, Requesty, Vercel | brak publicznego programu | OpenRouter ma tylko program startupowy przez partnerów |

Jak włączyć: po akceptacji wklej swój link w `core/affiliates.js` (pole `link`). Apka i landing od razu
kierują tam ruch i oznaczają ofertę jako „link partnerski”. Oznaczenie jest obowiązkowe (UCPD, wytyczne
UOKiK) i nie wpływa na kolejność ofert, sortujemy wyłącznie po cenie. Wszystkie linki wyjściowe mają UTM
`utm_source=tanitoken`, więc dostawcy widzą ruch od nas, co pomaga przy rozmowach o partnerstwie.

## Wygląd

Apka: kierunek „Kolorowe kategorie” (wybrany z makiet w `mockups/`). Każda kategoria ma kolor (Tekst
niebieski, Kod fioletowy, Obraz różowy, Wideo pomarańczowy), karty z kolorowym paskiem, filtry na całą
szerokość, fonty Bricolage Grotesque + Figtree. Motyw systemowy, jasny albo ciemny (Profil → Wygląd).
Tokeny w `mobile/src/theme.js`, komponenty w `mobile/src/ui.js`. Landing jest jeszcze w starym stylu
„półka z promocjami” i zostanie przerobiony na końcu.

## Snapshot co 15 minut

`.github/workflows/tanitoken-snapshot.yml` publikuje `snapshot.json` na gałęzi `tanitoken-data` (jeden
nadpisywany commit, `main` zostaje czysty). Landing i apka czytają go z `raw.githubusercontent.com`, z
fallbackiem na kopię w repo i na samo `/models` z OpenRouter.

Workflow z `schedule` działa dopiero na domyślnej gałęzi. Po merge’u odpal go raz ręcznie
(Actions → TaniToken snapshot → Run workflow), żeby powstała gałąź `tanitoken-data`.

## Testy i skrypty

```
node --test tanitoken/core/pricing.test.mjs
node tanitoken/scripts/build-snapshot.mjs
python3 -m http.server   # landing: http://localhost:8000/tanitoken/landing/
```
