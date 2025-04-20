**Dokumentacja Architektury Frontendowej - Aplikacja SmartCook (React Native / Expo)**

**1. Wprowadzenie**

Niniejszy dokument opisuje proponowaną architekturę frontendową dla aplikacji mobilnej SmartCook, tworzonej w React Native z wykorzystaniem Expo. Celem jest stworzenie aplikacji do zarządzania przepisami kulinarnymi, umożliwiającej pracę offline oraz synchronizację danych z backendem Django przy użyciu WatermelonDB. Dokumentacja ta stanowi podstawę do implementacji, kładąc nacisk na przyjęte rozwiązania, ich uzasadnienie oraz logikę biznesową.

**2. Główne Założenia i Cele Architektury**

*   **Offline-First:** Aplikacja musi być w pełni funkcjonalna bez dostępu do internetu. Użytkownik może przeglądać, tworzyć i modyfikować swoje przepisy, tagi, listę zakupów w trybie offline. Dane są synchronizowane z serwerem, gdy połączenie jest dostępne.
*   **Synchronizacja WatermelonDB:** Wykorzystanie natywnego mechanizmu synchronizacji WatermelonDB jako podstawowego sposobu wymiany danych z backendem dla kluczowych modeli (Przepisy, Składniki, Tagi, Lista Zakupów, Ustawienia Klienta, Profil Użytkownika, Powiadomienia).
*   **Solidna Struktura:** Zastosowanie architektury opartej na modułach/domenach (feature-based) w celu zapewnienia skalowalności, łatwości utrzymania i testowania kodu.
*   **Separacja Odpowiedzialności:** Wyraźne oddzielenie logiki UI (komponenty, ekrany), logiki biznesowej (serwisy), zarządzania stanem (konteksty) oraz dostępu do danych (WatermelonDB, API).
*   **Najlepsze Praktyki:** Unikanie obejść (workarounds), stosowanie sprawdzonych wzorców projektowych w React Native i Expo.
*   **Adaptacja Platformy/Środowiska:** Elastyczne dostosowanie działania aplikacji (szczególnie warstwy bazy danych) w zależności od środowiska (DEBUG vs Produkcja) za pomocą flagi `DEBUG`.
*   **Zarządzanie Danymi Offline Użytkownika:** Bezpieczne i logiczne obsłużenie danych utworzonych przez użytkownika przed pierwszym zalogowaniem.
*   **Efektywne Zarządzanie Obrazkami:** Lokalna obsługa obrazków przepisów w celu zapewnienia dostępności offline i optymalizacji wydajności.

**3. Stos Technologiczny**

*   **Framework:** React Native (z Expo SDK)
*   **Nawigacja:** Expo Router (File-based Routing)
*   **Lokalna Baza Danych:** WatermelonDB
    *   Adapter Produkcyjny: `@nozbe/watermelondb/adapters/sqlite` (z JSI dla wydajności)
    *   Adapter Debugowy: `@nozbe/watermelondb/adapters/lokijs`
*   **Komunikacja API:** Fetch API (lub Axios) z dedykowanym klientem API (`apiClient.ts`)
*   **Zarządzanie Stanem Globalnym:** React Context API (`AuthContext`, opcjonalnie `SyncStatusContext`)
*   **Przechowywanie Wrażliwych Danych:** `expo-secure-store` (dla refresh token)
*   **Przechowywanie Niewrażliwych Danych:** `@react-native-async-storage/async-storage` (dla access token, userId, flag konfiguracyjnych)
*   **Obsługa Plików Lokalnych:** `expo-file-system`, `expo-image-manipulator`
*   **UI:** Standardowe komponenty React Native, potencjalnie biblioteki UI (opcjonalnie)

**4. Struktura Katalogów**

Proponowana struktura oparta na funkcjonalnościach/domenach (szczegółowy opis w poprzedniej wiadomości):

