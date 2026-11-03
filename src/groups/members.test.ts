import { describe, expect, it } from 'vitest';
import { deniedPeople, normalizeMembers, resolveFieldKeys, selectPeople, shownFields, PEOPLE_CAP, type PeopleGroup } from './members';

const member = (personId: number, first: string, last: string, extra: Record<string, unknown> = {}) => ({
    personId,
    groupTypeRoleId: 5,
    groupMemberStatus: 'active',
    person: { title: `${last}, ${first}`, imageUrl: `https://x.example/images/${personId}`, domainAttributes: { firstName: first, lastName: last, guid: `guid-${personId}` } },
    fields: [],
    ...extra,
});
const roles = [
    { groupTypeRoleId: 5, name: 'Teilnehmer' },
    { groupTypeRoleId: 6, name: 'Leiter' },
];
/** The measured form (G71): a list of `{ id, name, value, sortKey }`. */
const field = (id: number, name: string, value: unknown, sortKey = id) => ({ id, name, value, sortKey });

describe('normalizeMembers (Plan.md 112, G70)', () => {
    it('keeps name, picture, role and the named member fields – nothing else of a person', () => {
        const group = normalizeMembers(40, [member(1, 'Anna', 'Berg', { fields: [field(2, 'Funktion', 'Pastorin'), field(5, 'Büro', ' 12 ')], comment: 'privat', email: 'a@x.example' })], roles);
        expect(group.denied).toBe(false);
        expect(group.people).toEqual([
            { firstName: 'Anna', lastName: 'Berg', name: 'Anna Berg', imageUrl: 'https://x.example/images/1', roleId: 5, fields: { '2': 'Pastorin', '5': '12' } },
        ]);
        // No id, no guid, no comment, no address anywhere in what leaves the file.
        const text = JSON.stringify(group);
        for (const leak of ['guid-1', 'privat', 'a@x.example', 'personId']) expect(text).not.toContain(leak);
    });

    it('drops the device itself, archived and deceased people and members that are not active', () => {
        const group = normalizeMembers(
            40,
            [
                member(22, 'Foyer', 'TV'),
                member(2, 'Archiv', 'Alt', { person: { title: 'Alt, Archiv', domainAttributes: { firstName: 'Archiv', lastName: 'Alt', isArchived: true } } }),
                member(3, 'Tot', 'Mann', { person: { title: 'Mann, Tot', domainAttributes: { firstName: 'Tot', lastName: 'Mann', dateOfDeath: '2020-01-01' } } }),
                member(4, 'Warte', 'Liste', { groupMemberStatus: 'waiting' }),
                member(1, 'Anna', 'Berg'),
            ],
            roles,
            [22],
        );
        expect(group.people.map((p) => p.name)).toEqual(['Anna Berg']);
    });

    it('falls back to the title without name parts, drops a nameless member, and shows no picture without an address', () => {
        const group = normalizeMembers(40, [
            member(1, '', '', { person: { title: 'Pastor Berg', domainAttributes: {} } }),
            member(2, '', '', { person: { title: '  ', domainAttributes: {} } }),
        ]);
        expect(group.people).toEqual([expect.objectContaining({ name: 'Pastor Berg', imageUrl: null })]);
    });

    it('reads the fields as the list ChurchTools sends, by id, and leaves out empty values and entries without an id', () => {
        const group = normalizeMembers(40, [member(1, 'A', 'B', { fields: [field(2, 'Funktion', 'Leitung'), field(5, 'Büro', ''), field(7, 'Raum', ['A', 'B']), { name: 'Ohne Id', value: 'x' }] })]);
        expect(group.people[0]!.fields).toEqual({ '2': 'Leitung', '7': 'A, B' });
        // An object keyed by id is not the measured form: nothing is read from it.
        expect(normalizeMembers(40, [member(1, 'A', 'B', { fields: { '2': 'Pastorin' } as never })]).people[0]!.fields).toEqual({});
    });

    it('leaves out every device account of the setup, whoever asks', () => {
        const group = normalizeMembers(40, [member(22, 'A', 'TV'), member(23, 'B', 'TV'), member(1, 'Anna', 'Berg')], roles, [22, 23]);
        expect(group.people.map((p) => p.name)).toEqual(['Anna Berg']);
    });

    it('offers the roles and fields there are to choose from – the fields in the order of the group, each once', () => {
        const group = normalizeMembers(40, [member(1, 'A', 'B', { fields: [field(9, 'Raum', 'y', 3), field(5, 'Büro', 'x', 1)] })], [...roles, roles[0]!]);
        expect(group.roles).toEqual([{ id: 5, name: 'Teilnehmer' }, { id: 6, name: 'Leiter' }]);
        expect(group.fields).toEqual([{ key: '5', name: 'Büro' }, { key: '9', name: 'Raum' }]);
    });

    it('takes no more people than a card wall can show', () => {
        const many = Array.from({ length: PEOPLE_CAP + 20 }, (_, i) => member(i + 1, 'P', String(i)));
        expect(normalizeMembers(40, many).people).toHaveLength(PEOPLE_CAP);
    });

    it('marks a group the device may not read as such – not as empty', () => {
        expect(deniedPeople(40)).toEqual({ groupId: 40, denied: true, people: [], roles: [], fields: [] });
    });
});

