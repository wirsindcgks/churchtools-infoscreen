# ChurchTools Infoscreen Designer – Projektplan

Ein ChurchTools Custom Module (CCM), mit dem angemeldete ChurchTools-Anwender Infoscreens gestalten. Das Ergebnis ist eine Webseite, die ein Raspberry Pi im Kioskmodus aufruft und auf den Foyer-TVs anzeigt.

## Rahmendaten

- **Stand**: 2026-09-22, Phase 0 läuft. Die Kernfrage ist beantwortet: Custom Modules sind auf unserer Instanz verfügbar, die Architektur dieses Plans trägt. Hinzu kommt die Lektüre des Quellcodes von `ct-pass-store` – des Moduls, das auf unserer Instanz bereits läuft –, die Struktur und Grenzen des Speichers, das Rechtemodell und den Installationsweg belegt. Am selben Tag kamen drei Befunde dazu: Der Quelltext von `/ccm/ctpassstore/` beantwortet die Einbettungsfrage (G6, kein iframe) und bestätigt das Rechteobjekt (G4), ein erfundener Unterpfad den SPA-Fallback (G7, echte Routen tragen), und im Nachbarprojekt `churchtools-plugin` sind die Adressen gemessen, unter denen ChurchTools Bilder ausliefert (G14). Code existiert noch nicht. Einzelheiten im Phase-0-Protokoll (Abschnitt G).
- **Testinstanz**: `https://test-cg-ks.church.tools` (leer, Build 32882 wie produktiv) – **30 Tage Lizenz, bis etwa 2026-10-22**, Verlängerung ungeklärt. Sie taktet Phase 0: zuerst messen, was nur eine Instanz beantwortet. Siehe „Entwicklungs- und Testumgebung".
- **Autor / Repo**: `wirsindcgks <media@cg-ks.de>`, geplant unter `github.com/wirsindcgks/churchtools-infoscreen`
- **Lizenz**: GPL-2.0-or-later (wie `churchtools-plugin`)
- **Arbeitsname Produkt**: ChurchTools Infoscreen Designer
- **Extension-Key (Vorschlag)**: `infoscreen-cgks` → Auslieferungspfad `/ccm/infoscreen-cgks/`
- **Stack (Vorschlag)**: Vue 3 + TypeScript + Vite + Pinia, `@churchtools/churchtools-client`, Vitest, Playwright. Damit identisch zu dem, was ChurchTools selbst im Boilerplate vorgibt und was die bekannten produktiven Fremd-Extensions einsetzen: `aschojz/churchtools-extension-publisher`, `lub90/ct-pass-store` (Vue 3, Vite 7, Vuetify) und `bensteUEM/ct-events-load`.
- **Dokumente**: `Plan.md` ist das ausführliche Arbeits- und Kontextdokument (wie in `churchtools-plugin`), [`Preparation.md`](Preparation.md) die abzuhakende Vorbereitungsliste für Phase 0, `CHANGELOG.md` die knappe versionierte Historie, `AGENTS.md` die Repo-Konventionen für Agenten.

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

**Designer und Player teilen sich den Code.** Ein Screen ist eine Sammlung von JSON-Dokumenten – Screen, Playlists, Slides mit ihren Blöcken und Bindungen (siehe „Playlists und Zeitpläne“ und Abschnitt E; ein einzelner Datenwert fasst nur 10.000 Zeichen). Der Designer schreibt es, der Player liest es und rendert dieselben Blockkomponenten ohne Bedienelemente. Damit ist die Vorschau im Designer definitionsgemäß das, was auf dem TV steht.

**DOM statt Canvas.** Der Publisher rendert mit Konva, weil er PNG/JPEG exportieren muss. Ein Infoscreen exportiert nichts, er läuft – und braucht dafür Videos, Web-Fonts, Laufschrift und weiche Übergänge. Das ist mit absolut positionierten DOM-Blöcken auf einer per `transform: scale()` skalierten 1920×1080-Bühne einfacher und robuster als mit einem Szenengraphen.

**Die Bühne ist 1920×1080, der Fernseher ist es nicht immer.** `transform: scale()` setzt ein passendes Seitenverhältnis voraus. Im Foyer stehen aber 4K-Geräte, hochkant gedrehte Bildschirme, gelegentlich ein Beamer mit krummer Auflösung – und fast alle haben Overscan. Die Regel deshalb ausformuliert: Die Bühne hat feste Pixelmaße, alles darauf wird in Pixeln positioniert, und ein einziger Skalierungsfaktor (`--stage-scale`) bildet sie auf den Viewport ab. Passt das Seitenverhältnis nicht, wird **eingepasst statt beschnitten** (Letterbox); je Screen gibt es zusätzlich eine Overscan-Korrektur in Prozent. Das kostet jetzt einen Absatz und später keine zwei Wochen.

**Die Bühne braucht eine Mauer nach außen – und zwar in beide Richtungen.** Nach G6 läuft eine Extension im Dokument der Hostseite, nicht in einem iframe: Das ist jetzt belegt, nicht vermutet. ChurchTools' Stile gelten also für unsere Blöcke, und unsere Stile gelten für ChurchTools – die zweite Richtung ist die unangenehmere, weil sie fremde Oberflächen beschädigt, die niemand mit uns in Verbindung bringt. Alle eigenen Regeln gehören deshalb unter eine Wurzelklasse, keine nackten Elementselektoren. Zur Gegenrichtung hilft ein Detail aus dem Quelltext: Die Hostseite deklariert `@layer theme, base, oldcss, components, utilities` – ungeschichtetes CSS schlägt geschichtetes, unsere Bühne gewinnt also ohne `!important`. Eine Bühne, deren Aussehen von einem Update der Hostseite abhängt, ist als Gestaltungswerkzeug wertlos. Die Stage bekommt deshalb eine eigene Stilgrenze: alle Blockstile als Custom Properties auf einem Wurzelelement, `all: initial` an der Bühnenkante, und keine Abhängigkeit von geerbten Schriftgrößen oder Farben. Das ist billig, solange es von Anfang an steht.

**Der Player verträgt kein Code-Splitting.** Wird eine neue Version der Extension hochgeladen, ändern sich die Asset-Namen im `dist/`. Ein Kiosk-Tab, der seit Wochen offen ist und dann einen nachzuladenden Chunk anfordert, bekommt einen 404 – weißer Bildschirm im Foyer, ausgelöst durch ein Update, das jemand vormittags gemacht hat. Der Player wird deshalb als **ein Bündel** gebaut, ohne verzögert geladene Routen, und fängt zusätzlich Ladefehler von Modulen ab, um sich neu zu laden statt stehenzubleiben. Für den Designer gilt das nicht; er wird von einem Menschen benutzt, der ein Neuladen versteht.

**Schriften kommen aus dem Paket.** Web-Fonts sind einer der Gründe für DOM statt Canvas – dann muss aber auch feststehen, woher sie kommen. Nicht von Google Fonts: Das lädt personenbezogene Daten von einem Gerät im Gemeindefoyer zu einem Dritten und fällt bei Netzausfall aus. Stattdessen ein fester, mitgelieferter, selbst gehosteter Satz freier Schriften mit geprüfter Lizenz; die Schriftauswahl im Designer ist eine geschlossene Liste, kein Textfeld für eine URL.

## Voraussetzungen für die ChurchTools-Integration

Das ist der Teil, der vor der ersten Zeile Code steht. Belegt ist alles unter A–F; was noch offen ist, steht gesammelt unter G.

### A. Auf Seiten der ChurchTools-Instanz

