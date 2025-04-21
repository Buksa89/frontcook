**Dokumentacja Architektury Frontendowej - Aplikacja OmNomNom (React Native / Expo)**

**1. Wprowadzenie**

Niniejszy dokument opisuje architekturę frontendową aplikacji mobilnej OmNomNom, tworzonej w React Native z wykorzystaniem Expo. Celem jest stworzenie aplikacji do zarządzania przepisami kulinarnymi, umożliwiającej pracę offline oraz synchronizację danych z backendem Django przy użyciu WatermelonDB. Dokumentacja ta stanowi podstawę do implementacji, kładąc nacisk na przyjęte rozwiązania, ich uzasadnienie oraz logikę biznesową.

**2. Główne Założenia i Cele Architektury**

*   **Offline-First:** Aplikacja musi być w pełni funkcjonalna bez dostępu do internetu. Użytkownik może przeglądać, tworzyć i modyfikować swoje przepisy, tagi, listę zakupów w trybie offline. Dane są synchronizowane z serwerem, gdy połączenie jest dostępne.
*   **Synchronizacja WatermelonDB:** Wykorzystanie natywnego mechanizmu synchronizacji WatermelonDB jako podstawowego sposobu wymiany danych z backendem dla kluczowych modeli *użytkownika* (Przepisy, Składniki, Tagi, Lista Zakupów, Ustawienia Klienta, Profil Użytkownika, Powiadomienia).
*   **Spójność Identyfikatorów:** Klient generuje standardowe identyfikatory **UUID v4** dla nowo tworzonych lokalnie rekordów synchronizowanych tabel (np. Recipe, Tag, Ingredient, ShoppingItem, RecipeTag), aby zapewnić zgodność z backendem oczekującym UUID jako kluczy głównych.
*   **Zarządzanie Stanem Synchronizacji Per-Użytkownik:** Mechanizm synchronizacji musi poprawnie obsługiwać scenariusz wielu użytkowników na jednym urządzeniu, przechowując stan ostatniej synchronizacji (`lastPulledAt`) indywidualnie dla każdego użytkownika.
*   **Funkcjonalności Online-Only:** Przewidzenie mechanizmów dla funkcji wymagających stałego połączenia z internetem i pobierających dane bezpośrednio z API, bez zapisywania ich w lokalnej bazie (np. zarządzanie znajomymi, przeglądanie przepisów znajomych - "Stalking").
*   **Solidna Struktura:** Zastosowanie architektury opartej na modułach/domenach (feature-based) w celu zapewnienia skalowalności, łatwości utrzymania i testowania kodu.
*   **Separacja Odpowiedzialności:** Wyraźne oddzielenie logiki UI (komponenty, ekrany), logiki biznesowej (serwisy), zarządzania stanem (konteksty) oraz dostępu do danych (WatermelonDB dla danych offline, API dla danych online).
*   **Najlepsze Praktyki:** Unikanie obejść (workarounds), stosowanie sprawdzonych wzorców projektowych w React Native i Expo.
*   **Adaptacja Platformy/Środowiska:** Elastyczne dostosowanie działania aplikacji (szczególnie warstwy bazy danych) w zależności od środowiska (DEBUG vs Produkcja) za pomocą flagi `DEBUG`.
*   **Zarządzanie Danymi Offline Użytkownika:** Bezpieczne i logiczne obsłużenie danych utworzonych przez użytkownika przed pierwszym zalogowaniem.
*   **Efektywne Zarządzanie Obrazkami:** Lokalna obsługa obrazków przepisów użytkownika w celu zapewnienia dostępności offline i optymalizacji wydajności.
*   **Stylistyka "Monochrome":** Implementacja minimalistycznego, czytelnego i spójnego interfejsu użytkownika, który nie przytłacza i skupia się na funkcjonalności.
*   **Spójny Feedback dla Użytkownika:** Użycie komponentu `Toast` do informowania o sukcesach, ostrzeżeniach i błędach (w tym błędach walidacji formularzy), zamiast natywnych `Alert`. `Alert` zarezerwowany dla akcji wymagających jawnego potwierdzenia (np. usuwanie).

