# Monetyzacja

Data: 2026-11-19 · **Status: ODROCZONY.** Bez planu i bez kodu do wyraźnej decyzji właściciela. Spec produktu: `2026-11-19-produkt-design.md`.

Ceny i warunki sprawdzono 2026-11-19 i trzeba je sprawdzić ponownie w dniu decyzji.

## Model

1. **Aplikacja jest darmowa** i ma otwarty kod. Uczelnia używa jej bez opłat i bez klucza.
2. **Płatny hosting do wyboru.** Kto chce, uruchamia aplikację sam za darmo.
3. **Płatne wtyczki** dodają wyłącznie rzeczy spoza listy funkcji w specu produktu.

Wzorce:

- Indico (MIT) jest darmowe, a hosting sprzedają firmy trzecie, np. Mythic Beasts: od 100 GBP/mies. (Business) i od 400 GBP/mies. (Enterprise) netto, z kopiami zapasowymi i wyborem regionu UK/UE/USA ([Mythic Beasts](https://www.mythic-beasts.com/apps/indico)).
- pretix łączy rdzeń AGPLv3 z licencją komercyjną i płatnymi wtyczkami ([cennik self-hosted](https://pretix.eu/about/en/pricing/selfhosted), [FAQ licencji](https://docs.pretix.eu/trust/licensing/faq/)). Jego hosting pobiera 2,5% ceny netto biletu, najwyżej 15 EUR za bilet ([cennik](https://pretix.eu/about/en/pricing)).

## Hosting

- **Jedna instancja na klienta:** osobna baza, kontenery i domena. Aplikacja nie dostaje trybu wielu najemców.
- **Plany** różnią się:
  - rozmiarem (CPU, RAM, miejsce na pliki);
  - poziomem wsparcia;
  - regionem (Polska albo UE);
  - czasem przechowywania kopii zapasowych;
  - oknami aktualizacji.
- **Kopie zapasowe:** codzienna kopia bazy i plików, test odtworzenia przed każdą większą aktualizacją.
- **Przejście z hostingu na własny serwer i z powrotem:** ta sama procedura kopii i odtworzenia (baza i pliki), udokumentowana i sprawdzona testem odtworzenia kopii hostingu na czystej instalacji.
- **Kod hostingu** (zakładanie instancji, rozliczenia, portal klienta) żyje w osobnym repozytorium, nigdy w aplikacji.

## Płatne wtyczki

- **Zakup:** w portalu klienta, roczna licencja na instancję.
- **Instalacja:** pakiet z prywatnego rejestru npm dopisany do listy wtyczek instalacji, potem przebudowa obrazu. Mechanizm wtyczek powstanie wraz z pierwszą integracją, która go potrzebuje.
- **Licencja:**
  - podpisany plik z identyfikatorem instancji i datą ważności, sprawdzany offline przez wtyczkę, nigdy przez aplikację;
  - bez łączenia z serwerem bez zgody administratora;
  - po wygaśnięciu i 30 dniach karencji wtyczka przestaje dodawać nowe rzeczy, ale nie usuwa, nie ukrywa i nie blokuje danych, a odczyt działa dalej.

## Kandydaci na płatne wtyczki

Hipotezy do sprawdzenia, nie do budowy:

- integracja z USOS dla innych uczelni;
- faktury KSeF dla opłat za udział;
- kolejne polskie bramki płatności;
- logowanie Microsoft Entra ID z automatyczną synchronizacją kont;
- zaawansowane raporty i eksport do narzędzi BI;
- własna marka i domena;
- cyfrowe odznaki;
- integracja z Moodle.

## Sprawy do załatwienia przed startem

- **Prawa autorskie.**
  - W rozmowie podałeś, że majątkowe prawa autorskie do kodu są Twoje.
  - Trzeba to potwierdzić z prawnikiem albo biurem transferu technologii uczelni, zwłaszcza czy kod nie powstaje w ramach obowiązków pracowniczych lub studenckich.
  - To nie jest porada prawna.
- **Licencja.**
  - Wybór między MIT a AGPLv3 z licencją komercyjną (pytanie 3).
  - AGPLv3 wymaga udostępnienia kodu zmodyfikowanej wersji użytkownikom usługi sieciowej ([AGPLv3](https://www.gnu.org/licenses/agpl-3.0.html), sekcja 13).
  - Licencja komercyjna jest możliwa tylko wtedy, gdy masz prawa do całego kodu, więc przed pierwszym cudzym wkładem potrzebna jest umowa dla współtwórców (CLA albo cesja).
- **Działalność i faktury.**
  - Działalność gospodarcza i VAT.
  - Faktury przez KSeF: obowiązek od 1 kwietnia 2026 r. dla podatników VAT, od 1 stycznia 2027 r. dla najmniejszych firm ([KSeF: etapy wdrożenia](https://ksef.podatki.gov.pl/etapy-wdrozenia-ksef)).
- **RODO przy hostingu:**
  - jako hostujący jesteś podmiotem przetwarzającym (art. 28 RODO);
  - umowa powierzenia z każdym klientem;
  - lista podwykonawców;
  - rejestr czynności przetwarzania.
- Znak towarowy nazwy, regulamin usług i polityka bezpieczeństwa (zgłaszanie podatności).
