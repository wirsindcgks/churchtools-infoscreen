# Lokale Testumgebung

Wie man den Infoscreen Designer auf dem eigenen Rechner einrichtet, startet, testet und wieder beendet.
Warum die Umgebung so gebaut ist, steht in [`Plan.md`](Plan.md); die Arbeitsregeln in [`AGENTS.md`](AGENTS.md).

## Wie die Umgebung aussieht

```
Browser ──► Vite-Dev-Server (localhost:5173) ──► Testinstanz <instanz>.church.tools
            │  /ccm/infoscreen-designer/   die App selbst, mit Hot Reload
            │  /api      ─ Proxy, meldet sich mit CT_LOGIN_TOKEN an
            │  /images   ─ Proxy, anonym (Bilddienst, G14)
            │  /logo     ─ Proxy, anonym (Gemeindelogo, G29)
```

- **Der Dev-Server spielt die Rolle von ChurchTools.** Er liefert die App unter demselben Pfad aus wie später
  die Instanz (`/ccm/infoscreen-designer/`) und reicht alle Anfragen an die Testinstanz weiter.
- **Angemeldet wird im Proxy, nicht im Browser.** Der Login-Token steht nur in der `.env` und im
  Node-Prozess; der Browser sieht weder Token noch Cookie. Deshalb klappt das auch in Safari.
- **Demo-Modus – die Vorgabe in der Entwicklung.** Die Screens liegen im **Speicher des Browsers**, nicht in
  ChurchTools – auch seit die Extension auf der Testinstanz installiert ist. Sonst schrieben Dev-Server und
  e2e-Tests unbemerkt in deren echte Daten. Wer bewusst mit den echten Daten arbeiten will, setzt in der `.env`
  `VITE_USE_MODULE=true` (schreibende Zugriffe vorher besprechen, `AGENTS.md`). Beim ersten Öffnen legt die App den Screen
  „Demo – Foyer" an. Alles andere ist echt:

  | Echt, von der Testinstanz | Nur im Browser |
  | --- | --- |
  | Anmeldung, Kalender, Termine | Screens, Playlists, Slides |
  | Gemeindename und Logo | Einträge der Mediathek |
  | Bilder im Wiki-Bereich „Infoscreen" (Upload schreibt dorthin!) | |

  Designer und Player **in Tabs desselben Browsers** teilen sich die Demo-Screens; ein offener Player
  übernimmt Gespeichertes sofort. Ein anderer Browser hat seine eigenen. Zurücksetzen: auf der Startseite
  „Demo zurücksetzen".
- **Rechte:** Über den Proxy arbeitet man mit den Rechten des Kontos, dessen Token in der `.env` steht –
  in der Regel ein Administrator. Den Hinweis „Dir fehlen Rechte" sieht man damit nicht.

## Einmalig einrichten

**Voraussetzungen:** Node.js (aktuelle LTS oder neuer; das CI nutzt `lts/*`), npm, Git, Zugang zur Testinstanz.

1. **Abhängigkeiten installieren**

   ```sh
   npm ci
   npx playwright install chromium webkit   # nur für die e2e-Tests
   ```

2. **`.env` anlegen** – aus der Vorlage, die Datei selbst wird **nie** eingecheckt:

   ```sh
   cp .env-example .env
   ```

   Dann eintragen:

   | Schlüssel | Inhalt |
   | --- | --- |
   | `CT_BASE_URL` | Adresse der Testinstanz, z. B. `https://<instanz>.church.tools` |
   | `CT_LOGIN_TOKEN` | Login-Token eines Kontos der Testinstanz |

   **Kein `VITE_`-Präfix** vor diesen beiden: Alles mit `VITE_` schreibt Vite ins Bündel, und dann stünde die
   Instanz-URL im Release. Eine Zeile wie `VITE_BASE_URL=…` gehört gelöscht.

   Den Login-Token erzeugt `POST /api/login/token` aus Benutzername und Passwort des Kontos (G18, G21).
   **Nur ein Konto der Testinstanz verwenden, nie eines der Produktivinstanz.**

3. **Fixtures zurückspielen** (optional). Aufgezeichnete Antworten der Testinstanz liegen unter `fixtures/`,
   sind aber **nicht versioniert** – ein frisch geklonter Rechner hat sie nicht. Ohne sie laufen die
   Unit-Tests trotzdem; die Tests, die Fixtures brauchen, erscheinen als **übersprungen**, nicht als grün.
   Wer sie braucht, spielt sie aus der Sicherung außerhalb des Repos zurück. Wie sie bereinigt wurden, steht in
   `fixtures/README.md`.

## Starten

```sh
npm run dev
```

Danach im Browser:

| Was | Adresse |
| --- | --- |
| **Designer** | <http://localhost:5173/ccm/infoscreen-designer/> |
| **Player** (Demo-Screen) | <http://localhost:5173/ccm/infoscreen-designer/player?screen=demo> |

Änderungen am Code erscheinen sofort im Browser. Eine Änderung an `vite.config.ts` oder `.env` startet den
Server von selbst neu.

**Einen anderen Port** nimmt man, wenn 5173 belegt ist, etwa während die e2e-Tests laufen sollen:

```sh
npm run dev -- --port 5174
```

## Beenden

