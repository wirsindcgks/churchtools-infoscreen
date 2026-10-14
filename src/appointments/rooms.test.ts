import { describe, expect, it } from 'vitest';
import type { Block } from '../model/schema';
import { needsAppointmentRooms, pruneRoomOffIds, pruneRoomsOff, roomsShownInLayout, shownRoom, shownRoomNames, showsAppointmentRooms, showsRoomsAt, toggleRoomOff, toggleRoomsOff } from './rooms';

describe('showsRoomsAt (schema 1.17, Plan.md 51)', () => {
    it('shows rooms when asked for and the calendar is not left out', () => {
        expect(showsRoomsAt({ showRooms: true }, 2)).toBe(true);
        expect(showsRoomsAt({ showRooms: true, roomsOffCalendarIds: [3] }, 2)).toBe(true);
        expect(showsRoomsAt({ showRooms: true, roomsOffCalendarIds: [2, 3] }, 2)).toBe(false);
        expect(showsRoomsAt({ roomsOffCalendarIds: [] }, 2)).toBe(false);
        expect(showsRoomsAt({ showRooms: false }, 2)).toBe(false);
    });
});

describe('toggleRoomsOff / pruneRoomsOff', () => {
    it('leaves a calendar out and brings it back', () => {
        expect(toggleRoomsOff(undefined, 5, false)).toEqual([5]);
        expect(toggleRoomsOff([7], 5, false)).toEqual([5, 7]);
        expect(toggleRoomsOff([5, 7], 5, true)).toEqual([7]);
    });

    it('keeps only chosen calendars and drops the field when none is left', () => {
        expect(pruneRoomsOff([5, 7], [5, 6])).toEqual([5]);
        expect(pruneRoomsOff([7], [5, 6])).toBeUndefined();
        expect(pruneRoomsOff(undefined, [5])).toBeUndefined();
    });
});

describe('showsAppointmentRooms (schema 1.34, Plan.md 82)', () => {
    const list = (layout: 'rows' | 'cards' | undefined, showRooms?: boolean) =>
        ({ type: 'appointment-list', layout, showRooms }) as unknown as Block;

    it('asks for rooms in every layout of the list, as the next appointment does', () => {
        expect(showsAppointmentRooms(list('rows', true))).toBe(true);
        expect(showsAppointmentRooms(list('cards', true))).toBe(true);
        expect(showsAppointmentRooms(list(undefined, true))).toBe(true);
        expect(showsAppointmentRooms(list('rows'))).toBe(false);
        expect(showsAppointmentRooms({ type: 'next-appointment', showRooms: true } as unknown as Block)).toBe(true);
        expect(needsAppointmentRooms([list('rows', true)])).toBe(true);
        expect(needsAppointmentRooms([list('rows', false)])).toBe(false);
    });
});

describe('roomsInRows false (lists from before 1.34)', () => {
    const old = { type: 'appointment-list', showRooms: true, roomsInRows: false };
    it('loads rooms unless the layout is surely rows, and shows them as cards only', () => {
        expect(showsAppointmentRooms({ ...old, layout: 'rows' } as unknown as Block)).toBe(false);
        expect(showsAppointmentRooms({ ...old, layout: 'cards' } as unknown as Block)).toBe(true);
        expect(showsAppointmentRooms(old as unknown as Block)).toBe(true);
        expect(roomsShownInLayout(old, 'rows')).toBe(false);
        expect(roomsShownInLayout(old, 'cards')).toBe(true);
        expect(roomsShownInLayout({ showRooms: true }, 'rows')).toBe(true);
        expect(roomsShownInLayout({ roomsInRows: true }, 'cards')).toBe(false);
    });
});

describe('shownRoom / shownRoomNames (schema 1.34)', () => {
    const appointment = { calendarId: 2, rooms: ['Saal', 'Küche', 'Raum 01'], roomIds: [1, 2, 3] };
    const on = { showRooms: true };

    it('names every room without a list or with an empty one', () => {
        expect(shownRoomNames(on, appointment)).toEqual(['Saal', 'Küche', 'Raum 01']);
        expect(shownRoomNames({ ...on, roomsOffIds: [] }, appointment)).toEqual(['Saal', 'Küche', 'Raum 01']);
    });

    it('leaves out the switched-off rooms, names and ids in step', () => {
        expect(shownRoomNames({ ...on, roomsOffIds: [2] }, appointment)).toEqual(['Saal', 'Raum 01']);
        expect(shownRoomNames({ ...on, roomsOffIds: [1, 2, 3] }, appointment)).toEqual([]);
        expect(shownRoom({ ...on, roomsOffIds: [2] }, 2, 2)).toBe(false);
        expect(shownRoom({ ...on, roomsOffIds: [2] }, 2, 1)).toBe(true);
    });

    it('ignores ids that are not booked or no longer exist', () => {
        expect(shownRoomNames({ ...on, roomsOffIds: [99] }, appointment)).toEqual(['Saal', 'Küche', 'Raum 01']);
    });

    it('names all rooms of an appointment cached without ids', () => {
        expect(shownRoomNames({ ...on, roomsOffIds: [1] }, { calendarId: 2, rooms: ['Saal', 'Küche'] })).toEqual(['Saal', 'Küche']);
    });

    it('names nothing where the block does not ask or leaves the calendar out, nor without rooms', () => {
        expect(shownRoomNames({}, appointment)).toEqual([]);
        expect(shownRoomNames({ ...on, roomsOffCalendarIds: [2] }, appointment)).toEqual([]);
        expect(shownRoom({ ...on, roomsOffCalendarIds: [2] }, 2, 1)).toBe(false);
        expect(shownRoomNames(on, { calendarId: 2 })).toEqual([]);
    });
});

describe('toggleRoomOff / pruneRoomOffIds', () => {
    it('switches a room off and back on', () => {
        expect(toggleRoomOff(undefined, 5, false)).toEqual([5]);
        expect(toggleRoomOff([7], 5, false)).toEqual([5, 7]);
        expect(toggleRoomOff([5, 7], 5, true)).toEqual([7]);
    });

    it('keeps only rooms that still exist and drops the field when none is left', () => {
        const rooms = [{ id: 5 }, { id: 6 }];
        expect(pruneRoomOffIds([5, 7], rooms)).toEqual([5]);
        expect(pruneRoomOffIds([7], rooms)).toBeUndefined();
        expect(pruneRoomOffIds(undefined, rooms)).toBeUndefined();
    });
});
