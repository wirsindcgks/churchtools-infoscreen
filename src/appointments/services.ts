/**
 * Who needs the services of an appointment (schema 1.17, Plan.md, Nächste Schritte 51):
 * the same blocks that show rooms – the next appointment in both layouts, the list
 * only as cards. One rule for the player, the preview and the device rights.
 */
import type { Block } from '../model/schema';

/** The service ids a block shows; empty where it shows none. */
export function appointmentServiceIds(block: Block): number[] {
    if (block.type === 'next-appointment') return block.services ?? [];
    if (block.type === 'appointment-list' && block.layout !== 'rows') return block.services ?? [];
    return [];
}

/** The union of the service ids of all blocks, sorted and each once. */
export function appointmentServicesInUse(blocks: readonly Block[]): number[] {
    return [...new Set(blocks.flatMap(appointmentServiceIds))].sort((a, b) => a - b);
}

/** One entry of `GET /services`, as far as this code reads it. */
export interface ServiceResponse {
    id?: number;
    name?: string | null;
    serviceGroupId?: number | null;
    hidePersonName?: boolean | null;
    sortKey?: number | null;
}

/** One entry of `GET /servicegroups`, as far as this code reads it. */
export interface ServiceGroupResponse {
    id?: number;
    name?: string | null;
    viewAll?: boolean | null;
}

/** One entry of `eventServices` of `GET /events?include=eventServices` – only what is read; the rest never leaves this file. */
interface EventServiceResponse {
    serviceId?: number | null;
    person?: {
        title?: string | null;
        domainAttributes?: { firstName?: string | null; lastName?: string | null } | null;
    } | null;
    name?: string | null;
    isAccepted?: boolean | null;
    isValid?: boolean | null;
}

/** One event of `GET /events`, as far as this code reads it. */
export interface EventResponse {
    appointmentId?: number | null;
    startDate?: string | null;
    isCanceled?: boolean | null;
    eventServices?: EventServiceResponse[] | null;
}

/** What the services of the appointments are made of: the events, the stammdaten and the services the screen chose. */
export interface ServiceInput {
    events: EventResponse[];
    services: ServiceResponse[];
    serviceGroups: ServiceGroupResponse[];
    /** The union of the ids the blocks of the screen chose. */
    chosen: number[];
}

/** The people of one service at an appointment: names only. */
export interface AppointmentService {
    serviceId: number;
    name: string;
    people: string[];
}

/** A service people may see on a public screen: not hidden and in a group "Ohne Berechtigung einsehbar" (`viewAll`). */
export function showableServices(services: ServiceResponse[], groups: ServiceGroupResponse[]): ServiceResponse[] {
    const open = new Set(groups.filter((g) => g?.viewAll === true && typeof g.id === 'number').map((g) => g.id));
    return services.filter(
        (s) => typeof s?.id === 'number' && s.hidePersonName !== true && s.serviceGroupId != null && open.has(s.serviceGroupId),
    );
}

/**
 * The privacy rule sits here, not in the view: of an event only start and cancellation count, of an
 * assignment only the service and the name – and only accepted ones of showable, chosen services.
 * `personId`, `guid`, `imageUrl`, addresses, `comment` and `requesterPerson` never leave this function,
 * so they reach neither the screen nor the offline copy. Keyed like `Appointment.key`.
 */
export function servicesByAppointment(input: ServiceInput): Map<string, AppointmentService[]> {
    const chosen = new Set(input.chosen);
    const showable = new Map(
        showableServices(input.services, input.serviceGroups)
            .filter((s) => chosen.has(s.id!))
            .map((s) => [s.id!, s] as const),
    );
    const result = new Map<string, AppointmentService[]>();
    if (!showable.size) return result;
    for (const event of input.events) {
        if (!event || event.isCanceled || typeof event.appointmentId !== 'number' || !event.startDate) continue;
        const start = new Date(event.startDate);
        if (Number.isNaN(start.getTime())) continue;
        const byService = new Map<number, string[]>();
        for (const entry of event.eventServices ?? []) {
            const service = entry?.serviceId == null ? undefined : showable.get(entry.serviceId);
            if (!service || entry.isAccepted !== true || entry.isValid === false) continue;
            const name = personName(entry);
            if (!name) continue;
            const people = byService.get(service.id!) ?? [];
            if (!people.includes(name)) people.push(name);
            byService.set(service.id!, people);
        }
        if (!byService.size) continue;
        const key = `${event.appointmentId}@${start.toISOString()}`;
        const list = result.get(key) ?? [];
        for (const [serviceId, people] of byService) {
            const service = showable.get(serviceId)!;
            list.push({ serviceId, name: (service.name ?? '').trim() || `Dienst ${serviceId}`, people });
        }
        list.sort((a, b) => {
            const sa = showable.get(a.serviceId)!.sortKey ?? Infinity;
            const sb = showable.get(b.serviceId)!.sortKey ?? Infinity;
            return (sa === sb ? 0 : sa < sb ? -1 : 1) || a.name.localeCompare(b.name, 'de');
        });
        result.set(key, list);
    }
    return result;
}

/** First and last name; without both the title of the person; without a person the name typed into the assignment. */
function personName(entry: EventServiceResponse): string {
    const person = entry.person;
    if (!person) return (entry.name ?? '').trim();
    const names = [person.domainAttributes?.firstName, person.domainAttributes?.lastName]
        .map((part) => part?.trim())
        .filter(Boolean)
        .join(' ');
    return names || (person.title ?? '').trim();
}

/** A service to choose in the inspector. */
export interface ServiceInfo {
    id: number;
    name: string;
}

/** The showable services, by name. */
export function serviceChoices(services: ServiceResponse[], groups: ServiceGroupResponse[]): ServiceInfo[] {
    return showableServices(services, groups)
        .map((s) => ({ id: s.id!, name: (s.name ?? '').trim() || `Dienst ${s.id}` }))
        .sort((a, b) => a.name.localeCompare(b.name, 'de'));
}

/** Most services a block holds – the schema's limit. */
export const SERVICES_MAX = 6;

/**
 * The chosen ids after a checkbox: `id` added or removed, and – once the list of showable services
 * is known (`available` not null) – every id that is not on it any more dropped. Unknown list: nothing is dropped.
 */
export function toggleServiceIds(
    chosen: readonly number[] | undefined,
    id: number,
    on: boolean,
    available: readonly ServiceInfo[] | null,
): number[] {
    const known = available ? new Set(available.map((s) => s.id)) : null;
    const kept = (chosen ?? []).filter((c) => c !== id && (!known || known.has(c)));
    return on ? [...kept, id].slice(0, SERVICES_MAX) : kept;
}
