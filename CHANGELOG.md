# Changelog

Alle nennenswerten Änderungen am Infoscreen Designer. Aufbau nach [Keep a Changelog](https://keepachangelog.com/de/1.1.0/),
Versionen nach [Semantic Versioning](https://semver.org/lang/de/). Wie eine Version entsteht, steht in
[`LocalTests.md`](LocalTests.md) unter „Release veröffentlichen".

## [Unreleased]

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
