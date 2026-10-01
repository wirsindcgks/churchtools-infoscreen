import { describe, expect, it } from 'vitest';
import { pruneRoomsOff, showsRoomsAt, toggleRoomsOff } from './rooms';

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
