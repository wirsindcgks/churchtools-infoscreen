/**
 * The traffic lights of the setup page (Plan.md, Nächste Schritte 8): do the
 * two groups of the module carry what designers and devices need? Pure
 * functions over what `load.ts` fetched, so every rule is testable without an
 * instance.
 *
 * Rights of a role come as bare numbers (G30). The few this page checks are
 * core rights of ChurchTools, read once from the legacy catalogue; the rights
 * of the extension itself exist only once it is installed.
 */

import { PUBLIC_CALENDAR_PATH } from '../ct/api';
import type { RoomInfo } from '../rooms/normalize';
import { t } from '../i18n/designer';

/** Core permission ids (G30). */
export const AUTH = {
    calendarView: 403, // churchcal: "Einzelnen Kalender sehen"
    resourceView: 205, // churchresource: "Ressource sehen"
    eventView: 306, // churchservice: "Events von einzelnen Kalendern sehen"
    wikiView: 501, // churchwiki: "Wiki" sehen
    wikiCategoryView: 502, // churchwiki: "Einzelne Wiki-Kategorien sehen"
    wikiCategoryEdit: 503, // churchwiki: "Einzelne Wiki-Kategorien bearbeiten"
    // The person status of a fresh instance gives it to everyone, the device account too (measured 2026-10-02, status 0).
    ownDataView: 131, // churchdb: "Eigene Personendaten sehen - bis zum gewählten Sicherheitslevel"
} as const;

/** `dataId` of a right granted for all data, e.g. all calendars – seen on person rights (G30). */
export const ALL_DATA = -1;

/** Group status ids (G30); rights work while active or finished, not as a draft or archived (Academy). */
export const GROUP_STATUS: Record<number, string> = { 1: 'aktiv', 2: 'Entwurf', 3: 'archiviert', 4: 'beendet' };

export interface Grant {
    authId: number;
    dataId: number | null;
    type?: string;
}

export type Level = 'ok' | 'warn' | 'fail' | 'info';

/** What a check is about; the setup page folds its checks by it. A check without one counts as `group`. */
export type CheckCategory = 'group' | 'calendars' | 'rooms' | 'services' | 'module' | 'media' | 'rights';

export interface Check {
    level: Level;
    category?: CheckCategory;
    text: string;
    detail?: string;
}

/** Whether the grants contain a right, for one data id or – without – at all. Revocations win. */
export function has(grants: Grant[], authId: number, dataId?: number): boolean {
    const matches = (g: Grant) =>
        g.authId === authId && (dataId === undefined || g.dataId === dataId || g.dataId === ALL_DATA);
    const granted = grants.some((g) => matches(g) && (g.type ?? 'grant') === 'grant');
    const revoked = grants.some((g) => matches(g) && g.type === 'revoke');
    return granted && !revoked;
}

export function checkStatus(statusId: number | null | undefined): Check {
    switch (statusId) {
        case 1:
            return { level: 'ok', category: 'group', text: t.setup.checks.status.active };
        case 4:
            return { level: 'warn', category: 'group', text: t.setup.checks.status.finished, detail: t.setup.checks.status.finishedDetail };
        case 2:
            return { level: 'fail', category: 'group', text: t.setup.checks.status.draft, detail: t.setup.checks.status.draftDetail };
        case 3:
            return { level: 'fail', category: 'group', text: t.setup.checks.status.archived, detail: t.setup.checks.status.archivedDetail };
        default:
            return { level: 'warn', category: 'group', text: t.setup.checks.status.unknown(statusId) };
    }
}

export interface RoleRights {
    name: string;
    /** Rights of the group role and of its group type role together. */
    grants: Grant[];
    memberCount: number;
    isDefault: boolean;
}

/** The roles whose rights reach people: those with members, else the default role new members get. */
function relevantRoles(roles: RoleRights[]): RoleRights[] {
    const withMembers = roles.filter((r) => r.memberCount > 0);
    return withMembers.length ? withMembers : roles.filter((r) => r.isDefault);
}

