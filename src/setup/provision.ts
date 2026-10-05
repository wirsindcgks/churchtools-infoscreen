/**
 * The setup assistant (Plan.md, Nächste Schritte 9): creates the two groups
 * of the module and gives their roles the rights – because the permission
 * management of ChurchTools is too much to ask of a congregation.
 *
 * `planProvisioning` decides what happens, as data the page can show before
 * anything is written. `provision` carries it out step by step and keeps a
 * record, so that an interruption leaves a clear account of what exists.
 *
 * Rules (AGENTS.md): only groups the assistant created itself are touched,
 * never existing roles; creating and deleting groups is measured (G34),
 * granting rights is not – the first run on the test instance is the test.
 */
import type { CategoryKey } from '../store/screen-repository';
import type { AuthCatalog } from './catalog';
import { ALL_DATA, AUTH, has, type Grant } from './checks';

export const GROUP_NAMES = { designer: 'Infoscreen-Designer', device: 'Infoscreen-Devices' } as const;
/** The group type the assistant suggests, looked up by name: ids and names differ per instance, and a church may have removed it (Plan.md 71). */
export const DEFAULT_GROUP_TYPE_NAME = 'Merkmal';

export interface GroupTypeChoice {
    id: number;
    /** What the administrator sees – the translated name where there is one. */
    name: string;
    /** The name as stored, where it differs from `name`. */
    rawName?: string;
}

/** The suggested group type among the ones the instance has – by its shown or its stored name – or null. */
export function defaultGroupTypeId(types: readonly GroupTypeChoice[]): number | null {
    return types.find((t) => t.name === DEFAULT_GROUP_TYPE_NAME || t.rawName === DEFAULT_GROUP_TYPE_NAME)?.id ?? null;
}

export type GroupKey = keyof typeof GROUP_NAMES;

/** The core rights the assistant grants per calendar or room, as it labels them – and takes back again (Plan.md 62). */
const RIGHT_LABELS = {
    [AUTH.calendarView]: 'Einzelnen Kalender sehen',
    [AUTH.eventView]: 'Events von einzelnen Kalendern sehen',
    [AUTH.resourceView]: 'Ressource sehen',
} as const;

/**
 * What "Rechte aktualisieren" takes back besides the writing rights, by group: rights per calendar or room, but
 * only for those the administrator sees (`planRefresh`). Everything else on these groups stays.
 */
export const MANAGED_RIGHTS: Record<GroupKey, { authId: number; label: string }[]> = {
    device: [AUTH.calendarView, AUTH.eventView, AUTH.resourceView].map((authId) => ({ authId, label: RIGHT_LABELS[authId] })),
    designer: [{ authId: AUTH.resourceView, label: RIGHT_LABELS[AUTH.resourceView] }],
};

export interface GrantSpec {
    authId: number;
    /** Omitted for rights without data, e.g. "see the module". */
    dataId?: number[];
    label: string;
}

export interface GroupSpec {
    key: GroupKey;
    name: string;
    grants: GrantSpec[];
    /**
     * Rights the group must not have – for designers, writing screens and
     * settings: screens are the administrators' (Plan.md, F, 2026-09-25).
     * "Rechte aktualisieren" takes them back from the assistant's groups,
     * one data id at a time, as ChurchTools stores them (G34).
     */
    forbidden: GrantSpec[];
}

export interface PlanInput {
    catalog: AuthCatalog;
    moduleKey: string;
    /** Ids of the module's data categories, as they exist after the first start. */
    categories: Record<CategoryKey, number>;
    wikiCategoryId: number | null;
    /**
     * Every public calendar the screens use that the administrator sees (Plan.md 62). Public ones need the
     * right too: a signed-in account without it gets 403 for the whole request (G35).
     */
    calendarIds: number[];
    /**
     * Every room the administrator sees: designers may choose among all of
     * them (Plan.md 46; G45). Type room only – no items or vehicles.
     */
    roomIds: number[];
    /** The rooms the screens show – what a device must be able to read. */
    usedRoomIds: number[];
    /** A block shows the rooms of its appointments (Plan.md 50): the device sees every room then. */
    appointmentRooms: boolean;
    /** The calendars of the blocks that show services (Plan.md 51): the device sees their events. */
    serviceCalendarIds: number[];
}

