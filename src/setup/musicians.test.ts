import { describe, expect, it } from 'vitest';
import { catalogFrom } from './catalog';
import { ALL_DATA, AUTH } from './checks';
import { musicianRuleset, provisionMusicians, updateMusicianSources, type MusicianApi } from './musicians';
import { GROUP_NAMES, planProvisioning, planRefresh, type ProvisionApi } from './provision';

/** The module rights as the test instance numbered them (G33). */
const catalog = catalogFrom({
    'infoscreen-designer': Object.fromEntries(
        ['view', 'view custom category', 'create custom category', 'edit custom category', 'delete custom category', 'view custom data', 'create custom data', 'edit custom data', 'delete custom data'].map(
            (auth, i) => [auth, { id: 2010 + i, auth }],
        ),
    ),
});
const categories = { screens: 1, playlists: 4, slides: 7, media: 10, settings: 13 };
const input = { catalog, moduleKey: 'infoscreen-designer', categories, wikiCategoryId: 1, roomIds: [1], usedRoomIds: [], appointmentRooms: false, serviceCalendarIds: [] as number[] };
const ctl = { ...input, songsheet: true, controlCategoryId: 36, agendaCalendarIds: [2, 3] };
const pairs = (items: { authId: number; dataId: number | null }[]) => items.map((i) => `${i.authId}:${i.dataId}`);

describe('the musicians group in the plan (Plan.md 121 E3, G83)', () => {
    it('is there only with a group id; the device then sees the category steuerung', () => {
        expect(planProvisioning(ctl).map((g) => g.key)).toEqual(['designer', 'device']);
        const plan = planProvisioning({ ...ctl, musicianGroupId: 'new' });
        expect(plan.map((g) => g.key)).toEqual(['designer', 'device', 'musician']);
        expect(plan[2]!.name).toBe(GROUP_NAMES.musician);
        expect(plan[2]!.postsOff).toBe(true);
        expect(plan[2]!.membersFrom).toBeUndefined();
    });

    it('gives the device "Daten sehen" on steuerung only with a song sheet and the category', () => {
        const seen = (i: Parameters<typeof planProvisioning>[0]) => planProvisioning(i)[1]!.grants.filter((g) => g.dataId?.[0] === 36).map((g) => g.authId);
        expect(seen(ctl)).toEqual([2011, 2015]);
        expect(seen({ ...ctl, songsheet: false })).toEqual([]);
        expect(seen({ ...ctl, controlCategoryId: undefined })).toEqual([]);
    });

    it('gives the musicians module, agenda, songs and writing on steuerung – nothing on the other categories', () => {
        const spec = planProvisioning({ ...ctl, musicianGroupId: 84 }).find((g) => g.key === 'musician')!;
        const rights = spec.grants.map((g) => `${g.authId}:${g.dataId?.join(',') ?? ''}`);
        expect(rights).toEqual(['2010:', '2011:36', '2015:36', '2016:36', '2017:36', '2018:36', '301:', `313:${ALL_DATA}`, '306:2,3', '331:2,3']);
        // No right on the screens, playlists, slides, media or settings: they are only forbidden.
        const onOthers = spec.grants.filter((g) => g.dataId?.some((id) => id !== 36 && id !== ALL_DATA && g.authId >= 2011));
        expect(onOthers).toEqual([]);
        expect(spec.forbidden.map((f) => f.authId)).toEqual([2016, 2017, 2018]);
    });

    it('has no spec without the category steuerung', () => {
        expect(planProvisioning({ ...input, musicianGroupId: 84 }).map((g) => g.key)).toEqual(['designer', 'device']);
    });

    it('takes back 306 and 331 of a calendar no block "Ablauf" has any more', () => {
        const plan = planProvisioning({ ...ctl, agendaCalendarIds: [2], musicianGroupId: 84 });
        const held = [
            { authId: AUTH.eventView, dataId: 2 },
            { authId: AUTH.eventView, dataId: 3 },
            { authId: AUTH.agendaView, dataId: 3 },
            { authId: AUTH.eventsView, dataId: null },
        ];
        const change = planRefresh(plan, { musician: [held] }, { calendarIds: [2, 3], roomIds: [] }).find((g) => g.key === 'musician')!;
        expect(pairs(change.remove)).toEqual(['306:3', '331:3']);
    });
});

