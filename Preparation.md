# Phase 0 – Vorbereitungs-Checkliste

Abzuarbeiten vor der ersten Zeile Anwendungscode. Jeder Punkt nennt, **was zu tun ist**, **woran man das
Ergebnis erkennt** und **welche Frage aus `Plan.md`, Abschnitt G** er beantwortet. Befunde gehören danach in
`Plan.md` – diese Datei ist die Arbeitsliste, der Plan ist das Gedächtnis.

Die Reihenfolge folgte bisher dem Preis: erst was nichts kostet, dann was Zeit kostet, zuletzt was Daten
anfasst. **Seit dem 2026-09-22 gilt ein anderer Taktgeber.**

> **⏱ Die Testinstanz läuft ab**
>
> `https://test-cg-ks.church.tools` – leer, Build 32882 wie produktiv, **30 Tage Lizenz, bis etwa 2026-10-22**.
> Eine Verlängerung ist ungeklärt (**F1**, zuerst zu fragen).
>
> **Regel, die dieser Liste vorgeht: Was nur eine Instanz beantworten kann, wird zuerst gemessen.
> Was lokal geht, geht auch im November noch.** Damit ändert sich die Reihenfolge:
> **T** → **B** → **C**, **D**, **E** (alle instanzgebunden, alle auf der Testinstanz) → erst danach die
> Oberfläche gegen den Mock. **F1 geht heute raus**, nicht am Ende.
>
> **Und alles, was die Instanz überlebt, wird mitgeschrieben**: Fixtures ins Repo, Typ-Snapshot einchecken.
> Das ist der Ertrag dieser 30 Tage.

**Grundregel:** Ein `404` der ChurchTools-API ist kein Beweis für eine fehlende Route. Jede Prüfung läuft
angemeldet und mit ausreichenden Rechten, sonst ist ihr Ergebnis wertlos (Lehre aus G1).

---

## T. Trägt die Testinstanz? (fünf Minuten, vor allem anderen)

Ohne diesen Befund ist jede Planung auf die Testinstanz hin wertlos – der Lizenzumfang einer Testinstanz
muss dem der Produktivinstanz nicht gleichen.

- [ ] **T1 · Custom Modules auf der Testinstanz** – **angemeldet**, nicht anonym
      `GET /api/config` → `feature_custommodule`, `GET /api/custommodules` → **200**.
      Anonym geprüft ist das wertlos: Die anonyme `config`-Antwort führt das Flag gar nicht, und
      `/api/custommodules` antwortet anonym mit 404 – gemessen am 2026-09-22, und genau die Falle aus **G1**.
      - Trägt → alles Instanzgebundene wandert dorthin, die Produktivinstanz bleibt unberührt.
      - Trägt nicht → zurück zum kontrollierten Vorgehen auf der Produktivinstanz, und F1 wird dringend.

- [ ] **T2 · Zugang einrichten**
      Eigener Administrator-Benutzer, Zugangsdaten in die lokale `.env` (**nicht ins Repo**).
      Die Instanz ist leer – ein Kalender, ein paar Termine mit Bild und zwei Gruppen sind die Grundlage
      für alles Weitere und liefern zugleich die Fixtures.

- [ ] **T3 · Ablaufdatum notieren**
      In ChurchTools nachsehen, wann die Lizenz tatsächlich endet, und das Datum hier und in `Plan.md`
      eintragen. Ein geschätztes Datum taugt nicht als Taktgeber.

## A. Kostenlos – nur hinsehen (ca. 30 Minuten)

Alles an `ctpassstore`, dem fremden Modul, das auf unserer Instanz bereits läuft. Nichts wird gebaut,
nichts verändert.

**Stand 2026-09-22: A1, A3 und A4 sind erledigt**, sie haben G6, G7 und G4 beantwortet. Offen ist allein A2 –
der Antwort-Header. Ein Aufruf, zwei Minuten.

- [x] **A1 · Einbettung ansehen** → **beantwortet G6** *(2026-09-22)*
      **Kein iframe.** ChurchTools hängt die Extension in den eigenen Dokumentkopf
      (`<script src="/ccm/ctpassstore/assets/index-BtWd1lCL.js" type="module">` samt zugehörigem CSS),
      die Navigation steht drumherum, das Modul rendert in deren Inhaltsbereich. Assets kommen aus
      `/ccm/<key>/assets/…` mit Build-Hash im Namen. `window.settings` liegt als JSON im Dokument
      (`<script type="application/json" id="ct-settings-json">`) mit `base_url`, `files_url`, `csrfToken`,
      `modules` und dem vollständigen `auth`-Objekt. Folgen stehen in `Plan.md`, G6.

