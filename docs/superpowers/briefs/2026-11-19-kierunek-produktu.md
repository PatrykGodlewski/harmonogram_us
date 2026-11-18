# Zlecenie: aktualizacja specu i planu — parytet funkcji z Indico, przewagi, hosting i płatne wtyczki

Pracujesz w repozytorium mojej aplikacji do zarządzania wydarzeniami na uczelni. Spec i plan powstały w Superpowers, a implementacja jest w toku. Zmieniam kierunek produktu. Doprowadź spec i plany do stanu, który:

1. czyni aplikację funkcjonalnie kompletną względem Indico, z dowodem w postaci testów end-to-end i automatycznej bramki (sekcje 3.2 i 4),
2. zachowuje trwałe przewagi nad Indico (sekcja 3.3),
3. przyjmuje model biznesowy: darmowy rdzeń, płatny hosting zarządzany i płatne wtyczki; komercja jest odroczona i na razie tylko opisana (sekcja 5),
4. wynika z faktycznego stanu kodu, a nie z założeń (Krok 2),
5. nie zawiera niedomówień ani rozwiązań tymczasowych (sekcje 6 i 7).

Poza dokończeniem zadania, które jest właśnie w toku, efektem tej pracy są dokumenty i narzędzia analityczne (inwentarz Indico i skrypt, który go generuje), nie kod produktu. Nie implementuj niczego nowego, dopóki nie zatwierdzę zaktualizowanych planów. To zlecenie ma pierwszeństwo przed zasadą nieprzerwanego wykonywania planu ze skilli wykonawczych.

Jeśli którejś instrukcji nie da się wykonać w tym repozytorium albo przeczy jej kod, nie obchodź jej: opisz konflikt i zapytaj mnie.

## 1. Kontekst

- Aplikację buduję dla mojej uczelni i ma być dla niej w pełni darmowa, bez kluczy licencyjnych. Później możliwe są płatny hosting dla innych organizacji i płatne wtyczki. Dziś nic z tego nie jest wdrażane (sekcja 5).
- Uczelnia używa Indico: darmowego systemu CERN-u na licencji MIT. Wzorzec: wersja 3.3.15-dev, commit `7bc32f2fe889943ef5df9c00ddfe868c9720cd34` z 18 listopada 2026. Moja aplikacja ma robić wszystko to, co Indico (parytet, sekcja 3.2), i być lepsza tam, gdzie Indico jest słabe (sekcja 3.3).
- Zakres jest duży: Indico to około 1000 tras HTTP i 143 tabele. Dlatego pracujemy etapami. Każdy etap kończy się działającym, przetestowanym oprogramowaniem, a funkcji niedokończonej nie wypuszczamy (T3). Zakresu nie skracaj. Jeśli coś nie mieści się w etapie, przesuń to do następnego i pokaż mi to w raporcie.

## 2. Kolejność pracy

Kroki wykonuj po kolei. Każdy kończy się plikiem w repozytorium albo moją decyzją. W nazwach plików RRRR-MM-DD oznacza dzisiejszą datę.

### Krok 1. Bezpieczny punkt zatrzymania

1. Zapisz ten dokument bez zmian jako `docs/superpowers/briefs/RRRR-MM-DD-kierunek-produktu.md` i zacommituj. Jeśli w tym katalogu jest starsza wersja tego zlecenia, nowa ją zastępuje; starej nie usuwaj. Po kompakcji kontekstu wracaj do tego pliku, a nie do pamięci rozmowy.
2. Nie zaczynaj żadnego nowego zadania.
3. Zadanie, które jest w toku, dokończ według obecnego planu: testy przechodzą, commit, wpis w ledgerze. Wyjątek: jeśli dotyczy ono wyłącznie komercjalizacji produktu (licencje, plany, cenniki, paywalle), przerwij je w obecnym stanie, niczego nie commituj i opisz jego stan w audycie. Opłaty rejestracyjne pobierane przez organizatora od uczestników to funkcja produktu, a nie wyjątek.
4. Zmian w drzewie roboczym, które nie należą do żadnego zadania, nie usuwaj i nie cofaj. Opisz je w audycie i zapytaj mnie, co z nimi zrobić.
5. Uruchom pełny zestaw testów i zapisz komendę oraz wynik jako punkt odniesienia. Jeśli testy nie przechodzą, zapisz to jako ustalenie audytu; naprawa będzie pierwszym zadaniem nowego planu.

### Krok 2. Audyt stanu faktycznego

Zanim cokolwiek zaproponujesz, ustal fakty. Każde stwierdzenie o stanie aplikacji oprzyj na dowodzie: ścieżce pliku, commicie, wpisie w ledgerze albo wyniku testu. Nie polegaj na pamięci rozmowy.

Przeczytaj wszystkie specyfikacje (`docs/superpowers/specs/`), wszystkie plany (`docs/superpowers/plans/`), ledgery (`.superpowers/sdd/*/progress.md`, razem z liniami `Ruling:`; ledgera może nie być), `git log`, strukturę kodu, model danych i migracje, testy, konfigurację i konfigurację CI. Jeśli dokumenty leżą gdzie indziej, użyj faktycznych ścieżek i napisz mi, jakich. Jeśli w repozytorium jest już audyt albo brief z wcześniejszej wersji tego zlecenia, użyj go jako punktu wyjścia, ale sprawdź każde jego stwierdzenie względem bieżącego kodu.

Zapisz audyt w `docs/superpowers/audits/RRRR-MM-DD-stan-aplikacji.md` i zacommituj. Audyt zawiera:

- **A.** Tabelę zadań każdego planu: numer, tytuł, status (ukończone / w toku / nierozpoczęte), dowód.
- **B.** Stan gałęzi: na jakiej gałęzi i w jakim worktree jest praca, czy jest scalona z gałęzią główną.
- **C.** Architekturę w obecnym kształcie: stack i wersje, moduły i ich zależności, model danych, logowanie i role, przebieg zapisu na wydarzenie (stany i przejścia), powiadomienia, API, tłumaczenia, dostępność, sposób wdrożenia, a także to, czy istnieje mechanizm wtyczek i jaki.
- **D.** Rejestr rozwiązań tymczasowych obecnych w kodzie (definicja w sekcji 6), każde z plikiem i linią.
- **E.** Wszystko, co w kodzie lub planie dotyczy komercjalizacji produktu: licencje, klucze, plany i cenniki, ograniczenia zależne od planu, paywalle, telemetrię. Opłaty rejestracyjne pobierane przez organizatora od uczestników nie należą do E; to funkcja produktu (wiersze F-PLT i F-REJ).
- **F.** Mapę parytetu: dla każdego wiersza katalogu (Załącznik A, rozszerzony w Kroku 3) status spełniona / częściowo / brak z dowodem. „Spełniona” wymaga przechodzącego testu e2e oznaczonego ID wiersza. Bez tego status to „częściowo” albo „brak”. Tę część uzupełnij po Kroku 3 i zacommituj ponownie.
- **G.** Mapę przewag z sekcji 3.3: dla każdej pozycji P status (spełniona / częściowo / brak) z dowodem. Obowiązuje ta sama zasada co w F.
- **H.** Infrastrukturę testową: framework e2e (jeśli jest), liczbę testów w podziale na jednostkowe, integracyjne i e2e, konfigurację CI, czas przebiegu, testy niestabilne lub pominięte, sposób przygotowania danych testowych.

### Krok 3. Inwentarz Indico i katalog funkcji

Katalog w Załączniku A to zalążek, a nie dowód kompletności. Kompletność wykazuje inwentarz wygenerowany ze źródeł Indico.

1. Pobierz Indico w stałej wersji, poza repozytorium (na przykład do `../indico-ref`), płytkim klonem na commit z sekcji 1. Jeśli sieć jest niedostępna albo commitu nie da się pobrać, zatrzymaj się i poproś mnie o kod. Nie uruchamiaj kodu Indico i nie instaluj jego zależności: tylko czytaj pliki.
2. Napisz powtarzalny skrypt (w `docs/superpowers/parity/tools/`, z instrukcją uruchomienia), który generuje `docs/superpowers/parity/inwentarz-indico.json` z następującymi pozycjami:
   - każda reguła URL z plików `blueprint.py` (blueprint, ścieżka, endpoint, metody, klasa obsługi),
   - każda tabela bazy z kolumnami,
   - każda klasa enum (nazwa, wartości) z oznaczeniem, czy opisuje stan obiektu,
   - każdy sygnał (`indico/core/signals`),
   - każde ustawienie konfiguracji z `docs/source/config/settings.rst`,
   - każde polecenie CLI (`indico/cli`) oraz każde zadanie cykliczne i asynchroniczne,
   - eksportery HTTP API (`indico/web/http_api`) i rozdziały referencji API z `docs/source/api`,
   - moduły i podmoduły, funkcje wydarzenia, uprawnienia zarządzania, lokalizacje tłumaczeń,
   - wtyczki z repozytorium `indico-plugins` (w dniu sprawdzenia 18 katalogów).

   Liczby kontrolne z mojego liczenia na tym commicie: 1004 wywołania `add_url_rule` w plikach `blueprint.py` (1015 poza testami), 1078 klas `RH*`, 143 tabele, 166 sygnałów, 80 klas enum, 97 ustawień konfiguracji, 142 pliki testów w Pythonie, 23 moduły w `indico/modules`, 19 lokalizacji tłumaczeń. Jeśli twoje liczby różnią się o więcej niż 5%, opisz w audycie różnicę i metodę liczenia.
3. Przypisz każdą pozycję inwentarza do wiersza katalogu (pole `funkcja`) albo oznacz ją jako wyłączoną z powodem z listy F1 (sekcja 3.2). Pozycji nieprzypisanych ma być zero. Trasy AJAX i pomocnicze przypisuj do funkcji, której służą. Przypisanie hurtowe (po blueprincie albo prefiksie ścieżki) jest dozwolone tam, gdzie wszystkie trasy służą tej samej funkcji, ale lista przypisań ma być jawna w pliku.
4. Rozszerz katalog z Załącznika A do poziomu zachowań: dziel wiersze, aż każdy da się sprawdzić jednym scenariuszem e2e z obserwowalnymi asercjami. Zachowanie ustalaj w tej kolejności: kod kontrolerów i modeli Indico, testy jednostkowe Indico (`*_test.py` opisują zamierzone zachowanie), `CHANGES.rst`, dokumentacja użytkownika (learn.getindico.io). Gdy dokumentacja i kod się różnią, wygrywa kod. Zapisz katalog w `docs/superpowers/parity/katalog-funkcji.yaml` w schemacie z sekcji 4.2. Przy dzieleniu wiersza zachowaj jego ID jako prefiks (F-REJ-01 daje F-REJ-01.1, F-REJ-01.2).
5. Zacommituj inwentarz, skrypt i katalog osobno od kodu. W raporcie podaj liczby pozycji inwentarza (przypisane / wyłączone / nieprzypisane) i liczbę wierszy katalogu w podziale na domeny.

