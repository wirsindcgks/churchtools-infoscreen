import { describe, expect, it } from 'vitest';
import { AUTH, checkDesignerGroup, checkDeviceGroup, checkStatus, has, type Grant, type RoleRights } from './checks';

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
        { id: 2, name: 'Gottesdienst', isPublic: true },
        { id: 4, name: 'Gemeindeleitung', isPublic: false },
    ];

    it('warns without a device account, like an empty designer group – the next step, not a fault', () => {
        const checks = checkDeviceGroup({ statusId: 1, members: [], calendars, usedCalendarIds: [4], wikiCategoryId: WIKI });
        expect(checks.at(-1)).toMatchObject({ level: 'warn', text: 'Noch kein Geräte-Benutzer in der Gruppe.' });
    });

    it('asks for the right on public calendars too – without it ChurchTools refuses with 403 (G35)', () => {
        const checks = checkDeviceGroup({
            statusId: 1,
            members: [{ label: 'Minimal User', grants: [grant(AUTH.calendarView, 4)] }],
            calendars,
            usedCalendarIds: [2, 4],
            wikiCategoryId: WIKI,
        });
        expect(checks.find((c) => c.text.includes('Gemeindeleitung'))?.level).toBe('ok');
        const fail = checks.find((c) => c.text.includes('Gottesdienst'));
        expect(fail?.level).toBe('fail');
        expect(fail?.text).toContain('Minimal User');
    });

    it('counts rights from every source, e.g. the person status (G21: the base carries three calendars)', () => {
        const checks = checkDeviceGroup({
            statusId: 1,
            members: [{ label: 'Minimal User', grants: [grant(AUTH.calendarView, 4)] }],
            calendars,
            usedCalendarIds: [4],
            wikiCategoryId: WIKI,
        });
        expect(checks.find((c) => c.text.includes('Gemeindeleitung'))?.level).toBe('ok');
    });

    it('warns about wiki rights a device does not need (least privilege)', () => {
        const checks = checkDeviceGroup({
            statusId: 1,
            members: [{ label: 'Minimal User', grants: [grant(AUTH.wikiView)] }],
            calendars,
            usedCalendarIds: [],
            wikiCategoryId: WIKI,
        });
        expect(checks.find((c) => c.text.includes('Wiki-Rechte'))?.level).toBe('warn');
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
            usedCalendarIds: [],
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
                usedCalendarIds: [],
                rooms,
                usedRoomIds: [],
                appointmentRooms: true,
                wikiCategoryId: WIKI,
            }).filter((c) => c.text.startsWith('Räume an Terminen'));
        expect(check([grant(AUTH.resourceView, 1)])).toEqual([
            {
                level: 'fail',
                text: 'Räume an Terminen: Gerät A sieht 2 von 3 Räumen nicht.',
                detail: '„Rechte aktualisieren" gibt der Gerätegruppe das Recht „Ressource sehen" für alle Räume.',
            },
        ]);
        expect(check([grant(AUTH.resourceView, 1), grant(AUTH.resourceView, 3), grant(AUTH.resourceView, 4)])).toEqual([
            { level: 'ok', text: 'Räume an Terminen sind sichtbar.' },
        ]);
    });

    it('checks that a device sees the events of the calendars that show services (Plan.md 51)', () => {
        const check = (grants: Grant[], serviceCalendarIds = [1, 2]) =>
            checkDeviceGroup({
                statusId: 1,
                members: [{ label: 'Gerät A', grants }],
                calendars,
                usedCalendarIds: [],
                serviceCalendarIds,
                wikiCategoryId: WIKI,
            }).filter((c) => c.text.startsWith('Dienste an Terminen'));
        const [fail] = check([grant(AUTH.eventView, 1)]);
        expect(fail).toMatchObject({ level: 'fail', text: 'Dienste an Terminen: Gerät A sieht die Events der Kalender nicht.' });
        expect(fail?.detail).toContain('Events von einzelnen Kalendern sehen');
        expect(check([grant(AUTH.eventView, 1), grant(AUTH.eventView, 2)])).toEqual([
            { level: 'ok', text: 'Dienste an Terminen sind sichtbar.' },
        ]);
        expect(check([], [])).toEqual([]);
    });

    it('adds no row for rooms at appointments when no block asks for them', () => {
        const checks = checkDeviceGroup({ statusId: 1, members: [{ label: 'G', grants: [] }], calendars, usedCalendarIds: [], rooms: [{ id: 1, name: 'Saal' }], wikiCategoryId: WIKI });
        expect(checks.some((c) => c.text.startsWith('Räume an Terminen'))).toBe(false);
    });

    it('warns about a room a screen uses that is not to be found, and adds no row without used rooms', () => {
        const members = [{ label: 'Gerät', grants: [] }];
        const unknown = checkDeviceGroup({ statusId: 1, members, calendars, usedCalendarIds: [], rooms: [], usedRoomIds: [42], wikiCategoryId: WIKI });
        expect(unknown.find((c) => c.text.includes('42'))?.level).toBe('warn');
        const none = checkDeviceGroup({ statusId: 1, members, calendars, usedCalendarIds: [], rooms: [{ id: 1, name: 'Saal' }], usedRoomIds: [], wikiCategoryId: WIKI });
        expect(none.some((c) => c.text.includes('Saal') || c.text.includes('Raum'))).toBe(false);
    });

    it('warns about a calendar a screen uses that no longer exists', () => {
        const checks = checkDeviceGroup({
            statusId: 1,
            members: [{ label: 'Gerät', grants: [] }],
            calendars,
            usedCalendarIds: [99],
            wikiCategoryId: WIKI,
        });
        expect(checks.find((c) => c.text.includes('99'))?.level).toBe('warn');
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
            usedCalendarIds: [],
            wikiCategoryId: WIKI,
            moduleRights: required,
        });
        expect(checks.find((c) => c.text.includes('Gerät darf'))?.level).toBe('ok');
    });
});
