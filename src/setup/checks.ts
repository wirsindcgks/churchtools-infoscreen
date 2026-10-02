/**
 * The traffic lights of the setup page (Plan.md, Nächste Schritte 8): do the
 * two groups of the module carry what designers and devices need? Pure
 * functions over what `load.ts` fetched, so every rule is testable without an
 * instance.
 *
 * Rights of a role come as bare numbers (G30). The few this page checks are
 * core rights of ChurchTools, read once from the legacy catalogue; the rights
 * of the extension itself exist only once it is installed.
 */

import type { RoomInfo } from '../rooms/normalize';

/** Core permission ids (G30). */
export const AUTH = {
    calendarView: 403, // churchcal: "Einzelnen Kalender sehen"
    resourceView: 205, // churchresource: "Ressource sehen"
    eventView: 306, // churchservice: "Events von einzelnen Kalendern sehen"
    wikiView: 501, // churchwiki: "Wiki" sehen
    wikiCategoryView: 502, // churchwiki: "Einzelne Wiki-Kategorien sehen"
    wikiCategoryEdit: 503, // churchwiki: "Einzelne Wiki-Kategorien bearbeiten"
    // The person status of a fresh instance gives it to everyone, the device account too (measured 2026-10-02, status 0).
    ownDataView: 131, // churchdb: "Eigene Personendaten sehen - bis zum gewählten Sicherheitslevel"
} as const;

/** `dataId` of a right granted for all data, e.g. all calendars – seen on person rights (G30). */
export const ALL_DATA = -1;

/** Group status ids (G30); rights work while active or finished, not as a draft or archived (Academy). */
export const GROUP_STATUS: Record<number, string> = { 1: 'aktiv', 2: 'Entwurf', 3: 'archiviert', 4: 'beendet' };

export interface Grant {
    authId: number;
    dataId: number | null;
    type?: string;
}

export type Level = 'ok' | 'warn' | 'fail' | 'info';

export interface Check {
    level: Level;
    text: string;
    detail?: string;
}

/** Whether the grants contain a right, for one data id or – without – at all. Revocations win. */
export function has(grants: Grant[], authId: number, dataId?: number): boolean {
    const matches = (g: Grant) =>
        g.authId === authId && (dataId === undefined || g.dataId === dataId || g.dataId === ALL_DATA);
    const granted = grants.some((g) => matches(g) && (g.type ?? 'grant') === 'grant');
    const revoked = grants.some((g) => matches(g) && g.type === 'revoke');
    return granted && !revoked;
}

export function checkStatus(statusId: number | null | undefined): Check {
    switch (statusId) {
        case 1:
            return { level: 'ok', text: 'Die Gruppe ist aktiv.' };
        case 4:
            return { level: 'warn', text: 'Die Gruppe ist beendet.', detail: 'Ihre Rechte wirken noch, aber beendete Gruppen geraten leicht aus dem Blick.' };
        case 2:
            return { level: 'fail', text: 'Die Gruppe ist ein Entwurf.', detail: 'Rechte wirken erst, wenn sie aktiv ist.' };
        case 3:
            return { level: 'fail', text: 'Die Gruppe ist archiviert.', detail: 'Die Rechte ihrer Mitglieder wirken nicht mehr.' };
        default:
            return { level: 'warn', text: `Unbekannter Gruppenstatus (${statusId ?? 'keiner'}).` };
    }
}

export interface RoleRights {
    name: string;
    /** Rights of the group role and of its group type role together. */
    grants: Grant[];
    memberCount: number;
    isDefault: boolean;
}

/** The roles whose rights reach people: those with members, else the default role new members get. */
function relevantRoles(roles: RoleRights[]): RoleRights[] {
    const withMembers = roles.filter((r) => r.memberCount > 0);
    return withMembers.length ? withMembers : roles.filter((r) => r.isDefault);
}

/** A right the module needs, with the data it must cover – as the setup assistant grants it. */
export interface RequiredRight {
    authId: number;
    dataId?: number[];
    label: string;
}

/** Labels of the required rights these grants do not cover. */
export function lacking(grants: Grant[], required: RequiredRight[]): string[] {
    return required
        .filter((r) => !(r.dataId ?? [undefined]).every((d) => has(grants, r.authId, d)))
        .map((r) => r.label);
}

/** `null`: the rights of the module cannot be named here (no catalogue, e.g. in local development). */
type ModuleRights = RequiredRight[] | null;

const MODULE_RIGHTS_UNKNOWN: Check = {
    level: 'info',
    text: 'Rechte am Modul lassen sich hier nicht prüfen.',
    detail: 'Der Rechtekatalog ist nur innerhalb von ChurchTools lesbar, nicht in der lokalen Entwicklung.',
};