**3. Stos Technologiczny**

*   **Framework:** React Native (z Expo SDK)
*   **Nawigacja:** Expo Router (File-based Routing)
*   **Lokalna Baza Danych (Offline):** WatermelonDB
    *   Adapter Produkcyjny: `@nozbe/watermelondb/adapters/sqlite` (z JSI dla wydajności)
    *   Adapter Debugowy: `@nozbe/watermelondb/adapters/lokijs`
*   **Komunikacja API:** Fetch API (lub Axios) z dedykowanym klientem API (`apiClient.ts`)
*   **Zarządzanie Stanem Globalnym:** React Context API (`AuthContext`, `SyncStatusContext`)
*   **Zarządzanie Stanem Zapytań API (Opcjonalnie dla danych Online):** Rozważenie bibliotek typu React Query (TanStack Query) lub SWR do zarządzania stanem danych pobieranych bezpośrednio z API (np. przepisy znajomych).
*   **Przechowywanie Wrażliwych Danych:** `expo-secure-store` (dla refresh token)
*   **Przechowywanie Niewrażliwych Danych:** `@react-native-async-storage/async-storage` (dla access token, userId, flag konfiguracyjnych, **timestampów `lastPulledAt` per użytkownik**)
*   **Obsługa Plików Lokalnych:** `expo-file-system`, `expo-image-manipulator`
*   **Interakcje Drag & Drop:** `react-native-draggable-flatlist` (dla listy zakupów)
*   **Komponenty UI:** Standardowe komponenty React Native, `@expo/vector-icons`.
*   **Narzędzia Dodatkowe:**
    *   `react-native-toast-message` (dla powiadomień typu Toast)
    *   `eventemitter3` (dla `SyncService`)
    *   `@react-native-community/netinfo` (do sprawdzania stanu sieci)
    *   **`uuid`** (do generowania identyfikatorów UUID v4)
    *   **`react-native-get-random-values`** (polyfill dla `crypto.getRandomValues()` wymaganego przez `uuid`)

**4. Stylistyka "Monochrome" i Założenia UX/UI**

*   **Filozofia:** Minimalizm, czytelność, spokój, funkcjonalność ponad formą. Design ma być neutralnym tłem, nie przytłaczać i nie męczyć wzroku.
*   **Paleta Kolorów:**
    *   **Baza:** Odcienie szarości (od bardzo jasnych `#f8f9fa` dla tła, przez biel `#ffffff` dla kart, po ciemniejsze `#2d3748` dla tekstu) i neutralne odcienie pośrednie (`#718096`, `#a0aec0`, `#e2e8f0`).
    *   **Akcent:** Spokojny niebieski (`#5c7ba9`) używany oszczędnie do wyróżnienia aktywnych elementów i głównych akcji.
    *   **Sygnalizacja:** Stonowany czerwony (`#e53e3e`) dla akcji destrukcyjnych/błędów, zielony (`#48bb78`) dla sukcesu, żółty (`#ecc94b`) dla ostrzeżeń.
    *   **Zasada:** Unikanie gradientów, mocnych cieni, wielu jaskrawych kolorów. Nacisk na kontrast i dostępność.
*   **Typografia:**
    *   **Czcionka:** Systemowa (San Francisco/Roboto).
    *   **Hierarchia:** Uzyskiwana przez rozmiar (np. Tytuł ekranu 18-20pt, Tytuł sekcji 16pt, Tekst główny 15-16pt, Tekst pomocniczy 13-14pt) i wagę (np. Bold/Semibold dla tytułów, Regular dla reszty).
    *   **Interlinia:** Dostosowana do komfortu czytania (ok. 1.4-1.5).
