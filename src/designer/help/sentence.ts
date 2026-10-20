/** A full stop after one of these does not end a sentence: "z. B.", "d. h.", "u. a.", "bzw.", "ca.", "usw." and the like. */
const ABBREVIATION = /(?:^|[\s(„"])(?:z\.\s?B|d\.\s?h|u\.\s?a|z|d|u|bzw|ca|usw|ggf|evtl|vgl|inkl|max|min)\.$/i;

/**
 * The first sentence of a help text: it ends at the first `.`, `!` or `?` followed by a space and a capital letter,
 * skipping German abbreviations; a text without such a boundary is returned whole (Plan.md 98, C).
 */
export function firstSentence(text: string): string {
    const boundary = /[.!?](?=\s+[A-ZÄÖÜ])/g;
    for (let match = boundary.exec(text); match; match = boundary.exec(text)) {
        if (match[0] === '.' && ABBREVIATION.test(text.slice(0, match.index + 1))) continue;
        return text.slice(0, match.index + 1);
    }
    return text.trim();
}