- Im Terminal, in dem der Server läuft: **`Ctrl+C`**.
- Läuft er im Hintergrund oder das Terminal ist weg, den Prozess am Port beenden:

  ```sh
  lsof -ti :5173 | xargs kill
  ```

Die Demo-Screens bleiben im Browser erhalten und sind beim nächsten Start wieder da.

## Tests und Prüfungen

| Befehl | Was er prüft | Braucht die Testinstanz? |
| --- | --- | --- |
| `npm test` | Unit-Tests (Vitest) | nein |
| `npm run lint` | ESLint | nein |
| `npm run typecheck` | TypeScript, auch in `.vue`-Dateien | nein |
| `npm run build` | Release-Bündel plus `scripts/check-dist.js`: ein JS-Bündel, kein Inline-Skript, keine Instanz-URL, keine fremde Schriftquelle, Lizenztexte der Schriften, kein Demo-Code | nein |
| `npm run smoke` | e2e-Tests (Playwright) in **Chromium und WebKit** | **ja** – über die `.env` |

Das CI auf GitHub führt die ersten vier bei jedem Push aus; die e2e-Tests laufen nur lokal.

### e2e-Tests

```sh
npm run smoke                                   # alle, Chromium und WebKit
npx playwright test e2e/player.spec.ts          # eine Datei
npx playwright test --project chromium          # nur ein Browser
npx playwright test --grep-invert "upload an image"   # ohne den schreibenden Test
```

- Playwright startet den Dev-Server auf Port 5173 selbst – oder **nutzt einen laufenden mit**.
- Jeder Test beginnt mit einem frischen Browser, also mit frisch angelegtem Demo-Screen.
- Bildschirmfotos landen unter `test-results/` (nicht versioniert).
- **`e2e/media.spec.ts` schreibt auf die Testinstanz:** Er lädt ein Testbild in den Wiki-Bereich „Infoscreen"
  und löscht es am Ende wieder. Scheitert er vorher, bleibt die Datei liegen. Nach den Arbeitsregeln wird ein
  schreibender Zugriff vorher besprochen – im Zweifel mit `--grep-invert "upload an image"` ausschließen.
- Alle anderen e2e-Tests lesen nur. Wo sie Rechte oder Anmeldungen durchspielen, verändern sie die Antwort
  im Browser, nicht die Instanz.

## Release-Paket bauen

```sh
npm run release
```

Baut `dist/` und packt es als ZIP nach `releases/` (nicht versioniert), benannt nach Version und Commit, etwa
`churchtools-infoscreen-v0.1.0-8c241d9.zip`. Das ZIP lässt sich zum Ausprobieren direkt in ChurchTools hochladen:
**Extension-Verwaltung → Infoscreen Designer → Bearbeiten → ZIP wählen**. Welche Fassung installiert ist, steht unten
auf der Seite „Einstellungen" des Designers.

## Release veröffentlichen

Ein Tag `vX.Y.Z` auf GitHub baut das Release von selbst (`.github/workflows/release.yml`). ChurchTools kann sich
Updates nicht selbst holen; ein Administrator lädt das ZIP unter „Releases" herunter und in der Extension-Verwaltung
hoch.

1. **`CHANGELOG.md`**: die Einträge unter `## [Unreleased]` in einen neuen Abschnitt `## [0.1.0] – 2026-09-25`
   verschieben, `[Unreleased]` leer stehen lassen.
2. **Version setzen** – schreibt `package.json` und `package-lock.json`, ohne Commit und Tag:

   ```sh
   npm version 0.1.0 --no-git-tag-version
   ```

3. **Prüfen**, dass alles zusammenpasst – dieselbe Prüfung macht der Workflow als Erstes:

   ```sh
   npm run release:check -- v0.1.0
   ```

4. **Committen, taggen, pushen** – mit dem Konto `wirsindcgks`:

   ```sh
   git commit -am "Version 0.1.0"
   git tag v0.1.0
   git push origin main v0.1.0
   ```

5. Der Workflow prüft, testet, baut und veröffentlicht `churchtools-infoscreen-v0.1.0.zip` mit dem
   CHANGELOG-Abschnitt als Beschreibung. Passt eine Version nicht, bricht er vor dem Bauen ab; dann den Tag löschen
   (`git push origin :v0.1.0`, `git tag -d v0.1.0`), korrigieren und neu taggen.

## Stolpersteine

- **Die Testinstanz läuft am 2026-10-22 um 21:53 ab.** Danach funktionieren Dev-Server und e2e-Tests nicht mehr
  gegen sie; Unit-Tests, Lint, Typecheck und Build schon.
- **„ChurchTools ist gerade nicht erreichbar"** auf der Startseite: meist ein fehlender oder abgelaufener
  `CT_LOGIN_TOKEN`, oder die Instanz ist nicht erreichbar.
- **Port 5173 belegt:** Ein anderer Dev-Server läuft noch – beenden (siehe oben) oder einen anderen Port nehmen.
- **Ein e2e-Test scheitert mit „Network Error":** Gelegentlich antwortet die Testinstanz über den Proxy nicht.
  Einmal wiederholen, bevor man einen Fehler im Code sucht.
- **Gegen die Produktivinstanz wird nichts geschrieben und nichts aufgezeichnet** – auch nicht „nur kurz zum
  Testen" (`AGENTS.md`).
