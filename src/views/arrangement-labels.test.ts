import { describe, expect, it } from 'vitest';
import { arrangementLabels } from './arrangement-labels';

describe('arrangementLabels', () => {
    it('joins name and key, the key from keyOfArrangement when key is empty', () => {
        expect(arrangementLabels([{ name: 'Standard', key: 'G' }, { name: 'Tief', key: null, keyOfArrangement: 'E' }], 'Arrangement')).toEqual(['Standard · G', 'Tief · E']);
    });

    it('numbers the second and further equal labels', () => {
        const same = { name: 'Neues Arrangement' };
        expect(arrangementLabels([same, same, same], 'Arrangement')).toEqual(['Neues Arrangement', 'Neues Arrangement 2', 'Neues Arrangement 3']);
    });

    it('does not number labels that differ by key, and falls back for empty ones', () => {
        expect(arrangementLabels([{ name: 'A', key: 'C' }, { name: 'A', key: 'D' }, {}], 'Arrangement')).toEqual(['A · C', 'A · D', 'Arrangement']);
    });
});
