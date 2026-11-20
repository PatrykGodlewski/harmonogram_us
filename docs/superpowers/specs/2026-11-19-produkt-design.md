# Spec produktu

Data: 2026-11-19 · Status: **do akceptacji** · Jedyne źródło prawdy o tym, co budujemy. Zlecenie: `docs/superpowers/briefs/2026-11-19-kierunek-produktu.md`.

## Historia zmian

| Data | Zmiana | Powód |
|---|---|---|
| 2026-11-19 | Pierwszy spec produktu. Zastępuje specy funkcji z 18.11, które są teraz archiwalne. Lista funkcji F1–F25 ze zlecenia oraz F26 (rejestracja grupowa) i F27 (zapis na punkty programu), które już działają. Zasady pracy po przeglądzie (`docs/superpowers/audits/2026-11-19-przeglad.md`). | Nowy, uproszczony kierunek produktu |
| 2026-11-19 | Plan „moje zapisy, bilety, agenda" wykonany: statusy F5, F11 (bilet z QR; skaner w planie 2) i F18 (widok listy i kalendarza). | Prośba użytkownika o konto z zapisami, bilet z kodem QR i kalendarz programu |
| 2026-11-20 | Plan „organizator na poziomie Indico" wykonany: F2, F3, F6, F7, F11 gotowe. Decyzja: organizator pracuje w `apps/admin` ograniczonym do swoich wydarzeń (zmienia K4). | Decyzja użytkownika z 20.11; plan `docs/superpowers/plans/2026-11-20-organizator-jak-w-indico.md` |
| 2026-11-20 | Dodane F28–F31 z porównania z Indico (`docs/indico-comparison.md`). Plan 3: F9, F13, reszta F4, F28, F29. Plan 4: F30, F12, F31, F18/F19 prelegenci. | Decyzja użytkownika 20.11 |
| 2026-11-20 | Plan 3 wykonany: F4, F9, F13, F28, F29 gotowe. | Plan `docs/superpowers/plans/2026-11-20-rodo-przypomnienia-kalendarz-zapisani.md` |

## Kierunek produktu

Kampusowe centrum wydarzeń: seminaria, wykłady gościnne, koła naukowe, samorząd, biuro karier, a później także konferencje. Aplikacja jest własna, prostsza i wygodniejsza od Indico. Indico jest tylko inspiracją. Lepiej mniej funkcji zrobionych dobrze i do końca niż wiele zrobionych w połowie.

- **Uczestnik** (student, pracownik, gość) znajduje wydarzenie i zapisuje się z telefonu w kilkanaście sekund.
- **Organizator** (pracownik, koło, samorząd, biuro karier) publikuje wydarzenie w dwie minuty, bez szkolenia.
- **Administrator** utrzymuje instancję uczelni: słowniki, role, ustawienia.

Przewagi nad Indico, widoczne od pierwszej wersji:

- **Telefon.** Wszystko, co robi uczestnik, działa wygodnie na ekranie szerokości 360 px.
- **Lista rezerwowa** z automatycznym awansem po zwolnieniu miejsca.
- **Prostota.** Krótkie formularze, rozsądne wartości domyślne, minimum kliknięć.
- **Polski kontekst.** Interfejs po polsku i angielsku, logowanie kontem uczelni, docelowo USOS.

Jedna uczelnia to jedna instalacja. Nazwa uczelni, logo, strefa czasowa i sposób logowania są konfiguracją, a nie kodem. Do czasu, gdy aplikacja wystarczy uczelni, Indico działa obok (F16).

## Funkcje

Oznaczenia stanu:

- **działa:** jest w kodzie i ma testy Vitest, ale nie ma testu e2e, więc nie jest jeszcze „gotowa”;
- **częściowo:** część opisu istnieje;
- **brak:** nie ma jeszcze nic.

Kryterium „gotowe” to zawsze przechodzący test e2e `[Fn] …` z widocznym skutkiem (patrz Zasady).

### Priorytet 1: pierwsza wersja dla uczelni

