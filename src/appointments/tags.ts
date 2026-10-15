/**
 * Who needs the tags of an appointment (schema 1.37, Plan.md 82 C): the blocks that hide appointments by tag.
 * One rule for the player and the preview, so the tags are only asked for where a block uses them.
 */
import type { Block } from '../model/schema';

export function needsAppointmentTags(blocks: readonly Block[]): boolean {
    return blocks.some(
        (block) =>
            (block.type === 'appointment-list' || block.type === 'next-appointment' || block.type === 'countdown') &&
            (block.hideTagIds?.length ?? 0) > 0,
    );
}
