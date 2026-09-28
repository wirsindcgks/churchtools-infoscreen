import { describe, expect, it } from 'vitest';
import { catalogFrom } from './catalog';
import { AUTH } from './checks';
import {
    GROUP_NAMES,
    MissingAuthError,
    planProvisioning,
    provision,
    refreshGrants,
    REMOVE_SETUP_NEXT_STEPS_LOG_LINE,
    removeCreatedGroups,
    type ProvisionApi,
} from './provision';

/** The module rights as the test instance numbered them (G33). */
const catalog = catalogFrom({
    'infoscreen-designer': Object.fromEntries(
        [
            'view',
            'view custom category',
            'create custom category',
            'edit custom category',
            'delete custom category',
            'view custom data',
            'create custom data',
            'edit custom data',
            'delete custom data',
        ].map((auth, i) => [auth, { id: 2010 + i, auth }]),
    ),
});
const categories = { screens: 1, playlists: 4, slides: 7, media: 10, settings: 13 };
const input = { catalog, moduleKey: 'infoscreen-designer', categories, wikiCategoryId: 1, calendarIds: [4, 5] };

describe('planProvisioning', () => {
    const [designer, device] = planProvisioning(input);

    it('creates the two groups under the agreed names', () => {
        expect([designer!.name, device!.name]).toEqual([GROUP_NAMES.designer, GROUP_NAMES.device]);
    });

    it('lets designers write content – playlists, slides, media – but not screens and settings (Plan.md, F)', () => {
        const edit = designer!.grants.find((g) => g.authId === 2017);
        expect(edit?.dataId).toEqual([4, 7, 10]);
        expect(designer!.grants.find((g) => g.authId === 2015)?.dataId).toEqual([1, 4, 7, 10, 13]);
        expect(designer!.forbidden.map((f) => f.authId)).toEqual([2016, 2017, 2018]);
        expect(designer!.forbidden[0]?.dataId).toEqual([1, 13]);
    });

    it('gives designers the wiki category for the media library', () => {
        expect(designer!.grants.find((g) => g.authId === AUTH.wikiCategoryEdit)?.dataId).toEqual([1]);
    });

    it('lets devices only read: the module, its data and every calendar of the screens, public ones too (G35)', () => {
        expect(device!.grants.map((g) => g.authId).sort((a, b) => a - b)).toEqual([403, 2010, 2011, 2015]);
        expect(device!.grants.find((g) => g.authId === AUTH.calendarView)?.dataId).toEqual([4, 5]);
    });

    it('gives nobody the right to create, edit or delete categories', () => {
        const ids = [...designer!.grants, ...device!.grants].map((g) => g.authId);
        expect(ids).not.toContain(2012);
        expect(ids).not.toContain(2013);
        expect(ids).not.toContain(2014);
    });

    it('asks for no calendar right before a screen shows appointments, and no wiki category before it exists', () => {
        const [d, v] = planProvisioning({ ...input, wikiCategoryId: null, calendarIds: [] });
        expect(d!.grants.some((g) => g.authId === AUTH.wikiCategoryEdit)).toBe(false);
        expect(v!.grants.some((g) => g.authId === AUTH.calendarView)).toBe(false);
    });

    it('refuses to plan when the catalogue does not know the module', () => {
        expect(() => planProvisioning({ ...input, moduleKey: 'other' })).toThrow(MissingAuthError);
    });
});

describe('provision', () => {
    function fakeApi(failOnGrant?: number) {
        const calls: string[] = [];
        let nextGroup = 30;
        const api: ProvisionApi = {
            async createGroup(name) {
                calls.push(`create ${name}`);
                return nextGroup++;
            },
            async roleIds(groupId) {
                return [groupId * 10, groupId * 10 + 1];
            },
            async grant(roleId, authId, dataId) {
                if (authId === failOnGrant) throw new Error('Forbidden');
                calls.push(`grant ${roleId} ${authId}${dataId ? ` [${dataId.join(',')}]` : ''}`);
            },
            grants: async () => [],
            revoke: async () => {
                throw new Error('must not revoke');
            },
        };
        return { api, calls };
    }

    it('creates both groups and grants every right to every role', async () => {
        const plan = planProvisioning(input);
        const { api, calls } = fakeApi();
        const result = await provision(plan, 4, api);
        expect(result.error).toBeNull();
        expect(result.groupIds).toEqual({ designer: 30, device: 31 });
        const grants = plan.reduce((n, g) => n + g.grants.length * 2, 0);
        expect(calls.filter((c) => c.startsWith('grant'))).toHaveLength(grants);
    });

    it('stops at the first failure and says what already exists', async () => {
        const { api } = fakeApi(AUTH.wikiView);
        const result = await provision(planProvisioning(input), 4, api);
        expect(result.error).toBe('Forbidden');
        expect(result.groupIds).toEqual({ designer: 30 });
        expect(result.log.at(-1)).toContain('Abgebrochen');
    });
});

