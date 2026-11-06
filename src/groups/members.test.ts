import { describe, expect, it } from 'vitest';
import { deniedPeople, entriesPatch, normalizeMembers, peopleEntries, rightEntries, shownEntries, personFieldValues, resolveFieldKeys, selectPeople, shownFields, shownPersonFields, withPersonFields, PEOPLE_CAP, type PeopleGroup } from './members';

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

describe('person fields (Plan.md 112, Stück 3, G71)', () => {
    const persons = [{ id: 1, email: 'anna@example.org', mobile: ' 0170 1 ', zip: 34117, birthday: '1980-05-17', street: 'Weg 1', guid: 'g' }];

    it('keeps exactly the keys asked for, formats the birthday without the year and drops everything else of the answer', () => {
        const values = personFieldValues(persons, ['email', 'zip', 'birthday', 'street']);
        expect([...values]).toEqual([[1, { email: 'anna@example.org', zip: '34117', birthday: '17.05.' }]]);
        expect(JSON.stringify([...values])).not.toMatch(/1980|Weg|0170|guid/);
        expect(personFieldValues([{ id: 2, birthday: 'garbled' }], ['birthday']).get(2)).toEqual({});
    });

    it('puts the values on the people by id, removes the id again and leaves a person without values empty', () => {
        const group = normalizeMembers(40, [member(1, 'Anna', 'Berg'), member(2, 'Ben', 'Adler')], roles, [], true);
        expect(group.people[0]!.personId).toBe(1);
        const done = withPersonFields(group, personFieldValues(persons, ['email']), ['email']);
        expect(done.personFieldKeys).toEqual(['email']);
        expect(done.people.map((p) => p.personFields)).toEqual([{ email: 'anna@example.org' }, {}]);
        expect(JSON.stringify(done)).not.toContain('personId');
        expect(normalizeMembers(40, [member(1, 'Anna', 'Berg')], roles).people[0]).not.toHaveProperty('personId');
    });

    it('shows a person field only if the group was read for it, in the block\'s order', () => {
        const anna = { ...normalizeMembers(40, [member(1, 'Anna', 'Berg')], roles).people[0]!, personFields: { email: 'a@x.example', city: 'Kassel' } };
        const read: PeopleGroup = { groupId: 40, denied: false, people: [anna], roles: [], fields: [], personFieldKeys: ['city', 'email'] };
        expect(shownPersonFields(anna, read, ['email', 'city', 'zip']).map((f) => f.key)).toEqual(['email', 'city']);
        expect(shownPersonFields(anna, { ...read, personFieldKeys: ['city'] }, ['email', 'city']).map((f) => f.key)).toEqual(['city']);
        expect(shownPersonFields(anna, { ...read, personFieldKeys: undefined }, ['email'])).toEqual([]);
        expect(shownPersonFields(anna, read, undefined)).toEqual([]);
    });
});

describe('member field types and translated roles (Plan.md 114, G75)', () => {
    const def = (id: number, fieldTypeCode: string, name = `Feld ${id}`, options: { id: string; name: string }[] = []) => ({ type: 'group', field: { id, name, fieldTypeCode, options } });
    const colors = [{ id: '4', name: 'Rot' }, { id: '16', name: 'Blau' }, { id: '19', name: 'Grün' }];
    const defs = [
        def(1, 'select', 'Farbe', colors),
        def(2, 'radioselect', 'Radio', colors),
        def(3, 'multiselect', 'Mehrfach', colors),
        def(4, 'checkbox', 'Taufe'),
        def(5, 'date', 'Datum'),
        def(6, 'number', 'Zahl'),
        def(7, 'datetime', 'Zeit'),
        def(8, 'textarea', 'Kommentar'),
        def(9, 'text', 'Text'),
    ];
    const valuesOf = (values: [number, unknown][], fieldDefs: unknown[] = defs) => {
        const group = normalizeMembers(40, [member(1, 'A', 'B', { fields: values.map(([id, value]) => field(id, `Feld ${id}`, value)) })], roles, [], false, fieldDefs);
        return { fields: group.people[0]!.fields, group };
    };

    it('names a role by its translated name and falls back to the name', () => {
        const group = normalizeMembers(40, [], [{ groupTypeRoleId: 5, name: 'leader', nameTranslated: ' Leiter ' }, { groupTypeRoleId: 6, name: 'participant' }]);
        expect(group.roles).toEqual([{ id: 5, name: 'Leiter' }, { id: 6, name: 'participant' }]);
    });

    it('turns option ids into names and leaves out unknown ones', () => {
        expect(valuesOf([[1, '16'], [2, '4'], [3, ['19', '4']]]).fields).toEqual({ '1': 'Blau', '2': 'Rot', '3': 'Grün, Rot' });
        expect(valuesOf([[1, '99'], [2, null], [3, ['98', '99']]]).fields).toEqual({});
        expect(valuesOf([[3, ['99', '16']]]).fields).toEqual({ '3': 'Blau' });
    });

    it('shows a checked box as the name of the field and an unchecked one not at all', () => {
        expect(valuesOf([[4, '1']]).fields).toEqual({ '4': 'Taufe' });
        expect(valuesOf([[4, '0']]).fields).toEqual({});
        expect(valuesOf([[4, false]]).fields).toEqual({});
        expect(valuesOf([[4, true]]).fields).toEqual({ '4': 'Taufe' });
        expect(valuesOf([[4, 1]]).fields).toEqual({ '4': 'Taufe' });
    });

    it('writes a date and a number the German way', () => {
        expect(valuesOf([[5, '2026-11-24']]).fields).toEqual({ '5': '24.11.2026' });
        expect(valuesOf([[5, 'morgen']]).fields).toEqual({});
        expect(valuesOf([[6, '12.5']]).fields).toEqual({ '6': '12,5' });
        expect(valuesOf([[6, '12345']]).fields).toEqual({ '6': '12345' });
        expect(valuesOf([[6, 'viel']]).fields).toEqual({});
    });

    it('keeps a date and time raw and marks it, and marks a comment field as Markdown', () => {
        const { fields, group } = valuesOf([[7, '2026-11-24T18:30:00Z'], [8, '**fett**\n\n- eins'], [9, ' Text ']]);
        expect(fields).toEqual({ '7': '2026-11-24T18:30:00Z', '8': '**fett**\n\n- eins', '9': 'Text' });
        expect(group.fields.filter((f) => f.format).map((f) => [f.key, f.format])).toEqual([['7', 'datetime'], ['8', 'markdown']]);
        expect(shownFields(group.people[0]!, ['8', '9', '7'], group.fields)).toEqual([
            { key: '8', text: '**fett**\n\n- eins', format: 'markdown' },
            { key: '9', text: 'Text' },
            { key: '7', text: '2026-11-24T18:30:00Z', format: 'datetime' },
        ]);
    });

    it('takes the field name of the value where the definition has none, and behaves as before without definitions', () => {
        const noName = [{ type: 'group', field: { id: 4, fieldTypeCode: 'checkbox' } }];
        expect(valuesOf([[4, '1']], noName).fields).toEqual({ '4': 'Feld 4' });
        expect(valuesOf([[1, '16'], [4, '0'], [3, ['4', '16']]], []).fields).toEqual({ '1': '16', '4': '0', '3': '4, 16' });
        expect(valuesOf([[1, '16']], [null, { field: null }, 'x']).fields).toEqual({ '1': '16' });
    });
});