| # | Funkcja | Co użytkownik może zrobić | Gotowe, gdy test e2e pokazuje, że… | Stan |
|---|---|---|---|---|
| F1 | Konta i logowanie | Logowanie linkiem e-mail z dowolnego adresu albo hasłem do konta lokalnego. Profil z imieniem, nazwiskiem, e-mailem i językiem. Logowanie kontem uczelni działa za wspólnym interfejsem tożsamości (zobacz konflikt K1). | użytkownik loguje się linkiem z Mailpit i hasłem, zmienia imię i język, a interfejs przełącza się na wybrany język | częściowo: link e-mail, hasło, weryfikacja adresu (`packages/api/src/auth/better-auth.ts`); brak języka w profilu |
| F2 | Role i uprawnienia | Uczestnik, organizator, administrator. Organizator zarządza swoimi wydarzeniami i dodaje współorganizatorów. Wydarzenie jest publiczne albo tylko dla zalogowanych. | współorganizator dodany po e-mailu może edytować wydarzenie; obcy organizator dostaje odmowę; wydarzenie „tylko dla zalogowanych” nie jest widoczne dla niezalogowanego | gotowe (20.11): role uczestnik/organizator/admin, współorganizatorzy po e-mailu, wydarzenia tylko dla zalogowanych; panel organizatora w `apps/admin` (`e2e/tests/f2-organizatorzy.spec.ts`, `f2-widocznosc.spec.ts`) |
| F3 | Wydarzenia | Tworzenie, edycja, publikacja, odwołanie i duplikowanie. Pola: tytuł, opis, termin, miejsce albo link online, jednostka, kategoria. Wymagane są tylko tytuł, termin oraz miejsce albo link. | organizator tworzy wydarzenie z czterech pól i publikuje je w kilku krokach; szkic nie jest widoczny publicznie; po odwołaniu strona pokazuje „odwołane” i zapisy są zamknięte; duplikat ma te same dane i nowy termin | gotowe (20.11): szkic, publikacja, odwołanie, duplikowanie, link online i forma wydarzenia (`e2e/tests/f3-szkic-i-publikacja.spec.ts`, `f3-odwolanie.spec.ts`, `f3-duplikowanie.spec.ts`, `f3-cykl-wydarzenia.spec.ts`) |
| F4 | Kalendarz kampusu | Lista i widok kalendarza wszystkich wydarzeń. Filtry: termin, kategoria, jednostka, na miejscu albo online. Wyszukiwanie. Subskrypcja ICS (wszystkie oraz moje zapisy). Stały link z podglądem przy udostępnianiu (Open Graph). | każdy filtr zawęża listę; plik ICS zawiera wydarzenie z poprawnym terminem i linkiem; HTML strony wydarzenia ma `og:title` i `og:description` | gotowe (20.11): lista z wyszukiwaniem i filtrami (jednostka, typ, miejsce, termin: dziś / 7 / 30 dni, forma), subskrypcja ICS (wszystkie i moje zapisy), „Dodaj do kalendarza”, Open Graph (`e2e/tests/f4-lista-wydarzen.spec.ts`, `f4-kalendarz.spec.ts`); bez widoku kalendarza miesiąca |
| F5 | Zapisy | Zapis jednym kliknięciem dla zalogowanych, limit miejsc, lista rezerwowa z automatycznym awansem, samodzielna rezygnacja. Równoczesne zapisy nigdy nie przekraczają limitu. | zapis na pełne wydarzenie trafia na listę rezerwową; po rezygnacji pierwsza osoba z listy awansuje; 20 równoległych zapisów na 5 miejsc daje 5 zapisanych i 15 rezerwowych | działa: zapis, limit, współbieżność, rezygnacja, lista rezerwowa z automatycznym awansem, moje zapisy na koncie (`queries/event-registrations.ts`, `queries/my-registrations.ts`, `e2e/tests/f5-*.spec.ts`) |
| F6 | Powiadomienia e-mail | Potwierdzenie zapisu, awans z listy rezerwowej, odwołanie wydarzenia. | każdy z trzech przypadków daje w Mailpit wiadomość do właściwej osoby, z tytułem wydarzenia i linkiem | gotowe (20.11): potwierdzenie, lista rezerwowa, awans i odwołanie (`e2e/tests/f6-powiadomienia.spec.ts`, `f3-odwolanie.spec.ts`) |
| F7 | Panel organizatora | Lista zapisanych i rezerwowych, ręczne dodanie lub usunięcie osoby, eksport do CSV, wiadomość do zapisanych. | organizator dodaje osobę po e-mailu i usuwa inną; CSV zawiera nagłówki i wiersze zapisanych; wiadomość dociera do wszystkich zapisanych | gotowe (20.11): lista z wyszukiwaniem i filtrem, ręczne dodanie i usunięcie, CSV, wiadomość do zapisanych (`e2e/tests/f7-zapisani.spec.ts`, `f7-wiadomosc.spec.ts`) |
| F8 | Dostępność i języki | WCAG 2.1 AA, strona z deklaracją dostępności, interfejs po polsku i angielsku. | skan axe (WCAG 2.1 A i AA) na każdym ekranie uczestnika i organizatora nie zgłasza naruszeń; deklaracja istnieje w obu językach; brak tekstów interfejsu poza plikami tłumaczeń (reguła lint) | częściowo: pl/en (Paraglide); teksty poza tłumaczeniami (przegląd, T2) |
| F9 | RODO | Klauzula informacyjna przy zapisie, automatyczne usuwanie danych zapisów po ustalonym czasie, eksport i usunięcie własnych danych. | klauzula jest widoczna przy zapisie; po przesunięciu zegara poza okres przechowywania dane znikają z listy i CSV; eksport zawiera moje zapisy; po usunięciu konta logowanie nie działa | gotowe (20.11): klauzula przy zapisie, strona informacji o danych, automatyczne usuwanie zapisów po `REGISTRATION_RETENTION_DAYS`, eksport i usunięcie konta (`e2e/tests/f9-rodo.spec.ts`); treść informacji do potwierdzenia przez IOD uczelni |

