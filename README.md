# MFKiG Indie Notes

Notatnik do testowania gier indie na **37. MFKiG (Łódź, 2026)**. Działa w przeglądarce jako aplikacja (PWA), zrobiony pod iPhone'a.

**Apka:** https://nitve1.github.io/mfkig-notatnik/

## Instalacja na iPhonie

1. Otwórz link w **Safari**.
2. Udostępnij → **Do ekranu początkowego**.
3. Odpalaj z ikony. Działa offline, pełny ekran, a iOS nie czyści zapisanych danych.

## Co umie

- 29 gier z line-upu: opis, okładka, screeny, trailer ze Steama (odtwarzany w apce), dane: premiera, gatunki, platformy, język PL.
- Gry spoza Steama: dane z itch.io albo przyciski szukania. Twoje zdjęcie staje się okładką kafelka.
- **Zdjęcia, wideo** (aparat albo galeria), **głosówki** nagrywane w apce.
- **Notatki** z autozapisem, przycisk „Wstaw godzinę”, szablon recenzencki.
- Status: zagrane / rozmowa z devem / kontakt / do artykułu / follow-up, ocena 1–5, stoisko, kontakt, link.
- Filtry, wyszukiwarka (też po treści notatek), sortowanie, pasek postępu.
- **Eksport**:
  - „Wyślij paczkę” w kafelku: udostępnia notatki + pliki (AirDrop, Pliki, mail).
  - Menu → ZIP wszystkiego: folder per gra (`notatki.md` + media), `RAPORT.md`, `backup.json`.
  - Menu → Kopiuj raport: markdown ze wszystkimi notatkami do schowka.
  - Menu → Przywróć z kopii: wczytuje ZIP z eksportu (np. na drugim telefonie).
- Dodawanie gier spoza listy.

Dane (notatki, zdjęcia, nagrania) są **tylko na telefonie** (IndexedDB), nic nie idzie na serwer. Po imprezie zrób eksport.

## Aktualizacja danych gier

```
node tools/fetch-steam.mjs    # Steam + itch -> data/games.json
node tools/fetch-images.mjs   # okładki do img/games (offline)
```

Line-up: `tools/lineup.json`. Ręczne poprawki (appid, link itch, brak Steama): `tools/overrides.json`.
Po zmianie plików apki podbij `VERSION` w `sw.js`, żeby telefony pobrały nową wersję.

---

## LightTokenz (osobny projekt, dawniej TaniToken)

W katalogu [`tanitoken/`](tanitoken/) jest niezależna apka: porównywarka cen API modeli AI (OpenRouter) z promocjami na żywo. Landing page, apka Android/iOS (Expo) i snapshot cen co 15 min z GitHub Actions. Szczegóły w [`tanitoken/README.md`](tanitoken/README.md).