/** A right the module needs, with the data it must cover – as the setup assistant grants it. */
export interface RequiredRight {
    authId: number;
    dataId?: number[];
    label: string;
}

/** Labels of the required rights these grants do not cover. */
export function lacking(grants: Grant[], required: RequiredRight[]): string[] {
    return required
        .filter((r) => !(r.dataId ?? [undefined]).every((d) => has(grants, r.authId, d)))
        .map((r) => r.label);
}

/** `null`: the rights of the module cannot be named here (no catalogue, e.g. in local development). */
type ModuleRights = RequiredRight[] | null;

const MODULE_RIGHTS_UNKNOWN: Check = {
    level: 'info',
    category: 'module',
    text: t.setup.checks.moduleUnknown,
    detail: t.setup.checks.moduleUnknownDetail,
};

export interface DesignerGroupInput {
    statusId: number | null;
    roles: RoleRights[];
    /** `null`: the wiki category does not exist yet or is not visible. */
    wikiCategoryId: number | null;
    moduleRights?: ModuleRights;
    /** Rights designers must not hold: writing screens and settings (Plan.md, F). */
    forbidden?: RequiredRight[] | null;
    /** Every room the administrator sees – designers choose among them for the block "Raumbelegung" (G45). */
    roomIds?: number[];
}

export function checkDesignerGroup(input: DesignerGroupInput): Check[] {
    const members = input.roles.reduce((n, r) => n + r.memberCount, 0);
    const checks: Check[] = [
        checkStatus(input.statusId),
        members
            ? { level: 'ok', category: 'group', text: t.setup.checks.members(members) }
            : { level: 'warn', category: 'group', text: t.setup.checks.nobody, detail: t.setup.checks.nobodyDetail },
    ];

    if (input.wikiCategoryId === null) {
        checks.push({
            level: 'info',
            category: 'media',
            text: t.setup.checks.wikiMissing,
            detail: t.setup.checks.wikiMissingDetail,
        });
    } else {
        const wiki = input.wikiCategoryId;
        for (const role of relevantRoles(input.roles)) {
            const lacking = ([
                !has(role.grants, AUTH.wikiView) && t.setup.checks.wikiSee,
                !has(role.grants, AUTH.wikiCategoryView, wiki) && t.setup.checks.wikiCategorySee,
                !has(role.grants, AUTH.wikiCategoryEdit, wiki) && t.setup.checks.wikiCategoryEdit,
            ] as (string | false)[]).filter((x): x is string => !!x);
            checks.push(
                lacking.length
                    ? { level: 'fail', category: 'media', text: t.setup.checks.roleLacksMedia(role.name, lacking.join(', ')) }
                    : { level: 'ok', category: 'media', text: t.setup.checks.roleMayUpload(role.name) },
            );
        }
    }

    if (!input.moduleRights) {
        checks.push(MODULE_RIGHTS_UNKNOWN);
    } else {
        for (const role of relevantRoles(input.roles)) {
            const missing = lacking(role.grants, input.moduleRights);
            checks.push(
                missing.length
                    ? { level: 'fail', category: 'module', text: t.setup.checks.roleLacksModule(role.name, missing.join(', ')) }
                    : { level: 'ok', category: 'module', text: t.setup.checks.roleMayDesign(role.name) },
            );
            const tooMuch = (input.forbidden ?? []).filter((f) => (f.dataId ?? []).some((d) => has(role.grants, f.authId, d)));
            if (tooMuch.length) {
                checks.push({
                    level: 'warn',
                    category: 'module',
                    text: t.setup.checks.roleTooMuch(role.name),
                    detail: t.setup.checks.roleTooMuchDetail,
                });
            }
        }
    }

    // Rooms are chosen in the designer: without the right on a room it is missing from the list (G45).
    const roomIds = input.roomIds ?? [];
    if (roomIds.length) {
        for (const role of relevantRoles(input.roles)) {
            if (roomIds.every((id) => has(role.grants, AUTH.resourceView, id))) continue;
            checks.push({
                level: 'warn',
                category: 'rooms',
                text: t.setup.checks.roleRooms(role.name),
                detail: t.setup.checks.roleRoomsDetail,
            });
        }
    }
    return checks;
}

