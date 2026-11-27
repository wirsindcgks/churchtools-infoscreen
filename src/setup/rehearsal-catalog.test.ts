import { describe, expect, it } from 'vitest';
import type { RehearsalCatalogDoc } from '../agenda/control';
import { catalogOutdated, releasedWithoutSheet } from './rehearsal-catalog';

const stored = (over: Partial<RehearsalCatalogDoc> = {}): RehearsalCatalogDoc => ({
    kind: 'rehearsalCatalog',
    screens: [{ id: 's1', name: 'Bühne' }],
    playlists: [{ id: 'p1', name: 'Probe' }],
    clickScreens: [],
    at: '2026-11-26T10:00:00Z',
    ...over,
});
const wanted = { screens: [{ id: 's1', name: 'Bühne' }], playlists: [{ id: 'p1', name: 'Probe' }], clickScreens: [] };

describe('catalogOutdated (Plan.md 135 D)', () => {
    it('is false where names and sets agree, in any order', () => {
        expect(catalogOutdated(stored(), wanted)).toBe(false);
        const two = { ...wanted, screens: [{ id: 's2', name: 'Saal' }, ...wanted.screens] };
        expect(catalogOutdated(stored({ screens: [...wanted.screens, { id: 's2', name: 'Saal' }] }), two)).toBe(false);
    });

    it('is true for a renamed presentation or screen', () => {
        expect(catalogOutdated(stored({ playlists: [{ id: 'p1', name: 'Ablauf' }] }), wanted)).toBe(true);
        expect(catalogOutdated(stored({ screens: [{ id: 's1', name: 'Altar' }] }), wanted)).toBe(true);
    });

    it('is true where a presentation, a screen or a click screen was added or dropped', () => {
        expect(catalogOutdated(stored({ playlists: [] }), wanted)).toBe(true);
        expect(catalogOutdated(stored(), { ...wanted, playlists: [] })).toBe(true);
        expect(catalogOutdated(stored(), { ...wanted, clickScreens: [{ id: 's3', name: 'Foyer' }] })).toBe(true);
    });

    it('does not ask for a list where nothing is released and none is stored', () => {
        expect(catalogOutdated(null, { screens: [], playlists: [], clickScreens: [] })).toBe(false);
        expect(catalogOutdated(null, wanted)).toBe(true);
    });
});

describe('releasedWithoutSheet', () => {
    const all = [{ id: 'p1', name: 'Ablauf' }, { id: 'p2', name: 'Probe' }];

    it('names the released presentation that has lost its sheet', () => {
        expect(releasedWithoutSheet(['p1', 'p2'], all, [{ id: 'p2', name: 'Probe' }])).toEqual(['Ablauf']);
    });

    it('leaves out presentations that are gone, and those with a sheet', () => {
        expect(releasedWithoutSheet(['gone', 'p2'], all, [{ id: 'p2', name: 'Probe' }])).toEqual([]);
        expect(releasedWithoutSheet([], all, [])).toEqual([]);
    });
});