### Krok 4. Uzgodnienie zmian

Użyj skilla `superpowers:brainstorming`. Potraktuj ten dokument jako moje szczegółowe zlecenie: sekcje 3–7 to decyzje już podjęte i nie pytaj o nie ponownie.

- W pierwszej wiadomości streść audyt i wynik Kroku 3 (pełna treść jest w plikach) i wskaż, co w obecnym kodzie lub planie koliduje z nowym kierunkiem.
- Zadaj mi pytania z sekcji 8, po jednym naraz, każde z twoją rekomendacją. Własne pytanie dodaj tylko wtedy, gdy odpowiedź zmienia to, co powstanie, i nie wynika ani z tego dokumentu, ani z kodu.
- Przedstaw 2–3 sposoby wpasowania zmian w obecną architekturę, w szczególności: (a) jak wprowadzić system wtyczek i przenieść istniejące integracje na jego API, (b) jak dodać warstwę e2e i bramkę parytetu do istniejących testów. Dla każdego podaj, które istniejące części kodu trzeba zmienić i jakie niesie ryzyko. Wskaż rekomendację i poczekaj na mój wybór.

### Krok 5. Dokumenty projektowe

- Spec produktu jest jedynym źródłem prawdy o tym, co budujemy. Zaktualizuj istniejący spec w miejscu i dodaj na górze sekcję „Historia zmian” (data, co się zmieniło, dlaczego). Jeśli spec jest podzielony na kilka plików, popraw każdy, którego dotyczą zmiany. Po aktualizacji żaden spec nie może zawierać zdania sprzecznego z sekcjami 3–7. Spec produktu zawiera: cele, nie-cele i anty-cele; definicję „feature complete” (3.2); pozycje P z kryteriami akceptacji; słownik pojęć, w którym każdy termin ma jedno znaczenie i tę samą nazwę co w kodzie; wymagania B1–B5 (sekcja 5) i T1–T8 (sekcja 6); listę „później” bez zadań.
- Spec parytetu: `docs/superpowers/specs/RRRR-MM-DD-parytet-indico-design.md`. Zawiera schemat katalogu, reguły z sekcji 4 (G1–G5, E1–E12), opis narzędzia `parity:check` (wejścia, wyjścia, kody wyjścia, tryb etapu i tryb pełny), format raportu oraz procedurę aktualizacji wzorca: co zrobić, gdy Indico wyda nową wersję (porównać `CHANGES.rst` od commita wzorca, zaproponować nowe wiersze, dopisać je po mojej zgodzie; bez automatyki).
- Spec systemu wtyczek: `docs/superpowers/specs/RRRR-MM-DD-system-wtyczek-design.md`. Zawiera kontrakt wtyczki (wiersze F-PLG), zasady wersjonowania i zgodności z rdzeniem, listę punktów rozszerzeń z podaniem, z której funkcji darmowego produktu każdy korzysta, wskazanie, które integracje są wtyczkami w pierwszym wydaniu (B2), miejsce, w którym żyją wtyczki pierwszej generacji (osobne pakiety w tym repozytorium czy osobne repozytoria) oraz test architektury (B3).
- Spec modułu komercyjnego opisany w sekcji 5.3, ze statusem ODROCZONY.
- Pisz w języku dotychczasowych dokumentów. Dokumenty commituj osobno od kodu.
- Poczekaj na moją akceptację wszystkich speców. Od tej chwili źródłem prawdy są specy, a ten dokument zostaje jako zapis zlecenia.

### Krok 6. Plany

Po akceptacji speców użyj skilla `superpowers:writing-plans`. Plany obejmują wszystkie wiersze katalogu ze statusem „wymagana”, które w audycie nie mają statusu „spełniona”, wszystkie pozycje P „musi” i „powinno” niespełnione oraz usunięcie pozycji z rejestru D. Pozycje „później” nie dostają zadań. Obowiązują sekcje 4, 6 i 7.

Domyślna kolejność etapów (zmieniasz ją tylko z uzasadnieniem zależności, które pokażesz w raporcie z Kroku 7):

- **Etap 0. Fundament dowodu.** Środowisko e2e, narzędzie `parity:check`, CI, otagowanie istniejących testów identyfikatorami wierszy, usunięcie rozwiązań tymczasowych z rejestru D.
- **Etap 1. Rdzeń kampusowy.** Konta i logowanie (F-UWT, F-UZY), dostęp (F-DOS), kategorie i wydarzenia (F-WYD), system wtyczek (F-PLG), rejestracja z limitem, listą rezerwową i rezygnacją (F-REJ, P3), kalendarz (P5), telefon (P1), dostępność i języki (F-I18, P6), RODO (P7), wdrożenie (F-OPS). Po tym etapie aplikacja nadaje się do uruchomienia na uczelni dla seminariów i wydarzeń kampusowych.
- **Etap 2. Rejestracja i dokumenty.** Pełny edytor formularza, zaproszenia, tagi, płatności (F-PLT) z wtyczkami dostawców, bilety, check-in, identyfikatory, zaświadczenia (F-DOK), komunikacja (F-KOM), P9, P10, P13.
- **Etap 3. Program i materiały.** Referaty, program, sesje, materiały, notatki, ankiety, wygląd, kopia offline (F-REF, F-PRG, F-MAT, F-ANK, F-WYG).
- **Etap 4. Konferencja naukowa.** Abstrakty, recenzje, referaty naukowe, redakcja (F-ABS, F-PAP, F-EDI).
- **Etap 5. Zasoby i integracje.** Sale (F-SAL), wideokonferencje (F-WID), wyszukiwanie (F-WYS), API z OpenAPI i widżet (F-API, P15), integracja z USOS (P11), import z Indico (F-MIG, P12).
- **Etap 6. Domknięcie parytetu.** Administracja i pozostałe wiersze, `parity:check` w trybie pełnym z kodem 0, dowód czułości (E11) dla całości, audyt dostępności, test obciążeniowy kluczowych ścieżek.

### Krok 7. Sprawdzenie i oddanie

Zanim zgłosisz koniec, sprawdź i pokaż dowód, że:

- każdy wiersz „wymagana” bez statusu „spełniona” ma zadanie-właściciela w planie, a każde takie zadanie ma w krokach testy e2e z ID wiersza (sprawdź to skryptem; lista wierszy bez właściciela ma być pusta);
- każda pozycja P „musi” i „powinno” bez statusu „spełniona” ma zadania, a każde kryterium akceptacji ma test albo komendę, która je sprawdza;
- żaden krok w planach nie jest ogólnikiem i żaden nie wprowadza rozwiązania tymczasowego;
- nazwy, typy i sygnatury są spójne między zadaniami i między planami;
- żaden spec ani plan nie przeczy sekcjom 3–7;
- ponowne uruchomienie skryptu inwentaryzacji daje identyczny wynik.

Potem oddaj mi wynik według sekcji 9 i poczekaj na akceptację. Po niej wróć do tej samej metody wykonywania planu, której używałeś dotąd.

## 3. Kierunek produktu — decyzje podjęte

### 3.1. Pozycjonowanie

Aplikacja ma być pełnoprawnym następcą Indico na mojej uczelni. Obsługuje to samo, od seminarium po konferencję naukową z abstraktami, recenzjami, programem i rezerwacją sal. Dodatkowo jest zaprojektowana od telefonu, po polsku i pod polskie systemy uczelniane. Uczestnik znajduje wydarzenie i zapisuje się z telefonu w kilkanaście sekund. Organizator publikuje wydarzenie w dwie minuty, bez szkolenia. Do czasu osiągnięcia parytetu uczelniane Indico działa obok, a jego wydarzenia widać we wspólnym kalendarzu (P12).

Jedna uczelnia to jedna instalacja z własną bazą danych. Tak samo działa hosting Indico u firm trzecich. Wszystko, co specyficzne dla uczelni (nazwa, logo, dostawca tożsamości, adres Indico), jest konfiguracją instalacji, a nie kodem.

### 3.2. Definicja „feature complete”

- **F1. Wzorzec i kryterium.** Wzorcem jest Indico w commicie z sekcji 1. Aplikacja jest funkcjonalnie kompletna, gdy każdy wiersz katalogu o statusie „wymagana” działa i ma przechodzący test e2e, a wszystkie pozycje inwentarza są przypisane do wiersza albo wyłączone (bramka z sekcji 4). Pozycję wolno wyłączyć tylko z jednego z czterech powodów: (a) zgodność wsteczna z historycznymi wersjami Indico (adresy legacy, migracja z wersji 1.x, wygasłe klucze API); (b) infrastruktura wspólnoty i CERN-u (telemetria `cephalopod`, wtyczki wewnętrzne CERN); (c) narzędzia wyłącznie dla deweloperów Indico (serwer deweloperski, obsługa tłumaczeń w projekcie Indico); (d) mój zapis „później” w specu, wyłącznie z moją wyraźną zgodą dla każdego wiersza osobno. Z żadnego innego powodu nie wyłączaj funkcji samodzielnie.
- **F2. Zachowanie, nie kopia.** Parytet dotyczy zachowania, a nie wyglądu ani kodu. Wiersz można spełnić inaczej niż Indico, byle zachowanie z pola `zachowanie` było takie samo. Tam, gdzie wskazują to przewagi (3.3), ma być lepiej.
- **F3. Licencja.** Indico jest na licencji MIT. Implementuj na podstawie obserwowanego zachowania. Nie kopiuj kodu, tłumaczeń ani grafik Indico do repozytorium. Jeśli mimo to przejmujesz fragment, zachowaj informację o prawach autorskich i licencji w pliku `NOTICE` i wskaż go w raporcie. Nie używaj nazwy ani logo Indico w produkcie.
- **F4. Późniejsze wersje Indico.** Zgodność z wersjami wydanymi po commicie wzorca nie jest częścią tego zlecenia. Procedura aktualizacji wzorca trafia do specu parytetu (Krok 5), bez automatyki.
- **F5. Uczciwy komunikat.** Każdy etap (Krok 6) jest wdrażalny na uczelni. Hasło „feature complete” padnie dopiero przy zielonej bramce w trybie pełnym. Wcześniej w specach, raportach i interfejsie wolno pisać wyłącznie „parytet: X% wierszy zielonych”, liczone przez narzędzie.

