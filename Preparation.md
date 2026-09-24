# Phase 0 – Vorbereitungs-Checkliste

Abzuarbeiten vor der ersten Zeile Anwendungscode. Jeder Punkt nennt, **was zu tun ist**, **woran man das
Ergebnis erkennt** und **welche Frage aus [`Befunde.md`](Befunde.md)** er beantwortet. Befunde gehören danach in
[`Befunde.md`](Befunde.md). Diese Datei ist die **Arbeitsliste**, `Befunde.md` das **Messprotokoll**, [`Plan.md`](Plan.md) das **Gedächtnis**.

Die Reihenfolge folgte bisher dem Preis: erst was nichts kostet, dann was Zeit kostet, zuletzt was Daten
anfasst. **Seit dem 2026-09-22 gilt ein anderer Taktgeber.**

> **⏱ Die Testinstanz läuft ab**
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

- [x] **T1 · Custom Modules auf der Testinstanz** → **beantwortet, negativ** *(2026-09-23)*
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

## A. Kostenlos – nur hinsehen (ca. 30 Minuten)

Alles an `ctpassstore`, dem fremden Modul, das auf unserer Instanz bereits läuft. Nichts wird gebaut,
nichts verändert.

**Der A-Block ist abgeschlossen** – A1, A3, A4 am 2026-09-22 (G6, G7, G4), A2 am 2026-09-23 (G15).
Ein Rest bleibt: der Statuscode eines unbekannten `/ccm/`-Pfades als sauberer Gegentest zu G7, siehe A2.

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
      **Offen bleibt** der Statuscode von `/ccm/<unbekannt>/` als sauberer Gegentest zu G7: Auf der
      Testinstanz kam **500**, aber bei abgeschaltetem Feature – das zählt nicht.

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

- [ ] **B5 · Typ-Snapshot holen**
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

- [ ] **B6 · Testmodul anlegen**
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

- [ ] **C4 · Grenzen gegenprüfen**
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

- [ ] **D4 · Aufräumen** – **nur auf der Produktivinstanz**
      Dort entfernen Testdateien und Test-Wiki-Kategorie wieder; Uploads erzeugen echte Inhalte.
      Auf der Testinstanz darf alles stehen bleiben – das ist ihr Zweck.

## E. Player-Voraussetzungen – **vorgezogen**

~~(nach Phase 2, nicht früher)~~ Die Verschiebung nach hinten schützte die Produktivinstanz vor einem
Dauerpasswort auf einer SD-Karte. Auf der leeren Testinstanz gibt es diesen Grund nicht mehr, wohl aber
eine Frist: **E1 bis E4 sind instanzgebunden und gehören deshalb in die ersten Tage.** Nur E5 hängt an
Hardware, nicht an der Instanz, und kann warten.

- [ ] **E1 · Service Worker unter `/ccm/`** → beantwortet **G10**
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

- [ ] **E4 · `login_token` in der URL am `/ccm/`-Pfad** → beantwortet **G9** – **doppelt blockiert**
      Es fehlt das Custom Module (T1) **und** ein Token, an den ein Administrator regulär herankommt (E3/G18).
      `…/ccm/infoscreen-designer/player?screen=…&login_token=<TOKEN>&user_id=<ID>&no_url_rewrite=true` in einem
      privaten Fenster aufrufen. **Prüfen, dass wirklich der Infoscreen-Benutzer angemeldet ist** – ChurchTools
      antwortet anonym als öffentlicher Benutzer, ein fehlgeschlagener Login fällt sonst nicht auf.

- [ ] **E5 · Auf der echten Hardware ansehen**
      Pi-Generation, Auflösung, Ausrichtung, Overscan, FullPageOS-Stand. Entscheidet über
      **Offene Entscheidung 3** (Hardware) und darüber, ob Videos überhaupt in Frage kommen.

## F. Auskünfte einholen (Laufzeit: Tage)

Früh anstoßen, weil die Antwort nicht von uns abhängt.

- [ ] **F1 · Support anschreiben** – `support@churchtools.de`
      - ~~Wie widerruft ein Administrator den Login-Token eines Geräts?~~ **Entfällt** – über den
        Passwortwechsel des Geräte-Benutzers (E3/G18), am 2026-09-23 gemessen.
      - **Zuerst: Custom Modules für die Testinstanz freischalten.** *(angefragt am 2026-09-23; laut Auskunft vom 2026-09-24 schalten die Entwickler frei, nicht das Paket – Rückmeldung steht aus)*
        Ohne sie sind B5, B6, C1–C4, E1 und E4 blockiert – siehe T1.
      - **Lässt sich die Testinstanz über die 30 Tage hinaus verlängern?** Wir sind Kunde und
        entwickeln eine Extension; 30 Tage reichen dafür nicht – erst recht nicht, wenn ein Teil davon
        auf die Freischaltung verstreicht.
      - Ist ein Rate-Limit dokumentiert? (**G16** – gemessen wurde keines bei 60 Anfragen je Sekunde,
        aber gemessen ist nicht zugesagt.)
      - ~~Ist ein Speicherziel für Dateien aus Custom Modules geplant?~~ **Entfällt** – die Wiki-Kategorie
        samt Bilddienst beantwortet G8.