export interface DeviceMember {
    label: string;
    /** Everything this person holds: group role, group type role, person status and direct rights. */
    grants: Grant[];
    /** Names of the person's groups besides the device group; left out when they could not be read. */
    otherGroups?: string[];
}

export interface CalendarInfo {
    id: number;
    name: string;
}

export interface DeviceGroupInput {
    statusId: number | null;
    members: DeviceMember[];
    calendars: CalendarInfo[];
    usedCalendarIds: number[];
    /** The calendars the public user sees – that is "public" (Plan.md 73, G53). */
    publicCalendarIds: number[];
    /** The rooms the administrator sees, to name the used ones. */
    rooms?: RoomInfo[];
    usedRoomIds?: number[];
    /** A block shows the rooms of its appointments (Plan.md 50): the device must see all rooms. */
    appointmentRooms?: boolean;
    /** The calendars of the blocks that show services (Plan.md 51): the device must see their events. */
    serviceCalendarIds?: number[];
    /** A screen shows a video (Plan.md 52): the device must see the wiki category, else the video does not run. */
    videoInUse?: boolean;
    wikiCategoryId: number | null;
    moduleRights?: ModuleRights;
    /**
     * The rights the assistant plans for a device, by id (Plan.md 58 E). With them the check names what a
     * device account holds beyond – without them (no catalogue, as in development) it says nothing.
     */
    plannedAuthIds?: number[];
    /** A right's name for people; the bare number where there is none. */
    authName?: (authId: number) => string | undefined;
}

/** More names would not be read on the page; the rest is counted. */
const EXCESS_NAMED = 6;

/**
 * The rights a device account holds that no device needs – by right, whatever data it is for. The
 * address of a TV carries its account's login token (Plan.md, D): who has the address has these rights.
 * Wiki rights have their own line in `checkDeviceGroup`. Seeing the own person data does not count: it reaches
 * no further than the device account's own record, and the usual person status brings it along. Editing it
 * does count, like every right that changes something – a device only reads (user, 2026-10-02). A calendar right
 * from status or group is no excess right either: if it reads a calendar that is not public, its own line warns.
 */
export function excessRights(grants: Grant[], plannedAuthIds: readonly number[]): number[] {
    const planned = new Set<number>([...plannedAuthIds, AUTH.wikiView, AUTH.wikiCategoryEdit, AUTH.ownDataView, AUTH.calendarView]);
    const held = [...new Set(grants.map((g) => g.authId))].filter((authId) => has(grants, authId));
    return held.filter((authId) => !planned.has(authId)).sort((a, b) => a - b);
}

