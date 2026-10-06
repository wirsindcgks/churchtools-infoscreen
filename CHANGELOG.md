# Changelog

Alle nennenswerten Änderungen am Infoscreen Designer. Aufbau nach [Keep a Changelog](https://keepachangelog.com/de/1.1.0/),
Versionen nach [Semantic Versioning](https://semver.org/lang/de/). Wie eine Version entsteht, steht in
[`LocalTests.md`](LocalTests.md) unter „Release veröffentlichen".

## [0.16.0] – 2026-10-06

### Neu

- **Kartenhintergrund im Design:** Ein neuer Kasten auf der Design-Seite steuert für alle Screens die Fläche hinter
  den Karten – „Leicht getönt" (wie bisher: die Textfarbe scheint leicht durch), „Ohne" oder „Eigene Farbe" mit
  Farbfeld samt Palette und einem Regler für die Deckkraft. Er gilt für die Karte von „Nächster Termin" (Form
  „Modern"), für „Beiträge" und „Gruppen" sowie die Tür-Anzeige der Raumbelegung. Kalender- und Akzentfarben bleiben,
  wie sie sind.
- **Datenmodell:** Schema 1.27 (`cards`, `cardColor`, `cardOpacity` im Design). Ältere Player tönen weiter wie bisher.

### Geändert

- Die Tür-Anzeige der Raumbelegung ist mit „Leicht getönt" einen Hauch heller (7 statt 8 %) – eine Fläche für alle
  Karten.

## [0.15.1] – 2026-10-06

### Behoben

- **Nur wirklich öffentliche Kalender:** Bisher galt jeder Gemeindekalender als öffentlich – auch interne wie ein
  „Interner Kalender", die Besucher in ChurchTools nicht sehen. Der Editor bot sie zur Wahl an, und die Einstellungen
  hätten sie den Fernsehern freigegeben. Öffentlich ist jetzt, was ChurchTools ohne Anmeldung zeigt, also was der
  „Öffentliche Benutzer" sehen darf. Editor, Zeitpläne, Einstellungen und Fernseher halten sich alle daran.

### Geändert

- **Fernseher brauchen kein Kalenderrecht mehr:** Öffentliche Kalender sieht das Gerätekonto ohnehin. „Rechte
  aktualisieren" vergibt „Einzelnen Kalender sehen" nicht mehr und nimmt es der Gerätegruppe zurück. Einmal klicken,
  nachdem die neue Version installiert ist.
- **Wo man einen Kalender freigibt:** Am Kalender-Feld im Editor erklärt ein (i), was „öffentlich" heißt; ist kein
  Kalender öffentlich, steht der Weg direkt da: Berechtigungen → Benutzer → „Öffentlicher Benutzer" → Kalender →
  „Einzelnen Kalender sehen". Das darf, wer in ChurchTools Berechtigungen verwalten darf.
- **Prüfung der Gerätegruppe:** sagt je Kalender der Screens, ob er öffentlich ist, und nennt sonst den Weg zur
  Freigabe – jetzt auch, solange noch kein Geräte-Benutzer in der Gruppe ist. Die Vorschau von „Rechte aktualisieren"
  nennt keine „nicht geprüften" Kalender mehr.

### Dokumentation

- **Einrichtung, Schritt 4:** neuer Absatz „Welche Kalender öffentlich sind"; „Rechte" und „Wenn etwas nicht klappt"
  entsprechend angepasst.

## [0.15.0] – 2026-10-06

### Neu

- **Reihenfolge im Baustein „Gruppen":** Sind alle Gruppen der Homepage gewählt, legt das neue Feld „Reihenfolge" fest,
  wie sie nacheinander erscheinen: nach Wochentag (Montag zuerst, wie bisher), Name A–Z oder Name Z–A. Zahlen im
  Namen zählen als Zahlen – „Hauskreis 2" steht vor „Hauskreis 10". Wer Gruppen einzeln auswählt, ordnet sie weiter
  von Hand; die Auswahl beginnt in der zuletzt gewählten Reihenfolge.
- **Datenmodell:** Schema 1.26 (`sort` am Baustein „Gruppen"). Ältere Bausteine sortieren weiter nach Wochentag.

## [0.14.1] – 2026-10-05

### Geändert

- **Dienste freigeben mit rotem Hinweis:** In den Einstellungen unter „Dienste auf Screens" steht über der Liste ein
  roter Kasten „Datenschutz beachten": Wer einen Dienst freigibt, macht die Namen der Eingeteilten öffentlich – die
  Freigabe sollte vorher mit der Gemeindeleitung abgestimmt sein. Die Rückfrage beim Ankreuzen eines Dienstes fragt
  danach.

### Dokumentation

- **Einrichtung, Schritt 1:** Die Maske „Erweiterung hinzufügen" ist Feld für Feld beschrieben. Das Kürzel muss
  exakt `infoscreen-designer` lauten – mit einem anderen installiert ChurchTools die Extension ohne Fehlermeldung,
  der Menüpunkt zeigt dann aber eine weiße Seite. „Wenn etwas nicht klappt" nennt das Erkennungszeichen.

## [0.14.0] – 2026-10-05

### Neu

- **„Umbenennen" im Menü der Screen-Kachel:** Administratoren ändern den Namen eines Screens direkt über „…" →
  „Umbenennen", ohne Umweg über „Einstellungen".
- **Datenmodell:** Schema 1.25 (`createdGroupTypeId` in den Einstellungen). Ältere Einrichtungen gelten weiter als
  „Merkmal".

### Behoben

- **Einrichtung ohne Gruppentyp „Merkmal":** Der Assistent brach auf Instanzen, die diesen Gruppentyp gelöscht oder
  umbenannt haben, mit „Den Gruppentyp „Merkmal" gibt es auf dieser Instanz nicht." ab. Den Gruppentyp wählt der
  Administrator jetzt selbst; vorgewählt ist „Merkmal", wenn es ihn gibt, darunter steht, worauf es bei der Wahl ankommt.

### Dokumentation

- **Einrichtung, Schritt 2:** Die Tabelle nennt alle neun Rechte des Moduls, auch „Kategorien bearbeiten" und
  „Kategorien löschen" (beides braucht niemand). Rechte ohne Auswahl stehen als „✓ Haken setzen" statt „–".
- **Rechte:** Vor den Tabellen steht, dass die Rechte nur über die Gruppen des Assistenten vergeben werden und danach
  nur noch Personen aufgenommen werden – nie Rechte direkt an Personen.

## [0.13.0] – 2026-10-05

### Neu

- **Vertikale Ausrichtung:** Im Bereich „Schrift" steht neben „Ausrichtung" das Feld „Vertikal" – oben, mittig oder
  unten in der Box. Es gibt es bei Text, Uhr, Countdown, Nächstem Termin und Gemeindekopf. Ohne Wahl bleibt alles,
  wie es war. Passt der Inhalt nicht in die Box, beginnt er oben; der Anfang wird nie abgeschnitten. Fernseher mit
  einem älteren Stand zeigen bis zum Update wie bisher.
- **Datenmodell:** Schema 1.24 (`verticalAlign` in der Schrift). Ältere Slides lesen sich wie bisher.

## [0.12.0] – 2026-10-05

### Neu

- **Zeitpläne mit Zeitleiste:** Jeder Screen ist eine Kachel mit einer Zeitleiste über die nächsten sieben Tage –
  heute oben, mit einer Nadel für jetzt, jede Playlist in ihrer Farbe wie im Zeitplan-Dialog. Darunter stehen die
  Regeln in denselben Farben. Fahrt ihr über eine Regel, leuchten ihre Zeiten auf; ein Klick auf eine Regel oder
  einen Abschnitt zeigt deren Playlist im Bild. Eine Regel für Sonntag ist so auch am Montag zu sehen.
- **Hinweise mit Zeitleiste:** Jeder Hinweis ist eine Kachel mit derselben Zeitleiste. Sie zeigt, wann er
  tatsächlich am Fernseher steht – wann eine seiner Playlists laut Zeitplan auf einem Screen läuft, bis zu seinem
  Ende. Jeder Screen steht in einer eigenen Zeile; fahrt ihr darüber, leuchten seine Zeiten auf. Steht ein Hinweis
  in den nächsten sieben Tagen auf keinem Fernseher, sagt die Kachel das. In der Vorschau steht das Band still.

### Geändert

- **Einheitliche Kacheln:** Screens, Playlists, Zeitpläne, Hinweise und Mediathek zeigen dieselben Kacheln in
  derselben Breite (mindestens 240 px, auf schmalen Bildschirmen 200 px, auf dem Handy eine Spalte). Lange Namen
  brechen um, nichts wird mehr mit „…" abgeschnitten.
- **Mediathek:** Der Dateiname steht als Titel wie auf den anderen Kacheln; jede Verwendung ist eine eigene Zeile mit
  Symbol, „Unbenutzt" nicht mehr kursiv. Der Auswahl-Dialog im Editor zeigt dieselben Kacheln.

## [0.11.0] – 2026-10-05

### Neu

- **Wer und wann, auf jeder Kachel:** Screens, Playlists, Zeitpläne, Hinweise und die Mediathek zeigen, wann und von
  wem zuletzt etwas geändert wurde – Datum mit Uhrzeit und Name, beim Darüberfahren in Langform. In der Mediathek ist
  das das Hochladen, wie ChurchTools es an der Datei führt.
- **Hinweise mit eigenem Stempel:** Ein Hinweis merkt sich, wann und von wem er selbst zuletzt geändert wurde; wer nur
  eine Slide der Playlist speichert, ändert ihn nicht. Hinweise von vor dieser Version zeigen das erst nach ihrer
  nächsten Änderung.
- **Datenmodell:** Schema 1.23 (`updatedAt` und `updatedBy` am Hinweisband). Ältere Playlists lesen sich wie bisher;
  Fernseher ignorieren die Felder.

### Geändert

- **Kacheln:** Die Angaben einer Kachel stehen untereinander, eine je Zeile.
- **Playlists:** Wurde eine verknüpfte Slide aus einer anderen Playlist gespeichert, nennt die Kachel jetzt auch, wer
  das war; bisher blieb der Name dann leer.

## [0.10.1] – 2026-10-05

### Geändert

- **Farbtupfer:** „Auf der Slide" zeigt jetzt alle Farben der Slide, auch freigegebene – eine Farbe aus der Palette
  trägt dort ihren Namen. Bisher fehlte die Gruppe, sobald eine Slide nur freigegebene Farben nutzte.
- **Schrift:** „Großbuchstaben" steht vor der Farbe; die Farbe hat mit ihren Tupfern die volle Breite.
- **Farbtupfer:** Eine Farbe ohne Namen heißt beim Darüberfahren nur noch nach ihrem Hex-Wert.

## [0.10.0] – 2026-10-05

### Neu

- **Großbuchstaben:** Im Bereich „Schrift" jedes Bausteins mit Schrift gibt es das Kästchen „Großbuchstaben". Ihr
  schreibt den Text normal, der Fernseher zeigt ihn in Großbuchstaben; gespeichert bleibt, wie ihr ihn getippt habt.
  Fernseher mit einem älteren Stand zeigen den Text bis zum Update normal.
- **Datenmodell:** Schema 1.22 (`uppercase` in der Schrift). Ältere Slides lesen sich wie bisher.

### Geändert

- **Farbtupfer in zwei Gruppen:** An jedem Farbfeld stehen zuerst die „Farbpalette" (Akzent, Text, Hintergrund und
  eure Palette), darunter „Auf der Slide" – die Farben der gerade bearbeiteten Slide, die nicht in der Farbpalette
  stehen. So seht ihr, was vom Freigegebenen abweicht. Im Dialog der Hinweise gibt es nur die „Farbpalette".

## [0.9.0] – 2026-10-05

### Neu

- **Farbpalette im Design:** Auf der Seite „Design" legt ihr bis zu zwölf Farben eurer Gemeinde mit Namen an
  („Gemeindeblau", „Sonnengelb"), ordnet sie und entfernt sie wieder. Im Editor stehen sie an jedem Farbfeld als
  kleine Tupfer zum Anklicken – zusammen mit Akzent, Text und Hintergrund des Designs, auch ohne Palette. Ein Klick
  übernimmt den Hex-Wert; beim Darüberfahren steht der Name mit Hex-Code. Die Farbe wird kopiert: Ändert ihr eine
  Palettenfarbe später, färbt das bestehende Slides nicht um. Die Tupfer gibt es auch im Dialog der Hinweise.
- **Datenmodell:** Schema 1.21 (`palette` im Design). Ältere Designs lesen sich wie bisher; die Fernseher brauchen die
  Palette nicht.

### Geändert

- **Mediathek:** Das Kästchen zur Auswahl steht ohne weißen Kasten auf dem Bild; ein leichter Schatten hält es auf
  hellen wie dunklen Bildern sichtbar.
- **Anleitung:** Die Rechte für Installation und Einrichtung stehen vollständig in einer Tabelle, getrennt nach
  einmalig und dauerhaft, mit Hinweis, was gemessen ist.

## [0.8.1] – 2026-10-05

### Behoben

- **Video:** Wird bei einem laufenden Video der Ton eingeschaltet – etwa durch eine Änderung im Editor, während der
  Fernseher läuft –, startet das Video neu, statt stehen zu bleiben. Lässt der Browser den Ton ohne Klick nicht zu,
  läuft es stumm weiter.

## [0.8.0] – 2026-10-05

### Wichtig beim Update

Ein Screen, der einen **internen Kalender** (in ChurchTools nicht öffentlich) zeigt, zeigt dessen Termine nach dem
Update nicht mehr. Das nächste „Rechte aktualisieren" nimmt der Gerätegruppe außerdem das Recht an diesem Kalender –
mit Vorschau, bevor etwas geschrieben wird. Interne Termine öffentlicher Kalender („nur für angemeldete Benutzer")
zeigt der Fernseher ebenfalls nicht mehr.

### Geändert

- **Fernseher:** Sie zeigen nur noch Termine aus öffentlichen Kalendern und keine internen Termine. Das gilt auch
  dann, wenn das Gerätekonto über seinen Status oder eine andere Gruppe mehr lesen dürfte.
- **Editor:** Zur Wahl stehen nur öffentliche Kalender. Hat ein Baustein schon einen nicht öffentlichen Kalender,
  nennt ihn der Inspektor („nicht öffentlich, erscheint auf keinem Fernseher") und bietet „Entfernen" an; im
  Zeitplan steht der Kalender als „nicht öffentlich – wird ignoriert".
- **Einrichtungsassistent:** Er vergibt Rechte nur für öffentliche Kalender, die der Administrator selbst sieht.
- **Prüfung der Gerätegruppe:** Sie warnt vor nicht öffentlichen Kalendern in Screens, vor Kalendern, die der
  Administrator nicht sieht, und vor Gerätekonten, die einen internen Kalender lesen dürfen.

### Neu

- **Einstellungen:** Fehlen dir in ChurchTools Gruppenrechte, sind die Knöpfe unter „Gruppen und Rechte" („Gruppen und
  Rechte anlegen", „Rechte aktualisieren", „Automatische Einrichtung rückgängig machen") ausgegraut und nennen, was
  fehlt – statt erst beim Klicken zu scheitern.
- **„Rechte aktualisieren" nimmt zurück:** Kalender, Dienste und Räume, die kein Screen mehr braucht, verlieren ihr
  Recht an den Gruppen des Assistenten – nur für Kalender und Räume, die der Administrator sieht. Vorher zeigt eine
  Vorschau je Gruppe, was dazukommt und was wegfällt; erst „Übernehmen" schreibt.

## [0.7.3] – 2026-10-05

### Geändert

- **Einstellungen:** „Einrichtung entfernen" heißt jetzt „Automatische Einrichtung rückgängig machen". Das alte Wort
  klang nach „alles deinstallieren"; gelöscht werden nur die beiden Gruppen, die der Assistent angelegt hat. Das Wort,
  das man im Dialog eintippt, bleibt „entfernen".
- **Dienste freigeben:** Über der Liste steht ein deutlicher Hinweis, dass die Namen der Eingeteilten öffentlich sind.
  Das Ankreuzen eines Dienstes fragt vorher nach; bei „Abbrechen" bleibt das Kästchen leer und nichts wird gespeichert.
- **Prüfung der Gerätegruppe:** Ist ein Gerätekonto auch Mitglied in anderen Gruppen, nennt die Prüfung sie mit Namen –
  deren Rechte bekommt der Fernseher mit. Die Rechte selbst prüft sie weiterhin nicht.
- **Anleitung:** Das Gerätekonto soll eine eigene Person je Standort sein, kein echtes Personenkonto, und in keiner
  weiteren Gruppe stehen. Das Bearbeitungsrecht am Wiki-Bereich „Infoscreen" ist eng zu vergeben: Wer es hat, kann im Wiki
  Bilder löschen, auch an der Warnung der Mediathek vorbei.

## [0.7.2] – 2026-10-02

### Behoben

- **Mediathek:** Das Kästchen zur Auswahl liegt jetzt auch in ChurchTools oben links auf dem Bild oder Video. Die
  Korrektur aus 0.7.1 griff dort nicht: ChurchTools hat eine eigene Regel für den Namen, den das Feld um das Kästchen
  trug, und schob es unter das Bild.
- **Mediathek:** Die Dateiliste im Löschdialog ist gegen eine gleichnamige Regel von ChurchTools abgesichert, die ihr
  Aufzählungspunkte und Einzug gegeben hätte.

## [0.7.1] – 2026-10-02

### Behoben

- **Mediathek:** Das Kästchen zur Auswahl liegt jetzt sicher oben links auf dem Bild oder Video. In ChurchTools
  rutschte es unter das Bild in die Beschreibung; auf dunklen Bildern hebt es sich jetzt durch einen hellen Grund ab.

## [0.7.0] – 2026-10-02

### Neu

- **Playlists:** Jede Kachel zeigt, wann die Playlist zuletzt bearbeitet wurde; beim Überfahren stehen Uhrzeit und
  Name dabei. Es zählt die jüngste Speicherung der Playlist oder einer ihrer Slides – auch wenn eine verknüpfte Slide
  über eine andere Playlist geändert wurde.
- **Mediathek:** Dateien lassen sich über ein Kästchen auf der Kachel auswählen – eine oder mehrere, dazu „Alle
  auswählen" für das, was Suche und Filter gerade zeigen – und gemeinsam löschen. Vorher nennt ein Dialog jede Datei.
  Läuft eine noch auf einer Slide, steht dort, wo (Screen › Playlist › Slide), mit dem Hinweis auf die leere Fläche;
  „Nur unbenutzte löschen" spart diese Dateien aus.

### Geändert

- **Mediathek:** Die Kacheln sehen aus wie die der Screens und Playlists. Auf der Seite „Mediathek" ersetzt die
  Auswahl den Link „Löschen" an der einzelnen Kachel; im Auswahl-Dialog des Editors bleibt er.

## [0.6.4] – 2026-10-02

### Geändert

- **Einstellungen → Gruppen und Rechte:** Ein zugeklappter Bereich ist jetzt eine einzige Zeile. Statt des ganzen
  Textes einer Warnung steht dort, was im Bereich wartet – „1 Warnung", „1 Fehler, 2 Warnungen", „1 Hinweis" –, und
  das Symbol zeigt den schwersten Fall. Der Text selbst steht aufgeklappt, mit seiner Erläuterung.

## [0.6.3] – 2026-10-02

### Behoben

- **Einstellungen → Gruppen und Rechte:** Ein aufgeklappter Bereich zeigte seine Warnung zweimal – am Kopf und
  darunter. Aufgeklappt steht sie jetzt nur noch einmal, mit ihrer Erläuterung; zugeklappt bleibt sie am Kopf.

## [0.6.2] – 2026-10-02

### Geändert

- **Einstellungen → Gruppen und Rechte:** Die Prüfung steht jetzt nach Bereichen geordnet – Gruppe, Kalender, Räume,
  Dienste, Infoscreen Designer, Mediathek und Videos, Weitere Rechte – und jeder Bereich lässt sich auf- und
  zuklappen. Fehlt etwas, steht es schon am zugeklappten Bereich; aufgeklappt folgen alle Zeilen mit ihrer
  Erläuterung. Bei vielen Kalendern und Räumen bleibt die Seite so kurz.

### Neu

- **Fehler melden und Funktionen vorschlagen:** Auf GitHub führen jetzt Formulare durch eine Meldung – sie fragen
  nach Bereich, Rolle, Version und Gerät und erinnern daran, keine Adresse eines Fernsehers und keine Personendaten
  einzufügen.

## [0.6.1] – 2026-10-02

### Behoben

- **Editor:** In einer Playlist mit vielen Slides ragte das Vorschaubild rechts über den Rahmen seiner Kachel, sobald
  die Liste scrollte und der Rollbalken Platz nahm – etwa mit angeschlossener Maus. Das Vorschaubild richtet sich
  jetzt nach der Breite der Liste.

### Geändert

- **Rechte der Gerätekonten in Klartext:** Die Prüfung unter **Einstellungen → Gruppen und Rechte** nennt ein Recht,
  das ein Gerät nicht braucht, jetzt so, wie es in der Rechteverwaltung von ChurchTools heißt – etwa „Personen:
  Eigene Personendaten bearbeiten". „Eigene Personendaten sehen" zählt nicht mehr dazu: Es kommt mit dem üblichen
  Personenstatus und reicht nicht über das eigene Konto hinaus. Was etwas ändern kann, wird weiter genannt.

## [0.6.0] – 2026-10-02

Eine Durchsicht auf Sicherheit und Datenschutz, bevor das Modul weitergegeben wird. Eine ausnutzbare Lücke fand sich
nicht; diese Version schließt, was offen stand.

### Geändert

- **Dienste erscheinen nur noch nach Freigabe.** Unter **Einstellungen → Dienste auf Screens** legt ein Administrator
  fest, welche Dienste mit Namen auf einem Fernseher stehen dürfen – etwa nur „Predigt". Gestalter wählen nur aus
  diesen. **Nach dem Update zeigt ein Screen Dienste erst wieder, wenn sie freigegeben sind.**
- **Der Baustein „Webseite" bettet das eigene ChurchTools nicht mehr ein.** Der Inspektor sagt es, wenn eine solche
  Adresse eingetragen ist; fremde Seiten laufen wie bisher.
- **Lizenz:** Der Designer steht jetzt unter der GNU General Public License, Version 3 oder später (bisher Version 2
  oder später) – sie verträgt sich mit den Lizenzen aller mitgelieferten Bibliotheken.

### Neu

- **Die Prüfung der Gerätegruppe nennt Rechte, die ein Gerät nicht braucht.** Die Adresse eines Fernsehers trägt die
  Rechte seines Kontos; hat es mehr als nötig – meist aus dem Personenstatus –, steht das jetzt unter
  **Einstellungen → Gruppen und Rechte**, mit dem Namen des Rechts.
- **Lizenztexte im Paket:** Das ZIP enthält die Lizenz des Designers und die aller mitgelieferten Bibliotheken.

### Behoben

- **Bilder und Videos kommen nur noch von der eigenen Instanz.** Ein Eintrag der Mediathek, der auf einen fremden
  Server zeigt, bleibt leer.
- Die alten Adressen `/einrichtung` und `/einrichtung#fernseher` gibt es nicht mehr; die Einstellungen stehen unter
  `/einstellungen`.

## [0.5.0] – 2026-10-01

### Neu

- **Galerie mit Bewegung:** Bilder können, während sie stehen, langsam hinein- oder herauszoomen – oder abwechselnd.
  Das neue Feld „Bewegung" gilt mit jedem Übergang. Den bisherigen Übergang „Heranzoomen" gibt es dafür nicht mehr;
  eine Galerie, die ihn nutzt, läuft unverändert und zeigt sich als „Überblenden" mit „Langsam hineinzoomen".
- **Einbettungscode im Baustein „Webseite":** Anbieter von Karten, Umfragen oder Pinnwänden geben oft einen
  „iframe"-Code heraus statt einer Adresse. Er lässt sich jetzt ins Adressfeld einfügen; übernommen wird nur die
  Adresse darin.

### Behoben

- **Mediathek:** Wer in der Vorschau das 31. Bild für eine Galerie markieren will, sieht den Hinweis „Höchstens 30
  Bilder je Galerie" jetzt in der Vorschau – bisher lag er dahinter.
- **Einrichtung:** Der Assistent legt keinen zweiten Wiki-Bereich „Infoscreen" mehr an, wenn es schon einen gibt, den
  der Administrator nicht sieht. Er bricht ab, bevor er etwas anlegt, und sagt, welches Recht fehlt. Dafür braucht,
  wer den Assistenten startet, das Recht, das Wiki zu sehen.

## [0.4.2] – 2026-10-01

### Geändert

- **Zeitpläne:** Ein Klick auf das Bild eines Screens öffnet jetzt seinen Zeitplan, wie der Knopf „Bearbeiten" –
  bisher ging dort der Editor der Playlist auf. In den Editor führt der Name der Playlist unter dem Bild.

## [0.4.1] – 2026-10-01

### Neu

- **Vorschau in der Mediathek:** Ein Klick auf eine Kachel öffnet das Bild oder Video groß – so, wie ein Fernseher
  es zeigt. Der Hintergrund lässt sich zwischen „Dunkel", „Hell" und „Karo" umschalten: Freigestellte Grafiken
  wirken auf Weiß anders als auf einer dunklen Slide, und das Karo zeigt, was durchsichtig ist. Daneben stehen Name,
  Maße, Länge, Datum und alle Stellen, an denen die Datei läuft. Mit den Pfeilen oder den Pfeiltasten blättert man
  durch die Dateien, die gerade zu sehen sind.
- **Vorschau beim Auswählen:** Im Editor öffnet das Auge auf einer Kachel der Mediathek die Vorschau; dort steht
  auch „Verwenden" bzw. bei der Galerie „Markieren".

## [0.4.0] – 2026-10-01

### Neu

- **Baustein „Video":** Ein eigenes Video aus der Mediathek auf der Slide – MP4 (H.264) bis 128 MB. Die Slide dauert
  mindestens so lange wie das Video; dauert sie länger, läuft es in Schleife. **Ton** ist je Baustein einschaltbar
  und zunächst aus; verweigert der Browser des Fernsehers den Ton, läuft das Video stumm. Die Vorschau im Designer
  spielt stumm und bietet den Ton auf einem Knopf an. **Ohne Netz zeigt der Fernseher an dieser Stelle nichts** –
  Videos liegen, anders als Bilder, nicht auf dem Gerät. Auf einem Kiosk-Gerät ist der Baustein noch nicht im
  Dauerbetrieb geprüft.
- **Videos in der Mediathek:** Hochladen, Löschschutz und „Wo läuft es" wie bei Bildern; eine Kachel zeigt ein
  Standbild und die Länge. Wo ein Bild verlangt ist, werden keine Videos angeboten – und umgekehrt.

### Geändert

- **Geräte sehen den Wiki-Bereich „Infoscreen":** Videos gibt ChurchTools nur über die Download-Adresse der Datei
  heraus, und die verlangt dieses Recht. „Rechte aktualisieren" vergibt es an die Geräte-Gruppe; die
  Einstellungsseite meldet, wenn es fehlt. „Wiki" sehen und das Bearbeiten braucht ein Gerät weiterhin nicht.
- Die Seite „Mediathek" spricht von Dateien statt von Bildern.

## [0.3.9] – 2026-10-01

### Neu

- **Dienste am Termin:** Der „Nächste Termin" und die Terminliste als Karten zeigen, wer einen Dienst übernimmt –
  „Predigt: Anna Beispiel". Im Inspektor unter „Dienste zeigen" wählt man bis zu sechs Dienste. Gezeigt werden nur
  **zugesagte** Einteilungen und nur Dienste aus Dienstgruppen, die in ChurchTools „Ohne Berechtigung einsehbar"
  sind; Dienste, deren Personenname verborgen ist, erscheinen nie. Auf den Bildschirm kommt nur der Name – kein
  Bild, kein Kommentar, nicht, wer angefragt hat. Dafür bekommt das Gerät mit „Rechte aktualisieren" das Recht,
  die Events der Kalender dieser Bausteine zu sehen.
- **Räume je Kalender:** Unter „Raum zeigen" lässt sich je gewähltem Kalender abschalten, ob die gebuchten Räume am
  Termin stehen – etwa für Veranstaltungen, die viele Räume buchen. Ein eingetragener Ort bleibt stehen.

### Geändert

- **Terminliste als Karten, neu geordnet:** Links stehen Datum, Uhrzeit und darunter Ort und Raum, rechts Titel,
  Untertitel und die Dienste – höchstens drei Zeilen je Termin. Der Abstand links und rechts vom Datum ist gleich,
  und die Datumsspalte ist auf jeder Seite gleich breit, sodass beim Seitenwechsel nichts verrutscht. Datum und
  Uhrzeit sind nicht mehr fett; ein langer Ort endet mit „…".

## [0.3.8] – 2026-09-30

### Neu

- **Baustein „Raumbelegung":** Welcher Raum ist heute belegt – als Übersicht mehrerer Räume oder als Türschild eines
  Raums („Jetzt" oder „Frei", danach die nächsten Buchungen), für heute oder heute und morgen. Nur Räume, keine
  Gegenstände und Fahrzeuge; nur bestätigte Buchungen. Je Raum ein Wegweiser wie „1. OG, links" und der Schalter
  „Titel zeigen" – aus, steht dort nur „Belegt", etwa für den Seelsorgeraum. Der Einrichtungsassistent gibt den
  Gestaltern das Recht, alle Räume zu sehen, und dem Gerät die Räume, die ein Screen zeigt.
- **Der Raum am Termin:** Der „Nächste Termin" und die Terminliste als Karten zeigen neben dem Ort den gebuchten Raum
  („Kirchsaal · Saal"), abschaltbar mit „Raum zeigen". Dafür bekommt das Gerät mit „Rechte aktualisieren" das Recht,
  alle Räume zu sehen; am Termin steht nur der Raumname, nie der Titel einer Buchung.
- Beide zeigen nur **bestätigte** Buchungen – eine Anfrage, die noch wartet, erscheint nicht; der Inspektor sagt das.

### Geändert

- **Schalter mit Info-Kreis** im Inspektor sind so groß wie die anderen Schalter.
- **Testversionen erkennbar:** Ein Build mit noch nicht gespeicherten Änderungen heißt unter „Über & Neuigkeiten"
  jetzt z. B. „0.3.7+612cd6f-dirty" und gibt sich nicht mehr als die veröffentlichte Version aus.

## [0.3.7] – 2026-09-30

### Neu

- **Verknüpfte Slides:** Eine Slide kann in mehreren Playlists stehen und bleibt überall gleich – etwa die Begrüßung.
  „Aus anderer Playlist …" und „Duplizieren" fragen jetzt: als Kopie (wie bisher, die Vorgabe) oder verknüpft.
  Verknüpfte Slides tragen ein Kettensymbol; im Inspektor steht, wo sie noch laufen, und „Verknüpfung lösen" macht
  daraus eine eigene Kopie. Hat jemand die Slide inzwischen in einer anderen Playlist geändert, speichert der Editor
  nichts, sondern fragt: neu laden oder als eigene Kopie behalten. Nach dem Speichern sagt eine kurze Meldung, wenn
  verknüpfte Slides dabei waren und wo sie noch laufen.

### Geändert

- **Speichern schreibt nur geänderte Slides:** Unveränderte Slides einer Playlist bleiben beim Speichern unberührt.

## [0.3.6] – 2026-09-30

### Neu

- **Baustein „Galerie":** bis zu 30 Bilder aus der Mediathek nacheinander in einem Baustein, etwa für Impressionen vom
  letzten Gemeindefest. Übergänge: Überblenden, Schieben, Aufdecken, Heranzoomen oder ohne; Dauer je Bild 3–60 Sekunden,
  Einpassen oder Fläche füllen. Die Slide läuft, bis jedes Bild einmal zu sehen war. Die Bilder liegen wie alle anderen
  auf dem Gerät, die Galerie läuft also auch ohne Netz. Ein Player vor dieser Version lässt den Baustein aus.
- **Mehrere Bilder auf einmal wählen:** Für die Galerie markiert man in der Mediathek mehrere Bilder – mit Nummer in
  der gewählten Reihenfolge – und übernimmt sie mit „Hinzufügen".

## [0.3.5] – 2026-09-30

### Geändert

- **Kopf des Inspektors:** Oben steht jetzt „Slide 2 von 5" – auch wenn ein Baustein gewählt ist. Die Überschrift
  „Slide" über dem Namensfeld ist weg; jeder Name steht nur noch einmal da. Am Handy bleibt die Leiste unten wie bisher.

### Behoben

- **Trennlinien und Karten auf hellen Slides:** Die Linien zwischen Terminen, Beiträgen und Gruppen und die hinterlegten
  Karten waren festes Weiß und auf hellem oder grauem Hintergrund nicht zu sehen. Sie nehmen ihren Ton jetzt aus der
  Textfarbe des Bausteins.

## [0.3.4] – 2026-09-30

### Behoben

- **Kalenderfarben als Name:** ChurchTools liefert eine Kalenderfarbe auch als Wort, etwa `black`. Etiketten und
  Datumskacheln solcher Kalender waren auf weißen Slides unsichtbar. Die Farbe wird jetzt wie im WordPress-Plugin
  `connect-churchtools` unverändert übernommen und im Browser getönt; die Schrift auf dem Etikett wählt dunkel oder
  weiß nach der Leuchtdichte der Farbe.
- **Ladebalken beim Blättern** (Terminliste, Gruppen) steht mittig auf Höhe der Seitenzahl.

## [0.3.3] – 2026-09-30

Feinschliff am Editor nach dem Test im Testsystem.

### Geändert

- **Kopf der Einstellungen zweizeilig:** oben der Baustein, darunter „Sperren" und „Löschen" gleich breit – auch bei
  langen Namen wie „Nächster Termin" bricht nichts mehr um. Am Handy bleibt es eine Zeile mit Symbolen.
- **„Hilfslinien"** steht jetzt neben dem Raster-Symbol; das Symbol allein war nicht zu erkennen.

### Behoben

- Der Knopf **„<" zum Einklappen der Slides** war in ChurchTools unsichtbar (im Demo-Modus nicht): Sein Klassenname
  stieß mit einer Hilfsklasse von ChurchTools zusammen. Ein Test fängt solche Namen künftig ab.
- Auf dem Tablet und in schmalen Fenstern fehlte in der aufgeklappten Slides-Liste der Knopf zum Zuklappen.

## [0.3.2] – 2026-09-30

Neu: ein **ruhigerer Editor** – weniger auf einmal, alles weiter erreichbar.

### Geändert

- **Bausteine alphabetisch:** „+ Baustein" gibt es jetzt auch am Rechner und zeigt alle Bausteine von „Beiträge" bis
  „Webseite". Die Leiste mit zwölf Knöpfen über der Slide ist weg, die Slide bekommt mehr Höhe.
- **Einstellungen zum Aufklappen:** Oben steht, worum es beim Baustein geht – Text, Kalender, Homepage. „Schrift" und
  „Position & Ebene" sind zugeklappt und zeigen in einer Zeile, was eingestellt ist; was man einmal aufklappt, bleibt
  offen. Genauso „Angaben" bei Gruppen sowie „Hintergrund" und „Playlist" bei der Slide.
- **Sperren und Löschen** stehen im Kopf der Einstellungen, die Ebene ist eine Zeile aus vier Symbolen; Duplizieren
  und Entfernen einer Slide sind Symbole. Längere Erklärungen öffnet ein ⓘ, Warnungen bleiben sichtbar.
- **Aufgeräumt:** Trennlinien statt Kästen, weniger Farbe; die Köpfe von Slides, Bausteinleiste und Einstellungen
  stehen auf einer Linie, eingeklappte Leisten haben Luft um ihre Knöpfe, „Einklappen" ist ein Pfeil.

### Behoben

- Die **Anzahl der Screens** in der Seitenleiste fehlte auf allen Seiten außer der Startseite.

## [0.3.1] – 2026-09-30

Neu: der Designer **auf dem Tablet**, und am Rechner lassen sich die Seitenspalten einklappen.

### Hinzugefügt

- **Tablet:** Die Slide nimmt fast die ganze Breite ein – auf einem iPad hochkant etwa 760 statt 290 Pixel. Die
  Slides stehen als schmale Leiste am linken Rand und klappen als Liste auf; nach der Wahl einer Slide klappt sie
  wieder zu. Die Bausteine kommen über **„+ Baustein"**.
- **Die Einstellungen eines Bausteins verdecken die Slide nicht:** Auf dem Tablet hochkant öffnen sie als Blatt am
  unteren Rand wie am Handy, die ganze Slide bleibt darüber; quer stehen sie als Spalte daneben und lassen sich mit
  „Einklappen" zur Leiste machen.
- **Am Rechner einklappbar:** Slides und Einstellungen lassen sich je zu einer schmalen Leiste einklappen, die Slide
  wächst mit. Der Browser merkt sich das für den nächsten Besuch.

## [0.3.0] – 2026-09-29

Neu: der Baustein **Gruppen** – was es in der Gemeinde für Gruppen gibt, direkt aus ChurchTools, mit QR-Code zum
Anmelden.

### Hinzugefügt

- **Baustein „Gruppen":** zeigt die Gruppen einer Gruppen-Homepage aus ChurchTools – alle, nach Wochentag sortiert,
  oder eine Auswahl in eigener Reihenfolge. Je Gruppe Name, Bild, Wochentag und Uhrzeit, Zielgruppe, Kategorie,
  Beschreibung, freie Plätze und ein **QR-Code auf die öffentliche Gruppenseite**, jede Angabe einzeln abschaltbar.
  Als **Karten** mit ein bis vier Gruppen je Seite oder als **Liste**, seitenweise mit Ladebalken und Seitenzahl wie
  die Terminliste.
- **Leitung und Bild der Leitung** lassen sich zuschalten. Beides ist aus, bis man es einschaltet, und erscheint nur,
  wenn die Gruppen-Homepage in ChurchTools die Leiter ohnehin öffentlich zeigt.
- Der Baustein zeigt nur, was ChurchTools auf der Gruppen-Homepage öffentlich zeigt – Gruppen ohne öffentliche Seite
  nie, auch wenn das Konto des Fernsehers mehr sehen dürfte.

### Behoben

- **Die Vorschau im Editor zeigte keine Beiträge** („Keine aktuellen Beiträge"), obwohl der Fernseher sie zeigte.
- **Fett gesetzter Text in Beiträgen** war auf dunklen Karten kaum zu lesen.

## [0.2.13] – 2026-09-29

Die Vorschau lässt sich am Handy wieder bedienen.

### Behoben

- **Die Steuerleiste der Vorschau verschwand am Handy** und kam nicht wieder – man konnte weder anhalten noch
  schließen. Auf Touch-Geräten bleibt sie jetzt eingeblendet. Am Rechner blendet sie sich weiterhin aus, damit die
  Vorschau aussieht wie der Fernseher, und kommt mit Maus, Klick oder Tippen zurück.

## [0.2.12] – 2026-09-29

Beim Bearbeiten am Handy bleibt die ganze Slide im Blick.

### Geändert

- **Einstellungen im Editor am Handy** nehmen höchstens die untere Hälfte des Bildschirms ein und scrollen in sich.
  Die Slide darüber wird so weit verkleinert, dass sie ganz zu sehen ist – auch im Hochformat, nach dem Drehen des
  Telefons und wenn man die Einstellungen der Slide über die Leiste unten öffnet.

## [0.2.11] – 2026-09-29

Nachgebessert nach dem zweiten Test am iPhone.

### Geändert

- **Slides im Editor am Handy** sind kleiner und passen nebeneinander: unter dem Bild nur Nummer und Dauer,
  „Neue Slide" und „Aus anderer Playlist" als Symbole daneben. Der Knopf zum Zuklappen ist deutlicher zu erkennen.
- **Beim Bearbeiten am Handy nur die Slide:** Solange die Einstellungen unten offen sind, verschwinden die Slides
  und „+ Baustein"; darüber steht nur die Slide, an der man arbeitet. Die Einstellungen öffnen sich erst, wenn der
  Finger losgelassen ist, damit ein Baustein beim Ziehen nicht verrutscht.

### Behoben

- **Zugeklappte Slides blieben am Rechner verschwunden,** wenn man das Fenster erst schmal und dann wieder breit
  zog. Zugeklappt wird jetzt nur in Handy-Breite.

## [0.2.10] – 2026-09-29

Nachgebessert nach dem ersten Test am iPhone.

### Geändert

- **Slides im Editor am Handy:** Die Reihe der Slides ist kleiner und lässt sich zuklappen. Zugeklappt zeigt der
  Kopf die gewählte Slide; Duplizieren und Entfernen stehen als Symbole daneben. Der Browser merkt sich, ob die
  Reihe offen ist.

### Behoben

- **Am iPhone ließ sich der Editor seitlich verschieben,** nachdem man ein Feld angetippt hatte: iOS zoomt bei
  kleiner Schrift in das Feld hinein. Felder haben auf Touch-Geräten jetzt 16 px Schrift, und die Einstellungen
  eines Bausteins scrollen nur noch nach oben und unten.

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

[0.16.0]: https://github.com/wirsindcgks/churchtools-infoscreen/releases/tag/v0.16.0
[0.15.1]: https://github.com/wirsindcgks/churchtools-infoscreen/releases/tag/v0.15.1
[0.15.0]: https://github.com/wirsindcgks/churchtools-infoscreen/releases/tag/v0.15.0
[0.14.1]: https://github.com/wirsindcgks/churchtools-infoscreen/releases/tag/v0.14.1
[0.14.0]: https://github.com/wirsindcgks/churchtools-infoscreen/releases/tag/v0.14.0
[0.13.0]: https://github.com/wirsindcgks/churchtools-infoscreen/releases/tag/v0.13.0
[0.12.0]: https://github.com/wirsindcgks/churchtools-infoscreen/releases/tag/v0.12.0
[0.11.0]: https://github.com/wirsindcgks/churchtools-infoscreen/releases/tag/v0.11.0
[0.10.1]: https://github.com/wirsindcgks/churchtools-infoscreen/releases/tag/v0.10.1
[0.10.0]: https://github.com/wirsindcgks/churchtools-infoscreen/releases/tag/v0.10.0
[0.9.0]: https://github.com/wirsindcgks/churchtools-infoscreen/releases/tag/v0.9.0
[0.8.1]: https://github.com/wirsindcgks/churchtools-infoscreen/releases/tag/v0.8.1
[0.8.0]: https://github.com/wirsindcgks/churchtools-infoscreen/releases/tag/v0.8.0
[0.7.3]: https://github.com/wirsindcgks/churchtools-infoscreen/releases/tag/v0.7.3
[0.7.2]: https://github.com/wirsindcgks/churchtools-infoscreen/releases/tag/v0.7.2
[0.7.1]: https://github.com/wirsindcgks/churchtools-infoscreen/releases/tag/v0.7.1
[0.7.0]: https://github.com/wirsindcgks/churchtools-infoscreen/releases/tag/v0.7.0
[0.6.4]: https://github.com/wirsindcgks/churchtools-infoscreen/releases/tag/v0.6.4
[0.6.3]: https://github.com/wirsindcgks/churchtools-infoscreen/releases/tag/v0.6.3
[0.6.2]: https://github.com/wirsindcgks/churchtools-infoscreen/releases/tag/v0.6.2
[0.6.1]: https://github.com/wirsindcgks/churchtools-infoscreen/releases/tag/v0.6.1
[0.6.0]: https://github.com/wirsindcgks/churchtools-infoscreen/releases/tag/v0.6.0
[0.5.0]: https://github.com/wirsindcgks/churchtools-infoscreen/releases/tag/v0.5.0
[0.4.2]: https://github.com/wirsindcgks/churchtools-infoscreen/releases/tag/v0.4.2
[0.4.1]: https://github.com/wirsindcgks/churchtools-infoscreen/releases/tag/v0.4.1
[0.4.0]: https://github.com/wirsindcgks/churchtools-infoscreen/releases/tag/v0.4.0
[0.3.9]: https://github.com/wirsindcgks/churchtools-infoscreen/releases/tag/v0.3.9
[0.3.8]: https://github.com/wirsindcgks/churchtools-infoscreen/releases/tag/v0.3.8
[0.3.7]: https://github.com/wirsindcgks/churchtools-infoscreen/releases/tag/v0.3.7
[0.3.6]: https://github.com/wirsindcgks/churchtools-infoscreen/releases/tag/v0.3.6
[0.3.5]: https://github.com/wirsindcgks/churchtools-infoscreen/releases/tag/v0.3.5
[0.3.4]: https://github.com/wirsindcgks/churchtools-infoscreen/releases/tag/v0.3.4
[0.3.3]: https://github.com/wirsindcgks/churchtools-infoscreen/releases/tag/v0.3.3
[0.3.2]: https://github.com/wirsindcgks/churchtools-infoscreen/releases/tag/v0.3.2
[0.3.1]: https://github.com/wirsindcgks/churchtools-infoscreen/releases/tag/v0.3.1
[0.3.0]: https://github.com/wirsindcgks/churchtools-infoscreen/releases/tag/v0.3.0
[0.2.13]: https://github.com/wirsindcgks/churchtools-infoscreen/releases/tag/v0.2.13
[0.2.12]: https://github.com/wirsindcgks/churchtools-infoscreen/releases/tag/v0.2.12
[0.2.11]: https://github.com/wirsindcgks/churchtools-infoscreen/releases/tag/v0.2.11
[0.2.10]: https://github.com/wirsindcgks/churchtools-infoscreen/releases/tag/v0.2.10
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
