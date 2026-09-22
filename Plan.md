# ChurchTools Infoscreen Designer – Projektplan

Ein ChurchTools Custom Module (CCM), mit dem angemeldete ChurchTools-Anwender Infoscreens gestalten. Das Ergebnis ist eine Webseite, die ein Raspberry Pi im Kioskmodus aufruft und auf den Foyer-TVs anzeigt.

## Rahmendaten

- **Stand**: 2026-09-22, Phase 0 läuft. Die Kernfrage ist beantwortet: Custom Modules sind auf unserer Instanz verfügbar, die Architektur dieses Plans trägt. Code existiert noch nicht. Einzelheiten im Phase-0-Protokoll (Abschnitt G).
- **Autor / Repo**: `wirsindcgks <media@cg-ks.de>`, geplant unter `github.com/wirsindcgks/churchtools-infoscreen`
- **Lizenz**: GPL-2.0-or-later (wie `churchtools-plugin`)
- **Arbeitsname Produkt**: ChurchTools Infoscreen Designer
- **Extension-Key (Vorschlag)**: `infoscreen-cgks` → Auslieferungspfad `/ccm/infoscreen-cgks/`
- **Stack (Vorschlag)**: Vue 3 + TypeScript + Vite + Pinia, `@churchtools/churchtools-client`, Vitest, Playwright. Damit identisch zu dem, was ChurchTools selbst im Boilerplate vorgibt und was die einzige bekannte produktive Fremd-Extension (`aschojz/churchtools-extension-publisher`) einsetzt.
- **Dokumente**: `Plan.md` ist das ausführliche Arbeits- und Kontextdokument (wie in `churchtools-plugin`), `CHANGELOG.md` die knappe versionierte Historie, `AGENTS.md` die Repo-Konventionen für Agenten.

## Abgrenzung zu den bestehenden Modulen

Eigenständiges Projekt in einem eigenen Repository, eigener Release-Zyklus, eigene Versionsnummern. **Kein Bestandteil des WordPress-Plugins `churchtools-plugin`** und keine gemeinsame Codebasis mit ihm: Das Plugin ist PHP und läuft in WordPress, der Infoscreen Designer ist TypeScript und läuft in ChurchTools. Die beiden teilen lediglich die Datenquelle und die Erfahrungen aus `churchtools-plugin/plan.md` über das Verhalten der ChurchTools-API.

Übernommen werden bewusst nur Arbeitsweisen: `Plan.md` als Kontextdokument, Keep-a-Changelog, Tag-gesteuerter Release-Workflow, deutsche Oberfläche.

## Pitch

Der native ChurchTools-Infoscreen zeigt eine Terminliste in einem festen Layout. Wiederkehrende Wünsche im ChurchTools-Forum sind seit Jahren dieselben: eigene Inhalte (Bilder, Videos, freie Texte) im Wechsel mit den Terminen, ein abschaltbarer oder gestaltbarer Header, einstellbare Anzeigedauer, mehrere Screens mit unterschiedlichen Inhalten. Wer das braucht, weicht heute auf externe Digital-Signage-Dienste wie Yodeck aus – und pflegt seine Termine dann zweimal.

Der Infoscreen Designer schließt genau diese Lücke: gestalten in ChurchTools, Daten aus ChurchTools, ausspielen aus ChurchTools. Kein zweites System, kein zweiter Datenstand, keine zusätzliche Hosting-Rechnung.

## Architektur

Zwei Oberflächen, ein Paket, kein eigener Server.

```
ChurchTools-Instanz
├── /ccm/infoscreen-cgks/            (das ausgelieferte dist/ der Extension)
│   ├── Designer   – angemeldeter Anwender gestaltet Screens
│   └── Player     – derselbe Code, Parameter ?screen=<id>&kiosk=1
├── /api/custommodules/…             Screens + Einstellungen (KV-Store)
└── /api/…                           Termine, Gruppen, Beiträge, Geburtstage, Räume
                     ▲
                     │ Raspberry Pi (FullPageOS / Chromium Kiosk)
                     │ ruft /ccm/infoscreen-cgks/?screen=3&login_token=…&user_id=…
```

**Warum kein eigener Server.** Ein eigener Renderer-Dienst würde eine öffentliche URL ohne ChurchTools-Anmeldung erlauben, bräuchte aber Hosting, einen dauerhaft gültigen API-Key mit Leserechten auf Gemeindedaten und eine eigene Update-Strecke. Der CCM-Weg kommt ohne all das aus: Die Instanz ist zugleich Speicher, Auslieferung und Rechteverwaltung. Der Preis dafür ist, dass der Pi sich anmelden muss – das löst der Login-Token (siehe Abschnitt D), und genau so läuft der native Infoscreen heute schon.

**Designer und Player teilen sich den Code.** Ein Screen ist ein JSON-Dokument (Seiten, Blöcke, Bindungen). Der Designer schreibt es, der Player liest es und rendert dieselben Blockkomponenten ohne Bedienelemente. Damit ist die Vorschau im Designer definitionsgemäß das, was auf dem TV steht.

**DOM statt Canvas.** Der Publisher rendert mit Konva, weil er PNG/JPEG exportieren muss. Ein Infoscreen exportiert nichts, er läuft – und braucht dafür Videos, Web-Fonts, Laufschrift und weiche Übergänge. Das ist mit absolut positionierten DOM-Blöcken auf einer per `transform: scale()` skalierten 1920×1080-Bühne einfacher und robuster als mit einem Szenengraphen.

**Die Bühne ist 1920×1080, der Fernseher ist es nicht immer.** `transform: scale()` setzt ein passendes Seitenverhältnis voraus. Im Foyer stehen aber 4K-Geräte, hochkant gedrehte Bildschirme, gelegentlich ein Beamer mit krummer Auflösung – und fast alle haben Overscan. Die Regel deshalb ausformuliert: Die Bühne hat feste Pixelmaße, alles darauf wird in Pixeln positioniert, und ein einziger Skalierungsfaktor (`--stage-scale`) bildet sie auf den Viewport ab. Passt das Seitenverhältnis nicht, wird **eingepasst statt beschnitten** (Letterbox); je Screen gibt es zusätzlich eine Overscan-Korrektur in Prozent. Das kostet jetzt einen Absatz und später keine zwei Wochen.

