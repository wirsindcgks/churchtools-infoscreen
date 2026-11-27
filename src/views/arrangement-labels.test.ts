import { describe, expect, it } from 'vitest';
import { arrangementLabels, labelText } from './arrangement-labels';

const texts = (...args: Parameters<typeof arrangementLabels>) => arrangementLabels(...args).map(labelText);

describe('arrangementLabels', () => {
    it('joins name and key, the key from keyOfArrangement when key is empty', () => {
        expect(texts([{ name: 'Standard', key: 'G' }, { name: 'Tief', key: null, keyOfArrangement: 'E' }], 'Arrangement')).toEqual(['Standard · G', 'Tief · E']);
    });

    it('drops the word "Arrangement" and shortens the names ChurchTools gives', () => {
        expect(texts([{ name: 'Standard-Arrangement', key: 'G' }, { name: 'Neues Arrangement' }, { name: 'Akustik Arrangement' }, { name: 'Jugend' }], 'Arrangement')).toEqual(['Standard · G', 'Neu', 'Akustik', 'Jugend']);
    });

    it('numbers the second and further equal labels', () => {
        const same = { name: 'Neues Arrangement' };
        expect(texts([same, same, same], 'Arrangement')).toEqual(['Neu', 'Neu 2', 'Neu 3']);
    });

    it('numbers the name, not the key, of equal labels', () => {
        const same = { name: 'Neues Arrangement', key: 'D' };
        expect(arrangementLabels([same, same], 'Arrangement')).toEqual([{ name: 'Neu', key: 'D' }, { name: 'Neu 2', key: 'D' }]);
    });

    it('does not number labels that differ by key, and falls back for empty ones and for a bare "Arrangement"', () => {
        expect(texts([{ name: 'A', key: 'C' }, { name: 'A', key: 'D' }, {}, { name: 'Arrangement' }], 'Arrangement')).toEqual(['A · C', 'A · D', 'Arrangement', 'Arrangement 2']);
    });
});
