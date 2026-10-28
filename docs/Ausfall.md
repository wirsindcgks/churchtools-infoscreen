# Der Fernseher, wenn ChurchTools ausfällt

Was ein Fernseher tut, wenn ChurchTools nicht erreichbar ist – etwa bei einer Wartung oder einem Netzausfall.

## Kurz gesagt

```mermaid
flowchart LR
    A["ChurchTools<br>nicht erreichbar"] --> B["Fernseher zeigt<br>den letzten Stand"]
    B --> C["fragt immer seltener nach,<br>höchstens alle 30 Minuten"]
    C --> D["ChurchTools<br>wieder da"]
    D --> E["Fernseher holt sich<br>den neuen Stand selbst"]
```

- **Der Fernseher zeigt weiter seinen letzten Stand**, mit einem kleinen Punkt in der Ecke („keine Verbindung“).
  Bilder, Videos und eigene Schriften liegen auf dem Gerät.
- **Im Designer** steht der Bildschirm nach 15 Minuten als „nicht online“.
- **Ist ChurchTools wieder da, erholt sich der Fernseher von selbst** – auch nach einem Neustart ohne Netz, wenn er
  vorher schon einmal gelaufen ist.

## Wann ihr eingreifen müsst

- **Der Fernseher zeigt „abgemeldet“:** Seine Anmeldung gilt nicht mehr, etwa nach einer Passwortänderung oder
  wenn ChurchTools nach einem Sicherheitsvorfall Anmeldungen zurücksetzt. Eine neue Adresse erzeugen
  ([Einrichtung, Schritt 7](Einrichtung.md#7-den-fernseher-einrichten)).
- **Der Bildschirm bleibt lange nach dem Ausfall „nicht online“:** den Kiosk-Browser oder das Gerät neu starten.

<details>
<summary>Für Entwickler: der Ablauf im Einzelnen</summary>

Stand `v0.48.1`, abgelesen aus `src/player/controller.ts`, `src/player/timing.ts`, `src/sw/sw.ts` und
`src/views/PlayerView.vue`. Neu geladen wird nur, wenn danach wieder der Player läuft – nach 30 Minuten nur Fehlern
und jede Nacht gegen 3 Uhr. Findet der Player Daten einer neueren Version, lädt er höchstens alle zehn Minuten neu
(Befunde G16).

### Ablauf im Einzelnen

```mermaid
flowchart TD
    A([Player läuft]) --> B{Abfrage an<br/>ChurchTools gelingt?}
    B -- ja --> C[Daten und Stand<br/>auf dem Gerät speichern<br/>Lebenszeichen alle 5 Min.]
    C --> A
    B -- "nein: kein Netz, Zeitüberschreitung<br/>nach 20 s, Fehlerstatus" --> D[Letzten Stand weiter zeigen<br/>Punkt „keine Verbindung“]
    B -- "nein: Token oder Sitzung<br/>nicht mehr gültig" --> Z[Meldung „abgemeldet“<br/>statt des Inhalts<br/>kein Lebenszeichen]
    D --> E[Erneut versuchen nach<br/>30 s, 1, 2, 4 … höchstens 30 Min.]
    Z --> E
    E --> F{Seit 30 Min.<br/>nur Fehler?}
    F -- nein --> B
    F -- ja --> G
    N([Jede Nacht 03:xx]) --> G{Seite ladbar?<br/>Service Worker hat Kopie<br/>oder Netz bringt den Player}
    G -- "nein (nachts: in<br/>einer Stunde wieder)" --> E
    G -- ja --> R

    R[Neu laden] --> S{Service Worker:<br/>Netz antwortet<br/>binnen 10 s?}
    S -- "ja: Player-Seite" --> A
    S -- "ja: Anmeldung nötig" --> L[Anmeldung über den<br/>Token in der Adresse] --> A
    S -- "ja: Fehler- oder<br/>Wartungsseite" --> T
    S -- "nein: kein Netz,<br/>Zeitüberschreitung" --> T{Kopie der Seite<br/>auf dem Gerät?}
    T -- ja --> U[Seite aus der Kopie<br/>Stand aus IndexedDB] --> A
    T -- nein --> X[Fehlerseite<br/>ohne Skript]

    classDef bad fill:#fde2e1,stroke:#c0392b,color:#000
    class X bad
```

Der rote Kasten ist eine Sackgasse: Auf einer Seite ohne unser Skript versucht niemand mehr etwas. Heraus
führen nur ein Neuladen von Hand oder ein Neustart des Kiosk-Browsers. Er ist nur noch erreichbar, wenn das
Gerät keine Kopie hat (unten, 2).

### Was offen bleibt

1. **Ungültige Anmeldung.** Setzt ChurchTools nach einem Sicherheitsvorfall Sitzungen oder Login-Token zurück,
   zeigt der Fernseher „abgemeldet“ und meldet kein Lebenszeichen mehr. Das kann das Modul nicht selbst lösen –
   ein neuer Token gehört in die Kiosk-Adresse –, es ist aber am Fernseher sichtbar.
2. **Ohne Kopie.** Ein Gerät, das noch nie erfolgreich gezeigt hat, oder ein Browser ohne Service Worker hat
   keine Kopie. Ohne Kopie lädt der Player nur neu, wenn das Netz die Player-Seite selbst bringt – eine
   Wartungsseite mit `200` zählt nicht. Die Kopie kann auch verschwinden: Wird der Speicher knapp, darf der
   Browser alles räumen, was die Seite abgelegt hat. Deshalb bittet der Player nach dem ersten erfolgreichen
   Anzeigen darum, seinen Speicher zu behalten (`navigator.storage.persist()`). Chromium entscheidet darüber
   selbst, ohne zu fragen; lehnt es ab, steht das nur in der Konsole.
3. **Eine Weiterleitung auf eine Wartungsseite.** Weiterleitungen reicht der Service Worker unverändert durch,
   weil die Anmeldung über den Token eine ist. Leitet ChurchTools während eines Ausfalls auf eine eigene Adresse
   um, landet der Fernseher dort. Wie ChurchTools einen Ausfall ausliefert, ist nicht gemessen.

### Der Ausfall vom 21.10.2026

ChurchTools hat die Systeme am Nachmittag des 21.10. wegen einer PHP-Lücke kurzzeitig heruntergefahren. Beide
Screens meldeten sich zuletzt um 15:52 und 15:54 und danach nicht mehr – auch nicht, als ChurchTools wieder lief.
Im ChurchTools-Protokoll (Log Viewer, Person des Geräte-Benutzers) fehlen seither die täglichen Anmeldungen
„mittels logintoken“, die jeder Fernseher alle 24 Stunden beim Ablauf seiner Sitzung schreibt; das nächtliche
Neuladen schreibt keine. Bis `v0.48.0` gab der Service Worker eine Fehler- oder Wartungsseite beim Neuladen
unverändert weiter, und das nächtliche Neuladen prüfte nichts – auf so einer Seite blieben die Fernseher stehen,
bis jemand sie neu startete. `v0.48.1` schließt diese Lücke.

**Woran man einen hängenden Fernseher erkennt:** im Designer „nicht online“, und im Protokoll seit mehr als
24 Stunden keine Anmeldung des Geräte-Benutzers.

**Ausgang:** Nach einem Neustart beider Pis sind beide Screens wieder dauerhaft „online“ (bestätigt am
2026-10-27) – der Token war also gültig geblieben, es reichte, die hängende Seite zu verlassen. Seit `v0.48.1`
sollte ein solcher Ausfall ohne Neustart überstanden werden. Hängt ein Gerät trotzdem, braucht es für den Pi im
Serverraum jemanden mit Schlüssel, der ihn aus- und wieder einsteckt.

</details>
