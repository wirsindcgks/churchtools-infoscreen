# Phase 0 – Vorbereitungs-Checkliste

Abzuarbeiten vor der ersten Zeile Anwendungscode. Jeder Punkt nennt, **was zu tun ist**, **woran man das
Ergebnis erkennt** und **welche Frage aus `Plan.md`, Abschnitt G** er beantwortet. Befunde gehören danach in
`Plan.md` – diese Datei ist die Arbeitsliste, der Plan ist das Gedächtnis.

Die Reihenfolge folgt dem Preis: erst was nichts kostet, dann was Zeit kostet, zuletzt was Daten anfasst.

**Grundregel:** Ein `404` der ChurchTools-API ist kein Beweis für eine fehlende Route. Jede Prüfung läuft
angemeldet und mit ausreichenden Rechten, sonst ist ihr Ergebnis wertlos (Lehre aus G1).

---

## A. Kostenlos – nur hinsehen (ca. 30 Minuten)

Alles an `ctpassstore`, dem fremden Modul, das auf unserer Instanz bereits läuft. Nichts wird gebaut,
nichts verändert.

- [ ] **A1 · Einbettung ansehen** → beantwortet **G6**
      `https://<instanz>/ccm/ctpassstore/` öffnen, Entwicklerwerkzeuge daneben.
      - Steht die ChurchTools-Navigation drumherum?
      - Hängt das Modul in einem `<iframe>` oder im Dokument der Hostseite?
        (Elemente-Ansicht: Gibt es ein `iframe` um `#app`?)
      - Ist `window.settings.base_url` in der Konsole gesetzt?
      - Woher kommen die Assets – `/ccm/ctpassstore/assets/…`?
      **Erwartung laut Indiz:** kein iframe. Falls bestätigt: Die Bühne braucht eine eigene Stilgrenze, und
      der Kiosk-Modus wird `position: fixed; inset: 0`.

- [ ] **A2 · Content-Security-Policy ablesen** → beantwortet **G15**
      Im Netzwerk-Reiter die Antwort der Modulseite anklicken, Antwort-Header lesen:
      `Content-Security-Policy`, `X-Frame-Options`.
      Entscheidet, ob `srcdoc`-Rahmen, Inline-Styles und eingebettete Fremdseiten überhaupt erlaubt sind.

- [ ] **A3 · SPA-Fallback prüfen** → beantwortet **G7**
      `https://<instanz>/ccm/ctpassstore/irgendwas` aufrufen.
      - Modulseite → echte History-Routen sind möglich.
      - 404 → **Hash-Route bleibt Vorgabe** (`#/player?screen=foyer-links`).
      Für uns kritischer als für andere: Der Player lädt sich nachts neu, und zwar auf seiner eigenen URL.

- [ ] **A4 · Rechteobjekt ansehen** → bestätigt **G4**
      Angemeldet `https://<instanz>/api/permissions/global` aufrufen und unter `data.ctpassstore` nachsehen,
      wie ein echtes `CustomModulePermission` aussieht.

## B. Entwicklungsumgebung (ca. ein halber Abend)

- [ ] **B1 · Boilerplate aufsetzen**
      <https://github.com/churchtools/extension-boilerplate> klonen, `.env` aus `.env-example` anlegen.
      **`.env` gehört nicht ins Repo** – vor dem ersten Commit prüfen, dass `.gitignore` sie erfasst.

- [ ] **B2 · Vite-Proxy statt CORS**
      `/api` → Instanz im Vite-Dev-Server proxen. Das vermeidet CORS vollständig und löst zugleich den
      Safari-Fall. **Nicht** `access_control_allow_origins` der Instanz öffnen.

- [ ] **B3 · „Hallo <Vorname>" aus `/whoami`**
      `npm run dev`, Anmeldung über die Dev-Zugangsdaten, Name des angemeldeten Anwenders anzeigen.

- [ ] **B4 · Einmal in Safari öffnen**
      Nicht nur in Chrome. Safari blockt `Secure; SameSite=None` auf `http://localhost`; wenn etwas bricht,
      dann hier. Gegebenenfalls HTTPS im Dev-Server über mkcert.

- [ ] **B5 · Typ-Snapshot holen**
      `ct-types.d.ts` aus der generierten Typdatei **unserer** Instanz übernehmen, nicht von Hand pflegen und
      nicht aus der Demo. Als versionierten Snapshot einchecken.

- [ ] **B6 · Testmodul anlegen**
      Eigener Key `infoscreen-cgks-test`, damit eine spätere produktive Installation unberührt bleibt.
      Bauen mit `VITE_KEY=infoscreen-cgks-test npm run release`, hochladen über
      System-Einstellungen → Extensions → Extension hinzufügen. **Kurzbezeichner muss exakt zum Build passen,
      Ordnernamen sind case-sensitiv.**

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
      über `GET` wiederfinden.

- [ ] **D2 · Das Bild tatsächlich anzeigen** → beantwortet **G14**
      Die zurückgegebene Datei-URL in ein `<img src="…">` setzen und im Browser anzeigen.
      **Das ist der eigentliche Test**, nicht der Upload. Er beantwortet zugleich:
      Ist die URL cookie-authentifiziert, tokenbehaftet oder läuft sie ab? Davon hängt ab, ob ein
      Service Worker oder der Player sie überhaupt laden und zwischenspeichern kann.

- [ ] **D3 · Fallweise Ausweichpfade prüfen**
      Nur falls D1 scheitert: `attachments` (woran bindet `domainIdentifier`?), dann
      `POST /files/{domainType}/{domainIdentifier}/link` für externe Adressen.
      Ergebnis entscheidet über **Offene Entscheidung 5** – ob „nur externe URLs" ein tragfähiger MVP ist.

- [ ] **D4 · Aufräumen**
      Testdateien und Test-Wiki-Kategorie wieder entfernen. Uploads erzeugen echte Inhalte.

## E. Player-Voraussetzungen (nach Phase 2, nicht früher)

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

- [ ] **E4 · `login_token` in der URL am `/ccm/`-Pfad** → beantwortet **G9**
      `…/ccm/infoscreen-cgks-test/?login_token=<TOKEN>&user_id=<ID>&no_url_rewrite=true` in einem
      privaten Fenster aufrufen. **Prüfen, dass wirklich der Infoscreen-Benutzer angemeldet ist** – ChurchTools
      antwortet anonym als öffentlicher Benutzer, ein fehlgeschlagener Login fällt sonst nicht auf.

- [ ] **E5 · Auf der echten Hardware ansehen**
      Pi-Generation, Auflösung, Ausrichtung, Overscan, FullPageOS-Stand. Entscheidet über
      **Offene Entscheidung 1** und darüber, ob Videos überhaupt in Frage kommen.

## F. Auskünfte einholen (Laufzeit: Tage)

Früh anstoßen, weil die Antwort nicht von uns abhängt.

- [ ] **F1 · Support anschreiben** – `support@churchtools.de`
      - Instanz für die Entwicklung einer Extension (wir sind Kunde, 30 Tage reichen nicht)
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
- Keine Tests gegen die Produktivinstanz, die Daten verändern. Das Testmodul hat einen eigenen Key und
  schreibt nur in eigene Kategorien.
- Keine Testinstanz unter erfundenem Gemeindenamen anlegen.
- An bestehenden Rollen der Rechteverwaltung nichts ändern – eigene Testgruppe verwenden.