*   **Styl Komponentów:**
    *   **Przyciski:** Proste, z lekkim zaokrągleniem (`borderRadius: 6-10`), wypełnione (kolor akcentu `active` lub szary/inny dla `secondary`) lub ikonowe (`iconOnly`). Spójna wysokość (np. 44-50px). Reużywalny komponent `Button` (`src/components/Button.tsx`) obsługuje warianty, stany `disabled` i `isLoading`.
    *   **Inputy:** Jasne tło (`#f7f7f7` lub `#f1f5f9`), delikatna ramka (`#eee` lub `#e2e8f0`), zaokrąglenie (`borderRadius: 10`), czytelny tekst, ikony wewnątrz (`MaterialIcons`).
    *   **Karty:** Białe tło, lekkie zaokrąglenie, subtelny cień lub ramka. Przejrzysty układ.
    *   **Checkboxy:** Kwadratowe ikony (`MaterialIcons` `check-box`/`check-box-outline-blank`), zmiana koloru wskazująca stan.
    *   **Modale/Menu:** Czysty wygląd, tło overlay (`rgba(0,0,0,0.4)`), zaokrąglone górne rogi dla menu wysuwanych od dołu (`MainMenu`), spójne przyciski.
*   **UX i Interakcje:**
    *   **Nawigacja:** Użycie Expo Router z layoutami grupowymi (`(auth)`, `(tabs)`) i Stackiem. Zaimplementowano niestandardowy nagłówek dla `(tabs)` z wyszukiwarką i `MainMenu`. Dla `(auth)` zaimplementowano nagłówek ze stałym przyciskiem "Wstecz" nawigującym do listy przepisów.
    *   **Feedback:** Spójne użycie `Toast` (`react-native-toast-message` z `src/components/Toast.tsx`) do informowania o sukcesach (np. logowanie, wysłanie linku resetującego), ostrzeżeniach (np. walidacja formularzy) i błędach (w tym błędach API z przetłumaczonymi komunikatami). `Alert` używany tylko do krytycznych potwierdzeń (np. usuwanie). Wskaźniki ładowania (`ActivityIndicator`) w przyciskach i globalnie podczas inicjalizacji.
    *   **Animacje:** Minimalne, subtelne (`LayoutAnimation.Presets.easeInEaseOut`, fade dla modali, animacja wyszukiwarki).
    *   **Responsywność:** Układ dostosowany do ekranów mobilnych.

**5. Struktura Katalogów**

