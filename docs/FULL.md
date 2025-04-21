**Dokumentacja Architektury Frontendowej - Aplikacja OmNomNom (React Native / Expo)**

**1. Wprowadzenie**

Niniejszy dokument opisuje architekturę frontendową aplikacji mobilnej OmNomNom, tworzonej w React Native z wykorzystaniem Expo. Celem jest stworzenie aplikacji do zarządzania przepisami kulinarnymi, umożliwiającej pracę offline oraz synchronizację danych z backendem Django przy użyciu WatermelonDB. Dokumentacja ta stanowi podstawę do implementacji, kładąc nacisk na przyjęte rozwiązania, ich uzasadnienie oraz logikę biznesową.

**2. Główne Założenia i Cele Architektury**

*   **Offline-First:** Aplikacja musi być w pełni funkcjonalna bez dostępu do internetu. Użytkownik może przeglądać, tworzyć i modyfikować swoje przepisy, tagi, listę zakupów w trybie offline. Dane są synchronizowane z serwerem, gdy połączenie jest dostępne.
*   **Synchronizacja WatermelonDB:** Wykorzystanie natywnego mechanizmu synchronizacji WatermelonDB jako podstawowego sposobu wymiany danych z backendem dla kluczowych modeli *użytkownika* (Przepisy, Składniki, Tagi, Lista Zakupów, Ustawienia Klienta, Profil Użytkownika, Powiadomienia).
*   **Funkcjonalności Online-Only:** Przewidzenie mechanizmów dla funkcji wymagających stałego połączenia z internetem i pobierających dane bezpośrednio z API, bez zapisywania ich w lokalnej bazie (np. zarządzanie znajomymi, przeglądanie przepisów znajomych - "Stalking").
*   **Solidna Struktura:** Zastosowanie architektury opartej na modułach/domenach (feature-based) w celu zapewnienia skalowalności, łatwości utrzymania i testowania kodu.
*   **Separacja Odpowiedzialności:** Wyraźne oddzielenie logiki UI (komponenty, ekrany), logiki biznesowej (serwisy), zarządzania stanem (konteksty) oraz dostępu do danych (WatermelonDB dla danych offline, API dla danych online).
*   **Najlepsze Praktyki:** Unikanie obejść (workarounds), stosowanie sprawdzonych wzorców projektowych w React Native i Expo.
*   **Adaptacja Platformy/Środowiska:** Elastyczne dostosowanie działania aplikacji (szczególnie warstwy bazy danych) w zależności od środowiska (DEBUG vs Produkcja) za pomocą flagi `DEBUG`.
*   **Zarządzanie Danymi Offline Użytkownika:** Bezpieczne i logiczne obsłużenie danych utworzonych przez użytkownika przed pierwszym zalogowaniem.
*   **Efektywne Zarządzanie Obrazkami:** Lokalna obsługa obrazków przepisów użytkownika w celu zapewnienia dostępności offline i optymalizacji wydajności.
*   **Stylistyka "Monochrome":** Implementacja minimalistycznego, czytelnego i spójnego interfejsu użytkownika, który nie przytłacza i skupia się na funkcjonalności.

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
*   **Przechowywanie Niewrażliwych Danych:** `@react-native-async-storage/async-storage` (dla access token, userId, flag konfiguracyjnych)
*   **Obsługa Plików Lokalnych:** `expo-file-system`, `expo-image-manipulator`
*   **Interakcje Drag & Drop:** `react-native-draggable-flatlist` (dla listy zakupów)
*   **Komponenty UI:** Standardowe komponenty React Native, `@expo/vector-icons`.
*   **Narzędzia Dodatkowe:** `react-native-toast-message` (dla powiadomień), `eventemitter3` (dla `SyncService`).

**4. Stylistyka "Monochrome" i Założenia UX/UI**

*   **Filozofia:** Minimalizm, czytelność, spokój, funkcjonalność ponad formą. Design ma być neutralnym tłem, nie przytłaczać i nie męczyć wzroku.
*   **Paleta Kolorów:**
    *   **Baza:** Odcienie szarości (od bardzo jasnych `#f8f9fa` dla tła, przez biel `#ffffff` dla kart, po ciemniejsze `#2d3748` dla tekstu) i neutralne odcienie pośrednie (`#718096`, `#a0aec0`, `#e2e8f0`).
    *   **Akcent:** Spokojny niebieski (`#5c7ba9`) używany oszczędnie do wyróżnienia aktywnych elementów i głównych akcji.
    *   **Sygnalizacja:** Stonowany czerwony (`#e53e3e`) dla akcji destrukcyjnych/błędów, zielony (`#48bb78`) dla sukcesu, żółty (`#ecc94b`) dla ostrzeżeń.
    *   **Zasada:** Unikanie gradientów, mocnych cieni, wielu jaskrawych kolorów. Nacisk na kontrast i dostępność.
