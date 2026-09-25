/**
 * docs/Rechte.md is maintained by hand, for administrators of other churches.
 * This test keeps it honest: every right the setup assistant grants or takes
 * back must be named there – change the assistant, and the build fails until
 * the page follows.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { CATEGORIES } from '../store/screen-repository';
import { catalogFrom } from './catalog';
import { AUTH } from './checks';
import { planProvisioning } from './provision';

// Tests run from the repository root (jsdom's import.meta.url is no file URL).
const doc = fs.readFileSync(path.resolve('docs/Rechte.md'), 'utf8');

const MODULE_AUTHS = [
    'view',
    'view custom category',
    'create custom category',
    'edit custom category',
    'delete custom category',
    'view custom data',
    'create custom data',
    'edit custom data',
    'delete custom data',
];
const catalog = catalogFrom({
    'infoscreen-designer': Object.fromEntries(MODULE_AUTHS.map((auth, i) => [auth, { id: 2010 + i, auth }])),
});
const plan = planProvisioning({
    catalog,
    moduleKey: 'infoscreen-designer',
    categories: { screens: 1, playlists: 4, slides: 7, media: 10, settings: 13 },
    wikiCategoryId: 1,
    calendarIds: [1],
});

describe('docs/Rechte.md', () => {
    it('names every right the assistant grants or takes back, as the assistant labels it', () => {
        const labels = new Set(plan.flatMap((g) => [...g.grants, ...g.forbidden]).map((g) => g.label));
        const missing = [...labels].filter((label) => !doc.includes(label));
        expect(missing).toEqual([]);
    });

    it('names every permission key of the module and the core rights by number', () => {
        expect(MODULE_AUTHS.filter((auth) => !doc.includes(`\`${auth}\``))).toEqual([]);
        for (const id of [AUTH.calendarView, AUTH.wikiView, AUTH.wikiCategoryView, AUTH.wikiCategoryEdit]) {
            expect(doc).toContain(String(id));
        }
    });

    it('names the categories as ChurchTools shows them', () => {
        expect(Object.values(CATEGORIES).filter((c) => !doc.includes(c.name))).toEqual([]);
    });

    it('names the groups the assistant creates', () => {
        for (const group of plan) expect(doc).toContain(`„${group.name}"`);
    });
});
