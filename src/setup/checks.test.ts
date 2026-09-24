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

    it('fails without a device account', () => {
        const checks = checkDeviceGroup({ statusId: 1, members: [], calendars, usedCalendarIds: [4], wikiCategoryId: WIKI });
        expect(checks.at(-1)).toMatchObject({ level: 'fail' });
    });

    it('accepts public calendars and names who cannot see a private one', () => {
        const checks = checkDeviceGroup({
            statusId: 1,
            members: [{ label: 'Minimal User', grants: [grant(AUTH.calendarView, 1)] }],
            calendars,
            usedCalendarIds: [2, 4],
            wikiCategoryId: WIKI,
        });
        expect(checks.find((c) => c.text.includes('Gottesdienst'))?.level).toBe('ok');
        const fail = checks.find((c) => c.text.includes('Gemeindeleitung'));
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
