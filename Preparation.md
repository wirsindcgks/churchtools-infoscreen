# Phase 0 – Vorbereitungs-Checkliste

Abzuarbeiten vor der ersten Zeile Anwendungscode. Jeder Punkt nennt, **was zu tun ist**, **woran man das
Ergebnis erkennt** und **welche Frage aus [`Befunde.md`](Befunde.md)** er beantwortet. Befunde gehören danach in
[`Befunde.md`](Befunde.md). Diese Datei ist die **Arbeitsliste**, `Befunde.md` das **Messprotokoll**, [`Plan.md`](Plan.md) das **Gedächtnis**.

Die Reihenfolge folgte bisher dem Preis: erst was nichts kostet, dann was Zeit kostet, zuletzt was Daten
anfasst. **Seit dem 2026-09-22 gilt ein anderer Taktgeber.**

> **✅ Stand 2026-09-28 – die Frist ist aufgehoben**
>
> ChurchTools hat am 2026-09-28 geantwortet (F1): *„dein Entwicklersystem ist für die Zeit der
> Extensionentwicklung für [dich] kostenfrei nutzbar. Wir prüfen regelmäßig die Nutzung und erlauben uns, das
> System in Rechnung zu stellen, sofern es produktiv genutzt wird."*
>
> - **Das Ende der Lizenz am 2026-10-22 gilt nicht mehr.** Die Testinstanz bleibt, solange an der Extension
>   entwickelt wird. Was unten mit „vor Ablauf" begründet ist, hat keine Eile mehr.
> - **Die neue Grenze ist die produktive Nutzung.** Testen darf man auf der Testinstanz alles, auch
>   tagelang auf einem echten Gerät. Echte Inhalte der Gemeinde, die dauerhaft im Foyer laufen, wären aber
>   produktive Nutzung und würden kostenpflichtig. Der Betrieb gehört auf die Produktivinstanz.
> - **Kein Gerät an der Testinstanz** *(Entscheidung des Nutzers, 2026-09-28)*: Auch mit Testinhalten
>   sähe ein Raspberry, der tagelang alle 20 Sekunden abruft, von außen wie Betrieb aus. Kosten, weil
>   ChurchTools eine produktive Nutzung erkennt, sollen gar nicht erst entstehen.
>
> **Offen sind danach, jeweils mit dem Punkt unten bzw. in [`Plan.md`](Plan.md):**
>
> - **Praxistest auf echter Hardware**: ein Raspberry mit Kiosk-Browser über mehrere Tage (E5, `Plan.md`,
>   „Als Nächstes" 2). **Entschieden am 2026-09-28:** Alle Tests mit den Raspberrys laufen auf der
>   Produktivinstanz, **keine Vorstufe auf der Testinstanz**. Vorher muss das Modul die **Abnahme in
>   Abschnitt P** bestehen; das Gerät kommt danach (P4).
> - **Beiträge im Player** mit dem Test-ZIP prüfen, Gruppe „ISD-Beitragstest" (`Plan.md`, Punkt 33). Offen
>   bleiben dabei interne Gruppen und ob Mitglieder eingeschränkter Gruppen deren Beiträge lesen (G37).
> - ~~**Service Worker unter `/ccm/`**~~ (E1, G10) **gebaut und abgenommen am 2026-09-28, `v0.2.4`**
>   (`Plan.md`, Punkt 37).
> - **Modul-Fixtures nachsichern**: Die am 2026-09-25 aufgezeichneten Modul-Antworten liegen noch nicht in
>   der Sicherung außerhalb des Repos. Das ist keine Frist mehr, aber ein einzelner Arbeitsplatz. **Der Ort der
>   Sicherung steht bewusst nicht im Repo – den nennt der Nutzer.**
> - ~~**GitHub-Actions auf Node.js 24 heben**~~ **erledigt am 2026-09-28** (`Plan.md`, Punkt 35). Ab dem
>   2026-10-19 wechselt zusätzlich `ubuntu-latest` auf Ubuntu 26 – nur beobachten.
> - **Zwei Entscheidungen ohne Vorgabe**: Hardware (G-E2) und Zeitbudget (G-E7).
> - **Kleinere Reste aus dem Plan** stehen seit dem 2026-09-28 im Umsetzungsplan (`Plan.md`, „Als Nächstes" 5,
>   Punkte 39–44): `429`, Standardschrift, Inspektor am Handy, ein wackelnder e2e-Test, der Baustein „Gruppen", der Designer am Handy.
>   *(Die Rechte am Modul selbst vergibt und prüft der Assistent seit Punkt 8.)* *(Slides übernehmen und Playlist duplizieren sind seit
>   Punkt 31 gebaut, das Durchgreifen durch gesperrte Bausteine seit Punkt 25.)*
>
> **Geparkt, bis ein Produktschritt es braucht:** C4, D4, F2, F3, `attachments`. *(G16 ist seit P5 beantwortet.)*

> **⏱ ~~Die Testinstanz läuft ab~~** – *aufgehoben am 2026-09-28, siehe oben; der Kasten bleibt als Verlauf.*
>
> Die Testinstanz (Adresse nur in der `.env`) – leer, Build 32882 wie produktiv, **30 Tage Lizenz, bis 2026-10-22, 21:53** (T3).
> Eine Verlängerung ist ungeklärt (**F1**, zuerst zu fragen).
>
> **Regel, die dieser Liste vorgeht: Was nur eine Instanz beantworten kann, wird zuerst gemessen.
> Was lokal geht, geht auch im November noch.**
>
> **Stand 2026-09-23 – zweite Bremse.** Auf der Testinstanz sind **Custom Modules nicht freigeschaltet**
> (T1, negativ). Eine Freischaltung ist angefragt, die Antwort steht aus. Damit zerfällt die Liste
> nicht mehr nach Preis, sondern danach, **ob ein Punkt ein eigenes Modul braucht**:
>
> - **Ohne Modul, also jetzt machbar:** T2, T3, D1–D3, E2, E3 – und alles Lesende.
>   **D1/D2 und A2 sind damit erledigt.**
> - **Blockiert bis zur Freischaltung:** B5, B6, C1–C4, E1, E4.
> - **Unbefristet und lokal:** die Oberfläche gegen den Mock. Dafür braucht es nie wieder eine Instanz.
>
> **Und alles, was die Instanz überlebt, wird mitgeschrieben**: Fixtures aufzeichnen, Typ-Snapshot ziehen.
> Das ist der Ertrag dieser 30 Tage.
>
> **Entschieden am 2026-09-23:** Die Fixtures liegen unter `fixtures/` und werden **nicht versioniert**
> (`.gitignore` erfasst das Verzeichnis). Der Ertrag hängt damit an einem Arbeitsplatz – eine Sicherung
> außerhalb des Repos ist der Ersatz, den dieser Zuschnitt braucht. **Angelegt am 2026-09-24.**

> **🎯 Fokuswechsel am 2026-09-23**
>
> Phase 0 ist überwiegend abgeschlossen, und der Plan hatte sich dabei vom Pitch entfernt – 63 % Plattformarchäologie
> gegen 20 % Produkt. **Ab jetzt ist der Pitch der Taktgeber**, nicht mehr die Frist der Testinstanz.
>
> Diese Liste bleibt gültig, ändert aber ihren Rang: Sie ist **Zuarbeit**, keine Voraussetzung mehr. Offen und
> wirklich dringlich ist daraus nur noch **B1–B4** (Entwicklungsumgebung, unblockiert); T3 ist seit dem
> 2026-09-24 erledigt. C, E1, E4 und B5/B6 warten auf die Freischaltung und halten nichts auf.
>
> Der Bauplan steht in [`Plan.md`](Plan.md), „Nächste Schritte" – am Pitch entlang, nicht am Preis der Messungen.

**Grundregel:** Ein `404` der ChurchTools-API ist kein Beweis für eine fehlende Route. Jede Prüfung läuft
angemeldet und mit ausreichenden Rechten, sonst ist ihr Ergebnis wertlos (Lehre aus G1).

---

## T. Trägt die Testinstanz? (fünf Minuten, vor allem anderen)

Ohne diesen Befund ist jede Planung auf die Testinstanz hin wertlos – der Lizenzumfang einer Testinstanz
muss dem der Produktivinstanz nicht gleichen.

- [x] **T1 · Custom Modules auf der Testinstanz** → **freigeschaltet am 2026-09-24** (zuvor negativ, 2026-09-23)
      `/api/custommodules` antwortet `200` mit leerer Liste, `feature_custommodule: 1`, `config` hat 156 statt 154 Schlüssel.
      Hochladen einer Extension als ZIP über die Oberfläche: `<instanz>/custom/modules/overview`.
      Zwei Befunde dazu in `Befunde.md`, G31. **Ursprünglicher Eintrag:**
      Geprüft **angemeldet als Administrator** (`administer settings: true`) – die Falle aus **G1** greift also nicht.
      **Ergebnis: Sie trägt nicht.** `feature_custommodule` fehlt unter 154 `config`-Schlüsseln,
      `/api/custommodules` antwortet **404**, und die gefilterte Spezifikation führt **alle neun
      `CustomModule*`-Schemas, aber keinen einzigen Pfad** – dasselbe Muster wie auf der Demo (G1),
      diesmal mit `administer settings: true` geprüft. Freischaltung bei ChurchTools angefragt, Antwort steht aus.
      Damit blockiert: **B5, B6, C1–C4, E1, E4.** Offen nutzbar: **D1/D2, E2/E3** – siehe unten.

- [x] **T2 · Zugang einrichten** – *(2026-09-23, weitgehend erledigt)*
      Administrator-Benutzer vorhanden, Login-Token in der lokalen `.env` (**nicht im Repo**, `.gitignore` greift).
      Die Instanz ist **nicht leer**: 5 Kalender, 7 Gruppen, 2 Termine, 1 Event, 8 Dienste stehen bereits.
      Aufgezeichnet als Fixtures unter `fixtures/api/` (**lokal, nicht versioniert**), personenbezogene
      Felder und Instanz-URL maskiert.
      **Nachgetragen am 2026-09-23:** Ein **Serientermin** (id 4, wöchentlich, mit Ausnahme und Zusatztermin)
      und ein **Terminbild** daran (Datei 46) – beides fehlte und beides war nötig, weil alle vorhandenen
      Termine einmalig und bildlos waren. Befunde in `Plan.md`, G19 und G14.

- [x] **T3 · Ablaufdatum notieren** → **2026-10-22, 21:53** *(2026-09-24)*
      30 Tage ab Anlage der Instanz am 2026-09-22 um 21:53. Eingetragen auch in `Plan.md`.
      **Aufgehoben am 2026-09-28:** Die Instanz bleibt für die Zeit der Extensionentwicklung kostenfrei,
      solange sie nicht produktiv genutzt wird (F1).

## A. Kostenlos – nur hinsehen (ca. 30 Minuten)

Alles an `ctpassstore`, dem fremden Modul, das auf unserer Instanz bereits läuft. Nichts wird gebaut,
nichts verändert.

**Der A-Block ist abgeschlossen** – A1, A3, A4 am 2026-09-22 (G6, G7, G4), A2 am 2026-09-23 (G15).
~~Ein Rest bleibt: der Statuscode eines unbekannten `/ccm/`-Pfades als sauberer Gegentest zu G7, siehe A2.~~
Nachgeholt am 2026-09-28, siehe A2.

- [x] **A1 · Einbettung ansehen** → **beantwortet G6** *(2026-09-22)*
      **Kein iframe.** ChurchTools hängt die Extension in den eigenen Dokumentkopf
      (`<script src="/ccm/ctpassstore/assets/index-BtWd1lCL.js" type="module">` samt zugehörigem CSS),
      die Navigation steht drumherum, das Modul rendert in deren Inhaltsbereich. Assets kommen aus
      `/ccm/<key>/assets/…` mit Build-Hash im Namen. `window.settings` liegt als JSON im Dokument
      (`<script type="application/json" id="ct-settings-json">`) mit `base_url`, `files_url`, `csrfToken`,
      `modules` und dem vollständigen `auth`-Objekt. Folgen stehen in `Plan.md`, G6.

- [x] **A2 · Content-Security-Policy ablesen** → **beantwortet G15** *(2026-09-23, an der Testinstanz)*
      **Es gibt eine scharfe CSP**, ausgeliefert als Antwort-Header – auch auf `/ccm/`-Pfaden. Das leere
      `nonce=""` im Quelltext war ein Fehlschluss. Kernpunkte: `script-src` **ohne** `'unsafe-inline'`
      (der Vite-Build darf kein Inline-Skript ausliefern), `style-src` **mit** `'unsafe-inline'`,
      `img-src *`, `child-src *`, **kein `media-src`** – externe Videos sind damit blockiert.
      Ein `srcdoc`-Rahmen **erbt** diese Policy. Vollständig in `Plan.md`, G15.
      ~~**Offen bleibt** der Statuscode von `/ccm/<unbekannt>/` als sauberer Gegentest zu G7: Auf der
      Testinstanz kam **500**, aber bei abgeschaltetem Feature – das zählt nicht.~~
      **Nachgeholt am 2026-09-28** (G7, Nachtrag): Ein unbekannter Key antwortet `404`, ein unbekannter Unterpfad
      eines installierten Moduls `200` mit unserem Skript.

- [x] **A3 · SPA-Fallback prüfen** → **beantwortet G7** *(2026-09-22)*
      `/ccm/ctpassstore/pasword` liefert die Modulseite, keinen ChurchTools-404.
      **Echte History-Routen sind möglich** – der Player darf auf `…/player?screen=foyer-links` neu laden,
      die Hash-Route ist nicht mehr Vorgabe.
      Zwei Nachträge: Der Inhaltsbereich blieb **leer**, weil `ct-pass-store` für die unbekannte Route nichts
      anzeigt – unser Router braucht eine **Catch-all-Route** mit benennbarer Fehlerseite, denn auf einem
      Foyer-TV ist Leere nicht von einem Absturz zu unterscheiden. Und der **Statuscode** ist ungelesen;
      für den Kiosk-Browser gleichgültig, für einen Service Worker (E1) nicht. → mit A2 nachholen.

- [x] **A4 · Rechteobjekt ansehen** → **bestätigt G4** *(2026-09-22)*
      `GET /api/permissions/global` → `data.ctpassstore` trägt **alle neun Schlüssel** des Typs aus
      `Plan.md`, F – der Snapshot aus `ct-pass-store` stimmt Feld für Feld mit unserer Instanz überein.
      Fehlende Rechte sind `[]` bzw. `false`, keine fehlenden Schlüssel.
      **Zwei Befunde nebenbei**, beide in `Plan.md` eingearbeitet:
      - `"ctradius":{"view":false,…}` – alles leer, obwohl der abgefragte Benutzer Administrator ist.
        **Adminrecht impliziert kein Modulrecht.** Wer in B6 sein Testmodul aufruft und nichts sieht,
        sucht den Fehler zuerst bei der Rechtevergabe, nicht im Build.
      - Die Kopie im Seitenquelltext (`ct-settings-json`) ist **beschnitten und anders kodiert**
        (`{"4":"4"}` statt `[4]`, Leeres fällt weg, `ctradius` fehlt ganz).
        Rechte werden über die API gelesen, nicht aus der Seite.

## B. Entwicklungsumgebung (ca. ein halber Abend)

- [x] **B1 · Boilerplate aufsetzen** *(2026-09-24)*
      Nach dem Muster des Boilerplates aufgebaut, nicht kopiert (es trägt keine Lizenzdatei): Vue 3, Vite, Pinia,
      Router, Vitest, Playwright, ESLint, CI. `.env` bleibt ignoriert.

- [x] **B2 · Vite-Proxy statt CORS** *(2026-09-24)*
      `/api` → Testinstanz, **mit `Authorization: Login <token>` im Proxy** statt einer Anmeldung im Browser.
      Set-Cookie wird verworfen. CORS der Instanz bleibt zu.

- [x] **B3 · „Hallo <Vorname>" aus `/whoami`** *(2026-09-24)*
      Mit `only_allow_authenticated=true` und Ablehnung der anonymen Pseudoperson (G20), als Unit-Test gesichert.

- [x] **B4 · Einmal in Safari öffnen** *(2026-09-24)*
      `npm run smoke` läuft in Chromium **und WebKit** grün – Begrüßung, Fehlerseite für unbekannte Pfade, Player
      ohne Parameter. mkcert ist unnötig, weil keine Cookies im Spiel sind. **Im echten Safari gegengeprüft**
      (2026-09-24): „Hallo <Vorname>" erscheint.

- [x] ~~**B5 · Typ-Snapshot holen**~~ → **nicht möglich** *(2026-09-24, G31)*: Die Typen bleiben handgeschrieben.
      **Ergebnis 2026-09-24:** Auch mit installiertem Modul und Modulrechten führt die Spezifikation keinen Modul-Pfad (G31).
      Für die Modul-Routen gibt es also keinen Snapshot; die Typen bleiben handgeschrieben nach den neun Schemas.
      **Stand 2026-09-24, nach der Freischaltung:** Die Spezifikation enthält als Administrator **weiterhin keinen**
      `/custommodules`-Pfad (497 Pfade wie zuvor). Also noch nicht ziehen – erst mit installiertem Modul erneut prüfen (G31).
      `ct-types.d.ts` aus der generierten Typdatei **unserer** Instanz übernehmen, nicht von Hand pflegen und
      nicht aus der Demo. Als versionierten Snapshot einchecken.
      **⚠ Blockiert – und eine Falle.** Die Spezifikation wird pro Benutzer und Rechten gefiltert
      ausgeliefert (G1). Solange Custom Modules auf der Testinstanz abgeschaltet sind, kommt sie **ohne
      die `CustomModule`-Pfade** zurück. Ein so gezogener Snapshot wäre **schlimmer als keiner**, weil der
      Fehler erst in Phase 1 aufflöge. Also: nach der Freischaltung wiederholen – oder von der
      Produktivinstanz holen.
      Zu finden ist sie unter `/system/runtime/swagger/openapi.json` (26 MB, 497 Pfade, 587 Schemas);
      der Abruf braucht ein Session-Cookie, der `Authorization: Login`-Header allein genügt nicht.
      **Teilweise vorweggenommen:** Die neun `CustomModule*`-**Schemas** sind auch jetzt schon enthalten und
      liegen lokal als `fixtures/schema/custommodule-schemas.json` (nicht versioniert).

- [x] **B6 · Testmodul anlegen** → **erledigt am 2026-09-24**: Extension unter `infoscreen-designer` hochgeladen, Rechte vergeben (G33).
      **Auf der Testinstanz** – und dort gleich unter dem echten Key `infoscreen-designer`, weil damit auch der
      spätere Pfad `/ccm/infoscreen-designer/` mitgetestet wird. Der Ausweichkey `infoscreen-designer-test` bleibt für
      den Fall, dass doch auf der Produktivinstanz gearbeitet werden muss.
      Bauen mit `VITE_KEY=infoscreen-designer npm run release`, hochladen über
      System-Einstellungen → Extensions → Extension hinzufügen. **Kurzbezeichner muss exakt zum Build passen,
      Ordnernamen sind case-sensitiv.**
      **Direkt danach die Rechte vergeben** – sonst ist das Modul auch für den Administrator unsichtbar
      und der Fehler wird im Build gesucht (A4).

## C. Am eigenen Testmodul messen (ca. eine Stunde)

Setzt B6 voraus. Diese vier Punkte entscheiden über den Zuschnitt des Datenmodells in Phase 1.

- [x] ~~**C1 · Lässt sich über `domainType`/`domainId` filtern?**~~ → **entfällt** *(2026-09-23)*
      **Die Felder gibt es nicht.** `CustomModuleDataValue` führt auf Build 32882 nur `id`,
      `dataCategoryId` und `value` – der Snapshot aus `ct-pass-store` (2025-09-02) ist überholt.
      Es bleibt bei „ganze Kategorie holen, im Client filtern"; der Slug-im-JSON-Ansatz ist damit
      nicht mehr die bessere, sondern die einzige Wahl.
      Beleg: `fixtures/schema/custommodule-schemas.json` (lokal, nicht versioniert).

- [x] ~~**C2 · Wird das JSON Schema durchgesetzt?**~~ → **entfällt** *(2026-09-24)*: Kategorien haben kein Schema-Feld (G22).
      Ursprünglich → beantwortet **G12**
      Kategorie mit engem Schema anlegen, dann einen Wert schreiben, der es verletzt.
      - Abgelehnt → wir brauchen ein vollständiges Schema und stoßen an 2.000 Zeichen.
      - Angenommen → **permissives Schema in ChurchTools, Validierung im Client** (Vorgabe).

- [x] ~~**C3 · Was bewirkt `securityLevelId`?**~~ → **entfällt** *(2026-09-24)*: Kategorien haben keine Sicherheitsstufe (G22).
      Ursprünglich → beantwortet **G13**
      Zwei Kategorien mit unterschiedlicher Stufe, Zugriff mit einem gering berechtigten Benutzer.
      Wichtig für `status` – die einzige Kategorie, auf die ein unbeaufsichtigtes Gerät schreiben darf.

- [ ] **C4 · Grenzen gegenprüfen** – **geparkt**, bis ein Produktschritt es braucht (`Plan.md`, „Nächste Schritte").
      Einen Wert mit 10.001 Zeichen schreiben. Kommt eine saubere Fehlermeldung oder eine stille Kürzung?
      Eine stille Kürzung wäre der unangenehmste Fall und müsste im Designer abgefangen werden.

## D. Medien – der teuerste offene Punkt (ca. eine Stunde)

- [x] **D1 · Wiki-Kategorie als Mediathek** → **beantwortet G8** *(2026-09-23)*
      **Der Weg trägt.** Kategorie „Infoscreen-Medien" (id 1) angelegt, Trägerseite „Mediathek", Bild über
      `POST /api/files/wiki_1/<guid>` hochgeladen. **Die Datei trägt `fileUrl` *und* `imageUrl`.**
      Zwei Feinheiten: Die Trägerseite wird über ihre **GUID** adressiert, nicht über eine numerische id,
      und die Kategorie verlangt `inMenu` und `fileAccessWithoutPermission` als ausdrückliche Boolesche
      Werte, sonst 400. Beleg: `fixtures/api/files-wiki_1.json` (lokal, nicht versioniert).

- [x] **D2 · Das Bild tatsächlich anzeigen** → **beantwortet G14** *(2026-09-23)*
      `fileUrl`: abgemeldet **401**, angemeldet 302 → Cookie → 200. `imageUrl`: **anonym 200**.
      **Achtung, neuer Fallstrick:** Der Bilddienst hat eine Vorgabe von **150×150**; `w` und `h`
      überschreiben jeweils nur eine Seite (`?w=1920` ergibt 1920×150). **Beide Parameter sind Pflicht.**
      `fit`-Modi getrennt gemessen: `max`/`contain` passen ohne Beschnitt ein, `crop` schneidet mittig,
      `fill` füllt mit Rand, `stretch` verzerrt, ohne `fit` wird beschnitten.
      Cache `max-age=604800, public`, **kein ETag**.
      **Und ein Sicherheitsbefund:** `fileAccessWithoutPermission: false` schützt die `imageUrl` **nicht** –
      sie schützt allein der Hash. Gehört in die Betriebsdoku.

- [x] **D3 · Ausweichpfade** – *(teilweise, 2026-09-23)*
      **Externe Adressen geprüft:** `POST /api/files/wiki_1/<guid>/link` antwortet **201** und legt einen
      regulären Dateisatz an (`type: "link"`, gleicher `domainType`/`domainId` wie ein Upload) –
      **aber ohne `imageUrl`**. Der Bilddienst entfällt damit, `fileUrl` reicht nur die fremde Adresse durch.
      Für **G-E6** heißt das: Der Notausgang trägt, kostet aber serverseitige Skalierung und Cachefähigkeit;
      für Videos scheitert er zusätzlich an der CSP (G15). Da D1 **nicht** gescheitert ist, bleibt das die
      Rückfallposition und nicht der Weg.
      `attachments` ist weiterhin ungeprüft – wird nicht mehr gebraucht. Ursprünglicher Auftrag, nur falls D1 scheitert: `attachments` (woran bindet `domainIdentifier`?), dann
      `POST /files/{domainType}/{domainIdentifier}/link` für externe Adressen.
      **Nicht zu prüfen: `appointment_image` als Ablage.** Geprüft und verworfen – es bräuchte Trägertermine,
      die im Kalender, in der App und auf der Gemeindeseite auftauchen (Begründung in `Plan.md`, G8).
      Die Frage, ob „nur externe URLs" ein tragfähiger MVP wäre, ist damit **gestrichen** (2026-09-24).

- [ ] **D4 · Aufräumen** – **nur auf der Produktivinstanz**, **geparkt**: Dort ist bisher nichts geschrieben worden.
      Dort entfernen Testdateien und Test-Wiki-Kategorie wieder; Uploads erzeugen echte Inhalte.
      Auf der Testinstanz darf alles stehen bleiben – das ist ihr Zweck.

## E. Player-Voraussetzungen – **vorgezogen**

~~(nach Phase 2, nicht früher)~~ Die Verschiebung nach hinten schützte die Produktivinstanz vor einem
Dauerpasswort auf einer SD-Karte. Auf der leeren Testinstanz gibt es diesen Grund nicht mehr, wohl aber
eine Frist: **E1 bis E4 sind instanzgebunden und gehören deshalb in die ersten Tage.** Nur E5 hängt an
Hardware, nicht an der Instanz, und kann warten.

- [x] **E1 · Service Worker unter `/ccm/`** → **G10 beantwortet am 2026-09-28: ja**, aus dem Wurzelordner des ZIPs; Bauplan in `Plan.md`, Punkt 37. *(Ursprünglich: nicht mehr blockiert seit der Freischaltung, 2026-09-24.)*
      Registrierung versuchen: Scope, MIME-Typ, schreibt ChurchTools den Pfad um?
      Scheitert das, bleibt die Offline-Festigkeit halb – ein Pi, der während eines Netzausfalls neu startet,
      hat nichts zu laden. Dann ausdrücklich benennen, nicht übergehen.

- [x] **E2 · Betriebsbenutzer mit Minimalrechten** → **weitgehend beantwortet** *(2026-09-23, siehe `Plan.md`, G21)*
      **Gebaut und gemessen.** Person 22 „Minimal User" (`statusId: 0`, Benutzername `muser`), Mitglied der Gruppe 16
      „Infoscreen-Geraete" (Gruppentyp **Dienst**, Status aktiv) in der Rolle Mitarbeiter. Eine Sitzung als dieses Konto
      ist geführt und gegen das Administratorkonto gestellt.
      **Drei Befunde, die den Zuschnitt ändern:**
      - **`view` ist kein API-Recht.** Mit `churchcal.view = false` liefert `/api/calendars` trotzdem die berechtigten
        Kalender und `/api/calendars/appointments` dieselben Termine wie dem Administrator. Der Modulschalter regelt die
        Oberfläche, nicht die API – ein Recht weniger auf der SD-Karte.
      - **`site_licensekey` fährt nicht mit.** `/api/config` gibt diesem Konto **74** Schlüssel – exakt dieselben wie einem
        anonymen Aufruf, gegenüber 154 für den Administrator.
      - **Der Sockel trägt mehr als gedacht.** Ohne jede Gruppenberechtigung: 3 Kalender, 10 Termine (9 davon mit Bild
        samt `imageUrl`), 1 Event, 8 Dienste. Ein Terminblock mit Bildern liefe heute schon.
      **Beim Anlegen zu wissen:** Die Person braucht einen **Benutzernamen** (`cmsUserId`), nicht nur ein Passwort –
      sonst scheitert `POST /api/login/token` unabhängig vom Passwort. `POST /api/persons` verlangt außerdem
      `departmentIds` (nicht leer), `campusId` und eine vollständige Datenschutz-Einwilligung; Personen werden mit
      **`PATCH`** geändert, nicht mit `PUT` (405).
      **Offener Rest – geparkt am 2026-09-24**, gehört in die Einrichtungsdoku (Phase 4), nicht vor den Bau: die Haken an Rolle 124 in der Oberfläche setzen (trennt endlich `authId` 306 von 403),
      ein Testbeitrag für den Newsblock, Archivieren als zweite Notbremse. Die Modulrechte bleiben an T1 gebunden.

- [x] **E3 · Rückzugsweg** → **beantwortet** *(2026-09-23, siehe `Plan.md`, G18)*
      **Die ursprüngliche Anleitung war falsch.** `DELETE /api/persons/{id}/logintoken` liefert für eine
      **fremde** Person **403**, auch als Administrator – ebenso `GET …/logintoken` und `GET …/loginstring`.
      Im ganzen `churchcore`-Rechtesatz gibt es kein Recht dafür, und die Administrationsoberfläche gibt
      den Token ebenso wenig heraus (gegengeprüft).
      **Der Grund ist einleuchtend:** Der Token wird über `POST /api/login/token` aus **Benutzername und
      Passwort** abgeleitet. Er gehört der Person, nicht der Verwaltung.
      **Gemessen:** Nach einem Wechsel des Passworts von Person 16 antwortete deren bis dahin gültiger
      Token auf zwei Endpunkten mit **401**, bei gesunder Instanz und unverändertem anonymem Verhalten.
      **Der Betriebsweg lautet damit:**
      1. Geräte-Benutzer anlegen und ihm **in der ChurchTools-Oberfläche** ein Passwort geben.
         **Nicht über die API:** `PUT /persons/{id}/password` verlangt `oldPassword` und ist Selbstbedienung,
         kein Admin-Reset. Als API-Alternative bliebe `POST /persons/{id}/invite` – braucht ein Postfach.
      2. `POST /api/login/token` mit dessen Zugangsdaten erzeugt den Token.
      3. Token in die Player-URL (der `/ccm/`-Teil bleibt E4/G9).
      4. **Notbremse: Passwort in der Oberfläche ändern** – der Token ist sofort tot.
      **Die Doku beschreibt hier Klickwege, keine curl-Aufrufe.** Wer sie als API-Anleitung schreibt,
      schreibt etwas auf, das nicht funktioniert.
      **Noch nicht gemessen:** Schritt 2 ist nur negativ geprüft (falsche Daten → 400); ob `archive` als
      zweite Notbremse wirkt, ebenso. Beides hängt an einem Konto mit gesetztem Passwort → **G21**.

- [x] **E4 · `login_token` in der URL am `/ccm/`-Pfad** → **beantwortet G9 am 2026-09-25: trägt.** Darauf baut Weg B (`Plan.md`).
      **Ursprünglicher Eintrag, doppelt blockiert:**
      Es fehlt das Custom Module (T1) **und** ein Token, an den ein Administrator regulär herankommt (E3/G18).
      `…/ccm/infoscreen-designer/player?screen=…&login_token=<TOKEN>&user_id=<ID>&no_url_rewrite=true` in einem
      privaten Fenster aufrufen. **Prüfen, dass wirklich der Infoscreen-Benutzer angemeldet ist** – ChurchTools
      antwortet anonym als öffentlicher Benutzer, ein fehlgeschlagener Login fällt sonst nicht auf.

- [ ] **E5 · Auf der echten Hardware ansehen** – als Praxistest über mehrere Tage (`Plan.md`, „Als Nächstes" 2).
      **Seit 2026-09-28:** Nur auf der Produktivinstanz, erst mit Testinhalten, dann mit echten; kein Gerät
      an der Testinstanz, damit dort keine produktive Nutzung erkannt wird (F1, Entscheidung des Nutzers).
      Setzt die Abnahme in Abschnitt P voraus (P4).
      Pi-Generation, Auflösung, Ausrichtung, Overscan, FullPageOS-Stand. Entscheidet über
      **Offene Entscheidung 3** (Hardware) und darüber, ob Videos überhaupt in Frage kommen.

## F. Auskünfte einholen (Laufzeit: Tage)

Früh anstoßen, weil die Antwort nicht von uns abhängt.

- [x] **F1 · Support anschreiben** – `support@churchtools.de` → **erledigt am 2026-09-28**; die Frage nach dem Rate-Limit beantwortet seit P5 das Forum (G16).
      - ~~Wie widerruft ein Administrator den Login-Token eines Geräts?~~ **Entfällt** – über den
        Passwortwechsel des Geräte-Benutzers (E3/G18), am 2026-09-23 gemessen.
      - ~~**Zuerst: Custom Modules für die Testinstanz freischalten.**~~ **Freigeschaltet am 2026-09-24** (T1).
        *(angefragt am 2026-09-23; laut Auskunft vom 2026-09-24 schalten die Entwickler frei, nicht das Paket)*
        Ohne sie sind B5, B6, C1–C4, E1 und E4 blockiert – siehe T1.
      - ~~**Lässt sich die Testinstanz über die 30 Tage hinaus verlängern?**~~ **Ja, beantwortet am 2026-09-28:**
        kostenfrei für die Zeit der Extensionentwicklung; ChurchTools prüft die Nutzung und berechnet das System,
        sobald es produktiv genutzt wird. Ursprünglich: Wir sind Kunde und
        entwickeln eine Extension; 30 Tage reichen dafür nicht – erst recht nicht, wenn ein Teil davon
        auf die Freischaltung verstreicht.
      - ~~Ist ein Rate-Limit dokumentiert?~~ **Beantwortet am 2026-09-28 ohne Support:** 600 Anfragen je Minute
        und IP-Adresse, genannt von einem ChurchTools-Mitarbeiter im Forum (**G16**).
      - ~~Ist ein Speicherziel für Dateien aus Custom Modules geplant?~~ **Entfällt** – die Wiki-Kategorie
        samt Bilddienst beantwortet G8.

- [ ] **F2 · Lukas Block (`lubl`) im Forum ansprechen** – **geparkt**
      Nicht zu Fragen, die sein Code beantwortet, sondern zu G8, G10 und zur Idee einer gemeinsamen
      `ct-utils`-Bibliothek. **Geparkt am 2026-09-24** – die gemeinsame Bibliothek ist aus dem Plan gestrichen.

- [ ] **F3 · `bensteUEM/ct-events-load` lesen** – **geparkt**
      Besonders `src/persistance.ts` und die Terminbehandlung – vor der ersten Zeile Bindungscode in Phase 4.
      **Überholt am 2026-09-24:** Die Terminnormalisierung steht und ist gegen die Fixtures getestet (G19, G23).
      Nur noch lesen, wenn ein Terminfall auftaucht, den sie nicht abdeckt.

## G. Entscheidungen, die niemand für uns trifft

Die offenen Entscheidungen aus `Plan.md` – keine Recherche, sondern Festlegungen. Sie gehören beantwortet,
bevor das Screen-Schema steht.

- [x] **G-E1 · Undo/Redo** – **entschieden am 2026-09-24 für V1: Zustand**, als Verlauf von Schnappschüssen der Slide.
      Siehe `Plan.md`, „Offene Entscheidungen".
- [x] **G-E11 · Playlists und Zeitpläne** – **entschieden am 2026-09-23**, die zweite architekturrelevante
      Frage dieser Art. Die Ebene **Screen → Playlist → Slides** kommt in Phase 1 ins Schema, die
      Zeitplan-Oberfläche später; Slides werden referenziert und dürfen in mehreren Playlists vorkommen.
      Regeln nach **Termin** (dank G19 billig) und nach Uhrzeit. Standard-Playlist ist Pflicht, und der
      Player wechselt nicht, solange seine Uhr unbestätigt ist. Siehe `Plan.md`, „Playlists und Zeitpläne".
- [ ] **G-E2 · Hardware** – wie viele Geräte, welche Generation, Auflösung, Ausrichtung
- [x] **G-E3 · Zielgruppe** – nur wir, oder von Anfang an Extension Store (**G17**) → **Vorgabe:** zuerst nur wir (`Plan.md`)
- [x] **G-E4 · MVP-Zuschnitt** – **entschieden am 2026-09-24**: wie in `Plan.md`, „Funktionsumfang – MVP".
      Kein Web-Code-Block, keine Geburtstage, keine Videos in V1.
- [x] **G-E5 · Wer gestaltet** – nur wir, oder nicht-technische Ehrenamtliche → **Vorgabe:** zuerst wir
- [x] ~~**G-E6 · Rückfallposition Medien** – ist „nur externe URLs" ein tragfähiger MVP?~~ **Gestrichen am 2026-09-24**: Der Wiki-Weg trägt (D1–D3).
- [ ] **G-E7 · Zeitbudget** – der Plan nennt sieben Phasen und keine Schätzung
- [x] **G-E8 · Aktualität** – wie schnell muss eine Änderung auf dem TV sein? → **Vorgabe:** Konfiguration alle 2, Daten alle 10 Minuten
- [x] **G-E9 · Ton im Foyer** – ja oder nein → **Vorgabe:** alles stumm

Die Vorgaben gelten, bis jemand widerspricht (`Plan.md`, „Offene Entscheidungen"). **Wirklich offen sind G-E2 und G-E7.**

## P. Vor der Produktivinstanz – Abnahme *(angelegt am 2026-09-28)*

Der Dauertest läuft auf der Produktivinstanz (`Plan.md`, „Als Nächstes" 2). Eine Extension kann ChurchTools
nicht zum Absturz bringen: Sie läuft im Browser unter `/ccm/infoscreen-designer/`. Schaden kann sie auf
drei Arten: durch **Schreibzugriffe außerhalb ihres eigenen Speichers**, durch **Spuren, die Gemeindeglieder
sehen**, und durch **Reste, die sich nicht wieder entfernen lassen**. Die Liste prüft genau diese drei Punkte.

**Reihenfolge seit 2026-09-28:** P1–P3 und P5–P7 vor der Installation, dann P8, **danach erst P4**. Ein Gerät
hängt nie an der Testinstanz, auch nicht mit Testinhalten (Entscheidung des Nutzers; siehe Kasten oben).

**Was das Modul außerhalb seines eigenen Speichers schreibt** (Stand des Codes am 2026-09-28):

| Wer | Was | Wo im Code |
| --- | --- | --- |
| Einrichtungsassistent | legt **zwei Gruppen** an (Typ „Merkmal"), setzt Rechte an deren Rollen und nimmt sie zurück; „Einrichtung entfernen" löscht die Gruppen | `src/setup/provision.ts`, `src/setup/load.ts` |
| Mediathek | legt Seiten im Wiki-Bereich „Infoscreen" an und ändert sie; lädt Dateien hoch und löscht sie | `src/media/wiki.ts` |
| Einstellungen | erzeugt den Login-Token des Geräte-Benutzers (`POST /login/token`) | `src/setup/device-token.ts` |
| Designer | schreibt und löscht Werte im eigenen Speicher der Extension | `src/store/churchtools-kv.ts` |

Der Player schreibt nichts nach ChurchTools, sondern nur in den Speicher des eigenen Browsers.

- [x] **P1 · Einrichtung auf der Testinstanz von vorn** – „Einrichtung entfernen", dann neu einrichten. Danach
      darf es keine verwaisten Rechte an fremden Rollen geben, und nur die zwei eigenen Gruppen dürfen angefasst
      worden sein. Das ist der einzige Teil, der Rechte schreibt. *(Schreibzugriff, vorher absprechen.)*
      **Erster Durchgang am 2026-09-28 mit `v0.2.2` – nicht bestanden (G39):** Die Gruppen wurden gelöscht, das
      Speichern scheiterte, danach war die Seite festgefahren; das Entwicklungskonto kam nicht mehr in den Designer.
      Andere Gruppen und Rechte blieben unberührt. **Behoben in `v0.2.3`.** **Zweiter Durchgang:** `v0.2.3` als
      Update auf die Testinstanz, als System Admin „Einrichtung entfernen" (repariert den Zustand) und „Gruppen und
      Rechte anlegen", danach Personen 1 und 16 als „Leiter" in „Infoscreen-Designer" und das Gerätekonto 22 in
      „Infoscreen-Devices" wieder aufnehmen und vorher/nachher vergleichen. Das Entwicklungskonto braucht die
      Modulrechte künftig über eine eigene Admin-Gruppe (`docs/Einrichtung.md`, Schritt 2), nicht über die Gestalter.
      **→ Zweiter Durchgang am 2026-09-28 bestanden** (`v0.2.3`, Nutzer als System Admin): „Einrichtung entfernen"
      bereinigte die verwaisten Einträge, „Gruppen und Rechte anlegen" legte die Gruppen 37 und 40 an. Vergleich mit
      dem Stand vor dem ersten Durchgang: nur die Gruppen 25/28 gegen 37/40 getauscht, **Rechte Rolle für Rolle
      identisch**, keine andere Gruppe, Gruppentyp-Rolle oder Status-Rechte verändert, Wiki-Bereich unberührt.
      Dabei aufgefallen: Eine leere Geräte-Gruppe stand als Fehler (rot), eine leere Gestalter-Gruppe als Warnung
      – beide sind jetzt eine Warnung, denn direkt nach dem Einrichten sind beide leer (kommt mit der nächsten
      Version). **Offen:** Mitglieder wieder aufnehmen (Personen 1 und 16, Gerätekonto 22) und dem
      Entwicklungskonto die Modulrechte über eine eigene Admin-Gruppe geben.
- [x] **P2 · Rückweg beschreiben und auf der Testinstanz einmal gehen** → **gemessen am 2026-09-28 (G38)**:
      Das Löschen der Extension räumt Daten, Modulrechte (auch an fremden Rollen), Rechtekatalog und ZIP selbst ab;
      eine Neuinstallation beginnt leer. Übrig bleiben nur Gruppen, Wiki-Bereich und Geräte-Benutzer – deshalb
      erst „Einrichtung entfernen", dann die Extension löschen. Beschrieben in `docs/Einrichtung.md`,
      „Den Designer wieder entfernen". Offener Rest: ein vermuteter Rechte-Cache (G38).
      *Ursprünglicher Auftrag:* Was bleibt, wenn die Extension
      deinstalliert wird: Kategorien und Werte, Rechte am Modul, die beiden Gruppen, Wiki-Bereich und Dateien,
      der Geräte-Benutzer? Zuerst in der Academy nachlesen, dann messen. Das Ergebnis gehört nach
      `docs/Einrichtung.md`; dort fehlt ein Abschnitt zum Entfernen bisher.
      **Recherche am 2026-09-28 ohne Ergebnis** (G38): Weder Academy noch Boilerplate, Spezifikation oder Forum
      sagen, was beim Entfernen einer Extension bleibt. Die Spuren außerhalb des Modulspeichers haben ihren
      eigenen Rückweg. Offen sind die Kategorien, die Modulrechte an fremden Rollen, der Rechtekatalog und ob
      eine Neuinstallation die alten Daten wiederfindet. **Nächster Schritt: Messung mit Wegwerf-Key,
      Messplan in G38.**
      **Regel seit 2026-09-28** (`Plan.md`, F, „Entfernen nur, was das Modul selbst angelegt hat"): Gelöscht wird
      nur, was über das Modul entstanden ist, erkannt an der beim Anlegen gespeicherten id. Gewählte bestehende
      Gruppen nie. Gruppen und Wiki-Bereich halten das seit Schema 1.12 ein.
- [x] **P3 · Sichtbarkeit für Gemeindeglieder** – Wo tauchen die Gruppen vom Typ „Merkmal", der Wiki-Bereich
      (G36) und der Geräte-Benutzer auf: Gruppenliste, App, Personensuche, Wiki? Nichts davon darf wie ein
      Fehler aussehen oder Fragen auslösen.
      **Teilweise geprüft am 2026-09-28** (Nutzer, mit einem neu angelegten Konto ohne Rechte): kein Wiki, kein
      Infoscreen Designer. Die Gruppen legt der Assistent mit Sichtbarkeit „Eingeschränkt" an – sichtbar nur mit
      Rechten wie „view alldata" oder „view group" ([Academy](https://churchtools.academy/de/help/app/gruppen-berechtigen/0-gruppensichtbarkeiten/)).
      **→ Auf der Testinstanz bestanden am 2026-09-28** (Nutzer, nach dem Neueinrichten): Ein Konto ohne Rechte sieht
      im Menü nur „Beiträge" – keine Personen, keine Gruppen, kein Wiki, keinen Designer; Gruppen, Wiki-Bereich und
      Geräte-Benutzer kann es gar nicht finden. **Das gilt nur für Konten ohne Rechte.** Auf der Produktivinstanz
      dürfen Gemeindeglieder je nach Personenstatus mehr, etwa Personen oder Gruppen sehen. Die Gruppen bleiben dann
      unsichtbar („Eingeschränkt"), der Geräte-Benutzer aber ist eine normale Person – daher in der Anleitung ein
      sprechender Name wie „Infoscreen Foyer" und ein Status mit wenig Rechten. **Bei P8 einmal wiederholen:** nach
      der Einrichtung auf der Produktivinstanz mit einem typischen Mitgliedskonto in Web und App nach „Infoscreen"
      und nach dem Geräte-Benutzer suchen (fünf Minuten, durch den Administrator).
- [ ] **P4 · Erstes Gerät, auf der Produktivinstanz** *(nach P8)* – Das echte Gerät mit Kiosk-Browser läuft
      mehrere Tage fehlerfrei, zuerst mit Testinhalten in einer eigenen Playlist, einschließlich des nächtlichen
      Neuladens und eines Netzausfalls (E5). Bis dahin hängt kein Gerät an einer Instanz.
      ~~Vorstufe auf der Testinstanz~~ – verworfen am 2026-09-28: Auch Testinhalte sähen dort wie Betrieb aus (F1).
- [x] **P5 · Last überschlagen** → **gerechnet am 2026-09-28 (G16)**: rund **375 Anfragen je Gerät und
      Stunde** (gut 6 je Minute), die Hälfte davon der Schnellcheck alle 20 Sekunden, den die ursprüngliche
      Vorgabe (Konfiguration alle 2, Daten alle 10 Minuten) nicht nannte. ChurchTools erlaubt **600 Anfragen je
      Minute und IP-Adresse**. Die Geräte eines Hauses teilen sich eine Adresse, mit ihnen die Handys im
      Gemeinde-WLAN und die Gestalter. Fünf Geräte brauchen rund 5 % davon. Das trägt.
      **Nachgeschoben, geschlossen am 2026-09-29:** Nach einem `429` wartet der Player jetzt mindestens 60
      Sekunden, länger, wenn `Retry-After` es verlangt; siehe `Plan.md`, Punkt 39, und G16.
- [x] **P6 · Nur ein Release** – Installiert wird ein ZIP aus dem Release-Workflow bei grünem CI, kein
      lokaler Build. **Vorbereitet am 2026-09-28:** Die Workflows laufen auf `actions/checkout@v7` und
      `actions/setup-node@v7` (Node.js 24, `Plan.md`, Punkt 35); die Release-Läufe `v0.2.0`–`v0.2.2` waren grün.
      Abgehakt wird P6 mit dem Release, das auf die Produktivinstanz geht – das erste nach dieser Umstellung.
      **→ Erfüllt mit `v0.2.3` (2026-09-28):** Release-Lauf mit den neuen Actions grün, ZIP auf der Release-Seite.
      Gilt für jede Installation auf der Produktivinstanz weiter: nur ein ZIP aus dem Release-Workflow.
- [x] **P7 · Entscheidung des Nutzers: Key** → **entschieden am 2026-09-28: gleich der echte Key
      `infoscreen-designer`**, unter der Bedingung, dass er sich restlos entfernen lässt. Das ist erfüllt:
      „Einrichtung entfernen" nimmt die Gruppen, das Löschen der Extension alles Übrige am Modul (G38). Von Hand
      bleiben nur Wiki-Bereich und Geräte-Benutzer, die der Designer nie löscht (`docs/Einrichtung.md`). Vor der
      Installation lesend prüfen, ob es auf der Produktivinstanz schon Gruppen „Infoscreen-Designer" oder
      „Infoscreen-Devices" oder einen Wiki-Bereich „Infoscreen" gibt.
      *Ursprüngliche Frage:* Gleich unter dem echten Key, der danach bleibt? Oder unter
      `infoscreen-designer-test`, der sich spurlos wieder entfernen lässt, aber für den Betrieb neu eingerichtet
      werden muss?
- [ ] **P8 · Freigabe** – *Wartet seit dem 2026-09-28 auf die Klärung des Nutzers mit dem Administrator der
      Produktivinstanz.* Nach der Installation dort P3 mit einem typischen Mitgliedskonto wiederholen.
      Die Installation auf der Produktivinstanz wird mit dem Nutzer abgesprochen. Erst
      dann wird die Regel „gegen die Produktivinstanz nur lesen" in `AGENTS.md` für dieses Modul angepasst.

---

## Abschluss

- [x] **Alle Befunde in [`Befunde.md`](Befunde.md) eingetragen** *(Stand 2026-09-23)*: beantwortete Punkte nach
      oben, mit Datum und Quelle (Instanz, Spezifikation oder fremder Code).
      Beantwortet: **G1–G8, G11, G14, G15, G18, G19, G20**; **G16** und **G21** zur Hälfte.
      **G21** ist seit dem 2026-09-23 gebaut und gemessen – offen bleiben daran nur noch die Sichtbarkeit von Beiträgen und das Archivieren als zweite Notbremse.
      Offen und an der Freischaltung hängend: **G9, G10**; **G12, G13** sind seit G22 hinfällig. Dazu **G17** als Entscheidung.
      **G18 hat den Notfallpfad aus E3 erst widerlegt und dann ersetzt** – die Notbremse ist der Passwortwechsel.
      Belege liegen lokal unter `fixtures/` – **nicht im Repo**, siehe `fixtures/README.md`.
- [x] **Erst danach das Screen-Schema festlegen.** → **überholt**: Das Schema steht seit Phase 1 (2026-09-24) und ist seitdem versioniert gewachsen.

## Was dabei nicht passieren darf

- Keine Zugangsdaten und keine Instanz-URL ins Repo – `.env` bleibt ignoriert, Instanz-URL und Token tragen
  kein `VITE_`-Präfix, und `scripts/check-dist.js` prüft das `dist/`.
- Keine Tests gegen die Produktivinstanz, die Daten verändern – dafür gibt es jetzt die Testinstanz.
  Muss doch produktiv gearbeitet werden, hat das Testmodul einen eigenen Key und schreibt nur in eigene Kategorien.
- Keine Testinstanz unter erfundenem Gemeindenamen anlegen – die vorhandene läuft auf den echten Namen.
- **Die Testinstanz nicht produktiv nutzen** *(seit 2026-09-28)*: Sonst stellt ChurchTools sie in Rechnung (F1).
  Keine echten Inhalte im Dauerbetrieb, kein Foyer, das an ihr hängt.
- ~~Die Frist nicht verstreichen lassen, ohne die Fixtures und den Typ-Snapshot gesichert zu haben.~~
  Die Frist ist seit dem 2026-09-28 aufgehoben; die Sicherung außerhalb des Repos bleibt nötig.
  **Die Fixtures sind seit dem 2026-09-23 aufgezeichnet, der Typ-Snapshot fehlt noch** (hängt an der Freischaltung, B5).
  Da `fixtures/` nicht versioniert ist, ersetzt **keine** Sicherung im Repo den Verlust dieses Arbeitsplatzes –
  eine Kopie außerhalb gehört dazu. **Seit dem 2026-09-24 gesichert**; was danach noch aufgezeichnet wird,
  ebenfalls nachsichern (offen für die Modul-Antworten vom 2026-09-25).
- Die aufgezeichneten Antworten nicht roh weitergeben: Instanz-URL, `admin_mail` und personenbezogene Felder
  werden vorher ersetzt. Wie, steht in `fixtures/README.md`.
- An bestehenden Rollen der Rechteverwaltung nichts ändern – eigene Testgruppe verwenden.
