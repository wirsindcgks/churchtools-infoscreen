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
- **Zeitpläne:** mehrere Playlists je Screen; Regeln nach Uhrzeit (Wochentage, von–bis) und rund um Termine
  ausgewählter Kalender entscheiden, welche läuft, die obere Regel gewinnt; eine Tagesvorschau zeigt, was wann
  läuft. Gesteuert von der Startseite (Kachel → „Zeitplan"); im Editor wählt man, welche Playlist man gestaltet.
  Slides lassen sich in mehreren Playlists zeigen, ohne sie zu kopieren.
- **Mediathek** als eigener Bereich in der Seitenleiste und als Auswahl im Editor: Bilder in den Wiki-Bereich
  „Infoscreen" hochladen, mit Warnung vor dem Löschen, solange ein Bild gezeigt wird.
- **Player** für Fernseher: meldet sich über seine Adresse bei jedem Start selbst als Geräte-Benutzer an und erneuert
  die Anmeldung täglich; zeigt Termine live, hält Daten und Bilder auf dem Gerät, lädt nach anhaltenden Fehlern und
  nachts neu.
- **Adresse für einen Fernseher** in den Einstellungen: aus Benutzername und Passwort des Geräte-Kontos, ohne das
  Passwort zu speichern.
- **Zehn Schriften** unter der SIL Open Font License, von der eigenen Instanz ausgeliefert; Lato als Standard.
- **Einrichtungsanleitung** für ChurchTools-Administratoren: `docs/Einrichtung.md`; dazu das **Onboarding** je Rolle
  (`docs/Onboarding.md`) und die **Rechte-Übersicht** als Tabelle (`docs/Rechte.md`), die ein Test mit dem
  Einrichtungsassistenten abgleicht.
- **Rollen:** Screens anlegen, einstellen und löschen nur Administratoren (Menü „…" der Kachel → „Einstellungen");
  Gestalter gestalten Slides, Playlists und Bilder. Nach dem Update einmal „Rechte aktualisieren".
- **Einstellungen** für Administratoren: Der Assistent legt die Gruppen „Infoscreen-Designer" und
  „Infoscreen-Devices" samt Rechten an und prüft sie.
