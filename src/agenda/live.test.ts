import { describe, expect, it } from 'vitest';
import {
    agendaDisplay,
    clockText,
    signalState,
    countdownSeconds,
    delaySeconds,
    endReached,
    liveItems,
    nextIndex,
    parsePosition,
    pickEvent,
    plannedStartMs,
    pollableEvents,
    POLL_AFTER_MS,
    POLL_BEFORE_MS,
    type AgendaEvent,
    type AgendaItemResponse,
    type LivePosition,
} from './live';

// The test instance of G81: event 1, points id 1 "Countdown", id 3 song "Halleluja", id 4 "Begrüßung", id 5 "Predigt", id 6 "Segen".
const G81: AgendaItemResponse[] = [
    { type: 'normal', title: 'Countdown', duration: 300 },
    { type: 'header', title: 'Eingang', duration: 0 },
    { type: 'song', title: '', duration: 300, song: { title: 'Halleluja' } },
    { type: 'normal', title: 'Begrüßung', duration: 300 },
    { type: 'normal', title: 'Predigt', duration: 1800 },
    { type: 'normal', title: 'Segen', duration: 300 },
];

const START = Date.parse('2026-11-10T10:00:00Z');

function event(items: AgendaItemResponse[], extra: Partial<AgendaEvent> = {}): AgendaEvent {
    const live = liveItems(items);
    const seconds = live.reduce((sum, i) => sum + i.duration, 0);
    return { eventId: 1, calendarId: 2, startMs: START, endMs: START + seconds * 1000, items: live, ...extra };
}

/** A reading whose server clock is the device clock; switched `agoSeconds` before `nowMs`. */
function at(raw: { pos_id: string | null; agoSeconds?: number; addseconds?: string }, nowMs: number): LivePosition {
    return parsePosition(
        {
            pos_id: raw.pos_id,
            switchdate: raw.pos_id === null ? null : new Date(nowMs - (raw.agoSeconds ?? 0) * 1000).toISOString(),
            addseconds: raw.pos_id === null ? null : (raw.addseconds ?? '0'),
            currentTime: nowMs,
        },
        nowMs,
    );
}

describe('liveItems', () => {
    it('starts with the placeholder and leaves the headers out', () => {
        const items = liveItems(G81);
        expect(items.map((i) => i.title)).toEqual(['', 'Countdown', 'Halleluja', 'Begrüßung', 'Predigt', 'Segen']);
        expect(items[0]).toMatchObject({ duration: 0, song: false });
    });

    it('takes the name of a song from the song when the title is empty, else the title', () => {
        const items = liveItems([
            { type: 'song', title: '', duration: 200, song: { title: 'Halleluja' } },
            { type: 'song', title: 'Eigener Titel', duration: 200, song: { title: 'Anderes' } },
        ]);
        expect(items.slice(1).map((i) => i.title)).toEqual(['Halleluja', 'Eigener Titel']);
    });

    it('counts points before the event along', () => {
        const items = liveItems([
            { title: 'Einlass', duration: 600, isBeforeEvent: true },
            { title: 'Begrüßung', duration: 300 },
        ]);
        expect(items.map((i) => i.title)).toEqual(['', 'Einlass', 'Begrüßung']);
        expect(items[1]!.beforeEvent).toBe(true);
    });
});

describe('parsePosition', () => {
    it('reads the strings of the old interface; null is "not started" at index 0', () => {
        const raw = { pos_id: '3', switchdate: '2026-11-10T10:10:00Z', addseconds: '60', currentTime: START + 5000 };
        expect(parsePosition(raw, START + 5100)).toEqual({ index: 3, set: true, switchMs: START + 600_000, addSeconds: 60, offsetMs: 100 });
        expect(parsePosition({ pos_id: null, switchdate: null, addseconds: null, currentTime: START }, START)).toMatchObject({ index: 0, set: false, switchMs: null, addSeconds: 0 });
    });
});