describe('selectPeople', () => {
    const group: PeopleGroup = normalizeMembers(
        40,
        [
            member(1, 'Zoe', 'Adler', { groupTypeRoleId: 5 }),
            member(2, 'Ben', 'Zorn', { groupTypeRoleId: 6 }),
            member(3, 'Cleo', 'Adler', { groupTypeRoleId: 6 }),
            member(4, 'Dora', 'Adler', { groupTypeRoleId: 7 }),
        ],
        roles,
    );
    const names = (people: { name: string }[]) => people.map((p) => p.name);

    it('sorts by last name, then first name – or by first name – by default last name', () => {
        expect(names(selectPeople(group, []))).toEqual(['Cleo Adler', 'Dora Adler', 'Zoe Adler', 'Ben Zorn']);
        expect(names(selectPeople(group, [], 'first-name'))).toEqual(['Ben Zorn', 'Cleo Adler', 'Dora Adler', 'Zoe Adler']);
    });

    it('sorts by role in the order of the roles, a role the group does not know last', () => {
        expect(names(selectPeople(group, [], 'role'))).toEqual(['Zoe Adler', 'Cleo Adler', 'Ben Zorn', 'Dora Adler']);
    });

    it('shows only the chosen roles, every role without a choice', () => {
        expect(names(selectPeople(group, [6]))).toEqual(['Cleo Adler', 'Ben Zorn']);
        expect(selectPeople(group, [99])).toEqual([]);
    });

    it('shows nobody for a missing or denied group', () => {
        expect(selectPeople(undefined, [])).toEqual([]);
        expect(selectPeople(deniedPeople(40), [])).toEqual([]);
    });
});

describe('shownFields', () => {
    it('lists the chosen fields in the order of the block, only those with a value', () => {
        const [person] = normalizeMembers(40, [member(1, 'A', 'B', { fields: [field(1, 'Funktion', 'Pastorin'), field(2, 'Büro', '12')] })]).people;
        expect(shownFields(person!, ['2', '9', '1'])).toEqual([
            { key: '2', text: '12' },
            { key: '1', text: 'Pastorin' },
        ]);
    });
});

describe('fields by id (Plan.md 112)', () => {
    const before = normalizeMembers(40, [member(1, 'Anna', 'Berg', { fields: [field(2, 'funktion', 'Pastorin'), field(5, 'buero', '12')] })]);
    // The church renames the fields in ChurchTools; the ids stay.
    const after = normalizeMembers(40, [member(1, 'Anna', 'Berg', { fields: [field(2, 'Funktion', 'Pastorin'), field(5, 'Büro', '12')] })]);

    it('keeps a chosen field across a rename: same id, the current name is shown', () => {
        expect(before.fields).toEqual([{ key: '2', name: 'funktion' }, { key: '5', name: 'buero' }]);
        expect(after.fields).toEqual([{ key: '2', name: 'Funktion' }, { key: '5', name: 'Büro' }]);
        expect(shownFields(after.people[0]!, ['5', '2'])).toEqual([{ key: '5', text: '12' }, { key: '2', text: 'Pastorin' }]);
    });

    it('maps the names an older block stored to the ids – when exactly one field has the name', () => {
        expect(resolveFieldKeys(['Büro', 'Funktion'], after.fields)).toEqual(['5', '2']);
        // Ids stay as they are, also when one looks like a name.
        expect(resolveFieldKeys(['5', '2'], after.fields)).toEqual(['5', '2']);
    });

    it('leaves a name as it is when no field or more than one field has it – it then shows nothing', () => {
        const twice = [{ key: '1', name: 'Raum' }, { key: '2', name: 'Raum' }];
        expect(resolveFieldKeys(['Raum', 'Telefon'], twice)).toEqual(['Raum', 'Telefon']);
        expect(shownFields(after.people[0]!, resolveFieldKeys(['Gibt es nicht'], after.fields))).toEqual([]);
    });
});
