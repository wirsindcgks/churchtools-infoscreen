import { describe, expect, it } from 'vitest';
import { controlsByEvent, readControl } from './control';

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
