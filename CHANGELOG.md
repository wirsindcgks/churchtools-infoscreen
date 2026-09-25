# Changelog

Alle nennenswerten Änderungen am Infoscreen Designer. Aufbau nach [Keep a Changelog](https://keepachangelog.com/de/1.1.0/),
Versionen nach [Semantic Versioning](https://semver.org/lang/de/). Wie eine Version entsteht, steht in
[`LocalTests.md`](LocalTests.md) unter „Release veröffentlichen".

## [Unreleased]

### Neu

- **Designer** in ChurchTools unter `/ccm/infoscreen-designer/`: Startseite nach dem Muster der Gruppen-Übersicht
  mit Kacheln, Vorschau der ersten Slide, Filtern nach Format und Suche; handytauglich.
- **Editor**: Slides anlegen, ordnen, abschalten; neun Bausteine (Text, Bild, Fläche, Uhr, Terminliste, Nächster
  Termin, Gemeindekopf, Webseite, QR-Code) auf der Bühne ziehen und skalieren, mit Raster und Hilfslinien; Farben als Hex-Wert;
  Rückgängig/Wiederholen; Speichern mit Konflikterkennung.
- **Playlists** als eigener Bereich: unabhängig von einem Screen anlegen, gestalten und löschen; dieselbe Playlist
  kann auf mehreren Screens laufen, die Kachel sagt, auf welchen. Der Editor gestaltet eine Playlist.
- **Zeitpläne** an jeder Screen-Kachel und als eigener Bereich mit allen Screens, ihren Regeln in Worten und dem,
  was gerade läuft: Standard-Playlist wählen, Regeln nach Uhrzeit (Wochentage, von–bis) und rund um Termine
  ausgewählter Kalender, die obere gewinnt; eine Tagesvorschau zeigt, was wann läuft. Termin-Regeln mit frei
  gewähltem Zeitraum, z. B. „30 Min. vor Beginn bis 10 Min. nach Beginn" für eine Begrüßung.
  Ein Screen mit Regeln zeigt nach dem Start sofort die richtige Playlist, nicht erst kurz die Standard-Playlist.
- **Neue Darstellungen** nach dem WordPress-Plugin: die Terminliste als Karten – links ein gleich breiter Block mit
  Kalender, Tag und Uhrzeit, rechts Titel, Untertitel und Ort; „Nächster Termin" hervorgehoben mit Beschreibung,
  Ort und Bild.
- **Design** als eigener Bereich: für alle Screens Ecken rund oder eckig, Akzentfarbe, Text- und Hintergrundfarbe
  für neue Slides, Termine „Nativ" oder „Groß" und das Format der Terminbilder (16:9 voreingestellt) – mit
  Live-Vorschau; ein Baustein mit eigener Darstellung behält sie.
- **Bausteine „Webseite" und „QR-Code"**: eine fremde Seite per https-Adresse im abgesicherten Rahmen, etwa das
  Instagram-Profil der Gemeinde (der Profilname genügt), in wählbarer Größe; ein QR-Code, der auf dem Gerät
  entsteht, ohne fremden Dienst.
- **Terminliste mit allen Terminen** der nächsten Tage: was nicht in die Box passt, blättert seitenweise (10 s je
  Seite, einstellbar); ein Balken zeigt je Seite die verbleibende Zeit; die Slide bleibt, bis alle Seiten gezeigt
  sind – die Slide-Liste zeigt die längere Laufzeit („12 → 30 s").
- **Mediathek im Wiki ausblenden:** Der Wiki-Bereich der Bilder steht im Wiki unter „Ausgeblendet"; für bestehende
  Installationen ein Knopf in den Einstellungen.
- **Bausteine sperren:** Ein gesperrter Baustein lässt sich weder verschieben noch ändern oder löschen, bis er
  entsperrt wird.
- **Vorschau im Editor:** spielt die Playlist mit allen ungespeicherten Änderungen im Vollbild ab, wie der
  Fernseher – mit vor/zurück und Anhalten.
- **Player** zeigt beim Laden eine drehende Sanduhr und übernimmt Gespeichertes in etwa 20 Sekunden: ein
  Schnellcheck mit einer kleinen Anfrage, erst bei einer Änderung lädt er den Screen.
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
