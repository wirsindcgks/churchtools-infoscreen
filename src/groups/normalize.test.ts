import { describe, expect, it } from 'vitest';
import {
    homepageGroups,
    isValidHomepageHash,
    normalizeHomepage,
    normalizeHomepageList,
    placesText,
    selectGroups,
    whenText,
    type Group,
} from './normalize';

const BASE = 'https://example.church.tools';

/** A leader as ChurchTools sends it anonymously (G40) – with guid, id and addresses the block must not take. */
function leader(first: string, last: string, extra: Record<string, unknown> = {}) {
    return {
        domainType: 'person',
        domainIdentifier: '22',
        title: `${first} ${last}`,
        initials: `${first[0]}${last[0]}`,
        imageUrl: `${BASE}/images/99/secret`,
        apiUrl: `${BASE}/api/persons/22`,
        frontendUrl: `${BASE}/persons/22`,
        domainAttributes: { firstName: first, lastName: last, guid: 'GUID-1', dateOfDeath: null, isArchived: false, ...extra },
    };
}

/** One group of `/grouphomepages/{hash}`, shaped like Kinderkirche on the test instance (G40). */
function group(id: number, extra: Record<string, unknown> = {}, information: Record<string, unknown> = {}) {
    return {
        id,
        name: `Gruppe ${id}`,
        maxMemberCount: null,
        currentMemberCount: 0,
        requestedSeatsCount: 0,
        allowWaitinglist: false,
        canSignUp: true,
        signUpPersons: [{ person: { title: 'Geräte-Konto' } }],
        settings: { hideLogin: false },
        information: {
            note: '',
            imageUrl: null,
            meetingTime: '',
            weekday: null,
            targetGroup: null,
            groupCategory: null,
            color: 'lime',
            leader: [],
            ...information,
        },
        ...extra,
    };
}

function homepage(groups: unknown[], extra: Record<string, unknown> = {}) {
    return { showLeaders: true, showGroupImages: true, groups, ...extra };
}

describe('normalizeHomepageList', () => {
    it('takes parent group, title and the hash from the end of apiUrl', () => {
        const list = normalizeHomepageList([
            {
                domainType: 'grouphomepage',
                domainIdentifier: '4',
                title: 'Gottesdienst | Gottesdienste',
                apiUrl: `${BASE}/api/grouphomepages/abc123XYZ`,
                domainAttributes: { parentGroupId: 10, childGroupIds: [6, 7, 8, 9] },
            },
            {
                domainIdentifier: '1',
                title: 'Kinderkirche',
                apiUrl: `${BASE}/api/grouphomepages/def456/`,
                domainAttributes: { parentGroupId: 8, childGroupIds: [] },
            },
        ]);
        expect(list).toEqual([
            { parentGroupId: 10, title: 'Gottesdienst | Gottesdienste', hash: 'abc123XYZ' },
            { parentGroupId: 8, title: 'Kinderkirche', hash: 'def456' },
        ]);
    });

    it('drops entries whose hash would not be safe in a path, and those without a parent group', () => {
        const list = normalizeHomepageList([
            { title: 'A', apiUrl: `${BASE}/api/grouphomepages/..%2Fpersons`, domainAttributes: { parentGroupId: 1 } },
            { title: 'B', apiUrl: `${BASE}/api/grouphomepages/`, domainAttributes: { parentGroupId: 2 } },
            { title: 'C', apiUrl: `${BASE}/api/grouphomepages/ok1`, domainAttributes: {} },
            { title: 'D', apiUrl: `${BASE}/api/grouphomepages/ok2`, domainAttributes: { parentGroupId: '5' } },
        ]);
        expect(list).toEqual([{ parentGroupId: 5, title: 'D', hash: 'ok2' }]);
    });

    it('checks hashes like isValidHomepageHash in connect-churchtools', () => {
        expect(isValidHomepageHash('vjU0aB9')).toBe(true);
        expect(isValidHomepageHash('')).toBe(false);
        expect(isValidHomepageHash('a/b')).toBe(false);
        expect(isValidHomepageHash('a-b')).toBe(false);
    });
});

