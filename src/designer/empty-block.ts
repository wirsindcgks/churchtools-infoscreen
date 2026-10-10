import { t } from '../i18n/designer';
import type { Block } from '../model/schema';

/** What a block still lacks, as the words of the button on it (Plan.md 79, C6); null where it has what it needs. */
export function emptyAction(block: Block): string | null {
    const say = t.quick.empty;
    switch (block.type) {
        case 'image':
            return block.mediaId ? null : say.image;
        case 'video':
            return block.mediaId ? null : say.video;
        case 'slideshow':
            return block.mediaIds.length ? null : say.slideshow;
        case 'web':
            return block.url.trim() ? null : say.web;
        case 'qr':
            return block.data.trim() ? null : say.qr;
        case 'posts':
            return block.groupIds.length ? null : say.posts;
        case 'groups':
            return block.parentGroupId === undefined ? say.groups : null;
        case 'rooms':
            return block.rooms.length ? null : say.rooms;
        default:
            return null;
    }
}

/** Whether a block above this one (later in the list) has the middle of this block inside its frame – then the button on it would lie over that block. */
export function centerCovered(block: Block, blocks: readonly Block[]): boolean {
    const cx = block.x + block.width / 2;
    const cy = block.y + block.height / 2;
    return blocks
        .slice(blocks.findIndex((b) => b.id === block.id) + 1)
        .some((b) => cx >= b.x && cx <= b.x + b.width && cy >= b.y && cy <= b.y + b.height);
}
