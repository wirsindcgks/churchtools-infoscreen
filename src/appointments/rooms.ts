/**
 * Who needs the rooms of an appointment (schema 1.16, Plan.md, Nächste Schritte 50):
 * the next appointment in both layouts, the list only as cards. One rule for the
 * player, the preview and the device rights.
 *
 * A list that follows the theme (no `layout`) may turn out as cards – the theme
 * is not known here, so its rooms are fetched; the view decides whether to show them.
 */
import type { Block } from '../model/schema';

export function showsAppointmentRooms(block: Block): boolean {
    if (block.type === 'next-appointment') return block.showRooms === true;
    if (block.type === 'appointment-list') return block.showRooms === true && block.layout !== 'rows';
    return false;
}

export function needsAppointmentRooms(blocks: readonly Block[]): boolean {
    return blocks.some(showsAppointmentRooms);
}