export interface DesignerGroupInput {
    statusId: number | null;
    roles: RoleRights[];
    /** `null`: the wiki category does not exist yet or is not visible. */
    wikiCategoryId: number | null;
    moduleRights?: ModuleRights;
    /** Rights designers must not hold: writing screens and settings (Plan.md, F). */
    forbidden?: RequiredRight[] | null;
    /** Every room the administrator sees – designers choose among them for the block "Raumbelegung" (G45). */
    roomIds?: number[];
}

export function checkDesignerGroup(input: DesignerGroupInput): Check[] {
    const members = input.roles.reduce((n, r) => n + r.memberCount, 0);
    const checks: Check[] = [
        checkStatus(input.statusId),
        members
            ? { level: 'ok', text: `${members} ${members === 1 ? 'Mitglied' : 'Mitglieder'}.` }
            : { level: 'warn', text: 'Noch niemand in der Gruppe.', detail: 'Wer Infoscreens gestalten soll, wird hier Mitglied.' },
    ];

    if (input.wikiCategoryId === null) {
        checks.push({
            level: 'info',
            text: 'Der Wiki-Bereich „Infoscreen" ist noch nicht da.',
            detail: 'Er entsteht beim ersten Bild-Upload in der Mediathek; danach lassen sich die Rechte hier prüfen.',
        });
    } else {
        const wiki = input.wikiCategoryId;
        for (const role of relevantRoles(input.roles)) {
            const lacking = [
                !has(role.grants, AUTH.wikiView) && '„Wiki" sehen',
                !has(role.grants, AUTH.wikiCategoryView, wiki) && 'Wiki-Bereich „Infoscreen" sehen',
                !has(role.grants, AUTH.wikiCategoryEdit, wiki) && 'Wiki-Bereich „Infoscreen" bearbeiten',
            ].filter((x): x is string => !!x);
            checks.push(
                lacking.length
                    ? { level: 'fail', text: `Rolle „${role.name}": für die Mediathek fehlt ${lacking.join(', ')}.` }
                    : { level: 'ok', text: `Rolle „${role.name}" darf Bilder in die Mediathek laden.` },
            );
        }
    }

    if (!input.moduleRights) {
        checks.push(MODULE_RIGHTS_UNKNOWN);
    } else {
        for (const role of relevantRoles(input.roles)) {
            const missing = lacking(role.grants, input.moduleRights);
            checks.push(
                missing.length
                    ? { level: 'fail', text: `Rolle „${role.name}": am Modul fehlt ${missing.join(', ')}.` }
                    : { level: 'ok', text: `Rolle „${role.name}" darf Screens gestalten.` },
            );
            const tooMuch = (input.forbidden ?? []).filter((f) => (f.dataId ?? []).some((d) => has(role.grants, f.authId, d)));
            if (tooMuch.length) {
                checks.push({
                    level: 'warn',
                    text: `Rolle „${role.name}" darf Screens oder Einstellungen ändern – das ist Sache der Administratoren.`,
                    detail:
                        '„Rechte aktualisieren" nimmt das bei den Gruppen des Assistenten zurück; bei eigenen Gruppen in der ' +
                        'Rechteverwaltung von ChurchTools entfernen.',
                });
            }
        }
    }

    // Rooms are chosen in the designer: without the right on a room it is missing from the list (G45).
    const roomIds = input.roomIds ?? [];
    if (roomIds.length) {
        for (const role of relevantRoles(input.roles)) {
            if (roomIds.every((id) => has(role.grants, AUTH.resourceView, id))) continue;
            checks.push({
                level: 'warn',
                text: `Rolle „${role.name}" sieht nicht alle Räume.`,
                detail: 'Dann fehlen sie im Baustein „Raumbelegung". „Rechte aktualisieren" gibt sie den Gruppen des Assistenten.',
            });
        }
    }
    return checks;
}

export interface DeviceMember {
    label: string;
    /** Everything this person holds: group role, group type role, person status and direct rights. */
    grants: Grant[];
}

export interface CalendarInfo {
    id: number;
    name: string;
    isPublic?: boolean;
}

