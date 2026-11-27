# Arbeitsregeln für Agenten

Dieses Repository entwickelt den **ChurchTools Infoscreen Designer**, ein ChurchTools Custom Module (CCM).
**Stand 2026-09-24: Datenmodell, Player und Designer laufen gegen den Mock** (Vue 3, Vite, Vitest, Playwright, CI);
was bis zum MVP fehlt, steht priorisiert in `Plan.md`, „Nächste Schritte". `npm run dev` läuft gegen die Testinstanz über den Vite-Proxy; `npm test` braucht keine Instanz,
`npm run smoke` schon.
Einrichten, Starten, Beenden und Testen beschreibt [`LocalTests.md`](LocalTests.md).

## Die vier Dokumente

| Datei | Rolle | Wann sie gilt |
| --- | --- | --- |
| [`Plan.md`](Plan.md) | **Gedächtnis** – was gebaut wird und warum | Bei jeder Frage nach Architektur, Zuschnitt, Reihenfolge |
| [`Preparation.md`](Preparation.md) | **Arbeitsliste** – was als Nächstes zu tun ist | Beim Abhaken von Phase-0-Punkten |
| [`Befunde.md`](Befunde.md) | **Messprotokoll** – worauf sich beides stützt | **Alle Verweise „G1" bis „G21" zeigen hierher** |
| [`README.md`](README.md) | Außendarstellung, Abgrenzung zum Hersteller | Bei allem, was nach außen geht |

Ein Befund gehört nach `Befunde.md`, eine Festlegung nach `Plan.md`, ein Handgriff nach `Preparation.md`.
Wer eine Messung in den Plan schreibt, bläht ihn auf – genau das ist am 2026-09-23 korrigiert worden.

**Was offen ist, steht vollständig in `Plan.md`, „Auf einen Blick"** – mehr muss dafür niemand lesen. Erledigte
Punkte liegen wörtlich und mit ihrer Nummer in [`docs/Plan-Archiv.md`](docs/Plan-Archiv.md) (seit dem 2026-10-01);
dorthin zeigen Verweise im Code wie „Plan.md 47". Das Archiv wird nur gezielt nach einer Nummer durchsucht, nie
ganz geladen. Mit jedem Release wandert der veröffentlichte Punkt aus dem Plan ins Archiv; was an ihm offen bleibt,
kommt als eigene Zeile in „Auf einen Blick".

## Fünf Regeln, die Geld gekostet haben

1. **Der Pitch ist der Taktgeber, nicht das gerade Messbare.** Ist etwas durch den Hersteller blockiert, nicht in
   die nächstgelegene unblockierte Nische ausweichen, sondern fragen, was am **Produkt** weitergeht. Blockaden
   hängen hier typischerweise am Speichern und Ausliefern – und das steht am Ende, nicht am Anfang.
   *(Der Plan war einmal auf 63 % Plattformarchäologie gegen 20 % Produkt gelaufen.)*