export class MissingAuthError extends Error {
    constructor(readonly auth: string) {
        super(`Das Recht „${auth}" fehlt im Rechtekatalog – ist die Extension installiert?`);
        this.name = 'MissingAuthError';
    }
}

export function planProvisioning(input: PlanInput): GroupSpec[] {
    const moduleRight = (auth: string): number => {
        const id = input.catalog.id(input.moduleKey, auth);
        if (id === undefined) throw new MissingAuthError(auth);
        return id;
    };
    // Explicit category ids, as ChurchTools itself stores them (G33); "all" by omission is unmeasured (G34).
    const all = Object.values(input.categories).sort((a, b) => a - b);
    // Designers write content; the screens themselves and the settings belong to the administrators (F).
    const written = (['playlists', 'slides', 'media'] as const).map((k) => input.categories[k]);
    const adminOnly = (['screens', 'settings'] as const).map((k) => input.categories[k]);

    const readModule: GrantSpec[] = [
        { authId: moduleRight('view'), label: '„Infoscreen Designer" sehen' },
        { authId: moduleRight('view custom category'), dataId: all, label: 'Kategorien sehen' },
        { authId: moduleRight('view custom data'), dataId: all, label: 'Daten in Kategorie sehen' },
    ];

    const designer: GrantSpec[] = [
        ...readModule,
        { authId: moduleRight('create custom data'), dataId: written, label: 'Daten in Kategorie erstellen' },
        { authId: moduleRight('edit custom data'), dataId: written, label: 'Daten in Kategorie bearbeiten' },
        { authId: moduleRight('delete custom data'), dataId: written, label: 'Daten in Kategorie löschen' },
        { authId: AUTH.wikiView, label: '„Wiki" sehen' },
    ];
    // "Ressource sehen" per room (205) is enough; "Ressourcen sehen" (201) nobody needs (G45).
    if (input.roomIds.length) {
        designer.push({ authId: AUTH.resourceView, dataId: input.roomIds, label: RIGHT_LABELS[AUTH.resourceView] });
    }
    if (input.wikiCategoryId !== null) {
        designer.push(
            { authId: AUTH.wikiCategoryView, dataId: [input.wikiCategoryId], label: 'Wiki-Bereich „Infoscreen" sehen' },
            { authId: AUTH.wikiCategoryEdit, dataId: [input.wikiCategoryId], label: 'Wiki-Bereich „Infoscreen" bearbeiten' },
        );
    }

    const device: GrantSpec[] = [...readModule];
    // Videos come only through the download address, which wants this one right; "Wiki" sehen (501) a device does not need (G47, Plan.md 52).
    if (input.wikiCategoryId !== null) {
        device.push({ authId: AUTH.wikiCategoryView, dataId: [input.wikiCategoryId], label: 'Wiki-Bereich „Infoscreen" sehen' });
    }
    if (input.calendarIds.length) {
        device.push({ authId: AUTH.calendarView, dataId: input.calendarIds, label: RIGHT_LABELS[AUTH.calendarView] });
    }
    // One entry: every room when appointments show theirs, plus what the rooms blocks use.
    const deviceRooms =
        input.appointmentRooms && input.roomIds.length
            ? [...new Set([...input.roomIds, ...input.usedRoomIds])].sort((a, b) => a - b)
            : input.usedRoomIds;
    if (deviceRooms.length) {
        device.push({ authId: AUTH.resourceView, dataId: deviceRooms, label: RIGHT_LABELS[AUTH.resourceView] });
    }

    if (input.serviceCalendarIds.length) {
        device.push({ authId: AUTH.eventView, dataId: input.serviceCalendarIds, label: RIGHT_LABELS[AUTH.eventView] });
    }

    const writing = (['create custom data', 'edit custom data', 'delete custom data'] as const).map((auth) => ({
        authId: moduleRight(auth),
        dataId: adminOnly,
        label: `${{ 'create custom data': 'Anlegen', 'edit custom data': 'Bearbeiten', 'delete custom data': 'Löschen' }[auth]} von Screens und Einstellungen`,
    }));

    return [
        { key: 'designer', name: GROUP_NAMES.designer, grants: designer, forbidden: writing },
        { key: 'device', name: GROUP_NAMES.device, grants: device, forbidden: writing },
    ];
}