export interface DeviceGroupInput {
    statusId: number | null;
    members: DeviceMember[];
    calendars: CalendarInfo[];
    usedCalendarIds: number[];
    /** The rooms the administrator sees, to name the used ones. */
    rooms?: RoomInfo[];
    usedRoomIds?: number[];
    /** A block shows the rooms of its appointments (Plan.md 50): the device must see all rooms. */
    appointmentRooms?: boolean;
    /** The calendars of the blocks that show services (Plan.md 51): the device must see their events. */
    serviceCalendarIds?: number[];
    /** A screen shows a video (Plan.md 52): the device must see the wiki category, else the video does not run. */
    videoInUse?: boolean;
    wikiCategoryId: number | null;
    moduleRights?: ModuleRights;
    /**
     * The rights the assistant plans for a device, by id (Plan.md 58 E). With them the check names what a
     * device account holds beyond – without them (no catalogue, as in development) it says nothing.
     */
    plannedAuthIds?: number[];
    /** A right's name for people; the bare number where there is none. */
    authName?: (authId: number) => string | undefined;
}

/** More names would not be read on the page; the rest is counted. */
const EXCESS_NAMED = 6;

/**
 * The rights a device account holds that no device needs – by right, whatever data it is for. The
 * address of a TV carries its account's login token (Plan.md, D): who has the address has these rights.
 * Wiki rights have their own line in `checkDeviceGroup`. Seeing the own person data does not count: it reaches
 * no further than the device account's own record, and the usual person status brings it along. Editing it
 * does count, like every right that changes something – a device only reads (user, 2026-10-02).
 */
export function excessRights(grants: Grant[], plannedAuthIds: readonly number[]): number[] {
    const planned = new Set<number>([...plannedAuthIds, AUTH.wikiView, AUTH.wikiCategoryEdit, AUTH.ownDataView]);
    const held = [...new Set(grants.map((g) => g.authId))].filter((authId) => has(grants, authId));
    return held.filter((authId) => !planned.has(authId)).sort((a, b) => a - b);
}

