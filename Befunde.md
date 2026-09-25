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

**Eine durchgehende Nummerierung.** G1–G9, G11, G14, G15, G18–G20, G22–G32 und G35 sind beantwortet, G16, G21, G33, G34, G36 und G37 zur Hälfte; G12 und G13 sind hinfällig, der Rest offen (zuletzt G37).

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

**Nicht gemessen, und deshalb nicht behauptet:** ob `POST /persons/{id}/archive` als zweite Notbremse wirkt – siehe **G21**. Dass `POST /login/token` für *gültige* Zugangsdaten einen brauchbaren Token liefert, stand hier zuerst als ungemessen; **G21, Frage 3** hat es seither bestätigt (`whoami` antwortet mit `id: 22`).

**Drei Sackgassen, damit sie niemand erneut geht:** `DELETE …/logintoken` als Widerruf (403). `GET …/loginstring` als Ausweg (dieselbe Sperre). Und `POST /api/simulate`, das technisch funktioniert – `whoami` liefert die simulierte Person samt `meta.simulatingUserId`, der Zustand endet mit `DELETE /api/simulate` – aber ein Umweg um ein Problem war, das es nicht gab. Festzuhalten bleibt allein, dass eine Simulation an der Antwort erkennbar ist.

**G22 – Nachträge aus Phase 1: zwei Fragen hinfällig, ein Geheimnis, eine Grenze.** *(2026-09-24, Spezifikation der Testinstanz aus `fixtures/schema/`, Testinstanz lesend, Code in `src/`)*

- **Kategorien haben weder Schema noch Sicherheitsstufe.** `CustomModuleDataCategory` führt auf Build 32882 nur `customModuleId`, `name`, `shorty`, `description` und `data` (max. 2.000 Zeichen). Die Felder `schema` und `securityLevelId` stammen – wie `domainType` bei G11 – aus dem überholten Snapshot von `ct-pass-store`. **G12 und G13 sind damit hinfällig**, nicht nur geparkt: Es gibt nichts durchzusetzen und keine Stufe zu setzen. Validiert wird allein im Client; die Schemas liegen in `src/model/schema.ts`.
- **`randomUrl` am Kalender ist ein Zugangsschlüssel.** Sie ist die geheime Adresse des iCal-Abonnements und stand unbereinigt in `fixtures/api/calendars.json` und `appointments.json`. Beide Dateien sind lokal nachbereinigt; **die externe Sicherung vom 2026-09-24 enthält sie noch.** Die Bereinigungsregel ist seitdem Code: `scripts/sanitize-fixture.js`, dort auch `iCalUid` und Hashes ab 32 Zeichen.
- **„Index zuletzt" schützt Neues, nicht Geändertes.** Neue Slides und Playlists sind unsichtbar, bis der Index geschrieben ist. Eine *bestehende* Slide wird dagegen an Ort und Stelle überschrieben: Bricht das Speichern danach ab, zeigt der Screen die neue Slide in der alten Reihenfolge. Verweise zeigen trotzdem nie ins Leere (Reihenfolge Slides → Playlists → Index), und jede Slide ist für sich vollständig. Für die Handvoll Gestalter hingenommen; die Abhilfe wäre Copy-on-write mit neuen IDs bei jedem Speichern.
- **Die Serie aus G19 ist jetzt aufgezeichnet** (`fixtures/api/appointments-series.json`) und durch Tests gesichert: neun Vorkommen, durchgehend 11:00 Ortszeit, Ausnahme 18.10. fehlt, Zusatztermin 04.11. enthalten.
- **`calendar_ids[]` kodiert der Client richtig.** Der `churchtools-client` nutzt axios ohne eigenen Serializer; axios schreibt Arrays als `calendar_ids[]=2&calendar_ids[]=4`, gegengeprüft mit `curl` an der Testinstanz.
- **Die Zeitzone steht in `/api/config`** als `timezone`, auch anonym (74 Schlüssel) – also für den Geräte-Benutzer lesbar. `Intl` genügt zum Rechnen; eine Zeitzonen-Bibliothek ist nicht nötig.

