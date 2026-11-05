import { describe, expect, it } from 'vitest';
import { catalogFrom } from './catalog';
import { AUTH } from './checks';
import {
    devicePasswordRecommendationLogLine,
    GROUP_NAMES,
    MissingAuthError,
    planProvisioning,
    provision,
    applyRefresh,
    applyPeopleRelease,
    planRefresh,
    provisionPeople,
    completePeople,
    orphanPeopleGroup,
    readRefresh,
    refreshIsEmpty,
    REMOVE_SETUP_NEXT_STEPS_LOG_LINE,
    removeCreatedGroups,
    type ProvisionApi,
    type RefreshItem,
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
/** The calls the people group needs (Plan.md 112): a default role per group, the device group's members, adding one. */
function peopleStubs(
    calls: string[],
    members: Record<number, number[]> = {},
    /** Whether posts are on, by group; a group not named has them off already. */
    posts: Record<number, boolean> = {},
): Pick<ProvisionApi, 'defaultRole' | 'memberIds' | 'addMember' | 'postsEnabled' | 'setPostsEnabled'> {
    return {
        postsEnabled: async (groupId) => posts[groupId] ?? false,
        setPostsEnabled: async (groupId, enabled) => {
            posts[groupId] = enabled;
        },
        defaultRole: async (groupId) => ({ roleId: groupId * 10 + 1, groupTypeRoleId: 900 + groupId }),
        memberIds: async (groupId) => members[groupId] ?? [],
        addMember: async (groupId, personId, groupTypeRoleId) => {
            calls.push(`member ${groupId} ${personId} ${groupTypeRoleId}`);
            (members[groupId] ??= []).push(personId);
        },
    };
}
const categories = { screens: 1, playlists: 4, slides: 7, media: 10, settings: 13 };
const input = { catalog, moduleKey: 'infoscreen-designer', categories, wikiCategoryId: 1, roomIds: [1, 2, 3], usedRoomIds: [2], appointmentRooms: false, serviceCalendarIds: [] as number[] };

describe('the catalogue', () => {
    it('names a right by its id – in the words of ChurchTools, else as module and API name', () => {
        expect(catalog.name(2010)).toBe('infoscreen-designer: view');
        expect(catalog.name(1)).toBeUndefined();
        const worded = catalogFrom({
            churchdb: {
                'security level edit own data': {
                    id: 132,
                    auth: 'security level edit own data',
                    bezeichnung: 'Eigene Personendaten bearbeiten - bis zum gewählten Sicherheitslevel',
                },
            },
            churchcore: { 'administer settings': { id: 1, auth: 'administer settings', bezeichnung: 'System-Einstellungen verwalten' } },
        });
        expect(worded.name(132)).toBe('Personen: Eigene Personendaten bearbeiten - bis zum gewählten Sicherheitslevel');
        // A module whose heading in ChurchTools is not known: the wording alone.
        expect(worded.name(1)).toBe('System-Einstellungen verwalten');
    });
});

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

    it('lets devices only read: the module, its data, the rooms and the wiki category for videos (G47) – no calendar, they see public ones through the public user (Plan.md 73, G53)', () => {
        expect(device!.grants.map((g) => g.authId).sort((a, b) => a - b)).toEqual([205, 502, 2010, 2011, 2015]);
    });

    it('gives devices the wiki category to see – always, but never "Wiki" itself or the right to edit (Plan.md 52)', () => {
        expect(device!.grants.find((g) => g.authId === AUTH.wikiCategoryView)).toEqual({
            authId: 502,
            dataId: [1],
            label: 'Wiki-Bereich „Infoscreen" sehen',
        });
        expect(device!.grants.some((g) => g.authId === AUTH.wikiView || g.authId === AUTH.wikiCategoryEdit)).toBe(false);
        const [, without] = planProvisioning({ ...input, wikiCategoryId: null });
        expect(without!.grants.some((g) => g.authId === AUTH.wikiCategoryView)).toBe(false);
    });

    it('gives designers "Ressource sehen" for every room, devices only for the rooms a screen shows (G45)', () => {
        expect(designer!.grants.find((g) => g.authId === AUTH.resourceView)).toEqual({
            authId: 205,
            dataId: [1, 2, 3],
            label: 'Ressource sehen',
        });
        expect(device!.grants.find((g) => g.authId === AUTH.resourceView)?.dataId).toEqual([2]);
    });

    it('gives the device every room in one entry when appointments show theirs (Plan.md 50)', () => {
        const [, v] = planProvisioning({ ...input, appointmentRooms: true, roomIds: [1, 2, 3], usedRoomIds: [2, 7] });
        const entries = v!.grants.filter((g) => g.authId === AUTH.resourceView);
        expect(entries).toEqual([{ authId: 205, dataId: [1, 2, 3, 7], label: 'Ressource sehen' }]);
        // No rooms visible at all: nothing to add.
        const [, none] = planProvisioning({ ...input, appointmentRooms: true, roomIds: [], usedRoomIds: [] });
        expect(none!.grants.some((g) => g.authId === AUTH.resourceView)).toBe(false);
    });

    it('gives the device the events of the calendars that show services – and only then (Plan.md 51)', () => {
        expect(device!.grants.some((g) => g.authId === AUTH.eventView)).toBe(false);
        expect(designer!.grants.some((g) => g.authId === AUTH.eventView)).toBe(false);
        const [d, v] = planProvisioning({ ...input, serviceCalendarIds: [5] });
        expect(v!.grants.find((g) => g.authId === AUTH.eventView)).toEqual({
            authId: 306,
            dataId: [5],
            label: 'Events von einzelnen Kalendern sehen',
        });
        expect(d!.grants.some((g) => g.authId === AUTH.eventView)).toBe(false);
    });

    it('gives nobody "Ressourcen sehen" (201) – the right per room is enough (G45)', () => {
        const ids = [...designer!.grants, ...device!.grants].map((g) => g.authId);
        expect(ids).not.toContain(201);
    });

    it('asks for no room right where there are no rooms: none for designers, none for devices before a screen shows one', () => {
        const [d, v] = planProvisioning({ ...input, roomIds: [], usedRoomIds: [] });
        expect(d!.grants.some((g) => g.authId === AUTH.resourceView)).toBe(false);
        expect(v!.grants.some((g) => g.authId === AUTH.resourceView)).toBe(false);
        const [, v2] = planProvisioning({ ...input, usedRoomIds: [] });
        expect(v2!.grants.some((g) => g.authId === AUTH.resourceView)).toBe(false);
    });

    it('gives nobody the right to create, edit or delete categories', () => {
        const ids = [...designer!.grants, ...device!.grants].map((g) => g.authId);
        expect(ids).not.toContain(2012);
        expect(ids).not.toContain(2013);
        expect(ids).not.toContain(2014);
    });

    it('asks for no calendar right, and no wiki category before it exists', () => {
        const [d, v] = planProvisioning({ ...input, wikiCategoryId: null });
        expect(d!.grants.some((g) => g.authId === AUTH.wikiCategoryEdit)).toBe(false);
        expect(d!.grants.some((g) => g.authId === AUTH.calendarView)).toBe(false);
        expect(v!.grants.some((g) => g.authId === AUTH.calendarView)).toBe(false);
    });

    it('refuses to plan when the catalogue does not know the module', () => {
        expect(() => planProvisioning({ ...input, moduleKey: 'other' })).toThrow(MissingAuthError);
    });
});

