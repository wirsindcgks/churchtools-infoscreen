import { describe, expect, it } from 'vitest';
import { AUTH, checkDesignerGroup, checkDeviceGroup, checkStatus, excessRights, groupChecks, has, scopeExcess, ALL_DATA, type Check, type DeviceMember, type Grant, type OtherGroup, type RoleRights } from './checks';
import { PUBLIC_CALENDAR_PATH } from '../ct/api';

const grant = (authId: number, dataId: number | null = null): Grant => ({ authId, dataId, type: 'grant' });
const WIKI = 1;
const designerGrants = [grant(AUTH.wikiView), grant(AUTH.wikiCategoryView, WIKI), grant(AUTH.wikiCategoryEdit, WIKI)];
const role = (overrides: Partial<RoleRights> = {}): RoleRights => ({
    name: 'Mitarbeiter',
    grants: designerGrants,
    memberCount: 2,
    isDefault: true,
    ...overrides,
});

describe('has', () => {
    it('matches one data id, all data (-1), or the right at all', () => {
        expect(has([grant(403, 4)], 403, 4)).toBe(true);
        expect(has([grant(403, 4)], 403, 5)).toBe(false);
        expect(has([grant(403, -1)], 403, 5)).toBe(true);
        expect(has([grant(501)], 501)).toBe(true);
    });

    it('lets a revocation win over a grant', () => {
        expect(has([grant(403, 4), { authId: 403, dataId: 4, type: 'revoke' }], 403, 4)).toBe(false);
    });
});

describe('checkStatus', () => {
    it('knows that rights work while active or finished, not as a draft or archived (Academy)', () => {
        expect(checkStatus(1).level).toBe('ok');
        expect(checkStatus(4).level).toBe('warn');
        expect(checkStatus(2).level).toBe('fail');
        expect(checkStatus(3).level).toBe('fail');
    });
});

describe('checkDesignerGroup', () => {
    it('is content with an active group whose members may upload to the media library', () => {
        const checks = checkDesignerGroup({ statusId: 1, roles: [role()], wikiCategoryId: WIKI });
        expect(checks.filter((c) => c.level === 'fail' || c.level === 'warn')).toEqual([]);
    });

    it('names the role and the wiki rights it lacks', () => {
        const checks = checkDesignerGroup({
            statusId: 1,
            roles: [role({ name: 'Leiter', grants: [grant(AUTH.wikiView)] })],
            wikiCategoryId: WIKI,
        });
        const fail = checks.find((c) => c.level === 'fail');
        expect(fail?.text).toContain('Leiter');
        expect(fail?.text).toContain('bearbeiten');
    });

    it('names the wiki area as it is called now – it may have been renamed (Plan.md 84)', () => {
        const checks = checkDesignerGroup({ statusId: 1, roles: [role({ grants: [] })], wikiCategoryId: WIKI, wikiCategoryName: 'Bilder Foyer' });
        expect(checks.find((c) => c.level === 'fail')?.text).toContain('Wiki-Bereich „Bilder Foyer" bearbeiten');
    });

    it('checks only roles that reach people: with members, else the default role', () => {
        const checks = checkDesignerGroup({
            statusId: 1,
            roles: [role({ memberCount: 2 }), role({ name: 'Coach', grants: [], memberCount: 0, isDefault: false })],
            wikiCategoryId: WIKI,
        });
        expect(checks.some((c) => c.text.includes('Coach'))).toBe(false);
    });

    it('explains a wiki category that does not exist yet instead of failing', () => {
        const checks = checkDesignerGroup({ statusId: 1, roles: [role()], wikiCategoryId: null });
        expect(checks.find((c) => c.text.includes('Wiki'))?.level).toBe('info');
    });

    it('warns when a role does not see every room – they would be missing in the block "Raumbelegung" (G45)', () => {
        const all = checkDesignerGroup({
            statusId: 1,
            roles: [role({ grants: [...designerGrants, grant(AUTH.resourceView, 1), grant(AUTH.resourceView, 2)] })],
            wikiCategoryId: WIKI,
            roomIds: [1, 2],
        });
        expect(all.some((c) => c.text.includes('Räume'))).toBe(false);
        const some = checkDesignerGroup({
            statusId: 1,
            roles: [role({ name: 'Leiter', grants: [...designerGrants, grant(AUTH.resourceView, 1)] })],
            wikiCategoryId: WIKI,
            roomIds: [1, 2],
        });
        expect(some.find((c) => c.text.includes('Räume'))).toMatchObject({ level: 'warn', text: 'Rolle „Leiter" sieht nicht alle Räume.' });
    });

    it('says nothing about rooms where there are none', () => {
        const checks = checkDesignerGroup({ statusId: 1, roles: [role()], wikiCategoryId: WIKI, roomIds: [] });
        expect(checks.some((c) => c.text.includes('Räume'))).toBe(false);
    });

    it('says the module rights wait for the installed extension', () => {
        const checks = checkDesignerGroup({ statusId: 1, roles: [role()], wikiCategoryId: WIKI });
        expect(checks.at(-1)).toMatchObject({ level: 'info' });
    });
});