```
src/
|-- app/                   # (Expo Router) Definicje ekranów/nawigacji
|   |-- (auth)/            # Grupa ekranów autoryzacji
|   |   |-- _layout.tsx      # Layout Stack dla grupy (auth) z niestandardowym headerLeft
|   |   |-- index.tsx        # Komponent przekierowujący (Redirect) na podstawie stanu auth
|   |   |-- login.tsx        # Ekran logowania
|   |   |-- register.tsx     # Ekran rejestracji
|   |   |-- forgot-password.tsx # Ekran resetowania hasła
|   |-- (tabs)/            # Grupa ekranów z zakładkami (główna część aplikacji)
|   |   |-- _layout.tsx      # Layout Stack dla grupy (tabs) z niestandardowym nagłówkiem i MainMenu
|   |   |-- recipes.tsx      # Ekran listy przepisów (kontener)
|   |   |-- shoppingList.tsx # Ekran listy zakupów (kontener)
|   |   |-- settings.tsx     # Ekran ustawień (TODO)
|   |-- (screens)/         # Grupa dla ekranów bez zakładek (np. detale, edycja)
|   |   |-- RecipeDetailScreen/ (TODO)
|   |   |-- RecipeManagementScreen/ (TODO)
|   |-- _layout.tsx          # Główny layout aplikacji (renderuje AppRoot)
|   |-- debug.tsx          # Ekran debugowania
|   |-- index.tsx            # Przekierowanie na startowy ekran (np. do grupy (auth))
|-- assets/                # Statyczne zasoby (obrazy, czcionki)
|-- components/            # Globalne, reużywalne komponenty UI
|   |-- Button.tsx         # Przycisk z wariantami i stanami ładowania/wyłączenia
|   |-- HeaderDeleteButton.tsx # Przycisk usuwania do nagłówka
|   |-- MainMenu.tsx       # Wysuwane menu główne aplikacji
|   |-- Toast.tsx          # Konfiguracja i wrapper dla react-native-toast-message
|-- config/                # Konfiguracja
|   |-- env.ts             # Zmienne środowiskowe (API_URL, DEBUG)
|   |-- theme.ts           # Paleta kolorów, typografia, style komponentów (np. ButtonStyles)
|-- contexts/              # Globalne konteksty React
|   |-- AuthContext.tsx    # Zarządzanie stanem autentykacji, funkcje login/logout/register/reset, tłumaczenie błędów API
|   |-- SyncStatusContext.tsx # Śledzenie statusu synchronizacji WDB
|-- database/              # Logika WatermelonDB
|   |-- index.ts           # Inicjalizacja bazy, wybór adaptera
|   |-- schema.ts          # Definicja schematu bazy danych (wersja 2)
|   |-- models/            # Modele WDB (Recipe, Tag, Ingredient, ShoppingItem, etc.) - metody tworzące generują UUID
|   |-- migrations.ts      # Migracje schematu
|-- features/              # Główne moduły/funkcjonalności (komponenty specyficzne dla modułu)
|   |-- recipes/
|   |   |-- components/    # RecipeCard, PendingRecipeCard, AddRecipeMenu, FilterMenu, SortMenu, TagList
|   |   |-- types.ts       # FilterState, SortOption
|   |-- shoppingList/
|   |   |-- components/    # (Jeśli potrzebne specyficzne komponenty)
|   |-- (inne moduły jak friends, settings, notifications...)
|-- hooks/                 # Globalne, reużywalne hooki
|-- services/              # Logika biznesowa, API, synchronizacja
|   |-- api/               # Moduły komunikacji z API (apiClient, authApi, syncApi, ...)
|   |-- auth/              # Serwis i storage autentykacji (authService, authStorage, authUserIdProvider) - AuthStorage zarządza LPA per user
|   |-- sync/              # Serwis synchronizacji WatermelonDB (syncService) - używa LPA z AuthStorage
|   |-- image/             # Serwis zarządzania lokalnymi obrazkami (imageService)
|   |-- friends/           # (TODO) Serwis dla znajomych
|-- types/                 # Globalne typy TypeScript
|-- utils/                 # Globalne funkcje pomocnicze (imageProcessor, ingredientParser, shoppingItemParser, timeFormat)
|-- App.tsx                # Główny komponent aplikacji (inicjalizacja, providery, import polyfilla 'react-native-get-random-values')
```

**6. Kluczowe Komponenty Architektury**

*   **Warstwa Bazy Danych (`src/database`)**
    *   **Cel:** Dostęp do danych *użytkownika* offline, synchronizacja.
    *   **Kluczowe Elementy:**
        *   **`index.ts`:** Wybór adaptera (SQLite/LokiJS), inicjalizacja `Database`.
        *   **`schema.ts`:** Wersja 2. Definiuje tabele z opcjonalnym `user_id` (typ `string`) i timestampami (typ `number`).
        *   **`models/`:** Modele WDB z logiką. Metody tworzące nowe rekordy (`createItem`, `createTag`, `createLink`, `upsertFromFormData` dla nowych `Recipe`, `createIngredientsFromText`) **generują i przypisują standardowe identyfikatory UUID v4**. Użycie `getCurrentUserId` z `authUserIdProvider`. Modele `UserProfile` i `RecipeImageLocal` nie generują UUID po stronie klienta.
        *   **`migrations.ts`:** Definicja migracji (obecnie do v2).

*   **Warstwa Komunikacji API (`src/services/api`)**
    *   **Cel:** Komunikacja z backendem REST API.
    *   **Kluczowe Elementy:**
        *   **`apiClient.ts`:** Centralny klient HTTP. Automatyczne dodawanie tokenu Bearer. Zaimplementowana logika odświeżania tokenu przy błędzie 401 (wywołuje `authApi.refreshToken`). Obsługa `FormData`. Tłumaczenie błędów w `parseErrorResponse`.
        *   **`authApi.ts`:** Funkcje dla endpointów autoryzacji. Zawiera dedykowaną funkcję `refreshToken`.
        *   **`syncApi.ts`:** Implementuje funkcje `pullChanges` i `pushChanges` dla endpointu `/api/sync/`. **Zawiera logowanie pełnych payloadów PUSH i odpowiedzi PULL w trybie DEBUG**. Oczekuje `user_id` jako string i timestampów jako number od serwera.