- [ ] **F2 · Lukas Block (`lubl`) im Forum ansprechen**
      Nicht zu Fragen, die sein Code beantwortet, sondern zu G8, G10 und zur Idee einer gemeinsamen
      `ct-utils`-Bibliothek. **Geparkt am 2026-09-24** – die gemeinsame Bibliothek ist aus dem Plan gestrichen.

- [ ] **F3 · `bensteUEM/ct-events-load` lesen**
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
- [ ] **G-E3 · Zielgruppe** – nur wir, oder von Anfang an Extension Store (**G17**)
- [x] **G-E4 · MVP-Zuschnitt** – **entschieden am 2026-09-24**: wie in `Plan.md`, „Funktionsumfang – MVP".
      Kein Web-Code-Block, keine Geburtstage, keine Videos in V1.
- [ ] **G-E5 · Wer gestaltet** – nur wir, oder nicht-technische Ehrenamtliche
- [ ] **G-E6 · Rückfallposition Medien** – ist „nur externe URLs" ein tragfähiger MVP?
- [ ] **G-E7 · Zeitbudget** – der Plan nennt sieben Phasen und keine Schätzung
- [ ] **G-E8 · Aktualität** – wie schnell muss eine Änderung auf dem TV sein? (setzt das Konfigurationsintervall)
- [ ] **G-E9 · Ton im Foyer** – ja oder nein

---

## Abschluss

- [x] **Alle Befunde in [`Befunde.md`](Befunde.md) eingetragen** *(Stand 2026-09-23)*: beantwortete Punkte nach
      oben, mit Datum und Quelle (Instanz, Spezifikation oder fremder Code).
      Beantwortet: **G1–G8, G11, G14, G15, G18, G19, G20**; **G16** und **G21** zur Hälfte.
      **G21** ist seit dem 2026-09-23 gebaut und gemessen – offen bleiben daran nur noch `authId` 306 gegen 403, die Sichtbarkeit von Beiträgen und das Archivieren als zweite Notbremse.
      Offen und an der Freischaltung hängend: **G9, G10**; **G12, G13** sind seit G22 hinfällig. Dazu **G17** als Entscheidung.
      **G18 hat den Notfallpfad aus E3 erst widerlegt und dann ersetzt** – die Notbremse ist der Passwortwechsel.
      Belege liegen lokal unter `fixtures/` – **nicht im Repo**, siehe `fixtures/README.md`.
- [ ] **Erst danach das Screen-Schema festlegen.**

## Was dabei nicht passieren darf

- Keine Zugangsdaten und keine Instanz-URL ins Repo – `.env` bleibt ignoriert, Instanz-URL und Token tragen
  kein `VITE_`-Präfix, und `scripts/check-dist.js` prüft das `dist/`.
- Keine Tests gegen die Produktivinstanz, die Daten verändern – dafür gibt es jetzt die Testinstanz.
  Muss doch produktiv gearbeitet werden, hat das Testmodul einen eigenen Key und schreibt nur in eigene Kategorien.
- Keine Testinstanz unter erfundenem Gemeindenamen anlegen – die vorhandene läuft auf den echten Namen.
- Die Frist nicht verstreichen lassen, ohne die Fixtures und den Typ-Snapshot gesichert zu haben.
  **Die Fixtures sind seit dem 2026-09-23 aufgezeichnet, der Typ-Snapshot fehlt noch** (hängt an der Freischaltung, B5).
  Da `fixtures/` nicht versioniert ist, ersetzt **keine** Sicherung im Repo den Verlust dieses Arbeitsplatzes –
  eine Kopie außerhalb gehört dazu. **Seit dem 2026-09-24 gesichert**; was danach noch aufgezeichnet wird,
  vor Ablauf der Instanz nachsichern.
- Die aufgezeichneten Antworten nicht roh weitergeben: Instanz-URL, `admin_mail` und personenbezogene Felder
  werden vorher ersetzt. Wie, steht in `fixtures/README.md`.
- An bestehenden Rollen der Rechteverwaltung nichts ändern – eigene Testgruppe verwenden.