describe('planProvisioning with the status category (Plan.md 59)', () => {
    const [designer, device] = planProvisioning({ ...input, categories: { ...categories, status: 22 } });

    it('lets everyone see it, as the other categories', () => {
        expect(designer!.grants.find((g) => g.label === 'Kategorien sehen')?.dataId).toEqual([1, 4, 7, 10, 13, 22]);
        expect(device!.grants.find((g) => g.label === 'Daten in Kategorie sehen')?.dataId).toEqual([1, 4, 7, 10, 13, 22]);
    });

    it('lets a device create and edit there – and nowhere else, and never delete', () => {
        const writing = device!.grants.filter((g) => [2016, 2017, 2018].includes(g.authId));
        expect(writing.map((g) => [g.authId, g.dataId])).toEqual([
            [2016, [22]],
            [2017, [22]],
        ]);
    });

    it('gives designers only the seeing, and still forbids devices the writing of screens and settings', () => {
        expect(designer!.grants.find((g) => g.authId === 2017)?.dataId).toEqual([4, 7, 10]);
        expect(designer!.grants.find((g) => g.authId === 2016)?.dataId).toEqual([4, 7, 10]);
        expect(device!.forbidden[0]?.dataId).toEqual([1, 13]);
    });

    it('plans as before without it', () => {
        const [, without] = planProvisioning(input);
        expect(without!.grants.map((g) => g.authId).sort((a, b) => a - b)).toEqual([205, 502, 2010, 2011, 2015]);
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
            ...peopleStubs(calls),
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

const held = (authId: number, dataId: number | null, type?: string) => ({ authId, dataId, ...(type ? { type } : {}) });
const pairs = (items: RefreshItem[]) => items.map((i) => `${i.authId}:${i.dataId}`);

describe('planRefresh (Plan.md 62)', () => {
    const plan = planProvisioning(input); // device: no 403; 205 for 2; designer: 205 for 1, 2, 3
    const known = { calendarIds: [1, 2, 3, 4, 5], roomIds: [1, 2, 3, 4] };
    const device = (grants: ReturnType<typeof held>[][], k = known) => planRefresh(plan, { device: grants }, k).find((g) => g.key === 'device')!;

    it('takes back a right for a calendar or room no screen needs any more – as far as the administrator sees it', () => {
        const result = device([[held(403, 3), held(403, 4), held(306, 1), held(205, 4), held(205, 2)]]);
        expect(pairs(result.remove)).toEqual(['403:3', '403:4', '306:1', '205:4']);
    });

    it('takes back a calendar right the device still holds from before – always, for a calendar the administrator sees (Plan.md 73)', () => {
        const result = device([[held(403, 3)]]);
        expect(pairs(result.remove)).toEqual(['403:3']);
        expect(result.add.some((i) => i.authId === AUTH.calendarView)).toBe(false);
    });

    it('names what falls away with the right and the name of the calendar or room', () => {
        const names = { calendars: new Map([[3, 'Jugend']]), rooms: new Map([[4, 'Saal']]) };
        const result = planRefresh(plan, { device: [[held(403, 3), held(205, 4), held(306, 9)]] }, { calendarIds: [3], roomIds: [4] }, names);
        expect(result.find((g) => g.key === 'device')!.remove.map((i) => i.label)).toEqual(['Einzelnen Kalender sehen: Jugend', 'Ressource sehen: Saal']);
    });

    it('lists what is planned but missing on at least one role – each pair once', () => {
        const result = device([
            [held(205, 2)],
            [], // the second role lacks room 2
        ]);
        expect(pairs(result.add).filter((p) => p === '205:2')).toHaveLength(1);
    });

    it('lists a right without data as missing with a null data id', () => {
        const result = device([[]]);
        expect(result.add.find((i) => i.dataId === null)).toBeTruthy();
    });

    it('leaves an id the administrator does not see', () => {
        const result = device([[held(403, 99), held(306, 98)]]);
        expect(result.remove).toEqual([]);
    });

    it('leaves rights the assistant does not manage, e.g. 502 for another wiki category', () => {
        const result = device([[held(502, 7), held(403, 3)]]);
        expect(pairs(result.remove)).toEqual(['403:3']);
    });

    it('takes a calendar right from the designers, too – but not the events right (306), which only devices get', () => {
        const result = planRefresh(plan, { designer: [[held(403, 3), held(306, 3), held(205, 4)]] }, known).find((g) => g.key === 'designer')!;
        expect(pairs(result.remove)).toEqual(['403:3', '205:4']);
    });

    it('takes no room when the list of rooms is empty, e.g. after a failed load', () => {
        const result = planRefresh(plan, { device: [[held(205, 4)]], designer: [[held(205, 4)]] }, { calendarIds: known.calendarIds, roomIds: [] });
        expect(result.flatMap((g) => g.remove)).toEqual([]);
    });

    it('still takes back the writing rights on screens and settings, one data id at a time', () => {
        const result = planRefresh(plan, { designer: [[held(2017, 1), held(2017, 4), held(2016, 4), held(2016, 13)]] }, known).find((g) => g.key === 'designer')!;
        expect(pairs(result.remove)).toEqual(['2016:13', '2017:1']);
    });

    it('counts only assignments of type grant', () => {
        const result = device([[held(403, 3, 'revoke'), held(2017, 1, 'revoke')]]);
        expect(result.remove).toEqual([]);
    });

    it('lists each pair once, however many roles hold it', () => {
        const result = device([[held(403, 3)], [held(403, 3)]]);
        expect(pairs(result.remove)).toEqual(['403:3']);
    });
});

describe('released calendars (Plan.md 85 b)', () => {
    const plan = planProvisioning({ ...input, screenCalendarIds: [3, 4] });
    const known = { calendarIds: [1, 2, 3, 4, 5], roomIds: [] };
    const refresh = (key: 'device' | 'designer', grants: ReturnType<typeof held>[][]) => planRefresh(plan, { [key]: grants }, known).find((g) => g.key === key)!;

    it('gives device and designers "Einzelnen Kalender sehen" on exactly these calendars', () => {
        for (const spec of plan) expect(spec.grants.find((g) => g.authId === AUTH.calendarView)?.dataId).toEqual([3, 4]);
    });

    it('asks for what is missing on both groups', () => {
        expect(pairs(refresh('device', [[]]).add)).toEqual(expect.arrayContaining(['403:3', '403:4']));
        expect(pairs(refresh('designer', [[]]).add)).toEqual(expect.arrayContaining(['403:3', '403:4']));
    });

    it('takes the right back from both groups once the release ends – only for calendars the administrator sees', () => {
        const ended = planProvisioning({ ...input, screenCalendarIds: [] });
        for (const key of ['device', 'designer'] as const) {
            const result = planRefresh(ended, { [key]: [[held(403, 3), held(403, 99)]] }, known).find((g) => g.key === key)!;
            expect(pairs(result.remove)).toEqual(['403:3']);
        }
    });

    it('keeps the right while the release stands', () => {
        expect(refresh('device', [[held(403, 3)]]).remove).toEqual([]);
        expect(refresh('designer', [[held(403, 4)]]).remove).toEqual([]);
    });

    it('asks nothing for calendars when none is released', () => {
        const [d, v] = planProvisioning({ ...input, screenCalendarIds: [] });
        expect(d!.grants.some((g) => g.authId === AUTH.calendarView)).toBe(false);
        expect(v!.grants.some((g) => g.authId === AUTH.calendarView)).toBe(false);
    });
});

describe('readRefresh and applyRefresh', () => {
    const known = { calendarIds: [3, 4, 5], roomIds: [1, 2, 3] };
    function fakeApi() {
        const calls: string[] = [];
        const api: ProvisionApi = {
            createGroup: async () => {
                throw new Error('must not create');
            },
            roleIds: async (groupId) => [groupId * 10, groupId * 10 + 1],
            grant: async (roleId, authId, dataId) => {
                calls.push(`grant ${roleId}:${authId}:${dataId?.join(',') ?? ''}`);
            },
            grants: async (roleId) => (roleId === 280 ? [held(403, 3), held(403, 4)] : [held(403, 4)]),
            revoke: async (roleId, authId, dataId) => {
                calls.push(`revoke ${roleId}:${authId}:${dataId.join(',')}`);
            },
            ...peopleStubs(calls),
        };
        return { api, calls };
    }

    it('reads only the groups the assistant created and writes nothing', async () => {
        const { api, calls } = fakeApi();
        const state = await readRefresh(planProvisioning(input), { device: 28 }, known, {}, api);
        expect(state.groups.map((g) => g.key)).toEqual(['device']);
        expect(calls).toEqual([]);
    });

    it('grants the plan to every role and takes back each right from the roles that hold it', async () => {
        const { api, calls } = fakeApi();
        const plan = planProvisioning(input);
        const state = await readRefresh(plan, { device: 28 }, known, {}, api);
        const result = await applyRefresh(plan, state, api);
        expect(result.error).toBeNull();
        expect(calls).toContain('grant 280:205:2');
        expect(calls.filter((c) => c.startsWith('revoke'))).toEqual(['revoke 280:403:3', 'revoke 280:403:4', 'revoke 281:403:4']);
        expect(calls.every((c) => c.includes(' 28'))).toBe(true);
        expect(result.log).toEqual(['„Infoscreen-Devices": 13 Rechte vergeben, 2 zurückgenommen.']);
    });

    it('says a group is up to date when nothing differs', async () => {
        const plan = planProvisioning(input);
        const api: ProvisionApi = {
            createGroup: async () => 1,
            roleIds: async () => [280],
            grant: async () => {},
            grants: async () => plan[1]!.grants.flatMap((g) => (g.dataId ?? [null]).map((d) => held(g.authId, d))),
            revoke: async () => {},
            ...peopleStubs([]),
        };
        const state = await readRefresh(plan, { device: 28 }, known, {}, api);
        expect(refreshIsEmpty(state.groups)).toBe(true);
        expect((await applyRefresh(plan, state, api)).log).toEqual(['Rechte von „Infoscreen-Devices" sind auf dem Stand.']);
    });

    it('stops at the first failure and says so', async () => {
        const { api } = fakeApi();
        api.revoke = async () => {
            throw new Error('Forbidden');
        };
        const plan = planProvisioning(input);
        const result = await applyRefresh(plan, await readRefresh(plan, { device: 28 }, known, {}, api), api);
        expect(result.error).toBe('Forbidden');
        expect(result.log.at(-1)).toContain('Abgebrochen');
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
    it('names both manual steps left after a clean removal: the extension, then the device accounts and wiki area', () => {
        expect(REMOVE_SETUP_NEXT_STEPS_LOG_LINE).toContain('Extension-Verwaltung');
        expect(REMOVE_SETUP_NEXT_STEPS_LOG_LINE).toContain('Gerätekonten');
        expect(REMOVE_SETUP_NEXT_STEPS_LOG_LINE).toContain('Wiki-Bereich');
    });
});

describe('devicePasswordRecommendationLogLine (G18: a login token is only invalidated by a password change)', () => {
    it('names every collected account, comma-separated, with the recommendation', () => {
        expect(devicePasswordRecommendationLogLine(['Minimal User', 'Infoscreen Foyer'])).toBe(
            'Passwörter ändern empfohlen für: Minimal User, Infoscreen Foyer – dann funktionieren die Adressen der Bildschirme nicht mehr.',
        );
    });
});

describe('planProvisioning with the drafts category (Plan.md 79)', () => {
    const [designer, device] = planProvisioning({ ...input, categories: { ...categories, drafts: 28 } });
    const [plainDesigner, plainDevice] = planProvisioning(input);

    it('gives designers the five rights on it', () => {
        expect(designer!.grants.find((g) => g.label === 'Kategorien sehen')?.dataId).toEqual([1, 4, 7, 10, 13, 28]);
        expect(designer!.grants.find((g) => g.label === 'Daten in Kategorie sehen')?.dataId).toEqual([1, 4, 7, 10, 13, 28]);
        for (const authId of [2016, 2017, 2018]) {
            expect(designer!.grants.find((g) => g.authId === authId)?.dataId).toEqual([4, 7, 10, 28]);
        }
    });

    it('gives a device nothing on it, not even the seeing', () => {
        const ids = device!.grants.flatMap((g) => g.dataId ?? []);
        expect(ids).not.toContain(28);
        expect(device!.grants.find((g) => g.label === 'Kategorien sehen')?.dataId).toEqual([1, 4, 7, 10, 13]);
    });

    it('stays as it was without it', () => {
        const [d, v] = planProvisioning({ ...input, categories });
        expect(d).toEqual(plainDesigner);
        expect(v).toEqual(plainDevice);
        expect(plainDesigner!.grants.flatMap((g) => g.dataId ?? [])).not.toContain(28);
    });
});

describe('planProvisioning with the changelog category (Plan.md 100)', () => {
    const [designer, device] = planProvisioning({ ...input, categories: { ...categories, drafts: 28, changelog: 31 } });
    const [plainDesigner, plainDevice] = planProvisioning(input);

    it('gives designers seeing and adding, but neither editing nor deleting', () => {
        for (const authId of [2011, 2015]) {
            expect(designer!.grants.find((g) => g.authId === authId)?.dataId).toEqual([1, 4, 7, 10, 13, 28, 31]);
        }
        expect(designer!.grants.find((g) => g.authId === 2016)?.dataId).toEqual([4, 7, 10, 28, 31]);
        for (const authId of [2017, 2018]) {
            expect(designer!.grants.find((g) => g.authId === authId)?.dataId).toEqual([4, 7, 10, 28]);
        }
    });

    it('gives a device nothing on it', () => {
        expect(device!.grants.flatMap((g) => g.dataId ?? [])).not.toContain(31);
    });

    it('stays as it was without it', () => {
        const [d, v] = planProvisioning({ ...input, categories });
        expect(d).toEqual(plainDesigner);
        expect(v).toEqual(plainDevice);
    });
});

describe('the people group (Plan.md 112, G70)', () => {
    const withPeople = { ...input, peopleGroupId: 'new' as const };

    it('is the third group, and the device sees exactly it (1104) – without a group id before it exists', () => {
        const plan = planProvisioning(withPeople);
        expect(plan.map((g) => g.key)).toEqual(['designer', 'device', 'people']);
        expect(plan[2]!.name).toBe(GROUP_NAMES.people);
        const seen = plan[1]!.grants.find((g) => g.authId === AUTH.groupWithMembersView)!;
        expect(seen.dataGroup).toBe('people');
        expect(seen.dataId).toBeUndefined();
        // The assistant grants nothing within the group: 10126 is the administrator's (G73).
        expect(plan[2]!.grants).toEqual([]);
        expect(plan[2]!.membersFrom).toBe('device');
        expect(plan[0]!.grants.some((g) => g.authId === AUTH.groupWithMembersView)).toBe(false);
    });

    it('names the group by its id once it exists, and leaves everything out where there is none', () => {
        const device = planProvisioning({ ...input, peopleGroupId: 77 })[1]!;
        expect(device.grants.find((g) => g.authId === AUTH.groupWithMembersView)).toMatchObject({ dataId: [77] });
        expect(planProvisioning(input).map((g) => g.key)).toEqual(['designer', 'device']);
    });

    it('gives the device group 1104 for each released group in the same entry as the people group, and touches the released group not at all (Stück 2a)', () => {
        const numeric = planProvisioning({ ...input, peopleGroupId: 77, peopleGroupIds: [51, 52] });
        const seen = numeric[1]!.grants.filter((g) => g.authId === AUTH.groupWithMembersView);
        expect(seen).toHaveLength(1);
        expect(seen[0]).toMatchObject({ dataId: [77, 51, 52] });
        expect(numeric.map((g) => g.key)).toEqual(['designer', 'device', 'people']);
        const created = planProvisioning({ ...withPeople, peopleGroupIds: [51] })[1]!.grants.find((g) => g.authId === AUTH.groupWithMembersView)!;
        expect(created).toMatchObject({ dataGroup: 'people', dataId: [51] });
        // Without a people group the released ones stand alone; no group of theirs is in the plan.
        const alone = planProvisioning({ ...input, peopleGroupIds: [51] });
        expect(alone.map((g) => g.key)).toEqual(['designer', 'device']);
        expect(alone[1]!.grants.find((g) => g.authId === AUTH.groupWithMembersView)).toMatchObject({ dataId: [51] });
        expect(planProvisioning({ ...input, peopleGroupId: 77, peopleGroupIds: [51] }).flatMap((g) => g.grants.map((x) => x.authId))).not.toContain(10126);
    });

    it('sets 1104 when the release is saved: new ones added to what the role holds, withdrawn ones taken back, a hand-given one kept', async () => {
        const calls: string[] = [];
        const api = {
            roleIds: async () => [5],
            grants: async () => [held(AUTH.groupWithMembersView, 77), held(AUTH.groupWithMembersView, 51), held(AUTH.groupWithMembersView, 99)],
            grant: async (roleId: number, authId: number, dataId?: number[]) => void calls.push(`grant ${roleId} ${authId} ${dataId?.join(',')}`),
            revoke: async (roleId: number, authId: number, dataId: number[]) => void calls.push(`revoke ${roleId} ${authId} ${dataId.join(',')}`),
        };
        await applyPeopleRelease(10, [51], [60], api);
        expect(calls).toEqual(['grant 5 1104 77,99,60', 'revoke 5 1104 51']);
        calls.length = 0;
        expect(await applyPeopleRelease(10, [51], [51], api)).toEqual([]);
        expect(calls).toEqual([]);
    });

    it('takes back 1104 only for the groups released before and not any more – the people group and a 1104 given by hand stay', () => {
        const plan = planProvisioning({ ...input, peopleGroupId: 77, peopleGroupIds: [51] });
        const held = [[{ authId: AUTH.groupWithMembersView, dataId: 77 }, { authId: AUTH.groupWithMembersView, dataId: 51 }, { authId: AUTH.groupWithMembersView, dataId: 52 }, { authId: AUTH.groupWithMembersView, dataId: 99 }]];
        const names = { groups: new Map([[52, 'Alte Gruppe']]) };
        const change = planRefresh(plan, { device: held }, { calendarIds: [], roomIds: [], groupIds: [52] }, names).find((g) => g.key === 'device')!;
        expect(change.remove).toEqual([{ authId: AUTH.groupWithMembersView, dataId: 52, label: 'Freigegebene Gruppe inkl. ihrer Gruppenmitglieder sehen: Alte Gruppe' }]);
        // Nothing withdrawn: nothing is taken back, whatever else is held.
        expect(planRefresh(plan, { device: held }, { calendarIds: [], roomIds: [] }, names).find((g) => g.key === 'device')!.remove).toEqual([]);
        // A missing one is added under the name of the released group.
        const missing = planRefresh(plan, { device: [[{ authId: AUTH.groupWithMembersView, dataId: 77 }]] }, { calendarIds: [], roomIds: [], groupIds: [] }, { groups: new Map([[51, 'Mitarbeiter']]) }).find((g) => g.key === 'device')!;
        expect(missing.add.find((a) => a.dataId === 51)?.label).toBe('Freigegebene Gruppe inkl. ihrer Gruppenmitglieder sehen: Mitarbeiter');
    });

    it('never plans 125 or 10101 – the administrator sets 125 in ChurchTools (G73), and both open the e-mail address', () => {
        const all = planProvisioning(withPeople).flatMap((g) => g.grants).map((g) => g.authId);
        expect(all).not.toContain(125);
        expect(all).not.toContain(10101);
    });

    function fakeApi(members: Record<number, number[]> = {}) {
        const calls: string[] = [];
        let nextGroup = 30;
        const api: ProvisionApi = {
            createGroup: async (name) => {
                calls.push(`create ${name}`);
                return nextGroup++;
            },
            roleIds: async (groupId) => [groupId * 10, groupId * 10 + 1],
            grant: async (roleId, authId, dataId) => {
                calls.push(`grant ${roleId} ${authId}${dataId ? ` [${dataId.join(',')}]` : ''}`);
            },
            grants: async () => [],
            revoke: async () => {},
            ...peopleStubs(calls, members),
        };
        return { api, calls };
    }

    it('creates the people group first, so that the device can be given the right on its id', async () => {
        const { api, calls } = fakeApi();
        const result = await provision(planProvisioning(withPeople), 4, api);
        expect(result.error).toBeNull();
        expect(result.groupIds).toEqual({ people: 30, designer: 31, device: 32 });
        expect(calls.filter((c) => c.startsWith('create'))).toEqual(['create Infoscreen-People', 'create Infoscreen-Designer', 'create Infoscreen-Devices']);
        // On both roles of the device group, as an array, with the id of the group just created.
        expect(calls).toContain('grant 320 1104 [30]');
        expect(calls).toContain('grant 321 1104 [30]');
        // The assistant never grants the member fields (G73).
        expect(calls.filter((c) => c.includes(' 10126'))).toEqual([]);
    });

    it('refreshes an existing instance: grants the missing rights and puts the devices into the group', async () => {
        const members = { 12: [5, 6], 40: [5] };
        const { api, calls } = fakeApi(members);
        const plan = planProvisioning({ ...input, peopleGroupId: 40 });
        const state = await readRefresh(plan, { device: 12, people: 40 }, { calendarIds: [], roomIds: [] }, {}, api);
        const people = state.groups.find((g) => g.key === 'people')!;
        expect(people.add).toEqual([]);
        const result = await applyRefresh(plan, state, api);
        expect(result.error).toBeNull();
        expect(calls).toContain('grant 121 1104 [40]');
        expect(calls.filter((c) => c.includes(' 10126'))).toEqual([]);
        // Person 5 is in already; only 6 is added, in the default role of the people group.
        expect(calls.filter((c) => c.startsWith('member'))).toEqual(['member 40 6 940']);
        expect(result.log).toContain('1 Gerät in „Infoscreen-People" aufgenommen.');
    });

    it('does not plan the right of a group that is not created yet, when a refresh runs', async () => {
        const { api, calls } = fakeApi();
        const plan = planProvisioning(withPeople);
        const state = await readRefresh(plan, { device: 12 }, { calendarIds: [], roomIds: [] }, {}, api);
        await applyRefresh(plan, state, api);
        expect(calls.some((c) => c.includes(' 1104'))).toBe(false);
    });
});

describe('the people group: device list, refresh and retrofit (Plan.md 112)', () => {
    const withPeople = { ...input, peopleGroupId: 'new' as const };
    function fakeApi(members: Record<number, number[]> = {}) {
        const calls: string[] = [];
        let nextGroup = 40;
        const api: ProvisionApi = {
            createGroup: async (name) => {
                calls.push(`create ${name}`);
                return nextGroup++;
            },
            roleIds: async (groupId) => [groupId * 10, groupId * 10 + 1],
            grant: async (roleId, authId, dataId) => {
                calls.push(`grant ${roleId} ${authId}${dataId ? ` [${dataId.join(',')}]` : ''}`);
            },
            grants: async () => [],
            revoke: async () => {
                throw new Error('must not revoke');
            },
            ...peopleStubs(calls, members),
        };
        return { api, calls };
    }

    it('retrofits the group alone: creates it, puts the devices in, gives the device roles 1104', async () => {
        const { api, calls } = fakeApi({ 12: [5, 6] });
        const result = await provisionPeople(planProvisioning(withPeople), 4, 12, api);
        expect(result.error).toBeNull();
        expect(result.groupIds).toEqual({ people: 40 });
        expect(result.deviceIds).toEqual([5, 6]);
        expect(calls).toEqual([
            'create Infoscreen-People',
            'member 40 5 940',
            'member 40 6 940',
            'grant 120 1104 [40]',
            'grant 121 1104 [40]',
        ]);
    });

    it('stops the retrofit where the group cannot be created, and writes nothing else', async () => {
        const { api, calls } = fakeApi();
        api.createGroup = async () => {
            throw new Error('Forbidden');
        };
        const result = await provisionPeople(planProvisioning(withPeople), 4, 12, api);
        expect(result.error).toBe('Forbidden');
        expect(calls).toEqual([]);
    });

    it('lists a device missing in the group as a change of its own – a refresh with nothing else to do is not empty', async () => {
        const plan = planProvisioning({ ...input, peopleGroupId: 40 });
        const { api } = fakeApi({ 12: [5, 6], 40: [5] });
        // The rights are all there; only person 6 is missing in the group, and the stored list lacks it.
        api.grants = async () => plan.flatMap((s) => s.grants).flatMap((g) => (g.dataId ?? [null]).map((d) => held(g.authId, d)));
        const state = await readRefresh(plan, { device: 12, people: 40 }, { calendarIds: [], roomIds: [] }, {}, api, [5]);
        const people = state.groups.find((g) => g.key === 'people')!;
        expect(people.add).toEqual([]);
        expect(people.extras).toHaveLength(2);
        expect(refreshIsEmpty(state.groups)).toBe(false);
        expect(state.deviceIds).toEqual([5, 6]);
    });

    it('is empty when the devices are in and the stored list is the same', async () => {
        const plan = planProvisioning({ ...input, peopleGroupId: 40 });
        const { api } = fakeApi({ 12: [5, 6], 40: [6, 5] });
        api.grants = async () => plan.flatMap((s) => s.grants).flatMap((g) => (g.dataId ?? [null]).map((d) => held(g.authId, d)));
        const state = await readRefresh(plan, { device: 12, people: 40 }, { calendarIds: [], roomIds: [] }, {}, api, [5, 6]);
        expect(refreshIsEmpty(state.groups)).toBe(true);
    });

    it('hands the current device accounts back after a refresh, for the settings', async () => {
        const plan = planProvisioning({ ...input, peopleGroupId: 40 });
        const { api } = fakeApi({ 12: [5, 6], 40: [5] });
        const state = await readRefresh(plan, { device: 12, people: 40 }, { calendarIds: [], roomIds: [] }, {}, api);
        expect((await applyRefresh(plan, state, api)).deviceIds).toEqual([5, 6]);
    });
});

describe('log lines and finishing a retrofit (Plan.md 112)', () => {
    const withPeople = { ...input, peopleGroupId: 'new' as const };
    function fakeApi(members: Record<number, number[]> = {}) {
        const calls: string[] = [];
        let nextGroup = 40;
        const api: ProvisionApi = {
            createGroup: async () => nextGroup++,
            roleIds: async (groupId) => [groupId * 10, groupId * 10 + 1],
            grant: async (roleId, authId, dataId) => {
                calls.push(`grant ${roleId} ${authId}${dataId ? ` [${dataId.join(',')}]` : ''}`);
            },
            grants: async () => [],
            revoke: async () => {},
            ...peopleStubs(calls, members),
        };
        return { api, calls };
    }

    it('counts what was granted and says it in the right number: "1 Recht an 1 Rolle", "1 Recht an 2 Rollen"', async () => {
        const { api } = fakeApi();
        const result = await provisionPeople(planProvisioning(withPeople), 4, 12, api);
        expect(result.log).toContain('1 Recht an 2 Rollen von „Infoscreen-Devices" vergeben.');
        expect(result.log.some((line) => line.startsWith('0 Rechte'))).toBe(false);
        const all = await provision(planProvisioning(withPeople), 4, fakeApi().api);
        expect(all.log.some((line) => line.startsWith('0 Rechte'))).toBe(false);
    });

    it('finishes a stopped retrofit: grants again, puts in only the devices that are not in, creates no group', async () => {
        const { api, calls } = fakeApi({ 12: [5, 6], 40: [5] });
        const result = await completePeople(planProvisioning(withPeople), 40, 12, api);
        expect(result.error).toBeNull();
        expect(result.groupIds).toEqual({ people: 40 });
        expect(result.deviceIds).toEqual([5, 6]);
        expect(calls).toEqual(['member 40 6 940', 'grant 120 1104 [40]', 'grant 121 1104 [40]']);
        expect(result.log).toContain('1 Gerät in „Infoscreen-People" aufgenommen.');
    });
});

describe('orphanPeopleGroup (Plan.md 112)', () => {
    const group = (id: number, name = 'Infoscreen-People', statusId: number | null = 1) => ({ id, name, statusId });
    const sees = (id: number) => [[held(1104, id)], [held(1104, id)]];

    it('recognises the one active group the device group can see – and nothing else', () => {
        expect(orphanPeopleGroup([group(40), group(7, 'Hauskreis')], [12], sees(40))).toBe(40);
    });

    it('leaves a foreign group alone: not seen by the device group, not active, not alone, or already recorded', () => {
        expect(orphanPeopleGroup([group(40)], [12], [[held(1104, 99)], []])).toBeNull();
        expect(orphanPeopleGroup([group(40)], [12], [[held(403, 40)]])).toBeNull();
        expect(orphanPeopleGroup([group(40, 'Infoscreen-People', 2)], [12], sees(40))).toBeNull();
        expect(orphanPeopleGroup([group(40), group(41)], [12], sees(40))).toBeNull();
        expect(orphanPeopleGroup([group(40)], [12, 40], sees(40))).toBeNull();
        expect(orphanPeopleGroup([], [12], sees(40))).toBeNull();
    });
});

describe('posts off in the groups of the devices and the people (Plan.md 112, G71)', () => {
    const withPeople = { ...input, peopleGroupId: 'new' as const };
    const keys = (plan: ReturnType<typeof planProvisioning>) => plan.filter((g) => g.postsOff).map((g) => g.key);

    function fakeApi(posts: Record<number, boolean>, members: Record<number, number[]> = {}) {
        const calls: string[] = [];
        let nextGroup = 40;
        const api: ProvisionApi = {
            createGroup: async () => nextGroup++,
            roleIds: async (groupId) => [groupId * 10, groupId * 10 + 1],
            grant: async (roleId, authId) => {
                calls.push(`grant ${roleId} ${authId}`);
            },
            grants: async () => [],
            revoke: async () => {},
            ...peopleStubs(calls, members, posts),
        };
        return { api, calls };
    }

    it('plans it for the devices and the people, never for the designers', () => {
        expect(keys(planProvisioning(withPeople))).toEqual(['device', 'people']);
        expect(keys(planProvisioning(input))).toEqual(['device']);
    });

    it('switches posts off in each new group and says so in the log', async () => {
        const posts: Record<number, boolean> = { 40: true, 41: true, 42: true };
        const { api } = fakeApi(posts);
        const result = await provision(planProvisioning(withPeople), 4, api);
        // The people group is created first (40), then the designers (41) and the devices (42).
        expect(posts).toEqual({ 40: false, 41: true, 42: false });
        expect(result.log).toContain('Beiträge in „Infoscreen-People" abgeschaltet.');
        expect(result.log).toContain('Beiträge in „Infoscreen-Devices" abgeschaltet.');
    });

    it('switches them off when a retrofit is finished, but only if they are still on', async () => {
        const posts: Record<number, boolean> = { 40: true };
        const { api } = fakeApi(posts, { 12: [5] });
        const result = await completePeople(planProvisioning(withPeople), 40, 12, api);
        expect(posts[40]).toBe(false);
        expect(result.log).toContain('Beiträge in „Infoscreen-People" abgeschaltet.');
        const again = await completePeople(planProvisioning(withPeople), 40, 12, api);
        expect(again.log.some((line) => line.includes('Beiträge'))).toBe(false);
    });

    it('lets a refresh switch them off where they are on – as a line of the preview, not as an empty refresh', async () => {
        const plan = planProvisioning({ ...input, peopleGroupId: 40 });
        const posts: Record<number, boolean> = { 12: true, 40: false };
        const { api } = fakeApi(posts, { 12: [5], 40: [5] });
        api.grants = async () => plan.flatMap((s) => s.grants).flatMap((g) => (g.dataId ?? [null]).map((d) => held(g.authId, d)));
        const state = await readRefresh(plan, { device: 12, people: 40 }, { calendarIds: [], roomIds: [] }, {}, api, [5]);
        expect(state.groups.find((g) => g.key === 'device')!.extras).toEqual(['Beiträge in „Infoscreen-Devices" werden abgeschaltet']);
        expect(state.groups.find((g) => g.key === 'people')!.extras).toBeUndefined();
        expect(refreshIsEmpty(state.groups)).toBe(false);
        await applyRefresh(plan, state, api);
        expect(posts).toEqual({ 12: false, 40: false });
        const after = await readRefresh(plan, { device: 12, people: 40 }, { calendarIds: [], roomIds: [] }, {}, api, [5]);
        expect(refreshIsEmpty(after.groups)).toBe(true);
    });

    it('never touches a group the administrator chose: a refresh reads only the groups of the assistant', async () => {
        const plan = planProvisioning({ ...input, peopleGroupId: 40 });
        const posts: Record<number, boolean> = { 99: true };
        const { api } = fakeApi(posts);
        const state = await readRefresh(plan, { designer: 7 }, { calendarIds: [], roomIds: [] }, {}, api);
        await applyRefresh(plan, state, api);
        expect(posts).toEqual({ 99: true });
        expect(state.postsOn).toEqual([]);
    });
});
