import { describe, expect, it } from 'vitest';
import { DEFAULT_THEME } from '../../model/schema';
import { PICTOGRAMS } from './pictograms';
import { appointmentListTiles, GROUPS_TILES, MOTION_TILES, nextAppointmentTiles, POSTS_TILES, ROOMS_TILES, TRANSITION_TILES } from './layouts';
import { createBlock } from '../ops';

const nativeTheme = { ...DEFAULT_THEME, appointments: 'native' } as const;
const largeTheme = { ...DEFAULT_THEME, appointments: 'large' } as const;

function listBlock() {
    const block = createBlock('appointment-list', { width: 1920, height: 1080 });
    if (block.type !== 'appointment-list') throw new Error('wrong block');
    return block;
}

function nextBlock() {
    const block = createBlock('next-appointment', { width: 1920, height: 1080 });
    if (block.type !== 'next-appointment') throw new Error('wrong block');
    return block;
}

describe('the picture tiles of the blocks (Plan.md 79, B2)', () => {
    it('"Wie im Design" of the list shows the picture of what the theme takes', () => {
        const [design, rows, cards] = appointmentListTiles(listBlock(), nativeTheme);
        expect([design!.value, design!.label, rows!.label, cards!.label]).toEqual(['', 'Wie im Design', 'Zeilen', 'Karten']);
        expect(design!.pictogram).toBe('list-rows');
        expect(appointmentListTiles(listBlock(), largeTheme)[0]!.pictogram).toBe('list-cards');
    });

    it('"Wie im Design" ignores the layout the block itself has: it names the theme', () => {
        const own = { ...listBlock(), layout: 'cards' as const };
        expect(appointmentListTiles(own, nativeTheme)[0]!.pictogram).toBe('list-rows');
    });

    it('"Wie im Design" of the next appointment shows the plain or the highlighted picture', () => {
        const tiles = nextAppointmentTiles(nextBlock(), nativeTheme);
        expect(tiles.map((o) => o.label)).toEqual(['Wie im Design', 'Schlicht', 'Hervorgehoben']);
        expect(tiles[0]!.pictogram).toBe('next-classic');
        expect(nextAppointmentTiles(nextBlock(), largeTheme)[0]!.pictogram).toBe('next-card');
    });

    it('names the looks of the other blocks with one word', () => {
        expect(POSTS_TILES.map((o) => o.label)).toEqual(['Hervorgehoben', 'Liste']);
        expect(GROUPS_TILES.map((o) => o.label)).toEqual(['Hervorgehoben', 'Liste']);
        expect(ROOMS_TILES.map((o) => [o.value, o.label])).toEqual([['overview', 'Übersicht'], ['door', 'Türschild']]);
        expect(TRANSITION_TILES.map((o) => o.label)).toEqual(['Überblenden', 'Schieben', 'Aufdecken', 'Ohne']);
        expect(MOTION_TILES.map((o) => o.label)).toEqual(['Keine', 'Hineinzoomen', 'Herauszoomen', 'Abwechselnd']);
    });

    it('every tile has a picture of its own, drawn', () => {
        const tiles = [...POSTS_TILES, ...GROUPS_TILES, ...ROOMS_TILES, ...TRANSITION_TILES, ...MOTION_TILES, ...appointmentListTiles(listBlock(), nativeTheme), ...nextAppointmentTiles(nextBlock(), nativeTheme)];
        for (const tile of tiles) expect(PICTOGRAMS[tile.pictogram].length).toBeGreaterThan(0);
        const drawn = Object.values(PICTOGRAMS).map((paths) => paths.map((p) => p.d).join('|'));
        expect(new Set(drawn).size).toBe(drawn.length);
    });
});
