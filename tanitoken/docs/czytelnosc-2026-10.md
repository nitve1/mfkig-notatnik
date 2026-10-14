# Czytelność i wydajność LightTokenz (audyt 2026-10-14)

Pomiar: kontrast WCAG 2.x liczony z kolorów tekstu i tła; tło brane z zrzutu ekranu (mediana) oraz najgorszy
przypadek (karta na środku plamy tła). Norma AA: 4,5:1 dla zwykłego tekstu, 3:1 dla dużego (≥ 24 px albo ≥ 18,7 px pogrubiony).

## Wyniki (stan obecny, plamy 67%)

| Gdzie | Tekst | Kontrast | AA |
| --- | --- | --- | --- |
| Karta na pomarańczowej plamie | szary `ink2` #b4b0cc | 2,8 | nie |
| Karta na pomarańczowej plamie | jasnoszary `ink3` #7e7a98 | 1,4 | nie |
| Karta na pomarańczowej plamie | niebieski kategorii #6d8cff | 1,9 | nie |
| Karta na niebieskiej plamie | szary `ink2` | 4,1 | nie |
| Ciemne miejsca tła | `ink3` | 4,2 do 4,8 | na granicy |
| Kafel Wideo #ffa23a 85% | biały | 2,7 | nie |
| Kafel Obraz #ff6fa3 85% | biały | 3,5 | tylko duży tekst |
| Kafel Tekst / Kod | biały | 4,1 | tylko duży tekst |

## Zalecenia

Kolory i tło
1. Stonować plamy tła do 25–40% (albo trzymać kolor tylko przy krawędziach, środek z listą ciemny).
2. Pod szkłem równe przyciemnienie 55% (zamiast 22%) i słabszy połysk (0.12 → 0.05 → 0.03).
3. `ink2` #b4b0cc → #c9c5dd, `ink3` #7e7a98 → #a29eba, niebieski etykiet #6d8cff → #8aa2ff.
4. Kafle kategorii pełne, ciemniejsze tony z białym tekstem ≥ 4,5:1: Tekst #4a63d8 (5,2), Kod #7a3fe0 (5,8),
   Obraz #c2185b (5,9), Wideo #a8530a (5,4).

Wielkości
5. Najmniejszy tekst 11,5 px → 12,5 px (lepiej 13); jasnoszary tylko od 12,5 px w górę.
6. Cele dotyku min. 48 dp (Android): segmenty filtrów mają ok. 38 dp, pigułki ok. 36 dp → wyższe.
7. Skalowanie tekstu systemowego zostaje (do 1,3x), sprawdzić układ przy 1,3x na 360 dp.

Wydajność
8. Połysk kart jako osobne SVG w każdej karcie listy jest drogi na Androidzie (dodatkowy widok na kartę).
   Zamiast tego natywny gradient w stylu (`experimental_backgroundImage: linear-gradient(...)`, nowa
   architektura RN) albo `expo-linear-gradient`: bez dodatkowych warstw SVG.
9. Tło (siatka gradientów) jako jeden obrazek PNG/WebP zamiast SVG z 4 elipsami: rysowany raz, tani.
10. Na webie rozmycie (backdrop-filter) na każdej karcie jest kosztowne przy przewijaniu; zostawić na pasku
    i kaflach, karty bez rozmycia (wyglądają tak samo przy przyciemnieniu 55%).
11. Pełne sprawdzanie cen co 30 min (ok. 430 zapytań, 3 MB): domyślnie tylko przez Wi-Fi, na danych komórkowych
    tylko obserwowane modele.
12. Snapshot w paczce 1,74 MB parsowany przy starcie: przenieść opisy (`desc`) do osobnego pliku wczytywanego
    przy otwarciu karty modelu.