export function checkDeviceGroup(input: DeviceGroupInput): Check[] {
    const checks: Check[] = [checkStatus(input.statusId)];
    const publicIds = new Set(input.publicCalendarIds);
    const byId = new Map(input.calendars.map((c) => [c.id, c]));
    if (!input.usedCalendarIds.length) {
        checks.push({ level: 'info', category: 'calendars', text: t.setup.checks.noAppointments });
    }
    for (const id of input.usedCalendarIds) {
        const calendar = byId.get(id);
        if (publicIds.has(id)) {
            checks.push({ level: 'ok', category: 'calendars', text: t.setup.checks.calendarPublic(calendar?.name ?? t.setup.checks.calendarFallback(id)) });
        } else if (calendar) {
            checks.push({
                level: 'warn',
                category: 'calendars',
                text: t.setup.checks.calendarNotPublic(calendar.name),
                detail: t.setup.checks.calendarNotPublicDetail(PUBLIC_CALENDAR_PATH),
            });
        } else {
            checks.push({
                level: 'warn',
                category: 'calendars',
                text: t.setup.checks.calendarGone(id),
                detail: t.setup.checks.calendarGoneDetail,
            });
        }
    }

    if (!input.members.length) {
        // Like an empty designer group: right after the assistant this is the next step, not a fault.
        checks.push({
            level: 'warn',
            category: 'group',
            text: t.setup.checks.noDevice,
            detail: t.setup.checks.noDeviceDetail,
        });
        return checks;
    }
    checks.push({ level: 'ok', category: 'group', text: t.setup.checks.devices(input.members.length) });
    for (const m of input.members) {
        if (!m.otherGroups?.length) continue;
        checks.push({
            level: 'warn',
            category: 'rights',
            text: t.setup.checks.otherGroups(m.label, m.otherGroups.map((g) => `„${g}"`).join(', ')),
            detail: t.setup.checks.otherGroupsDetail,
        });
    }

    // A device account that may read an internal calendar (one the public user does not see): the TV does not show it, but its address reads it (Plan.md 62).
    for (const calendar of input.calendars.filter((c) => !publicIds.has(c.id))) {
        for (const member of input.members.filter((m) => has(m.grants, AUTH.calendarView, calendar.id))) {
            checks.push({
                level: 'warn',
                category: 'rights',
                text: t.setup.checks.internalCalendar(member.label, calendar.name),
                detail: t.setup.checks.internalCalendarDetail,
            });
        }
    }

    const roomsById = new Map((input.rooms ?? []).map((r) => [r.id, r]));
    for (const id of input.usedRoomIds ?? []) {
        const room = roomsById.get(id);
        if (!room) {
            checks.push({ level: 'warn', category: 'rooms', text: t.setup.checks.roomUnknown(id) });
            continue;
        }
        const blind = input.members.filter((m) => !has(m.grants, AUTH.resourceView, id)).map((m) => m.label);
        checks.push(
            blind.length
                ? {
                      level: 'fail',
                      category: 'rooms',
                      text: t.setup.checks.roomBlind(room.name, blind.join(', ')),
                      detail: t.setup.checks.roomBlindDetail,
                  }
                : { level: 'ok', category: 'rooms', text: t.setup.checks.roomVisible(room.name) },
        );
    }

    if (input.appointmentRooms) {
        const all = input.rooms ?? [];
        const blind = input.members
            .map((m) => ({ label: m.label, unseen: all.filter((r) => !has(m.grants, AUTH.resourceView, r.id)).length }))
            .filter((m) => m.unseen > 0);
        if (blind.length) {
            for (const m of blind) {
                checks.push({
                    level: 'fail',
                    category: 'rooms',
                    text: t.setup.checks.appointmentRoomsBlind(m.label, m.unseen, all.length),
                    detail: t.setup.checks.appointmentRoomsBlindDetail,
                });
            }
        } else {
            checks.push({ level: 'ok', category: 'rooms', text: t.setup.checks.appointmentRoomsVisible });
        }
    }

    // Only public calendars get a right for their events (Plan.md 73); the others are named above.
    const serviceCalendarIds = (input.serviceCalendarIds ?? []).filter((id) => publicIds.has(id));
    if (serviceCalendarIds.length) {
        const blind = input.members
            .filter((m) => !serviceCalendarIds.every((id) => has(m.grants, AUTH.eventView, id)))
            .map((m) => m.label);
        checks.push(
            blind.length
                ? {
                      level: 'fail',
                      category: 'services',
                      text: t.setup.checks.servicesBlind(blind.join(', ')),
                      detail: t.setup.checks.servicesBlindDetail,
                  }
                : { level: 'ok', category: 'services', text: t.setup.checks.servicesVisible },
        );
    }

    if (!input.moduleRights) {
        checks.push(MODULE_RIGHTS_UNKNOWN);
    } else {
        for (const member of input.members) {
            const missing = lacking(member.grants, input.moduleRights);
            checks.push(
                missing.length
                    ? { level: 'fail', category: 'module', text: t.setup.checks.deviceLacksModule(member.label, missing.join(', ')) }
                    : { level: 'ok', category: 'module', text: t.setup.checks.deviceMayRead(member.label) },
            );
        }
    }

    // Videos come through the download address, which wants "Wiki-Bereich sehen" (502) and nothing more (G47, Plan.md 52).
    if (input.wikiCategoryId !== null) {
        const wiki = input.wikiCategoryId;
        const blind = input.members.filter((m) => !has(m.grants, AUTH.wikiCategoryView, wiki)).map((m) => m.label);
        if (blind.length) {
            const subject = t.setup.checks.videoSubject(blind.join(', '), blind.length);
            checks.push(
                input.videoInUse
                    ? { level: 'fail', category: 'media', text: t.setup.checks.videoBlind(subject), detail: t.setup.checks.videoBlindDetail }
                    : { level: 'warn', category: 'media', text: t.setup.checks.videoWouldBlind(subject), detail: t.setup.checks.videoWouldBlindDetail },
            );
        } else if (input.videoInUse) {
            checks.push({ level: 'ok', category: 'media', text: t.setup.checks.videoOk });
        }
    }

    // Least privilege (Plan.md, F): images come through the image service without sign-in (G14), videos need only 502.
    const wikiHolders = input.members
        .filter((m) => [AUTH.wikiView, AUTH.wikiCategoryEdit].some((a) => has(m.grants, a)))
        .map((m) => m.label);
    if (wikiHolders.length) {
        checks.push({
            level: 'warn',
            category: 'rights',
            text: t.setup.checks.wikiHolders(wikiHolders.join(', '), wikiHolders.length),
            detail: t.setup.checks.wikiHoldersDetail,
        });
    }

    if (input.plannedAuthIds) {
        for (const member of input.members) {
            const excess = excessRights(member.grants, input.plannedAuthIds);
            if (!excess.length) continue;
            const names = excess.slice(0, EXCESS_NAMED).map((id) => input.authName?.(id) ?? t.setup.checks.excessFallback(id));
            const more = excess.length - names.length;
            checks.push({
                level: 'warn',
                category: 'rights',
                text: t.setup.checks.excess(member.label, excess.length, names.join(', '), more),
                detail: t.setup.checks.excessDetail,
            });
        }
    }
    return checks;
}

