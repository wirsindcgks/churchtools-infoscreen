import { describe, expect, it } from 'vitest';
import { missingDesignerRights, type ModulePermissions, type RightsInput } from './rights';

const categories = { screens: 11, playlists: 12, slides: 13, media: 14, settings: 15 };
const all = [11, 12, 13, 14, 15];
const written = [11, 12, 13, 14];

const fullModule: ModulePermissions = {
    view: true,
    'create custom category': false,
    'view custom category': all,
    'view custom data': all,
    'create custom data': written,
    'edit custom data': written,
    'delete custom data': written,
};

function input(overrides: Partial<RightsInput> = {}): RightsInput {
    return {
        module: fullModule,
        categories,
        wiki: { view: true, 'view category': [1], 'edit category': [1] },
        wikiCategoryId: 1,
        ...overrides,
    };
}

describe('missingDesignerRights', () => {
    it('finds nothing missing for a fully equipped designer', () => {
        expect(missingDesignerRights(input())).toEqual([]);
    });

    it('does not ask for write rights on the settings, which only the setup writes', () => {
        expect(missingDesignerRights(input({ module: { ...fullModule, 'edit custom data': written } }))).toEqual([]);
    });

    it('says so when there are no module rights at all – the empty list must not read as "no screens"', () => {
        const missing = missingDesignerRights(input({ module: null }));
        expect(missing).toHaveLength(1);
        expect(missing[0]?.text).toContain('Keine Rechte');
    });

    it('skips the module in demo mode, where there is none, but still checks the wiki', () => {
        const missing = missingDesignerRights(input({ module: undefined, wiki: { view: true, 'view category': [1] } }));
        expect(missing.map((m) => m.area)).toEqual(['wiki']);
        expect(missing[0]?.key).toBe('edit category');
    });

    it('names each data right with the categories it lacks', () => {
        const missing = missingDesignerRights(
            input({ module: { ...fullModule, 'edit custom data': [11, 12], 'delete custom data': [] } }),
        );
        expect(missing).toEqual([
            { area: 'module', text: 'Daten bearbeiten', key: 'edit custom data', detail: 'Slides, Medien' },
            { area: 'module', text: 'Daten löschen', key: 'delete custom data', detail: 'Screens, Playlists, Slides, Medien' },
        ]);
    });

    it('names both causes of invisible categories, since the API cannot tell them apart (G20)', () => {
        const missing = missingDesignerRights(input({ categories: { screens: 11 } }));
        expect(missing).toHaveLength(1);
        expect(missing[0]?.key).toBe('view custom category');
        expect(missing[0]?.detail).toContain('Playlists, Slides, Medien, Einstellungen');
        expect(missing[0]?.detail).toContain('create custom category');
    });

    it('accepts missing categories when this person may create them on first use', () => {
        const missing = missingDesignerRights(
            input({ categories: {}, module: { ...fullModule, 'create custom category': true } }),
        );
        expect(missing).toEqual([]);
    });

    it('asks for the module view right', () => {
        const missing = missingDesignerRights(input({ module: { ...fullModule, view: false } }));
        expect(missing.map((m) => m.key)).toEqual(['view']);
    });

    it('names a wiki without view right before anything about its categories', () => {
        const missing = missingDesignerRights(input({ wiki: { view: false } }));
        expect(missing).toHaveLength(1);
        expect(missing[0]?.key).toBe('churchwiki: view');
    });

    it('explains an invisible wiki category instead of claiming it is missing', () => {
        const missing = missingDesignerRights(input({ wikiCategoryId: null }));
        expect(missing).toHaveLength(1);
        expect(missing[0]?.detail).toContain('ersten Bild-Upload');
    });
});
