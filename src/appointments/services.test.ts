import { describe, expect, it } from 'vitest';
import { normalizeAppointments, type AppointmentResponse } from './normalize';
import {
    appointmentServiceIds,
    appointmentServicesInUse,
    serviceChoices,
    toggleServiceIds,
    type EventResponse,
    type ServiceGroupResponse,
    type ServiceInput,
    type ServiceResponse,
} from './services';
import type { Block } from '../model/schema';

const BERLIN = 'Europe/Berlin';
const START = '2026-10-04T08:00:00Z';

const appointment = (id: number, startDate = START): AppointmentResponse => ({
    appointment: {
        base: { id, title: `Termin ${id}`, allDay: false, calendar: { id: 2, name: 'Gottesdienst', color: 'black' } },
        calculated: { startDate, endDate: '2026-10-04T09:30:00Z' },
    },
});

const SERVICES: ServiceResponse[] = [
    { id: 1, name: 'Predigt', serviceGroupId: 10, hidePersonName: false, sortKey: 20 },
    { id: 2, name: 'Moderation', serviceGroupId: 10, hidePersonName: false, sortKey: 10 },
    { id: 3, name: 'Ton', serviceGroupId: 11, hidePersonName: false, sortKey: 30 },
    { id: 4, name: 'Anonym', serviceGroupId: 10, hidePersonName: true, sortKey: 40 },
    { id: 5, name: 'Ohne Gruppe', serviceGroupId: 99, hidePersonName: false, sortKey: 50 },
];
const GROUPS: ServiceGroupResponse[] = [
    { id: 10, name: 'Offen', viewAll: true },
    { id: 11, name: 'Geschlossen', viewAll: false },
];

const person = (first: string, last: string, extra: Record<string, unknown> = {}) => ({
    title: `${last}, ${first}`,
    domainAttributes: { firstName: first, lastName: last },
    ...extra,
});
const entry = (serviceId: number, name: string, extra: Record<string, unknown> = {}) => ({
    serviceId,
    person: person(name.split(' ')[0]!, name.split(' ')[1]!),
    isAccepted: true,
    isValid: true,
    ...extra,
});
const event = (eventServices: unknown[], extra: Partial<EventResponse> = {}): EventResponse =>
    ({ appointmentId: 9, startDate: START, isCanceled: false, eventServices, ...extra }) as EventResponse;

function run(events: EventResponse[], chosen = [1, 2, 3, 4, 5], appointments = [appointment(9)]) {
    const input: ServiceInput = { events, services: SERVICES, serviceGroups: GROUPS, chosen };
    return normalizeAppointments(appointments, BERLIN, [], input);
}

describe('services at appointments – the privacy rule (Plan.md 51)', () => {
    it('1: shows only services that are not hidden and whose group is open to all; unknown ones never', () => {
        const [a] = run([
            event([
                entry(1, 'Anna Beispiel'),
                entry(3, 'Dirk Probe'), // closed group
                entry(4, 'Eva Anonym'), // hidePersonName
                entry(5, 'Fritz Waise'), // group missing
                entry(77, 'Gabi Unbekannt'), // service missing
            ]),
        ]);
        expect(a?.services).toEqual([{ serviceId: 1, name: 'Predigt', people: ['Anna Beispiel'] }]);
    });

    it('2: keeps accepted, valid assignments of the chosen services only', () => {
        const [a] = run(
            [
                event([
                    entry(1, 'Anna Beispiel'),
                    entry(1, 'Nicht Zugesagt', { isAccepted: false }),
                    entry(1, 'Offen Gelassen', { isAccepted: null }),
                    entry(1, 'Ungueltig Person', { isValid: false }),
                    entry(2, 'Ben Muster'), // not chosen
                ]),
            ],
            [1],
        );
        expect(a?.services).toEqual([{ serviceId: 1, name: 'Predigt', people: ['Anna Beispiel'] }]);
    });

    it('3: ignores events that are canceled', () => {
        const [a] = run([event([entry(1, 'Anna Beispiel')], { isCanceled: true })]);
        expect(a).not.toHaveProperty('services');
    });

    it('4: takes first and last name, else the title, else the typed name – and drops an empty one', () => {
        const [a] = run([
            event([
                entry(1, 'Anna Beispiel'),
                { serviceId: 1, person: { title: 'Muster, Ben', domainAttributes: {} }, isAccepted: true },
                { serviceId: 1, person: null, name: '  Frei Eingetragen ', isAccepted: true },
                { serviceId: 1, person: null, name: '   ', isAccepted: true },
                { serviceId: 1, person: { title: ' ' }, isAccepted: true },
            ]),
        ]);
        expect(a?.services?.[0]?.people).toEqual(['Anna Beispiel', 'Muster, Ben', 'Frei Eingetragen']);
    });

    it('5: sorts by sortKey, then name; people in the order of the answer, each once; no field if nothing shows', () => {
        const [a] = run([
            event([entry(1, 'Anna Beispiel'), entry(2, 'Ben Muster'), entry(1, 'Cora Test'), entry(1, 'Anna Beispiel')]),
        ]);
        expect(a?.services).toEqual([
            { serviceId: 2, name: 'Moderation', people: ['Ben Muster'] },
            { serviceId: 1, name: 'Predigt', people: ['Anna Beispiel', 'Cora Test'] },
        ]);
        const [none] = run([event([entry(3, 'Dirk Probe')])]);
        expect(none).not.toHaveProperty('services');
    });

    it('5: lets nothing else of an event or an assignment reach the appointment', () => {
        const marker = 'GEHEIMER-MARKER';
        const [a] = run([
            event([
                entry(1, 'Anna Beispiel', {
                    personId: 4711,
                    comment: marker,
                    requesterPerson: { title: marker, guid: marker, imageUrl: `https://x/${marker}` },
                    person: person('Anna', 'Beispiel', {
                        guid: marker,
                        imageUrl: `https://x/${marker}`,
                        apiUrl: `https://x/${marker}`,
                        frontendUrl: `https://x/${marker}`,
                    }),
                }),
            ]),
        ]);
        expect(a?.services).toHaveLength(1);
        const text = JSON.stringify(a);
        expect(text).not.toContain(marker);
        expect(text).not.toContain('4711');
        expect(JSON.stringify(a!.services)).not.toMatch(/personId|guid|imageUrl|comment|requesterPerson/);
        expect(Object.keys(a!.services![0]!).sort()).toEqual(['name', 'people', 'serviceId']);
    });

    it('6: matches an event by appointmentId and the very start; any other is ignored', () => {
        const events = [
            event([entry(1, 'Anna Beispiel')], { appointmentId: 8 }),
            event([entry(1, 'Ben Muster')], { startDate: '2026-10-11T08:00:00Z' }),
            event([entry(1, 'Cora Test')], { appointmentId: 9, startDate: '2026-10-04T08:00:00.000Z' }),
        ];
        const [first, second] = run(events, [1], [appointment(9), appointment(9, '2026-10-11T08:00:00Z')]);
        expect(first?.services?.[0]?.people).toEqual(['Cora Test']);
        expect(second?.services?.[0]?.people).toEqual(['Ben Muster']);
        const [other] = run([event([entry(1, 'Anna Beispiel')])], [1], [appointment(3)]);
        expect(other).not.toHaveProperty('services');
    });

    it('adds nothing where services were not asked for', () => {
        const [a] = normalizeAppointments([appointment(9)], BERLIN);
        expect(a).not.toHaveProperty('services');
    });
});

