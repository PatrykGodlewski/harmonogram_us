# Zlecenie: uproszczenie pracy i nowy kierunek produktu

Pracujesz nad moją aplikacją do wydarzeń na uczelni. Zmieniam kierunek i chcę uprościć całą pracę. Ten dokument zastępuje wszystkie wcześniejsze wersje tego zlecenia.

**Cel:** nowa, własna aplikacja do wydarzeń uczelnianych, prostsza i wygodniejsza od Indico. Nie budujemy kopii Indico. Indico służy wyłącznie jako inspiracja, co warto mieć. Wolę mniej funkcji zrobionych dobrze i do końca niż wiele zrobionych w połowie.

Dopóki nie zatwierdzę zaktualizowanego specu i planu, nie implementuj żadnych nowych funkcji. To zlecenie ma pierwszeństwo przed zasadą nieprzerwanego wykonywania planu.

## Krok 1. Zatrzymaj się bezpiecznie

1. Zapisz ten dokument jako `docs/superpowers/briefs/RRRR-MM-DD-kierunek-produktu.md` i zacommituj. Po kompakcji kontekstu wracaj do tego pliku.
2. Dokończ zadanie, które jest w toku: testy przechodzą, commit, wpis w ledgerze. Nie zaczynaj kolejnego.
3. Nie usuwaj zmian w drzewie roboczym, które nie należą do żadnego zadania. Opisz je i zapytaj mnie, co z nimi zrobić.
4. Uruchom wszystkie testy i zapisz wynik.

## Krok 2. Sprawdź, co zrobiłeś, i uprość

Przejrzyj uczciwie dotychczasową pracę: kod, testy, specy, plany, ledgery, `git log`. Jeśli zacząłeś według poprzedniej wersji tego zlecenia (inwentarz Indico, katalog funkcji F-xxx, narzędzie `parity:check`, bramki parytetu), przerwij to i niczego dalej nie rozbudowuj.

Zapisz krótki raport w `docs/superpowers/audits/RRRR-MM-DD-przeglad.md`:

- **Co działa:** funkcje, które działają i mają testy, z odwołaniem do plików.
- **Co jest niedokończone:** zaczęte, ale niedziałające albo bez testów.
- **Co jest za skomplikowane:** abstrakcje bez drugiego użycia, kod przygotowany „na przyszłość”, nieużywany kod, zduplikowana logika, nadmiar konfiguracji, zbędne zależności.
- **Rozwiązania tymczasowe:** TODO, atrapy w kodzie produkcyjnym, dane na sztywno, zakomentowany kod, pominięte testy, ręczne zmiany bazy zamiast migracji. Każde z plikiem i linią.
- **Co jest za ciężkie w procesie:** ile jest speców, planów i dokumentów, które się dublują albo są nieaktualne; czy zadania w planach są za drobne lub za duże; ile kosztuje wykonanie jednego zadania (liczba przeglądów, subagentów, kroków).

Na końcu raportu zaproponuj uproszczenia w dwóch listach:

**A. Uproszczenia kodu.** Co usunąć, połączyć albo przepisać prościej i jakie ryzyko to niesie. Każda zmiana zachowania działającego kodu wymaga najpierw testu, który to zachowanie utrwala.

**B. Uproszczenie procesu pracy.** Docelowo:

- jeden spec produktu jako jedyne źródło prawdy; nieaktualne specy i plany oznacz jako archiwalne (dopisek na górze), a nie usuwaj;
- jeden aktywny plan naraz, najwyżej około 10 zadań, kończący się działającą funkcją;
- zadanie to jedna funkcja albo jej spójna część z testem, a nie pojedyncza drobna zmiana;
- sposób wykonywania dobrany do zadania: proste zadania wykonuj sam (`superpowers:executing-plans`), subagentów używaj tylko tam, gdzie zadanie jest naprawdę złożone;
- bez dodatkowych dokumentów, narzędzi i bramek, jeśli nie są potrzebne do zbudowania lub przetestowania funkcji.

Pokaż mi raport i obie listy, a potem poczekaj na moją decyzję. Bez mojej zgody niczego nie usuwaj.

