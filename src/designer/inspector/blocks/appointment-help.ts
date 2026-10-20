import { t } from '../../../i18n/designer';
import type { Block, ThemeDoc } from '../../../model/schema';
import { listLayout } from '../../../player/theme';
import type { HelpItem } from '../../help/types';

/** The explanation of "Raum zeigen" (Plan.md 98): the switch stands in the "Darstellung" of both blocks, the text depends on the form of the list. */
export function showRoomHelp(block: Extract<Block, { type: 'appointment-list' | 'next-appointment' }>, theme: ThemeDoc): HelpItem {
    return { term: t.inspector.showRoom, text: t.inspector.showRoomInfo(block.type === 'appointment-list' && listLayout(block, theme) === 'visitor') };
}
