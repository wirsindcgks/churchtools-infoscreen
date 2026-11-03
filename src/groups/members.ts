/**
 * Turns the members of the module's own group "Infoscreen-People" into the cards the `people` block shows
 * (schema 1.51, Plan.md 112; measured in G70 and G71).
 *
 * The source is `GET /groups/{id}/members` and nothing else – never `/persons`. From each member only named fields
 * are taken: first and last name, the picture, the role and the member fields of the group. Everything else
 * ChurchTools sends along (`guid`, the person's id and addresses, `comment`) never leaves this file. Archived and
 * deceased people drop out, so do members that are not active and the account that asks (the device itself).
 */
import { LOCALE, tp } from '../i18n/player';
import type { PeopleSort } from '../model/schema';

interface PersonResponse {
    title?: string | null;
    imageUrl?: string | null;
    domainIdentifier?: string | number | null;
    domainAttributes?: {
        firstName?: string | null;
        lastName?: string | null;
        isArchived?: boolean | null;
        dateOfDeath?: string | null;
    } | null;
}

/** An entry of `GET /groups/{id}/members`, as far as this code reads it. */
export interface MemberResponse {
    personId?: number | string | null;
    groupTypeRoleId?: number | string | null;
    groupMemberStatus?: string | null;
    person?: PersonResponse | null;
    /** Measured (G71): a list of `{ id, name, value, sortKey }`, the name as the field is called in the group. */
    fields?: MemberFieldValueResponse[] | null;
}

interface MemberFieldValueResponse {
    id?: number | string | null;
    name?: string | null;
    value?: unknown;
    sortKey?: number | null;
}

/** An entry of `GET /groups/{id}/roles`. */
export interface RoleResponse {
    groupTypeRoleId?: number | string | null;
    name?: string | null;
}

export interface PeopleRole {
    /** The group type role's id – what a member carries. */
    id: number;
    name: string;
}

export interface PeopleField {
    /** What the block stores: the field's id as text – it stays when the church renames the field. */
    key: string;
    /** The name as the church keeps it in ChurchTools now. */
    name: string;
}

export interface Person {
    firstName: string;
    lastName: string;
    /** "Vorname Nachname" – or the title ChurchTools shows where it sends no parts. */
    name: string;
    imageUrl: string | null;
    roleId: number | null;
    /** Field id → shown value; empty values are left out. */
    fields: Record<string, string>;
}

/** The people group as the player keeps it: who is in it, and which roles and fields there are to choose. */
export interface PeopleGroup {
    groupId: number;
    /** The device may not read the group (`403`): the block says so instead of "no people" (AGENTS.md, Regel 5). */
    denied: boolean;
    people: Person[];
    roles: PeopleRole[];
    fields: PeopleField[];
    /** The module's own group "Infoscreen-People": the one a block without `groupId` shows (schema 1.53). */
    standard?: boolean;
    /** The group is neither "Infoscreen-People" nor released by an administrator: not read at all (Plan.md 112, Stück 2a). */
    unreleased?: boolean;
}

/** More would not be cards a person can read; the same cap as the groups overview. */
export const PEOPLE_CAP = 120;

/** A person group that could not be read at all. */
export function deniedPeople(groupId: number): PeopleGroup {
    return { groupId, denied: true, people: [], roles: [], fields: [] };
}

/** A group that is not released for screens: nothing of it is read, the block says so. */
export function unreleasedPeople(groupId: number): PeopleGroup {
    return { ...deniedPeople(groupId), unreleased: true };
}

/** The group a `people` block shows among the ones the player holds: `undefined` while they are not read, `null` when its group is missing. */
export function groupOfBlock(groups: readonly PeopleGroup[] | undefined, groupId: number | undefined): PeopleGroup | null | undefined {
    if (groups === undefined) return undefined;
    return groups.find((g) => (groupId === undefined ? g.standard === true : g.groupId === groupId)) ?? null;
}

function idOf(value: unknown): number | null {
    const id = Number(value);
    return Number.isInteger(id) && id > 0 ? id : null;
}

/** One field value as text: strings and numbers as they are, a list joined, a yes as "Ja"; anything else is left out. */
function valueText(value: unknown): string {
    if (typeof value === 'string') return value.trim();
    if (typeof value === 'number') return String(value);
    if (typeof value === 'boolean') return value ? tp.people.yes : '';
    if (Array.isArray(value)) return value.map(valueText).filter((part) => part !== '').join(', ');
    if (value && typeof value === 'object') {
        const inner = (value as { value?: unknown; text?: unknown; name?: unknown });
        return valueText(inner.value ?? inner.text ?? inner.name);
    }
    return '';
}

