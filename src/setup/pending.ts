/**
 * Whether „Rechte aktualisieren" would change something (Plan.md 122): a dot at „Einstellungen" for administrators.
 * The same reckoning as the button – `planProvisioning` and `readRefresh` – not the whole check of rights, which reads
 * several people per device. Reads only; nothing is created. Once per visit, the answer kept 10 minutes in the session.
 */
import { churchtoolsClient } from '@churchtools/churchtools-client';
import { ref } from 'vue';
import { EXTENSION_KEY } from '../config';
import { fetchCalendars, fetchPublicCalendars, fetchResourceMasterdata } from '../ct/api';
import { instanceBaseUrl } from '../ct/client';
import { isAdministrator } from '../designer/administrator';
import { pickCategory, type WikiCategory } from '../media/wiki';
import { roomsOf } from '../rooms/normalize';
import { getRepository } from '../store/backend';
import { CATEGORIES, type CategoryKey } from '../store/screen-repository';
import { grantableCalendars } from './calendars';
import { loadAuthCatalog } from './catalog';
import { churchToolsProvisionApi, loadGroups } from './load';
import { readLocks } from './locks';
import { planProvisioning, readRefresh, refreshIsEmpty } from './provision';

const KEY = 'infoscreen-rights-pending';
const VALID_MS = 10 * 60 * 1000;

/** True while „Rechte aktualisieren" has something to do; false until known. */
export const rightsPending = ref<boolean>(false);

function stored(): boolean | null {
    try {
        const raw = window.sessionStorage.getItem(KEY);
        if (!raw) return null;
        const { value, at } = JSON.parse(raw) as { value?: unknown; at?: unknown };
        if (typeof value !== 'boolean' || typeof at !== 'number' || Date.now() - at > VALID_MS) return null;
        return value;
    } catch {
        return null;
    }
}

/** Sets the answer and keeps it for the session; the settings page calls it with what its own reckoning found. */
export function setRightsPending(value: boolean): void {
    rightsPending.value = value;
    try {
        window.sessionStorage.setItem(KEY, JSON.stringify({ value, at: Date.now() }));
    } catch {
        // Blocked storage: the next visit asks again, nothing worse.
    }
}

/** Reads what the button reads; any failure means no dot. */
async function compute(): Promise<boolean> {
    if (!(await isAdministrator())) return false;
    const handle = await getRepository();
    if (handle.demo) return false;
    const repository = handle.repository;
    // Like SetupView.vue (arrival): the same reads, the categories only looked up.
    const [groups, settings, wikiCategories, calendars, publicCalendars, resources, usedRooms, roomsAtAppointments, serviceCalendarIds, agendaCalendarIds, songsheet, visible, statusId, controlId, draftsId, changelogId, catalog] =
        await Promise.all([
            loadGroups(),
            repository.loadSettings(),
            churchtoolsClient.get<WikiCategory[]>('/wiki/categories'),
            fetchCalendars(),
            fetchPublicCalendars(instanceBaseUrl()),
            fetchResourceMasterdata().catch(() => null),
            repository.roomIdsInUse(),
            repository.appointmentRoomsInUse(),
            repository.serviceCalendarIdsInUse(),
            repository.agendaCalendarIdsInUse(),
            repository.songsheetInUse(),
            repository.visibleCategories(),
            repository.statusCategoryId().catch(() => null),
            repository.controlCategoryId().catch(() => null),
            repository.drafts.categoryId().catch(() => null),
            repository.changelog.categoryId().catch(() => null),
            loadAuthCatalog().catch(() => null),
        ]);
    if (!catalog) return false;
    const categories = {
        ...visible,
        ...(statusId === null ? {} : { status: statusId }),
        ...(draftsId === null ? {} : { drafts: draftsId }),
        ...(changelogId === null ? {} : { changelog: changelogId }),
    };
    if ((Object.keys(CATEGORIES) as CategoryKey[]).some((k) => categories[k] === undefined)) return false;

    const publicIds = publicCalendars.map((c) => c.id);
    const publicSet = new Set(publicIds);
    const internal = new Set(calendars.filter((c) => !publicSet.has(c.id)).map((c) => c.id));
    // Like SetupView.vue (`sortedIds`): the release as stored, only calendars and groups that still exist.
    const released = [...new Set(settings?.screenCalendarIds ?? [])].filter((id) => internal.has(id));
    const groupIds = new Set(groups.map((g) => g.id));
    const releasedPeople = [...new Set(settings?.peopleGroupIds ?? [])].filter((id) => groupIds.has(id));
    const rooms = resources ? roomsOf(resources, settings?.roomTypeIds) : [];
    const created = settings?.createdGroupIds ?? [];
    const peopleGroupId = settings?.peopleGroupId ?? null;
    const musicianGroupId = settings?.musicianGroupId ?? null;
    const plan = planProvisioning({
        catalog,
        moduleKey: EXTENSION_KEY,
        categories: categories as Record<CategoryKey, number> & { status?: number; drafts?: number; changelog?: number },
        peopleGroupId: peopleGroupId ?? undefined,
        controlCategoryId: controlId ?? undefined,
        musicianGroupId: musicianGroupId ?? undefined,
        wikiCategoryId: pickCategory(wikiCategories, settings)?.id ?? null,
        roomIds: rooms.map((r) => r.id),
        usedRoomIds: usedRooms,
        appointmentRooms: roomsAtAppointments,
        serviceCalendarIds: grantableCalendars(serviceCalendarIds, publicIds, released),
        agendaCalendarIds: grantableCalendars(agendaCalendarIds, publicIds, released),
        songsheet,
        screenCalendarIds: released,
        peopleGroupIds: releasedPeople,
    });
    const designer = settings?.designerGroupId ?? -1;
    const device = settings?.deviceGroupId ?? -1;
    const state = await readRefresh(
        plan,
        {
            designer: created.includes(designer) ? designer : undefined,
            device: created.includes(device) ? device : undefined,
            people: created.includes(peopleGroupId ?? -1) ? peopleGroupId! : undefined,
            musician: created.includes(musicianGroupId ?? -1) ? musicianGroupId! : undefined,
        },
        { calendarIds: calendars.map((c) => c.id), roomIds: rooms.map((r) => r.id) },
        {
            calendars: new Map(calendars.map((c) => [c.id, c.name] as const)),
            rooms: new Map(rooms.map((r) => [r.id, r.name] as const)),
            groups: new Map(groups.map((g) => [g.id, g.name] as const)),
        },
        churchToolsProvisionApi,
        settings?.peopleDeviceIds ?? [],
        await readLocks(),
    );
    return !refreshIsEmpty(state.groups) && state.blocked.length === 0;
}

let running: Promise<void> | null = null;

/** Fills `rightsPending`: from the session while it is fresh, else by reading. Concurrent calls share one run. */
export function checkRightsPending(): Promise<void> {
    running ??= run().finally(() => (running = null));
    return running;
}

async function run(): Promise<void> {
    try {
        const known = stored();
        if (known !== null) {
            rightsPending.value = known;
            return;
        }
        setRightsPending(await compute());
    } catch (e) {
        console.warn('Hinweis „Rechte aktualisieren" nicht ermittelt:', e);
        rightsPending.value = false;
    }
}
