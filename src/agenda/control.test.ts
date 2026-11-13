import { describe, expect, it } from 'vitest';
import { controlsByEvent, latestRehearsal, planControlWrite, planRehearsalWrite, readControl, readRehearsal, stepPart, stepSection } from './control';
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

describe('rehearsal choice (Plan.md 121, "Proben")', () => {
    const rehearsal = { kind: 'rehearsal', songId: 7, arrangementId: 3, section: 1, at: '2026-11-11T10:00:00Z', by: 'Max' };
    const text = (d: object) => JSON.stringify(d);
    const now = Date.parse('2026-11-20T12:00:00Z');

    it('reads a JSON string and an object, tolerantly', () => {
        expect(readRehearsal(text(rehearsal))).toEqual(rehearsal);
        expect(readRehearsal(rehearsal)).toEqual(rehearsal);
        expect(readRehearsal('no json')).toBeNull();
        expect(readRehearsal(null)).toBeNull();
        expect(readRehearsal({ ...rehearsal, songId: 0 })).toBeNull();
        expect(readRehearsal({ ...rehearsal, at: 'gestern' })).toBeNull();
        expect(readRehearsal({ ...rehearsal, kind: undefined })).toBeNull();
        // "Lied beenden" (user, 2026-11-13): read as such, and it counts as the latest choice.
        const ended = { kind: 'rehearsal', ended: true, at: '2026-11-13T20:00:00.000Z', by: 'Anna' };
        expect(readRehearsal(text(ended))).toEqual({ kind: 'rehearsal', songId: 0, arrangementId: 0, section: 0, ended: true, at: ended.at, by: 'Anna' });
        expect(readRehearsal({ ...ended, at: 'gestern' })).toBeNull();
        expect(latestRehearsal([{ value: text({ ...rehearsal, at: '2026-11-13T19:00:00.000Z' }) }, { value: text(ended) }])?.ended).toBe(true);
    });
    it('is not fooled by a choice per event, and the other way round', () => {
        expect(readRehearsal(doc)).toBeNull();
        expect(readControl(rehearsal)).toBeNull();
        expect(controlsByEvent([{ value: text(rehearsal) }])).toEqual({});
    });
    it('finds the latest', () => {
        const newer = { ...rehearsal, section: 2, at: '2026-11-11T10:05:00Z' };
        expect(latestRehearsal([{ value: text(newer) }, { value: text(rehearsal) }, { value: text(doc) }])).toEqual(newer);
        expect(latestRehearsal([{ value: text(doc) }])).toBeNull();
    });
    it('plans a write: creates, changes the latest, drops doubles and leaves the choices per event', () => {
        expect(planRehearsalWrite([{ id: 1, value: text(doc) }], now)).toEqual({ updateId: null, removeIds: [] });
        const values = [
            { id: 1, value: text(rehearsal) },
            { id: 2, value: text({ ...rehearsal, at: '2026-11-11T10:05:00Z' }) },
            { id: 3, value: text(doc) },
            { id: 4, value: 'x' },
        ];
        expect(planRehearsalWrite(values, now)).toEqual({ updateId: 2, removeIds: [1] });
    });
    it('is left standing by the write of a choice per event, even when old', () => {
        const old = { ...rehearsal, at: '2020-01-01T10:00:00Z' };
        expect(planControlWrite([{ id: 1, value: text(old) }], doc, now)).toEqual({ updateId: null, removeIds: [] });
    });
});

describe('stepSection', () => {
    const sheet = (extras: boolean[]): SongSheet => ({ sections: extras.map((extra) => ({ label: '', lines: [], ...(extra ? { extra } : {}) })) });
    it('starts at the first step and has no back from nowhere', () => {
        expect(stepSection(sheet([false, false]), null, 1)).toBe(0);
        expect(stepSection(sheet([false, false]), null, -1)).toBeNull();
        expect(stepSection(null, null, 1)).toBeNull();
    });
    it('steps inside the song and ends at its borders', () => {
        const s = sheet([false, false, false]);
        expect(stepSection(s, 0, 1)).toBe(1);
        expect(stepSection(s, 1, -1)).toBe(0);
        expect(stepSection(s, 2, 1)).toBeNull();
        expect(stepSection(s, 0, -1)).toBeNull();
    });
    it('counts no part outside the flow, and leaves one to the next step or back to the last one', () => {
        const s = sheet([false, true, false, true]);
        expect(stepSection(s, 0, 1)).toBe(2);
        expect(stepSection(s, 1, 1)).toBe(2);
        expect(stepSection(s, 1, -1)).toBe(0);
        expect(stepSection(s, 3, 1)).toBeNull();
        expect(stepSection(s, 3, -1)).toBe(2);
    });
});