describe('Jetzt and Dann (G81)', () => {
    const e = event(G81);

    it('pos_id "3" is "Begrüßung", then "Predigt"', () => {
        const display = agendaDisplay({ event: e, position: at({ pos_id: '3' }, START), phase: 'live' }, START);
        expect(display).toMatchObject({ kind: 'now', title: 'Begrüßung', next: 'Predigt' });
    });

    it('skips songs without a duration for "Dann"; they belong to the point before', () => {
        const withSong = event([
            { title: 'Predigt', duration: 600 },
            { type: 'song', title: '', duration: 0, song: { title: 'Zugabe' } },
            { title: 'Segen', duration: 300 },
        ]);
        expect(nextIndex(withSong.items, 1)).toBe(3);
        expect(agendaDisplay({ event: withSong, position: at({ pos_id: '1' }, START), phase: 'live' }, START)).toMatchObject({ title: 'Predigt', next: 'Segen' });
        // A song with a duration is a point of its own.
        expect(nextIndex(e.items, 1)).toBe(2);
    });

    it('has no next point at the last one', () => {
        expect(agendaDisplay({ event: e, position: at({ pos_id: '5' }, START), phase: 'live' }, START)).toMatchObject({ title: 'Segen', next: null });
    });

    it('announces the first point before the start', () => {
        expect(agendaDisplay({ event: e, position: undefined, phase: 'upcoming' }, START)).toMatchObject({ kind: 'soon', title: 'Countdown', next: null, countdownSeconds: null, delaySeconds: null, lengthSeconds: null });
        expect(agendaDisplay({ event: e, position: at({ pos_id: null }, START), phase: 'live' }, START)).toMatchObject({ kind: 'soon' });
    });

    it('shows nothing for no pick', () => {
        expect(agendaDisplay(null, START)).toBeNull();
    });
});

describe('note, services and people of a point', () => {
    const parsed = (item: AgendaItemResponse) => liveItems([{ title: 'Punkt', duration: 60, ...item }])[1]!;

    it('takes the note trimmed and leaves an empty one out', () => {
        expect(parsed({ note: '  Gemeindefest  ' }).note).toBe('Gemeindefest');
        expect(parsed({ note: '   ' })).not.toHaveProperty('note');
    });

    it('reads the first service from the brackets and the people by service (G81)', () => {
        const item = parsed({ responsible: { text: '[Predigt]', persons: [{ service: '[Predigt]', person: { title: 'Max Mustermann' } }] } });
        expect(item.service).toBe('Predigt');
        expect(item.responsible).toBe('Predigt: Max Mustermann');
    });

    it('groups two people of the same service and drops the unfilled ones', () => {
        const item = parsed({
            responsible: {
                text: '[Predigt], [Technik]',
                persons: [
                    { service: '[Predigt]', person: { title: 'Max Mustermann' } },
                    { service: '[Technik]', person: null },
                    { service: '[Predigt]', person: { title: 'Erika Muster' } },
                ],
            },
        });
        expect(item.service).toBe('Predigt');
        expect(item.responsible).toBe('Predigt: Max Mustermann, Erika Muster');
    });

    it('keeps the free text outside the brackets as a part of its own', () => {
        const item = parsed({ responsible: { text: '[Leitung],  Gäste  vom Chor,', persons: [{ service: '[Leitung]', person: { title: 'Anna' } }, { person: { title: 'Ben' } }] } });
        expect(item.responsible).toBe('Leitung: Anna · Ben · Gäste vom Chor');
        expect(parsed({ responsible: { text: 'Gäste', persons: [] } })).toMatchObject({ responsible: 'Gäste' });
        expect(parsed({ responsible: { text: '[Technik]', persons: [{ service: '[Technik]', person: null }] } })).not.toHaveProperty('responsible');
    });

    it('has none of it without "Verantwortlich"', () => {
        const item = parsed({});
        expect(item).not.toHaveProperty('service');
        expect(item).not.toHaveProperty('responsible');
    });
});

describe('position and planned start of the shown point', () => {
    it('counts the points without the songs that have no duration', () => {
        const e = event([
            { title: 'Predigt', duration: 600 },
            { type: 'song', title: '', duration: 0, song: { title: 'Zugabe' } },
            { title: 'Segen', duration: 300 },
        ]);
        const at3 = agendaDisplay({ event: e, position: at({ pos_id: '3' }, START), phase: 'live' }, START);
        expect(at3).toMatchObject({ title: 'Segen', number: 2, count: 2, song: false });
        // Standing on the skipped song itself counts as the point before.
        expect(agendaDisplay({ event: e, position: at({ pos_id: '2' }, START), phase: 'live' }, START)).toMatchObject({ number: 1, count: 2, song: true });
    });

    it('plans the shown point and the next; before the start the first point', () => {
        const e = event(G81);
        const now = agendaDisplay({ event: e, position: at({ pos_id: '3' }, START), phase: 'live' }, START)!;
        expect(now.plannedStartMs).toBe(plannedStartMs(e, 3));
        expect(now.nextPlannedStartMs).toBe(plannedStartMs(e, 4));
        const soon = agendaDisplay({ event: e, position: undefined, phase: 'upcoming' }, START)!;
        expect(soon).toMatchObject({ plannedStartMs: START, number: 1, count: 5, nextPlannedStartMs: null });
    });
});