describe('serviceChoices', () => {
    it('offers the showable services by name', () => {
        expect(serviceChoices(SERVICES, GROUPS)).toEqual([
            { id: 2, name: 'Moderation' },
            { id: 1, name: 'Predigt' },
        ]);
    });
});

describe('who shows services', () => {
    const base = { x: 0, y: 0, width: 100, height: 100, calendarIds: [2], style: { fontFamily: 'sans', fontSize: 20, color: '#fff' } };
    const next = { id: 'n', type: 'next-appointment', ...base, showImage: true, services: [2, 1] } as Block;
    const list = { id: 'l', type: 'appointment-list', ...base, horizonDays: 7, limit: 5, services: [1, 3] } as Block;

    it('takes the next appointment in both layouts and a list unless it is rows', () => {
        expect(appointmentServiceIds(next)).toEqual([2, 1]);
        expect(appointmentServiceIds({ ...next, layout: 'classic' } as Block)).toEqual([2, 1]);
        expect(appointmentServiceIds(list)).toEqual([1, 3]);
        expect(appointmentServiceIds({ ...list, layout: 'cards' } as Block)).toEqual([1, 3]);
        expect(appointmentServiceIds({ ...list, layout: 'rows' } as Block)).toEqual([]);
        expect(appointmentServiceIds({ ...next, services: undefined } as Block)).toEqual([]);
    });

    it('unites the ids of all blocks, sorted', () => {
        expect(appointmentServicesInUse([next, list])).toEqual([1, 2, 3]);
        expect(appointmentServicesInUse([])).toEqual([]);
    });
});

describe('toggleServiceIds', () => {
    const available = [1, 2, 3, 4, 5, 6, 7].map((id) => ({ id, name: `Dienst ${id}` }));

    it('adds and removes one id', () => {
        expect(toggleServiceIds([1], 2, true, available)).toEqual([1, 2]);
        expect(toggleServiceIds([1, 2], 1, false, available)).toEqual([2]);
        expect(toggleServiceIds(undefined, 3, true, available)).toEqual([3]);
    });

    it('drops ids that are not showable any more once the list is known', () => {
        expect(toggleServiceIds([1, 99], 2, true, available)).toEqual([1, 2]);
        expect(toggleServiceIds([1, 99], 1, false, available)).toEqual([]);
    });

    it('keeps everything while the list is not known (loading or failed)', () => {
        expect(toggleServiceIds([1, 99], 2, true, null)).toEqual([1, 99, 2]);
    });

    it('never holds more than 6', () => {
        expect(toggleServiceIds([1, 2, 3, 4, 5, 6], 7, true, available)).toHaveLength(6);
    });
});
