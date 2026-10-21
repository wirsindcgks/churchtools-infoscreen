# ChurchTools Infoscreen Designer – Projektplan

Ein ChurchTools Custom Module (CCM), mit dem angemeldete ChurchTools-Anwender Infoscreens gestalten. Das Ergebnis ist eine Webseite, die ein Kiosk-Browser aufruft und auf den Foyer-TVs anzeigt – auf einem Raspberry Pi, einem Mini-PC oder in einer VM.

## Auf einen Blick

**Stand 2026-10-21.** Veröffentlicht sind `v0.1.0` bis `v0.46.0` (`v0.20.0`: Räume in der Terminliste auswählen und in Zeilen zeigen, Punkt 82; `v0.20.1`: Schrift für Social Media, Schatten für Listen, Punkt 83; `v0.21.0`: Raumtypen wählbar, „Kalender zeigen“, einheitliche Auswahlfelder, Punkte 85 und 86; `v0.22.0`: Umbenennen von Wiki-Bereich und Gruppen, Punkt 84; `v0.23.0`: Tags ausblenden, interne Kalender freigeben, Raumbelegung bis 14 Tage, Fortschrittsbalken, Punkte 82 C, 85 und 86; `v0.24.0`: Ordnung im Inspektor, Punkt 88 A; `v0.25.0`: Feinschliff im Inspektor, Punkt 88 B; `v0.26.0`: Kurzmenü in Worten, Chipzeile am Handy, Punkt 88 C; `v0.27.0`: Vorlagen, Punkt 87 A; `v0.28.0`: Aufteilung der Folie, Punkt 87 B; `v0.29.0`: Besucherübersicht der Terminliste, Punkt 90; `v0.30.0`: Ordnung auf der Seite „Design“, ein Klappmenü offen auch im Inspektor, Punkte 89 und 91; `v0.31.0`: Einführung in den Editor, „? Hilfe“, Punkt 81; `v0.32.0`: Abstand in der Aufteilung, Suche in langen Listen, Punkte 92 und 93; `v0.33.0`: Rechte weiterer Gruppen eines Gerätekontos, Titel über der Bühne, Hochkant-Folien am Handy, Punkt 94 A; `v0.34.0`: Markdown aus ChurchTools formatiert, Punkt 97; `v0.35.0`: Angaben und Bild im Baustein „Beiträge“, Punkt 96; `v0.36.0`: Videos ohne Netz, Punkt 102; `v0.37.0`: eigene Schriften, Punkt 103; `v0.38.0`: Aufteilung im Raster, Punkt 104; `v0.39.0`: Geltungsbereich der Geräterechte, Punkt 94 B; `v0.40.0`: eigene Auswahlliste, Punkt 98 A; `v0.41.0`: Hilfe-Leiste, Punkt 98 B; `v0.42.0`: Erklärung beim Überfahren, Punkt 98 C; `v0.43.0`: Hilfetexte, Hilfe-Leiste über der Folie, Punkt 98 D, erster Teil; `v0.44.0`: Hilfetexte für alle Bausteine, Punkt 98 D; `v0.45.0`: Fortschritt je Baustein, Punkt 105; `v0.45.1`: Textschatten und Einrasten in die Aufteilung, Punkt 106; `v0.46.0`: Lage des Fortschritts, Punkt 107); das Modul läuft im echten ChurchTools der Testinstanz. **Auf der Produktivinstanz ist es seit dem 2026-10-05 installiert** (der erste Versuch scheiterte am Kürzel, Befunde.md G52); **dort läuft `v0.45.1` (seit dem 2026-10-21, davor `v0.45.0`, `v0.43.0`, `v0.41.0`, `v0.39.0`, `v0.38.0`, `v0.36.0`, `v0.35.0`, `v0.33.0` und `v0.31.0`), beide Screens „online“. Der erste Nutzer von außen ist über `v0.22.0` informiert (2026-10-15). Der Gerätetest P4 ist bestanden (2026-10-14), der Feature-Stopp ist aufgehoben.** Die Fernseher melden sich über ihre Adresse selbst an (Weg B, Abschnitt D). Das Repository ist seit dem 2026-09-25 öffentlich.

**Dieser Abschnitt ist die vollständige Liste dessen, was offen ist.** Wer wissen will, was als Nächstes kommt, liest ihn und sonst nichts. Erledigtes steht mit seiner Nummer in [`docs/Plan-Archiv.md`](docs/Plan-Archiv.md) und wird nur nachgeschlagen, wenn jemand die Begründung einer alten Entscheidung braucht.

**Offen, nach Rang** *(Maßstab ist der Pitch)*:

*Reihenfolge mit dem Nutzer festgelegt am 2026-10-18: zuerst, was am Bildschirm im Foyer sichtbar wird, dann Sicherheit und Messungen, Konzepte zuletzt.*