```
src/
|-- app/                   # (Expo Router) Definicje ekranów/nawigacji
|-- assets/                # Statyczne zasoby
|-- components/            # Globalne, reużywalne komponenty UI
|-- config/                # Konfiguracja (env, theme)
|-- contexts/              # Globalne konteksty React
|-- database/              # Logika WatermelonDB (index, schema, models, migrations)
|-- features/              # Główne moduły/funkcjonalności (auth, recipes, shoppingList, etc.)
|   |-- [featureName]/
|       |-- components/    # Komponenty specyficzne dla funkcji
|       |-- hooks/         # Hooki specyficzne dla funkcji
|       |-- screens/       # (Jeśli nie w app/) Ekrany specyficzne dla funkcji
|       |-- types.ts       # Typy specyficzne dla funkcji
|-- hooks/                 # Globalne, reużywalne hooki
|-- services/              # Logika biznesowa, API, synchronizacja
|   |-- api/               # Moduły komunikacji z API backendu
|   |-- auth/              # Serwis i storage autentykacji
|   |-- sync/              # Serwis synchronizacji WatermelonDB
|   |-- image/             # (Nowy) Serwis zarządzania obrazkami lokalnymi
|-- types/                 # Globalne typy TypeScript
|-- utils/                 # Globalne funkcje pomocnicze
|-- App.tsx                # Główny komponent aplikacji
```

**Uzasadnienie:** Taka struktura promuje modularność. Każda główna funkcjonalność (np. przepisy) jest zamknięta we własnym katalogu `features`, co ułatwia jej rozwój i modyfikację. Globalne elementy (komponenty, hooki, serwisy) są łatwo dostępne. Logika bazy danych, API i synchronizacji jest wyraźnie oddzielona.

**5. Kluczowe Komponenty Architektury**

*   **Warstwa Bazy Danych (`src/database`)**
    *   **Cel:** Abstrakcja nad lokalną bazą danych WatermelonDB. Zapewnia dostęp do danych offline i mechanizmy synchronizacji.
    *   **Kluczowe Elementy:**
        *   **`index.ts`:** Inicjalizuje bazę danych, dynamicznie wybiera adapter (`SQLiteAdapter` lub `LokiJSAdapter`) na podstawie flagi `DEBUG`. Odpowiada za ustawienie opcji JSI (Turbo Sync) dla SQLite w trybie produkcyjnym.
        *   **`schema.ts`:** Definiuje strukturę tabel lokalnej bazy danych, **musząc być zgodna** z polami synchronizowanymi przez backend (zgodnie z dokumentacją API `/sync/`). Zawiera standardowe pola WatermelonDB (`_status`, `_changed`) oraz wymagane pola dla synchronizacji (`last_modified`, `created_at`, `user_id`). Definiuje również lokalną, niesynchronizowaną tabelę `recipe_images_local`.
        *   **`models/`:** Implementacje klas modeli WatermelonDB (`Recipe`, `Tag`, `Ingredient`, `ShoppingItem`, `ClientUserSettings`, `Notification`, `UserProfile`, `RecipeTag`, `RecipeImageLocal`). Zawierają definicje pól, relacji oraz metody `@writer` do modyfikacji danych i logikę specyficzną dla modelu (np. parsowanie, metody statyczne do zapytań).
        *   **`migrations.ts`:** Definiuje kroki migracji schematu bazy danych WatermelonDB, umożliwiając ewolucję struktury bazy w kolejnych wersjach aplikacji.
    *   **Dlaczego WatermelonDB?** Zostało wybrane ze względu na jego dojrzałość, silne wsparcie dla React Native, wydajność (zwłaszcza z SQLite/JSI) oraz wbudowany, elastyczny mechanizm synchronizacji offline-first.

*   **Warstwa Komunikacji API (`src/services/api`)**
    *   **Cel:** Obsługa komunikacji z backendem REST API Django.
    *   **Kluczowe Elementy:**
        *   **`apiClient.ts`:** Centralny klient HTTP (oparty na Fetch lub Axios). Odpowiada za:
            *   Dodawanie `baseURL` do wszystkich żądań.
            *   Automatyczne dołączanie tokenu JWT (`Authorization: Bearer`) do żądań wymagających uwierzytelnienia.
            *   **Automatyczne odświeżanie tokenu:** Implementuje interceptor odpowiedzi. W przypadku otrzymania statusu `401 Unauthorized` (poza endpointem odświeżania), próbuje odświeżyć token za pomocą zapisanego `refreshToken` i endpointu `/api/auth/refresh-token/`. Jeśli odświeżanie się powiedzie, ponawia oryginalne żądanie z nowym tokenem. Jeśli nie, zgłasza błąd, który może prowadzić do wylogowania.
            *   Ujednoliconą obsługę błędów API (parsowanie odpowiedzi, rzucanie `ApiError`).
        *   **Moduły API (`authApi.ts`, `recipesApi.ts`, `syncApi.ts`, etc.):** Grupują funkcje odpowiadające konkretnym endpointom backendu (np. `login`, `register`, `importFromUrl`, `uploadRecipeImage`, `pullChanges`, `pushChanges`). Korzystają z `apiClient` do wykonywania żądań.
    *   **Dlaczego Dedykowany Klient?** Zapewnia spójny sposób wykonywania zapytań, centralizuje logikę autentykacji (tokeny, odświeżanie) i obsługę błędów, ułatwiając zarządzanie komunikacją z API w całej aplikacji.

