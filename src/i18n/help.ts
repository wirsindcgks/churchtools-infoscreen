/**
 * The texts of the help bar (Plan.md 98, D), ordered by the section of the inspector they explain. The first sentence of
 * each item is also the tip on its label (Plan.md 98, C), so it has to stand alone; the rest is for the bar only.
 * Texts that several blocks share and that were written before D stay under their keys in `designer.ts`.
 */
import type { HelpItem, HelpTopic } from '../designer/help/types';
import { t } from './designer';

const i = t.inspector;

export const th = {
    /** Loose fields at the top of a block, shown under "Allgemein". */
    general: {
        text: {
            term: i.text,
            text:
                'Was der Baustein zeigt. Eine neue Zeile im Feld ist auch auf dem Bildschirm eine neue Zeile. Schneller geht es direkt auf der Folie: ' +
                'Doppelklick auf den Text. Was nicht in den Rahmen passt, wird abgeschnitten – dann den Rahmen größer ziehen oder die Schrift kleiner stellen.',
        },
        image: {
            term: t.blocks.image,
            text:
                'Das Bild kommt aus der Mediathek; dort lädt man auch neue hoch. Der Fernseher bekommt es höchstens in 1920 × 1080 Bildpunkten – ' +
                'größere Dateien schaden nicht, werden aber nicht schärfer.',
        },
    } satisfies Record<string, HelpItem>,

    /** "Schrift" – items by field; `FontSection` takes the ones it shows. */
    font: {
        intro:
            'Wie der Text dieses Bausteins aussieht. Größen zählen in Bildpunkten der Folie, quer misst sie 1920 × 1080; auf dem Fernseher wird die ' +
            'ganze Folie passend vergrößert oder verkleinert, das Verhältnis bleibt.',
        level: {
            term: i.textLevel,
            text:
                'Setzt Größe und Stärke auf einmal: Überschrift, Untertitel oder Text. Die drei Stufen passen zueinander und zur Größe der Folie. ' +
                'Ändert man Größe oder Stärke von Hand, ist keine Stufe mehr gewählt.',
        },
        family: {
            term: i.fontFamily,
            text:
                'Die Schrift des Textes. Oben steht die Schrift des Designs, darunter die eigenen Schriften der Gemeinde und alle übrigen. ' +
                'Eigene Schriften lädt man auf der Seite „Design“ hoch.',
        },
        size: {
            term: i.fontSize,
            text: 'Die Schriftgröße in Bildpunkten der Folie. Die Stufe „Text“ hat 44 px; kleiner wird es aus einigen Metern Abstand schnell mühsam.',
        },
        weight: {
            term: i.fontWeight,
            text: 'Wie kräftig die Buchstaben sind: Normal, Halbfett oder Fett. Fehlt einer Schrift eine Stärke, nimmt der Browser die nächstliegende.',
        },
        uppercase: {
            term: i.uppercase,
            text: 'Zeigt den Text in Großbuchstaben, ohne ihn zu ändern. Ausgeschaltet steht er wieder so da, wie er eingegeben ist.',
        },
        color: {
            term: t.common.fill.solid,
            text: 'Die Farbe der Schrift. Je stärker sie sich vom Hintergrund abhebt, desto besser liest man sie von weitem.',
        },
        align: {
            term: i.align,
            text: 'Richtet die Zeilen links, mittig oder rechts im Rahmen des Bausteins aus.',
        },
        lineHeight: {
            term: i.lineHeight,
            text: 'Der Abstand zwischen den Zeilen. Eng passt zu großen Überschriften über mehrere Zeilen, Weit zu längerem Text.',
        },
        letterSpacing: {
            term: i.letterSpacing,
            text: 'Der Abstand zwischen den Buchstaben. Weit liest sich gut in Großbuchstaben, Eng bei sehr großer Schrift.',
        },
        shadow: {
            term: i.shadow,
            text: 'Ein Schatten hinter den Buchstaben, weich oder kräftig. Hilft, wenn der Text über einem Bild oder Video steht.',
        },
        highlight: {
            term: i.highlight,
            text: 'Ein farbiges Band hinter jeder Zeile, wie mit einem Textmarker. Macht Text über unruhigen Bildern lesbar; Farbe und Deckkraft stehen darunter.',
        },
        highlightColor: {
            term: i.highlightColor,
            text: 'Die Farbe des Bandes hinter den Zeilen. Vorgegeben ist die Akzentfarbe des Designs.',
        },
        highlightOpacity: {
            term: i.highlightOpacity,
            text: 'Wie stark das Band deckt, von 0 % bis 100 %. Bei den vorgegebenen 80 % scheint das Bild darunter noch leicht durch.',
        },
        vertical: {
            term: i.vertical,
            text: 'Wo der Text im Rahmen steht: oben, mittig oder unten. Das wirkt nur, wenn der Rahmen höher ist als der Text.',
        },
    },

    /** "Drehung und Deckkraft" – every block. */
    frameLook: {
        intro: 'Dreht den ganzen Baustein oder lässt ihn durchscheinen, gleich, was er zeigt.',
        items: [
            {
                term: i.rotation,
                text:
                    'Dreht den Baustein um seine Mitte, von −180° bis 180°. Auf der Folie geht es auch mit dem Drehgriff am Rahmen; ' +
                    'er rastet bei 0°, 45°, 90° und so weiter ein, mit gedrückter Umschalttaste nicht.',
            },
            { term: i.opacity, text: 'Wie sichtbar der Baustein ist, von 0 % (unsichtbar) bis 100 %. Dazwischen scheint durch, was dahinter liegt.' },
        ],
    } satisfies HelpTopic,

    /** "Anordnen" – every block; "Im Bereich fest" only where the slide has a layout. */
    arrange: {
        intro:
            'Ein einzelner Baustein richtet sich an der Folie aus, mehrere gewählte aneinander; eine Gruppe zählt dabei wie ein Baustein. ' +
            'Verteilen setzt gleiche Abstände und braucht mindestens drei Bausteine oder Gruppen.\n\n' +
            'Die Ebene bestimmt, was vorne liegt: Ebene 1 liegt ganz hinten, die höchste ganz vorne. Die vier Knöpfe holen den Baustein ganz nach vorne, ' +
            'eine Ebene nach vorne, eine nach hinten oder ganz nach hinten.',
        regionFixed: { term: i.regionFixed, text: i.regionFixedInfo },
    },

    /** "Genaue Maße" – every block. */
    measures: {
        intro:
            'Lage und Größe des Bausteins in Bildpunkten der Folie; quer misst sie 1920 × 1080, hochkant 1080 × 1920. X zählt vom linken Rand, ' +
            'Y vom oberen Rand bis zur linken oberen Ecke des Bausteins. Ist der Baustein im Bereich fest, gibt die Aufteilung die Maße vor.',
    } satisfies HelpTopic,

    /** "Darstellung" of the image block. */
    image: {
        intro: 'Wie das Bild im Rahmen sitzt und wirkt.',
        items: [
            {
                term: i.fit,
                text:
                    'Ob das Bild ganz zu sehen ist oder den Rahmen füllt. „Ganz zeigen“ lässt freie Ränder, wenn die Seitenverhältnisse nicht passen; ' +
                    '„Füllen“ deckt den Rahmen und schneidet ab, was übersteht.',
            },
            { term: i.tone, text: 'Färbt das Bild: abdunkeln, aufhellen oder in Graustufen. Abgedunkelt oder aufgehellt trägt es Text darüber besser.' },
            {
                term: i.cropChoose,
                text:
                    'Bei „Füllen“ der Teil des Bildes, der sichtbar bleibt. Auf der Folie verschiebt man das Bild im Rahmen und vergrößert es mit „Zoom“; ' +
                    '„Fertig“ übernimmt, „Zurücksetzen“ nimmt wieder die Mitte.',
            },
            { term: i.cornerRadius, text: 'Rundet die Ecken des Bildes ab, in Bildpunkten. 0 heißt eckig.' },
            { term: i.shadow, text: 'Ein Schatten unter dem Bild, weich oder kräftig. Er hebt das Bild vom Hintergrund ab.' },
        ],
    } satisfies HelpTopic,

    /** "Darstellung" of the appointment list; "Raum zeigen" depends on the form, see `appointment-help.ts`. */
    appointmentList: {
        intro: 'Wie die Termine aussehen, wie weit die Liste vorausschaut und wie viele sie zeigt.',
        view: {
            term: i.view,
            text:
                'Die Form der Liste: Zeilen, Karten oder die Besucherübersicht. „Wie im Design“ folgt der Wahl auf der Seite „Design“ und ändert sich mit ihr.',
        },
        showCalendar: { term: i.showCalendar, text: 'Zeigt auf jeder Karte, aus welchem Kalender der Termin stammt.' },
        period: { term: i.period, text: 'Wie viele Tage ab heute die Liste vorausschaut, von 1 bis 366.' },
        count: {
            term: i.count,
            text: 'Wie viele Termine die Liste höchstens zeigt, die nächsten zuerst. Für alle Termine des Zeitraums „Alle Termine, seitenweise“ einschalten.',
        },
        showAll: {
            term: i.showAll,
            text:
                'Zeigt jeden Termin des Zeitraums und blättert, wenn nicht alle auf eine Seite passen. Darunter steht, wie viele Seiten es werden; ' +
                'reicht die Dauer der Folie dafür nicht, läuft sie länger.',
        },
        secondsPerPage: { term: i.secondsPerPage, text: 'Wie lange jede Seite stehen bleibt, bevor die Liste weiterblättert. Vorgegeben sind 10 Sekunden.' },
    },

    /** "Räume zeigen für" of the appointment blocks. */
    roomsFor: {
        intro: 'Für welche Kalender und welche Räume der gebuchte Raum genannt wird. Ein abgeschalteter Raum wird nur nicht genannt; der Termin bleibt in der Liste.',
    } satisfies HelpTopic,
};