/** The ChurchTools calls the assistant makes – behind an interface, so tests need no instance. */
export interface ProvisionApi {
    createGroup(name: string, groupTypeId: number): Promise<number>;
    roleIds(groupId: number): Promise<number[]>;
    grant(roleId: number, authId: number, dataId?: number[]): Promise<void>;
    /** What a role holds now – read before anything is taken back. */
    grants(roleId: number): Promise<Grant[]>;
    revoke(roleId: number, authId: number, dataId: number[]): Promise<void>;
}

export interface ProvisionResult {
    groupIds: Partial<Record<GroupKey, number>>;
    /** Plain-language account of every step, also of the one that failed. */
    log: string[];
    error: string | null;
}

/**
 * Creates each group and grants every right to every role of it – with the
 * group type ("Merkmal": "Teilnehmer" and "Leiter"), so whoever is added,
 * in whichever role, gets the same rights.
 */
export async function provision(plan: GroupSpec[], groupTypeId: number, api: ProvisionApi): Promise<ProvisionResult> {
    const result: ProvisionResult = { groupIds: {}, log: [], error: null };
    try {
        for (const spec of plan) {
            const groupId = await api.createGroup(spec.name, groupTypeId);
            result.groupIds[spec.key] = groupId;
            result.log.push(`Gruppe „${spec.name}" angelegt.`);
            const roles = await api.roleIds(groupId);
            for (const roleId of roles) {
                for (const g of spec.grants) await api.grant(roleId, g.authId, g.dataId);
            }
            result.log.push(`${spec.grants.length} Rechte an ${roles.length} Rollen von „${spec.name}" vergeben.`);
        }
    } catch (e) {
        result.error = e instanceof Error ? e.message : String(e);
        result.log.push(`Abgebrochen: ${result.error}`);
    }
    return result;
}

export interface RemovalResult {
    /** Created groups still there – what a retry would delete. */
    remaining: number[];
    /** Ids no longer part of the setup, deleted or already gone – a fresh group list must not show them again (Plan.md, F). */
    removed: number[];
    selected: Partial<Record<GroupKey, number | null>>;
    log: string[];
    error: string | null;
}

/** What deleting one group turned out to be: actually deleted, or already gone (a `404`, e.g. from a save that failed after a previous run). */
export type DeleteOutcome = 'deleted' | 'gone';

/**
 * „Automatische Einrichtung rückgängig machen" (Plan.md, F, 2026-09-28): deletes only the groups
 * the assistant created itself, recognised by the id kept since creation,
 * never by name – a group an administrator chose is never touched, even if
 * it is currently selected. A group that turns out to be gone already counts
 * the same as a deleted one: both leave `createdGroupIds`, so a save that
 * failed once does not wedge every later attempt on the same `404`. Stops at
 * the first real failure, so that a retry knows exactly what is still there.
 */
export async function removeCreatedGroups(
    createdGroupIds: readonly number[],
    selected: Partial<Record<GroupKey, number | null>>,
    deleteGroup: (groupId: number) => Promise<DeleteOutcome>,
): Promise<RemovalResult> {
    const remaining = [...createdGroupIds];
    const removed: number[] = [];
    const nextSelected = { ...selected };
    const log: string[] = [];
    let deleted = 0;
    let error: string | null = null;
    while (remaining.length) {
        const id = remaining[0]!;
        let outcome: DeleteOutcome;
        try {
            outcome = await deleteGroup(id);
        } catch (e) {
            error = e instanceof Error ? e.message : String(e);
            log.push(`Abgebrochen: ${error}`);
            break;
        }
        remaining.shift();
        removed.push(id);
        if (outcome === 'gone') {
            log.push(`Gruppe ${id} gab es nicht mehr – aus den Einstellungen entfernt.`);
        } else {
            deleted++;
        }
        for (const key of Object.keys(nextSelected) as GroupKey[]) {
            if (nextSelected[key] === id) nextSelected[key] = null;
        }
    }
    if (!error && deleted) log.push(`${deleted} Gruppen gelöscht.`);
    return { remaining, removed, selected: nextSelected, log, error };
}

