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

/** Core permission ids (G30). */
export const AUTH = {
    calendarView: 403, // churchcal: "Einzelnen Kalender sehen"
    wikiView: 501, // churchwiki: "Wiki" sehen
    wikiCategoryView: 502, // churchwiki: "Einzelne Wiki-Kategorien sehen"
    wikiCategoryEdit: 503, // churchwiki: "Einzelne Wiki-Kategorien bearbeiten"
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
    wikiCategoryId: number | null;
    moduleRights?: ModuleRights;
}

export function checkDeviceGroup(input: DeviceGroupInput): Check[] {
    const checks: Check[] = [checkStatus(input.statusId)];
    if (!input.members.length) {
        checks.push({
            level: 'fail',
            text: 'Kein Geräte-Benutzer in der Gruppe.',
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

    // Least privilege (Plan.md, F): images come through the image service without sign-in (G14).
    const wikiHolders = input.members
        .filter((m) => [AUTH.wikiView, AUTH.wikiCategoryView, AUTH.wikiCategoryEdit].some((a) => has(m.grants, a)))
        .map((m) => m.label);
    if (wikiHolders.length) {
        checks.push({
            level: 'warn',
            text: `${wikiHolders.join(', ')} ${wikiHolders.length === 1 ? 'hat' : 'haben'} Wiki-Rechte, die ein Gerät nicht braucht.`,
            detail: 'Bilder lädt der Fernseher ohne Anmeldung. Weniger Rechte heißt weniger Schaden, wenn ein Gerät verloren geht.',
        });
    }
    return checks;
}
