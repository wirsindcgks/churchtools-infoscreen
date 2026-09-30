# Onboarding – der Einstieg je Rolle

Wer mit dem Infoscreen Designer arbeitet, hat eine von drei Rollen. Hier steht für jede, was zu tun ist – in der
Reihenfolge, in der es passiert. Die Einzelheiten stehen in der [Einrichtungsanleitung](Einrichtung.md), welche
Rechte wer braucht in der [Rechte-Übersicht](Rechte.md). Was der Designer kann, zeigt die Übersicht
[Der Designer in Bildern](Funktionen.md).

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
- [ ] **Einstellungen → Gruppen und Rechte → „Gruppen und Rechte anlegen"** – der Assistent legt „Infoscreen-Designer" und
      „Infoscreen-Devices" samt Rechten an ([Schritt 4](Einrichtung.md#4-gruppen-und-rechte-anlegen-lassen)).
- [ ] **Screens anlegen:** Startseite → **„+ Screen erstellen"**, je Fernseher einer. Name und Overscan später über
      „…" → „Einstellungen".
- [ ] **Gestalter aufnehmen:** in die Gruppe „Infoscreen-Designer", egal in welcher Rolle.
- [ ] **Je Fernseher ein Geräte-Konto** mit Benutzername und Passwort, Personenstatus mit wenig Rechten, Mitglied
      von „Infoscreen-Devices" ([Schritt 6](Einrichtung.md#6-geräte-benutzer-anlegen)).