describe('delay and countdown', () => {
    const e = event([{ title: 'Einlass', duration: 600, isBeforeEvent: true }, ...G81]);

    it('plans point i at the start, less the points before the event, plus the points ahead of it', () => {
        // Einlass (1) lies before the event: the plan begins ten minutes earlier.
        expect(plannedStartMs(e, 1)).toBe(START - 600_000);
        expect(plannedStartMs(e, 2)).toBe(START - 600_000 + 600_000);
        expect(plannedStartMs(e, 4)).toBe(START - 600_000 + 600_000 + 300_000 + 300_000);
    });

    it('measures the delay from the switch time, none before the start', () => {
        const late = parsePosition({ pos_id: '2', switchdate: new Date(START + 150_000).toISOString(), addseconds: '0', currentTime: START }, START);
        expect(delaySeconds(e, late)).toBe(150);
        const early = parsePosition({ pos_id: '2', switchdate: new Date(START - 30_000).toISOString(), addseconds: '0', currentTime: START }, START);
        expect(delaySeconds(e, early)).toBe(-30);
        expect(delaySeconds(e, at({ pos_id: null }, START))).toBeNull();
    });

    it('counts down duration and added time less what passed since the switch, on the server clock', () => {
        const position = parsePosition({ pos_id: '4', switchdate: new Date(START).toISOString(), addseconds: '60', currentTime: START + 100_000 }, START + 100_000);
        expect(countdownSeconds(e, position, START + 100_000)).toBe(300 + 60 - 100);
        // The device runs two minutes ahead: the offset brings it back to the server clock.
        const ahead = parsePosition({ pos_id: '4', switchdate: new Date(START).toISOString(), addseconds: '0', currentTime: START + 100_000 }, START + 220_000);
        expect(ahead.offsetMs).toBe(120_000);
        expect(agendaDisplay({ event: e, position: ahead, phase: 'live' }, START + 220_000)?.countdownSeconds).toBe(300 - 100);
    });
});

describe('the end', () => {
    // 300 + 300 + 300 + 1800 + 300 seconds; after "Segen" two closing parts without a duration.
    const closing = event([...G81, { title: 'Hintergrundmusik', duration: 0 }, { title: 'Gebetsangebot', duration: 0 }]);
    const last = 5;

    it('is reached when the last point with a duration has run out', () => {
        expect(endReached(closing, at({ pos_id: String(last), agoSeconds: 100 }, START), START)).toBe(false);
        expect(endReached(closing, at({ pos_id: String(last), agoSeconds: 300 }, START), START)).toBe(true);
    });

    it('is reached when the position stands behind it; the closing part is not "the end" before', () => {
        expect(endReached(closing, at({ pos_id: String(last + 1) }, START), START)).toBe(true);
        expect(endReached(closing, at({ pos_id: String(last - 1), agoSeconds: 5000 }, START), START)).toBe(false);
    });

    it('falls back to an hour after the planned end', () => {
        const position = at({ pos_id: '2' }, closing.endMs);
        expect(endReached(closing, position, closing.endMs + POLL_AFTER_MS - 1000)).toBe(false);
        expect(endReached(closing, position, closing.endMs + POLL_AFTER_MS)).toBe(true);
        expect(endReached(closing, undefined, closing.endMs + POLL_AFTER_MS)).toBe(true);
    });

    it('falls back to the given time after the planned end', () => {
        const buffer = 30 * 60_000;
        expect(endReached(closing, undefined, closing.endMs + buffer - 1, buffer)).toBe(false);
        expect(endReached(closing, undefined, closing.endMs + buffer, buffer)).toBe(true);
    });

    it('is not reached with no position and time left', () => {
        expect(endReached(closing, undefined, START)).toBe(false);
        expect(endReached(closing, at({ pos_id: null }, START), START)).toBe(false);
    });
});

