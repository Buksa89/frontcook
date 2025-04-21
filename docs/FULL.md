**Dokumentacja Architektury Frontendowej - Aplikacja OmNomNom (React Native / Expo)**

**1. Wprowadzenie**

Niniejszy dokument opisuje proponowaną architekturę frontendową dla aplikacji mobilnej OmNomNom, tworzonej w React Native z wykorzystaniem Expo. Celem jest stworzenie aplikacji do zarządzania przepisami kulinarnymi, umożliwiającej pracę offline oraz synchronizację danych z backendem Django przy użyciu WatermelonDB. Dokumentacja ta stanowi podstawę do implementacji, kładąc nacisk na przyjęte rozwiązania, ich uzasadnienie oraz logikę biznesową.

**2. Główne Założenia i Cele Architektury**

*   **Offline-First:** Aplikacja musi być w pełni funkcjonalna bez dostępu do internetu. Użytkownik może przeglądać, tworzyć i modyfikować swoje przepisy, tagi, listę zakupów w trybie offline. Dane są synchronizowane z serwerem, gdy połączenie jest dostępne.
*   **Synchronizacja WatermelonDB:** Wykorzystanie natywnego mechanizmu synchronizacji WatermelonDB jako podstawowego sposobu wymiany danych z backendem dla kluczowych modeli *użytkownika* (Przepisy, Składniki, Tagi, Lista Zakupów, Ustawienia Klienta, Profil Użytkownika, Powiadomienia).
*   **Funkcjonalności Online-Only:** Przewidzenie mechanizmów dla funkcji wymagających stałego połączenia z internetem i pobierających dane bezpośrednio z API, bez zapisywania ich w lokalnej bazie (np. zarządzanie znajomymi, przeglądanie przepisów znajomych).
*   **Solidna Struktura:** Zastosowanie architektury opartej na modułach/domenach (feature-based) w celu zapewnienia skalowalności, łatwości utrzymania i testowania kodu.
*   **Separacja Odpowiedzialności:** Wyraźne oddzielenie logiki UI (komponenty, ekrany), logiki biznesowej (serwisy), zarządzania stanem (konteksty) oraz dostępu do danych (WatermelonDB dla danych offline, API dla danych online).
*   **Najlepsze Praktyki:** Unikanie obejść (workarounds), stosowanie sprawdzonych wzorców projektowych w React Native i Expo.
*   **Adaptacja Platformy/Środowiska:** Elastyczne dostosowanie działania aplikacji (szczególnie warstwy bazy danych) w zależności od środowiska (DEBUG vs Produkcja) za pomocą flagi `DEBUG`.
*   **Zarządzanie Danymi Offline Użytkownika:** Bezpieczne i logiczne obsłużenie danych utworzonych przez użytkownika przed pierwszym zalogowaniem.
*   **Efektywne Zarządzanie Obrazkami:** Lokalna obsługa obrazków przepisów użytkownika w celu zapewnienia dostępności offline i optymalizacji wydajności.

**3. Stos Technologiczny**

*   **Framework:** React Native (z Expo SDK)
*   **Nawigacja:** Expo Router (File-based Routing)
*   **Lokalna Baza Danych (Offline):** WatermelonDB
    *   Adapter Produkcyjny: `@nozbe/watermelondb/adapters/sqlite` (z JSI dla wydajności)
    *   Adapter Debugowy: `@nozbe/watermelondb/adapters/lokijs`
*   **Komunikacja API:** Fetch API (lub Axios) z dedykowanym klientem API (`apiClient.ts`)
*   **Zarządzanie Stanem Globalnym:** React Context API (`AuthContext`, opcjonalnie `SyncStatusContext`)
*   **Zarządzanie Stanem Zapytań API (Opcjonalnie dla danych Online):** Rozważenie bibliotek typu React Query (TanStack Query) lub SWR do zarządzania stanem danych pobieranych bezpośrednio z API (np. przepisy znajomych).
*   **Przechowywanie Wrażliwych Danych:** `expo-secure-store` (dla refresh token)
*   **Przechowywanie Niewrażliwych Danych:** `@react-native-async-storage/async-storage` (dla access token, userId, flag konfiguracyjnych)
*   **Obsługa Plików Lokalnych:** `expo-file-system`, `expo-image-manipulator`
*   **UI:** Standardowe komponenty React Native, potencjalnie biblioteki UI (opcjonalnie)

**4. Struktura Katalogów**

Proponowana struktura oparta na funkcjonalnościach/domenach:

```
src/
|-- app/                   # (Expo Router) Definicje ekranów/nawigacji
|-- assets/                # Statyczne zasoby
|-- components/            # Globalne, reużywalne komponenty UI
|-- config/                # Konfiguracja (env, theme)
|-- contexts/              # Globalne konteksty React
|-- database/              # Logika WatermelonDB (index, schema, models, migrations)
|-- features/              # Główne moduły/funkcjonalności aplikacji
|   |-- auth/              # Logowanie, Rejestracja
|   |-- recipes/           # Przepisy Użytkownika (Offline-first)
|   |-- shoppingList/      # Lista Zakupów (Offline-first)
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
|   |-- api/               # Moduły komunikacji z API backendu (auth, recipes, sync, friends, etc.)
|   |-- auth/              # Serwis i storage autentykacji
|   |-- sync/              # Serwis synchronizacji WatermelonDB (dla danych użytkownika)
|   |-- image/             # Serwis zarządzania lokalnymi obrazkami (dla przepisów użytkownika)
|   |-- friends/           # (Nowy/TODO) Serwis do interakcji z API znajomych i przepisów znajomych
|-- types/                 # Globalne typy TypeScript
|-- utils/                 # Globalne funkcje pomocnicze
|-- App.tsx                # Główny komponent aplikacji
```

**Uzasadnienie:** Struktura pozostaje modularna. Funkcjonalność związana ze znajomymi i przeglądaniem ich przepisów ("Stalking") jest zgrupowana w dedykowanym module `features/friends/`. Ten moduł będzie zawierał komponenty, hooki i ekrany operujące głównie na danych pobieranych bezpośrednio z API, a nie z WatermelonDB.

**5. Kluczowe Komponenty Architektury**

*   **Warstwa Bazy Danych (`src/database`)**
    *   **Cel:** Zapewnia dostęp do danych *użytkownika* w trybie offline i mechanizmy synchronizacji tych danych. **Nie przechowuje danych znajomych ani ich przepisów.**
    *   **Kluczowe Elementy:** Bez zmian w stosunku do poprzedniego opisu (index, schema, models dla danych użytkownika, migrations).

*   **Warstwa Komunikacji API (`src/services/api`)**
    *   **Cel:** Obsługa komunikacji z całym backendem REST API.
    *   **Kluczowe Elementy:**
        *   **`apiClient.ts`:** Bez zmian (centralny klient z odświeżaniem tokenu).
        *   **Moduły API:** Oprócz istniejących (`authApi`, `recipesApi`, `syncApi` itd.), zostanie dodany:
            *   **`friendsApi.ts` (Nowy/TODO):** Będzie zawierał funkcje do:
                *   Zarządzania zaproszeniami/znajomościami (np. `sendFriendRequest`, `acceptRequest`, `listFriends`).
                *   Pobierania przepisów konkretnego znajomego (np. `getFriendRecipes(friendId: string, page?: number, filters?: any)`).
                *   Potencjalnie pobierania zagregowanej listy przepisów od wszystkich znajomych.
    *   **Dlaczego Dedykowany Klient?** Jak poprzednio - spójność, centralizacja logiki auth, obsługa błędów.

*   **Serwisy (`src/services`)**
    *   **Cel:** Hermetyzacja logiki biznesowej.
    *   **Kluczowe Serwisy:**
        *   **`AuthService`:** Bez zmian.
        *   **`SyncService`:** Odpowiada **tylko** za synchronizację danych *użytkownika* z WatermelonDB.
        *   **`ImageService`:** Odpowiada **tylko** za zarządzanie lokalnymi obrazkami przepisów *użytkownika*.
        *   **`FriendsService` (Nowy/TODO):** Będzie odpowiedzialny za:
            *   Orkiestrację operacji na znajomych (wykorzystując `friendsApi`).
            *   Pobieranie i potencjalnie cache'owanie (w pamięci lub za pomocą biblioteki typu React Query) listy znajomych.
            *   Pobieranie i paginację listy przepisów znajomych (wykorzystując `friendsApi`). **Nie będzie zapisywał tych przepisów do WatermelonDB.**
    *   **Dlaczego Serwisy?** Jak poprzednio - separacja logiki, testowalność, reużywalność. `FriendsService` izoluje logikę online od reszty aplikacji.

*   **Konteksty (`src/contexts`)**
    *   **Cel:** Dostarczanie globalnego stanu.
    *   **Kluczowe Konteksty:**
        *   **`AuthContext.tsx`:** Bez zmian.
        *   **`SyncStatusContext.tsx` (Opcjonalny):** Bez zmian (dotyczy tylko synchronizacji danych użytkownika).
    *   **Dlaczego Konteksty?** Jak poprzednio.

