---
name: release
description: Veröffentlicht eine neue Version des Infoscreen Designers (Changelog, Version-PR, Tag, Release-Workflow, ZIP melden) oder trägt nach „Prod läuft auf …“ die Produktivversion im Plan nach. Aufruf `/release` (neue Version) oder `/release prod` (Prod nachtragen). Nutzen, wenn der Nutzer ein Release, eine Version oder einen Patch veröffentlichen will oder meldet, dass die Produktivinstanz aktualisiert ist.
---

# Release

Fester Ablauf, kein Urteil nötig – bis auf die Versionsnummer und die Texte. Grundlage ist
[`LocalTests.md`](../../../LocalTests.md), „Release veröffentlichen“; dieser Skill ergänzt, was die Regeln in
`AGENTS.md` und die Erfahrung aus vielen Releases verlangen. **Hochladen nach ChurchTools macht immer der Nutzer**,
nie der Agent – weder auf die Test- noch auf die Produktivinstanz.

## Git und GitHub – immer als `cgksmedia`

```sh
C='credential.helper=!f() { test "$1" = get || exit 0; echo username=cgksmedia; echo "password=$(gh auth token -u cgksmedia)"; }; f'
git -c credential.helper= -c "$C" push …        # jeder Push, Pull, Fetch
GH_TOKEN=$(gh auth token -u cgksmedia) gh … -R wirsindcgks/churchtools-infoscreen
```

Nie direkt nach `main`: Zweig, PR, grüne Prüfung `check`, Squash-Merge.

**Warten** nie mit `gh pr checks --watch` im Vordergrund (hängt und reißt das Zeitlimit) und nie mit `sleep`-Ketten.
Stattdessen eine Schleife, die endet, sobald alle Prüfungen fertig sind:

```sh
until GH_TOKEN=$(gh auth token -u cgksmedia) gh pr view <PR> -R wirsindcgks/churchtools-infoscreen --json statusCheckRollup \
  --jq '(.statusCheckRollup|length)>0 and ([.statusCheckRollup[].status] | all(. == "COMPLETED"))' 2>/dev/null | grep -q true; do sleep 15; done
GH_TOKEN=$(gh auth token -u cgksmedia) gh pr view <PR> -R wirsindcgks/churchtools-infoscreen --json statusCheckRollup --jq '[.statusCheckRollup[].conclusion] | join(",")'
```

Mit `timeout` 600000; reicht das nicht, den Stand einmal einzeln abfragen statt die Schleife neu zu starten.
Meldet `gh pr merge` einen Netzwerkfehler, erst mit `git log origin/main` prüfen, ob der Merge doch durch ist.

## `/release` – neue Version

1. **Ausgangslage prüfen:** auf `main`, sauber, aktuell (`pull`). Seit dem letzten Tag gemergte PRs ansehen
   (`git log --oneline v<letzte>..HEAD`). Kein offener PR, der dazugehören soll.
2. **Version wählen:** neue Funktion → Minor (`0.65.0`), nur Korrekturen oder kleine Hinweise → Patch (`0.64.1`).
   Im Zweifel den Nutzer fragen.
3. **`CHANGELOG.md`:** neuer Abschnitt `## [X.Y.Z] – JJJJ-MM-TT` über dem letzten, Anwendertext auf Deutsch
   („Neu“, „Geändert“, „Behoben“), je Eintrag die Plan-Nummer in Klammern. Am Dateiende die Link-Definition
   `[X.Y.Z]: https://github.com/wirsindcgks/churchtools-infoscreen/releases/tag/vX.Y.Z`.
   - **Wunsch von außen** (Issue eines externen Nutzers): Dank als Absatz direkt unter der Überschrift, mit Link
     auf Profil und Issue, wertschätzend („für den Wunsch nach …“). Bekannte Ideengeber und ihre Schreibweise stehen
     im Gedächtnis („Ideengeber danken und Co-Autor“).
