import { describe, expect, it } from 'vitest';
import { catalogFrom } from './catalog';
import { AUTH } from './checks';
import { GROUP_NAMES, MissingAuthError, planProvisioning, provision, type ProvisionApi } from './provision';

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
const input = { catalog, moduleKey: 'infoscreen-designer', categories, wikiCategoryId: 1, privateCalendarIds: [4] };

describe('planProvisioning', () => {
    const [designer, device] = planProvisioning(input);

    it('creates the two groups under the agreed names', () => {
        expect([designer!.name, device!.name]).toEqual([GROUP_NAMES.designer, GROUP_NAMES.device]);
    });

    it('lets designers write every category but the settings, which only the setup writes', () => {
        const edit = designer!.grants.find((g) => g.authId === 2017);
        expect(edit?.dataId).toEqual([1, 4, 7, 10]);
        expect(designer!.grants.find((g) => g.authId === 2015)?.dataId).toEqual([1, 4, 7, 10, 13]);
    });

    it('gives designers the wiki category for the media library', () => {
        expect(designer!.grants.find((g) => g.authId === AUTH.wikiCategoryEdit)?.dataId).toEqual([1]);
    });

    it('lets devices only read: the module, its data and the private calendars of the screens', () => {
        expect(device!.grants.map((g) => g.authId).sort((a, b) => a - b)).toEqual([403, 2010, 2011, 2015]);
        expect(device!.grants.find((g) => g.authId === AUTH.calendarView)?.dataId).toEqual([4]);
    });

    it('gives nobody the right to create, edit or delete categories', () => {
        const ids = [...designer!.grants, ...device!.grants].map((g) => g.authId);
        expect(ids).not.toContain(2012);
        expect(ids).not.toContain(2013);
        expect(ids).not.toContain(2014);
    });

    it('asks for no calendar right when all calendars are public, and no wiki category before it exists', () => {
        const [d, v] = planProvisioning({ ...input, wikiCategoryId: null, privateCalendarIds: [] });
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