*   **Serwisy (`src/services`)**
    *   **Cel:** Logika biznesowa, zarządzanie stanem zewnętrznym.
    *   **Kluczowe Serwisy:**
        *   **`AuthService` (`src/services/auth/authService.ts`):** Zarządza procesem logowania/wylogowania. Wywołuje `authApi` i zapisuje/czyści dane w `AuthStorage`. Implementuje logikę przypisywania danych offline. Metoda `logout` **próbuje wymusić synchronizację** (`SyncService.triggerManualSync`) przed wywołaniem API logout i czyszczeniem danych.
        *   **`AuthStorage.ts`:** Odpowiada za zapis i odczyt tokenów, `userId` oraz **przechowuje timestamp ostatniej synchronizacji (`lastPulledAt`) indywidualnie dla każdego użytkownika** w AsyncStorage.
        *   **`authUserIdProvider.ts`:** Dostarcza asynchroniczną funkcję `getCurrentUserId` do bezpiecznego pobierania ID użytkownika w modelach WDB.
        *   **`SyncService` (`src/services/sync/syncService.ts`):** Zarządza cyklem synchronizacji WDB. **Odczytuje `lastPulledAt` specyficzne dla użytkownika z `AuthStorage`** przed fazą PULL i używa go w zapytaniu do API. **Zapisuje nowy `timestamp` w `AuthStorage`** po udanym PULL. Odczytuje świeży `userLPA` przed fazą PUSH. Używa `syncApi`.
        *   **`ImageService` (`src/services/image/imageService.ts`):** Zarządza lokalnymi obrazkami przepisów użytkownika.
        *   **`FriendsService` (TODO):** Logika znajomych.

*   **Konteksty (`src/contexts`)**
    *   **Cel:** Globalny stan.
    *   **Kluczowe Konteksty:**
        *   **`AuthContext.tsx`:** Stan `isAuthenticated`, `userId`, `accessToken`, `isAuthCheckLoading`. Metody `login`, `logout`, `register`, `resetPassword`. **Tłumaczy błędy API** na polskie komunikaty przed pokazaniem `Toast`.
        *   **`SyncStatusContext.tsx`:** Stan synchronizacji (`status`, `lastError`, `logs`), metoda `triggerSync`.

*   **Interfejs Użytkownika (UI)**
    *   **Cel:** Prezentacja, interakcja.
    *   **Nawigacja:** Expo Router. Layout `(auth)` z przyciskiem "Wstecz" do `/recipes`. Layout `(tabs)` z niestandardowym nagłówkiem (wyszukiwarka, `MainMenu`).
    *   **Komponenty Reużywalne:** `Button`, `MainMenu`, `Toast`, etc.
    *   **Ekrany:** Ekrany logowania/rejestracji/resetu używają `Button` i `Toast`. `RecipeListScreen` i `ShoppingListScreen` integrują odpowiednie komponenty i logikę WDB.
    *   **Polyfill UUID:** Plik `App.js` lub `src/App.tsx` importuje **`react-native-get-random-values`** na samym początku, aby zapewnić działanie generowania UUID.

**7. Przepływ Danych i Synchronizacja**

*   **Dane Użytkownika:** Jak opisano wcześniej. Kluczowe jest, że **`lastPulledAt` jest zarządzane per użytkownik** w `AuthStorage`, a `SyncService` używa tego stanu zamiast wewnętrznego stanu WDB. Nowe rekordy tworzone lokalnie mają **UUID v4**. Serwer musi akceptować UUID jako ID i zwracać `user_id` jako string oraz timestampy jako number.
*   **Dane Znajomych:** Bez zmian (API jako źródło).

**8. Implementacja Specyficznych Wymagań**

*   **Dane Offline i Pierwsze Logowanie:**
    *   **Implementacja:** `AuthService` po odebraniu flagi `is_first_ever_login: true` z API `/login/` uruchamia metodę `assignOrphanedDataToUser`, która w transakcji WDB aktualizuje `userId` z `null` na ID zalogowanego użytkownika (jako string) dla wszystkich kwalifikujących się rekordów.
    *   **Uzasadnienie:** Bezpieczne przypisanie danych tylko przy pierwszym logowaniu użytkownika w systemie.
