/**
 * Finding an entry of a long list by parts of its name (Plan.md 93): like the quick search of ChurchTools, the parts of
 * the query, split at spaces, have to occur in the name in their order – "ju kr" finds "Jugendkreis". Lower case, and
 * umlauts as their two letters, so "ä" and "ae" meet (Plan.md 79, C7).
 */

/** From this many entries on, a list of switches in the inspector gets a search field. */
export const TOGGLE_LIST_SEARCH_FROM = 9;

/** From this many entries on, a `SelectMenu` gets one: it stands only in the unfolded list (Plan.md 98). */
export const SELECT_SEARCH_FROM = 5;

export function normalise(text: string): string {
    return text
        .toLowerCase()
        .replaceAll('ä', 'ae')
        .replaceAll('ö', 'oe')
        .replaceAll('ü', 'ue')
        .replaceAll('ß', 'ss');
}

/** Whether the parts of the query occur in the name in their order; an empty query matches every name. */
export function matchesName(name: string, query: string): boolean {
    const haystack = normalise(name);
    let at = 0;
    for (const part of normalise(query).split(/\s+/).filter(Boolean)) {
        const found = haystack.indexOf(part, at);
        if (found < 0) return false;
        at = found + part.length;
    }
    return true;
}

/** Letters a query part stands for in the text: the two letters of an umlaut meet the umlaut itself (as in `normalise`). */
const SPELLINGS: Record<string, string> = { ae: '(?:ae|ä)', oe: '(?:oe|ö)', ue: '(?:ue|ü)', ss: '(?:ss|ß)' };

/** A text cut where the parts of the query occur, so a list of hits can mark them (Plan.md 98, D); without a query one piece. */
export function markMatches(text: string, query: string): { text: string; hit: boolean }[] {
    const parts = normalise(query).split(/\s+/).filter(Boolean);
    if (!parts.length) return [{ text, hit: false }];
    const pattern = parts
        .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ae|oe|ue|ss/g, (pair) => SPELLINGS[pair]!))
        .sort((a, b) => b.length - a.length)
        .join('|');
    const pieces: { text: string; hit: boolean }[] = [];
    let at = 0;
    for (const match of text.matchAll(new RegExp(pattern, 'gi'))) {
        if (!match[0]) continue;
        if (match.index > at) pieces.push({ text: text.slice(at, match.index), hit: false });
        pieces.push({ text: match[0], hit: true });
        at = match.index + match[0].length;
    }
    if (at < text.length) pieces.push({ text: text.slice(at), hit: false });
    return pieces;
}
