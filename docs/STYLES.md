**Dokumentacja Stylistyczna – Motyw "Monochrome" (Aplikacja OmNomNom)**

**1. Filozofia i Główne Założenia**

Styl marki "Monochrome" dla aplikacji OmNomNom opiera się na następujących zasadach:

*   **Minimalizm:** Interfejs ma być czysty, uporządkowany i pozbawiony zbędnych elementów wizualnych. Skupiamy się na treści i funkcjonalności.
*   **Czytelność:** Priorytetem jest łatwość odczytu informacji. Używamy wysokiego (ale nie męczącego) kontrastu i przejrzystej typografii.
*   **Neutralność i Spokój:** Paleta barw jest stonowana, oparta głównie na odcieniach szarości z jednym, delikatnym akcentem kolorystycznym. Unikamy jaskrawych barw, gradientów i skomplikowanych efektów wizualnych. Design ma być przyjazny dla oka, niezależnie od pory dnia i otoczenia.
*   **Intuicyjność (UX):** Interfejs ma być przewidywalny i łatwy w obsłudze. Interakcje i nawigacja powinny być oczywiste dla użytkownika.
*   **Funkcjonalność ponad Formą:** Design wspiera użytkownika w realizacji zadań (zarządzanie przepisami, lista zakupów), nie odciągając uwagi od głównego celu aplikacji. Interfejs ma "znikać" w tle.
*   **Subtelne Animacje:** Animacje są używane oszczędnie, głównie do zapewnienia płynnych przejść (np. fade-in/out, delikatny slide) i feedbacku dla użytkownika. Czas trwania animacji powinien być krótki (preferowane 150-200ms).
*   **Spójność:** Zdefiniowane style (kolory, typografia, komponenty) muszą być stosowane konsekwentnie we wszystkich częściach aplikacji.

**2. Paleta Kolorów**

Paleta jest zbudowana na bazie neutralnych szarości z jednym kolorem akcentującym (niebieskim).

*   **Podstawowe Kolory Tła:**
    *   `backgroundPrimary`: `#FFFFFF` (Czysta biel - główne tło treści)
    *   `backgroundSecondary`: `#F7FAFC` (Bardzo jasny, lekko chłodny szary - tła dla sekcji, kart, inputów)
    *   `background Tertiary`: `#F1F5F9` (Nieco ciemniejszy szary - tła dla elementów w stanie "hover" lub nieaktywnych)

*   **Kolory Tekstu:**
    *   `textPrimary`: `#2D3748` (Ciemny, czytelny szary/grafitowy - główny tekst)
    *   `textSecondary`: `#4A5568` (Średni szary - tekst drugorzędny, etykiety)
    *   `textTertiary`: `#718096` (Jaśniejszy szary - hinty, opisy, mniej ważne informacje)
    *   `textPlaceholder`: `#A0AEC0` (Bardzo jasny szary - tekst w placeholderach inputów)
    *   `textOnAccent`: `#FFFFFF` (Biały - tekst na przyciskach z tłem akcentującym)
    *   `textDisabled`: `#CBD5E0` (Bardzo jasny szary - tekst na elementach wyłączonych)

*   **Kolory Akcentujące (Niebieski):**
    *   `accentPrimary`: `#5c7ba9` (Główny kolor akcentujący - przyciski, linki, aktywne stany)
    *   `accentHover`: `#4a628a` (Ciemniejszy odcień dla stanu :hover/:pressed)
    *   `accentDisabled`: `#cbd5e0` (Bardzo jasny, wyszarzony niebieski/szary - tło wyłączonych przycisków głównych)
    *   `accentSubtle`: `#eef2ff` (Bardzo jasny niebieski - tło dla zaznaczonych elementów listy, np. tagów)

*   **Kolory Ramek i Separatorów:**
    *   `borderPrimary`: `#E2E8F0` (Bardzo delikatna szara ramka/separator)
    *   `borderSecondary`: `#CBD5E0` (Nieco ciemniejsza ramka, np. dla inputów w stanie focus)

*   **Kolory Informacyjne (Feedback):**
    *   `success`: `#48BB78` (Spokojna zieleń - np. toasty sukcesu)
    *   `error`: `#E53E3E` (Spokojna czerwień - np. toasty błędów, walidacja)
    *   `warning`: `#FFA000` (Spokojny pomarańczowy/żółty - np. toasty ostrzegawcze)
    *   `info`: `#5c7ba9` (Kolor akcentujący - np. toasty informacyjne)

**Uwaga:** Należy zadbać o odpowiedni kontrast pomiędzy kolorem tekstu a tłem, zgodnie z wytycznymi dostępności (WCAG AA).

**3. Typografia**

*   **Rodzina Czcionek:** Systemowa czcionka sans-serif (San Francisco na iOS, Roboto na Android). Zapewnia to natywny wygląd i dobrą wydajność bez potrzeby ładowania dodatkowych zasobów.
*   **Skala Rozmiarów:**
    *   `H1 (Tytuł Ekranu)`: ~28px, Bold/Semibold
    *   `H2 (Tytuł Sekcji)`: ~18px-20px, Semibold
    *   `H3 (Podtytuł)`: ~16px-18px, Semibold/Medium
    *   `Body (Główny Tekst)`: ~15px-16px, Regular
    *   `Label (Etykiety Inputów)`: ~14px-15px, Medium/Semibold
    *   `Caption/Hint (Mały Tekst)`: ~12px-13px, Regular
    *   `Button Text`: ~16px, Semibold/Bold
