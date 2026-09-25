# Changelog

Alle nennenswerten Änderungen am Infoscreen Designer. Aufbau nach [Keep a Changelog](https://keepachangelog.com/de/1.1.0/),
Versionen nach [Semantic Versioning](https://semver.org/lang/de/). Wie eine Version entsteht, steht in
[`LocalTests.md`](LocalTests.md) unter „Release veröffentlichen".

## [Unreleased]

### Neu

- **Designer** in ChurchTools unter `/ccm/infoscreen-designer/`: Startseite nach dem Muster der Gruppen-Übersicht
  mit Kacheln, Vorschau der ersten Slide, Filtern nach Format und Suche; handytauglich.
- **Editor**: Slides anlegen, ordnen, abschalten; sieben Bausteine (Text, Bild, Fläche, Uhr, Terminliste, Nächster
  Termin, Gemeindekopf) auf der Bühne ziehen und skalieren, mit Raster und Hilfslinien; Farben als Hex-Wert;
  Rückgängig/Wiederholen; Speichern mit Konflikterkennung.
- **Mediathek**: Bilder in den Wiki-Bereich „Infoscreen", mit Löschschutz.
- **Player** für Fernseher: meldet sich einmal als Geräte-Benutzer an (Weg A), zeigt Termine live, hält Daten und
  Bilder auf dem Gerät, lädt nach anhaltenden Fehlern und nachts neu.
- **Zehn Schriften** unter der SIL Open Font License, von der eigenen Instanz ausgeliefert; Lato als Standard.
- **Einrichtungsanleitung** für ChurchTools-Administratoren: `docs/Einrichtung.md`.
- **Einstellungen** für Administratoren: Der Assistent legt die Gruppen „Infoscreen-Designer" und
  „Infoscreen-Devices" samt Rechten an und prüft sie.
