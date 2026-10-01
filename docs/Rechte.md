# Rechte im Infoscreen Designer – wer braucht was?

Die Übersicht für ChurchTools-Administratoren: welche Rolle welche Rechte braucht, woher sie kommen und was fehlt,
wenn etwas nicht geht. Wie man einrichtet, steht in der [Einrichtungsanleitung](Einrichtung.md); den Einstieg je
Rolle zeigt das [Onboarding](Onboarding.md).

> **Diese Tabellen werden mitgepflegt.** Die Rechte der beiden Gruppen vergibt der Einrichtungsassistent
> (`src/setup/provision.ts`); ein Test prüft bei jedem Build, dass jedes Recht, das er vergibt oder zurücknimmt, hier
> steht. Ändert sich der Assistent, schlägt der Test fehl, bis diese Seite nachgezogen ist.

## Die drei Rollen auf einen Blick

| Rolle | Wer | Darf | Darf nicht |
| --- | --- | --- | --- |
| **Administrator** | ChurchTools-Admins mit „Personen administrieren" | Extension installieren, **Einstellungen** öffnen (Assistent, Rechte prüfen, Adressen für Fernseher), **Screens anlegen, einstellen, löschen** | – |
| **Gestalter** | Mitglieder der Gruppe **„Infoscreen-Designer"** | gestalten, was die Screens zeigen: Slides, Playlists, Zeitpläne, Bilder in der Mediathek | Screens anlegen, einstellen, löschen; Einstellungen |
| **Gerät** | Konten der Fernseher, Mitglieder von **„Infoscreen-Devices"** | nur lesen: die Screens, die Kalender und die Räume, die sie zeigen | alles andere |

**Die Sperre sitzt bei ChurchTools, nicht im Designer.** ChurchTools prüft bei jedem Lesen und Speichern das Recht;
der Designer blendet nur aus, was ohnehin scheitern würde. Auch Administratoren brauchen die Rechte am Modul
ausdrücklich – ChurchTools-Adminrechte schließen sie nicht ein (sie können sie sich aber jederzeit selbst geben).

**Gruppen und Beiträge brauchen kein eigenes Recht.** Der Baustein „Gruppen" liest eine Gruppen-Homepage ohne
Anmeldung, so wie jeder Besucher sie sieht; der Baustein „Beiträge" zeigt Beiträge öffentlicher Gruppen, die auch
ohne Anmeldung sichtbar sind. Deshalb vergibt der Assistent dafür nichts – und der Fernseher zeigt nie mehr, als
ChurchTools ohnehin öffentlich zeigt.

## Rechte je Rolle

**Kategorien** sind die Ablagen des Moduls in ChurchTools: **Screens**, **Playlists**, **Slides**, **Medien** und
**Einstellungen**. Die Datenrechte werden je Kategorie vergeben.

### Modul „Infoscreen Designer"

In der Rechteverwaltung unter **„Infoscreen Designer"**.

| Im Assistenten | In der Rechteverwaltung (API) | Administrator | Gestalter | Gerät |
| --- | --- | --- | --- | --- |
| „Infoscreen Designer" sehen | `view` | ✓ | ✓ | ✓ |
| Kategorien sehen | `view custom category` | alle | alle | alle |
| – | `create custom category` | ✓ ¹ | – | – |
| Daten in Kategorie sehen | `view custom data` | alle | alle | alle |
| Daten in Kategorie erstellen | `create custom data` | alle | Playlists, Slides, Medien | – |
| Daten in Kategorie bearbeiten | `edit custom data` | alle | Playlists, Slides, Medien | – |
| Daten in Kategorie löschen | `delete custom data` | alle | Playlists, Slides, Medien | – |
| – | `edit custom category`, `delete custom category` | – | – | – |

¹ Nur für den allerersten Start: Beim ersten Öffnen legt der Designer seine Kategorien an.