### 3.3. Przewagi

Parytet jest warunkiem koniecznym, ale nie daje nikomu powodu do zmiany narzędzia. Powód mają dać przewagi. „Musi” to fundament budowany od pierwszego wdrażalnego etapu. „Powinno” to wyróżniki budowane zaraz po nim. W nawiasach podaję powód rynkowy; dane są w Załączniku B.

**Musi**

- **P1. Uczestnik na telefonie.** Każda ścieżka uczestnika (lista → szczegóły → zapis → potwierdzenie → rezygnacja) działa w całości na ekranie o szerokości 360 px, bez przewijania w poziomie i bez funkcji dostępnych tylko na desktopie. Kryterium: testy e2e tych ścieżek w widoku mobilnym. (Indico planuje lepszą obsługę telefonów dopiero w wersji 3.5, na 2027 r.)
- **P2. Zapis bez tarcia.** Zalogowany użytkownik zapisuje się jednym działaniem na stronie wydarzenia, jeśli organizator nie dodał własnych pytań. Imię, nazwisko i e-mail pochodzą z konta i nie są wpisywane ponownie.
- **P3. Limit miejsc, lista rezerwowa, rezygnacja.** Po wyczerpaniu limitu zapisy trafiają na listę rezerwową. Gdy miejsce się zwalnia (rezygnacja albo zwiększenie limitu), pierwsza osoba z listy awansuje automatycznie i dostaje e-mail. Uczestnik rezygnuje sam, jednym działaniem. Stan „na liście rezerwowej” wchodzi do macierzy stanów rejestracji (G4). Kryterium: test współbieżności pokazuje, że równoczesne zapisy nigdy nie przekraczają limitu, a awans z listy jest atomowy. (W kodzie Indico nie ma listy rezerwowej, a prośba o nią czeka od 2017 r.; na darmowe wydarzenia nie przychodzi około 28% zapisanych.)
- **P4. Publikacja w dwie minuty.** Wydarzenie da się opublikować po wypełnieniu wyłącznie pól wymaganych: tytuł, termin, miejsce albo link, organizator. Pozostałe pola mają wartości domyślne. Istniejące wydarzenie da się zduplikować.
- **P5. Jeden kalendarz kampusu.** Publiczna lista i kalendarz wszystkich wydarzeń z filtrami (termin, jednostka lub organizator, kategoria, forma: na miejscu albo online), wyszukiwaniem i subskrypcją ICS (całość, jeden organizator, „moje zapisy”). Strona wydarzenia ma stały adres, metadane Open Graph i schema.org/Event.
- **P6. Dostępność i dwa języki interfejsu.** WCAG 2.1 AA na wszystkich widokach. Automatyczny test dostępności w e2e (E8), bez naruszeń poziomów A i AA, oraz lista ręcznego przeglądu (klawiatura, czytnik ekranu) w specu. Strona „Deklaracja dostępności”. Interfejs po polsku i angielsku; teksty interfejsu wyłącznie w plikach tłumaczeń. (Wymóg ustawowy dla uczelni publicznej.)
- **P7. RODO w projekcie.** Formularze zbierają tylko niezbędne dane. Przy zapisie widać klauzulę informacyjną. Dane zapisów mają okres retencji, po którym są automatycznie usuwane albo anonimizowane. Użytkownik może wyeksportować i usunąć swoje dane.
- **P8. Logowanie uczelniane.** Użytkownik loguje się kontem uczelni. Kod aplikacji zależy od jednego wewnętrznego interfejsu tożsamości, a konkretny dostawca (USOS API, CAS, OIDC, SAML) jest adapterem wybieranym w konfiguracji instalacji i dostarczanym jako wtyczka (B2). W pierwszym wydaniu powstaje jeden adapter: ten, którego używa moja uczelnia (pytanie O1).

**Powinno**

- **P9. Check-in w tej samej aplikacji.** Ponad parytet (F-REJ: bilety i odhaczanie obecności): organizator odhacza uczestników, skanując kod QR telefonem w przeglądarce, w tej samej aplikacji, bez osobnej aplikacji i drugiego logowania. (Indico ma osobną aplikację PWA do check-inu pod osobnym adresem.)
- **P10. Przypomnienia i zmiany.** Ponad parytet (F-KOM-01): automatyczne powiadomienie zapisanych o zmianie terminu, zmianie miejsca albo odwołaniu wydarzenia, bez ręcznego pisania wiadomości.
- **P11. Integracja z USOS** (tylko jeśli odpowiedź na O1 to USOS API; w innym wypadku przechodzi do „później”). Dostarczana jako wtyczka. Organizator może ograniczyć zapisy do grup znanych z USOS, na przykład wydziału albo kierunku. Uczestnik widzi ostrzeżenie, gdy wydarzenie koliduje z jego planem zajęć. Najpierw sprawdź w dokumentacji instalacji USOS API mojej uczelni, które metody i zakresy są dostępne; niczego nie zakładaj.
- **P12. Współistnienie z Indico.** Import tylko do odczytu wydarzeń z uczelnianego Indico do wspólnego kalendarza (HTTP Export API albo ICS), z linkiem do źródła. Zaimportowane wydarzenia są wyraźnie oznaczone i nie da się na nie zapisać w aplikacji. Zakres importu ustala pytanie O2.
- **P13. Statystyki.** Organizator widzi dla wydarzenia: zapisanych, listę rezerwową, obecnych i odsetek nieobecnych. Administrator widzi w czasie liczbę wydarzeń, zapisów i aktywnych organizatorów.
- **P14. Treść w dwóch językach.** Tytuł i opis wydarzenia po polsku i opcjonalnie po angielsku, wyświetlane zgodnie z językiem interfejsu. (W Indico treść organizatora ma jedną wersję językową, a wielojęzyczna treść jest na roadmapie bez terminu.)
- **P15. API i osadzanie.** Publiczne REST API z opisem OpenAPI oraz widżet „najbliższe wydarzenia” do osadzenia na stronach wydziałów. Parytet zapewnia wiersz F-API-01 (eksport HTTP), a P15 (wiersz F-API-03) jest ponad nim. (Indico ma REST API v2 z OpenAPI na roadmapie bez terminu.)
- **P16. Goście bez konta.** Rejestracja bez konta jest w Indico możliwa (opcja formularza „wymagaj logowania”), więc to parytet. Przewaga to jakość przepływu: potwierdzenie adresu e-mail linkiem, zarządzanie własnym zapisem i rezygnacja bez konta, ochrona formularza przed nadużyciami.

**Później** (tylko wpis na liście w specu, bez zadań): cyfrowe odznaki za udział w standardzie Open Badges i historia aktywności studenta; powiadomienia web push; rekomendacje wydarzeń; moduł komercyjny (sekcja 5.3).

### 3.4. Czego nie budujemy

Nie-cele: natywne aplikacje mobilne (Indico ich nie ma, wystarcza przeglądarka i PWA); własny silnik wideokonferencji (integrację z dostawcą budujemy, wiersze F-WID); funkcje wyłączone z parytetu z powodów F1 (a)–(c).

Anty-cele, czyli porażka nawet przy działającym kodzie:

- uczestnik musi zainstalować aplikację albo założyć osobne konto, żeby zapisać się na wydarzenie własnej uczelni;
- w produkcie widać ślad komercjalizacji produktu: cennik, baner „wykup”, zablokowaną funkcję, licznik licencji albo nagabywanie (opłaty pobierane przez organizatora od uczestników są funkcją i anty-celem nie są);
- funkcja jest uznana za gotową bez przechodzącego testu e2e powiązanego z wierszem katalogu;
- do użytkowników trafia funkcja działająca w połowie;
- dane uczestników służą do profilowania reklamowego albo produkt wysyła cokolwiek poza instancję bez wyraźnej zgody jej administratora (telemetria, łączenie z serwerem producenta).

## 4. Dowód parytetu — bramka i testy e2e

W repozytorium Indico nie ma testów end-to-end (brak Cypress, Playwright i Selenium; są 142 pliki testów jednostkowych w Pythonie i 9 w JavaScript). Dowód parytetu budujemy więc od zera i nie możemy go skądś przepisać.

### 4.1. Bramka `parity:check`

„Feature complete” to stan, w którym polecenie `parity:check` w trybie pełnym kończy się kodem 0. Nie opinia, nie mój podpis, nie przegląd. Kod 0 wymaga spełnienia pięciu warunków:

- **G1. Inwentarz.** Każda pozycja inwentarza Indico (trasa, tabela, enum, sygnał, ustawienie, polecenie CLI, zadanie, eksporter API) ma przypisany wiersz katalogu albo wyłączenie z powodem z F1. Pozycji nieprzypisanych jest zero.
- **G2. Katalog i testy.** Każdy wiersz „wymagana” ma co najmniej jeden test e2e z jego ID, a każde ID w nazwach testów wskazuje istniejący wiersz.
- **G3. Zielony przebieg.** Wszystkie te testy przechodzą w jednym przebiegu CI, bez ponowień. Test zaliczony dopiero po ponowieniu jest niestabilny, czyli czerwony. Żaden nie jest pominięty (`skip`, `fixme`, `only`).
- **G4. Macierze stanów.** Dla każdego enuma z inwentarza opisującego stan obiektu (stany abstraktu, rejestracji, zaproszenia, transakcji, rezerwacji sali, tryby ochrony, tryby tworzenia wydarzeń i podobne, a także stany dodane przez nas, jak lista rezerwowa) istnieje test każdego dozwolonego przejścia i test negatywny każdego niedozwolonego. Przejście niemożliwe z założenia dostaje wiersz z uzasadnieniem.
- **G5. Uprawnienia.** Dla każdego wiersza z polem `role` istnieje test dla każdej roli z dostępem i test odmowy dla roli bez dostępu (anonim, uczestnik, organizator, administrator).

