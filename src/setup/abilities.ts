/**
 * Which buttons of the settings page the signed-in person can use (Plan.md 63, G50): "Berechtigungen verwalten"
 * is not enough – the assistant also reads, creates and deletes groups, and ChurchTools hides a restricted group
 * from anyone without the group rights. A pure function over the `churchgroup` section of `/permissions/global`,
 * where "all" already comes as the list of all ids (G50). Only reading: nothing is tried out by writing.
 */

/** The `churchgroup` section of `/permissions/global`, as far as read here. */
export interface GroupPermissions {
    'view group'?: number[];
    'delete group'?: number[];
    'create groups of grouptype'?: number[];
    'view groups of grouptype'?: number[];
    'delete groups of grouptype'?: number[];
    'administer groups'?: boolean;
}

export type SettingsButton = 'refresh' | 'remove' | 'create';

export interface Ability {
    allowed: boolean;
    /** The missing rights in the words of the permission management; empty when allowed. */
    missing: string[];
}

export const GROUP_RIGHT_NAMES = {
    view: 'Gruppe inkl. ihrer Gruppenmitglieder sehen',
    viewType: 'Gruppen eines Gruppentyps sehen',
    delete: 'Gruppe löschen',
    createType: 'Gruppen eines Gruppentyps erstellen',
} as const;

const ALLOWED: Ability = { allowed: true, missing: [] };

/**
 * `section` undefined: not readable – everything stays allowed, as before. `groupTypeId` null: the type „Merkmal"
 * was not found, so only `administer groups` and the id lists count.
 */
export function settingsAbilities(
    section: GroupPermissions | undefined,
    createdGroupIds: readonly number[],
    groupTypeId: number | null,
): Record<SettingsButton, Ability> {
    if (!section) return { refresh: ALLOWED, remove: ALLOWED, create: ALLOWED };
    const list = (key: Exclude<keyof GroupPermissions, 'administer groups'>): number[] =>
        Array.isArray(section[key]) ? section[key]! : [];
    const admin = section['administer groups'] === true;
    const ofType = (key: Exclude<keyof GroupPermissions, 'administer groups'>): boolean =>
        groupTypeId !== null && list(key).includes(groupTypeId);

    const canView = (id: number): boolean => admin || list('view group').includes(id) || ofType('view groups of grouptype');
    const canDelete = (id: number): boolean => admin || list('delete group').includes(id) || ofType('delete groups of grouptype');
    const canViewType = admin || ofType('view groups of grouptype');
    const canCreateType = admin || ofType('create groups of grouptype');

    const refresh = createdGroupIds.every(canView);
    const remove = createdGroupIds.every(canDelete);
    // A group created without the right to see it afterwards cannot be given its rights (G50).
    const create = canCreateType && canViewType;
    return {
        refresh: { allowed: refresh, missing: refresh ? [] : [GROUP_RIGHT_NAMES.view] },
        remove: { allowed: remove, missing: remove ? [] : [GROUP_RIGHT_NAMES.delete] },
        create: {
            allowed: create,
            missing: [
                ...(canCreateType ? [] : [GROUP_RIGHT_NAMES.createType]),
                ...(canViewType ? [] : [GROUP_RIGHT_NAMES.viewType]),
            ],
        },
    };
}
