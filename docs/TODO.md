spytaj usera przy logowaniu o synchronizacje
sync id po obu stronach, automatyczne tworzenie
synchro listy zakupow



prep time przy sortowaniu, na koniec jesli 0
ikonke czasu zmien  wjednym miejscu



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
ikonka prep time w sortowaniu
bug: przepis po dodaniu nie pojawia sie na liscie, trzeba odswiezyc
poprawa wizualna alertow
dodanie opcji pro
dodanie reklam
dodanie resetu hasla
dodanie logwania do settingsow
przenoszenie tagow i shopping items
dodanie parsowania pdf
przy tworzeniu elementu, sprawdzaj czy juz nie istnieje


8. upewnienie sie ze mamy te same regexy na hasla na backendzie i froncie - przy tworzeniu i resecie i updatach z admina i z settingsow
checkAndAssignLocalDataToUser - edge cases, obsluz duplikaty z manytomany

zarzadzanie tokenem:
https://chatgpt.com/c/67c60929-7658-8008-8824-4e885f95ab8c

sync
https://chatgpt.com/c/67c43d5a-4cec-8010-9fcd-d2295f4017a0

recipetag sie tworza bez basemodel
nie robia sie delete po updacie, byc moze tez nie basemodel
sprawdzic rozne formy edycji czy updatuja sie przez basemodel
sprawdzic settings

nie wyslaly sie: ingredient, recipetag
prawdopodobnie nie zmieniaja sie statusy po wyslaniu
update lastsync from candidate