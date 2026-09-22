# ChurchTools Infoscreen Designer – Projektplan

Ein ChurchTools Custom Module (CCM), mit dem angemeldete ChurchTools-Anwender Infoscreens gestalten. Das Ergebnis ist eine Webseite, die ein Raspberry Pi im Kioskmodus aufruft und auf den Foyer-TVs anzeigt.

## Rahmendaten

- **Stand**: 2026-09-22, Phase 0 (Machbarkeit) noch nicht begonnen. Es existiert nur dieser Plan.
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

## Voraussetzungen für die ChurchTools-Integration

Das ist der Teil, der vor der ersten Zeile Code steht. Belegt ist alles unter A–F; was noch offen ist, steht gesammelt unter G.

### A. Auf Seiten der ChurchTools-Instanz

| Voraussetzung | Details |
| --- | --- |
| **Custom Modules verfügbar** | Die Extension-Schnittstelle (`/api/custommodules`) muss die Instanz mitbringen. Auf `demo.church.tools` (Version **3.136.2**, Build 32882, Stand 2026-09-22) antwortet `/api/custommodules` mit **404**, während `/api/whoami` 200 liefert – die Route existiert dort also nicht. Die Mindestversion ist damit **> 3.136.2 oder an ein Feature-Flag/Tarif gebunden**. Erste Aufgabe in Phase 0: gegen die eigene Instanz prüfen und, falls 404, im ChurchTools-Forum bzw. beim Support klären. |
| **Administrationsrecht** | Zum Hochladen/Anlegen des Custom Modules und zum Erzeugen eines Login-Tokens für einen anderen Benutzer braucht es Adminrechte. |
| **CORS-Freigabe (nur Entwicklung)** | System-Einstellungen → Integrationen → API → Cross-Origin Resource Sharing, Eintrag für `http://localhost:5173`. Im Produktivbetrieb liegt die Extension auf derselben Domain, dann entfällt das. |
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

Geplante Kategorien: `screens` (je ein Wert pro Screen-Dokument), `templates` (wiederverwendbare Layouts), `settings` (globale Voreinstellungen). In der Entwicklung legt `getOrCreateModule()` das Modul selbst an, im Produktivbetrieb entsteht es bei der Installation.

Die offizielle Empfehlung lautet ausdrücklich, Werte klein zu halten und große Objekte aufzuteilen. Ein Screen-Dokument mit vielen Seiten kann diese Grenze reißen – deshalb Phase 1 mit einer echten Messung beginnen (siehe G).

### F. Rechte, Datenschutz, Betrieb

- Berechtigungen sind **pro Route** des Custom Modules möglich. Trennung von Anfang an: Screens gestalten dürfen wenige, Screens ansehen darf der Player-Benutzer.
- Der Designer liest nur, was der angemeldete Anwender sehen darf. Was er in einen Screen legt, sieht aber später **jeder im Foyer**. Diese Schere ist die eigentliche Datenschutzfrage dieses Moduls, nicht die API.
- **Geburtstage** sind der offensichtliche Fall: `GET /persons/birthdays` liefert sie bequem, auf einem öffentlichen TV sind sie personenbezogene Daten ohne Einwilligung. Der Block kommt deshalb nur mit ausdrücklicher Bestätigung und einem Hinweis in die Oberfläche – oder zunächst gar nicht.
- Dasselbe gilt abgeschwächt für Dienstpläne mit Namen und für Gruppenkontakte.

### G. Noch zu verifizieren (Phase 0)

Diese Punkte entscheiden über die Machbarkeit und sind **nicht** belegt. Sie werden gegen die eigene Instanz geprüft, nicht gegen die Demo und nicht gegen eine Vermutung – dieselbe Regel wie in `kraichtal-wetter-hacs`.

