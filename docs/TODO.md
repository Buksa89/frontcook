next steps:
    
    zdebuguj dlaczego klawiatura wyswietla sie na recipe list po otwarciu

    poprawa promptow importow i flow (usun header, footer ze stron, deeepsek, pdfy tekstowe jako tekst)

    Import przepisow z innych apek
    reorder tagow/shopping items
    reset/zmiana hasla
    grafiki
    forced sync wywolany przez server - architektura
    sync przed wylogowaniem

rozwiazania:
    beautiful dnd
    react query

Issues:
    Obsluga bledow z api
    Sprawdz czy zdjecie jest poprawnie przyciete
    Brak zrodel w przepisie, kiedy url


Pilnuj:
    Przytrzymanie na listach jako menu kontekstowe
    last update - test
    brak settings przy pierwszym uruchomieniu! - test

Quick wins:
    popraw prompt, zeby byl w formacie json
    popraw prompt zeby ulamki byly z kropką
    lepsze powiadomienie w przypadku nieprzetworzenia
    Reset hasła
    Filmik w widoku przepisu
    Info o synchronizacji
    pogrubienie skladnikow w tekscie

Dev:
    Mierzenie czasu api calli
    Zappisywanie logow w sentry

Improvements:
    Architektura pod pro
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
    Zapsute observables dla subscription
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