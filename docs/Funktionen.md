# Der Infoscreen Designer in Bildern

Was der Designer kann, auf einen Blick – für Gemeinden, die überlegen, ob er zu ihnen passt, und für alle, die ihn
neu kennenlernen. Wie man ihn einrichtet, steht in der [Einrichtungsanleitung](Einrichtung.md), wie man damit
arbeitet, im [Onboarding](Onboarding.md).

**Alle Bilder zeigen eine erfundene „Gemeinde am Markt"** mit ausgedachten Terminen, Gruppen, Namen und Bildern –
nichts davon stammt aus einer echten ChurchTools-Instanz. Die Bilder entstehen automatisch
(`npm run docs:screenshots`) und lassen sich nach jeder Änderung neu erzeugen.

## Die Screens

Jeder Fernseher ist eine Kachel – mit dem, was er **gerade** zeigt. Ein Klick öffnet die laufende Playlist im
Editor; Adresse, Zeitplan und Player stecken im Menü „…". Filter trennen Quer- und Hochformat.

![Startseite: zwei Screens als Kacheln, quer und hochkant, jeweils mit der laufenden Slide](bilder/startseite.png)

## Der Editor

Slides gestalten wie in einem Folienprogramm: links die Slides, oben die Bausteine, in der Mitte die Bildfläche,
rechts der Inspektor mit allen Einstellungen des gewählten Bausteins. Ziehen, an den Griffen skalieren, am Raster
ausrichten, sperren, rückgängig machen. Termine kommen live aus den Kalendern von ChurchTools – hier als Karten mit
Datumskachel und Kalenderfarbe.

![Editor mit einer Terminliste als Karten, darüber Gemeindename und Uhr](bilder/editor.png)

**Zwölf Bausteine:** Text, Bild, Fläche, Uhr, Terminliste, Nächster Termin, Gemeindekopf mit Logo, Webseite,
QR-Code, Countdown, Beiträge und Gruppen.

## Gruppen aus ChurchTools

Was es in der Gemeinde für Gruppen gibt – direkt aus einer **Gruppen-Homepage** von ChurchTools, ohne doppelte
Pflege. Je Gruppe Name, Bild, Wochentag und Uhrzeit, Zielgruppe, Kategorie, Beschreibung, freie Plätze, auf Wunsch
die Leitung mit Bild und ein **QR-Code auf die öffentliche Gruppenseite** zum Anmelden. Jede Angabe lässt sich
einzeln abschalten; ein bis vier Gruppen je Seite, oder als Liste.

![Editor mit dem Baustein „Gruppen": zwei Karten nebeneinander, rechts die Schalter für jede Angabe](bilder/gruppen.png)

Gezeigt wird nur, was ChurchTools auf der Gruppen-Homepage ohnehin öffentlich zeigt.

## Die Vorschau – genau wie am Fernseher

„Vorschau" spielt die Playlist mit allen ungespeicherten Änderungen im Vollbild ab: dieselben Bausteine, derselbe
Wechsel, dieselben Daten wie am Fernseher. Die Gruppen wechseln seitenweise; die Slide bleibt, bis alle Seiten
gelaufen sind.

![Vollbild-Vorschau: zwei Gruppen-Karten mit QR-Code, unten ein Hinweisband](bilder/vorschau.png)

## Beiträge aus ChurchTools

Die neuesten Beiträge öffentlicher Gruppen – mit Bild, Gruppe und Alter des Beitrags, einer nach dem anderen oder als
Liste. Abgelaufene Beiträge erscheinen nie; den Namen der Autorin oder des Autors zeigt der Baustein nur, wenn man es
einschaltet.

![Editor mit dem Baustein „Beiträge": ein Beitrag mit Bild links und Text rechts](bilder/beitraege.png)

## Hinweise

Ein Band über allen Slides – als Laufschrift oder stehend, etwa „Heute Parkplatz gesperrt". Es läuft auf den
gewählten Playlists und verschwindet zur eingestellten Zeit von selbst.

![Seite „Hinweise" mit einem laufenden Hinweis und den Playlists, auf denen er läuft](bilder/hinweise.png)

## Playlists

Eine Playlist ist der Inhalt eines Screens und kann auf mehreren Screens laufen. Duplizieren ergibt eine Kopie mit
eigenen Slides.

![Playlists als Kacheln mit Format, Zahl der Slides und den Screens, die sie zeigen](bilder/playlists.png)

## Zeitpläne

Welche Playlist ein Screen wann zeigt: nach Uhrzeit („sonntags 9–12 Uhr") oder rund um Termine („30 Minuten vor
Beginn bis 10 Minuten nach Beginn"). Daneben die Playlist, die gerade läuft.

![Zeitpläne: je Screen die Regeln und eine Vorschau der laufenden Playlist](bilder/zeitplaene.png)

## Mediathek

Bilder einmal hochladen und überall verwenden. Unter jedem Bild steht, wo es läuft; „Unbenutzt" hilft beim
Aufräumen.

![Mediathek mit Suche, Filtern und der Angabe, wo ein Bild verwendet wird](bilder/mediathek.png)

## Design

Einmal für alle Screens: Ecken, Akzentfarbe, Farben und Schrift für neue Bausteine, Termine schlicht oder als Karten,
das Format der Bilder – mit Vorschau.

![Design: Einstellungen links, Vorschau rechts](bilder/design.png)

## Am Handy

Der Designer passt sich dem Telefon an: Seiten über ein Menü, Slides und Bausteine zum Aufklappen, die Einstellungen
eines Bausteins als Blatt am unteren Rand – die ganze Slide bleibt darüber im Blick.

<img src="bilder/handy.png" alt="Editor am Handy: oben die Slide, unten das Blatt mit den Einstellungen der Terminliste" width="320">

## Am Fernseher

Ohne Bild, weil es dort nichts zu bedienen gibt: Der Fernseher meldet sich über seine Adresse selbst an, holt
Änderungen in etwa 20 Sekunden, hält Daten und Bilder auf dem Gerät, zeigt bei einem Netzausfall den letzten Stand
und lädt jede Nacht neu. Er braucht weder Tastatur noch Maus.