describe('refreshGrants', () => {
    it('grants the current plan again to the groups the assistant created, and only to those', async () => {
        const calls: string[] = [];
        const api: ProvisionApi = {
            createGroup: async () => {
                throw new Error('must not create');
            },
            roleIds: async (groupId) => [groupId * 10],
            grant: async (roleId, authId, dataId) => {
                calls.push(`${roleId}:${authId}:${dataId?.join(',') ?? ''}`);
            },
            grants: async () => [],
            revoke: async () => {
                throw new Error('nothing to revoke');
            },
        };
        const result = await refreshGrants(planProvisioning(input), { device: 28 }, api);
        expect(result.error).toBeNull();
        expect(calls).toContain('280:403:4,5');
        expect(calls.every((c) => c.startsWith('280:'))).toBe(true);
    });

    it('takes back the designers\' old right to write screens – only what is there, one data id at a time', async () => {
        const revoked: string[] = [];
        const api: ProvisionApi = {
            createGroup: async () => {
                throw new Error('must not create');
            },
            roleIds: async () => [250],
            grant: async () => {},
            // As the assistant granted it until 2026-09-25: edit on screens (1) and content; create on content only.
            grants: async () => [
                { authId: 2017, dataId: 1 },
                { authId: 2017, dataId: 4 },
                { authId: 2016, dataId: 4 },
            ],
            revoke: async (roleId, authId, dataId) => {
                revoked.push(`${roleId}:${authId}:${dataId.join(',')}`);
            },
        };
        const result = await refreshGrants(planProvisioning(input), { designer: 25 }, api);
        expect(result.error).toBeNull();
        expect(revoked).toEqual(['250:2017:1']);
        expect(result.log[0]).toContain('1 Schreibrechte');
    });
});

describe('removeCreatedGroups (Plan.md, F: nur entfernen, was das Modul selbst angelegt hat)', () => {
    it('deletes only the ids the assistant created, never a chosen existing group', async () => {
        const calls: number[] = [];
        const result = await removeCreatedGroups([25, 28], { designer: 7, device: 28 }, async (id) => {
            calls.push(id);
            return 'deleted';
        });
        expect(calls).toEqual([25, 28]);
        expect(calls).not.toContain(7);
        expect(result.selected).toEqual({ designer: 7, device: null });
        expect(result.remaining).toEqual([]);
        expect(result.removed).toEqual([25, 28]);
        expect(result.error).toBeNull();
        expect(result.log).toEqual(['2 Gruppen gelöscht.']);
    });

    it('stops at the first failure: what follows stays untried and remains removable', async () => {
        const calls: number[] = [];
        const result = await removeCreatedGroups([25, 28, 31], { designer: 25, device: null }, async (id) => {
            calls.push(id);
            if (id === 28) throw new Error('Forbidden');
            return 'deleted';
        });
        expect(calls).toEqual([25, 28]);
        expect(result.remaining).toEqual([28, 31]);
        expect(result.removed).toEqual([25]);
        expect(result.error).toBe('Forbidden');
        expect(result.selected).toEqual({ designer: null, device: null });
        expect(result.log.at(-1)).toContain('Abgebrochen');
    });

    it('does nothing for an empty list', async () => {
        const calls: number[] = [];
        const result = await removeCreatedGroups([], { designer: null, device: null }, async (id) => {
            calls.push(id);
            return 'deleted';
        });
        expect(calls).toEqual([]);
        expect(result.remaining).toEqual([]);
        expect(result.removed).toEqual([]);
        expect(result.error).toBeNull();
    });

    it('treats an already-deleted group as gone: named on its own line, taken out like a real deletion', async () => {
        const result = await removeCreatedGroups([25], { designer: 25, device: null }, async () => 'gone');
        expect(result.remaining).toEqual([]);
        expect(result.removed).toEqual([25]);
        expect(result.selected).toEqual({ designer: null, device: null });
        expect(result.error).toBeNull();
        // No sum line: nothing was actually deleted.
        expect(result.log).toEqual(['Gruppe 25 gab es nicht mehr – aus den Einstellungen entfernt.']);
    });

    it('names a gone id on its own line and still sums up the ones actually deleted', async () => {
        const result = await removeCreatedGroups([25, 28], { designer: null, device: null }, async (id) =>
            id === 25 ? 'gone' : 'deleted',
        );
        expect(result.remaining).toEqual([]);
        expect(result.removed).toEqual([25, 28]);
        expect(result.log).toEqual(['Gruppe 25 gab es nicht mehr – aus den Einstellungen entfernt.', '1 Gruppen gelöscht.']);
    });

    it('keeps a gone id\'s effect even when a later id fails for real', async () => {
        const calls: number[] = [];
        const result = await removeCreatedGroups([25, 28, 31], { designer: 25, device: null }, async (id) => {
            calls.push(id);
            if (id === 25) return 'gone';
            if (id === 28) throw new Error('Forbidden');
            return 'deleted';
        });
        expect(calls).toEqual([25, 28]);
        expect(result.remaining).toEqual([28, 31]);
        expect(result.removed).toEqual([25]);
        expect(result.error).toBe('Forbidden');
        expect(result.log).toEqual(['Gruppe 25 gab es nicht mehr – aus den Einstellungen entfernt.', 'Abgebrochen: Forbidden']);
    });
});

describe('REMOVE_SETUP_NEXT_STEPS_LOG_LINE', () => {
    it('names both manual steps left after a clean removal: the extension, then the device user and wiki area', () => {
        expect(REMOVE_SETUP_NEXT_STEPS_LOG_LINE).toContain('Extension-Verwaltung');
        expect(REMOVE_SETUP_NEXT_STEPS_LOG_LINE).toContain('Geräte-Benutzer');
        expect(REMOVE_SETUP_NEXT_STEPS_LOG_LINE).toContain('Wiki-Bereich');
    });
});