describe('one list of entries (Plan.md 114 B, schema 1.56)', () => {
    const fields = [{ key: '11', name: 'Aufgabe' }, { key: '12', name: 'Notiz', format: 'markdown' as const }];

    it('derives the order from before for a block without entries: the role first in the list, none on cards', () => {
        const block = { fieldKeys: ['Aufgabe', '12'], personFieldKeys: ['email' as const] };
        expect(peopleEntries({ ...block, layout: 'list' }, fields)).toEqual(['role', 'member:11', 'member:12', 'person:email']);
        expect(peopleEntries({ ...block, layout: 'card' }, fields)).toEqual(['member:11', 'member:12', 'person:email']);
        expect(peopleEntries({ fieldKeys: [], layout: 'card' })).toEqual([]);
    });

    it('takes the entries as they stand where the block has them, in both layouts – also none at all', () => {
        const entries = [{ key: 'person:city' }, { key: 'role' }, { key: 'member:Aufgabe' }];
        expect(peopleEntries({ entries, fieldKeys: ['11'], layout: 'card' }, fields)).toEqual(['person:city', 'role', 'member:11']);
        expect(peopleEntries({ entries: [], fieldKeys: [], layout: 'list' })).toEqual([]);
    });

    it('writes the member and person fields alongside, in the order of the entries', () => {
        expect(entriesPatch(['person:city', 'member:12', 'role', 'member:11', 'person:email'])).toEqual({
            entries: [{ key: 'person:city' }, { key: 'member:12' }, { key: 'role' }, { key: 'member:11' }, { key: 'person:email' }],
            fieldKeys: ['12', '11'],
            personFieldKeys: ['city', 'email'],
        });
        expect(entriesPatch(['role'])).toEqual({ entries: [{ key: 'role' }], fieldKeys: [], personFieldKeys: undefined });
    });

    it('writes the pin only as true, and reads the pinned keys in the form peopleEntries gives (schema 1.57)', () => {
        expect(entriesPatch(['role', 'member:11', 'person:city'], ['member:11', 'person:email']).entries).toEqual([{ key: 'role' }, { key: 'member:11', right: true }, { key: 'person:city' }]);
        expect(rightEntries({ fieldKeys: ['11'], layout: 'list' })).toEqual([]);
        const entries = [{ key: 'person:city', right: true as const }, { key: 'role' }, { key: 'member:Aufgabe', right: true as const }];
        expect(rightEntries({ entries, fieldKeys: [], layout: 'card' }, fields)).toEqual(['person:city', 'member:11']);
    });

    it('shows the entries of a person in their order, only those with a value', () => {
        const group: PeopleGroup = {
            ...normalizeMembers(40, [member(1, 'Anna', 'Berg')], roles),
            fields,
            personFieldKeys: ['city'],
        };
        const anna = { ...group.people[0]!, fields: { 11: 'Technik', 12: '**Ton**' }, personFields: { city: 'Kassel', email: 'a@x.example' } };
        expect(shownEntries(anna, group, ['person:city', 'member:12', 'role', 'member:11', 'person:email', 'member:99'])).toEqual([
            { key: 'person:city', text: 'Kassel' },
            { key: 'member:12', text: '**Ton**', format: 'markdown' },
            { key: 'role', text: 'Teilnehmer' },
            { key: 'member:11', text: 'Technik' },
        ]);
        expect(shownEntries({ ...anna, roleId: null }, group, ['role'])).toEqual([]);
    });
});
