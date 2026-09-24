/**
 * What the setup page reads from ChurchTools. Only reading: the page shows
 * what is missing and where to click; it changes no rights (Plan.md, 8).
 * Reading rights of others needs administrator rights – without them the
 * calls answer 403, which the page names instead of showing empty lights.
 */
import { churchtoolsClient } from '@churchtools/churchtools-client';
import type { Grant, RoleRights } from './checks';

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
