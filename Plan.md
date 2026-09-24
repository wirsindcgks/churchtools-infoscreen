# ChurchTools Infoscreen Designer – Projektplan

Ein ChurchTools Custom Module (CCM), mit dem angemeldete ChurchTools-Anwender Infoscreens gestalten. Das Ergebnis ist eine Webseite, die ein Kiosk-Browser aufruft und auf den Foyer-TVs anzeigt – auf einem Raspberry Pi, einem Mini-PC oder in einer VM.

## Auf einen Blick

**Stand 2026-09-24.** Phase 0 ist abgeschlossen, soweit sie ohne Custom Modules auf der Testinstanz geht. Datenmodell, Player und Designer samt Mediathek laufen gegen den Mock (Phasen 1–3); was bis zum MVP fehlt, steht priorisiert unter „Nächste Schritte". Am 2026-09-24 ist der Plan gekürzt worden: Er war ins Rechtemodell abgetaucht, und das Rechtemodell ist für den MVP **ein Satz** (siehe F), keine Baustelle.

**Zwingend – ohne das gibt es kein Produkt:**

1. **Keine offene Entscheidung mehr vor Phase 1**: MVP-Zuschnitt und Undo/Redo stehen seit dem 2026-09-24 (siehe „Offene Entscheidungen").
2. **Entwicklungsumgebung** bis zum „Hallo &lt;Vorname&gt;" – unblockiert.
3. **Datenmodell, Player, Designer gegen den Mock** – unblockiert.
4. **Nach der Freischaltung genau drei Punkte**: Testmodul hochladen (B6), Typ-Snapshot ziehen (B5), Login-Token am `/ccm/`-Pfad prüfen (G9). Alles andere aus dem blockierten Rest ist verzichtbar oder hat eine Vorgabe.
5. ~~**Die Fixtures außerhalb des Repos sichern**~~ – **erledigt am 2026-09-24.** Was danach noch aufgezeichnet wird, muss vor Ablauf der Testinstanz (2026-10-22, 21:53) nachgesichert werden.

**Bewusst geparkt** – nicht falsch, aber nicht jetzt: alles Weitere am Betriebsbenutzer (G21-Reste), Rate-Limit (G16), Heartbeat und Statusanzeige, eine gemeinsame Bibliothek mit `ct-pass-store`, Rollenmodell für mehrere Gestalter.

## Rahmendaten

- **Testinstanz**: Adresse nur in der `.env`, Build 32882 wie produktiv, **Lizenz bis 2026-10-22, 21:53** (30 Tage ab Anlage am 2026-09-22, 21:53; T3). Custom Modules dort **nicht freigeschaltet** (T1), angefragt am 2026-09-23. Freigeschaltet wird nach Auskunft vom 2026-09-24 über die Entwickler von ChurchTools, nicht über das Paket; Rückmeldung steht aus. Ein Paketwechsel (etwa auf Combo) ist im Gespräch, dann werden Kalender und Personen der Testinstanz entsprechend reduziert. Die **Produktivinstanz** hat sie (G1).
- **Autor / Repo**: `wirsindcgks <media@cg-ks.de>`, geplant unter `github.com/wirsindcgks/churchtools-infoscreen`
- **Lizenz**: GPL-2.0-or-later
- **Ziel**: Das Modul geht am Ende an die ChurchTools-Community – daher **kein Gemeinde-Branding** (seit 2026-09-24).
- **Extension-Key**: `infoscreen-designer` → Auslieferungspfad `/ccm/infoscreen-designer/`
- **Stack**: Vue 3 + TypeScript + Vite + Pinia, `@churchtools/churchtools-client`, Vitest, Playwright – wie das [Boilerplate](https://github.com/churchtools/extension-boilerplate) und die bekannten Fremd-Extensions.
- **Dokumente**: `Plan.md` ist das Gedächtnis, [`Preparation.md`](Preparation.md) die Arbeitsliste, [`Befunde.md`](Befunde.md) das Messprotokoll (**alle Verweise „G1"–„G21" zeigen dorthin**), [`AGENTS.md`](AGENTS.md) die Arbeitsregeln.
- **Abgrenzung**: Eigenständiges Projekt, kein Teil des WordPress-Plugins `churchtools-plugin` und keine gemeinsame Codebasis damit.

## Pitch

Der native ChurchTools-Infoscreen zeigt eine Terminliste in einem festen Layout. Wiederkehrende Wünsche im ChurchTools-Forum sind seit Jahren dieselben: eigene Inhalte (Bilder, Videos, freie Texte) im Wechsel mit den Terminen, ein abschaltbarer oder gestaltbarer Header, einstellbare Anzeigedauer, mehrere Screens mit unterschiedlichen Inhalten. Wer das braucht, weicht heute auf externe Digital-Signage-Dienste wie Yodeck aus – und pflegt seine Termine dann zweimal.

Der Infoscreen Designer schließt genau diese Lücke: gestalten in ChurchTools, Daten aus ChurchTools, ausspielen aus ChurchTools. Kein zweites System, kein zweiter Datenstand, keine zusätzliche Hosting-Rechnung.

**Dieser Absatz ist der Maßstab für jeden Punkt dieses Plans.** Was keines der Versprechen darin einlöst, gehört nach „Später".

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
- **DOM statt Canvas**, auf einer Bühne mit festen Pixelmaßen (1920×1080 oder hochkant), die ein einziger Faktor per `transform: scale()` auf den Viewport abbildet. Passt das Seitenverhältnis nicht, wird **eingepasst statt beschnitten**; je Screen eine Overscan-Korrektur in Prozent.
- **Stilgrenze in beide Richtungen.** Die Extension läuft im Dokument der Hostseite, nicht in einem iframe (G6). Alle eigenen Regeln unter einer Wurzelklasse, `all: initial` an der Bühnenkante, keine geerbten Schriftgrößen oder Farben. Ungeschichtetes CSS schlägt die `@layer`-Stile der Hostseite, `!important` ist unnötig.
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
- Updates über die Oberfläche, wenn ein Download-Link hinterlegt ist: Tag `vx.y.z` → GitHub Action baut das ZIP → Release-Asset ist die Update-Quelle.

### D. Authentifizierung

1. **Designer im Betrieb** – keine eigene Anmeldung; die Extension läuft in der ChurchTools-Sitzung, `GET /whoami` liefert den Anwender.
2. **Entwicklung** – `POST /login` mit den Zugangsdaten aus der `.env`, nur im Modus `development`.
3. **Raspberry Pi** – Login-Token des Geräte-Benutzers in der Player-URL:
   ```
   https://<instanz>/ccm/infoscreen-designer/player?screen=foyer-links&login_token=<TOKEN>&user_id=<ID>&no_url_rewrite=true
   ```
   Echte Unterpfade wie `/player` sind gedeckt (G7). Der Token entsteht über `POST /api/login/token` mit Benutzername und Passwort des Geräte-Benutzers; der `churchtools-client` meldet sich damit nach Sitzungsablauf selbst neu an. **Ob das unter `/ccm/` trägt, ist die wichtigste offene Messung (G9).**

**Der Token ist ein Dauerpasswort** – in der URL, im Browserverlauf, auf der SD-Karte. **Die Notbremse ist der Passwortwechsel des Geräte-Benutzers in der Oberfläche**; der Token ist danach sofort ungültig (G18). Einen Admin-Endpunkt zum Widerrufen gibt es nicht.

### E. Datenspeicherung

Eigene Daten liegen im KV-Store des Moduls: Modul → Kategorie → Datenwert, jeder Wert ein JSON-String. **Ein Datenwert hat keinen Namen, keine Version und fasst höchstens 10.000 Zeichen** (G2, G3, G11). Daraus folgt der Zuschnitt:

| Kategorie | Inhalt |
| --- | --- |
| `screens` | je Screen ein Index-Wert: Slug, Name, Auflösung, Schema-Version, Revision, `updatedAt`, Standard-Playlist, Zeitplan |
| `playlists` | je Playlist ein Wert: Name, Reihenfolge der Slide-IDs |
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
| Die Kalender, die ein Screen zeigt | Terminblöcke |
| `view custom data` auf `screens`, `playlists`, `slides`, `media`, `settings` | Screen-Konfiguration |

**Ausdrücklich nicht:** Personendaten, Schreibrechte, Administrationsrechte, Zweifaktor – **und auch kein Wiki-Recht**: Bilder kommen über die Adresse des Bilddienstes, die ohne Anmeldung trägt (G14, G27). **Die Gestalter sind im MVP wir selbst**, mit vollen Modulrechten und Ansehen/Bearbeiten auf der Wiki-Kategorie „Infoscreen"; ein Rollenmodell entsteht erst, wenn jemand anderes gestaltet.

**Zwei Befunde, die den Bau betreffen – der Rest steht in [`Befunde.md`](Befunde.md), „Der Betriebsbenutzer":**

- **Fehlende Rechte sehen nicht wie Fehler aus**, sondern wie leere Listen (G20). Der Player belegt jede Anfrage mit `only_allow_authenticated=true`, prüft die Identität über `whoami` und **behandelt einen leeren Screen als Fehler**, nicht als leeren Kalender.
- **Wie das Konto eingerichtet wird, ist gemessen** (G21): Rechte über eine eigene Gruppe, Status „Aktiv", Rolle „Mitarbeiter"; die Person braucht einen Benutzernamen. Das reicht für den Bau. Die offenen Reste daran sind Stoff für die Einrichtungsdoku in Phase 4.

**Die Datenschutzfrage ist nicht die API, sondern das Foyer**: Was ein angemeldeter Gestalter in einen Screen legt, sieht jeder. Geburtstage, Dienstpläne mit Namen und Gruppenkontakte kommen deshalb nicht in den MVP.

## Phase 0 und Testinstanz

Das Messprotokoll steht in [`Befunde.md`](Befunde.md). Stand:

| | Punkte |
| --- | --- |
| **Beantwortet** | G1–G8, G11, G14, G15, G18, G19, G20, G22; G21 für den Bau ausreichend |
| **Blockiert und zwingend** | **G9** (Login-Token unter `/ccm/`) |
| **Blockiert, aber verzichtbar** | G10 (Service Worker – ohne ihn bleibt Offline-Festigkeit halb, siehe Risiko 2) |
| **Hinfällig** | G12, G13 – die Felder gibt es nicht (G22) |
| **Geparkt** | G16 (Rate-Limit) · G17 (Extension Store) · G21-Reste |

**Die Testinstanz** ist leer angelegt, Build und Upload-Grenze wie produktiv. Dort darf ausprobiert, liegengelassen und zerschossen werden; gegen die Produktivinstanz wird nur gelesen. **Ihr Ertrag sind die Fixtures unter `fixtures/`** (nicht versioniert) – gegen sie läuft die gesamte Entwicklung, und sie sind **seit dem 2026-09-24 außerhalb des Repos gesichert**. Neu Aufgezeichnetes wird vor Ablauf der Lizenz nachgesichert.

## Datenquellen für Inhaltsblöcke

Geprüft gegen die OpenAPI-Spezifikation 3.136.2. **Fett = MVP.**

| Block | Endpunkte |
| --- | --- |
| **Termine** | `/calendars`, `/calendars/appointments` (**`calendar_ids[]` Pflicht**, dazu `from`, `to`). Serien löst der Server auf, samt Ausnahmen und Zeitumstellung; Zeiten in UTC (G19) |
| **Gemeindekopf** | `/info` (Name, Anschrift), Logo über `<instanz>/logo`, anonym; Ziel der Weiterleitung mit `w`/`h` (G29) |
| **Bilder** | `imageUrl` (`/images/{fileId}/{hash}`) am Bilddienst, **immer mit `w` und `h`** (G14) |
| Beiträge / News | `/posts` – woran die Sichtbarkeit hängt, ist offen |
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

**Entschieden am 2026-09-23:** Das Modell lautet **Screen → Playlist → Slides**. Die Ebene kommt in Phase 1 ins Schema, weil sie sich später nur mit einer Datenmigration auf laufenden Geräten nachziehen ließe. **Die Oberfläche dafür kommt später.** Im MVP hat jeder Screen genau eine Playlist, und der Gestalter merkt davon nichts.

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
- Bühnenskalierung mit Letterbox und Overscan-Korrektur.
- Slide-Rotation; **drei getrennte Intervalle**: Slides (Sekunden), ChurchTools-Daten (Minuten), Screen-Konfiguration (wenige Minuten – sonst sieht niemand seine Änderung, bevor er das Haus verlässt).
- Anmeldung per Token, `whoami`-Prüfung, leerer Screen = Fehler mit sichtbarer Meldung (F).
- **Uhrprüfung**: Gerätezeit gegen die Zeit einer API-Antwort; unbestätigt lieber keine Uhr als eine falsche.
- Letzter erfolgreicher Stand in IndexedDB, **Bilder in Cache Storage** (nach dem ersten Durchlauf lädt das Gerät sie von der eigenen Platte, G28), Bilder der nächsten Slide vorab dekodiert; Backoff bei Fehlern, `429`/`Retry-After` beachten, zufälliger Versatz im Intervall.
- Selbstheilung: Neuanmeldung, Neuladen nach wiederholten Fehlern und bei Modul-Ladefehlern, nächtlicher Neustart der Seite.
- Duldsam gegenüber neueren Daten (E).

### Später

In ungefährer Reihenfolge des Nutzens:

- Zeitplan-Oberfläche samt Zeitregler in der Vorschau („was liefe Sonntag 10:30?") – das Datenmodell steht bereits.
- Player-URL-Generator im Designer mit Erklärung zum Token. Bis dahin wird die URL einmal von Hand gebaut.
- Heartbeat und Statusanzeige je Screen („zuletzt gesehen") – braucht die Kategorie `status` und damit das einzige Schreibrecht des Geräts.
- Export/Import eines Screens als JSON, Vorlagen, Duplizieren.
- Weitere Datenblöcke: Beiträge, Gruppen/Anmeldungen, Raumbelegung, Dienste. QR-Code, Laufschrift.
- Wechsel der Auflösung eines bestehenden Screens als Umrechnung mit Vorschau.
- Löschen in der Mediathek mit Referenzzählung (bis dahin: löschen in ChurchTools, der Player zeigt einen Platzhalter).
- Warnung bei schlechter Lesbarkeit aus fünf Metern.
- Service Worker für den Neustart ohne Netz (G10).
- Web-Code-Block, Videos.
- Rollen für Gestalter, die nicht wir sind; Extension Store (G17).

## Phasen

| Phase | Inhalt | Ergebnis |
| --- | --- | --- |
| **0 – Machbarkeit** | Abgeschlossen bis auf G9 und das Hochladen eines leeren Moduls – beides wartet auf die Freischaltung | „Hallo &lt;Vorname&gt;" läuft im echten ChurchTools |
| **1 – Datenmodell** | Schema Screen → Playlist → Slides → Blöcke, versioniert und duldsam; Slug; KV-Repository mit Mock; Revisionsprüfung. **Dazu die Terminnormalisierung** als eigene Schicht mit Tests gegen die Fixtures (ganztägig, mehrtägig, Zeitzone der Instanz) | Screens lassen sich ohne Oberfläche speichern und laden |
| **2 – Player** | Blockrendering, Bühne, Rotation, Intervalle, Token-Anmeldung, Uhrprüfung, Offline-Stand | Ein von Hand geschriebener Screen läuft auf einem Kiosk-Gerät am Foyer-TV |
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

## Risiken

1. **Die Freischaltung kommt nicht rechtzeitig.** Die Lizenz der Testinstanz läuft am 2026-10-22 um 21:53 ab, die Anfrage ist unbeantwortet. Bis Phase 2 hält das nichts auf – dann aber muss ein Modul irgendwo laufen. Rückfall ist ein Testmodul unter eigenem Key (`infoscreen-designer-test`) auf der **Produktivinstanz**, das nur in eigene Kategorien schreibt. **Das ist eine Entscheidung, keine Automatik** – nach den Arbeitsregeln wird dort bisher nichts geschrieben.
2. **Das Gerät läuft unbeaufsichtigt.** Speicherlecks, abgelaufene Sitzungen, Netz- und Stromausfälle, schwache Hardware. Der Player muss von selbst wieder hochkommen. Daten und Bilder liegen nach dem ersten Durchlauf auf dem Gerät (G28); die Seite selbst aber nicht – ohne Service Worker (G10) zeigt ein Gerät, das während eines Netzausfalls neu startet, nichts. Das ist dann zu benennen, nicht zu übergehen.
3. **Login-Token auf der SD-Karte.** Tragbar, weil der Rückzugsweg gemessen ist (Passwortwechsel, G18) und das Konto nur liest.
4. **Stilgrenze zur Hostseite.** Ohne sie hängt das Aussehen der Bühne von ChurchTools-Updates ab – und unsere Stile beschädigen fremde Oberflächen.
5. **ChurchTools ändert die Extension-Schnittstelle.** Deshalb eine Naht (Repository), nicht KV-Zugriffe quer durch die Anwendung.
6. **Stilles gegenseitiges Überschreiben.** Kein ETag, keine Transaktion (G3). Revisionsprüfung und „Index zuletzt" erkennen den Konflikt, verhindern ihn nicht.
7. **Ein Update der Extension bricht laufende Player.** Neue Asset-Namen, alter Kiosk-Tab, `404` auf einen Chunk. Deshalb ein Bündel und Neuladen bei Modul-Ladefehlern, im CI geprüft.
8. **Die Instanz-URL landet im Release-Build.** Vite ersetzt `import.meta.env.*` zur Bauzeit. Deshalb tragen Instanz-URL und Token kein `VITE_`-Präfix und leben nur im Dev-Proxy; `scripts/check-dist.js` sucht bei jedem Build nach `*.church.tools` im `dist/`.

## Offene Entscheidungen

**Vor Phase 1 – beide entschieden:**

1. ~~**Undo/Redo: Zustand oder Befehle?**~~ – **entschieden am 2026-09-24 für V1: Zustand.** Der Designer führt einen Verlauf von Schnappschüssen der betroffenen Slide, keine umkehrbaren Befehle. Die Werte sind klein (höchstens 10.000 Zeichen), und Schnappschüsse sind mit Pinia einfacher und robuster. Reicht das später nicht mehr, wird neu entschieden.
2. ~~**MVP-Zuschnitt**~~ – **entschieden am 2026-09-24: wie unter „Funktionsumfang – MVP"**. V1 hat Termine, Bilder, Text, Gemeindekopf und Uhr, eine Playlist je Screen; kein Web-Code-Block, keine Geburtstage, keine Videos. Alles unter „Später" ist ausdrücklich nicht V1.

3. ~~**Hardware**~~ – **entschieden am 2026-09-24: keine Zielhardware.** Die Extension geht an die Community; dort laufen Raspberry Pis, Mini-PCs und VMs nebeneinander. Der Player setzt deshalb nur einen aktuellen Browser mit **dauerhaftem Profil** voraus und holt nach dem ersten Durchlauf alles Schwere vom Gerät selbst: Konfiguration und Termine aus IndexedDB, Bilder aus Cache Storage, die Bilder der nächsten Slide vorab dekodiert. Ein Test auf schwacher Hardware (ein älterer Pi) bleibt sinnvoll, entscheidet aber nichts mehr vorab.

**Nicht blockierend, aber offen:**

4. **Zeitbudget.** Der Plan nennt Phasen, aber keine Schätzung; für ein Feierabendprojekt entscheidet das über den Zuschnitt.

**Mit Vorgabe beantwortet, bis jemand widerspricht:**

- **Zielgruppe**: zuerst nur wir; der Extension Store (G17) kommt später. Keine eigene Instanz-URL im Build hält die Tür offen.
- **Wer gestaltet**: zuerst wir.
- **Aktualität**: Konfiguration alle 2 Minuten, Daten alle 10 Minuten, jeweils mit Versatz.
- **Ton**: alles stumm.

**Gestrichen am 2026-09-24:** die Rückfallposition bei den Medien (der Wiki-Weg trägt) und eine gemeinsame `ct-utils`-Bibliothek mit `ct-pass-store` (Abstimmungsaufwand ohne Produktnutzen; der Code bleibt als Vorlage lesbar).

## Nächste Schritte

**Zwingend, in dieser Reihenfolge:**

1. ~~**Fixtures außerhalb des Repos sichern**~~ – **erledigt am 2026-09-24.**
2. ~~**Ablaufdatum der Testinstanz nachsehen**~~ (T3) – **2026-10-22, 21:53.** Das ist der Stichtag für Risiko 1.
3. ~~**Entwicklungsumgebung**~~ (`Preparation.md` B1–B4) – **erledigt am 2026-09-24**, „Hallo &lt;Vorname&gt;" läuft in Chromium und WebKit.
4. **Phase 1** – **Kern steht seit dem 2026-09-24**: Schema mit duldsamem Lesen, Repository mit Mock und Revisionsprüfung, Terminnormalisierung samt Zeitzone. Ganztägige Termine sind seit G23 gemessen. Offen: die echte KV-Anbindung gegen eine Instanz prüfen (nach T1).
5. **Phase 2** – **Player läuft seit dem 2026-09-24 gegen den Mock**, mit echten Terminen der Testinstanz: Bühne mit Letterbox und Overscan, Rotation, Zeitplan-Auswertung, drei Intervalle mit Versatz und Backoff, Zeitlimit je Anfrage, Uhrprüfung über den `Date`-Kopf, letzter Stand in IndexedDB, Bilder in Cache Storage mit Vorab-Dekodierung der nächsten Slide, Neuladen bei neuerem Schema und nachts. Im Designer eine Screen-Liste mit Link in den Player; ohne Custom Modules steht dort in der Entwicklung ein Demo-Screen aus dem Arbeitsspeicher, im Release-Bündel fehlt er. **Offen:** Anmeldung per Token unter `/ccm/` (G9), das Logo im Kopfblock, mitgelieferte Schriften statt Systemschriften, Service Worker (G10) und ein Test auf schwacher Hardware (Offene Entscheidung 3).
6. **Phase 3** – **Editor steht seit dem 2026-09-24**: Screens anlegen (Name, feste Adresse, quer oder hochkant) und löschen; Slides hinzufügen, duplizieren, entfernen, per Ziehen ordnen, Dauer und Hintergrund setzen, abschalten; alle sieben Blocktypen einfügen, auf der Bühne ziehen und an acht Griffen skalieren – mit einblendbarem Raster (10–60 px) zum Einrasten und Hilfslinien an Bühnenmitte, Bühnenrändern und anderen Blöcken, aussetzbar mit der Alt-Taste – im Inspektor gestalten, Kalender wählen, Ebenen ordnen. Rückgängig/Wiederholen als Schnappschüsse des ganzen Screens – ein Ziehen oder ein Feld ist ein Schritt. Speichern mit Revisionsprüfung und Dialog bei Konflikt, Warnung beim Verlassen mit ungespeicherten Änderungen. Die Vorschau nutzt die Komponenten des Players mit Live-Daten. **Im Demo-Modus** (Entwicklung ohne Custom Modules) teilen sich Designer- und Player-Tabs eines Browsers denselben Speicher, und ein offener Player übernimmt Gespeichertes sofort; im Betrieb findet er Änderungen beim nächsten Konfigurationsabruf (Vorgabe 2 Minuten). Nach einer Änderung bleibt der Player auf der gezeigten Slide, statt von vorn zu beginnen. Aussehen nach den Tokens der Hostseite (G25). Die **Mediathek** steht seit demselben Tag: Upload in den Wiki-Bereich „Infoscreen", Bild für Bildblock und Slide-Hintergrund, Löschschutz mit Nennung der Verwendungen. Lesbarkeitswarnung und Vorlagen stehen unter „Später", nicht im MVP.

**Bis zum MVP, nach Priorität** *(festgelegt am 2026-09-24)*:

1. ~~**Player an den Geräte-Benutzer binden.**~~ **Erledigt am 2026-09-24.** Hat der Kiosk-Browser noch die Sitzung eines Menschen, liefe der Player mit dessen Rechten, und der Token würde nie benutzt. Weicht `whoami` von `user_id` ab, meldet er sich jetzt mit dem Token neu an; gelingt das nicht, zeigt er einen Fehler mit beiden Personennummern, ohne Namen. Ein solcher Fehler sperrt auch die Datenabrufe, bis die Anmeldung wieder stimmt – sonst hätte der nächste Datenabruf ihn überdeckt, wo ein gespeicherter Stand vorlag. **Ungemessen:** ob `login_token` eine bestehende fremde Sitzung tatsächlich ersetzt (G9).
2. ~~**Neuladen nach anhaltenden Fehlern**~~ **Erledigt am 2026-09-24:** nach 30 Minuten ununterbrochener Fehler eines Abrufs – aber nur, wenn die Seite selbst erreichbar ist. Ohne Service Worker (G10) ersetzte ein Neuladen im Netzausfall den alten Stand durch die Fehlerseite des Browsers. Scheitert schon das Laden des Bündels, hilft kein eigener Code; das gehört als Kiosk-Einstellung in die Einrichtungsdoku.
3. ~~**Fehlende Rechte im Designer benennen**~~ **Erledigt am 2026-09-24.** Die Startseite liest `/permissions/global` und nennt, was fehlt: Modulrechte je Kategorie (Schreibrechte nur auf Screens, Playlists, Slides und Medien – die Einstellungen schreibt die Einrichtung) und die Wiki-Rechte am Bereich „Infoscreen". Eine unsichtbare Kategorie wird mit beiden möglichen Ursachen benannt, weil die API sie nicht unterscheidet (G20). **Ungeprüft bis zur Freischaltung:** die Form der Modulrechte (G4 aus der Spezifikation, nicht aus einer Antwort) und ob „alle Kategorien" als Liste oder anders geliefert wird.
4. **Risiko 1 entscheiden** – fremdbestimmt, läuft nebenher: bei ChurchTools nach Freischaltung und Verlängerung fragen. Stichtag **2026-10-08**; kommt bis dahin nichts, den Rückfall unter `infoscreen-designer-test` auf der Produktivinstanz entscheiden.
5. ~~**Logo im Gemeindekopf**~~ **Erledigt am 2026-09-24.** Player und Vorschau lösen `<instanz>/logo` bei jedem Datenabruf auf und fordern das Ziel in der Größe des Blocks an (G29); das Logo liegt wie alle Bilder im Gerätespeicher, ein neues Logo kommt über die neue Adresse von selbst. Scheitert der Abruf, bleibt das letzte Logo. Im Inspektor „Logo zeigen" und ein eigenes Logo aus der Mediathek als Ersatz, etwa für ein dunkles Logo auf dunklem Grund – als optionales Feld, Schema 1.1; der Löschschutz der Mediathek kennt es. Neue Kopfblöcke zeigen das Logo von Anfang an. **Ungemessen:** was `/logo` ohne hinterlegtes Logo liefert – alles außer einem Bild gilt als „kein Logo".
6. ~~**Mitgelieferte Schriften**~~ **Erledigt am 2026-09-24:** zehn freie Schriften unter der SIL Open Font License, alle von der eigenen Instanz ausgeliefert, nie von einem Schriftendienst – das wäre ein Datenschutzproblem, weil jeder Aufruf Gerät und Gestalter einem Dritten verriete. Ausgewählt nach Verbreitung (Web Almanac 2024, lateinische Schriften ohne Icon-Schriften): Roboto, Open Sans, Poppins, Montserrat, Lato, Source Sans 3, Inter, Oswald; dazu Barlow Semi Condensed und als Serifenschrift Merriweather statt Raleway, deren Mediävalziffern Uhrzeiten unruhig machen. Lato ist Standard, wie im eingebauten Infoscreen (G25). Registriert unter eigenen Namen („ISD …"), nur Latin und Latin-ext, nur 400/600/700; geladen wird eine Schrift erst, wenn Text sie braucht. Ziffern sind auf der ganzen Bühne gleich breit (`tabular-nums`), damit die Uhr beim Minutenwechsel nicht zuckt – gemessen wirkt das in acht der zehn Schriften, Oswald und Poppins bringen keine gleich breiten Ziffern mit. Die alten Schlüssel `sans`, `serif`, `mono` zeigen auf Lato und Merriweather, unbekannte auf Lato. `check-dist.js` bricht ab bei einer fremden Schriftquelle und bei Schriftdateien ohne Lizenztexte. **Offen:** eine Hausschrift als Modul-Einstellung (mit Punkt 8), eine eigene hochgeladene Schrift (Später – das Gerät bräuchte Wiki-Rechte).
7. ~~**Umbenennen abrunden**~~ **Erledigt am 2026-09-24:** Der Name steht im Inspektor unter „Screen" (kein Block gewählt); beim Speichern wird er getrimmt, ein leerer wird mit Hinweis abgelehnt. Im Schema bleibt ein leerer Name lesbar, damit ältere Werte nicht verloren gehen.
8. **Einrichtungsseite, Stufe 1** – nur lesend: Gruppen „Infoscreen-Gestalter" und „Infoscreen-Geräte" wählen, Status und Rechte als Ampel prüfen, fehlende Klickwege nennen. Die Kategorie-IDs der Datenrechte gibt es erst nach dem ersten Start – genau diese Lücke schließt die Seite. Die Kernrechte sind seit G30 bekannt (403 Kalender, 501–503 Wiki); die Rechte der Extension selbst erst nach der Freischaltung. **Vorschlag, noch nicht entschieden** – ersetzt „Wer gestaltet: zuerst wir".
9. **Startseite überarbeiten** *(gewünscht am 2026-09-24)*: je Screen ein Vorschaubild seiner ersten Slide, damit man Screens auf einen Blick erkennt; ein Symbol für Hoch- oder Querformat; die Formularfelder einheitlich – das Auswahlfeld „Ausrichtung" ist niedriger als die Textfelder daneben.
10. **Designer leichter bedienbar** *(gewünscht am 2026-09-24)*: Farben auch als Hex-Wert eingeben, nicht nur über den Farbwähler des Browsers; unter der Slide-Liste ein „+" für eine neue Slide; die Bausteine sichtbarer machen – heute stehen sie als Knopfreihe in der Kopfzeile und gehen dort unter.
11. **Release-Workflow** auf Tags `v*.*.*`, Versionsabgleich mit `CHANGELOG.md`, ZIP als GitHub-Release.
12. **Einrichtungsdoku** `docs/Einrichtung.md`: Klickwege, Kiosk-Browser, Notbremse (G18), Öffentlichkeit von Bildern und Logo (G14, G29).
13. **Freischaltung vorbereiten**: Skript für den Typ-Snapshot, das ohne `/custommodules`-Pfade abbricht; Checklisten für B6 und G9.

**Sobald freigeschaltet ist:** Testmodul unter `infoscreen-designer` hochladen und Rechte vergeben (B6), Typ-Snapshot ziehen (B5), Login-Token am `/ccm/`-Pfad prüfen (G9), die numerischen Rechte-IDs der Extension ablesen, das Speichern einmal gegen die echte KV-Anbindung durchspielen, Fixtures nachsichern. G10 nur, wenn es nebenbei geht.

**Später:** Rechte aus der Einrichtungsseite selbst setzen (Stufe 2, `POST /groups` und `PUT /permissions/group_role/{id}`, nur an neu angelegten Gruppen).

**Nicht anfassen, bis ein Produktschritt es braucht:** G16, C4, `attachments`, `ct-events-load`, das Gespräch mit dem Autor von `ct-pass-store`. Die Frage 306/403 aus G21 ist seit G30 beantwortet.

## Quellen

- ChurchTools Extension Boilerplate: <https://github.com/churchtools/extension-boilerplate>
- ChurchTools JS-Client: <https://github.com/churchtools/churchtools-js-client>
- `ct-pass-store` (MIT), läuft auf unserer Produktivinstanz: <https://github.com/lub90/ct-pass-store> – ergiebig sind `extension/src/ct-utils/lib/ExtensionData.ts`, `extension/vite.config.ts`, `extension/scripts/package.js`, `extension/README.md` (Rechte je Rolle)
- Referenz-Extension: <https://github.com/aschojz/churchtools-extension-publisher>
- Extension mit Termin-Persistenz: <https://github.com/bensteUEM/ct-events-load>
- Forum: [Infoscreen mit FullPageOS](https://forum.church.tools/topic/10280), [Wünsche der Anwender](https://forum.church.tools/topic/6252), [Login-Token für den Infoscreen](https://forum.church.tools/topic/11910)
- ChurchTools Academy: [Rechteverwaltung verstehen](https://churchtools.academy/de/help/rechteverwaltung/rechteverwaltung-verstehen/), [CORS](https://churchtools.academy/help/system-einstellungen/api/0-cors/)
- 30-Tage-Testinstanz: <https://church.tools/de/test-churchtools/> · Support: <support@churchtools.de>
