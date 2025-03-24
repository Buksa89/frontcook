next steps:
    poprawa promptow importow i flow (usun header, footer ze stron, deeepsek, pdfy tekstowe jako tekst)
    alerty w auth

    Import przepisow z innych apek
    reorder tagow/shopping items
    Architektura pod pro
    reset/zmiana hasla
    grafiki
    forced sync wywolany przez server - architektura

rozwiazania:
    beautiful dnd
    react query

Issues:
    Obsluga bledow z api
    sync przed wylogowaniem
    Sprawdz czy zdjecie jest poprawnie przyciete
    brak settings przy pierwszym uruchomieniu!
    Brak zrodel w przepisie, kiedy url


Pilnuj:
    Przytrzymanie na listach jako menu kontekstowe
    last update - test


Quick wins:
    popraw prompt, zeby byl w formacie json
    popraw prompt zeby ulamki byly z kropką
    lepsze powiadomienie w przypadku nieprzetworzenia
    react-toastify - moze pomoc z wygladem alertow
    Reset hasła
    Filmik w widoku przepisu
    Info o synchronizacji
    pogrubienie skladnikow w tekscie

Dev:
    Mierzenie czasu api calli
    Zappisywanie logow w sentry

Improvements:
    Lista znajomych
    Udostepnianie przepisow
    Stalking
    Obsluga grafik
    Przechowywanie screenow/pdf
    parsowanie grafik  przez ai do przepisu
    Włączenie opcji pro
    włączenie 1 pdf/tydz
    Dodanie reklam
    checkAndAssignLocalDataToUser - edge cases, obsluz duplikaty z manytomany
    Jesli przepis nie ma zdjecia a ma filmik, uzyj miniaturki jako zdjecia


Final:
    Poprawa ui/ux, grafiki
    Code review by gpt
    upewnienie sie ze mamy te same regexy na hasla na backendzie i froncie - przy tworzeniu i resecie i updatach z admina i z settingsow

Future improvement:
    Shopping list sharing
    Multiple shoppinmg lists
    Przepisy z filmikow
    Oauth
    Multilanguage
    Domyslny jezyk na bazie telefonu
    Szablony graficzne
    Synchronizacja w tle (bez wlaczania apki)
    ksiazka do druku
    reparsing przepisu
    wersja web dietetykow, z mozliwoscia importu do apki


testy:
    https://chatgpt.com/c/67cf2401-07e0-8010-b0d9-94f2a294a95a