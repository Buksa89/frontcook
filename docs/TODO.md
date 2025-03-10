
recipetag sie tworza bez basemodel
nie robia sie delete po updacie, byc moze tez nie basemodel
sprawdzic rozne formy edycji czy updatuja sie przez basemodel
sprawdzic settings

nie wyslaly sie: ingredient, recipetag
prawdopodobnie nie zmieniaja sie statusy po wyslaniu
update lastsync from candidate
sprawdz czy push jest na pewno per user
obsluga response z konfliktami



synchronizacja:
    settings
    tags
    recipes
    shopping list
    notyfikacje
obsluga refresh tokena
obsluga logout

1. Enable recipe sharing
2. recipe adding by api:
    scan
    internet
    pdf
    import from other apps
3. context menu
    znajomi
    przepisy znajomych
    
4 shopping list sharing
5. przeklejenie widokow backendu do gpt i dopytanie czy ok
6. obsluga bledow api
7. ladniejsze notyfikacje bledow/sukcesow

znajomi
przepisy do akceptacji
stalking
dodawanie recipes web
dodawanie recipes foto
foto przepisow
poprawa wizualna alertow
dodanie opcji pro
dodanie reklam
dodanie resetu hasla
dodanie logwania do settingsow
kolejnosc tagow i shopping items
dodanie parsowania pdf
przy tworzeniu elementu, sprawdzaj czy juz nie istnieje


8. upewnienie sie ze mamy te same regexy na hasla na backendzie i froncie - przy tworzeniu i resecie i updatach z admina i z settingsow
checkAndAssignLocalDataToUser - edge cases, obsluz duplikaty z manytomany

zarzadzanie tokenem:
https://chatgpt.com/c/67c60929-7658-8008-8824-4e885f95ab8c

testy:
https://chatgpt.com/c/67cf2401-07e0-8010-b0d9-94f2a294a95a


refresh token: 
zmiana czasow
sprawdzenie tokenow przed synchronizacją