**G24 – Einen öffentlichen Design-Guide für Extensions gibt es nicht; das Styleguide-Paket ist intern.** *(2026-09-24, GitHub und npm)* Weder die Academy noch das Boilerplate beschreiben, wie eine Extension aussehen soll. Die Liturgie-Extension [`niklasarnitz/churchtools-liturgy-editor`](https://github.com/niklasarnitz/churchtools-liturgy-editor) bindet `@churchtools/styleguide`, `@churchtools/design-system`, `@churchtools/colors` und `@churchtools/fontawesome-pro` ein – aber per `file:` aus einer **lokalen ChurchTools-Codebasis** (`../../work/churchtools/frontend-packages/…`). Auf npm gibt es keines dieser Pakete; Font Awesome Pro ist zudem lizenzpflichtig. Für eine Community-Extension ist dieser Weg verschlossen. Belegt ist dabei zweierlei: ChurchTools baut seine Oberfläche mit **Tailwind v4** (passt zu den `@layer`-Namen aus G6), und Vue ist der gemeinsame Nenner.

**Nebenfund: [`churchtools/churchtools-extension-points`](https://github.com/churchtools/churchtools-extension-points)** (MIT, Version 0.0.1, Stand 2025-11) beschreibt einen neueren Einhängemechanismus: Einstiegspunkte `main` (eigener Menüpunkt) und `admin` (Einstellungsseite unter Admin → Extensions), dazu Reiter und Detailbereiche in fremden Modulen. Eine Extension bekommt dort `{ data, on, emit, element }` statt eines `#app`-Elements. Ob Build 32882 ihn schon nutzt, ist offen – `ct-pass-store` hängt sich klassisch an `#app`. **Nach der Freischaltung mitzuprüfen**, weil es entscheidet, wie `main.ts` einhängt.

**G23 – Ganztägige Termine kommen als reine Daten mit einschließlichem Ende.** *(2026-09-24, Testinstanz – drei eigens angelegte Termine in „Sonstige Veranstaltung": id 7, 10, 13)* `GET /calendars/appointments` liefert bei `allDay: true` in `base` **und** `calculated` reine Daten: ein Tag als `2026-10-03 → 2026-10-03`, eine Freizeit als `2026-10-16 → 2026-10-18` – das Ende ist der letzte Tag, nicht der Tag danach. Termine mit Uhrzeit bleiben ISO mit `Z`, auch über mehrere Tage (`2026-11-06T17:00:00Z → 2026-11-08T13:00:00Z`, Ortszeit Fr 18:00 bis So 14:00). Aufgezeichnet unter `fixtures/api/appointments-allday.json`.

**Ein Fehler, den erst die Messung zeigte:** Die Normalisierung setzte das Ende eines reinen Datums auf den *Beginn* des letzten Tages – eine Freizeit wäre am letzten Morgen um 0 Uhr vom Bildschirm verschwunden. Jetzt endet sie mit dem letzten Tag, per Test gesichert.

**Beim Anlegen zu wissen:** `POST /calendars/{id}/appointments` verlangt `isInternal` als ausdrücklichen Wahrheitswert, sonst 400 – dasselbe Muster wie `inMenu` bei Wiki-Kategorien (G8).

**G25 – Das Design der Hostseite ist über semantische CSS-Variablen erreichbar.** *(2026-09-24, Stylesheet `system/dist/assets/index-*.css` der Testinstanz, anonym gelesen)* ChurchTools setzt Tailwind v4 ein und legt 761 Variablen auf `:root`. Brauchbar sind nicht die Paletten (`--color-blue-600`), sondern die **semantischen Tokens** `--color-{basic|accent|info|success|warning|critical|error|destructive|constructive|magic}-{primary|secondary|tertiary|bright|b-pale|b-bright|b-contrast|divider|interactive|inverted|disabled}`; `.dark` belegt 250 davon neu, der Dunkelmodus kommt also mit. Dazu `--font-sans` (Lato, von ChurchTools selbst ausgeliefert), `--text-base` = 14 px und `--radius-*`. Der Designer nutzt eine Handvoll davon mit Ersatzwerten (`src/designer/theme.css`); die Bühne keine – sonst hinge das Foyer an einem Update der Hostseite.

**Nachtrag vom 2026-09-24:** Auch der **eingebaute Infoscreen** setzt Lato – sein Stylesheet `system/dist/assets/InfoScreen-*.css` der Testinstanz, anonym gelesen, nennt siebenmal `font-family: Lato` und als Stärke nur Fett (700). Lato ist deshalb die Standardschrift neuer Blöcke. ChurchTools definiert „Lato" auf seiner eigenen Seite; eigene Schriften brauchen darum eigene Namen, sonst mischen sich die Schnitte beider Seiten.

**G26 – Ohne Wiki gibt es keinen sauberen Bildspeicher.** *(2026-09-24, vollständige Spezifikation der Testinstanz über eine Sitzung, dazu drei Versuche an der Testinstanz)* Die `domainType`-Liste ist auf Build 32882 unverändert (`avatar` … `post`, `wiki_.?`); einen Speicherort für Extensions gibt es nicht. Zwei Kandidaten sind geprüft:

- **`attachments` ist ein Zwischenlager.** `POST /files/attachments/<beliebig>` antwortet 200 – mit `id: null`, ohne `imageUrl`, Ersteller „Person −5". Danach ist die Datei unter keiner Adresse zu finden. Vermutlich der Zwischenspeicher für E-Mail-Anhänge. Sackgasse.
- **Bild-Assets einer E-Mail-Vorlage tragen, sind aber ein Missbrauch.** `POST /htmltemplates/{id}/uploadassets` legt das Bild in den Bilddienst (`/images/{id}/{hash}`, anonym abrufbar, `w`/`h` wirken). Dagegen spricht: Eine private Vorlage gehört ihrem Ersteller und verschwindet mit ihm, sie erscheint im E-Mail-Dialog, wo sie jemand arglos löscht, und die API listet die Assets einer Vorlage nicht. Die Testvorlage ist wieder gelöscht.

Die Website-Dateiverwaltung der Academy gehört zum kostenpflichtigen Produkt „ChurchTools Website" und fällt für eine Community-Extension aus. **Festlegung: eigene Wiki-Kategorie, je Screen eine Seite als Bildträger, dazu eine Übersichtsseite mit Anleitung.**

**G27 – Vier Eigenheiten des Wiki-Wegs.** *(2026-09-24, Testinstanz: Kategorie 1 in „Infoscreen" umbenannt, Seite `demo` angelegt, Testbilder hoch- und wieder heruntergeladen)*

- **Hochladen verkleinert nichts.** `max_width`/`max_height` am Upload bleiben ohne Wirkung: Ein 320 px breites Bild mit `max_width=100` kommt mit unveränderten 95 335 Byte an. Verkleinert wird deshalb im Browser, auf 3840 px an der langen Kante.
- **Lesen per Titel, Ändern nur per GUID.** `GET /wiki/categories/{id}/pages/main` findet die Seite über ihren Titel; `PATCH` auf denselben Pfad antwortet 400 („keine gültige GUID"). Geändert wird über `page.guid`.
- **Die Seitenliste hat keine Seitenaufteilung.** `churchtoolsClient.getAllPages` scheitert an `/wiki/categories/{id}/pages`, weil die Antwort keine Paginierungsdaten trägt; ein einfaches `get` liefert alle Seiten.
- **Der Geräte-Benutzer braucht kein Wiki-Recht.** Die Bilder erreicht er über die `imageUrl`, die ohne Anmeldung trägt (G14). Rechte auf den Wiki-Bereich brauchen nur die Gestalter.

**G28 – Cache Storage trägt Bilder über Neustarts, aber nur mit dauerhaftem Profil.** *(2026-09-24, Playwright mit Chromium und WebKit am Entwicklungsserver, dazu eine Mediathek-Datei der Testinstanz)* Der Player legt jedes Bild beim ersten Durchlauf in Cache Storage ab und zeigt es als `blob:`-Adresse, was die CSP erlaubt (G15). Ein Service Worker ist dafür nicht nötig. In Chromium lädt die Seite nach einem Neuladen mit gesperrtem Bilddienst alle Bilder aus dem Cache. Zwei Einschränkungen gehören dazu:

- **Ein flüchtiger Browserkontext behält nichts.** Der Standardkontext von Playwright-WebKit verhält sich wie ein privates Fenster: Cache Storage lebt nur im Arbeitsspeicher und ist nach dem Neuladen leer, und IndexedDB lehnt Blobs ganz ab. Mit dauerhaftem Profil (`launchPersistentContext`) übersteht der Cache in WebKit Neuladen und Browser-Neustart. **Kiosk-Geräte brauchen ein dauerhaftes Profil**; das gehört in die Einrichtungsdoku, ein Inkognito-Kiosk verliert den Vorteil.
- **Cache Storage gibt es nur im sicheren Kontext.** Unter `https://` ist das gegeben, im Betrieb also immer. Wo es fehlt, lädt der Player die Bilder wie bisher über das Netz.

**G29 – Das Gemeindelogo liegt anonym unter `/logo`, aber nur in 150×150.** *(2026-09-24, Testinstanz: Logo vom Nutzer in den Gemeindeinfos hinterlegt; Anmeldeseite anonym in Chromium mitgeschnitten, dazu die Spezifikation und die [Academy](https://churchtools.academy/de/kurse/system-einstellungen-berblick/lektionen/gemeindeinfos/))* Die Academy führt das Logo unter den „Gemeindeinfos" der Systemeinstellungen, getrennt von den beiden Website-Logos für hellen und dunklen Grund. Den Hinweis auf den anonymen Weg gab der Nutzer: Die Anmeldeseite zeigt das Logo.

- **Der Weg für den Player ist `<instanz>/logo`** – keine API-Route, anonym, ohne Hash in der Adresse. Die Anmeldeseite lädt `/logo?fit=true`. Die Antwort ist ein `302` ohne `cache-control` auf die Adresse des Bilddienstes, `/images/<id>/<hash>?fit=contain`.
- **`/logo` verwirft `w`, `h` und `fit`**: Das Ziel ist immer dasselbe und liefert die Vorgabe von 150×150 (G14). Für einen Kopfblock auf einer 1920 Pixel breiten Bühne ist das zu klein. Also der Weiterleitung folgen, das Ziel ablesen und `w` und `h` selbst setzen – der Bilddienst selbst hält sich daran (anonym 400×400 auf Anfrage), `max-age=604800, public`, kein ETag.
- **Wechselt das Logo, wechselt das Ziel** (neue Datei-id, neuer Hash). Wer das Ziel bei jedem Datenabruf neu auflöst und als Schlüssel für Cache Storage nimmt (G28), bekommt ein neues Logo ohne eigene Gültigkeitsregel.
- **Die API-Route braucht Rechte:** `GET /api/profiles/church` → `data.logo` trägt dieselbe `imageUrl`, antwortet anonym aber mit `403`; `GET /api/profiles` anonym mit `200` und **leerer** Liste, als Administrator mit zwei unveröffentlichten Profilen (G20). Die Datei liegt unter `domainType` **`profile_logo`**, `domainId` = id des Kirchenprofils. `/info` kennt kein Logo, und `site_logo` fehlt unter den 154 `config`-Schlüsseln des Administrators, obwohl das `Config`-Schema es führt.
- **Sackgasse:** `GET /api/files/logo/{id}` antwortet für jede id mit `200` und leerer Liste – falscher `domainType`, kein Beleg für „kein Logo".

**Ungemessen:** was `/logo` liefert, wenn **kein** Logo hinterlegt ist. Der Player behandelt alles außer einem Bild als „kein Logo" und zeigt dann nur den Namen.

**G30 – Rollenrechte kommen als Nummern; den Katalog dazu hat nur die alte Schnittstelle.** *(2026-09-24, Testinstanz, nur lesend: `GET /api/permissions/group_role/{id}`, `GET /api/groups/{id}/roles`, dazu `POST ?q=churchauth/ajax` und `POST ?q=churchdb/ajax` mit `func=getMasterData`)*

- **`GET /api/permissions/group_role/{rolle}`** liefert je Recht `authId`, `dataId` (eine Zahl je Eintrag, etwa eine Kalender-id), `type: "grant"` und `isInherited` – **ohne Namen**. Eine Rolle ohne Rechte antwortet mit leerer Liste (Rolle 124 der Gruppe 16). Die Rollen einer Gruppe liefert `GET /api/groups/{id}/roles` (id, Name, `isDefault`).
- **Eine Route, die `authId` in Namen übersetzt, hat die neue API nicht.** Die alte Schnittstelle hat sie: `churchauth` → `getMasterData` → `auth_table`, je Modul jedes Recht mit id, API-Namen und der Bezeichnung aus der Oberfläche. Sie verlangt eine **Sitzung mit CSRF-Token**; mit `Authorization: Login` allein antwortet sie mit `302`. Custom Modules fehlen darin, solange sie abgeschaltet sind (T1).
- **Damit ist die offene Frage aus G21 beantwortet:** `306` ist `churchservice` → „Events von einzelnen Kalendern sehen", **`403` ist `churchcal` → „Einzelnen Kalender sehen"**. Für die Termine eines Screens braucht das Gerät 403; 306 gehört zum Dienstmodul. Dazu `churchwiki`: 501 „Wiki" sehen, 502 einzelne Kategorien sehen, 503 einzelne Kategorien bearbeiten, 599 Stammdaten bearbeiten.
- **Gruppenstatus** steht in `information.groupStatusId` von `GET /api/groups/{id}`; die Namen nur in `churchdb` → `getMasterData` → `groupstatus`: **1 aktiv, 2 Entwurf, 3 archiviert, 4 beendet**. Laut [Academy](https://churchtools.academy/de/help/rechteverwaltung/gruppen-berechtigen/28-wann-sind-rechte-von-gruppenmitgliedern-wirksam/) wirken Rechte bei „aktiv" und „beendet", nicht im Entwurf, und gehen mit dem Archivieren verloren.

**Für die Einrichtungsseite folgt:** Die wenigen Kernrechte, die sie prüft (403, 501–503), stehen als Konstanten im Code – die alte Schnittstelle zur Laufzeit zu brauchen, hieße, an einer Sitzung und einem Altsystem zu hängen. Die Rechte-Nummern der Extension selbst sind erst nach der Freischaltung zu lesen; ob sie je Instanz verschieden sind, ist offen.

**G31 – Nach der Freischaltung: Module nur über ihre id, Spezifikation noch ohne Modul-Pfade.** *(2026-09-24, Testinstanz, nur lesend, unmittelbar nach der Freischaltung durch ChurchTools)*

- **`GET /api/custommodules/{id}` nimmt nur die numerische id.** Mit dem Schlüssel (`/custommodules/infoscreen-designer`) antwortet ChurchTools `400` „validation.integer" – nicht `404`. Eine unbekannte id antwortet `404` „CustomModule [999] not found". Das Modul einer Extension findet man über die Liste `GET /api/custommodules` und deren `shorty`. Unser Code fragte bis dahin mit dem Schlüssel; ungeprüft war er ausdrücklich markiert.
- **Nachtrag vom 2026-09-24:** Auch mit installiertem Modul und allen Modulrechten enthält die Spezifikation **keinen einzigen** `/custommodules`-Pfad (497 Pfade) – nur die neun Schemas. Der Typ-Snapshot für die Modul-Routen ist auf diesem Build nicht zu haben; die Typen bleiben handgeschrieben nach den Schemas.
- **Die Spezifikation enthält als Administrator weiterhin keinen `/custommodules`-Pfad** (497 Pfade, wie vor der Freischaltung), obwohl die Route selbst antwortet. Sie ist also nicht allein nach dem Feature gefiltert. Der Typ-Snapshot (B5) wartet deshalb weiter – vermutlich bis ein Modul installiert ist; das ist zu prüfen.

**G36 – Zur Hälfte beantwortet: Ohne „Im Menü anzeigen" verschwindet der Bereich nicht, er rutscht unter „Ausgeblendet".** *(gemessen am 2026-09-25 auf der Testinstanz, mit OK des Nutzers)* `PUT /wiki/categories/1` mit `{name, sortKey, campusId, inMenu: false, fileAccessWithoutPermission}` → `200` (`GET` auf die einzelne Kategorie gibt `405`, erlaubt sind nur `PUT` und `DELETE`). Danach zeigt die Wiki-Oberfläche den Bereich für ein Konto mit Bearbeiten-Recht (das Entwicklungskonto) **nicht mehr unter „Kategorien", sondern in einer eigenen, zuklappbaren Gruppe „Ausgeblendet"** darunter; der direkte Link `/wiki/1` öffnet ihn wie zuvor, die API liefert weiter alle Seiten. Anschließend zurückgestellt auf `inMenu: true`. **Nicht gemessen:** die Ansicht eines Gestalters ohne Adminrechte – nach der Forumsbeobachtung vermutlich dieselbe. **Folge:** Verbergen im strengen Sinn geht nicht, aus dem Blick räumen schon – ausreichend für die Idee „die Mediathek im Designer, das Wiki im Hintergrund". Ursprüngliche Frage: **Verschwindet ein Wiki-Bereich ohne „Im Menü anzeigen" auch für die, die ihn bearbeiten dürfen?** *(Frage vom 2026-09-25)* Idee des Nutzers: die Mediathek im Designer zeigen und den Wiki-Bereich „Infoscreen" dahinter im Wiki gar nicht erst anzeigen. ChurchTools kennt dafür je Bereich `inMenu` („Im Menü anzeigen", in `GET /wiki/categories` sichtbar); der Assistent legt den Bereich bisher mit `inMenu: true` an (`src/media/wiki.ts`). **Was bekannt ist, reicht nicht:** Im [Forum](https://forum.church.tools/topic/7141/wiki-kategoriename-und-anzeige-separat-einstellen) beobachtet ein Nutzer, dass ein Bereich mit Leserecht trotz ausgeschaltetem „Im Menü" im Wiki-Menü erscheint („ist das ein Bug?"); ein ChurchTools-Mitarbeiter lässt offen, ob Bearbeiter ihn sehen sollen. Gestalter brauchen das Bearbeiten-Recht für den Upload (G8) – genau für sie ist die Wirkung ungewiss. **Messung, schreibend, vorher zu besprechen:** am Bereich „Infoscreen" der Testinstanz `inMenu` ausschalten; dann im Wiki nachsehen als Administrator und als Mitglied von „Infoscreen-Designer" (Menü, Suche, direkter Link), danach zurückstellen. Unabhängig vom Ergebnis: Verbergen ist Ordnung, kein Schutz – die Bilder sind über den Bilddienst ohnehin ohne Anmeldung erreichbar (G14).

**G35 – Öffentliche Kalender brauchen für angemeldete Konten trotzdem das Leserecht, und ein fehlendes kippt die ganze Anfrage.** *(2026-09-24, Testinstanz: Player im Browser des Nutzers, angemeldet als Geräte-Benutzer `muser`; Screen „foyer" und Rechte danach gelesen)*

- Der Slide „Willkommen" zeigt die Kalender 1–5. `muser` darf 1–3 über seinen Personenstatus (G21) und 4 über die Gruppe „Infoscreen-Devices". **Kalender 5 „Bandproben" ist öffentlich** (`isPublic: true`), `muser` hat darauf kein Recht – und `GET /api/calendars/appointments?calendar_ids[]=1…5` antwortet mit **`403` für die ganze Anfrage**, nicht mit einer gefilterten Liste.
- **Folgen, umgesetzt:** Der Einrichtungsassistent vergibt „Einzelnen Kalender sehen" für jeden genutzten Kalender, die Ampel verlangt es; der Player fragt nach einem `403` die Kalender einzeln ab und lässt nur die verbotenen weg. Und er zeigt den Screen, sobald er geladen ist – bis dahin blieb er bei einem Datenfehler auf „Lade …" stehen.
- **Nebenbei gemessen:** Die Rechte, die der Assistent an eine Rolle gibt, kommen beim Mitglied an – „Claude Code" hatte als Leiter von „Infoscreen-Designer" in `/permissions/global` genau diese Rechte (G34).

## Teilweise beantwortet

**G37 – Zur Hälfte beantwortet: Öffentliche Beiträge öffentlicher Gruppen liest jeder, auch ohne Anmeldung und das Geräte-Konto; eingeschränkte Gruppen bleiben beiden verborgen; die API liefert Markdown.** *(2026-09-25, Testinstanz, Schreibzugriffe mit Freigabe des Nutzers: zwei Testbeiträge, eine öffentliche Testgruppe)* **Academy vorab:** Eingebettet wird über `/posts/feeds/main?embedded=true`; ohne Anmeldung sichtbar ist ein Beitrag nur, wenn **Gruppe und Beitrag** öffentlich sind ([Beiträge einbetten](https://churchtools.academy/en/help/app-en/administration-posts/24-how-to-embed-posts-on-my-website/)). Ein Beitrag ist entweder `group_intern` (nur Mitglieder) oder `group_visible` (so sichtbar wie die Gruppe); **wer die Sichtbarkeit einer Gruppe erhöht, setzt alle ihre Beiträge auf „nur Mitglieder" zurück** ([Beiträge für Gruppen](https://churchtools.academy/en/help/churchtools-modules/administration-posts/24-how-to-set-up-posts-for-my-groups/)). „Eingeschränkt" heißt: sichtbar nur mit einem Recht wie „Gruppen eines Gruppentyps sehen" oder über die Mitgliedschaft ([Gruppensichtbarkeiten](https://churchtools.academy/de/help/app/gruppen-berechtigen/0-gruppensichtbarkeiten/)). **Gemessen:** Alle neun Gruppen der Testinstanz stehen auf `restricted`, bei allen ist `postsEnabled: true` mit `defaultPostVisibility: group_visible`. `GET /api/post/groups` nennt dem Entwicklungskonto (Person 16) nur Gruppe 25 „Infoscreen-Designer" (Rolle Leiter). `POST /api/posts` mit `{groupId: 25, title, content, visibility: "group_visible", commentsActive: false, expirationDate: "2026-10-22T19:53:00Z"}` → `200`, Beitrag **id 1**, läuft mit der Testinstanz ab.

| Aufruf | Antwort |
| --- | --- |
| angemeldet (Person 16), `GET /api/posts` | 1 Beitrag; `content` **als Markdown-Text, unverändert** (`\n\n`, `**fett**`), dazu `publishedDate`, `images`/`imagesMeta` (Bilder vorher separat hochzuladen, höchstens 8), `group` mit `visibility`, `actor` |
| ohne Anmeldung, `GET /api/posts` | `200`, **leere Liste** – still gefiltert (G20) |
| ohne Anmeldung, `GET /api/posts/1` | `403` „Forbidden to see post[1]" – belegt, dass die leere Liste nichts beweist |
| ohne Anmeldung, `/posts/feeds/main?embedded=true` | `200`, darf eingebettet werden (weder `X-Frame-Options` noch `frame-ancestors`); die Seite baut sich per JavaScript auf und hätte hier nichts zu zeigen |

**Zweite Messung, mit öffentlicher Gruppe.** `POST /api/groups` mit `{name: "ISD-Beitragstest", groupTypeId: 4, groupStatusId: 1, visibility: "public"}` → `201`, **Gruppe 31**; die Sichtbarkeit steht danach unter `settings.visibility` (nicht unter `information`), Beiträge sind eingeschaltet wie überall. Neu angelegt, nicht hochgestuft – die Warnung der Academy trifft so nicht. **Aufnehmen als Leiter:** `PUT /api/groups/31/members/16` mit der Rollen-id **des Gruppentyps** (`groupTypeRoleId: 30`) → `200`; die id der Rolle in der Gruppe aus `GET /groups/31/roles` (280) lehnt ChurchTools mit `400` ab und nennt die erlaubten Werte (`[30, 29]`). Erst danach nennt `/post/groups` die Gruppe, vorher antwortete `POST /api/posts` mit `403`. Beitrag **id 4**, `group_visible`, läuft am 2026-10-22 ab.

| Ohne Anmeldung | Antwort |
| --- | --- |
| `GET /api/posts` | `200`, **genau der öffentliche Beitrag** (id 4), der aus Gruppe 25 fehlt |
| `GET /api/posts/4` | `200` |
| `GET /api/posts/1` | weiter `403` |
| `/posts/feeds/main?embedded=true` im Browser (Playwright, ohne Cookies) | zeigt den öffentlichen Beitrag mit Gruppe, Autor, Zeit, Reaktionen und „Teilen" – eine Seite zum Bedienen, nicht für den Fernseher gestaltet |

**Folgen:** Der Player muss Markdown selbst darstellen (wie der CHANGELOG: als Daten, nie als HTML). Ohne Anmeldung trägt nur eine **öffentliche Gruppe**; dann liefert die API aber **auch den Namen des Autors** (`actor.title`) an jeden – ein Baustein sollte ihn nur auf Wunsch zeigen. Die Einbettungsseite taugt für den Fernseher wenig; ein eigener Baustein über `/api/posts?group_ids[]=…` passt besser zum Design. **Dritte Messung, als Geräte-Konto** *(am selben Tag, nur lesend, mit dem Login-Token von Person 22 aus der Adresse eines Fernsehers)*:

| Als Geräte-Konto (Person 22) | Antwort |
| --- | --- |
| `GET /api/posts` | `200`, **nur der öffentliche Beitrag** (id 4, Gruppe 31) |
| `GET /api/posts/1` (Gruppe 25, eingeschränkt, kein Mitglied) | `403` |
| `GET /api/posts?group_ids[]=25` | `200`, leere Liste |
| `GET /api/groups` | nur Gruppe 31 |
| `GET /api/persons/22/groups` | **leere Liste** – der Administrator sieht für dieselbe Person die aktive Mitgliedschaft in Gruppe 28 „Infoscreen-Devices" (Rolle 29) |

**Das Geräte-Konto sieht damit nicht mehr als ein anonymer Aufruf:** öffentliche Beiträge ja, eingeschränkte Gruppen nicht, nicht einmal die eigene Gruppe 28 – eine Mitgliedschaft allein macht eine eingeschränkte Gruppe für das Mitglied nicht sichtbar (passt zur Academy: dafür braucht es ein Recht wie „Gruppeninfos sehen"; stille Leere wie in G20). **Offen, für den Baustein aber nicht blockierend:** ob das Geräte-Konto Beiträge einer **internen** Gruppe liest (laut Academy für jedes Benutzerkonto sichtbar) und ob ein Mitglied einer eingeschränkten Gruppe deren Beiträge liest. Beides bräuchte einen weiteren Schreibzugriff. Gruppe 31 bleibt dafür vorerst stehen.

**Vierte Messung, ein Beitrag aus der Oberfläche** *(am selben Tag, vom Nutzer in Gruppe 31 geschrieben, Beitrag id 7, danach nur lesend)*: `content` ist **schlichter Text** (ohne Formatierung geschrieben – ob die Oberfläche Markdown überhaupt anbietet, ist damit offen). Das Bild steht zweimal: in `images` als Adresse und in `imagesMeta` als `{imageUrl, aspectRatio}` (hier `1`). Die Adresse ist die des **Bilddienstes** (`/images/<id>/<hash>`, wie G14) und lädt **ohne Anmeldung und als Geräte-Konto** mit `200`, auch mit `w`/`h`/`m=crop`. `actor.title` ist der **Klarname** des Schreibenden. `group.color` ist ein Farbname (`{key: "teal", shade: null}`), kein Farbwert. `/api/posts` liefert die neuesten zuerst, `limit` und `group_ids[]` wirken (auch mehrere Gruppen in einer Anfrage).

**G34 – Gruppen und Rollenrechte lassen sich per API anlegen und restlos entfernen.** *(2026-09-24, Testinstanz, Schreibzugriffe mit Freigabe des Nutzers: Testgruppe „ISD-Test" angelegt und wieder gelöscht)*

- **`POST /api/groups`** mit `{"name", "groupTypeId", "groupStatusId": 1}` antwortet `201`; die Rollen legt ChurchTools nach dem Gruppentyp selbst an – beim Typ „Merkmal" (hier id 4) „Teilnehmer" (Standardrolle) und „Leiter". Gruppentypen und ihre Namen sind je Instanz anpassbar; ein Assistent sucht sie über `GET /api/group/grouptypes`, nicht über eine feste id.
- **`PUT /api/groups/{id}/members/{personId}`** mit `{"groupTypeRoleId", "groupMemberStatus": "active"}` nimmt auf (`200`), `DELETE` entfernt (`204`).
- **`DELETE /api/groups/{id}?dry_run=true`** listet Verweise und `deletionBlockers`, ohne zu löschen; ohne den Parameter löscht es (`204`, danach `404`). Ein Rückweg für einen Assistenten ist damit gemessen.
- **`PUT /api/permissions/group_role/{id}` trägt – gemessen am 2026-09-24 durch den Einrichtungsassistenten, ausgelöst vom Nutzer auf der Testinstanz.** Beide Gruppen („Infoscreen-Designer" 25, „Infoscreen-Devices" 28) tragen danach an beiden Rollen genau die geplanten Rechte; ein `dataId`-Array wird zu je einem Eintrag pro id, ein Recht ohne `dataId` steht mit `dataId: null`. Ob ein weggelassenes `dataId` bei Datenrechten „alle Kategorien" bedeutet, bleibt ungeprüft – der Assistent vergibt die Kategorien einzeln. Ebenfalls noch offen: ob die Rechte beim Mitglied ankommen (die Designer-Gruppe war beim Nachsehen leer). Ein Versuch des Agenten selbst war zuvor von der Sicherheitsprüfung seiner Sitzung blockiert worden.

- **`DELETE /api/permissions/group_role/{id}` mit `{authId, dataId: [eine id]}` nimmt genau diese Zuweisung zurück – gemessen am 2026-09-25.** Ausgelöst vom Nutzer mit „Rechte aktualisieren" (Fassung `aa6d2c6`), danach lesend geprüft: Beide Rollen von „Infoscreen-Designer" tragen die Rechte 2016–2018 nur noch für die Kategorien 4, 7 und 10 (Playlists, Slides, Medien), die Zuweisungen für Kategorie 1 (Screens) sind weg; das Mitglied „Claude Code" sieht in `/permissions/global` für `create/edit/delete custom data` entsprechend `[4, 7, 10]`. Die übrigen Rechte blieben unberührt. **Nebenbefund:** Ein ChurchTools-Administrator („administer persons") hat damit nicht automatisch Schreibrechte auf Screens – die Oberfläche richtet die Screen-Knöpfe seitdem nach dem Modulrecht, nicht nach dem Adminrecht.

**G33 – Installiert, aber ohne Modulrecht unsichtbar – auch für den Administrator.** *(2026-09-24, Testinstanz direkt nach dem Hochladen der Extension durch den Nutzer, nur lesend)*

- **`GET /api/custommodules` antwortet mit leerer Liste**, obwohl die Extension installiert ist. `GET /api/permissions/global` führt `infoscreen-designer` aber bereits mit allen neun Schlüsseln – alle auf „nein" (`view: false`). Eine leere Liste heißt hier also „nicht freigegeben", nicht „nicht da" (G20, A4).
- **Die Rechte des Moduls** stehen im Katalog der alten Schnittstelle (G30) unter dem Modul `infoscreen-designer`: **2010** „Infoscreen Designer" sehen; **2011–2014** Kategorien sehen, erstellen, bearbeiten, löschen; **2015–2018** Daten in Kategorie sehen, erstellen, bearbeiten, löschen. Die Datenrechte beziehen sich auf `ccm_data_category`. Ob die Nummern auf jeder Instanz gleich sind, ist offen – sie sehen nach laufender Vergabe beim Installieren aus.
- **`/ccm/infoscreen-designer/` antwortet anonym wie angemeldet mit `200`** – mit der ChurchTools-Seite, aber **ohne unser Skript**; `settings.modules` nennt das Modul. Vermutlich hängt ChurchTools das Skript ohne Recht 2010 nicht ein (anders als in G6, wo das Recht bestand). Zu prüfen, sobald Rechte vergeben sind – ebenso, ob die Spezifikation dann Modul-Pfade enthält (weiterhin 497 Pfade, keiner davon für Custom Modules).


**G32 – Eine Sitzung aus dem Login-Token hält 24 Stunden, fest.** *(2026-09-24, Testinstanz, nur lesend: `GET /api/whoami?login_token=…`, danach zwei Anfragen mit dem erhaltenen Cookie)* Die Anmeldung setzt `ChurchToolsV2_<instanz>` mit `Max-Age=86400`. Folgeanfragen senden das Cookie mit **demselben Ablaufdatum** zurück, `Max-Age` zählt nur herunter (86397, 86396) – die Sitzung verlängert sich durch Benutzung **nicht**. Wer sich einmal anmeldet und dann nur abfragt, ist nach 24 Stunden abgemeldet. **Nachtrag vom 2026-09-25 (Nutzer, Testsystem):** Ein Screen mit Weg B (G9) lief über 24 Stunden durch, ohne Auffälligkeiten – die Neuanmeldung über die Adresse trägt über das Ende der ersten Sitzung hinaus.

**Für Weg A** (Anmeldung im Browser des Fernsehers, entschieden am 2026-09-24) ist damit die entscheidende Frage offen: Hält eine Anmeldung über das Formular mit „Angemeldet bleiben" (`show_remember_me: true`) länger? Die [Academy](https://churchtools.academy/en/help/my-churchtools/register-and-log-in-en/register-and-log-in-on-the-web/) sagt nur „für die Dauer der aktuellen Browsersitzung". Zu messen mit den Zugangsdaten eines Geräte-Kontos. Hält sie nicht, braucht der Dauerbetrieb Weg B – der Player meldet sich mit dem Token selbst neu an (Plan.md, D).

**Zwischenstand 2026-09-25, 08:47 (vom Nutzer beobachtet):** Der Geräte-Benutzer hatte sich am 2026-09-24 gegen 22:28 im Browser (Chrome) über das Formular angemeldet, Player-Tab offen. Rund zehn Stunden später zeigt der Player noch Daten, auch nach einem Neuladen von Hand; das nächtliche Neuladen (03–04 Uhr) hat die Anmeldung ebenfalls nicht verloren. **Das beantwortet die Frage nicht** – eine feste 24-Stunden-Sitzung wäre ebenso noch gültig. Entscheidend ist das Ablaufdatum des Cookies `ChurchToolsV2_…` in den Entwicklerwerkzeugen oder ein Blick nach 2026-09-25, 22:30.

**Beantwortet am 2026-09-25: Auch „Angemeldet bleiben" hält nur 24 Stunden.** Das Cookie `ChurchToolsV2_…` im Browser des Geräte-Benutzers läuft am **2026-09-25T20:27:39Z** ab – 24 Stunden nach der Anmeldung über das Formular, obwohl der Player die ganze Nacht alle paar Minuten abgefragt hat. Die Sitzung verlängert sich durch Benutzung nicht, genau wie beim Token (oben). **Weg A trägt damit keinen Dauerbetrieb:** Nach einem Tag ist der Fernseher abgemeldet, und nach dem nächsten Neuladen bindet ChurchTools unser Skript gar nicht mehr ein (G9, G33). Der Dauerbetrieb braucht Weg B.


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
| `/posts` | 0 | 0 | unentscheidbar – die Instanz hat keine Beiträge (Nachtrag: G37) |

**Der Sockel trägt mehr, als er sollte – und genug für einen ersten Block.** Ohne dass jemand etwas vergeben hätte, liest das Gerätekonto drei Kalender, zehn Termine, ein Event und acht Dienste. **Neun der zehn Termine tragen ein Bild mit `imageUrl`, für dieses Konto lesbar.** Ein Terminblock mit Bildern liefe heute schon. Das ist bequem und zugleich der Beleg für die additive Falle: Die drei Kalender hat niemand für den Screen bestimmt, und abstellen ließen sie sich nur über den Status **für alle**.

**Der wichtigste Einzelbefund: `view` ist kein API-Recht.** `churchcal.view` steht für dieses Konto auf `false` – und trotzdem liefert `/api/calendars` drei Kalender und `/api/calendars/appointments` dieselben zehn Termine wie dem Administrator. Ebenso `churchservice.view = false` bei identischem `/api/events`. Der Modulschalter „Kalender" sehen (`view`) steuert die **Sichtbarkeit des Moduls in der Oberfläche**, nicht den Zugriff über die API. Die Regel der ChurchTools-Dokumentation, man brauche stets beide Rechte, gilt für Menschen, die klicken – **nicht für einen Player, der liest**. Für den Betriebsbenutzer ist das ein Recht weniger auf der SD-Karte. *(Gemessen auf Build 32882; ob ChurchTools das als Zusage versteht, ist offen – der Player sollte ohne `view` auskommen, aber nicht daran zerbrechen, wenn es später anders wäre.)*

**Frage 2 – `site_licensekey`: Entwarnung.** `GET /api/config` liefert dem Administrator **154** Schlüssel, Person 22 aber nur **74** – und das sind **exakt dieselben 74, die auch ein anonymer Aufruf bekommt**. Dem Administrator vorbehalten bleiben unter anderem `site_licensekey`, `admin_mail`, `admin_ids`, `emailServer`, `access_control_allow_origins`, `churchdb_mailchimp_apikey` und `churchservice_ccli_token*`. **Der Lizenzschlüssel fährt nicht auf der SD-Karte mit.** Umgekehrt heißt das: Der Player kann sich an `/api/config` nicht von einem anonymen Aufrufer unterscheiden – die Identitätsprüfung aus G20 bleibt Pflicht.

**Frage 3 – die Reste aus G18.** `POST /api/login/token` **trägt für gültige Zugangsdaten**: Der so erzeugte Token beantwortet `/api/whoami` mit `id: 22`, also nicht mit dem anonymen Benutzer. Damit ist der Betriebsweg aus G18 durchgehend gemessen, mit Ausnahme des Archivierens als zweiter Notbremse – das steht noch aus und ist ein Schreibzugriff.

**Was offen bleibt:**

- ~~**Welche `authId` welches Kalenderrecht ist** (306 gegen 403).~~ **Beantwortet durch G30**, ohne Schreibzugriff: 306 ist „Events von einzelnen Kalendern sehen" (Dienstmodul), 403 „Einzelnen Kalender sehen".
- **Woran die Sichtbarkeit von Beiträgen hängt.** Ein Leserecht gibt es nicht (siehe Abschnitt F), und die Instanz hat keinen einzigen Beitrag – die Frage ist ohne Testbeitrag nicht zu beantworten.
- **Ob Archivieren der Gruppe als zweite Notbremse wirkt.**
- **Die Modulrechte selbst**, solange Custom Modules nicht freigeschaltet sind (T1). Die ChurchTools-seitige Hälfte ist aber die größere: Sie bemisst, was der Token auf der SD-Karte wirklich darf.

## Offen

**G9 – Beantwortet: ChurchTools nimmt `login_token` in der Adresse einer Extension-Seite an – schon beim Laden, vor unserem Skript.** *(2026-09-25, Testinstanz, nur lesend: `curl` ohne Cookies auf `/ccm/infoscreen-designer/player?screen=foyer`, mit dem Token des Entwicklungskontos, Person 16)*

| Aufruf | Antwort |
| --- | --- |
| ohne Anmeldung, ohne Token | `200`, die ChurchTools-Seite **ohne unser Skript** – bestätigt die Vermutung aus G33 |
| ohne Anmeldung, mit `login_token=…&user_id=16` | `302`; setzt `ChurchToolsV2_…` mit `Max-Age=86400`, löscht das alte Cookie `ChurchTools_ct_…`; **`Location` ist dieselbe Adresse ohne `login_token`**, `user_id` bleibt |
| der Weiterleitung gefolgt, mit dem neuen Cookie | `200`, **unser Skript ist eingebunden** |

**Folgen für den Player (Weg B):**
- Eine Kiosk-Startadresse mit `login_token` meldet das Gerät **bei jedem Laden** neu an – auch nach einem Neustart mit abgelaufener Sitzung. Das löst G32.
- **Unser Skript sieht den Token nie:** ChurchTools hat ihn schon aus der Adresse genommen, bevor die Seite lädt. Die eingebaute Neuanmeldung des Players (`ensureSignedIn`, liest `login_token` aus der Adresse) greift deshalb nicht. Ein Neuladen des Players (nachts, nach Fehlern) lädt die Adresse **ohne** Token – nach Ablauf der 24 Stunden also die Seite ohne Skript.
- **Der Ausweg, gemessen am selben Tag:** den Token zusätzlich hinter `#` mitgeben. Das Fragment geht nicht an den Server, und der Browser hängt es bei einer Weiterleitung ohne eigenes Fragment wieder an – **in Chromium und WebKit bestätigt** (frischer Browser ohne Cookies, echte Adresse der Testinstanz: `302`, `200`, Token nur noch im Fragment, Player sichtbar). Der Player liest ihn dort und lädt sich selbst nur über die Adresse **mit** Token neu; so erneuert schon das nächtliche Neuladen die Sitzung jeden Tag. Gebaut als Weg B (Plan.md, D). **Nachtrag vom selben Tag (Nutzer im echten Chrome, gegengeprüft mit `curl`):** Ist der Browser **schon angemeldet**, antwortet ChurchTools auf die Adresse mit Token mit `200` **ohne** Weiterleitung – der Token bleibt dann in der Adresszeile stehen. Der Player nimmt ihn deshalb selbst heraus (`history.replaceState`, Query und Fragment) und hält ihn für eigene Neuladungen im `sessionStorage` des Tabs. Das ist Ordnung, kein Schutz: In der Kiosk-Einstellung und im Verlauf steht er weiter.

*Die ursprüngliche Frage, zur Nachverfolgung:* Wie verhält sich `login_token` in der URL bei einem Custom Module?** Beim nativen Infoscreen erprobt, für `/ccm/`-Pfade ungeprüft. `ct-pass-store` hilft hier nicht: Es benutzt Tokens gegenüber seinem eigenen Backend, nicht zur Anmeldung einer Seite. **Doppelt blockiert seit dem 2026-09-23:** Es fehlt das Custom Module (T1) *und* ein Token, an den ein Administrator regulär herankommt (**G18**).

**G10 – Darf unter `/ccm/<key>/` ein Service Worker registriert werden?** Entscheidet, ob Offline-Festigkeit vollständig erreichbar ist oder nur halb: IndexedDB sichert die Daten, aber nicht die eigenen Assets und nicht die Bilder. Ohne Service Worker zeigt ein Pi, der während eines Netzausfalls neu startet, einen weißen Bildschirm – genau der Fall aus Risiko 2 in `Plan.md`. Zu prüfen sind Scope, MIME-Typ und ob ChurchTools den Pfad umschreibt.

~~**G12 – Wird das JSON Schema einer Kategorie serverseitig durchgesetzt?**~~ **Hinfällig seit G22** – das Feld gibt es auf Build 32882 nicht.

~~**G13 – Was bewirkt `securityLevelId` an einer Kategorie?**~~ **Hinfällig seit G22** – das Feld gibt es auf Build 32882 nicht.



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
