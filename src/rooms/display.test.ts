import { describe, expect, it } from 'vitest';
import type { RoomEntry } from '../model/schema';
import { doorSign, emptyText, overviewRows } from './display';
import type { RoomBooking, RoomBookings } from './normalize';

const TZ = 'Europe/Berlin';
/** 2026-09-27 (Sunday), 10:30 in Berlin (UTC+2). */
const NOW = new Date('2026-09-27T08:30:00Z');
const at = (time: string, day = 27) => new Date(`2026-09-${day}T${time}:00Z`); // UTC; Berlin is +2

let nextId = 1;
function booking(start: Date, end: Date, title: string | null = 'Gottesdienst', allDay = false): RoomBooking {
    return { id: nextId++, resourceId: 1, title, start, end, allDay };
}
const saal = (bookings: RoomBooking[]): RoomBookings => ({ resourceId: 1, name: 'Saal', bookings });
const entry = (overrides: Partial<RoomEntry> = {}): RoomEntry => ({ resourceId: 1, hint: '', showTitles: true, ...overrides });

describe('overviewRows', () => {
    it('drops what is over, marks what runs now, keeps what comes, by start', () => {
        const rows = overviewRows(
            [saal([booking(at('12:00'), at('13:00'), 'Später'), booking(at('06:00'), at('07:00'), 'Vorbei'), booking(at('07:30'), at('09:30'), 'Jetzt')])],
            [entry({ hint: ' 1. OG, links ' })],
            NOW,
            TZ,
            1,
        );
        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({ name: 'Saal', hint: '1. OG, links' });
        expect(rows[0]!.lines.map((l) => [l.title, l.now])).toEqual([
            ['Jetzt', true],
            ['Später', false],
        ]);
        expect(rows[0]!.lines[0]!.time).toBe('09:30–11:30');
    });

    it('treats the end as over: a booking that ends at this minute is gone', () => {
        expect(overviewRows([saal([booking(at('07:00'), NOW)])], [entry()], NOW, TZ, 1)).toEqual([]);
    });

    it('says "ganztägig" instead of a time', () => {
        const rows = overviewRows([saal([booking(at('00:00'), at('21:59'), 'Tagung', true)])], [entry()], NOW, TZ, 1);
        expect(rows[0]!.lines[0]).toMatchObject({ time: 'ganztägig', now: true });
    });

    it('shows "Belegt" where titles are off or missing, and the title where they are on', () => {
        const rooms: RoomBookings[] = [
            saal([booking(at('12:00'), at('13:00'), 'Gespräch Familie X')]),
            { resourceId: 2, name: 'Küche', bookings: [{ ...booking(at('12:00'), at('13:00'), null), resourceId: 2 }] },
            { resourceId: 3, name: 'Keller', bookings: [{ ...booking(at('12:00'), at('13:00'), 'Jugend'), resourceId: 3 }] },
        ];
        const rows = overviewRows(rooms, [entry({ showTitles: false }), entry({ resourceId: 2 }), entry({ resourceId: 3 })], NOW, TZ, 1);
        expect(rows.map((r) => r.lines[0]!.title)).toEqual(['Belegt', 'Belegt', 'Jugend']);
        expect(JSON.stringify(rows)).not.toContain('Familie');
    });

    it('marks tomorrow only with two days, and shows nothing of it with one', () => {
        const tomorrow = booking(at('08:00', 28), at('09:00', 28), 'Morgens');
        expect(overviewRows([saal([tomorrow])], [entry()], NOW, TZ, 1)).toEqual([]);
        const rows = overviewRows([saal([booking(at('12:00'), at('13:00'), 'Heute'), tomorrow])], [entry()], NOW, TZ, 2);
        expect(rows[0]!.lines.map((l) => [l.title, l.tomorrow])).toEqual([
            ['Heute', false],
            ['Morgens', true],
        ]);
    });

    it('follows the block\'s order, and leaves out rooms without a booking left or without data', () => {
        const rooms: RoomBookings[] = [
            saal([booking(at('12:00'), at('13:00'))]),
            { resourceId: 2, name: 'Küche', bookings: [] },
            { resourceId: 3, name: 'Keller', bookings: [{ ...booking(at('14:00'), at('15:00')), resourceId: 3 }] },
        ];
        const rows = overviewRows(rooms, [entry({ resourceId: 3 }), entry({ resourceId: 2 }), entry({ resourceId: 9 }), entry()], NOW, TZ, 1);
        expect(rows.map((r) => r.name)).toEqual(['Keller', 'Saal']);
    });

    it('has the texts for an empty day', () => {
        expect(emptyText(1)).toBe('Heute sind keine Räume belegt.');
        expect(emptyText(2)).toBe('Heute und morgen sind keine Räume belegt.');
    });
});

describe('doorSign', () => {
    it('shows what is going on now, until when, and up to three after it', () => {
        const sign = doorSign(
            [
                saal([
                    booking(at('07:30'), at('09:30'), 'Gottesdienst'),
                    booking(at('10:00'), at('11:00'), 'A'),
                    booking(at('11:30'), at('12:00'), 'B'),
                    booking(at('12:30'), at('13:00'), 'C'),
                    booking(at('13:30'), at('14:00'), 'D'),
                ]),
            ],
            [entry({ hint: '1. OG' })],
            NOW,
            TZ,
            1,
        );
        expect(sign).toMatchObject({ name: 'Saal', hint: '1. OG', freeUntil: null });
        expect(sign!.current).toMatchObject({ title: 'Gottesdienst', until: 'bis 11:30', now: true });
        expect(sign!.next.map((l) => l.title)).toEqual(['A', 'B', 'C']);
    });

    it('says free, and until when if something comes today', () => {
        const sign = doorSign([saal([booking(at('12:00'), at('13:00'), 'Probe')])], [entry()], NOW, TZ, 1);
        expect(sign!.current).toBeNull();
        expect(sign!.freeUntil).toBe('bis 14:00');
        expect(sign!.next.map((l) => l.title)).toEqual(['Probe']);
    });

    it('is free without "until" when nothing comes today – tomorrow does not count', () => {
        const sign = doorSign([saal([booking(at('08:00', 28), at('09:00', 28), 'Morgens')])], [entry()], NOW, TZ, 2);
        expect(sign!.current).toBeNull();
        expect(sign!.freeUntil).toBeNull();
        expect(sign!.next[0]).toMatchObject({ title: 'Morgens', tomorrow: true });
        expect(doorSign([saal([])], [entry()], NOW, TZ, 1)).toMatchObject({ current: null, freeUntil: null, next: [] });
    });

    it('takes the first room of the list only, and the privacy switch applies', () => {
        const rooms: RoomBookings[] = [saal([booking(at('07:30'), at('09:30'), 'Gespräch Familie X')]), { resourceId: 2, name: 'Küche', bookings: [] }];
        const sign = doorSign(rooms, [entry({ showTitles: false }), entry({ resourceId: 2 })], NOW, TZ, 1);
        expect(sign!.name).toBe('Saal');
        expect(sign!.current!.title).toBe('Belegt');
        expect(JSON.stringify(sign)).not.toContain('Familie');
    });

    it('is null when the first room has no data, or the block has no room', () => {
        expect(doorSign([], [entry()], NOW, TZ, 1)).toBeNull();
        expect(doorSign([saal([])], [], NOW, TZ, 1)).toBeNull();
    });

    it('says "ganztägig" for an all-day booking now', () => {
        const sign = doorSign([saal([booking(at('00:00'), at('21:59'), 'Tagung', true)])], [entry()], NOW, TZ, 1);
        expect(sign!.current!.until).toBe('ganztägig');
    });
});