export function checkDeviceGroup(input: DeviceGroupInput): Check[] {
    const checks: Check[] = [checkStatus(input.statusId)];
    if (!input.members.length) {
        // Like an empty designer group: right after the assistant this is the next step, not a fault.
        checks.push({
            level: 'warn',
            text: 'Noch kein Geräte-Benutzer in der Gruppe.',
            detail: 'Das Konto, mit dem sich die Fernseher anmelden, gehört hierher.',
        });
        return checks;
    }
    checks.push({ level: 'ok', text: `${input.members.length} Geräte-Benutzer.` });

    if (!input.usedCalendarIds.length) {
        checks.push({ level: 'info', text: 'Noch zeigt kein Screen Termine.' });
    }
    const byId = new Map(input.calendars.map((c) => [c.id, c]));
    for (const id of input.usedCalendarIds) {
        const calendar = byId.get(id);
        if (!calendar) {
            checks.push({ level: 'warn', text: `Kalender ${id} wird verwendet, ist aber nicht (mehr) zu finden.` });
            continue;
        }
        const blind = input.members.filter((m) => !has(m.grants, AUTH.calendarView, id)).map((m) => m.label);
        checks.push(
            blind.length
                ? {
                      level: 'fail',
                      text: `„${calendar.name}" ist für ${blind.join(', ')} nicht sichtbar.`,
                      detail: 'Recht „Einzelnen Kalender sehen" für diesen Kalender an die Rolle der Gerätegruppe geben.',
                  }
                : { level: 'ok', text: `„${calendar.name}" ist sichtbar.` },
        );
    }

    const roomsById = new Map((input.rooms ?? []).map((r) => [r.id, r]));
    for (const id of input.usedRoomIds ?? []) {
        const room = roomsById.get(id);
        if (!room) {
            checks.push({ level: 'warn', text: `Raum ${id} wird verwendet, ist aber nicht (mehr) zu finden.` });
            continue;
        }
        const blind = input.members.filter((m) => !has(m.grants, AUTH.resourceView, id)).map((m) => m.label);
        checks.push(
            blind.length
                ? {
                      level: 'fail',
                      text: `„${room.name}" ist für ${blind.join(', ')} nicht sichtbar.`,
                      detail: 'Recht „Ressource sehen" für diesen Raum an die Rolle der Gerätegruppe geben – oder „Rechte aktualisieren".',
                  }
                : { level: 'ok', text: `„${room.name}" ist sichtbar.` },
        );
    }

    if (input.appointmentRooms) {
        const all = input.rooms ?? [];
        const blind = input.members
            .map((m) => ({ label: m.label, unseen: all.filter((r) => !has(m.grants, AUTH.resourceView, r.id)).length }))
            .filter((m) => m.unseen > 0);
        if (blind.length) {
            for (const m of blind) {
                checks.push({
                    level: 'fail',
                    text: `Räume an Terminen: ${m.label} sieht ${m.unseen} von ${all.length} Räumen nicht.`,
                    detail: '„Rechte aktualisieren" gibt der Gerätegruppe das Recht „Ressource sehen" für alle Räume.',
                });
            }
        } else {
            checks.push({ level: 'ok', text: 'Räume an Terminen sind sichtbar.' });
        }
    }

    const serviceCalendarIds = input.serviceCalendarIds ?? [];
    if (serviceCalendarIds.length) {
        const blind = input.members
            .filter((m) => !serviceCalendarIds.every((id) => has(m.grants, AUTH.eventView, id)))
            .map((m) => m.label);
        checks.push(
            blind.length
                ? {
                      level: 'fail',
                      text: `Dienste an Terminen: ${blind.join(', ')} sieht die Events der Kalender nicht.`,
                      detail: '„Rechte aktualisieren" gibt der Gerätegruppe das Recht „Events von einzelnen Kalendern sehen" für diese Kalender.',
                  }
                : { level: 'ok', text: 'Dienste an Terminen sind sichtbar.' },
        );
    }

    if (!input.moduleRights) {
        checks.push(MODULE_RIGHTS_UNKNOWN);
    } else {
        for (const member of input.members) {
            const missing = lacking(member.grants, input.moduleRights);
            checks.push(
                missing.length
                    ? { level: 'fail', text: `${member.label}: am Modul fehlt ${missing.join(', ')}.` }
                    : { level: 'ok', text: `${member.label} darf die Screens lesen.` },
            );
        }
    }

    // Videos come through the download address, which wants "Wiki-Bereich sehen" (502) and nothing more (G47, Plan.md 52).
    if (input.wikiCategoryId !== null) {
        const wiki = input.wikiCategoryId;
        const blind = input.members.filter((m) => !has(m.grants, AUTH.wikiCategoryView, wiki)).map((m) => m.label);
        if (blind.length) {
            const subject = `${blind.join(', ')} ${blind.length === 1 ? 'darf' : 'dürfen'} den Wiki-Bereich „Infoscreen" nicht sehen`;
            checks.push(
                input.videoInUse
                    ? { level: 'fail', text: `${subject} – Videos laufen nicht.`, detail: '„Rechte aktualisieren" gibt der Gerätegruppe das Recht „Einzelne Wiki-Kategorien sehen" für den Bereich.' }
                    : { level: 'warn', text: `${subject} – Videos würden nicht laufen.`, detail: '„Rechte aktualisieren" vergibt es.' },
            );
        } else if (input.videoInUse) {
            checks.push({ level: 'ok', text: 'Videos können laufen: der Wiki-Bereich „Infoscreen" ist sichtbar.' });
        }
    }

    // Least privilege (Plan.md, F): images come through the image service without sign-in (G14), videos need only 502.
    const wikiHolders = input.members
        .filter((m) => [AUTH.wikiView, AUTH.wikiCategoryEdit].some((a) => has(m.grants, a)))
        .map((m) => m.label);
    if (wikiHolders.length) {
        checks.push({
            level: 'warn',
            text: `${wikiHolders.join(', ')} ${wikiHolders.length === 1 ? 'hat' : 'haben'} Wiki-Rechte, die ein Gerät nicht braucht.`,
            detail:
                'Bilder lädt der Fernseher ohne Anmeldung, zum Abspielen von Videos genügt „Wiki-Bereich Infoscreen sehen". ' +
                'Weniger Rechte heißt weniger Schaden, wenn ein Gerät verloren geht.',
        });
    }

    if (input.plannedAuthIds) {
        for (const member of input.members) {
            const excess = excessRights(member.grants, input.plannedAuthIds);
            if (!excess.length) continue;
            const names = excess.slice(0, EXCESS_NAMED).map((id) => input.authName?.(id) ?? `Recht ${id}`);
            const more = excess.length - names.length;
            checks.push({
                level: 'warn',
                text:
                    `${member.label} hat ${excess.length === 1 ? 'ein Recht' : `${excess.length} Rechte`}, ` +
                    `${excess.length === 1 ? 'das' : 'die'} ein Gerät nicht braucht: ${names.join(', ')}${more > 0 ? ` und ${more} weitere` : ''}.`,
                detail:
                    'Ein Gerät soll nur lesen, und nur, was seine Screens zeigen: Wer die Adresse des Fernsehers kennt, hat diese ' +
                    'Rechte auch. Meist kommen sie aus dem Personenstatus oder einer anderen Gruppe des Kontos. Die Namen sind die ' +
                    'der Rechteverwaltung von ChurchTools; dort der Person einen Status ohne diese Rechte geben.',
            });
        }
    }
    return checks;
}