Narzędzie ma tryb etapu (tylko wiersze przypisane do planów do bieżącego etapu włącznie) i tryb pełny. Jego raport (wiersz → testy → wynik → ostatni przebieg) jest jedyną miarą postępu. Nie podawaj postępu z pamięci.

### 4.2. Schemat katalogu (`katalog-funkcji.yaml`)

```yaml
- id: F-REJ-12.1
  domena: REJ
  tytul: Odznaczenie obecności po kodzie QR
  zachowanie:
    - "Gdy organizator skanuje bilet uczestnika, wtedy rejestracja ma stan „obecny” i widać to na liście."
  role: [organizator, administrator]      # role z dostępem; pozostałe dostają odmowę
  dowod_indico: [indico/modules/events/registration/controllers/management/reglists.py]  # ścieżki i symbole, bez numerów linii
  interfejs: [mobilny, desktop]
  status: wymagana                        # wymagana | wylaczona | do-decyzji
  wylaczenie: null                        # albo {powod: a|b|c|d, uzasadnienie: "..."}
  realizacja: rdzen                       # rdzen | wtyczka:<nazwa>
  plan: null                              # uzupełniane w Kroku 6: ścieżka planu i numery zadań
  testy: []                               # uzupełniane przez narzędzie
```

### 4.3. Zasady pisania testów

- **E1. Przez interfejs.** Test działa w przeglądarce z perspektywy użytkownika (kliknięcia, formularze). Skróty przez API wolno stosować tylko do przygotowania danych, nigdy do czynności będącej przedmiotem testu.
- **E2. Najpierw test.** Test e2e powstaje przed kodem i musi być czerwony z właściwego powodu, czyli z powodu braku zachowania. Czerwień wynikająca z błędu infrastruktury (brak serwera, zły selektor) nie jest dowodem. Nazwę testu i komunikat błędu zapisz w ledgerze.
- **E3. ID i asercje.** Nazwa testu zawiera ID wiersza w nawiasach kwadratowych, na przykład `[F-REJ-12.1]`, a komentarze Given/When/Then odpowiadają polu `zachowanie`. Asercje sprawdzają obserwowalny skutek (treść ekranu, wiadomość w skrzynce testowej, zawartość pobranego pliku, stan listy), a nie to, że strona się załadowała.
- **E4. Zawartość plików i wiadomości.** PDF sprawdzaj po wyodrębnionym tekście, CSV i XLSX po nagłówkach i wierszach, iCal po polach zdarzenia, e-mail po adresacie, temacie, treści i linkach.
- **E5. Niezależność i czas.** Każdy test tworzy własne dane i nie zależy od kolejności ani od innych testów; da się je uruchamiać równolegle. Zegar jest kontrolowany w testach (przypomnienia, retencja, terminy). Żadnych `sleep`.
- **E6. Usługi zewnętrzne.** SMTP, bramkę płatniczą, dostawcę wideokonferencji i dostawcę tożsamości zastępuje w e2e test double żyjący wyłącznie w kodzie testów (nie w produkcyjnym, T1). Kontrakt z piaskownicą dostawcy sprawdza osobne zadanie CI. Nie blokuje ono bramki, ale musi być zielone przed wydaniem danej wtyczki.
- **E7. Widoki i przeglądarki.** Ścieżki uczestnika działają przy 360 px (P1). Panel organizatora jest sprawdzany na desktopie i tablecie. Chromium jest obowiązkowy, a WebKit i Firefox obejmują co najmniej logowanie i rejestrację.
- **E8. Dostępność.** Widoki z listy kluczowych w specu przechodzą automatyczny skan dostępności (na przykład axe) w stanach, które test osiąga. Naruszenie poziomu A albo AA oznacza czerwony test.
- **E9. Współbieżność.** Limity miejsc, lista rezerwowa, rezerwacje sal, edycja notatek i decyzje recenzentów mają test z co najmniej 20 równoległymi sesjami, który potwierdza zachowanie niezmienników.
- **E10. Dane i retencja.** Testy RODO (P7) działają na kontrolowanym zegarze. Eksport i usunięcie danych sprawdzaj na prawdziwej zawartości. Migracje testuj na istniejących danych (T4).
- **E11. Dowód czułości.** Po zamknięciu domeny (a w Etapie 6 całości) wylosuj skryptem co najmniej 3 wiersze albo 10% wierszy, co większe. Dla każdego celowo zepsuj zachowanie w kodzie produkcyjnym na osobnej, nigdy niescalanej gałęzi i pokaż, że test poszedł na czerwono. Wynik zapisz w ledgerze, zepsucie cofnij. Losowanie robi skrypt, nie ty. W Etapie 6 próbę wykonuje świeży recenzent, który nie wie, które wiersze wylosowano.
- **E12. Pipeline.** Na każdym PR działa podzbiór podstawowy, a pełny zestaw na gałęzi głównej. Budżet czasu pełnego przebiegu ustal w specu parytetu; dzielenie na równoległe zadania CI jest dozwolone. W bramce nie ma ponowień.

### 4.4. Granice dowodu

Bramka dowodzi, że aplikacja ma zachowania opisane w katalogu na wzorcu z F1 i że testy je sprawdzają. Nie dowodzi braku błędów ani tego, że katalog uchwycił każdy niuans. Dlatego G1 wymusza pokrycie każdej trasy, tabeli i stanu Indico, a E11 sprawdza, że testy potrafią zawieść.

Weryfikacja uzupełniająca, poza bramką: jeśli środowisko pozwala uruchomić referencyjne Indico z commita wzorca (kontenery, osobny katalog, nie w repozytorium), przejdź obok siebie 20–30 najbardziej złożonych scenariuszy (rejestracja z opłatami i limitami, abstrakt od złożenia do akceptacji, harmonogram z sesjami równoległymi, rezerwacja cykliczna sali, dokument z szablonu) i zapisz różnice w `docs/superpowers/parity/porownanie-z-indico.md`. Jeśli środowisko na to nie pozwala, napisz to w raporcie.

## 5. Model biznesowy i moduł komercyjny

### 5.1. Strategia

Trzy warstwy:

1. **Rdzeń.** Darmowy, z otwartym kodem, z pełną funkcjonalnością katalogu. Moja uczelnia używa go bez opłat i bez klucza licencyjnego.
2. **Hosting zarządzany.** Płatna usługa uruchamiania i utrzymania instancji dla organizacji, które nie chcą robić tego same. Klient wybiera plan (rozmiar, poziom wsparcia, region). Jedna organizacja to jedna instancja (3.1).
3. **Płatne wtyczki.** Dodatkowe pakiety, które administrator kupuje i instaluje w swojej instancji. Rdzeń i hosting działają bez nich.

Co z tego wynika dla Indico: ani CERN, ani projekt nie sprzedają hostingu ani wtyczek. Hosting oferują firmy trzecie, a oficjalne wtyczki (płatności, Zoom, magazyn S3 i inne) są na licencji MIT. Płatne wtyczki to więc mój dodatek, bez bezpośredniego wzorca w Indico. Najbliższy sprawdzony wzorzec „rdzeń + hosting + płatne wtyczki” to pretix (dane w Załączniku B). Ma on inną licencję niż Indico, a to ma znaczenie dla opłacalności płatnych wtyczek (pytanie O3).

### 5.2. Teraz, w darmowym produkcie

- **B1. Zero komercjalizacji w kodzie.** W obecnym zakresie nie powstaje żaden kod, tabela, kolumna, flaga, ekran ani tekst dotyczący licencji, kluczy, planów, cenników, paywalli, liczników, limitów zależnych od planu, baneru „wykup” ani telemetrii. Opłaty rejestracyjne pobierane przez organizatora od uczestników są funkcją produktu (F-PLT, F-REJ), nie podlegają temu zakazowi i trafiają do organizatora, a nie do mnie. Produkt nie pobiera prowizji. Kod platformy hostingowej (przydzielanie instancji, rozliczenia, portal klienta) żyje w osobnym repozytorium, nigdy w rdzeniu. Rdzeń zna tylko obraz kontenera i konfigurację.
- **B2. System wtyczek teraz.** System wtyczek powstaje w pierwszym etapie jako część parytetu (Indico ma go od lat, wiersze F-PLG) i jest używany przez funkcje darmowego produktu. Od pierwszego wydania wtyczkami są: dostawcy płatności, dostawcy wideokonferencji, adaptery tożsamości (P8), integracja z USOS (P11) i magazyny plików poza lokalnym dyskiem. Wszystko, co ma być wtyczką, powstaje od razu wyłącznie na publicznym API wtyczek, a nie jako kod rdzenia do późniejszego wydzielenia. Dziś są one bezpłatne i niezależne od jakiejkolwiek licencji.
- **B3. Test architektury.** Rdzeń i wtyczki pierwszej generacji używają wyłącznie publicznego API. Test w CI wykrywa import prywatnych modułów rdzenia przez wtyczkę oraz jakikolwiek import wtyczki przez rdzeń. Dowód, że nowego dostawcę płatności lub wideokonferencji da się dodać bez zmiany rdzenia, to test z wtyczką żyjącą wyłącznie w katalogu testów.
- **B4. Instancja jest rozpoznawalna.** Instancja ma stały identyfikator widoczny na stronie „O systemie” w administracji razem z wersją rdzenia i listą zainstalowanych wtyczek (F-ADM-08). Potrzebują go wsparcie, hosting i diagnostyka. Jest to funkcja używana dziś, a nie punkt rozszerzenia „na zapas”.
- **B5. Parytet jest darmowy.** Wszystko z katalogu parytetu działa w darmowym rdzeniu. Płatna wtyczka nie może być warunkiem żadnego wiersza katalogu. Inaczej „feature complete” byłoby fikcją.

### 5.3. Później: moduł komercyjny (tylko spec)

Powstaje wyłącznie dokument `docs/superpowers/specs/RRRR-MM-DD-modul-komercyjny-design.md` ze statusem „ODROCZONY — bez planu i bez implementacji do mojej wyraźnej decyzji”. Planu implementacji teraz nie pisz. Spec ma być na tyle kompletny, żeby po mojej decyzji dało się od razu uruchomić `superpowers:writing-plans`. Każda podana w nim cena, licencja i warunek ma źródło. Spec opisuje:

