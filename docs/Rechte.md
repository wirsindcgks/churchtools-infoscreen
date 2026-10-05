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
| **Gerät** | Konten der Fernseher, Mitglieder von **„Infoscreen-Devices"** | nur lesen: die Screens, die Kalender und die Räume, die sie zeigen – und die Videos der Mediathek | alles andere |

**Die Sperre sitzt bei ChurchTools, nicht im Designer.** ChurchTools prüft bei jedem Lesen und Speichern das Recht;
der Designer blendet nur aus, was ohnehin scheitern würde. Auch Administratoren über Gruppen brauchen die Rechte am
Modul ausdrücklich – ChurchTools-Adminrechte schließen sie nicht ein (sie können sie sich aber jederzeit selbst geben);
ein Super-Admin braucht sie nicht.

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

**Ausdrücklich nicht für Gestalter und Geräte:** das Anlegen, Bearbeiten und Löschen von Screens und Einstellungen.
Der Assistent nimmt diese Rechte zurück, wenn eine seiner Gruppen sie noch hat – siehe
[„Was „Rechte aktualisieren" zurücknimmt"](#was-rechte-aktualisieren-zurücknimmt).

### Wiki – für die Mediathek

Bilder und Videos der Mediathek liegen im Wiki-Bereich **„Infoscreen"**. In der Rechteverwaltung unter **„Wiki"**.

| Im Assistenten | In der Rechteverwaltung | Administrator | Gestalter | Gerät |
| --- | --- | --- | --- | --- |
| „Wiki" sehen | „Wiki" sehen (`view`, 501) | ✓ | ✓ | – ² |
| Wiki-Bereich „Infoscreen" sehen | Einzelne Wiki-Kategorien sehen (`view category`, 502) | ✓ | ✓ | ✓ ² |
| Wiki-Bereich „Infoscreen" bearbeiten | Einzelne Wiki-Kategorien bearbeiten (`edit category`, 503) | ✓ | ✓ | – ² |

² Bilder kommen ohne Anmeldung über den Bilddienst von ChurchTools. Videos gibt es nur über die Download-Adresse der
Datei, und die verlangt dieses eine Recht – deshalb bekommt das Gerät „Wiki-Bereich „Infoscreen" sehen", immer, auch
bevor ein Screen ein Video zeigt. Damit sieht das Gerät die Dateien dieses Bereichs. „Wiki" sehen und das Bearbeiten
braucht ein Gerät nicht; die Einstellungsseite warnt, wenn es sie hat.

**Das Bearbeiten des Wiki-Bereichs „Infoscreen" eng vergeben.** Wer es hat, kann im Wiki Bilder löschen – an der
Warnung der Mediathek vorbei –, und auf den Fernsehern fehlen sie dann. Jedes Mitglied von „Infoscreen-Designer" hat
dieses Recht; deshalb auch die Mitgliedschaft dort bewusst vergeben.

### Kalender – für Termine auf den Screens

In der Rechteverwaltung unter **„Kalender"**.

| Im Assistenten | In der Rechteverwaltung | Administrator | Gestalter | Gerät |
| --- | --- | --- | --- | --- |
| Einzelnen Kalender sehen | Einzelnen Kalender sehen (`view category`, 403) | für die Vorschau | für die Vorschau | **jeden Kalender, den ein Screen zeigt** ³ |

³ **Nur öffentliche Kalender.** Ein Fernseher zeigt nur Termine aus Kalendern, die in ChurchTools öffentlich sind
(und nicht privat), und von diesen **nie interne Termine** („nur für angemeldete Benutzer"). Der Assistent vergibt das
Recht deshalb nur für öffentliche Kalender, und der Fernseher fragt nur diese ab – auch dann nicht andere, wenn sein
Konto sie über Status oder eine andere Gruppe lesen dürfte. Gestalter können nur öffentliche Kalender wählen.
Das Recht gilt **auch für öffentliche Kalender:** Ein angemeldetes Konto ohne dieses Recht bekommt für die ganze
Terminabfrage einen Fehler. Zeigt ein Screen einen weiteren Kalender, einmal „Rechte aktualisieren". Kalender, die du
selbst nicht siehst, kann der Assistent nicht beurteilen: Gib dir „Einzelnen Kalender sehen" für sie.

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

Wer das Modul installiert und einrichtet, braucht diese Rechte. „Gemessen" heißt: auf der Testinstanz ausprobiert;
„Katalog" heißt: der Name steht so in der Rechteverwaltung bzw. die API-Spezifikation der Instanz verlangt es, ausprobiert
ist es nicht.

**Einmalig – Installation und Einrichtung**

| Bereich in der Rechteverwaltung | Recht | Wofür | Beleg |
| --- | --- | --- | --- |
| Administration | „Erweiterungen verwalten" | Die Extension hochladen und aktualisieren | Katalog |
| Administration | „Berechtigungen verwalten" | Einstellungsseite des Designers öffnen; der Assistent vergibt damit die Rechte der beiden Gruppen; sich selbst die Modulrechte geben ([Einrichtung, Schritt 2](Einrichtung.md#2-dir-selbst-die-modulrechte-geben)) | gemessen |
| Gruppen | „Gruppen eines Gruppentyps erstellen" **und** „Gruppen eines Gruppentyps sehen", je für „Merkmal" | „Gruppen und Rechte anlegen" – ohne Sehen bräche der Assistent nach dem Anlegen ab | gemessen |
| Gruppen | „Gruppen eines Gruppentyps löschen" für „Merkmal" (oder „Gruppe löschen" je Gruppe) | „Automatische Einrichtung rückgängig machen" | gemessen |
| Gruppen | „Gruppenmitgliedschaften von Gruppen eines Gruppentyps bearbeiten" für „Merkmal" | Gestalter und Gerätekonten in die beiden Gruppen aufnehmen | Katalog |
| Gruppen | statt der vier Zeilen oben: „Gruppen verwalten" | alles davon auf einmal | gemessen (ersetzt die Gruppenrechte) |
| Wiki | „„Wiki" sehen" **und** „Stammdaten bearbeiten" | Der Assistent legt den Wiki-Bereich „Infoscreen" an | Katalog (API-Spezifikation) |
| Personen | „Personen erstellen" und „Personen bearbeiten" | Das Gerätekonto anlegen und ihm einen Status geben | Katalog |
| Administration | „Personen simulieren, Passwort ändern und Zugang sperren" | Dem Gerätekonto Benutzername und Passwort setzen | Katalog |

**Dauerhaft – Screens betreuen**

| Bereich in der Rechteverwaltung | Recht | Wofür | Beleg |
| --- | --- | --- | --- |
| Infoscreen Designer | alle Rechte, die Datenrechte für alle Kategorien (Tabelle oben, Spalte „Administrator") | Screens anlegen, einstellen, löschen | gemessen |
| Kalender | „Einzelnen Kalender sehen" für jeden Kalender, den die Fernseher zeigen sollen | „Rechte aktualisieren" vergibt nur Kalender, die du selbst siehst – **auch als Super-Admin nötig** | gemessen |
| Ressourcen | „Ressource sehen" für die Räume | Gestalter bekommen die Räume, die du siehst | gemessen |
| Administration | „Berechtigungen verwalten" (siehe oben) | Einstellungen: „Rechte aktualisieren", Adressen für Fernseher, Dienste freigeben | gemessen |
| Gruppen | „Gruppen eines Gruppentyps sehen" für „Merkmal" (siehe oben) | „Rechte aktualisieren" und die Prüfung der Gruppen | gemessen |

**„Berechtigungen verwalten" ist ein mächtiges Recht:** Wer es hat, kann sich jedes andere Recht selbst geben. Wo es nur
für die Einrichtung vergeben werden soll, kann ein Super-Admin die einmaligen Schritte selbst übernehmen oder das Recht
danach wieder entziehen – „Rechte aktualisieren" und die Adressen für neue Fernseher brauchen es dann wieder.

Fehlt ein Gruppenrecht, graut die Einstellungsseite den Knopf aus und nennt darunter, was fehlt (gemessen am 2026-10-05).

**Ein Super-Admin hat all das – nur Kalender nicht:** „Einzelnen Kalender sehen" bekommt er nur für Kalender, die ihm
Status oder Person geben. Die Modulrechte des Designers braucht er nicht ausdrücklich. Einen Administrator über
Gruppen (ohne Super-Admin) trifft das nicht: Er hat, was seine Gemeinde ihm gibt.

## Was „Rechte aktualisieren" zurücknimmt

„Rechte aktualisieren" vergibt nicht nur, was fehlt, sondern nimmt auch zurück, was kein Screen mehr braucht. Vorher zeigt
ein Fenster, was dazukommt und was wegfällt; erst „Übernehmen" schreibt. Zurückgenommen wird **nur an den Gruppen, die
der Assistent selbst angelegt hat**, und nur das, was er selbst verwaltet:

| Im Assistenten | In der Rechteverwaltung (API) | Gruppe | Wann es wegfällt |
| --- | --- | --- | --- |
| Einzelnen Kalender sehen | Einzelnen Kalender sehen (`view category`, 403) | Gerät | Kein Screen zeigt den Kalender mehr, oder er ist nicht öffentlich |
| Events von einzelnen Kalendern sehen | Events von einzelnen Kalendern sehen (`view events`, 306) | Gerät | Kein Baustein zeigt mehr Dienste dieses Kalenders, oder er ist nicht öffentlich |
| Ressource sehen | Ressource sehen (`view resource`, 205) | Gerät, Gestalter | Der Raum ist kein Raum mehr in dem, was die Gruppe haben soll |
| Anlegen von Screens und Einstellungen | `create custom data` | Gestalter, Gerät | immer – das ist Sache der Administratoren |
| Bearbeiten von Screens und Einstellungen | `edit custom data` | Gestalter, Gerät | immer |
| Löschen von Screens und Einstellungen | `delete custom data` | Gestalter, Gerät | immer |

**Nur was der Administrator sieht.** Ein Recht an einem Kalender oder Raum, den der Administrator selbst nicht sieht, bleibt
unangetastet – der Assistent weiß nicht, ob es dort gebraucht wird. Das gilt auch, wenn die Raumliste nicht lädt: Dann
nimmt er keinem Gestalter einen Raum. Alle anderen Rechte an diesen Gruppen bleiben, auch fremde Gruppen werden nicht angefasst.

**An den Gruppen des Assistenten nichts von Hand ergänzen.** Was dort an Kalendern, Events oder Räumen von Hand vergeben
wurde, nimmt „Rechte aktualisieren" bei der nächsten Gelegenheit zurück, sobald es kein Screen braucht. Wer mehr vergeben
will, nimmt eine eigene Gruppe.

**Ein entzogenes Recht wirkt bei ChurchTools noch bis zu einer Dreiviertelstunde nach.**

## Was brauche ich für …?

| Ich will … | Rolle | Fehlt es, dann … |
| --- | --- | --- |
| den Menüpunkt „Infoscreen Designer" sehen | alle | „Infoscreen Designer" sehen |
| Screens auf der Startseite sehen | alle | Kategorien sehen, Daten in Kategorie sehen |
| Slides gestalten und speichern | Gestalter | Daten in Kategorie erstellen / bearbeiten / löschen für Playlists und Slides |
| Bilder und Videos hochladen | Gestalter | „Wiki" sehen und Wiki-Bereich „Infoscreen" sehen / bearbeiten, dazu Medien schreiben |
| einen Screen anlegen, umbenennen, löschen | Administrator | Daten in Kategorie erstellen / bearbeiten / löschen für **Screens** |
| die Einstellungen öffnen | Administrator | „Personen administrieren" |
| dass der Fernseher Termine zeigt | Gerät | Einzelnen Kalender sehen für jeden **öffentlichen** Kalender des Screens |
| dass der Fernseher Videos abspielt | Gerät | Wiki-Bereich „Infoscreen" sehen |
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
- **Ein Geräte-Konto ist kein echtes Personenkonto,** sondern eine eigene Person je Standort, und gehört in **keine
  weitere Gruppe** als „Infoscreen-Devices". Rechte aus anderen Gruppen bekommt der Fernseher mit – und jeder, der
  seine Adresse kennt. Die Prüfung sieht diese Rechte nicht; sie nennt seit Version 0.7.3 nur die Gruppen.
- **Gruppenrechte wirken nur, solange die Gruppe den Status „aktiv" hat.**