### Priorytet 2: wygoda organizatora

| # | Funkcja | Co użytkownik może zrobić | Gotowe, gdy test e2e pokazuje, że… | Stan |
|---|---|---|---|---|
| F10 | Własne pytania w formularzu | Pola tekst, wybór i tak/nie, wymagane albo opcjonalne. Bez pytań zapis zostaje jednym kliknięciem. | wymagane pole blokuje zapis bez odpowiedzi; odpowiedzi są na liście i w CSV | brak |
| F11 | Bilety i obecność | Kod QR w potwierdzeniu zapisu; organizator skanuje go telefonem w przeglądarce i odhacza obecność. | skan kodu (sztuczny obraz z kamery) oznacza osobę jako obecną na liście | gotowe (20.11): bilet z QR, skaner kamerą w panelu i ręczne odhaczanie obecności (`e2e/tests/f11-bilety.spec.ts`, `f11-skaner.spec.ts`) |
| F12 | Zaświadczenia | PDF z potwierdzeniem udziału dla obecnych. | tekst PDF zawiera imię, nazwisko, tytuł i datę; nieobecny nie może go pobrać | brak |
| F13 | Przypomnienia i zmiany | Przypomnienie przed wydarzeniem; automatyczna informacja o zmianie terminu lub miejsca. | o ustalonej godzinie (kontrolowany zegar) przychodzi przypomnienie; zmiana terminu daje e-mail ze starą i nową datą | gotowe (20.11): przypomnienie (domyślnie dzień przed; 1 h, 2 dni albo wyłączone), e-mail o zmianie terminu lub miejsca ze starą i nową wartością (`e2e/tests/f13-przypomnienia.spec.ts`) |
| F14 | Materiały | Pliki i linki przy wydarzeniu. | dodany plik i link widać na stronie wydarzenia, a pobrany plik ma tę samą zawartość | brak |
| F15 | Statystyki | Organizator widzi zapisanych, obecnych i odsetek nieobecnych. Administrator widzi liczbę wydarzeń i zapisów w czasie. | liczby zgadzają się z danymi testowymi | brak |
| F16 | Wydarzenia z Indico | Import do odczytu wydarzeń z uczelnianego Indico, z linkiem do oryginału; nie można się na nie zapisać. | wydarzenie z testowego eksportu Indico jest w kalendarzu z oznaczeniem i linkiem | brak |
| F17 | Goście bez konta | Zapis z potwierdzeniem e-mailem i rezygnacja z linku. | gość zapisuje się, potwierdza linkiem z Mailpit i rezygnuje przez link | brak |