*   **Typografia:**
    *   **Czcionka:** Systemowa (San Francisco/Roboto).
    *   **Hierarchia:** Uzyskiwana przez rozmiar (np. Tytuł ekranu 20pt, Tytuł sekcji 16pt, Tekst główny 15pt, Tekst pomocniczy 13pt) i wagę (np. Bold/Semibold dla tytułów, Regular dla reszty).
    *   **Interlinia:** Dostosowana do komfortu czytania (ok. 1.4-1.5).
*   **Styl Komponentów:**
    *   **Przyciski:** Proste, z lekkim zaokrągleniem (`borderRadius: 6-8`), wypełnione (kolor akcentu lub szary dla nieaktywnych) lub zarysowane (dla drugorzędnych akcji). Spójna wysokość (np. 44-48px). Reużywalny komponent `Button` (`src/components/Button.tsx`).
    *   **Inputy:** Jasne tło (`#f1f5f9`), delikatna ramka (`#e2e8f0`), zaokrąglenie (`borderRadius: 6-8`), czytelny tekst.
    *   **Karty:** Białe tło, lekkie zaokrąglenie, subtelny cień lub ramka. Przejrzysty układ.
    *   **Checkboxy:** Kwadratowe ikony (`MaterialIcons` `check-box`/`check-box-outline-blank`), zmiana koloru wskazująca stan.
    *   **Modale/Menu:** Czysty wygląd, tło overlay, zaokrąglone rogi, spójne przyciski.
*   **UX i Interakcje:**
    *   **Intuicyjność:** Proste i przewidywalne przepływy.
    *   **Feedback:** Wyraźny (Toast dla informacji, Alert dla potwierdzeń krytycznych, wskaźniki ładowania).
    *   **Animacje:** Minimalne, subtelne (np. `LayoutAnimation.Presets.easeInEaseOut` dla rozwijania/zwijania, fade dla modali, max 150-200ms).
    *   **Responsywność:** Układ dostosowany do ekranów mobilnych.

**5. Struktura Katalogów**

```
src/
|-- app/                   # (Expo Router) Definicje ekranów/nawigacji
|-- assets/                # Statyczne zasoby
|-- components/            # Globalne, reużywalne komponenty UI (np. Button, HeaderDeleteButton, Toast)
|-- config/                # Konfiguracja (env, theme)
|-- contexts/              # Globalne konteksty React (AuthContext, SyncStatusContext)
|-- database/              # Logika WatermelonDB (index, schema, models, migrations)
|-- features/              # Główne moduły/funkcjonalności aplikacji
|   |-- auth/              # Logowanie, Rejestracja
|   |-- recipes/           # Przepisy Użytkownika (Offline-first)
|   |   |-- components/    # (np. RecipeCard, AddRecipeMenu, FilterMenu, SortMenu)
|   |   |-- hooks/         #
|   |   |-- screens/       # (np. RecipeListScreen - w app/)
|   |   |-- types.ts       #
|   |-- shoppingList/      # Lista Zakupów (Offline-first)
|   |   |-- components/    #
|   |   |-- hooks/         #
|   |   |-- screens/       # (np. ShoppingListScreen - w app/)
|   |   |-- types.ts       #
|   |-- notifications/     # Powiadomienia (Offline-first)
|   |-- settings/          # Ustawienia
|   |-- friends/           # Zarządzanie Znajomymi i Przeglądanie Ich Przepisów (Online-only)
|   |   |-- components/    # Komponenty specyficzne dla znajomych/stalkingu
|   |   |-- hooks/         # Hooki do pobierania danych znajomych/przepisów z API
|   |   |-- screens/       # Ekrany FriendsListScreen, FriendRecipesScreen (Stalking)
|   |   |-- types.ts       # Typy dla danych znajomych i ich przepisów (z API)
|   |-- import/            # (Opcjonalnie) Komponenty związane z importem
|-- hooks/                 # Globalne, reużywalne hooki
|-- services/              # Logika biznesowa, API, synchronizacja
|   |-- api/               # Moduły komunikacji z API backendu (apiClient, authApi, syncApi, ...)
|   |-- auth/              # Serwis i storage autentykacji (authService, authStorage, authUserIdProvider)
|   |-- sync/              # Serwis synchronizacji WatermelonDB (syncService)
|   |-- image/             # Serwis zarządzania lokalnymi obrazkami (imageService)
|   |-- friends/           # (Nowy/TODO) Serwis do interakcji z API znajomych i przepisów znajomych
|-- types/                 # Globalne typy TypeScript
|-- utils/                 # Globalne funkcje pomocnicze (np. imageProcessor, ingredientParser, timeFormat)
|-- App.tsx                # Główny komponent aplikacji
```

