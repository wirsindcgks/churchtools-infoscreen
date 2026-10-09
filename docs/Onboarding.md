# Onboarding – der Einstieg je Rolle

Wer mit dem Infoscreen Designer arbeitet, hat eine von drei Rollen. Hier steht für jede, was zu tun ist – in der
Reihenfolge, in der es passiert. Die Einzelheiten stehen in der [Einrichtungsanleitung](Einrichtung.md), welche
Rechte wer braucht in der [Rechte-Übersicht](Rechte.md). Was der Designer kann, zeigt die Übersicht
[Der Designer in Bildern](Funktionen.md).

| Rolle | Wer | Aufgabe |
| --- | --- | --- |
| [Administrator](#administrator--einmal-einrichten) | ChurchTools-Admin | installiert, vergibt Rechte, legt Bildschirme an |
| [Gestalter](#gestalter--inhalte-gestalten) | Mitglied von „Infoscreen-Designer" | gestaltet, was die Bildschirme zeigen |
| [Gerät](#gerät--der-fernseher) | Konto eines Fernsehers | zeigt einen Bildschirm an – ohne dass jemand etwas tut |

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
- [ ] **Bildschirme anlegen:** Startseite → **„+ Bildschirm erstellen"**, je Fernseher einer. Umbenennen später über „…" →
      „Umbenennen", den Overscan über „…" → „Einstellungen".
- [ ] **Gestalter aufnehmen:** in die Gruppe „Infoscreen-Designer", egal in welcher Rolle.
- [ ] **Je Fernseher ein Geräte-Konto** mit Benutzername und Passwort, Personenstatus mit wenig Rechten, Mitglied
      von „Infoscreen-Devices" ([Schritt 6](Einrichtung.md#6-geräte-benutzer-anlegen)).
- [ ] **Adresse für den Fernseher erzeugen:** Einstellungen → Adressen der Bildschirme
      ([Schritt 7](Einrichtung.md#7-den-fernseher-einrichten)).

**Danach gelegentlich:**

- **Nach jedem Update** und wenn ein Bildschirm einen neuen Kalender zeigt: Einstellungen → Gruppen und Rechte →
  **„Rechte aktualisieren"** (eine Vorschau zeigt vorher, was sich ändert; was kein Bildschirm mehr braucht, fällt weg).
- **Gerät verloren?** Passwort des Geräte-Kontos ändern, neue Adresse erzeugen
  ([Notbremse](Einrichtung.md#wenn-ein-gerät-verloren-geht--die-notbremse)).
- **Jemand hört auf zu gestalten?** Aus der Gruppe „Infoscreen-Designer" nehmen – die Rechte gehen mit.

## Gestalter – Inhalte gestalten

Du brauchst nur die Mitgliedschaft in „Infoscreen-Designer"; alles Weitere kommt von dort. Die Bilder hier zeigen
eine erfundene Gemeinde.

### 1. Die Bildschirme

In ChurchTools oben auf **„Infoscreen Designer"**. Die Startseite zeigt jeden Fernseher als Kachel – mit dem, was er
**gerade** zeigt. Ein Klick auf die Kachel öffnet diese Präsentation im Editor; Adresse, Zeitplan und Player stecken im
Menü „…". Die erste Zeile sagt, ob der Fernseher gerade **„online"** ist. Neue Bildschirme legt ein Administrator an.

![Startseite mit zwei Bildschirmen als Kacheln](bilder/startseite.png)

### 2. Folien gestalten

![Editor: links die Folien, oben „+ Baustein", in der Mitte die Bildfläche, rechts der Inspektor](bilder/editor.png)

- **Links die Folien** – „Neue Folie" unter der letzten, ziehen zum Umsortieren, darunter **„Aus anderer Präsentation
  …"**, um Folien einer anderen Präsentation zu übernehmen – **„Als Kopie"** (Vorgabe: was du hier änderst, bleibt in der
  anderen Präsentation, wie es ist) oder **„Verknüpft"**: dann ist es dieselbe Folie, und eine Änderung gilt in beiden
  Präsentationen. Verknüpfte Folien tragen ein Kettensymbol auf dem Vorschaubild; im Inspektor steht unter dem Namen
  „Auch in: …", dort löst **„Verknüpfung lösen"** die Folie zu einer eigenen Kopie nur für diese Präsentation. Hat
  jemand eine verknüpfte Folie inzwischen woanders geändert, speichert der Editor nichts, sondern fragt: **„Neu laden"**
  oder **„Als eigene Kopie behalten"**.
- **„+ Baustein"** öffnet alle Bausteine, alphabetisch: Beiträge, Bild, Countdown („Gottesdienst beginnt in 12:34"),
  Fläche, Galerie (siehe unten), Gemeindekopf, Gruppen (siehe unten), Nächster Termin, QR-Code, Raumbelegung (siehe unten), Terminliste, Text, Uhr und Webseite.
- **In der Mitte die Bildfläche:** ziehen, an den Griffen skalieren, an den **Hilfslinien** ausrichten (oben rechts: Abstand wählen oder aus; mit gedrückter Alt-Taste frei platzieren).
- **Rechts der Inspektor:** Sein Kopf sagt, wo du bist („Folie 2 von 5"). Oben steht der Inhalt des Bausteins (Text, Kalender, Adresse …), darunter aufklappbare
  Bereiche – **Schrift** und **Position & Ebene**, bei Gruppen auch **Angaben**. Zugeklappt zeigt jeder Bereich in
  einer Zeile, was eingestellt ist; was du einmal aufklappst, bleibt offen. Im Kopf des Inspektors stehen
  **„Sperren"** – damit ein Logo oder Hintergrund nicht verrutscht, ein Klick darauf erreicht dann den Baustein
  darunter, mit gedrückter Alt-Taste (Mac: Option) den gesperrten selbst –, **„Duplizieren"**, **„Kopieren"** und **„Löschen"**. Eine Kopie fügst du mit **„Einfügen"** neben „+ Baustein" oder Strg/⌘ + V an derselben Stelle ein, auch auf einer anderen Folie; Strg/⌘ + D dupliziert. Ein **ⓘ** klappt eine
  Erklärung auf. Folien und Inspektor lassen sich einklappen, damit die Bildfläche mehr Platz bekommt; auf dem
  Tablet sind sie das von Anfang an.
- **Hinweise** haben eine eigene Seite in der Seitenleiste: ein Band über allen Folien der gewählten Präsentationen – als
  Laufschrift oder stehend, etwa „Heute Parkplatz gesperrt", mit **„Zeigen bis"**, danach verschwindet es von selbst.
- **Vorschau** (oben): spielt die Präsentation mit deinen Änderungen im Vollbild ab, wie der Fernseher – ohne zu
  speichern. Esc schließt sie.
- **Speichern** (oder ⌘S / Strg+S). Alle Fernseher, die diese Präsentation zeigen, übernehmen die Änderung in etwa
  20 Sekunden von selbst.

**Galerie:** Der Baustein zeigt Bilder aus der Mediathek nacheinander. Mit **„+ Bilder"** wählst du mehrere auf einmal
(die Zahl auf dem Bild ist die Reihenfolge), im Inspektor sortierst du sie mit ↑ und ↓ oder nimmst eins heraus. Du
stellst die **Dauer je Bild** ein und den **Übergang** – Überblenden, Schieben, Aufdecken, Heranzoomen oder ohne. Die Folie läuft so lange, bis jedes Bild einmal zu sehen
war; höchstens 30 Bilder je Galerie. Sie läuft auch ohne Netz, denn die Bilder liegen auf dem Gerät.

![Editor mit dem Baustein „Galerie": rechts die Liste der Bilder mit Reihenfolge, Dauer und Übergang](bilder/galerie.png)

### 3. Gruppen aus ChurchTools

Der Baustein **„Gruppen"** zeigt, was es in der Gemeinde für Gruppen gibt – aus einer **Gruppen-Homepage** von
ChurchTools. Die legt ein Administrator an der Obergruppe an: Gruppe öffnen → **Einstellungen → Allgemein →
Außendarstellung → „Gruppenhomepage erstellen"**
([Academy](https://churchtools.academy/de/help/churchtools-module/einstellungen-gruppen/wie-passe-ich-die-gruppenhomepage-meiner-obergruppe-an/)).
Darauf erscheinen die Untergruppen, deren öffentliche Seite eingeschaltet ist.

- **Im Inspektor** die Homepage wählen; dann **alle Gruppen** (nach Wochentag, Name A–Z oder Z–A) oder eine **Auswahl** in eigener
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

### 4. Präsentationen

Eine **Präsentation** ist der Inhalt, den ein Bildschirm zeigt; sie kann auf mehreren Bildschirmen laufen. Unter **„Präsentationen"**
legst du neue an (oben rechts) und **duplizierst** bestehende (Menü „…") – du wählst **„Kopie"** (eigene Folien,
Änderungen daran berühren das Original nicht) oder **„Verknüpft"** (dieselben Folien, Änderungen gelten in beiden).

![Präsentationen als Kacheln mit Format, Zahl der Folien und den Bildschirmen, die sie zeigen](bilder/playlists.png)

### 5. Zeitpläne

Welche Präsentation ein Bildschirm wann zeigt. Die **Standard-Präsentation** läuft, wenn keine **Regel** passt. Regeln schalten auf
eine andere – nach Uhrzeit („sonntags 9–12 Uhr") oder rund um Termine („30 Minuten vor Beginn bis 10 Minuten nach
Beginn" für eine Begrüßung); passen mehrere, gewinnt die obere. Die Seite **„Zeitpläne"** zeigt alle Bildschirme mit
ihren Regeln und daneben die Präsentation, die gerade läuft; ein Klick auf eine Regel zeigt deren Präsentation.
„Bearbeiten" öffnet denselben Dialog wie „Zeitplan" an der Kachel.

![Zeitpläne: je Bildschirm die Regeln und eine Vorschau der laufenden Präsentation](bilder/zeitplaene.png)

### 6. Bilder

Über den Baustein „Bild" oder in der **Mediathek**. Unter jedem Bild steht, wo es läuft („Foyer › Gottesdienst ›
Begrüßung"); „Unbenutzt" hilft beim Aufräumen. Ein Bild lässt sich beliebig oft verwenden. **Nichts Vertrauliches
hochladen** – Bilder sind über ihre Adresse ohne Anmeldung abrufbar.

![Mediathek mit Suche, Filtern und der Angabe, wo ein Bild verwendet wird](bilder/mediathek.png)

### 7. Design

Einmal für alle Bildschirme: Ecken rund oder eckig, Akzentfarbe, Farben für neue Folien, die Schrift für neue Bausteine
und Hinweise, Termine **„Nativ"** (schlichte Zeilen) oder **„Modern"** (Karten mit Datumskachel) und das Format der
Terminbilder sowie der Kartenhintergrund (leicht getönt, ohne oder eigene Farbe) – mit Vorschau. Ein Baustein, der eine eigene Darstellung gewählt hat, behält sie; bestehende Bausteine
behalten auch ihre Schrift.

![Design: Einstellungen links, Vorschau rechts](bilder/design.png)

### Gut zu wissen

- **Rückgängig** mit ⌘Z / Strg+Z; ein Ziehen ist ein Schritt.
- **Speichert jemand anderes gleichzeitig dieselbe Präsentation**, fragt der Editor, welche Fassung gelten soll.
- **Neuer Kalender auf einem Bildschirm** – in einer Terminliste, einem Countdown oder einer Termin-Regel? Zur Wahl
  stehen nur öffentliche Kalender, also solche, die man in ChurchTools auch ohne Anmeldung sieht; die zeigen die
  Fernseher ohne weiteren Handgriff. Fehlt einer, kann ihn ein Administrator freigeben – den Weg nennt das (i) am
  Kalender-Feld. Ein interner Kalender erscheint auf keinem Fernseher.
- **Sagt die Startseite „Dir fehlen Rechte"**, nennt sie das Recht – gib die Meldung an einen Administrator weiter.
- **Was neu ist**, steht unter **„Über & Neuigkeiten"** unten in der Seitenleiste; ein blauer Punkt zeigt eine neue
  Version an.
- **Alles auf einem Bildschirm sieht jeder im Foyer.** Personenbezogenes gehört nicht darauf. Die Leitung einer Gruppe
  zeigt der Baustein nur, wenn du sie einschaltest und ChurchTools sie ohnehin öffentlich zeigt.

## Gerät – der Fernseher

Das Gerät tut nichts selbst; es braucht nur einmal die richtige Adresse.

- [ ] Ein Administrator hat ein **Geräte-Konto** angelegt und unter **Einstellungen → Adressen der Bildschirme die Adresse** erzeugt.
- [ ] Die Adresse ist die **Startseite des Kiosk-Browsers**, im Vollbild; auf einem Raspberry Pi mit FullPageOS in
      `fullpageos.txt`. Tastatur und Maus braucht es nicht.
- [ ] **Bildschirmschoner und Energiesparen aus.**

Danach meldet sich der Fernseher bei jedem Start selbst an, holt Änderungen in etwa 20 Sekunden, zeigt bei Netzausfall
den letzten Stand und lädt jede Nacht neu. Zeigt er „nicht angemeldet", eine neue Adresse erzeugen – meist wurde das
Passwort des Geräte-Kontos geändert.