### Priorytet 3: większe wydarzenia

| # | Funkcja | Co użytkownik może zrobić | Gotowe, gdy test e2e pokazuje, że… | Stan |
|---|---|---|---|---|
| F18 | Program wydarzenia | Harmonogram z punktami programu, prelegentami i salami, także na kilka dni. | program wielodniowy z salami wyświetla się poprawnie na telefonie i komputerze | częściowo: program z salami jako lista albo kalendarz z równoległymi sesjami obok siebie, podział na dni (`@repo/ui/agenda` `layoutAgenda`, `e2e/tests/f18-program.spec.ts`); brak prelegentów |
| F19 | Prelegenci i referaty | Lista wystąpień z opisami i materiałami prelegentów. | wystąpienie z prelegentem i plikiem jest na stronie wydarzenia | brak |
| F20 | Ankiety | Ankieta po wydarzeniu z prostym podsumowaniem. | odpowiedzi uczestników dają poprawne podsumowanie | brak |
| F21 | Opłaty za udział | Płatność ręczna (przelew) i jedna bramka online. Pieniądze trafiają do organizatora. | zapis na płatne wydarzenie czeka na płatność; organizator oznacza wpłatę; płatność przez atrapę bramki w testach kończy zapis | brak |
| F22 | Strona wydarzenia | Logo, obraz nagłówka, własne podstrony. | obraz i podstrona są widoczne na stronie wydarzenia | brak |
| F23 | Wideokonferencje | Automatyczne spotkanie u dostawcy uczelni (Microsoft Teams). | dla wydarzenia online powstaje spotkanie (atrapa Graph w testach), a link jest widoczny dla zapisanych | brak |
| F24 | API i widżet | Publiczne API do odczytu wydarzeń i widżet „najbliższe wydarzenia”. | API zwraca nadchodzące wydarzenia; widżet na testowej stronie pokazuje trzy najbliższe | brak |
| F25 | Integracja z USOS | Zapisy ograniczone do wydziału lub kierunku, ostrzeżenie o kolizji z planem zajęć. | zapis spoza wydziału jest zablokowany; kolizja z planem pokazuje ostrzeżenie (atrapa USOS w testach) | brak |

### Funkcje, które już działają (spoza listy ze zlecenia)

| # | Funkcja | Co użytkownik może zrobić | Gotowe, gdy test e2e pokazuje, że… | Stan |
|---|---|---|---|---|
| F26 | Rejestracja grupowa | Nauczyciel rezerwuje miejsca dla klasy, zaprasza uczniów e-mailem albo linkiem z kodem QR, a uczeń potwierdza miejsce jednym przyciskiem. Niepotwierdzone miejsca wracają po terminie. | grupa trzyma miejsca w licznikach; uczeń potwierdza z linku w Mailpit; zamknięcie grupy zwalnia miejsca | działa (`packages/db/src/queries/groups.ts`, `group-members.ts`, testy Vitest) |
| F27 | Zapis na punkty programu | Zapis na wybrane punkty programu z własnym limitem; zapis na punkt zapisuje też na wydarzenie. | zapis na pełny punkt jest odrzucony z komunikatem; licznik punktu zmienia się na żywo | działa (`queries/event-registrations.ts`, `agenda-items.test.ts`) |

### Uzupełnienia z porównania z Indico (decyzja użytkownika 20.11)

Źródło: `docs/indico-comparison.md`. Użytkownik: „ensure we contain these features and improve upon them UX related”. Każda funkcja ma być co najmniej na poziomie Indico i wygodniejsza na telefonie.