## Krok 3. Zaktualizuj spec

Po mojej decyzji zaktualizuj istniejący spec produktu w miejscu i dodaj na górze krótką sekcję „Historia zmian”. Spec zawiera:

- cel i dla kogo jest aplikacja (sekcja „Kierunek produktu”),
- listę funkcji z priorytetami (sekcja „Funkcje”); przy każdej funkcji jedno lub dwa zdania, co użytkownik może zrobić, oraz kryterium „gotowe”,
- zasady (sekcja „Zasady”),
- monetyzację jako osobny, odroczony moduł (sekcja „Monetyzacja”).

Jeśli coś z listy funkcji już działa, zaznacz to. Jeśli moja lista koliduje z tym, co już jest w kodzie, opisz konflikt i zaproponuj rozwiązanie, zamiast zgadywać.

Poczekaj na moją akceptację specu.

## Krok 4. Plan

Po akceptacji użyj `superpowers:writing-plans` i napisz plan tylko dla funkcji z priorytetu 1, które jeszcze nie działają, plus uproszczenia zatwierdzone w Kroku 2. Kolejne priorytety dostaną własne plany, gdy skończymy poprzedni.

Zasady dla planów w Superpowers:

- Nie zmieniaj nazwy ani numerów zadań w planie, który ma ukończone zadania (ledger rozpoznaje pracę po ścieżce pliku i numerze zadania). Jeśli stary plan trzeba zmienić, zamknij go na ostatnim ukończonym zadaniu z dopiskiem „Zamknięty po Task K; dalsza praca: <nowy plan>”, a resztę przenieś do nowego planu.
- Nagłówki zadań zawsze w postaci `### Task N: …` z angielskim słowem „Task”, także w planie po polsku.

Pokaż mi plan i poczekaj na akceptację. Potem wykonuj go sposobem ustalonym w Kroku 2.

## Kierunek produktu

Kampusowe centrum wydarzeń: seminaria, wykłady gościnne, koła naukowe, samorząd, biuro karier, a później także konferencje. Uczestnik znajduje wydarzenie i zapisuje się z telefonu w kilkanaście sekund. Organizator publikuje wydarzenie w dwie minuty, bez szkolenia.

Przewagi nad Indico, które mają być widoczne od pierwszej wersji:

- **Telefon.** Wszystko, co robi uczestnik, działa wygodnie na telefonie (Indico planuje poprawę obsługi telefonów dopiero na 2027 r.).
- **Lista rezerwowa.** Automatyczny awans z listy po zwolnieniu miejsca (Indico jej nie ma).
- **Prostota.** Krótkie formularze, rozsądne wartości domyślne, minimum kliknięć.
- **Polski kontekst.** Interfejs po polsku i angielsku, logowanie kontem uczelni, docelowo integracja z USOS.

Jedna uczelnia to jedna instalacja. Nazwa uczelni, logo i sposób logowania są konfiguracją, a nie kodem. Do czasu, gdy aplikacja wystarczy uczelni, Indico działa obok.

## Funkcje

Lista powstała z przeglądu repozytorium Indico, ale opisuje, czego potrzebują nasi użytkownicy, a nie jak to robi Indico. Szczegóły każdej funkcji ustal ze mną albo zaproponuj sam, w najprostszej wersji, która spełnia opis.

### Priorytet 1: pierwsza wersja dla uczelni