| Voraussetzung | Details |
| --- | --- |
| **Custom Modules verfügbar** | **Erledigt am 2026-09-22.** `feature_custommodule` steht auf `"1"`, `GET /api/custommodules` antwortet mit 200. Siehe G. |
| **Administrationsrecht** | Zum Hochladen und Anlegen des Custom Modules. **Nicht** zum direkten Erzeugen eines fremden Login-Tokens – den gibt die API auch Administratoren nicht heraus (G18); der Weg führt über das Setzen des Passworts und `POST /api/login/token`. |
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
- **Referenz auf der eigenen Instanz, mit offenem Quellcode**: Unter `/ccm/ctpassstore/` läuft bereits ein fremdes Custom Module („Sekundär-Passwort"). Es ist keine Hausentwicklung, sondern das öffentliche MIT-Projekt <https://github.com/lub90/ct-pass-store> von Lukas Block (im Forum `lubl`). Damit ist es die wertvollste Quelle des Projekts: ein produktiv laufendes Modul, dessen Code, Rechtedokumentation und Installationsanleitung sich lesen lassen. Es enthält eine wiederverwendbare `ct-utils`-Schicht (`ExtensionData.ts`, `Permissions.ts`) und einen generierten Typ-Snapshot `ct-types.d.ts` (Stand 2025-09-02). MIT ist mit GPL-2.0-or-later verträglich; eine Übernahme von `ct-utils` unter Beibehaltung des Urheberrechtsvermerks ist zulässig.
- **Weitere Referenz für Termindaten**: `bensteUEM/ct-events-load` mit `src/persistance.ts` – eine Extension, die Termine lädt und ablegt. Die naheliegendste Vorlage für Phase 4, vor der ersten eigenen Zeile Bindungscode anzusehen.
- **Node-Version**: Der Publisher nennt 24.15.0+, `ct-pass-store` entwickelt in einem Node-22-Devcontainer mit Vite 7. Eine aktuelle LTS genügt; die Angabe des Publishers ist keine harte Grenze.
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
   https://<instanz>.church.tools/ccm/infoscreen-cgks/player?screen=foyer-links&login_token=<TOKEN>&user_id=<ID>&no_url_rewrite=true
   ```
   Der Pfad `/player` statt eines Parameters am Wurzelpfad ist seit G7 gedeckt: ChurchTools liefert für unbekannte Unterpfade die Modulseite aus, ein nächtliches Neuladen auf dieser Adresse fällt also nicht ins Leere. Der Screen wird über seinen **Slug** benannt, nicht über die `id` – siehe Abschnitt E.
   Der Token wird über `GET /api/persons/<id>/logintoken` geholt (legt ihn bei Bedarf an; an 2FA-Konten wird keiner ausgegeben). **Adminrecht braucht nur, wer den Token einer fremden Person zieht** – `ct-pass-store` ruft denselben Endpunkt aus der Extension heraus für die eigene Benutzer-ID auf, ohne besondere Rechte. Für den URL-Generator im Designer heißt das: Wer sich als Infoscreen-Benutzer anmeldet, kann sich seinen Token selbst holen; für den bequemen Weg über ein Adminkonto bleibt es beim Adminrecht. Alternativ liefert `POST /api/login/token` mit Benutzername und Passwort `{personId, token}`, ohne eine Sitzung zu eröffnen. Gegen die API lässt sich ein solcher Token auch als Kopfzeile einsetzen – `Authorization: Login <token>`, so macht es das PHP-Backend von `ct-pass-store`. Für den Pi hilft das nicht (er ruft eine URL auf und kann keine Kopfzeilen setzen), wohl aber für Werkzeuge und Testskripte, die ohne Sitzung arbeiten sollen. Der `churchtools-client` nutzt den Token außerdem, um nach Sitzungsablauf selbsttätig neu anzumelden – für ein Gerät, das monatelang durchläuft, ist genau das der entscheidende Punkt.

   **Der Token ist ein Dauerpasswort.** Er steht in der URL, im Browserverlauf des Pi und in der `fullpageos.txt` auf der SD-Karte. Konsequenz für den Plan: eigener Benutzer mit minimalen Rechten, ein dokumentierter Weg zum Zurückziehen, und im Designer ein Dialog, der die fertige URL erzeugt und dabei erklärt, was sie enthält.

   **Der Weg zum Zurückziehen ist der Passwortwechsel, nicht der Token-Endpunkt** *(2026-09-23 gemessen, **G18**)*. Die frühere Annahme, ein Administrator rufe `DELETE /api/persons/{id}/logintoken` auf, ist widerlegt – der Endpunkt antwortet für fremde Personen mit 403, und die Oberfläche gibt den Token ebenso wenig heraus. Der Grund ist einleuchtend: Der Token wird aus den Zugangsdaten abgeleitet (`POST /api/login/token`), gehört also der Person und nicht der Verwaltung.

   Die Notbremse ist damit **das Passwort des Geräte-Benutzers zu ändern**; ein bestehender Token ist danach sofort ungültig (401, gemessen). **Das geschieht in der ChurchTools-Oberfläche, nicht über die API** – `PUT /persons/{id}/password` verlangt das alte Passwort und taugt nicht als Admin-Reset. Die Einrichtungsdoku beschreibt hier also Klickwege: Passwort in der Oberfläche setzen, Token über `POST /api/login/token` erzeugen, im Notfall das Passwort in der Oberfläche ändern.

### E. Datenspeicherung

Eigene Daten liegen im Key-Value-Store des Custom Modules – hierarchisch Modul → Datenkategorie → Datenwert, wobei jeder Wert ein JSON-String ist:

```
GET    /custommodules                                   alle Module
GET    /custommodules/{extensionkey|moduleId}           eigenes Modul
GET…DELETE /custommodules/{moduleId}/customdatacategories[/{id}]
GET…DELETE /custommodules/{moduleId}/customdatacategories/{id}/customdatavalues[/{id}]
```

**Ein Datenwert hat keinen Namen.** Das ist die einschneidendste Eigenschaft dieses Speichers, und sie steht in der generierten Typdatei:

```ts
export type CustomModuleDataValueCreate = {
    dataCategoryId: number;   // Pflicht
    value: string;            // Pflicht, max. 10.000 Zeichen
};
```

Kein Schlüssel, kein Name, kein `updatedAt`, keine Version – nur eine serverseitig vergebene `id` und der JSON-String. Beide Implementierungen in `ct-pass-store` (TypeScript und PHP) holen deshalb **alle** Werte einer Kategorie und filtern im Client; eine Filter- oder Paginierungsmöglichkeit nutzt keine von beiden. Drei Folgen für das Datenmodell:

1. **Adressiert wird über die `id`**, und die kennt nur, wer zuvor den Index gelesen hat. Jeder Zugriff auf eine Slide ist damit zweistufig.
2. **`GET …/customdatavalues` ist eine Volltabelle.** Bei zehn Screens zu je acht Slides zieht der Player achtzig Werte, um acht zu brauchen. Für den Anfang tragbar – aber es ist der Grund, Slides nicht noch feiner zu zerlegen, und der Grund, die Blöcke einer Slide in deren Wert zu lassen statt sie einzeln abzulegen.
3. **Es gibt keinen Schlüssel am Wert.** Der frühere Kandidat – `domainType`/`domainId`, von `ct-pass-store` uneinheitlich benutzt – **existiert auf Build 32882 nicht** (G11, an der Spezifikation unserer eigenen Instanz gemessen). Der Snapshot, aus dem die Felder stammten, ist vom 2025-09-02 und überholt. Punkt 2 bleibt damit bestehen: Volltabelle lesen, im Client filtern. Das ist keine Zwischenlösung mehr, sondern der Zuschnitt.

**Der Slug ist die Adresse, nicht die `id`.** Weil die `id` vom Server kommt, zeigt eine Player-URL mit `?screen=7` auf einen Datenbankschlüssel. Wird ein Screen gelöscht und neu angelegt – der normale Weg, wenn etwas gründlich schiefging –, zeigt die SD-Karte im Foyer ins Leere, und niemand verbindet die Ursache mit der Wirkung. Deshalb bekommt jeder Screen einen vom Gestalter vergebenen, stabilen Slug (`foyer-links`), die URL nennt den Slug, und der Index bildet Slug → `id` ab. Der Designer wacht über die Eindeutigkeit.

**Kategorien tragen ein JSON Schema.** `CustomModuleDataCategoryCreate` hat neben `name`, `shorty` und `description` die Felder `schema` und `securityLevelId`; `ct-pass-store` hinterlegt dort echte JSON-Schema-Dokumente je Kategorie. Trifft die 2.000-Zeichen-Grenze dieses Feld, passt ein Schema, das eine Slide mit allen Blocktypen beschreibt, dort **nicht** hinein. Vorgabe bis zur Klärung (G12): **ein bewusst permissives Schema in ChurchTools, die eigentliche Validierung im Client.** Der Speicher prüft die Form, nicht den Inhalt – und das Schema im Repo ist die Wahrheit, nicht das in der Instanz.

**Die Grenzen sind dokumentiert, nicht zu messen.** Aus der OpenAPI-Spezifikation (3.136.2):

| Feld | Grenze |
| --- | --- |
| `CustomModuleDataValue.value` | **10.000 Zeichen** |
| `CustomModuleDataCategory.data` | 2.000 Zeichen |
| `CustomModule.shorty` (Extension-Key) | 50 Zeichen |
| `CustomModule.description` | 300 Zeichen |

10.000 Zeichen sind eng. Ein Screen mit mehreren Slides passt nicht in einen Wert, und Bilddaten passen dort unter keinen Umständen hinein – 10.000 Zeichen sind rund sieben Kilobyte.

**Zuschnitt, der daraus folgt.** Ein Screen ist keine Ablage, sondern eine Sammlung von Werten:

- `screens` – je Screen **ein Index-Wert**: Slug, Name, Auflösung, Schema-Version, Revision, `updatedAt`, `updatedBy`, die **Standard-Playlist** und der **Zeitplan**. Klein und stabil. Der Screen führt seit dem 2026-09-23 **keine Slide-Liste mehr** – die steht in der Playlist.
- `playlists` – je Playlist **ein Wert**: Name, Slug und die Reihenfolge der Slide-IDs. Siehe „Playlists und Zeitpläne".
- `slides` – je Slide **ein Wert** mit ihren Blöcken. Ein bis vier Kilobyte sind realistisch; für eine gut gefüllte Slide reicht das Limit, für einen ganzen Screen nicht. **Eine Slide gehört keiner Playlist**, sie wird von Playlists über ihre ID referenziert und darf in mehreren vorkommen.
- `snippets` – eigener Wert je HTML-Block, siehe „Eigener Web-Code".
- `media` – Verweise auf ChurchTools-Dateien, nie die Dateien selbst.
- `templates`, `settings` – wie geplant.
- `status` – Lebenszeichen der Player, eigene Kategorie mit eigenem Schreibrecht (siehe F).

**Speichern ist damit ein Mehrfach-Schreibvorgang ohne Transaktion.** Der Index-Wert wird deshalb **zuletzt** geschrieben: Solange er auf den alten Stand zeigt, ist ein halb geschriebener Screen unsichtbar statt kaputt. Verwaiste Slide-Werte räumt ein Aufräumlauf weg.

**Gleichzeitiges Bearbeiten bleibt ungelöst – und das ist jetzt belegt, nicht vermutet.** Am Datenwert gibt es kein `updatedAt`, keine Version und kein ETag; `PUT` nimmt die vollständige Nutzlast und überschreibt. Optimistisches Sperren auf API-Ebene ist damit unmöglich. Es bleibt das Mindestmaß: `revision` und `updatedAt` **im JSON**, Lesen vor dem Schreiben, Vergleich der gelesenen Revision, und ein Dialog statt eines stillen Überschreibens. Das erkennt den Konflikt, es verhindert ihn nicht – zwischen Lesen und Schreiben bleibt ein Fenster. Für eine Handvoll Gestalter ist das angemessen; als gelöst gilt es nicht.

**Die Auflösung ist Teil des Schemas, nicht eine Einstellung daneben.** Alle Blöcke sind in Pixeln der Bühne positioniert. Wer einen fertigen 1920×1080-Screen auf hochkant umstellt, erzeugt ohne Regel einen Haufen Blöcke außerhalb der Bühne. Festlegung: Ein Wechsel der Auflösung ist eine ausdrückliche Umrechnung mit Vorschau und Rückgängig-Möglichkeit, kein stilles Umschalten eines Feldes – und im Zweifel legt der Designer eine Kopie an, statt das Original zu verändern.

**Der Player kann älter sein als die Daten.** Die Konvention „beim Lesen migrieren" deckt alte Daten mit neuem Code. Der Regelfall hier ist der umgekehrte: Ein Pi läuft seit sechs Wochen mit dem Code von damals und bekommt einen Screen mit einem Blocktyp, den er nicht kennt. Deshalb gilt für den Player: **Ein unbekannter Blocktyp wird übersprungen, ein unbekanntes Feld ignoriert, eine höhere Schema-Hauptversion führt zu einem Neuladen der Seite** – nie zu einer leeren Slide und nie zu einem Absturz. Das gehört als Test in Phase 1, nicht als Vorsatz in Phase 5.

In der Entwicklung legt `getOrCreateModule()` das Modul selbst an, im Produktivbetrieb entsteht es bei der Installation. Die **Kategorien legt die Extension selbst an**: `ct-pass-store` führt beim ersten Aufruf einen Setup-Assistenten aus, der Kategorien samt Schema erzeugt, sofern der angemeldete Anwender `create custom category` hat. Dieser Weg ist erprobt und wird übernommen – er erspart eine Installationsanleitung mit acht manuellen Schritten.

### F. Rechte, Datenschutz, Betrieb

- **Das Rechtemodell steht fest und ist im laufenden Betrieb bestätigt.** Gelesen wird es über `GET /permissions/global`; die Antwort trägt unter `data[<extensionkey>]` das Rechteobjekt des eigenen Moduls. Der vollständige Typ:

  ```ts
  export type CustomModulePermission = {
      view: boolean;
      'create custom category': boolean;
      'view custom category':   Array<number>;
      'edit custom category':   Array<number>;
      'delete custom category': Array<number>;
      'create custom data':     Array<number>;
      'view custom data':       Array<number>;
      'edit custom data':       Array<number>;
      'delete custom data':     Array<number>;
  };
  ```

  **Gegen die eigene Instanz geprüft** (2026-09-22, G4): Die Antwort trägt alle neun Schlüssel, fehlende Rechte als `[]` bzw. `false`. Die Datenrechte sind **Listen von Kategorie-IDs**, `view` und `create custom category` sind modulweite Schalter. Genau der Zuschnitt, den dieses Modul braucht:

  | Rolle | Rechte am Custom Module |
  | --- | --- |
  | Gestalter | `view`; `view custom category` und `view/edit/create custom data` auf `screens`, `playlists`, `slides`, `media`, `templates` |
  | Web-Code | zusätzlich `edit custom data` auf `snippets` – ein eigenes Recht, im Gestalten **nicht** enthalten |
  | Player-Benutzer | `view`; `view custom data` auf `screens`, `playlists`, `slides`, `snippets`, `media`, `settings`; `create` **und** `edit custom data` **allein** auf `status` (der erste Heartbeat legt an, alle weiteren überschreiben) |
  | Administration | zusätzlich `settings`, `create custom category` und die Kategorie-Rechte |

- **Der Player braucht mehr als Modulrechte.** Die Tabelle oben regelt nur den Zugriff auf unseren eigenen Speicher. Das ist die tatsächliche Reichweite des Tokens auf der SD-Karte, und der Grundsatz der minimalen Rechte bemisst sich an **dieser** Liste, nicht an der kurzen darüber:

  | Lesen auf | Wofür | Anmerkung |
  | --- | --- | --- |
  | **Kalender** – genau die, die ein Screen zeigt | Terminblöcke | `/calendars/appointments` verlangt `calendar_ids[]`; ohne Leserecht auf diese Kalender kommt nichts zurück |
  | **Beiträge** | Newsblock | |
  | **Gruppen** | Gruppen- und Anmeldeblock | |
  | **Wiki-Kategorie „Infoscreen-Medien“ samt Dateien** | Mediathek | Der Wiki-Weg hat gewonnen (G8) |
  | **Ressourcen und Buchungen** | Raumbelegung | nur bei diesem Block |
  | **Events und Dienste** | Gottesdienstblock | nur bei diesem Block |

  **Ausdrücklich nicht:** Personendaten, Schreibrechte irgendwo außer `status`, Administrationsrechte, Zweifaktor-Anmeldung (an 2FA-Konten werden keine Login-Tokens ausgegeben).

  **Warum das geprüft und nicht angenommen werden muss:** Fehlende Leserechte sehen nach **G20** nicht wie Fehler aus, sondern wie leere Listen. Ein zu knapp berechtigter Player zeigt eine leere Bühne, keine Meldung – der Fehler fällt erst im Foyer auf, und dort niemandem.
- **Wie der Betriebsbenutzer eingerichtet wird – und wie nicht.** *(2026-09-23; an der Testinstanz gemessen und gegen die ChurchTools-Dokumentation gelesen, G21)*

  **Vier Träger, und ChurchTools nennt sie selbst:** Personenstatus, Gruppentyp, Gruppe und Benutzer. Zum letzten sagt die Dokumentation ausdrücklich: *„Hier kannst du Benutzern direkt Rechte zuordnen. Dies sollte nur in Ausnahmefällen geschehen."* Das deckt sich mit dem Messbefund – die Adminrechte des eigenen Kontos stehen nicht an der Person, sondern kommen über Gruppen.

  **Der Satz, der alles andere bestimmt:** *„Berechtigungen in ChurchTools funktionieren nur additiv. Das bedeutet, dass du einem Nutzer nicht Rechte entziehen, sondern ihm immer nur Rechte dazu geben kannst."*

  Daraus folgt für ein Gerätekonto etwas Unbequemes: **Was der Personenstatus gibt, ist ein Sockel, den keine Gruppenkonfiguration wieder abträgt.** Gemessen trägt der Status „Unbekannt" (`statusId: 0`) auf unserer Instanz seit der Einrichtung: eigene Personendaten **sehen und bearbeiten** bis Sicherheitsstufe 2, dazu Lesen von drei Kalendern. Ein neu angelegter Benutzer bekommt das, ohne dass jemand es wählt – und er behält es.

  **Zwei Folgen, die in die Betriebsdoku gehören.** Erstens sieht das Gerät drei Kalender, die niemand für den Screen bestimmt hat. Zweitens darf es eigene Personendaten bearbeiten, was es nie braucht. Beides ist nur abzustellen, indem man den **Status für alle** ändert. „Unbekannt" ist dabei bereits der geringste der fünf Status – ihm fehlt ein Recht, das die Status 1 bis 3 tragen. Er ist die richtige Wahl; der Sockel bleibt trotzdem und wird benannt, nicht übersehen.

  **Die Rechte des Screens kommen deshalb über eine eigene Gruppe.** Es sind **globale** Berechtigungen (Kalender lesen, Wiki-Kategorie lesen), die über die Gruppenmitgliedschaft vergeben werden – nicht gruppeninterne, die nur das Verwalten der Gruppe selbst regeln. Der Träger ist die **Gruppe**, nicht der **Gruppentyp**:

  | Träger | Reichweite | Für uns |
  | --- | --- | --- |
  | Gruppentyp | die Rolle in **allen** Gruppen dieses Typs | **falsch** – trifft fremde Gruppen mit |
  | Gruppe | die Rolle in **einer** Gruppe | **richtig** |
  | Benutzer direkt | nur diese Person | laut ChurchTools nur im Ausnahmefall |

  **Die Einrichtung:**

  1. Eigene Gruppe anlegen, etwa „Infoscreen-Geräte". Als Gruppentyp bietet sich **Merkmal** an – es ist kein Dienst und keine Kleingruppe, und der Typ trägt nur zwei Rollen.
  2. **Die Gruppe auf Status „Aktiv" setzen.** Solange sie im **Entwurf** steht, sind die Rechte *nicht* wirksam: *„Permissions are not yet active as long as the group has the status Draft."* Wer das übersieht, sucht den Fehler beim Player.
  3. Den Geräte-Benutzer als Mitglied aufnehmen.
  4. Die Rechte **an der Rolle in dieser Gruppe** vergeben.
  5. Anschließend `GET /api/permissions/group_role` auslesen und die vergebenen `authId`s notieren – die gemessene Zuordnung für die Einrichtungsdoku.

  **Was die Rolle bekommt** – jeweils so eng wie möglich, nicht „alle":

  | Recht | Umfang | Nur wenn |
  | --- | --- | --- |
  | Kalender: einzelnen Kalender sehen | genau die Kalender, die ein Screen zeigt | Terminblock |
  | Events: Events einzelner Kalender sehen | dieselben Kalender | Gottesdienst-/Dienstblock |
  | Gruppen: Gruppe sehen | genau die Gruppen, die ein Screen zeigt | Gruppenblock |
  | Wiki: Kategorie sehen | allein „Infoscreen-Medien" | Mediathek |
  | Beiträge sehen | – | Newsblock |
  | Ressourcen sehen, Buchungen lesen | die gezeigten Ressourcen | Raumbelegung |
  | Custom Module | siehe Rollentabelle oben | sobald freigeschaltet (T1) |

  **Und eine zweite Notbremse, die dabei abfällt:** *„[Permissions] lose their effectiveness once the group has the status Archived."* Wird die Berechtigungsgruppe archiviert, verliert das Gerät **sofort alle** darüber vergebenen Rechte – unabhängig davon, ob sein Login-Token noch gültig ist. Zusammen mit dem Passwortwechsel (G18) gibt es damit zwei voneinander unabhängige Wege, ein Gerät stillzulegen: einen, der die **Anmeldung** beendet, und einen, der die **Sichtbarkeit** beendet. Der Sockel aus dem Personenstatus bleibt von beidem unberührt.

  **Die gemessenen `authId`s** – der Anfang der Zuordnung, die die Spezifikation nicht liefert:

  | `authId` | `dataId` | Bedeutung laut Oberfläche |
  | --- | --- | --- |
  | 131 | Sicherheitsstufe | Personen: eigene Personendaten **sehen** |
  | 132 | Sicherheitsstufe | Personen: eigene Personendaten **bearbeiten** |
  | 306 | Kalender-IDs | „Events einzelner Kalender sehen" **oder** „einzelnen Kalender sehen" |
  | 403 | Kalender-IDs | die jeweils andere der beiden |

  Dass 306 und 403 die beiden Kalenderrechte sind, ist belegt: Beide tragen `dataId: [1, 2, 3]`, und die Oberfläche nennt für denselben Status genau die Kalender 1, 2 und 3. **Welches welches ist, ist offen** – das entscheidet ein einziger Aufruf von `GET /permissions/global` in einer Sitzung dieses Kontos, weil die Antwort dort die Rechte benannt führt.

- **Kategorien haben eine `securityLevelId`.** `ct-pass-store` setzt sie auf `1`. Was die Stufen im Zusammenspiel mit den Kategorie-Rechten bewirken, ist ungeklärt (G13) – für `status`, die einzige Kategorie mit Schreibrecht für ein unbeaufsichtigtes Gerät, lohnt der Blick.
- **Ein frisch installiertes Modul ist für alle unsichtbar – auch für Administratoren.** Belegt am zweiten Modul der Instanz: `ctradius` steht mit `view: false` und durchweg leeren Listen im Rechteobjekt eines Admin-Kontos (G4). Die Rechtevergabe ist damit **der erste Schritt nach dem Hochladen**, nicht der letzte vor der Übergabe; in der Einrichtungsdoku steht sie an erster Stelle, und wer in Phase 0 sein Testmodul aufruft und nichts sieht, sucht den Fehler zuerst hier.
- **Die Rechte heißen in der Oberfläche anders als in der API.** In der ChurchTools-Rechteverwaltung stehen sie als „Extension ansehen", „Custom Category ansehen", „Custom Data ansehen/anlegen/bearbeiten/löschen", jeweils mit Auswahl der Kategorien. Die `README` von `ct-pass-store` führt die Zuordnung je Rolle vor – eine brauchbare Vorlage für unsere eigene Einrichtungsdoku in Phase 5.
- **Der Heartbeat braucht ein Schreibrecht.** Die Statusanzeige „zuletzt gesehen" aus Phase 5 setzt voraus, dass der Player schreibt – und damit, dass der Token auf der SD-Karte schreiben darf. Deshalb liegt `status` in einer eigenen Kategorie, auf die sich dieses Recht begrenzen lässt. Wer das nicht will, überwacht die Screens von außen (ein Lebenszeichen des Pi an Home Assistant) und lässt die Kategorie weg.
- **Das Fehlerprotokoll braucht eine Mengenregel.** `status` wird von einem Gerät beschrieben, das monatelang unbeaufsichtigt läuft, und ein Datenwert fasst 10.000 Zeichen. Festlegung: **genau ein Wert je Screen, überschreibend**, mit den letzten Ereignissen als Ringpuffer darin – kein Anhängen, kein Wert je Vorfall. Sonst erzeugt ein Screen in einer schlechten Nacht hundert Werte, die niemand wieder wegräumt.
- Der Designer liest nur, was der angemeldete Anwender sehen darf. Was er in einen Screen legt, sieht aber später **jeder im Foyer**. Diese Schere ist die eigentliche Datenschutzfrage dieses Moduls, nicht die API.
- **Geburtstage** sind der offensichtliche Fall: `GET /persons/birthdays` liefert sie bequem, auf einem öffentlichen TV sind sie personenbezogene Daten ohne Einwilligung. Der Block kommt deshalb nur mit ausdrücklicher Bestätigung und einem Hinweis in die Oberfläche – oder zunächst gar nicht.
- Dasselbe gilt abgeschwächt für Dienstpläne mit Namen und für Gruppenkontakte.

### G. Phase-0-Protokoll

Geprüft wird gegen die eigene Instanz, nicht gegen die Demo und nicht gegen eine Vermutung – dieselbe Regel wie in `kraichtal-wetter-hacs`. Als zweite Quelle gilt der Quellcode einer Extension, die auf dieser Instanz **läuft**; er beweist Verhalten, das keine Spezifikation zusagt.

**Eine durchgehende Nummerierung.** G1–G8, G11, G14, G15, G18, G19 und G20 sind beantwortet, G16 zur Hälfte, der Rest offen.

**Sackgassen bleiben stehen, kurz und als solche gekennzeichnet.** Ein Plan, der nur die richtigen Wege nennt, lädt dazu ein, die falschen ein zweites Mal zu gehen. Die Nummer bleibt einem Punkt erhalten, auch wenn er wandert. (Der frühere „G4" für die KV-Grenzen heißt jetzt G2; die alte Doppelnummerierung – Buchstabenkürzel für Beantwortetes, eigene Zählung für Offenes – ist damit aufgelöst.)

#### Beantwortet

**G1 – Custom Modules sind verfügbar.** *(2026-09-22, Instanz)* Angemeldet liefert `GET /api/config` das Flag `feature_custommodule: "1"`; `GET /api/custommodules` antwortet mit **200** und listet ein bereits produktiv installiertes fremdes Modul (`ctpassstore`, „Sekundär-Passwort", `inMenu: true`). Die Architektur dieses Plans trägt.

Die frühere Annahme, es brauche eine Version über 3.136.2, ist damit **widerlegt**: Unsere Instanz läuft auf Build 32882 – demselben Build wie `demo.church.tools`. Der dortige 404 kam daher, dass anonym angefragt wurde. Die Spezifikation sagt es selbst: „The documentation will always show only those endpoints you can use with your ChurchTools installation." Die `CustomModule*`-Schemas stehen auch in der Demo-Spec, nur ihre Pfade fehlen dort.

> **Lehre, die über diesen Punkt hinausreicht:** Ein 404 der ChurchTools-API ist **kein** Beweis für eine fehlende Route. Ohne passende Anmeldung und Rechte ist eine Route unsichtbar – auch in der OpenAPI-Spezifikation, die pro Benutzer gefiltert ausgeliefert wird. Jede Aussage der Form „gibt es nicht" braucht einen angemeldeten Versuch mit ausreichenden Rechten, sonst ist sie wertlos.

**G2 – Die Grenzen des KV-Stores stehen.** *(2026-09-22, Spezifikation)* 10.000 Zeichen je Datenwert, 2.000 je Kategorie. Nicht gemessen, sondern dokumentiert. Zuschnitt und Folgen stehen in Abschnitt E. Mitentschieden ist damit: Bilddaten als Data-URI im KV-Store scheiden aus.

**G3 – Ein Datenwert hat keinen Schlüssel und keine Version.** *(2026-09-22, Typ-Snapshot und zwei Implementierungen in `ct-pass-store`)* `CustomModuleDataValue` kennt nur `id`, `dataCategoryId`, `domainId?`, `domainType?`, `value?`. Kein Name, kein `updatedAt`, kein ETag. Beide Implementierungen holen ganze Kategorien und filtern im Client. **Damit ist auch die frühere Frage nach einer Konfliktprüfung beim `PUT` beantwortet – es gibt keine.** Folgen: Slug statt `id` als Adresse, Revision im JSON, Index zuletzt schreiben. Siehe Abschnitt E.

**Korrektur vom 2026-09-23.** Die Aufzählung oben stammt aus dem `ct-pass-store`-Snapshot und nennt `domainId?` und `domainType?`. **Beide gibt es auf Build 32882 nicht**; die Spezifikation unserer eigenen Instanz führt ausschließlich `id`, `dataCategoryId` und `value`. Siehe G11. Am Schluss – kein Name, keine Version, keine Konfliktprüfung – ändert das nichts, er wird nur deutlicher.

**G4 – Rechtemodell und der Endpunkt dazu.** *(2026-09-22, `ct-pass-store` – und an der eigenen Instanz gemessen)* `GET /permissions/global` → `data[<extensionkey>]`; Datenrechte als Kategorie-ID-Listen, `view` und `create custom category` als Schalter. Vollständiger Typ und Rollenzuschnitt in Abschnitt F.

**Am 2026-09-22 an der echten Instanz gegengelesen.** `GET /api/permissions/global` liefert unter `data.ctpassstore` **alle neun Schlüssel** des Typs oben, in genau dieser Form – der Typ-Snapshot aus `ct-pass-store` stimmt Feld für Feld mit unserer Instanz überein:

```json
"ctpassstore":{"view":true,"view custom category":[4,10],"create custom category":false,
"edit custom category":[],"delete custom category":[],"view custom data":[4,10],
"create custom data":[],"edit custom data":[],"delete custom data":[]}
```

Drei Dinge stehen damit fest, die der Plan bisher nur annahm:

1. **Fehlende Rechte sind leere Listen, nicht fehlende Schlüssel.** Ein Client darf `perm['edit custom data']` ohne Fallback lesen; `[]` und `false` sind die Normalfälle.
2. **Adminrecht impliziert kein Modulrecht.** Dasselbe Objekt führt das zweite Modul der Instanz mit `"ctradius":{"view":false,…}` – alles leer, obwohl der abgefragte Benutzer Administrator ist. Folge für den Betrieb: **Nach dem Hochladen unserer Extension sieht sie zunächst niemand**, auch der Administrator nicht, bis die Rechte vergeben sind. Das gehört in die Einrichtungsdoku – und in Phase 0 an B6, sonst sucht man den Fehler im Build.
3. **Der Player-Zuschnitt aus Abschnitt F ist ausdrückbar.** `view` plus Lesekategorien plus `create/edit custom data` allein auf `status` sind genau die Felder, die es gibt.

**Die Kopie im Seitenquelltext taugt dafür nicht.** Dasselbe Recht steht im `ct-settings-json` als `{"view":true,"view custom category":{"4":"4","10":"10"},"view custom data":{"4":"4","10":"10"}}` – alles Leere ist weggefallen, die Listen sind zu Objekten geworden, und `ctradius` fehlt ganz. Zwei Formen für dieselbe Tatsache: **Rechte werden über die API gelesen, nicht aus der Seite**, sonst hängt die Oberfläche an einem Format, das niemand zusagt.

**G5 – Paketierung, Installation und Kategorieanlage.** *(2026-09-22, `ct-pass-store`)* `npm run deploy` baut `dist/` und packt es mit `zip -r … dist/ -x "*.map"` nach `releases/<name>-v<version>-<commit>.zip`; im ZIP liegt der Ordner `dist/` auf oberster Ebene. In ChurchTools: System-Einstellungen → Extensions → Extension hinzufügen, dort **Name, Kurzbezeichner, Beschreibung und Sortierindex** setzen und das ZIP ablegen. Der Kurzbezeichner ist der Extension-Key aus dem Build. Die **Kategorien legt die Extension anschließend selbst an**, über einen Setup-Assistenten beim ersten Aufruf.

**G6 – Kein iframe: Die Extension läuft im Dokument der Hostseite.** *(2026-09-22, Quelltext von `/ccm/ctpassstore/`)* ChurchTools liefert seine eigene Seite aus – `<base href="https://cg-ks.church.tools/">`, die vollständige Hauptnavigation, der eigene Vue-Build unter `system/dist/assets/…` – und hängt die Extension in **denselben Dokumentkopf**:

```html
<script src="/ccm/ctpassstore/assets/index-BtWd1lCL.js" type="module"></script>
<link rel="stylesheet" href="/ccm/ctpassstore/assets/index-DNQr0TSY.css">
```

Kein `iframe`, kein eigenes Dokument, kein eigener Ursprung. Das Modul erscheint als eigener Punkt der Hauptnavigation („Sekundär-Passwort", neben Beiträge, Personen, Gruppen …) und rendert unterhalb der Navigationsleiste in deren Inhaltsbereich. Der Menüname kommt aus der Installation, nicht aus dem Modul: Die Oberfläche von `ctpassstore` ist englisch, der Eintrag deutsch.

Vier Folgen, bisher vorgesehen, jetzt belegt:

1. **Die Stile gehen in beide Richtungen** – siehe Abschnitt C. Die Hostseite deklariert `@layer theme, base, oldcss, components, utilities`; ungeschichtetes CSS schlägt geschichtetes, die Bühne gewinnt also ohne `!important`. ChurchTools legt zudem ein globales Vuetify-Theme als `:root`-Variablensatz an – Variablennamen, die wir nicht benutzen dürfen.
2. **Der Player bekommt die Fläche nicht geschenkt.** Er rendert im Inhaltsbereich unterhalb der Navigation; der Kiosk-Modus wird damit Fallback (a), `position: fixed; inset: 0` über den gesamten Viewport.
3. **Die Asset-Namen tragen einen Build-Hash** (`index-BtWd1lCL.js`). Risiko 9 ist damit keine Theorie: Nach einem Upload zeigt ein wochenlang offener Kiosk-Tab auf Dateien, die es nicht mehr gibt. Ein Bündel ohne Code-Splitting bleibt Vorgabe.
4. **Die Einstellungen liegen im Dokument**, als JSON in `<script type="application/json" id="ct-settings-json">`: `base_url`, `files_url`, `csrfToken`, `version`/`jsversion`, die `modules`-Liste, das vollständige `auth`-Objekt (siehe G4) und der angemeldete Benutzer. Der Player kann das lesen, statt zu fragen – aber nur, solange ChurchTools die Seite baut, und **nicht für die Rechte**: Die Kopie im Dokument ist beschnitten und anders kodiert als die API-Antwort (siehe G4). Die Anmeldung des Pi (G9) ersetzt sie ohnehin nicht.

**G7 – Unbekannte Unterpfade fallen auf die Modulseite zurück.** *(2026-09-22, `/ccm/ctpassstore/pasword` – ein Pfad, den das Modul nicht kennt)* Die Seite kommt: ChurchTools-Navigation, Modul-Seitenleiste, leerer Inhaltsbereich. ChurchTools liefert für den unbekannten Pfad also die `index.html` der Extension aus, statt einen eigenen 404 zu zeigen. **Echte History-Routen sind damit möglich** – der Player darf auf `…/ccm/infoscreen-cgks/player?screen=foyer-links` neu laden.

Zwei Dinge gehören zur Antwort dazu. Erstens ist der leere Inhaltsbereich die Sache des Moduls, nicht des Servers: `ct-pass-store` hat für die unbekannte Route keinen Treffer und zeigt nichts. Unser Router braucht deshalb eine **Catch-all-Route**, die statt Leere eine benennbare Fehlerseite zeigt – auf einem Foyer-TV ist ein leerer Inhaltsbereich nicht von einem Absturz zu unterscheiden. Zweitens ist der **HTTP-Statuscode nicht abgelesen**; möglich bleibt ein 404 mit ausgelieferter Seite im Rumpf. Für den Kiosk-Browser ändert das nichts, für einen Service Worker (G10) schon – beim nächsten Aufruf im Netzwerk-Reiter mitnehmen.

**Nebenbefunde der Instanz** (in A und B eingearbeitet): CORS ist unkonfiguriert und `access_control_allow_credentials` steht auf `false`; die Upload-Grenze liegt bei 128 MB je Datei; Zeitzone `Europe/Berlin`; gehostet bei ChurchTools, also kein Self-Hosting; Wiki, Kalender, Gruppen, Beiträge, Ressourcen und Dienste sind aktiv – sämtliche Datenquellen der Blocktabelle stehen zur Verfügung. **Nachtrag vom Quelltext:** Die `modules`-Liste der Instanz nennt **zwei** fremde Module, `ctpassstore` und `ctradius`. Custom Modules sind hier also kein Einzelfall, und mit `ctradius` steht eine zweite Lesequelle bereit, falls eine Frage an `ct-pass-store` unbeantwortet bleibt.

**G14 – Datei-Adressen, Bilddienst und die 150-Pixel-Falle.** *(2026-09-15 im Nachbarprojekt `churchtools-plugin`; **am 2026-09-23 an der Testinstanz vervollständigt** – aufgezeichnet unter `fixtures/api/files-wiki_1.json` – **lokal, nicht versioniert**)*

**Der offene Teil ist beantwortet: ja.** Eine **selbst hochgeladene** Datei bekommt ebenfalls eine `imageUrl`. Ein Bild, über `POST /api/files/wiki_<kategorie>/<guid>` in eine Wiki-Kategorie geladen, trägt in der Antwort beide Adressen. Damit ist die Wiki-Kategorie als Mediathek tragfähig und **G8 verliert seine Schärfe**.

| Feld | Form | Ohne Anmeldung | Angemeldet |
| --- | --- | --- | --- |
| `fileUrl` | `?q=public/filedownload&id=…&filename=<hash>` | **401** | 302 → Cookie → 200 |
| `imageUrl` | `/images/{fileId}/{hash}` | **200** | 200 |

**Die 150-Pixel-Falle.** Der Bilddienst (League Glide) hat eine fest eingebackene Vorgabe von 150×150, und `w` bzw. `h` überschreiben jeweils **nur eine Seite**. Gemessen an einem Original von 1920×1080:

| Aufruf | Ergebnis |
| --- | --- |
| ohne Parameter | **150×150** |
| `?w=1920` | **1920×150** |
| `?w=1920&fit=max` | **267×150** |
| `?w=1920&h=1080&fit=max` | 1920×1080 |

Ein schlichtes `<img src={imageUrl}>` zeigt auf dem Foyer-TV also einen Daumennagel. **Beide Parameter sind Pflicht** – das gehört in den Renderer, nicht in eine Fußnote. Die frühere Notiz „`?w=1600` skaliert auf die Breite" war zu großzügig gelesen; sie galt für ein Terminbild mit hinterlegtem Ausschnitt, nicht allgemein.

**Die `fit`-Modi, gegen ein abweichendes Seitenverhältnis getrennt** (Quelle 1920×1080, angefragt 1200×600): `max` und `contain` passen ohne Beschnitt ein (1067×600), `crop` schneidet mittig, `fill` füllt mit Rand auf, `stretch` verzerrt – und **ohne `fit` wird beschnitten**. Das bildet die Block-Optionen des Designers eins zu eins auf Server-Parameter ab: Skalieren kostet den Pi nichts.

**Am 2026-09-23 auch für Terminbilder bestätigt.** Ein über `POST /api/files/appointment_image/<id>` angehängtes Bild trägt dieselbe `imageUrl` und unterliegt derselben 150-Pixel-Regel. Es hängt am `base`-Termin und erscheint damit an **allen** Vorkommen einer Serie – bei neun aufgelösten Sonntagen an allen neun (G19). Für den Terminblock heißt das: ein Bild je Serie, nicht je Vorkommen.

**Cache:** `cache-control: max-age=604800, public` – aber **kein ETag und kein `Last-Modified`**. Für den Player günstig; für einen Service Worker (G10) heißt es, dass Gültigkeit allein über die Laufzeit läuft und es keine billige Revalidierung gibt.

**Ein Sicherheitsbefund, der in die Betriebsdoku gehört.** Die Testkategorie wurde mit `fileAccessWithoutPermission: false` angelegt – der strengen Einstellung. Die `imageUrl` liefert **trotzdem anonym 200**. Der Bilddienst umgeht die Kategorieberechtigung; es schützt allein der Hash im Pfad. Wer ein Bild in die Mediathek lädt, veröffentlicht es praktisch: unter einer nicht zu erratenden Adresse, aber ohne Anmeldung abrufbar. Das ist zu sagen, bevor jemand dort etwas ablegt, das nicht ins Foyer gehört.

**G15 – Es gibt eine scharfe CSP, und sie gilt auch unter `/ccm/`.** *(2026-09-23, Antwort-Header der Testinstanz)* Das frühere Indiz – keine CSP als `<meta http-equiv>`, aber ein leeres `nonce=""` – war irreführend. Der **Header** trägt sie, auf der Hauptseite, auf `/api` und auf `/ccm/`-Pfaden gleichermaßen:

```
default-src 'self'; script-src 'self' js.stripe.com 'nonce-…' 'unsafe-eval';
style-src 'self' 'unsafe-inline' *.dev.churchtools.website;
font-src 'self' *.dev.churchtools.website data:;
img-src * data: blob: *.church.tools; child-src * data; connect-src *;
object-src 'self' www.youtube.com; frame-ancestors 'self'
```

Fünf Folgen, zwei davon Vorgaben und keine Hinweise:

1. **`script-src` kennt kein `'unsafe-inline'`.** Inline-Skripte brauchen den Nonce, den ChurchTools vergibt und den unser Build nicht kennt. **Der Vite-Build darf deshalb kein Inline-Skript ausliefern** – der Modulepreload-Polyfill ist eines. Das ist eine harte Build-Vorgabe und gehört neben „kein Code-Splitting" (G6) in die Konventionen.
2. **`style-src` erlaubt `'unsafe-inline'`.** Die dynamischen Block-Stile des Designers und die des Vite-Builds laufen. Der heikle Teil war ohnehin die Schichtung (G6), nicht die CSP.
3. **`img-src *`** – externe Bilder sind erlaubt. Das stützt die Rückfallposition aus **Offene Entscheidung 6**.
4. **Kein `media-src`** – es fällt auf `default-src 'self'` zurück: **Externe Videos sind blockiert.** Bilder von überall, Videos nur von der eigenen Domain. Diese Asymmetrie trifft Offene Entscheidung 6 und 9 unmittelbar: „nur externe URLs" trägt für Bilder, für Videos nicht.
5. **`child-src *`** – Sandbox-`iframe`s und eingebettete Fremdseiten sind erlaubt. Aber ein `srcdoc`-Rahmen **erbt die CSP des Elterndokuments**. Fremdcode mit Inline-Skript läuft darin also nicht, gleichgültig wie die Sandbox gesetzt ist. Für den Web-Code-Block heißt das: entweder er lädt aus einer Datei gleicher Herkunft, oder er beschränkt sich auf das, was ohne Inline-Skript auskommt.

Die Nebenfrage – ob wir dem Sandbox-Rahmen selbst eine CSP per `<meta http-equiv>` mitgeben – bleibt eine Entscheidung, ist aber entschärft: Die geerbte Policy ist bereits enger als das, was wir vermutlich gesetzt hätten.

**G8 – Beantwortet: die Wiki-Kategorie trägt.** *(2026-09-23, Testinstanz)* Der Umweg ist gefunden. Eine eigene Wiki-Kategorie nimmt Uploads über `POST /api/files/wiki_<kategorie>/<guid>` an, und die Datei bekommt eine `imageUrl` am Bilddienst (G14). Dass die `domainType`-Liste **kein Ziel für Custom Modules** kennt, bleibt richtig – es spielt nur keine Rolle mehr.

Drei Dinge bringt der Zuschnitt mit. Die Trägerseite wird über ihre **GUID** adressiert, nicht über eine numerische id. Die Kategorie verlangt bei der Anlage `inMenu` und `fileAccessWithoutPermission` als ausdrückliche Boolesche Werte, sonst 400. Und `fileAccessWithoutPermission: false` schützt die `imageUrl` **nicht** – siehe G14.

**Videos bleiben offen.** Die CSP erlaubt Bilder von überall, Videos nur von der eigenen Domain (G15). Ob eine Videodatei denselben Weg nimmt und wie sie ausgeliefert wird, ist ungeprüft; die Upload-Grenze von 128 MB je Datei steht.

**G19 – Serientermine löst die API selbst auf, samt Zeitumstellung.** *(2026-09-23, Testinstanz – eigens angelegte Serie)* Die vorhandenen Termine waren alle einmalig, also wurde eine wöchentliche Serie über neun Sonntage angelegt, dazu eine **Ausnahme** und ein **Zusatztermin**. `GET /calendars/appointments` liefert daraufhin **neun einzelne Einträge**, alle mit demselben `base.id`, jeder mit eigenem `calculated.startDate`. Die Ausnahme fehlt in der Liste, der Zusatztermin steht darin.

**Der Client braucht also keine Wiederholungslogik.** Er liest `calculated`; `base` ist nur die Seriendefinition. Das nimmt dem Terminblock den aufwendigsten Teil – RRULE-Auflösung, Ausnahmen, Zusatztermine – vollständig ab. `exceptions` und `additionals` sind am `base`-Satz sichtbar, falls der Designer sie je anzeigen will (`additions` ist deprecated).

**Und die Zeitumstellung ist mitgemessen.** Die Serie läuft über den 25. Oktober 2026, das Ende der Sommerzeit:

| Vorkommen | `calculated.startDate` | Ortszeit |
| --- | --- | --- |
| 04.10., 11.10. | `09:00:00Z` | 11:00 |
| 25.10. und später | `10:00:00Z` | 11:00 |

ChurchTools hält die **Ortszeit** konstant und verschiebt die UTC-Darstellung. Für den Player heißt das unmissverständlich: **Er rechnet jeden Zeitstempel nach `Europe/Berlin` um und rechnet nie mit einem festen Offset.** Ein Player, der einmalig „UTC+2" annimmt, zeigt ab dem 25. Oktober jeden Gottesdienst eine Stunde falsch – auf einem Gerät, das niemand kontrolliert, ein Fehler, der wochenlang stehen bleibt.

**Nebenbefund zum Anlegen:** `repeatUntil` verlangt `Y-m-d`, `startDate` und `endDate` verlangen ISO-8601 mit `Z`. Zwei Datumsformate in derselben Nutzlast. Betrifft uns nur, falls der Designer je Termine schreibt – aber es kostet sonst einen Nachmittag.

**G20 – Ein fehlgeschlagener Login sieht aus wie ein leerer Kalender.** *(2026-09-23, Testinstanz)* Der Plan warnte davor; hier sind die Zahlen. Anonym, also genau im Zustand eines Players, dessen Anmeldung gescheitert ist:

| Aufruf | Anonym | Angemeldet |
| --- | --- | --- |
| `/api/whoami` | **200**, `id: -1`, `lastName: "Anonymous"` | 200 |
| `/api/calendars` | **200, leere Liste** | 5 |
| `/api/groups` | **200, leere Liste** | 7 |
| `/api/events`, `/api/wiki/pages` | **200, leere Liste** | 1 bzw. 3 |
| `/api/calendars/appointments` | **403** | 200 |

**Das ist schlimmer als ein 401.** Die meisten Quellen antworten *erfolgreich* mit nichts. Ein Screen, dessen Anmeldung scheitert, zeigt eine leere Bühne – nicht von einem Sonntag ohne Termine zu unterscheiden. Nur die Terminabfrage selbst fällt mit 403 auf.

Zwei Festlegungen folgen daraus, beide gehören ins Datenmodell und nicht in ein späteres Review:

1. **Der Player hängt `only_allow_authenticated=true` an jede Anfrage.** Gemessen: Damit liefert `/api/whoami` anonym sauber **401** statt 200. Das ist der Schalter, der den stillen Fehler in einen lauten verwandelt.
2. **Der Player prüft nach dem Start die Identität**, nicht nur den Statuscode: Ist `whoami.data.id` die erwartete Person? Leere Daten ohne bestätigte Identität sind ein **Fehlerzustand mit sichtbarer Meldung**, kein leerer Kalender.

**G11 – Beantwortet, und damit hinfällig: Die Felder gibt es nicht.** *(2026-09-23, Spezifikation unserer eigenen Instanz, Build 32882 – aufgezeichnet unter `fixtures/schema/custommodule-schemas.json` – **lokal, nicht versioniert**)* `CustomModuleDataValue` führt **nur** `id`, `dataCategoryId` und `value`. **Weder `domainId` noch `domainType`.** Der Typ-Snapshot aus `ct-pass-store` (2025-09-02) ist an dieser Stelle überholt – er hat die Frage überhaupt erst aufgeworfen.

Damit entfällt **C1 aus `Preparation.md` ersatzlos**: Es gibt nichts zu filtern. Der Slug-im-JSON-Ansatz aus G3 ist nicht mehr die bessere, sondern die einzige Wahl, und das Lesen ganzer Kategorien bleibt der Normalfall.

**Aus derselben Quelle mitbelegt**, jetzt gegen unsere Instanz statt gegen fremden Code: `value` max. **10.000** Zeichen (bestätigt G2), Kategorie-`data` max. **2.000**, `name` 100, `shorty` 2–50, `description` 300 und Pflicht. `CustomModulePermission` fordert **alle neun Schlüssel** – G4 gilt damit nicht nur empirisch, sondern spezifiziert.

**G18 – Das Geräte-Login wird in der Oberfläche verwaltet, nicht über die API.** *(2026-09-23, Testinstanz)* Der Punkt hat den Plan zweimal korrigiert und dabei drei Sackgassen erzeugt, die hier bewusst kurz stehen, damit sie niemand erneut geht.

**Was ein Administrator nicht kann.** Geprüft mit `administer settings` und `administer persons`:

| Aufruf | Antwort | Bedeutung |
| --- | --- | --- |
| `GET /persons/16/logintoken` – eigene Person | 200 | Der Endpunkt gilt nur für einen selbst |
| `GET /persons/1/logintoken` – fremde Person | **403** | Kein Recht im `churchcore`-Satz ändert das |
| `GET /persons/{id}/loginstring` | **403** | Dieselbe Sperre |
| `DELETE /persons/{id}/logintoken` | **403** | Der Widerruf aus dem alten E3 ist unmöglich |
| `PUT /persons/{id}/password` | **verlangt `oldPassword`** | Selbstbedienung, kein Admin-Reset. Dazu `newPasswordConfirm`; der Endpunkt ist als `Hidden`/`TODO 200` geführt |

Auch die **Administrationsoberfläche gibt einen fremden Token nicht heraus** (2026-09-23 gegengeprüft). Es gibt also keinen Weg – weder API noch Oberfläche –, sich den Token eines anderen Kontos anzusehen.

**Das ist kein Loch, sondern Logik.** `POST /api/login/token` ist anonym erreichbar und nimmt `username` und `password` (falsche Daten: 400 „Login failed"). Der Token wird **aus den Zugangsdaten abgeleitet**; er gehört der Person, nicht der Verwaltung. Wer ihn haben will, muss das Passwort haben – deshalb die 403.

**Die Notbremse wirkt, und sie ist gemessen.** Am 2026-09-23 wurde das Passwort der Person 16 **in der ChurchTools-Oberfläche** geändert. Deren bis dahin gültiger Token danach:

| Prüfung | Vorher | Nachher |
| --- | --- | --- |
| `GET /api/whoami` mit dem Token | 200, `id: 16` | **401 „No valid token"** |
| `GET /api/calendars` mit demselben Token | 200, 5 Kalender | **401** |
| `GET /api/info` – Gegenprobe Instanz | 200 | 200 |
| `GET /api/whoami` anonym – Gegenprobe | 200, `id: -1` | 200, `id: -1` |

**Ein Passwortwechsel macht den Login-Token derselben Person ungültig.** Instanz gesund, anonymes Verhalten unverändert – es lag am Token.

**Der Betriebsweg, wie er in die Einrichtungsdoku gehört:**

1. **Einrichten:** Geräte-Benutzer anlegen und ihm **in der Oberfläche** ein Passwort geben. Als API-Alternative bliebe `POST /persons/{id}/invite`, wobei die Person ihr Passwort selbst setzt – das braucht ein erreichbares Postfach.
2. **Token erzeugen:** `POST /api/login/token` mit dessen Zugangsdaten.
3. **Verwenden:** Token in die Player-URL. Der `/ccm/`-Teil ist G9 und braucht ein Modul.
4. **Notbremse:** Passwort **in der Oberfläche** ändern – der Token ist sofort tot.

**Die Doku beschreibt hier also Klickwege, keine curl-Aufrufe.** Das ist kein Schönheitsfehler: Wer sie als API-Anleitung schreibt, schreibt etwas auf, das nicht funktioniert.

**Nicht gemessen, und deshalb nicht behauptet:** dass `POST /login/token` für *gültige* Zugangsdaten einen brauchbaren Token liefert (nur negativ geprüft), und ob `POST /persons/{id}/archive` als zweite Notbremse wirkt. Beides braucht ein Gerätekonto mit gesetztem Passwort – siehe **G21**.

**Drei Sackgassen, damit sie niemand erneut geht:** `DELETE …/logintoken` als Widerruf (403). `GET …/loginstring` als Ausweg (dieselbe Sperre). Und `POST /api/simulate`, das technisch funktioniert – `whoami` liefert die simulierte Person samt `meta.simulatingUserId`, der Zustand endet mit `DELETE /api/simulate` – aber ein Umweg um ein Problem war, das es nicht gab. Festzuhalten bleibt allein, dass eine Simulation an der Antwort erkennbar ist.

#### Teilweise beantwortet

**G16 – Kein Limit in Reichweite, aber keine Zusage.** *(2026-09-23, Testinstanz)* 60 gleichzeitige Anfragen an `/api/whoami` in einer Sekunde: **alle 200**, kein `429`, und **keine Rate-Limit-Header** – weder `X-RateLimit-*` noch `Retry-After`. Weiter wurde nicht gedrückt.

Das misst die Reichweite, nicht die Regel. Mehrere Pis plus Designer liegen weit darunter, und der Player wertet `429` und `Retry-After` weiterhin aus – nur ist jetzt belegt, dass er sie im Normalbetrieb nicht zu sehen bekommt. Nach einer **dokumentierten** Grenze bleibt die Frage an den Support (F1) offen.

#### Offen

**G9 – Wie verhält sich `login_token` in der URL bei einem Custom Module?** Beim nativen Infoscreen erprobt, für `/ccm/`-Pfade ungeprüft. `ct-pass-store` hilft hier nicht: Es benutzt Tokens gegenüber seinem eigenen Backend, nicht zur Anmeldung einer Seite. **Doppelt blockiert seit dem 2026-09-23:** Es fehlt das Custom Module (T1) *und* ein Token, an den ein Administrator regulär herankommt (**G18**).

**G10 – Darf unter `/ccm/<key>/` ein Service Worker registriert werden?** Entscheidet, ob Offline-Festigkeit vollständig erreichbar ist oder nur halb: IndexedDB sichert die Daten, aber nicht die eigenen Assets und nicht die Bilder. Ohne Service Worker zeigt ein Pi, der während eines Netzausfalls neu startet, einen weißen Bildschirm – genau der Fall aus Risiko 4. Zu prüfen sind Scope, MIME-Typ und ob ChurchTools den Pfad umschreibt.

**G12 – Wird das JSON Schema einer Kategorie serverseitig durchgesetzt?** Entscheidet, ob wir ein vollständiges Schema hinterlegen müssen (und dann an 2.000 Zeichen scheitern) oder ein permissives genügt. Siehe Abschnitt E.

**G13 – Was bewirkt `securityLevelId` an einer Kategorie?** Besonders für `status`, die einzige Kategorie, auf die ein unbeaufsichtigtes Gerät schreibt.

**G21 – Der Betriebsbenutzer mit Minimalrechten ist nie gebaut worden.** Abschnitt F beschreibt seinen Zuschnitt seit Beginn – die Modulrechte und, wichtiger, die Leserechte in ChurchTools selbst. **Gegen eine echte Person geprüft wurde das nie.** Es ist eine Absichtserklärung, kein Befund.

**Stand 2026-09-23:** Person 22 „Minimal User" ist angelegt (`statusId: 0`), hat aber **keine Gruppenmitgliedschaft und keine direkte Zuweisung**. Ihre Rechte stammen allein aus dem Personenstatus – und die sind Vorgabe der Instanzeinrichtung, nicht bewusst gewählt. Der Zuschnitt aus Abschnitt F ist damit noch nicht gebaut.

**Person 19 auf der Testinstanz taugt dafür nicht** – aber nicht, weil sie zu viele Rechte hätte. *(Korrektur vom 2026-09-23: Die frühere Behauptung, sie trage „Vorgaberechte, die niemand bewusst gewählt hat", ist falsch.)* `GET /api/permissions/internal/persons/19` liefert zwei Bereiche, `churchdb` und `churchservice`, **alle Werte leer**. Sie ist ein unbeschriebenes Blatt. Untauglich ist sie, weil sie als Messobjekt für den Token-Weg entstanden ist: Wegwerfname, `.invalid`-Adresse, kein Passwort.

**Wie Rechte in ChurchTools tatsächlich vergeben werden** *(2026-09-23 gemessen)*:

- `GET /permissions/internal/persons/{id}` zeigt **nur direkte Zuweisungen an der Person**, nicht die wirksamen. Für das eigene Administratorkonto (Person 16) stehen dort **dieselben zwei leeren Bereiche** – die Adminrechte tauchen gar nicht auf. Sie kommen über **Gruppen und Rollen**. Rechte an der Person sind damit der Ausnahmeweg, nicht der Normalfall.
- `PUT /permissions/{domainType}/{domainId}` existiert („Save a raw permission assignment"), `domainType` aus `group, group_role, group_type, group_type_role, person, status`. Der Körper trägt `authId` und optional `dataId`.
- **Die `authId` ist eine Zahl ohne Namen.** Die Spezifikation liefert keine Zuordnung, und einen Katalog-Endpunkt gibt es nicht. `GET /permissions/person` listet nur die vorhandenen Zuweisungen (302 auf dieser Instanz, authIds von 1 bis 10801).

**Daraus der Weg, und er dreht den Nachteil um:** Der Benutzer wird **in der Oberfläche** eingerichtet, wo die Rechte Namen tragen. Anschließend liest man über `GET /api/permissions/group_role` aus, **welche `authId`s dabei gesetzt wurden** – eine belegte Zuordnung Zahl → Recht statt einer geratenen. Der vollständige Zuschnitt samt Fallstricken steht in **Abschnitt F**, „Wie der Betriebsbenutzer eingerichtet wird – und wie nicht".

**Am 2026-09-23 gegen die ChurchTools-Dokumentation gelesen**, mit zwei Folgen, die keine Messung gezeigt hätte: Berechtigungen sind **rein additiv** – was der Personenstatus gibt, nimmt keine Gruppenkonfiguration zurück. Und die Rechte einer Gruppe wirken erst, wenn die Gruppe den Status **„Aktiv"** hat; im Entwurf sind sie unwirksam, beim Archivieren verfallen sie. Letzteres ist zugleich eine **zweite Notbremse** neben dem Passwortwechsel aus G18.

**Drei Fragen hängen an dem fertigen Konto**, und alle drei brauchen eine **Anmeldung als dieses Konto**:

1. **Reicht der Zuschnitt aus Abschnitt F**, damit der Player alles sieht, was er rendern muss – und nicht mehr? Nach **G20** ist das nicht durch Hinsehen zu beantworten: Fehlende Rechte sehen wie leere Listen aus, nicht wie Fehler.
2. **Was sieht ein gering berechtigter Benutzer in `GET /api/config`?** Als Administrator steht dort `site_licensekey` im Klartext. Liest der Infoscreen-Benutzer ihn mit, fährt der Lizenzschlüssel auf jeder SD-Karte im Foyer mit.
3. **Die beiden Reste aus G18**: ob `POST /login/token` für gültige Zugangsdaten trägt, und ob Archivieren als zweite Notbremse wirkt.

**Die Modulrechte selbst sind davon ausgenommen**, solange Custom Modules nicht freigeschaltet sind (T1) – prüfbar ist zunächst nur die ChurchTools-seitige Hälfte. Die ist aber die größere: Sie bemisst, was der Token auf der SD-Karte wirklich darf.

**G17 – Extension Store**: Aufnahmekriterien, Einreichungsweg, ob eine Veröffentlichung überhaupt angestrebt wird. Der Publisher hält seinen Store-Text in einer eigenen `EXTENSION_STORE.md` – ein Muster, das sich übernehmen lässt.

## Entwicklungs- und Testumgebung

**Seit dem 2026-09-22 gibt es eine eigene Testinstanz: `https://test-cg-ks.church.tools`** („Testsystem - CG-KS"). Anonym gegengeprüft: **Version 3.136.2, Build 32882** – Ziffer für Ziffer derselbe Stand wie die Produktivinstanz, dazu dieselbe Upload-Grenze (128 MB) und dieselbe Zeitzone. Was dort gemessen wird, gilt hier. Sie ist **leer** angelegt und enthält keine echten Personendaten; Kalender, Termine, Gruppen und Bilder müssen von Hand entstehen.

**Und sie hat eine Frist: 30 Tage Lizenz**, also bis etwa **2026-10-22**. Ob sich das verlängern lässt, ist ungeklärt – und damit eine der dringlichsten Fragen an den Support, weil ihre Antwort die Reihenfolge der Arbeit bestimmt.

> **⚠ Befund vom 2026-09-23: Custom Modules sind auf der Testinstanz nicht freigeschaltet.**
>
> Angemeldet als Administrator (`administer settings: true`) gemessen, dreifach belegt:
> `feature_custommodule` **fehlt** unter den 154 Schlüsseln von `GET /api/config`; `GET /api/custommodules`
> antwortet mit **404**; und die pro Benutzer gefilterte Spezifikation enthält **alle neun `CustomModule*`-Schemas,
> aber keinen einzigen zugehörigen Pfad**. Das ist Zeichen für Zeichen dasselbe Muster wie seinerzeit auf
> `demo.church.tools` (G1) – diesmal aber mit ausreichenden Rechten geprüft, der 404 zählt also.
>
> Die Lehre aus dem T-Block hat sich damit bewahrheitet: **Gleicher Build, anderer Lizenzumfang.** Eine
> Freischaltung ist bei ChurchTools angefragt (Stand 2026-09-23 unbeantwortet). Bis dahin sind **B5, B6,
> der gesamte C-Block, E1 und E4 blockiert**; was ohne Custom Modules geht – D1/D2, E2/E3 und die
> Datenquellen der Blocktabelle – ist gemessen und liegt als Fixture im Repo.
>
> **Ein Fallstrick für B5:** Die Spezifikation dieser Instanz ist **kein** tauglicher Typ-Snapshot. Sie kommt
> gefiltert und damit ohne die `CustomModule`-Pfade. Ein solcher Snapshot wäre schlimmer als keiner, weil der
> Fehler erst in Phase 1 aufflöge. B5 wird nach der Freischaltung wiederholt oder kommt von der Produktivinstanz.

**Die Frist ist der Taktgeber, nicht die Phasenfolge.** Daraus folgt eine Regel, die dem Plan vorgeht: **Was nur eine Instanz beantworten kann, wird zuerst gemessen; was lokal geht, geht auch im November noch.** In dieser Reihenfolge:

1. ~~**Zuerst prüfen, ob die Testinstanz überhaupt trägt**~~ – **erledigt am 2026-09-23, und zwar negativ.** Siehe den Befund oben. Die Begründung war richtig: Der Lizenzumfang einer Testinstanz muss dem der Produktivinstanz nicht gleichen. Genau das ist eingetreten.
2. **Dann alles Instanzgebundene aus Abschnitt G.** Stand 2026-09-23: **erledigt**, soweit ohne Custom Modules erreichbar – Upload-Weg und Datei-Adressen (G8, G14) und der CSP-Header (G15). **Blockiert** bis zur Freischaltung: Login-Token unter `/ccm/` (G9), Service Worker (G10), die Speicher-Feinheiten am eigenen Modul (G12, G13). **Entfallen:** G11 – die Felder gibt es nicht.
3. **Dabei mitschreiben, was die Instanz überlebt**: aufgezeichnete Antworten als Fixtures und der **Typ-Snapshot** (`ct-types.d.ts`). Ein Abend Termine und Gruppen anzulegen ist auf einer befristeten Instanz nur dann keine verlorene Zeit, wenn die Antworten erhalten bleiben. Das ist der eigentliche Ertrag dieser 30 Tage: Danach bleibt ein Mock, der sich wie die echte Instanz verhält.

   **Entschieden am 2026-09-23: Die Fixtures werden *nicht* versioniert.** Sie liegen unter `fixtures/`, und `.gitignore` erfasst das Verzeichnis. Das hat einen Preis, der hier stehen soll, damit er nicht überrascht: Der Ertrag der 30 Tage hängt damit an **einem** Arbeitsplatz. Geht er verloren, sind die Antworten nach Ablauf der Lizenz nicht wiederherstellbar – die Instanz gibt es dann nicht mehr. Wer diesen Zuschnitt beibehält, braucht dafür einen Ersatz: eine Sicherung außerhalb des Repos oder ein Aufzeichnungsskript, das gegen eine dann noch laufende Instanz erneut ziehen kann.
4. **Zuletzt, unbefristet und lokal**: Designer, Blockrendering, Bühnenskalierung, Rotation, Offline-Verhalten, Undo/Redo gegen genau diesen Mock. Dafür braucht es nie wieder eine Instanz.

**Was die Testinstanz an Vorsicht erspart.** Drei Bremsen dieses Plans sind dort gegenstandslos:

- **Testdaten und Uploads müssen nicht aufgeräumt werden.** Wiki-Kategorien, Dateien, verwaiste Datenwerte dürfen stehen bleiben. Die Aufräumregel gilt weiter, sobald etwas auf der Produktivinstanz entsteht – dort aber auch unverändert streng.
- **Der Login-Token ist kein Dauerpasswort auf einer echten Gemeinde.** Infoscreen-Benutzer, Token und Rückzugsweg (`DELETE …/logintoken`) lassen sich üben, bevor es darauf ankommt. Die Prüfungen des E-Blocks müssen deshalb **nicht mehr auf Phase 2 warten** – sie gehören in die ersten Tage, weil sie instanzgebunden sind.
- **Rechte dürfen zerschossen werden.** Rollen, Gruppen, Kategorie-Rechte: Ausprobieren ist billig, und G13 (`securityLevelId`) braucht genau das. Dass ein frisch installiertes Modul zunächst für niemanden sichtbar ist (G4), lässt sich dort gefahrlos durchspielen.

**Die Produktivinstanz bleibt an zwei Stellen im Spiel.** Sie hat die echten Kalender, Gruppen und Terminbilder, an denen sich die Datenquellen der Blocktabelle im Ernstfall bewähren müssen – und sie ist am Ende das Ziel. Lesende Stichproben dort sind unbedenklich; alles Schreibende gehört auf die Testinstanz.

**Der frühere Befund bleibt richtig, ist aber überholt.** Eine kostenlose Dauer-Sandbox gibt es bei ChurchTools nicht („Ein solches Testsystem gibt es derzeit nicht"), eine Instanz unter erfundenem Gemeindenamen verbietet sich, und eine Datenbank-Kopie der Produktivinstanz brächte echte Personendaten in eine Entwicklungsumgebung – genau das, was dort nicht hingehört. Die leere Testinstanz umgeht all das. Unverändert gilt: Wir sind bei ChurchTools gehostet (`hostingservice: "1"`), Self-Hosting steht nicht zur Wahl.

## Datenquellen für Inhaltsblöcke

Geprüft gegen die OpenAPI-Spezifikation 3.136.2 (497 Pfade):

| Block | Endpunkte |
| --- | --- |
| Termine | `/calendars`, `/calendars/appointments` (**`calendar_ids[]` ist Pflicht**, sonst 400; dazu `from`, `to`), `/calendars/{id}/appointments/{id}/{startDate}` für Einzeltermin samt Bild. **Serien löst der Server auf** – ein Eintrag je Vorkommen, Ausnahmen und Zusatztermine berücksichtigt, Zeiten in UTC und über die Zeitumstellung hinweg ortszeitstabil (G19) |
| Gemeindekopf | `/info` (Name, Anschrift), `/files/logo/{id}` |
| Beiträge / News | `/posts`, `/post/groups` |
| Gruppen & Anmeldungen | `/groups`, `/groups/grouped`, `/grouphomepages`, `/publicgroups/{id}` (Kapazität, Warteliste) |
| Raumbelegung „wer ist wo" | `/resource/masterdata`, `/bookings` (`resource_ids[]` ist Pflicht) |
| Dienste / Gottesdienst | `/events`, `/events/{id}/agenda`, `/services`, `/event/masterdata` |
| Geburtstage | `/persons/birthdays` (`start_date`, `end_date`, `campus_ids[]`, `group_ids[]`) – **nur mit Einwilligung** |
| Bilder | `/files/{domainType}/{domainIdentifier}` mit `appointment_image`, `groupimage`, `logo`, `post`. Zum **Anzeigen** `imageUrl` (`/images/{fileId}/{hash}`, skalierbar über `w`/`h`/`fit`) statt `fileUrl` – siehe G14 |
| Filter mehrerer Standorte | `/campuses`, `/departments`, `/tags/{domainType}` |
| Freie Texte | `/wiki/pages`, `/wiki/categories/{id}/pages/{identifier}` |

Dass `/api/whoami` anonym 200 liefert, ist nicht mehr nur bekannt, sondern **an unserer Instanz gemessen** (G20): `id: -1`, `lastName: "Anonymous"` – und die Datenquellen antworten anonym ebenfalls mit **200 und leeren Listen**, nicht mit 401. Ein fehlgeschlagener Login fällt also nicht von selbst auf, sondern sieht aus wie ein ereignisloser Tag. Der Player verwendet deshalb `only_allow_authenticated=true` (anonym dann sauber 401) **und** prüft die Identität aus `whoami`, statt sich auf Statuscodes zu verlassen. Einen leeren Screen behandelt er als Fehler, nicht als leeren Kalender.

## Medien und eigener Web-Code

Slides sollen nicht nur ChurchTools-Daten zeigen, sondern auch eigene Bilder, Videos und eigenen Web-Code. Beides berührt die zwei heikelsten Stellen des Moduls.

### Eigene Bilder und Videos

ChurchTools kann Dateien annehmen: `POST /files/{domainType}/{domainIdentifier}` als `multipart/form-data` mit `files[]`, optional `max_width`, `max_height` und `image_options` für Zuschnitt und Fokus. Dazu passend `GET` zum Auflisten, `PATCH` zum Umbenennen und Sortieren, `DELETE` zum Entfernen.

Der Haken ist `domainType`. Die Spezifikation führt eine feste Liste: `avatar`, `groupimage`, `appointment_image`, `logo`, `attachments`, `bulkletter_template`, `service`, `song_arrangement`, `importtable`, `person`, `familyavatar`, `post`, `wiki_.?`. **Ein eigener Typ für Custom Modules ist nicht darunter.** Das deckt sich damit, dass der Publisher eigene Bild-Uploads „bis zu einem offiziellen ChurchTools-Speicherpfad bewusst deaktiviert" hat.

**Wo die Dateien liegen, ist dabei keine Frage der Ablage, sondern des Besitzers.** ChurchTools hat keinen freien Dateispeicher; jede Datei hängt an einem Domänenobjekt. Physisch liegen sie unter der `files_url` der Instanz (`https://cg-ks.church.tools/sites/default`), erreichbar aber nur über die Datei-API und die Adressen, die das jeweilige Objekt mitführt – einen Ordner, den man ansteuern könnte, gibt es nicht.

**Wie ChurchTools vorhandene Bilder ausliefert**, ist belegt (G14): Ein Bild am Termin trägt zwei Adressen – `fileUrl` (Dateidownload, cookie-authentifiziert) und `imageUrl` (`/images/{fileId}/{hash}`, der Bilddienst League Glide mit `w`, `h`, `fit`). Für den Player heißt das zweierlei. Erstens trägt ein `<img>` unter `/ccm/` die Anmeldung von selbst, weil es dieselbe Domain ist; der 401, an dem das WordPress-Plugin scheiterte, trifft ihn nicht. Zweitens – und wertvoller – kann er die Zielgröße **anfordern**, statt ein Vollformat zu laden und im Browser zu verkleinern: `?w=1920&h=1080&fit=max` liefert genau das, was die Bühne braucht. Auf einer Leitung, an deren Ende ein Raspberry Pi hängt, ist das der Unterschied zwischen einem Bild und einem Megabyte.

**Diese Frage ist am 2026-09-23 beantwortet – mit ja.** Sie lautete: Bekommt eine **selbst hochgeladene** Datei ebenfalls eine `imageUrl` am Bilddienst? Ein Bild, über `POST /api/files/wiki_<kategorie>/<guid>` in eine eigene Wiki-Kategorie geladen, trägt beide Adressen. Serverseitige Skalierung, Cachefähigkeit und G14 sind damit in einem Zug erledigt, und die Mediathek steht auf tragfähigem Grund.

**Zwei Bedingungen hängen daran.** Erstens die **150-Pixel-Falle**: Ohne Parameter liefert der Bilddienst 150×150, und `w` allein setzt nur die Breite – `?w=1920` ergibt 1920×150. **Der Renderer muss immer beide Werte setzen.** Zweitens: `fileAccessWithoutPermission: false` an der Kategorie schützt die `imageUrl` **nicht**; sie ist anonym abrufbar, geschützt allein durch den Hash. Beides steht ausführlich bei G14.

**Der Weg steht seit dem 2026-09-23** – die folgende Liste ist deshalb keine Prüfreihenfolge mehr, sondern eine Rangfolge mit einem Gewinner und drei Rückfallpositionen:

1. **Wiki-Kategorie als Mediathek** (`wiki_<kategorie>`) – **geprüft und bestätigt** *(2026-09-23)*. Eine eigene Kategorie „Infoscreen-Medien", Uploads hängen an Wiki-Seiten, adressiert über deren **GUID**. Vorteile wie erwartet: echte ChurchTools-Dateien mit URL, ChurchTools-Rechten und einer Oberfläche, in der Anwender sie auch ohne unser Modul verwalten und löschen können – **und** der Bilddienst. Das ist der Weg; die folgenden Kandidaten sind damit Rückfallpositionen und keine Prüfaufträge mehr.
2. ~~**`attachments`**~~ – **nicht geprüft und nicht mehr nötig.** Stand hier als zweiter Anlauf, falls die Wiki-Kategorie scheitert. Sie ist nicht gescheitert. Bleibt als Notiz stehen, damit niemand die Frage nach `domainIdentifier` erneut aufwirft.
3. **Bestehende ChurchTools-Bilder ohne eigenen Upload**: Termin-, Gruppen-, Beitrags- und Logobilder. Das funktioniert nicht nur sicher, sondern nachweislich, mitsamt Bilddienst (G14). Für „Bild hochladen" reicht es trotzdem nicht – es ist der Rückfallplan, nicht das Ziel. Umgekehrt gilt: `appointment_image` als **Ablage** für eigene Medien zu missbrauchen ist geprüft und verworfen; Begründung bei G8.
4. ~~**Data-URI im KV-Store**~~ – **ausgeschieden.** Ein Datenwert fasst 10.000 Zeichen, also rund sieben Kilobyte. Das reicht nicht einmal für ein Icon, für Videos erst recht nicht.
5. **Externe URL** als Notausgang – **geprüft am 2026-09-23.** `POST /files/{domainType}/{domainIdentifier}/link` nimmt `url`, `name` und optional `securityLevelId`, antwortet **201** und legt einen regulären Dateisatz an: `type: "link"`, gleicher `domainType`/`domainId` wie ein Upload. Ein verlinktes Bild steht damit in derselben Liste wie eine hochgeladene Datei – für die Mediathek ein sauberes, einheitliches Datenmodell.

   **Aber `imageUrl` ist `null`.** `fileUrl` reicht nur die fremde Adresse durch. Der Bilddienst entfällt also: keine serverseitige Skalierung, kein Cache über ChurchTools, und der Player lädt von einem fremden Server. Die CSP erlaubt das für **Bilder** (`img-src *`), für **Videos nicht** (G15). Der Notausgang trägt – er kostet aber genau die Vorteile, die G14 gebracht hat.

**Löschen braucht eine Referenzzählung.** Die Mediathek erlaubt Löschen, und die Slides verweisen auf Dateien. Wer ein noch benutztes Bild entfernt, erzeugt einen kaputten Rahmen auf einem TV, den er nicht sieht. Der Designer zählt deshalb vor dem Löschen die Verwendungen und benennt sie – und der Player zeigt für eine fehlende Datei einen ruhigen Platzhalter statt eines Bruchsymbols.

**Der Bilddienst ist jetzt belegt** – die Regel ändert sich dadurch, statt zu entfallen. Für die **Anzeige** skaliert ChurchTools serverseitig, der Player fordert mit `?w=…&h=…&fit=max` genau die Bühnengröße an und muss nichts mehr im Browser verkleinern. Für den **Upload** bleibt es beim Herunterskalieren im Browser auf eine vernünftige Obergrenze: Ein 8-Megapixel-Handyfoto belegt sonst dauerhaft Speicher der Instanz, den niemand je ausliefert – und die 128 MB je Datei sind eine Grenze, kein Ziel.

Videos sind der Sonderfall: groß, und ein Pi der älteren Generationen spielt sie im Browser nicht zuverlässig ab. **Dazu kommt seit G15 eine harte Schranke:** Die CSP der Instanz kennt kein `media-src` und fällt damit auf `default-src 'self'` zurück – **externe Videoadressen sind blockiert.** Bilder von überall, Videos nur von der eigenen Domain. Der Notausgang „externe URL" (Kandidat 5) trägt also für Bilder, für Videos nicht. Sie kommen erst nach dem MVP und erst, nachdem sie auf der echten Hardware gemessen wurden.

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
- **Der `srcdoc`-Rahmen erbt die CSP der Hostseite** *(G15, gemessen 2026-09-23)*. Das ist der unangenehmste Befund für diesen Block: `script-src` erlaubt kein `'unsafe-inline'`, und ein Rahmen mit undurchsichtiger Herkunft bekommt keinen Nonce. **Ein eingebettetes Widget mit `<script>`-Tag läuft darin nicht** – gleichgültig, wie die Sandbox gesetzt ist. Was bleibt: HTML und CSS laufen (`style-src` erlaubt `'unsafe-inline'`), und **fremde Seiten über `src` laufen ebenfalls**, weil `child-src *` sie zulässt und sie ihre eigene Policy mitbringen. Die Folge für den MVP ist eine Zuspitzung, keine Absage: Die Variante „fremde Seite einbetten" trägt, die Variante „eigener JS-Schnipsel" trägt nicht. Das gehört in die Blockbeschreibung im Designer, nicht in eine Fehlermeldung zur Laufzeit – und es verschiebt das Gewicht von **Offene Entscheidung 4** (Web-Code-Block jetzt oder später?).

## Playlists und Zeitpläne

**Entschieden am 2026-09-23.** Anlass war der Betriebsfall, um den es eigentlich geht: Im Foyer stehen mehrere Fernseher, und vor dem Gottesdienst soll anderes laufen als danach.

**Mehrere Geräte sind bereits gelöst** – jeder Screen hat einen stabilen Slug, jedes Gerät seine eigene Player-URL. Dafür braucht es kein neues Konzept, wohl aber mehr Gewicht auf der `status`-Kategorie: Bei einem TV sieht man selbst, ob er läuft; bei fünfen will man im Designer ablesen, welches Gerät wann zuletzt gemeldet hat und welche Konfigurationsrevision es zeigt.

**Der Zeitplan dagegen ist keine Ergänzung, sondern eine Ebene.** Bisher lautete das Modell Screen → Slides; mit Zeitplänen lautet es **Screen → Playlist → Slides**. Der Screen wird damit zu „Geräteadresse plus Zeitplan", die Playlist zu „geordnete Menge von Slides". Diese Ebene nachträglich einzuziehen, wenn bereits Screens im Foyer laufen, hieße Bestandsdaten migrieren und ein zweites Mal die Schema-Hauptversion heben.

**Festlegung: Die Ebene kommt in Phase 1 ins Schema, die Oberfläche dazu kommt später.** Ein Screen ohne Zeitplan hat genau eine Playlist; im Designer ist davon zunächst nichts zu sehen, der Player wertet den Zeitplan aber schon aus. Das kostet in Phase 1 wenig und hält die Tür offen. Damit gehört der Punkt in dieselbe Kategorie wie Undo/Redo: architekturrelevant, vor Phase 1 zu entscheiden – und entschieden.

**Zwei Arten von Regel, beide vorgesehen:**

| Art | Beispiel | Wann sinnvoll |
| --- | --- | --- |
| **Nach Termin** | von 30 Minuten vor bis zum Beginn eines Termins im Kalender „Gottesdienst" | Der eigentlich gemeinte Fall |
| **Nach Uhrzeit** | sonntags 11:30–13:00 | Einfacher Rückfall, wenn kein Termin taugt |

Die Termin-Regel ist für dieses Projekt die bessere Antwort und seit **G19** auch die billigere: Die API löst Serien selbst auf, samt Ausnahmen, Zusatzterminen und Zeitumstellung, und der Player fragt Termine ohnehin ab. Fällt ein Gottesdienst aus, folgt das Foyer von selbst – niemand muss daran denken, den Zeitplan nachzuziehen. Die Uhrzeit-Regel ist vorhersagbarer, geht aber an Weihnachten und bei jedem Sondergottesdienst fehl.

**Drei Regeln, die der Zeitplan mitbringt:**

1. **Eine Standard-Playlist ist Pflicht.** Kein Treffer im Zeitplan darf nie „schwarzer Bildschirm" heißen. Dazu eine feste Vorrangregel bei Überschneidungen – sonst hängt das Verhalten von der Reihenfolge im JSON ab, und das ist keine Festlegung, sondern ein Zufall.
2. **Der Player wechselt die Playlist nicht, solange seine Uhr unbestätigt ist.** Bisher hieß eine falsche Uhr auf einem Pi ohne gepufferte Echtzeituhr: falsche Uhrzeit im Bild. Mit Zeitplänen heißt sie **falscher Inhalt**. Bis die Gerätezeit gegen die Zeit einer API-Antwort bestätigt ist, bleibt er auf der Standard-Playlist.
3. **Der Player hält alle Playlists vor, nicht nur die laufende.** Sonst steht er nach einem Netzausfall um 9:55 Uhr ohne die 10-Uhr-Playlist da. Das vergrößert den Offline-Vorrat und ist beim Zuschnitt in Abschnitt E mitzudenken.

**Slides gehören keiner Playlist.** Playlists verweisen auf Slide-IDs, dieselbe Slide darf in mehreren vorkommen – gemeinsame Inhalte wie Begrüßung oder Spendenhinweis werden einmal gepflegt. Der Preis ist die Fernwirkung: Wer eine Slide ändert, ändert sie überall. Der Designer weist deshalb beim Bearbeiten aus, in wie vielen Playlists eine Slide steckt, und bietet „nur hier ändern" als Kopie an. Die Referenzzählung beim Löschen, die es für Medien ohnehin braucht, gilt damit auch für Slides.

**Der Designer braucht einen Zeitregler in der Vorschau** – „was liefe jetzt?", „was liefe Sonntag 10:30?". Ohne ihn lässt sich ein Zeitplan erst am Sonntag prüfen, und dann steht man im Foyer. Der Regler gehört zur Zeitplan-Oberfläche, also in denselben späteren Schritt.

## Funktionsumfang

### Designer – MVP

- Screen-Verwaltung: anlegen, duplizieren, umbenennen, löschen; je Screen ein **stabiler Slug** als Adresse der Player-URL und eine Auflösung (Voreinstellung 1920×1080, quer und hoch). Ein Wechsel der Auflösung rechnet die Blöcke um, mit Vorschau und Rückgängig – siehe Abschnitt E.
- **Playlists**: je Screen im MVP genau **eine**, ohne Zeitplan-Oberfläche – die Ebene liegt aber im Schema und der Player wertet sie aus (siehe „Playlists und Zeitpläne"). Der Gestalter merkt davon nichts; nachgerüstet wird später nur die Oberfläche, nicht das Datenmodell.
- **Slides**: beliebig viele je Playlist, mit eigener Anzeigedauer und Übergang, Reihenfolge per Drag-and-drop, einzeln deaktivierbar. Eine Slide kann in mehreren Playlists vorkommen; der Designer weist das beim Bearbeiten aus und bietet „nur hier ändern" als Kopie an.
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

- Ein Einstiegspunkt, gesteuert über `?screen=<slug>&kiosk=1` – der Slug aus Abschnitt E, nicht die Datenbank-ID. Mehrere Fernseher sind mehrere Screens mit je eigenem Slug; ein neues Konzept braucht es dafür nicht.
- **Zeitplan auswerten**: Der Player entscheidet selbst, welche Playlist gerade gilt – er muss das offline können. Er hält deshalb **alle** Playlists eines Screens vor, nicht nur die laufende. Greift keine Regel, läuft die Standard-Playlist; sie ist Pflicht, damit „kein Treffer" nie „schwarzer Bildschirm" heißt.
- Seitenrotation nach hinterlegter Dauer. **Drei getrennte Intervalle**, weil sie verschiedene Fragen beantworten: die Rotation der Slides (Sekunden), die Aktualisierung der ChurchTools-Daten (Minuten) und die Aktualisierung der **Screen-Konfiguration** selbst (wenige Minuten). Das dritte fehlte bisher – ohne es merkt der TV nicht, dass jemand gerade eine Slide geändert hat. Wer im Designer speichert, will das Ergebnis sehen, bevor er das Haus verlässt; die Konfiguration ist klein genug, um sie häufig zu holen.
- **Die Uhr des Pi ist nicht selbstverständlich richtig – und mit Zeitplänen wird sie tragend.** Ein Raspberry Pi hat keine gepufferte Echtzeituhr. Nach einem Stromausfall startet er mit dem Zeitstempel des letzten Herunterfahrens, und bevor NTP greift, filtert der Player Termine gegen ein falsches Datum und zeigt eine falsche Uhrzeit. Bisher hieß das: falsche Uhrzeit im Bild. **Seit der Zeitplan dazukommt, heißt es: falscher Inhalt.** Der Player prüft deshalb die Gerätezeit gegen die Zeit der API-Antwort, zeigt lieber gar keine Uhr als eine falsche – und **wechselt die Playlist nicht, solange die Zeit unbestätigt ist**, sondern bleibt auf der Standard-Playlist.
- **Offline-Festigkeit auf drei Ebenen**: die Daten im IndexedDB (letzter erfolgreicher Stand, mit dezenter Alterskennzeichnung), die eigenen Assets und die Bilder über einen Service Worker – sofern `/ccm/` einen zulässt (G10). Ohne ihn bleibt eine Lücke: Ein Pi, der während eines Netzausfalls neu startet, hat nichts zu laden. Das ist dann ausdrücklich zu benennen, nicht zu übergehen.
- **Rücksicht auf die API**: Datenaktualisierung mit Backoff, Auswertung von `429` und `Retry-After`, und ein zufälliger Versatz auf dem Intervall – sonst fragen nach einem Stromausfall alle Screens in derselben Sekunde.
- Selbstheilung: Neuanmeldung über den Login-Token, Neuladen nach wiederholten Fehlern, nächtlicher Neustart der Seite – und ein Neuladen bei Modul-Ladefehlern nach einem Extension-Update.
- **Duldsam gegenüber neueren Daten**: unbekannte Blocktypen überspringen, unbekannte Felder ignorieren, bei höherer Schema-Hauptversion neu laden. Siehe Abschnitt E.
- **Ton ist standardmäßig aus.** Chromium spielt unstummgeschaltete Medien nicht von selbst ab; ein Video mit Ton bliebe im Kiosk schlicht stehen. Ob im Foyer überhaupt Ton gewünscht ist, ist eine Entscheidung, keine Technikfrage – bis sie fällt, läuft alles stumm.
- Keine Bedienelemente, kein Mauszeiger, kein Scrollbalken.

### Später

- Videos, gemessen auf der echten Pi-Hardware, und Bildstrecken.
- **Die Zeitplan-Oberfläche**: Regeln nach Termin und Uhrzeit anlegen, dazu der Zeitregler in der Vorschau („was liefe Sonntag 10:30?"). **Das Datenmodell dafür steht bereits in Phase 1** – nachgerüstet wird nur die Bedienung, nicht der Speicher.
- Zeit- und regelgesteuerte Einblendungen einzelner Blöcke („nur bis zum Termin") – feiner als die Playlist-Ebene und davon unabhängig.
- Mehrere Screens mit gemeinsamer Vorlage und Standortfilter.

## Phasen

| Phase | Inhalt | Ergebnis |
| --- | --- | --- |
| **0 – Machbarkeit** | **Überwiegend erledigt** (G1–G8, G11, G14, G15, G18, G19, G20; G16 zur Hälfte). Offen und **an der Freischaltung der Testinstanz hängend**: G9, G10, G12, G13. Dazu G17 als Entscheidung. Der Medienweg steht (Wiki-Kategorie, Bilddienst), die CSP ist gemessen, die Fixtures sind aufgezeichnet (lokal, nicht versioniert). Was bleibt: Boilerplate aufsetzen, leere Extension bauen, hochladen, aufrufen – sobald Custom Modules freigeschaltet sind | Ein „Hallo <Vorname>" aus `/whoami` läuft im echten ChurchTools. **Erreicht:** Es steht fest, wohin ein hochgeladenes Bild geht. Befunde stehen in diesem Plan, Belege lokal unter `fixtures/`. |
| **1 – Datenmodell** | Screen-Schema mit **Playlists**, Slides und Blöcken (Ebene Screen → Playlist → Slides, siehe „Playlists und Zeitpläne“) (versioniert, migrierbar, **in beide Richtungen duldsam**), aufgeteilt nach der 10.000-Zeichen-Grenze; Slug als Adresse; KV-Repository mit den Kategorien aus E; Medienreferenzen mit Referenzzählung; Konflikterkennung über `revision`; Export/Import; Mock und Fixtures für die Entwicklung ohne Instanz. Undo/Redo ist hier zu entscheiden, nicht später – es bestimmt, ob Änderungen als Zustand oder als Befehle geführt werden | Screens lassen sich speichern, laden und exportieren, ohne Oberfläche. |
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
- **Zeiten kommen in UTC und werden nach `Europe/Berlin` umgerechnet – immer über eine Zeitzonen-Bibliothek, nie über einen festen Offset.** ChurchTools hält die Ortszeit konstant und verschiebt die UTC-Darstellung über die Zeitumstellung (G19). Ein fester Offset zeigt ab Ende Oktober jeden Termin eine Stunde falsch, auf einem Gerät, das niemand kontrolliert.
- **Der Player belegt jede Anfrage mit `only_allow_authenticated=true` und prüft die Identität aus `whoami`.** Leere Daten ohne bestätigte Identität sind ein Fehlerzustand mit sichtbarer Meldung, kein leerer Kalender (G20).
- **Tests laufen nie gegen die Live-Instanz.** Grundlage sind aufgezeichnete API-Antworten unter `fixtures/`, gegen einen Mock gespielt. Ein Test, der eine Instanz und ein Passwort braucht, ist kein Test, sondern ein Handgriff. **Das Verzeichnis ist nicht versioniert** (Entscheidung vom 2026-09-23) – ein frisch geklonter Arbeitsplatz hat die Fixtures nicht und muss sie sich beschaffen, bevor die Tests laufen. Ein Generator für einen einzucheckenden, synthetischen Satz wurde erwogen und **verworfen**, solange die Fixtures nur lokal gebraucht werden.

- **Aufgezeichnet wird nur von der Testinstanz, nie von der Produktivinstanz** – und vor dem Ablegen wird bereinigt. Das ist keine Vorsichtsregel, sondern eine Lehre: Der erste Durchgang am 2026-09-23 war sorgfältig gemacht und übersah trotzdem zwei Klassen. **Zu entfernen sind mindestens:**

  | Klasse | Beispiel | Warum |
  | --- | --- | --- |
  | Personenbezogene Felder | E-Mail, Telefon, Anschrift, Geburtstag | Datenschutz |
  | Instanz-URL | `site_url`, `fileUrl`, `apiUrl` | Grundregel des Repos |
  | Schlüssel und Geheimnisse | **`site_licensekey`**, `*_apikey`, `*_token`, `*_secret` | Beim ersten Durchgang übersehen |
  | Datei- und Bild-Hashes | `/images/{id}/{hash}`, `filename=<hash>` | **Sind Zugangsschlüssel, keine Kennungen** – die `imageUrl` liefert anonym 200 (G14) |

  Der gefährlichste Fall steht nicht in der Tabelle: In `GET /api/config` sind `churchdb_mailchimp_apikey`, `churchservice_ccli_token` und `churchservice_ccli_token_secret` auf **unserer Testinstanz leer** – auf einer produktiven Instanz müssen sie das nicht sein. Eine Bereinigung, die auf die vorliegenden Daten zugeschnitten ist, ist keine Regel. Deshalb die erste Hälfte dieses Punktes.

  Nicht zu bereinigen sind dagegen Gruppen-, Kalender- und Dienstnamen. Sie sind organisatorisch und für eine Gemeinde weitgehend öffentlich – und realistische Namen sind als Testdaten wertvoll: Umlaute, Längen, Sonderzeichen, Namensgleichheiten. Wer sie wegkürzt, testet gegen eine Welt, die es nicht gibt.
- **Ein Test sichert die Sandbox.** Er verbietet `allow-same-origin` in jedem erzeugten `<iframe>`. Siehe Risiko 6.
- **Ein Test sichert die Duldsamkeit des Players.** Ein Screen mit einem erfundenen Blocktyp und einem unbekannten Feld muss rendern, nicht scheitern. Siehe Abschnitt E.
- **Der Player-Build hat keine nachzuladenden Chunks.** Eine Prüfung im CI schlägt an, wenn der Build für den Player mehr als ein JavaScript-Bündel erzeugt.
- **CI bei jedem Push**: Lint, Typecheck, Tests, Build. Der Tag-Workflow baut nur das Release, er ersetzt die Prüfung nicht.

## Risiken

1. ~~**Custom Modules sind auf der Instanz nicht verfügbar**~~ – **entfallen am 2026-09-22.** Feature freigeschaltet, Route antwortet, ein fremdes Modul läuft bereits. Der Ausweichweg über einen eigenen Renderer-Dienst wird nicht gebraucht und ist damit vom Tisch.
2. **Kein eigener Speicherort für hochgeladene Medien.** Die Datei-API nimmt Uploads an, aber nur in feste Domain-Typen; einer für Custom Modules fehlt. Bilderupload ist ausdrücklich gewünscht und für einen Infoscreen der meistgenannte Wunsch überhaupt – er hängt damit an einem Weg, der erst gefunden werden muss (Wiki-Mediathek, `attachments`, ersatzweise externe URLs). Das Ergebnis entscheidet über den Zuschnitt des MVP und gehört deshalb in Phase 0.
3. **Login-Token in der URL.** Bekannt, praxiserprobt, aber ein Dauerpasswort auf einer SD-Karte. Minimale Rechte bleiben Pflicht. Der Rückzugsweg ist seit dem 2026-09-23 bekannt und gemessen: **Passwort des Geräte-Benutzers ändern, der Token ist sofort tot** (G18). Er gehört in die Betriebsdoku, nicht in eine Fußnote – und er ist der Grund, warum das Risiko tragbar ist.
4. **Der Pi läuft unbeaufsichtigt.** Speicherlecks über Wochen, abgelaufene Sitzungen, Netzausfälle, Stromausfälle. Der Player muss von sich aus wieder hochkommen; ein weißer Bildschirm im Foyer ist der Regelfall schlechter Signage-Software.
5. **Einbettung in die ChurchTools-Oberfläche.** ~~Wenn sich die Host-Chrome nicht sauber ausblenden lässt, wird der Player unansehnlich.~~ **Entschärft** (G6, 2026-09-22): Kein iframe, gemeinsames Dokument – `position: fixed; inset: 0` deckt die Host-Chrome zu, ohne sie anfassen zu müssen. Was bleibt, ist die Stilgrenze in beide Richtungen.
6. **Eigener Web-Code ist ausführbarer Fremdcode auf der ChurchTools-Domain.** Ohne Sandbox liefe er in der Sitzung eines angemeldeten Benutzers und hätte Zugriff auf dessen ChurchTools-Daten – aus einem Gestaltungsmodul würde ein Einfallstor. Die Regel aus dem Abschnitt „Eigener Web-Code" ist deshalb nicht verhandelbar und wird durch einen Test abgesichert, der `allow-same-origin` in den erzeugten Rahmen verbietet.
7. **ChurchTools ändert die Extension-Schnittstelle.** Sie ist jung und gering dokumentiert. Die Abhängigkeit auf wenige Stellen bündeln (`src/utils/kv-store.ts`, ein Repository), damit eine Änderung nicht durch die halbe Anwendung geht.
8. **Stilles gegenseitiges Überschreiben.** Belegt, nicht vermutet: Am Datenwert gibt es weder Version noch ETag (G3). Ein Screen besteht aus mehreren Werten, gespeichert wird ohne Transaktion. Ohne `revision`-Prüfung und ohne die Regel „Index zuletzt schreiben" verliert der zweite Gestalter die Arbeit des ersten, ohne dass es jemandem auffällt. Und selbst mit beidem bleibt ein Fenster zwischen Lesen und Schreiben – erkannt, nicht verhindert.
9. **Ein Update der Extension bricht laufende Player.** Neue Asset-Namen, alter Kiosk-Tab, nachzuladender Chunk, 404, weißer Bildschirm – ausgelöst durch einen Upload, den jemand vormittags gemacht hat und der erst sonntags auffällt. Deshalb ein Bündel ohne Code-Splitting und ein Neuladen bei Modul-Ladefehlern, beides im CI geprüft.
10. **Die Instanz-URL landet im Release-Build.** Das Muster aus dem Boilerplate lautet `window.settings?.base_url ?? import.meta.env.VITE_BASE_URL` – so steht es auch in `ct-pass-store` –, und Vite ersetzt `import.meta.env.*` zur Bauzeit durch den Literalwert. Was beim Bauen in der `.env` steht, steht danach im Bündel. Für ein Paket, das andere Gemeinden installieren sollen, ist das eine fremde Adresse im Auslieferungsstand. Der Release-Build setzt `VITE_BASE_URL`, `VITE_USERNAME` und `VITE_PASSWORD` ausdrücklich leer, und ein Test im CI sucht im gebauten `dist/` nach der eigenen Instanzadresse.

## Offene Entscheidungen

Nicht technisch offen, sondern unentschieden – und jede dieser Antworten verändert den Zuschnitt:

1. **Hardware.** Wie viele Fernseher, welche Pi-Generation, welche Auflösung und Ausrichtung, läuft FullPageOS schon? Entscheidet über Videos, Overscan und Bühnenskalierung.
2. **Zielgruppe.** Nur für uns, oder von Anfang an für den Extension Store? Verändert Mehrsprachigkeit, Konfigurierbarkeit und Aufwand erheblich.
3. **Zuschnitt des MVP.** Ist der Web-Code-Block im MVP oder später? Er ist das riskanteste Stück des Moduls. Dasselbe für Geburtstage: mit Einwilligungsdialog hinein, oder für v1 ganz heraus?
4. **Wer gestaltet?** Nur wir, oder auch nicht-technische Ehrenamtliche? Verschiebt die Anforderungen an den Designer deutlich.
5. **Rückfallposition bei den Medien.** Wenn der Wiki-Weg scheitert: Ist „nur externe URLs" ein tragfähiger MVP, oder ist der Upload ein Muss?
6. **Zeitbudget.** Der Plan nennt sieben Phasen und keine einzige Aufwandsschätzung. Für ein Feierabendprojekt entscheidet genau das über den Zuschnitt.
7. **Editor-Umfang.** Rasterfang, Mehrfachauswahl, Kopieren zwischen Slides, Tastaturkürzel, Undo/Redo. Undo/Redo ist architekturrelevant und muss vor Phase 1 entschieden sein, der Rest nicht.

   **Erledigt am 2026-09-23 – die zweite architekturrelevante Frage dieser Art:** Ob Screens Playlists und Zeitpläne bekommen, ist entschieden. Die Ebene **Screen → Playlist → Slides** kommt in Phase 1 ins Schema, die Zeitplan-Oberfläche später; Slides werden von Playlists referenziert und dürfen mehrfach vorkommen. Begründung und Folgen stehen unter „Playlists und Zeitpläne".
8. **Wie schnell muss eine Änderung auf dem TV sein?** Zwei Minuten sind bequem und kosten API-Last mal Anzahl Screens; zehn Minuten sind sparsam und fühlen sich beim Gestalten falsch an. Die Antwort setzt das Konfigurationsintervall des Players.
9. **Ton im Foyer.** Läuft dort je etwas mit Ton, oder bleibt alles stumm? Entscheidet, ob der Videoblock überhaupt einen Lautstärkeregler bekommt – und ob die Autoplay-Regel von Chromium je zum Thema wird.
10. **Eigene Extension oder Beitrag zum Bestehenden?** `ct-pass-store` bringt mit `ct-utils` und `ct-extension-utils` genau die Schichten mit, die wir ebenfalls brauchen, und dessen Autor sucht ausdrücklich nach einem Ort für wiederverwendbaren Setup-Code. Eine gemeinsame Bibliothek statt einer dritten Kopie wäre für beide Seiten günstiger – kostet aber Abstimmung und Fremdabhängigkeit.


## Nächste Schritte

**Erledigt am 2026-09-22:** Version und Build der Instanz (3.136.2 / 32882), `feature_custommodule`, Antwort von `/api/custommodules`, KV-Grenzen aus der Spezifikation (G1, G2). Aus der Lektüre von `ct-pass-store`: Struktur des Datenwerts, Rechtemodell samt Endpunkt, Paketierungs- und Installationsweg (G3–G5).

Die Reihenfolge folgt dem Preis: erst was nichts kostet, dann was etwas kostet. Zum Abhaken steht dasselbe mit Handgriffen und Abbruchkriterien in [`Preparation.md`](Preparation.md).

1. ~~**Ein einziger Seitenaufruf, drei Antworten.**~~ **Erledigt am 2026-09-22** – der Quelltext von `/ccm/ctpassstore/` beantwortet G6 vollständig und G4 nebenbei. **Offen bleibt daran nur der Netzwerk-Reiter**: Welche Content-Security-Policy steht im Antwort-Header (G15)? Zwei Minuten, beim nächsten Aufruf.
2. ~~**Einen erfundenen Unterpfad aufrufen.**~~ **Erledigt am 2026-09-22**: `/ccm/ctpassstore/pasword` liefert die Modulseite, G7 ist beantwortet, der Player bekommt eine echte Route. Mitzunehmen beim nächsten Mal: der Statuscode dahinter.
3. **Boilerplate klonen**, `.env` anlegen, Vite-Proxy einrichten statt CORS zu öffnen, `npm run dev` bis zum „Hallo <Vorname>". Dabei einmal in Safari öffnen, nicht nur in Chrome.
4. **Die Speicher-Feinheiten am eigenen Testmodul messen**, sobald es steht: Nimmt `GET …/customdatavalues` einen Filter auf `domainType`/`domainId` an (G11)? Wird ein hinterlegtes JSON Schema serverseitig durchgesetzt (G12)? Was ändert `securityLevelId` (G13)? Drei Aufrufe, die den Zuschnitt aus Abschnitt E entweder bestätigen oder vereinfachen.
5. **Ein Bild über `POST /files/wiki_<kategorie>/<id>` hochladen**, wieder auslesen und **in einem `<img>`-Tag anzeigen**. Seit G14 ist die Frage schärfer gefasst: Trägt die hochgeladene Datei neben `fileUrl` auch eine `imageUrl` am Bilddienst? Davon hängen serverseitige Skalierung und Cachefähigkeit ab. Der Versuch, der über den Bilderupload entscheidet.
6. **Support anschreiben – und zwar zuerst wegen der Frist.** Die Testinstanz läuft nach 30 Tagen ab (etwa 2026-10-22); ob sich das für die Entwicklung einer Extension verlängern lässt, bestimmt, wie eng die Messungen getaktet werden müssen. **Seit dem 2026-09-23 steht eine zweite, dringendere Frage daneben:** die **Freischaltung der Custom Modules** für diese Instanz – ohne sie sind B5, B6, der C-Block, E1 und E4 blockiert (angefragt, Antwort steht aus). Im selben Schreiben die Frage nach einem dokumentierten Rate-Limit (G16); **entfallen** ist dagegen die Frage nach einem Speicherziel für Custom-Module-Dateien – die Wiki-Kategorie samt Bilddienst beantwortet sie (G8).
7. **`bensteUEM/ct-events-load` lesen**, insbesondere `src/persistance.ts` und die Terminbehandlung – vor der ersten eigenen Zeile Bindungscode in Phase 4, und bevor das Screen-Schema festgezurrt wird.
8. **Einen Betriebsbenutzer mit Minimalrechten bauen und prüfen** (**G21**) – vorgezogen, weil er ohne Custom Modules weiterkommt und drei offene Fragen auf einmal schließt. Er braucht ein Passwort, und das geht nur über die Oberfläche (**G18**). Person 19 auf der Testinstanz taugt dafür nicht – sie hat gar keine Rechte, ist aber als Messobjekt entstanden und hat kein Passwort. Anlegen **in der Oberfläche**, danach die vergebenen `authId`s über `GET /api/permissions/person` auslesen. Danach die URL am Pi aufrufen (G9), sobald Phase 2 steht.
9. **Lukas Block (`lubl`) im Forum ansprechen** – nicht, um Fragen zu stellen, die der Code beantwortet, sondern zu G8, G10 und der Idee einer gemeinsamen `ct-utils`-Bibliothek (Offene Entscheidung 10). Er betreibt dieselbe Schnittstelle produktiv und sucht ausdrücklich nach einem Ort für wiederverwendbaren Setup-Code.
10. **Befunde hier eintragen**, erst danach das Screen-Schema festlegen.

## Quellen

- ChurchTools Extension Boilerplate: <https://github.com/churchtools/extension-boilerplate> (README, `vite.config.ts`, `scripts/package.js`, `key-value-store.md`, `src/utils/kv-store.ts`)
- ChurchTools JS-Client: <https://github.com/churchtools/churchtools-js-client>
- Referenz-Extension eines Dritten: <https://github.com/aschojz/churchtools-extension-publisher> (README, `EXTENSION_STORE.md`)
- **Auf unserer Instanz laufende Fremd-Extension, MIT-lizenziert**: <https://github.com/lub90/ct-pass-store> – gelesen am 2026-09-22, Stand `main` (letzte Änderung 2026-02-14). Ergiebig sind `extension/src/ct-utils/lib/ExtensionData.ts` (KV-Zugriff), `extension/src/ct-utils/lib/Permissions.ts` (`/permissions/global`), `extension/src/utils/ct-types.d.ts` (generierter Typ-Snapshot vom 2025-09-02), `extension/vite.config.ts`, `extension/scripts/package.js`, `extension/README.md` (Rechtezuordnung je Rolle) und `extension/docs/setup.md` (Installationsweg). Autor Lukas Block, im ChurchTools-Forum als `lubl`.
- Extension mit Termin-Persistenz: <https://github.com/bensteUEM/ct-events-load> (`src/persistance.ts`) – Vorlage für Phase 4
- Generierter PHP-Client zur ChurchTools-API: <https://github.com/lub90/ct-php-client> (Fassung 3.126.2)
- OpenAPI der Demo-Instanz: `https://demo.church.tools/system/runtime/swagger/openapi.json` (3.136.2, Build 32882, 497 Pfade, abgerufen 2026-09-22)
- Infoscreen am Raspberry Pi mit FullPageOS: <https://forum.church.tools/topic/10280>
- Infoscreen mit eigenen Inhalten (Wünsche der Anwender): <https://forum.church.tools/topic/6252>
- Login-Token für den Infoscreen-Benutzer: <https://forum.church.tools/topic/11910>
- CORS in ChurchTools: <https://churchtools.academy/help/system-einstellungen/api/0-cors/>

- Kein offizielles Testsystem, Datenbank-Kopie kostenpflichtig: <https://forum.church.tools/topic/6264/testsystem>
- 30-Tage-Testinstanz: <https://church.tools/de/test-churchtools/> · Support: <support@churchtools.de>
- Eigene Instanz, Phase-0-Befunde vom 2026-09-22: `GET /api/info`, `GET /api/config`, `GET /api/custommodules` (angemeldet), sowie die `CustomModule*`-Schemas aus `openapi.json` der Instanz