| # | Funkcja | Co użytkownik może zrobić | Gotowe, gdy test e2e pokazuje, że… | Stan |
|---|---|---|---|---|
| F28 | Akcje grupowe i eksport XLSX | Organizator zaznacza kilka osób na liście zapisanych i jednym ruchem odhacza obecność, usuwa je albo pisze tylko do nich; pobiera listę także jako arkusz XLSX. | zaznaczenie dwóch osób i „Odhacz obecność” zmienia obie; wiadomość do zaznaczonych trafia tylko do nich; plik XLSX ma nagłówki i wiersze zapisanych | gotowe (20.11): zaznaczanie, odhaczanie obecności, wiadomość do zaznaczonych, usuwanie z awansem listy, XLSX (`e2e/tests/f28-akcje-grupowe.spec.ts`) |
| F29 | Pomocnik od wejścia | Organizator dodaje osobę, która może tylko skanować bilety i odhaczać obecność w tym wydarzeniu. | pomocnik widzi skaner i listę obecności, ale nie może edytować wydarzenia ani usuwać zapisów | gotowe (20.11): pomocnik od wejścia (rola przy wydarzeniu), widok wejścia: skaner i obecność (`e2e/tests/f29-pomocnik.spec.ts`) |
| F30 | Akceptacja zapisów | Wydarzenie może wymagać akceptacji: zapis czeka, organizator akceptuje albo odrzuca (także grupowo), uczestnik dostaje e-mail. | zapis na wydarzenie z akceptacją ma stan „czeka”; po akceptacji osoba jest zapisana i dostaje e-mail; po odrzuceniu dostaje e-mail z odmową | brak |
| F31 | Wydarzenia cykliczne | Duplikowanie co tydzień albo co miesiąc przez wybraną liczbę powtórzeń, z wyborem, co skopiować. | „co tydzień, 4 razy” tworzy cztery szkice w kolejnych tygodniach o tej samej godzinie | brak |

### Później (tylko wpis, bez planu)

Zgłaszanie i recenzowanie abstraktów, rezerwacja sal, identyfikatory do druku, treść wydarzeń w dwóch językach, cyfrowe odznaki za udział, powiadomienia push, rekomendacje wydarzeń.

### Konflikty z obecnym kodem i proponowane rozwiązania

- **K1. Logowanie kontem uczelni (F1).**
  - Wcześniej w rozmowie ustaliłeś, że prosty e-mail wystarczy, a USOS można dodać później.
  - Propozycja: w pierwszej wersji logowanie linkiem e-mail z dowolnego adresu plus konto lokalne z hasłem; to działa już dziś.
  - Logowanie przechodzi przez wspólny interfejs tożsamości, więc adapter uczelni (USOS/CAS, Entra ID) dojdzie bez zmian w reszcie aplikacji, gdy uczelnia wskaże system.
  - Do potwierdzenia: pytanie 1.
- **K2. Lista rezerwowa (F5) a model zapisów.**
  - Dziś zapis to istnienie wiersza, a rezygnacja go usuwa (`queries/event-registrations.ts`).
  - Propozycja: kolumna stanu zapisu (`zapisany`, `rezerwowy`, `wycofany`) dodana migracją z testem na istniejących danych.
  - Liczniki miejsc liczą tylko zapisanych. Awans pierwszej osoby z listy odbywa się w tej samej transakcji co zwolnienie miejsca, pod istniejącą blokadą wydarzenia.
  - Punkty programu (F27) nie mają listy rezerwowej: pełny punkt odrzuca zapis, jak dziś.
  - Grupa (F26), która się nie mieści, jest odrzucona, jak dziś. Miejsca zwolnione przez zamkniętą grupę awansują osoby z listy rezerwowej.
- **K3. Kategoria i jednostka (F3, F4) a słowniki.**
  - Dziś są słowniki typów, wydziałów i miejsc (`packages/db/src/schema/event-lookups.ts`).
  - Propozycja: wydziały stają się „jednostkami”, typy „kategoriami”, a miejsca zostają słownikiem miejsc. Zmiana nazw dotyczy interfejsu i komunikatów, tabele zostają bez zmian, więc nie ma migracji danych.
  - Dochodzi pole „link online” i rodzaj wydarzenia (na miejscu / online / hybrydowo) do filtra F4.