describe('musicianRuleset', () => {
    it('is the rule ChurchTools itself wrote (G83)', () => {
        const expected = [
            {
                description: 'Automatische Mitgliedschaft für Gruppe #84',
                shorty: 'Autom. Mitgliedschaft Gruppe #84',
                personIdFieldName: 'person.id',
                importance: 0,
                query: {
                    method: 'ChurchQuery',
                    params: {
                        groupBy: ['person.id'],
                        filter: {
                            and: [
                                {
                                    dterm: [
                                        { title: 'group.automatic-membership.default-archived.title' },
                                        {
                                            and: [
                                                { dterm: [{ title: 'group.automatic-membership.default.person-not-archived.title' }, { '==': [{ var: 'person.isArchived' }, 0] }] },
                                                { dterm: [{ title: 'group.automatic-membership.default.person-not-deceased.title' }, { isnull: [{ var: 'person.dateOfDeath' }] }] },
                                            ],
                                        },
                                    ],
                                },
                                { dterm: [{ title: 'Mitgliedschaft in einer Gruppe' }, { and: [{ and: [{ oneof: [{ var: 'ctgroup.id' }, ['9']] }] }, { 'true and': [] }] }] },
                            ],
                        },
                    },
                    primaryEntityAlias: 'person',
                    responseFields: ['person.id', 'person.firstName', 'person.lastName'],
                },
                process: {
                    queryResultOnly: { none: { handleMembership: { groupMemberStatus: 'active', groupTypeRoleId: 29 } } },
                    groupOnly: { active: { handleMembership: { groupMemberStatus: 'none' } } },
                    groupAndQueryResult: {},
                },
            },
        ];
        expect(musicianRuleset(84, [9], 29)).toEqual(expected);
    });

    it('lists every band group as text', () => {
        const rule = JSON.stringify(musicianRuleset(5, [9, 12], 1));
        expect(rule).toContain('"oneof":[{"var":"ctgroup.id"},["9","12"]]');
        expect(rule).toContain('#5');
    });
});

describe('provisionMusicians and updateMusicianSources', () => {
    function fakes(opts: { failOn?: string } = {}) {
        const calls: string[] = [];
        const fail = (name: string) => {
            if (opts.failOn === name) throw new Error(`${name} failed`);
        };
        const api = {
            async createGroup(name: string) {
                calls.push(`create ${name}`);
                return 84;
            },
            roleIds: async () => [840, 841],
            grant: async (roleId: number, authId: number) => void calls.push(`grant ${roleId} ${authId}`),
            grants: async () => [],
            revoke: async () => undefined,
            defaultRole: async () => {
                fail('defaultRole');
                return { roleId: 840, groupTypeRoleId: 29 };
            },
            memberIds: async () => [],
            addMember: async () => undefined,
            postsEnabled: async () => false,
            setPostsEnabled: async () => void calls.push('posts off'),
            async setRuleset(groupId: number, rules: unknown[]) {
                fail('setRuleset');
                calls.push(`ruleset ${groupId} ${rules.length}`);
            },
            async setDynamicStatus(groupId: number, status: string) {
                fail('setDynamicStatus');
                calls.push(`status ${groupId} ${status}`);
            },
            async refreshDynamic(groupId: number) {
                fail('refreshDynamic');
                calls.push(`refresh ${groupId}`);
            },
        } satisfies ProvisionApi & MusicianApi;
        return { api, calls };
    }
    const plan = planProvisioning({ ...ctl, musicianGroupId: 'new' });

    it('creates the group with its rights, sets the rule, switches it on and runs it', async () => {
        const { api, calls } = fakes();
        const result = await provisionMusicians(plan, 4, [9], true, api);
        expect(result.error).toBeNull();
        expect(result.groupIds).toEqual({ musician: 84 });
        expect(calls.filter((c) => c.startsWith('grant'))).toHaveLength(10 * 2);
        expect(calls.slice(-3)).toEqual(['ruleset 84 1', 'status 84 active', 'refresh 84']);
    });

    it('leaves the rule to the administrator without "Personen verwalten"', async () => {
        const { api, calls } = fakes();
        const result = await provisionMusicians(plan, 4, [9], false, api);
        expect(result.error).toBeNull();
        expect(result.groupIds.musician).toBe(84);
        expect(calls.some((c) => c.startsWith('ruleset') || c.startsWith('status') || c.startsWith('refresh'))).toBe(false);
        expect(result.log.at(-1)).toContain('Personen verwalten');
    });

    it('makes the group alone when no band group is chosen', async () => {
        const { api, calls } = fakes();
        const result = await provisionMusicians(plan, 4, [], true, api);
        expect(result.error).toBeNull();
        expect(calls.some((c) => c.startsWith('ruleset'))).toBe(false);
    });

    it('stops after the group exists on a failure and keeps the group in the result', async () => {
        const { api, calls } = fakes({ failOn: 'setDynamicStatus' });
        const result = await provisionMusicians(plan, 4, [9], true, api);
        expect(result.error).toBe('setDynamicStatus failed');
        expect(result.groupIds).toEqual({ musician: 84 });
        expect(calls.some((c) => c.startsWith('refresh'))).toBe(false);
        expect(result.log.at(-1)).toContain('Abgebrochen');
    });

    it('reports a plan without the musicians group', async () => {
        const { api } = fakes();
        const result = await provisionMusicians(planProvisioning(ctl), 4, [9], true, api);
        expect(result.error).not.toBeNull();
        expect(result.groupIds).toEqual({});
    });

    it('writes the rule anew and runs it; an empty list clears it', async () => {
        const { api, calls } = fakes();
        await updateMusicianSources(84, [9, 12], api);
        expect(calls).toEqual(['ruleset 84 1', 'status 84 active', 'refresh 84']);
        calls.length = 0;
        await updateMusicianSources(84, [], api);
        expect(calls).toEqual(['ruleset 84 0', 'status 84 none']);
    });
});
