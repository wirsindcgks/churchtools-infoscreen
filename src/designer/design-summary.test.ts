import { describe, expect, it } from 'vitest';
import { appointmentsSummary, fontSummary, paletteSummary, surfacesSummary } from './design-summary';

describe('paletteSummary', () => {
    it('counts the colours', () => {
        expect(paletteSummary([])).toBe('ohne Palette');
        expect(paletteSummary([{}])).toBe('Palette mit 1 Farbe');
        expect(paletteSummary([{}, {}, {}])).toBe('Palette mit 3 Farben');
    });
});

describe('surfacesSummary', () => {
    it('names the corners and the cards', () => {
        expect(surfacesSummary({ corners: 'round', cards: 'tint', cardOpacity: 80 })).toBe('Rund · leicht getönt');
        expect(surfacesSummary({ corners: 'square', cards: 'none', cardOpacity: 80 })).toBe('Eckig · ohne Karten');
    });

    it('adds the opacity of an own colour', () => {
        expect(surfacesSummary({ corners: 'round', cards: 'color', cardOpacity: 80 })).toBe('Rund · eigene Farbe, 80 %');
    });
});

describe('fontSummary', () => {
    it('names the font, an unknown key as the default font', () => {
        expect(fontSummary({ font: 'oswald' })).toBe('Oswald');
        expect(fontSummary({ font: 'gibt-es-nicht' })).toBe(fontSummary({ font: 'lato' }));
    });
});

describe('appointmentsSummary', () => {
    it('names the look and the shape of the images', () => {
        expect(appointmentsSummary({ appointments: 'large', imageRatio: '16:9' })).toBe('Modern · Bilder 16:9');
        expect(appointmentsSummary({ appointments: 'native', imageRatio: '1:1' })).toBe('Nativ · Bilder 1:1');
    });

    it('says free for the ratio „Frei“', () => {
        expect(appointmentsSummary({ appointments: 'native', imageRatio: 'free' })).toBe('Nativ · Bilder frei');
    });
});