1. **Konta i logowanie.** Logowanie kontem uczelni (sposób ustalimy, zobacz pytania na końcu) oraz opcjonalnie kontem lokalnym. Profil z imieniem, nazwiskiem, e-mailem i językiem.
2. **Role i uprawnienia.** Uczestnik, organizator, administrator. Organizator zarządza swoimi wydarzeniami i może dodać współorganizatorów. Wydarzenie może być publiczne albo tylko dla zalogowanych.
3. **Wydarzenia.** Tworzenie, edycja, publikacja, odwołanie i duplikowanie. Tytuł, opis, termin, miejsce albo link, organizator lub jednostka, kategoria.
4. **Kalendarz kampusu.** Lista i kalendarz wszystkich wydarzeń z filtrami (termin, kategoria, jednostka, na miejscu czy online), wyszukiwaniem i subskrypcją w kalendarzu (ICS). Każde wydarzenie ma stały link, który dobrze wygląda po udostępnieniu.
5. **Zapisy.** Zapis jednym kliknięciem dla zalogowanych, limit miejsc, lista rezerwowa z automatycznym awansem, samodzielna rezygnacja. Równoczesne zapisy nigdy nie przekraczają limitu.
6. **Powiadomienia e-mail.** Potwierdzenie zapisu, awans z listy rezerwowej, odwołanie wydarzenia.
7. **Panel organizatora.** Lista zapisanych i rezerwowych, ręczne dodanie lub usunięcie osoby, eksport do CSV, wiadomość do zapisanych.
8. **Dostępność i języki.** WCAG 2.1 AA (wymóg ustawowy dla uczelni publicznej), strona z deklaracją dostępności, interfejs po polsku i angielsku.
9. **RODO.** Klauzula informacyjna przy zapisie, automatyczne usuwanie danych zapisów po ustalonym czasie, eksport i usunięcie własnych danych przez użytkownika.

### Priorytet 2: wygoda organizatora

10. **Własne pytania w formularzu zapisu.** Kilka typów pól (tekst, wybór, tak/nie), pola wymagane i opcjonalne.
11. **Bilety i obecność.** Kod QR w potwierdzeniu zapisu; organizator odhacza obecność, skanując kod telefonem.
12. **Zaświadczenia.** PDF z potwierdzeniem udziału dla obecnych.
13. **Przypomnienia i zmiany.** Przypomnienie przed wydarzeniem; automatyczna informacja o zmianie terminu lub miejsca.
14. **Materiały.** Pliki i linki przy wydarzeniu (slajdy, nagrania).
15. **Statystyki.** Dla organizatora: zapisani, obecni, odsetek nieobecnych. Dla administratora: liczba wydarzeń i zapisów w czasie.
16. **Wydarzenia z Indico w kalendarzu.** Import do odczytu wydarzeń z uczelnianego Indico, z linkiem do oryginału.
17. **Goście bez konta.** Zapis z potwierdzeniem e-mailem i możliwość rezygnacji z linku.

### Priorytet 3: większe wydarzenia

18. **Program wydarzenia.** Harmonogram z punktami programu, prelegentami i salami, także na kilka dni.
19. **Prelegenci i referaty.** Lista wystąpień z opisami i materiałami prelegentów.
20. **Ankiety.** Ankieta po wydarzeniu z prostym podsumowaniem wyników.
21. **Opłaty za udział.** Płatność ręczna (przelew) oraz jedna bramka online. Pieniądze trafiają do organizatora.
22. **Strona wydarzenia.** Logo, obraz nagłówka, własne podstrony.
23. **Wideokonferencje.** Automatyczne tworzenie spotkania u dostawcy używanego przez uczelnię.
24. **API i widżet.** Publiczne API do odczytu wydarzeń i widżet „najbliższe wydarzenia” do osadzenia na stronach wydziałów.
25. **Integracja z USOS.** Zapisy ograniczone do wydziału lub kierunku, ostrzeżenie o kolizji z planem zajęć.

### Później (tylko wpis w specu, bez planu)

Zgłaszanie i recenzowanie abstraktów, rezerwacja sal, identyfikatory do druku, treść wydarzeń w dwóch językach, cyfrowe odznaki za udział, powiadomienia push, rekomendacje wydarzeń.

Kolejność wewnątrz priorytetu możesz zmienić, jeśli wymagają tego zależności techniczne. Powiedz mi wtedy dlaczego.

## Zasady