/**
 * Last log line once `removeCreatedGroups` succeeded: this step never touches
 * the extension itself or what is left for people to do by hand – that stays
 * unwritten unless said here (docs/Einrichtung.md, „Was beim Abbau passiert –
 * auf einen Blick").
 */
export const REMOVE_SETUP_NEXT_STEPS_LOG_LINE =
    'Als Nächstes: den Designer in der Extension-Verwaltung von ChurchTools löschen, falls er ganz weg soll. ' +
    'Danach von Hand: die Passwörter der Gerätekonten ändern oder die Konten löschen (sonst gelten die Adressen ' +
    'der Fernseher weiter), Wiki-Bereich sichern und löschen oder behalten.';

/**
 * Log line before `REMOVE_SETUP_NEXT_STEPS_LOG_LINE`, once device accounts
 * were collected before the device group was deleted (Plan.md, F; G18): a
 * login token cannot be revoked, only invalidated by a password change – and
 * by then the group that named the accounts is already gone.
 */
export function devicePasswordRecommendationLogLine(names: string[]): string {
    return `Passwörter ändern empfohlen für: ${names.join(', ')} – dann funktionieren die Adressen der Fernseher nicht mehr.`;
}

export interface RefreshItem {
    authId: number;
    /** `null` for a right without data. */
    dataId: number | null;
    label: string;
}

export interface RefreshGroup {
    key: GroupKey;
    name: string;
    /** Planned, but missing on at least one role. */
    add: RefreshItem[];
    /** Held, managed by the assistant, no longer planned, and known to the administrator. */
    remove: RefreshItem[];
}

/** What the administrator sees – only for these an unplanned right is taken back (Plan.md 62). */
export interface KnownData {
    calendarIds: number[];
    roomIds: number[];
}

/** Names of calendars and rooms for the labels; an id without a name is labelled by its number. */
export interface DataNames {
    calendars?: ReadonlyMap<number, string>;
    rooms?: ReadonlyMap<number, string>;
}

/**
 * What "Rechte aktualisieren" would change, before anything is written (Plan.md 62). `held` is what the roles
 * of each group hold now, one list per role. Taken back is only what the assistant manages (`MANAGED_RIGHTS`)
 * and only for calendars and rooms in `known` – an id the administrator does not see stays untouched, and an
 * empty list of rooms, e.g. after a failed load, takes none. Plus the writing rights the groups must not have.
 */
export function planRefresh(
    plan: GroupSpec[],
    held: Partial<Record<GroupKey, Grant[][]>>,
    known: KnownData,
    names: DataNames = {},
): RefreshGroup[] {
    const nameOf = (authId: number, dataId: number): string | undefined =>
        authId === AUTH.resourceView ? names.rooms?.get(dataId) : names.calendars?.get(dataId);
    const named = (authId: number, dataId: number, label: string): string => {
        const name = nameOf(authId, dataId);
        return name ? `${label}: ${name}` : `${label}: ${authId === AUTH.resourceView ? 'Raum' : 'Kalender'} ${dataId}`;
    };
    const knownIds = (authId: number): Set<number> => new Set(authId === AUTH.resourceView ? known.roomIds : known.calendarIds);

    return plan.map((spec) => {
        const roles = held[spec.key] ?? [];
        const add: RefreshItem[] = [];
        const seenAdd = new Set<string>();
        for (const g of spec.grants) {
            for (const dataId of g.dataId ?? [null]) {
                const pair = `${g.authId}:${dataId}`;
                if (seenAdd.has(pair)) continue;
                if (roles.length && roles.every((grants) => has(grants, g.authId, dataId ?? undefined))) continue;
                seenAdd.add(pair);
                add.push({ authId: g.authId, dataId, label: dataId !== null && g.authId in RIGHT_LABELS ? named(g.authId, dataId, g.label) : g.label });
            }
        }

        const remove: RefreshItem[] = [];
        const seenRemove = new Set<string>();
        const takeBack = (item: RefreshItem): void => {
            const pair = `${item.authId}:${item.dataId}`;
            if (seenRemove.has(pair)) return;
            seenRemove.add(pair);
            remove.push(item);
        };
        const planned = (authId: number, dataId: number): boolean =>
            spec.grants.some((g) => g.authId === authId && (g.dataId ?? []).includes(dataId));
        for (const grants of roles) {
            for (const g of grants) {
                if ((g.type ?? 'grant') !== 'grant' || g.dataId === null || g.dataId === ALL_DATA) continue;
                const managed = MANAGED_RIGHTS[spec.key].find((m) => m.authId === g.authId);
                if (!managed || planned(g.authId, g.dataId) || !knownIds(g.authId).has(g.dataId)) continue;
                takeBack({ authId: g.authId, dataId: g.dataId, label: named(g.authId, g.dataId, managed.label) });
            }
            for (const f of spec.forbidden) {
                for (const dataId of f.dataId ?? []) {
                    if (grants.some((g) => g.authId === f.authId && g.dataId === dataId && (g.type ?? 'grant') === 'grant')) {
                        takeBack({ authId: f.authId, dataId, label: f.label });
                    }
                }
            }
        }
        return { key: spec.key, name: spec.name, add, remove };
    });
}

