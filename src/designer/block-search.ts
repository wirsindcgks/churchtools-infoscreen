import { t } from '../i18n/designer';
import type { BlockType } from '../model/schema';
import { PALETTE } from './ops';

/** Lower case, umlauts as their two letters: "ä" and "ae" meet (Plan.md 79, C7). */
function normalise(text: string): string {
    return text
        .toLowerCase()
        .replaceAll('ä', 'ae')
        .replaceAll('ö', 'oe')
        .replaceAll('ü', 'ue')
        .replaceAll('ß', 'ss');
}

/** The blocks whose name or sentence contains the query, in the order of the palette; an empty query finds all. */
export function searchBlocks(query: string): BlockType[] {
    const needle = normalise(query.trim());
    return PALETTE.filter(([type, label]) => !needle || normalise(`${label} ${t.editor.palette.descriptions[type]}`).includes(needle)).map(([type]) => type);
}