**Schriften kommen aus dem Paket.** Web-Fonts sind einer der Gründe für DOM statt Canvas – dann muss aber auch feststehen, woher sie kommen. Nicht von Google Fonts: Das lädt personenbezogene Daten von einem Gerät im Gemeindefoyer zu einem Dritten und fällt bei Netzausfall aus. Stattdessen ein fester, mitgelieferter, selbst gehosteter Satz freier Schriften mit geprüfter Lizenz; die Schriftauswahl im Designer ist eine geschlossene Liste, kein Textfeld für eine URL.

## Voraussetzungen für die ChurchTools-Integration

Das ist der Teil, der vor der ersten Zeile Code steht. Belegt ist alles unter A–F; was noch offen ist, steht gesammelt unter G.

### A. Auf Seiten der ChurchTools-Instanz

| Voraussetzung | Details |
| --- | --- |
| **Custom Modules verfügbar** | **Erledigt am 2026-09-22.** `feature_custommodule` steht auf `"1"`, `GET /api/custommodules` antwortet mit 200. Siehe G. |
| **Administrationsrecht** | Zum Hochladen/Anlegen des Custom Modules und zum Erzeugen eines Login-Tokens für einen anderen Benutzer braucht es Adminrechte. |
| **CORS-Freigabe (nur Entwicklung)** | System-Einstellungen → Integrationen → API → Cross-Origin Resource Sharing. Auf unserer Instanz steht heute `access_control_allow_origins: "[]"` und `access_control_allow_credentials: false`. Der Origin allein genügt nicht: ohne `allow_credentials` fährt in der Entwicklung kein Session-Cookie mit. **Bevorzugter Weg ist deshalb der Vite-Proxy** (`/api` → Instanz), der ohnehin für den Safari-Fall gebraucht wird und CORS ganz vermeidet. Im Produktivbetrieb liegt die Extension auf derselben Domain, dann entfällt beides. |
| **Dedizierter Infoscreen-Benutzer** | Eigene Person/Benutzer, ohne Zweifaktor (Login-Tokens werden an 2FA-Konten nicht ausgegeben), mit genau den Leserechten, die die Screens brauchen – nicht mehr. |
| **Leserechte** | Für die genutzten Kalender, Gruppen, Beiträge und ggf. Ressourcen. Der Player sieht exakt das, was sein Benutzer sehen darf; das ist die Rechteprüfung, die wir nicht selbst bauen müssen. |

### B. Entwicklungsumgebung

- **Node.js** (aktuelle LTS; der Publisher setzt 24.15.0+ voraus) mit npm, plus `zip` für die Paketierung.
- **Offizielles Boilerplate** als Ausgangspunkt: <https://github.com/churchtools/extension-boilerplate> – bringt `vite.config.ts` mit `base: '/ccm/${VITE_KEY}/'`, `scripts/package.js`, `src/utils/kv-store.ts`, `src/utils/ct-types.d.ts` und eine Dev-Container-Konfiguration mit.
- **`.env`** aus `.env-example` (nicht ins Repo):
  ```
  VITE_KEY=infoscreen-cgks
  VITE_BASE_URL=https://<instanz>.church.tools
  VITE_USERNAME=…
  VITE_PASSWORD=…
  ```
  Benutzername/Passwort dienen nur dem Dev-Login; der Release-Build muss sie ausdrücklich zurücksetzen und stattdessen `window.settings.base_url` der ChurchTools-Hostseite verwenden.
