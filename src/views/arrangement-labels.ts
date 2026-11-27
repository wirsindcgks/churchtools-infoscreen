import type { SongArrangementResponse } from '../ct/api';

/**
 * The short name of an arrangement (user, 2026-11-27): the pills stand under the song, so the word "Arrangement" tells nothing and goes,
 * with its hyphen – "Standard-Arrangement" becomes "Standard"; the "Neues Arrangement" ChurchTools gives new ones becomes "Neu".
 */
function shortName(name: string | null | undefined): string {
    const short = (name ?? '')
        .replace(/[\s-]*\barrangement\b[\s-]*/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    return /^neues$/i.test(short) ? 'Neu' : short;
}

/** A pill: the name, which may be cut with "…", and the key, which stays whole. */
export interface ArrangementLabel {
    name: string;
    key: string | null;
}

/**
 * The texts of the arrangement pills: the short name and the key ("key", else "keyOfArrangement"); where several read the same the second
 * and each further one gets a running number on its name ("Neu", "Neu 2").
 */
export function arrangementLabels(arrangements: SongArrangementResponse[], fallback: string): ArrangementLabel[] {
    const seen = new Map<string, number>();
    return arrangements.map((a) => {
        const name = shortName(a.name) || fallback;
        const key = a.key || a.keyOfArrangement || null;
        const id = `${name}\u0000${key ?? ''}`;
        const n = (seen.get(id) ?? 0) + 1;
        seen.set(id, n);
        return { name: n > 1 ? `${name} ${n}` : name, key };
    });
}

/** The label as one line, for tests and for reading aloud: "Standard · G". */
export const labelText = (label: ArrangementLabel): string => (label.key ? `${label.name} · ${label.key}` : label.name);