1. **Wiederverwendbare Designs** (Punkt 87) – Idee von außen; Vorlagen und Aufteilung der Folie sind veröffentlicht (`v0.27.0`, `v0.28.0`). Offen sind die Stile für Listen-Bausteine: Sie warten auf die Antwort des Ideengebers, was mit „Sammlungen“ gemeint ist. *(wartet auf andere)*
2. **Der Designer für alle** (Punkt 79) – B1 bis F3 veröffentlicht (`v0.19.0`), seit dem 2026-10-14 auf der Produktivinstanz, am iPad abgenommen am 2026-10-21. Offen: **Testpersonen** aus Welcome-Team oder Social Media für die Abnahme *(Nutzer)*; **F4** Bewegung beim Einblenden, wartet nur noch auf die Messung am Pi; der Seitenrand (D8) bleibt später.
3. **Nebenbei und später aus den Issues** – **Erst Konzept,** nach oben erst, wenn mehrere Teams den Designer gemeinsam nutzen: Zuständigkeiten (Punkt 99, #139), Änderungsprotokoll (Punkt 100, #134), öffentlich auf der Website (Punkt 101, #133). **Entscheidung beim Nutzer:** YouTube/Vimeo (Punkt 46.6, #131) und Mitarbeiterkarten (#129, unter „Ideen“).
4. **ChurchTools 3.138 prüfen** (Punkt 108) – *fällig mit dem Update, vermutlich ab 2026-10-27.* ChurchTools hat dafür die API-Dokumentation mit der Implementierung abgeglichen: ausführlichere Beschreibungen von Parametern, Berechtigungen, Antworten und Fehlern, dazu bisher undokumentierte Endpunkte und Felder; korrigierte Datentypen und Pflichtfelder können generierte Clients ändern, das Verhalten der Endpunkte ändert sich dadurch nicht zwingend ([Forum, Ankündigung](https://forum.church.tools/topic/12127/mehr-klarheit-f%C3%BCr-eure-integrationen-api-dokumentation-%C3%BCberarbeitet)). **Uns betrifft das weniger als andere:** Wir generieren keinen Client aus der Spezifikation, die Typen sind von Hand geschrieben (`src/store/churchtools-kv.ts` nach Build 32882). **Vorgehen:** (1) ~~*Vor dem Update* die Spezifikation der Testinstanz (3.137) als Administrator sichern~~ – **erledigt am 2026-10-21:** 3.137.1, Build 32915, als Entwicklungskonto mit Session-Cookie; 525 Pfade, 689 Schemas, in `fixtures/schema/openapi-3.137.json` (nicht versioniert, mit Notiz daneben). Alle Pfade des Moduls stehen drin, bis auf die `/custommodules`-Pfade und `DELETE /permissions/group_role/{id}` – nach der Ankündigung („bisher undokumentierte Endpunkte“) die ersten Kandidaten für den Vergleich. (2) *Nach dem Update* dieselbe mit demselben Konto ziehen und die Pfade vergleichen, die das Modul aufruft: Typen, Pflichtfelder, Antworten und genannte Berechtigungen. (3) Neu dokumentierte Rechte gegen die offenen Fragen halten (etwa G37, interne Gruppen bei Beiträgen; die Rechte des Gerätekontos, G21). (4) Ergebnis als Befund in `Befunde.md`; Abweichungen in der Dokumentation allein sind kein Fehler im Modul – nur, was sich messbar anders verhält. Danach die e2e-Tests, die an der Testinstanz hängen (`setup.spec.ts`, `rights.spec.ts`, `hello.spec.ts`), einzeln gegen die aktualisierte Instanz.
5. **Vorschau in einem zweiten Fenster** (Punkt 56) – skizziert; geparkt (Nutzer, 2026-10-10).
6. **Teststrategie prüfen – keine doppelten Prüfungen** (Punkt 60) – vom Nutzer gewünscht am 2026-10-02; eine Durchsicht, später (Nutzer, 2026-10-10).

**Kleine Reste, kein Auftrag, bis jemand sie wählt** *(durchgesehen mit dem Nutzer am 2026-10-10: später; „Rechte aktualisieren“ echt ausprobiert, ohne Auffälligkeiten)*:

- **Im Betrieb beobachten** *(aus P4; bestanden am 2026-10-14 ohne gezielte Prüfung, entschieden mit dem Nutzer)*: Nach acht Tagen ohne Befund, einem Kaltstart am Rollwagen und beiden Screens „online“ wurde P4 abgekürzt. Die übrigen Prüfungen sind mit vertretbarem Aufwand nicht auslösbar: Der Pi am Rollwagen hängt im WLAN ohne Zugang zur Netzwerktechnik, der andere im abgeschlossenen Serverraum. **Probleme werden gelöst, wenn sie zum ersten Mal auftreten** – auf der Testinstanz nachstellen, dort beheben, als Patch-Release einspielen (Archiv, Punkt 57, „Fehler unterwegs“). Ungeprüft sind:
  - Netzausfall, Neustart ohne Netz und eine während eines langen Ausfalls abgelaufene Sitzung (Service Worker, Archiv Punkt 37; Risiko 2);
  - der Baustein „Video“ über eine Nacht und mit Ton (Archiv, Punkt 52);
  - Laufschrift, ein Beiträge-Block (Archiv, Punkt 33) und das Lebenszeichen über Wochen (G54 hat nur Minuten gemessen);
  - in der Prüfung der Gerätegruppe: jeder Kalender der Screens meldet „ist öffentlich“ (Archiv, Punkt 73).
  - Für den Pi im Serverraum braucht es im Fehlerfall jemanden mit Schlüssel, der ihn aus- und wieder einsteckt.
- **`editor.spec.ts:1091` ist in WebKit rot** (`save-status` nicht gefunden), bemerkt am 2026-10-16 bei Punkt 89 – auch auf dem Stand davor rot; in Chromium grün.
- **Assistent mit einem anderen Gruppentyp als „Merkmal"** ist nur gegen nachgestellte Antworten geprüft (Archiv, Punkt 71); spätestens die Einrichtung auf der Produktivinstanz zeigt es, wenn dort ein anderer Typ gewählt wird.
- Der Abbruch des Assistenten bei unsichtbarem Wiki-Bereich ist gegen kein echtes ChurchTools geprüft; ein fremder Bereich gleichen Namens, den der Administrator trotz Wiki-Recht nicht sieht, bleibt unerkennbar (Archiv, Punkt 55 B).
- Beiträge: interne Gruppen, und ob Mitglieder eingeschränkter Gruppen deren Beiträge lesen (G37).
- **Last der e2e-Tests auf der Testinstanz** *(gemessen am 2026-10-08)*: Ein Gesamtlauf von `tiles`, `editor` und `home` schickt rund 1450 Anfragen in drei Minuten, in der Spitze gut 530 je Minute – nahe an den 600, die ChurchTools je Minute und Adresse erlaubt (G16). Mit offen gehaltenen Verbindungen lief er schneller, bekam bis zu 39-mal `429` und verlor zwei bis vier Tests; deshalb kein keep-alive im Dev-Proxy. Die früher zufällig scheiternden Tests kamen von einer gelegentlich gescheiterten Namensauflösung (`ENOTFOUND`, ein- bis dreimal je Lauf), die als `502` ankam; seit dem 2026-10-08 nimmt der Proxy dann die zuletzt bekannte Adresse (`vite.config.ts`). Wird die Testsammlung größer, zuerst die Zahl der Anfragen je Seitenaufruf senken.
- Aus der Durchsicht vor dem Teilen (Archiv, Punkt 58, `v0.6.0`):
  - **Sobald die Produktivinstanz Dienste zeigt** (heute nicht): die Freigabe der Dienste („Predigt“) unter Einstellungen → Dienste auf Screens prüfen. *(Der Rest des ersten Starts – Bilder, Videos, Personenstatus des Gerätekontos – ist seit dem 2026-10-05 ohne Auffälligkeit, Nutzer am 2026-10-21; die Rechte prüft die Einrichtung seit `v0.33.0` und `v0.39.0` selbst.)*
  - **Nutzer:** dem ChurchTools-Support melden, was `Befunde.md` über anonym Lesbares festhält (G14, G40), bevor das Modul beworben wird.

**Ideen, nicht gewählt** *(Rest der früheren „Später"-Liste, mit dem Nutzer durchgesehen am 2026-10-01; keine ist gebaut, jede bräuchte ihren eigenen Bauplan)*:

- **Format einer Playlist nachträglich wechseln** (quer ↔ hoch), als Umrechnung mit Vorschau – heute wird das Format nur beim Anlegen gewählt. *Nutzer: „könnte ich mir vorstellen, dass es benötigt wird."*
- **Export und Import** einer Playlist als JSON, etwa um sie von der Testinstanz auf die Produktivinstanz zu bringen; dazu Vorlagen für neue Playlists oder Slides. *Nutzer: wie oben.*
- **Mitarbeiter einer Gruppe mit Bild und Aufgabe** *(Wunsch von außen, 2026-10-14, Punkt 82)* – wie die Mitarbeiterseite einer Gemeinde-Website, gedacht als Wegweiser zu den Ansprechpartnern im Foyer. Steht gegen die Datenschutzregel fürs Foyer (Gruppenkontakte nicht im MVP); bräuchte eine Einwilligung, die das Modul erkennen kann. *Seit dem 2026-10-16 auch als Vorschlag #129:* Karten mit Name, Aufgabe (Feld `funktion` der Gruppenmitgliedschaft) und einem QR-Code für eine E-Mail an die Person; im Vorschlag selbst niedrig eingestuft. Eine E-Mail-Adresse auf einem öffentlichen Bildschirm ist genau das, was die Regel vermeidet. **Entscheidung beim Nutzer.**
- **Baustein „Wiki-Seite“** *(Wunsch von außen, 2026-10-19, in PR #160)* – eine Wiki-Seite bildschirmfüllend zeigen, anders als Beiträge mit Tabellen und Bildern, dazu Seitenwechsel oder langsames Scrollen, wenn der Text länger ist als die Fläche. Um ein eigenes Issue mit Beispielen gebeten (2026-10-20).

**Gestrichen am 2026-10-01 (Nutzer):** der Umschalter „läuft gerade" auf der Kachel (der Zeitplan ist seit `v0.4.2` einen Klick aufs Bild entfernt), die Warnung bei schlechter Lesbarkeit (die Vorschau zeigt es), die Vorschau in einem stilisierten Bildschirm (reine Optik), eigene Skripte in einem Web-Code-Block (trägt unter der CSP nicht, G15) und Auswertungen.

**Beobachten:** ob die Griffe am Handy im Alltag reichen und der Zoom-Schutz (16 px) auf jedem Gerät greift (Archiv, Punkt 44). Und die Arbeitsteilung: Opus plant und sieht durch, der Umsetzer baut – auch die Feedback-Runden zum Layout (AGENTS.md).

**Bewusst geparkt** – nicht falsch, aber nicht jetzt: **der Token aus der Adresszeile** (Punkt 95, #140; geparkt mit dem Nutzer am 2026-10-20) – gemessen (G66), Bauplan fertig; der Nutzen ist klein: Der Kiosk der Produktivinstanz läuft mit `--app` ohne Adresszeile, F5 trägt heute schon, und hinter einer öffentlichen Weiterleitung bleibt der Token ohnehin auslesbar; im Issue keine Dringlichkeit („unschön, ein Problem ist es nicht“). Wieder aufnehmen, wenn jemand ihn im Betrieb braucht. alles Weitere am Betriebsbenutzer (G21-Reste), eine gemeinsame Bibliothek mit `ct-pass-store`, Koppeln am Fernseher (geprüft am 2026-09-25; die Geräte haben weder Tastatur noch Maus – Begründung im Archiv, „Funktionsumfang – Später"), der Extension Store (G17), YouTube/Vimeo (Punkt 46.6; erste Anfrage von außen am 2026-10-14, auch Twitch – laut Autor nicht dringend, gedacht für Imagefilme, und die gehen schon heute als MP4 über den Baustein „Video“), **4K** (Nutzer, 2026-10-01: „bauen es ein, falls von dritten gefordert"; ein eigenes Format braucht es nicht – die Bildfläche wird skaliert, Schrift bleibt scharf, nur Bilder fordert der Player höchstens in 1920 × 1080 an, `src/player/images.ts`; ungemessen). **Nicht anfassen, bis ein Produktschritt es braucht:** C4, `attachments`, `ct-events-load`, das Gespräch mit dem Autor von `ct-pass-store`.

**Pflege dieses Dokuments** *(Wunsch des Nutzers, 2026-10-01: „alte Zöpfe abschneiden")*: Ein neuer Punkt bekommt die nächste Nummer und steht unter „Nächste Schritte", bis er veröffentlicht ist. Mit dem Release wandert sein Text wörtlich ins Archiv, hier bleibt eine Zeile im Verzeichnis; was an ihm offen bleibt, kommt als eigene Zeile in die Liste oben. Die Nummern bleiben, weil der Code auf sie verweist („Plan.md 47").

## Rahmendaten

- **Testinstanz**: Adresse nur in der `.env`, 3.137.1, Build 32915 (gemessen am 2026-10-05; vorher Build 32882 wie produktiv – ob die Produktivinstanz mitgezogen hat, ist nicht geprüft, G51), ~~Lizenz bis 2026-10-22, 21:53~~ (30 Tage ab Anlage am 2026-09-22, 21:53; T3). **Seit dem 2026-09-28 ohne Frist:** ChurchTools stellt sie für die Zeit der Extensionentwicklung kostenfrei, prüft die Nutzung regelmäßig und berechnet sie, sobald sie **produktiv genutzt** wird (F1). Testen darf man dort alles, auch tagelang auf einem Gerät; echte Inhalte im Dauerbetrieb gehören auf die Produktivinstanz. Custom Modules dort **freigeschaltet seit dem 2026-09-24** (T1), angefragt am 2026-09-23. Freigeschaltet wird nach Auskunft vom 2026-09-24 über die Entwickler von ChurchTools, nicht über das Paket; Rückmeldung steht aus. Ein Paketwechsel (etwa auf Combo) ist im Gespräch, dann werden Kalender und Personen der Testinstanz entsprechend reduziert. Die **Produktivinstanz** hat sie (G1).
- **Autor / Repo**: `wirsindcgks <media@cg-ks.de>`, [`github.com/wirsindcgks/churchtools-infoscreen`](https://github.com/wirsindcgks/churchtools-infoscreen), **öffentlich seit dem 2026-09-25**. Seit dem 2026-09-27 gehört das Repo der **Organisation** `wirsindcgks`; der frühere gleichnamige Benutzer heißt jetzt `cgksmedia` und ist dort Admin. Git und `gh` immer als `cgksmedia`. Ältere Commits nennen noch Instanz-Adressen und die Autor-Adresse – **entschieden am 2026-09-29: so lassen.** Umschreiben bräuchte einen Force-Push gegen das Ruleset, und Forks, Klone und Caches behielten die alten Stände trotzdem; die Adressen sind Anmeldeseiten, keine Geheimnisse. Neu ins Repo kommt davon nichts (AGENTS.md).
- **Lizenz**: GPL-3.0-or-later *(seit dem 2026-10-01, Punkt 58; vorher GPL-2.0-or-later)*
- **Ziel**: Das Modul geht am Ende an die ChurchTools-Community – daher **kein Gemeinde-Branding** (seit 2026-09-24).
- **Extension-Key**: `infoscreen-designer` → Auslieferungspfad `/ccm/infoscreen-designer/`
- **Stack**: Vue 3 + TypeScript + Vite + Pinia, `@churchtools/churchtools-client`, Vitest, Playwright – wie das [Boilerplate](https://github.com/churchtools/extension-boilerplate) und die bekannten Fremd-Extensions.
- **Für Anwender** *(seit 2026-09-25)*: [`docs/Onboarding.md`](docs/Onboarding.md) – Einstieg je Rolle; [`docs/Einrichtung.md`](docs/Einrichtung.md) – die Anleitung für Administratoren; [`docs/Rechte.md`](docs/Rechte.md) – wer welche Rechte braucht, als Tabelle. **`docs/Rechte.md` wird mitgepflegt:** `src/setup/rights-doc.test.ts` bricht ab, sobald der Assistent ein Recht vergibt oder zurücknimmt, das dort nicht steht.
- **Dokumente**: `Plan.md` ist das Gedächtnis, [`Preparation.md`](Preparation.md) die Arbeitsliste, [`Befunde.md`](Befunde.md) das Messprotokoll (**alle Verweise „G…" zeigen dorthin**), [`AGENTS.md`](AGENTS.md) die Arbeitsregeln.
- **Abgrenzung**: Eigenständiges Projekt, kein Teil des WordPress-Plugins `churchtools-plugin` und keine gemeinsame Codebasis damit.

## Pitch

Der native ChurchTools-Infoscreen zeigt eine Terminliste in einem festen Layout. Wiederkehrende Wünsche im ChurchTools-Forum sind seit Jahren dieselben: eigene Inhalte (Bilder, Videos, freie Texte) im Wechsel mit den Terminen, ein abschaltbarer oder gestaltbarer Header, einstellbare Anzeigedauer, mehrere Screens mit unterschiedlichen Inhalten. Wer das braucht, weicht heute auf externe Digital-Signage-Dienste aus – und pflegt seine Termine dann zweimal.

Der Infoscreen Designer schließt genau diese Lücke: gestalten in ChurchTools, Daten aus ChurchTools, ausspielen aus ChurchTools. Kein zweites System, kein zweiter Datenstand, keine zusätzliche Hosting-Rechnung.

**Dieser Absatz ist der Maßstab für jeden Punkt dieses Plans.** Was keines der Versprechen darin einlöst, gehört unter „Ideen, nicht gewählt" in „Auf einen Blick".

## Architektur

Zwei Oberflächen, ein Paket, kein eigener Server.

```
ChurchTools-Instanz
├── /ccm/infoscreen-designer/            (das ausgelieferte dist/ der Extension)
│   ├── Designer   – angemeldeter Anwender gestaltet Screens
│   └── Player     – derselbe Code, Route /player?screen=<slug>
├── /api/custommodules/…             Screens + Einstellungen (KV-Store)
└── /api/…                           Termine, Dateien, Gemeindekopf
                     ▲
                     │ Kiosk-Gerät (Raspberry Pi, Mini-PC, VM – Chromium im Kioskmodus)
                     │ ruft /ccm/infoscreen-designer/player?screen=foyer-links&login_token=…&user_id=…
```

- **Kein eigener Server.** Die Instanz ist Speicher, Auslieferung und Rechteverwaltung zugleich. Der Preis: Der Pi meldet sich per Login-Token an (D) – so läuft der native Infoscreen heute schon.
- **Designer und Player teilen sich den Code.** Der Player rendert dieselben Blockkomponenten ohne Bedienelemente; die Vorschau im Designer ist damit definitionsgemäß das, was auf dem TV steht.
- **DOM statt Canvas**, auf einer Bildfläche mit festen Pixelmaßen (1920×1080 oder hochkant), die ein einziger Faktor per `transform: scale()` auf den Viewport abbildet. Passt das Seitenverhältnis nicht, wird **eingepasst statt beschnitten**; je Screen eine Overscan-Korrektur in Prozent.
- **Stilgrenze in beide Richtungen.** Die Extension läuft im Dokument der Hostseite, nicht in einem iframe (G6). Alle eigenen Regeln unter einer Wurzelklasse, `all: initial` an der Kante der Bildfläche, keine geerbten Schriftgrößen oder Farben. Ungeschichtetes CSS schlägt die `@layer`-Stile der Hostseite, `!important` ist unnötig.
- **Der Player ist ein Bündel ohne nachzuladende Chunks** und lädt bei einem Modul-Ladefehler neu. Sonst zerlegt ein Extension-Update laufende Kiosk-Tabs mit einem `404`. Der Designer darf splitten.
- **Kein Inline-Skript im Build** – die CSP erlaubt `script-src` ohne `'unsafe-inline'` (G15).
- **Schriften kommen aus dem Paket**, nicht von Google Fonts: geschlossene Liste freier, selbst gehosteter Schriften (OFL), unter eigenen Namen registriert. Kein Aufruf eines Schriftendienstes – Datenschutz; `check-dist.js` prüft es.

## Voraussetzungen für die ChurchTools-Integration

### A. Auf Seiten der ChurchTools-Instanz

- **Custom Modules freigeschaltet** – produktiv ja (G1), auf der Testinstanz **nein** (T1).
- **Ein Administrator** zum Hochladen des Moduls und zum Vergeben der Modulrechte. **Direkt nach dem Hochladen die Rechte vergeben**: Ein frisch installiertes Modul ist auch für Administratoren unsichtbar (G4).
- **Ein Geräte-Benutzer** ohne Zweifaktor, mit Leserechten auf das, was die Screens zeigen – siehe F.
- **Kein CORS nötig**: In der Entwicklung proxt Vite `/api`, im Betrieb liegt die Extension auf derselben Domain.

### B. Entwicklungsumgebung

- **Node.js** (aktuelle LTS) mit npm, plus `zip` für die Paketierung.
- **Steht seit dem 2026-09-24** (B1–B4). Nach dem Muster des Boilerplates, aber an einer Stelle bewusst anders: **Der Dev-Login läuft im Vite-Proxy, nicht im Browser.** Der Proxy leitet `/api` an die Testinstanz und setzt dort `Authorization: Login <token>`; Set-Cookie-Kopfzeilen verwirft er. Damit gibt es kein `VITE_USERNAME`/`VITE_PASSWORD`, das ins Bündel geraten könnte, und der Safari-Fall (`Secure; SameSite=None` auf `localhost`) tritt gar nicht erst auf – belegt mit Playwright in WebKit.
- **`.env`** aus `.env-example`, nicht im Repo: `CT_BASE_URL`, `CT_LOGIN_TOKEN`, optional `VITE_KEY`. Die Anwendung nimmt `window.settings.base_url` der Hostseite, in der Entwicklung den eigenen Ursprung.
- **Befehle**: `npm run dev` (unter `/ccm/infoscreen-designer/`), `npm test` (ohne Instanz), `npm run smoke` (Playwright in Chromium und WebKit gegen die Testinstanz, nicht im CI), `npm run build` (inklusive `scripts/check-dist.js`), `npm run release` (ZIP).
- **Typ-Snapshot** `ct-types.d.ts` aus der Spezifikation **einer Instanz mit freigeschalteten Custom Modules** – die Spezifikation wird pro Benutzer gefiltert, ein Snapshot ohne `CustomModule`-Pfade ist schlimmer als keiner (B5).
- **Vorlage mit offenem Quellcode**: [`lub90/ct-pass-store`](https://github.com/lub90/ct-pass-store) (MIT) läuft auf unserer Produktivinstanz. `ct-utils/lib/ExtensionData.ts` (KV-Zugriff) und der Setup-Assistent für Kategorien sind übernehmbar, mit Urheberrechtsvermerk.

### C. Paketierung und Installation

- `npm run release` baut `dist/` und packt es nach `releases/<name>-v<version>-<commit>.zip` – nur `dist/`, ohne Source-Maps.
- Installation: Admin → Extensions → ZIP hochladen. **Der Kurzbezeichner muss exakt zum Build-Key passen**, Ordnernamen sind case-sensitiv.
- **Updates nur als ZIP** im Bearbeiten-Dialog der Extension-Verwaltung: Auf Build 32882 gibt es weder ein Feld für eine Download-Adresse noch ein automatisches Update aus GitHub (Code der Oberfläche gelesen, 2026-09-24). Tag `vx.y.z` → GitHub Action baut das ZIP → das Release trägt es zum Herunterladen und Hochladen.

### D. Authentifizierung

1. **Designer im Betrieb** – keine eigene Anmeldung; die Extension läuft in der ChurchTools-Sitzung, `GET /whoami` liefert den Anwender.
2. **Entwicklung** – `POST /login` mit den Zugangsdaten aus der `.env`, nur im Modus `development`.
3. **Fernseher – Weg B, gebaut am 2026-09-25:** Die Adresse trägt den Login-Token des Geräte-Benutzers zweimal – im Query, damit ChurchTools beim Laden anmeldet (G9), und im Fragment, das die Weiterleitung übersteht und der Player liest:
   ```
   https://<instanz>/ccm/infoscreen-designer/player?screen=foyer-links&login_token=<TOKEN>&user_id=<ID>#login_token=<TOKEN>&user_id=<ID>
   ```
   Der Player meldet sich bei abgelaufener Sitzung selbst neu an und lädt sich nur über diese Adresse neu; das nächtliche Neuladen erneuert die Sitzung täglich. Die Adresse erzeugt ein Administrator in den Einstellungen aus Benutzername und Passwort des Geräte-Kontos (`POST /api/login/token`, ohne Cookies); gespeichert wird nichts davon. Echte Unterpfade wie `/player` sind gedeckt (G7). **Die Adresszeile behält den Token** (seit 2026-09-26, G9): Ein F5 von Hand meldet so ebenfalls an. **Ein Browser trägt nur eine ChurchTools-Sitzung** – ein Player braucht einen eigenen Browser oder ein eigenes Profil; der Datenzyklus prüft die Person wie der Konfigurationszyklus.
4. **Weg A, verworfen am 2026-09-25** (entschieden am 2026-09-24): Der Browser meldet sich einmal von Hand an, die Adresse trägt nur den Screen. Auch mit „Angemeldet bleiben" hält die Sitzung nur 24 Stunden (G32), danach bindet ChurchTools unser Skript nicht mehr ein (G9, G33). Bleibt zum Ausprobieren: angemeldet über „Player öffnen".

**Für Weg B gilt: Der Token ist ein Dauerpasswort** – in der URL, im Browserverlauf, auf der SD-Karte. **Die Notbremse ist der Passwortwechsel des Geräte-Benutzers in der Oberfläche**; der Token ist danach sofort ungültig (G18). Einen Admin-Endpunkt zum Widerrufen gibt es nicht.

### E. Datenspeicherung

Eigene Daten liegen im KV-Store des Moduls: Modul → Kategorie → Datenwert, jeder Wert ein JSON-String. **Ein Datenwert hat keinen Namen, keine Version und fasst höchstens 10.000 Zeichen** (G2, G3, G11). Daraus folgt der Zuschnitt:

| Kategorie | Inhalt |
| --- | --- |
| `screens` | je Screen ein Index-Wert: Slug, Name, Auflösung, Overscan, Schema-Version, Revision, `updatedAt` – gehört den Administratoren |
| `playlists` | je Playlist ein Wert: Name, Reihenfolge der Slide-IDs, **Format, Revision** (seit Schema 1.4 – eine Playlist steht für sich und kann auf mehreren Screens laufen); dazu **je Screen ein Zeitplan** (`kind: 'schedule'`, seit 1.2): Standard-Playlist, Regeln, eigene Revision – beides gehört den Gestaltern |
| `slides` | je Slide ein Wert mit ihren Blöcken (realistisch 1–4 KB). Slides gehören keiner Playlist, sie werden referenziert |
| `media` | Verweise auf ChurchTools-Dateien, nie die Dateien selbst |
| `settings` | modulweite Einstellungen |

| `status` | je Screen ein Lebenszeichen des Fernsehers (seit `v0.17.0`, Punkt 59) – **keine Pflichtkategorie**, das Gerät schreibt hier und nur hier |

Später hinzu: `templates`, `snippets` (Web-Code).

**Regeln, die ab der ersten Zeile gelten:**

- **Gelesen wird eine Kategorie immer ganz**, gefiltert im Client – eine Abfrage nach Feldern gibt es nicht.
- **Die Adresse eines Screens ist sein Slug** (`foyer-links`), nicht die Server-`id`. Sonst zeigt die SD-Karte nach „löschen und neu anlegen" ins Leere.
- **Speichern schreibt mehrere Werte ohne Transaktion – Slides, dann Playlists, der Index zuletzt.** Neues bleibt bis zum Index unsichtbar, und kein Verweis zeigt ins Leere. Eine geänderte bestehende Slide ist allerdings sofort sichtbar (G22) – hingenommen.
- **Konflikte werden erkannt, nicht verhindert**: `revision` im JSON, vor dem Schreiben lesen und vergleichen, bei Abweichung ein Dialog statt stillen Überschreibens.
- **Die 10.000-Zeichen-Grenze prüft der Designer vor dem Speichern.** Damit ist es gleichgültig, ob der Server sauber ablehnt oder still kürzt (C4).
- **Validiert wird allein im Client**, gegen `src/model/schema.ts`. Kategorien haben auf unserem Build weder Schema noch Sicherheitsstufe (G22).
- **Persistierte Daten sind versioniert** und werden beim Lesen migriert. **Der Player ist duldsam gegenüber neueren Daten**: unbekannter Blocktyp wird übersprungen, unbekanntes Feld ignoriert, höhere Schema-Hauptversion führt zum Neuladen – nie zu einer leeren Slide. Das ist ein Test in Phase 1.
- **Die Kategorien legt die Extension beim ersten Aufruf selbst an**, wie der Setup-Assistent von `ct-pass-store`.
- **Der KV-Zugriff liegt hinter genau einer Naht** (Repository). Dahinter zuerst der Mock aus `fixtures/`, später der echte Store.

### F. Rechte und Datenschutz

**Für den MVP genügt ein Satz:** Der Geräte-Benutzer darf lesen, was die Screens zeigen, und nichts sonst – **außer sein Lebenszeichen zu schreiben** (seit 2026-10-06, Punkt 59: „Daten erstellen" und „bearbeiten" nur auf `status`). Konkret:

| Lesen auf | Wofür |
| --- | --- |
| Die **öffentlichen** Kalender, die ein Screen zeigt – über den öffentlichen Benutzer, ohne eigenes Recht (G53) | Terminblöcke |
| `view custom data` auf `screens`, `playlists`, `slides`, `media`, `settings` | Screen-Konfiguration |

**Nur öffentliche Kalender** *(entschieden am 2026-10-05, Nutzer: „Nicht öffentliche Kalender holen wir uns erst gar nicht"; Maßstab berichtigt am 2026-10-06, G53)*: Ein Fernseher zeigt nur Termine aus Kalendern, die in ChurchTools **öffentlich** sind, und von diesen keine, die als intern markiert sind (`isInternal`). **Öffentlich ist ein Kalender, den der öffentliche Benutzer sehen darf** – also genau die, die `GET /api/calendars` ohne Anmeldung liefert. Das Feld `isPublic` taugt dafür nicht: Es heißt nur „Gemeindekalender" und ist veraltet; daran rutschten in der Produktivinstanz interne Gemeindekalender durch. Gestalter bekommen nicht öffentliche Kalender gar nicht erst zur Wahl, und der Player fragt sie nicht ab – auch dann nicht, wenn das Gerätekonto sie über Status oder eine andere Gruppe lesen dürfte. **Ein eigenes Kalenderrecht braucht das Gerät nicht:** Was der öffentliche Benutzer sieht, sieht jedes angemeldete Konto mit. Welche Kalender öffentlich sind, entscheidet die Gemeinde in ihrer Rechteverwaltung, nicht das Modul; das Modul sagt an den Stellen, wo es auffällt, wo man das einstellt. Umgesetzt in `v0.8.0` (Archiv, Punkt 62), berichtigt in `v0.15.1` (Archiv, Punkt 73). Seit Punkt 85 b kann ein Administrator einzelne nicht öffentliche Kalender in den Einstellungen für Bildschirme freigeben (`screenCalendarIds`); sonst gilt der Satz unverändert.

**Ausdrücklich nicht:** Personendaten, Schreibrechte (bis auf `status`), Administrationsrechte, Zweifaktor – **und auch kein Wiki-Recht**: Bilder kommen über die Adresse des Bilddienstes, die ohne Anmeldung trägt (G14, G27). **Rollenkonzept** *(festgelegt am 2026-09-24)*:

| Rolle | Wer | Darf |
| --- | --- | --- |
| **Administrator** | wer in ChurchTools Berechtigungen verwalten darf (`churchcore` „administer persons") | die Extension installieren; die **Einstellungen** öffnen, dort die Gruppen samt Rechten anlegen (Assistent) und prüfen; beim ersten Start entstehen die Kategorien des Moduls |
| **Gestalter** | Mitglieder von „Infoscreen-Designer" | **Inhalte und Zeitpläne**: Slides und Playlists anlegen, ändern, löschen; **wählen, welche Playlist wann läuft** (Zeitplan, seit 2026-09-25); Bilder in den Wiki-Bereich „Infoscreen" laden. **Nicht:** Screens anlegen, löschen oder konfigurieren (Name, Format, Overscan), Einstellungen, Kategorien, Rechte |
| **Gerät** | Mitglieder von „Infoscreen-Devices" | nur lesen: Modul, seine Daten, die Kalender der Screens – und sein Lebenszeichen in `status` schreiben (Punkt 59) |

Wer kein Administrator ist, sieht „Einstellungen" weder in der Kopfleiste noch in der Seitenleiste; ruft er die Adresse trotzdem auf, sagt die Seite, dass sie Sache der Administratoren ist. Das ist Bedienung, keine Sperre – die Sperre sind die Rechte selbst: Gestalter haben kein Schreibrecht auf `settings`, Geräte gar keines. **Entschieden am 2026-09-25: Screens konfigurieren nur Administratoren** – anlegen, löschen, Name, Format, Overscan –, damit Gestalter die Screen-Konfiguration nicht beschädigen können; ein Screen steht für ein Gerät im Haus. **Den Zeitplan wählen die Gestalter** (entschieden am selben Tag) – er gehört zum Inhalt, nicht zur Gerätekonfiguration. **Umgesetzt am 2026-09-25** (Punkte 15 und 17): Der Editor schreibt nur Slides, Playlists und das Zeitplan-Dokument; der Assistent gibt Gestaltern kein Schreibrecht mehr auf `screens` und nimmt ein vorhandenes zurück.

**Entfernen nur, was das Modul selbst angelegt hat** *(entschieden am 2026-09-28, Nutzer)*: Gelöscht wird – wenn
überhaupt – nur, was über das Modul entstanden ist. Was ein Administrator in der Auswahl der Einstellungen wählt,
etwa eine bestehende Gruppe, wird beim Entfernen **auf keinen Fall** gelöscht. Wiedererkannt wird Eigenes an der
**gespeicherten id aus dem Moment des Anlegens**, nie am Namen: Eine Gruppe oder ein Bereich mit passendem Namen kann
der Gemeinde gehören.

| Spur | Wem sie gehört | Stand im Code (2026-09-28, Schema 1.12) |
| --- | --- | --- |
| Kategorien und Werte des Modulspeichers | dem Modul | nur über das Modul erreichbar |
| Gruppen „Infoscreen-Designer" und „Infoscreen-Devices" | dem Modul, **wenn der Assistent sie angelegt hat** | **hält die Regel ein:** `createdGroupIds` in `settings`; „Einrichtung entfernen" und „Rechte aktualisieren" fassen nur diese ids an, gleichnamige fremde Gruppen werden angezeigt, aber nie übernommen. Das Entfernen steckt in `removeCreatedGroups` und ist getestet; bricht es ab, bleiben die noch vorhandenen ids gespeichert. **Seit 0.2.3 (G39):** Vor dem Löschen wird einmal unverändert gespeichert, sonst wird nichts gelöscht; eine Gruppe mit `404` gilt als entfernt; ein Dialog verlangt das Wort „entfernen“ |
| Gewählte bestehende Gruppen | der Gemeinde | werden weder gelöscht noch mit Rechten versehen |
| Wiki-Bereich „Infoscreen" | dem Modul, **wenn es ihn angelegt hat** | **hält die Regel ein:** Nur der Einrichtungsassistent legt den Bereich an und merkt sich die id in `createdWikiCategoryId`; die Mediathek sucht nur und legt nie an. Ein vorgefundener Bereich gleichen Namens wird mitbenutzt, gilt aber als fremd, und die Einstellungen sagen das. Installationen vor Schema 1.12 haben die id nicht – ihr Bereich gilt ebenfalls als fremd und bleibt stehen. Einen Knopf zum Löschen des Bereichs gibt es nicht. **Seit 0.2.3** *(Wunsch des Nutzers, 2026-09-28)* blendet „Einrichtung entfernen" ihn wieder ins Wiki-Menü ein, damit Administratoren die Bilder sichern können – eingeblendet, nie gelöscht, auch ein fremder Bereich. **Rest:** Sieht der Administrator den Bereich mangels Wiki-Rechten nicht, legt der Assistent einen zweiten an (G20) |
| Wiki-Seiten des Moduls | dem Modul | tragen die Marke `<!-- infoscreen-designer -->`; fremder Text wird nie überschrieben |
| Hochgeladene Bilder | dem Modul | liegen auf den Seiten des Moduls |
| Geräte-Benutzer | der Gemeinde | legt der Administrator in der Oberfläche an, nicht das Modul |
| Modulrechte an der Administratoren-Rolle (`docs/Einrichtung.md`, Schritt 2) | der Gemeinde | setzt der Administrator von Hand; **verschwinden mit der Extension** – ChurchTools nimmt sie beim Löschen selbst zurück (G38) |

**Zwei Befunde, die den Bau betreffen – der Rest steht in [`Befunde.md`](Befunde.md), „Der Betriebsbenutzer":**

- **Fehlende Rechte sehen nicht wie Fehler aus**, sondern wie leere Listen (G20). Der Player belegt jede Anfrage mit `only_allow_authenticated=true`, prüft die Identität über `whoami` und **behandelt einen leeren Screen als Fehler**, nicht als leeren Kalender.
- **Wie das Konto eingerichtet wird, ist gemessen** (G21): Rechte über eine eigene Gruppe, Status „Aktiv", Rolle „Mitarbeiter"; die Person braucht einen Benutzernamen. Das reicht für den Bau. Die offenen Reste daran sind Stoff für die Einrichtungsdoku in Phase 4.

**Die Datenschutzfrage ist nicht die API, sondern das Foyer**: Was ein angemeldeter Gestalter in einen Screen legt, sieht jeder. Geburtstage, Dienstpläne mit Namen und Gruppenkontakte kommen deshalb nicht in den MVP.

## Phase 0 und Testinstanz

Das Messprotokoll steht in [`Befunde.md`](Befunde.md). Stand:

| | Punkte |
| --- | --- |
| **Beantwortet** | G1–G8, G11, G14, G15, G16 (600 Anfragen je Minute und IP), G18, G19, G20, G22; G21 für den Bau ausreichend |
| **Blockiert und zwingend** | **G9** (Login-Token unter `/ccm/`) |
| **Blockiert, aber verzichtbar** | G10 (Service Worker – ohne ihn bleibt Offline-Festigkeit halb, siehe Risiko 2) |
| **Hinfällig** | G12, G13 – die Felder gibt es nicht (G22) |
| **Geparkt** | G17 (Extension Store) · G21-Reste |

**Die Testinstanz** ist leer angelegt, Build und Upload-Grenze wie produktiv. Dort darf ausprobiert, liegengelassen und zerschossen werden; gegen die Produktivinstanz wird nur gelesen. **Ihr Ertrag sind die Fixtures unter `fixtures/`** (nicht versioniert) – gegen sie läuft die gesamte Entwicklung, und sie sind **seit dem 2026-09-24 außerhalb des Repos gesichert**. Neu Aufgezeichnetes wird nachgesichert – seit dem 2026-09-28 ohne Frist, weil die Instanz für die Entwicklung bleibt.

## Datenquellen für Inhaltsblöcke

Geprüft gegen die OpenAPI-Spezifikation 3.136.2. **Fett = MVP.**

| Block | Endpunkte |
| --- | --- |
| **Termine** | `/calendars`, `/calendars/appointments` (**`calendar_ids[]` Pflicht**, dazu `from`, `to`). Serien löst der Server auf, samt Ausnahmen und Zeitumstellung; Zeiten in UTC (G19) |
| **Gemeindekopf** | `/info` (Name, Anschrift), Logo über `<instanz>/logo`, anonym; Ziel der Weiterleitung mit `w`/`h` (G29) |
| **Bilder** | `imageUrl` (`/images/{fileId}/{hash}`) am Bilddienst, **immer mit `w` und `h`** (G14) |
| Beiträge / News | `/posts` – Inhalt als Markdown; ohne Anmeldung aus öffentlichen Gruppen, samt Autorname; das Geräte-Konto sieht nicht mehr; interne Gruppen offen (G37) |
| Gruppen & Anmeldungen | `/groups`, `/publicgroups/{id}` |
| Raumbelegung | `/resource/masterdata`, `/bookings` (`resource_ids[]` Pflicht) |
| Dienste / Gottesdienst | `/events`, `/events/{id}/agenda`, `/services` |
| Freie Texte | `/wiki/pages` |

## Medien

**Gebaut am 2026-09-24 (G8, G14, G26, G27):** Das Modul hat einen eigenen Wiki-Bereich **„Infoscreen"**. Seine Startseite `main` erklärt Designer und Einrichtung und wird vom Modul geschrieben, solange sie niemand ändert. **Jeder Screen hat eine Seite, benannt nach seiner Adresse**; an ihr hängen die für ihn hochgeladenen Bilder, verwendbar sind sie in jedem Screen. Seite und Bereich legt der Designer bei Bedarf selbst an. Jede Datei trägt eine `imageUrl` am Bilddienst – der Player fordert damit genau die Blockgröße an. Ohne Wiki gibt es keinen sauberen Weg (G26).

Die Mediathek im Designer lädt hoch (Knopf oder Ziehen), zeigt alle Bilder aller Screen-Seiten und übernimmt auch Bilder, die jemand direkt im Wiki hochgeladen hat. **Vor dem Löschen nennt sie jede Stelle, an der ein Bild gezeigt wird.**

- **Beide Maße sind Pflicht**: Ohne Parameter liefert der Bilddienst 150×150, `w` allein ergibt 1920×150.
- **Die `imageUrl` ist anonym abrufbar**, geschützt allein durch den Hash – gehört in die Betriebsdoku.
- **Beim Upload im Browser herunterskalieren**, auf 3840 px an der langen Kante – ChurchTools verkleinert selbst nichts, `max_width` bleibt ohne Wirkung (G27).
- **Eine fehlende Datei zeigt der Player als ruhigen Platzhalter**, nicht als Bruchsymbol.
- **Videos kommen nach dem MVP**: Externe Videos blockiert die CSP (kein `media-src`, G15), und ein Pi spielt sie nicht zuverlässig ab. Erst auf der echten Hardware messen.

## Eigener Web-Code – nach dem MVP

Ein HTML-Block führt fremden Code auf der ChurchTools-Domain aus, in der Sitzung eines angemeldeten Benutzers. Er ist das riskanteste Stück des Moduls, und seit G15 ist er zusätzlich beschnitten: **Ein `srcdoc`-Rahmen erbt die CSP, eigene `<script>`-Schnipsel laufen darin nicht.** Was trägt, ist „fremde Seite per `src` einbetten" sowie reines HTML/CSS. Deshalb **nicht im MVP** (entschieden am 2026-09-24, siehe Offene Entscheidung 2).

**Wenn er kommt, gilt ohne Ausnahme:** `<iframe sandbox="allow-scripts">` **ohne** `allow-same-origin`, abgesichert durch einen Test; eigenes Recht, getrennt vom Gestalten; eigener Datenwert in `snippets`; Code wird unverändert gespeichert – die Sandbox ist die Grenze, kein Filter.

## Playlists und Zeitpläne

**Die Oberfläche ist seit dem 2026-09-25 gebaut (Punkte 17 und 19 der Nächsten Schritte); wählen dürfen sie die Gestalter.** **Entschieden am 2026-09-25: Playlists stehen für sich** – sie werden unabhängig von einem Screen angelegt, und ein Screen wählt sie in seinem Zeitplan; dieselbe Playlist darf auf mehreren Screens laufen. Der Editor hängt an der Playlist, nicht am Screen. Begriffe: **Screen** = Gerät (Administratoren), **Zeitplan** = was der Screen wann zeigt (Gestalter, am Screen), **Playlist** = Inhalt (Gestalter, eigener Bereich). **Entschieden am 2026-09-23:** Das Modell lautet **Screen → Playlist → Slides**. Die Ebene kommt in Phase 1 ins Schema, weil sie sich später nur mit einer Datenmigration auf laufenden Geräten nachziehen ließe. **Die Oberfläche dafür kommt später.** Im MVP hat jeder Screen genau eine Playlist, und der Gestalter merkt davon nichts.

Für den späteren Zeitplan liegen die Regeln fest, damit das Schema sie tragen kann:

- Zwei Regelarten: **nach Termin** („30 Minuten vor Gottesdienstbeginn" – dank G19 billig) und **nach Uhrzeit**.
- **Eine Standard-Playlist ist Pflicht**, dazu eine feste Vorrangregel bei Überschneidungen.
- **Der Player wechselt die Playlist nicht, solange seine Uhr unbestätigt ist**, und hält alle Playlists eines Screens vor.
- **Slides werden referenziert**, dürfen in mehreren Playlists stehen; der Designer zeigt, wo überall.

## Funktionsumfang

### MVP – was der Pitch verlangt

**Designer**

- Screens anlegen, umbenennen, löschen; je Screen ein **Slug** und eine Auflösung (quer oder hoch).
- Slides mit **eigener Anzeigedauer**, Reihenfolge per Drag-and-drop, einzeln deaktivierbar.
- Blöcke frei platzierbar: **Terminliste, Einzeltermin, Bild, Text, Fläche/Farbverlauf, Uhr und Datum, Gemeindekopf** (der abschaltbare Header aus dem Pitch).
- Gestaltung: Position, Größe, Schrift, Farben, Hintergrund, Ebenen.
- Bindung eines Terminblocks: Kalenderauswahl, Zeitfenster, Anzahl.
- **Mediathek**: hochladen und auswählen.
- Live-Vorschau in Zielauflösung, unter denselben Bedingungen wie der Player.

**Player**

- Route `/player?screen=<slug>`, keine Bedienelemente, kein Mauszeiger, alles stumm.
- Skalierung der Bildfläche mit Letterbox und Overscan-Korrektur.
- Slide-Rotation; **drei getrennte Intervalle**: Slides (Sekunden), ChurchTools-Daten (Minuten), Screen-Konfiguration (wenige Minuten – sonst sieht niemand seine Änderung, bevor er das Haus verlässt).
- Anmeldung per Token, `whoami`-Prüfung, leerer Screen = Fehler mit sichtbarer Meldung (F).
- **Uhrprüfung**: Gerätezeit gegen die Zeit einer API-Antwort; unbestätigt lieber keine Uhr als eine falsche.
- Letzter erfolgreicher Stand in IndexedDB, **Bilder in Cache Storage** (nach dem ersten Durchlauf lädt das Gerät sie von der eigenen Platte, G28), Bilder der nächsten Slide vorab dekodiert; Backoff bei Fehlern, `429`/`Retry-After` beachten, zufälliger Versatz im Intervall.
- Selbstheilung: Neuanmeldung, Neuladen nach wiederholten Fehlern und bei Modul-Ladefehlern, nächtlicher Neustart der Seite.
- Duldsam gegenüber neueren Daten (E).

### Später

Die Liste ist am 2026-10-01 aufgelöst worden *(Nutzer: „Lass uns die später Liste sauber leer bekommen")*; ihr Wortlaut steht im [Archiv](docs/Plan-Archiv.md), Abschnitt „Funktionsumfang – Später". Gebaut ist davon: eigene Bereiche für Playlists, Zeitpläne und Mediathek (Punkte 16, 19, 21), Duplizieren von Playlists (31), Raumbelegung und Dienste (46, 51), Löschen in der Mediathek mit den Fundstellen (18), der Service Worker (37), Webseite und Video (28, 52). Was offen blieb, steht in „Auf einen Blick" – als Idee oder unter „Bewusst geparkt". Eine neue Idee kommt gleich dorthin, nicht hierher.

## Phasen

| Phase | Inhalt | Ergebnis |
| --- | --- | --- |
| **0 – Machbarkeit** | **Abgeschlossen am 2026-09-24:** Extension hochgeladen, läuft im echten ChurchTools; G9 wird nur für Weg B gebraucht | „Hallo &lt;Vorname&gt;" läuft im echten ChurchTools ✓ |
| **1 – Datenmodell** | Schema Screen → Playlist → Slides → Blöcke, versioniert und duldsam; Slug; KV-Repository mit Mock; Revisionsprüfung. **Dazu die Terminnormalisierung** als eigene Schicht mit Tests gegen die Fixtures (ganztägig, mehrtägig, Zeitzone der Instanz) | Screens lassen sich ohne Oberfläche speichern und laden |
| **2 – Player** | Blockrendering, Bildfläche, Rotation, Intervalle, Token-Anmeldung, Uhrprüfung, Offline-Stand | Ein von Hand geschriebener Screen läuft auf einem Kiosk-Gerät am Foyer-TV |
| **3 – Designer** | Editor, Slide-Verwaltung, Blockpalette, Inspektor, Vorschau, Mediathek | Ein Screen mit eigenen Bildern entsteht ohne Entwicklerhilfe |
| **4 – Betrieb** | Einrichtungsdoku für Geräte-Benutzer und FullPageOS, Release-Workflow | Ein zweiter Screen geht ohne uns in Betrieb |

Phase 2 vor Phase 3 – ein Designer für ein Ausgabeformat, das noch nie auf einem TV lief, gestaltet ins Blaue.

## Konventionen

Sprache, Geheimnisse, Commit-Form und die drei Bauregeln stehen in [`AGENTS.md`](AGENTS.md). Hier nur, was dort fehlt:

- **Tests laufen nie gegen eine Live-Instanz**, sondern gegen aufgezeichnete Antworten unter `fixtures/`. Das Verzeichnis ist nicht versioniert; ein frisch geklonter Arbeitsplatz muss sie sich beschaffen.
- **Ohne Fixtures überspringen sich die Tests, die sie brauchen** – sichtbar als übersprungen, nicht still grün (entschieden am 2026-09-24). Das CI auf GitHub hat keine Fixtures und prüft deshalb nur, was ohne sie geht. **Die Form der Antworten wird dafür dokumentiert statt eingecheckt**: als Typen im Code, die nur die tatsächlich gelesenen Felder beschreiben, ohne Daten. Tests ohne Fixtures bauen ihre Eingaben aus diesen Typen selbst.
- **Aufgezeichnet wird nur von der Testinstanz – und vor dem Ablegen bereinigt**, mit `scripts/sanitize-fixture.js`. Zu entfernen sind mindestens:

  | Klasse | Beispiel | Warum |
  | --- | --- | --- |
  | Personenbezogene Felder | E-Mail, Telefon, Anschrift, Geburtstag | Datenschutz |
  | Instanz-URL | `site_url`, `fileUrl`, `apiUrl` | Grundregel des Repos |
  | Schlüssel und Geheimnisse | `site_licensekey`, `*_apikey`, `*_token`, `*_secret` | Beim ersten Durchgang übersehen |
  | Geheime Abo-Adressen | `randomUrl` am Kalender, `iCalUid` | Die iCal-Adresse ist ein Zugangsschlüssel (G22) |
  | Datei- und Bild-Hashes | `/images/{id}/{hash}`, `filename=<hash>` | Zugangsschlüssel, keine Kennungen (G14) |

  Die Regel gilt auch für Felder, die auf der Testinstanz leer sind – auf einer produktiven Instanz sind sie es nicht unbedingt. **Nicht** bereinigt werden Gruppen-, Kalender- und Dienstnamen: Umlaute, Längen und Namensgleichheiten sind wertvolle Testdaten.
- **Tests, die Vorgaben sichern**: Duldsamkeit des Players (erfundener Blocktyp, unbekanntes Feld). Genau ein JS-Bündel, kein Inline-Skript und keine `*.church.tools`-Adresse im `dist/` prüft `scripts/check-dist.js` bei jedem Build.
- **CI bei jedem Push**: Lint, Typecheck, Tests, Build. Tag `vx.y.z` baut das Release; Version in `package.json`, `package-lock.json` und `CHANGELOG.md` gemeinsam ziehen.
- **Rulesets auf GitHub** (seit dem 2026-09-28, übernommen von `connect-churchtools`): `main` lässt sich von niemandem löschen oder per Force-Push umschreiben, die Historie bleibt linear. Andere als Admins kommen nur per Pull Request mit grüner Prüfung `check` hinein, gemergt wird nur per Squash. Release-Tags `v*` legen nur Admins an; löschen oder verschieben kann sie niemand. **Scheitert ein Release-Lauf, wird die nächste Patch-Version getaggt**, statt den Tag neu zu setzen. Heißt der CI-Job einmal anders, muss die Pflicht-Prüfung im Ruleset mitziehen, sonst lässt sich keine PR mehr mergen.
- **Folie, Präsentation, Bildschirm** *(Nutzer, 2026-10-09, Punkt 79, B1)*: In Oberfläche und Anwenderdoku heißt eine Slide **Folie**, eine Playlist **Präsentation**, ein Screen **Bildschirm**. Code, Bezeichner, Schema, Kategorien, `data-testid`, Routen und Geräteadressen bleiben englisch; die internen Dokumente (dieser Plan, `Befunde.md`, das Archiv) behalten die alten Wörter, weil sie dort auch den Code meinen. Sichtbare Texte stehen in `src/i18n/` (`designer.ts`, `player.ts`, `repository.ts`), die Sprache in `LOCALE`; zwei Wächtertests halten Text aus den Templates und die alten Wörter aus den Textdateien. **„Bildschirm" oder „Fernseher"?** *(Nutzer am ZIP, 2026-10-09)*: Was man anlegt, benennt und adressiert, ist ein **Bildschirm** – Kachel, Zeitplan, „Adressen der Bildschirme". „Fernseher" bleibt für das Gerät im Raum, in erklärenden Sätzen („auf dem Fernseher zu sehen", „Dieser Fernseher ist nicht angemeldet"). Seiten zählen, was sie zeigen („Alle Zeitpläne · 2 Zeitpläne", nicht „Alle Bildschirme").
- **Neue Bausteine bringen die übliche Formatierung gleich mit** *(Nutzer, 2026-10-14: „sollten wir neue Bausteine erstellen, packen wir immer gleich das Default Set an Formatierungsmöglichkeiten dazu“)*: Ein Baustein mit Text bekommt den Abschnitt „Schrift“ (`FontSection`) mit allem, was zu seinem Inhalt passt – Schriftart, Größe, Stärke, Farbe, Ausrichtung, Abstände und Schatten (`effects="shadow"`); Drehen und Deckkraft hat jeder Baustein ohnehin. Was nicht zum Inhalt passt, bleibt weg (etwa die Hinterlegung, die nur der Text-Baustein hat). Der Unit-Test „the font of the blocks“ in `src/designer/inspector/blocks/quick.test.ts` prüft Abschnitt und Schatten für jeden Baustein mit Textstil; eine Ausnahme steht dort mit Grund und als Rest hier im Plan.
- **Bildfläche, nicht Bühne** *(Nutzer, 2026-09-28)*: Die Fläche von 1920 × 1080 bzw. 1080 × 1920, auf der im Editor gestaltet wird und die der Fernseher zeigt, heißt in Oberfläche und Dokumentation **Bildfläche**; im Code bleibt es `stage`. Ausgewählt aus zehn Vorschlägen, weil das Wort im Editor und am Fernseher gleich gut passt und sich weder mit „Slide" (Folie) noch mit „Screen" noch mit der Beamer-Leinwand im Saal verwechseln lässt.

## Risiken

1. ~~**Die Freischaltung kommt nicht rechtzeitig.**~~ **Entfallen:** freigeschaltet am 2026-09-24, die Frist ist seit dem 2026-09-28 aufgehoben (F1). Die Lizenz der Testinstanz läuft am 2026-10-22 um 21:53 ab, die Anfrage ist unbeantwortet. Bis Phase 2 hält das nichts auf – dann aber muss ein Modul irgendwo laufen. Rückfall ist ein Testmodul unter eigenem Key (`infoscreen-designer-test`) auf der **Produktivinstanz**, das nur in eigene Kategorien schreibt. **Das ist eine Entscheidung, keine Automatik** – nach den Arbeitsregeln wird dort bisher nichts geschrieben.
2. **Das Gerät läuft unbeaufsichtigt.** Speicherlecks, abgelaufene Sitzungen, Netz- und Stromausfälle, schwache Hardware. Der Player muss von selbst wieder hochkommen. Daten und Bilder liegen nach dem ersten Durchlauf auf dem Gerät (G28); die Seite selbst aber nicht – ohne Service Worker (G10) zeigt ein Gerät, das während eines Netzausfalls neu startet, nichts. Das ist dann zu benennen, nicht zu übergehen.
3. **Login-Token auf der SD-Karte.** Tragbar, weil der Rückzugsweg gemessen ist (Passwortwechsel, G18) und das Konto nur liest.
4. **Stilgrenze zur Hostseite.** Ohne sie hängt das Aussehen der Bildfläche von ChurchTools-Updates ab – und unsere Stile beschädigen fremde Oberflächen.
5. **ChurchTools ändert die Extension-Schnittstelle.** Deshalb eine Naht (Repository), nicht KV-Zugriffe quer durch die Anwendung.
6. **Stilles gegenseitiges Überschreiben.** Kein ETag, keine Transaktion (G3). Revisionsprüfung und „Index zuletzt" erkennen den Konflikt, verhindern ihn nicht.
7. **Ein Update der Extension bricht laufende Player.** Neue Asset-Namen, alter Kiosk-Tab, `404` auf einen Chunk. Deshalb ein Bündel und Neuladen bei Modul-Ladefehlern, im CI geprüft.
8. **Die Instanz-URL landet im Release-Build.** Vite ersetzt `import.meta.env.*` zur Bauzeit. Deshalb tragen Instanz-URL und Token kein `VITE_`-Präfix und leben nur im Dev-Proxy; `scripts/check-dist.js` sucht bei jedem Build nach `*.church.tools` im `dist/`.

## Offene Entscheidungen

**Vor Phase 1 – beide entschieden:**

1. ~~**Undo/Redo: Zustand oder Befehle?**~~ – **entschieden am 2026-09-24 für V1: Zustand.** Der Designer führt einen Verlauf von Schnappschüssen der betroffenen Slide, keine umkehrbaren Befehle. Die Werte sind klein (höchstens 10.000 Zeichen), und Schnappschüsse sind mit Pinia einfacher und robuster. Reicht das später nicht mehr, wird neu entschieden.
2. ~~**MVP-Zuschnitt**~~ – **entschieden am 2026-09-24: wie unter „Funktionsumfang – MVP"**. V1 hat Termine, Bilder, Text, Gemeindekopf und Uhr, eine Playlist je Screen; kein Web-Code-Block, keine Geburtstage, keine Videos. Alles unter „Später" ist ausdrücklich nicht V1.

3. ~~**Hardware**~~ – **entschieden am 2026-09-24: keine Zielhardware.** Die Extension geht an die Community; dort laufen Raspberry Pis, Mini-PCs und VMs nebeneinander. Der Player setzt deshalb nur einen aktuellen Browser mit **dauerhaftem Profil** voraus und holt nach dem ersten Durchlauf alles Schwere vom Gerät selbst: Konfiguration und Termine aus IndexedDB, Bilder aus Cache Storage, die Bilder der nächsten Slide vorab dekodiert. Ein Test auf schwacher Hardware (ein älterer Pi) bleibt sinnvoll, entscheidet aber nichts mehr vorab.

**Nicht blockierend – entschieden am 2026-09-29:**

4. ~~**Zeitbudget.**~~ – **entschieden am 2026-09-29: kein festes Budget.** Der Pitch ist der Taktgeber; jedes fertige Stück wird ein Release. Der MVP war da schon gebaut.

**Mit Vorgabe beantwortet, bis jemand widerspricht:**

- **Zielgruppe**: zuerst nur wir; der Extension Store (G17) kommt später. Keine eigene Instanz-URL im Build hält die Tür offen.
- **Wer gestaltet**: zuerst wir.
- **Aktualität**: Konfiguration alle 2 Minuten, Daten alle 10 Minuten, jeweils mit Versatz.
- **Ton**: alles stumm.

**Gestrichen am 2026-09-24:** die Rückfallposition bei den Medien (der Wiki-Weg trägt) und eine gemeinsame `ct-utils`-Bibliothek mit `ct-pass-store` (Abstimmungsaufwand ohne Produktnutzen; der Code bleibt als Vorlage lesbar).

## Nächste Schritte

Hier stehen nur Punkte, die noch nicht veröffentlicht sind, mit vollem Text. Die Rangfolge steht in „Auf einen Blick".

46. **Weitere Inhalte – Kandidaten** *(recherchiert am 2026-09-29; „wir schauen dann auf dem Weg, welche wir mitnehmen")*. **Maßstab des Nutzers: Was lokal und mit ChurchTools geht, hat Vorrang.** Kein Auftrag; jeder Punkt braucht vor dem Bau seinen eigenen Bauplan. Erledigt sind 1 Galerie (`v0.3.6`), 2 Raumbelegung (`v0.3.8`), 3 Dienste am Termin (`v0.3.9`, Punkt 51) und 4 Video (`v0.4.0`, Punkt 52) – Recherche, Bauplan-Entwürfe und Messungen dazu im Archiv. Offen:
    5. ~~**Einbettungscode in „Webseite"**~~ – **veröffentlicht in `v0.5.0`** (Archiv, Punkt 55 C).
    6. ~~**YouTube/Vimeo, auch der Livestream**~~ – **zurückgestellt am 2026-10-01 (Nutzer):** Der Livestream wird im Haus über SDI verteilt, ohne Zeitverzögerung; ein Baustein dafür bringt nichts. Wenn doch: eigener Baustein, weil YouTube im Rahmen von „Webseite" die Einbettung verweigert (Archiv, Punkt 28). **Wieder angefragt als Vorschlag #131 (2026-10-16):** ein einzelnes Video über seine Adresse oder das neueste einer YouTube-Playlist, mit Autostart, Ton und Wiederholung oder Weiterschalten. Ein einzelnes Video über den offiziellen Player passt unter die CSP (`child-src *`, G15); zu messen wäre, ob es im Kiosk von selbst startet. „Das neueste einer Playlist“ bräuchte die Programmierschnittstelle von YouTube mit eigenem Schlüssel, also einen fremden Dienst. **Entscheidung beim Nutzer.**
    7. ~~**Videos ohne Netz**~~ – **veröffentlicht in `v0.36.0`** (Archiv, Punkt 102; G63).

    **Nicht aufgenommen:** Wetter (fremder Dienst, für uns unwichtig); Losung des Tages (nur nach Anfrage bei der Herrnhuter Brüdergemeine); Geburtstage (Datenschutz); Social Feeds (entschieden am 2026-09-25); PDF und PowerPoint (als Bilder exportieren).

56. **Vorschau in einem zweiten Fenster** *(Rest aus Punkt 24; noch nicht gewählt)*. Für zwei Bildschirme: Die Vorschau des Editors läuft in einem eigenen Fenster mit, während man bearbeitet. Skizze: eine Route `/vorschau/<playlist>` ohne Bedienelemente, die der Editor über „Vorschau › im eigenen Fenster" öffnet; der Editor sendet seinen ungespeicherten Stand (Slides, Playlist, gewählte Slide) über einen `BroadcastChannel`, das Fenster zeigt die gewählte Slide und folgt der Auswahl. Schließt man den Editor, sagt das Fenster das und bleibt beim letzten Stand. Kein Schema, keine Rechte. Ein eigener Auftrag mit eigenem Release, erst wenn der Nutzer ihn wählt.

60. **Teststrategie prüfen – keine doppelten Prüfungen** *(Nutzer, 2026-10-02: „Teststrategie prüfen, keine doppelten Prüfungen")*. Eine Durchsicht (Opus), kein Umbau auf Verdacht; ihr Ergebnis ist eine kurze Regel in `LocalTests.md` und eine Liste dessen, was entfällt oder umzieht.
    - **Stand.** 57 Unit-Testdateien (Vitest, 694 Tests, wenige Sekunden) und 17 Browser-Testdateien (Playwright, je zwei Browser; ein Durchlauf in einem Browser dauert knapp acht Minuten). Die Pflichtprüfung `check` fährt Lint, Typprüfung, Unit-Tests und Build – **keine Browser-Tests**; die laufen nur von Hand. Der Release-Lauf fährt Lint, Typprüfung und Unit-Tests nach dem Merge ein zweites Mal.
    - **Was die Durchsicht klärt.** (1) **Jede Aussage an genau einer Stelle:** Logik im Unit-Test, Zusammenspiel im Browser-Test – wo beides dasselbe prüft (Beispiel: der Löschdialog der Mediathek hat seit `v0.7.0` einen Komponententest und zwei Browser-Tests), bleibt die schnellere Stelle, und der Browser-Test behält nur, was erst im Browser sichtbar wird. (2) **Mehrfach durchlaufene Wege:** Mehrere Browser-Tests bauen denselben Anlauf (Editor öffnen, Baustein anlegen, Mediathek mit nachgestellten Antworten) – gemeinsame Helfer statt Kopien, und ein Weg wird nicht in drei Dateien erneut geprüft. (3) **Doppelte Läufe:** ob der Release-Lauf wiederholen muss, was `check` am selben Stand schon bestanden hat, und ob jeder Browser-Test wirklich beide Browser braucht. (3a) **Wackelnde Tests:** `video.spec.ts`, „the player loops the video …", scheiterte in WebKit etwa einmal in drei Läufen – **geklärt und behoben am 2026-10-05:** Der Player startet aus seinem Zwischenstand (Video ohne Ton) und zeigt erst danach den frischen Stand; der Test sah nur den ersten `play()`-Aufruf. Dahinter lag ein echter Fehler: Wurde der Ton bei laufendem Video eingeschaltet, nahm der Player nur die Stummschaltung weg, und ein Browser ohne Klick hält das Video dann an. Jetzt startet der Block neu (mit Rückfall auf stumm; veröffentlicht in `v0.8.1`), der Test prüft irgendeinen Aufruf mit Ton; 30 von 30 Läufen in WebKit grün. (4) **Was niemand ausführt:** Eine Browser-Prüfung war auf `main` unbemerkt rot (`home.spec.ts`, behoben in `v0.7.0`), weil `check` sie nicht fährt – entweder eine kleine, schnelle Auswahl in `check` aufnehmen oder festlegen, wann die Suite von Hand läuft. (5) **Die Stilgrenze zur Hostseite:** Zweimal hat erst ChurchTools gezeigt, was der Demo-Modus verbirgt (G43 samt Nachtrag) – prüfen, ob ein Browser-Test mit den Stylesheets der Hostseite und `body.cts` die Liste verbotener Klassennamen ersetzt oder ergänzt; die Stylesheets dürfen dabei nicht ins Repo.
    - **Fertig,** wenn zu jeder gestrichenen Prüfung dasteht, wo ihre Aussage weiterhin geprüft wird, die Laufzeiten vorher und nachher gemessen sind und keine Aussage verloren ging.
    - **Reihenfolge.** Berührt kein Produktverhalten; gebaut wird erst nach der Durchsicht und einem eigenen Auftrag.


79. **Der Designer für alle – Reste** *(B1 bis F3 veröffentlicht bis `v0.19.0`, am iPad abgenommen am 2026-10-21; Bauplan und Stand im Archiv, Punkt 79)*.
    - **Testpersonen** *(Nutzer)*: wer aus Welcome-Team oder Social Media den neuen Designer ausprobiert. Er läuft seit `v0.19.1` (2026-10-14) auf der Produktivinstanz.
    - **Abnahme nach jedem Paket:** Jemand ohne Vorwissen baut am Handy **und** am Rechner eine Slide nach einer Aufgabe („Gottesdienst am Sonntag mit Bild, Uhrzeit und Predigt"); der Nutzer schaut zu und notiert, wo gezögert wird. Das ist die Abnahme, nicht die Zahl der Funktionen.
    - **F4 Bewegung beim Einblenden.** Schema: `BlockFrame` optional `enter: { effect: 'fade' | 'rise' | 'slide-left' | 'slide-right' | 'zoom', delay: 0–3000 ms }`, feste Dauer 600 ms. Player: beim Zeigen einer Folie CSS-Animationen nur auf `transform` und `opacity` (wie Punkt 78), nach dem Überblenden der Folie (`PlayerView.vue`, `Transition name="fade"`); bei `prefers-reduced-motion` keine. Editor: Effekt und Verzögerung als Bildkacheln und Segment im Bereich „Darstellung", ein Knopf **„Bewegung abspielen"** an der Folie und in der Vorschau. **Erst messen** am Pi (P4 ist seit dem 2026-10-14 bestanden, die Messung also möglich): wie viele gleichzeitige Bewegungen über einer laufenden Galerie oder einem Video ruckelfrei bleiben; daraus eine Obergrenze je Folie mit Hinweis im Editor.
    - **D8 Seitenrand** *(Nutzer, 2026-10-10: **später** – nicht in D; bleibt Idee)*: optionales Feld `margin` in `ThemeDoc` (Vorgabe 80 px), auf der Seite „Design" einstellbar; der Editor zeigt ihn als feine Linie, rastet daran ein, und Ausrichten bei einem Baustein richtet am Rand statt an der Bildfläche aus. Der Player braucht das Feld nicht.

87. **Wiederverwendbare Designs – Reste** *(Idee von außen; Pakete A und B veröffentlicht mit `v0.27.0` und `v0.28.0`, Bauplan und Stand im Archiv, Punkt 87)*.
    - **Darstellungen für Listen-Bausteine** – wörtlich „für die verschiedenen Darstellungen von Sammlungen und Gruppen und Gruppenmitgliedern etc.“ das Design in den Einstellungen bereitstellen, „out of the Box“ mit einer Standardeinstellung je Baustein. Neu wären benannte Stile je Bausteinart, die ein Baustein wählt, statt alles selbst einzustellen. **Vorher beim Ideengeber nachfragen, was mit „Sammlungen“ gemeint ist** (Nutzer); einen Baustein dieses Namens gibt es nicht. Hierher gehört auch die Idee aus Punkt 86, frei zu wählen, welche Angaben eines Termins erscheinen, samt Reihenfolge.
    - **Kleine Reste aus Paket A:** (1) `mediaUses` zählt keine Bilder einer Vorlage, die auf keiner Folie steht. (2) Kein e2e für die Handy-Leiste im Bearbeiten-Modus. (3) Der Player bemerkt eine Vorlage, die beim Laden noch fehlte, erst mit der nächsten Änderung der Playlist (`contentChanged`).

*Die Punkte 92 bis 101 sind Vorschläge aus GitHub-Issues (2026-10-16/17), mit dem Nutzer durchgesehen und aufgenommen am 2026-10-17. 92 und 93 sind mit `v0.32.0`, 94 A mit `v0.33.0`, 94 B mit `v0.39.0`, 97 mit `v0.34.0`, 96 mit `v0.35.0` veröffentlicht (Archiv); #131 (YouTube/Vimeo) steht bei Punkt 46.6, #129 (Mitarbeiterkarten) unter „Ideen, nicht gewählt“.*

95. **Token aus der Adresszeile, Rücksprung zur Weiterleitung** *(Issue #140)*. Heute schreibt der Player den Token absichtlich zurück in die Adresse (`src/views/PlayerView.vue`): So landet ein Neuladen von Hand auch nach Ablauf der ChurchTools-Sitzung (24 Stunden, G32) wieder im Player und nicht auf der Anmeldeseite (G9). Ohne Token in der Adresse müsste der Player ihn selbst aufbewahren und beim Neuladen einsetzen – am Kiosk-Browser mit dauerhaftem Profil zu messen (G28), samt Neustart des Browsers und abgelaufener Sitzung. Dazu ein zweiter Wunsch aus dem Vorschlag: eine Rücksprungadresse (etwa eine Weiterleitung auf der Gemeinde-Website), die das nächtliche Neuladen aufruft, damit sich das Ziel ändern lässt, ohne das Image des Pi neu zu bauen; nur ausdrücklich erlaubte Adressen. Schützt vor beiläufigem Ablesen, nicht vor Weitergabe: Wer die Weiterleitung aufruft, bekommt den Token weiterhin (Punkt 101). **Schon einmal versucht:** Am 2026-09-25 nahm der Player den Token aus der Adresse und hielt ihn im `sessionStorage` (a1bfb32); am 2026-09-26 zurückgenommen (34687a1), weil ein Neuladen von Hand nach Ablauf der Sitzung auf der Anmeldeseite landete. ChurchTools prüft die Anmeldung, bevor unser Modul lädt – ein gespeicherter Token kommt dann nicht mehr zum Zug, der Speicherort allein löst es nicht. **Ungeprüfte Idee:** Der Service Worker hängt den Token beim Neuladen wieder an die Anfrage; ob er das darf und ob es einen Neustart des Browsers übersteht, am Kiosk-Browser messen. Bernhard hat selbst angefangen (2026-10-19) und es wieder aufgegeben: Bei F5 lädt der Browser die bereinigte Adresse, nicht die Weiterleitung, und nach Ablauf der Sitzung liefert ChurchTools den Player nicht aus – für seinen Betrieb nicht zuverlässig genug. Sein Fazit: Das gehört in die Extension-Möglichkeiten von ChurchTools, sonst bleibt es ein Workaround. Er hat dazu eine Anforderung entworfen (#140, 2026-10-19): begrenzte, einzeln widerrufbare Zugänge, die ChurchTools serverseitig durchsetzt; für Bildschirme ein Registrierungscode, den ein Administrator bestätigt, und danach ein dauerhaftes Geräte-Cookie (`HttpOnly`, `Secure`), das ChurchTools vor dem Laden des Moduls auswertet; für die Website eine kurzlebige Abspielfreigabe, die das CMS aus seinem Backend holt und mit der es den Player als iframe einbindet (Grundlage auch für Punkt 101). **Entschieden mit dem Nutzer am 2026-10-20:** vorher die Idee mit dem Service Worker messen, im Issue angekündigt. **Gemessen am selben Tag (G66):** Sie trägt. Der Player nimmt den Token aus der Adresse und gibt ihn dem Worker; lädt ein Seitenaufruf ohne Token die Anmeldeseite, fragt der Worker einmal mit dem Token nach und reicht die Weiterleitung von ChurchTools durch – Chrome übernimmt das Cookie, F5 und Neustart des Browsers landen im Player, auch nach abgelaufener Sitzung. Die Versuchsfassung liegt nur lokal auf dem Zweig `messung-95-service-worker`.

    **Bauplan** *(2026-10-20; **geparkt** mit dem Nutzer am selben Tag, siehe „Bewusst geparkt“)*. **Kiosk der Produktivinstanz** *(Startskript, vom Nutzer gezeigt am 2026-10-20)*: Chromium mit `--app=<Adresse mit Token in Abfrage und Fragment>` und eigenem `--user-data-dir`, ohne Inkognito – der Worker überlebt dort jeden Neustart, das Skript bliebe unverändert. Grundsatz: **Der Token verlässt die Adresse erst, wenn der Worker ihn sicher hat.** Ohne Worker (alter Browser, Registrierung gescheitert, Entwicklungsserver) bleibt alles wie heute.

    ```mermaid
    sequenceDiagram
        participant Pi as Kiosk-Browser
        participant SW as Service Worker
        participant CT as ChurchTools
        participant P as Player
        Note over Pi,P: Start – Adresse mit Token
        Pi->>SW: …/player?screen=foyer&user_id=22&login_token=…
        SW->>SW: Token ablegen (aus der Adresse)
        SW->>CT: Anfrage unverändert
        CT-->>Pi: 302 ohne Token, Cookie gesetzt (G9)
        Pi->>CT: …/player?screen=foyer&user_id=22
        CT-->>P: Player
        P->>SW: Token übergeben (falls der Worker neu ist)
        SW-->>P: abgelegt
        P->>P: Token aus der Adresse nehmen
        Note over Pi,P: Später – F5 oder nächtliches Neuladen, Sitzung abgelaufen
        Pi->>SW: …/player?screen=foyer&user_id=22
        SW->>CT: Anfrage ohne Token
        CT-->>SW: 200 Anmeldeseite
        SW->>CT: dieselbe Adresse mit abgelegtem Token (redirect: manual)
        CT-->>Pi: 302 ohne Token, Cookie gesetzt
        Pi->>SW: …/player?screen=foyer&user_id=22
        SW->>CT: Anfrage ohne Token
        CT-->>P: Player
    ```

    1. **Worker legt den Token selbst ab** (`src/sw/sw.ts`, Entscheidungen in `src/sw/logic.ts`): Trägt ein Aufruf des Players `login_token` und `user_id`, legt er beide in einem eigenen Cache ab (ohne `CACHE_PREFIX`, damit ein neuer Worker ihn nicht löscht – wie die Videos). Damit hat jeder Start des Pi über die volle Adresse den Token aktuell, auch nach einem neuen Token in den Einstellungen.
    2. **Player übergibt und wartet auf Bestätigung** (`PlayerView.vue`, `service-worker.ts`): beim ersten Start gibt es noch keinen Worker (er wird erst nach der ersten Anzeige registriert). Der Player schickt den Token, sobald ein Worker die Seite steuert – auch nach `controllerchange`, denn beim ersten Aufruf der Messung kam er beim alten Worker an (G66). **Erst auf die Antwort „abgelegt“** nimmt er `login_token` aus der Adresse, samt Fragment und dem hängenden `&`.
    3. **Nachfragen nur bei passender Person:** Der Worker fragt nur nach, wenn die Adresse eine `user_id` trägt und sie zur abgelegten Person passt. Wer den Player im eigenen Browser ohne `user_id` öffnet, bekommt nie heimlich die Sitzung eines Geräts.
    4. **Schleifenschutz statt 30-Sekunden-Sperre:** Der Worker merkt sich die Nachfrage (Adresse, Zeitpunkt) im Cache, nicht im Speicher, denn er kann zwischendurch beendet werden. Kommt die unmittelbar folgende Weiterleitung binnen 10 Sekunden wieder als Anmeldeseite an, gibt er sie aus und fragt nicht erneut – etwa bei einem zurückgezogenen Token. Jedes spätere Neuladen fragt wieder.
    5. **Seite erfragt den Token beim Worker:** Steht keiner in der Adresse, fragt der Player den Worker (Nachricht wie `has-page`, Punkt 37) und meldet sich damit nach 24 Stunden selbst neu an (`enableTokenLogin`) und schreibt das Lebenszeichen (Punkt 59).
    6. **Neuladen:** `reloadWithDeviceLogin` setzt den Token nur noch in die Adresse, wenn kein Worker ihn bestätigt hat; sonst `location.reload()`. `canReload()` braucht nichts Neues: Der `HEAD` auf die Adresse ohne Token bekommt auch ohne Sitzung `200`.
    7. **Nicht in diesem Schritt:** die Rücksprungadresse (eigener Wunsch aus #140) und alles, was den Token vor jemandem schützt, der die Entwicklertools des Kiosk-Browsers öffnet (G66).

    **Tests:** Unit-Tests für die neuen Entscheidungen in `src/sw/logic.test.ts` (wann ablegen, wann nachfragen, Schleifenschutz, Bereinigen der Adresse) und `device-login.test.ts`. Die e2e-Tests laufen am Entwicklungsserver ohne Worker, dort bleibt der Token in der Adresse – `e2e/player.spec.ts` prüft, dass das so bleibt. Der Ablauf mit Worker wird wie in G66 von Hand auf der Testinstanz geprüft, Fälle A bis C, dazu: erster Start auf frischem Profil, neuer Token in den Einstellungen, zurückgezogener Token und **das Update auf einem laufenden Gerät** (die alte Fassung läuft, die neue wird installiert, der Player lädt sich selbst neu – danach muss der Token aus der Adresse verschwunden sein). **Doku:** das Diagramm in [`docs/Einrichtung.md`](docs/Einrichtung.md), dazu ein Satz, dass „Websitedaten löschen“ im Kiosk-Browser auch den Token entfernt.

99. **Wer darf was – Zuständigkeiten für Bildschirme und gemeinsame Inhalte** *(Issue #139; erst Konzept)*. Wenn mehrere Teams den Designer nutzen: Bildschirm-Verantwortliche betreuen bestimmte Bildschirme, Bereitsteller pflegen gemeinsame Folien und Vorlagen. Gemeinsame Inhalte werden als Entwurf bearbeitet und erst vom Bereitsteller veröffentlicht, vorher zeigt der Designer die betroffenen Präsentationen; „weitere Verwendung sperren“ und „zurückziehen“ sind getrennt. Ziel ist zuerst ein abgestimmtes Konzept, dann die Liste dessen, was dem Extension-System von ChurchTools dafür fehlt: Heute gelten Rechte je Kategorie des Speichers (Abschnitt E), nicht je Dokument, und durchgesetzt werden müssten sie auch bei direkten Aufrufen der API. Berührt Vorlagen (Punkt 87 A) und Entwurf (Punkt 79 E).

100. **Änderungsprotokoll** *(Issue #134)*. Wer hat wann was an Präsentation, Folie, Bildschirm oder Einstellung geändert – im Designer einsehbar. Zwei Wege: eine eigene Kategorie im Speicher des Moduls mit deren Rechten, oder die Protokolle von ChurchTools selbst, falls es dafür eine Schnittstelle gibt (ungeprüft). Abzustimmen: welche Vorgänge, wer liest, wie lange und wie viele Einträge. Gehört zu Punkt 99.

101. **Öffentlich auf der Gemeinde-Website** *(Issue #133; erst Konzept)*. Eine Präsentation soll auch auf der Website laufen, ohne Anmeldung und ohne dass Besucher Zugangsdaten bekommen – die Adresse der Fernseher trägt den Token, und ChurchTools erlaubt keine Einbettung auf fremden Seiten (`frame-ancestors 'self'`, G15). Der Ansatz im Vorschlag: ein kleiner Dienst auf dem Webspace der Gemeinde holt die freigegebenen Inhalte serverseitig, mit Cache, und liefert sie über den vorhandenen Player aus. Das wäre ein zweites Stück Software neben dem Modul; offen sind Freigabe, Umfang der Daten, Verwaltung der Zugangsdaten, Aktualisierung, Ausfälle und Updates.

### Verzeichnis der erledigten Punkte

Volltext in [`docs/Plan-Archiv.md`](docs/Plan-Archiv.md). Die Punkte 1 bis 6 der ersten Liste (Fixtures, Testinstanz, Entwicklungsumgebung, Phasen 1 bis 3) stehen dort davor.

| Nr. | Punkt |
| --- | --- |
| 1 | Player an den Geräte-Benutzer binden |
| 2 | Neuladen nach anhaltenden Fehlern |
| 3 | Fehlende Rechte im Designer benennen |
| 4 | Risiko 1 entscheiden |
| 5 | Logo im Gemeindekopf |
| 6 | Mitgelieferte Schriften |
| 7 | Umbenennen abrunden |
| 8 | Einrichtungsseite, Stufe 1 |
| 9 | Einrichtungsassistent |
| 10 | Startseite überarbeiten |
| 11 | Designer leichter bedienbar |
| 12 | Release-Workflow |
| 13 | Einrichtungsdoku |
| 14 | Freischaltung vorbereiten |
| 15 | Screen-Einstellungen außerhalb des Editors |
| 16 | Mediathek auf der Startseite, der Wiki-Bereich im Hintergrund |
| 17 | Zeitplan-Oberfläche für die Gestalter |
| 18 | Mediathek: „Verwendet in", Filter, „Unbenutzt" |
| 19 | Playlists für sich, zwischen Screens geteilt |
| 20 | Hervorgehobene und kommende Events mit Bild |
| 21 | Zeitpläne in der Seitenleiste |
| 22 | Termin-Regeln mit eigenem Zeitraum |
| 23 | Terminliste: alle Termine der nächsten X Tage, seitenweise |
| 24 | Vorschau im Editor |
| 25 | Bausteine sperren (Schloss) |
| 26 | Schnellcheck: Änderungen in etwa 20 Sekunden auf dem Fernseher |
| 27 | Design-Backend |
| 28 | HTML-Block / Webseite einbetten |
| 29 | Die Bereiche angleichen |
| 30 | Neuigkeiten im Modul |
| 31 | Playlists duplizieren, Slides übernehmen |
| 32 | Countdown und Hinweisband |
| 33 | Beiträge aus ChurchTools |
| 34 | Hinweise als eigener Bereich |
| 35 | GitHub-Actions auf Node.js 24 heben |
| 36 | Einstellungen nach dem Muster der Gruppen |
| 37 | Service Worker für den Neustart ohne Netz |
| 38 | Abgelaufene Hinweise verschwinden nach 7 Tagen |
| 39 | Nach einem `429` mindestens 60 Sekunden warten |
| 40 | Standardschrift im Design-Reiter |
| 41 | Inspektor am Handy als ausklappbares Blatt |
| 42 | Wackelnder e2e-Test „Schriften nur vom eigenen Server" |
| 43 | Baustein „Gruppen" – eine Übersicht, welche Gruppen es gibt |
| 44 | Der Designer am Handy – ein Durchgang |
| 45 | Der Designer auf dem Tablet – am echten Tablet abgenommen am 2026-10-01 |
| 47 | Der Editor wird ruhiger – Bausteine alphabetisch, Inspektor zum Aufklappen |
| 48 | Linien auf hellen Slides, Inspektor-Kopf ohne Doppelung |
| 49 | Verknüpfte Slides – Kopien, die nach dem Bearbeiten gleich bleiben |
| 50 | Der Raum am Termin |
| 51 | Dienste am Termin |
| 52 | Baustein „Video" |
| 53 | Vorschau in der Mediathek |
| 54 | Klick auf das Bild bei den Zeitplänen |
| 55 | Reste-Paket: Hinweis zur Obergrenze, kein zweiter Wiki-Bereich, Einbettungscode, Bewegung in der Galerie |
| 57 | Wechsel auf die Produktivinstanz – Gerätetest P4 bestanden am 2026-10-14 |
| 58 | Durchsicht vor dem Teilen: Dienste nur nach Freigabe, Webseite ohne eigene Instanz, Medienadressen, Lizenz GPL 3, Rechte der Gerätekonten |
| 59 | Lebenszeichen der Screens: „online" auf der Kachel |
| 61 | Klarere Texte und Hinweise in den Einstellungen |
| 62 | „Rechte aktualisieren" nimmt zurück, Fernseher zeigen nur öffentliche Kalender |
| 63 | Knöpfe der Einstellungen ausgrauen, wenn ein Gruppenrecht fehlt |
| 64 | Branding-Farbpalette im Design |
| 65 | Farbtupfer getrennt, Großbuchstaben als Schrift-Option |
| 66 | Wer und wann zuletzt geändert – auf jeder Kachel |
| 67 | Einheitliche Kacheln in allen Bereichen |
| 68 | Zeitpläne als Kacheln mit Wochen-Zeitleiste |
| 69 | Hinweise als Kacheln mit derselben Zeitleiste |
| 70 | Vertikale Ausrichtung in den Bausteinen |
| 71 | Rückmeldungen eines Testers zur Einrichtung |
| 72 | Reihenfolge im Baustein „Gruppen" |
| 73 | Öffentlich ist, was der öffentliche Benutzer sieht |
| 74 | Kartenhintergrund im Design |
| 75 | Inspektor kompakter und einheitlich |
| 76 | Kacheln: jede Angabe mit Icon |
| 77 | Hinweis „Läuft gerade“ an Playlist und Editor |
| 78 | Ladeanimation im Player |
| 79 | Der Designer für alle: Begriffe und Textdatei, Ordnung auf der Fläche, ein Bedienelement je Sache, neuer Look, Kurzmenü, Entwurf und Veröffentlichen, mehrere Bausteine, Drehen, Ausschnitt, Schrifteffekte |
| 80 | Baustein „Social Media“ |
| 83 | Social Media: Schrift im Inspektor |
| 82 | Rückmeldungen des ersten Nutzers von außen: Webseiten-Hinweis, Räume in der Terminliste, Tags ausblenden |
| 84 | Umbenennen von Wiki-Bereich und Gruppen |
| 85 | Rückmeldungen von Manuel (CredoKirche): Kalendername, interne Kalender für Bildschirme |
| 86 | Raumtypen wählbar, „Kalender zeigen“, Zeitraum der Raumbelegung, Fortschrittsbalken |
| 87 | Wiederverwendbare Designs, Pakete A und B: Vorlagen, Aufteilung der Folie (die Listen-Stile stehen weiter im Plan) |
| 88 | Ordnung im Inspektor, Pakete A bis C: feste Reihenfolge, Klappmenüs zu, Zusammenfassungen in Worten; Farbfeld, Anordnen, Zähler, Schrift der Raumbelegung; Kurzmenü in Worten, Chipzeile am Handy |
| 89 | Ordnung auf der Seite „Design“: vier Klappmenüs mit Zusammenfassung, Vorlagen in eigener Karte, halb/halb |
| 90 | Besucherübersicht als vierte Darstellung der Terminliste (PR #111 von außen), rechts Raum vor Ort |
| 91 | Im Inspektor und auf der Seite „Design“ immer nur ein Klappmenü offen (Ausnahme „Bausteine dieser Folie“) |
| 81 | Einführung in den Editor: Karte „Neu hier?“ mit Rundgang in sechs Schritten, „? Hilfe“ mit Menü; am Handy keine |
| 92 | Abstand in der Aufteilung als Stufe Ohne · Eng · Normal · Weit, Rand gleich Abstand (Schema 1.44) |
| 93 | Suche über Schalterlisten ab neun Einträgen: Kalender, Gruppen der Beiträge, Gruppen des Bausteins „Gruppen“ |
| 94 A | Prüfung der Gerätegruppe liest die Herkunft der Rechte (G61) und warnt je weiterer Gruppe mit ihren Rechten, auch gruppeninternen |
| 94 B | Prüfung der Gerätegruppe warnt bei Rechten über den Geltungsbereich hinaus (Schreiben außerhalb „Status“, Entwürfe, weitere Wiki-Bereiche), auch aus weiteren Gruppen (G65) |
| 96 | Beiträge: Angaben einzeln ein- und ausblenden ohne leeren Platz, Bild füllen mit Ausschnitt oder ganz zeigen (Schema 1.45) |
| 97 | Markdown aus ChurchTools (G62) formatiert in Beiträgen, Gruppenbeschreibung und Terminbeschreibung, eigene Umwandlung als Daten |
| 98 | Hilfe-Leiste mit „?“ je Bereich statt (i) je Zeile, eigene Auswahlliste statt der Klappliste des Browsers, Erklärung beim Überfahren, Hilfetexte für jeden Baustein |
| 102 | Videos ohne Netz: der Player legt sie mit der Präsentation ab, der Service Worker beantwortet Bereichsanfragen daraus (G63) |
| 103 | Eigene Schriften auf der Seite „Design“, bis zu drei Schnitte, geladen als `FontFace` aus dem Speicher des Geräts (Schema 1.46, G64) |
| 104 | Abstände der Aufteilung in Rasterweiten (20/40/60 px), Bereichsgrößen auf volle 20 px, Hälften gleich groß |
| 105 | Fortschritt je Baustein ein- und ausschaltbar, Balken der Präsentation mit Foliennummer, eigenem Abschnitt und auf der Folie im Editor (Schema 1.47) |
| 106 | Abnahme am iPad: Textschatten immer dunkel, Einrasten in jeden leeren Bereich der Aufteilung |
| 107 | Lage des Fortschritts wählbar: abgesetzt oder als Linie am Rand, ohne Seitenzahl, auch für die Präsentation (Schema 1.48) |

## Quellen

- ChurchTools Extension Boilerplate: <https://github.com/churchtools/extension-boilerplate>
- ChurchTools JS-Client: <https://github.com/churchtools/churchtools-js-client>
- `ct-pass-store` (MIT), läuft auf unserer Produktivinstanz: <https://github.com/lub90/ct-pass-store> – ergiebig sind `extension/src/ct-utils/lib/ExtensionData.ts`, `extension/vite.config.ts`, `extension/scripts/package.js`, `extension/README.md` (Rechte je Rolle)
- Referenz-Extension: <https://github.com/aschojz/churchtools-extension-publisher>
- Extension mit Termin-Persistenz: <https://github.com/bensteUEM/ct-events-load>
- Forum: [Infoscreen mit FullPageOS](https://forum.church.tools/topic/10280), [Wünsche der Anwender](https://forum.church.tools/topic/6252), [Login-Token für den Infoscreen](https://forum.church.tools/topic/11910)
- ChurchTools Academy: [Rechteverwaltung verstehen](https://churchtools.academy/de/help/rechteverwaltung/rechteverwaltung-verstehen/), [CORS](https://churchtools.academy/help/system-einstellungen/api/0-cors/)
- 30-Tage-Testinstanz: <https://church.tools/de/test-churchtools/> · Support: <support@churchtools.de>
