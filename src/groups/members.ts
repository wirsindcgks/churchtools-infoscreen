/**
 * Turns the members of the module's own group "Infoscreen-People" into the cards the `people` block shows
 * (schema 1.51, Plan.md 112; measured in G70 and G71).
 *
 * The source is `GET /groups/{id}/members`. From each member only named fields are taken: first and last name, the
 * picture, the role and the member fields of the group. Everything else ChurchTools sends along (`guid`, addresses,
 * `comment`) never leaves this file. Archived and deceased people drop out, so do members that are not active and the
 * account that asks (the device itself).
 *
 * The type of a member field is not in the value: `GET /groups/{id}/memberfields` is read as well (G75), but only `id`, `name`,
 * `fieldTypeCode` and `options` of a definition are kept – they turn option ids into names and decide how a value is shown.
 *
 * `/persons` is read only with a release (Plan.md 112, Stück 3, G71): when an administrator released person fields and a
 * block chose some. Then `personFieldValues` keeps exactly those keys of the answer and drops the rest at once.
 */
import { markdownText } from '../ct/markdown';
import { LOCALE, tp } from '../i18n/player';
import type { Block, PeopleSort } from '../model/schema';

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
    /** The name in the language of the instance; `name` can be the key (G75: "leader"). */
    nameTranslated?: string | null;
}

/** An entry of `GET /groups/{id}/memberfields`, as far as this code reads it (G75). */
export interface MemberFieldDefResponse {
    field?: {
        id?: number | string | null;
        name?: string | null;
        fieldTypeCode?: string | null;
        options?: { id?: number | string | null; name?: string | null }[] | null;
    } | null;
}

interface FieldDef {
    type: string;
    name: string;
    options: Map<string, string>;
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
    /** How the view shows the values: a comment field as Markdown, a date and time in the instance's time zone (G75). */
    format?: 'markdown' | 'datetime';
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
    /** Only between `normalizeMembers(…, true)` and `withPersonFields`: the id `GET /persons` is asked for. It never stays on a person. */
    personId?: number | null;
    /** Person field key (`email`, `birthday` …) → shown value; only released and chosen keys (schema 1.54), empty values left out. */
    personFields?: Record<string, string>;
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
    /** The person field keys read for this group (released and chosen by a block); the view shows no others (schema 1.54). */
    personFieldKeys?: string[];
    /** Person field key → how the view shows it, where not plain: a comment field (`textarea`) as Markdown (Plan.md 115). */
    personFieldFormats?: Record<string, 'markdown'>;
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

function idText(value: unknown): string {
    return value === undefined || value === null ? '' : String(value).trim();
}

/** The fields of the group by id, as far as the definitions tell (G75). */
function fieldDefs(rawFieldDefs: unknown[]): Map<string, FieldDef> {
    const defs = new Map<string, FieldDef>();
    for (const raw of rawFieldDefs as MemberFieldDefResponse[]) {
        const field = raw?.field;
        const id = idText(field?.id);
        if (!id || !field) continue;
        const options = new Map<string, string>();
        for (const option of Array.isArray(field.options) ? field.options : []) {
            const optionId = idText(option?.id);
            const name = (option?.name ?? '').trim();
            if (optionId && name) options.set(optionId, name);
        }
        defs.set(id, { type: (field.fieldTypeCode ?? '').trim(), name: (field.name ?? '').trim(), options });
    }
    return defs;
}

/** A tick shows as the field's name; "0" is also what members get for whom nothing was ever set, so only "1"/`true` counts. */
function checkboxText(value: unknown, name: string): string {
    const on = value === true || value === 1 || value === '1' || (typeof value === 'string' && value.trim() === '1');
    return on ? name : '';
}

/** `1980-05-17` → `17.05.1980`. */
function dateText(value: unknown): string {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(typeof value === 'string' ? value.trim() : '');
    return match ? `${match[3]}.${match[2]}.${match[1]}` : '';
}

function numberText(value: unknown): string {
    const text = valueText(value);
    const number = text === '' ? NaN : Number(text);
    return Number.isFinite(number) ? number.toLocaleString(LOCALE, { useGrouping: false, maximumFractionDigits: 20 }) : '';
}

/** What a member field's value shows, by the type of its definition (G75); without a definition the value as it comes. */
function memberValueText(value: unknown, def: FieldDef | undefined, label: string): string {
    switch (def?.type) {
        case 'select':
        case 'radioselect':
            return def.options.get(idText(value)) ?? '';
        case 'multiselect':
            return (Array.isArray(value) ? value : [value]).map((id) => def.options.get(idText(id)) ?? '').filter(Boolean).join(', ');
        case 'checkbox':
            return checkboxText(value, def.name || label);
        case 'date':
            return dateText(value);
        case 'number':
            return numberText(value);
        default:
            return valueText(value);
    }
}

function formatOf(def: FieldDef | undefined): PeopleField['format'] {
    return def?.type === 'textarea' ? 'markdown' : def?.type === 'datetime' ? 'datetime' : undefined;
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
    /** Keep the person's id for the one read of `/persons` (person fields); `withPersonFields` removes it again. */
    keepIds = false,
    /** The group's member field definitions (`GET /groups/{id}/memberfields`, G75): they give the types and the names of options. */
    rawFieldDefs: unknown[] = [],
): PeopleGroup {
    const defs = fieldDefs(rawFieldDefs);
    const roles: PeopleRole[] = [];
    for (const role of rawRoles as RoleResponse[]) {
        const id = idOf(role?.groupTypeRoleId);
        const name = (role?.nameTranslated ?? '').trim() || (role?.name ?? '').trim();
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
            // A field the church named differently now is the same field: the id is what counts, the name is only shown.
            const label = (field.name ?? '').trim() || id;
            const text = memberValueText(field.value, defs.get(id), label);
            if (text) fields[id] = text;
            if (!seenFields.has(id)) seenFields.set(id, { name: label, sortKey: typeof field.sortKey === 'number' ? field.sortKey : Infinity });
        }
        people.push({ firstName, lastName, name, imageUrl: person?.imageUrl || null, roleId: idOf(member.groupTypeRoleId), fields, ...(keepIds ? { personId } : {}) });
        if (people.length >= PEOPLE_CAP) break;
    }
    return { groupId, denied: false, people, roles, fields: [...seenFields].sort((a, b) => a[1].sortKey - b[1].sortKey).map(([key, { name }]) => ({ key, name, ...(formatOf(defs.get(key)) ? { format: formatOf(defs.get(key)) } : {}) })) };
}