**Uzasadnienie:** Struktura pozostaje modularna. Funkcjonalność związana ze znajomymi i przeglądaniem ich przepisów ("Stalking") jest zgrupowana w dedykowanym module `features/friends/`. Ten moduł będzie zawierał komponenty, hooki i ekrany operujące głównie na danych pobieranych bezpośrednio z API, a nie z WatermelonDB.

**6. Kluczowe Komponenty Architektury**

*   **Warstwa Bazy Danych (`src/database`)**
    *   **Cel:** Dostęp do danych *użytkownika* offline, synchronizacja.
    *   **Kluczowe Elementy:**
        *   **`index.ts`:** Wybór adaptera (SQLite/LokiJS) na podstawie `DEBUG`, inicjalizacja `Database`, obsługa JSI. Przekazuje `migrations` do adapterów.
        *   **`schema.ts`:** Wersja 2. Definiuje wszystkie tabele użytkownika (synchronizowane) **z `user_id` jako opcjonalnym (`isOptional: true`)** oraz lokalną tabelę `recipe_images_local`.
        *   **`models/`:** Implementacje modeli WDB. Zawierają logikę biznesową (np. `ShoppingItem.addItemFromText` z mergowaniem, `ShoppingItem.bulkUpdateOrder` do D&D, `Recipe.markAsDeletedCascade`), metody `@writer` i metody obserwacji (`observe...`). Modele używają `getCurrentUserId` (z `authUserIdProvider`) zamiast bezpośrednio `AuthService`.
        *   **`migrations.ts`:** Zawiera definicję migracji z wersji 1 do 2 (pusty krok `steps`).

*   **Warstwa Komunikacji API (`src/services/api`)**
    *   **Cel:** Komunikacja z backendem REST API.
    *   **Kluczowe Elementy:**
        *   **`apiClient.ts`:** Centralny klient HTTP z automatycznym dołączaniem tokenu Bearer i **zaimplementowaną logiką odświeżania tokenu** przy błędzie 401 (używając `authService.refreshAccessToken`). Odpowiednio formatuje dane dla `POST`, obsługuje `FormData`. Zgodny z dokumentacją API (np. pole `login` zamiast `username`).
        *   **Moduły API:** `authApi.ts`, `syncApi.ts`, `recipesApi.ts` (do importu/uploadu/delete obrazków), `ninjaApi.ts` (TODO), `userApi.ts` (TODO), `friendsApi.ts` (TODO). Definiują interfejsy Request/Response zgodne z backendem.

*   **Serwisy (`src/services`)**
    *   **Cel:** Logika biznesowa, zarządzanie stanem zewnętrznym.
    *   **Kluczowe Serwisy:**
        *   **`AuthService` (`src/services/auth/authService.ts`):** Zarządza logowaniem/wylogowaniem, tokenami (`AuthStorage`). Implementuje logikę **przypisywania danych offline (`userId=null`)** po otrzymaniu flagi `is_first_ever_login` z API `/login/`. Dostarcza metodę `refreshAccessToken` używaną przez `apiClient`. Używa `authUserIdProvider` do dostarczania ID użytkownika dla innych części systemu.
        *   **`SyncService` (`src/services/sync/syncService.ts`):** Zarządza cyklem synchronizacji WDB danych użytkownika (start, stop, status, cykliczne wywołania, obsługa offline/błędów, ponowienia). Używa `syncApi`. Przekazuje `migrationsEnabledAtVersion` do `synchronize`. Emituje zdarzenia (`statusChanged`).
        *   **`ImageService` (`src/services/image/imageService.ts`):** Zarządza lokalnymi obrazkami przepisów użytkownika. Nasłuchuje na zmiany `Recipe.imageUrl`, pobiera, przetwarza (`utils/imageProcessor.ts`), zapisuje pliki i aktualizuje lokalny model `RecipeImageLocal` w WDB. Obsługuje usuwanie. Używa RxJS (z `bufferTime` i `mergeMap`) do zarządzania kolejką przetwarzania i unikania problemów z wydajnością.
        *   **`FriendsService` (TODO):** Do obsługi logiki związanej ze znajomymi (API).

