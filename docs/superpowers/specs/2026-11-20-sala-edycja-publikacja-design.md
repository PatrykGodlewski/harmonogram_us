# Sala jako tekst, edycja na stronie wydarzenia, jaśniejsza publikacja: krótki projekt

Data: 2026-11-20 · Status: zaakceptowany przez użytkownika („continue”) · Dotyczy F3 (wydarzenia).

## Po co

Organizator testujący panel na telefonie: lista miejsc ma tylko ogólne pozycje („Katowice”), więc nie da się podać sali („B105”), a bez miejsca publikacja kończy się błędem. Edycja jest dostępna tylko z listy wydarzeń, a nie ze strony wydarzenia.

## Co budujemy

1. **Sala jako tekst.** Nowe opcjonalne pole wydarzenia `room` („Sala / pokój”, do 100 znaków) obok wyboru miejsca. Strona publiczna i lista pokazują „Katowice · sala B105”. Do publikacji wydarzenia na miejscu lub hybrydowego wystarczy miejsce **albo** sala. Punkty programu zostają przy słowniku sal.
2. **Edycja ze strony wydarzenia.** Przycisk „Edytuj” w karcie wydarzenia otwiera ten sam formularz co na liście. Formularz staje się osobnym komponentem używanym w obu miejscach.
3. **Jaśniejsza publikacja.** Gdy brakuje miejsca/sali lub linku, przy przycisku „Opublikuj” widać, czego brakuje, a przycisk jest nieaktywny.

## Podejścia

- Wybrane: osobne pole tekstowe `room` — proste, nie miesza słownika miejsc z wpisami jednorazowymi.
- Odrzucone: pole miejsca jako combobox z dopisywaniem do słownika — słownik zarośnie jednorazowymi salami, a organizator nie powinien zmieniać słowników (to rola administratora).

## Poza zakresem

Sala tekstowa w punktach programu; mapa/adres miejsca.
