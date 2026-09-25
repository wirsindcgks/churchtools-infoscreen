# Onboarding – der Einstieg je Rolle

Wer mit dem Infoscreen Designer arbeitet, hat eine von drei Rollen. Hier steht für jede, was zu tun ist – in der
Reihenfolge, in der es passiert. Die Einzelheiten stehen in der [Einrichtungsanleitung](Einrichtung.md), welche
Rechte wer braucht in der [Rechte-Übersicht](Rechte.md).

| Rolle | Wer | Aufgabe |
| --- | --- | --- |
| [Administrator](#administrator--einmal-einrichten) | ChurchTools-Admin | installiert, vergibt Rechte, legt Screens an |
| [Gestalter](#gestalter--inhalte-gestalten) | Mitglied von „Infoscreen-Designer" | gestaltet, was die Screens zeigen |
| [Gerät](#gerät--der-fernseher) | Konto eines Fernsehers | zeigt einen Screen an – ohne dass jemand etwas tut |

## Administrator – einmal einrichten

Etwa eine halbe Stunde, den Fernseher nicht mitgezählt.

- [ ] **Extension installieren:** das ZIP von der
      [Release-Seite](https://github.com/wirsindcgks/churchtools-infoscreen/releases) in der Extension-Verwaltung von
      ChurchTools hochladen ([Schritt 1](Einrichtung.md#1-extension-installieren)).
- [ ] **Dir selbst die Modulrechte geben** – auch Admins sehen das Modul sonst nicht
      ([Schritt 2](Einrichtung.md#2-dir-selbst-die-modulrechte-geben)).
- [ ] **Designer einmal öffnen** – er legt dabei seine Ablage an.
- [ ] **Einstellungen → „Gruppen und Rechte anlegen"** – der Assistent legt „Infoscreen-Designer" und
      „Infoscreen-Devices" samt Rechten an ([Schritt 4](Einrichtung.md#4-gruppen-und-rechte-anlegen-lassen)).
- [ ] **Screens anlegen:** Startseite → **„+ Screen erstellen"**, je Fernseher einer. Name und Overscan später über
      „…" → „Einstellungen".
- [ ] **Gestalter aufnehmen:** in die Gruppe „Infoscreen-Designer", egal in welcher Rolle.
- [ ] **Je Fernseher ein Geräte-Konto** mit Benutzername und Passwort, Personenstatus mit wenig Rechten, Mitglied
      von „Infoscreen-Devices" ([Schritt 6](Einrichtung.md#6-geräte-benutzer-anlegen)).
- [ ] **Adresse für den Fernseher erzeugen:** Einstellungen → „Adresse für einen Fernseher"
      ([Schritt 7](Einrichtung.md#7-den-fernseher-einrichten)).

**Danach gelegentlich:**

- **Nach jedem Update** und wenn ein Screen einen neuen Kalender zeigt: Einstellungen → **„Rechte aktualisieren"**.
- **Gerät verloren?** Passwort des Geräte-Kontos ändern, neue Adresse erzeugen
  ([Notbremse](Einrichtung.md#wenn-ein-gerät-verloren-geht--die-notbremse)).
- **Jemand hört auf zu gestalten?** Aus der Gruppe „Infoscreen-Designer" nehmen – die Rechte gehen mit.

## Gestalter – Inhalte gestalten

Du brauchst nur die Mitgliedschaft in „Infoscreen-Designer"; alles Weitere kommt von dort.

1. **Öffnen:** In ChurchTools oben auf **„Infoscreen Designer"**. Die Startseite zeigt alle Screens als Kacheln mit
   ihrer ersten Slide.
2. **Screen wählen:** Klick auf die Kachel öffnet den Editor mit der Playlist, die dort läuft (ihr Name steht auf
   der Kachel). Neue Screens legt ein Administrator an. **Playlists** – der Inhalt – stehen in der Seitenleiste für
   sich: Dort legst du neue an; eine Playlist kann auf mehreren Screens laufen.
3. **Gestalten:**
   - links die **Slides** – „Neue Slide" unter der letzten, ziehen zum Umsortieren;
   - über der Bühne die **Bausteine**: Text, Bild, Fläche, Uhr, Terminliste, Nächster Termin, Gemeindekopf;
   - auf der **Bühne** ziehen und an den Griffen skalieren; rechts im **Inspektor** Schrift, Farben (auch als
     Hex-Wert), Kalender und Hintergrund.
4. **Zeitplan** – an der Kachel des Screens („Zeitplan") oder in der Seitenleiste unter **„Zeitpläne"**, wo alle
   Screens mit ihren Regeln und dem, was gerade läuft, untereinander stehen: welche Playlist ein Screen zeigt.
   Die **Standard-Playlist** läuft immer, wenn keine **Regel** passt. Regeln schalten auf eine andere Playlist –
   nach Uhrzeit („sonntags 9–12 Uhr") oder rund um Termine („30 Minuten vor Beginn bis 10 Minuten nach Beginn"
   für eine Begrüßung, „75 bis 105 Minuten nach Beginn" für eine Verabschiedung); passen mehrere, gewinnt die
   obere. Zur Wahl stehen Playlists im Format des Screens; eine neue legst du direkt dort an – letzter Eintrag
   jeder Auswahl, „＋ Neue Playlist anlegen …". Die Vorschau zeigt für jeden Tag, was wann läuft.
5. **Bilder:** über den Baustein „Bild" oder in der **Mediathek** (Seitenleiste). Ein Bild lässt sich beliebig oft
   verwenden. Nichts Vertrauliches hochladen – Bilder sind über ihre Adresse ohne Anmeldung abrufbar.
6. **Vorschau** (oben im Editor): spielt die Playlist mit deinen Änderungen im Vollbild ab, wie der Fernseher –
   ohne zu speichern. Esc schließt sie.
7. **Speichern** (oder ⌘S / Strg+S). Alle Fernseher, die diese Playlist zeigen, übernehmen die Änderung nach wenigen
   Minuten von selbst.

**Gut zu wissen:**

- **Rückgängig** mit ⌘Z / Strg+Z; ein Ziehen ist ein Schritt.
- **Speichert jemand anderes gleichzeitig denselben Screen**, fragt der Editor, welche Fassung gelten soll.
- **Neuer Kalender auf einem Screen** – in einer Terminliste oder einer Termin-Regel? Dann einem Administrator
  Bescheid geben: Er klickt einmal „Rechte aktualisieren", damit die Fernseher den Kalender lesen dürfen.
- **Sagt die Startseite „Dir fehlen Rechte"**, nennt sie das Recht – gib die Meldung an einen Administrator weiter.
- **Alles auf einem Screen sieht jeder im Foyer.** Personenbezogenes gehört nicht darauf.

## Gerät – der Fernseher

Das Gerät tut nichts selbst; es braucht nur einmal die richtige Adresse.

- [ ] Ein Administrator hat ein **Geräte-Konto** angelegt und in den **Einstellungen die Adresse** erzeugt.
- [ ] Die Adresse ist die **Startseite des Kiosk-Browsers**, im Vollbild; auf einem Raspberry Pi mit FullPageOS in
      `fullpageos.txt`. Tastatur und Maus braucht es nicht.
- [ ] **Bildschirmschoner und Energiesparen aus.**

Danach meldet sich der Fernseher bei jedem Start selbst an, holt Änderungen alle paar Minuten, zeigt bei Netzausfall
den letzten Stand und lädt jede Nacht neu. Zeigt er „nicht angemeldet", eine neue Adresse erzeugen – meist wurde das
Passwort des Geräte-Kontos geändert.
