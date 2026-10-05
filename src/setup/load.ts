/**
 * What the setup page reads from ChurchTools. Only reading: the page shows
 * what is missing and where to click; it changes no rights (Plan.md, 8).
 * Reading rights of others needs administrator rights – without them the
 * calls answer 403, which the page names instead of showing empty lights.
 */
import { churchtoolsClient } from '@churchtools/churchtools-client';
import type { Grant, RoleRights } from './checks';
import type { ProvisionApi } from './provision';

export interface GroupSummary {
    id: number;
    name: string;
    statusId: number | null;
}

interface GroupResponse {
    id: number;
    name: string;
    information?: { groupStatusId?: number | null } | null;
}

interface RoleResponse {
    id: number;
    groupTypeRoleId: number;
    name: string;
    isDefault?: boolean;
}

interface MemberResponse {
    personId: number;
    groupTypeRoleId: number;
    groupMemberStatus?: string;
}

interface PersonResponse {
    id: number;
    firstName: string;
    lastName: string;
    statusId: number;
}

const summary = (g: GroupResponse): GroupSummary => ({ id: g.id, name: g.name, statusId: g.information?.groupStatusId ?? null });

export async function loadGroups(): Promise<GroupSummary[]> {
    const groups = await churchtoolsClient.getAllPages<GroupResponse>('/groups');
    return groups.map(summary).sort((a, b) => a.name.localeCompare(b.name, 'de'));
}

function permissions(domainType: string, id: number): Promise<Grant[]> {
    return churchtoolsClient.get<Grant[]>(`/permissions/${domainType}/${id}`);
}

export interface GroupRights {
    group: GroupSummary;
    roles: (RoleRights & { groupTypeRoleId: number })[];
    /** Active members with the rights of their role in this group. */
    members: { personId: number; roleGrants: Grant[] }[];
}

/** A group with its roles and the rights each role carries – of the group role and of its group type role. */
export async function loadGroupRights(groupId: number): Promise<GroupRights> {
    const [group, roles, members] = await Promise.all([
        churchtoolsClient.get<GroupResponse>(`/groups/${groupId}`),
        churchtoolsClient.get<RoleResponse[]>(`/groups/${groupId}/roles`),
        churchtoolsClient.getAllPages<MemberResponse>(`/groups/${groupId}/members`),
    ]);
    const active = members.filter((m) => (m.groupMemberStatus ?? 'active') === 'active');
    const withGrants = await Promise.all(
        roles.map(async (role) => {
            const [own, byType] = await Promise.all([
                permissions('group_role', role.id),
                permissions('group_type_role', role.groupTypeRoleId),
            ]);
            return {
                name: role.name,
                groupTypeRoleId: role.groupTypeRoleId,
                isDefault: !!role.isDefault,
                grants: [...own, ...byType],
                memberCount: active.filter((m) => m.groupTypeRoleId === role.groupTypeRoleId).length,
            };
        }),
    );
    return {
        group: summary(group),
        roles: withGrants,
        members: active.map((m) => ({
            personId: m.personId,
            roleGrants: withGrants.find((r) => r.groupTypeRoleId === m.groupTypeRoleId)?.grants ?? [],
        })),
    };
}

/**
 * A person's rights beyond this group: from the person status – where the
 * device account gets its three calendars on the test instance (G21) – and
 * granted to the person directly. Rights from other groups are not included.
 */
export async function loadPersonGrants(personId: number): Promise<{ label: string; grants: Grant[] }> {
    const person = await churchtoolsClient.get<PersonResponse>(`/persons/${personId}`);
    const [byStatus, direct] = await Promise.all([permissions('status', person.statusId), permissions('person', personId)]);
    return { label: `${person.firstName} ${person.lastName}`.trim(), grants: [...byStatus, ...direct] };
}