1. **Gibt es `/api/custommodules` auf unserer Instanz?** Auf der Demo (3.136.2) nicht. Ohne diese Route trägt die gesamte Architektur nicht.
2. **Wird die Extension in die ChurchTools-Oberfläche eingebettet?** Vieles spricht dafür: Das Boilerplate lädt sein `reset.css` nur in der Entwicklung, „um die CT-Umgebung zu simulieren", und liest `window.settings.base_url` aus einer von ChurchTools eingefügten Variablen. Für den Player bedeutet eine sichtbare Navigation ein Problem. Fallbacks in dieser Reihenfolge: (a) Kiosk-Modus als `position: fixed; inset: 0` über den gesamten Viewport, (b) gezieltes Ausblenden der Hostseiten-Chrome per CSS, (c) Player als eigene, minimale HTML-Datei im Paket.
3. **Werden Unterpfade unter `/ccm/<key>/` ausgeliefert** oder nur `index.html`? Bis das geklärt ist, ist der Player kein eigener Einstiegspunkt, sondern eine Route über Query-Parameter auf derselben `index.html`.
4. **Wie groß darf ein Datenwert im KV-Store sein?** Undokumentiert. Messen, bevor das Screen-Schema festgelegt wird.
5. **Wohin gehen hochgeladene Bilder und Videos?** Siehe eigenen Abschnitt „Medien und eigener Web-Code" – die Frage ist zu groß für eine Zeile und entscheidet über den Zuschnitt des MVP.
6. **Wie verhält sich `login_token` in der URL bei einem Custom Module?** Beim nativen Infoscreen ist der Weg erprobt, für `/ccm/`-Pfade ungeprüft.
7. **Extension Store**: Aufnahmekriterien, Einreichungsweg, ob eine Veröffentlichung überhaupt angestrebt wird. Der Publisher hält seinen Store-Text in einer eigenen `EXTENSION_STORE.md` – ein Muster, das sich übernehmen lässt.

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
4. **Data-URI im KV-Store** – nur für Kleinstgrafiken. Die offizielle Empfehlung lautet ausdrücklich, Werte klein zu halten; ein Full-HD-JPEG gehört dort nicht hinein. Für Videos scheidet der Weg vollständig aus.
5. **Externe URL** als Notausgang: Der Anwender hinterlegt eine Adresse, wir speichern nur den Link. Kostet nichts, verlagert aber das Problem auf den Anwender und bricht, sobald die Quelle verschwindet.

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

### Player

- Ein Einstiegspunkt, gesteuert über `?screen=<id>&kiosk=1`.
- Seitenrotation nach hinterlegter Dauer, Datenaktualisierung in einem eigenen, längeren Intervall.
- **Offline-Festigkeit**: letzter erfolgreicher Datenstand in IndexedDB; bei Netzausfall weiterlaufen statt weiß werden, mit dezenter Alterskennzeichnung.
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
| **0 – Machbarkeit** | Punkte 1–7 aus G gegen die eigene Instanz prüfen, **Upload-Weg für Medien klären**, Boilerplate aufsetzen, leere Extension bauen, hochladen, aufrufen | Ein „Hallo <Vorname>" aus `/whoami` läuft im echten ChurchTools, und es steht fest, wohin ein hochgeladenes Bild geht. Befunde stehen in diesem Plan. |
| **1 – Datenmodell** | Screen-Schema mit Slides und Blöcken (versioniert, migrierbar), KV-Repository mit Kategorien `screens`/`templates`/`settings`, Medienreferenzen, Größenmessung | Screens lassen sich speichern und laden, ohne Oberfläche. |
| **2 – Player** | Rendering der Blöcke, Slide-Rotation, Kiosk-Modus, Token-Anmeldung, Offline-Cache, gesandboxter Web-Code-Block | Ein von Hand geschriebener Screen läuft auf dem Pi am Foyer-TV. |
| **3 – Designer** | Editor, Slide-Verwaltung, Blockpalette, Inspektor, Vorschau, Vorlagen, **Mediathek mit Upload**, URL-Generator | Ein Anwender gestaltet einen Screen mit eigenen Bildern ohne Entwicklerhilfe. |
| **4 – Datenbindungen** | Alle Datenblöcke aus der Tabelle oben, Filter, Formatierungen, Fallbacks bei leeren Daten | Ein Screen bleibt ansehnlich, auch wenn diese Woche kein Termin ansteht. |
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

## Risiken

