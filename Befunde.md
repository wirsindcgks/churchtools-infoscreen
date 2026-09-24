# Befunde – das Messprotokoll der Phase 0

Dies ist das Laborbuch des Projekts: **was an der Instanz gemessen wurde, wann, womit und was widerlegt wurde.**
[`Plan.md`](Plan.md) ist das Gedächtnis und sagt, *was gebaut wird*; [`Preparation.md`](Preparation.md) ist die
Arbeitsliste und sagt, *was als Nächstes zu tun ist*. Diese Datei sagt, **worauf sich beides stützt**.

Ausgelagert am 2026-09-23. Das Protokoll war auf 262 Zeilen gewachsen und machte `Plan.md` zu zwei Dritteln zu einem
Messbericht – der Plan soll aber vom Produkt handeln.

**Zwei Regeln, die sich hier teuer erarbeitet haben:**

1. **Ein `404` der ChurchTools-API beweist nichts.** Jede Prüfung läuft angemeldet und mit ausreichenden Rechten,
   sonst ist ihr Ergebnis wertlos (Lehre aus G1).
2. **Zu ChurchTools-Verhalten wird vorab in der [ChurchTools Academy](https://churchtools.academy/de/) recherchiert**,
   nicht erst, wenn eine Messung unklar bleibt. Die API zeigt Zustände, die Dokumentation zeigt Regeln. Messung und
   Doku gehören gegeneinander gehalten, beides mit Quelle (Lehre aus G21).

---


Geprüft wird gegen die eigene Instanz, nicht gegen die Demo und nicht gegen eine Vermutung – dieselbe Regel wie in `kraichtal-wetter-hacs`. Als zweite Quelle gilt der Quellcode einer Extension, die auf dieser Instanz **läuft**; er beweist Verhalten, das keine Spezifikation zusagt.

**Eine durchgehende Nummerierung.** G1–G8, G11, G14, G15, G18–G20 und G22 sind beantwortet, G16 und G21 zur Hälfte; G12 und G13 sind hinfällig, der Rest offen.

**Sackgassen bleiben stehen, kurz und als solche gekennzeichnet.** Ein Plan, der nur die richtigen Wege nennt, lädt dazu ein, die falschen ein zweites Mal zu gehen. Die Nummer bleibt einem Punkt erhalten, auch wenn er wandert. (Der frühere „G4" für die KV-Grenzen heißt jetzt G2; die alte Doppelnummerierung – Buchstabenkürzel für Beantwortetes, eigene Zählung für Offenes – ist damit aufgelöst.)

## Beantwortet

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

**G6 – Kein iframe: Die Extension läuft im Dokument der Hostseite.** *(2026-09-22, Quelltext von `/ccm/ctpassstore/`)* ChurchTools liefert seine eigene Seite aus – `<base href="https://<instanz>/">`, die vollständige Hauptnavigation, der eigene Vue-Build unter `system/dist/assets/…` – und hängt die Extension in **denselben Dokumentkopf**:

```html
<script src="/ccm/ctpassstore/assets/index-BtWd1lCL.js" type="module"></script>
<link rel="stylesheet" href="/ccm/ctpassstore/assets/index-DNQr0TSY.css">
```

Kein `iframe`, kein eigenes Dokument, kein eigener Ursprung. Das Modul erscheint als eigener Punkt der Hauptnavigation („Sekundär-Passwort", neben Beiträge, Personen, Gruppen …) und rendert unterhalb der Navigationsleiste in deren Inhaltsbereich. Der Menüname kommt aus der Installation, nicht aus dem Modul: Die Oberfläche von `ctpassstore` ist englisch, der Eintrag deutsch.

Vier Folgen, bisher vorgesehen, jetzt belegt:

1. **Die Stile gehen in beide Richtungen** – siehe `Plan.md`, „Architektur“. Die Hostseite deklariert `@layer theme, base, oldcss, components, utilities`; ungeschichtetes CSS schlägt geschichtetes, die Bühne gewinnt also ohne `!important`. ChurchTools legt zudem ein globales Vuetify-Theme als `:root`-Variablensatz an – Variablennamen, die wir nicht benutzen dürfen.
2. **Der Player bekommt die Fläche nicht geschenkt.** Er rendert im Inhaltsbereich unterhalb der Navigation; der Kiosk-Modus wird damit Fallback (a), `position: fixed; inset: 0` über den gesamten Viewport.
3. **Die Asset-Namen tragen einen Build-Hash** (`index-BtWd1lCL.js`). Risiko 7 in `Plan.md` ist damit keine Theorie: Nach einem Upload zeigt ein wochenlang offener Kiosk-Tab auf Dateien, die es nicht mehr gibt. Ein Bündel ohne Code-Splitting bleibt Vorgabe.
4. **Die Einstellungen liegen im Dokument**, als JSON in `<script type="application/json" id="ct-settings-json">`: `base_url`, `files_url`, `csrfToken`, `version`/`jsversion`, die `modules`-Liste, das vollständige `auth`-Objekt (siehe G4) und der angemeldete Benutzer. Der Player kann das lesen, statt zu fragen – aber nur, solange ChurchTools die Seite baut, und **nicht für die Rechte**: Die Kopie im Dokument ist beschnitten und anders kodiert als die API-Antwort (siehe G4). Die Anmeldung des Pi (G9) ersetzt sie ohnehin nicht.

**G7 – Unbekannte Unterpfade fallen auf die Modulseite zurück.** *(2026-09-22, `/ccm/ctpassstore/pasword` – ein Pfad, den das Modul nicht kennt)* Die Seite kommt: ChurchTools-Navigation, Modul-Seitenleiste, leerer Inhaltsbereich. ChurchTools liefert für den unbekannten Pfad also die `index.html` der Extension aus, statt einen eigenen 404 zu zeigen. **Echte History-Routen sind damit möglich** – der Player darf auf `…/ccm/infoscreen-designer/player?screen=foyer-links` neu laden.

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
3. **`img-src *`** – externe Bilder sind erlaubt. Das stützt die Rückfallposition „externe URL“ (`Plan.md`, „Medien“).
4. **Kein `media-src`** – es fällt auf `default-src 'self'` zurück: **Externe Videos sind blockiert.** Bilder von überall, Videos nur von der eigenen Domain. Diese Asymmetrie trifft die Rückfallposition und die Videofrage unmittelbar: „nur externe URLs" trägt für Bilder, für Videos nicht.
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

**Nachtrag vom 2026-09-23, und er macht die Sache schlimmer.** Mit einem **angemeldeten, aber gering berechtigten** Konto (G21) treten **drei** Verhaltensweisen nebeneinander auf, und sie sind von außen nicht zu unterscheiden:

| Verhalten | Beispiel | Erkennbar? |
| --- | --- | --- |
| **403 mit Klartext** | `/wiki/categories/1/pages` → „Forbidden to see WikiCategory[1]" | ja |
| **200, still gefiltert** | `/calendars` → 3 statt 5 | nein |
| **200, leere Liste** | `/files/wiki_1/<Mediathek>` → 0 statt 2 Dateien | nein |

Der dritte Fall trifft ausgerechnet die **Mediathek**. Ein Player ohne Wiki-Recht zeigt Schwarz und meldet nichts – und `only_allow_authenticated` hilft hier gar nicht, denn die Anmeldung ist ja gelungen. Daraus folgt eine dritte Festlegung, unten als Punkt 3.

Zwei Festlegungen folgen daraus, beide gehören ins Datenmodell und nicht in ein späteres Review:

1. **Der Player hängt `only_allow_authenticated=true` an jede Anfrage.** Gemessen: Damit liefert `/api/whoami` anonym sauber **401** statt 200. Das ist der Schalter, der den stillen Fehler in einen lauten verwandelt.
2. **Der Player prüft nach dem Start die Identität**, nicht nur den Statuscode: Ist `whoami.data.id` die erwartete Person? Leere Daten ohne bestätigte Identität sind ein **Fehlerzustand mit sichtbarer Meldung**, kein leerer Kalender.
3. **Der Player prüft beim Start seine Rechte, statt auf Fehler zu warten.** Er liest `GET /permissions/global` und gleicht ab, ob er für jeden Block seines Screens das nötige Recht trägt. Fehlt eines, ist das eine **benannte Meldung** – nicht ein Block, der still leer bleibt.


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

**G22 – Nachträge aus Phase 1: zwei Fragen hinfällig, ein Geheimnis, eine Grenze.** *(2026-09-24, Spezifikation der Testinstanz aus `fixtures/schema/`, Testinstanz lesend, Code in `src/`)*

- **Kategorien haben weder Schema noch Sicherheitsstufe.** `CustomModuleDataCategory` führt auf Build 32882 nur `customModuleId`, `name`, `shorty`, `description` und `data` (max. 2.000 Zeichen). Die Felder `schema` und `securityLevelId` stammen – wie `domainType` bei G11 – aus dem überholten Snapshot von `ct-pass-store`. **G12 und G13 sind damit hinfällig**, nicht nur geparkt: Es gibt nichts durchzusetzen und keine Stufe zu setzen. Validiert wird allein im Client; die Schemas liegen in `src/model/schema.ts`.
- **`randomUrl` am Kalender ist ein Zugangsschlüssel.** Sie ist die geheime Adresse des iCal-Abonnements und stand unbereinigt in `fixtures/api/calendars.json` und `appointments.json`. Beide Dateien sind lokal nachbereinigt; **die externe Sicherung vom 2026-09-24 enthält sie noch.** Die Bereinigungsregel ist seitdem Code: `scripts/sanitize-fixture.js`, dort auch `iCalUid` und Hashes ab 32 Zeichen.
- **„Index zuletzt" schützt Neues, nicht Geändertes.** Neue Slides und Playlists sind unsichtbar, bis der Index geschrieben ist. Eine *bestehende* Slide wird dagegen an Ort und Stelle überschrieben: Bricht das Speichern danach ab, zeigt der Screen die neue Slide in der alten Reihenfolge. Verweise zeigen trotzdem nie ins Leere (Reihenfolge Slides → Playlists → Index), und jede Slide ist für sich vollständig. Für die Handvoll Gestalter hingenommen; die Abhilfe wäre Copy-on-write mit neuen IDs bei jedem Speichern.
- **Die Serie aus G19 ist jetzt aufgezeichnet** (`fixtures/api/appointments-series.json`) und durch Tests gesichert: neun Vorkommen, durchgehend 11:00 Ortszeit, Ausnahme 18.10. fehlt, Zusatztermin 04.11. enthalten.
- **`calendar_ids[]` kodiert der Client richtig.** Der `churchtools-client` nutzt axios ohne eigenen Serializer; axios schreibt Arrays als `calendar_ids[]=2&calendar_ids[]=4`, gegengeprüft mit `curl` an der Testinstanz.
- **Die Zeitzone steht in `/api/config`** als `timezone`, auch anonym (74 Schlüssel) – also für den Geräte-Benutzer lesbar. `Intl` genügt zum Rechnen; eine Zeitzonen-Bibliothek ist nicht nötig.

## Teilweise beantwortet

**G16 – Kein Limit in Reichweite, aber keine Zusage.** *(2026-09-23, Testinstanz)* 60 gleichzeitige Anfragen an `/api/whoami` in einer Sekunde: **alle 200**, kein `429`, und **keine Rate-Limit-Header** – weder `X-RateLimit-*` noch `Retry-After`. Weiter wurde nicht gedrückt.

Das misst die Reichweite, nicht die Regel. Mehrere Pis plus Designer liegen weit darunter, und der Player wertet `429` und `Retry-After` weiterhin aus – nur ist jetzt belegt, dass er sie im Normalbetrieb nicht zu sehen bekommt. Nach einer **dokumentierten** Grenze bleibt die Frage an den Support (F1) offen.
**G21 – Der Betriebsbenutzer, erstmals gegen ein echtes Konto gemessen.** *(2026-09-23, Testinstanz)* Abschnitt F beschrieb seinen Zuschnitt seit Beginn – aber als Absichtserklärung, nie geprüft. Seit dem 2026-09-23 gibt es Zahlen: Person 22 „Minimal User" (`statusId: 0`, Benutzername `muser`) ist angelegt, Mitglied der Gruppe 16 „Infoscreen-Geraete" in der Rolle Mitarbeiter, und es wurde **eine vollständige Sitzung als dieses Konto** geführt.

**Beim Anlegen: Ein Passwort allein genügt nicht.** Die Person braucht einen **Benutzernamen** (`cmsUserId`). Fehlt er, hat `POST /api/login/token` nichts, wogegen es prüfen könnte – jeder Versuch endet mit „Login fehlgeschlagen: Überprüfe Benutzername und Passwort", unabhängig davon, welches Passwort gesetzt wurde. `POST /api/persons` legt das Feld nicht mit an, und ohne hinterlegtes Postfach scheidet auch `POST /persons/{id}/invite` aus. Das gehört an den Anfang der Einrichtungsdoku, weil der Fehler sonst beim Passwort gesucht wird, wo er nicht liegt.

**Frage 1 – reicht der Zuschnitt? Die Nulllinie steht.** Gemessen **ohne eine einzige Gruppenberechtigung**, also allein aus dem Sockel des Personenstatus:

| Quelle | Administrator | Person 22 | Verhalten |
| --- | --- | --- | --- |
| `/calendars` | 5 | **3** | still gefiltert nach `view category` |
| `/calendars/appointments` Kal. 1–3 | 10 | **10** | identisch |
| `/calendars/appointments` Kal. 4 | 1 | **403** | ehrlicher Fehler |
| `/events` | 1 | **1** | identisch |
| `/services` | 8 | **8** | Stammdaten, ungeschützt |
| `/groups` | 8 | **1** | nur die eigene, über die Mitgliedschaft |
| `/persons` | 4 | **1** | nur sie selbst |
| `/wiki/categories` | 2 | **0** | |
| `/wiki/categories/1/pages` | 200 | **403** „Forbidden to see WikiCategory[1]" | |
| `/files/wiki_1/<Mediathek>` | 2 Dateien | **200 – 0 Dateien** | **stille Leere** |
| `/resources` | 7 | **0** | |
| `/posts` | 0 | 0 | unentscheidbar – die Instanz hat keine Beiträge |

**Der Sockel trägt mehr, als er sollte – und genug für einen ersten Block.** Ohne dass jemand etwas vergeben hätte, liest das Gerätekonto drei Kalender, zehn Termine, ein Event und acht Dienste. **Neun der zehn Termine tragen ein Bild mit `imageUrl`, für dieses Konto lesbar.** Ein Terminblock mit Bildern liefe heute schon. Das ist bequem und zugleich der Beleg für die additive Falle: Die drei Kalender hat niemand für den Screen bestimmt, und abstellen ließen sie sich nur über den Status **für alle**.

**Der wichtigste Einzelbefund: `view` ist kein API-Recht.** `churchcal.view` steht für dieses Konto auf `false` – und trotzdem liefert `/api/calendars` drei Kalender und `/api/calendars/appointments` dieselben zehn Termine wie dem Administrator. Ebenso `churchservice.view = false` bei identischem `/api/events`. Der Modulschalter „Kalender" sehen (`view`) steuert die **Sichtbarkeit des Moduls in der Oberfläche**, nicht den Zugriff über die API. Die Regel der ChurchTools-Dokumentation, man brauche stets beide Rechte, gilt für Menschen, die klicken – **nicht für einen Player, der liest**. Für den Betriebsbenutzer ist das ein Recht weniger auf der SD-Karte. *(Gemessen auf Build 32882; ob ChurchTools das als Zusage versteht, ist offen – der Player sollte ohne `view` auskommen, aber nicht daran zerbrechen, wenn es später anders wäre.)*

**Frage 2 – `site_licensekey`: Entwarnung.** `GET /api/config` liefert dem Administrator **154** Schlüssel, Person 22 aber nur **74** – und das sind **exakt dieselben 74, die auch ein anonymer Aufruf bekommt**. Dem Administrator vorbehalten bleiben unter anderem `site_licensekey`, `admin_mail`, `admin_ids`, `emailServer`, `access_control_allow_origins`, `churchdb_mailchimp_apikey` und `churchservice_ccli_token*`. **Der Lizenzschlüssel fährt nicht auf der SD-Karte mit.** Umgekehrt heißt das: Der Player kann sich an `/api/config` nicht von einem anonymen Aufrufer unterscheiden – die Identitätsprüfung aus G20 bleibt Pflicht.

**Frage 3 – die Reste aus G18.** `POST /api/login/token` **trägt für gültige Zugangsdaten**: Der so erzeugte Token beantwortet `/api/whoami` mit `id: 22`, also nicht mit dem anonymen Benutzer. Damit ist der Betriebsweg aus G18 durchgehend gemessen, mit Ausnahme des Archivierens als zweiter Notbremse – das steht noch aus und ist ein Schreibzugriff.

**Was offen bleibt:**

- **Welche `authId` welches Kalenderrecht ist** (306 gegen 403). Die Sitzung trennt sie nicht: Beide tragen `dataId [1, 2, 3]`, und `churchcal.view category` wie `churchservice.view events` stehen beide auf `[1, 2, 3]`. Es hilft nur, **ein einzelnes** Recht an Rolle 124 zu setzen und zurückzulesen.
- **Woran die Sichtbarkeit von Beiträgen hängt.** Ein Leserecht gibt es nicht (siehe Abschnitt F), und die Instanz hat keinen einzigen Beitrag – die Frage ist ohne Testbeitrag nicht zu beantworten.
- **Ob Archivieren der Gruppe als zweite Notbremse wirkt.**
- **Die Modulrechte selbst**, solange Custom Modules nicht freigeschaltet sind (T1). Die ChurchTools-seitige Hälfte ist aber die größere: Sie bemisst, was der Token auf der SD-Karte wirklich darf.


## Offen

**G9 – Wie verhält sich `login_token` in der URL bei einem Custom Module?** Beim nativen Infoscreen erprobt, für `/ccm/`-Pfade ungeprüft. `ct-pass-store` hilft hier nicht: Es benutzt Tokens gegenüber seinem eigenen Backend, nicht zur Anmeldung einer Seite. **Doppelt blockiert seit dem 2026-09-23:** Es fehlt das Custom Module (T1) *und* ein Token, an den ein Administrator regulär herankommt (**G18**).

**G10 – Darf unter `/ccm/<key>/` ein Service Worker registriert werden?** Entscheidet, ob Offline-Festigkeit vollständig erreichbar ist oder nur halb: IndexedDB sichert die Daten, aber nicht die eigenen Assets und nicht die Bilder. Ohne Service Worker zeigt ein Pi, der während eines Netzausfalls neu startet, einen weißen Bildschirm – genau der Fall aus Risiko 2 in `Plan.md`. Zu prüfen sind Scope, MIME-Typ und ob ChurchTools den Pfad umschreibt.

~~**G12 – Wird das JSON Schema einer Kategorie serverseitig durchgesetzt?**~~ **Hinfällig seit G22** – das Feld gibt es auf Build 32882 nicht.

~~**G13 – Was bewirkt `securityLevelId` an einer Kategorie?**~~ **Hinfällig seit G22** – das Feld gibt es auf Build 32882 nicht.

**G23 – Wie kodiert ChurchTools ganztägige und mehrtägige Termine?** Auf der Testinstanz gibt es keinen; `src/appointments/normalize.ts` nimmt an, dass ein Ende um Mitternacht Ortszeit exklusiv ist, und liest reine Datumswerte als inklusiv. **Zu messen mit je einem ganztägigen und einem mehrtägigen Termin – ein schreibender Zugriff auf die Testinstanz, also vorher abzustimmen.**

**G17 – Extension Store**: Aufnahmekriterien, Einreichungsweg, ob eine Veröffentlichung überhaupt angestrebt wird. Der Publisher hält seinen Store-Text in einer eigenen `EXTENSION_STORE.md` – ein Muster, das sich übernehmen lässt.

---

## Der Betriebsbenutzer – wie er eingerichtet wird und wie nicht


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

1. Eigene Gruppe anlegen, etwa „Infoscreen-Geräte". Als Gruppentyp **Dienst** – so schreibt es die ChurchTools-Dokumentation für eine reine Berechtigungsgruppe vor: *„Als Gruppentyp wählst du Dienst aus."* *(Korrektur vom 2026-09-23: Hier stand zuvor **Merkmal**, aus eigener Überlegung statt aus der Doku. Die zuerst so angelegte Gruppe wurde gelöscht und als Dienst neu angelegt.)* **Was der Typ mitbringt, ist gemessen:** Gruppe 16 trägt über `group_type_role` bereits **170** Zuweisungen. Auf die Rolle **Mitarbeiter** entfallen davon **8** – die wenigsten der fünf Rollen (Leiter und Co-Leiter tragen je 62) – und alle acht sind **gruppeninterne** Rechte (`+see group`, `+view service` …), keine globalen. Der Typ Dienst schleppt also nichts Globales ein, und Mitarbeiter ist belegt die schmalste Rolle.
2. **Die Gruppe auf Status „Aktiv" setzen.** Solange sie im **Entwurf** steht, sind die Rechte *nicht* wirksam: *„Permissions are not yet active as long as the group has the status Draft."* Wer das übersieht, sucht den Fehler beim Player.
3. Den Geräte-Benutzer als Mitglied aufnehmen – und ihm **einen Benutzernamen** (`cmsUserId`) geben, nicht nur ein Passwort. Ohne Benutzernamen scheitert `POST /api/login/token` unabhängig vom Passwort (G21).
4. Die Rechte **an der Rolle in dieser Gruppe** vergeben. Der Klickweg laut ChurchTools-Dokumentation:
   Rechteverwaltung → Reiter **Gruppen** → Gruppennamen anklicken → mit der Maus über die **Rolle** fahren →
   **Bearbeiten** → Berechtigungsbaum ausklappen → Haken setzen → Speichern.

   **Die Falle, die zwanzig Minuten kostet:** Der Reiter kennt eine Checkbox *„Nur Einträge mit Berechtigungen
   anzeigen"*. Ist sie aktiv, erscheinen nur Gruppen, *„denen mindestens eine Berechtigung gegeben wurde"* – die
   frisch angelegte Berechtigungsgruppe hat naturgemäß keine und **fehlt in der Liste, in der man sie gerade
   berechtigen will**. Daneben filtern Gruppentyp und Standort.

5. Anschließend `GET /api/permissions/group_role/{rolle}` auslesen und die vergebenen `authId`s notieren – die gemessene
   Zuordnung für die Einrichtungsdoku. Der Endpunkt gibt es auch je Rolle, das grenzt die Antwort eng ein.
   **Wer die Zuordnung Zahl → Recht gewinnen will, setzt jeweils ein einzelnes Recht und liest zwischendurch zurück** –
   werden mehrere auf einmal gesetzt, ist die Zuordnung wieder Auslegungssache.

**Was die Rolle bekommt** – jeweils so eng wie möglich, nicht „alle":

| Recht – Name in der Oberfläche (API-Schlüssel) | Umfang | Nur wenn |
| --- | --- | --- |
| Kalender: *Einzelnen Kalender sehen* (`view category`) | genau die Kalender, die ein Screen zeigt | Terminblock |
| Events: *Events von einzelnen Kalendern sehen* (`view events`) | dieselben **Kalender** – das Recht nimmt Kalender-IDs, keine Event-IDs | Gottesdienstblock |
| Events: *Dienste einzelner Dienstkategorien sehen* (`view servicegroup`) | die gezeigten Dienstkategorien | Dienstplanblock |
| Gruppen: *Gruppe inkl. ihrer Gruppenmitglieder sehen* (`view group`) | genau die Gruppen, die ein Screen zeigt | Gruppenblock |
| Wiki: *Einzelne Wiki-Kategorien sehen* (`view category`) | allein „Infoscreen-Medien" | Mediathek |
| Ressourcen: *Ressource sehen* (`view resource`) | die gezeigten Ressourcen | Raumbelegung |
| Custom Module | siehe Rollentabelle oben | sobald freigeschaltet (T1) |

**Der Modulschalter fehlt in dieser Tabelle mit Absicht.** Die ChurchTools-Dokumentation verlangt zu jedem Kategorierecht
zusätzlich das modulweite *„Kalender" sehen* (`view`) – und für Menschen, die klicken, stimmt das auch. **Für einen Player,
der liest, nicht:** Mit `churchcal.view = false` liefert `/api/calendars` trotzdem die berechtigten Kalender und
`/api/calendars/appointments` dieselben Termine wie dem Administrator (gemessen 2026-09-23, G21). `view` steuert die
Sichtbarkeit des Moduls in der Oberfläche, nicht den API-Zugriff. Der Betriebsbenutzer bekommt es deshalb **nicht** –
es wäre ein Recht mehr auf der SD-Karte ohne Gegenwert.

**Ein weiteres Recht braucht er ebenfalls nicht:** Die eigene Gruppenmitgliedschaft macht die Berechtigungsgruppe für ihn
sichtbar, ohne dass `view group` vergeben wäre. Für **andere** Gruppen gilt das nicht.

**Und eine zweite Notbremse, die dabei abfällt:** *„[Permissions] lose their effectiveness once the group has the status Archived."* Wird die Berechtigungsgruppe archiviert, verliert das Gerät **sofort alle** darüber vergebenen Rechte – unabhängig davon, ob sein Login-Token noch gültig ist. Zusammen mit dem Passwortwechsel (G18) gibt es damit zwei voneinander unabhängige Wege, ein Gerät stillzulegen: einen, der die **Anmeldung** beendet, und einen, der die **Sichtbarkeit** beendet. Der Sockel aus dem Personenstatus bleibt von beidem unberührt.

**Der Rechtekatalog ist seit dem 2026-09-23 vollständig bekannt** – nicht aus der Spezifikation, sondern aus der
Rechteverwaltung selbst: Sie führt jedes Recht mit **Klarnamen und API-Schlüssel in Klammern**, und die Schlüssel decken
sich Zeichen für Zeichen mit denen, die `GET /permissions/global` zurückgibt. Damit ist die Zuordnung **Name → Schlüssel**
erledigt. Was fehlt, ist allein die Zuordnung **Schlüssel → Zahl**.

**Die gemessenen `authId`s** – der Anfang dieser letzten Zuordnung:

| `authId` | `dataId` | Bedeutung | Beleg |
| --- | --- | --- | --- |
| 131 | Sicherheitsstufe | Personen: eigene Personendaten **sehen** (`security level view own data`) | Status 0 trägt 131 mit `dataId 2`; die Sitzung zeigt `= [2]` |
| 132 | Sicherheitsstufe | Personen: eigene Personendaten **bearbeiten** (`security level edit own data`) | ebenso |
| 306 | Kalender-IDs | `view category` **oder** `view events` | siehe unten |
| 403 | Kalender-IDs | die jeweils andere der beiden | siehe unten |

**Warum 306 und 403 weiterhin nicht getrennt sind.** Dass es die beiden Kalenderrechte sind, ist doppelt belegt: Am
Personenstatus 0 tragen beide `dataId [1, 2, 3]`, und die Sitzung dieses Kontos zeigt `churchcal.view category = [1,2,3]`
und `churchservice.view events = [1,2,3]`. An der Gruppe 11 „Gemeindeleitung" tragen alle fünf Rollen beide authIds mit
`dataId 4` – und Kalender 4 heißt „Gemeindeleitung". **Die Zahlen laufen aber immer im Doppel**, deshalb trennt sie keine
Messung an bestehenden Zuweisungen. Es hilft nur, **genau eines** der beiden Rechte an einer Rolle zu setzen und
anschließend `GET /api/permissions/group_role/{rolle}` zu lesen. Ein Haken, ein Aufruf.