- **Funkcja jest gotowa, gdy przechodzi test e2e.** Każda funkcja z listy ma testy end-to-end w przeglądarce, które przechodzą przez jej główne ścieżki z perspektywy użytkownika i sprawdzają widoczny skutek (treść ekranu, wysłany e-mail, zawartość pliku). Ścieżki uczestnika testuj też w widoku telefonu (360 px). Testy e2e działają w CI. Test piszesz przed kodem i widzisz, że najpierw nie przechodzi. Nazwa testu zawiera numer funkcji z listy, na przykład `[F5] zapis na pełne wydarzenie trafia na listę rezerwową`.
- **Bez rozwiązań tymczasowych.** Bez TODO, atrap w kodzie produkcyjnym, danych na sztywno, zakomentowanego kodu i pominiętych testów. Zmiany bazy danych tylko przez migracje. Jeśli czegoś nie da się zrobić porządnie teraz, przesuń to w całości na później.
- **Bez kodu „na przyszłość”.** Abstrakcję wprowadzasz dopiero wtedy, gdy ma drugie użycie. Wyjątek: integracje zewnętrzne (logowanie, płatności, wideokonferencje, import z Indico) są od początku za prostym wspólnym interfejsem, bo w przyszłości mogą być wtyczkami (zobacz „Monetyzacja”).
- **Prosto.** Jeśli są dwa sposoby, wybierz prostszy. Jeśli funkcja rośnie poza opis, zatrzymaj się i zapytaj.

## Monetyzacja

Model docelowy jest taki jak w Indico, z jednym dodatkiem:

1. **Aplikacja jest darmowa** i ma otwarty kod. Moja uczelnia używa jej bez opłat.
2. **Płatny hosting do wyboru** dla organizacji, które nie chcą utrzymywać serwera. Ten, kto chce, uruchamia aplikację sam za darmo.
3. **Płatne wtyczki** (mój dodatek), które administrator może dokupić do swojej instancji. Aplikacja działa w pełni bez nich.

Teraz:

- W aplikacji nie ma żadnego kodu ani tekstu związanego ze sprzedażą produktu: licencji, kluczy, cenników, planów, blokad funkcji, telemetrii. Opłaty za udział w wydarzeniu (funkcja 21) to funkcja dla organizatora, a nie monetyzacja.
- Kod hostingu (zakładanie instancji, rozliczenia) nigdy nie trafia do tej aplikacji.
- Mechanizm wtyczek powstaje dopiero wtedy, gdy będzie potrzebny pierwszej integracji. Do tego czasu wystarczą wspólne interfejsy z sekcji „Zasady”.
- Wszystko z listy funkcji należy do darmowej aplikacji. Płatne wtyczki mogą dodawać tylko rzeczy spoza listy (przykłady: integracja z USOS dla innych uczelni, faktury KSeF, zaawansowane raporty, własna marka).
- Napisz osobny krótki spec `docs/superpowers/specs/RRRR-MM-DD-monetyzacja-design.md` ze statusem „ODROCZONY”. Spec opisuje: hosting (plany, kopie zapasowe, przejście z hostingu na własny serwer i odwrotnie), płatne wtyczki (jak się je kupuje, instaluje i licencjonuje bez blokowania danych po wygaśnięciu), kandydatów na płatne wtyczki oraz sprawy do załatwienia przed startem: prawa autorskie do kodu, wybór licencji, działalność gospodarcza i faktury, RODO przy hostingu. Bez planu i bez kodu.

## Pytania do mnie

Zadaj je po jednym, każde z twoją rekomendacją, tylko jeśli odpowiedzi nie ma w kodzie:

1. Jakim systemem logowania uczelni się logujemy (USOS, CAS, Microsoft Entra ID, inny)?
2. Jaki jest adres uczelnianego Indico i które kategorie importować?
3. Licencja kodu: MIT (jak Indico; najprostsza, ale każdy może sprzedawać hosting i odtworzyć płatne wtyczki) czy AGPLv3 z licencją komercyjną (chroni płatne wtyczki i hosting, ale wymaga, żebym był właścicielem całego kodu)? Zaznacz, że prawa autorskie wymagają sprawdzenia z prawnikiem albo uczelnią.
4. Jaka bramka płatności i jaki dostawca wideokonferencji (priorytet 3; mogą poczekać)?

## Co mi oddajesz

Po Kroku 2: raport z przeglądu i dwie listy uproszczeń. Po Kroku 3: zaktualizowany spec i spec monetyzacji. Po Kroku 4: plan, a przy nim krótka tabela „funkcja → działa / w planie / później”. Za każdym razem poczekaj na moją akceptację.
