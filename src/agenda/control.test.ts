import { describe, expect, it } from 'vitest';
import { controlsByEvent, planControlWrite, readControl, stepPart } from './control';
import type { AgendaEvent, LiveItem } from './live';
import type { SongSheet } from './songsheet';

const doc = { eventId: 5, itemIndex: 2, arrangementId: 9, section: 1, at: '2026-11-11T10:00:00Z', by: 'Max' };

describe('readControl', () => {
    it('reads a JSON string and an object', () => {
        expect(readControl(JSON.stringify(doc))).toEqual(doc);
        expect(readControl(doc)).toEqual(doc);
    });
    it('needs no arrangement and no name', () => {
        expect(readControl({ eventId: 5, itemIndex: 2, section: 0, at: doc.at })).toEqual({ eventId: 5, itemIndex: 2, section: 0, at: doc.at });
    });
    it('gives null for anything unusable', () => {
        expect(readControl('no json')).toBeNull();
        expect(readControl(null)).toBeNull();
        expect(readControl({ ...doc, eventId: '5' })).toBeNull();
        expect(readControl({ ...doc, section: -1 })).toBeNull();
        expect(readControl({ ...doc, itemIndex: 1.5 })).toBeNull();
        expect(readControl({ ...doc, at: 'gestern' })).toBeNull();
        expect(readControl({ ...doc, at: undefined })).toBeNull();
    });
});

describe('controlsByEvent', () => {
    it('keeps the latest choice per event and skips the rest', () => {
        const newer = { ...doc, section: 3, at: '2026-11-11T10:05:00Z' };
        const other = { ...doc, eventId: 6 };
        const result = controlsByEvent([{ value: JSON.stringify(newer) }, { value: JSON.stringify(doc) }, { value: 'x' }, { value: JSON.stringify(other) }]);
        expect(result).toEqual({ 5: newer, 6: other });
    });
});

describe('planControlWrite', () => {
    const now = Date.parse('2026-11-11T12:00:00Z');
    const text = (d: object) => JSON.stringify(d);
    it('creates when the event has no value', () => {
        expect(planControlWrite([], doc, now)).toEqual({ updateId: null, removeIds: [] });
    });
    it('changes the value of the same event', () => {
        expect(planControlWrite([{ id: 4, value: text(doc) }], doc, now)).toEqual({ updateId: 4, removeIds: [] });
    });
    it('changes the latest of several and removes the rest', () => {
        const values = [
            { id: 1, value: text({ ...doc, at: '2026-11-11T09:00:00Z' }) },
            { id: 2, value: text({ ...doc, at: '2026-11-11T11:00:00Z' }) },
            { id: 3, value: text({ ...doc, at: '2026-11-11T10:00:00Z' }) },
        ];
        expect(planControlWrite(values, doc, now)).toEqual({ updateId: 2, removeIds: [3, 1] });
    });
    it('removes old readable choices of other events and keeps the unreadable', () => {
        const values = [
            { id: 1, value: text({ ...doc, eventId: 6, at: '2026-11-08T10:00:00Z' }) },
            { id: 2, value: text({ ...doc, eventId: 7, at: '2026-11-10T10:00:00Z' }) },
            { id: 3, value: 'kaputt' },
        ];
        expect(planControlWrite(values, doc, now)).toEqual({ updateId: null, removeIds: [1] });
    });
});

describe('stepPart', () => {
    const sheet = (n: number): SongSheet => ({ sections: Array.from({ length: n }, () => ({ label: '', lines: [] })) });
    const item = (song: boolean, sections: number): LiveItem => ({ title: 'x', duration: 0, song, beforeEvent: false, ...(sections ? { sheet: sheet(sections) } : {}) });
    const event: AgendaEvent = { eventId: 5, calendarId: 1, startMs: 0, endMs: 1, items: [item(false, 0), item(true, 2), item(false, 0), item(true, 0), item(true, 1)] };
    it('starts at the first part and has no back from nowhere', () => {
        expect(stepPart(event, null, 1)).toEqual({ itemIndex: 1, section: 0 });
        expect(stepPart(event, null, -1)).toBeNull();
    });
    it('steps inside a song and over its border, skipping songs without a sheet', () => {
        expect(stepPart(event, { itemIndex: 1, section: 0 }, 1)).toEqual({ itemIndex: 1, section: 1 });
        expect(stepPart(event, { itemIndex: 1, section: 1 }, 1)).toEqual({ itemIndex: 4, section: 0 });
        expect(stepPart(event, { itemIndex: 4, section: 0 }, -1)).toEqual({ itemIndex: 1, section: 1 });
    });
    it('counts no part outside the flow, and leaves one to the next song or back to the last step', () => {
        const flowed = (extras: boolean[]): LiveItem => ({ ...item(true, 0), sheet: { sections: extras.map((extra) => ({ label: '', lines: [], ...(extra ? { extra } : {}) })) } });
        const list: AgendaEvent = { ...event, items: [item(false, 0), flowed([false, false, true, true]), flowed([false])] };
        expect(stepPart(list, { itemIndex: 1, section: 1 }, 1)).toEqual({ itemIndex: 2, section: 0 });
        expect(stepPart(list, { itemIndex: 2, section: 0 }, -1)).toEqual({ itemIndex: 1, section: 1 });
        expect(stepPart(list, { itemIndex: 1, section: 3 }, 1)).toEqual({ itemIndex: 2, section: 0 });
        expect(stepPart(list, { itemIndex: 1, section: 2 }, -1)).toEqual({ itemIndex: 1, section: 1 });
        expect(stepPart(list, { itemIndex: 2, section: 0 }, 1)).toBeNull();
    });
    it('gives null at the edges', () => {
        expect(stepPart(event, { itemIndex: 4, section: 0 }, 1)).toBeNull();
        expect(stepPart(event, { itemIndex: 1, section: 0 }, -1)).toBeNull();
    });
});
