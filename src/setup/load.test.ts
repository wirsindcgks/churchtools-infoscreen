import { churchtoolsClient } from '@churchtools/churchtools-client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { groupMemberNames, loadGroupTypes, loadRightOrigins, personGroupIds } from './load';

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

describe('loadRightOrigins (G61)', () => {
    afterEach(() => vi.restoreAllMocks());

    const origin = (type: string, groupId: number | undefined, value: boolean | number | number[] = true, revokedByGroupRoleId: number | null = null) => ({
        type,
        groupId,
        value,
        revokedByGroupRoleId,
    });

    it('joins global and internal, keeps only effective group sources and each pair once', async () => {
        vi.spyOn(churchtoolsClient, 'get').mockImplementation(async (path: string) => {
            if (path === '/permissions/origins/global/persons/22') {
                return {
                    personId: 22,
                    permissions: [
                        { authId: 1, origins: [origin('groupTypeRole', 8, 2), origin('status', undefined), origin('publicUser', undefined)] },
                        { authId: 2, origins: [origin('groupRole', 9, true, 5), origin('groupRole', 9, false), origin('groupRole', 9, 0), origin('groupRole', 9, [])] },
                    ],
                };
            }
            if (path === '/permissions/origins/internal/persons/22') {
                return {
                    personId: 22,
                    groups: [
                        { groupId: 8, permissions: [{ authId: 1, origins: [origin('groupRole', 8)] }, { authId: 3, origins: [origin('groupRole', 4, [7])] }] },
                    ],
                };
            }
            throw new Error(`unexpected ${path}`);
        });
        expect(await loadRightOrigins(22)).toEqual([
            { authId: 1, groupId: 8 },
            { authId: 3, groupId: 4 },
        ]);
    });
});
