# Narzędzia parytetu

## `inwentarz.py`: inwentarz Indico

Skrypt czyta źródła Indico i indico-plugins statycznie (AST Pythona, pliki `.rst`). Kodu Indico nie uruchamia ani nie instaluje. Wynikiem jest `../inwentarz-indico.json`: każda trasa, tabela, enum, sygnał, ustawienie konfiguracji, polecenie CLI, zadanie w tle, eksporter HTTP API, rozdział referencji API, moduł, funkcja wydarzenia, uprawnienie zarządzania, lokalizacja i wtyczka. Każda pozycja dostaje przypisanie do wiersza katalogu albo wyłączenie z powodem z F1.

### Wymagania

- [uv](https://docs.astral.sh/uv/) (zależność `pyyaml==6.0.3` instaluje się sama z nagłówka skryptu),
- git.

### Pobranie wzorca (poza repozytorium)

```bash
cd ..   # katalog nadrzędny repozytorium harmonogram_us
mkdir indico-ref && cd indico-ref
git init -q && git remote add origin https://github.com/indico/indico.git
git fetch -q --depth 1 origin 7bc32f2fe889943ef5df9c00ddfe868c9720cd34 && git checkout -q FETCH_HEAD
cd .. && git clone -q --depth 1 https://github.com/indico/indico-plugins.git indico-plugins-ref
git -C indico-plugins-ref checkout -q 1be80e0ec25a58df0530c7dcb3e0d4eff5a78c95   # commit użyty w inwentarzu
```

### Uruchomienie

Z katalogu `docs/superpowers/parity`:

```bash
uv run -q tools/inwentarz.py --indico ../../../../indico-ref --plugins ../../../../indico-plugins-ref
```

Skrypt:

1. sprawdza, że klon Indico jest na commicie wzorca (inaczej kończy się kodem 2);
2. waliduje `katalog-funkcji.yaml` według schematu z sekcji 4.2 briefu: kolejność pól, format ID, role, interfejsy, statusy, wyłączenia tylko z F1, istnienie ścieżek `dowod_indico` w źródłach Indico i brak wiersza podzielonego obok jego części;
3. przypisuje pozycje według reguł z `przypisania/*.yaml`;
4. zapisuje `inwentarz-indico.json` i wypisuje podsumowanie z liczbami.

Kod wyjścia to 0 tylko wtedy, gdy katalog jest poprawny, każda reguła wskazuje istniejący wiersz i pasuje do co najmniej jednej pozycji, a nieprzypisanych pozycji jest zero.

Opcje:

| Opcja | Znaczenie |
|---|---|
| `--bez-przypisan` | tylko ekstrakcja, bez katalogu i reguł |
| `--pozycje plik.json` | sprawdza tylko pozycje o ID z podanej listy (praca nad częścią inwentarza) |
| `--katalog`, `--przypisania`, `--wyjscie` | inne ścieżki wejścia i wyjścia |

### Reguły przypisań (`przypisania/*.yaml`)

```yaml
- rodzaj: trasa                                   # opcjonalnie
  gdy: {blueprint: event_registration, endpoint_regex: "^manage_regform_(list|display)$"}
  funkcja: F-REJ-01.1
- gdy: {id: "trasa:…:42"}
  wylaczenie: {powod: a, uzasadnienie: "…"}
```

- Klucze `gdy` to pola pozycji. Zwykły klucz oznacza równość, a `<pole>_regex` oznacza `re.search`; pola, które nie są tekstem, porównuje się z ich zapisem JSON.
- W obrębie jednego pliku wygrywa pierwsza pasująca reguła.
- Pozycja może pasować tylko do jednego pliku, inaczej skrypt zgłasza błąd.
- Reguła, która nie pasuje do żadnej pozycji, też jest błędem.

### Powtarzalność

Te same źródła i te same pliki dają bajtowo identyczny JSON. Wynik nie zawiera dat ani ścieżek absolutnych, a pozycje są posortowane. Sprawdzenie:

```bash
uv run -q tools/inwentarz.py --indico ../../../../indico-ref --plugins ../../../../indico-plugins-ref --wyjscie /tmp/a.json
uv run -q tools/inwentarz.py --indico ../../../../indico-ref --plugins ../../../../indico-plugins-ref --wyjscie /tmp/b.json
cmp /tmp/a.json /tmp/b.json
```
