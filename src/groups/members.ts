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
    /** Keyed by the field's id, or by its name – the answer is not measured for both (G70). */
    fields?: unknown;
}

/** An entry of `GET /groups/{id}/roles`. */
export interface RoleResponse {
    groupTypeRoleId?: number | string | null;
    name?: string | null;
}

/** An entry of `GET /groups/{id}/memberfields`. */
export interface MemberFieldResponse {
    id?: number | string | null;
    name?: string | null;
    sortKey?: number | null;
}

export interface PeopleRole {
    /** The group type role's id – what a member carries. */
    id: number;
    name: string;
}

export interface PeopleField {
    /** What the block stores: the field's name. */
    key: string;
    name: string;
}

export interface Person {
    firstName: string;
    lastName: string;
    /** "Vorname Nachname" – or the title ChurchTools shows where it sends no parts. */
    name: string;
    imageUrl: string | null;
    roleId: number | null;
    /** Field name → shown value; empty values are left out. */
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
}

/** More would not be cards a person can read; the same cap as the groups overview. */
export const PEOPLE_CAP = 120;

/** A person group that could not be read at all. */
export function deniedPeople(groupId: number): PeopleGroup {
    return { groupId, denied: true, people: [], roles: [], fields: [] };
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

/** The entries of a `fields` answer as key/value pairs, whether it is an object or a list of `{ id | name, value }`. */
function fieldEntries(fields: unknown): [string, unknown][] {
    if (Array.isArray(fields)) {
        return fields.flatMap((entry): [string, unknown][] => {
            const e = entry as { id?: unknown; name?: unknown; fieldId?: unknown; value?: unknown } | null;
            const key = e?.id ?? e?.fieldId ?? e?.name;
            return key === undefined || key === null ? [] : [[String(key), e?.value]];
        });
    }
    return fields && typeof fields === 'object' ? Object.entries(fields as Record<string, unknown>) : [];
}

/**
 * The people of the group in the order ChurchTools sends them. `ownPersonId` is the account that asks – the device
 * itself, which sits in the group for the sake of the field rights and is no one to show.
 */
export function normalizeMembers(
    groupId: number,
    rawMembers: unknown[],
    rawRoles: unknown[] = [],
    rawFields: unknown[] = [],
    ownPersonId?: number,
): PeopleGroup {
    const definitions = new Map<string, string>();
    for (const field of rawFields as MemberFieldResponse[]) {
        const name = (field?.name ?? '').trim();
        const id = field?.id;
        if (name && id !== undefined && id !== null) definitions.set(String(id), name);
    }
    const roles: PeopleRole[] = [];
    for (const role of rawRoles as RoleResponse[]) {
        const id = idOf(role?.groupTypeRoleId);
        const name = (role?.name ?? '').trim();
        if (id !== null && name && !roles.some((r) => r.id === id)) roles.push({ id, name });
    }
    const fieldNames: string[] = [...new Set(definitions.values())];

    const people: Person[] = [];
    for (const member of rawMembers as MemberResponse[]) {
        if ((member?.groupMemberStatus ?? 'active') !== 'active') continue;
        const person = member?.person;
        if (person?.domainAttributes?.isArchived || person?.domainAttributes?.dateOfDeath) continue;
        const personId = idOf(member?.personId) ?? idOf(person?.domainIdentifier);
        if (ownPersonId !== undefined && personId === ownPersonId) continue;
        const firstName = (person?.domainAttributes?.firstName ?? '').trim();
        const lastName = (person?.domainAttributes?.lastName ?? '').trim();
        const name = `${firstName} ${lastName}`.trim() || (person?.title ?? '').trim();
        if (!name) continue;
        const fields: Record<string, string> = {};
        for (const [key, value] of fieldEntries(member.fields)) {
            const text = valueText(value);
            const fieldName = definitions.get(key) ?? key;
            if (text) fields[fieldName] = text;
            if (!fieldNames.includes(fieldName)) fieldNames.push(fieldName);
        }
        people.push({ firstName, lastName, name, imageUrl: person?.imageUrl || null, roleId: idOf(member.groupTypeRoleId), fields });
        if (people.length >= PEOPLE_CAP) break;
    }
    return { groupId, denied: false, people, roles, fields: fieldNames.map((name) => ({ key: name, name })) };
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

/** The fields of a person the block shows, in the block's order – only those the person has a value for. */
export function shownFields(person: Person, fieldKeys: readonly string[]): { key: string; text: string }[] {
    return fieldKeys.flatMap((key) => (person.fields[key] ? [{ key, text: person.fields[key]! }] : []));
}