- **C1. Licencjonowanie wtyczek.** Model per instancja: identyfikator instancji (B4) i podpisany plik licencji sprawdzany offline, okres ważności i okres karencji. Po wygaśnięciu wtyczka przestaje dodawać nowe funkcje, ale nigdy nie usuwa ani nie blokuje danych i nie wpływa na działanie rdzenia. Brak łączenia z serwerem bez wyraźnej zgody administratora. Sprawdzanie licencji żyje we wtyczce albo w osobnym pakiecie licencyjnym, nigdy w rdzeniu.
- **C2. Dystrybucja wtyczek.** Prywatny indeks pakietów, wersjonowanie, macierz zgodności z wersjami rdzenia, polityka wycofywania elementów API (wersjonowanie semantyczne, co najmniej dwa wydania ostrzeżenia).
- **C3. Hosting.** Instancja na klienta, infrastruktura jako kod, plany (rozmiar i miejsce na pliki, poziom wsparcia, region UE lub Polska, kopie zapasowe, okna aktualizacji), przejście klienta z hostingu na własny serwer i z powrotem bez utraty danych (z użyciem eksportu i importu z katalogu), portal klienta, rozliczenia i faktury (KSeF), umowa powierzenia przetwarzania danych (przy hostingu jestem podmiotem przetwarzającym).
- **C4. Wsparcie.** Poziomy, czasy reakcji, polityka zgłaszania i łatania podatności również dla instancji samodzielnie utrzymywanych.
- **C5. Katalog wtyczek kandydujących** (hipotezy do zweryfikowania, nie do budowy). Dla każdej: wartość dla klienta, dlaczego nie należy do parytetu (B5), czego wymaga od rdzenia, model ceny. Kandydaci: integracja z USOS dla innych uczelni; faktury KSeF dla opłat rejestracyjnych; dodatkowe bramki płatnicze popularne w Polsce; logowanie przez Microsoft Entra ID z provisioningiem; odznaki Open Badges; zaawansowane raporty i eksport do narzędzi BI; marka własna i własna domena; integracje z systemami e-learningu.
- **C6. Warunki wstępne.** (a) Własność praw autorskich do kodu i zgoda uczelni na komercjalizację (pytanie O3). (b) Wybór licencji rdzenia i skutki wyboru (O3). (c) Zasady przyjmowania cudzego kodu (umowa cesji lub licencji dla współtwórców), zanim pojawi się pierwszy zewnętrzny wkład. (d) Znak towarowy nazwy produktu. (e) Podatki: działalność gospodarcza, VAT, KSeF. (f) Regulamin i SLA. (g) RODO w roli podmiotu przetwarzającego. (h) Polityka bezpieczeństwa.
- **C7. Zmiany rdzenia.** Konkretna lista zmian, które po decyzji trzeba będzie wprowadzić w rdzeniu (każda z migracją i testami). Jeśli lista jest pusta, napisz to wprost.

Niczego z 5.3 nie implementuj ani nie przygotowuj „na zapas” (T1, T3).

## 6. Zero rozwiązań tymczasowych

Rozwiązanie tymczasowe to: komentarz TODO, FIXME albo HACK odkładający pracę; atrapa, stub albo zaślepka w kodzie produkcyjnym; dane wpisane na sztywno, które udają dynamiczne; flaga ukrywająca niedokończoną funkcję; zakomentowany kod; pominięty albo wyłączony test; logika zduplikowana „na razie”; ręczna zmiana bazy zamiast migracji; połykanie wyjątków; krok planu w rodzaju „TBD”, „obsłuż przypadki brzegowe”, „dopracować później”.

- **T1.** Żadne zadanie w planie nie wprowadza rozwiązania tymczasowego. Test double wolno trzymać wyłącznie w kodzie testów.
- **T2.** Każda pozycja z rejestru D dostaje zadanie, które usuwa ją właściwie, albo moją wyraźną zgodę na pozostawienie.
- **T3.** Jeśli czegoś nie da się zrobić porządnie w danym etapie, całość przechodzi do późniejszego etapu. Nie trafia do kodu w połowie.
- **T4.** Każda zmiana modelu danych idzie przez migrację z testem na istniejących danych.
- **T5.** Każda zmiana zachowania działającego już kodu to zadanie refaktoryzacji: najpierw test utrwalający obecne zachowanie, potem zmiana.
- **T6.** Konfiguracja instalacji (nazwa uczelni, dostawca tożsamości, adres Indico, włączenie zainstalowanej wtyczki) nie jest rozwiązaniem tymczasowym. Wartości specyficzne dla mojej uczelni nie mogą być zaszyte w kodzie.
- **T7.** Każde wymaganie ma kryterium akceptacji sprawdzane testem albo komendą. „Szybko”, „intuicyjnie” i „w miarę możliwości” nie są kryteriami.
- **T8.** Wiersz katalogu „wymagana” bez przechodzącego testu e2e jest rozwiązaniem tymczasowym. Funkcja bez takiego testu nie jest uznana za gotową.

## 7. Zmiana planu w trakcie wykonania

Skrypty i ledger Superpowers rozpoznają pracę po ścieżce pliku planu i numerze zadania. Dlatego:

- **Z1.** Nie zmieniaj nazwy ani położenia pliku planu, który ma ukończone zadania. Nie zmieniaj treści ani numerów zadań ukończonych.
- **Z2.** Każde nieukończone zadanie obecnego planu sklasyfikuj: bez zmian / do zmiany / do usunięcia.
- **Z3.** Jeśli wszystkie nieukończone zadania są „bez zmian”, obecny plan zostaje nietknięty i zostanie wykonany do końca jako pierwszy. Nowa praca trafia do nowych planów.
- **Z4.** Jeśli choć jedno jest „do zmiany” albo „do usunięcia”, zamknij obecny plan na ostatnim ukończonym zadaniu. Pod tytułem planu dopisz: „Zamknięty po Task K dnia RRRR-MM-DD; dalsza praca: <ścieżka nowego planu>”. Usuń z pliku treść nieukończonych zadań (historia zostaje w git). Wszystkie pozostałe zadania, zmienione i niezmienione, przenieś do nowego planu z nową numeracją. Jeśli plan ma ledger, dopisz w nim tę samą notę.
- **Z5.** Nowe plany zapisuj jako `docs/superpowers/plans/RRRR-MM-DD-<nazwa>.md` w formacie skilla writing-plans (nagłówek ze Spec, Global Constraints i Review Focus; zadania z Files, Interfaces i krokami TDD). Nagłówki zadań mają zawsze postać `### Task N: …` z angielskim słowem „Task”, także w planie pisanym po polsku. Inaczej skrypty nie znajdą zadań.
- **Z6.** Jeden plan to jeden etap albo spójna część etapu i kończy się działającym, przetestowanym oprogramowaniem. Plan, który przekracza 15 zadań, podziel na kolejne. W nagłówku każdego planu podaj jego miejsce w kolejności z Kroku 6, plany wymagane wcześniej i commit bazowy, od którego plan zakłada stan kodu. Pierwszy nowy plan zaczyna od stanu kodu, na którym kończy się obecny plan: zamknięty według Z4 albo wykonany do końca według Z3.
- **Z7.** Wymagania B1–B5, T1–T8, E1–E12 i G1–G5 skopiuj ze specu do sekcji Global Constraints każdego planu.
- **Z8.** Przed rozpoczęciem każdego kolejnego planu porównaj go z aktualnym kodem. Rozbieżności popraw w planie i pokaż mi zmiany przed wykonaniem.
- **Z9.** Każdy plan ma w nagłówku listę „Pokrywa:” z ID wierszy katalogu i numerami P, które realizuje. Każde zadanie wskazuje wiersze, które domyka, a jego kroki zawierają napisanie testu e2e z tymi ID i obserwację jego czerwonego wyniku (E2). Ostatnie zadanie planu to `### Task N: Bramka etapu`, które uruchamia `parity:check` w trybie etapu i wymaga kodu 0.

## 8. Pytania do mnie

Zadaj je w Kroku 4, jeśli odpowiedzi nie ma w kodzie ani w konfiguracji:

- **O1.** Z jakiego systemu tożsamości mojej uczelni ma korzystać aplikacja: USOS API, CAS, OIDC, SAML czy Microsoft Entra ID? Od tego zależą P8 i P11.
- **O2.** Jaki jest adres uczelnianego Indico i które kategorie importować (P12)? Czy potrzebna jest też jednorazowa pełna migracja archiwum (kategorie, wydarzenia, rejestracje, materiały), czy wystarczy import do odczytu? Rekomendacja domyślna: import do odczytu, a decyzja o pełnej migracji po Etapie 3 (wiersz F-MIG-02 ma status „do-decyzji”).
- **O3.** Prawa autorskie i licencja rdzenia. (a) Kto jest właścicielem majątkowych praw autorskich do kodu: ja, uczelnia czy współautorzy? To zależy od umów, regulaminu uczelni i sposobu powstania kodu. Nie rozstrzygaj tego; zapisz moją odpowiedź jako warunek wstępny w specu komercyjnym i oznacz ryzyko, jeśli odpowiedź brzmi „nie wiem”. To nie jest porada prawna; zaznacz, że wymaga konsultacji z prawnikiem albo biurem transferu technologii uczelni. (b) Jaka licencja rdzenia? MIT (jak Indico): maksymalna swoboda użycia, ale każdy, także konkurent, może hostować produkt i sprzedawać własne wersje, a nic nie chroni funkcji płatnych wtyczek przed odtworzeniem. AGPLv3 z osobną licencją komercyjną (jak pretix): kto uruchamia zmodyfikowaną wersję jako usługę dla innych, musi udostępnić jej kod, co utrudnia zamknięte forki hostingowe i pozwala sprzedawać licencję komercyjną i płatne wtyczki, ale wymaga, żebym był właścicielem całego kodu albo miał zgodę współautorów, i część instytucji niechętniej ją wdraża. Rekomendacja domyślna: AGPLv3 z licencją komercyjną, jeśli odpowiedź na (a) brzmi „ja”, bo to jedyny sprawdzony wzorzec z płatnymi wtyczkami; w przeciwnym razie MIT. Licencję trzeba wybrać przed pierwszym zewnętrznym wdrożeniem albo wkładem, bo późniejsza zmiana wymaga zgody wszystkich autorów.
- **O4.** Tylko jeśli część E audytu nie jest pusta: usunąć te elementy z kodu i opisać je w specu komercyjnym, czy wydzielić je do osobnej wtyczki wyłączonej domyślnie w konfiguracji instalacji?
- **O5.** Integracje na pierwsze wydanie: który dostawca płatności online (F-PLT-04), który dostawca wideokonferencji (F-WID-02), gdzie przechowywać pliki (dysk czy S3-kompatybilny magazyn) i jaka poczta wychodząca (SMTP)? Rekomendacja domyślna: płatność ręczna plus jedna bramka online obsługująca BLIK i szybkie przelewy; wideokonferencje dostawcy, z którego korzysta uczelnia; pliki na dysku z możliwością S3 jako wtyczki.