- [ ] **A2 · Content-Security-Policy ablesen** → beantwortet **G15** – **der letzte offene Punkt im A-Block**
      Im Netzwerk-Reiter die Antwort der Modulseite anklicken, Antwort-Header lesen:
      `Content-Security-Policy`, `X-Frame-Options`.
      Im Quelltext steht keine CSP als `<meta http-equiv>`, aber ein leeres `nonce=""` an einem Inline-Skript –
      die Vorrichtung ist da, über den scharfen Zustand sagt sie nichts. Nur der Header entscheidet.
      Gleich mitnehmen: der **Statuscode** von `/ccm/ctpassstore/pasword` (200 oder 404 mit Rumpf?) – offener Rest von A3.
      Entscheidet, ob `srcdoc`-Rahmen, Inline-Styles und eingebettete Fremdseiten überhaupt erlaubt sind.

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

- [ ] **B1 · Boilerplate aufsetzen**
      <https://github.com/churchtools/extension-boilerplate> klonen, `.env` aus `.env-example` anlegen.
      **`.env` gehört nicht ins Repo** – vor dem ersten Commit prüfen, dass `.gitignore` sie erfasst.

- [ ] **B2 · Vite-Proxy statt CORS**
      `/api` → **Testinstanz** im Vite-Dev-Server proxen. Das vermeidet CORS vollständig und löst zugleich den
      Safari-Fall. **Nicht** `access_control_allow_origins` der Instanz öffnen.

- [ ] **B3 · „Hallo <Vorname>" aus `/whoami`**
      `npm run dev`, Anmeldung über die Dev-Zugangsdaten, Name des angemeldeten Anwenders anzeigen.

- [ ] **B4 · Einmal in Safari öffnen**
      Nicht nur in Chrome. Safari blockt `Secure; SameSite=None` auf `http://localhost`; wenn etwas bricht,
      dann hier. Gegebenenfalls HTTPS im Dev-Server über mkcert.

- [ ] **B5 · Typ-Snapshot holen**
      `ct-types.d.ts` aus der generierten Typdatei **unserer** Instanz übernehmen, nicht von Hand pflegen und
      nicht aus der Demo. Als versionierten Snapshot einchecken.
      Die Testinstanz taugt dafür (Build 32882, derselbe Stand) – **und sie ist der Grund, es jetzt zu tun**:
      Die Spezifikation wird pro Benutzer und Rechten gefiltert ausgeliefert (G1), nach Ablauf der Lizenz
      gibt es sie dort nicht mehr. Mit einem Administrator-Konto holen, einchecken, fertig.

- [ ] **B6 · Testmodul anlegen**
      **Auf der Testinstanz** – und dort gleich unter dem echten Key `infoscreen-cgks`, weil damit auch der
      spätere Pfad `/ccm/infoscreen-cgks/` mitgetestet wird. Der Ausweichkey `infoscreen-cgks-test` bleibt für
      den Fall, dass doch auf der Produktivinstanz gearbeitet werden muss.
      Bauen mit `VITE_KEY=infoscreen-cgks npm run release`, hochladen über
      System-Einstellungen → Extensions → Extension hinzufügen. **Kurzbezeichner muss exakt zum Build passen,
      Ordnernamen sind case-sensitiv.**
      **Direkt danach die Rechte vergeben** – sonst ist das Modul auch für den Administrator unsichtbar
      und der Fehler wird im Build gesucht (A4).

## C. Am eigenen Testmodul messen (ca. eine Stunde)

Setzt B6 voraus. Diese vier Punkte entscheiden über den Zuschnitt des Datenmodells in Phase 1.

- [ ] **C1 · Lässt sich über `domainType`/`domainId` filtern?** → beantwortet **G11**
      Zwei Datenwerte mit unterschiedlichem `domainType` anlegen, dann
      `GET …/customdatavalues?domainType=…` versuchen.
      - Filter greift → das Lesen ganzer Kategorien entfällt, Datenmodell wird einfacher.
      - Filter greift nicht → es bleibt bei „ganze Kategorie holen, im Client filtern".

