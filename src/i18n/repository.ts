/**
 * What the store says to the designer (Plan.md 79, B1): conflicts, missing documents, the names of what it
 * creates. Apart from `designer.ts` because the player imports the store and must not pull in the designer's
 * texts. German values, English keys; a text with a number or a name is a function.
 */
export const tr = {
    slugTaken: (slug: string) => `Die Adresse „${slug}" ist schon vergeben.`,
    /** Thrown for screens, presentations, schedules and the design alike – so it names none of them. */
    conflict: (revision: number, by: string | undefined) =>
        `Inzwischen wurde ein neuerer Stand gespeichert (Stand ${revision}` + (by ? `, von ${by}` : '') + ').',
    slideConflict: (name: string, playlist: string | null, by: string | undefined) =>
        `Die Folie „${name}" wurde inzwischen geändert` +
        (playlist ? ` (in „${playlist}")` : '') +
        (by ? `, von ${by}` : '') +
        '.',
    draftConflict: (revision: number, by: string | undefined) =>
        `Der Entwurf wurde inzwischen weitergeführt (Stand ${revision}` + (by ? `, von ${by}` : '') + ').',
    draftsUnavailable: 'Entwürfe sind nicht verfügbar: Die Kategorie „Entwürfe" fehlt, oder das Recht darauf.',
    playlistNotFound: 'Diese Präsentation gibt es nicht (mehr).',
    playlistInUse: (screens: string[]) =>
        `Die Präsentation läuft noch auf ${screens.map((s) => `„${s}"`).join(', ')}. Erst dort im Zeitplan eine andere wählen.`,
    playlistMissing: 'Präsentation fehlt.',
    slideMissing: 'Folie fehlt.',
    mediaMissing: 'Medium fehlt.',
    slideMissingInStore: (id: string) => `Folie ${id} fehlt im Speicherstand.`,
    playlistMissingInStore: (id: string) => `Präsentation ${id} fehlt im Speicherstand.`,
    otherFormat: (staged: string, current: string) => `„${staged}" ist für ein anderes Format gestaltet als „${current}".`,
    newSlide: 'Neue Folie',
    newPlaylist: 'Neue Präsentation',
    copyOf: (name: string) => `${name} (Kopie)`,
};
