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
        video: {
            term: t.blocks.video,
            text:
                'Das Video kommt aus der Mediathek; dort lädt man MP4-Dateien hoch. Es beginnt jedes Mal von vorn, wenn die Folie erscheint, ' +
                'und läuft in Schleife, solange sie steht. Im Designer zeigt die Folie nur ein Standbild.',
        },
        videoRuntime: {
            term: t.help.terms.runtime,
            text:
                'Die Folie dauert mindestens so lange wie das Video. Der Fernseher lädt es mit der Präsentation vorab und spielt es dann auch ohne Netz, ' +
                'solange sein Speicher reicht.',
        },
        sound: {
            term: i.sound,
            text:
                'Spielt den Ton des Videos mit. Viele Browser starten Ton erst nach einem Klick auf die Seite; bis dahin läuft das Video stumm, ' +
                'und auf dem Fernseher steht ein Knopf „Ton an“.',
        },
        slideshowAdd: {
            term: i.addImages,
            text:
                'Wählt Bilder aus der Mediathek, mehrere auf einmal; sie kommen in der Reihenfolge des Anklickens ans Ende der Galerie. ' +
                'Eine Galerie fasst höchstens 30 Bilder.',
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

    /** Corners and shadow of a picture, video or gallery that fills its frame (`PictureFrameFields`). */
    pictureFrame: {
        corners: { term: i.cornerRadius, text: 'Rundet die Ecken ab, in Bildpunkten. 0 heißt eckig; das Feld steht nur bei „Füllen“.' },
        shadow: { term: i.shadow, text: 'Ein Schatten unter dem Rahmen, weich oder kräftig. Er hebt den Baustein vom Hintergrund ab.' },
    } satisfies Record<string, HelpItem>,

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
        ],
    },

    /** "Darstellung" of the video block. */
    video: {
        intro: 'Wie das Video im Rahmen sitzt.',
        fit: {
            term: i.fit,
            text:
                'Ob das Video ganz zu sehen ist oder den Rahmen füllt. „Ganz zeigen“ lässt freie Ränder, wenn die Seitenverhältnisse nicht passen; ' +
                '„Füllen“ deckt den Rahmen und schneidet ab, was übersteht.',
        },
    },

    /** "Fortschritt" of the blocks that turn by themselves (Plan.md 105); `next` names what comes next. */
    pageProgress: (next: string): HelpItem => ({
        term: i.pageProgress,
        text: `Ein dünner Balken unten im Baustein zeigt, wann ${next} kommt. Aus ändert nichts am Takt.`,
    }),

    /** "Bilder" and "Darstellung" of the gallery. */
    slideshow: {
        images: {
            intro:
                'Die Bilder der Galerie in der Reihenfolge, in der sie erscheinen. Zum Umsortieren einen Eintrag ziehen; ✕ nimmt das Bild ' +
                'aus der Galerie, in der Mediathek bleibt es.',
        } satisfies HelpTopic,
        intro: 'Wie lange jedes Bild steht, wie es wechselt und wie es im Rahmen sitzt.',
        seconds: {
            term: i.secondsPerImage,
            text: 'Wie lange jedes Bild stehen bleibt, von 3 bis 60 Sekunden. Die Folie läuft so lange, bis jedes Bild einmal zu sehen war.',
        },
        transition: {
            term: i.transition,
            text: 'Wie ein Bild dem nächsten Platz macht: überblenden, schieben oder aufdecken. „Ohne“ wechselt sofort.',
        },
        motion: {
            term: i.motion,
            text: 'Ein langsamer Zoom, solange ein Bild steht. „Abwechselnd“ zoomt beim einen Bild hinein, beim nächsten heraus.',
        },
        fit: {
            term: i.fit,
            text:
                'Ob jedes Bild ganz zu sehen ist oder den Rahmen füllt. Vorgegeben ist „Füllen“: Es deckt den Rahmen und schneidet ab, was übersteht; ' +
                '„Ganz zeigen“ lässt freie Ränder.',
        },
    },

    /** "Darstellung" of the clock. */
    clock: {
        view: {
            term: i.view,
            text:
                'Was die Uhr zeigt: Uhrzeit, Datum oder beides. Sie geht nach der Uhr des Fernsehers; solange er deren Zeit nach einem Neustart ' +
                'noch nicht bestätigen konnte, bleibt der Baustein leer statt eine falsche Zeit zu zeigen.',
        },
    },

    /** "Darstellung" of the countdown. */
    countdown: {
        intro:
            'Ab einem Tag zeigt der Countdown Tage und Stunden, darunter die Zeit bis auf die Sekunde. Steht kein Termin an, ' +
            'steht dort „Kein Termin in Sicht“.',
        showTitle: { term: i.showTitle, text: 'Nennt den Titel des Termins, bis zu dem gezählt wird.' },
        running: {
            term: i.duringAppointment,
            text:
                'Ein Text, der statt der Zeit erscheint, solange ein Termin läuft – etwa „Der Gottesdienst hat begonnen“. ' +
                'Bleibt das Feld leer, zählt der Baustein gleich zum nächsten Termin.',
        },
    },

    /** "Darstellung" of the shape. */
    shape: {
        intro: 'Eine Fläche als Hintergrund für Text, als farbiger Balken oder als Kreis.',
        form: { term: i.shapeForm, text: 'Rechteck oder Ellipse. Eine Ellipse in einem quadratischen Rahmen ist ein Kreis.' },
        kind: {
            term: t.common.fill.kind,
            text: 'Eine Farbe oder ein Verlauf zwischen zwei Farben. Der Winkel gibt die Richtung des Verlaufs: 0° läuft von unten nach oben, 90° von links nach rechts.',
        },
        corners: { term: i.cornerRadius, text: 'Rundet die Ecken des Rechtecks ab, in Bildpunkten. 0 heißt eckig.' },
        border: { term: i.shapeBorder, text: 'Eine Linie um die Form, so breit wie angegeben. 0 nimmt den Rand weg.' },
        borderColor: { term: i.shapeBorderColor, text: 'Die Farbe des Rands. Anfangs ist es die Textfarbe des Designs.' },
    },

    /** "Darstellung" of the line. */
    line: {
        intro: 'Eine waagrechte Linie, etwa als Trenner zwischen Überschrift und Text; schräg oder senkrecht wird sie mit der Drehung.',
        items: [
            { term: t.common.fill.solid, text: 'Die Farbe der Linie.' },
            { term: i.lineThickness, text: 'Wie dick die Linie ist, in Bildpunkten der Folie. Wird sie dicker als ihr Rahmen, wächst der Rahmen mit.' },
            { term: i.lineDash, text: 'Durchgezogen oder gestrichelt.' },
        ],
    } satisfies HelpTopic,

    /** "Darstellung" of the next appointment; "Raum zeigen" comes from `appointment-help.ts`. */
    nextAppointment: {
        intro: 'Wie der nächste Termin der gewählten Kalender aussieht.',
        view: {
            term: i.view,
            text:
                '„Schlicht“ zeigt den Termin als Text, „Hervorgehoben“ als Karte. „Wie im Design“ folgt der Wahl auf der Seite „Design“ und ändert sich mit ihr.',
        },
        showCalendar: { term: i.showCalendar, text: 'Zeigt auf der Karte, aus welchem Kalender der Termin stammt.' },
        showImage: {
            term: i.showAppointmentImage,
            text: 'Zeigt das Bild, das der Termin in ChurchTools hat, neben dem Text. Hat der Termin keins, bekommt der Text den ganzen Platz.',
        },
    },

    /** The sections of the posts block. */
    posts: {
        groups: {
            intro:
                'Die Gruppen, deren Beiträge der Baustein zeigt, die neuesten zuerst; abgelaufene Beiträge nie. Der Fernseher zeigt nur Beiträge ' +
                'öffentlicher Gruppen – die übrigen sind hier als „nicht öffentlich“ markiert, die Vorschau zeigt sie mit deinen Rechten trotzdem.',
        } satisfies HelpTopic,
        intro: 'Wie die Beiträge erscheinen und welche in Frage kommen.',
        view: {
            term: i.view,
            text: 'Einer nach dem anderen oder mehrere untereinander. „Hervorgehoben“ zeigt je einen Beitrag groß, mit Bild; „Liste“ so viele, wie in den Rahmen passen.',
        },
        count: { term: i.count, text: 'Wie viele Beiträge der Baustein höchstens zeigt, von 1 bis 10, die neuesten zuerst.' },
        period: { term: i.period, text: 'Zeigt nur Beiträge, die höchstens so viele Tage alt sind, von 1 bis 365.' },
        seconds: {
            term: i.secondsPerPost,
            text: 'Wie lange jeder Beitrag stehen bleibt, vorgegeben sind 15 Sekunden. Die Folie läuft so lange, bis jeder Beitrag einmal zu sehen war.',
        },
        fit: {
            term: i.fit,
            text: 'Ob das Bild des Beitrags ganz zu sehen ist oder seinen Platz füllt. „Füllen“ schneidet ab, was übersteht; welcher Teil bleibt, sagt „Ausschnitt“.',
        },
        focus: { term: i.focus, text: 'Der Teil des Bildes, der beim Zuschneiden sichtbar bleibt. Er gilt für alle Beiträge dieses Bausteins.' },
        details: {
            intro: 'Was ein Beitrag zeigt. Was ausgeschaltet ist, nimmt keinen Platz. Bild und Name gibt es nur in der Ansicht „Hervorgehoben“.',
            items: [{ term: i.postShow.showAuthor, text: 'Der Name der Person, die den Beitrag geschrieben hat.' }],
        } satisfies HelpTopic,
    },

    /** The sections of the groups block. */
    groups: {
        homepage: {
            intro: 'Die Gruppen einer Gruppen-Homepage aus ChurchTools – alle oder eine Auswahl in eigener Reihenfolge.',
            items: [
                {
                    term: i.groupsHomepage,
                    text:
                        'Zeigt nur Gruppen, die ChurchTools auf dieser Homepage öffentlich zeigt. Eine Gruppen-Homepage legt man in ChurchTools ' +
                        'an der Obergruppe an: Einstellungen → Allgemein → Außendarstellung.',
                },
                {
                    term: i.allGroups,
                    text:
                        'Zeigt jede Gruppe der Homepage, auch neue, sobald sie dort erscheinen. Ausgeschaltet wählt man Gruppen einzeln ' +
                        'und legt ihre Reihenfolge durch Ziehen fest.',
                },
            ],
        } satisfies HelpTopic,
        intro: 'Ob die Gruppen als Karten mit QR-Code erscheinen oder als Liste, und wie lange jede Seite steht.',
        view: {
            term: i.view,
            text:
                '„Hervorgehoben“ zeigt Karten mit QR-Code zur Gruppenseite, „Liste“ so viele Zeilen, wie in den Rahmen passen. ' +
                'Beide blättern, wenn nicht alle Gruppen Platz haben.',
        },
        order: {
            term: i.order,
            text: 'Nach Wochentag, beginnend mit Montag, oder nach Namen. Eine eigene Auswahl behält die Reihenfolge, die man ihr gibt.',
        },
        perPage: (wide: boolean): HelpItem => ({
            term: i.groupsPerPage,
            text:
                `Wie viele Karten auf einer Seite stehen, 1 bis 4. In diesem Baustein stehen sie ${wide ? 'nebeneinander' : 'untereinander'}; ` +
                'jede Karte richtet sich nach ihrer eigenen Form – zwei in einem breiten Baustein stehen hochkant.',
        }),
        seconds: (term: string): HelpItem => ({
            term,
            text:
                'Wie lange jede Seite stehen bleibt, vorgegeben sind 15 Sekunden – Zeit genug, den QR-Code zu fotografieren. ' +
                'Die Folie läuft so lange, bis jede Seite einmal zu sehen war.',
        }),
        details: {
            intro:
                'Was eine Gruppe zeigt. Beschreibung, QR-Code und Bild der Leitung gibt es nur in der Ansicht „Hervorgehoben“. Namen der Leitung erscheinen nur, ' +
                'wenn die Gruppen-Homepage in ChurchTools die Leiter zeigt – dann sind sie ohnehin öffentlich.',
        } satisfies HelpTopic,
    },

    /** The sections of the room occupancy. */
    rooms: {
        add: {
            term: i.addAllRooms,
            text: 'Nimmt alle Räume auf, die du sehen darfst, höchstens 30. Einzelne kommen über „+ Raum“ dazu.',
        },
        list: {
            intro:
                'Die Räume in der Reihenfolge, in der sie erscheinen; zum Umsortieren einen Eintrag ziehen. ' +
                'Gezeigt werden nur bestätigte Buchungen, keine, die noch warten.',
            items: [
                { term: i.signpost, text: 'Ein kurzer Hinweis, wie man den Raum findet, etwa „1. OG, links“. Er steht beim Namen des Raums.' },
                {
                    term: i.showTitles,
                    text:
                        'Zeigt, wofür der Raum gebucht ist. Buchungstitel können Namen enthalten, etwa „Gespräch Familie X“ – ' +
                        'für solche Räume den Titel ausschalten, dann steht dort „Belegt“.',
                },
            ],
        } satisfies HelpTopic,
        intro: 'Ob der Baustein mehrere Räume im Überblick zeigt oder das Türschild eines Raums.',
        view: {
            term: i.view,
            text:
                '„Übersicht“ zeigt die Belegung aller gewählten Räume und blättert, wenn sie nicht auf eine Seite passt. ' +
                '„Türschild“ zeigt den ersten Raum der Liste: was gerade läuft, bis wann er frei ist und was danach kommt.',
        },
        period: { term: i.period, text: 'Wie viele Tage ab heute der Baustein vorausschaut, von 1 bis 14.' },
        seconds: {
            term: i.secondsPerPage,
            text: 'Wie lange jede Seite der Übersicht stehen bleibt, vorgegeben sind 10 Sekunden. Die Folie läuft so lange, bis jede Seite einmal zu sehen war.',
        },
    },

    /** The sections of the social media block. */
    social: {
        add: {
            term: i.socialAdd,
            text:
                'Der Link zu einem Profil, etwa instagram.com/gemeinde; mit Enter kommt er in die Liste. Zeichen und Name erkennt der Designer ' +
                'aus dem Link, ohne Abfrage im Internet. Ein Baustein fasst höchstens 12 Profile.',
        },
        list: {
            intro: 'Die Profile in der Reihenfolge, in der sie erscheinen; zum Umsortieren einen Eintrag ziehen.',
            items: [
                { term: i.socialLink, text: 'Der Link zum Profil. Ändert man ihn, erkennt der Designer Zeichen und Name neu.' },
                { term: i.socialLabel, text: 'Ersetzt den aus dem Link erkannten Namen, etwa durch „@gemeinde“. Bleibt das Feld leer, gilt der erkannte Name.' },
            ],
        } satisfies HelpTopic,
        look: {
            intro: 'Wie die Profile angeordnet sind und wie ihre Zeichen aussehen.',
            items: [
                { term: i.socialLayout, text: 'Die Profile untereinander oder nebeneinander. Nebeneinander passt gut in eine Fußzeile.' },
                { term: i.socialBrand, text: 'Zeigt jedes Zeichen weiß auf der Farbe seiner Plattform. Ausgeschaltet steht das Zeichen allein in der Schriftfarbe.' },
            ],
        } satisfies HelpTopic,
    },

    /** The web page block. */
    web: {
        address: {
            term: i.webAddress,
            text:
                'Die Adresse der Seite, die im Rahmen erscheint, oder ihr Einbettungscode. Sie gilt nach Enter oder beim Verlassen des Feldes; ' +
                'erst dann lädt die Seite. Aus einem Einbettungscode („iframe“), wie ihn Karten, Umfragen oder Pinnwände anbieten, wird nur die ' +
                'Adresse übernommen. Viele Seiten verbieten, dass andere sie einbetten, auch manche Gemeinde-Website – dann bleibt der Rahmen leer ' +
                'oder zeigt einen Fehler; man sieht es gleich auf der Folie. Die Seite wird nur gezeigt, nicht bedient. Ohne Netz bleibt der Rahmen leer.',
        },
        look: {
            intro: 'Wie groß die Seite im Rahmen erscheint.',
            items: [
                {
                    term: i.webSize,
                    text: 'Vergrößert oder verkleinert die Seite im Rahmen. Bei 50 % passt mehr von ihr hinein, 200 % passt zu Seiten, die fürs Handy gemacht sind.',
                },
            ],
        } satisfies HelpTopic,
    },

    /** The QR code block. */
    qr: {
        content: {
            term: i.qrContent,
            text:
                'Was der Code enthält, meist eine Adresse mit https://. Je kürzer der Inhalt, desto gröber das Muster – ' +
                'und desto weiter weg kann man noch fotografieren.',
        },
        look: {
            intro: 'Dunkel auf hell lesen alle Handykameras am sichersten.',
            items: [
                { term: t.common.fill.solid, text: 'Die Farbe des Musters.' },
                { term: t.common.color.background, text: 'Die Farbe hinter dem Muster. Sie muss sich deutlich davon abheben.' },
            ],
        } satisfies HelpTopic,
    },

    /** "Darstellung" of the church header. */
    churchHeader: {
        intro: 'Name und Logo der Gemeinde, wie sie in ChurchTools in den Gemeindeinfos stehen.',
        items: [
            { term: i.showChurchName, text: 'Zeigt den Namen der Gemeinde aus ChurchTools.' },
            {
                term: i.showLogo,
                text:
                    'Zeigt das Logo aus den Gemeindeinfos von ChurchTools. Ist es auf dem Hintergrund nicht gut zu sehen, nimmt „Logo wählen“ ' +
                    'ein eigenes aus der Mediathek; „Logo zurücksetzen“ nimmt wieder das aus ChurchTools.',
            },
        ],
    } satisfies HelpTopic,

    /** The loose buttons of a template block. */
    template: {
        edit: {
            term: t.templates.edit.start,
            text: 'Öffnet die Vorlage zum Bearbeiten. Änderungen erscheinen auf allen Folien mit dieser Vorlage.',
        },
        unlink: {
            term: t.templates.unlink,
            text: 'Macht aus der Vorlage eigene Bausteine nur für diese Folie. Spätere Änderungen an der Vorlage erreichen sie dann nicht mehr.',
        },
    },

    /** "Hintergrund" of the slide. */
    background: {
        intro:
            'Was hinter allen Bausteinen der Folie liegt: eine Farbe, ein Verlauf oder ein Bild aus der Mediathek. Ein Bild füllt die ganze Folie; ' +
            'was übersteht, wird abgeschnitten.',
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
