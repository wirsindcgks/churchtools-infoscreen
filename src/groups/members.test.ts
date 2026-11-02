import { describe, expect, it } from 'vitest';
import { deniedPeople, normalizeMembers, selectPeople, shownFields, PEOPLE_CAP, type PeopleGroup } from './members';

const member = (personId: number, first: string, last: string, extra: Record<string, unknown> = {}) => ({
    personId,
    groupTypeRoleId: 5,
    groupMemberStatus: 'active',
    person: { title: `${last}, ${first}`, imageUrl: `https://x.example/images/${personId}`, domainAttributes: { firstName: first, lastName: last, guid: `guid-${personId}` } },
    fields: {},
    ...extra,
});
const roles = [
    { groupTypeRoleId: 5, name: 'Teilnehmer' },
    { groupTypeRoleId: 6, name: 'Leiter' },
];
const fieldDefinitions = [
    { id: 2, name: 'Funktion' },
    { id: 5, name: 'Büro' },
];

describe('normalizeMembers (Plan.md 112, G70)', () => {
    it('keeps name, picture, role and the named member fields – nothing else of a person', () => {
        const group = normalizeMembers(40, [member(1, 'Anna', 'Berg', { fields: { '2': 'Pastorin', '5': ' 12 ' }, comment: 'privat', email: 'a@x.example' })], roles, fieldDefinitions);
        expect(group.denied).toBe(false);
        expect(group.people).toEqual([
            { firstName: 'Anna', lastName: 'Berg', name: 'Anna Berg', imageUrl: 'https://x.example/images/1', roleId: 5, fields: { Funktion: 'Pastorin', Büro: '12' } },
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
            fieldDefinitions,
            22,
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

    it('reads fields by name too, as a list, and leaves out empty values', () => {
        const byName = normalizeMembers(40, [member(1, 'A', 'B', { fields: { Funktion: 'Leitung', Büro: '' } })]);
        expect(byName.people[0]!.fields).toEqual({ Funktion: 'Leitung' });
        expect(byName.fields.map((f) => f.key)).toEqual(['Funktion', 'Büro']);
        const asList = normalizeMembers(40, [member(1, 'A', 'B', { fields: [{ id: 2, value: 'Pastorin' }, { name: 'Raum', value: ['A', 'B'] }] })], roles, fieldDefinitions);
        expect(asList.people[0]!.fields).toEqual({ Funktion: 'Pastorin', Raum: 'A, B' });
    });

    it('offers the roles and fields there are to choose from – the defined ones first, each once', () => {
        const group = normalizeMembers(40, [member(1, 'A', 'B', { fields: { '5': 'x', '9': 'y' } })], [...roles, roles[0]!], fieldDefinitions);
        expect(group.roles).toEqual([{ id: 5, name: 'Teilnehmer' }, { id: 6, name: 'Leiter' }]);
        expect(group.fields.map((f) => f.key)).toEqual(['Funktion', 'Büro', '9']);
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
        const [person] = normalizeMembers(40, [member(1, 'A', 'B', { fields: { Funktion: 'Pastorin', Büro: '12' } })]).people;
        expect(shownFields(person!, ['Büro', 'Raum', 'Funktion'])).toEqual([
            { key: 'Büro', text: '12' },
            { key: 'Funktion', text: 'Pastorin' },
        ]);
    });
});
