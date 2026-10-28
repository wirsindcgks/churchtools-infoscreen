# Onboarding – der Einstieg je Rolle

Wer mit dem Infoscreen Designer arbeitet, hat eine von drei Rollen. Hier steht für jede, was zu tun ist – in der
Reihenfolge, in der es passiert. Die Einzelheiten stehen in der [Einrichtungsanleitung](Einrichtung.md), welche
Rechte wer braucht in der [Rechte-Übersicht](Rechte.md). Was der Designer kann, zeigt die Übersicht
[Der Designer in Bildern](Funktionen.md).

| Rolle | Wer | Aufgabe |
| --- | --- | --- |
| [Administrator](#administrator--einmal-einrichten) | ChurchTools-Admin | installiert, vergibt Rechte, legt Bildschirme an |
| [Gestalter](#gestalter--inhalte-gestalten) | Mitglied von „Infoscreen-Designer" | gestaltet, was die Bildschirme zeigen |
| [Gerät](#gerät--der-fernseher) | Konto eines Fernsehers | zeigt einen Bildschirm an – ohne dass jemand etwas tut |

## Administrator – einmal einrichten

Etwa eine halbe Stunde, den Fernseher nicht mitgezählt.

- [ ] **Extension installieren:** das ZIP von der
      [Release-Seite](https://github.com/wirsindcgks/churchtools-infoscreen/releases) in der Extension-Verwaltung von
      ChurchTools hochladen ([Schritt 1](Einrichtung.md#1-extension-installieren)).
- [ ] **Dir selbst die Modulrechte geben** – auch Admins sehen das Modul sonst nicht
      ([Schritt 2](Einrichtung.md#2-dir-selbst-die-modulrechte-geben)).
- [ ] **Designer einmal öffnen** – er legt dabei seine Ablage an.
- [ ] **Einstellungen → Gruppen und Rechte → „Gruppen und Rechte anlegen"** – der Assistent legt „Infoscreen-Designer" und
      „Infoscreen-Devices" samt Rechten an ([Schritt 4](Einrichtung.md#4-gruppen-und-rechte-anlegen-lassen)).
- [ ] **Bildschirme anlegen:** Startseite → **„+ Bildschirm erstellen"**, je Fernseher einer. Umbenennen später über „…" →
      „Umbenennen", den Overscan über „…" → „Einstellungen".
- [ ] **Gestalter aufnehmen:** in die Gruppe „Infoscreen-Designer", egal in welcher Rolle.
- [ ] **Je Fernseher ein Geräte-Konto** mit Benutzername und Passwort, Personenstatus mit wenig Rechten, Mitglied
      von „Infoscreen-Devices" ([Schritt 6](Einrichtung.md#6-geräte-benutzer-anlegen)).
- [ ] **Adresse für den Fernseher erzeugen:** Einstellungen → Adressen der Bildschirme
      ([Schritt 7](Einrichtung.md#7-den-fernseher-einrichten)).

**Danach gelegentlich:**

- **Nach jedem Update** und wenn ein Bildschirm neue Räume zeigt: Einstellungen → Gruppen und Rechte →
  **„Rechte aktualisieren"** (eine Vorschau zeigt vorher, was sich ändert; was kein Bildschirm mehr braucht, fällt weg).
- **Gerät verloren?** Passwort des Geräte-Kontos ändern, neue Adresse erzeugen
  ([Notbremse](Einrichtung.md#wenn-ein-gerät-verloren-geht--die-notbremse)).
- **Jemand hört auf zu gestalten?** Aus der Gruppe „Infoscreen-Designer" nehmen – die Rechte gehen mit.

## Gestalter – Inhalte gestalten

Du brauchst nur die Mitgliedschaft in „Infoscreen-Designer". Was der Designer alles kann, zeigt
[Der Designer in Bildern](Funktionen.md); hier steht der Weg zur ersten eigenen Folie.

```mermaid
flowchart LR
    S["Bildschirm<br>anklicken"] --> E["Folie<br>gestalten"]
    E --> V["Vorschau"]
    V --> P["Veröffentlichen"]
    P --> F["Fernseher zeigt es<br>nach etwa 20 Sekunden"]
```

- [ ] **Designer öffnen:** in ChurchTools oben auf **„Infoscreen Designer"**. Die Startseite zeigt jeden Fernseher als
      Kachel mit dem, was er gerade zeigt.
- [ ] **Kachel anklicken** – die laufende Präsentation öffnet sich im Editor.
- [ ] **Gestalten:** links die Folien, oben **„+ Baustein"**, in der Mitte die Folie. Ein Doppelklick auf einen Text
      schreibt direkt darauf. Das türkise **„?"** erklärt jede Einstellung.
- [ ] **Speichern musst du nicht** – der Editor sichert alles als **Entwurf**. Die Fernseher sehen davon noch nichts.
- [ ] **„Vorschau"** spielt die Präsentation im Vollbild ab, genau wie am Fernseher.
- [ ] **„Veröffentlichen"** – erst jetzt übernehmen die Fernseher die Änderung.

![Editor: links die Folien, oben „+ Baustein", in der Mitte die Bildfläche, rechts die Einstellungen](bilder/editor.png)

**Danach lohnt sich ein Blick auf:**

- [Vorlagen](Funktionen.md#vorlagen) – ein Seitenkopf, der auf allen Folien gleich ist.
- [Zeitpläne](Funktionen.md#zeitpläne) – wann ein Bildschirm welche Präsentation zeigt.
- [Hinweise](Funktionen.md#hinweise) – ein Band wie „Heute Parkplatz gesperrt" über allen Folien.
- [Die Bausteine](Funktionen.md#die-bausteine) – Termine, Gruppen, Raumbelegung und mehr aus ChurchTools.

### Gut zu wissen

- **Rückgängig** mit ⌘Z / Strg+Z. **„Entwurf verwerfen"** im Menü „⋯" holt den veröffentlichten Stand zurück.
- **Der Entwurf gehört der Präsentation:** Wer sie als Nächstes öffnet, auch am Handy, macht daran weiter.
- **Zur Wahl stehen nur öffentliche Kalender** (und vom Administrator freigegebene). Fehlt einer, sagt das „?" am
  Bereich „Kalender", wie er freigegeben wird.
- **Alles auf einem Bildschirm sieht jeder im Foyer.** Personenbezogenes gehört nicht darauf, und Bilder sind über
  ihre Adresse ohne Anmeldung abrufbar.
- **Sagt die Startseite „Dir fehlen Rechte"**, gib die Meldung an einen Administrator weiter.
- **Was neu ist**, steht unter **„Über & Neuigkeiten"** unten in der Seitenleiste.

## Gerät – der Fernseher

Das Gerät tut nichts selbst; es braucht nur einmal die richtige Adresse.

- [ ] Ein Administrator hat ein **Geräte-Konto** angelegt und unter **Einstellungen → Adressen der Bildschirme die Adresse** erzeugt.
- [ ] Die Adresse ist die **Startseite des Kiosk-Browsers**, im Vollbild. Tastatur und Maus braucht es nicht.
- [ ] **Bildschirmschoner und Energiesparen aus.**

Danach läuft der Fernseher von selbst ([Einrichtung, Schritt 7](Einrichtung.md#7-den-fernseher-einrichten)). Zeigt er
„nicht angemeldet", eine neue Adresse erzeugen – meist wurde das Passwort des Geräte-Kontos geändert.
