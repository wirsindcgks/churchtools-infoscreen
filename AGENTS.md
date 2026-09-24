# Arbeitsregeln für Agenten

Dieses Repository entwickelt den **ChurchTools Infoscreen Designer**, ein ChurchTools Custom Module (CCM).
**Stand 2026-09-24: Die Entwicklungsumgebung steht** (Vue 3, Vite, Vitest, Playwright, CI), Produktcode gibt es
noch kaum. `npm run dev` läuft gegen die Testinstanz über den Vite-Proxy; `npm test` braucht keine Instanz,
`npm run smoke` schon.

## Die vier Dokumente

| Datei | Rolle | Wann sie gilt |
| --- | --- | --- |
| [`Plan.md`](Plan.md) | **Gedächtnis** – was gebaut wird und warum | Bei jeder Frage nach Architektur, Zuschnitt, Reihenfolge |
| [`Preparation.md`](Preparation.md) | **Arbeitsliste** – was als Nächstes zu tun ist | Beim Abhaken von Phase-0-Punkten |
| [`Befunde.md`](Befunde.md) | **Messprotokoll** – worauf sich beides stützt | **Alle Verweise „G1" bis „G21" zeigen hierher** |
| [`README.md`](README.md) | Außendarstellung, Abgrenzung zum Hersteller | Bei allem, was nach außen geht |

Ein Befund gehört nach `Befunde.md`, eine Festlegung nach `Plan.md`, ein Handgriff nach `Preparation.md`.
Wer eine Messung in den Plan schreibt, bläht ihn auf – genau das ist am 2026-09-23 korrigiert worden.

## Fünf Regeln, die Geld gekostet haben

1. **Der Pitch ist der Taktgeber, nicht das gerade Messbare.** Ist etwas durch den Hersteller blockiert, nicht in
   die nächstgelegene unblockierte Nische ausweichen, sondern fragen, was am **Produkt** weitergeht. Blockaden
   hängen hier typischerweise am Speichern und Ausliefern – und das steht am Ende, nicht am Anfang.
   *(Der Plan war einmal auf 63 % Plattformarchäologie gegen 20 % Produkt gelaufen.)*

