# Infoscreen Designer einrichten

Diese Anleitung führt dich als **ChurchTools-Administrator** durch die Einrichtung: von der Installation über die
Rechte bis zum Fernseher im Foyer. Rechne mit etwa einer halben Stunde, den Fernseher nicht mitgezählt. Die
Kurzfassung je Rolle steht im [Onboarding](Onboarding.md), alle Rechte als Tabelle in der
[Rechte-Übersicht](Rechte.md).

> **Kein Produkt der ChurchTools Innovation GmbH.** Der Infoscreen Designer ist eine unabhängige Entwicklung von
> Anwendern. Fragen gehören in den [Issue-Tracker](https://github.com/wirsindcgks/churchtools-infoscreen/issues),
> nicht an den ChurchTools-Support.

## Auf einen Blick

| Schritt | Wer | Wo |
| --- | --- | --- |
| [1. Extension installieren](#1-extension-installieren) | Administrator | Extension-Verwaltung von ChurchTools |
| [2. Dir selbst die Modulrechte geben](#2-dir-selbst-die-modulrechte-geben) | Administrator | Rechteverwaltung |
| [3. Den Designer einmal öffnen](#3-den-designer-einmal-öffnen) | Administrator | Menü „Infoscreen Designer" |
| [4. Gruppen und Rechte anlegen lassen](#4-gruppen-und-rechte-anlegen-lassen) | Administrator | Designer → Einstellungen → Gruppen und Rechte |
| [5. Gestalter aufnehmen](#5-gestalter-aufnehmen) | Administrator | Gruppe „Infoscreen-Designer" |
| [6. Geräte-Benutzer anlegen](#6-geräte-benutzer-anlegen) | Administrator | Personen, Gruppe „Infoscreen-Devices" |
| [7. Den Fernseher einrichten](#7-den-fernseher-einrichten) | Administrator, dann wer vor Ort ist | Designer → Einstellungen → Adressen für die Fernseher, Kiosk-Browser |

### Drei Rollen

| Rolle | Wer | Darf |
| --- | --- | --- |
| **Administrator** | wer in ChurchTools Berechtigungen verwalten darf | installieren, die **Einstellungen** des Designers öffnen, Gruppen und Rechte anlegen; **Bildschirme anlegen, einstellen (Name, Overscan) und löschen** – ein Bildschirm steht für ein Gerät im Haus |
| **Gestalter** | Mitglieder der Gruppe „Infoscreen-Designer" | gestalten, was die Bildschirme zeigen: Folien, Präsentationen, Zeitpläne und Bilder anlegen, ändern und löschen – nicht die Bildschirme selbst und nicht die Einstellungen |
| **Gerät** | Mitglieder der Gruppe „Infoscreen-Devices" | nur lesen: die Bildschirme, die Kalender und Räume, die sie zeigen, und die Videos der Mediathek; schreiben nur ihr Lebenszeichen |

### Voraussetzungen

- **Extensions (Custom Modules) müssen für deine Instanz freigeschaltet sein.** Das ist nicht überall der Fall; ob
  es bei euch geht, siehst du daran, dass es die Extension-Verwaltung gibt (Schritt 1). Sonst bei ChurchTools
  anfragen.
- **Ein Administrator-Konto**, das Berechtigungen verwalten darf – und unter „Gruppen" die Gruppen des Assistenten
  sehen, anlegen und löschen: „Gruppen eines Gruppentyps erstellen" und „… sehen" für den Gruppentyp, den du in Schritt 4 wählst
  – vorgewählt ist „Merkmal" („Gruppe inkl. ihrer Gruppenmitglieder sehen" je Gruppe tut es auch), „Gruppe löschen" bzw. „Gruppen eines Gruppentyps löschen" – oder
  alles zusammen „Gruppen verwalten". Fehlt eines, graut die Einstellungsseite den Knopf aus und nennt es. Ein
  Super-Admin hat das alles und braucht auch die Modulrechte aus Schritt 2 nicht ausdrücklich
  (Einzelheiten in [Rechte](Rechte.md#churchtools-selbst--nur-für-administratoren)).
- **Pro Fernseher ein Gerät mit Browser**, das im Vollbild dauerhaft eine Webseite zeigt – etwa ein Raspberry Pi,
  ein Mini-PC oder ein Smart-TV mit Kiosk-Browser. Näheres in Schritt 7.

---

## 1. Extension installieren

1. Lade das neueste Paket `churchtools-infoscreen-vX.Y.Z.zip` von der
   [Release-Seite](https://github.com/wirsindcgks/churchtools-infoscreen/releases) herunter. **Nicht entpacken.**
2. Öffne in ChurchTools die Extension-Verwaltung: `https://<eure-instanz>.church.tools/custom/modules/overview`.
3. **„Erweiterung hinzufügen"** öffnet eine Maske; ChurchTools füllt darin nichts vor:

   | Feld | Eintrag |
   | --- | --- |
   | Name | `Infoscreen Designer` |
   | Kürzel | **exakt** `infoscreen-designer` – mit Bindestrich, alles klein |
   | Beschreibung | frei, etwa `Gestaltung und Ausspielung der Infoscreens` (Pflichtfeld) |
   | Sortierung | frei |
   | Im Menü anzeigen | Haken lassen |
   | ZIP-Datei | das heruntergeladene ZIP |

   **Das Kürzel muss stimmen.** Der Designer findet seine Dateien und seine Daten nur unter diesem Namen. Mit einem
   anderen Kürzel installiert ChurchTools die Extension ohne Fehlermeldung, aber der Menüpunkt öffnet eine weiße
   Seite.

Danach ist die Extension installiert, **aber noch für niemanden sichtbar – auch nicht für dich.** Das ist kein
Fehler, sondern die Rechteverwaltung von ChurchTools: Administratorrechte schließen die Rechte an einer Extension
nicht ein.

## 2. Dir selbst die Modulrechte geben

Einmalig, damit du den Designer öffnen und einrichten kannst. Am besten über die Rolle einer Gruppe, in der die
Administratoren ohnehin sind – so bleibt es nachvollziehbar
([Academy: Wie vergebe ich eine globale Berechtigung?](https://churchtools.academy/de/help/rechteverwaltung/berechtigungen-vergeben/wie-vergebe-ich-eine-globale-berechtigung/)):

1. **Rechteverwaltung** öffnen, Reiter **Gruppen**, eure Administratoren-Gruppe anklicken.
2. Unter der Rolle, in der du Mitglied bist, auf **Bearbeiten** klicken.
3. Im Berechtigungsbaum **„Infoscreen Designer"** aufklappen und so einstellen – alle neun Zeilen des Baums:

   | Berechtigung | Einstellung |
   | --- | --- |
   | „Infoscreen Designer" sehen | ✓ Haken setzen |
   | Kategorien sehen | Haken setzen, Auswahl „alle" |
   | Kategorien erstellen | ✓ Haken setzen |
   | Kategorien bearbeiten | kein Haken – braucht niemand |
   | Kategorien löschen | kein Haken – braucht niemand |
   | Daten in Kategorie sehen | Haken setzen, Auswahl „alle" |
   | Daten in Kategorie erstellen | Haken setzen, Auswahl „alle" |
   | Daten in Kategorie bearbeiten | Haken setzen, Auswahl „alle" |
   | Daten in Kategorie löschen | Haken setzen, Auswahl „alle" |

   „Infoscreen Designer" sehen und „Kategorien erstellen" haben keine Auswahl, nur den Haken.

4. **Speichern.**

Rechte einer Gruppe wirken nur, solange die Gruppe den Status **„aktiv"** hat.

## 3. Den Designer einmal öffnen

Oben im Menü von ChurchTools erscheint jetzt **„Infoscreen Designer"** (sonst die Seite einmal neu laden). Beim
ersten Öffnen legt der Designer seine Datenablage in ChurchTools an – dafür brauchte es das Recht „Kategorien
erstellen" aus Schritt 2. Niemand sonst braucht dieses Recht.

## 4. Gruppen und Rechte anlegen lassen

**Welche Kalender öffentlich sind.** Fernseher zeigen nur Kalender, die der öffentliche Benutzer sehen darf – also
auch ohne Anmeldung sichtbare. Das prüfst und änderst du in ChurchTools unter Berechtigungen → Benutzer →
„Öffentlicher Benutzer" → Kalender → „Einzelnen Kalender sehen". Das ist eine Entscheidung der Gemeinde und gilt auch
für die Website und den öffentlichen Kalender; der Designer ändert daran nichts.

Die Rechteverwaltung von ChurchTools ist fein, aber aufwendig. Deshalb erledigt der Designer den Rest selbst:

1. Im Designer oben auf **Einstellungen → Gruppen und Rechte**.
2. In der Karte **„Automatisch einrichten"** unter „Was genau passiert" nachlesen, was angelegt wird.
3. Den **Gruppentyp** wählen. Vorgewählt ist „Merkmal", wenn es ihn bei euch gibt. Gemeinden dürfen Gruppentypen
   umbenennen und löschen; fehlt „Merkmal", nimm einen Typ für Gruppen, die eine Funktion in der Gemeinde abbilden,
   etwa „Dienst". **Achte darauf, was der Typ mitbringt:** Rechte, die ein Gruppentyp seinen Rollen gibt, gelten in
   jeder Gruppe dieses Typs – Gestalter und Fernseher bekämen sie mit. Ein Typ, der wenig mitbringt, ist der richtige
   ([Academy: Gruppentypen](https://churchtools.academy/de/help/app/rund-ums-gruppenmodul/37-was-sind-gruppentypen-und-wofur-kann-ich-sie-benutzen/)).
4. **„Gruppen und Rechte anlegen"** klicken.

Der Assistent legt zwei **leere, aktive Gruppen vom gewählten Typ** an und gibt allen ihren Rollen die nötigen
Rechte:

- **„Infoscreen-Designer"** – das Modul sehen und seine Inhalte bearbeiten, dazu den Wiki-Bereich „Infoscreen", in
  dem die Bilder der Mediathek liegen. Fehlt er, legt ihn der Assistent an; gibt es schon einen Bereich dieses
  Namens, benutzt er ihn mit. Die Mediathek selbst legt keinen an – sie ist erst nach diesem Schritt nutzbar.
- **„Infoscreen-Devices"** – das Modul und seine Daten sehen, **jeden Raum, den ein Bildschirm zeigt**, und den
  Wiki-Bereich „Infoscreen" (nur sehen) – Videos laufen nur über die Download-Adresse ihrer Datei, und die verlangt
  dieses Recht. Öffentliche Kalender sieht das Gerät ohne eigenes Recht. Die Gestalter sehen dazu alle Räume, damit sie im Baustein „Raumbelegung" wählen können.

Der Assistent fasst **nur Gruppen an, die er selbst angelegt hat**, und ändert keine bestehenden Rollen. Gibt es
schon Gruppen mit diesen Namen, hält er an.

**Später wiederkommen:** Zeigt ein Bildschirm einen weiteren Kalender, muss der Kalender nur öffentlich sein – ein
„Rechte aktualisieren" braucht es dafür nicht. Zeigt ein Bildschirm neue Räume, klicke in **Einstellungen → Gruppen und
Rechte** auf **„Rechte aktualisieren"**. **Der Knopf nimmt auch zurück,** was kein Bildschirm mehr braucht: Kalender, Dienste und
Räume, die kein Bildschirm mehr zeigt, verlieren ihr Recht an den Gruppen des Assistenten. Vorher öffnet sich eine
**Vorschau** – je Gruppe, was dazukommt und was wegfällt. Erst „Übernehmen" schreibt; ohne Änderung meldet der Knopf nur, dass alles auf dem
Stand ist. Ein entzogenes Recht wirkt bei ChurchTools noch bis zu einer Dreiviertelstunde nach, weil ChurchTools Rechte
zwischenspeichert. Von Hand an diesen Gruppen ergänzte Rechte an Kalendern und Räumen nähme der Knopf ebenfalls zurück
([Rechte](Rechte.md#was-rechte-aktualisieren-zurücknimmt)). **Nur öffentliche Kalender:** Der Fernseher zeigt nur
öffentliche Kalender – und von diesen keine internen Termine. „Automatische Einrichtung rückgängig machen" löscht die
beiden Gruppen wieder – **nur die, die der Assistent selbst angelegt hat**. Vorhandene Gruppen, die du gewählt hast,
bleiben, ebenso der Wiki-Bereich mit den Bildern. Ob der Bereich vom Designer angelegt wurde oder schon da war, steht
unter **Einstellungen → Mediathek im Wiki**.

Der Assistent legt den Wiki-Bereich nur an, wenn du das Wiki sehen darfst; ohne dieses Recht bricht er ab, bevor er etwas anlegt. Einen fremden Bereich gleichen Namens, den du nicht sehen darfst, kann er nicht erkennen.

**Bildschirme legst du als Administrator an:** auf der Startseite des Designers **„+ Bildschirm erstellen"** – Name, Adresse
und Format. Den Namen änderst du später über das Menü **„…" der Kachel → „Umbenennen"**, den Overscan über **„…" →
„Einstellungen"**; was der Bildschirm zeigt, gestalten die Gestalter.

*Eigene Gruppen statt der automatischen?* Weiter unten auf **Einstellungen → Gruppen und Rechte** lassen sich
vorhandene Gruppen für Gestalter und Geräte wählen; die Seite prüft dann, was ihnen fehlt, und ändert selbst nichts.

## 5. Gestalter aufnehmen

Wer Infoscreens gestalten soll, wird **Mitglied der Gruppe „Infoscreen-Designer"** – die Rolle ist egal, alle Rollen
haben dieselben Rechte. Dazu gehört das Bearbeiten des Wiki-Bereichs „Infoscreen" – wer dort Mitglied ist, kann im
Wiki Bilder löschen, auch an der Warnung der Mediathek vorbei. Vergib die Mitgliedschaft deshalb bewusst. Möchtest du selbst gestalten, nimm dich auch auf; die Rechte aus Schritt 2 kannst du dann
behalten (für die Einstellungen) oder auf „sehen" zurücknehmen.

Gestalter sehen die Einstellungen nicht. Fehlt ihnen ein Recht, sagt die Startseite des Designers, welches.

## 6. Geräte-Benutzer anlegen

Der Fernseher meldet sich mit einem **eigenen ChurchTools-Konto** an, das nur lesen darf – bis auf sein Lebenszeichen. Empfehlung: **ein Konto je
Standort** („Infoscreen Foyer", „Infoscreen Café") – dann lässt sich ein einzelnes Gerät sperren (siehe
[Notbremse](#wenn-ein-gerät-verloren-geht--die-notbremse)).

1. **Person anlegen**, etwa „Infoscreen Foyer" – **eine eigene Person je Standort, kein echtes Personenkonto**
   (nicht das einer Mitarbeiterin oder eines Ehrenamtlichen). Eine E-Mail-Adresse ist nicht nötig.
2. **Benutzername und Passwort in der ChurchTools-Oberfläche setzen.** Wichtig: **Ein Passwort allein reicht
   nicht.** Ohne Benutzernamen scheitert jede Anmeldung mit „Überprüfe Benutzername und Passwort" – egal, welches
   Passwort gesetzt ist. Der Fehler wird dann meist am Passwort gesucht, wo er nicht liegt.
3. **Personenstatus mit möglichst wenig Rechten wählen.** Rechte in ChurchTools addieren sich: Was der Status
   erlaubt, darf das Gerät zusätzlich zu seiner Gruppe. Ein Status für Mitarbeiter mit weitreichenden Rechten
   gehört nicht auf ein Gerät im Foyer.
4. **In die Gruppe „Infoscreen-Devices" aufnehmen – und in keine weitere.** Rechte addieren sich: Was eine andere
   Gruppe erlaubt, darf auch der Fernseher, und mit ihm jeder, der seine Adresse kennt. Rechte aus anderen Gruppen
   sieht die Prüfung nicht; sie nennt seit Version 0.7.3 nur die Gruppen.

Einrichtung prüfen: Unter **Einstellungen → Gruppen und Rechte** die Gruppe „Infoscreen-Devices" wählen – die
Prüfung zeigt je Kalender der Bildschirme, ob er öffentlich ist – auch ohne Geräte-Benutzer –, warnt vor nicht öffentlichen Kalendern in Bildschirmen und vor Konten, die einen internen Kalender lesen dürfen, und nennt jedes Recht des Kontos, das ein Gerät
nicht braucht. Steht dort eine Warnung, dem Konto einen Personenstatus ohne diese Rechte geben: Wer die Adresse des
Fernsehers kennt, hat sie sonst auch. Ist das Konto noch in weiteren Gruppen, nennt die Prüfung sie mit Namen.

## 7. Den Fernseher einrichten

### Die Adresse erzeugen

Der Fernseher bekommt eine Adresse, mit der er sich **bei jedem Start selbst** als Geräte-Benutzer anmeldet. Eine
Anmeldung von Hand im Browser genügt nicht: Auch mit „Angemeldet bleiben" meldet ChurchTools nach 24 Stunden ab.

1. Im Designer auf **Einstellungen → Adressen für die Fernseher**.
2. Den **Bildschirm** wählen, **Benutzername und Passwort des Geräte-Kontos** eingeben, **„Adresse erzeugen"**.
3. **Kopieren** und als **Startseite des Kiosk-Browsers** eintragen. Anmelden musst du dich im Browser nicht.

Das Passwort wird nirgends gespeichert; es dient nur dazu, bei ChurchTools den **Login-Token** des Geräte-Kontos
abzuholen, der in der Adresse steht. **Die Adresse ist deshalb ein Schlüssel:** Wer sie hat, sieht ChurchTools mit
den Rechten des Geräte-Kontos – nur lesend bis auf sein Lebenszeichen, aber ohne Passwort. Gib sie nicht per E-Mail oder Chat weiter, sondern
trag sie direkt am Gerät ein. Ungültig wird sie, sobald das Passwort des Geräte-Kontos geändert wird. Die Adresse
bleibt auch in der Adresszeile des Browsers stehen – nicht fotografieren oder abfilmen, wenn sie zu sehen ist.

**Ein Browser, ein Konto.** ChurchTools kennt je Browser nur eine Anmeldung. Wer im selben Browser selbst in
ChurchTools angemeldet ist, meldet den Player ab und der Player ihn. Am Schreibtisch deshalb den Player in einem
**Inkognito-Fenster** oder einem **eigenen Browserprofil** öffnen, nicht in einem Tab neben ChurchTools.

**Nur zum Ausprobieren** geht es auch ohne: im Browser mit dem Geräte-Benutzer anmelden und im Designer über „…" →
„Player öffnen" den Bildschirm aufrufen – in einem eigenen Browser oder Profil, siehe oben. Das hält einen Tag.

Fehlt die Anmeldung, zeigt der Fernseher: *„Dieser Fernseher ist nicht bei ChurchTools angemeldet. Seine Adresse
erzeugt ein Administrator …"*.

### Einstellungen des Kiosk-Browsers

| Einstellung | Warum |
| --- | --- |
| **Dauerhaftes Browserprofil** – Cookies und Websitedaten beim Beenden nicht löschen | Daten und Bilder bleiben auf dem Gerät und helfen über Netzausfälle |
| **Beim Start die Adresse des Bildschirms öffnen**, im Vollbild | der Fernseher läuft nach einem Stromausfall von selbst wieder an |
| **Bildschirmschoner, Energiesparen und Abschalten des Bildschirms aus** | sonst wird das Foyer schwarz |
| **Neu laden, wenn die Seite nicht lädt** – falls der Kiosk-Browser das kann | startet das Gerät, während das Netz weg ist, kann die Seite sich nicht selbst helfen |
| **Auflösung 1920 × 1080** (hochkant 1080 × 1920) | darauf ist die Bildfläche ausgelegt; andere Seitenverhältnisse bekommen schwarze Ränder |

Auf einem Raspberry Pi eignet sich **FullPageOS**: Dort steht die Startadresse in der Datei `fullpageos.txt` auf
der Boot-Partition.

**Ton bei Videos:** Kiosk-Browser lassen Ton ohne Klick oft erst zu, wenn man es ihnen erlaubt – bei Chromium mit der
Startoption `--autoplay-policy=no-user-gesture-required`. Ohne sie läuft ein Video mit eingeschaltetem Ton stumm.

**Schneidet der Fernseher den Rand ab** (Overscan), stelle an der Kachel des Bildschirms unter „…" → „Einstellungen" die **Overscan-Korrektur** ein –
die Bildfläche rückt dann um so viel Prozent nach innen.

### Was der Fernseher von selbst tut

- Er sieht **alle 20 Sekunden** mit einer kleinen Anfrage nach, ob ein Gestalter gespeichert hat, und lädt dann
  den Bildschirm neu; alles andere am Bildschirm holt er **alle zwei Minuten**, **Termine alle zehn Minuten** – ein Gestalter
  muss nichts anstoßen.
- Er **hält den letzten Stand und die Bilder auf dem Gerät.** Fällt das Netz aus, zeigt er weiter, was er hatte.
- **Auch ein Neustart ohne Netz zeigt den letzten Stand** statt der Fehlerseite des Browsers – etwa nach einem
  Stromausfall, der auch den Router getroffen hat. Dafür legt der Player die Seite nach dem ersten erfolgreichen
  Anzeigen auf dem Gerät ab (ein sogenannter Service Worker). Voraussetzung: Er war seit der Installation mindestens
  einmal mit Netz gelaufen.
- Er **lädt jede Nacht zwischen 3 und 4 Uhr neu** und nach **30 Minuten ununterbrochener Fehler** – auch ohne Netz,
  sobald er die Seite auf dem Gerät hat. Dabei meldet er sich jedes Mal frisch an; läuft die Anmeldung zwischendurch
  ab, erneuert er sie selbst.
- Er **meldet sich alle fünf Minuten** – ein Lebenszeichen, das ChurchTools in der Kategorie „Status" ablegt. Auf der
  Startseite des Designers zeigt jede Kachel daraus „online", „nicht online seit …" oder „noch nie abgerufen"
  („online" heißt: Der Browser des Geräts läuft und erreicht ChurchTools, höchstens 15 Minuten her). Das tut nur ein
  Fernseher mit der Adresse aus Schritt 7; wer den Player über „Player öffnen" im eigenen Browser ansieht, meldet nichts.
  Fehlt dem Gerät das Recht dafür, läuft die Anzeige unverändert weiter, und die Kachel steht auf „noch nie abgerufen".
  Sieht jemand die Kategorie „Status" nicht, fehlt die Zeile auf der Kachel.

## Updates

1. Das neue ZIP von der [Release-Seite](https://github.com/wirsindcgks/churchtools-infoscreen/releases)
   herunterladen.
2. In der Extension-Verwaltung bei „Infoscreen Designer" auf **Bearbeiten** und das ZIP hochladen. Eine
   automatische Aktualisierung aus GitHub bietet ChurchTools nicht an.
3. Welche Fassung installiert ist, steht unten auf der Übersicht **Einstellungen** des Designers.

Die Fernseher übernehmen die neue Fassung **spätestens beim nächtlichen Neuladen**. Bildschirme und Bilder bleiben
erhalten.

**Nach einem Update einmal „Rechte aktualisieren"** (Designer → Einstellungen → Gruppen und Rechte). Neue
Fassungen können die Rechte der beiden Gruppen ändern – etwa seit Version 0.1: Gestalter gestalten Inhalte, die
Bildschirme selbst legt und stellt ein Administrator ein; ältere Gruppen verlieren dabei ihr Schreibrecht auf Bildschirmen.

**Seit Version 0.17.0 (Lebenszeichen der Bildschirme):** Ein Administrator mit dem Recht „Kategorien erstellen"
([Schritt 2](#2-dir-selbst-die-modulrechte-geben)) öffnet einmal die **Startseite** des Designers – sie legt die Kategorie
„Status" an – und klickt danach in den Einstellungen auf **„Rechte aktualisieren"**; der Dialog
zeigt die neuen Rechte der Geräte unter „Kommt dazu". Am Gerät ist nichts zu tun: Der Fernseher holt den neuen Player beim
nächsten nächtlichen Neuladen und meldet sich danach selbst.

## Den Designer wieder entfernen

Die Reihenfolge ist wichtig: **erst die Einrichtung, dann die Extension.**

1. **Einstellungen → Gruppen und Rechte → „Automatische Einrichtung rückgängig machen".** Das löscht die beiden Gruppen, die der
   Assistent angelegt hat, samt ihrer Rechte. Gruppen, die du selbst gewählt hast, bleiben. Diesen Schritt zuerst:
   Mit der Extension verschwinden auch die Einstellungen, und danach weiß der Designer nicht mehr, welche Gruppen
   von ihm stammen. Zur Sicherheit fragt ein Dialog nach, zeigt, was verschwindet, und verlangt das Wort **„entfernen"**.
   **Du brauchst dafür die Modulrechte aus [Schritt 2](#2-dir-selbst-die-modulrechte-geben)**, sonst kann der
   Designer nicht speichern, dass die Gruppen weg sind, und löscht deshalb gar nicht erst. **Bist du selbst in
   „Infoscreen-Designer"** und hast die Rechte nur darüber, kommst du danach nicht mehr in den Designer – der
   Dialog warnt davor.
2. **Extension-Verwaltung → „Infoscreen Designer" → Löschen.** ChurchTools zeigt vorher, was mitgelöscht wird,
   und entfernt dann alle Bildschirme, Präsentationen, Folien und Einstellungen, die Rechte am Modul – auch die aus
   Schritt 2 an eurer Administratoren-Gruppe – und das hochgeladene ZIP.
3. **Was bleibt, entscheidest du selbst:** der Wiki-Bereich „Infoscreen" mit den Bildern (im Wiki löschen oder
   behalten) und der Geräte-Benutzer (in der Personenverwaltung archivieren oder löschen). Beides gehört nicht
   dem Designer; er löscht es nie. Den Wiki-Bereich zeigt „Automatische Einrichtung rückgängig machen" wieder im Wiki unter
   „Kategorien" an, damit du die Bilder dort sichern kannst. Hineinsehen kann nur, wer Rechte am Bereich hat –
   die Gestalter nicht mehr, ihre Rechte gingen mit der Gruppe.

4. **Die Passwörter der Gerätekonten ändern – empfohlen** (oder die Konten löschen). Die Adressen der Fernseher
   enthalten den Login-Token dieser Konten; solange er gilt, meldet sich jeder damit bei ChurchTools an – auch
   ohne Designer. Ungültig wird er nur durch ein neues Passwort oder das Löschen der Person; von außen widerrufen
   lässt er sich nicht. Welche Konten das sind, nennt der Dialog von „Automatische Einrichtung rückgängig machen" mit Link zur Person
   und danach das Protokoll – nach dem Entfernen gibt es die Gruppe „Infoscreen-Devices" nicht mehr, die es
   verraten hätte.

### Was beim Abbau passiert – auf einen Blick

| Was | „Automatische Einrichtung rückgängig machen" | Extension löschen | Danach |
| --- | --- | --- | --- |
| Gruppen „Infoscreen-Designer" und „Infoscreen-Devices", **wenn der Assistent sie angelegt hat** – samt Rollen, Rechten und Mitgliedschaften | **gelöscht** | – | weg |
| Gruppen, die du **selbst gewählt** hast | unberührt | Rechte am Modul werden entfernt | bleiben, mit allen anderen Rechten (etwa an Kalendern oder am Wiki-Bereich) |
| Bildschirme, Präsentationen, Folien, Hinweise, Design, Einstellungen | bleiben | **gelöscht** | weg; eine Neuinstallation beginnt leer |
| Rechte am Modul an allen Rollen, auch an eurer Administratoren-Gruppe (Schritt 2) | bleiben | **entfernt** | weg |
| Das hochgeladene ZIP | bleibt | **gelöscht** | weg |
| Wiki-Bereich „Infoscreen" mit den Bildern | **bleibt** und steht wieder unter „Kategorien" | bleibt | **von Hand**: sichern, dann im Wiki löschen oder behalten |
| Adressen der Bilder | bleiben erreichbar | bleiben erreichbar | erreichbar, bis das Bild im Wiki gelöscht ist – ohne Anmeldung, wer die Adresse kennt |
| Geräte-Benutzer (Person) | bleibt, ohne die Rechte aus „Infoscreen-Devices" | bleibt | **von Hand**: archivieren oder löschen |
| Login-Token in den Adressen der Fernseher | bleibt gültig | bleibt gültig | **von Hand, empfohlen**: Passwörter der Gerätekonten ändern oder die Konten löschen |
| Fernseher | zeigen keine neuen Inhalte mehr | Der Designer ist nicht mehr erreichbar | Kiosk-Browser umstellen oder ausschalten; Bilder und letzter Stand liegen noch im Speicher des Browsers |

Was ChurchTools beim Löschen der Extension abräumt, ist am 2026-09-28 gemessen (`Befunde.md`, G38). Eine Warnung
beim Löschen selbst kann der Designer nicht zeigen: Das Löschen geschieht in der Extension-Verwaltung von
ChurchTools, und eine Extension erfährt davon nichts. Deshalb zeigt der Dialog von „Automatische Einrichtung rückgängig machen" diese
Übersicht schon vorher.

**Löschen und neu hochladen ist kein Update.** Eine neu installierte Extension beginnt leer – alle Bildschirme sind
weg. Für eine neue Fassung siehe [Updates](#updates).

## Wenn ein Gerät verloren geht – die Notbremse

1. **Den Geräte-Benutzer aus der Gruppe „Infoscreen-Devices" nehmen.** Damit verliert das Konto alle Rechte, die
   es über diese Gruppe hatte – am Designer und an den Kalendern. Was sein Personenstatus erlaubt, bleibt (deshalb
   in Schritt 6 ein Status mit wenig Rechten).
2. **Sein Passwort in der ChurchTools-Oberfläche ändern.** Damit wird der Login-Token ungültig – die Adresse auf
   dem verlorenen Gerät meldet sich nicht mehr an.
3. Für das Ersatzgerät unter **Einstellungen → Adressen für die Fernseher** eine **neue Adresse erzeugen** (mit dem neuen Passwort). Hängen weitere
   Fernseher am selben Konto, brauchen sie ebenfalls eine neue Adresse – ein Grund für ein Konto je Standort.

Mehr als lesen konnte das Gerät ohnehin nie – wer es findet, sieht, was im Foyer ohnehin zu sehen ist.

## Was öffentlich ist – Datenschutz

- **Alles auf einem Bildschirm sieht jeder, der vorbeigeht.** Personenbezogenes – Geburtstage, Kontaktdaten – gehört
  nicht auf einen Infoscreen.
- **Dienste mit Namen erscheinen nur nach Freigabe.** Wer an einem Termin welchen Dienst übernimmt, zeigt ein
  Baustein nur für Dienste, die ein Administrator unter **Einstellungen → Dienste auf Bildschirmen** freigegeben hat –
  etwa nur „Predigt". Ohne Freigabe erscheint kein Dienst. Zur Wahl stehen ohnehin nur Dienste, deren Dienstgruppe
  in ChurchTools „Ohne Berechtigung einsehbar" ist und die Namen nicht verbergen; gezeigt werden Vor- und Nachname
  zugesagter Einteilungen, nichts sonst von einer Person. **Stimmt die Freigabe vorher mit der Gemeindeleitung
  ab** – die Seite und die Rückfrage beim Ankreuzen erinnern daran.
- **Buchungstitel der Raumbelegung lassen sich je Raum abschalten.** Ein Titel wie „Gespräch Familie X" verrät
  mehr, als ein Türschild soll; ohne Titel steht dort „Belegt".
- **Die Bilder der Mediathek und das Gemeindelogo sind über ihre Adresse ohne Anmeldung abrufbar.** So liefert
  ChurchTools Bilder aus; die Adressen sind lang und nicht zu erraten, aber wer eine kennt, kann das Bild ansehen.
  Lade nichts hoch, was nicht öffentlich sein darf.
- **Gruppen und Beiträge zeigt der Designer nur, soweit ChurchTools sie ohnehin öffentlich zeigt.** Der Baustein
  „Gruppen" liest eine **Gruppen-Homepage** ohne Anmeldung – genau das, was jeder Besucher sieht –, nie die
  Gruppenliste, in der das Konto des Fernsehers auch interne Gruppen sähe. Die **Leitung** (Vor- und Nachname) und
  ihr **Bild** zeigt er nur, wenn ein Gestalter es einschaltet und die Homepage die Leiter ohnehin zeigt; nichts
  sonst von einer Person. Den Namen der Autorin oder des Autors eines Beitrags zeigt der Baustein „Beiträge" nur,
  wenn man es einschaltet.
- **Schriften kommen von eurer eigenen Instanz**, nicht von einem Schriftendienst – kein Aufruf verrät Gerät oder
  Gestalter an Dritte.
- **Eine eingebettete Webseite ist ein Aufruf bei Dritten.** Der Baustein „Webseite" lädt die fremde Seite auf dem
  Fernseher und im Editor: Ihr Betreiber erfährt die Internetadresse des Geräts und des Gestalters und kann Cookies
  setzen. Der Designer selbst gibt nichts weiter – auch nicht, von welcher Seite der Aufruf kommt. Bettet nur ein,
  was ihr auch auf eurer Website einbetten würdet. Seiten des eigenen ChurchTools nimmt der Baustein nicht an.
- **Der Designer merkt sich, wer zuletzt gespeichert hat.** Der Name steht an Bildschirmen, Präsentationen und Zeitplänen,
  damit Gestalter einander nicht überschreiben. Lesen können ihn die Gestalter, die Administratoren und die
  Gerätekonten.
- **Der Fernseher behält den letzten Stand.** Damit er einen Netzausfall übersteht, liegen Bilder und Inhalte im
  Browserprofil des Geräts – auch Namen, die ein Bildschirm zeigt (Leitung, Dienste, Autorinnen und Autoren). Wer ein
  Gerät weggibt, löscht vorher das Browserprofil.
- **Die Bilder liegen im Wiki-Bereich „Infoscreen".** Wer dort ein Bild löscht, löscht es auch auf den Bildschirmen –
  der Fernseher zeigt dann einen Platzhalter. Bilder am besten nur in der **Mediathek** des Designers verwalten
  (Seitenleiste): Sie warnt vor dem Löschen, wenn ein Bild noch gezeigt wird.
  Im Wiki steht der Bereich unter **„Ausgeblendet"** aus dem Blick (bei älteren Installationen: Einstellungen →
  Mediathek im Wiki); erreichbar bleibt er dort trotzdem.
- **Das Bearbeitungsrecht am Wiki-Bereich „Infoscreen" nur eng vergeben.** Wer es hat, kann im Wiki Bilder löschen –
  an der Warnung der Mediathek vorbei –, und auf den Fernsehern fehlen sie dann. Jedes Mitglied von
  „Infoscreen-Designer" hat dieses Recht; deshalb auch die Mitgliedschaft dort bewusst vergeben.

## Wenn etwas nicht klappt

| Was du siehst | Woran es liegt | Was hilft |
| --- | --- | --- |
| Kein Menüpunkt „Infoscreen Designer", auch nicht als Administrator | Modulrecht „sehen" fehlt | Schritt 2; Gruppe muss „aktiv" sein |
| Menüpunkt öffnet eine weiße Seite; die Browser-Konsole meldet `404` für `…/ccm/infoscreen-designer/assets/app-….js` | Das Kürzel der Extension ist nicht `infoscreen-designer` (die Adresse in der Adresszeile zeigt das tatsächliche) | Schritt 1: Extension mit dem Kürzel `infoscreen-designer` anlegen. Vor der Einrichtung geht beim Löschen der falsch benannten nichts verloren |
| Startseite des Designers: „Dir fehlen Rechte …" | Person ist nicht (aktiv) in „Infoscreen-Designer" | Schritt 5; die Liste nennt das fehlende Recht |
| Kein „Einstellungen" in der Kopfzeile des Designers | Du bist kein Administrator | Einstellungen sind Administratoren vorbehalten |
| Kein „+ Bildschirm erstellen", kein „Umbenennen" und kein „Einstellungen" im Menü der Kachel | Dir fehlt das Recht, Bildschirme anzulegen, zu bearbeiten und zu löschen – auch Administratoren brauchen es | Schritt 2: die drei „Daten in Kategorie …"-Rechte für alle Kategorien |
| Assistent bricht ab: „Den Gruppentyp „Merkmal" gibt es auf dieser Instanz nicht." | Version vor `v0.14.0` auf einer Instanz ohne diesen Gruppentyp | aktuelle Version installieren und in Schritt 4 einen Gruppentyp wählen |
| „Gruppen und Rechte anlegen" bleibt grau, ohne Hinweis auf fehlende Rechte | Kein Gruppentyp gewählt | in Schritt 4 einen Gruppentyp wählen |
| „Adresse erzeugen" meldet „Anmeldung fehlgeschlagen" | meist fehlt dem Geräte-Konto der **Benutzername** | Schritt 6, Punkt 2 |
| Fernseher: „Dieser Fernseher ist nicht bei ChurchTools angemeldet" | Adresse ohne Anmeldung, oder das Passwort des Geräte-Kontos wurde geändert | unter Einstellungen → Adressen für die Fernseher eine neue Adresse erzeugen |
| Player im Tab neben ChurchTools: fragt nach Anmeldung oder zeigt keine Termine | Im selben Browser ist jemand anderes angemeldet – ChurchTools kennt je Browser nur eine Anmeldung | Player in einem Inkognito-Fenster oder eigenen Browserprofil öffnen |
| Fernseher: „Es gibt keinen Bildschirm „…"" | Adresse vertippt oder Bildschirm gelöscht | Adresse neu kopieren |
| Fernseher: Termine eines Kalenders fehlen | Der Kalender ist nicht öffentlich (dann zeigt ihn kein Fernseher) | in ChurchTools freigeben: Berechtigungen → Benutzer → „Öffentlicher Benutzer" → Kalender → „Einzelnen Kalender sehen" – oder im Editor aus dem Baustein entfernen |
| Fernseher: Ein Raum fehlt in der Raumbelegung | Gerät darf den Raum nicht sehen | Einstellungen → Gruppen und Rechte → „Rechte aktualisieren" |
| Fernseher: Bild fehlt, Platzhalter statt Bild | Bild im Wiki gelöscht | im Designer ein neues Bild wählen |
| Baustein „Gruppen": „Noch keine Gruppen-Homepage" | In ChurchTools gibt es keine Gruppen-Homepage | an der Obergruppe: Einstellungen → Allgemein → Außendarstellung → „Gruppenhomepage erstellen" |
| Baustein „Gruppen": eine Gruppe fehlt | Ihre öffentliche Seite ist aus, oder sie ist keine Untergruppe der Obergruppe | in ChurchTools an der Gruppe die öffentliche Seite einschalten |
| Baustein „Gruppen": keine Leitung, obwohl eingeschaltet | Die Gruppen-Homepage zeigt die Leiter nicht – oder die Karte ist zu voll | an der Homepage „Leiter anzeigen" einschalten; sonst weniger Gruppen je Seite oder eine kleinere Schrift |
| Mediathek: „Den Wiki-Bereich „Infoscreen" gibt es noch nicht" | Die Einrichtung ist noch nicht gelaufen – oder dir fehlt das Recht, den Bereich zu sehen | Schritt 4; sonst die Rechte am Wiki-Bereich prüfen |
