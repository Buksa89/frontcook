/my-expo-app
│── /src                   # Główny kod aplikacji
│   │── /assets            # Statyczne zasoby (obrazy, czcionki, ikony)
│   │── /components        # Reużywalne komponenty UI
│   │── /screens           # Ekrany aplikacji
│   │── /navigation        # Konfiguracja nawigacji
│   │── /context           # Context API (jeśli używasz)
│   │── /hooks             # Niestandardowe hooki
│   │── /utils             # Funkcje pomocnicze
│   │── /services          # API, Firebase, bazy danych
│   │── /styles            # Globalne style
│   │── App.js             # Główny plik aplikacji
│── /node_modules          # Zależności npm
│── .gitignore
│── package.json
│── babel.config.js
│── metro.config.js
│── app.json               # Konfiguracja Expo
│── app.config.js          # Alternatywna konfiguracja Expo
│── README.md

src/assets – trzymamy tu obrazy, ikony, czcionki itp.
src/components – reużywalne komponenty UI, np. Button.js, Card.js
src/screens – każdy ekran aplikacji, np. HomeScreen.js, LoginScreen.js
src/navigation – konfiguracja nawigacji (React Navigation)
src/redux lub src/context – zarządzanie stanem aplikacji
src/hooks – niestandardowe hooki, np. useAuth.js
src/utils – funkcje pomocnicze, np. formatDate.js
src/services – API, np. authService.js
src/styles – globalne style, motywy

Dobra praktyka to trzymanie niereużywalnych komponentów UI w folderze odpowiadającym ich kontekstowi, czyli w folderze ekranu, w którym są używane. Dzięki temu zachowujesz porządek i unikasz bałaganu w katalogu components.
✔ Hooki używane w jednym ekranie → trzymamy w folderze ekranu.
✔ Hooki używane w jednym komponencie → trzymamy w folderze komponentu.
✔ Hooki używane w wielu miejscach → przenosimy do /hooks/.

Struktura z niereużywalnymi komponentami:
bash
Kopiuj
Edytuj
/src
│── /screens
│   │── /HomeScreen
│   │   │── HomeScreen.js         # Główny plik ekranu
│   │   │── HomeHeader.js         # Niereużywalny komponent UI dla HomeScreen
│   │   │── HomeListItem.js       # Niereużywalny komponent UI dla HomeScreen
│       │── HomeSearchBar.js  # Pasek wyszukiwania dla HomeScreen
│   │── /ProfileScreen
│   │   │── ProfileScreen.js
│   │   │── ProfileAvatar.js      # Niereużywalny komponent UI dla ProfileScreen
│── /components
│   │── Button.js                 # Reużywalny komponent UI
│   │── Card.js                    # Reużywalny komponent UI


Kiedy trzymać komponent w components/?
Jeśli jest wielokrotnie używany w różnych miejscach aplikacji.
Jeśli jest czysto prezentacyjny i można go łatwo dostosować (np. Button.js, Card.js).
Kiedy trzymać komponent w screens/?
Jeśli jest specyficzny dla jednego ekranu i nie ma sensu używać go w innym miejscu.
Jeśli jest ściśle związany z logiką danego ekranu.


