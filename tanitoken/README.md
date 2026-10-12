# TaniToken

Gdzie dziś najtaniej korzystać z API danego modelu AI. Ceny wszystkich providerów z OpenRouter,
zniżki, obniżki cen i darmowe modele w czasie (prawie) rzeczywistym.

Osobny projekt w tym repo, niezależny od notatnika MFKiG.

```
tanitoken/
├── core/pricing.js          wspólna logika cen (Node, przeglądarka, React Native)
├── scripts/build-snapshot.mjs  pobiera modele + oferty providerów -> data/snapshot.json
├── data/snapshot.json       kopia startowa (fallback)
├── landing/                 landing page (statyczny HTML/CSS/JS, dane na żywo)
└── mobile/                  apka Android + iOS (Expo / React Native, jeden kod)
```

## Skąd są dane

Publiczne API OpenRouter, bez klucza:

- `GET /api/v1/models` – lista modeli i cena bazowa,
- `GET /api/v1/models/{id}/endpoints` – oferty wszystkich providerów modelu: cena wejścia/wyjścia,
  pole `discount` (zniżka providera, cena w API jest już po zniżce), kontekst, kwantyzacja, uptime.

Typy okazji:

| Typ | Skąd |
| --- | --- |
| Zniżka | `discount > 0` u providera |
| Obniżka ceny | cena spadła o ≥2% względem poprzedniego snapshotu (trzymane 7 dni, znika gdy cena wróci) |
| Darmowy | model ma wariant `:free` |

## Jak to działa „na żywo”

1. GitHub Actions (`.github/workflows/tanitoken-snapshot.yml`) co 15 min pobiera ~370 modeli i ~1300 ofert providerów
   (ok. 5 s) i publikuje `snapshot.json` na gałęzi `tanitoken-data` (jeden nadpisywany commit, `main` zostaje czysty).
2. Landing i apka czytają snapshot z `raw.githubusercontent.com`, odświeżają co 5 min.
3. Po otwarciu modelu ceny providerów są pobierane prosto z OpenRouter (w apce co 60 s).
4. Fallbacki: `tanitoken/data/snapshot.json` z repo, a na końcu samo `/models` z OpenRouter.

Workflow z `schedule` działa dopiero na domyślnej gałęzi. Po merge’u odpal go raz ręcznie
(Actions → TaniToken snapshot → Run workflow), żeby od razu powstała gałąź `tanitoken-data`.
GitHub przy dużym obciążeniu potrafi opóźniać crony o kilka-kilkanaście minut.

## Landing page

Statyczny, bez builda. Na GitHub Pages: `https://nitve1.github.io/mfkig-notatnik/tanitoken/landing/`.
Lokalnie:

```
python3 -m http.server   # w katalogu głównym repo
# http://localhost:8000/tanitoken/landing/
```

## Apka mobilna (Android + iOS)

Expo SDK 57 / React Native. Jeden kod, dwa sklepy. Ekrany: Promocje (zniżki / obniżki / darmowe),
Modele (wyszukiwarka, sortowanie po cenie), Ulubione, karta modelu z kalkulatorem miesięcznego kosztu
i rankingiem providerów.

```
cd tanitoken/mobile
npm install
npx expo start          # skanujesz QR w Expo Go (Android / iOS)
```

Buildy w chmurze przez EAS (konto na expo.dev, `npm i -g eas-cli`, `eas login`):

| Cel | Komenda |
| --- | --- |
| APK do testów na Androidzie | `npm run build:android:apk` |
| Google Play (AAB) | `npm run build:android` |
| App Store / TestFlight | `npm run build:ios` (wymaga Apple Developer, 99 USD/rok) |
| Wysyłka do sklepów | `eas submit -p android` / `eas submit -p ios` |

Natywne projekty `android/` i `ios/` są generowane (`npx expo prebuild`) i nie siedzą w repo.
Identyfikator apki: `pl.tanitoken.app` (zmień w `mobile/app.json` przed publikacją, jeśli chcesz inny).

## Testy i skrypty

```
node --test tanitoken/core/pricing.test.mjs
node tanitoken/scripts/build-snapshot.mjs   # odświeża data/snapshot.json lokalnie
```

## Dalsze pomysły

- więcej źródeł niż OpenRouter (bezpośrednie cenniki providerów, Requesty, Together, Groq…) –
  `core/pricing.js` operuje na znormalizowanym formacie, wystarczy nowy adapter w `build-snapshot.mjs`,
- push o nowych zniżkach dla ulubionych modeli (expo-notifications + porównanie snapshotów),
- historia cen i wykresy.
