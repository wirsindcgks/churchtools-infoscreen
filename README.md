# ChurchTools Infoscreen Designer

[![Release](https://img.shields.io/github/v/release/wirsindcgks/churchtools-infoscreen)](https://github.com/wirsindcgks/churchtools-infoscreen/releases)
[![Lizenz: GPL v3](https://img.shields.io/github/license/wirsindcgks/churchtools-infoscreen)](LICENSE)
[![Mit KI entwickelt](https://img.shields.io/badge/mit_KI_entwickelt-Claude_Code-8A2BE2)](AGENTS.md)

Mit dem Infoscreen Designer gestaltet eure Gemeinde die Bildschirme im Foyer selbst – im Browser, direkt in
[ChurchTools](https://church.tools) und ohne Programmierkenntnisse. Termine, Gruppen und Räume kommen live aus
ChurchTools und erscheinen von selbst auf dem Bildschirm. Ein Fernseher mit Kiosk-Browser zeigt das Ergebnis.

![Der Editor: Folien, Bausteine, Bildfläche und Inspektor](docs/bilder/editor.png)

## Was ihr damit macht

- **Folien gestalten wie in einem Folien-Editor:** Text, Bilder, Uhr, Countdown, QR-Code, Galerie, Video und mehr
  per Drag and drop. Die Vorschau zeigt genau das, was der Fernseher zeigt – auch am Handy und auf dem Tablet.
- **Inhalte aus ChurchTools zeigen:** Termine als Liste oder als Karten (auf Wunsch mit Ort, Raum und Diensten),
  den nächsten Termin, Gruppen mit Treffzeit und QR-Code zur Anmeldung, aktuelle Beiträge und die Raumbelegung.
  Was in ChurchTools geändert wird, steht nach etwa 20 Sekunden auf dem Bildschirm.
- **Wechseln nach Plan:** Mehrere Folien laufen als Präsentation. Zeitpläne schalten um, etwa „30 Minuten vor dem
  Gottesdienst die Begrüßung". Hinweise und Laufschrift liegen über allen Folien und verschwinden zur eingestellten
  Zeit von selbst.
- **Mehrere Bildschirme:** quer oder hochkant, jeder unter einer festen Adresse. Die Startseite zeigt, was jeder
  Bildschirm gerade zeigt und ob er online ist.
- **Einheitliches Aussehen:** Farben, Schriften und Darstellung der Termine legt ihr einmal für alle Bildschirme fest.
  Bilder lädt ihr einmal in die Mediathek und nutzt sie überall.

Mehr Bilder zeigt [**Der Designer in Bildern**](docs/Funktionen.md).

## Was ihr braucht

- eine ChurchTools-Instanz, auf der **Extensions (Custom Modules)** freigeschaltet sind,
- einen Administrator, der das Modul einmal einrichtet,
- für jeden Bildschirm einen Fernseher oder Mini-PC mit aktuellem Browser im Kiosk-Modus.

## Loslegen

1. **Paket laden:** das ZIP unter [Releases](https://github.com/wirsindcgks/churchtools-infoscreen/releases)
   herunterladen.
2. **Hochladen:** in ChurchTools in der Extension-Verwaltung hochladen.
3. **Einrichten:** Ein Assistent legt die Gruppen für Gestalter und Geräte samt Rechten an – mit einem Knopf.
4. **Gestalten:** Folien bauen, Präsentation und Bildschirm zusammenstellen, die Adresse des Bildschirms im Kiosk-Browser
   des Fernsehers eintragen.

Probiert es bitte **zuerst in einer Test- oder Demo-Instanz** aus und nicht direkt in eurer produktiven Umgebung:
Der Assistent legt Gruppen und Rechte an. Die Adresse eines Fernsehers enthält einen Login-Token; behandelt sie
wie ein Passwort.

Die Anleitungen:

- **[Onboarding](docs/Onboarding.md)** – der Einstieg je Rolle: Administrator, Gestalter, Gerät.
- **[Einrichtung für Administratoren](docs/Einrichtung.md)** – Installation, Rechte, Geräte-Benutzer, Kiosk-Browser,
  Updates und Datenschutz.
- **[Rechte-Übersicht](docs/Rechte.md)** – wer welche Rechte braucht, als Tabelle.

## Datenschutz

Die zehn mitgelieferten Schriften kommen von eurer eigenen Instanz, es gibt keinen Aufruf an Dritte. Der Fernseher
hat ein eigenes Konto, das nur lesen darf – bis auf sein Lebenszeichen, das die Startseite als „online" zeigt. Seine
Adresse trägt statt eines Passworts einen Login-Token, den ein Passwortwechsel ungültig macht. Gruppen und Beiträge
erscheinen nur, wenn ChurchTools sie ohnehin öffentlich zeigt, und Namen von Diensten nur nach Freigabe durch einen
Administrator.

## Stand

Aktuell ist Version 0.17.1. Bei uns zeigen seit dem 6. Oktober 2026 zwei Fernseher im Foyer ihre Folien damit;
getestet ist es auf ChurchTools 3.136. Was sich je Version geändert hat, steht im
[Changelog](CHANGELOG.md), was als Nächstes kommt, in [`Plan.md`](Plan.md). Fehler und Wünsche gerne im
[Issue-Tracker](https://github.com/wirsindcgks/churchtools-infoscreen/issues).

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

© 2026 Tobias N. für CG Kraichgau-Stromberg e. V.

[GPL-3.0-or-later](LICENSE). Die mitgelieferten Schriften stehen unter der SIL Open Font License; ihre Lizenztexte
liegen dem Paket bei, ebenso die der gebündelten Bibliotheken (`licenses/THIRD-PARTY-NOTICES.txt`).