*   **Wagi Czcionek:** Głównie `Regular` (400) i `Semibold` (600). `Bold` (700) tylko dla najważniejszych nagłówków.
*   **Interlinia:** Ustawiona na wartość zapewniającą dobrą czytelność (np. 1.4 - 1.5 * rozmiar czcionki).
*   **Kolor:** Domyślnie `textPrimary`, z użyciem `textSecondary` i `textTertiary` dla hierarchii.

**4. Przyciski (Buttons)**

*   **Styl Ogólny:** Proste, czyste, z zaokrąglonymi rogami (np. `borderRadius: 8` lub `10`). Spójny padding pionowy i poziomy.
*   **Przycisk Podstawowy (Primary):**
    *   Tło: `accentPrimary` (`#5c7ba9`)
    *   Tekst: `textOnAccent` (`#FFFFFF`), Semibold/Bold
    *   Stan `:pressed`: Tło ciemnieje do `accentHover` (`#4a628a`)
    *   Stan `:disabled`: Tło `accentDisabled` (`#cbd5e0`), tekst `textDisabled` lub `textTertiary`.
*   **Przycisk Drugorzędny (Secondary/Outline):**
    *   Tło: Przezroczyste lub `backgroundPrimary` (`#FFFFFF`)
    *   Ramka: 1px `accentPrimary` (`#5c7ba9`)
    *   Tekst: `accentPrimary` (`#5c7ba9`), Semibold
    *   Stan `:pressed`: Tło zmienia się na bardzo subtelny `accentSubtle` lub `backgroundTertiary`.
    *   Stan `:disabled`: Ramka i tekst w kolorze `borderSecondary` lub `textDisabled`.
*   **Przycisk Tekstowy/Link:**
    *   Tło: Brak
    *   Ramka: Brak
    *   Tekst: `accentPrimary` (`#5c7ba9`), Semibold/Medium
    *   Stan `:pressed`: Lekkie przyciemnienie tekstu lub subtelne tło (`backgroundTertiary`).
    *   Stan `:disabled`: Tekst `textDisabled`.
*   **Floating Action Button (FAB):**
    *   Okrągły.
    *   Tło: `accentPrimary` (`#5c7ba9`).
    *   Ikona: Biała (`#FFFFFF`), rozmiar ~24px.
    *   Subtelny cień (zgodny ze stylem Material Design lub iOS).

**5. Pola Wprowadzania (Inputs)**

*   **Styl Ogólny:** Zaokrąglone rogi (spójne z przyciskami). Wysokość zapewniająca łatwe trafienie palcem (np. 48-50px).
*   **Tło:** `backgroundSecondary` (`#F7FAFC`) lub `#F1F5F9`.
*   **Ramka:** 1px `borderPrimary` (`#E2E8F0`).
*   **Tekst:** `textPrimary` (`#2D3748`), rozmiar `Body`.
*   **Placeholder:** `textPlaceholder` (`#A0AEC0`).
*   **Stan `:focus`:** Ramka zmienia kolor na `accentPrimary` (`#5c7ba9`) lub `borderSecondary` (`#CBD5E0`). Możliwy bardzo subtelny cień wewnętrzny (opcjonalnie).
*   **Stan `:error`:** Ramka zmienia kolor na `error` (`#E53E3E`). Można dodać ikonę błędu.
*   **Ikony wewnątrz Inputu:** Jeśli używane (np. lupa, oko), umieszczone po lewej lub prawej stronie z odpowiednim paddingiem dla tekstu. Kolor ikony: `textPlaceholder` lub `textTertiary`.

**6. Ikony**

*   **Zestaw:** Używać spójnego zestawu ikon, np. `MaterialIcons` lub `Feather` (dostępne w `@expo/vector-icons`).
*   **Cel:** Głównie do wsparcia nawigacji, akcji i poprawy czytelności, nie jako dekoracja.
*   **Rozmiar:** Standardowe rozmiary (np. 20px, 24px).
*   **Kolor:** Domyślnie `textSecondary` lub `textTertiary` (`#4A5568`, `#718096`). Kolor `accentPrimary` zarezerwowany dla ikon reprezentujących główne akcje (np. w FAB) lub aktywny stan. Kolor `error` dla ikon błędów.

**7. Layout i Odstępy**

*   **Whitespace:** Stosować hojnie białą przestrzeń, aby interfejs był "przewiewny" i nie przytłaczał.
*   **Skala Odstępów:** Używać spójnej skali dla marginesów i paddingów (np. opartej na 4px lub 8px: 4, 8, 12, 16, 20, 24, 32...).
*   **Separatory:** Używać subtelnych linii (`borderPrimary`) lub różnic w kolorze tła (`backgroundSecondary`) zamiast grubych ramek.
*   **Układ:** Preferować proste, pionowe układy dla list i formularzy na urządzeniach mobilnych.

**8. Animacje**

*   **Subtelność:** Animacje powinny być delikatne i szybkie (150-200ms).
*   **Typy:** Głównie `Fade` (zanikanie/pojawianie się) i `Slide` (delikatne wsuwanie/wysuwanie, np. dla modali od dołu).
*   **Cel:** Poprawa płynności przejść i dostarczanie wizualnego feedbacku na akcje użytkownika. Unikać animacji czysto dekoracyjnych, pulsujących, podskakujących itp.

**Podsumowanie:**

Styl "Monochrome" ma na celu stworzenie spokojnego, eleganckiego i wysoce funkcjonalnego interfejsu, który nie rozprasza użytkownika. Kluczem jest konsekwencja w stosowaniu zdefiniowanej palety kolorów, typografii oraz prostych, czystych wzorców komponentów UI.

---

Czy ta dokumentacja stylu jest wystarczająco szczegółowa i zgodna z Twoją wizją estetyki "Monochrome"?