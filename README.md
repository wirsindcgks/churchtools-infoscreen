# ChurchTools Infoscreen Designer

Eine Extension für [ChurchTools](https://church.tools), mit der eine Gemeinde die Bildschirme in ihrem Foyer selbst
gestaltet – im Browser, ohne Programmierkenntnisse. Termine kommen live aus ChurchTools, Bilder aus der eigenen
Mediathek; ein Fernseher mit Kiosk-Browser zeigt das Ergebnis.

![Der Editor: Slides, Bausteine, Bildfläche und Inspektor](docs/bilder/editor.png)

## Was es kann

- **Gestalten wie in einem Folien-Editor:** Slides mit Text, Bild, Fläche, Uhr, Terminliste, nächstem Termin,
  Countdown, Gemeindekopf mit Logo, Webseite, QR-Code, Beiträgen, Gruppen und einer Galerie; ziehen, skalieren, am Raster
  ausrichten, sperren; Rückgängig/Wiederholen. Die Vorschau ist genau das, was der Fernseher zeigt.
- **Termine live aus den Kalendern von ChurchTools** – was dort eingetragen wird, erscheint von selbst im Foyer, als
  schlichte Liste oder als Karten mit Datumskachel.
- **Gruppen und Beiträge aus ChurchTools:** die Gruppen einer Gruppen-Homepage mit Treffzeit, freien Plätzen und
  einem QR-Code zum Anmelden, die neuesten Beiträge öffentlicher Gruppen – nur, was ChurchTools ohnehin öffentlich
  zeigt.
- **Playlists und Zeitpläne:** Eine Playlist kann auf mehreren Screens laufen; Regeln nach Uhrzeit oder rund um
  Termine schalten um, etwa „30 Minuten vor dem Gottesdienst die Begrüßung". Die Startseite zeigt, was jeder
  Fernseher gerade zeigt.
- **Hinweise:** eine Laufschrift oder ein stehender Hinweis über allen Slides, der zur eingestellten Zeit von
  selbst verschwindet.
- **Mediathek und Design:** Bilder einmal hochladen und überall verwenden, mit der Angabe, wo sie laufen; Ecken,
  Farben und Darstellung der Termine einmal für alle Screens festlegen.
- **Mehrere Screens**, quer oder hochkant, jeder unter einer festen Adresse.
- **Auch am Handy und auf dem Tablet:** Übersicht, Menü und Editor passen sich an – Slides gestalten mit dem Finger,
  die Einstellungen eines Bausteins als Blatt am unteren Rand oder als Spalte daneben, die ganze Slide im Blick. Am
  Rechner lassen sich Slides und Einstellungen einklappen.
- **Fernseher, die sich selbst helfen:** Sie melden sich selbst an, holen Änderungen in etwa 20 Sekunden, halten
  Daten und Bilder auf dem Gerät, überstehen Netzausfälle und laden nach Fehlern und jede Nacht neu.
- **Rechte mit einem Knopf:** Ein Assistent legt die Gruppen für Gestalter und Geräte samt Rechten an.
- **Datensparsam:** Zehn freie Schriften kommen von der eigenen Instanz, kein Aufruf an Dritte; das Gerät hat ein
  eigenes Konto, das nur lesen darf; seine Adresse trägt statt eines Passworts einen Login-Token, den ein
  Passwortwechsel ungültig macht.

**Mehr Bilder** – Gruppen, Vorschau, Beiträge, Hinweise, Zeitpläne, Mediathek, Design und der Designer am Handy –
zeigt die Übersicht [**Der Designer in Bildern**](docs/Funktionen.md).

## Installieren

- **[Der Designer in Bildern](docs/Funktionen.md)** – was er kann, in Screenshots.
- **[Onboarding](docs/Onboarding.md)** – der Einstieg je Rolle: Administrator, Gestalter, Gerät.
- **[Einrichtungsanleitung für ChurchTools-Administratoren](docs/Einrichtung.md)** – Installation, Rechte,
  Geräte-Benutzer, Kiosk-Browser, Updates und Datenschutz.
- **[Rechte-Übersicht](docs/Rechte.md)** – wer welche Rechte braucht, als Tabelle.

Das Paket zum Hochladen liegt unter [Releases](https://github.com/wirsindcgks/churchtools-infoscreen/releases).
Voraussetzung ist eine ChurchTools-Instanz, auf der Extensions (Custom Modules) freigeschaltet sind.

## Stand

Aktuell ist Version 0.3.6 (30. September 2026) mit dem Baustein „Galerie", seit 0.3.2 mit einem ruhigeren Editor, davor 0.3.1 mit dem Designer auf dem Tablet; das erste Release war 0.1.0 am
25. September 2026. Der Designer läuft auf einer Testinstanz (ChurchTools 3.136, Build 32882); der erste Fernseher
im Foyer steht aus.
Was als Nächstes kommt, steht in [`Plan.md`](Plan.md); Änderungen je Version in [`CHANGELOG.md`](CHANGELOG.md).

## Mitentwickeln

Vue 3, TypeScript, Vite, Vitest, Playwright. Wie die lokale Umgebung eingerichtet, gestartet und getestet wird,
steht in [`LocalTests.md`](LocalTests.md); die Arbeitsregeln für Mitwirkende und KI-Agenten in
[`AGENTS.md`](AGENTS.md). Die Messungen an ChurchTools, auf die sich der Bau stützt, stehen in
[`Befunde.md`](Befunde.md).

## Kein Bezug zum Hersteller

Dieses Projekt ist eine unabhängige Entwicklung von Anwendern und steht in keiner Verbindung zur ChurchTools
Innovation GmbH. Es wird von ihr weder herausgegeben noch betrieben, unterstützt, geprüft oder freigegeben.
„ChurchTools" und zugehörige Namen und Zeichen gehören ihren jeweiligen Inhabern und werden hier allein zur
Beschreibung der Schnittstelle verwendet, mit der diese Extension arbeitet. Für Fragen ist der Hersteller-Support
nicht zuständig; sie gehören in den [Issue-Tracker](https://github.com/wirsindcgks/churchtools-infoscreen/issues)
dieses Repositorys.

## Lizenz

[GPL-2.0-or-later](LICENSE). Die mitgelieferten Schriften stehen unter der SIL Open Font License; ihre Lizenztexte
liegen dem Paket bei.