**Ausdrücklich nicht für Gestalter und Geräte** – der Assistent nimmt diese Rechte zurück, wenn eine seiner Gruppen
sie noch hat („Rechte aktualisieren"):

| Im Assistenten | In der Rechteverwaltung (API) | Kategorien |
| --- | --- | --- |
| Anlegen von Screens und Einstellungen | `create custom data` | Screens, Einstellungen |
| Bearbeiten von Screens und Einstellungen | `edit custom data` | Screens, Einstellungen |
| Löschen von Screens und Einstellungen | `delete custom data` | Screens, Einstellungen |

### Wiki – für die Mediathek

Die Bilder der Mediathek liegen im Wiki-Bereich **„Infoscreen"**. In der Rechteverwaltung unter **„Wiki"**.

| Im Assistenten | In der Rechteverwaltung | Administrator | Gestalter | Gerät |
| --- | --- | --- | --- | --- |
| „Wiki" sehen | „Wiki" sehen (`view`, 501) | ✓ | ✓ | – ² |
| Wiki-Bereich „Infoscreen" sehen | Einzelne Wiki-Kategorien sehen (`view category`, 502) | ✓ | ✓ | – ² |
| Wiki-Bereich „Infoscreen" bearbeiten | Einzelne Wiki-Kategorien bearbeiten (`edit category`, 503) | ✓ | ✓ | – |

² Geräte brauchen kein Wiki-Recht: Bilder kommen über den Bilddienst von ChurchTools, der ohne Anmeldung liefert.

### Kalender – für Termine auf den Screens

In der Rechteverwaltung unter **„Kalender"**.

| Im Assistenten | In der Rechteverwaltung | Administrator | Gestalter | Gerät |
| --- | --- | --- | --- | --- |
| Einzelnen Kalender sehen | Einzelnen Kalender sehen (`view category`, 403) | für die Vorschau | für die Vorschau | **jeden Kalender, den ein Screen zeigt** ³ |

³ **Auch öffentliche Kalender.** Ein angemeldetes Konto ohne dieses Recht bekommt für die ganze Terminabfrage einen
Fehler. Zeigt ein Screen einen weiteren Kalender, einmal „Rechte aktualisieren".

### Ressourcen – für die Raumbelegung

In der Rechteverwaltung unter **„Ressourcen"**.

| Im Assistenten | In der Rechteverwaltung | Administrator | Gestalter | Gerät |
| --- | --- | --- | --- | --- |
| Ressource sehen | Ressource sehen (`view resource`, 205) | für die Vorschau | **alle Räume** | **jeden Raum, den ein Screen zeigt** – und **alle Räume**, sobald ein Termin-Baustein „Raum zeigen" an hat ⁴ |

⁴ **Nur Räume,** nicht Gegenstände und Fahrzeuge. Das Recht „„Ressourcen" sehen" (201) braucht niemand – das Recht
je Ressource genügt. Gestalter sehen nur Räume, für die sie das Recht haben; fehlt es, steht der Raum im Baustein
„Raumbelegung" nicht zur Auswahl. Zeigt ein Screen einen weiteren Raum, einmal „Rechte aktualisieren".
**Raum am Termin:** Welche Räume künftige Termine buchen, weiß der Assistent nicht vorher – deshalb bekommt das Gerät
„Ressource sehen" für alle Räume, sobald ein „Nächster Termin" oder eine Terminliste (als Karten) „Raum zeigen" an hat.
Am Termin steht nur der Raumname, nie ein Buchungstitel.
**Ein entzogenes Recht wirkt bei ChurchTools noch eine Weile nach – gemessen gut 40 Minuten.**

### Events – für Dienste am Termin

In der Rechteverwaltung unter **„Events"**.

| Im Assistenten | In der Rechteverwaltung | Administrator | Gestalter | Gerät |
| --- | --- | --- | --- | --- |
| Events von einzelnen Kalendern sehen | Events von einzelnen Kalendern sehen (`view events`, 306) | für die Vorschau | für die Vorschau | **jeden Kalender, dessen Termine Dienste zeigen** ⁵ |

⁵ **Kommt aus dem Events-Modul** (in der Rechteverwaltung unter „Events"). Das Gerät sieht damit nur die Dienste
offen einsehbarer Dienstgruppen („Ohne Berechtigung einsehbar"), keine anderen – und nur zugesagte Einteilungen. Das
Recht an den Dienstgruppen selbst bekommt das Gerät nicht.

### ChurchTools selbst – nur für Administratoren

| Recht | Wofür |
| --- | --- |
| „Personen administrieren" (`churchcore`) | Einstellungsseite des Designers: Assistent, Rechte prüfen, Adressen für Fernseher |
| Gruppen anlegen und löschen dürfen | Der Assistent legt die Gruppen „Infoscreen-Designer" und „Infoscreen-Devices" an und entfernt sie auf Wunsch |
| Zugang zur Extension-Verwaltung | Die Extension installieren und aktualisieren |

Die genauen Namen dieser beiden Rechte in ChurchTools sind hier nicht gemessen; ein ChurchTools-Administrator hat sie
in der Regel.

## Was brauche ich für …?

| Ich will … | Rolle | Fehlt es, dann … |
| --- | --- | --- |
| den Menüpunkt „Infoscreen Designer" sehen | alle | „Infoscreen Designer" sehen |
| Screens auf der Startseite sehen | alle | Kategorien sehen, Daten in Kategorie sehen |
| Slides gestalten und speichern | Gestalter | Daten in Kategorie erstellen / bearbeiten / löschen für Playlists und Slides |
| Bilder hochladen | Gestalter | „Wiki" sehen und Wiki-Bereich „Infoscreen" sehen / bearbeiten, dazu Medien schreiben |
| einen Screen anlegen, umbenennen, löschen | Administrator | Daten in Kategorie erstellen / bearbeiten / löschen für **Screens** |
| die Einstellungen öffnen | Administrator | „Personen administrieren" |
| dass der Fernseher Termine zeigt | Gerät | Einzelnen Kalender sehen für jeden Kalender des Screens |
| dass der Fernseher die Raumbelegung zeigt | Gerät | Ressource sehen für jeden Raum des Screens |
| dass der Fernseher den Raum am Termin zeigt | Gerät | Ressource sehen für alle Räume |
| Räume im Baustein „Raumbelegung" wählen | Gestalter | Ressource sehen für die Räume |

Die Startseite des Designers nennt fehlende Rechte selbst; die Einstellungsseite prüft die Rechte beider Gruppen und
warnt, wenn Gestalter mehr dürfen als vorgesehen.

## Woher die Rechte kommen

- **Über die Gruppen des Assistenten** – der empfohlene Weg. Alle Rollen einer Gruppe („Teilnehmer", „Leiter")
  bekommen dieselben Rechte; wer Mitglied wird, hat sie. Nach einem Update der Extension einmal **„Rechte
  aktualisieren"**.
- **Administratoren** geben sich die Modulrechte einmal selbst, am besten über die Rolle ihrer Admin-Gruppe
  ([Einrichtung, Schritt 2](Einrichtung.md#2-dir-selbst-die-modulrechte-geben)).
- **Rechte addieren sich.** Was der **Personenstatus** oder eine andere Gruppe erlaubt, kommt dazu. Deshalb bekommt
  ein Geräte-Konto einen Status mit möglichst wenig Rechten.
- **Gruppenrechte wirken nur, solange die Gruppe den Status „aktiv" hat.**
