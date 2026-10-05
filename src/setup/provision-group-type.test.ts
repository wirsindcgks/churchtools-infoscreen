import { describe, expect, it } from 'vitest';
import { defaultGroupTypeId } from './provision';

describe('defaultGroupTypeId (Plan.md 71)', () => {
    const types = [
        { id: 1, name: 'Kleingruppe' },
        { id: 4, name: 'Merkmal' },
    ];

    it('finds „Merkmal" by its shown name', () => {
        expect(defaultGroupTypeId(types)).toBe(4);
    });

    it('finds it by its stored name when the shown one is translated', () => {
        expect(defaultGroupTypeId([{ id: 1, name: 'Kleingruppe' }, { id: 7, name: 'Attribute', rawName: 'Merkmal' }])).toBe(7);
    });

    it('is null when the instance has no such type', () => {
        expect(defaultGroupTypeId([{ id: 1, name: 'Kleingruppe' }, { id: 2, name: 'Dienst' }])).toBeNull();
        expect(defaultGroupTypeId([])).toBeNull();
    });
});
