import { describe, expect, it } from 'vitest';
import { matchesName } from './name-search';

describe('matchesName', () => {
    it('matches every name with an empty query', () => {
        expect(matchesName('Jugendkreis', '')).toBe(true);
        expect(matchesName('Jugendkreis', '   ')).toBe(true);
    });

    it('finds parts of the name, in their order', () => {
        expect(matchesName('Jugendkreis Nord', 'ju kr')).toBe(true);
        expect(matchesName('Jugendkreis Nord', 'nord')).toBe(true);
        expect(matchesName('Jugendkreis Nord', 'kr ju')).toBe(false);
        expect(matchesName('Jugendkreis Nord', 'ju süd')).toBe(false);
    });

    it('does not count one place twice', () => {
        expect(matchesName('Chor', 'ch ch')).toBe(false);
        expect(matchesName('Chor & Chorleitung', 'ch ch')).toBe(true);
    });

    it('ignores case and meets umlauts in their two letters', () => {
        expect(matchesName('Männerfrühstück', 'MAENNER fruehst')).toBe(true);
        expect(matchesName('Gemeindegruss', 'gruß')).toBe(true);
    });
});
