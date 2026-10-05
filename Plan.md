# ChurchTools Infoscreen Designer – Projektplan

Ein ChurchTools Custom Module (CCM), mit dem angemeldete ChurchTools-Anwender Infoscreens gestalten. Das Ergebnis ist eine Webseite, die ein Kiosk-Browser aufruft und auf den Foyer-TVs anzeigt – auf einem Raspberry Pi, einem Mini-PC oder in einer VM.

## Auf einen Blick

**Stand 2026-10-05.** Veröffentlicht sind `v0.1.0` bis `v0.8.0`; das Modul läuft im echten ChurchTools der Testinstanz, auf der Produktivinstanz noch nicht. Die Fernseher melden sich über ihre Adresse selbst an (Weg B, Abschnitt D). Das Repository ist seit dem 2026-09-25 öffentlich.

**Dieser Abschnitt ist die vollständige Liste dessen, was offen ist.** Wer wissen will, was als Nächstes kommt, liest ihn und sonst nichts. Erledigtes steht mit seiner Nummer in [`docs/Plan-Archiv.md`](docs/Plan-Archiv.md) und wird nur nachgeschlagen, wenn jemand die Begründung einer alten Entscheidung braucht.

**Offen, nach Rang** *(Maßstab ist der Pitch)*:

1. **Auf die Produktivinstanz und ein Gerät ans Laufen bringen** – **der Ablauf in Stufen steht in Punkt 57** (freigegeben am 2026-10-01); bis das Gerät bestanden hat, gilt ein Feature-Stopp, nur Fehlerbehebungen. Wartet seit dem 2026-09-28 auf die Klärung des Nutzers mit dem Administrator der Produktivinstanz. Bis zur Installation (P8) wird dort nur gelesen; ein Gerät hängt nie an der Testinstanz (entschieden am 2026-09-28, F1). In dieser Reihenfolge:
   1. **Lesende Vorprüfung:** Gibt es dort schon Gruppen „Infoscreen-Designer" oder „Infoscreen-Devices" oder einen Wiki-Bereich „Infoscreen"? (P7)
   2. **P8, Freigabe und Installation** mit dem Release-ZIP, Schritt 2 der Anleitung über eine **Admin-Gruppe** (nicht über die Gestalter, G39), dann der Assistent.
   3. **P3 wiederholen** mit einem typischen Mitgliedskonto (auf der Testinstanz bestanden am 2026-09-28).
   4. **P4, ein Raspberry über mehrere Tage** – zuerst mit Testinhalten in einer eigenen Playlist. Dabei ansehen:
      - Laufschrift, nächtliches Neuladen, ein Netzausfall;
      - ein Beiträge-Block in der Test-Playlist (Archiv, Punkt 33);
      - der Service Worker: ob die Skripte der ChurchTools-Seite ohne Netz stören und was bei einem langen Ausfall mit abgelaufener Sitzung passiert (Archiv, Punkt 37; Risiko 2);
      - der Baustein „Video": Dauerlauf über eine Nacht und Ton (Archiv, Punkt 52). Der Nutzer will ihn danach gegebenenfalls schärfen.
2. **Erst messen, dann planen** (Opus, nach dem Gerätetest P4): **Videos ohne Netz** (Punkt 46.7 – ob der Service Worker ein Video samt Bereichsanfragen aus dem Cache liefern kann) und **eine eigene hochgeladene Schrift** (ob die Download-Adresse einer Schriftdatei unter der CSP trägt; bräuchte ein Schema-Feld).
3. **Vorschau in einem zweiten Fenster** (Punkt 56) – skizziert, noch nicht gewählt.
4. **Lebenszeichen der Screens: „online" oder „nicht online" auf der Kachel** (Punkt 59) – vom Nutzer gewünscht am 2026-10-02, skizziert; vor dem Bau stehen eine Entscheidung (das Gerät bekäme sein erstes Schreibrecht) und eine Messung.
5. **Teststrategie prüfen – keine doppelten Prüfungen** (Punkt 60) – vom Nutzer gewünscht am 2026-10-02; eine Durchsicht, noch nicht begonnen.

**Kleine Reste, kein Auftrag, bis jemand sie wählt:**