1. **Custom Modules sind auf der Instanz nicht verfügbar** – trägt die Architektur nicht. Prüfen, bevor irgendetwas gebaut wird. Ausweichweg wäre ein eigener kleiner Renderer-Dienst mit API-Key, mit allen genannten Nachteilen.
2. **Kein eigener Speicherort für hochgeladene Medien.** Die Datei-API nimmt Uploads an, aber nur in feste Domain-Typen; einer für Custom Modules fehlt. Bilderupload ist ausdrücklich gewünscht und für einen Infoscreen der meistgenannte Wunsch überhaupt – er hängt damit an einem Weg, der erst gefunden werden muss (Wiki-Mediathek, `attachments`, ersatzweise externe URLs). Das Ergebnis entscheidet über den Zuschnitt des MVP und gehört deshalb in Phase 0.
3. **Login-Token in der URL.** Bekannt, praxiserprobt, aber ein Dauerpasswort auf einer SD-Karte. Minimale Rechte und ein dokumentierter Rückzugsweg sind Pflicht, kein Feinschliff.
4. **Der Pi läuft unbeaufsichtigt.** Speicherlecks über Wochen, abgelaufene Sitzungen, Netzausfälle, Stromausfälle. Der Player muss von sich aus wieder hochkommen; ein weißer Bildschirm im Foyer ist der Regelfall schlechter Signage-Software.
5. **Einbettung in die ChurchTools-Oberfläche.** Wenn sich die Host-Chrome nicht sauber ausblenden lässt, wird der Player unansehnlich. Fallbacks siehe G Punkt 2.
6. **Eigener Web-Code ist ausführbarer Fremdcode auf der ChurchTools-Domain.** Ohne Sandbox liefe er in der Sitzung eines angemeldeten Benutzers und hätte Zugriff auf dessen ChurchTools-Daten – aus einem Gestaltungsmodul würde ein Einfallstor. Die Regel aus dem Abschnitt „Eigener Web-Code" ist deshalb nicht verhandelbar und wird durch einen Test abgesichert, der `allow-same-origin` in den erzeugten Rahmen verbietet.
7. **ChurchTools ändert die Extension-Schnittstelle.** Sie ist jung und gering dokumentiert. Die Abhängigkeit auf wenige Stellen bündeln (`src/utils/kv-store.ts`, ein Repository), damit eine Änderung nicht durch die halbe Anwendung geht.

## Nächste Schritte

1. Gegen die eigene Instanz prüfen: Version aus `/api/info`, Antwort auf `/api/custommodules`, Vorhandensein des Menüpunkts Admin → Extensions.
2. Boilerplate klonen, `.env` anlegen, CORS für `localhost:5173` freigeben, `npm run dev` bis zum „Hallo <Vorname>".
3. Leeres Paket bauen, hochladen, unter `/ccm/infoscreen-cgks/` aufrufen – und dabei die Punkte 2, 3 und 6 aus G beantworten.
4. Ein Bild über `POST /files/wiki_<kategorie>/<id>` hochladen, wieder auslesen und im Browser anzeigen – der Test, der über den Bilderupload entscheidet.
5. Testweise einen Infoscreen-Benutzer anlegen, Login-Token ziehen, die URL am Pi aufrufen.
6. Befunde hier eintragen, erst danach das Screen-Schema festlegen.

## Quellen

- ChurchTools Extension Boilerplate: <https://github.com/churchtools/extension-boilerplate> (README, `vite.config.ts`, `scripts/package.js`, `key-value-store.md`, `src/utils/kv-store.ts`)
- ChurchTools JS-Client: <https://github.com/churchtools/churchtools-js-client>
- Referenz-Extension eines Dritten: <https://github.com/aschojz/churchtools-extension-publisher> (README, `EXTENSION_STORE.md`)
- OpenAPI der Demo-Instanz: `https://demo.church.tools/system/runtime/swagger/openapi.json` (3.136.2, Build 32882, 497 Pfade, abgerufen 2026-09-22)
- Infoscreen am Raspberry Pi mit FullPageOS: <https://forum.church.tools/topic/10280>
- Infoscreen mit eigenen Inhalten (Wünsche der Anwender): <https://forum.church.tools/topic/6252>
- Login-Token für den Infoscreen-Benutzer: <https://forum.church.tools/topic/11910>
- CORS in ChurchTools: <https://churchtools.academy/help/system-einstellungen/api/0-cors/>
