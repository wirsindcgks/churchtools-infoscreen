# Infoscreen Designer einrichten

Diese Anleitung führt dich als **ChurchTools-Administrator** durch die Einrichtung: von der Installation bis zum
Fernseher im Foyer. Rechne mit etwa einer halben Stunde, den Fernseher nicht mitgezählt. Die Kurzfassung je Rolle
steht im [Onboarding](Onboarding.md), alle Rechte als Tabelle in der [Rechte-Übersicht](Rechte.md).

> **Kein Produkt der ChurchTools Innovation GmbH.** Der Infoscreen Designer ist eine unabhängige Entwicklung von
> Anwendern. Fragen gehören in den [Issue-Tracker](https://github.com/wirsindcgks/churchtools-infoscreen/issues),
> nicht an den ChurchTools-Support.

## Auf einen Blick

| Schritt | Wo |
| --- | --- |
| [1. Extension installieren](#1-extension-installieren) | Extension-Verwaltung von ChurchTools |
| [2. Dir selbst die Modulrechte geben](#2-dir-selbst-die-modulrechte-geben) | Rechteverwaltung |
| [3. Den Designer einmal öffnen](#3-den-designer-einmal-öffnen) | Menü „Infoscreen Designer" |
| [4. Gruppen und Rechte anlegen lassen](#4-gruppen-und-rechte-anlegen-lassen) | Designer → Einstellungen |
| [5. Gestalter aufnehmen](#5-gestalter-aufnehmen) | Gruppe „Infoscreen-Designer" |
| [6. Geräte-Benutzer anlegen](#6-geräte-benutzer-anlegen) | Personen, Gruppe „Infoscreen-Devices" |
| [7. Den Fernseher einrichten](#7-den-fernseher-einrichten) | Designer → Einstellungen, dann am Gerät |

**Drei Rollen:** Der **Administrator** richtet ein und legt die Bildschirme an. **Gestalter** (Gruppe
„Infoscreen-Designer") gestalten, was die Bildschirme zeigen. Das **Gerät** (Gruppe „Infoscreen-Devices") zeigt
einen Bildschirm an und darf nur lesen.

### Voraussetzungen

- **Extensions müssen für eure Instanz freigeschaltet sein.** Gibt es die Extension-Verwaltung aus Schritt 1 nicht,
  bei ChurchTools anfragen.
- **Ein Administrator-Konto**, das Berechtigungen und Gruppen verwalten darf. Fehlt dir ein Recht, nennt es die
  Einstellungsseite ([Einzelheiten](Rechte.md#churchtools-selbst--nur-für-administratoren)).
- **Pro Fernseher ein Gerät mit Browser**, das im Vollbild dauerhaft eine Webseite zeigt – etwa ein Raspberry Pi,
  ein Mini-PC oder ein Smart-TV mit Kiosk-Browser.

---

## 1. Extension installieren

1. Das neueste `churchtools-infoscreen-vX.Y.Z.zip` von der
   [Release-Seite](https://github.com/wirsindcgks/churchtools-infoscreen/releases) herunterladen. **Nicht entpacken.**
2. In ChurchTools die Extension-Verwaltung öffnen: `https://<eure-instanz>.church.tools/custom/modules/overview`.
3. **„Erweiterung hinzufügen"** und ausfüllen:

   | Feld | Eintrag |
   | --- | --- |
   | Name | `Infoscreen Designer` |
   | Kürzel | **exakt** `infoscreen-designer` – mit Bindestrich, alles klein |
   | Beschreibung | frei, etwa `Gestaltung und Ausspielung der Infoscreens` (Pflichtfeld) |
   | Im Menü anzeigen | Haken lassen |
   | ZIP-Datei | das heruntergeladene ZIP |

   **Das Kürzel muss stimmen** – sonst öffnet der Menüpunkt nur eine weiße Seite.

Danach ist die Extension installiert, aber **noch für niemanden sichtbar, auch nicht für dich**. Das ist richtig so:
Administratorrechte schließen die Rechte an einer Extension nicht ein.

## 2. Dir selbst die Modulrechte geben

Am besten über die Rolle einer Gruppe, in der die Administratoren ohnehin sind
([Academy: globale Berechtigung vergeben](https://churchtools.academy/de/help/rechteverwaltung/berechtigungen-vergeben/wie-vergebe-ich-eine-globale-berechtigung/)):

1. **Rechteverwaltung** → Reiter **Gruppen** → eure Administratoren-Gruppe.
2. Bei deiner Rolle auf **Bearbeiten**.
3. **„Infoscreen Designer"** aufklappen und so einstellen:

   | Berechtigung | Einstellung |
   | --- | --- |
   | „Infoscreen Designer" sehen | ✓ |
   | Kategorien sehen | ✓, „alle" |
   | Kategorien erstellen | ✓ |
   | Kategorien bearbeiten, Kategorien löschen | kein Haken |
   | Daten in Kategorie sehen, erstellen, bearbeiten, löschen | ✓, „alle" |

4. **Speichern.** Die Gruppe muss den Status **„aktiv"** haben.

## 3. Den Designer einmal öffnen

Oben im Menü steht jetzt **„Infoscreen Designer"** (sonst die Seite neu laden). Beim ersten Öffnen legt der Designer
seine Datenablage in ChurchTools an.

## 4. Gruppen und Rechte anlegen lassen

Ein Assistent im Designer legt die Gruppen für Gestalter und Geräte samt allen Rechten an:

1. **Einstellungen → Räume:** prüfen, welche Ressourcentypen als Raum gelten. Gibt es bei euch den Typ „Raum", ist
   er vorgewählt und nichts zu tun. Sonst die passenden Typen ankreuzen und **„Speichern"**.
2. **Einstellungen → Gruppen und Rechte**, Karte **„Automatisch einrichten"**.
3. Den **Gruppentyp** wählen – vorgewählt ist „Merkmal". Nimm einen Typ, der seinen Rollen selbst wenig Rechte gibt:
   Gestalter und Fernseher bekämen sie mit
   ([Academy: Gruppentypen](https://churchtools.academy/de/help/app/rund-ums-gruppenmodul/37-was-sind-gruppentypen-und-wofur-kann-ich-sie-benutzen/)).
4. **„Gruppen und Rechte anlegen"** klicken.

Es entstehen zwei leere Gruppen: **„Infoscreen-Designer"** für die Gestalter und **„Infoscreen-Devices"** für die
Fernseher. Dazu kommt der Wiki-Bereich **„Infoscreen"**, in dem die Bilder der Mediathek liegen. Was genau welche
Gruppe darf, steht unter „Was genau passiert" auf der Seite und in der [Rechte-Übersicht](Rechte.md).

**Bildschirme anlegen:** auf der Startseite des Designers **„+ Bildschirm erstellen"**, je Fernseher einer. Name und
Overscan änderst du später über **„…"** an der Kachel.

### Gut zu wissen

- **Fernseher zeigen nur öffentliche Kalender** – solche, die man in ChurchTools auch ohne Anmeldung sieht
  (Berechtigungen → Benutzer → „Öffentlicher Benutzer" → Kalender). Einen neuen öffentlichen Kalender kann ein
  Gestalter sofort benutzen.
- **Interne Kalender freigeben:** Unter **Einstellungen → Interne Kalender für Bildschirme** lassen sich einzelne
  nicht öffentliche Kalender für die Bildschirme freischalten. **Wer die Adresse eines Fernsehers kennt, kann einen
  freigegebenen Kalender ganz lesen** – gib nur frei, was im Foyer stehen darf. Intern markierte Termine zeigt der
  Fernseher nie.
- **„Rechte aktualisieren"** (Einstellungen → Gruppen und Rechte) brauchst du, wenn ein Bildschirm neue Räume zeigt,
  wenn du interne Kalender oder Raumtypen änderst und nach einem Update. Eine Vorschau zeigt vorher, was dazukommt
  und was wegfällt – der Knopf nimmt auch Rechte zurück, die kein Bildschirm mehr braucht. Entzogene Rechte wirken in
  ChurchTools noch bis zu einer Dreiviertelstunde nach ([Einzelheiten](Rechte.md#was-rechte-aktualisieren-zurücknimmt)).
- **Gruppen und Wiki-Bereich darfst du umbenennen**; der Designer erkennt sie weiter.
- **Eigene Gruppen statt der automatischen?** Weiter unten auf derselben Seite lassen sich vorhandene Gruppen wählen.
  Die Seite prüft dann, was ihnen fehlt, ändert aber selbst nichts.
- **Zurücknehmen:** „Automatische Einrichtung rückgängig machen" löscht nur die Gruppen, die der Assistent selbst
  angelegt hat (siehe [Den Designer wieder entfernen](#den-designer-wieder-entfernen)).

## 5. Gestalter aufnehmen

Wer gestalten soll, wird **Mitglied der Gruppe „Infoscreen-Designer"** – die Rolle ist egal. Vergib die
Mitgliedschaft bewusst: Gestalter können im Wiki-Bereich „Infoscreen" auch Bilder löschen. Willst du selbst
gestalten, nimm dich ebenfalls auf.

Fehlt einem Gestalter ein Recht, nennt es die Startseite des Designers.

## 6. Geräte-Benutzer anlegen

Der Fernseher meldet sich mit einem **eigenen ChurchTools-Konto** an. Empfehlung: **ein Konto je Standort**
(„Infoscreen Foyer", „Infoscreen Café") – dann lässt sich ein einzelnes Gerät sperren.

1. **Person anlegen**, etwa „Infoscreen Foyer" – kein echtes Personenkonto. Eine E-Mail-Adresse ist nicht nötig.
2. **Benutzername und Passwort setzen.** **Ein Passwort allein reicht nicht** – ohne Benutzernamen scheitert jede
   Anmeldung mit „Überprüfe Benutzername und Passwort".
3. **Einen Personenstatus mit möglichst wenig Rechten wählen.** Rechte addieren sich: Was der Status erlaubt, darf
   auch jeder, der die Adresse des Fernsehers kennt.
4. **In die Gruppe „Infoscreen-Devices" aufnehmen – in keine weitere**, aus demselben Grund.

**Prüfen:** Unter **Einstellungen → Gruppen und Rechte** die Gruppe „Infoscreen-Devices" wählen. Die Prüfung nennt
nicht öffentliche Kalender und jedes Recht des Kontos, das ein Gerät nicht braucht – samt der Gruppe, von der es kommt.

## 7. Den Fernseher einrichten

### Die Adresse erzeugen

Der Fernseher bekommt eine Adresse, mit der er sich bei jedem Start selbst anmeldet. Eine Anmeldung von Hand im
Browser genügt nicht – ChurchTools meldet nach 24 Stunden ab.

1. **Einstellungen → Adressen der Bildschirme.**
2. Bildschirm wählen, **Benutzername und Passwort des Geräte-Kontos** eingeben, **„Adresse erzeugen"**.
3. **Kopieren** und als **Startseite des Kiosk-Browsers** eintragen.

**Die Adresse ist ein Schlüssel.** Wer sie hat, sieht ChurchTools mit den Rechten des Geräte-Kontos, ohne Passwort.
Trag sie direkt am Gerät ein, statt sie per E-Mail oder Chat zu schicken, und fotografiere sie nicht ab. Ungültig wird
sie, sobald das Passwort des Geräte-Kontos geändert wird.

**Ein Browser, ein Konto:** ChurchTools kennt je Browser nur eine Anmeldung. Zum Ausprobieren am Schreibtisch den
Player deshalb in einem **Inkognito-Fenster** oder eigenen Browserprofil öffnen, nicht neben ChurchTools.

### Einstellungen des Kiosk-Browsers

| Einstellung | Warum |
| --- | --- |
| **Dauerhaftes Browserprofil** – Cookies und Websitedaten nicht löschen | der Fernseher übersteht so Netzausfälle |
| **Beim Start die Adresse öffnen**, im Vollbild | läuft nach einem Stromausfall von selbst wieder an |
| **Bildschirmschoner und Energiesparen aus** | sonst wird das Foyer schwarz |
| **Neu laden, wenn die Seite nicht lädt** – falls möglich | hilft, wenn das Gerät ohne Netz startet |
| **Auflösung 1920 × 1080** (hochkant 1080 × 1920) | andere Seitenverhältnisse bekommen schwarze Ränder |

- **Raspberry Pi:** gut geeignet ist **FullPageOS**; die Startadresse steht in `fullpageos.txt` auf der
  Boot-Partition.
- **Ton bei Videos:** Chromium braucht die Startoption `--autoplay-policy=no-user-gesture-required`, sonst laufen
  Videos stumm.
- **Schneidet der Fernseher den Rand ab**, an der Kachel unter „…" → „Einstellungen" die **Overscan-Korrektur**
  einstellen.

### Was der Fernseher von selbst tut

- Er übernimmt Änderungen der Gestalter **binnen etwa einer halben Minute**, Termine alle zehn Minuten.
- Er **behält den letzten Stand** und zeigt ihn weiter, wenn Netz oder ChurchTools ausfallen – auch nach einem
  Neustart ([mehr dazu](Ausfall.md)).
- Er **lädt jede Nacht zwischen 3 und 4 Uhr neu** und erneuert dabei seine Anmeldung.
- Er **meldet sich alle fünf Minuten**; die Kachel auf der Startseite zeigt dann „online" oder „nicht online seit …".

## Updates

1. Das neue ZIP von der [Release-Seite](https://github.com/wirsindcgks/churchtools-infoscreen/releases) herunterladen.
2. In der Extension-Verwaltung bei „Infoscreen Designer" auf **Bearbeiten** und das ZIP hochladen.
3. Im Designer **Einstellungen → Gruppen und Rechte → „Rechte aktualisieren"** – neue Fassungen können neue Rechte
   brauchen.

Die Fernseher übernehmen die neue Fassung spätestens beim nächtlichen Neuladen. Welche Fassung installiert ist, steht
unten auf der Übersicht **Einstellungen**.

**Löschen und neu hochladen ist kein Update** – eine neu installierte Extension beginnt leer.

## Den Designer wieder entfernen

Die Reihenfolge ist wichtig: **erst die Einrichtung, dann die Extension.**

1. **Einstellungen → Gruppen und Rechte → „Automatische Einrichtung rückgängig machen".** Löscht die Gruppen des
   Assistenten. Dafür brauchst du die Modulrechte aus [Schritt 2](#2-dir-selbst-die-modulrechte-geben). Nach dem
   Löschen der Extension wüsste der Designer nicht mehr, welche Gruppen von ihm stammen.
2. **Extension-Verwaltung → „Infoscreen Designer" → Löschen.** Entfernt alle Bildschirme, Folien und Einstellungen.
3. **Wiki-Bereich und Geräte-Benutzer** löscht der Designer nie – sichern, löschen oder behalten entscheidest du.
4. **Die Passwörter der Gerätekonten ändern** (oder die Konten löschen). Sonst bleiben die Adressen der Fernseher
   gültige Schlüssel, auch ohne Designer. Welche Konten das sind, nennt der Dialog aus Punkt 1.

### Was beim Abbau passiert – auf einen Blick

| Was | „Rückgängig machen" | Extension löschen | Danach |
| --- | --- | --- | --- |
| Gruppen, die der Assistent angelegt hat | **gelöscht** | – | weg |
| Gruppen, die du selbst gewählt hast | unberührt | Rechte am Modul entfernt | bleiben |
| Bildschirme, Präsentationen, Folien, Design, Einstellungen | bleiben | **gelöscht** | weg |
| Rechte am Modul, auch an eurer Administratoren-Gruppe | bleiben | **entfernt** | weg |
| Wiki-Bereich „Infoscreen" mit den Bildern | bleibt | bleibt | **von Hand** sichern oder löschen |
| Geräte-Benutzer | bleibt, ohne Gruppe | bleibt | **von Hand** archivieren oder löschen |
| Adressen der Fernseher | bleiben gültig | bleiben gültig | **von Hand**: Passwörter ändern |

## Wenn ein Gerät verloren geht – die Notbremse

1. **Den Geräte-Benutzer aus „Infoscreen-Devices" nehmen** – damit verliert er die Rechte am Designer und an den
   Kalendern.
2. **Sein Passwort ändern** – die Adresse auf dem verlorenen Gerät meldet sich nicht mehr an.
3. Für das Ersatzgerät eine **neue Adresse erzeugen**. Andere Fernseher am selben Konto brauchen ebenfalls eine neue.

Mehr als lesen konnte das Gerät nie.

## Was öffentlich ist – Datenschutz

- **Was auf einem Bildschirm steht, sieht jeder, der vorbeigeht.** Geburtstage, Kontaktdaten und Ähnliches gehören
  nicht darauf.
- **Namen bei Diensten** erscheinen nur für Dienste, die ein Administrator unter **Einstellungen → Dienste auf
  Bildschirmen** freigibt. Stimmt das vorher mit der Gemeindeleitung ab.
- **Buchungstitel der Raumbelegung** lassen sich je Raum abschalten; dann steht dort „Belegt".
- **Bilder der Mediathek sind über ihre Adresse ohne Anmeldung abrufbar.** Lade nichts hoch, was nicht öffentlich
  sein darf.
- **Gruppen und Beiträge** zeigt der Designer nur, soweit ChurchTools sie ohnehin öffentlich zeigt. Namen von
  Leitung und Autoren erscheinen nur, wenn ein Gestalter sie einschaltet.
- **Eine eingebettete Webseite ist ein Aufruf bei Dritten:** Ihr Betreiber erfährt die Internetadresse des Geräts.
  Bettet nur ein, was ihr auch auf eurer Website einbetten würdet.
- **Schriften kommen von eurer eigenen Instanz**, nicht von einem fremden Dienst.
- **Der Fernseher speichert den letzten Stand** im Browser. Wer ein Gerät weggibt, löscht vorher das Browserprofil.
- **Bilder nur in der Mediathek verwalten:** Wer ein Bild im Wiki löscht, löscht es auch auf den Bildschirmen. Die
  Mediathek warnt davor, das Wiki nicht.

## Wenn etwas nicht klappt

| Was du siehst | Was hilft |
| --- | --- |
| Kein Menüpunkt „Infoscreen Designer" | Modulrechte aus [Schritt 2](#2-dir-selbst-die-modulrechte-geben); die Gruppe muss „aktiv" sein |
| Menüpunkt öffnet eine weiße Seite | Das Kürzel ist nicht `infoscreen-designer`: Extension löschen und mit richtigem Kürzel neu anlegen ([Schritt 1](#1-extension-installieren)) |
| Startseite: „Dir fehlen Rechte …" | Person (aktiv) in „Infoscreen-Designer" aufnehmen; die Liste nennt das fehlende Recht |
| Kein „Einstellungen" im Designer | Einstellungen sind Administratoren vorbehalten |
| Kein „+ Bildschirm erstellen" | auch Administratoren brauchen die „Daten in Kategorie …"-Rechte aus Schritt 2 |
| „Gruppen und Rechte anlegen" bleibt grau | einen Gruppentyp wählen |
| „Adresse erzeugen" meldet „Anmeldung fehlgeschlagen" | dem Geräte-Konto fehlt meist der **Benutzername** ([Schritt 6](#6-geräte-benutzer-anlegen)) |
| Fernseher: „… nicht bei ChurchTools angemeldet" | neue Adresse erzeugen – etwa nach einer Passwortänderung |
| Player fragt nach Anmeldung oder zeigt keine Termine | im Inkognito-Fenster oder eigenen Browserprofil öffnen |
| Fernseher: „Es gibt keinen Bildschirm „…"" | Adresse neu kopieren |
| Termine eines Kalenders fehlen | Kalender öffentlich machen oder [intern freigeben](#gut-zu-wissen) |
| Ein Raum fehlt in der Raumbelegung | „Rechte aktualisieren" |
| „Keine Ressource gilt als Raum" | Einstellungen → Räume: passende Typen wählen, dann „Rechte aktualisieren" |
| Platzhalter statt Bild | Das Bild wurde im Wiki gelöscht – ein neues wählen |
| Baustein „Gruppen": „Noch keine Gruppen-Homepage" | in ChurchTools an der Obergruppe: Einstellungen → Allgemein → Außendarstellung → „Gruppenhomepage erstellen" |
| Baustein „Gruppen": eine Gruppe fehlt | an der Gruppe die öffentliche Seite einschalten; sie muss Untergruppe der Obergruppe sein |
| Baustein „Gruppen": keine Leitung | an der Homepage „Leiter anzeigen" einschalten; sonst weniger Gruppen je Seite |
| Mediathek: „Wiki-Bereich … nicht zu finden" | Schritt 4 ausführen; sonst deine Rechte am Wiki-Bereich prüfen |