*   **Interfejs Użytkownika (UI) (`app/`, `src/features`, `src/components`)**
    *   **Cel:** Prezentacja danych i obsługa interakcji.
    *   **Nowe Elementy dla Funkcji "Stalking":**
        *   **`features/friends/screens/FriendRecipesScreen.tsx` (lub podobna nazwa):** Ekran wyświetlający listę przepisów znajomego (lub wszystkich znajomych).
            *   **Pobieranie Danych:** Ten ekran **nie będzie** używał `withObservables` do pobierania danych z WatermelonDB. Zamiast tego:
                *   Użyje dedykowanego hooka (np. `useFriendRecipes`) z katalogu `features/friends/hooks/`.
                *   Ten hook będzie wywoływał funkcje z `FriendsService` (lub bezpośrednio `friendsApi`), aby pobrać dane przepisów z API.
                *   Hook może implementować logikę paginacji, obsługę stanu ładowania i błędów (lub wykorzystać do tego React Query/SWR).
            *   **Wyświetlanie:** Będzie mapował dane otrzymane z API do komponentów `RecipeCard` (lub jego wariantu).
        *   **Komponent `RecipeCard`:** Będzie musiał być na tyle elastyczny, aby przyjąć dane przepisu albo jako obiekt modelu WatermelonDB (`Recipe`), albo jako zwykły obiekt JavaScript z danymi z API (np. `{ id: string, name: string, imageUrl: string | null, ... }`). Może to wymagać stworzenia typu `RecipeData` używanego zarówno przez model WDB, jak i API. Komponent będzie musiał pobierać obrazki bezpośrednio z `imageUrl` (z API), a nie szukać ich lokalnie dla przepisów znajomych.
    *   **Uzasadnienie Podziału Danych:** Rozdzielenie logiki pobierania danych dla własnych przepisów (offline-first z WDB) i przepisów znajomych (online-only z API) pozwala zachować zalety obu podejść i nie zaśmieca lokalnej bazy danych użytkownika danymi znajomych.

**6. Przepływ Danych i Synchronizacja**

*   **Dane Użytkownika (Przepisy Własne, Lista Zakupów itp.):**
    *   Źródło Prawdy Offline: WatermelonDB.
    *   Synchronizacja: Zarządzana przez `SyncService` (Pull/Push z `/api/v1/sync/`).
    *   Obrazki: URL synchronizowany w `Recipe`, pliki zarządzane lokalnie przez `ImageService` i `RecipeImageLocal`.
*   **Dane Znajomych i Ich Przepisy ("Stalking"):**
    *   Źródło Prawdy: **Wyłącznie Backend API**.
    *   Synchronizacja: **Brak synchronizacji z WatermelonDB.** Dane są pobierane na żądanie z API.
    *   Pobieranie: Dedykowane ekrany/hooki w `features/friends/` wywołują `friendsApi` (przez `FriendsService`) do pobrania listy znajomych i ich przepisów.
    *   Stan: Zarządzany lokalnie w komponentach/hookach lub przez bibliotekę do zarządzania stanem zapytań API (React Query/SWR).
    *   Obrazki: Wyświetlane bezpośrednio z URL-i (`imageUrl`) otrzymanych z API dla przepisów znajomych.

**7. Implementacja Specyficznych Wymagań**

*   **Dane Offline i Pierwsze Logowanie:** Bez zmian (logika oparta na fladze `is_first_ever_login` z API).
*   **Zarządzanie Obrazkami Przepisów (Użytkownika):** Bez zmian (model `RecipeImageLocal`, `ImageService`).
*   **Tryb `DEBUG`:** Bez zmian (wybór adaptera WDB, opcja JSI).
*   **Mergowanie `ShoppingItem`:** Bez zmian (logika w modelu `ShoppingItem`).
*   **UI - Przepisy Oczekujące:** Bez zmian.
*   **UI - Zmiana Kolejności (TODO):** Bez zmian.

**8. Przyszłe Rozważania / TODO**

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

**9. Wnioski**

Architektura została rozszerzona, aby uwzględnić przyszłą funkcjonalność przeglądania przepisów znajomych ("Stalking"). Kluczowe jest rozróżnienie między danymi użytkownika (zarządzanymi offline-first przez WatermelonDB i synchronizację) a danymi znajomych (zarządzanymi online-only przez bezpośrednie zapytania do API). Struktura katalogów i podział na serwisy wspierają ten podział, zapewniając modularność i możliwość dodania nowej funkcjonalności bez naruszania istniejącej logiki offline-first. Komponenty UI, takie jak `RecipeCard`, będą wymagały adaptacji, aby obsługiwać dane z obu źródeł (WDB i API).
