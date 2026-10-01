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

/**
 * Whether the rooms show at an appointment of this calendar: the block asks for them and the
 * calendar is not one it leaves out (schema 1.17). Loading and device rights follow `showRooms` alone.
 */
export function showsRoomsAt(
    block: { showRooms?: boolean; roomsOffCalendarIds?: readonly number[] },
    calendarId: number,
): boolean {
    return block.showRooms === true && !(block.roomsOffCalendarIds ?? []).includes(calendarId);
}

/** The ids left out after a checkbox "Räume zeigen für": `shown` takes the calendar out of the list or puts it back. */
export function toggleRoomsOff(off: readonly number[] | undefined, calendarId: number, shown: boolean): number[] {
    const rest = (off ?? []).filter((id) => id !== calendarId);
    return shown ? rest : [...rest, calendarId].sort((a, b) => a - b);
}

/** The ids left out once the block's calendars changed: only chosen calendars stay; undefined when none is left. */
export function pruneRoomsOff(off: readonly number[] | undefined, calendarIds: readonly number[]): number[] | undefined {
    const kept = (off ?? []).filter((id) => calendarIds.includes(id));
    return kept.length ? kept : undefined;
}