2. **Zu ChurchTools-Verhalten vorab in der [ChurchTools Academy](https://churchtools.academy/de/) recherchieren**,
   nicht erst, wenn eine Messung unklar bleibt. **Die API zeigt Zustände, die Dokumentation zeigt Regeln.**
   Beispiel: Dass Berechtigungen rein **additiv** sind und dass die Rechte einer Gruppe erst bei Status „Aktiv"
   wirken, hätte keine Messung gezeigt – beides hätte die Einrichtungsanleitung falsch gemacht.
   Messung und Doku gegeneinander halten, beides mit Quelle vermerken.

3. **Ein `404` der ChurchTools-API beweist nichts.** Jede Prüfung läuft angemeldet und mit ausreichenden Rechten,
   sonst ist ihr Ergebnis wertlos. Dazu: Die OpenAPI-Spezifikation wird **pro Benutzer und Rechten gefiltert**
   ausgeliefert – ein Snapshot aus einer Sitzung ohne das nötige Recht ist schlimmer als keiner.

4. **Die API ist die Referenz, nicht der plausible Feldname.** Vor jeder Änderung an datengetriebenen Teilen gegen
   die Spezifikation **der eigenen Instanz** prüfen. Fremde Typ-Snapshots veralten: Der aus `ct-pass-store`
   (2025-09-02) führte Felder, die es auf Build 32882 nicht gibt.

5. **Fehlende Rechte sehen nicht wie Fehler aus.** Drei Verhaltensweisen treten nebeneinander auf und sind von
   außen nicht zu unterscheiden: `403` mit Klartext, `200` mit still gefilterter Liste, `200` mit leerer Liste.
   Wer „die Liste ist leer" als „es gibt nichts" liest, misst falsch. Einzelheiten in `Befunde.md`, G20.

## Was ohne Rückfrage nicht passiert

- **Schreibende Zugriffe auf die Testinstanz werden vorher besprochen.** Der Nutzer hat Schreibrechte erteilt –
  mit der ausdrücklichen Auflage, jede Änderung vorher zu erklären. Lesen ist frei.
- **Gegen die Produktivinstanz wird nichts geschrieben und nichts aufgezeichnet.** Lesende Stichproben sind in
  Ordnung.
- **An bestehenden Rollen der Rechteverwaltung wird nichts geändert** – dafür gibt es eine eigene Testgruppe.

## Geheimnisse und Fixtures

- **Keine Zugangsdaten und keine Instanz-URL ins Repo.** `.env` ist ignoriert. Instanz-URL und Login-Token
  heißen dort `CT_BASE_URL` und `CT_LOGIN_TOKEN` – **ohne `VITE_`-Präfix**, damit Vite sie nie ins Bündel
  schreibt; sie leben nur im Dev-Proxy. Die Anwendung selbst nimmt `window.settings.base_url` oder den eigenen
  Ursprung. `scripts/check-dist.js` bricht den Build ab, wenn im `dist/` eine `*.church.tools`-Adresse steht.
- **`fixtures/` ist bewusst nicht versioniert.** Ein frisch geklonter Arbeitsplatz hat die aufgezeichneten
  Antworten nicht und muss sie sich beschaffen, bevor Tests laufen.
- **Aufgezeichnet wird nur von der Testinstanz** – und vor dem Ablegen bereinigt. Zu entfernen sind mindestens:
  personenbezogene Felder, die Instanz-URL, Schlüssel und Geheimnisse (`site_licensekey`, `*_apikey`, `*_token`,
  `*_secret`) **und Datei- bzw. Bild-Hashes** – letztere sind Zugangsschlüssel, keine Kennungen: Die `imageUrl`
  liefert damit anonym `200`. Die vollständige Regel samt Begründung steht in `Plan.md`, „Konventionen".
  **Nicht** zu bereinigen sind Gruppen-, Kalender- und Dienstnamen: Umlaute, Längen und Namensgleichheiten sind
  als Testdaten wertvoll.

## Sprache und Form

- **Oberfläche und Dokumentation deutsch, Code und Bezeichner englisch.**
- **Commit-Nachrichten deutsch, im Betreff ohne Umlaute.** Der Betreff sagt, was sich geändert hat, der Rumpf warum.
- Markdown mit deutschen Anführungszeichen („…"), Dateiverweise als relative Links.
- `CHANGELOG.md` folgt *Keep a Changelog*, ohne „Unreleased"-Abschnitt – Einträge erst beim Versionssprung.

## Technischer Rahmen

Vue 3 + TypeScript + Vite + Pinia, `@churchtools/churchtools-client`, Vitest, Playwright – wie im
[Extension-Boilerplate](https://github.com/churchtools/extension-boilerplate) von ChurchTools.
Extension-Key `infoscreen-cgks`, Auslieferungspfad `/ccm/infoscreen-cgks/`. Lizenz GPL-2.0-or-later.

**Drei Bauregeln, die aus gemessenen Grenzen folgen** – Herleitung jeweils in `Befunde.md`:

- Der Build darf **kein Inline-Skript** ausliefern: Die Content-Security-Policy erlaubt `script-src` ohne
  `'unsafe-inline'`, auch auf `/ccm/`-Pfaden (G15). Externe Videos sind mangels `media-src` blockiert.
- Der **Player-Build hat keine nachzuladenden Chunks**. Ein Update würde sonst laufende Kiosk-Tabs mit einem
  `404` auf einen alten Chunk-Namen zerlegen – bemerkt sonntags, ausgelöst vormittags.
- **Zeiten kommen in UTC und werden in die Zeitzone der Instanz gerechnet – `timezone` aus `/api/config`, auch anonym
  und für den Geräte-Benutzer lesbar, bei uns `Europe/Berlin`. Gerechnet wird über `Intl` bzw. eine Zeitzonen-Bibliothek, nie über einen
  festen Offset.** ChurchTools hält die Ortszeit über die Zeitumstellung konstant (G19).