- [ ] **Adresse für den Fernseher erzeugen:** Einstellungen → Adressen für die Fernseher
      ([Schritt 7](Einrichtung.md#7-den-fernseher-einrichten)).

**Danach gelegentlich:**

- **Nach jedem Update** und wenn ein Screen einen neuen Kalender zeigt: Einstellungen → Gruppen und Rechte →
  **„Rechte aktualisieren"**.
- **Gerät verloren?** Passwort des Geräte-Kontos ändern, neue Adresse erzeugen
  ([Notbremse](Einrichtung.md#wenn-ein-gerät-verloren-geht--die-notbremse)).
- **Jemand hört auf zu gestalten?** Aus der Gruppe „Infoscreen-Designer" nehmen – die Rechte gehen mit.

## Gestalter – Inhalte gestalten

Du brauchst nur die Mitgliedschaft in „Infoscreen-Designer"; alles Weitere kommt von dort. Die Bilder hier zeigen
eine erfundene Gemeinde.

### 1. Die Screens

In ChurchTools oben auf **„Infoscreen Designer"**. Die Startseite zeigt jeden Fernseher als Kachel – mit dem, was er
**gerade** zeigt. Ein Klick auf die Kachel öffnet diese Playlist im Editor; Adresse, Zeitplan und Player stecken im
Menü „…". Neue Screens legt ein Administrator an.

![Startseite mit zwei Screens als Kacheln](bilder/startseite.png)

### 2. Slides gestalten

![Editor: links die Slides, oben „+ Baustein", in der Mitte die Bildfläche, rechts der Inspektor](bilder/editor.png)

- **Links die Slides** – „Neue Slide" unter der letzten, ziehen zum Umsortieren, darunter **„Aus anderer Playlist
  …"**, um Slides einer anderen Playlist als Kopie zu übernehmen.
- **„+ Baustein"** öffnet alle Bausteine, alphabetisch: Beiträge, Bild, Countdown („Gottesdienst beginnt in 12:34"),
  Fläche, Gemeindekopf, Gruppen (siehe unten), Nächster Termin, QR-Code, Terminliste, Text, Uhr und Webseite.
- **In der Mitte die Bildfläche:** ziehen, an den Griffen skalieren, an den **Hilfslinien** ausrichten (oben rechts: Abstand wählen oder aus; mit gedrückter Alt-Taste frei platzieren).
- **Rechts der Inspektor:** oben der Inhalt des Bausteins (Text, Kalender, Adresse …), darunter aufklappbare
  Bereiche – **Schrift** und **Position & Ebene**, bei Gruppen auch **Angaben**. Zugeklappt zeigt jeder Bereich in
  einer Zeile, was eingestellt ist; was du einmal aufklappst, bleibt offen. Im Kopf des Inspektors stehen
  **„Sperren"** – damit ein Logo oder Hintergrund nicht verrutscht, ein Klick darauf erreicht dann den Baustein
  darunter, mit gedrückter Alt-Taste (Mac: Option) den gesperrten selbst – und **„Löschen"**. Ein **ⓘ** klappt eine
  Erklärung auf. Slides und Inspektor lassen sich einklappen, damit die Bildfläche mehr Platz bekommt; auf dem
  Tablet sind sie das von Anfang an.
- **Hinweise** haben eine eigene Seite in der Seitenleiste: ein Band über allen Slides der gewählten Playlists – als
  Laufschrift oder stehend, etwa „Heute Parkplatz gesperrt", mit **„Zeigen bis"**, danach verschwindet es von selbst.
- **Vorschau** (oben): spielt die Playlist mit deinen Änderungen im Vollbild ab, wie der Fernseher – ohne zu
  speichern. Esc schließt sie.
- **Speichern** (oder ⌘S / Strg+S). Alle Fernseher, die diese Playlist zeigen, übernehmen die Änderung in etwa
  20 Sekunden von selbst.

### 3. Gruppen aus ChurchTools

Der Baustein **„Gruppen"** zeigt, was es in der Gemeinde für Gruppen gibt – aus einer **Gruppen-Homepage** von
ChurchTools. Die legt ein Administrator an der Obergruppe an: Gruppe öffnen → **Einstellungen → Allgemein →
Außendarstellung → „Gruppenhomepage erstellen"**
([Academy](https://churchtools.academy/de/help/churchtools-module/einstellungen-gruppen/wie-passe-ich-die-gruppenhomepage-meiner-obergruppe-an/)).
Darauf erscheinen die Untergruppen, deren öffentliche Seite eingeschaltet ist.

- **Im Inspektor** die Homepage wählen; dann **alle Gruppen** (nach Wochentag) oder eine **Auswahl** in eigener
  Reihenfolge (↑/↓). Eine Gruppe allein ist ein Highlight – daneben ein zweiter Baustein mit den übrigen.
- **Darstellung:** Karten mit **ein bis vier Gruppen je Seite** oder eine Liste. Jede Karte trägt einen **QR-Code**
  auf die öffentliche Gruppenseite, über den man sich anmelden kann.
- **Angaben:** Name, Bild, Wochentag und Uhrzeit, Zielgruppe, Kategorie, Beschreibung, Leitung, Bild der Leitung,
  freie Plätze, QR-Code – jede einzeln abschaltbar. **Leitung und Bild der Leitung sind aus**, bis du sie
  einschaltest; sie erscheinen nur, wenn die Gruppen-Homepage in ChurchTools die Leiter ohnehin zeigt.
- **Wird es eng**, gibt zuerst die Beschreibung nach, dann die Leitung; Name und Angaben bleiben. Bei drei oder vier
  Gruppen je Seite passt eine kleinere Schrift (etwa 40 px) besser.
- Was du in ChurchTools an einer Gruppe änderst, steht nach spätestens zehn Minuten auf dem Fernseher.

![Editor mit dem Baustein „Gruppen": zwei Karten mit QR-Code, rechts die Schalter für jede Angabe](bilder/gruppen.png)

### 4. Playlists

Eine **Playlist** ist der Inhalt, den ein Screen zeigt; sie kann auf mehreren Screens laufen. Unter **„Playlists"**
legst du neue an (oben rechts) und **duplizierst** bestehende (Menü „…") – die Kopie hat eigene Slides, Änderungen
daran berühren das Original nicht.

![Playlists als Kacheln mit Format, Zahl der Slides und den Screens, die sie zeigen](bilder/playlists.png)

### 5. Zeitpläne

Welche Playlist ein Screen wann zeigt. Die **Standard-Playlist** läuft, wenn keine **Regel** passt. Regeln schalten auf
eine andere – nach Uhrzeit („sonntags 9–12 Uhr") oder rund um Termine („30 Minuten vor Beginn bis 10 Minuten nach
Beginn" für eine Begrüßung); passen mehrere, gewinnt die obere. Die Seite **„Zeitpläne"** zeigt alle Screens mit
ihren Regeln und daneben die Playlist, die gerade läuft; ein Klick auf eine Regel zeigt deren Playlist.
„Bearbeiten" öffnet denselben Dialog wie „Zeitplan" an der Kachel.

![Zeitpläne: je Screen die Regeln und eine Vorschau der laufenden Playlist](bilder/zeitplaene.png)

### 6. Bilder

Über den Baustein „Bild" oder in der **Mediathek**. Unter jedem Bild steht, wo es läuft („Foyer › Gottesdienst ›
Begrüßung"); „Unbenutzt" hilft beim Aufräumen. Ein Bild lässt sich beliebig oft verwenden. **Nichts Vertrauliches
hochladen** – Bilder sind über ihre Adresse ohne Anmeldung abrufbar.

![Mediathek mit Suche, Filtern und der Angabe, wo ein Bild verwendet wird](bilder/mediathek.png)

### 7. Design

Einmal für alle Screens: Ecken rund oder eckig, Akzentfarbe, Farben für neue Slides, die Schrift für neue Bausteine
und Hinweise, Termine **„Nativ"** (schlichte Zeilen) oder **„Modern"** (Karten mit Datumskachel) und das Format der
Terminbilder – mit Vorschau. Ein Baustein, der eine eigene Darstellung gewählt hat, behält sie; bestehende Bausteine
behalten auch ihre Schrift.

![Design: Einstellungen links, Vorschau rechts](bilder/design.png)

### Gut zu wissen

- **Rückgängig** mit ⌘Z / Strg+Z; ein Ziehen ist ein Schritt.
- **Speichert jemand anderes gleichzeitig dieselbe Playlist**, fragt der Editor, welche Fassung gelten soll.
- **Neuer Kalender auf einem Screen** – in einer Terminliste, einem Countdown oder einer Termin-Regel? Dann einem
  Administrator Bescheid geben: Er klickt einmal „Rechte aktualisieren", damit die Fernseher den Kalender lesen
  dürfen.
- **Sagt die Startseite „Dir fehlen Rechte"**, nennt sie das Recht – gib die Meldung an einen Administrator weiter.
- **Was neu ist**, steht unter **„Über & Neuigkeiten"** unten in der Seitenleiste; ein blauer Punkt zeigt eine neue
  Version an.
- **Alles auf einem Screen sieht jeder im Foyer.** Personenbezogenes gehört nicht darauf. Die Leitung einer Gruppe
  zeigt der Baustein nur, wenn du sie einschaltest und ChurchTools sie ohnehin öffentlich zeigt.

## Gerät – der Fernseher

Das Gerät tut nichts selbst; es braucht nur einmal die richtige Adresse.

- [ ] Ein Administrator hat ein **Geräte-Konto** angelegt und unter **Einstellungen → Adressen für die Fernseher die Adresse** erzeugt.
- [ ] Die Adresse ist die **Startseite des Kiosk-Browsers**, im Vollbild; auf einem Raspberry Pi mit FullPageOS in
      `fullpageos.txt`. Tastatur und Maus braucht es nicht.
- [ ] **Bildschirmschoner und Energiesparen aus.**

Danach meldet sich der Fernseher bei jedem Start selbst an, holt Änderungen in etwa 20 Sekunden, zeigt bei Netzausfall
den letzten Stand und lädt jede Nacht neu. Zeigt er „nicht angemeldet", eine neue Adresse erzeugen – meist wurde das
Passwort des Geräte-Kontos geändert.
