# Changelog

Alle nennenswerten Änderungen am Infoscreen Designer. Aufbau nach [Keep a Changelog](https://keepachangelog.com/de/1.1.0/),
Versionen nach [Semantic Versioning](https://semver.org/lang/de/). Wie eine Version entsteht, steht in
[`LocalTests.md`](LocalTests.md) unter „Release veröffentlichen".

## [0.2.9] – 2026-09-29

Der Designer am Handy: alle Seiten über ein Menü, und im Editor bleibt die Bildfläche im Blick.

### Geändert

- **Navigation am Handy:** Oben steht ein Knopf mit dem Namen der aktuellen Seite; er klappt die Liste aller Seiten
  auf – Screens, Zeitpläne, Hinweise, Playlists, Mediathek, Design, Über & Neuigkeiten. Bisher lagen die meisten
  davon unsichtbar rechts in einer Zeile zum Wischen. Die Filter „Alle / Querformat / Hochformat" stehen am Handy
  nur noch auf der Seite „Screens".
- **Kacheln am Handy** stehen untereinander in voller Breite; lange Namen werden nach Silben getrennt statt mitten
  im Wort.
- **Editor am Handy:**
  - Die Kopfleiste passt in eine Zeile. Vorschau und Player stecken im Menü „…".
  - „+ Baustein" öffnet eine Übersicht mit allen elf Bausteinen; bisher waren nur fünf zu sehen.
  - Die Einstellungen eines Bausteins erscheinen als Blatt am unteren Rand. Es klappt beim Antippen eines Bausteins
    von selbst auf, und die Bildfläche rückt darüber, damit man sieht, was man ändert.

Am Rechner sieht alles aus wie bisher.

## [0.2.8] – 2026-09-29

Eine Schrift für alle neuen Bausteine, und mehr Geduld, wenn ChurchTools um eine Pause bittet.

### Hinzugefügt

- **Schrift auf der Seite „Design":** Neue Bausteine und neue Hinweise beginnen mit der hier gewählten Schrift,
  so wie sie schon die Text- und Hintergrundfarbe übernehmen. Bestehende Bausteine und Hinweise behalten ihre Schrift.
  Ohne Auswahl bleibt es bei Lato.

### Geändert

- **Wenn ChurchTools zu viele Anfragen meldet** (`429`), wartet der Fernseher mindestens 60 Sekunden, bevor er
  wieder fragt, so wie ChurchTools es empfiehlt. Verlangt ChurchTools ausdrücklich eine längere Pause, hält er sie
  ein. Bisher fragte er schon nach 30 Sekunden wieder.

## [0.2.7] – 2026-09-28

Auswahlfelder passen zu den Textfeldern.

### Behoben

- **Auswahlfelder** waren in Safari niedriger als die Textfelder daneben und saßen tiefer, etwa „Screen" bei den
  Adressen für die Fernseher oder „Format" der Terminbilder. Jetzt haben alle Auswahlfelder Höhe und Rahmen der
  Textfelder, in jedem Browser.

## [0.2.6] – 2026-09-28

Lange Titel passen in die Karte des nächsten Termins.

### Behoben

- **Lange Titel im „Nächsten Termin" (Darstellung „Modern")** liefen unter das Bild, und bei knappem Platz ragten
  Datum und Uhrzeit über die Karte hinaus. Jetzt werden lange Wörter wie „Sonntagsgottesdienst" getrennt, der Titel
  zeigt höchstens drei Zeilen, der Untertitel höchstens zwei. Das gilt im Editor und auf dem Fernseher.
- **Die Vorschau auf der Seite „Design"** zeigt die Karte des nächsten Termins vollständig und darunter die Termine.

### Geändert

- Die Fläche, auf der im Editor gestaltet wird und die der Fernseher zeigt, heißt jetzt **Bildfläche** statt
  „Bühne" – in der Oberfläche und in den Anleitungen.

## [0.2.5] – 2026-09-28

Die Einstellungen sind aufgeräumt, und alte Hinweise räumen sich selbst weg.

### Geändert

- **Einstellungen als Übersicht:** Statt einer langen Seite zeigen die Einstellungen Karten – „Gruppen und Rechte",
  „Adressen für die Fernseher" und „Mediathek im Wiki" –, jede mit einer eigenen Seite. Erreichbar sind sie über
  „Einstellungen" in der Kopfzeile; in der Seitenleiste stehen sie nicht mehr. Wie bisher sehen sie nur
  Administratoren. Alte Links auf die Einstellungen führen weiter an die richtige Stelle.
- **Abgelaufene Hinweise verschwinden nach 7 Tagen** von der Seite „Hinweise". Bis dahin stehen sie unter
  „Abgelaufen" und lassen sich wie bisher früher entfernen. Hinweise ohne Ende bleiben stehen.
- **Ein abgelaufener Hinweis erscheint auch im Editor nicht mehr**: weder auf der Slide noch im Inspektor noch als
  Warnung „wird ersetzt" beim Anlegen eines neuen Hinweises – der Designer zeigt, was der Fernseher zeigt.

## [0.2.4] – 2026-09-28

Ein Fernseher, der ohne Netz neu startet, zeigt den letzten Stand.

### Neu

- **Neustart ohne Netz:** Bisher zeigte ein Gerät, das während eines Netzausfalls neu startete – etwa nach einem
  Stromausfall, der auch den Router traf –, die Fehlerseite des Browsers, bis jemand kam. Jetzt legt der Player
  seine Seite nach dem ersten erfolgreichen Anzeigen auf dem Gerät ab und zeigt beim Neustart ohne Netz den
  letzten Stand; sobald das Netz zurück ist, holt er sich Neues. Auch das nächtliche Neuladen darf dann ohne Netz
  stattfinden. Der Designer und alle Daten aus ChurchTools bleiben davon unberührt.

### Geändert

- Eine noch leere Gruppe „Infoscreen-Devices" steht in den Einstellungen als Hinweis (gelb) statt als Fehler (rot),
  wie eine leere Gestalter-Gruppe: Direkt nach dem Einrichten sind beide leer, und das ist der nächste Schritt, kein
  Fehler.

## [0.2.3] – 2026-09-28

„Einrichtung entfernen" ist abgesichert und lässt sich nicht mehr festfahren.

### Geändert

- **„Einrichtung entfernen" fragt in einem eigenen Dialog nach**: Er nennt die Gruppen, die verschwinden, mit
  der Zahl ihrer Mitglieder und den Folgen, und löscht erst, wenn man das Wort „entfernen" eintippt. Wer selbst
  Mitglied einer der Gruppen ist, bekommt einen Hinweis: Kommen die Rechte am Designer nur über diese Gruppe,
  sperrt man sich aus ([Einrichtung](docs/Einrichtung.md), „Den Designer wieder entfernen").
- **Nach „Einrichtung entfernen" steht der Wiki-Bereich „Infoscreen" wieder im Wiki** unter „Kategorien" statt
  unter „Ausgeblendet". Er bleibt mit allen Bildern erhalten; Administratoren können sie dort sichern.
- **Der Dialog zeigt, was beim ganzen Abbau passiert**: was „Einrichtung entfernen" löscht, was das Löschen der
  Extension in ChurchTools danach abräumt und was von Hand bleibt – Wiki-Bereich, Geräte-Benutzer und dessen
  Login-Token in den Adressen der Fernseher. Die Anleitung hat dazu eine Übersicht
  ([Einrichtung](docs/Einrichtung.md), „Was beim Abbau passiert – auf einen Blick").
- **Die Gerätekonten werden beim Namen genannt**, im Dialog mit Link zur Person und danach im Protokoll, mit der
  Empfehlung, ihre Passwörter zu ändern. Erst dann funktionieren die Adressen der Fernseher nicht mehr. Selbst
  ändern kann der Designer sie nicht: ChurchTools lässt einen Login-Token nicht von außen widerrufen.

### Behoben

- Durfte ein Konto Gruppen löschen, aber die Einstellungen des Designers nicht ändern, löschte „Einrichtung
  entfernen" die Gruppen und konnte sich das nicht merken. Danach brach jeder weitere Versuch ab. Jetzt prüft
  der Designer vorher, ob er speichern darf, und löscht sonst nichts. Eine Gruppe, die es schon nicht mehr
  gibt, gilt als entfernt – eine so festgefahrene Einrichtung lässt sich mit einem Klick bereinigen.
- Direkt nach dem Entfernen konnten die gelöschten Gruppen noch in der Liste stehen und galten dann als fremd;
  „Gruppen und Rechte anlegen" blieb gesperrt, bis man die Seite neu lud.

## [0.2.2] – 2026-09-28

Der Designer räumt nur noch weg, was er selbst angelegt hat.

### Geändert

- **Der Wiki-Bereich „Infoscreen" entsteht nur noch in der Einrichtung** (Einstellungen → „Automatisch
  einrichten"). Die Mediathek legt ihn nicht mehr beim ersten Öffnen an, sondern sagt, dass die Einrichtung fehlt.
- **Die Einstellungen zeigen, wem der Wiki-Bereich gehört:** ob ihn der Designer angelegt hat oder ob es ihn schon
  gab. Einen Bereich, den es schon gab, benutzt der Designer mit, löscht ihn aber nie. Bei Installationen vor dieser
  Version ist das nicht vermerkt; ihr Bereich gilt deshalb ebenfalls als vorhanden und bleibt stehen.

### Behoben

- Brach „Einrichtung entfernen" mittendrin ab, etwa weil eine Gruppe nicht gelöscht werden durfte, versuchte ein
  zweiter Anlauf auch die schon gelöschten Gruppen noch einmal. Jetzt merkt sich der Designer, was noch da ist.
  Vorhandene Gruppen, die in den Einstellungen gewählt sind, fasst „Einrichtung entfernen" wie bisher nicht an.

## [0.2.1] – 2026-09-26

Fernseher bleiben angemeldet, auch wenn jemand die Seite von Hand neu lädt.

### Behoben

- Nach einem Neuladen von Hand fragte der Player nach der Anmeldung, statt sich über seine Adresse selbst
  anzumelden. Die Adresse samt Anmeldung bleibt dafür jetzt in der Adresszeile stehen.
- War im selben Browser zugleich jemand anderes in ChurchTools angemeldet, holte der Player Termine und Beiträge
  zeitweise mit dessen Rechten – dann fehlten etwa Termine. Er prüft jetzt vor jedem Abruf, wer angemeldet ist.
  Ein Player braucht deshalb einen eigenen Browser; zum Ausprobieren am Schreibtisch genügt ein Inkognito-Fenster
  ([Einrichtung](docs/Einrichtung.md), Schritt 7).

## [0.2.0] – 2026-09-26

Beiträge aus ChurchTools auf dem Fernseher, und Hinweise an einem eigenen Ort.

### Gestalten

- **Beiträge:** Der neue Baustein zeigt die neuesten Beiträge gewählter Gruppen – hervorgehoben wie ein Beitrag in
  ChurchTools, mit Gruppe, Titel, Text und Bild, einer nach dem anderen; oder als Liste. Der Fernseher zeigt nur
  Beiträge öffentlicher Gruppen, und der Baustein warnt, wenn eine gewählte Gruppe nicht öffentlich ist. Den Namen
  der Autorin oder des Autors zeigt er nur, wenn man es einschaltet.
- **Hinweise haben einen eigenen Bereich:** „Hinweise" in der Seitenleiste zeigt, was gerade läuft und bis wann.
  Ein Hinweis läuft auf allen gewählten Playlists – vorausgewählt alle, die ein Fernseher zeigt –, mit Vorschau,
  eigener Schriftart und Stärke. Im Editor steht nur noch, ob einer läuft.
- **„Modern"** heißt jetzt die Darstellung der Termine mit Karten und Datumskachel (bisher „Groß").

### Behoben

- Fenster wie der Zeitplan-Dialog rutschten auf kleinen Bildschirmen mit ihrem oberen Teil hinter die Menüleiste
  von ChurchTools.
- Auf „Über & Neuigkeiten" fehlte der einleitende Satz einer Version.

## [0.1.0] – 2026-09-25

Die erste Version: Infoscreens für die Fernseher der Gemeinde, gestaltet direkt in ChurchTools.

### Gestalten

- **Screens auf einen Blick:** Jeder Fernseher ist eine Kachel mit einem Bild dessen, was er gerade zeigt – auch
  wenn der Zeitplan gerade eine andere Playlist gewählt hat. Filter nach Quer- und Hochformat und eine Suche helfen,
  wenn es mehr werden. Klappt auch am Handy.
- **Slides gestalten:** Texte, Bilder, Flächen, Uhr, Terminliste, nächster Termin, Gemeindekopf mit Name und Logo,
  Webseiten und QR-Codes auf die Fläche ziehen, verschieben und in der Größe ändern. Ein Raster und Hilfslinien
  helfen beim Ausrichten, Rückgängig und Wiederholen beim Ausprobieren.
- **Bausteine sperren**, damit ein Hintergrund oder Logo beim Gestalten nicht aus Versehen verrutscht. Ein Klick
  auf einen gesperrten Baustein erreicht den darunter; mit Alt wählt er den gesperrten selbst.
- **Vorschau:** spielt die Playlist im Vollbild ab, wie der Fernseher sie zeigt – auch mit Änderungen, die noch
  nicht gespeichert sind.
- **Termine aus dem Kalender**, immer aktuell: als schlichte Liste oder als große Karten mit Datumskachel, Uhrzeit,
  Ort und Kalender, dazu „Nächster Termin" mit Bild. Passen nicht alle Termine auf die Fläche, blättert die Liste
  weiter, und ein Balken zeigt, wann die nächste Seite kommt.
- **Countdown:** „Gottesdienst beginnt in 12:34" – zählt bis zum nächsten Termin gewählter Kalender und zeigt
  während des Termins einen eigenen Text, etwa „Läuft gerade".
- **Hinweisband:** eine Laufschrift oder ein stehender Hinweis über allen Slides einer Playlist, etwa „Heute
  Parkplatz gesperrt" – mit Ablaufzeit, danach verschwindet es von selbst.
- **Webseite und QR-Code:** eine Seite der Gemeinde-Website auf dem Fernseher zeigen; einen QR-Code zur Anmeldung
  oder zum Wochenblatt, der ohne fremden Dienst entsteht.
- **Playlists:** Slides zu Playlists bündeln. Eine Playlist kann auf mehreren Fernsehern laufen. Eine Playlist
  lässt sich duplizieren, und Slides aus einer anderen Playlist lassen sich als Kopie übernehmen.
- **Zeitpläne:** zu bestimmten Zeiten eine andere Playlist zeigen – etwa sonntags von 9 bis 12 Uhr den
  Gottesdienst, oder rund um die Termine eines Kalenders, z. B. „30 Minuten vor Beginn bis 10 Minuten danach". Die
  Seite „Zeitpläne" zeigt für jeden Fernseher, was gerade läuft, mit Vorschau.
- **Mediathek:** Bilder hochladen und für alle Screens verwenden. Unter jedem Bild steht, wo es läuft („Foyer ›
  Gottesdienst › Begrüßung"); „Unbenutzt" hilft beim Aufräumen. Vor dem Löschen warnt sie, wenn ein Bild noch
  gezeigt wird.
- **Design:** Ecken, Akzentfarbe, Farben für neue Slides, die Darstellung der Termine und das Format der Terminbilder
  einmal für alle Screens festlegen – mit Vorschau.
- **Zehn Schriften** zur Auswahl, Lato als Standard.
- **Gleichzeitig arbeiten:** Haben zwei Personen dieselbe Playlist geändert, sagt der Designer es, statt eine
  Änderung still zu überschreiben.
- **Über & Neuigkeiten:** die installierte Version und diese Liste; ein Punkt in der Seitenleiste zeigt, wenn es
  etwas Neues gibt.

### Am Fernseher

- **Änderungen kommen von selbst:** Gespeichertes erscheint nach etwa 20 Sekunden, ohne dass jemand am Gerät etwas
  tun muss.
- **Läuft auch, wenn das Netz hakt:** Der Fernseher behält Inhalte und Bilder und lädt nach längeren Störungen und
  jede Nacht neu.
- **Meldet sich selbst an:** Die Adresse des Fernsehers enthält eine eigene Anmeldung für ein Geräte-Konto, das nur
  Kalender lesen darf. Ein Screen mit Zeitplan zeigt nach dem Einschalten sofort die richtige Playlist.

### Für Administratoren

- **Einrichtung per Knopfdruck:** Ein Assistent in den Einstellungen legt die Gruppen „Infoscreen-Designer" und
  „Infoscreen-Devices" samt Rechten an und prüft sie. Wer Gestalter sein soll, kommt in die erste Gruppe.
- **Adresse für einen Fernseher** aus Benutzername und Passwort des Geräte-Kontos – das Passwort wird nicht
  gespeichert.
- **Rollen:** Screens anlegen, einstellen und löschen Administratoren; Gestalter kümmern sich um Slides, Playlists,
  Bilder und Design.
- **Die Bilder** liegen im Wiki-Bereich „Infoscreen" und können dort unter „Ausgeblendet" aus dem Blick rücken.
- **Anleitungen** zur [Einrichtung](docs/Einrichtung.md), zum [Einstieg je Rolle](docs/Onboarding.md) – mit
  Bildern für neue Gestalter – und eine [Übersicht der Rechte](docs/Rechte.md).

[0.2.9]: https://github.com/wirsindcgks/churchtools-infoscreen/releases/tag/v0.2.9
[0.2.8]: https://github.com/wirsindcgks/churchtools-infoscreen/releases/tag/v0.2.8
[0.2.7]: https://github.com/wirsindcgks/churchtools-infoscreen/releases/tag/v0.2.7
[0.2.6]: https://github.com/wirsindcgks/churchtools-infoscreen/releases/tag/v0.2.6
[0.2.5]: https://github.com/wirsindcgks/churchtools-infoscreen/releases/tag/v0.2.5
[0.2.4]: https://github.com/wirsindcgks/churchtools-infoscreen/releases/tag/v0.2.4
[0.2.3]: https://github.com/wirsindcgks/churchtools-infoscreen/releases/tag/v0.2.3
[0.2.2]: https://github.com/wirsindcgks/churchtools-infoscreen/releases/tag/v0.2.2
[0.2.1]: https://github.com/wirsindcgks/churchtools-infoscreen/releases/tag/v0.2.1
[0.2.0]: https://github.com/wirsindcgks/churchtools-infoscreen/releases/tag/v0.2.0
[0.1.0]: https://github.com/wirsindcgks/churchtools-infoscreen/releases/tag/v0.1.0
