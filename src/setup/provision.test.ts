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
    planRefresh,
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

    it('takes no calendar from the designers – they manage only rooms (205)', () => {
        const result = planRefresh(plan, { designer: [[held(403, 3), held(306, 3), held(205, 4)]] }, known).find((g) => g.key === 'designer')!;
        expect(pairs(result.remove)).toEqual(['205:4']);
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