2. **Zu ChurchTools-Verhalten vorab in der [ChurchTools Academy](https://churchtools.academy/de/) recherchieren**,
   nicht erst, wenn eine Messung unklar bleibt. **Die API zeigt Zustände, die Dokumentation zeigt Regeln.**
   Beispiel: Dass Berechtigungen rein **additiv** sind und dass die Rechte einer Gruppe erst bei Status „Aktiv"
   wirken, hätte keine Messung gezeigt – beides hätte die Einrichtungsanleitung falsch gemacht.
   Messung und Doku gegeneinander halten, beides mit Quelle vermerken.

3. **Ein `404` der ChurchTools-API beweist nichts.** Jede Prüfung läuft angemeldet und mit ausreichenden Rechten,
   sonst ist ihr Ergebnis wertlos. Dazu: Die OpenAPI-Spezifikation wird **pro Benutzer und Rechten gefiltert**
   ausgeliefert – ein Snapshot aus einer Sitzung ohne das nötige Recht ist schlimmer als keiner.

4. **Die API ist die Referenz, nicht der plausible Feldname.** Vor jeder Änderung an datengetriebenen Teilen gegen
   die Spezifikation **der eigenen Instanz** prüfen. Fremde Typ-Snapshots veralten: Der aus `ct-pass-store`
   (2025-09-02) führte Felder, die es auf Build 32882 nicht gibt.

5. **Fehlende Rechte sehen nicht wie Fehler aus.** Drei Verhaltensweisen treten nebeneinander auf und sind von
   außen nicht zu unterscheiden: `403` mit Klartext, `200` mit still gefilterter Liste, `200` mit leerer Liste.
   Wer „die Liste ist leer" als „es gibt nichts" liest, misst falsch. Einzelheiten in `Befunde.md`, G20.

## Was ohne Rückfrage nicht passiert

- **Schreibende Zugriffe auf die Testinstanz werden vorher besprochen.** Der Nutzer hat Schreibrechte erteilt –
  mit der ausdrücklichen Auflage, jede Änderung vorher zu erklären. Lesen ist frei.
- **Gegen die Produktivinstanz wird nichts geschrieben und nichts aufgezeichnet.** Lesende Stichproben sind in
  Ordnung.
- **An bestehenden Rollen der Rechteverwaltung wird nichts geändert** – dafür gibt es eine eigene Testgruppe.

## Ordnung im Inspektor

*Seit 2026-10-15 (Nutzer: „Das sollten wir zukünftig immer mitdenken").* Jedes neue Feld an einem Baustein bekommt
seinen Platz nach diesen Regeln, statt lose angehängt zu werden; wer plant, legt den Platz im Auftrag fest. Begründung
und Iststand in `docs/Plan-Archiv.md`, Punkt 88; was offen ist, in `Plan.md`, Punkt 88.

- **Reihenfolge:** Kopf → Inhalt (lose) → Auswahl-Klappmenüs mit Fachnamen (Kalender, Gruppen, Räume …) →
  „Angaben" → „Darstellung" → „Schrift" → Drehung und Deckkraft → Anordnen → Genaue Maße.
- **„Angaben" ist überall dasselbe Klappmenü** *(seit 2026-11-23, Plan.md 128)*: Titel „Angaben", Zusammenfassung
  „n von m", immer da (auch leer). Feste Angaben als Schalter; offene Angaben als sortierbare Liste mit „+ Angabe" als
  letzter Zeile im Klappmenü – nie außerhalb.
- **Lose steht nur der Inhalt** (was den Baustein füllt), alles andere in einem Klappmenü, immer `InspectorSection`.
- **„Darstellung" ist immer ein Klappmenü** (Kacheln zuerst, dann Zeitraum, Anzahl, Dauer, Schalter, Farben), nie die
  Beschriftung eines Feldes. **„Schrift"** enthält nur, was den Text betrifft.
- **Zum Start sind alle Klappmenüs zu** (Ausnahme: „Bausteine", wenn nichts gewählt ist).
- **Immer nur ein Klappmenü offen** – öffnet man eins, schließt sich das andere (Gruppe über `InspectorSection`); ausgenommen
  ist nur „Bausteine". Neue Seiten mit Klappmenüs geben ihnen eine eigene Gruppe.
- **Ohne gewählten Baustein stehen Trenner zwischen den Ebenen** („Auf der Folie", „Diese Folie", „Ganze Präsentation",
  `InspectorDivider`); „Folie" bis „Präsentation" sind dort, wo der Inspektor eine Spalte ist, am unteren Rand angeheftet
  (Plan.md 133). Ein neuer Abschnitt dieser Ebenen kommt in `SlideInspector`, ein neuer Trenner nur für eine neue Ebene.
- **Jedes Klappmenü hat eine Zusammenfassung in Worten;** Titel höchstens drei Wörter.
- **Das (i) am Ende der Zeile, die es erklärt,** oder im Titel des Klappmenüs – nie eine Zeile nur fürs (i).
- **Ein Bedienelement je Art,** Felder untereinander, kein Klappmenü im Klappmenü.

## Planen und Umsetzen

*Versuch seit 2026-09-25: Spart die Aufteilung Token, ohne dass die Qualität leidet?*

- **Geplant und entschieden wird mit Opus 5.5, umgesetzt mit Sonnet 5** – über den Agenten
  [`umsetzer`](.claude/agents/umsetzer.md) oder von Hand mit `/model`.
- **Vor der Umsetzung steht der Plan fest,** in `Plan.md` oder im Auftrag selbst: welche Dateien, welche
  Entscheidungen, welche Tests, woran „fertig" zu erkennen ist. Der Umsetzer kennt das Gespräch nicht – was nicht
  dasteht, weiß er nicht.
- **Bei Opus bleibt,** was Urteil braucht: Messungen an ChurchTools samt Academy-Recherche, Schemaänderungen,
  Rechte, alles, was die Testinstanz berührt, und die Durchsicht des Ergebnisses.
- **Wer beim Umsetzen auf eine offene Frage stößt, gibt sie zurück,** statt zu raten.
- **Wiederkehrende Abläufe sind Skills, keine Agenten** *(seit 2026-11-23)*: ein Release mit dem persönlichen Skill `/release`,
  der den Abschnitt „Release“ unten liest.
- **Rückmeldungen nach außen entwirft der persönliche Agent `kommunikation`** *(seit 2026-11-23)* nach dem Abschnitt
  „Kommunikation“ unten – er liest den ganzen Verlauf und postet nie; gepostet wird erst nach dem OK des Nutzers.
- **Vor jedem PR mit Code prüft der persönliche Agent `pruefer`** *(seit 2026-11-23)* den Diff gegen den Abschnitt „Prüfung“
  unten – mit dem Plan-Punkt im Auftrag. Er liest nur; seine Befunde prüft Opus nach, bevor etwas geändert wird. Reine
  Plan- und Doku-PRs brauchen ihn nicht.
- **Tests gehen mit der Änderung.** Wer Verhalten ändert, passt im selben PR die Tests an, die es prüfen – auch die
  e2e-Tests, die die Pflichtprüfung `check` nicht fährt: per `grep` in `e2e/` nach testids und Texten suchen und die
  Treffer lokal laufen lassen. *(Seit 2026-10-07: `v0.17.1` ließ vier Tests in `e2e/rooms.spec.ts` unbemerkt rot.)*
- **Nur testen, was die Änderung berührt.** Gezielt die einzelnen Tests (`<datei>:<zeile>` oder `-g "<Titel>"`), erst
  nur Chromium; WebKit nur für das, was Browser trennt (Finger, Safari-Eigenheiten). Keine ganzen Dateien und keine
  Gesamtläufe während der Arbeit – eine Runde dauert sonst zehn Minuten. *(Nutzer, 2026-10-09: „nur genau das, was
  verändert wurde, soll getestet werden".)*

### Sparsam arbeiten

*Seit 2026-10-09 (Nutzer: „Sonst kommen wir zu schnell an die Limits und das bremst uns aus").* Das meiste verbrauchen
nicht die Änderungen, sondern lange Sitzungen, Testläufe, Bilder und Berichte.

- **Eine Sitzung je Paket.** `Plan.md` ist das Gedächtnis: Am Ende einer Sitzung steht dort der Stand, die nächste
  beginnt mit „Plan.md, Punkt …, Paket …" statt mit dem alten Verlauf.
- **Je Runde prüfen:** Typprüfung, Lint und Unit-Tests ganz (sie sind schnell); von den e2e-Tests **nur die betroffenen**
  (`-g` bzw. Zeile), **nur Chromium**, mit `--reporter=line`, die Ausgabe in eine Datei und davon nur die Zusammenfassung
  lesen.
- **Am Ende eines Pakets, vor dem Merge:** die betroffenen e2e-Dateien ganz, in Chromium und WebKit, und
  `npm run docs:screenshots` – nicht in jeder Runde.
- **Ein roter Test wird einmal einzeln wiederholt,** nicht die ganze Datei. Die Testinstanz bremst über 600 Anfragen je
  Minute (`429`, G16); `editor.spec.ts` am Stück stößt daran.
- **Berichte des Umsetzers höchstens 25 Zeilen:** was gebaut, was vom Auftrag abweicht, was rot ist, offene Fragen.
- **Bilder sparsam:** je Runde höchstens ein Bild ansehen, das die Änderung zeigt.
- **Rückmeldungen gebündelt:** eine Liste je Runde statt einzelner Wünsche nacheinander.

## Kommunikation

*Für den persönlichen Agenten `kommunikation` (seit 2026-11-23).*

- **Konto:** `gh` mit `GH_TOKEN=$(gh auth token -u cgksmedia)`, Repository `wirsindcgks/churchtools-infoscreen`.
- **Sprache und Anrede:** Deutsch, „du“ – so schreiben die Ideengeber in den Issues selbst.
- **Wertschätzend:** Wer etwas meldet oder vorschlägt, hat eine Lücke im Produkt gezeigt, keinen eigenen Fehler gemacht –
  auch nicht zwischen den Zeilen. Das gilt ebenso für Zweig-, Commit- und PR-Namen: nach der Sache benennen, nie nach
  der Person („Vorschläge von …“ statt „…-issues“).
- **Dank:** Im Changelog ein Absatz direkt unter der Versionsüberschrift mit Link auf Profil und Issue; die Schreibweise
  je Person steht in früheren Einträgen (in `CHANGELOG.md` nach „Danke an“ suchen). Im Commit, der einen Vorschlag
  umsetzt, ein `Co-authored-by` mit der noreply-Adresse (`gh api users/<login>`). Woher ein Wunsch kommt, darf im Plan
  stehen („Wunsch von …“); wo wir einen Vorschlag kritisch bewerten (ablehnen, parken, als Fehlgriff einordnen), steht
  „Vorschlag #N“ statt des Namens.
- **Verknüpfen:** Ein PR, der baut, schreibt „Teil von #N“; der Versions-PR „Closes #N“ für Issues, die mit dem Release ganz
  erledigt sind. Bleibt etwas offen, bekommt das Issue einen Kommentar, was erschienen ist und was offen bleibt.
- **Zurückgestelltes:** Kommentar mit Begründung, Label „geparkt“, Issue schließen. Das Feld „Priority“ ist intern und
  wird nie erwähnt.
- **Kein Issue bleibt ohne Antwort:** Jedes neue Issue bekommt zeitnah eine erste Rückmeldung, auch wenn noch kein
  Bauplan steht (was wir daraus machen, was offen ist). Bei einer Triage zuerst nach Issues ohne Kommentar von uns suchen.
- **Inhalt einer Rückmeldung:** die Version, der Weg in der Oberfläche („Startseite → Kachel → „…“ → „Einstellungen““), was
  erschienen ist und was nicht, und nur Fragen, deren Antwort im Verlauf noch fehlt. Plan-Nummern nur mit Stichwort.

## Prüfung

*Für den persönlichen Agenten `pruefer` (seit 2026-11-23): Pflichtpunkte zusätzlich zu seinen allgemeinen Prüfungen.*

- **Ordnung im Inspektor** (Abschnitt oben): Platz des Feldes, Klappmenü statt lose, Zusammenfassung in Worten, Titel
  höchstens drei Wörter, `(i)` am Ende der Zeile, ein Bedienelement je Art, eigene Gruppe für neue Seiten.
- **Einheitlich über alle Bausteine:** Ändert sich etwas an einem Baustein (Feld, Verhalten, Schrift, Fortschritt), ist es
  bei den anderen, für die es passt, mitgezogen – oder die Ausnahme ist begründet. Ein neuer Baustein bringt „Schrift“
  und die übrigen üblichen Klappmenüs mit; das Kurzmenü/die Übersicht im Designer ist bedacht.
- **Texte:** Oberfläche und Doku deutsch, Code und Bezeichner englisch; Texte stehen in `src/i18n/`, nicht in Vue-Dateien;
  Hilfetexte (`src/i18n/help.ts`) für neue Felder.
- **Schema:** Jede Änderung an gespeicherten Dokumenten hebt `SCHEMA_VERSION` (Minor), neue Felder sind optional mit
  „fehlend = …“ im Kommentar, ältere Player kommen damit zurecht; Lesetest in `src/model/read.test.ts`.
- **Rechte:** Der Assistent (`src/setup/`) vergibt so eng wie möglich (je Kalender, Raum, Dienstgruppe), nimmt nur zurück,
  was er selbst verwaltet (`MANAGED_RIGHTS`) und der Administrator sieht; neue Rechte haben einen Check (`checks.ts`) und
  eine Zeile in `docs/Rechte.md`. Was die Befunde (G-Nummern) sagen, gilt – ein Recht ohne Befund ist ein Fehler.
- **Was öffentlich zu sehen ist:** Bildschirme zeigen nur, was ohne Anmeldung sichtbar sein darf (öffentliche oder
  freigegebene Kalender, Dienste nur aus offenen Dienstgruppen) – auch wenn das Gerät mehr lesen kann. Ausnahmen wählt
  ein Gestalter bewusst (etwa Notizen geschlossener Dienstgruppen im „Ablauf“, Punkt 119); dann sagt der Hilfetext, dass
  sie für alle sichtbar auf dem Bildschirm stehen.
- **Geheimnisse:** keine Instanz-URL, kein `*.church.tools` (ausgenommen das öffentliche Forum `forum.church.tools`), keine Tokens, keine Personendaten in Code, Tests, Doku,
  Kommentaren; `fixtures/` nicht versioniert; Datei- und Bild-Hashes sind Zugangsschlüssel.
- **Bauregeln:** kein Inline-Skript (CSP), der Player lädt keine Chunks nach, Zeiten über `Intl`/Zeitzone der Instanz,
  nie fester Offset; Timer und Listener werden beim Abbau entfernt (Kiosk-Tabs laufen wochenlang).
- **Tests:** Unit-Tests für neue Logik; betroffene e2e-Tests per `grep` nach Testids und Texten in `e2e/` gefunden und
  angepasst – die Pflichtprüfung `check` fährt keine e2e.
- **Doku und Plan:** `docs/Funktionen.md` bzw. `docs/Rechte.md`/`docs/Einrichtung.md` für sichtbare Änderungen; in
  `Plan.md` der Stand des Punktes; keine fremden Werkzeuge oder Anbieter im Plan; Nummern (Plan, G, Issues) nie ohne
  Stichwort.

## Release

*Für den persönlichen Skill `/release` (seit 2026-11-23); Grundlage ist [`LocalTests.md`](LocalTests.md), „Release
veröffentlichen“.*

- **Konto:** `cgksmedia` (Admin der Organisation `wirsindcgks`), Repository `wirsindcgks/churchtools-infoscreen`.
  `gh` mit `GH_TOKEN=$(gh auth token -u cgksmedia)`; Git je Aufruf mit
  `git -c credential.helper= -c 'credential.helper=!f() { test "$1" = get || exit 0; echo username=cgksmedia; echo "password=$(gh auth token -u cgksmedia)"; }; f' …`.
- **Zweig und Betreff:** `version-X.Y.Z`, Commit und PR `Version X.Y.Z`. **Squash-Merge**, Prüfung `check` muss grün sein.
- **Versionsdateien:** `npm version X.Y.Z --no-git-tag-version` (schreibt `package.json` und `package-lock.json`).
- **Changelog:** `## [X.Y.Z] – JJJJ-MM-TT` (Gedankenstrich), Abschnitte „Neu“, „Geändert“, „Behoben“, je Eintrag die
  Plan-Nummer; Link-Definition `[X.Y.Z]: https://github.com/wirsindcgks/churchtools-infoscreen/releases/tag/vX.Y.Z` am Ende.
- **Plan:** In „Auf einen Blick“ die Zeile „Veröffentlicht sind `v0.1.0` bis …“ und ihre Klammer (`vX.Y.Z`: Kurzbeschreibung,
  Punkt N); beim Punkt „gebaut (unveröffentlicht)“ → „veröffentlicht mit `vX.Y.Z`“ samt dem, was offen bleibt. Die Prod-Zeile
  („dort läuft …“) nicht – das ist der Nachtrag.
- **ChurchTools-Version in der README:** Badge „ChurchTools getestet …“ und der Satz im Abschnitt „Stand“ nennen die
  Version der Produktivinstanz, auf der die Erweiterung läuft. Beim Release den Nutzer fragen, ob Prod noch darauf läuft,
  und beide Stellen sonst nachziehen *(seit 2026-11-27, Nutzer)*.
- **Prüfen:** `npm run release:check -- vX.Y.Z`.
- **Tag:** leichtgewichtig, `git tag vX.Y.Z`. Workflow `release.yml`, Asset `churchtools-infoscreen-vX.Y.Z.zip`.
- **Danach meldet der Agent:** Link aufs Release; **das ZIP lädt der Nutzer** in der Extension-Verwaltung hoch (Test- und
  Produktivinstanz), nie der Agent. Fernseher hängen an Prod – geprüft wird dort erst nach dem Release.
- **Nach der Auslieferung** (`/release nachtrag`, wenn der Nutzer „Prod läuft auf vX.Y.Z“ meldet): Zweig `plan-prod-X.Y.Z`;
  in `Plan.md`, „Auf einen Blick“, die Prod-Zeile („dort läuft … (seit dem …; davor …)“) auf die neue Version und das heutige
  Datum setzen und die bisherige Version vorn in die Liste „davor“ stellen – die Liste
  bleibt vollständig; Commit und PR `Plan: Produktivinstanz auf vX.Y.Z`, Squash-Merge. Dann sagen, was an den
  veröffentlichten Punkten offen ist; ins Archiv erst, wenn nichts mehr offen ist.

## Geheimnisse und Fixtures

- **Keine Zugangsdaten und keine Instanz-URL ins Repo.** `.env` ist ignoriert. Instanz-URL und Login-Token
  heißen dort `CT_BASE_URL` und `CT_LOGIN_TOKEN` – **ohne `VITE_`-Präfix**, damit Vite sie nie ins Bündel
  schreibt; sie leben nur im Dev-Proxy. Die Anwendung selbst nimmt `window.settings.base_url` oder den eigenen
  Ursprung. `scripts/check-dist.js` bricht den Build ab, wenn im `dist/` eine `*.church.tools`-Adresse steht – außer dem öffentlichen Forum
  `forum.church.tools`, auf das der Changelog für Wünsche von dort verlinkt *(seit 2026-11-25, Nutzer)*.
- **`fixtures/` ist bewusst nicht versioniert.** Ein frisch geklonter Arbeitsplatz hat die aufgezeichneten
  Antworten nicht und muss sie sich beschaffen, bevor Tests laufen.
- **Aufgezeichnet wird nur von der Testinstanz** – und vor dem Ablegen bereinigt. Zu entfernen sind mindestens:
  personenbezogene Felder, die Instanz-URL, Schlüssel und Geheimnisse (`site_licensekey`, `*_apikey`, `*_token`,
  `*_secret`), die geheime iCal-Adresse `randomUrl` **und Datei- bzw. Bild-Hashes** – letztere sind Zugangsschlüssel, keine Kennungen: Die `imageUrl`
  liefert damit anonym `200`. Die vollständige Regel samt Begründung steht in `Plan.md`, „Konventionen".
  **Nicht** zu bereinigen sind Gruppen-, Kalender- und Dienstnamen: Umlaute, Längen und Namensgleichheiten sind
  als Testdaten wertvoll.

## Sprache und Form

- **Kein Gemeinde-Branding.** Das Modul geht am Ende an die ChurchTools-Community: kein Gemeindename, kein
  Kürzel, keine Instanzadresse in Key, Code, Oberfläche oder Beispieldaten. Beispiele verwenden `<instanz>`.

- **Oberfläche und Dokumentation deutsch, Code und Bezeichner englisch.**
- **Commit-Nachrichten deutsch, mit Umlauten** *(seit 2026-10-19, Nutzer; ältere Betreffe sind ohne)*. Der Betreff sagt, was sich geändert hat, der Rumpf warum.
- Markdown mit deutschen Anführungszeichen („…"), Dateiverweise als relative Links.
- `CHANGELOG.md` folgt *Keep a Changelog*, ohne „Unreleased"-Abschnitt – Einträge erst beim Versionssprung.
- **PRs nennen ihre Issues.** Der PR, der baut, verweist mit „Teil von #N“ – das verlinkt, schließt aber nicht.
  Der Versions-PR schreibt für jedes Issue, das mit dem Release ganz erledigt ist, „Closes #N“ in die
  Beschreibung; GitHub schließt es beim Merge, also mit dem Release. Bleibt an einem Issue etwas offen, steht dort
  weiter „Teil von #N“, und das Issue bekommt einen Kommentar, was erschienen ist und was offen bleibt.
  *(Nutzer, 2026-10-19.)*

## Technischer Rahmen

Vue 3 + TypeScript + Vite + Pinia, `@churchtools/churchtools-client`, Vitest, Playwright – wie im
[Extension-Boilerplate](https://github.com/churchtools/extension-boilerplate) von ChurchTools.
Extension-Key `infoscreen-designer`, Auslieferungspfad `/ccm/infoscreen-designer/`. Lizenz GPL-3.0-or-later.

**Drei Bauregeln, die aus gemessenen Grenzen folgen** – Herleitung jeweils in `Befunde.md`:

- Der Build darf **kein Inline-Skript** ausliefern: Die Content-Security-Policy erlaubt `script-src` ohne
  `'unsafe-inline'`, auch auf `/ccm/`-Pfaden (G15). Externe Videos sind mangels `media-src` blockiert.
- Der **Player-Build hat keine nachzuladenden Chunks**. Ein Update würde sonst laufende Kiosk-Tabs mit einem
  `404` auf einen alten Chunk-Namen zerlegen – bemerkt sonntags, ausgelöst vormittags.
- **Zeiten kommen in UTC und werden in die Zeitzone der Instanz gerechnet – `timezone` aus `/api/config`, auch anonym
  und für den Geräte-Benutzer lesbar, bei uns `Europe/Berlin`. Gerechnet wird über `Intl` bzw. eine Zeitzonen-Bibliothek, nie über einen
  festen Offset.** ChurchTools hält die Ortszeit über die Zeitumstellung konstant (G19).