*   **Serwisy (`src/services`)**
    *   **Cel:** Hermetyzacja logiki biznesowej, zarządzanie efektami ubocznymi (komunikacja API, dostęp do storage, synchronizacja).
    *   **Kluczowe Serwisy:**
        *   **`AuthService` (`src/services/auth/authService.ts`):** Orkiestruje procesy logowania, rejestracji, wylogowania. Współpracuje z `authApi` i `authStorage`. Zarządza stanem tokenów i ID użytkownika. Implementuje logikę przypisywania danych offline (`userId=null`) przy pierwszym logowaniu użytkownika (na podstawie flagi `is_first_ever_login` z API).
        *   **`SyncService` (`src/services/sync/syncService.ts`):** Odpowiada za zarządzanie cyklem życia synchronizacji WatermelonDB.
            *   Używa funkcji `pullChanges` i `pushChanges` z `syncApi`.
            *   Implementuje metodę `synchronize` z WatermelonDB.
            *   Obsługuje cykliczne wywoływanie synchronizacji (jeśli jest online).
            *   Udostępnia metody `start`, `stop`, `triggerManualSync`.
            *   Śledzi i udostępnia status synchronizacji (`idle`, `syncing`, `error`, `success`, `offline`).
        *   **`ImageService` (`src/services/image/imageService.ts`):** (Nowy) Odpowiada za zarządzanie lokalnymi obrazkami przepisów.
            *   Nasłuchuje na zmiany w modelu `Recipe` (po synchronizacji).
            *   Pobiera obrazy z `Recipe.image_url`.
            *   Przetwarza je (pełny rozmiar + miniatura) używając `utils/imageProcessor.ts`.
            *   Zapisuje lokalnie w `FileSystem`.
            *   Aktualizuje lokalny model `RecipeImageLocal` w WatermelonDB.
            *   Obsługuje usuwanie lokalnych plików i rekordu `RecipeImageLocal`, gdy `Recipe.image_url` staje się `null`.
    *   **Dlaczego Serwisy?** Oddzielają złożoną logikę od komponentów UI, czyniąc je prostszymi i bardziej testowalnymi. Promują reużywalność logiki biznesowej.

*   **Konteksty (`src/contexts`)**
    *   **Cel:** Dostarczanie globalnego stanu i funkcji do komponentów w drzewie React bez konieczności przekazywania propsów (prop drilling).
    *   **Kluczowe Konteksty:**
        *   **`AuthContext.tsx`:** Udostępnia stan `userId`, `accessToken`, `isAuthenticated`, `isLoading`. Dostarcza metody `login`, `logout`, `register`, `resetPassword`. Współpracuje z `AuthService`.
        *   **`SyncStatusContext.tsx` (Opcjonalny):** Może subskrybować do `SyncService` i udostępniać globalnie `syncStatus` i `lastSyncError`, aby UI mogło wyświetlać wskaźniki synchronizacji lub komunikaty o błędach.
    *   **Dlaczego Konteksty?** Są standardowym mechanizmem Reacta do zarządzania globalnym stanem, odpowiednim dla stanu autentykacji czy statusu synchronizacji.

*   **Interfejs Użytkownika (UI) (`app/`, `src/features`, `src/components`)**
    *   **Cel:** Prezentacja danych użytkownikowi i obsługa interakcji.
    *   **Struktura:**
        *   **`app/`:** Definicje ekranów i nawigacji zgodne z Expo Router.
        *   **`src/features/[nazwa]/screens/`:** (Jeśli ekrany nie są bezpośrednio w `app/`) Komponenty reprezentujące poszczególne ekrany aplikacji (np. `RecipeListScreen`). Odpowiadają za kompozycję UI, pobieranie danych (przez hooki obserwujące WDB lub wywołania serwisów) i obsługę akcji użytkownika (wywoływanie funkcji z serwisów lub kontekstów).
        *   **`src/features/[nazwa]/components/`:** Komponenty UI specyficzne dla danej funkcjonalności (np. `RecipeCard`, `IngredientInput`).
        *   **`src/components/`:** Globalne, reużywalne komponenty UI (np. `Button`, `ModalBase`, `TextInputStyled`).
    *   **Przepływ Danych:** Komponenty UI pobierają dane głównie przez obserwację modeli WatermelonDB (`withObservables` lub dedykowane hooki repozytoryjne). Stan globalny pobierają z Kontekstów (`useAuth`, `useSyncStatus`). Akcje użytkownika wywołują funkcje z serwisów (np. `authService.login`, `recipeService.deleteRecipe`, `syncService.triggerManualSync`).
    *   **Dlaczego Taki Podział?** Utrzymuje komponenty UI możliwie "czyste", oddzielając logikę pobierania danych i akcji do hooków, serwisów i kontekstów. Podział na globalne i feature-specific komponenty promuje reużywalność i porządek.

