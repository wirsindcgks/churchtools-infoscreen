/**
 * Who needs the rooms of an appointment (schema 1.16, Plan.md, Nächste Schritte 50): the next appointment
 * and the list, in every layout (since 1.34: rows as well, Plan.md 82). One rule for the player, the preview
 * and the device rights.
 *
 * Which rooms a block names is decided here too: not at calendars it leaves out (`roomsOffCalendarIds`),
 * and not the rooms it switched off (`roomsOffIds`) – that filters the named rooms, never the appointments.
 */
import type { Block } from '../model/schema';

export function showsAppointmentRooms(block: Block): boolean {
    if (block.type === 'next-appointment') return block.showRooms === true;
    // Without a layout the theme decides, which is not known here: the rooms are fetched, the view decides.
    if (block.type === 'appointment-list') return block.showRooms === true && !(block.roomsInRows === false && block.layout === 'rows');
    return false;
}

/** Whether a list shows rooms in the layout it really has: lists from before 1.34 (`roomsInRows: false`) only as cards. */
export function roomsShownInLayout(block: { showRooms?: boolean; roomsInRows?: boolean }, layout: 'rows' | 'cards'): boolean {
    return block.showRooms === true && (layout === 'cards' || block.roomsInRows !== false);
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

/** Whether a room is named at an appointment of this calendar – the one place that asks (a later "per calendar" needs no more). */
export function shownRoom(
    block: { showRooms?: boolean; roomsOffCalendarIds?: readonly number[]; roomsOffIds?: readonly number[] },
    calendarId: number,
    roomId: number,
): boolean {
    return showsRoomsAt(block, calendarId) && !(block.roomsOffIds ?? []).includes(roomId);
}

/** The room names an appointment shows in this block; all of them where the appointment carries no ids (cached before 1.34). */
export function shownRoomNames(
    block: { showRooms?: boolean; roomsOffCalendarIds?: readonly number[]; roomsOffIds?: readonly number[] },
    appointment: { calendarId: number; rooms?: string[]; roomIds?: number[] },
): string[] {
    if (!showsRoomsAt(block, appointment.calendarId)) return [];
    const names = appointment.rooms ?? [];
    const ids = appointment.roomIds;
    if (!ids) return names;
    return names.filter((_, i) => ids[i] === undefined || shownRoom(block, appointment.calendarId, ids[i]!));
}

/** The room ids left out after a switch "Diese Räume": `shown` takes the room out of the list or puts it back. */
export function toggleRoomOff(off: readonly number[] | undefined, roomId: number, shown: boolean): number[] {
    const rest = (off ?? []).filter((id) => id !== roomId);
    return shown ? rest : [...rest, roomId].sort((a, b) => a - b);
}

/** The room ids left out once the master data is known: only rooms that still exist stay; undefined when none is left. */
export function pruneRoomOffIds(off: readonly number[] | undefined, rooms: readonly { id: number }[]): number[] | undefined {
    const kept = (off ?? []).filter((id) => rooms.some((r) => r.id === id));
    return kept.length ? kept : undefined;
}
