import { describe, expect, it } from 'vitest';
import { markMatches, matchesName } from './name-search';

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

describe('markMatches (Plan.md 98, D)', () => {
    const marked = (text: string, query: string) => markMatches(text, query).filter((p) => p.hit).map((p) => p.text);

    it('cuts the text where the parts of the query occur, whatever the case', () => {
        expect(markMatches('Die Schriftart der Schrift', 'schrift').map((p) => p.text).join('')).toBe('Die Schriftart der Schrift');
        expect(marked('Die Schriftart der Schrift', 'schrift')).toEqual(['Schrift', 'Schrift']);
        expect(marked('Größe und Stärke', 'groe staer')).toEqual(['Grö', 'Stär']);
    });

    it('leaves the text whole without a query', () => {
        expect(markMatches('Text', ' ')).toEqual([{ text: 'Text', hit: false }]);
    });
});