describe('normalizeHomepage', () => {
    it('takes only named fields – nothing about the account that asks', () => {
        const [g] = normalizeHomepage(
            homepage([
                group(
                    8,
                    { name: 'Kinderkirche', maxMemberCount: 12, currentMemberCount: 7, requestedSeatsCount: 2 },
                    {
                        note: '  Für Kinder von 3 bis 11.  ',
                        imageUrl: `${BASE}/images/5/hash`,
                        meetingTime: '10:00',
                        weekday: { id: 0, name: 'sunday', nameTranslated: 'Sonntag', sortKey: 6 },
                        targetGroup: { id: 1, name: 'everyone', nameTranslated: 'Jeder', sortKey: 1 },
                        groupCategory: { id: 1, name: 'Aktivitäten', sortKey: 10 },
                    },
                ),
            ]),
            `${BASE}/`,
        );
        expect(g).toEqual({
            id: 8,
            name: 'Kinderkirche',
            note: 'Für Kinder von 3 bis 11.',
            imageUrl: `${BASE}/images/5/hash`,
            weekday: 'Sonntag',
            weekdaySort: 6,
            meetingTime: '10:00',
            targetGroup: 'Jeder',
            category: 'Aktivitäten',
            color: '#84cc16',
            leaders: [],
            freePlaces: 3,
            waitinglist: false,
            publicUrl: `${BASE}/publicgroup/8`,
        } satisfies Group);
        expect(JSON.stringify(g)).not.toMatch(/canSignUp|signUpPersons|Geräte-Konto|settings/);
    });

    it('takes leaders by name and picture only – no guid, id or addresses (Plan.md 43, c)', () => {
        const [g] = normalizeHomepage(
            homepage([group(8, {}, { leader: [leader('Erika', 'Beispiel'), { ...leader('Max', 'Muster'), imageUrl: null }] })]),
            BASE,
        );
        expect(g!.leaders).toEqual([
            { name: 'Erika Beispiel', imageUrl: `${BASE}/images/99/secret` },
            { name: 'Max Muster', imageUrl: null },
        ]);
        expect(JSON.stringify(g)).not.toMatch(/GUID-1|persons\/22|"22"|EB/);
    });

    it('falls back to the title when a leader has no names', () => {
        const nameless = { ...leader('A', 'B'), title: 'Gemeindebüro', domainAttributes: { firstName: '', lastName: null } };
        const [g] = normalizeHomepage(homepage([group(8, {}, { leader: [nameless] })]), BASE);
        expect(g!.leaders.map((l) => l.name)).toEqual(['Gemeindebüro']);
    });

    it('leaves out archived and deceased leaders', () => {
        const [g] = normalizeHomepage(
            homepage([
                group(8, {}, {
                    leader: [
                        leader('Erika', 'Beispiel'),
                        leader('Alt', 'Archiv', { isArchived: true }),
                        leader('Ver', 'Storben', { dateOfDeath: '2025-01-01' }),
                    ],
                }),
            ]),
            BASE,
        );
        expect(g!.leaders.map((l) => l.name)).toEqual(['Erika Beispiel']);
    });

    it('takes no leaders unless the homepage itself shows them – whatever the response carries', () => {
        const groups = [group(8, {}, { leader: [leader('Erika', 'Beispiel')] })];
        expect(normalizeHomepage(homepage(groups, { showLeaders: false }), BASE)[0]!.leaders).toEqual([]);
        expect(normalizeHomepage(homepage(groups, { showLeaders: undefined }), BASE)[0]!.leaders).toEqual([]);
    });

    it('takes no image where the homepage shows no group images', () => {
        const groups = [group(8, {}, { imageUrl: `${BASE}/images/5/hash` })];
        expect(normalizeHomepage(homepage(groups, { showGroupImages: false }), BASE)[0]!.imageUrl).toBeNull();
    });

    it('says nothing about places without a maximum, and never less than none', () => {
        const [none, full] = normalizeHomepage(
            homepage([
                group(1, { maxMemberCount: null, currentMemberCount: 40 }),
                group(2, { maxMemberCount: 10, currentMemberCount: 9, requestedSeatsCount: 3, allowWaitinglist: true }),
            ]),
            BASE,
        );
        expect(none!.freePlaces).toBeNull();
        expect(full!.freePlaces).toBe(0);
        expect(full!.waitinglist).toBe(true);
    });

    it('drops groups without id or name, and survives an empty or odd response', () => {
        expect(normalizeHomepage(homepage([group(0), { ...group(3), name: ' ' }, { name: 'x' }]), BASE)).toEqual([]);
        expect(normalizeHomepage(null, BASE)).toEqual([]);
        expect(normalizeHomepage({ groups: null }, BASE)).toEqual([]);
    });

    it('does not read deeper levels (children)', () => {
        const groups = normalizeHomepage(homepage([group(1, { children: [group(2)] })]), BASE);
        expect(groups.map((g) => g.id)).toEqual([1]);
    });
});