const CATEGORIES: { category: CheckCategory; title: string }[] = (
    ['group', 'calendars', 'rooms', 'services', 'module', 'media', 'rights'] as const
).map((category) => ({ category, title: t.setup.checks.categories[category] }));

const SEVERITY: Record<Level, number> = { ok: 0, info: 1, warn: 2, fail: 3 };

export interface CheckGroup {
    category: CheckCategory;
    title: string;
    /** The worst level in the group: fail > warn > info > ok. */
    level: Level;
    checks: Check[];
    /**
     * What the head of the group says beside its symbol: "5 von 5 in Ordnung" while all is well, else what
     * waits inside, worst first – "1 Fehler, 2 Warnungen". The lines themselves show once the group is open.
     */
    summary: string;
}

const COUNTED: { level: Level; one: string; many: string }[] = (['fail', 'warn', 'info'] as const).map((level) => ({
    level,
    one: t.setup.checks.counted[level][0],
    many: t.setup.checks.counted[level][1],
}));

/** Sorts checks into their categories, in a fixed order; categories without a check are left out. */
export function groupChecks(checks: Check[]): CheckGroup[] {
    const groups: CheckGroup[] = [];
    for (const { category, title } of CATEGORIES) {
        const own = checks.filter((c) => (c.category ?? 'group') === category);
        if (!own.length) continue;
        const ok = own.filter((c) => c.level === 'ok').length;
        const level = own.reduce<Level>((worst, c) => (SEVERITY[c.level] > SEVERITY[worst] ? c.level : worst), 'ok');
        const counts = COUNTED.map(({ level: counted, one, many }) => {
            const n = own.filter((c) => c.level === counted).length;
            return n ? `${n} ${n === 1 ? one : many}` : '';
        }).filter((part) => part !== '');
        const allWell = t.setup.checks.allWell(ok, own.length);
        groups.push({ category, title, level, checks: own, summary: counts.length ? counts.join(', ') : allWell });
    }
    return groups;
}
