/**
 * Everything the player shows on a TV, in one place (Plan.md 79, B1). German values, English keys; a text
 * with a number or a name is a function. No library: the player stays one bundle without parts to load.
 * The player imports this file and never `designer.ts`.
 */

/** The language of every date, time and sort order in the app. */
export const LOCALE = 'de-DE';

export const tp = {
    /** Shown instead of the stage when the address names no screen. */
    noScreen: 'Kein Bildschirm angegeben (Parameter „screen" fehlt).',
    noActiveSlide: 'Diese Präsentation enthält keine aktive Folie.',
    /** The tooltip of the dot that marks old content. */
    noConnection: 'Keine Verbindung zu ChurchTools',
    /** Shown when the browser of a TV is not signed in – its address lacks the device login or the password changed. */
    signedOut:
        'Dieser Fernseher ist nicht bei ChurchTools angemeldet. Seine Adresse erzeugt ein Administrator im Infoscreen ' +
        'Designer unter „Einstellungen" – mit ihr meldet er sich bei jedem Start selbst an.',
    screenNotFound: (slug: string) => `Es gibt keinen Bildschirm „${slug}".`,
    /** Only ids: it appears on a TV in the foyer. */
    wrongPerson: (signedInId: number, expectedId: number) =>
        `Angemeldet ist Person ${signedInId}, nicht der Geräte-Benutzer (Person ${expectedId}). ` +
        'Die Anmeldung mit dem Token aus der Adresse ist gescheitert – login_token und user_id prüfen.',
    noAnswer: (seconds: number) => `Keine Antwort nach ${seconds} Sekunden.`,

    time: {
        allDay: 'ganztägig',
        clock: (time: string | null) => `${time} Uhr`,
        range: (from: string, to: string) => `${from}–${to} Uhr`,
        until: (time: string) => `bis ${time}`,
        today: 'heute',
        yesterday: 'gestern',
        daysAgo: (days: number) => `vor ${days} Tagen`,
        tomorrow: 'Morgen',
        /** Month names of a date tile, in capitals. */
        months: ['JAN', 'FEB', 'MÄR', 'APR', 'MAI', 'JUN', 'JUL', 'AUG', 'SEP', 'OKT', 'NOV', 'DEZ'],
    },

    countdown: {
        /** "2 Tage 3 Std." */
        daysHours: (days: number, hours: number) => `${days} ${days === 1 ? 'Tag' : 'Tage'} ${hours} Std.`,
        startsIn: 'Beginnt in',
        titleStartsIn: (title: string) => `${title} beginnt in`,
        none: 'Kein Termin in Sicht',
    },

    appointments: {
        noneInDays: (days: number) => `Keine Termine in den nächsten ${days} Tagen.`,
        nextLabel: 'Nächster Termin',
        nonePlanned: 'Derzeit ist kein Termin geplant.',
        fallbackService: (id: number) => `Dienst ${id}`,
    },

    posts: {
        none: 'Keine aktuellen Beiträge',
    },

    groups: {
        noHomepage: 'Keine Gruppen-Homepage gewählt',
        none: 'Keine Gruppen',
        toGroup: 'Zur Gruppe',
        leaders: 'Leitung:',
        leadersLine: (names: string) => `Leitung: ${names}`,
        fullWithWaitlist: 'Ausgebucht – Warteliste offen',
        full: 'Ausgebucht',
        placesLeft: (n: number) => (n === 1 ? 'Noch 1 Platz frei' : `Noch ${n} Plätze frei`),
    },

    rooms: {
        choose: 'Räume wählen',
        now: 'Jetzt',
        free: 'Frei',
        next: 'Danach',
        busy: 'Belegt',
        gone: 'Raum nicht verfügbar',
        unreadable: 'Raumbelegung nicht verfügbar',
        emptyToday: 'Heute sind keine Räume belegt.',
        emptyTodayTomorrow: 'Heute und morgen sind keine Räume belegt.',
        fallbackName: (id: number) => `Raum ${id}`,
    },

    video: {
        choose: 'Video wählen',
        soundOn: 'Ton an',
    },
} as const;