4. **`Plan.md`, „Auf einen Blick“:** in der Zeile „Veröffentlicht sind `v0.1.0` bis …“ die neue Version setzen und
   in der Klammer `vX.Y.Z`: Kurzbeschreibung, Punkt N anhängen. Beim betroffenen Punkt „gebaut (unveröffentlicht)“ durch
   „veröffentlicht mit `vX.Y.Z`“ ersetzen und nennen, was noch offen ist (Prüfung am Gerät, Rückmeldung).
   Die Prod-Zeile („dort läuft …“) **nicht** anfassen – das macht `/release prod`.
5. **Version setzen und prüfen:**
   ```sh
   git checkout -b version-X.Y.Z
   npm version X.Y.Z --no-git-tag-version
   npm run release:check -- vX.Y.Z
   ```
6. **Commit** `Version X.Y.Z`, Rumpf nur Co-Autor-Zeilen: die Attribution aus der Sitzung und – wenn ein Ideengeber
   in den umsetzenden Squash-Commits fehlt (`git log v<letzte>..HEAD --format=%B | grep -i co-authored`) – seine Zeile
   hier nachtragen (noreply-Adresse per `gh api users/<login>`; die Geschichte von `main` wird nie umgeschrieben).
7. **PR** `Version X.Y.Z`: kurz, welche PRs drin sind. Für jedes Issue, das mit dem Release **ganz** erledigt ist,
   „Closes #N“; sonst „Teil von #N“. Warten (siehe oben), dann Squash-Merge mit denselben Co-Autor-Zeilen im `--body`,
   `--delete-branch`.
8. **Tag:** `git checkout main`, `pull`, `git tag vX.Y.Z`, Tag pushen.
9. **Release-Workflow beobachten:** `gh run list --workflow release.yml -L 1` → `gh run watch <id> --exit-status`
   (im Hintergrund oder mit `timeout` 600000), danach `gh release view vX.Y.Z --json url,assets`. Bricht der
   Workflow ab: Tag löschen (`git push origin :vX.Y.Z`, `git tag -d vX.Y.Z`), korrigieren, neu taggen.
10. **Dem Nutzer melden:** Link auf das Release, Name des ZIPs, „in der Extension-Verwaltung hochladen“, was danach
    zu prüfen ist (Testinstanz, Fernseher, Gerät) – und dass er Bescheid gibt, wenn Prod läuft. Fernseher hängen an
    Prod: geprüft wird dort erst nach dem Release.

## `/release prod` – Produktivversion nachtragen

Nach „Prod läuft auf vX.Y.Z“ (oder „Prod aktualisiert“):

1. Zweig `plan-prod-X.Y.Z`. In `Plan.md`, „Auf einen Blick“, `dort läuft \`vALT\` (seit dem …; davor …` ersetzen durch
   `dort läuft \`vX.Y.Z\` (seit dem <heute>; davor \`vALT\`, …` – die Liste der früheren Versionen bleibt vollständig.
   Eine Bemerkung des Nutzers („erster Eindruck gut“) darf in die Klammer.
2. Commit `Plan: Produktivinstanz auf vX.Y.Z`, PR, warten, Squash-Merge, `main` ziehen.
3. Sagen, was für die veröffentlichten Punkte noch offen ist (Prüfung, Rückmeldung an Ideengeber, Archiv).
   **Ins Archiv** wandert ein Punkt erst, wenn nichts mehr offen ist – dann nach der Regel „Plan nach Abschluss
   bereinigen“: Volltext wörtlich nach `docs/Plan-Archiv.md`, Zeile im Verzeichnis, Rest als Zeile in „Auf einen Blick“.

## Nicht Teil dieses Skills

- Kommentare in Issues: vorher den ganzen Verlauf lesen, Entwurf dem Nutzer zeigen, erst nach seinem OK posten.
- Ein lokales Test-ZIP (`npm run build` + `node scripts/package.js`) – nur auf Wunsch; `npm run release` ist gesperrt.