*   **Zarządzanie Obrazkami Przepisów (Użytkownika):**
    *   **Implementacja:** Użycie lokalnego modelu `RecipeImageLocal` (nie synchronizowanego) w WDB do śledzenia lokalnych ścieżek (`local_path`, `local_thumbnail_path`) i powiązanego `original_remote_url`. `ImageService` monitoruje `Recipe.imageUrl`, pobiera, przetwarza (`utils/imageProcessor.ts`), zapisuje pliki i aktualizuje `RecipeImageLocal`. UI (`RecipeCard`, `RecipeHeader`) obserwuje `RecipeImageLocal`, aby uzyskać ścieżki.
    *   **Uzasadnienie:** Dostępność offline, separacja logiki, reaktywność UI, unikanie synchronizacji plików.
*   **Tryb `DEBUG`:**
    *   **Implementacja:** Flaga `DEBUG` kontroluje wybór adaptera WDB (`LokiJS` vs `SQLite`) i włączenie JSI w `database/index.ts`.
    *   **Uzasadnienie:** Łatwe przełączanie środowisk dev/prod.
*   **Mergowanie `ShoppingItem`:**
    *   **Implementacja:** Logika sprawdzania (`findExisting`) i łączenia duplikatów (aktualizacja `amount`) zaimplementowana w metodach modelu `ShoppingItem.addItemFromText`, `ShoppingItem.toggleChecked`, `ShoppingItem.updateFromText`.
    *   **Uzasadnienie:** Poprawa UX listy zakupów.
*   **UI - Przepisy Oczekujące:**
    *   **Implementacja:** `RecipeListScreen` używa `SectionList` lub podobnego mechanizmu do wyświetlania `pendingRecipes` (z `PendingRecipeCard`) i `approvedRecipes` (z `RecipeCard`) w osobnych sekcjach.
    *   **Uzasadnienie:** Jasny przepływ weryfikacji przepisów.
*   **UI - Zmiana Kolejności:**
    *   **Implementacja (`ShoppingListScreen`):** Użycie `react-native-draggable-flatlist`. Funkcja `handleDragEnd` wywołuje metodę statyczną `ShoppingItem.bulkUpdateOrder` w transakcji `database.write`, aby zapisać nową kolejność.
    *   **Implementacja (`TagScreen` - TODO):** Analogiczne rozwiązanie będzie potrzebne dla zarządzania kolejnością tagów.
    *   **Uzasadnienie:** Intuicyjna interakcja dla użytkownika.

**9. Przyszłe Rozważania / TODO**

*   **Implementacja Funkcjonalności Znajomych:**
    *   Stworzenie `friendsApi.ts` i `FriendsService.ts`.
    *   Stworzenie ekranów i komponentów w `features/friends/` do zarządzania znajomościami (wysyłanie/akceptacja zaproszeń - online-only).
    *   **Implementacja Przeglądania Przepisów Znajomych (Stalking):**
        *   Stworzenie ekranu `FriendRecipesScreen`.
        *   Implementacja hooka `useFriendRecipes` do pobierania danych z API (z paginacją, obsługą ładowania/błędów).
        *   Adaptacja `RecipeCard` do wyświetlania danych z API (w tym obrazków z URL).
*   Implementacja interfejsu Drag & Drop do zmiany kolejności tagów i listy zakupów.
*   Obsługa błędów API w sposób bardziej przyjazny dla użytkownika.
*   Optymalizacja pobierania i cache'owania obrazków.
*   Potencjalne wprowadzenie biblioteki do zarządzania stanem zapytań API (React Query/SWR) dla funkcji online-only.
*   Testy jednostkowe i integracyjne.
*   Implementacja Funkcjonalności Znajomych.
*   Implementacja D&D dla tagów
*   Optymalizacje wydajności (np. cache'owanie, optymalizacja zapytań WDB)..
*   Testy jednostkowe i integracyjne.