/**
 * The people of the group in the order ChurchTools sends them. `excludedPersonIds` are the accounts that sit in
 * the group for the sake of the field rights and are no one to show: the one that asks and the device accounts of the setup.
 */
export function normalizeMembers(
    groupId: number,
    rawMembers: unknown[],
    rawRoles: unknown[] = [],
    excludedPersonIds: readonly number[] = [],
): PeopleGroup {
    const roles: PeopleRole[] = [];
    for (const role of rawRoles as RoleResponse[]) {
        const id = idOf(role?.groupTypeRoleId);
        const name = (role?.name ?? '').trim();
        if (id !== null && name && !roles.some((r) => r.id === id)) roles.push({ id, name });
    }
    /** The fields seen on any member by id, with their current name, in the group's own order (`sortKey`). */
    const seenFields = new Map<string, { name: string; sortKey: number }>();

    const people: Person[] = [];
    for (const member of rawMembers as MemberResponse[]) {
        if ((member?.groupMemberStatus ?? 'active') !== 'active') continue;
        const person = member?.person;
        if (person?.domainAttributes?.isArchived || person?.domainAttributes?.dateOfDeath) continue;
        const personId = idOf(member?.personId) ?? idOf(person?.domainIdentifier);
        if (personId !== null && excludedPersonIds.includes(personId)) continue;
        const firstName = (person?.domainAttributes?.firstName ?? '').trim();
        const lastName = (person?.domainAttributes?.lastName ?? '').trim();
        const name = `${firstName} ${lastName}`.trim() || (person?.title ?? '').trim();
        if (!name) continue;
        const fields: Record<string, string> = {};
        for (const field of Array.isArray(member.fields) ? member.fields : []) {
            const id = field?.id === undefined || field.id === null ? '' : String(field.id);
            if (!id) continue;
            const text = valueText(field.value);
            if (text) fields[id] = text;
            // A field the church named differently now is the same field: the id is what counts, the name is only shown.
            const label = (field.name ?? '').trim() || id;
            if (!seenFields.has(id)) seenFields.set(id, { name: label, sortKey: typeof field.sortKey === 'number' ? field.sortKey : Infinity });
        }
        people.push({ firstName, lastName, name, imageUrl: person?.imageUrl || null, roleId: idOf(member.groupTypeRoleId), fields });
        if (people.length >= PEOPLE_CAP) break;
    }
    return { groupId, denied: false, people, roles, fields: [...seenFields].sort((a, b) => a[1].sortKey - b[1].sortKey).map(([key, { name }]) => ({ key, name })) };
}

/**
 * What a `people` block shows: the people in the chosen roles (all without a choice), in `sort` order – by last name
 * or first name, numbers as numbers, equal names stay in ChurchTools' order; by role, in the order of the group's
 * roles, then by last name.
 */
export function selectPeople(group: PeopleGroup | undefined, roleIds: readonly number[], sort: PeopleSort = 'last-name'): Person[] {
    if (!group || group.denied) return [];
    const wanted = roleIds.length ? group.people.filter((p) => p.roleId !== null && roleIds.includes(p.roleId)) : [...group.people];
    const compare = (a: string, b: string): number => a.localeCompare(b, LOCALE, { numeric: true });
    const byLast = (a: Person, b: Person): number => compare(a.lastName || a.name, b.lastName || b.name) || compare(a.firstName, b.firstName);
    const byFirst = (a: Person, b: Person): number => compare(a.firstName || a.name, b.firstName || b.name) || compare(a.lastName, b.lastName);
    const rank = (p: Person): number => {
        const index = group.roles.findIndex((r) => r.id === p.roleId);
        return index === -1 ? Infinity : index;
    };
    return wanted.sort(sort === 'first-name' ? byFirst : sort === 'role' ? (a, b) => rank(a) - rank(b) || byLast(a, b) : byLast);
}

/**
 * The ids of the fields a block names. A block from before stored the field's name: it is mapped to the id when exactly
 * one field of the group has that name; otherwise it stays as it is and shows nothing – silently, as before.
 */
export function resolveFieldKeys(fieldKeys: readonly string[], fields: readonly PeopleField[]): string[] {
    return fieldKeys.map((key) => {
        if (fields.some((f) => f.key === key)) return key;
        const byName = fields.filter((f) => f.name === key);
        return byName.length === 1 ? byName[0]!.key : key;
    });
}

/** The fields of a person the block shows, in the block's order – only those the person has a value for. */
export function shownFields(person: Person, fieldKeys: readonly string[]): { key: string; text: string }[] {
    return fieldKeys.flatMap((key) => (person.fields[key] ? [{ key, text: person.fields[key]! }] : []));
}
