import { describe, expect, it } from 'vitest';
import { firstSentence } from './sentence';

describe('firstSentence (Plan.md 98, C)', () => {
    it('ends at the first full stop, exclamation or question mark before a capital', () => {
        expect(firstSentence('Das ist eins. Das ist zwei.')).toBe('Das ist eins.');
        expect(firstSentence('Wirklich? Ja.')).toBe('Wirklich?');
        expect(firstSentence('Achtung! Danach nichts.')).toBe('Achtung!');
    });

    it('skips German abbreviations', () => {
        expect(firstSentence('Zeigt z. B. den Namen. Mehr nicht.')).toBe('Zeigt z. B. den Namen.');
        expect(firstSentence('Das gilt, d. h. immer. Sonst Ende.')).toBe('Das gilt, d. h. immer.');
        expect(firstSentence('Gilt u. a. für Gruppen. Rest.')).toBe('Gilt u. a. für Gruppen.');
        expect(firstSentence('Gilt bzw. Ende ca. Mitte. Rest.')).toBe('Gilt bzw. Ende ca. Mitte.');
        expect(firstSentence('Und so weiter usw. Danach. Rest.')).toBe('Und so weiter usw. Danach.');
    });

    it('does not end before a lower-case word or a digit', () => {
        expect(firstSentence('Version 1.5 gilt. Neu.')).toBe('Version 1.5 gilt.');
        expect(firstSentence('Eins. zwei. Drei.')).toBe('Eins. zwei.');
    });

    it('returns the whole text without a boundary', () => {
        expect(firstSentence('Nur ein Satz.')).toBe('Nur ein Satz.');
        expect(firstSentence('Ohne Punkt')).toBe('Ohne Punkt');
    });
});