## 9. Co mi oddajesz

W ostatniej wiadomości podaj:

1. listę utworzonych i zmienionych plików;
2. tabelę przewag: pozycja P → status z audytu → plan i numery zadań, które ją realizują;
3. tabelę parytetu w podziale na domeny: domena → liczba wierszy → ile spełnionych, częściowych, brakujących → plany, które je realizują, oraz liczby inwentarza (przypisane / wyłączone / nieprzypisane);
4. pozycje przeniesione do „później” albo wyłączone, każdą z powodem i z odwołaniem do mojej zgody;
5. decyzje podjęte samodzielnie, każdą z uzasadnieniem;
6. liczbę zadań na etap (jako miarę względną rozmiaru pracy);
7. wynik testów bazowych z Kroku 1 i wynik `parity:check` uruchomionego na obecnym stanie kodu (tryb pełny, jeśli narzędzie już istnieje; w przeciwnym razie napisz, że powstaje w Etapie 0).

Potem czekaj na moją akceptację.

## Załącznik A. Katalog funkcji Indico (zalążek, stan: 19 listopada 2026)

To punkt wyjścia do Kroku 3, nie lista kompletna. Powstał z przeglądu kodu Indico w commicie wzorca (moduły, modele, enumy, trasy, `CHANGES.rst`). Pełny identyfikator wiersza to `F-` plus oznaczenie z listy (na przykład F-REJ-05). Zapis „(wtyczka)” oznacza, że funkcja ma być dostarczona jako wtyczka (B2). Powiązania z przewagami zaznaczono jako [P#].

### WYD. Wydarzenia i kategorie (`events`, `categories`)

- WYD-01 Trzy typy wydarzeń (wykład, spotkanie, konferencja) z różnym zestawem narzędzi i domyślnym motywem.
- WYD-02 Hierarchia kategorii dowolnej głębokości: tworzenie, przenoszenie, usuwanie, opis, ikona, ustawienia domyślne dziedziczone przez wydarzenia.
- WYD-03 Tryb tworzenia wydarzeń w kategorii: ograniczony do uprawnionych, moderowany (zatwierdza zarządca), otwarty; prośba o przeniesienie wydarzenia do kategorii zatwierdzana przez zarządcę.
- WYD-04 Wydarzenia bez kategorii („niewymienione”), widoczne tylko dla twórcy i wskazanych osób; włączane przez administratora.
- WYD-05 Tworzenie, edycja, przenoszenie i usuwanie wydarzenia (tytuł, termin, strefa czasowa, miejsce lub sala, organizator, opis, link) z wpisem w dzienniku. [P4]
- WYD-06 Klonowanie wydarzenia (jednorazowe i według wzorca powtarzania) z wyborem klonowanych elementów. [P4]
- WYD-07 Serie wydarzeń.
- WYD-08 Etykiety wydarzeń i zewnętrzne identyfikatory (referencje).
- WYD-09 Widoki kategorii: lista, przegląd tygodnia, kalendarz (miesiąc, tydzień, dzień) z filtrami kategorii, miejsca, sali i słów kluczowych; komunikat kategorii (informacja, ostrzeżenie, zagrożenie). [P5]
- WYD-10 Dziennik zmian kategorii oraz dziennik zdarzeń wydarzenia.
- WYD-11 Ulubione: wydarzenia, kategorie, osoby.
- WYD-12 Pulpit użytkownika: moje wydarzenia, zapisy, referaty, role, ulubione, sugestie kategorii; eksport pulpitu do iCal.
- WYD-13 Funkcje wydarzenia włączane i wyłączane (abstrakty, rejestracja, obrazy, redakcja, ankiety, referaty naukowe, płatności).
- WYD-14 Eksport iCal wydarzenia, kategorii i „moich” z alertami oraz ścieżką kategorii. [P5]
- WYD-15 Osoby wydarzenia (prowadzący, przewodniczący, prelegenci, autorzy): wyszukiwanie, łączenie z kontami, usuwanie osób bez powiązań.

### DOS. Dostęp i uprawnienia

- DOS-01 Tryby ochrony (publiczny, dziedziczony, chroniony) na kategorii, wydarzeniu, sesji, referacie, folderze i załączniku; obowiązuje ustawienie najbardziej szczegółowe.
- DOS-02 Listy dostępu: użytkownicy, grupy i role na każdym poziomie; klucz dostępu do chronionego wydarzenia.
- DOS-03 Uprawnienia zarządzania nadawane granularnie (pełne, tylko rejestracja, tylko abstrakty, tylko program i tym podobne) na wydarzeniu, sesji, referacie i kategorii.
- DOS-04 Role wydarzenia definiowane przez organizatora i przypisywane osobom; eksport członków roli do CSV.
- DOS-05 Grupy: lokalne oraz pochodzące od zewnętrznego dostawcy tożsamości; zarządzanie przez administratora.
- DOS-06 Sieci IP: zaufane zakresy adresów dające dostęp do chronionych zasobów bez logowania.
- DOS-07 Administrator systemu: nadawanie i odbieranie roli, pełny dostęp.

### REJ. Rejestracja uczestników (`events/registration`)

- REJ-01 Wiele formularzy rejestracyjnych na wydarzenie; okno otwarcia i zamknięcia, planowanie, wstrzymanie, limit uczestników, zmiana ustawień po otwarciu. [P2, P3]
- REJ-02 Edytor formularza: sekcje i pola układane przeciąganiem; typy pól: tekst, tekst wieloliniowy, liczba, wybór pojedynczy, wybór wielokrotny, data, tak/nie, telefon, kraj, e-mail, plik, obraz, zakwaterowanie, wybór sesji, osoby towarzyszące, afiliacja; etykiety statyczne; pola wymagane, włączone, wyłączone; pola warunkowe (widoczne zależnie od odpowiedzi w innym polu).
- REJ-03 Dane osobowe jako pola wbudowane z przypisaniem do typu danych (imię, nazwisko, e-mail, afiliacja i inne). [P2]
- REJ-04 Pola płatne: cena stała albo zależna od wyboru i ilości, limit miejsc na pojedynczą opcję, waluta.
- REJ-05 Stany rejestracji (zakończona, oczekująca na moderację, odrzucona, wycofana, oczekująca na płatność) i ich przejścia; moderacja ręczna; wymóg logowania jako opcja formularza. [P3, P16]
- REJ-06 Zaproszenia: rejestracja tylko na zaproszenie, zaproszenia e-mail, import z CSV, stany zaproszenia (oczekujące, przyjęte, odrzucone).
- REJ-07 Tagi rejestracji i filtrowanie po nich; lista rejestracji z kolumnami, filtrami, sortowaniem i zaznaczaniem zbiorczym; eksport PDF, CSV i XLSX.
- REJ-08 Ręczne dodanie, edycja i usunięcie rejestracji przez organizatora; zbiorcza zmiana opłaty.
- REJ-09 Modyfikacja i wycofanie rejestracji przez uczestnika w dozwolonym okresie, w tym wycofanie poza okresem modyfikacji. [P3]
- REJ-10 Powiadomienia e-mail do uczestnika (potwierdzenie, zmiana, płatność, moderacja) i do organizatorów; adres nadawcy; wyróżnienie zmienionych pól.
- REJ-11 Bilety PDF z kodem QR: w e-mailu, na stronie wydarzenia i w podsumowaniu; portfel Apple i Google.
- REJ-12 Odznaczanie obecności: ręcznie i po kodzie QR, sekret check-in, lista obecnych. [P9]
- REJ-13 Lista uczestników: ukryta, jawna albo jawna za zgodą, osobno dla publiczności i dla uczestników, z terminem publikacji.
- REJ-14 Prywatność: polityka prywatności wydarzenia z wymaganą akceptacją, administrator danych, okresy retencji całej rejestracji i pojedynczych pól, automatyczne usuwanie. [P7]
- REJ-15 Ochrona formularza przed nadużyciami (CAPTCHA). [P16]
- REJ-16 Osoby towarzyszące z własnymi biletami i identyfikatorami.
- REJ-17 Powiązanie rejestracji z sesjami (wybór sesji w formularzu).
- REJ-18 Statystyki rejestracji: liczby, przychody, podział według pól. [P13]

### PLT. Płatności (`events/payment`)

- PLT-01 Ramy płatności: dostawca płatności jako wtyczka (formularz płatności, obsługiwane waluty, ustawienia per wydarzenie, kontrola zgodności formularzy z dostawcą).
- PLT-02 Transakcje i ich statusy (udana, anulowana, nieudana, oczekująca, odrzucona) z dozwolonymi przejściami; historia transakcji rejestracji.
- PLT-03 Płatność ręczna (przelew, na miejscu): instrukcje dla uczestnika, oznaczanie opłaconych przez organizatora. (wtyczka)
- PLT-04 Co najmniej jedna bramka online wskazana w O5, z obsługą sukcesu, odmowy, anulowania, opóźnionego potwierdzenia i duplikatu powiadomienia. Kolejne bramki to wtyczki dodawane bez zmiany rdzenia (B3). (wtyczka)
- PLT-05 Rejestracja „oczekuje na płatność” przechodzi w „zakończoną” po zaksięgowaniu; zwrot i korekta opłaty przez organizatora.

### ABS. Abstrakty (`events/abstracts`)

- ABS-01 Wywołanie abstraktów z terminami składania i edycji, instrukcjami i uprawnieniami składania.
- ABS-02 Formularz abstraktu: tytuł, treść, pola własne (w tym wielokrotnego wyboru), autorzy, współautorzy, prelegenci, załączniki, wybór ścieżek i typu wkładu.
- ABS-03 Stany abstraktu (złożony, wycofany, przyjęty, odrzucony, połączony, duplikat, zaproszony) i publiczne stany; przejścia.
- ABS-04 Ścieżki tematyczne z konwenerami i grupami recenzentów; powiązane ścieżki.
- ABS-05 Recenzowanie: pytania recenzji, oceny, komentarze, rundy; role recenzenta, konwenera i sędziego; uprawnienia per ścieżka.
- ABS-06 Decyzje: akceptacja (jako referat z typem i ścieżką), odrzucenie, scalenie, oznaczenie duplikatu, zmiana decyzji; działania zbiorcze.
- ABS-07 Powiadomienia e-mail: szablony i reguły (warunki: ścieżka, stan) dla zmian stanu i nowych komentarzy; dziennik wysłanych wiadomości.
- ABS-08 Lista abstraktów organizatora z filtrami i eksport CSV, Excel, PDF; Księga abstraktów (PDF).
- ABS-09 Edycja, wycofanie i przywrócenie abstraktu przez autora w dozwolonym terminie; „moje abstrakty”.
- ABS-10 Przekształcenie przyjętych abstraktów w referaty z zachowaniem powiązań.

### REF. Referaty (`events/contributions`)

- REF-01 Referaty i podreferaty: typ, tytuł, opis, czas trwania, prelegenci, autorzy, sesja, ścieżka, sala lub miejsce, kod programu, pola własne, referencje zewnętrzne.
- REF-02 Lista referatów z filtrami, sortowaniem, działaniami zbiorczymi i eksportem CSV, Excel, PDF; PDF pojedynczego referatu tylko dla zalogowanych.
- REF-03 Zgłaszający materiały (prelegenci), „moje referaty”, ulubione referaty.
- REF-04 Uprawnienia i ochrona na poziomie referatu.
- REF-05 Osoby referatu: prelegenci, autorzy, afiliacje.

### PAP. Referaty naukowe i recenzje (`events/papers`)

- PAP-01 Wywołanie referatów: terminy, role (sędzia, recenzent treści, recenzent układu), pytania i oceny, szablony, kompetencje recenzentów, limit rund.
- PAP-02 Rewizje i pliki, komentarze, decyzje (akceptacja, odrzucenie, wymagane poprawki), powiadomienia.

### EDI. Redakcja publikacji (`events/editing`)

- EDI-01 Redakcja materiałów (referat, slajdy, plakat): rewizje plików, komentarze, tagi, warunki recenzji, role redaktora i recenzenta.
- EDI-02 Podłączenie zewnętrznej usługi redakcyjnej przez API.

### PRG. Program (`events/timetable`, `events/sessions`, `events/tracks`)

- PRG-01 Harmonogram wielodniowy z sesjami, przerwami i referatami edytowany przeciąganiem; sale i miejsca; sesje równoległe; wykrywanie konfliktów.
- PRG-02 Tryb roboczy harmonogramu widoczny tylko dla zarządców i publikacja.
- PRG-03 Przesuwanie czasu, zmiana czasu trwania, przeliczanie harmonogramu.
- PRG-04 Widoki programu (lista, dzień, „mój program”) z filtrami i kolorami sesji; eksport PDF (domyślny i konfigurowalny) i iCal.
- PRG-05 Sesje: typy, kody, konwenerzy, uprawnienia sesji, eksport sesji do CSV, Excel i PDF.
- PRG-06 Ścieżki programu z konwenerami.

### MAT. Materiały, notatki, kopia offline

- MAT-01 Załączniki (pliki i linki) w folderach na poziomie wydarzenia, sesji, referatu i kategorii; ochrona per folder i załącznik; sumy kontrolne; podgląd plików rozszerzalny wtyczkami.
- MAT-02 Notatki z posiedzeń z edytorem, wersjami i rozwiązywaniem konfliktów przy równoczesnej edycji; sanityzacja treści.
- MAT-03 Magazyn plików z wymiennym backendem (dysk lokalny domyślnie, S3 jako wtyczka) i czyszczeniem plików nieprzypisanych. (wtyczka)
- MAT-04 Kopia offline wydarzenia (archiwum do pobrania) generowana w tle i czyszczona po terminie.

### ANK. Ankiety (`events/surveys`)

- ANK-01 Ankiety wydarzenia: typy pytań, termin, anonimowość, wyniki, eksport CSV i XLSX, powiadomienie o starcie, wiadomości do uczestników.

### WYG. Wygląd wydarzenia (`events/layout`)

- WYG-01 Menu wydarzenia: pozycje wbudowane, własne, strony i linki, widoczność per rola (także tylko dla prelegentów), kolejność.
- WYG-02 Motywy wydarzenia (wykład, spotkanie, style konferencji z wariantami), własny CSS, logo i obrazy.
- WYG-03 Własne strony treści.
- WYG-04 Nagłówek, stopka i ustawienia wyświetlania.

### KOM. Komunikacja (`events/reminders`, `agreements`, `requests`)

- KOM-01 Przypomnienia e-mail o wydarzeniu: zaplanowane względem początku lub końca, do uczestników, prelegentów i wskazanych adresów, jako osobne wiadomości, z podsumowaniem. [P10]
- KOM-02 Wiadomości do osób z list (rejestracje, abstrakty, osoby wydarzenia): edytor z placeholderami, podgląd, wysyłka do wybranych.
- KOM-03 Umowy i zgody (agreements): formularze akceptowane przez osoby wydarzenia, stan, przypomnienia.
- KOM-04 Żądania do usług zewnętrznych definiowane przez wtyczki: wniosek, zatwierdzenie, odrzucenie, wycofanie.
- KOM-05 Poczta wychodząca: ustawienia SMTP, dozwolone adresy nadawcy z adresem zastępczym, kolejka wysyłki, dziennik.

### DOK. Dokumenty i identyfikatory (`designer`, `receipts`)

- DOK-01 Edytor szablonów identyfikatorów, biletów i plakatów: układ przeciąganiem, pola dynamiczne, obrazy tła i dodatkowe, formaty i orientacja, powiązanie szablonu z formularzem rejestracji, druk zbiorczy, identyfikatory osób towarzyszących.
- DOK-02 Szablony dokumentów: zaświadczenia o uczestnictwie i pokwitowania; generowanie PDF dla wybranych uczestników, wysyłka e-mailem, szablony domyślne, dane przykładowe.
- DOK-03 Generowanie PDF z ochroną przed pobieraniem zasobów z adresów wewnętrznych (SSRF).

### SAL. Rezerwacja sal (`rb`)

- SAL-01 Lokalizacje i sale: atrybuty, wyposażenie, cechy, zdjęcia, pojemność, godziny dostępności, okresy niedostępności, strefy mapy, właściciele i zarządcy.
- SAL-02 Wyszukiwanie wolnych sal z filtrami i rezerwacje pojedyncze i cykliczne (codziennie, co 1, 2 i 3 tygodnie, co miesiąc, w wybrane dni tygodnia); rezerwacja w czyimś imieniu.
- SAL-03 Stany rezerwacji (oczekująca, zaakceptowana, anulowana, odrzucona) i ich przejścia; akceptacja i odrzucenie przez właściciela sali z powodem.
- SAL-04 Blokady sal z uprawnieniami.
- SAL-05 Powiadomienia (nowa rezerwacja, decyzja, zbliżający się koniec) oraz historia zmian rezerwacji.
- SAL-06 Powiązanie rezerwacji z wydarzeniem, sesją albo referatem.
- SAL-07 Ulubione sale, kalendarz, statystyki użycia, eksport rezerwacji przez HTTP API (w tym iCal).
- SAL-08 Administracja: lokalizacje, atrybuty, wyposażenie, mapy, ustawienia.

### WID. Wideokonferencje (`vc`)

- WID-01 Ramy wideokonferencji: dostawca jako wtyczka; pokoje powiązane z wydarzeniem, sesją i referatem (tworzenie, edycja, usuwanie, odłączanie, klonowanie z wydarzeniem); link do dołączenia na stronie wydarzenia; uprawnienia. (wtyczka)
- WID-02 Co najmniej jeden dostawca wskazany w O5. (wtyczka)

### UZY. Użytkownicy (`users`)

- UZY-01 Konto lokalne: rejestracja z potwierdzeniem e-mail, reset i zmiana hasła (jeśli włączone).
- UZY-02 Profil: dane osobowe, afiliacja (ze słownika), adresy e-mail (główny i dodatkowe), zdjęcie, strefa czasowa, język, preferencje.
- UZY-03 Połączone tożsamości (wiele logowań w jednym koncie), scalanie kont i blokowanie użytkowników przez administratora.
- UZY-04 Wyszukiwarka osób i sugestie.
- UZY-05 Eksport wszystkich danych użytkownika i anonimizacja konta. [P7]
- UZY-06 Akceptacja warunków użytkowania przy rejestracji i po ich zmianie.
- UZY-07 Administracja użytkownikami: wyszukiwanie, tworzenie, edycja, afiliacje.

### UWT. Uwierzytelnianie

- UWT-01 Konto lokalne z hasłem, włączane i wyłączane w konfiguracji.
- UWT-02 Zewnętrzni dostawcy tożsamości: LDAP, SAML, Shibboleth, OAuth i OIDC; mapowanie atrybutów i grup. (wtyczka) [P8]
- UWT-03 Adapter CAS i USOS dla polskich uczelni. (wtyczka) [P8, P11]
- UWT-04 Aplikacje OAuth2, zgody użytkownika i osobiste tokeny dostępu; ochrona CSRF punktów autoryzacji.

### WYS. Wyszukiwanie (`search`)

- WYS-01 Wyszukiwanie wydarzeń, referatów, plików, osób, kategorii i notatek z filtrami, z uwzględnieniem uprawnień. [P5]
- WYS-02 Zewnętrzny silnik wyszukiwania podłączany przez wtyczkę. (wtyczka)

### API. API i integracje

- API-01 Eksport HTTP: kategorie, wydarzenia, program, osoby, pliki, wyszukiwanie wydarzeń, rezerwacje sal; uwierzytelnianie tokenami. [P15]
- API-02 Subskrypcje iCal: wydarzenia, kategorie, „moje”.
- API-03 Publiczne REST API z opisem OpenAPI i widżet „najbliższe wydarzenia”. [P15]
- API-04 Synchronizacja zmian do systemów zewnętrznych przez kolejkę zmian (odpowiednik wtyczki livesync). (wtyczka)

### ADM. Administracja i operacje

- ADM-01 Ustawienia systemu (nazwa, logo, strefa czasowa, języki, poczta, polityki, funkcje) w interfejsie i w pliku konfiguracji.
- ADM-02 Aktualności i komunikat administratora widoczny na wszystkich stronach.
- ADM-03 Dokumenty prawne: warunki użytkowania, polityka prywatności, deklaracja dostępności. [P6, P7]
- ADM-04 Dzienniki: zdarzeń wydarzenia, kategorii, użytkownika, czynności administratora.
- ADM-05 Komunikaty o poprawkach bezpieczeństwa i przestarzałych komponentach, pobierane z serwera projektu wyłącznie po włączeniu przez administratora (domyślnie wyłączone, zgodnie z anty-celem z 3.4) i bez wysyłania danych instancji.
- ADM-06 Polecenia administracyjne (CLI): migracje bazy, użytkownicy, anonimizacja, scalanie, sprzątanie, konserwacja.
- ADM-07 Zadania w tle: przypomnienia, retencja, sprzątanie plików i kopii offline, wiadomości, generowanie PDF i eksportów; harmonogram zadań cyklicznych.
- ADM-08 Strona „O systemie”: wersja, identyfikator instancji, wtyczki, stan zdrowia (B4).
- ADM-09 Zarządzanie wtyczkami: lista, włączanie i wyłączanie, ustawienia wtyczki w interfejsie administratora.

### PLG. System wtyczek

- PLG-01 Pakiet wtyczki (punkt wejścia, manifest, wersja, zgodność z rdzeniem), ładowanie przy starcie, czytelny błąd przy niezgodności.
- PLG-02 Ustawienia wtyczki: schemat, interfejs administratora, wartości domyślne z pliku konfiguracji i zmiennych środowiskowych.
- PLG-03 Własne tabele wtyczki z własnymi migracjami; bezpieczne wyłączenie i usunięcie bez utraty danych rdzenia.
- PLG-04 Zdarzenia cyklu życia (odpowiednik 166 sygnałów Indico) obejmujące wydarzenie, rejestrację, abstrakt, referat, użytkownika, kategorię, rezerwację, załącznik; wtyczka może reagować, a tam, gdzie Indico na to pozwala, także ograniczać zachowanie (na przykład dostęp do rejestracji).
- PLG-05 Punkty rozszerzeń interfejsu: pozycje menu, zakładki zarządzania, pola formularzy, placeholdery wiadomości i dokumentów, motywy, filtry list.
- PLG-06 Punkty rozszerzeń dziedzinowe: dostawca płatności, dostawca wideokonferencji, magazyn plików, dostawca tożsamości, silnik wyszukiwania, typ żądania, umowa, podgląd plików.
- PLG-07 Własne trasy i API wtyczki, tłumaczenia, zasoby statyczne, polecenia CLI.
- PLG-08 Stabilność kontraktu: wersjonowanie semantyczne, polityka wycofywania, test kontraktowy publicznego API.

### I18. Języki, strefy czasowe, dostępność

- I18-01 Interfejs wielojęzyczny: polski i angielski w pierwszym wydaniu; dodanie kolejnego języka wymaga wyłącznie pliku tłumaczeń (Indico ma 19 lokalizacji, w tym polską). [P6]
- I18-02 Strefy czasowe: wydarzenie w swojej strefie, wyświetlanie w strefie użytkownika, formaty dat.
- I18-03 Dostępność WCAG 2.1 AA: nawigacja klawiaturą, kontrast, czytnik ekranu. [P6]
- I18-04 Treść wydarzenia w dwóch językach. [P14]

### OPS. Wdrożenie i operacje

- OPS-01 Powtarzalne wdrożenie produkcyjne (kontenery), konfiguracja wyłącznie z pliku i zmiennych środowiskowych, bez ręcznych kroków.
- OPS-02 Aktualizacje: migracje bazy z testem na danych, polecenie aktualizacji, sprawdzanie zgodności wersji.
- OPS-03 Kopie zapasowe i odtwarzanie: udokumentowane polecenia oraz test odtworzenia.
- OPS-04 Obserwowalność: punkt kontroli zdrowia, metryki (odpowiednik wtyczki Prometheus), dzienniki strukturalne. (wtyczka)
- OPS-05 Opcjonalna analityka (odpowiednik wtyczki Matomo), domyślnie wyłączona. (wtyczka)
- OPS-06 Bezpieczeństwo: ochrona CSRF, sanityzacja treści (XSS), ochrona przed SSRF przy pobieraniu adresów i generowaniu PDF, nagłówki bezpieczeństwa, wymóg publicznych adresów IP w połączeniach wychodzących.

### MIG. Współistnienie i migracja

- MIG-01 Import wydarzeń z uczelnianego Indico do odczytu (HTTP Export API albo iCal) do wspólnego kalendarza. [P12]
- MIG-02 Jednorazowa pełna migracja archiwum Indico (kategorie, wydarzenia, rejestracje, materiały). Status „do-decyzji” (O2).

## Załącznik B. Dane rynkowe i ustalenia z repozytorium Indico (stan: 19 listopada 2026)

To uzasadnienie decyzji z sekcji 3, 4 i 5. Zanim oprzesz na którymś punkcie decyzję techniczną albo biznesową, sprawdź go u źródła.

**Indico, ustalenia z kodu (commit z sekcji 1)**

- Wersja 3.3.15-dev, licencja MIT, rozwijane przez CERN od około 20 lat. 23 moduły, około 1000 tras HTTP, 143 tabele, 166 sygnałów, 97 ustawień konfiguracji, 19 lokalizacji tłumaczeń (w tym pl_PL).
- Funkcje wydarzenia przełączane osobno: abstrakty, rejestracja, obrazy, redakcja, ankiety, referaty naukowe, płatności. Trzy typy wydarzeń: wykład, spotkanie, konferencja.
- Testy: 142 pliki w Pythonie, 9 w JavaScript, brak narzędzi e2e (sprawdzone po zależnościach i katalogach).
- W kodzie nie ma listy rezerwowej. Prośba o nią czeka od 2017 r. (zgłoszenie nr 3036); w zgłoszeniu z 2022 r., zamkniętym jako duplikat, jako obejście opisano drugi formularz rejestracyjny.
- Rejestracja bez konta jest możliwa: formularz ma opcję wymagania logowania.
- Wersja 3.3 dodała szablony dokumentów PDF (zaświadczenia, pokwitowania), aplikację do check-inu w formie osobnej PWA, eksport i anonimizację danych użytkownika, akceptację warunków użytkowania, polityki prywatności i retencję danych rejestracji, portfel Google, nowe widoki kalendarza kategorii i poprawki dostępności.
- Treść wpisywana przez organizatora (tytuł, opis) ma jedną wersję językową.
- Oficjalne wtyczki (repozytorium `indico-plugins`, licencja MIT, 18 katalogów): citadel, cloud_captchas, livesync, livesync_debug, owncloud, payment_manual, payment_paypal, payment_sixpay, payment_stripe, piwik, previewer_code, previewer_jupyter, prometheus, storage_s3, themes_legacy, ursh, vc_dummy, vc_zoom.
- Roadmapa (getindico.io/roadmap): 2026 — wersja 3.4 z przepisanym zarządzaniem programem; 2027 — wersja 3.5 z nową stroną główną, dashboardem i widokiem spotkań oraz lepszą obsługą telefonów na przeprojektowanych stronach. Bez terminu: REST API v2 z OpenAPI, lepsza obsługa osób bez konta, wielojęzyczna treść wydarzeń.
- Indico udostępnia wydarzenia przez HTTP Export API, między innymi `/export/categ/<id>.json`, oraz w formacie ICS.

**Model biznesowy**

- Hosting zarządzany Indico oferują firmy trzecie: na przykład Mythic Beasts (Business od 100 GBP miesięcznie, Enterprise od 400 GBP miesięcznie, ceny netto, kopie zapasowe, wybór regionu UK, UE albo USA) i Elestio. CERN ani projekt nie sprzedają hostingu ani wtyczek.
- pretix (najbliższy wzorzec z płatnymi wtyczkami): rdzeń na licencji AGPLv3 z dodatkowymi warunkami oraz licencja komercyjna „Enterprise”. Kto uruchamia pretix dla innych, musi udostępnić kod. Hosting pobiera 2,5% ceny biletu, najwyżej 15 EUR, plus opłaty operatora płatności. Licencje Enterprise dla własnego serwera zaczynają się od około 499 EUR rocznie (zależnie od skali) i dają „punkty licencyjne” na wtyczki proprietary; jest też marketplace wtyczek. Sprawdź aktualny cennik u źródła.
- Inne ceny odniesienia: Konfeo od około 0,50 USD za rejestrację; CONREGO od 47 USD miesięcznie; Oxford Abstracts około 890 USD za wydarzenie; Fourwaves około 899 USD rocznie.

**Rynek i prawo w Polsce**

- Wydarzenia bezpłatne: mediana nieobecności około 28%, przy płatnych około 17% (PheedLoop, ponad 1000 wydarzeń).
- Ustawa z 4 kwietnia 2019 r. o dostępności cyfrowej obejmuje uczelnie publiczne: WCAG 2.1 AA, deklaracja dostępności, możliwe kary finansowe.
- USOS API: OAuth 1.0a, logowanie przez CAS uczelni, osobna instalacja na każdej uczelni. Uczelnie z USOS kształcą około 2/3 studentów uczelni publicznych (dane za 2022 r.).
- KSeF jest obowiązkowy od 1 lutego 2026 r. dla dużych firm, od 1 kwietnia 2026 r. dla pozostałych, od 1 stycznia 2027 r. dla najmniejszych. Dotyczy faktur, które wystawiałbym ja jako sprzedawca hostingu i wtyczek (sekcja 5.3, C3 i C5).
- Platformy życia kampusu (CampusGroups, Anthology Engage) działają w USA: aplikacja mobilna, organizacje studenckie, śledzenie udziału. Polskiego odpowiednika nie znalazłem.
- Odznaka+ (IBE): cyfrowe odznaki w standardzie Open Badges, pilotaż z udziałem uczelni.