describe('checkDeviceGroup', () => {
    const calendars = [
        { id: 2, name: 'Gottesdienst' },
        { id: 4, name: 'Gemeindeleitung' },
    ];

    it('warns without a device account, like an empty designer group – the next step, not a fault', () => {
        const checks = checkDeviceGroup({ statusId: 1, members: [], calendars, usedCalendarIds: [4], publicCalendarIds: [2], wikiCategoryId: WIKI });
        expect(checks.at(-1)).toMatchObject({ level: 'warn', text: 'Noch kein Geräte-Benutzer in der Gruppe.' });
    });

    it('names a public calendar in use as public – the device needs no right of its own (Plan.md 73, G53)', () => {
        const checks = checkDeviceGroup({
            statusId: 1,
            members: [{ label: 'Minimal User', grants: [] }],
            calendars,
            usedCalendarIds: [2],
            publicCalendarIds: [2],
            wikiCategoryId: WIKI,
        });
        expect(checks.find((c) => c.category === 'calendars')).toEqual({ level: 'ok', category: 'calendars', text: '„Gottesdienst" ist öffentlich.' });
    });

    it('shows the calendar section without a device account', () => {
        const checks = checkDeviceGroup({ statusId: 1, members: [], calendars, usedCalendarIds: [2, 4], publicCalendarIds: [2], wikiCategoryId: WIKI });
        expect(checks.filter((c) => c.category === 'calendars').map((c) => c.level)).toEqual(['ok', 'warn']);
        expect(checkDeviceGroup({ statusId: 1, members: [], calendars, usedCalendarIds: [], publicCalendarIds: [], wikiCategoryId: WIKI })).toContainEqual({
            level: 'info',
            category: 'calendars',
            text: 'Noch zeigt kein Bildschirm Termine.',
        });
    });

    it('names a public calendar the administrator does not see by its number', () => {
        const checks = checkDeviceGroup({ statusId: 1, members: [], calendars, usedCalendarIds: [9], publicCalendarIds: [9], wikiCategoryId: WIKI });
        expect(checks.find((c) => c.category === 'calendars')?.text).toBe('„Kalender 9" ist öffentlich.');
    });

    it('warns about a calendar in use that is not public – no TV shows it, and where to release it (Plan.md 73)', () => {
        const checks = checkDeviceGroup({
            statusId: 1,
            members: [{ label: 'Minimal User', grants: [] }],
            calendars,
            usedCalendarIds: [4],
            publicCalendarIds: [2],
            wikiCategoryId: WIKI,
        });
        expect(checks.find((c) => c.category === 'calendars' && c.text.includes('Gemeindeleitung'))).toEqual({
            level: 'warn',
            category: 'calendars',
            text: '„Gemeindeleitung" ist nicht öffentlich – kein Fernseher zeigt ihn.',
            detail: `Freigeben: ${PUBLIC_CALENDAR_PATH}. Oder im Editor aus dem Baustein entfernen.`,
        });
    });

    it('calls a released calendar in use fine, and an unreleased one still warns (Plan.md 85 b)', () => {
        const input = { statusId: 1, members: [], calendars, usedCalendarIds: [4], publicCalendarIds: [2], wikiCategoryId: WIKI };
        const released = checkDeviceGroup({ ...input, screenCalendarIds: [4] });
        expect(released.find((c) => c.category === 'calendars')).toEqual({
            level: 'ok',
            category: 'calendars',
            text: '„Gemeindeleitung": nicht öffentlich, für Bildschirme freigegeben.',
        });
        expect(checkDeviceGroup({ ...input, screenCalendarIds: [] }).find((c) => c.category === 'calendars')).toMatchObject({ level: 'warn' });
    });

    it('does not warn that a device account reads a released calendar, but does for another internal one (Plan.md 85 b)', () => {
        const members = [{ label: 'Gerät A', grants: [{ authId: 403, dataId: 4 }, { authId: 403, dataId: 5 }] }];
        const all = [...calendars, { id: 5, name: 'Intern' }];
        const checks = checkDeviceGroup({ statusId: 1, members, calendars: all, usedCalendarIds: [], publicCalendarIds: [2], screenCalendarIds: [4], wikiCategoryId: WIKI });
        const texts = checks.filter((c) => c.category === 'rights').map((c) => c.text);
        expect(texts).toEqual(['Gerät A darf den internen Kalender „Intern" lesen.']);
    });

    it('warns about a calendar in use that is neither public nor visible to the administrator', () => {
        const checks = checkDeviceGroup({
            statusId: 1,
            members: [{ label: 'Minimal User', grants: [] }],
            calendars,
            usedCalendarIds: [7],
            publicCalendarIds: [2],
            wikiCategoryId: WIKI,
        });
        expect(checks.find((c) => c.text.startsWith('Kalender 7'))).toEqual({
            level: 'warn',
            category: 'calendars',
            text: 'Kalender 7 ist nicht öffentlich oder gelöscht – kein Fernseher zeigt ihn.',
            detail: 'Im Editor aus dem Baustein entfernen.',
        });
    });

    it('warns when a device account may read an internal calendar (Plan.md 62)', () => {
        const checks = checkDeviceGroup({
            statusId: 1,
            members: [{ label: 'Minimal User', grants: [grant(AUTH.calendarView, 4)] }],
            calendars,
            usedCalendarIds: [2], publicCalendarIds: [2],
            wikiCategoryId: WIKI,
        });
        const warning = checks.find((c) => c.text.includes('internen Kalender'));
        expect(warning).toMatchObject({
            level: 'warn',
            category: 'rights',
            text: 'Minimal User darf den internen Kalender „Gemeindeleitung" lesen.',
        });
        expect(warning?.detail).toContain('wer seine Adresse kennt');
    });

    it('warns about wiki rights a device does not need (least privilege)', () => {
        const checks = checkDeviceGroup({
            statusId: 1,
            members: [{ label: 'Minimal User', grants: [grant(AUTH.wikiView)] }],
            calendars,
            usedCalendarIds: [], publicCalendarIds: [2],
            wikiCategoryId: WIKI,
        });
        expect(checks.find((c) => c.text.includes('Wiki-Rechte'))?.level).toBe('warn');
    });

    it('warns about "Wiki" and editing, but no longer about seeing the category – videos need that (Plan.md 52)', () => {
        const check = (grants: Grant[]) =>
            checkDeviceGroup({ statusId: 1, members: [{ label: 'Gerät A', grants }], calendars, usedCalendarIds: [], publicCalendarIds: [2], wikiCategoryId: WIKI }).filter((c) =>
                c.text.includes('Wiki-Rechte'),
            );
        expect(check([grant(AUTH.wikiCategoryView, WIKI)])).toEqual([]);
        expect(check([grant(AUTH.wikiCategoryView, WIKI), grant(AUTH.wikiCategoryEdit, WIKI)])).toHaveLength(1);
        expect(check([grant(AUTH.wikiCategoryView, WIKI), grant(AUTH.wikiView)])).toHaveLength(1);
    });

    it('checks that a device may see the wiki category: a failure while a screen shows a video, else a warning (Plan.md 52)', () => {
        const check = (grants: Grant[], videoInUse: boolean, wikiCategoryId: number | null = WIKI) =>
            checkDeviceGroup({
                statusId: 1,
                members: [{ label: 'Gerät A', grants }],
                calendars,
                usedCalendarIds: [], publicCalendarIds: [2],
                videoInUse,
                wikiCategoryId,
            }).filter((c) => c.text.includes('Wiki-Bereich „Infoscreen"'));
        expect(check([], true)).toEqual([
            expect.objectContaining({ level: 'fail', text: 'Gerät A darf den Wiki-Bereich „Infoscreen" nicht sehen – Videos laufen nicht.' }),
        ]);
        expect(check([], false)).toEqual([
            { level: 'warn', category: 'media', text: 'Gerät A darf den Wiki-Bereich „Infoscreen" nicht sehen – Videos würden nicht laufen.', detail: '„Rechte aktualisieren" vergibt es.' },
        ]);
        expect(check([grant(AUTH.wikiCategoryView, WIKI)], true)).toEqual([expect.objectContaining({ level: 'ok' })]);
        expect(check([grant(AUTH.wikiCategoryView, WIKI)], false)).toEqual([]);
        // No wiki category yet: nothing to see.
        expect(check([], true, null)).toEqual([]);
    });

    it('fails for a room a device cannot see, and is content with one it can (G45)', () => {
        const rooms = [
            { id: 1, name: 'Saal' },
            { id: 3, name: 'Raum 01' },
        ];
        const checks = checkDeviceGroup({
            statusId: 1,
            members: [{ label: 'Minimal User', grants: [grant(AUTH.resourceView, 3)] }],
            calendars,
            usedCalendarIds: [], publicCalendarIds: [2],
            rooms,
            usedRoomIds: [1, 3],
            wikiCategoryId: WIKI,
        });
        expect(checks.find((c) => c.text.includes('Raum 01'))?.level).toBe('ok');
        const fail = checks.find((c) => c.text.includes('Saal'));
        expect(fail).toMatchObject({ level: 'fail', text: '„Saal" ist für Minimal User nicht sichtbar.' });
        expect(fail?.detail).toContain('Ressource sehen');
    });

    it('checks that a device sees every room when appointments show theirs (Plan.md 50)', () => {
        const rooms = [
            { id: 1, name: 'Saal' },
            { id: 3, name: 'Raum 01' },
            { id: 4, name: 'Keller' },
        ];
        const check = (grants: Grant[]) =>
            checkDeviceGroup({
                statusId: 1,
                members: [{ label: 'Gerät A', grants }],
                calendars,
                usedCalendarIds: [], publicCalendarIds: [2],
                rooms,
                usedRoomIds: [],
                appointmentRooms: true,
                wikiCategoryId: WIKI,
            }).filter((c) => c.text.startsWith('Räume an Terminen'));
        expect(check([grant(AUTH.resourceView, 1)])).toEqual([
            {
                level: 'fail',
                category: 'rooms',
                text: 'Räume an Terminen: Gerät A sieht 2 von 3 Räumen nicht.',
                detail: '„Rechte aktualisieren" gibt der Gerätegruppe das Recht „Ressource sehen" für alle Räume.',
            },
        ]);
        expect(check([grant(AUTH.resourceView, 1), grant(AUTH.resourceView, 3), grant(AUTH.resourceView, 4)])).toEqual([
            { level: 'ok', category: 'rooms', text: 'Räume an Terminen sind sichtbar.' },
        ]);
    });

    it('checks that a device sees the events of the calendars that show services (Plan.md 51)', () => {
        const check = (grants: Grant[], serviceCalendarIds = [1, 2]) =>
            checkDeviceGroup({
                statusId: 1,
                members: [{ label: 'Gerät A', grants }],
                calendars,
                usedCalendarIds: [], publicCalendarIds: [2],
                serviceCalendarIds,
                wikiCategoryId: WIKI,
            }).filter((c) => c.text.startsWith('Dienste an Terminen'));
        const [fail] = check([grant(AUTH.eventView, 1)]);
        expect(fail).toMatchObject({ level: 'fail', text: 'Dienste an Terminen: Gerät A sieht die Events der Kalender nicht.' });
        expect(fail?.detail).toContain('Events von einzelnen Kalendern sehen');
        expect(check([grant(AUTH.eventView, 1), grant(AUTH.eventView, 2)])).toEqual([
            { level: 'ok', category: 'services', text: 'Dienste an Terminen sind sichtbar.' },
        ]);
        expect(check([], [])).toEqual([]);
    });

    describe('other groups of a device account', () => {
        const check = (otherGroups?: OtherGroup[] | null, plannedAuthIds?: number[]) =>
            checkDeviceGroup({
                statusId: 1,
                members: [{ label: 'Gerät A', grants: [], otherGroups }],
                calendars,
                usedCalendarIds: [],
                publicCalendarIds: [2],
                wikiCategoryId: WIKI,
                plannedAuthIds,
                authName: (id) => (id === 7 ? 'Mitglieder sehen' : undefined),
            }).filter((c) => c.category === 'rights');

        it('says nothing about a group that gives no rights, or when not asked', () => {
            expect(check([{ name: 'Küche', grants: [] }])).toEqual([]);
            expect(check(undefined)).toEqual([]);
        });

        it('names the group and the rights it gives', () => {
            const [warning] = check([{ name: 'Küche', grants: [7, 7, 9].map((a) => ({ authId: a, dataId: null })) }]);
            expect(warning).toMatchObject({ level: 'warn', text: 'Über „Küche" hat Gerät A 2 Rechte, die ein Gerät nicht braucht: Mitglieder sehen, Recht 9.' });
            expect(warning?.detail).toContain('Rechteverwaltung');
        });

        it('leaves out rights the plan covers', () => {
            expect(check([{ name: 'Küche', grants: [7, 9].map((a) => ({ authId: a, dataId: null })) }], [7, 9])).toEqual([]);
        });

        it('counts the rest beyond six names', () => {
            const [warning] = check([{ name: 'Küche', grants: [1, 2, 3, 4, 5, 6, 7, 8, 9].map((a) => ({ authId: a, dataId: null })) }]);
            expect(warning?.text).toContain('9 Rechte');
            expect(warning?.text).toContain('und 3 weitere.');
        });

        it('is unsettled when a group or the groups cannot be read', () => {
            expect(check([{ name: 'Küche', grants: null }])[0]).toMatchObject({
                level: 'warn',
                text: 'Gerät A ist auch Mitglied in „Küche" – welche Rechte die Gruppe gibt, ist ungeklärt.',
            });
            expect(check(null)[0]).toMatchObject({ level: 'warn', text: 'Ob Gerät A in weiteren Gruppen ist, ist ungeklärt.' });
        });
    });

    describe('scope of a device account (Plan.md 94 B)', () => {
        const VIEW = 1001;
        const EDIT = 1002;
        const planned = [
            { authId: VIEW, dataId: [10, 11], label: 'Daten sehen' },
            { authId: EDIT, dataId: [12], label: 'Daten bearbeiten' },
            { authId: AUTH.wikiCategoryView, dataId: [WIKI], label: 'Wiki' },
            { authId: AUTH.calendarView, dataId: [1], label: 'Kalender' },
            { authId: 1000, label: 'Modul' },
        ];
        const g = (authId: number, dataId: number, type?: string): Grant => ({ authId, dataId, type });

        it('finds data beyond the plan, per right', () => {
            expect(scopeExcess([g(VIEW, 10), g(VIEW, 13), g(EDIT, 12), g(EDIT, 11), g(AUTH.wikiCategoryView, 99)], planned)).toEqual([
                { authId: AUTH.wikiCategoryView, dataIds: [99] },
                { authId: VIEW, dataIds: [13] },
                { authId: EDIT, dataIds: [11] },
            ]);
        });

        it('counts all data as beyond, not a revoked one, and leaves calendars, rooms and events alone', () => {
            expect(scopeExcess([g(VIEW, ALL_DATA)], planned)).toEqual([{ authId: VIEW, dataIds: [ALL_DATA] }]);
            expect(scopeExcess([g(VIEW, 13), g(VIEW, 13, 'revoke')], planned)).toEqual([]);
            expect(scopeExcess([g(AUTH.calendarView, 5), g(AUTH.resourceView, 5), g(AUTH.eventView, 5)], [...planned, { authId: AUTH.resourceView, dataId: [1], label: 'R' }])).toEqual([]);
        });

        it('is empty when everything lies in the plan, or the right is not planned', () => {
            expect(scopeExcess([g(VIEW, 10), g(VIEW, 11), g(EDIT, 12), { authId: 1000, dataId: null }, g(777, 3)], planned)).toEqual([]);
        });

        const check = (member: Partial<DeviceMember>, plannedGrants: typeof planned | null = planned) =>
            checkDeviceGroup({
                statusId: 1,
                members: [{ label: 'Gerät A', grants: [], ...member }],
                calendars,
                usedCalendarIds: [],
                publicCalendarIds: [2],
                wikiCategoryId: WIKI,
                plannedGrants: plannedGrants ?? undefined,
                authName: (id) => ({ [VIEW]: 'Daten sehen', [EDIT]: 'Daten bearbeiten', [AUTH.wikiCategoryView]: 'Wiki sehen' })[id],
                dataName: (_a, d) => (d === 13 ? 'Entwürfe' : undefined),
            }).filter((c) => c.category === 'rights');

        it('warns once per account, with names and fallbacks', () => {
            const warnings = check({ grants: [g(VIEW, 13), g(EDIT, 20), g(EDIT, ALL_DATA), g(AUTH.wikiCategoryView, 99)] });
            expect(warnings).toHaveLength(1);
            expect(warnings[0]).toMatchObject({
                level: 'warn',
                text: 'Gerät A darf mehr als nötig: Wiki sehen auch für Wiki-Bereich 99; Daten sehen auch für Entwürfe; Daten bearbeiten auch für alle, Kategorie 20.',
            });
            expect(warnings[0]?.detail).toContain('Entwürfe');
        });

        it('says nothing without a plan or when the account stays inside it', () => {
            expect(check({ grants: [g(VIEW, 13)] }, null)).toEqual([]);
            expect(check({ grants: [g(VIEW, 10)] })).toEqual([]);
        });

        it('counts a right from another group, in the scope row, the internal calendar and the wiki holders', () => {
            const other = [{ name: 'Küche', grants: [g(VIEW, 13), g(AUTH.calendarView, 4), g(AUTH.wikiView, 0)] }];
            const texts = check({ otherGroups: other }).map((c) => c.text);
            expect(texts).toContain('Gerät A darf mehr als nötig: Daten sehen auch für Entwürfe.');
            expect(texts).toContain('Gerät A darf den internen Kalender „Gemeindeleitung" lesen.');
            expect(texts.some((x) => x.includes('Wiki-Rechte'))).toBe(true);
        });
    });

    it('adds no row for rooms at appointments when no block asks for them', () => {
        const checks = checkDeviceGroup({ statusId: 1, members: [{ label: 'G', grants: [] }], calendars, usedCalendarIds: [], publicCalendarIds: [2], rooms: [{ id: 1, name: 'Saal' }], wikiCategoryId: WIKI });
        expect(checks.some((c) => c.text.startsWith('Räume an Terminen'))).toBe(false);
    });

    it('warns about a room a screen uses that is not to be found, and adds no row without used rooms', () => {
        const members = [{ label: 'Gerät', grants: [] }];
        const unknown = checkDeviceGroup({ statusId: 1, members, calendars, usedCalendarIds: [], publicCalendarIds: [2], rooms: [], usedRoomIds: [42], wikiCategoryId: WIKI });
        expect(unknown.find((c) => c.text.includes('42'))?.level).toBe('warn');
        const none = checkDeviceGroup({ statusId: 1, members, calendars, usedCalendarIds: [], publicCalendarIds: [2], rooms: [{ id: 1, name: 'Saal' }], usedRoomIds: [], wikiCategoryId: WIKI });
        expect(none.some((c) => c.text.includes('Saal') || c.text.includes('Raum'))).toBe(false);
    });

    it('warns when no resource type counts as a room (Plan.md 86) – also before a device is in the group', () => {
        const check = (roomTypeMissing?: boolean) =>
            checkDeviceGroup({ statusId: 1, members: [], calendars, usedCalendarIds: [], publicCalendarIds: [2], roomTypeMissing, wikiCategoryId: WIKI }).find(
                (c) => c.text === 'Kein Ressourcentyp für Räume gewählt.',
            );
        expect(check(true)).toMatchObject({ level: 'warn', category: 'rooms' });
        expect(check(true)?.detail).toContain('Einstellungen → Räume');
        expect(check(false)).toBeUndefined();
        expect(check()).toBeUndefined();
    });

    it('warns about a calendar a screen uses that no longer exists', () => {
        const checks = checkDeviceGroup({
            statusId: 1,
            members: [{ label: 'Gerät', grants: [] }],
            calendars,
            usedCalendarIds: [99], publicCalendarIds: [2],
            wikiCategoryId: WIKI,
        });
        expect(checks.find((c) => c.text.includes('99'))?.level).toBe('warn');
    });
});