describe('pickEvent', () => {
    const morning = event(G81, { eventId: 1, startMs: START });
    const noon = event(G81, { eventId: 2, startMs: START + 4 * 3600_000, endMs: START + 5 * 3600_000 });

    it('takes the running one first', () => {
        const positions = { 2: at({ pos_id: '3' }, START + 4 * 3600_000 + 60_000) };
        expect(pickEvent([morning, noon], positions, START + 4 * 3600_000 + 60_000)).toMatchObject({ event: { eventId: 2 }, phase: 'live' });
    });

    it('announces the next one that has not started when none runs', () => {
        expect(pickEvent([noon, morning], {}, START - 600_000)).toMatchObject({ event: { eventId: 1 }, phase: 'upcoming' });
        // The first is over, the second not started.
        const positions = { 1: at({ pos_id: '6' }, START + 3600_000) };
        expect(pickEvent([morning, noon], positions, START + 3600_000)).toMatchObject({ event: { eventId: 2 }, phase: 'upcoming' });
    });

    it('keeps the closing part of an over event while no other is due', () => {
        const positions = { 1: at({ pos_id: '6' }, START + 3600_000) };
        const pick = pickEvent([morning], positions, START + 3600_000);
        expect(pick).toMatchObject({ event: { eventId: 1 }, phase: 'ended' });
        expect(agendaDisplay(pick, START + 3600_000)).toMatchObject({ kind: 'now', title: 'Segen' });
    });

    it('leaves out an event whose position the account may not read', () => {
        expect(pickEvent([morning], { 1: null }, START - 600_000)).toBeNull();
        expect(pickEvent([morning, noon], { 1: null }, START - 600_000)).toMatchObject({ event: { eventId: 2 }, phase: 'upcoming' });
    });

    it('shows nothing without events or when nothing was ever started', () => {
        expect(pickEvent([], {}, START)).toBeNull();
        expect(pickEvent([morning], {}, morning.endMs + POLL_AFTER_MS + 1)).toBeNull();
        expect(pickEvent([event([])], {}, START)).toBeNull();
    });
});

describe('pollableEvents', () => {
    const e = event(G81);

    it('asks from half an hour before the start until an hour after the end, not outside', () => {
        expect(pollableEvents([e], START - POLL_BEFORE_MS - 1)).toEqual([]);
        expect(pollableEvents([e], START - POLL_BEFORE_MS)).toEqual([e]);
        expect(pollableEvents([e], e.endMs + POLL_AFTER_MS)).toEqual([e]);
        expect(pollableEvents([e], e.endMs + POLL_AFTER_MS + 1)).toEqual([]);
        expect(pollableEvents([e], e.endMs + 2 * POLL_AFTER_MS, 2 * POLL_AFTER_MS)).toEqual([e]);
        expect(pollableEvents([e], e.endMs + 2 * POLL_AFTER_MS + 1, 2 * POLL_AFTER_MS)).toEqual([]);
    });
});

describe('the clock and the signal of the card', () => {
    it('writes the time left as minutes and seconds, with a real minus once it is over', () => {
        expect(clockText(192)).toBe('3:12');
        expect(clockText(5)).toBe('0:05');
        expect(clockText(-40)).toBe('−0:40');
        expect(clockText(4500)).toBe('75:00');
        expect(clockText(0)).toBe('0:00');
    });

    it('is green, yellow from the warning minutes, red once over, and none without a countdown', () => {
        expect(signalState(null, 1)).toBeNull();
        expect(signalState(61, 1)).toBe('ok');
        expect(signalState(60, 1)).toBe('warn');
        expect(signalState(0, 1)).toBe('warn');
        expect(signalState(-1, 1)).toBe('over');
        expect(signalState(299, 5)).toBe('warn');
    });

    it('describes the next point for the card of "Dann"', () => {
        const e = event([
            { title: 'Begrüßung', duration: 300 },
            { title: 'Predigt', duration: 1800, responsible: { text: '[Predigt]', persons: [{ service: '[Predigt]', person: { title: 'Max' } }] } },
        ]);
        const display = agendaDisplay({ event: e, position: at({ pos_id: '1' }, START), phase: 'live' }, START);
        expect(display).toMatchObject({ next: 'Predigt', nextService: 'Predigt', nextResponsible: 'Predigt: Max', nextDurationSeconds: 1800 });
        expect(agendaDisplay({ event: e, position: at({ pos_id: '2' }, START), phase: 'live' }, START)).toMatchObject({ nextService: null, nextResponsible: null, nextDurationSeconds: null });
    });
});