- [ ] **C2 · Wird das JSON Schema durchgesetzt?** → beantwortet **G12**
      Kategorie mit engem Schema anlegen, dann einen Wert schreiben, der es verletzt.
      - Abgelehnt → wir brauchen ein vollständiges Schema und stoßen an 2.000 Zeichen.
      - Angenommen → **permissives Schema in ChurchTools, Validierung im Client** (Vorgabe).

- [ ] **C3 · Was bewirkt `securityLevelId`?** → beantwortet **G13**
      Zwei Kategorien mit unterschiedlicher Stufe, Zugriff mit einem gering berechtigten Benutzer.
      Wichtig für `status` – die einzige Kategorie, auf die ein unbeaufsichtigtes Gerät schreiben darf.

- [ ] **C4 · Grenzen gegenprüfen**
      Einen Wert mit 10.001 Zeichen schreiben. Kommt eine saubere Fehlermeldung oder eine stille Kürzung?
      Eine stille Kürzung wäre der unangenehmste Fall und müsste im Designer abgefangen werden.

## D. Medien – der teuerste offene Punkt (ca. eine Stunde)

- [ ] **D1 · Wiki-Kategorie als Mediathek** → beantwortet **G8**
      Kategorie „Infoscreen-Medien" anlegen, Bild über `POST /files/wiki_<kategorie>/<id>` hochladen,
      über `GET` wiederfinden. **Die Antwort des `GET` vollständig ansehen:** Trägt die Datei neben `fileUrl`
      auch eine **`imageUrl`** (`/images/{fileId}/{hash}`)? Das ist die eigentliche Frage, nicht der Upload –
      siehe `Plan.md`, G14.

- [ ] **D2 · Das Bild tatsächlich anzeigen** → beantwortet **G14**
      Beide Adressen in ein `<img src="…">` setzen – angemeldet **und** in einem zweiten, abgemeldeten Fenster.
      - **`imageUrl` vorhanden und anonym 200** → mit `?w=1920&h=1080&fit=max` gegenprüfen. Damit sind
        serverseitige Skalierung, Cachefähigkeit und G14 in einem Zug erledigt. Zu notieren bleibt, dass diese
        Adressen nur ein Hash schützt – das gehört in die Betriebsdoku, nicht in eine Fußnote.
      - **Nur `fileUrl`** → abgemeldet ein 401 zu erwarten, angemeldet 200 über das Session-Cookie. Für den
        Player tragfähig, weil er auf derselben Domain läuft – aber ohne Skalierung, und die Frage an den
        Service Worker (E1) bleibt offen.

- [ ] **D3 · Fallweise Ausweichpfade prüfen**
      Nur falls D1 scheitert: `attachments` (woran bindet `domainIdentifier`?), dann
      `POST /files/{domainType}/{domainIdentifier}/link` für externe Adressen.
      **Nicht zu prüfen: `appointment_image` als Ablage.** Geprüft und verworfen – es bräuchte Trägertermine,
      die im Kalender, in der App und auf der Gemeindeseite auftauchen (Begründung in `Plan.md`, G8).
      Ergebnis entscheidet über **Offene Entscheidung 5** – ob „nur externe URLs" ein tragfähiger MVP ist.

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

- [ ] **E2 · Infoscreen-Benutzer anlegen** → Voraussetzung für G9
      Eigene Person ohne Zweifaktor, mit **minimalen Rechten**. Die tatsächliche Reichweite umfasst neben
      den Modulrechten auch Lesen auf Kalender, Beiträge, Gruppen und ggf. Wiki – siehe `Plan.md`, F.

- [ ] **E3 · Rückzugsweg üben** – **vor** dem produktiven Einsatz
      `DELETE /api/persons/{id}/logintoken` einmal ausführen und prüfen, dass der Token wirklich ungültig ist.
      Der Token ist ein Dauerpasswort auf einer SD-Karte; der Weg zurück muss geübt sein, bevor er gebraucht wird.
      Auf der Testinstanz kostet dieses Üben nichts – genau deshalb wird es dort gemacht und nicht produktiv.