- **Auf `main`, noch nicht veröffentlicht:** Ein Video-Baustein, dessen Ton bei laufendem Video eingeschaltet wird, startet neu, statt vom Browser angehalten zu werden (`VideoView.vue`, Punkt 60, 3a) – geht mit dem nächsten Release hinaus; CHANGELOG-Eintrag dann unter „Behoben".
- **„Rechte aktualisieren" einmal echt ausprobieren** (Nutzer, Testinstanz, schreibend): Ein Baustein mit „Gemeindeleitung" – die Vorschau muss das Recht daran unter „Fällt weg" nennen und nach „Übernehmen" zurücknehmen; der Fernseher zeigt den Kalender schon vorher nicht mehr (Archiv, Punkt 62).
- Der Abbruch des Assistenten bei unsichtbarem Wiki-Bereich ist gegen kein echtes ChurchTools geprüft; ein fremder Bereich gleichen Namens, den der Administrator trotz Wiki-Recht nicht sieht, bleibt unerkennbar (Archiv, Punkt 55 B).
- Beiträge: interne Gruppen, und ob Mitglieder eingeschränkter Gruppen deren Beiträge lesen (G37).
- Aus der Durchsicht vor dem Teilen (Archiv, Punkt 58, `v0.6.0`):
  - **Beim ersten Start auf der Produktivinstanz ansehen** (Punkt 57, Stufe 4): ob Bilder und Videos erscheinen – Medienadressen gelten nur noch von der eigenen Instanz, gemessen ist das nur an der Testinstanz; was der Personenstatus des Gerätekontos dort mitbringt – die Warnung nennt seit `v0.6.1` jedes Recht außer „Eigene Personendaten sehen" im Wortlaut der Rechteverwaltung, auf der Testinstanz „Eigene Personendaten bearbeiten" (Befunde.md, G21); und die Freigabe der Dienste („Predigt") unter Einstellungen → Dienste auf Screens.
  - **Nutzer:** dem ChurchTools-Support melden, was `Befunde.md` über anonym Lesbares festhält (G14, G40), bevor das Modul beworben wird.
  - Vier e2e-Tests hängen an Gruppen und Rechten der eigenen Testinstanz (`setup.spec.ts`, `rights.spec.ts`, `hello.spec.ts`).

**Ideen, nicht gewählt** *(Rest der früheren „Später"-Liste, mit dem Nutzer durchgesehen am 2026-10-01; keine ist gebaut, jede bräuchte ihren eigenen Bauplan)*:

- **Format einer Playlist nachträglich wechseln** (quer ↔ hoch), als Umrechnung mit Vorschau – heute wird das Format nur beim Anlegen gewählt. *Nutzer: „könnte ich mir vorstellen, dass es benötigt wird."*
- **Export und Import** einer Playlist als JSON, etwa um sie von der Testinstanz auf die Produktivinstanz zu bringen; dazu Vorlagen für neue Playlists oder Slides. *Nutzer: wie oben.*

**Gestrichen am 2026-10-01 (Nutzer):** der Umschalter „läuft gerade" auf der Kachel (der Zeitplan ist seit `v0.4.2` einen Klick aufs Bild entfernt), die Warnung bei schlechter Lesbarkeit (die Vorschau zeigt es), die Vorschau in einem stilisierten Bildschirm (reine Optik), eigene Skripte in einem Web-Code-Block (trägt unter der CSP nicht, G15) und Auswertungen.

**Beobachten:** ob die Griffe am Handy im Alltag reichen und der Zoom-Schutz (16 px) auf jedem Gerät greift (Archiv, Punkt 44). Und die Arbeitsteilung: Opus plant und sieht durch, der Umsetzer baut – auch die Feedback-Runden zum Layout (AGENTS.md).

**Bewusst geparkt** – nicht falsch, aber nicht jetzt: alles Weitere am Betriebsbenutzer (G21-Reste), eine gemeinsame Bibliothek mit `ct-pass-store`, Koppeln am Fernseher (geprüft am 2026-09-25; die Geräte haben weder Tastatur noch Maus – Begründung im Archiv, „Funktionsumfang – Später"), der Extension Store (G17), YouTube/Vimeo (Punkt 46.6), **4K** (Nutzer, 2026-10-01: „bauen es ein, falls von dritten gefordert"; ein eigenes Format braucht es nicht – die Bildfläche wird skaliert, Schrift bleibt scharf, nur Bilder fordert der Player höchstens in 1920 × 1080 an, `src/player/images.ts`; ungemessen). **Nicht anfassen, bis ein Produktschritt es braucht:** C4, `attachments`, `ct-events-load`, das Gespräch mit dem Autor von `ct-pass-store`.

**Pflege dieses Dokuments** *(Wunsch des Nutzers, 2026-10-01: „alte Zöpfe abschneiden")*: Ein neuer Punkt bekommt die nächste Nummer und steht unter „Nächste Schritte", bis er veröffentlicht ist. Mit dem Release wandert sein Text wörtlich ins Archiv, hier bleibt eine Zeile im Verzeichnis; was an ihm offen bleibt, kommt als eigene Zeile in die Liste oben. Die Nummern bleiben, weil der Code auf sie verweist („Plan.md 47").

## Rahmendaten

- **Testinstanz**: Adresse nur in der `.env`, Build 32882 wie produktiv, ~~Lizenz bis 2026-10-22, 21:53~~ (30 Tage ab Anlage am 2026-09-22, 21:53; T3). **Seit dem 2026-09-28 ohne Frist:** ChurchTools stellt sie für die Zeit der Extensionentwicklung kostenfrei, prüft die Nutzung regelmäßig und berechnet sie, sobald sie **produktiv genutzt** wird (F1). Testen darf man dort alles, auch tagelang auf einem Gerät; echte Inhalte im Dauerbetrieb gehören auf die Produktivinstanz. Custom Modules dort **freigeschaltet seit dem 2026-09-24** (T1), angefragt am 2026-09-23. Freigeschaltet wird nach Auskunft vom 2026-09-24 über die Entwickler von ChurchTools, nicht über das Paket; Rückmeldung steht aus. Ein Paketwechsel (etwa auf Combo) ist im Gespräch, dann werden Kalender und Personen der Testinstanz entsprechend reduziert. Die **Produktivinstanz** hat sie (G1).
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

Später hinzu: `templates`, `snippets` (Web-Code), `status` (Heartbeat).

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

**Für den MVP genügt ein Satz:** Der Geräte-Benutzer darf lesen, was die Screens zeigen, und nichts sonst. Konkret:

| Lesen auf | Wofür |
| --- | --- |
| Die **öffentlichen** Kalender, die ein Screen zeigt | Terminblöcke |
| `view custom data` auf `screens`, `playlists`, `slides`, `media`, `settings` | Screen-Konfiguration |

**Nur öffentliche Kalender** *(entschieden am 2026-10-05, Nutzer: „Nicht öffentliche Kalender holen wir uns erst gar nicht")*: Ein Fernseher zeigt nur Termine aus Kalendern mit `isPublic: true` (und nicht `isPrivate`), und von diesen keine, die als intern markiert sind (`isInternal`). Gestalter bekommen interne Kalender gar nicht erst zur Wahl, der Assistent vergibt für sie kein Recht, und der Player fragt sie nicht ab – auch dann nicht, wenn das Gerätekonto sie über Status oder eine andere Gruppe lesen dürfte. Umgesetzt in `v0.8.0` (Archiv, Punkt 62).

**Ausdrücklich nicht:** Personendaten, Schreibrechte, Administrationsrechte, Zweifaktor – **und auch kein Wiki-Recht**: Bilder kommen über die Adresse des Bilddienstes, die ohne Anmeldung trägt (G14, G27). **Rollenkonzept** *(festgelegt am 2026-09-24)*:

| Rolle | Wer | Darf |
| --- | --- | --- |
| **Administrator** | wer in ChurchTools Berechtigungen verwalten darf (`churchcore` „administer persons") | die Extension installieren; die **Einstellungen** öffnen, dort die Gruppen samt Rechten anlegen (Assistent) und prüfen; beim ersten Start entstehen die Kategorien des Moduls |
| **Gestalter** | Mitglieder von „Infoscreen-Designer" | **Inhalte und Zeitpläne**: Slides und Playlists anlegen, ändern, löschen; **wählen, welche Playlist wann läuft** (Zeitplan, seit 2026-09-25); Bilder in den Wiki-Bereich „Infoscreen" laden. **Nicht:** Screens anlegen, löschen oder konfigurieren (Name, Format, Overscan), Einstellungen, Kategorien, Rechte |
| **Gerät** | Mitglieder von „Infoscreen-Devices" | nur lesen: Modul, seine Daten, die Kalender der Screens |

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
    6. ~~**YouTube/Vimeo, auch der Livestream**~~ – **zurückgestellt am 2026-10-01 (Nutzer):** Der Livestream wird im Haus über SDI verteilt, ohne Zeitverzögerung; ein Baustein dafür bringt nichts. Wenn doch: eigener Baustein, weil YouTube im Rahmen von „Webseite" die Einbettung verweigert (Archiv, Punkt 28).
    7. **Videos ohne Netz** *(aus Punkt 52)* – ginge nur über den Service Worker, weil die CSP `blob:` für Medien nicht erlaubt (G47); ungemessen.

    **Nicht aufgenommen:** Wetter (fremder Dienst, für uns unwichtig); Losung des Tages (nur nach Anfrage bei der Herrnhuter Brüdergemeine); Geburtstage (Datenschutz); Social Feeds (entschieden am 2026-09-25); PDF und PowerPoint (als Bilder exportieren).

56. **Vorschau in einem zweiten Fenster** *(Rest aus Punkt 24; noch nicht gewählt)*. Für zwei Bildschirme: Die Vorschau des Editors läuft in einem eigenen Fenster mit, während man bearbeitet. Skizze: eine Route `/vorschau/<playlist>` ohne Bedienelemente, die der Editor über „Vorschau › im eigenen Fenster" öffnet; der Editor sendet seinen ungespeicherten Stand (Slides, Playlist, gewählte Slide) über einen `BroadcastChannel`, das Fenster zeigt die gewählte Slide und folgt der Auswahl. Schließt man den Editor, sagt das Fenster das und bleibt beim letzten Stand. Kein Schema, keine Rechte. Ein eigener Auftrag mit eigenem Release, erst wenn der Nutzer ihn wählt.

59. **Lebenszeichen der Screens** *(Nutzer, 2026-10-02: „man soll erkennen, dass ein Screen gerade online ist, und wenn die Präsentation nicht abgerufen wird, ist zu erkennen, dass der Screen nicht online ist"; war bis dahin bewusst geparkt)*. Heute gibt es keinen solchen Hinweis: Der Player liest nur, und ChurchTools sagt dem Designer nicht, wer gelesen hat.
    - **Was man sieht.** Auf der Kachel jedes Screens ein Punkt mit Text: **„online"** (grün), **„nicht online seit …"** (rot, mit Zeitpunkt des letzten Lebenszeichens), **„noch nie abgerufen"** (grau – ein neu angelegter Screen ist kein Fehler). Derselbe Stand in der Seitenleiste als Zahl („2 von 3 online") nur, wenn er sich ohne weitere Anfrage ergibt. Der Text trägt die Aussage, nicht die Farbe allein.
    - **Wie es geht.** Der Player schreibt je Screen **einen** Wert in eine neue Kategorie `status` (in E als „später" vorgesehen): Screen-id, Zeitpunkt, Version des Players, was gerade läuft. Er überschreibt immer denselben Wert, es wächst nichts. Takt etwa alle fünf Minuten; „online" gilt bis zum Doppelten des Takts plus Reserve, damit ein einzelner verpasster Schlag nichts rot färbt. Verglichen wird mit der Uhr des Designers – beide Uhren gehen nach der Zeit von ChurchTools, soweit der Player sie bestätigt hat (`clockConfirmed`).
    - **Die Entscheidung davor (Nutzer).** Das Gerät bekäme sein **erstes Schreibrecht**: `create` und `edit custom data`, aber **nur** auf `status` – Datenrechte werden je Kategorie vergeben (`docs/Rechte.md`). Screens, Playlists, Slides, Medien und Einstellungen bleiben für Geräte nur lesbar. Die Regel „Geräte nur lesend" (F) wird damit zu „Geräte schreiben nur ihr Lebenszeichen"; wer eine Geräte-Adresse kennt, könnte Lebenszeichen fälschen, sonst nichts. Der Assistent vergibt das Recht über „Rechte aktualisieren"; `docs/Rechte.md`, `docs/Einrichtung.md` und die Rechteprüfung der Einstellungen ziehen mit.
    - **Ohne das Recht** läuft der Player unverändert weiter und die Kachel zeigt „noch nie abgerufen" – ein Fehler beim Schreiben darf nie die Anzeige stören.
    - **Zu messen (Opus, Testinstanz, Schreiben vorher besprechen):** ob das Recht je Kategorie für die Gerätegruppe wirklich nur `status` öffnet (G20: fehlende Rechte sehen nicht wie Fehler aus); ob ein Wert alle fünf Minuten über Tage etwas an ChurchTools auffällig macht (Protokoll, Änderungshistorie); ob das Schreiben die 24-Stunden-Sitzung berührt (G32). Vorab in der Academy nachlesen, was zu Datenrechten je Kategorie dokumentiert ist.
    - **Grenze.** „Online" heißt: Der Browser des Geräts läuft und erreicht ChurchTools. Ob der Fernseher eingeschaltet ist, weiß niemand.
    - **Reihenfolge.** Neue Funktion mit Schema- und Rechteänderung: erst nach dem Feature-Stopp aus Punkt 57 – es sei denn, der Nutzer zieht sie vor, weil sie gerade beim Gerätetest (P4) hilft.

60. **Teststrategie prüfen – keine doppelten Prüfungen** *(Nutzer, 2026-10-02: „Teststrategie prüfen, keine doppelten Prüfungen")*. Eine Durchsicht (Opus), kein Umbau auf Verdacht; ihr Ergebnis ist eine kurze Regel in `LocalTests.md` und eine Liste dessen, was entfällt oder umzieht.
    - **Stand.** 57 Unit-Testdateien (Vitest, 694 Tests, wenige Sekunden) und 17 Browser-Testdateien (Playwright, je zwei Browser; ein Durchlauf in einem Browser dauert knapp acht Minuten). Die Pflichtprüfung `check` fährt Lint, Typprüfung, Unit-Tests und Build – **keine Browser-Tests**; die laufen nur von Hand. Der Release-Lauf fährt Lint, Typprüfung und Unit-Tests nach dem Merge ein zweites Mal.
    - **Was die Durchsicht klärt.** (1) **Jede Aussage an genau einer Stelle:** Logik im Unit-Test, Zusammenspiel im Browser-Test – wo beides dasselbe prüft (Beispiel: der Löschdialog der Mediathek hat seit `v0.7.0` einen Komponententest und zwei Browser-Tests), bleibt die schnellere Stelle, und der Browser-Test behält nur, was erst im Browser sichtbar wird. (2) **Mehrfach durchlaufene Wege:** Mehrere Browser-Tests bauen denselben Anlauf (Editor öffnen, Baustein anlegen, Mediathek mit nachgestellten Antworten) – gemeinsame Helfer statt Kopien, und ein Weg wird nicht in drei Dateien erneut geprüft. (3) **Doppelte Läufe:** ob der Release-Lauf wiederholen muss, was `check` am selben Stand schon bestanden hat, und ob jeder Browser-Test wirklich beide Browser braucht. (3a) **Wackelnde Tests:** `video.spec.ts`, „the player loops the video …", scheiterte in WebKit etwa einmal in drei Läufen – **geklärt und behoben am 2026-10-05:** Der Player startet aus seinem Zwischenstand (Video ohne Ton) und zeigt erst danach den frischen Stand; der Test sah nur den ersten `play()`-Aufruf. Dahinter lag ein echter Fehler: Wurde der Ton bei laufendem Video eingeschaltet, nahm der Player nur die Stummschaltung weg, und ein Browser ohne Klick hält das Video dann an. Jetzt startet der Block neu (mit Rückfall auf stumm), der Test prüft irgendeinen Aufruf mit Ton; 30 von 30 Läufen in WebKit grün. (4) **Was niemand ausführt:** Eine Browser-Prüfung war auf `main` unbemerkt rot (`home.spec.ts`, behoben in `v0.7.0`), weil `check` sie nicht fährt – entweder eine kleine, schnelle Auswahl in `check` aufnehmen oder festlegen, wann die Suite von Hand läuft. (5) **Die Stilgrenze zur Hostseite:** Zweimal hat erst ChurchTools gezeigt, was der Demo-Modus verbirgt (G43 samt Nachtrag) – prüfen, ob ein Browser-Test mit den Stylesheets der Hostseite und `body.cts` die Liste verbotener Klassennamen ersetzt oder ergänzt; die Stylesheets dürfen dabei nicht ins Repo.
    - **Fertig,** wenn zu jeder gestrichenen Prüfung dasteht, wo ihre Aussage weiterhin geprüft wird, die Laufzeiten vorher und nachher gemessen sind und keine Aussage verloren ging.
    - **Reihenfolge.** Berührt kein Produktverhalten und fällt nicht unter den Feature-Stopp aus Punkt 57; gebaut wird trotzdem erst nach der Durchsicht und einem eigenen Auftrag.

57. **Wechsel auf die Produktivinstanz** *(geplant am 2026-10-01; Nutzer: „Als nächstes planen wir den Wechsel auf das Produktivsystem")*. Löst Rang 1 aus „Auf einen Blick" in Schritte auf; die Abnahme dahinter steht in `Preparation.md`, Abschnitt P (P4 und P8 sind offen). Gebaut wird hier nichts – es ist ein Ablauf für Menschen, mit `docs/Einrichtung.md` als Anleitung. **Freigegeben vom Nutzer am 2026-10-01** („Punkte passen so"); seine Antworten stehen unter „Geklärt".
    - **Grundsätze.** (1) Installiert wird das ZIP von der Release-Seite, **`v0.8.0`** (seit dem 2026-10-05: nur öffentliche Kalender, „Rechte aktualisieren" mit Vorschau und Zurücknehmen; vorher `v0.7.2`, davor `v0.5.0`), kein lokaler Build (P6). `v0.7.0` bringt auf Wunsch des Nutzers zwei Funktionen trotz Feature-Stopp: „zuletzt bearbeitet" auf den Playlist-Kacheln und Mehrfachauswahl mit Löschdialog in der Mediathek. (2) **Feature-Stopp während der Testphase:** Auf `main` kommen nur Fehlerbehebungen; jede geht als eigenes Patch-Release per ZIP-Upload auf die Instanz, und das Protokoll nennt, welche Version wann lief. (3) **Alle Handgriffe auf der Produktivinstanz macht ein Mensch in der Oberfläche.** Opus und der Umsetzer bekommen dafür keine Zugangsdaten und schreiben dort nichts; geprüft wird über das, was der Nutzer berichtet oder zeigt. Die Regel „gegen die Produktivinstanz nichts schreiben" in `AGENTS.md` bleibt damit, wie sie ist. (4) **Inhalte ziehen nicht um:** Screens, Playlists und Bilder der Testinstanz bleiben dort. Auf der Produktivinstanz wird neu angelegt; Bilder haben dort ohnehin andere Schlüssel. Wird das lästig, ist „Export und Import" der nächste Baupunkt.
    - **Stufe 0 – Gespräch mit dem Administrator** *(Nutzer; daran hängt alles)*. Was er wissen muss, auf einer Seite: Die Extension läuft nur im Browser unter `/ccm/infoscreen-designer/`. Außerhalb ihres eigenen Speichers legt sie zwei eingeschränkt sichtbare Gruppen vom Typ „Merkmal" an („Infoscreen-Designer", „Infoscreen-Devices"), einen Wiki-Bereich „Infoscreen" für die Bilder und einen Login-Token für das Gerätekonto; an bestehenden Rollen ändert sie nichts (Tabelle in `Preparation.md`, P). Sein Aufwand: etwa eine halbe Stunde für die Schritte 1 bis 6 der Anleitung. Der Rückweg ist gemessen (G38): „Einrichtung entfernen", dann die Extension löschen; von Hand bleiben der Wiki-Bereich und das Gerätekonto. **Mit ihm zu klären:** wer installiert und einrichtet (er selbst oder der Nutzer mit seinen Rechten); welche Gruppe die Modulrechte aus Schritt 2 trägt (eine Admin-Gruppe, nicht die Gestalter, G39); welcher Personenstatus für das Gerätekonto wenig genug darf; welche Kalender und Räume die Fernseher zeigen dürfen; ob ein Termin für die Einrichtung recht ist, an dem der Nutzer dabei ist.
    - **Stufe 1 – Lesende Vorprüfung** *(P7; Administrator, fünf Minuten, vor der Installation)*. Mit einem Konto, das **alles** sieht: Gibt es die Extension-Verwaltung (`/custom/modules/overview`)? Gibt es schon Gruppen „Infoscreen-Designer" oder „Infoscreen-Devices", auch archivierte und versteckte? Gibt es im Wiki einen Bereich „Infoscreen"? Darf das einrichtende Konto das Wiki sehen (seit `v0.5.0` Voraussetzung des Assistenten)? Eine leere Liste bei einem Konto mit eingeschränkter Sicht beweist nichts. **Abbruch:** Gibt es eine Gruppe dieses Namens, hält der Assistent an – dann erst klären, wem sie gehört.
    - **Stufe 2 – Installation und Einrichtung** *(P8; `docs/Einrichtung.md`, Schritte 1 bis 6)*. ZIP hochladen, Kurzbezeichner exakt `infoscreen-designer`; Modulrechte an die Admin-Gruppe; Designer öffnen; „Gruppen und Rechte anlegen"; Gestalter aufnehmen (zuerst nur der Nutzer); ein Gerätekonto mit sprechendem Namen nach dem Standort (Muster „Infoscreen Foyer"), mit Benutzername, Passwort und rechtearmem Status in „Infoscreen-Devices". **Dabei festhalten** (das ist die erste Messung gegen ein gewachsenes ChurchTools): Läuft der Assistent ohne Fehlermeldung durch, was zeigt die Prüfung unter „Gruppen und Rechte" danach, und stehen unter „Mediathek im Wiki" der Bereich und seine Herkunft. Ein Bildschirmfoto der Prüfung reicht als Beleg.
    - **Stufe 3 – Sichtbarkeit** *(P3 wiederholen; Administrator, fünf Minuten)*. Mit einem typischen Mitgliedskonto in Web **und** App nach „Infoscreen" und nach dem Gerätekonto suchen: Menü, Gruppenliste, Personensuche, Wiki. Erwartet: kein Designer, keine der beiden Gruppen, kein Wiki-Bereich; das Gerätekonto darf als Person auffindbar sein, wenn Mitglieder Personen sehen – deshalb der sprechende Name. **Abbruch:** Taucht eine der Gruppen oder der Wiki-Bereich bei einem Mitglied auf, erst die Ursache klären, bevor ein Gerät angeschlossen wird.
    - **Stufe 4 – Test-Screen und Test-Playlist** *(Nutzer)*. Ein Screen für das Testgerät – den Namen wählt der Nutzer nach dem Ort der beiden Fernseher, der Administrator legt ihn an – und **eine Test-Playlist** mit einer Slide je Sorge: Terminliste aus einem echten Kalender, Galerie mit Bewegung, Laufschrift oder Hinweisband, Uhr, ein Beiträge-Block, ein Video mit Ton, eine eingebettete Webseite. Danach unter „Gruppen und Rechte" einmal „Rechte aktualisieren" und die Prüfung des Gerätekontos ansehen. Im Zeitplan des Screens eine zweite Playlist zu einer festen Uhrzeit, damit der Wechsel mitgetestet wird.
    - **Stufe 5 – Das Gerät** *(P4; Schritt 7 der Anleitung)*. Adresse mit Token in den Einstellungen erzeugen und im Kiosk-Browser des Raspberry als Startseite eintragen; der Browser braucht ein dauerhaftes Profil. Der Raspberry speist zwei Fernseher mit demselben Bild – für das Modul ist das ein Gerät und ein Screen. Die Adresse ist ein Zugangsschlüssel: nicht fotografieren, nicht in einen Chat, nicht ins Repo. **Zuerst an einem Fernseher, den nicht die ganze Gemeinde sieht**, oder außerhalb der Veranstaltungen – es sind Testinhalte.
    - **Stufe 6 – Prüfprotokoll über mindestens drei Nächte.** Der Nutzer notiert Datum, Version und Beobachtung; wo das Protokoll liegt, entscheidet er (ins Repo nur ohne Adresse und ohne Namen). Einmal auszulösen: (a) eine Änderung im Editor ist nach etwa 20 Sekunden auf dem Fernseher; (b) Netz für zehn Minuten weg – das Bild läuft weiter, eine Uhr verschwindet eher, als falsch zu gehen, danach holt das Gerät von selbst auf; (c) Strom weg und wieder an, **ohne** Netz – zeigt der Service Worker den letzten Stand; (d) Netz für mehr als einen Tag weg, soweit das zumutbar ist – was passiert mit der abgelaufenen Sitzung (Archiv, Punkt 37; Risiko 2); (e) der Wechsel der Playlist zur geplanten Uhrzeit. Jeden Morgen anzusehen: läuft es noch, stimmt die Uhr, läuft das Video noch flüssig und mit Ton, ruckelt die Laufschrift oder die Bewegung der Galerie, zeigt die Terminliste den heutigen Tag. Am Ende: ob jemand aus der Gemeinde nach dem Gerätekonto oder nach „Infoscreen" gefragt hat.
    - **Bestanden**, wenn das Gerät drei Nächte ohne Eingriff durchläuft, (a) bis (c) und (e) wie beschrieben ausgehen und nichts für Mitglieder sichtbar wurde. Dann: `Preparation.md`, P4 und P8 abhaken; echte Inhalte in eine eigene Playlist und als Standard in den Zeitplan; der zweite Fernseher mit eigenem Gerätekonto. Danach erst die Messungen aus Rang 2 (Videos ohne Netz, eigene Schrift).
    - **Fehler unterwegs:** Ein Fehler des Moduls wird auf der Testinstanz nachgestellt, dort behoben und als Patch-Release eingespielt; die drei Nächte beginnen für den betroffenen Teil neu. **Notbremse** bei einem verlorenen Gerät oder einer bekannt gewordenen Adresse: Passwort des Gerätekontos wechseln (G18). **Rückweg ganz:** „Einrichtung entfernen", Extension löschen, Wiki-Bereich und Gerätekonto von Hand.
    - **Geklärt (Nutzer, 2026-10-01):** 1. **Der Nutzer hat auf der Produktivinstanz keine Administratorrechte**; der einrichtende Administrator darf das Wiki sehen. 2. **Erstes Testgerät ist der Raspberry, der zwei weitere Fernseher speist** – nicht der im Foyer auf dem Rollwagen. 3. Das Prüfprotokoll bleibt lokal beim Nutzer (Vorlage unter `fixtures/`, nicht versioniert). 4. Zur Dauer hat er nichts geändert: es bleibt bei mindestens drei Nächten.
    - **Folge aus 1 – ein Termin, an dem beide da sind** *(Opus)*: Der Designer lässt nur Administratoren in die Einstellungen und an die Screens. Der Administrator macht also nicht nur die Stufen 1 bis 3, sondern auch: den Screen anlegen, die Adresse mit Token erzeugen und „Rechte aktualisieren" klicken. Das letzte wirkt erst, wenn der Screen schon Kalender und Räume zeigt. Damit kein zweiter Termin nötig wird, gilt diese Reihenfolge im Termin: Vorprüfung → Installation und Assistent → der Nutzer wird Mitglied in „Infoscreen-Designer" → Gerätekonto → der Administrator legt den Screen an → **der Nutzer legt sofort die Test-Playlist mit einer Terminliste (alle Kalender, die je gezeigt werden sollen) und, falls gewünscht, einer Raumbelegung an und setzt sie in den Zeitplan** → der Administrator klickt „Rechte aktualisieren", sieht die Prüfung des Gerätekontos an und erzeugt die Adresse → Sichtbarkeit mit einem Mitgliedskonto. Die Adresse übergibt er dem Nutzer auf einem Weg, der nicht mitgelesen wird. Alles Weitere (übrige Slides, Gerät, Protokoll) macht der Nutzer allein. **Ein späterer weiterer Kalender oder Raum braucht wieder den Administrator** – deshalb im Termin lieber einen Kalender zu viel in die Terminliste nehmen.

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
| 58 | Durchsicht vor dem Teilen: Dienste nur nach Freigabe, Webseite ohne eigene Instanz, Medienadressen, Lizenz GPL 3, Rechte der Gerätekonten |
| 61 | Klarere Texte und Hinweise in den Einstellungen |
| 62 | „Rechte aktualisieren" nimmt zurück, Fernseher zeigen nur öffentliche Kalender |
| 63 | Knöpfe der Einstellungen ausgrauen, wenn ein Gruppenrecht fehlt |

## Quellen

- ChurchTools Extension Boilerplate: <https://github.com/churchtools/extension-boilerplate>
- ChurchTools JS-Client: <https://github.com/churchtools/churchtools-js-client>
- `ct-pass-store` (MIT), läuft auf unserer Produktivinstanz: <https://github.com/lub90/ct-pass-store> – ergiebig sind `extension/src/ct-utils/lib/ExtensionData.ts`, `extension/vite.config.ts`, `extension/scripts/package.js`, `extension/README.md` (Rechte je Rolle)
- Referenz-Extension: <https://github.com/aschojz/churchtools-extension-publisher>
- Extension mit Termin-Persistenz: <https://github.com/bensteUEM/ct-events-load>
- Forum: [Infoscreen mit FullPageOS](https://forum.church.tools/topic/10280), [Wünsche der Anwender](https://forum.church.tools/topic/6252), [Login-Token für den Infoscreen](https://forum.church.tools/topic/11910)
- ChurchTools Academy: [Rechteverwaltung verstehen](https://churchtools.academy/de/help/rechteverwaltung/rechteverwaltung-verstehen/), [CORS](https://churchtools.academy/help/system-einstellungen/api/0-cors/)
- 30-Tage-Testinstanz: <https://church.tools/de/test-churchtools/> · Support: <support@churchtools.de>
