import { t } from '../i18n/designer';
import type { ContentBlockType } from '../model/schema';
import { normalise } from './name-search';
import { PALETTE } from './ops';

/** The blocks whose name or sentence contains the query, in the order of the palette; an empty query finds all. */
export function searchBlocks(query: string): ContentBlockType[] {
    const needle = normalise(query.trim());
    return PALETTE.filter(([type, label]) => !needle || normalise(`${label} ${t.editor.palette.descriptions[type]}`).includes(needle)).map(([type]) => type);
}