- **Safari-Fallstrick**: Safari blockt `Secure; SameSite=None`-Cookies auf `http://localhost` und Drittanbieter-Cookies. Abhilfe: Vite-Proxy (`/api` → Instanz) plus HTTPS im Dev-Server via mkcert. In Chrome fällt das nicht auf – ein Test in Safari gehört deshalb früh dazu.
- **API-Typen**: `ct-types.d.ts` als versionierter Snapshot aus der generierten Typdatei übernehmen, nicht von Hand pflegen.
- **API-Referenz**: `https://<instanz>/api` (Swagger-UI) bzw. `https://<instanz>/system/runtime/swagger/openapi.json`. Die eigene Instanz ist die Referenz, nicht die Demo – 3.136.2 hat 497 Pfade, die Version darunter oder darüber kann abweichen.
- **Referenz auf der eigenen Instanz**: Unter `/ccm/ctpassstore/` läuft bereits ein fremdes Custom Module („Sekundär-Passwort"). Es beantwortet Fragen zur Einbettung, zu Asset-Pfaden und zur Paketierung, ohne dass wir dafür etwas bauen müssen. Erste Anlaufstelle bei jeder Unklarheit über das Laufzeitverhalten.
- **Upload-Grenze der Instanz**: `max_uploadfile_size_kb: 131072`, also 128 MB je Datei. An der Größe scheitert auch ein Video nicht – die offene Frage ist der `domainType`, nicht das Limit.

### C. Paketierung und Installation

- `npm run deploy` (bzw. `npm run release`) baut `dist/` und packt es nach `releases/<name>-v<version>-<commit>.zip`. Das ZIP enthält **nur `dist/`**, ohne Source-Maps.
- Installation in ChurchTools: Admin → Extensions → Upload Extension → ZIP auswählen.
- **Der Extension-Key im Custom Module muss zum Build passen.** Der Vite-Basispfad ist `/ccm/<VITE_KEY>/`; stimmt der Key nicht, laufen sämtliche Asset-Pfade ins Leere. Für einen abweichenden Key ein eigenes Paket bauen: `VITE_KEY=anderer-key npm run release`.
- Ordnernamen werden **case-sensitiv** behandelt – im Forum ein wiederkehrender Installationsfehler.
- Custom Modules lassen sich inzwischen über die Oberfläche aktualisieren, wenn ein Download-Link hinterlegt ist. Das passt zum bestehenden Muster aus `churchtools-plugin`/`email-obfuscate`: Tag `vx.y.z` pushen → GitHub Action baut das ZIP → Release-Asset ist die Update-Quelle.

### D. Authentifizierung

Drei Wege, für drei Situationen:

1. **Designer im Produktivbetrieb** – gar keine eigene Anmeldung. Die Extension läuft in der angemeldeten ChurchTools-Sitzung; `churchtoolsClient.setBaseUrl(window.settings.base_url)` genügt, `GET /whoami` liefert den Anwender.
2. **Entwicklung** – `POST /login` mit Benutzername/Passwort aus der `.env`, nur unter `import.meta.env.MODE === 'development'`.
3. **Der Raspberry Pi** – Login-Token des dedizierten Infoscreen-Benutzers, als Query-Parameter an die Player-URL:
   ```
   https://<instanz>.church.tools/ccm/infoscreen-cgks/?screen=3&login_token=<TOKEN>&user_id=<ID>&no_url_rewrite=true
   ```
   Der Token wird über `GET /api/persons/<id>/logintoken` geholt (legt ihn bei Bedarf an; Adminrecht nötig, an 2FA-Konten wird keiner ausgegeben). Alternativ liefert `POST /api/login/token` mit Benutzername und Passwort `{personId, token}`, ohne eine Sitzung zu eröffnen. Der `churchtools-client` nutzt den Token außerdem, um nach Sitzungsablauf selbsttätig neu anzumelden – für ein Gerät, das monatelang durchläuft, ist genau das der entscheidende Punkt.

   **Der Token ist ein Dauerpasswort.** Er steht in der URL, im Browserverlauf des Pi und in der `fullpageos.txt` auf der SD-Karte. Konsequenz für den Plan: eigener Benutzer mit minimalen Rechten, dokumentierter Weg zum Zurückziehen (`DELETE /api/persons/{id}/logintoken`), und im Designer ein Dialog, der die fertige URL erzeugt und dabei erklärt, was sie enthält.

### E. Datenspeicherung

Eigene Daten liegen im Key-Value-Store des Custom Modules – hierarchisch Modul → Datenkategorie → Datenwert, wobei jeder Wert ein JSON-String ist:

```
GET    /custommodules                                   alle Module
GET    /custommodules/{extensionkey|moduleId}           eigenes Modul
GET…DELETE /custommodules/{moduleId}/customdatacategories[/{id}]
GET…DELETE /custommodules/{moduleId}/customdatacategories/{id}/customdatavalues[/{id}]
```

**Die Grenzen sind dokumentiert, nicht zu messen.** Aus der OpenAPI-Spezifikation (3.136.2):

| Feld | Grenze |
| --- | --- |
| `CustomModuleDataValue.value` | **10.000 Zeichen** |
| `CustomModuleDataCategory.data` | 2.000 Zeichen |
| `CustomModule.shorty` (Extension-Key) | 50 Zeichen |
| `CustomModule.description` | 300 Zeichen |

10.000 Zeichen sind eng. Ein Screen mit mehreren Slides passt nicht in einen Wert, und Bilddaten passen dort unter keinen Umständen hinein – 10.000 Zeichen sind rund sieben Kilobyte.

**Zuschnitt, der daraus folgt.** Ein Screen ist keine Ablage, sondern eine Sammlung von Werten:

- `screens` – je Screen **ein Index-Wert**: Name, Auflösung, Schema-Version, Revision, Reihenfolge der Slide-IDs. Klein und stabil.
- `slides` – je Slide **ein Wert** mit ihren Blöcken. Ein bis vier Kilobyte sind realistisch; für eine gut gefüllte Slide reicht das Limit, für einen ganzen Screen nicht.
- `snippets` – eigener Wert je HTML-Block, siehe „Eigener Web-Code".
- `media` – Verweise auf ChurchTools-Dateien, nie die Dateien selbst.
- `templates`, `settings` – wie geplant.
- `status` – Lebenszeichen der Player, eigene Kategorie mit eigenem Schreibrecht (siehe F).

**Speichern ist damit ein Mehrfach-Schreibvorgang ohne Transaktion.** Der Index-Wert wird deshalb **zuletzt** geschrieben: Solange er auf den alten Stand zeigt, ist ein halb geschriebener Screen unsichtbar statt kaputt. Verwaiste Slide-Werte räumt ein Aufräumlauf weg.

**Gleichzeitiges Bearbeiten ist ungelöst.** Der KV-Store kennt weder ETags noch Sperren; das Boilerplate schweigt dazu. Zwei Anwender an demselben Screen überschreiben einander lautlos. Mindestmaß: `revision` und `updatedAt` im Index-Wert, Lesen vor dem Schreiben, und ein Dialog statt eines stillen Überschreibens.

In der Entwicklung legt `getOrCreateModule()` das Modul selbst an, im Produktivbetrieb entsteht es bei der Installation.

### F. Rechte, Datenschutz, Betrieb

- **Das Rechtemodell steht fest.** `CustomModulePermission` kennt je Custom Module den Schalter `view` sowie `view`, `create`, `edit` und `delete` jeweils für `custom category` und `custom data` – die Datenrechte als **Liste von Kategorie-IDs**. Genau der Zuschnitt, den dieses Modul braucht:

  | Rolle | Rechte |
  | --- | --- |
  | Gestalter | `view`; `edit custom data` auf `screens`, `slides`, `media`, `templates` |
  | Web-Code | zusätzlich `edit custom data` auf `snippets` – ein eigenes Recht, im Gestalten **nicht** enthalten |
  | Player-Benutzer | `view custom data` auf die lesenden Kategorien, `edit custom data` **allein** auf `status` |
  | Administration | zusätzlich `settings` und das Anlegen von Kategorien |

- **Der Heartbeat braucht ein Schreibrecht.** Die Statusanzeige „zuletzt gesehen" aus Phase 5 setzt voraus, dass der Player schreibt – und damit, dass der Token auf der SD-Karte schreiben darf. Deshalb liegt `status` in einer eigenen Kategorie, auf die sich dieses Recht begrenzen lässt. Wer das nicht will, überwacht die Screens von außen (ein Lebenszeichen des Pi an Home Assistant) und lässt die Kategorie weg.
- Der Designer liest nur, was der angemeldete Anwender sehen darf. Was er in einen Screen legt, sieht aber später **jeder im Foyer**. Diese Schere ist die eigentliche Datenschutzfrage dieses Moduls, nicht die API.
- **Geburtstage** sind der offensichtliche Fall: `GET /persons/birthdays` liefert sie bequem, auf einem öffentlichen TV sind sie personenbezogene Daten ohne Einwilligung. Der Block kommt deshalb nur mit ausdrücklicher Bestätigung und einem Hinweis in die Oberfläche – oder zunächst gar nicht.
- Dasselbe gilt abgeschwächt für Dienstpläne mit Namen und für Gruppenkontakte.

### G. Phase-0-Protokoll

Geprüft wird gegen die eigene Instanz, nicht gegen die Demo und nicht gegen eine Vermutung – dieselbe Regel wie in `kraichtal-wetter-hacs`.

#### Beantwortet am 2026-09-22

**G1 – Custom Modules sind verfügbar.** Angemeldet liefert `GET /api/config` das Flag `feature_custommodule: "1"`; `GET /api/custommodules` antwortet mit **200** und listet ein bereits produktiv installiertes fremdes Modul (`ctpassstore`, „Sekundär-Passwort", `inMenu: true`). Die Architektur dieses Plans trägt.

Die frühere Annahme, es brauche eine Version über 3.136.2, ist damit **widerlegt**: Unsere Instanz läuft auf Build 32882 – demselben Build wie `demo.church.tools`. Der dortige 404 kam daher, dass anonym angefragt wurde. Die Spezifikation sagt es selbst: „The documentation will always show only those endpoints you can use with your ChurchTools installation." Die `CustomModule*`-Schemas stehen auch in der Demo-Spec, nur ihre Pfade fehlen dort.

> **Lehre, die über diesen Punkt hinausreicht:** Ein 404 der ChurchTools-API ist **kein** Beweis für eine fehlende Route. Ohne passende Anmeldung und Rechte ist eine Route unsichtbar – auch in der OpenAPI-Spezifikation, die pro Benutzer gefiltert ausgeliefert wird. Jede Aussage der Form „gibt es nicht" braucht einen angemeldeten Versuch mit ausreichenden Rechten, sonst ist sie wertlos.

**G4 – Die Grenzen des KV-Stores stehen.** 10.000 Zeichen je Datenwert, 2.000 je Kategorie. Nicht gemessen, sondern in der Spezifikation dokumentiert. Zuschnitt und Folgen stehen in Abschnitt E. Mitentschieden ist damit: Bilddaten als Data-URI im KV-Store scheiden aus.

**Nebenbefunde der Instanz** (in A und B eingearbeitet): CORS ist unkonfiguriert und `access_control_allow_credentials` steht auf `false`; die Upload-Grenze liegt bei 128 MB je Datei; Zeitzone `Europe/Berlin`; gehostet bei ChurchTools, also kein Self-Hosting; Wiki, Kalender, Gruppen, Beiträge, Ressourcen und Dienste sind aktiv – sämtliche Datenquellen der Blocktabelle stehen zur Verfügung.

#### Offen

1. **Wird die Extension in die ChurchTools-Oberfläche eingebettet?** Mit `ctpassstore` ist das heute prüfbar, ohne etwas zu bauen: Seite aufrufen und ansehen, ob die ChurchTools-Navigation darum steht, ob das Modul im iframe hängt und ob `window.settings.base_url` tatsächlich injiziert wird. Für den Player ist eine sichtbare Navigation ein Problem. Fallbacks in dieser Reihenfolge: (a) Kiosk-Modus als `position: fixed; inset: 0` über den gesamten Viewport, (b) gezieltes Ausblenden der Hostseiten-Chrome per CSS, (c) Player als eigene, minimale HTML-Datei im Paket.
2. **Fallen unbekannte Unterpfade auf `index.html` zurück?** Statische Unterpfade funktionieren nachweislich – `ctpassstore` lädt seine Vite-Assets aus `/ccm/ctpassstore/assets/…`, sonst liefe es nicht. Offen ist allein der SPA-Fallback. Bis das geklärt ist, gilt die **Hash-Route als Vorgabe** (`#/player?screen=3`): Ein Hash erreicht den Server nie und kann deshalb nicht 404 werden.
3. **Wohin gehen hochgeladene Bilder und Videos?** Unverändert der teuerste offene Punkt; siehe „Medien und eigener Web-Code". An der Dateigröße scheitert es nicht (128 MB), nur am `domainType`.
4. **Wie verhält sich `login_token` in der URL bei einem Custom Module?** Beim nativen Infoscreen erprobt, für `/ccm/`-Pfade ungeprüft.
5. **Darf unter `/ccm/<key>/` ein Service Worker registriert werden?** Entscheidet, ob Offline-Festigkeit vollständig erreichbar ist oder nur halb: IndexedDB sichert die Daten, aber nicht die eigenen Assets und nicht die Bilder. Ohne Service Worker zeigt ein Pi, der während eines Netzausfalls neu startet, einen weißen Bildschirm – genau der Fall aus Risiko 4. Zu prüfen sind Scope, MIME-Typ und ob ChurchTools den Pfad umschreibt.
6. **Wie verhindern wir, dass zwei Gestalter einander überschreiben?** Der KV-Store kennt keine ETags, das Boilerplate schweigt dazu. Zu prüfen, ob `PUT` auf einen Datenwert irgendeine Form von Konfliktprüfung kennt; falls nicht, gilt das Mindestmaß aus Abschnitt E.
7. **Extension Store**: Aufnahmekriterien, Einreichungsweg, ob eine Veröffentlichung überhaupt angestrebt wird. Der Publisher hält seinen Store-Text in einer eigenen `EXTENSION_STORE.md` – ein Muster, das sich übernehmen lässt.

## Entwicklungs- und Testumgebung

**Eine offizielle Sandbox gibt es bei ChurchTools nicht.** Im Forum heißt es dazu unmissverständlich „Ein solches Testsystem gibt es derzeit nicht"; eine Datenbank-Kopie der Produktivinstanz ist kostenpflichtig und brächte echte Personendaten in eine Entwicklungsumgebung – genau das, was dort nicht hingehört. Wir sind bei ChurchTools gehostet (`hostingservice: "1"`), Self-Hosting steht also ohnehin nicht zur Wahl.

Daraus folgt eine Staffelung in drei Stufen statt einer einzigen Testumgebung:

**Stufe 1 – lokal, ohne ChurchTools.** Designer-Oberfläche, Blockrendering, Bühnenskalierung, Slide-Rotation, Offline-Verhalten, Undo/Redo: Für den größten Teil der Arbeit braucht es keine Instanz. Ein Mock aus der OpenAPI-Spezifikation der eigenen Instanz plus aufgezeichnete, anonymisierte Antworten als Fixtures. Das läuft offline, ist reproduzierbar, schont die Instanz und ist zugleich die Grundlage der automatisierten Tests. Diese Stufe wird gebaut, unabhängig davon, welche Instanz sonst zur Verfügung steht.

**Stufe 2 – eine eigene Instanz für die Integrationsfragen.** Nur eine echte Instanz beantwortet die offenen Punkte 1, 2, 4 und 5 aus G. Zwei Wege: die kostenlose 30-Tage-Testinstanz, oder – sauberer, weil wir bereits Kunde sind und länger als 30 Tage brauchen – eine Anfrage an `support@churchtools.de` nach einer Instanz für die Entwicklung einer Extension. ChurchTools betreibt den Extension Store selbst und richtet für Schulungen nachweislich Demo-Installationen ein. Eine Testinstanz unter erfundenem Gemeindenamen anzulegen verbietet sich. Zu beachten: Eine frische Instanz ist **leer**; Kalender, Termine und Gruppen müssen angelegt werden – was etwa einen Abend kostet und dabei die Fixtures für Stufe 1 erzeugt.

**Stufe 3 – kontrolliert auf der Produktivinstanz, früher als es sich anfühlt.** Ein Custom Module ist weniger invasiv als der Name nahelegt: Es liegt unter seinem eigenen Key-Pfad, schreibt ausschließlich in seine eigenen KV-Kategorien und liest über die API nur das, was der angemeldete Anwender ohnehin sehen darf. Mit einem eigenen Key (`infoscreen-cgks-test`) steht eine Testinstallation neben einer späteren produktiven, ohne sie zu berühren – dass mit `ctpassstore` bereits ein fremdes Modul dort läuft, zeigt, dass mehrere nebeneinander kein Problem sind.

Wirklich aufpassen muss man an drei Stellen, und alle drei sind vermeidbar:

- **Medien-Uploads** erzeugen echte Inhalte (Wiki-Seiten, Dateien) → eigene, versteckte Kategorie „Infoscreen-Test", am Ende aufgeräumt.
- **Der Infoscreen-Benutzer mit Login-Token** ist ein Dauerpasswort → erst anlegen, wenn Phase 2 steht, mit minimalen Rechten, und den Rückzugsweg (`DELETE /api/persons/{id}/logintoken`) vorher einmal geübt.
- **Rechtekonfiguration** am Custom Module → eigene Testgruppe, nicht an bestehenden Rollen schrauben.


## Datenquellen für Inhaltsblöcke

Geprüft gegen die OpenAPI-Spezifikation 3.136.2 (497 Pfade):

| Block | Endpunkte |
| --- | --- |
| Termine | `/calendars`, `/calendars/appointments` (`calendar_ids[]`, `from`, `to`), `/calendars/{id}/appointments/{id}/{startDate}` für Einzeltermin samt Bild |
| Gemeindekopf | `/info` (Name, Anschrift), `/files/logo/{id}` |
| Beiträge / News | `/posts`, `/post/groups` |
| Gruppen & Anmeldungen | `/groups`, `/groups/grouped`, `/grouphomepages`, `/publicgroups/{id}` (Kapazität, Warteliste) |
| Raumbelegung „wer ist wo" | `/resource/masterdata`, `/bookings` (`resource_ids[]` ist Pflicht) |
| Dienste / Gottesdienst | `/events`, `/events/{id}/agenda`, `/services`, `/event/masterdata` |
| Geburtstage | `/persons/birthdays` (`start_date`, `end_date`, `campus_ids[]`, `group_ids[]`) – **nur mit Einwilligung** |
| Bilder | `/files/{domainType}/{domainIdentifier}` mit `appointment_image`, `groupimage`, `logo`, `post` |
| Filter mehrerer Standorte | `/campuses`, `/departments`, `/tags/{domainType}` |
| Freie Texte | `/wiki/pages`, `/wiki/categories/{id}/pages/{identifier}` |

Dass `/api/whoami` auf der Demo anonym 200 liefert, ist bekannt und im `churchtools-plugin` bereits dokumentiert: ohne Anmeldung antwortet ChurchTools als öffentlicher Benutzer. Für den Player heißt das – ein fehlgeschlagener Login fällt nicht von selbst auf. Der Player muss `only_allow_authenticated=true` verwenden und einen leeren Screen als Fehler behandeln, nicht als leeren Kalender.

## Medien und eigener Web-Code

Slides sollen nicht nur ChurchTools-Daten zeigen, sondern auch eigene Bilder, Videos und eigenen Web-Code. Beides berührt die zwei heikelsten Stellen des Moduls.

### Eigene Bilder und Videos

ChurchTools kann Dateien annehmen: `POST /files/{domainType}/{domainIdentifier}` als `multipart/form-data` mit `files[]`, optional `max_width`, `max_height` und `image_options` für Zuschnitt und Fokus. Dazu passend `GET` zum Auflisten, `PATCH` zum Umbenennen und Sortieren, `DELETE` zum Entfernen.

Der Haken ist `domainType`. Die Spezifikation führt eine feste Liste: `avatar`, `groupimage`, `appointment_image`, `logo`, `attachments`, `bulkletter_template`, `service`, `song_arrangement`, `importtable`, `person`, `familyavatar`, `post`, `wiki_.?`. **Ein eigener Typ für Custom Modules ist nicht darunter.** Das deckt sich damit, dass der Publisher eigene Bild-Uploads „bis zu einem offiziellen ChurchTools-Speicherpfad bewusst deaktiviert" hat.

Kandidaten, in Phase 0 in dieser Reihenfolge zu prüfen:

1. **Wiki-Kategorie als Mediathek** (`wiki_<kategorie>`). Eine eigene Kategorie „Infoscreen-Medien", Uploads hängen an Wiki-Seiten. Vorteile: echte ChurchTools-Dateien mit URL, ChurchTools-Rechten und einer Oberfläche, in der Anwender sie auch ohne unser Modul verwalten und löschen können. Der wahrscheinlichste Weg – zuerst testen.
2. **`attachments`** – wenn sich klären lässt, woran `domainIdentifier` hier bindet und ob wir frei wählen dürfen.
3. **Bestehende ChurchTools-Bilder ohne eigenen Upload**: Termin-, Gruppen-, Beitrags- und Logobilder. Das funktioniert sicher, reicht aber für „Bild hochladen" nicht aus – es ist der Rückfallplan, nicht das Ziel.
4. ~~**Data-URI im KV-Store**~~ – **ausgeschieden.** Ein Datenwert fasst 10.000 Zeichen, also rund sieben Kilobyte. Das reicht nicht einmal für ein Icon, für Videos erst recht nicht.
5. **Externe URL** als Notausgang: Der Anwender hinterlegt eine Adresse, wir speichern nur den Link. Interessant dabei: ChurchTools kennt dafür einen eigenen Endpunkt, `POST /files/{domainType}/{domainIdentifier}/link` („Adds the given external link to the specified domain object"). Ein verlinktes Bild wäre damit kein Fremdkörper, sondern eine reguläre ChurchTools-Datei. Kostet nichts, verlagert aber das Problem auf den Anwender und bricht, sobald die Quelle verschwindet.

Unabhängig vom Ergebnis: Uploads werden vor dem Speichern im Browser auf die Zielauflösung des Screens herunterskaliert. Ein 8-Megapixel-Handyfoto auf einem 1080p-Screen ist verschwendete Bandbreite auf einer Leitung, an deren Ende ein Raspberry Pi hängt.

Videos sind der Sonderfall: groß, und ein Pi der älteren Generationen spielt sie im Browser nicht zuverlässig ab. Sie kommen erst nach dem MVP und erst, nachdem sie auf der echten Hardware gemessen wurden.

### Eigener Web-Code

Ein HTML-Block ist für einen Infoscreen naheliegend – eingebettete Wetterkarten, Zählerstände, fremde Widgets, schnelle Sonderlösungen. Er ist zugleich die einzige Stelle, an der dieses Modul fremden Code ausführt, und zwar auf der ChurchTools-Domain, in der Sitzung eines angemeldeten Benutzers.

Deshalb gilt ohne Ausnahme: **eigener Web-Code läuft in einem `<iframe>` mit `sandbox="allow-scripts"` und ohne `allow-same-origin`.** Die Kombination beider Flags hebt die Sandbox faktisch auf und ist verboten. Ohne `allow-same-origin` bekommt der Rahmen eine undurchsichtige Herkunft: kein Zugriff auf Cookies, `localStorage`, das DOM der Hostseite oder die ChurchTools-API. Der Inhalt kommt über `srcdoc`, nicht über `innerHTML` irgendwo im Player-DOM.

Weitere Regeln, die ins Datenmodell und nicht in ein späteres Review gehören:

- Der HTML-Block ist ein eigener Blocktyp mit eigenem Recht. Wer Screens gestalten darf, darf nicht automatisch Code einbetten.
- Zwei Varianten, getrennt gedacht: **eigener HTML-Schnipsel** (`srcdoc`, gesandboxt) und **fremde Seite einbetten** (`src`, ebenfalls gesandboxt). Bei letzterem gilt: Viele Seiten verbieten die Einbettung per `X-Frame-Options` oder `frame-ancestors` – der Designer muss das beim Einfügen erkennen und benennen, statt im Foyer einen leeren Rahmen zu zeigen.
- Der Block bekommt eine feste Größe auf der Bühne und darf nicht aus ihr ausbrechen; `allow-popups`, `allow-modals`, `allow-top-navigation` bleiben aus.
- Gespeichert wird der Code unverändert. Bereinigen würde funktionierende Widgets zerstören und falsche Sicherheit vortäuschen – die Sandbox ist die Grenze, nicht ein Filter.
- Im Designer läuft die Vorschau unter denselben Bedingungen wie im Player. Ein Block, der nur in der Vorschau funktioniert, ist ein Fehler.
- **Die 10.000-Zeichen-Grenze trifft diesen Block als ersten.** Ein eingebettetes Widget mit etwas CSS überschreitet sie allein. Ein HTML-Block bekommt deshalb seinen eigenen Datenwert in der Kategorie `snippets`; die Slide verweist nur darauf. Reicht auch das nicht, wird über mehrere Werte gestückelt, mit der Reihenfolge im Block. Der Designer sagt die Grenze an, bevor gespeichert wird – nicht danach.

## Funktionsumfang

### Designer – MVP

- Screen-Verwaltung: anlegen, duplizieren, umbenennen, löschen; je Screen eine Auflösung (Voreinstellung 1920×1080, quer und hoch).
- **Slides**: beliebig viele je Screen, mit eigener Anzeigedauer und Übergang, Reihenfolge per Drag-and-drop, einzeln deaktivierbar.
- **Blöcke** frei auf der Slide platzierbar:
  - *Daten aus ChurchTools*: Terminliste, Einzeltermin, Gruppen/Anmeldungen, Beiträge, Raumbelegung
  - *Medien*: Bild (hochgeladen oder aus ChurchTools), später Video
  - *Web*: eigener HTML-/CSS-/JS-Schnipsel, eingebettete fremde Seite – beide gesandboxt, siehe oben
  - *Gestaltung*: Text, Fläche und Farbverlauf, Uhr und Datum, QR-Code, Laufschrift
- **Mediathek** je Instanz: hochladen, benennen, wiederverwenden, löschen.
- Bindungen: ein Datenblock zieht seine Inhalte aus ChurchTools (Kalenderauswahl, Zeitfenster, Anzahl, Filter) oder ist statisch.
- Gestaltung: Position, Größe, Schrift, Farben, Hintergrund, Ausrichtung, Ebenen.
- Vorlagen: ein fertiger Screen lässt sich als Vorlage sichern und auf einen neuen anwenden.
- Live-Vorschau in echter Zielauflösung, herunterskaliert – unter denselben Bedingungen wie der Player.
- Player-URL erzeugen, inklusive Erklärung zum Login-Token.
- **Export und Import** eines Screens als JSON. Billig zu bauen und gleichzeitig Sicherung, Migrationspfad, Fehlerbericht-Format, Vorlagenaustausch und Quelle für Test-Fixtures. Der KV-Store liegt in ChurchTools und hat sonst keine Sicherungsgeschichte.
- **Warnung bei schlechter Lesbarkeit**: Hinweis, wenn Schriftgröße oder Kontrast für einen Bildschirm unterschreiten, der aus fünf Metern gelesen wird. Daran scheitern die meisten Foyer-Screens, nicht an der Technik.

### Player

- Ein Einstiegspunkt, gesteuert über `?screen=<id>&kiosk=1`.
- Seitenrotation nach hinterlegter Dauer, Datenaktualisierung in einem eigenen, längeren Intervall.
- **Offline-Festigkeit auf drei Ebenen**: die Daten im IndexedDB (letzter erfolgreicher Stand, mit dezenter Alterskennzeichnung), die eigenen Assets und die Bilder über einen Service Worker – sofern `/ccm/` einen zulässt (G, Punkt 5). Ohne ihn bleibt eine Lücke: Ein Pi, der während eines Netzausfalls neu startet, hat nichts zu laden. Das ist dann ausdrücklich zu benennen, nicht zu übergehen.
- **Rücksicht auf die API**: Datenaktualisierung mit Backoff, Auswertung von `429` und `Retry-After`, und ein zufälliger Versatz auf dem Intervall – sonst fragen nach einem Stromausfall alle Screens in derselben Sekunde.
- Selbstheilung: Neuanmeldung über den Login-Token, Neuladen nach wiederholten Fehlern, nächtlicher Neustart der Seite.
- Keine Bedienelemente, kein Mauszeiger, kein Scrollbalken.

### Später

- Videos, gemessen auf der echten Pi-Hardware, und Bildstrecken.
- Zeit- und regelgesteuerte Einblendungen („nur sonntags", „nur bis zum Termin").
- Mehrere Screens mit gemeinsamer Vorlage und Standortfilter.
- Wechselnde Screens je Tageszeit.

## Phasen

| Phase | Inhalt | Ergebnis |
| --- | --- | --- |
| **0 – Machbarkeit** | **Teilweise erledigt** (G1, G4). Offen: Einbettung und SPA-Fallback an `ctpassstore` ablesen, Upload-Weg für Medien klären, Login-Token unter `/ccm/` prüfen, Service Worker prüfen. Dann Boilerplate aufsetzen, leere Extension bauen, hochladen, aufrufen | Ein „Hallo <Vorname>" aus `/whoami` läuft im echten ChurchTools, und es steht fest, wohin ein hochgeladenes Bild geht. Befunde stehen in diesem Plan. |
| **1 – Datenmodell** | Screen-Schema mit Slides und Blöcken (versioniert, migrierbar), aufgeteilt nach der 10.000-Zeichen-Grenze; KV-Repository mit den Kategorien aus E; Medienreferenzen; Konflikterkennung über `revision`; Export/Import; Mock und Fixtures für die Entwicklung ohne Instanz | Screens lassen sich speichern, laden und exportieren, ohne Oberfläche. |
| **2 – Player** | Rendering der Blöcke, Slide-Rotation, Kiosk-Modus, Token-Anmeldung, Offline-Cache, gesandboxter Web-Code-Block | Ein von Hand geschriebener Screen läuft auf dem Pi am Foyer-TV. |
| **3 – Designer** | Editor, Slide-Verwaltung, Blockpalette, Inspektor, Vorschau, Vorlagen, **Mediathek mit Upload**, URL-Generator | Ein Anwender gestaltet einen Screen mit eigenen Bildern ohne Entwicklerhilfe. |
| **4 – Datenbindungen** | Alle Datenblöcke aus der Tabelle oben, Filter, Formatierungen, Fallbacks bei leeren Daten. Zuerst die **Normalisierung der Termine**: Serien, Ausnahmen, Zusatztermine, ganztägige und mehrtägige Einträge, Zeitzone `Europe/Berlin` – eine eigene Schicht mit eigenen Tests, nicht in jedem Block einzeln | Ein Screen bleibt ansehnlich, auch wenn diese Woche kein Termin ansteht. |
| **5 – Betrieb** | Fehlerprotokoll, Statusanzeige je Screen („zuletzt gesehen"), Einrichtungsdoku für FullPageOS | Ein Ausfall fällt auf, bevor ihn jemand im Foyer meldet. |
| **6 – Veröffentlichung** | Release-Workflow, GitHub-Release mit ZIP, `EXTENSION_STORE.md`, Screenshots | Andere Gemeinden können es installieren. |

Phase 2 vor Phase 3 – bewusst. Ein Designer für ein Ausgabeformat, das noch nie auf einem echten TV lief, gestaltet ins Blaue.

## Konventionen

- **Sprache**: Oberfläche und Dokumentation deutsch, Code und Bezeichner englisch. Commit-Nachrichten deutsch, ohne Umlaute im Betreff (wie in `EventManagementTool` und `kraichtal-wetter-hacs`).
- **Die API ist die Referenz.** Vor jeder Änderung an datengetriebenen Teilen gegen die OpenAPI-Spezifikation der eigenen Instanz prüfen – nicht gegen einen Feldnamen, der plausibel klingt. Diese Regel steht so in `kraichtal-wetter-hacs` und ist dort zweimal aus Schaden gelernt worden.
- **`Plan.md`** hält den Arbeitsstand, `CHANGELOG.md` die Releases (Keep a Changelog, ohne „Unreleased"-Abschnitt, Eintrag erst beim Versionssprung).
- **Versionierung**: Tag `vx.y.z` löst den Release-Workflow aus, der das ZIP baut und als Release-Asset anhängt. Version in `package.json`, `package-lock.json` und `CHANGELOG.md` gemeinsam ziehen.
- **Keine Geheimnisse im Repo**: `.env` bleibt ignoriert, der Release-Build setzt Zugangsdaten und Instanz-URL ausdrücklich zurück.
- **Persistierte Daten sind versioniert** und werden beim Lesen auf das aktuelle Schema migriert.
- **Tests laufen nie gegen die Live-Instanz.** Grundlage sind aufgezeichnete, anonymisierte API-Antworten unter `fixtures/`, gegen einen Mock gespielt. Ein Test, der eine Instanz und ein Passwort braucht, ist kein Test, sondern ein Handgriff.
- **Ein Test sichert die Sandbox.** Er verbietet `allow-same-origin` in jedem erzeugten `<iframe>`. Siehe Risiko 6.
- **CI bei jedem Push**: Lint, Typecheck, Tests, Build. Der Tag-Workflow baut nur das Release, er ersetzt die Prüfung nicht.

## Risiken

1. ~~**Custom Modules sind auf der Instanz nicht verfügbar**~~ – **entfallen am 2026-09-22.** Feature freigeschaltet, Route antwortet, ein fremdes Modul läuft bereits. Der Ausweichweg über einen eigenen Renderer-Dienst wird nicht gebraucht und ist damit vom Tisch.
2. **Kein eigener Speicherort für hochgeladene Medien.** Die Datei-API nimmt Uploads an, aber nur in feste Domain-Typen; einer für Custom Modules fehlt. Bilderupload ist ausdrücklich gewünscht und für einen Infoscreen der meistgenannte Wunsch überhaupt – er hängt damit an einem Weg, der erst gefunden werden muss (Wiki-Mediathek, `attachments`, ersatzweise externe URLs). Das Ergebnis entscheidet über den Zuschnitt des MVP und gehört deshalb in Phase 0.
3. **Login-Token in der URL.** Bekannt, praxiserprobt, aber ein Dauerpasswort auf einer SD-Karte. Minimale Rechte und ein dokumentierter Rückzugsweg sind Pflicht, kein Feinschliff.
4. **Der Pi läuft unbeaufsichtigt.** Speicherlecks über Wochen, abgelaufene Sitzungen, Netzausfälle, Stromausfälle. Der Player muss von sich aus wieder hochkommen; ein weißer Bildschirm im Foyer ist der Regelfall schlechter Signage-Software.
5. **Einbettung in die ChurchTools-Oberfläche.** Wenn sich die Host-Chrome nicht sauber ausblenden lässt, wird der Player unansehnlich. Fallbacks siehe G Punkt 2.
6. **Eigener Web-Code ist ausführbarer Fremdcode auf der ChurchTools-Domain.** Ohne Sandbox liefe er in der Sitzung eines angemeldeten Benutzers und hätte Zugriff auf dessen ChurchTools-Daten – aus einem Gestaltungsmodul würde ein Einfallstor. Die Regel aus dem Abschnitt „Eigener Web-Code" ist deshalb nicht verhandelbar und wird durch einen Test abgesichert, der `allow-same-origin` in den erzeugten Rahmen verbietet.
7. **ChurchTools ändert die Extension-Schnittstelle.** Sie ist jung und gering dokumentiert. Die Abhängigkeit auf wenige Stellen bündeln (`src/utils/kv-store.ts`, ein Repository), damit eine Änderung nicht durch die halbe Anwendung geht.
8. **Stilles gegenseitiges Überschreiben.** Der KV-Store hat keine Konfliktprüfung, ein Screen besteht aus mehreren Werten, und gespeichert wird ohne Transaktion. Ohne `revision`-Prüfung und ohne die Regel „Index zuletzt schreiben" verliert der zweite Gestalter die Arbeit des ersten, ohne dass es jemandem auffällt.

## Offene Entscheidungen

Nicht technisch offen, sondern unentschieden – und jede dieser Antworten verändert den Zuschnitt:

1. **Hardware.** Wie viele Fernseher, welche Pi-Generation, welche Auflösung und Ausrichtung, läuft FullPageOS schon? Entscheidet über Videos, Overscan und Bühnenskalierung.
2. **Zielgruppe.** Nur für uns, oder von Anfang an für den Extension Store? Verändert Mehrsprachigkeit, Konfigurierbarkeit und Aufwand erheblich.
3. **Zuschnitt des MVP.** Ist der Web-Code-Block im MVP oder später? Er ist das riskanteste Stück des Moduls. Dasselbe für Geburtstage: mit Einwilligungsdialog hinein, oder für v1 ganz heraus?
4. **Wer gestaltet?** Nur wir, oder auch nicht-technische Ehrenamtliche? Verschiebt die Anforderungen an den Designer deutlich.
5. **Rückfallposition bei den Medien.** Wenn der Wiki-Weg scheitert: Ist „nur externe URLs" ein tragfähiger MVP, oder ist der Upload ein Muss?
6. **Zeitbudget.** Der Plan nennt sieben Phasen und keine einzige Aufwandsschätzung. Für ein Feierabendprojekt entscheidet genau das über den Zuschnitt.
7. **Editor-Umfang.** Rasterfang, Mehrfachauswahl, Kopieren zwischen Slides, Tastaturkürzel, Undo/Redo. Undo/Redo ist architekturrelevant und muss vor Phase 1 entschieden sein, der Rest nicht.


## Nächste Schritte

**Erledigt am 2026-09-22:** Version und Build der Instanz (3.136.2 / 32882), `feature_custommodule`, Antwort von `/api/custommodules`, KV-Grenzen aus der Spezifikation.

1. `https://<instanz>/ccm/ctpassstore/` aufrufen und ansehen: Navigation drumherum? iframe? Wird `window.settings.base_url` injiziert? Woher kommen die Assets? Beantwortet G Punkt 1 in fünf Minuten, ohne etwas zu bauen.
2. Einen erfundenen Unterpfad aufrufen (`/ccm/ctpassstore/irgendwas`) – Modulseite oder 404? Beantwortet G Punkt 2 und damit, ob der Player eine echte Route bekommt oder bei der Hash-Route bleibt.
3. Klären, wer `ctpassstore` installiert hat. Wenn es aus dem eigenen Haus kommt, kennt diese Person den gesamten Weg von Boilerplate bis Upload bereits – die billigste Informationsquelle im ganzen Projekt.
4. Support anschreiben: Instanz für die Entwicklung einer Extension (siehe „Entwicklungs- und Testumgebung", Stufe 2).
5. Boilerplate klonen, `.env` anlegen, Vite-Proxy einrichten statt CORS zu öffnen, `npm run dev` bis zum „Hallo <Vorname>".
6. Ein Bild über `POST /files/wiki_<kategorie>/<id>` hochladen, wieder auslesen und anzeigen – der Test, der über den Bilderupload entscheidet.
7. Testweise einen Infoscreen-Benutzer anlegen, Login-Token ziehen, die URL am Pi aufrufen; dabei den Rückzugsweg einmal üben.
8. Befunde hier eintragen, erst danach das Screen-Schema festlegen.


## Quellen

- ChurchTools Extension Boilerplate: <https://github.com/churchtools/extension-boilerplate> (README, `vite.config.ts`, `scripts/package.js`, `key-value-store.md`, `src/utils/kv-store.ts`)
- ChurchTools JS-Client: <https://github.com/churchtools/churchtools-js-client>
- Referenz-Extension eines Dritten: <https://github.com/aschojz/churchtools-extension-publisher> (README, `EXTENSION_STORE.md`)
- OpenAPI der Demo-Instanz: `https://demo.church.tools/system/runtime/swagger/openapi.json` (3.136.2, Build 32882, 497 Pfade, abgerufen 2026-09-22)
- Infoscreen am Raspberry Pi mit FullPageOS: <https://forum.church.tools/topic/10280>
- Infoscreen mit eigenen Inhalten (Wünsche der Anwender): <https://forum.church.tools/topic/6252>
- Login-Token für den Infoscreen-Benutzer: <https://forum.church.tools/topic/11910>
- CORS in ChurchTools: <https://churchtools.academy/help/system-einstellungen/api/0-cors/>

- Kein offizielles Testsystem, Datenbank-Kopie kostenpflichtig: <https://forum.church.tools/topic/6264/testsystem>
- 30-Tage-Testinstanz: <https://church.tools/de/test-churchtools/> · Support: <support@churchtools.de>
- Eigene Instanz, Phase-0-Befunde vom 2026-09-22: `GET /api/info`, `GET /api/config`, `GET /api/custommodules` (angemeldet), sowie die `CustomModule*`-Schemas aus `openapi.json` der Instanz