**6. Przepływ Danych i Synchronizacja**

*   **Źródło Prawdy (Offline):** Lokalna baza WatermelonDB jest głównym źródłem danych dla UI, gdy aplikacja działa.
*   **Źródło Prawdy (Online):** Backend Django jest ostatecznym źródłem prawdy.
*   **Synchronizacja WDB:**
    *   Zarządzana przez `SyncService`.
    *   Uruchamiana cyklicznie (gdy aplikacja jest aktywna i online) lub manualnie.
    *   **PULL:** `SyncService` wywołuje `syncApi.pullChanges`, przekazując `lastPulledAt`. Otrzymane `changes` i `timestamp` są przekazywane do `WatermelonDB.synchronize`, która aktualizuje lokalną bazę. Serwis `ImageService` jest uruchamiany po udanym PULL, aby pobrać/zaktualizować lokalne obrazki.
    *   **PUSH:** `SyncService` wywołuje `syncApi.pushChanges`, wysyłając lokalne zmiany (`created`, `updated`, `deleted`) z WatermelonDB. Backend stosuje zmiany. W przypadku konfliktu (409), `SyncService` loguje błąd, a `synchronize` WDB zwykle przerywa proces (klient musi najpierw wykonać PULL).
    *   **Modele Read-Only (np. `UserProfile`):** `syncApi.pushChanges` po stronie serwera ignoruje zmiany dla tych tabel.

*   **Bezpośrednie Wywołania API:**
    *   Używane do operacji nieobjętych synchronizacją WDB:
        *   Logowanie, rejestracja, odświeżanie tokenu, wylogowanie (`authApi`).
        *   Wyzwalanie importu przepisów (`recipesApi`, `ninjaApi`).
        *   Upload/Delete obrazków przepisów (`recipesApi`).
        *   Pobieranie/aktualizacja ustawień serwera (jeśli potrzebne - `userApi`).
        *   Operacje na znajomych (TODO - `friendsApi`).

**7. Implementacja Specyficznych Wymagań**

*   **Dane Offline i Pierwsze Logowanie:**
    *   **Problem:** Jak bezpiecznie przypisać dane utworzone offline (`userId=null`) do użytkownika logującego się po raz pierwszy?
    *   **Rozwiązanie:** Backend `/login/` zwraca flagę `is_first_ever_login`. Po stronie klienta, `AuthService` po udanym logowaniu sprawdza tę flagę. Jeśli `true`, znajduje lokalne rekordy z `userId=null` i w transakcji WDB przypisuje im `userId` nowo zalogowanego użytkownika.
    *   **Uzasadnienie:** Rozwiązanie bezpieczniejsze niż automatyczne przypisywanie przy PUSH. Opiera się na sygnale z backendu o *pierwszym logowaniu użytkownika w systemie*, minimalizując ryzyko przejęcia danych przez innego użytkownika na tym samym urządzeniu. Nie wymaga dodatkowego UI ani flag w AsyncStorage.

*   **Zarządzanie Obrazkami Przepisów:**
    *   **Problem:** Przechowywanie i wyświetlanie obrazków offline, bez synchronizowania samych plików przez WDB.
    *   **Rozwiązanie:** Wprowadzenie lokalnego, **niesynchronizowanego** modelu `RecipeImageLocal` w WatermelonDB do przechowywania ścieżek (`local_path`, `local_thumbnail_path`) do przetworzonych lokalnie plików. `ImageService` po synchronizacji `Recipe` pobiera obrazy z `Recipe.image_url`, przetwarza je, zapisuje lokalnie i aktualizuje `RecipeImageLocal`. Komponenty UI obserwują `RecipeImageLocal` i wyświetlają obrazy z lokalnych ścieżek. Upload/delete odbywa się przez API, co aktualizuje `Recipe` na backendzie i inicjuje ponowne pobranie przez PULL.
    *   **Uzasadnienie:** Zapewnia dostępność obrazków offline, separuje logikę przetwarzania obrazów od synchronizacji danych, UI jest reaktywne na dostępność lokalnych obrazków. Unika problemów z synchronizacją dużych plików binarnych.

