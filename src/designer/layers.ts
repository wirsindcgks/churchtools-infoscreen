/**
 * The list of layers in "Anordnen" (Plan.md 79, B3): top layer first, each with a short content line so one block can
 * be told from the next of its kind. Pure, so the order and the lines are tested without a component.
 */
import type { Block } from '../model/schema';
import { socialName } from '../player/social';

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
        case 'social':
            return shorten((block.links[0] && socialName(block.links[0])) || '');
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

/**
 * The layers as units, bottom first (Plan.md 79, D9): a block without a group is a unit of its own, a group stands at
 * the place of its topmost member with its members in their order. `layerUnits(blocks).flat()` is the order in which
 * every group lies together – slides from earlier states with a group pulled apart become smooth on the first move.
 */
export function layerUnits(blocks: readonly Block[]): Block[][] {
    const lastOf = new Map<string, number>();
    blocks.forEach((block, i) => {
        if (block.groupId) lastOf.set(block.groupId, i);
    });
    const units: Block[][] = [];
    blocks.forEach((block, i) => {
        if (!block.groupId) units.push([block]);
        else if (lastOf.get(block.groupId) === i) units.push(blocks.filter((x) => x.groupId === block.groupId));
    });
    return units;
}

/** One line of the list: a block, or a group with its members (top first). */
export type LayerEntry = { kind: 'block'; row: LayerRow } | { kind: 'group'; groupId: string; rows: LayerRow[] };

/** The list of layers with the groups as one entry each, top first. A group of one member counts as a block. */
export function layerEntries(blocks: readonly Block[]): LayerEntry[] {
    const indexOf = new Map(blocks.map((block, index) => [block.id, index]));
    const row = (block: Block): LayerRow => ({ block, index: indexOf.get(block.id)! });
    return layerUnits(blocks)
        .map((unit): LayerEntry => {
            const groupId = unit[0]!.groupId;
            return groupId && unit.length > 1 ? { kind: 'group', groupId, rows: unit.map(row).reverse() } : { kind: 'block', row: row(unit[0]!) };
        })
        .reverse();
}