/** An entry of `GET /persons`, as far as this code reads it – only the keys a block chose are ever taken from it. */
type PersonRecord = Record<string, unknown> & { id?: number | string | null };

/** What `personFieldValues` needs of a field definition (`GET /fields`): the key, the name and the type. */
export interface PersonFieldDef {
    key: string;
    name: string;
    type: string;
}

/** `1980-05-17` → `17.05.`: the day and month, never the year (Plan.md 112, Stück 3). Anything else is left out. */
function birthdayText(value: unknown): string {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(typeof value === 'string' ? value.trim() : '');
    return match ? `${match[3]}.${match[2]}.` : '';
}

/** What a person field shows, by the type of its definition (Plan.md 115); without one (or of another type) the value as text. */
function personValueText(key: string, value: unknown, def: PersonFieldDef | undefined): string {
    if (key === 'birthday') return birthdayText(value);
    switch (def?.type) {
        case 'date':
            return dateText(value);
        case 'number':
            return numberText(value);
        case 'checkbox':
            return checkboxText(value, def.name || key);
        case 'select':
        case 'multiselect':
        case 'radioselect':
            // Options come with their own names and levels (G76) – not offered yet, so nothing shows even where a block names one.
            return '';
        default:
            return valueText(value);
    }
}

/**
 * The chosen person fields of each person from the answer of `GET /persons`: by person id, only the keys in `keys` (the
 * released ones a block chose). Everything else in the answer is dropped here. `defs` (`GET /fields`) give the types; without
 * them only text values and `birthday` come through.
 */
