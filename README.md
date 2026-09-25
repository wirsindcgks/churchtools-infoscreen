# ChurchTools Infoscreen Designer

Eine Extension für [ChurchTools](https://church.tools), mit der eine Gemeinde die Bildschirme in ihrem Foyer selbst
gestaltet – im Browser, ohne Programmierkenntnisse. Termine kommen live aus ChurchTools, Bilder aus der eigenen
Mediathek; ein Fernseher mit Kiosk-Browser zeigt das Ergebnis.

## Was es kann

- **Gestalten wie in einem Folien-Editor:** Slides mit Text, Bild, Fläche, Uhr, Terminliste, nächstem Termin und
  Gemeindekopf mit Logo; ziehen, skalieren, am Raster ausrichten, Farben als Hex-Wert; Rückgängig/Wiederholen.
  Die Vorschau ist genau das, was der Fernseher zeigt.
- **Termine live aus den Kalendern von ChurchTools** – was dort eingetragen wird, erscheint von selbst im Foyer.
- **Mehrere Screens**, quer oder hochkant, jeder unter einer festen Adresse; handytaugliche Übersicht.
- **Fernseher, die sich selbst helfen:** Sie melden sich selbst an, holen Änderungen in etwa 20 Sekunden, halten
  Daten und Bilder auf dem Gerät, überstehen Netzausfälle und laden nach Fehlern und jede Nacht neu.
- **Rechte mit einem Knopf:** Ein Assistent legt die Gruppen für Gestalter und Geräte samt Rechten an.
- **Datensparsam:** Zehn freie Schriften kommen von der eigenen Instanz, kein Aufruf an Dritte; das Gerät hat ein
  eigenes Konto, das nur lesen darf; seine Adresse trägt statt eines Passworts einen Login-Token, den ein
  Passwortwechsel ungültig macht.

## Installieren

- **[Onboarding](docs/Onboarding.md)** – der Einstieg je Rolle: Administrator, Gestalter, Gerät.
- **[Einrichtungsanleitung für ChurchTools-Administratoren](docs/Einrichtung.md)** – Installation, Rechte,
  Geräte-Benutzer, Kiosk-Browser, Updates und Datenschutz.
- **[Rechte-Übersicht](docs/Rechte.md)** – wer welche Rechte braucht, als Tabelle.

Das Paket zum Hochladen liegt unter [Releases](https://github.com/wirsindcgks/churchtools-infoscreen/releases).
Voraussetzung ist eine ChurchTools-Instanz, auf der Extensions (Custom Modules) freigeschaltet sind.

## Stand

Die erste Fassung läuft seit September 2026 auf einer Testinstanz (ChurchTools 3.136, Build 32882), der erste
Fernseher im Foyer steht aus.
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