- [ ] **E4 · `login_token` in der URL am `/ccm/`-Pfad** → beantwortet **G9**
      `…/ccm/infoscreen-cgks/player?screen=…&login_token=<TOKEN>&user_id=<ID>&no_url_rewrite=true` in einem
      privaten Fenster aufrufen. **Prüfen, dass wirklich der Infoscreen-Benutzer angemeldet ist** – ChurchTools
      antwortet anonym als öffentlicher Benutzer, ein fehlgeschlagener Login fällt sonst nicht auf.

- [ ] **E5 · Auf der echten Hardware ansehen**
      Pi-Generation, Auflösung, Ausrichtung, Overscan, FullPageOS-Stand. Entscheidet über
      **Offene Entscheidung 1** und darüber, ob Videos überhaupt in Frage kommen.

## F. Auskünfte einholen (Laufzeit: Tage)

Früh anstoßen, weil die Antwort nicht von uns abhängt.

- [ ] **F1 · Support anschreiben** – `support@churchtools.de`
      - **Zuerst: Lässt sich die Testinstanz über die 30 Tage hinaus verlängern?** Wir sind Kunde und
        entwickeln eine Extension; 30 Tage reichen dafür nicht. Diese Antwort taktet die gesamte Phase 0.
      - Ist ein Rate-Limit dokumentiert? (**G16**)
      - Ist ein Speicherziel für Dateien aus Custom Modules geplant? (**G8** – das kann nur ChurchTools beantworten)

- [ ] **F2 · Lukas Block (`lubl`) im Forum ansprechen**
      Nicht zu Fragen, die sein Code beantwortet, sondern zu G8, G10 und zur Idee einer gemeinsamen
      `ct-utils`-Bibliothek (**Offene Entscheidung 10**).

- [ ] **F3 · `bensteUEM/ct-events-load` lesen**
      Besonders `src/persistance.ts` und die Terminbehandlung – vor der ersten Zeile Bindungscode in Phase 4.

## G. Entscheidungen, die niemand für uns trifft

Die offenen Entscheidungen aus `Plan.md` – keine Recherche, sondern Festlegungen. Sie gehören beantwortet,
bevor das Screen-Schema steht.

- [ ] **G-E1 · Undo/Redo** – architekturrelevant, muss **vor Phase 1** fallen (Zustand oder Befehle?)
- [ ] **G-E2 · Hardware** – wie viele Geräte, welche Generation, Auflösung, Ausrichtung
- [ ] **G-E3 · Zielgruppe** – nur wir, oder von Anfang an Extension Store (**G17**)
- [ ] **G-E4 · MVP-Zuschnitt** – Web-Code-Block jetzt oder später? Geburtstage mit Einwilligung oder gar nicht?
- [ ] **G-E5 · Wer gestaltet** – nur wir, oder nicht-technische Ehrenamtliche
- [ ] **G-E6 · Rückfallposition Medien** – ist „nur externe URLs" ein tragfähiger MVP?
- [ ] **G-E7 · Zeitbudget** – der Plan nennt sieben Phasen und keine Schätzung
- [ ] **G-E8 · Aktualität** – wie schnell muss eine Änderung auf dem TV sein? (setzt das Konfigurationsintervall)
- [ ] **G-E9 · Ton im Foyer** – ja oder nein

---

## Abschluss

- [ ] **Alle Befunde in `Plan.md` eingetragen**, Abschnitt G: beantwortete Punkte nach oben, mit Datum und
      Quelle (Instanz, Spezifikation oder fremder Code).
- [ ] **Erst danach das Screen-Schema festlegen.**

## Was dabei nicht passieren darf

- Keine Zugangsdaten und keine Instanz-URL ins Repo – `.env` bleibt ignoriert, der Release-Build setzt
  `VITE_BASE_URL`, `VITE_USERNAME` und `VITE_PASSWORD` ausdrücklich leer.
- Keine Tests gegen die Produktivinstanz, die Daten verändern – dafür gibt es jetzt die Testinstanz.
  Muss doch produktiv gearbeitet werden, hat das Testmodul einen eigenen Key und schreibt nur in eigene Kategorien.
- Keine Testinstanz unter erfundenem Gemeindenamen anlegen – die vorhandene läuft auf den echten Namen.
- Die Frist nicht verstreichen lassen, ohne die Fixtures und den Typ-Snapshot im Repo zu haben.
- An bestehenden Rollen der Rechteverwaltung nichts ändern – eigene Testgruppe verwenden.