*   **Konteksty (`src/contexts`)**
    *   **Cel:** Globalny stan.
    *   **Kluczowe Konteksty:**
        *   **`AuthContext.tsx`:** Stan `isAuthenticated`, `userId`, `isLoading`. Metody `login`, `logout`, `register`, `resetPassword`. Inicjalizuje stan autentykacji przy starcie aplikacji.
        *   **`SyncStatusContext.tsx`:** Stan `syncStatus`, `lastSyncError`, `logs`. Metoda `triggerSync`. Subskrybuje do zdarzeń `SyncService`.

*   **Interfejs Użytkownika (UI)**
    *   **Cel:** Prezentacja, interakcja.
    *   **Komponenty Reużywalne (`src/components`):** Zaimplementowano `Button.tsx` (z wariantami `active`, `secondary`, `iconOnly`, obsługą `disabled`, `isLoading`), `HeaderDeleteButton.tsx`, `Toast.tsx`.
    *   **Ekrany (`app/` lub `src/features/.../screens`):**
        *   **`RecipeListScreen` (`app/(tabs)/recipes.tsx`):** Główny ekran. Wyświetla przepisy oczekujące (`PendingRecipeCard`) i zatwierdzone (`RecipeCard`) z WDB w osobnych sekcjach (używając `SectionList`). Integruje filtrowanie (`EnhancedFilterMenu`), sortowanie (`SortMenu`), wyszukiwanie (w nagłówku `app/(tabs)/_layout.tsx`) i dodawanie (`AddRecipeMenu`). Używa `withObservables` do reaktywnego pobierania danych.
        *   **`ShoppingListScreen` (`app/(tabs)/shoppingList.tsx`):** Wyświetla listę zakupów (niekupione/kupione) z WDB. Implementuje dodawanie (z mergowaniem), edycję, usuwanie, oznaczanie, czyszczenie listy. Używa `withObservables`. Zaimplementowano **Drag & Drop do zmiany kolejności** niekupionych elementów za pomocą `react-native-draggable-flatlist`. Przyciski "Dodaj" i "Wyczyść listę" używają reużywalnych komponentów `Button` i `HeaderDeleteButton`.
        *   **`RecipeDetailScreen` (`app/(screens)/RecipeDetailScreen/RecipeDetailScreen.tsx` - TODO):** Wyświetlanie szczegółów przepisu (dane z WDB), skalowanie składników, wyświetlanie lokalnego obrazka.
        *   **`RecipeManagementScreen` (`app/(screens)/RecipeManagementScreen/RecipeManagementScreen.tsx` - TODO):** Formularz dodawania/edycji przepisu.
        *   **`LoginScreen`, `RegisterScreen` (`app/(auth)/...`):** Podstawowe ekrany logowania/rejestracji. `LoginScreen` wysyła dane w formacie `{"login": ..., "password": ...}`.
        *   **`DebugScreen` (`app/debug.tsx`):** Ekran do debugowania, wyświetla stan Auth i dane z tabel WDB.
        *   **`IndexScreen` (`app/index.tsx`):** Główny punkt wejścia. Sprawdza stan autentykacji i przekierowuje do `/login` lub `/(tabs)/recipes`.
        *   **`FriendRecipesScreen` (TODO):** Ekran do przeglądania przepisów znajomych (dane z API).
    *   **UI Przepisów Znajomych (TODO):** Komponent `RecipeCard` będzie dostosowany do przyjmowania danych z API. Ekran `FriendRecipesScreen` będzie używał `FriendsService` do pobierania danych online.

**7. Przepływ Danych i Synchronizacja**

*   **Dane Użytkownika:** Jak opisano wcześniej (WDB jako źródło offline, synchronizacja przez `SyncService`, obrazki lokalnie przez `ImageService`). Synchronizacja uwzględnia migracje (`migrationsEnabledAtVersion`).
*   **Dane Znajomych:** Jak opisano wcześniej (API jako źródło, brak WDB, `FriendsService`).

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

(Sekcja bez zmian w stosunku do poprzedniej wersji - zawiera implementację znajomych, D&D dla tagów, obsługę błędów API, optymalizacje, potencjalne biblioteki stanu, testy).

**10. Wnioski**

Architektura aplikacji OmNomNom jest zaprojektowana z myślą o trybie offline-first, wykorzystując WatermelonDB do zarządzania danymi użytkownika i ich synchronizacji. Przewiduje również obsługę funkcji online-only (jak przepisy znajomych) poprzez bezpośrednią komunikację z API. Zaimplementowano kluczowe mechanizmy, takie jak bezpieczne przypisywanie danych offline, lokalne zarządzanie obrazkami i zmiana kolejności elementów przez Drag & Drop. Zastosowanie architektury modularnej, separacji odpowiedzialności i zdefiniowanej stylistyki "Monochrome" ma na celu stworzenie stabilnej, łatwej w utrzymaniu i przyjaznej dla użytkownika aplikacji.