- **K4. Panel organizatora (F2, F7) a aplikacja admin.**
  - **Decyzja 20.11 (użytkownik, zastępuje propozycję poniżej):** organizator zarządza swoimi wydarzeniami w `apps/admin`, które pokazuje mu tylko jego wydarzenia; słowniki i role widzi tylko administrator. `/manage` w `apps/web` nie powstaje.
  - Dziś `apps/admin` jest tylko dla administratora.
  - Propozycja (przyjęta przy przeglądzie, A8): organizator zarządza swoimi wydarzeniami w aplikacji publicznej pod `/manage`, a `apps/admin` zostaje dla administratora (słowniki, role, wszystkie wydarzenia).
  - Ekrany wydarzeń, agendy i zapisanych przechodzą do `/manage`.
- **K5. Strefa czasowa.** Dziś Europe/Warsaw jest wpisana w kod. Zostaje domyślną wartością w konfiguracji instalacji, którą odczytują wszystkie formatowania i zadania.
- **K6. Indico obok (F16).** Wcześniej mówiłeś, że uczelnia przestanie używać Indico, gdy aplikacja będzie działać. To zlecenie przewiduje import do czasu przejścia, więc F16 zostaje w priorytecie 2, a adres Indico i kategorie ustalimy przy planie priorytetu 2.

## Zasady

- **Funkcja jest gotowa, gdy przechodzi test e2e.**
  - Testy Playwright w przeglądarce przechodzą przez główne ścieżki z perspektywy użytkownika i sprawdzają widoczny skutek: treść ekranu, e-mail w Mailpit, zawartość pliku.
  - Ścieżki uczestnika działają też przy szerokości 360 px.
  - Testy e2e działają w CI.
  - Test powstaje przed kodem i najpierw nie przechodzi.
  - Nazwa testu zawiera numer funkcji, np. `[F5] zapis na pełne wydarzenie trafia na listę rezerwową`.
- **Bez rozwiązań tymczasowych.** Bez TODO, atrap w kodzie produkcyjnym, danych na sztywno, zakomentowanego kodu i pominiętych testów. Zmiany bazy tylko przez migracje. Czego nie da się zrobić porządnie teraz, przechodzi w całości na później.
- **Bez kodu „na przyszłość”.** Abstrakcja dopiero przy drugim użyciu. Wyjątek: integracje zewnętrzne (logowanie, płatności, wideokonferencje, import z Indico) od początku są za prostym wspólnym interfejsem.
- **Prosto.** Z dwóch sposobów wybieram prostszy. Jeśli funkcja rośnie poza opis, zatrzymuję się i pytam.
- **Sposób pracy** (przegląd, lista B):
  - jeden aktywny plan naraz, około 10 zadań, kończący się działającą funkcją;
  - plan opisuje pliki, interfejsy i testy, a nie przepisuje kodu;
  - zadanie to funkcja albo jej spójna część z testem e2e;
  - wykonanie domyślnie samodzielne (`superpowers:executing-plans`) z jednym przeglądem całości na końcu planu; subagent tylko przy zadaniach naprawdę złożonych;
  - jeden ledger postępu na plan;
  - CI: lint, typecheck, Vitest, build, Playwright; bez dodatkowych bramek i narzędzi.

## Monetyzacja

Odroczona, opisana w `docs/superpowers/specs/2026-11-19-monetyzacja-design.md` (status ODROCZONY). Model:

1. Aplikacja jest darmowa i ma otwarty kod. Uczelnia używa jej bez opłat.
2. Płatny hosting do wyboru. Kto chce, uruchamia aplikację sam za darmo.
3. Płatne wtyczki dodają tylko rzeczy spoza listy funkcji.

Teraz:

- W aplikacji nie ma żadnego kodu ani tekstu o sprzedaży produktu: licencji, kluczy, cenników, planów, blokad funkcji, telemetrii. Opłaty za udział (F21) to funkcja dla organizatora.
- Kod hostingu nigdy nie trafia do tej aplikacji.
- Mechanizm wtyczek powstaje, gdy będzie potrzebny pierwszej integracji. Do tego czasu wystarczą wspólne interfejsy z Zasad.
- Wszystko z listy funkcji jest w darmowej aplikacji.
