import { describe, expect, it } from 'vitest';
import { wikiCategoryCreation } from './wiki-creation';

describe('wikiCategoryCreation', () => {
    it('creates nothing, and reports nothing, when the area is visible', () => {
        expect(wikiCategoryCreation({ visibleCategoryId: 7, createdCategoryId: 7, canViewWiki: true })).toEqual({ create: false });
        expect(wikiCategoryCreation({ visibleCategoryId: 7, createdCategoryId: null, canViewWiki: false })).toEqual({ create: false });
    });

    it('does not create a second area when one was created before but is not visible', () => {
        const result = wikiCategoryCreation({ visibleCategoryId: null, createdCategoryId: 7, canViewWiki: true });
        expect(result.create).toBe(false);
        expect(result).toMatchObject({ problem: expect.stringContaining('schon angelegt') });
    });

    it('does not create it without the right to see the wiki', () => {
        const result = wikiCategoryCreation({ visibleCategoryId: null, createdCategoryId: null, canViewWiki: false });
        expect(result.create).toBe(false);
        expect(result).toMatchObject({ problem: expect.stringContaining('das Wiki zu sehen') });
    });

    it('creates it when there is none, none was created, and the wiki is visible', () => {
        expect(wikiCategoryCreation({ visibleCategoryId: null, createdCategoryId: null, canViewWiki: true })).toEqual({ create: true });
    });
});
