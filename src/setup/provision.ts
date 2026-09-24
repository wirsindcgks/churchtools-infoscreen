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
import { AUTH } from './checks';

export const GROUP_NAMES = { designer: 'Infoscreen-Designer', device: 'Infoscreen-Devices' } as const;
/** Group type of both groups, looked up by name: ids and names differ per instance. */
export const GROUP_TYPE_NAME = 'Merkmal';

export type GroupKey = keyof typeof GROUP_NAMES;

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
}

export interface PlanInput {
    catalog: AuthCatalog;
    moduleKey: string;
    /** Ids of the module's data categories, as they exist after the first start. */
    categories: Record<CategoryKey, number>;
    wikiCategoryId: number | null;
    /** Calendars the screens use that are not public – what a device must be allowed to read. */
    privateCalendarIds: number[];
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
    const written = (['screens', 'playlists', 'slides', 'media'] as const).map((k) => input.categories[k]);

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
    if (input.wikiCategoryId !== null) {
        designer.push(
            { authId: AUTH.wikiCategoryView, dataId: [input.wikiCategoryId], label: 'Wiki-Bereich „Infoscreen" sehen' },
            { authId: AUTH.wikiCategoryEdit, dataId: [input.wikiCategoryId], label: 'Wiki-Bereich „Infoscreen" bearbeiten' },
        );
    }

    const device: GrantSpec[] = [...readModule];
    if (input.privateCalendarIds.length) {
        device.push({ authId: AUTH.calendarView, dataId: input.privateCalendarIds, label: 'Einzelnen Kalender sehen' });
    }

    return [
        { key: 'designer', name: GROUP_NAMES.designer, grants: designer },
        { key: 'device', name: GROUP_NAMES.device, grants: device },
    ];
}

/** The ChurchTools calls the assistant makes – behind an interface, so tests need no instance. */
export interface ProvisionApi {
    createGroup(name: string, groupTypeId: number): Promise<number>;
    roleIds(groupId: number): Promise<number[]>;
    grant(roleId: number, authId: number, dataId?: number[]): Promise<void>;
}

export interface ProvisionResult {
    groupIds: Partial<Record<GroupKey, number>>;
    /** Plain-language account of every step, also of the one that failed. */
    log: string[];
    error: string | null;
}

/**
 * Creates each group and grants every right to every role of it – with the
 * type "Merkmal" these are "Teilnehmer" and "Leiter", so whoever is added,
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