export function personFieldValues(rawPersons: unknown[], keys: readonly string[], defs: readonly PersonFieldDef[] = []): Map<number, Record<string, string>> {
    const result = new Map<number, Record<string, string>>();
    for (const raw of rawPersons as PersonRecord[]) {
        const id = idOf(raw?.id);
        if (id === null) continue;
        const values: Record<string, string> = {};
        for (const key of keys) {
            const text = personValueText(key, raw[key], defs.find((d) => d.key === key));
            if (text) values[key] = text;
        }
        result.set(id, values);
    }
    return result;
}

/** The keys among `keys` that are comment fields by their definition: their text shows as Markdown. Without definitions none. */
export function personFieldFormats(keys: readonly string[], defs: readonly PersonFieldDef[] = []): Record<string, 'markdown'> {
    return Object.fromEntries(keys.filter((key) => defs.some((d) => d.key === key && d.type === 'textarea')).map((key) => [key, 'markdown' as const]));
}

/** The group with the person fields put on its people; `keys` are the ones read, `formats` come from `personFieldFormats`. */
export function withPersonFields(group: PeopleGroup, values: ReadonlyMap<number, Record<string, string>>, keys: readonly string[], formats: Record<string, 'markdown'> = {}): PeopleGroup {
    return {
        ...group,
        personFieldKeys: [...keys],
        ...(Object.keys(formats).length ? { personFieldFormats: formats } : {}),
        people: group.people.map(({ personId, ...p }) => ({ ...p, personFields: (personId != null && values.get(personId)) || {} })),
    };
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
export function shownFields(person: Person, fieldKeys: readonly string[], fields: readonly PeopleField[] = []): { key: string; text: string; format?: PeopleField['format'] }[] {
    return fieldKeys.flatMap((key) => {
        if (!person.fields[key]) return [];
        const format = fields.find((f) => f.key === key)?.format;
        return [{ key, text: person.fields[key]!, ...(format ? { format } : {}) }];
    });
}

/**
 * The person fields of a person the block shows: the block's order, but only keys the group was read for – a field an
 * administrator withdrew since is gone, even where the block still names it.
 */
export function shownPersonFields(person: Person, group: PeopleGroup | undefined, fieldKeys: readonly string[] | undefined): { key: string; text: string; format?: 'markdown' }[] {
    const read = group?.personFieldKeys ?? [];
    return (fieldKeys ?? []).flatMap((key) => {
        if (!read.includes(key) || !person.personFields?.[key]) return [];
        const format = group?.personFieldFormats?.[key];
        return [{ key, text: person.personFields[key]!, ...(format ? { format } : {}) }];
    });
}

// --- the name from fields (schema 1.60, Plan.md 115 B) ---

/** What the name is when the block has no pattern. */
export const DEFAULT_NAME_FORMAT = '{firstName} {lastName}';
const PLACEHOLDER = /\{([A-Za-z0-9_]{1,64})\}/g;

/** The person field keys a pattern names (not `firstName` and `lastName`), each once – they must be read like the entries. */
export function nameFormatKeys(format: string | undefined): string[] {
    return [...new Set([...(format ?? '').matchAll(PLACEHOLDER)].map((m) => m[1]!))].filter((key) => key !== 'firstName' && key !== 'lastName');
}

/**
 * The name of a person after the block's pattern. `{firstName}` and `{lastName}` come from the member data, a person field only
 * if the group was read for it (released and chosen – `group.personFieldKeys`); an unknown or empty placeholder is empty. Brackets
 * left empty go, spaces are gathered and trimmed; nothing left: the name as it is without a pattern.
 */
export function composeName(person: Person, group: PeopleGroup | undefined, format: string | undefined): string {
    if (format === undefined || format === DEFAULT_NAME_FORMAT) return person.name;
    const read = group?.personFieldKeys ?? [];
    const value = (key: string): string => {
        if (key === 'firstName') return person.firstName;
        if (key === 'lastName') return person.lastName;
        const text = read.includes(key) ? (person.personFields?.[key] ?? '') : '';
        return group?.personFieldFormats?.[key] === 'markdown' ? markdownText(text) : text;
    };
    // An empty placeholder right before brackets hands its place to them: "{nickname} ({firstName}) {lastName}" without a
    // nickname is "Valentin Mustermann", not "(Valentin) Mustermann" (#280).
    const unwrapped = format.replace(/\{([A-Za-z0-9_]{1,64})\}(\s*)[([]([^()[\]]*)[)\]]/g, (whole, key: string, gap: string, inner: string) => (value(key).trim() ? whole : `${gap}${inner}`));
    let name = unwrapped.replace(PLACEHOLDER, (_, key: string) => value(key));
    for (let before = ''; before !== name; ) {
        before = name;
        name = name.replace(/\(\s*\)|\[\s*\]/g, '');
    }
    name = name.replace(/\s+/g, ' ').trim();
    return name || person.name;
}

// --- one list "Angaben" (schema 1.56, Plan.md 114 B): role, member fields and person fields in one order ---

type PeopleBlock = Extract<Block, { type: 'people' }>;

/** The role in the group, as an entry. */
export const ROLE_ENTRY = 'role';
export const memberEntry = (id: string): string => `member:${id}`;
export const personEntry = (key: string): string => `person:${key}`;

/**
 * The entries a block shows under the name, in its order. A block from before 1.56 has none: then the order from before
 * holds – in the list the role first, on cards none, then the member fields (names mapped to ids), then the person fields.
 * A member entry is mapped like `fieldKeys`, so a name written by hand still finds its field.
 */
export function peopleEntries(block: Pick<PeopleBlock, 'entries' | 'fieldKeys' | 'personFieldKeys' | 'layout'>, fields: readonly PeopleField[] = []): string[] {
    if (block.entries) {
        return block.entries.map(({ key }) => (key.startsWith('member:') ? memberEntry(resolveFieldKeys([key.slice(7)], fields)[0]!) : key));
    }
    return [
        ...(block.layout === 'list' ? [ROLE_ENTRY] : []),
        ...resolveFieldKeys(block.fieldKeys, fields).map(memberEntry),
        ...(block.personFieldKeys ?? []).map(personEntry),
    ];
}

/** The keys of the entries pinned to the right (schema 1.57), in the form `peopleEntries` gives; a block without `entries` has none. */
export function rightEntries(block: Pick<PeopleBlock, 'entries' | 'fieldKeys' | 'personFieldKeys' | 'layout'>, fields: readonly PeopleField[] = []): string[] {
    if (!block.entries) return [];
    const keys = peopleEntries(block, fields);
    return keys.filter((_, i) => block.entries![i]!.right);
}

/**
 * What the designer writes for a list of entries: `entries` and, in the same order, `fieldKeys` and `personFieldKeys` – so
 * a player before 1.56 and `peopleNeeds` keep reading what they know. An empty list stays `[]`, so the order from before
 * does not come back.
 */
export function entriesPatch(keys: readonly string[], right: readonly string[] = []): Pick<PeopleBlock, 'entries' | 'fieldKeys' | 'personFieldKeys'> {
    const personFieldKeys = keys.flatMap((key) => (key.startsWith('person:') ? [key.slice(7)] : []));
    return {
        entries: keys.map((key) => (right.includes(key) ? { key, right: true as const } : { key })),
        fieldKeys: keys.flatMap((key) => (key.startsWith('member:') ? [key.slice(7)] : [])),
        personFieldKeys: personFieldKeys.length ? personFieldKeys : undefined,
    };
}

/** One entry shown for a person: its text, and how a member field is to be shown (`shownFields`). */
export interface ShownEntry {
    key: string;
    text: string;
    format?: PeopleField['format'];
}

/**
 * What a person shows under the name, in the block's order, only entries with a value: the role's name, the member
 * fields, the person fields the group was read for (`shownPersonFields`).
 */
export function shownEntries(person: Person, group: PeopleGroup | undefined, entries: readonly string[]): ShownEntry[] {
    return entries.flatMap((entry): ShownEntry[] => {
        if (entry === ROLE_ENTRY) {
            const name = group?.roles.find((r) => r.id === person.roleId)?.name;
            return name ? [{ key: entry, text: name }] : [];
        }
        if (entry.startsWith('member:')) return shownFields(person, [entry.slice(7)], group?.fields).map((f) => ({ ...f, key: entry }));
        if (entry.startsWith('person:')) return shownPersonFields(person, group, [entry.slice(7)]).map((f) => ({ ...f, key: entry }));
        return [];
    });
}