*   **Tryb `DEBUG`:**
    *   **Problem:** Potrzeba pracy bez natywnych zależności (SQLite) podczas developmentu.
    *   **Rozwiązanie:** Flaga `DEBUG` (z `config/env.ts`) jest używana w `database/index.ts` do wyboru adaptera WatermelonDB (`LokiJSAdapter` dla `DEBUG=true`, `SQLiteAdapter` dla `false`). Opcja `jsi: true` (Turbo Sync) dla `SQLiteAdapter` jest włączana tylko gdy `DEBUG=false`.
    *   **Uzasadnienie:** Umożliwia łatwe przełączanie między szybkim, czysto JS-owym środowiskiem deweloperskim a wydajnym, natywnym środowiskiem produkcyjnym bez zmian w logice aplikacji.

*   **Mergowanie `ShoppingItem`:**
    *   **Problem:** Unikanie duplikatów na liście zakupów dla tego samego produktu.
    *   **Rozwiązanie:** Przed utworzeniem nowego `ShoppingItem` (ręcznie lub z przepisu), sprawdzana jest obecność istniejącego elementu o tej samej nazwie i jednostce (oraz `isChecked=false`). Jeśli istnieje, jego ilość (`amount`) jest aktualizowana; w przeciwnym razie tworzony jest nowy rekord. Operacje update są wykonywane w `database.write`.
    *   **Uzasadnienie:** Zapewnia spójność danych i bardziej naturalne działanie listy zakupów dla użytkownika.

*   **UI - Przepisy Oczekujące:**
    *   **Wymaganie:** Osobne traktowanie przepisów niezatwierdzonych (`is_approved=false`).
    *   **Rozwiązanie:** `RecipeListScreen` pobiera dwie listy przepisów (oczekujące i zatwierdzone) lub jedną i filtruje. Wyświetla je w osobnych sekcjach (np. używając `SectionList` lub dodając nagłówek/separator), używając odpowiednich komponentów (`PendingRecipeCard` dla oczekujących, `RecipeCard` dla zatwierdzonych). Ekran detali/edycji może również dostosowywać swoje UI na podstawie flagi `is_approved`.
    *   **Uzasadnienie:** Zapewnia jasny przepływ pracy dla użytkownika z przepisami zaimportowanymi/wygenerowanymi, które wymagają weryfikacji.

*   **UI - Zmiana Kolejności (TODO):**
    *   **Wymaganie:** Umożliwienie zmiany kolejności Tagów i ShoppingItem przez Drag & Drop.
    *   **Plan:** Modele `Tag` i `ShoppingItem` posiadają pole `order`. Implementacja UI (np. z `react-native-gesture-handler` i `react-native-reanimated` lub dedykowaną biblioteką D&D) będzie musiała po zakończeniu przeciągania wywołać operację `@writer` w WDB, która zaktualizuje pola `order` (i **koniecznie** `last_modified`) dla zmienionych elementów w odpowiedniej kolejności, zapewniając synchronizację zmian.

**8. Przyszłe Rozważania / TODO**

*   Implementacja funkcjonalności Znajomych (online-only, przez API).
*   Implementacja interfejsu Drag & Drop do zmiany kolejności tagów i listy zakupów.
*   Obsługa błędów API w sposób bardziej przyjazny dla użytkownika (dedykowane komunikaty).
*   Optymalizacja pobierania i cache'owania obrazków (np. ograniczenie liczby równoczesnych pobrań).
*   Potencjalne wprowadzenie bardziej zaawansowanego zarządzania stanem (np. Zustand, Redux Toolkit), jeśli zarządzanie przez Context API stanie się zbyt skomplikowane.
*   Testy jednostkowe i integracyjne dla serwisów i logiki biznesowej.

**9. Wnioski**

Proponowana architektura zapewnia solidne podstawy dla aplikacji SmartCook. Kładzie nacisk na modularność, separację odpowiedzialności i obsługę kluczowych wymagań, takich jak praca offline z synchronizacją WatermelonDB, adaptacja do środowiska DEBUG oraz specyficzne mechanizmy obsługi danych offline i obrazków. Architektura jest zaprojektowana z myślą o przyszłej rozbudowie i łatwości utrzymania.