/**
 * Names of a group's members – collected before deleting the device group in
 * „Automatische Einrichtung rückgängig machen" (Plan.md, F; G18): a login token cannot be revoked
 * from outside, only invalidated by changing the account's password, and once
 * the group is gone nobody would know anymore which accounts were devices.
 */
export async function groupMemberNames(groupId: number): Promise<{ personId: number; name: string }[]> {
    const members = await churchtoolsClient.getAllPages<{ personId: number }>(`/groups/${groupId}/members`);
    return Promise.all(
        members.map(async (m) => {
            const person = await churchtoolsClient.get<PersonResponse>(`/persons/${m.personId}`);
            return { personId: m.personId, name: `${person.firstName} ${person.lastName}`.trim() };
        }),
    );
}

/** The group type of the module's groups, by name – ids and names differ per instance. */
export async function findGroupTypeId(name: string): Promise<number | null> {
    const types = await churchtoolsClient.get<{ id: number; name: string; nameTranslated?: string }[]>('/group/grouptypes');
    return types.find((t) => t.name === name || t.nameTranslated === name)?.id ?? null;
}

/** Only for groups the assistant created itself (Plan.md, 9). Their roles and rights go with them. */
export async function deleteGroup(groupId: number): Promise<void> {
    await churchtoolsClient.deleteApi(`/groups/${groupId}`);
}

/** Whether the signed-in person may manage permissions – what the assistant needs besides creating groups. */
export async function canManagePermissions(): Promise<boolean> {
    const global = await churchtoolsClient.get<{ churchcore?: Record<string, unknown> }>('/permissions/global');
    return global.churchcore?.['administer persons'] === true;
}

/** Whether the signed-in person may see the wiki (`churchwiki: view`) – the same source as the designer's rights check. */
export async function canViewWiki(): Promise<boolean> {
    const global = await churchtoolsClient.get<{ churchwiki?: { view?: boolean } }>('/permissions/global');
    return global.churchwiki?.view === true;
}

interface PersonGroupResponse {
    group?: { title?: string | null; domainIdentifier?: string | null } | null;
}

/**
 * Groups a person is a member of – `domainIdentifier` is the group id as a
 * string, `title` the name (both measured 2026-09-28 / 2026-10-05). Without a
 * title the group is called „Gruppe <id>".
 */
export async function personGroups(personId: number): Promise<{ id: number; name: string }[]> {
    const memberships = await churchtoolsClient.get<PersonGroupResponse[]>(`/persons/${personId}/groups`);
    return memberships.flatMap((m) => {
        const id = m.group?.domainIdentifier ? Number(m.group.domainIdentifier) : NaN;
        return Number.isNaN(id) ? [] : [{ id, name: m.group?.title || `Gruppe ${id}` }];
    });
}

/**
 * Groups a person is a member of, by id. „Automatische Einrichtung rückgängig machen" uses it to warn
 * before deleting the very group that gives the person access to the
 * designer (Plan.md, F).
 */
export async function personGroupIds(personId: number): Promise<number[]> {
    return (await personGroups(personId)).map((g) => g.id);
}

export const churchToolsProvisionApi: ProvisionApi = {
    async createGroup(name, groupTypeId) {
        const group = await churchtoolsClient.post<{ id: number }>('/groups', { name, groupTypeId, groupStatusId: 1 });
        return group.id;
    },
    async roleIds(groupId) {
        return (await churchtoolsClient.get<RoleResponse[]>(`/groups/${groupId}/roles`)).map((r) => r.id);
    },
    async grant(roleId, authId, dataId) {
        await churchtoolsClient.put(`/permissions/group_role/${roleId}`, dataId ? { authId, dataId } : { authId });
    },
    grants(roleId) {
        return permissions('group_role', roleId);
    },
    async revoke(roleId, authId, dataId) {
        // Spec: DELETE removes the raw assignment named by authId and dataId (Build 32882). Measured with G34's follow-up.
        await churchtoolsClient.deleteApi(`/permissions/group_role/${roleId}`, { authId, dataId });
    },
};