describe('selectGroups', () => {
    const g = (id: number, weekdaySort: number | null, meetingTime = '', name = `Gruppe ${id}`): Group => ({
        id,
        name,
        note: '',
        imageUrl: null,
        weekday: '',
        weekdaySort,
        meetingTime,
        targetGroup: '',
        category: '',
        color: null,
        leaders: [],
        freePlaces: null,
        waitinglist: false,
        publicUrl: '',
    });

    it('without a choice: by weekday (sortKey, Monday first), then time, then name; no weekday last', () => {
        const sunday = g(1, 6); // Sunday has the id 0 but the sortKey 6
        const monday = g(2, 0, '19:30');
        const mondayEarly = g(3, 0, '09:00');
        const none = g(4, null, '', 'Aaa');
        const tuesdayB = g(5, 1, '', 'Bibelkreis');
        const tuesdayA = g(6, 1, '', 'Alphakurs');
        expect(selectGroups([sunday, monday, none, tuesdayB, mondayEarly, tuesdayA], []).map((x) => x.id)).toEqual([
            3, 2, 6, 5, 1, 4,
        ]);
    });

    it('with a choice: exactly those, in that order; one no longer on the homepage is gone', () => {
        expect(selectGroups([g(1, 0), g(2, 1), g(3, 2)], [3, 99, 1]).map((x) => x.id)).toEqual([3, 1]);
    });

    const named = [
        g(1, 0, '', 'Ökumene'),
        g(2, 0, '', 'Alphakurs'),
        g(3, 0, '', 'Hauskreis 10'),
        g(4, 0, '', 'Hauskreis 2'),
        g(5, 0, '', 'Zeltlager'),
    ];

    it('without a choice, by name A–Z: German order, numbers as numbers, equal names by id (Plan.md 72)', () => {
        expect(selectGroups(named, [], 'name-asc').map((x) => x.id)).toEqual([2, 4, 3, 1, 5]);
        expect(selectGroups([g(9, 0, '', 'Chor'), g(7, 0, '', 'Chor'), g(8, 0, '', 'Abend')], [], 'name-asc').map((x) => x.id)).toEqual([8, 7, 9]);
    });

    it('without a choice, by name Z–A: the names reversed, equal names still by id (Plan.md 72)', () => {
        expect(selectGroups(named, [], 'name-desc').map((x) => x.id)).toEqual([5, 1, 3, 4, 2]);
        expect(selectGroups([g(9, 0, '', 'Chor'), g(7, 0, '', 'Chor'), g(8, 0, '', 'Abend')], [], 'name-desc').map((x) => x.id)).toEqual([7, 9, 8]);
    });

    it('with a choice the order is ignored (Plan.md 72)', () => {
        expect(selectGroups(named, [5, 2, 4], 'name-asc').map((x) => x.id)).toEqual([5, 2, 4]);
        expect(selectGroups(named, [5, 2, 4], 'name-desc').map((x) => x.id)).toEqual([5, 2, 4]);
    });

    it('cuts at the cap after sorting, not before (Plan.md 72)', () => {
        const many = Array.from({ length: 60 }, (_, i) => g(i + 1, 0, '', `Gruppe ${String(i + 1).padStart(2, '0')}`));
        const shown = selectGroups(many, [], 'name-desc');
        expect(shown).toHaveLength(50);
        expect(shown.map((x) => x.id)).toEqual(Array.from({ length: 50 }, (_, i) => 60 - i));
    });
});

describe('homepageGroups', () => {
    it('finds the groups of a parent group, none without one', () => {
        const loaded = [{ parentGroupId: 10, groups: normalizeHomepage(homepage([group(8)]), BASE) }];
        expect(homepageGroups(loaded, 10).map((x) => x.id)).toEqual([8]);
        expect(homepageGroups(loaded, 11)).toEqual([]);
        expect(homepageGroups(loaded, undefined)).toEqual([]);
        expect(homepageGroups(undefined, 10)).toEqual([]);
    });
});

describe('texts', () => {
    it('says how many places are free', () => {
        expect(placesText({ freePlaces: null, waitinglist: false })).toBeNull();
        expect(placesText({ freePlaces: 1, waitinglist: false })).toBe('Noch 1 Platz frei');
        expect(placesText({ freePlaces: 3, waitinglist: false })).toBe('Noch 3 Plätze frei');
        expect(placesText({ freePlaces: 0, waitinglist: false })).toBe('Ausgebucht');
        expect(placesText({ freePlaces: 0, waitinglist: true })).toBe('Ausgebucht – Warteliste offen');
    });

    it('joins weekday and time', () => {
        expect(whenText({ weekday: 'Mittwoch', meetingTime: '19:30' })).toBe('Mittwoch · 19:30');
        expect(whenText({ weekday: '', meetingTime: 'nach Absprache' })).toBe('nach Absprache');
        expect(whenText({ weekday: '', meetingTime: '' })).toBe('');
    });
});