/** What `readRefresh` found: the plan of changes, and the roles it was made from – `applyRefresh` writes against exactly these. */
export interface RefreshState {
    groups: RefreshGroup[];
    roles: Partial<Record<GroupKey, { roleId: number; grants: Grant[] }[]>>;
}

/**
 * First step of "Rechte aktualisieren": reads the roles of the groups the assistant created and what they hold,
 * and plans (`planRefresh`). Writes nothing – the page shows the plan before `applyRefresh` runs.
 */
export async function readRefresh(
    plan: GroupSpec[],
    groupIds: Partial<Record<GroupKey, number>>,
    known: KnownData,
    names: DataNames,
    api: ProvisionApi,
): Promise<RefreshState> {
    const roles: RefreshState['roles'] = {};
    for (const spec of plan) {
        const groupId = groupIds[spec.key];
        if (groupId === undefined) continue;
        roles[spec.key] = await Promise.all(
            (await api.roleIds(groupId)).map(async (roleId) => ({ roleId, grants: await api.grants(roleId) })),
        );
    }
    const held = Object.fromEntries(Object.entries(roles).map(([key, list]) => [key, list.map((r) => r.grants)]));
    const groups = planRefresh(plan, held, known, names).filter((g) => roles[g.key] !== undefined);
    return { groups, roles };
}

/**
 * Second step: grants the whole plan again – a grant is a PUT that creates or updates, so what exists stays – and
 * takes back each right of `remove` from every role that holds it, one data id at a time, as ChurchTools stores
 * them (G34, G48). Stops at the first failure and says so.
 */
export async function applyRefresh(plan: GroupSpec[], state: RefreshState, api: ProvisionApi): Promise<ProvisionResult> {
    const result: ProvisionResult = { groupIds: {}, log: [], error: null };
    try {
        for (const spec of plan) {
            const roles = state.roles[spec.key];
            const change = state.groups.find((g) => g.key === spec.key);
            if (!roles || !change) continue;
            for (const { roleId, grants } of roles) {
                for (const g of spec.grants) await api.grant(roleId, g.authId, g.dataId);
                for (const item of change.remove) {
                    if (item.dataId === null) continue;
                    if (!grants.some((g) => g.authId === item.authId && g.dataId === item.dataId && (g.type ?? 'grant') === 'grant')) continue;
                    await api.revoke(roleId, item.authId, [item.dataId]);
                }
            }
            result.log.push(refreshLogLine(change));
        }
    } catch (e) {
        result.error = e instanceof Error ? e.message : String(e);
        result.log.push(`Abgebrochen: ${result.error}`);
    }
    return result;
}

/** The log line of one group: what was granted and taken back, or that it is up to date. */
export function refreshLogLine(change: RefreshGroup): string {
    return change.add.length || change.remove.length
        ? `„${change.name}": ${change.add.length} Rechte vergeben, ${change.remove.length} zurückgenommen.`
        : `Rechte von „${change.name}" sind auf dem Stand.`;
}

/** Nothing to add and nothing to take back anywhere: no dialog, no writing. */
export function refreshIsEmpty(groups: RefreshGroup[]): boolean {
    return groups.every((g) => !g.add.length && !g.remove.length);
}