describe('rights a device does not need (Plan.md 58 E)', () => {
    const planned = [2010, AUTH.wikiCategoryView];
    const device = (grants: Grant[], extra: object = {}) =>
        checkDeviceGroup({
            statusId: 1,
            members: [{ label: 'Gerät A', grants }],
            calendars: [],
            usedCalendarIds: [], publicCalendarIds: [2],
            wikiCategoryId: WIKI,
            ...extra,
        }).filter((c) => c.text.includes('nicht braucht:'));

    it('counts a right once, whatever data it is for, and leaves planned and revoked ones out', () => {
        const grants = [grant(2010), grant(AUTH.calendarView, 1), grant(AUTH.calendarView, 2), grant(101, 3), grant(101, 4), grant(7)];
        // A calendar right from status or group is never excess; a non-public calendar it reads has its own line.
        expect(excessRights(grants, planned)).toEqual([7, 101]);
        expect(excessRights([...grants, { authId: 7, dataId: null, type: 'revoke' }], planned)).toEqual([101]);
        // Seeing the own person data comes with the usual person status; editing it is a right to change something.
        expect(excessRights([grant(AUTH.ownDataView, 2), grant(132, 2)], planned)).toEqual([132]);
        // Wiki rights have their own line.
        expect(excessRights([grant(AUTH.wikiView), grant(AUTH.wikiCategoryEdit, WIKI)], planned)).toEqual([]);
    });

    it('names them, by name where the catalogue has one', () => {
        const authName = (id: number) => (id === 101 ? 'Personen: Personen bearbeiten' : undefined);
        const [one] = device([grant(2010), grant(101, 3)], { plannedAuthIds: planned, authName });
        expect(one?.level).toBe('warn');
        expect(one?.text).toBe('Gerät A hat ein Recht, das ein Gerät nicht braucht: Personen: Personen bearbeiten.');
        const [two] = device([grant(101), grant(7)], { plannedAuthIds: planned, authName });
        expect(two?.text).toBe('Gerät A hat 2 Rechte, die ein Gerät nicht braucht: Recht 7, Personen: Personen bearbeiten.');
    });

    it('counts what it does not name', () => {
        const many = Array.from({ length: 9 }, (_, i) => grant(900 + i));
        expect(device(many, { plannedAuthIds: planned })[0]?.text).toContain('Recht 905 und 3 weitere.');
    });

    it('says nothing without a plan, and nothing about an account that holds only what is planned', () => {
        expect(device([grant(101)])).toEqual([]);
        expect(device([grant(2010), grant(AUTH.calendarView, 1)], { plannedAuthIds: planned })).toEqual([]);
    });
});

