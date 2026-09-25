# Infoscreen Designer einrichten

Diese Anleitung führt dich als **ChurchTools-Administrator** durch die Einrichtung: von der Installation über die
Rechte bis zum Fernseher im Foyer. Rechne mit etwa einer halben Stunde, den Fernseher nicht mitgezählt.

> **Kein Produkt der ChurchTools Innovation GmbH.** Der Infoscreen Designer ist eine unabhängige Entwicklung von
> Anwendern. Fragen gehören in den [Issue-Tracker](https://github.com/wirsindcgks/churchtools-infoscreen/issues),
> nicht an den ChurchTools-Support.

## Auf einen Blick

| Schritt | Wer | Wo |
| --- | --- | --- |
| [1. Extension installieren](#1-extension-installieren) | Administrator | Extension-Verwaltung von ChurchTools |
| [2. Dir selbst die Modulrechte geben](#2-dir-selbst-die-modulrechte-geben) | Administrator | Rechteverwaltung |
| [3. Den Designer einmal öffnen](#3-den-designer-einmal-öffnen) | Administrator | Menü „Infoscreen Designer" |
| [4. Gruppen und Rechte anlegen lassen](#4-gruppen-und-rechte-anlegen-lassen) | Administrator | Designer → Einstellungen |
| [5. Gestalter aufnehmen](#5-gestalter-aufnehmen) | Administrator | Gruppe „Infoscreen-Designer" |
| [6. Geräte-Benutzer anlegen](#6-geräte-benutzer-anlegen) | Administrator | Personen, Gruppe „Infoscreen-Devices" |
| [7. Den Fernseher einrichten](#7-den-fernseher-einrichten) | Administrator, dann wer vor Ort ist | Designer → Einstellungen, Kiosk-Browser |

### Drei Rollen

| Rolle | Wer | Darf |
| --- | --- | --- |
| **Administrator** | wer in ChurchTools Berechtigungen verwalten darf | installieren, die **Einstellungen** des Designers öffnen, Gruppen und Rechte anlegen |
| **Gestalter** | Mitglieder der Gruppe „Infoscreen-Designer" | Screens, Slides und Bilder anlegen, ändern und löschen – nicht die Einstellungen |
| **Gerät** | Mitglieder der Gruppe „Infoscreen-Devices" | nur lesen: die Screens und die Kalender, die sie zeigen |

### Voraussetzungen

- **Extensions (Custom Modules) müssen für deine Instanz freigeschaltet sein.** Das ist nicht überall der Fall; ob
  es bei euch geht, siehst du daran, dass es die Extension-Verwaltung gibt (Schritt 1). Sonst bei ChurchTools
  anfragen.
- **Ein Administrator-Konto**, das Berechtigungen verwalten darf.
- **Pro Fernseher ein Gerät mit Browser**, das im Vollbild dauerhaft eine Webseite zeigt – etwa ein Raspberry Pi,
  ein Mini-PC oder ein Smart-TV mit Kiosk-Browser. Näheres in Schritt 7.

---

## 1. Extension installieren

1. Lade das neueste Paket `churchtools-infoscreen-vX.Y.Z.zip` von der
   [Release-Seite](https://github.com/wirsindcgks/churchtools-infoscreen/releases) herunter. **Nicht entpacken.**
2. Öffne in ChurchTools die Extension-Verwaltung: `https://<eure-instanz>.church.tools/custom/modules/overview`.
3. Lade dort das ZIP hoch. Fragt ChurchTools nach einem Kurzbezeichner, trage **exakt** `infoscreen-designer` ein –
   sonst stimmen die Adressen nicht.

Danach ist die Extension installiert, **aber noch für niemanden sichtbar – auch nicht für dich.** Das ist kein
Fehler, sondern die Rechteverwaltung von ChurchTools: Administratorrechte schließen die Rechte an einer Extension
nicht ein.

## 2. Dir selbst die Modulrechte geben

Einmalig, damit du den Designer öffnen und einrichten kannst. Am besten über die Rolle einer Gruppe, in der die
Administratoren ohnehin sind – so bleibt es nachvollziehbar
([Academy: Wie vergebe ich eine globale Berechtigung?](https://churchtools.academy/de/help/rechteverwaltung/berechtigungen-vergeben/wie-vergebe-ich-eine-globale-berechtigung/)):

1. **Rechteverwaltung** öffnen, Reiter **Gruppen**, eure Administratoren-Gruppe anklicken.
2. Unter der Rolle, in der du Mitglied bist, auf **Bearbeiten** klicken.
3. Im Berechtigungsbaum **„Infoscreen Designer"** aufklappen und diese Haken setzen:

   | Berechtigung | Auswahl |
   | --- | --- |
   | „Infoscreen Designer" sehen | – |
   | Kategorien sehen | alle |
   | Kategorien erstellen | – |
   | Daten in Kategorie sehen | alle |
   | Daten in Kategorie erstellen | alle |
   | Daten in Kategorie bearbeiten | alle |
   | Daten in Kategorie löschen | alle |

4. **Speichern.**

Rechte einer Gruppe wirken nur, solange die Gruppe den Status **„aktiv"** hat.

## 3. Den Designer einmal öffnen

Oben im Menü von ChurchTools erscheint jetzt **„Infoscreen Designer"** (sonst die Seite einmal neu laden). Beim
ersten Öffnen legt der Designer seine Datenablage in ChurchTools an – dafür brauchte es das Recht „Kategorien
erstellen" aus Schritt 2. Niemand sonst braucht dieses Recht.

## 4. Gruppen und Rechte anlegen lassen

Die Rechteverwaltung von ChurchTools ist fein, aber aufwendig. Deshalb erledigt der Designer den Rest selbst:

1. Im Designer oben auf **Einstellungen**.
2. In der Karte **„Automatisch einrichten"** unter „Was genau passiert" nachlesen, was angelegt wird.
3. **„Gruppen und Rechte anlegen"** klicken.

Der Assistent legt zwei **leere, aktive Gruppen vom Typ „Merkmal"** an und gibt allen ihren Rollen die nötigen
Rechte:

- **„Infoscreen-Designer"** – das Modul sehen und seine Inhalte bearbeiten, dazu den Wiki-Bereich „Infoscreen", in
  dem die Bilder der Mediathek liegen (er wird bei Bedarf angelegt).
- **„Infoscreen-Devices"** – das Modul und seine Daten sehen und **jeden Kalender, den ein Screen zeigt**.

Der Assistent fasst **nur Gruppen an, die er selbst angelegt hat**, und ändert keine bestehenden Rollen. Gibt es
schon Gruppen mit diesen Namen, hält er an.

**Später wiederkommen:** Zeigt ein Screen einen weiteren Kalender, klicke in den Einstellungen auf **„Rechte
aktualisieren"** – sonst fehlen dessen Termine auf dem Fernseher. „Einrichtung entfernen" löscht die beiden Gruppen
wieder.

*Eigene Gruppen statt der automatischen?* Weiter unten in den Einstellungen lassen sich vorhandene Gruppen für
Gestalter und Geräte wählen; die Seite prüft dann, was ihnen fehlt, und ändert selbst nichts.

## 5. Gestalter aufnehmen

Wer Infoscreens gestalten soll, wird **Mitglied der Gruppe „Infoscreen-Designer"** – die Rolle ist egal, alle Rollen
haben dieselben Rechte. Möchtest du selbst gestalten, nimm dich auch auf; die Rechte aus Schritt 2 kannst du dann
behalten (für die Einstellungen) oder auf „sehen" zurücknehmen.

Gestalter sehen die Einstellungen nicht. Fehlt ihnen ein Recht, sagt die Startseite des Designers, welches.

## 6. Geräte-Benutzer anlegen

Der Fernseher meldet sich mit einem **eigenen ChurchTools-Konto** an, das nur lesen darf. Empfehlung: **ein Konto je
Standort** („Infoscreen Foyer", „Infoscreen Café") – dann lässt sich ein einzelnes Gerät sperren (siehe
[Notbremse](#wenn-ein-gerät-verloren-geht--die-notbremse)).

1. **Person anlegen**, etwa „Infoscreen Foyer". Eine E-Mail-Adresse ist nicht nötig.
2. **Benutzername und Passwort in der ChurchTools-Oberfläche setzen.** Wichtig: **Ein Passwort allein reicht
   nicht.** Ohne Benutzernamen scheitert jede Anmeldung mit „Überprüfe Benutzername und Passwort" – egal, welches
   Passwort gesetzt ist. Der Fehler wird dann meist am Passwort gesucht, wo er nicht liegt.
3. **Personenstatus mit möglichst wenig Rechten wählen.** Rechte in ChurchTools addieren sich: Was der Status
   erlaubt, darf das Gerät zusätzlich zu seiner Gruppe. Ein Status für Mitarbeiter mit weitreichenden Rechten
   gehört nicht auf ein Gerät im Foyer.
4. **In die Gruppe „Infoscreen-Devices" aufnehmen.**

Einrichtung prüfen: In den Einstellungen des Designers die Gruppe „Infoscreen-Devices" wählen – die Prüfung zeigt je
Mitglied, ob die Kalender der Screens lesbar sind.

## 7. Den Fernseher einrichten

### Die Adresse erzeugen

Der Fernseher bekommt eine Adresse, mit der er sich **bei jedem Start selbst** als Geräte-Benutzer anmeldet. Eine
Anmeldung von Hand im Browser genügt nicht: Auch mit „Angemeldet bleiben" meldet ChurchTools nach 24 Stunden ab.

1. Im Designer auf **Einstellungen**, Karte **„Adresse für einen Fernseher"**.
2. Den **Screen** wählen, **Benutzername und Passwort des Geräte-Kontos** eingeben, **„Adresse erzeugen"**.
3. **Kopieren** und als **Startseite des Kiosk-Browsers** eintragen. Anmelden musst du dich im Browser nicht.

Das Passwort wird nirgends gespeichert; es dient nur dazu, bei ChurchTools den **Login-Token** des Geräte-Kontos
abzuholen, der in der Adresse steht. **Die Adresse ist deshalb ein Schlüssel:** Wer sie hat, sieht ChurchTools mit
den Rechten des Geräte-Kontos – nur lesend, aber ohne Passwort. Gib sie nicht per E-Mail oder Chat weiter, sondern
trag sie direkt am Gerät ein. Ungültig wird sie, sobald das Passwort des Geräte-Kontos geändert wird.

**Nur zum Ausprobieren** geht es auch ohne: im Browser mit dem Geräte-Benutzer anmelden und im Designer über „…" →
„Player öffnen" den Screen aufrufen. Das hält einen Tag.

Fehlt die Anmeldung, zeigt der Fernseher: *„Dieser Fernseher ist nicht bei ChurchTools angemeldet. Seine Adresse
erzeugt ein Administrator …"*.

### Einstellungen des Kiosk-Browsers

| Einstellung | Warum |
| --- | --- |
| **Dauerhaftes Browserprofil** – Cookies und Websitedaten beim Beenden nicht löschen | Daten und Bilder bleiben auf dem Gerät und helfen über Netzausfälle |
| **Beim Start die Adresse des Screens öffnen**, im Vollbild | der Fernseher läuft nach einem Stromausfall von selbst wieder an |
| **Bildschirmschoner, Energiesparen und Abschalten des Bildschirms aus** | sonst wird das Foyer schwarz |
| **Neu laden, wenn die Seite nicht lädt** – falls der Kiosk-Browser das kann | startet das Gerät, während das Netz weg ist, kann die Seite sich nicht selbst helfen |
| **Auflösung 1920 × 1080** (hochkant 1080 × 1920) | darauf ist die Bühne ausgelegt; andere Seitenverhältnisse bekommen schwarze Ränder |

Auf einem Raspberry Pi eignet sich **FullPageOS**: Dort steht die Startadresse in der Datei `fullpageos.txt` auf
der Boot-Partition.

**Schneidet der Fernseher den Rand ab** (Overscan), stelle im Editor unter „Screen" die **Overscan-Korrektur** ein –
die Bühne rückt dann um so viel Prozent nach innen.

### Was der Fernseher von selbst tut

- Er holt **Änderungen am Screen alle zwei Minuten** und **Termine alle zehn Minuten** – ein Gestalter muss nichts
  anstoßen.
- Er **hält den letzten Stand und die Bilder auf dem Gerät.** Fällt das Netz aus, zeigt er weiter, was er hatte.
- Er **lädt jede Nacht zwischen 3 und 4 Uhr neu** und nach **30 Minuten ununterbrochener Fehler** – aber nur, wenn
  die Seite erreichbar ist. Dabei meldet er sich jedes Mal frisch an; läuft die Anmeldung zwischendurch ab, erneuert
  er sie selbst.

## Updates

1. Das neue ZIP von der [Release-Seite](https://github.com/wirsindcgks/churchtools-infoscreen/releases)
   herunterladen.
2. In der Extension-Verwaltung bei „Infoscreen Designer" auf **Bearbeiten** und das ZIP hochladen. Eine
   automatische Aktualisierung aus GitHub bietet ChurchTools nicht an.
3. Welche Fassung installiert ist, steht unten auf der Seite **Einstellungen** des Designers.

Die Fernseher übernehmen die neue Fassung **spätestens beim nächtlichen Neuladen**. Screens und Bilder bleiben
erhalten.

## Wenn ein Gerät verloren geht – die Notbremse

1. **Den Geräte-Benutzer aus der Gruppe „Infoscreen-Devices" nehmen.** Damit verliert das Konto alle Rechte, die
   es über diese Gruppe hatte – am Designer und an den Kalendern. Was sein Personenstatus erlaubt, bleibt (deshalb
   in Schritt 6 ein Status mit wenig Rechten).
2. **Sein Passwort in der ChurchTools-Oberfläche ändern.** Damit wird der Login-Token ungültig – die Adresse auf
   dem verlorenen Gerät meldet sich nicht mehr an.
3. Für das Ersatzgerät in den Einstellungen eine **neue Adresse erzeugen** (mit dem neuen Passwort). Hängen weitere
   Fernseher am selben Konto, brauchen sie ebenfalls eine neue Adresse – ein Grund für ein Konto je Standort.

Mehr als lesen konnte das Gerät ohnehin nie – wer es findet, sieht, was im Foyer ohnehin zu sehen ist.

## Was öffentlich ist – Datenschutz

- **Alles auf einem Screen sieht jeder, der vorbeigeht.** Personenbezogenes – Geburtstage, Dienstpläne mit Namen,
  Kontaktdaten – gehört nicht auf einen Infoscreen.
- **Die Bilder der Mediathek und das Gemeindelogo sind über ihre Adresse ohne Anmeldung abrufbar.** So liefert
  ChurchTools Bilder aus; die Adressen sind lang und nicht zu erraten, aber wer eine kennt, kann das Bild ansehen.
  Lade nichts hoch, was nicht öffentlich sein darf.
- **Schriften kommen von eurer eigenen Instanz**, nicht von einem Schriftendienst – kein Aufruf verrät Gerät oder
  Gestalter an Dritte.
- **Die Bilder liegen im Wiki-Bereich „Infoscreen".** Wer dort ein Bild löscht, löscht es auch auf den Screens –
  der Fernseher zeigt dann einen Platzhalter. Bilder am besten nur in der **Mediathek** des Designers verwalten
  (Seitenleiste): Sie warnt vor dem Löschen, wenn ein Bild noch gezeigt wird.

## Wenn etwas nicht klappt

| Was du siehst | Woran es liegt | Was hilft |
| --- | --- | --- |
| Kein Menüpunkt „Infoscreen Designer", auch nicht als Administrator | Modulrecht „sehen" fehlt | Schritt 2; Gruppe muss „aktiv" sein |
| Startseite des Designers: „Dir fehlen Rechte …" | Person ist nicht (aktiv) in „Infoscreen-Designer" | Schritt 5; die Liste nennt das fehlende Recht |
| Kein Menüpunkt „Einstellungen" im Designer | Du bist kein Administrator | Einstellungen sind Administratoren vorbehalten |
| „Adresse erzeugen" meldet „Anmeldung fehlgeschlagen" | meist fehlt dem Geräte-Konto der **Benutzername** | Schritt 6, Punkt 2 |
| Fernseher: „Dieser Fernseher ist nicht bei ChurchTools angemeldet" | Adresse ohne Anmeldung, oder das Passwort des Geräte-Kontos wurde geändert | in den Einstellungen eine neue Adresse erzeugen |
| Fernseher: „Es gibt keinen Screen „…"" | Adresse vertippt oder Screen gelöscht | Adresse neu kopieren |
| Fernseher: Termine eines Kalenders fehlen | Gerät darf den Kalender nicht lesen | Einstellungen → „Rechte aktualisieren" |
| Fernseher: Bild fehlt, Platzhalter statt Bild | Bild im Wiki gelöscht | im Designer ein neues Bild wählen |
