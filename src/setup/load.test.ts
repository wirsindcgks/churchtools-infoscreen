import { churchtoolsClient } from '@churchtools/churchtools-client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { groupMemberNames, loadGroupTypes, personGroupIds } from './load';

describe('personGroupIds', () => {
    afterEach(() => vi.restoreAllMocks());

    it('reads the ids from domainIdentifier, a string as ChurchTools sends it (measured 2026-09-28)', async () => {
        vi.spyOn(churchtoolsClient, 'get').mockResolvedValue([
            { group: { domainIdentifier: '28' } },
            { group: { domainIdentifier: null } },
        ]);
        expect(await personGroupIds(22)).toEqual([28]);
    });
});

describe('groupMemberNames (Plan.md, F; G18: names collected before the device group is deleted)', () => {
    afterEach(() => vi.restoreAllMocks());

    it('names every member of the group, by id in order', async () => {
        vi.spyOn(churchtoolsClient, 'getAllPages').mockResolvedValue([{ personId: 22 }, { personId: 16 }]);
        vi.spyOn(churchtoolsClient, 'get').mockImplementation(async (path: string) => {
            if (path === '/persons/22') return { id: 22, firstName: 'Minimal', lastName: 'User', statusId: 1 };
            if (path === '/persons/16') return { id: 16, firstName: 'Infoscreen', lastName: 'Foyer', statusId: 1 };
            throw new Error(`unexpected ${path}`);
        });
        expect(await groupMemberNames(28)).toEqual([
            { personId: 22, name: 'Minimal User' },
            { personId: 16, name: 'Infoscreen Foyer' },
        ]);
    });
});

describe('loadGroupTypes (Plan.md 71)', () => {
    afterEach(() => vi.restoreAllMocks());

    it('shows the translated name, orders by sortKey and then by name', async () => {
        vi.spyOn(churchtoolsClient, 'get').mockResolvedValue([
            { id: 3, name: 'Zeta' },
            { id: 4, name: 'merkmal', nameTranslated: 'Attribute', sortKey: 1 },
            { id: 1, name: 'Alpha' },
            { id: 2, name: 'Beta', sortKey: 2 },
        ]);
        expect(await loadGroupTypes()).toEqual([
            { id: 1, name: 'Alpha', rawName: 'Alpha' },
            { id: 3, name: 'Zeta', rawName: 'Zeta' },
            { id: 4, name: 'Attribute', rawName: 'merkmal' },
            { id: 2, name: 'Beta', rawName: 'Beta' },
        ]);
    });
});
