/**
 * The list of layers in "Anordnen" (Plan.md 79, B3): top layer first, each with a short content line so one block can
 * be told from the next of its kind. Pure, so the order and the lines are tested without a component.
 */
import type { Block } from '../model/schema';

/** Longest short content before it is cut. */
export const SUMMARY_MAX = 30;

/** How a block's references read: nothing is looked up here. */
export interface SummaryLookup {
    mediaName(id: string): string | undefined;
    calendarName(id: number): string | undefined;
    roomName(id: number): string | undefined;
}

export function shorten(text: string, max = SUMMARY_MAX): string {
    const line = text.replace(/\s+/g, ' ').trim();
    return line.length > max ? `${line.slice(0, max - 1).trimEnd()}…` : line;
}

/** Text start, picture name, first calendar, address – whatever the block has; empty where it has nothing to say. */
export function blockSummary(block: Block, lookup: SummaryLookup): string {
    switch (block.type) {
        case 'text':
            return shorten(block.text);
        case 'image':
        case 'video':
            return shorten((block.mediaId && lookup.mediaName(block.mediaId)) || '');
        case 'slideshow':
            return shorten((block.mediaIds[0] && lookup.mediaName(block.mediaIds[0])) || '');
        case 'appointment-list':
        case 'next-appointment':
        case 'countdown':
            return shorten((block.calendarIds[0] !== undefined && lookup.calendarName(block.calendarIds[0])) || '');
        case 'rooms':
            return shorten((block.rooms[0] && lookup.roomName(block.rooms[0].resourceId)) || '');
        case 'web':
            return shorten(block.url.replace(/^https?:\/\//, ''));
        case 'qr':
            return shorten(block.data.replace(/^https?:\/\//, ''));
        default:
            return '';
    }
}

export interface LayerRow {
    block: Block;
    /** The place in the slide's array: the layer's number, 1 = the back. */
    index: number;
}

/** The slide's blocks with the top layer first – the last in the array lies on top. */
export function layerRows(blocks: readonly Block[]): LayerRow[] {
    return blocks.map((block, index) => ({ block, index })).reverse();
}