describe('module rights, as the assistant grants them', () => {
    const required = [
        { authId: 2010, label: '„Infoscreen Designer" sehen' },
        { authId: 2017, dataId: [1, 4], label: 'Daten in Kategorie bearbeiten' },
    ];

    it('names what a designer role lacks – every category must be covered', () => {
        const checks = checkDesignerGroup({
            statusId: 1,
            roles: [role({ grants: [...designerGrants, grant(2010), grant(2017, 1)] })],
            wikiCategoryId: WIKI,
            moduleRights: required,
        });
        expect(checks.find((c) => c.text.includes('am Modul fehlt'))?.text).toContain('Daten in Kategorie bearbeiten');
    });

    it('accepts a device account that holds the module rights from any source', () => {
        const checks = checkDeviceGroup({
            statusId: 1,
            members: [{ label: 'Gerät', grants: [grant(2010), grant(2017, -1)] }],
            calendars: [],
            usedCalendarIds: [], publicCalendarIds: [2],
            wikiCategoryId: WIKI,
            moduleRights: required,
        });
        expect(checks.find((c) => c.text.includes('Gerät darf'))?.level).toBe('ok');
    });
});

describe('groupChecks', () => {
    const c = (level: Check['level'], text: string, category?: Check['category']): Check => ({ level, text, category });

    it('returns nothing for nothing', () => {
        expect(groupChecks([])).toEqual([]);
    });

    it('orders the groups as fixed and leaves out empty categories', () => {
        const groups = groupChecks([c('ok', 'a', 'rights'), c('ok', 'b', 'calendars'), c('ok', 'c', 'group'), c('ok', 'd', 'media')]);
        expect(groups.map((g) => g.category)).toEqual(['group', 'calendars', 'media', 'rights']);
        expect(groups.map((g) => g.title)).toEqual(['Gruppe', 'Kalender', 'Mediathek und Videos', 'Weitere Rechte']);
    });

    it('counts a check without a category to the group', () => {
        expect(groupChecks([c('ok', 'a')]).map((g) => g.category)).toEqual(['group']);
    });

    it('takes the worst level and counts what waits inside, worst first', () => {
        const [group] = groupChecks([
            c('info', 'i1', 'rooms'),
            c('ok', 'o', 'rooms'),
            c('warn', 'w1', 'rooms'),
            c('fail', 'f1', 'rooms'),
            c('warn', 'w2', 'rooms'),
            c('info', 'i2', 'rooms'),
        ]);
        expect(group?.level).toBe('fail');
        expect(group?.checks).toHaveLength(6);
        expect(group?.summary).toBe('1 Fehler, 2 Warnungen, 2 Hinweise');
    });

    it('ranks info above ok and writes the summary', () => {
        const [info] = groupChecks([c('ok', 'a', 'module'), c('info', 'b', 'module')]);
        expect(info?.level).toBe('info');
        expect(info?.summary).toBe('1 Hinweis');
        const [ok] = groupChecks([c('ok', 'a', 'module'), c('ok', 'b', 'module')]);
        expect(ok?.level).toBe('ok');
        expect(ok?.summary).toBe('2 von 2 in Ordnung');
        expect(groupChecks([c('ok', 'a', 'module')])[0]?.summary).toBe('In Ordnung');
        expect(groupChecks([c('warn', 'a', 'module')])[0]?.summary).toBe('1 Warnung');
    });
});
