<script setup lang="ts">
import { churchtoolsClient } from '@churchtools/churchtools-client';
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { EXTENSION_KEY } from '../config';
import Icon, { type IconName } from '../designer/Icon.vue';
import ModulePage from '../designer/ModulePage.vue';
import PageHeader from '../designer/PageHeader.vue';
import { fetchCalendars, fetchResourceMasterdata, fetchServiceGroups, fetchServices, type Calendar } from '../ct/api';
import { serviceChoices, type ServiceInfo } from '../appointments/services';
import { currentPerson, httpStatus, instanceBaseUrl, personUrl } from '../ct/client';
import { playerUrl } from '../designer/player-url';
import RemoveSetupDialog, { type DeviceAccountInfo, type RemoveGroupInfo } from '../designer/RemoveSetupDialog.vue';
import { createCategory, setCategoryInMenu, wikiRestoreLogLine, WIKI_CATEGORY_NAME, type WikiCategory } from '../media/wiki';
import type { ScreenDoc } from '../model/schema';
import { withDeviceLogin } from '../player/device-login';
import { roomsOf, type RoomInfo } from '../rooms/normalize';
import { loadAuthCatalog, type AuthCatalog } from '../setup/catalog';
import { AUTH, checkDesignerGroup, checkDeviceGroup, groupChecks, type Check, type RequiredRight } from '../setup/checks';
import {
    canViewWiki,
    churchToolsProvisionApi,
    deleteGroup,
    findGroupTypeId,
    groupMemberNames,
    loadGroupRights,
    loadGroups,
    loadPersonGrants,
    personGroupIds,
    type GroupSummary,
} from '../setup/load';
import { settingsToSave, type SettingsFields } from '../setup/settings-doc';
import { wikiCategoryCreation } from '../setup/wiki-creation';
import { createDeviceLogin } from '../setup/device-token';
import {
    devicePasswordRecommendationLogLine,
    GROUP_NAMES,
    GROUP_TYPE_NAME,
    planProvisioning,
    provision,
    refreshGrants,
    REMOVE_SETUP_NEXT_STEPS_LOG_LINE,
    removeCreatedGroups,
    type GroupSpec,
} from '../setup/provision';
import { isAdministrator } from '../designer/administrator';
import { getRepository } from '../store/backend';
import { CATEGORIES, type CategoryKey, type ScreenRepository } from '../store/screen-repository';

type Side = 'designer' | 'device';

/**
 * One component, four addresses (Plan.md 36): what the page shows follows
 * from the route name instead of splitting it into sub-components. `RouterView`
 * keeps the same instance across all four routes, so `onMounted` loads once,
 * whichever page one starts on or moves to.
 */
const route = useRoute();
type SetupPage = 'overview' | 'groups' | 'tv' | 'wiki' | 'services';
const page = computed<SetupPage>(() => {
    switch (route.name) {
        case 'setup-groups':
            return 'groups';
        case 'setup-tv':
            return 'tv';
        case 'setup-wiki':
            return 'wiki';
        case 'setup-services':
            return 'services';
        default:
            return 'overview';
    }
});
const HEADERS: Record<SetupPage, { icon: IconName; title: string; intro: string }> = {
    overview: {
        icon: 'settings',
        title: 'Einstellungen',
        intro:
            'Hier verwalten ChurchTools-Administratoren die Gruppen und Rechte für Gestalter und Geräte, die Adressen ' +
            'der Fernseher und die Mediathek im Wiki.',
    },
    groups: {
        icon: 'person',
        title: 'Gruppen und Rechte',
        intro:
            'Der Assistent legt die Gruppen für Gestalter und Geräte samt Rechten an; hier prüfst und aktualisierst du ' +
            'sie oder entfernst die Einrichtung.',
    },
    tv: {
        icon: 'tv',
        title: 'Adressen für die Fernseher',
        intro: 'Erzeugt die Adresse, mit der sich ein Fernseher selbst anmeldet.',
    },
    wiki: {
        icon: 'image',
        title: 'Mediathek im Wiki',
        intro: 'Wo die Bilder der Mediathek im Wiki stehen.',
    },
    services: {
        icon: 'person',
        title: 'Dienste auf Screens',
        intro: 'Welche Dienste mit Namen auf einem Fernseher erscheinen dürfen.',
    },
};
const header = computed(() => HEADERS[page.value]);

const groups = ref<GroupSummary[]>([]);
const selected = reactive<Record<Side, number | null>>({ designer: null, device: null });
const checks = reactive<Record<Side, Check[] | null>>({ designer: null, device: null });
const busy = reactive<Record<Side, boolean>>({ designer: false, device: false });
const error = ref<string | null>(null);
const saveState = ref<'idle' | 'saving' | 'saved' | 'failed'>('idle');

let repository: ScreenRepository | null = null;
let wikiCategoryId: number | null = null;
/** The media library's wiki area, for „im Wiki ausblenden" (G36). */
const wikiCategory = ref<WikiCategory | null>(null);
const wikiBusy = ref(false);
const wikiError = ref<string | null>(null);

async function toggleWikiMenu(): Promise<void> {
    if (!wikiCategory.value) return;
    wikiBusy.value = true;
    wikiError.value = null;
    try {
        wikiCategory.value = await setCategoryInMenu(wikiCategory.value, !(wikiCategory.value.inMenu ?? true));
    } catch (e) {
        wikiError.value = e instanceof Error ? e.message : String(e);
    } finally {
        wikiBusy.value = false;
    }
}
let calendars: Calendar[] = [];
let usedCalendarIds: number[] = [];
/** Rooms the administrator sees; empty when the master data is unreadable – the page runs on (G45). */
let rooms: RoomInfo[] = [];
let usedRoomIds: number[] = [];
/** A block shows the rooms of its appointments (Plan.md 50). */
let appointmentRooms = false;
/** The calendars of the blocks that show services (Plan.md 51). */
let serviceCalendarIds: number[] = [];
/** A screen shows a video (Plan.md 52). */
let videoInUse = false;
let catalog: AuthCatalog | null = null;
let categories: Partial<Record<CategoryKey, number>> = {};

/** The setup assistant (Plan.md, 9): what it would do, and what it did. */
const demo = ref(false);
const plan = ref<GroupSpec[] | null>(null);
const planProblem = ref<string | null>(null);
const createdGroupIds = ref<number[]>([]);
/** The wiki category the assistant created itself – the only one it may ever delete (Plan.md, F). */
const createdWikiCategoryId = ref<number | null>(null);
const assistant = reactive({ allowed: false, running: false, log: [] as string[], error: null as string | null });

/**
 * Members of a group, as `check()` already loaded it while checking designers
 * or devices – reused by the removal dialog instead of a fetch of its
 * own. Unknown for a created group that is neither side's current choice.
 */
const groupMemberCounts = reactive<Record<number, number>>({});
const removeDialog = ref<{ groups: RemoveGroupInfo[]; ownMemberOf: string[]; deviceAccounts: DeviceAccountInfo[] } | null>(null);

/** Groups under the assistant's names that it did not create: it never takes them over. */
const wikiMissing = computed(() => plan.value !== null && wikiCategoryIdKnown.value === false);
const wikiCategoryIdKnown = ref(true);

const foreignGroups = computed(() =>
    groups.value.filter(
        (g) => Object.values(GROUP_NAMES).includes(g.name as never) && !createdGroupIds.value.includes(g.id),
    ),
);

const NOT_MODULE: number[] = [AUTH.calendarView, AUTH.resourceView, AUTH.eventView, AUTH.wikiView, AUTH.wikiCategoryView, AUTH.wikiCategoryEdit];

/** Rights a side must not hold – what the assistant takes back (Plan.md, F). */
function forbiddenRights(side: Side): RequiredRight[] | null {
    return plan.value?.find((g) => g.key === side)?.forbidden ?? null;
}

/** The module rights a side needs – exactly what the assistant grants, so both agree. */
function moduleRights(side: Side): RequiredRight[] | null {
    const spec = plan.value?.find((g) => g.key === side);
    return spec ? spec.grants.filter((g) => !NOT_MODULE.includes(g.authId)) : null;
}

function computePlan(): void {
    plan.value = null;
    planProblem.value = null;
    if (demo.value) {
        planProblem.value = 'Im Demo-Modus nicht verfügbar: Die Screens liegen hier nur im Browser, nicht in ChurchTools.';
        return;
    }
    if (!catalog) {
        planProblem.value = 'Der Rechtekatalog von ChurchTools ist nicht lesbar.';
        return;
    }
    const keys = Object.keys(CATEGORIES) as CategoryKey[];
    if (keys.some((k) => categories[k] === undefined)) {
        planProblem.value = 'Die Datenkategorien des Moduls fehlen noch – einmal die Startseite des Designers öffnen.';
        return;
    }
    try {
        plan.value = planProvisioning({
            catalog,
            moduleKey: EXTENSION_KEY,
            categories: categories as Record<CategoryKey, number>,
            wikiCategoryId,
            calendarIds: usedCalendarIds,
            roomIds: rooms.map((r) => r.id),
            usedRoomIds,
            appointmentRooms,
            serviceCalendarIds,
        });
    } catch (e) {
        planProblem.value = explain(e);
    }
}

/** Saves `changes` over the stored settings, read fresh – what they do not name stays (see `settingsToSave`). By default the assistant's fields. */
async function persistSettings(changes?: Partial<SettingsFields>): Promise<void> {
    const current = await repository!.loadSettings();
    await repository!.saveSettings(
        settingsToSave(
            current,
            changes ?? {
                designerGroupId: selected.designer ?? undefined,
                deviceGroupId: selected.device ?? undefined,
                createdGroupIds: createdGroupIds.value.length ? createdGroupIds.value : undefined,
                createdWikiCategoryId: createdWikiCategoryId.value ?? undefined,
            },
        ),
    );
}

/** The services an administrator may allow (Plan.md 58): null until loaded or where they cannot be. */
const serviceList = ref<ServiceInfo[] | null>(null);
const servicesFailed = ref(false);
const allowedServices = ref<number[]>([]);
const servicesSaved = ref(false);
const servicesSaving = ref(false);
let servicesRequested = false;
/** Most services the settings hold – the schema's limit. */
const ALLOWED_SERVICES_MAX = 50;

async function loadServices(): Promise<void> {
    if (servicesRequested || !repository) return;
    servicesRequested = true;
    try {
        // Its own reads, so a failure elsewhere on the page (the wiki, say) does not stop it; unreadable settings must not save over them.
        const [list, serviceGroups, settings] = await Promise.all([fetchServices(), fetchServiceGroups(), repository.loadSettings()]);
        allowedServices.value = settings?.allowedServiceIds ?? [];
        serviceList.value = serviceChoices(list, serviceGroups);
    } catch {
        servicesFailed.value = true;
    }
}

/** Saves at once; ids that are not a showable service any more drop out here, not before. */
async function toggleAllowedService(id: number, on: boolean, box: HTMLInputElement): Promise<void> {
    if (!repository || !serviceList.value || servicesSaving.value) return;
    const known = new Set(serviceList.value.map((s) => s.id));
    const next = [...new Set(on ? [...allowedServices.value, id] : allowedServices.value.filter((a) => a !== id))]
        .filter((a) => known.has(a))
        .sort((a, b) => a - b);
    servicesSaving.value = true;
    servicesSaved.value = false;
    error.value = null;
    try {
        await persistSettings({ allowedServiceIds: next });
        allowedServices.value = next;
        servicesSaved.value = true;
    } catch (e) {
        box.checked = !on;
        error.value = explain(e);
    } finally {
        servicesSaving.value = false;
    }
}

async function runAssistant(): Promise<void> {
    const question =
        `Zwei Gruppen anlegen – „${GROUP_NAMES.designer}" und „${GROUP_NAMES.device}" – und ihren Rollen die Rechte geben?\n\n` +
        'Bestehende Gruppen und Rollen bleiben unberührt. „Einrichtung entfernen" macht es rückgängig.';
    if (!repository || !window.confirm(question)) return;
    assistant.running = true;
    assistant.error = null;
    assistant.log = [];
    try {
        // Before anything is created, groups included: no second wiki area for one the administrator cannot see (Plan.md 55 B).
        const creation = wikiCategoryCreation({
            visibleCategoryId: wikiCategoryId,
            createdCategoryId: createdWikiCategoryId.value,
            canViewWiki: await canViewWiki(),
        });
        if (!creation.create && creation.problem) throw new Error(creation.problem);
        const groupTypeId = await findGroupTypeId(GROUP_TYPE_NAME);
        if (groupTypeId === null) throw new Error(`Den Gruppentyp „${GROUP_TYPE_NAME}" gibt es auf dieser Instanz nicht.`);
        if (creation.create) {
            wikiCategory.value = await createCategory();
            wikiCategoryId = wikiCategory.value.id;
            createdWikiCategoryId.value = wikiCategory.value.id;
            assistant.log.push(`Wiki-Bereich „${WIKI_CATEGORY_NAME}" angelegt.`);
        }
        computePlan();
        if (!plan.value) throw new Error(planProblem.value ?? 'Kein Plan.');
        const result = await provision(plan.value, groupTypeId, churchToolsProvisionApi);
        assistant.log.push(...result.log);
        assistant.error = result.error;
        createdGroupIds.value = [...createdGroupIds.value, ...Object.values(result.groupIds)];
        selected.designer = result.groupIds.designer ?? selected.designer;
        selected.device = result.groupIds.device ?? selected.device;
        // Saved even after a failure: what was created must stay removable.
        await persistSettings();
        groups.value = await loadGroups();
        await Promise.all([check('designer'), check('device')]);
    } catch (e) {
        assistant.error = explain(e);
        assistant.log.push(`Abgebrochen: ${assistant.error}`);
    } finally {
        assistant.running = false;
    }
}

/** Grants the current plan again to the groups the assistant created – e.g. for a calendar a screen now shows. */
async function updateRights(): Promise<void> {
    if (!plan.value) return;
    const groupIds = {
        designer: createdGroupIds.value.includes(selected.designer ?? -1) ? selected.designer! : undefined,
        device: createdGroupIds.value.includes(selected.device ?? -1) ? selected.device! : undefined,
    };
    assistant.running = true;
    assistant.error = null;
    try {
        const result = await refreshGrants(plan.value, groupIds, churchToolsProvisionApi);
        assistant.log = result.log;
        assistant.error = result.error;
        await Promise.all([check('designer'), check('device')]);
    } finally {
        assistant.running = false;
    }
}

/**
 * Opens the confirmation dialog for „Einrichtung entfernen" – but only
 * once this account has saved the settings unchanged: without that right
 * the deletion could never be recorded, and every retry would run into an
 * already-gone group and stop right there (Plan.md, F; gemessen 2026-09-28,
 * Abnahme P1). A real save, not a look at `/permissions/global`: what that
 * reports for a system administrator is unmeasured.
 */
async function openRemoveSetup(): Promise<void> {
    if (!repository) return;
    assistant.error = null;
    try {
        await persistSettings();
    } catch (e) {
        assistant.error =
            httpStatus(e) === 403
                ? 'Entfernen nicht möglich: Du darfst die Einstellungen des Designers nicht ändern. Danach wüsste der ' +
                  'Designer nicht, dass die Gruppen gelöscht sind. Gib deiner Administratoren-Gruppe die Modulrechte ' +
                  '(Einrichtung, Schritt 2) und versuche es erneut.'
                : `Entfernen nicht möglich: Die Einstellungen ließen sich nicht speichern (${explain(e)}).`;
        return;
    }
    const affected: RemoveGroupInfo[] = createdGroupIds.value.map((id) => {
        const group = groups.value.find((g) => g.id === id);
        return { id, name: group?.name ?? null, memberCount: groupMemberCounts[id] };
    });
    let ownGroupIds: number[] = [];
    try {
        const person = await currentPerson();
        ownGroupIds = await personGroupIds(person.id);
    } catch {
        // Only the warning about locking oneself out is lost – the dialog still opens and removal still works.
    }
    let deviceAccounts: DeviceAccountInfo[] = [];
    try {
        const deviceGroupId = deviceGroupIdForRemoval();
        if (deviceGroupId !== null) {
            const members = await groupMemberNames(deviceGroupId);
            const baseUrl = instanceBaseUrl();
            deviceAccounts = members.map((m) => ({ ...m, url: personUrl(baseUrl, m.personId) }));
        }
    } catch {
        // Only naming the device accounts is lost – e.g. the group is already gone (404). The dialog still opens.
    }
    removeDialog.value = {
        groups: affected,
        ownMemberOf: affected.filter((g) => ownGroupIds.includes(g.id)).map((g) => g.name ?? `Gruppe ${g.id}`),
        deviceAccounts,
    };
}

/**
 * The device group's id for „Einrichtung entfernen" (Plan.md, F; G18): by
 * name where a group of that name is among the created ones, else by the
 * device side's own choice – but only if that choice is itself one of the
 * assistant's own groups. A group nobody can name anymore stays without
 * device accounts; the dialog still opens.
 */
function deviceGroupIdForRemoval(): number | null {
    const byName = groups.value.find((g) => g.name === GROUP_NAMES.device && createdGroupIds.value.includes(g.id));
    if (byName) return byName.id;
    return selected.device !== null && createdGroupIds.value.includes(selected.device) ? selected.device : null;
}

/**
 * Shows the wiki area among „Kategorien" again once the groups behind it are
 * gone (Plan.md, F, 2026-09-28): with „Infoscreen-Designer" removed, only
 * administrators reach the area anyway, so it no longer needs to hide under
 * „Ausgeblendet" – it stays, whether or not the assistant created it, and a
 * failed toggle is only logged, never treated as a failure of the removal.
 */
async function restoreWikiVisibility(): Promise<void> {
    if (!wikiCategory.value) return;
    if (wikiCategory.value.inMenu !== false) {
        assistant.log.push(wikiRestoreLogLine(WIKI_CATEGORY_NAME, 'already-shown'));
        return;
    }
    try {
        wikiCategory.value = await setCategoryInMenu(wikiCategory.value, true);
        assistant.log.push(wikiRestoreLogLine(WIKI_CATEGORY_NAME, 'shown'));
    } catch (e) {
        assistant.log.push(wikiRestoreLogLine(WIKI_CATEGORY_NAME, { error: explain(e) }));
    }
}

/**
 * Runs the removal once the dialog confirms it. The dialog closes right
 * away: progress and errors of every assistant action already have one place
 * on the page, the assistant card below – showing them a second time inside
 * a dialog that is about to disappear would only split the story in two.
 */
async function confirmRemoveSetup(): Promise<void> {
    if (!repository) return;
    // Kept beyond closing the dialog: once the device group is gone, this is the only record of who its members were.
    const deviceAccountNames = removeDialog.value?.deviceAccounts.map((a) => a.name) ?? [];
    removeDialog.value = null;
    assistant.running = true;
    assistant.error = null;
    try {
        const result = await removeCreatedGroups(
            createdGroupIds.value,
            { designer: selected.designer, device: selected.device },
            async (id) => {
                try {
                    await deleteGroup(id);
                    return 'deleted';
                } catch (e) {
                    // Already gone – e.g. a save that failed after a previous run (Plan.md, F).
                    if (httpStatus(e) === 404) return 'gone';
                    throw new Error(explain(e));
                }
            },
        );
        assistant.log = result.log;
        assistant.error = result.error;
        createdGroupIds.value = result.remaining;
        selected.designer = result.selected.designer ?? null;
        selected.device = result.selected.device ?? null;
        // Runs before the save below, but cannot block it: it only ever
        // pushes a log line, never throws (Plan.md, F).
        if (result.error === null) {
            await restoreWikiVisibility();
            if (deviceAccountNames.length) {
                assistant.log.push(devicePasswordRecommendationLogLine(deviceAccountNames));
            }
            // Only shown once removal went through cleanly: the manual steps left over
            // (extension, device accounts, wiki area) still apply (docs/Einrichtung.md).
            assistant.log.push(REMOVE_SETUP_NEXT_STEPS_LOG_LINE);
        }
        // Saved even after a failure: what is still there must stay removable (Plan.md, F).
        await persistSettings();
        // Not shown again, even if ChurchTools still had them in the same list request.
        groups.value = (await loadGroups()).filter((g) => !result.removed.includes(g.id));
        await Promise.all([check('designer'), check('device')]);
    } catch (e) {
        assistant.error = explain(e);
    } finally {
        assistant.running = false;
    }
}

function explain(e: unknown): string {
    if (httpStatus(e) === 403) {
        return 'Rechte anderer lesen darf nur, wer in ChurchTools Berechtigungen verwalten darf. Diese Seite ist für Administratoren.';
    }
    return e instanceof Error ? e.message : String(e);
}

async function check(side: Side): Promise<void> {
    const groupId = selected[side];
    checks[side] = null;
    if (groupId === null) return;
    busy[side] = true;
    try {
        const rights = await loadGroupRights(groupId);
        groupMemberCounts[groupId] = rights.members.length;
        if (side === 'designer') {
            checks.designer = checkDesignerGroup({
                statusId: rights.group.statusId,
                roles: rights.roles,
                wikiCategoryId,
                moduleRights: moduleRights('designer'),
                forbidden: forbiddenRights('designer'),
                roomIds: rooms.map((r) => r.id),
            });
        } else {
            const members = await Promise.all(
                rights.members.map(async (m) => {
                    const person = await loadPersonGrants(m.personId);
                    return { label: person.label, grants: [...m.roleGrants, ...person.grants] };
                }),
            );
            checks.device = checkDeviceGroup({
                statusId: rights.group.statusId,
                members,
                calendars,
                usedCalendarIds,
                rooms,
                usedRoomIds,
                appointmentRooms,
                serviceCalendarIds,
                videoInUse,
                wikiCategoryId,
                moduleRights: moduleRights('device'),
                // Only with the catalogue: without the plan nobody knows what a device needs (Plan.md 58 E).
                plannedAuthIds: plan.value?.find((spec) => spec.key === 'device')?.grants.map((g) => g.authId),
                authName: (authId) => catalog?.name(authId),
            });
        }
        if (selected.designer !== null && selected.designer === selected.device) {
            checks[side]!.unshift({
                level: 'warn',
                category: 'group',
                text: 'Gestalter und Geräte sind dieselbe Gruppe.',
                detail: 'Dann bekommen die Geräte die Rechte der Gestalter – mehr, als ein unbeaufsichtigtes Gerät haben sollte.',
            });
        }
    } catch (e) {
        checks[side] = [{ level: 'fail', category: 'group', text: 'Prüfen nicht möglich.', detail: explain(e) }];
    } finally {
        busy[side] = false;
    }
}

function choose(side: Side, value: string): void {
    selected[side] = value ? Number(value) : null;
    saveState.value = 'idle';
    void check(side);
}

async function save(): Promise<void> {
    if (!repository) return;
    saveState.value = 'saving';
    try {
        await persistSettings();
        saveState.value = 'saved';
    } catch (e) {
        saveState.value = 'failed';
        error.value = explain(e);
    }
}

/**
 * Role concept (2026-09-24): the setup belongs to ChurchTools administrators –
 * they install the extension and hand out the rights. Designers change
 * content, devices only read. Who may manage permissions counts as admin.
 */
const admin = ref<boolean | null>(null);
/**
 * Whether the card "Mediathek im Wiki" can be decided yet: only once the demo
 * mode and the wiki area are known does the overview know whether to show it.
 */
const settingsLoaded = ref(false);

onMounted(async () => {
    try {
        admin.value = await isAdministrator();
        if (!admin.value) return;
        const handle = await getRepository();
        repository = handle.repository;
        demo.value = handle.demo;
        if (page.value === 'services') void loadServices();
        const [list, settings, wikiCategories, calendarList, used, screenList, masterdata, usedRooms, roomsAtAppointments, serviceCalendars, videos] = await Promise.all([
            loadGroups(),
            repository.loadSettings(),
            churchtoolsClient.get<WikiCategory[]>('/wiki/categories'),
            fetchCalendars(),
            repository.calendarIdsInUse(),
            repository.listScreens(),
            fetchResourceMasterdata().catch(() => null),
            repository.roomIdsInUse(),
            repository.appointmentRoomsInUse(),
            repository.serviceCalendarIdsInUse(),
            repository.videoInUse(),
        ]);
        screens.value = screenList;
        device.slug = screenList[0]?.slug ?? '';
        groups.value = list;
        wikiCategory.value = wikiCategories.find((c) => c.name === WIKI_CATEGORY_NAME) ?? null;
        wikiCategoryId = wikiCategory.value?.id ?? null;
        wikiCategoryIdKnown.value = wikiCategoryId !== null;
        settingsLoaded.value = true;
        calendars = calendarList;
        usedCalendarIds = used;
        rooms = masterdata ? roomsOf(masterdata) : [];
        usedRoomIds = usedRooms;
        appointmentRooms = roomsAtAppointments;
        serviceCalendarIds = serviceCalendars;
        videoInUse = videos;
        selected.designer = settings?.designerGroupId ?? null;
        selected.device = settings?.deviceGroupId ?? null;
        createdGroupIds.value = settings?.createdGroupIds ?? [];
        createdWikiCategoryId.value = settings?.createdWikiCategoryId ?? null;
        if (!demo.value) {
            // Without these the assistant only explains; the page itself still works.
            [categories, catalog] = await Promise.all([
                repository.visibleCategories(),
                loadAuthCatalog().catch(() => null),
            ]);
            assistant.allowed = true;
        }
        computePlan();
        await Promise.all([check('designer'), check('device')]);
    } catch (e) {
        error.value = explain(e);
    }
});

// RouterView keeps this instance: arriving on the page later loads the services then.
watch(page, (now) => {
    if (now === 'services' && admin.value) void loadServices();
});

/**
 * Addresses for the TVs, way B (Plan.md, D; G9, G32): the device account's
 * token goes into the address, so the TV signs itself in on every load.
 * Password and token are kept nowhere – not in the settings, which designers
 * can read; the address exists only on this page and in the kiosk browser.
 */
const screens = ref<ScreenDoc[]>([]);
const device = reactive({
    slug: '',
    username: '',
    password: '',
    busy: false,
    error: null as string | null,
    url: null as string | null,
    personId: null as number | null,
    copied: false,
});

async function createTvAddress(): Promise<void> {
    if (!device.slug || !device.username.trim() || !device.password) return;
    Object.assign(device, { busy: true, error: null, url: null, personId: null, copied: false });
    try {
        const login = await createDeviceLogin(instanceBaseUrl(), device.username, device.password);
        device.url = withDeviceLogin(playerUrl(device.slug), login);
        device.personId = login.personId;
    } catch (e) {
        device.error = e instanceof Error ? e.message : String(e);
    } finally {
        device.password = '';
        device.busy = false;
    }
}

async function copyTvAddress(): Promise<void> {
    if (!device.url) return;
    try {
        await navigator.clipboard.writeText(device.url);
        device.copied = true;
    } catch {
        // Without clipboard access the address stays visible for copying by hand.
    }
}

/** Which build is installed (Plan.md, 12). */
const APP_VERSION = __APP_VERSION__;

const SYMBOL = { ok: '✓', warn: '!', fail: '✗', info: 'i' } as const;
const SIDES: { side: Side; title: string; purpose: string }[] = [
    {
        side: 'designer',
        title: 'Gestalter',
        purpose: 'Wer Infoscreens gestaltet. Die Gruppe braucht die Rechte am Modul und am Wiki-Bereich „Infoscreen" für die Mediathek.',
    },
    {
        side: 'device',
        title: 'Geräte',
        purpose: 'Die Konten, mit denen sich die Fernseher anmelden. Sie brauchen nur Leserechte: auf die Kalender ihrer Screens und, für Videos, auf den Wiki-Bereich „Infoscreen" – sonst nichts.',
    },
];
</script>

<template>
    <ModulePage current="setup">
        <div class="setup">
            <RouterLink v-if="page !== 'overview'" class="back" :to="{ name: 'setup' }" data-testid="settings-back">
                <Icon name="back" :size="16" /> Einstellungen
            </RouterLink>
            <PageHeader :icon="header.icon" :title="header.title" testid="setup-heading">
                {{ header.intro }}
            </PageHeader>
            <p v-if="admin === null" class="empty">Lade …</p>
            <section v-else-if="!admin" class="d-banner d-banner--warning" data-testid="setup-admins-only">
                <strong>Die Einstellungen sind Sache der ChurchTools-Administratoren.</strong>
                <p>
                    Sie legen die Gruppen für Gestalter und Geräte an und vergeben deren Rechte. Wer Infoscreens gestaltet,
                    braucht diese Seite nicht – fehlt dir ein Recht, wende dich an einen Administrator deiner Gemeinde.
                </p>
            </section>
            <template v-else>
                <p v-if="error" class="error" role="alert">{{ error }}</p>

                <div v-if="page === 'overview'" class="cards">
                    <RouterLink class="d-card settings-card" :to="{ name: 'setup-groups' }" data-testid="settings-card-groups">
                        <span class="settings-card-icon"><Icon name="person" :size="20" /></span>
                        <span class="settings-card-body">
                            <h2>Gruppen und Rechte</h2>
                            <p class="muted">
                                Der Assistent legt die Gruppen für Gestalter und Geräte samt Rechten an; hier prüfst und
                                aktualisierst du sie oder entfernst die Einrichtung.
                            </p>
                        </span>
                        <Icon name="forward" class="settings-card-forward" />
                    </RouterLink>
                    <RouterLink class="d-card settings-card" :to="{ name: 'setup-tv' }" data-testid="settings-card-tv">
                        <span class="settings-card-icon"><Icon name="tv" :size="20" /></span>
                        <span class="settings-card-body">
                            <h2>Adressen für die Fernseher</h2>
                            <p class="muted">Erzeugt die Adresse, mit der sich ein Fernseher selbst anmeldet.</p>
                        </span>
                        <Icon name="forward" class="settings-card-forward" />
                    </RouterLink>
                    <RouterLink
                        v-if="settingsLoaded && wikiCategory && !demo"
                        class="d-card settings-card"
                        :to="{ name: 'setup-wiki' }"
                        data-testid="settings-card-wiki"
                    >
                        <span class="settings-card-icon"><Icon name="image" :size="20" /></span>
                        <span class="settings-card-body">
                            <h2>Mediathek im Wiki</h2>
                            <p class="muted">Wo die Bilder der Mediathek im Wiki stehen.</p>
                        </span>
                        <Icon name="forward" class="settings-card-forward" />
                    </RouterLink>
                    <RouterLink class="d-card settings-card" :to="{ name: 'setup-services' }" data-testid="settings-card-services">
                        <span class="settings-card-icon"><Icon name="person" :size="20" /></span>
                        <span class="settings-card-body">
                            <h2>Dienste auf Screens</h2>
                            <p class="muted">Welche Dienste mit Namen auf einem Fernseher erscheinen dürfen.</p>
                        </span>
                        <Icon name="forward" class="settings-card-forward" />
                    </RouterLink>
                </div>

                <template v-if="page === 'groups'">
                    <p class="lead">
                        Rechte vergibt ChurchTools an Rollen in Gruppen. Am einfachsten legt der Assistent die beiden Gruppen samt
                        Rechten an. Wer eigene Gruppen nutzt, wählt sie unten aus – die Prüfung sagt, was fehlt, und ändert nichts.
                    </p>

                    <section class="d-card card assistant" data-testid="assistant">
                        <h2>Automatisch einrichten</h2>
                        <template v-if="createdGroupIds.length">
                            <p>
                                Die Gruppen des Infoscreens sind eingerichtet. Wer gestalten soll, wird Mitglied in „{{ GROUP_NAMES.designer }}",
                                die Konten der Fernseher in „{{ GROUP_NAMES.device }}" – mehr ist nicht zu tun.
                            </p>
                            <p class="muted small">
                                Zeigt ein Screen einen weiteren Kalender, bringt „Rechte aktualisieren" die Gruppen auf den Stand.
                            </p>
                            <div class="actions">
                                <button
                                    class="d-btn d-btn--primary"
                                    type="button"
                                    :disabled="!assistant.allowed || !plan || assistant.running"
                                    data-testid="update-rights"
                                    @click="updateRights"
                                >
                                    Rechte aktualisieren
                                </button>
                                <button class="d-btn d-btn--danger" type="button" :disabled="assistant.running" data-testid="remove-setup" @click="openRemoveSetup">
                                    Einrichtung entfernen
                                </button>
                            </div>
                        </template>
                        <template v-else>
                            <p>
                                Legt zwei leere Gruppen vom Typ „{{ GROUP_TYPE_NAME }}" an und gibt ihren Rollen die nötigen Rechte. Danach
                                müssen nur noch Personen in die Gruppen aufgenommen werden.
                            </p>
                            <p v-if="planProblem" class="muted">{{ planProblem }}</p>
                            <p v-else-if="foreignGroups.length" class="warn">
                                Es gibt schon {{ foreignGroups.map((g) => `„${g.name}"`).join(' und ') }}. Der Assistent übernimmt keine
                                fremden Gruppen – wähle sie unten aus und prüfe ihre Rechte.
                            </p>
                            <details v-if="plan" class="plan">
                                <summary>Was genau passiert</summary>
                                <div v-for="group in plan" :key="group.key">
                                    <strong>{{ group.name }}</strong> – an allen Rollen:
                                    <ul>
                                        <li v-for="grant in group.grants" :key="`${grant.authId}`">{{ grant.label }}</li>
                                    </ul>
                                </div>
                                <p v-if="wikiMissing" class="muted small">Dazu wird der Wiki-Bereich „Infoscreen" für die Mediathek angelegt.</p>
                            </details>
                            <div class="actions">
                                <button
                                    class="d-btn d-btn--primary"
                                    type="button"
                                    data-testid="run-assistant"
                                    :disabled="!assistant.allowed || !plan || foreignGroups.length > 0 || assistant.running"
                                    @click="runAssistant"
                                >
                                    Gruppen und Rechte anlegen
                                </button>
                                <span v-if="assistant.running" class="muted">Arbeitet …</span>
                            </div>
                        </template>
                        <ul v-if="assistant.log.length" class="log" data-testid="assistant-log">
                            <li v-for="(line, i) in assistant.log" :key="i">{{ line }}</li>
                        </ul>
                        <p v-if="assistant.error" class="error" role="alert">{{ assistant.error }}</p>
                    </section>

                    <div class="sides">
                        <section v-for="{ side, title, purpose } in SIDES" :key="side" class="d-card card" :data-testid="`setup-${side}`">
                            <h2>{{ title }}</h2>
                            <p class="muted">{{ purpose }}</p>
                            <label class="d-field">
                                Gruppe
                                <select
                                    :value="selected[side] ?? ''"
                                    :data-testid="`group-${side}`"
                                    @change="choose(side, ($event.target as HTMLSelectElement).value)"
                                >
                                    <option value="">– keine gewählt –</option>
                                    <option v-for="g in groups" :key="g.id" :value="g.id">{{ g.name }}</option>
                                </select>
                            </label>
                            <p v-if="!groups.length && !error" class="muted">Lade Gruppen …</p>
                            <p class="muted small">
                                Keine passende Gruppe? In ChurchTools unter „Gruppen" eine anlegen, auf „aktiv" stellen und hier wählen.
                            </p>

                            <p v-if="busy[side]" class="muted">Prüfe …</p>
                            <div v-else-if="checks[side]" class="checks" :data-testid="`checks-${side}`">
                                <details
                                    v-for="group in groupChecks(checks[side]!)"
                                    :key="group.category"
                                    :class="`check-group check-group--${group.level}`"
                                    data-testid="check-group"
                                    :data-category="group.category"
                                >
                                    <summary>
                                        <span class="check-group-head">
                                            <span :class="`check--${group.level}`">
                                                <span class="symbol" aria-hidden="true">{{ SYMBOL[group.level] }}</span>
                                            </span>
                                            <strong>{{ group.title }}</strong>
                                            <span class="check-group-summary muted">{{ group.summary }}</span>
                                            <Icon name="chevron-down" :size="14" class="chevron" />
                                        </span>
                                        <ul v-if="group.notices.length" class="check-notices">
                                            <li
                                                v-for="(c, i) in group.notices"
                                                :key="i"
                                                :class="`check--${c.level}`"
                                                data-testid="check-notice"
                                            >
                                                <span class="symbol" aria-hidden="true">{{ SYMBOL[c.level] }}</span>
                                                <span>{{ c.text }}</span>
                                            </li>
                                        </ul>
                                    </summary>
                                    <ul class="check-list">
                                        <li v-for="(c, i) in group.checks" :key="i" :class="`check--${c.level}`">
                                            <span class="symbol" aria-hidden="true">{{ SYMBOL[c.level] }}</span>
                                            <span>
                                                {{ c.text }}
                                                <small v-if="c.detail" class="muted">{{ c.detail }}</small>
                                            </span>
                                        </li>
                                    </ul>
                                </details>
                            </div>
                        </section>
                    </div>

                    <div class="actions">
                        <button class="d-btn d-btn--primary" type="button" data-testid="save-setup" @click="save">Auswahl speichern</button>
                        <span v-if="saveState === 'saved'" class="muted" data-testid="setup-saved">Gespeichert.</span>
                        <span v-else-if="saveState === 'saving'" class="muted">Speichert …</span>
                    </div>
                    <p class="muted small">
                        Geprüft werden die Rechte der Gruppenrollen und ihrer Gruppentyp-Rollen, bei Geräten dazu Personenstatus und
                        direkt vergebene Rechte. Rechte aus anderen Gruppen zählen nicht mit.
                    </p>
                </template>

                <template v-if="page === 'services'">
                    <section class="d-card card" data-testid="allowed-services">
                        <p class="lead">
                            Dienste zeigen, wer eingeteilt ist – mit Vor- und Nachnamen, für alle sichtbar, die am Fernseher
                            vorbeigehen. Hier legst du fest, welche Dienste Gestalter überhaupt wählen können. Ohne Auswahl
                            erscheint kein Dienst. Zur Wahl stehen nur Dienste, deren Dienstgruppe in ChurchTools „Ohne
                            Berechtigung einsehbar" ist und die Namen nicht verbergen.
                        </p>
                        <p v-if="servicesFailed" class="error" role="alert" data-testid="allowed-services-failed">
                            Dienste konnten nicht geladen werden.
                        </p>
                        <p v-else-if="!serviceList" class="empty">Lade …</p>
                        <p v-else-if="!serviceList.length" class="muted" data-testid="allowed-services-none">
                            In ChurchTools gibt es keinen Dienst, der gezeigt werden könnte.
                        </p>
                        <template v-else>
                            <label v-for="s in serviceList" :key="s.id" class="check">
                                <input
                                    type="checkbox"
                                    :checked="allowedServices.includes(s.id)"
                                    :disabled="servicesSaving || (!allowedServices.includes(s.id) && allowedServices.length >= ALLOWED_SERVICES_MAX)"
                                    data-testid="allowed-service"
                                    @change="toggleAllowedService(s.id, ($event.target as HTMLInputElement).checked, $event.target as HTMLInputElement)"
                                >
                                {{ s.name }}
                            </label>
                            <p v-if="servicesSaved" class="muted small" role="status" data-testid="allowed-services-saved">Gespeichert</p>
                        </template>
                    </section>
                </template>

                <template v-if="page === 'wiki'">
                    <section v-if="wikiCategory && !demo" class="d-card card" data-testid="wiki-menu">
                        <h2>Mediathek im Wiki</h2>
                        <p class="muted">
                            Die Bilder der Mediathek liegen im Wiki-Bereich „{{ WIKI_CATEGORY_NAME }}". Gepflegt werden sie im
                            Designer; im Wiki lässt sich der Bereich unter „Ausgeblendet" aus dem Blick räumen. Er bleibt dort
                            erreichbar – verborgen im strengen Sinn wird er nicht.
                        </p>
                        <p data-testid="wiki-menu-state">
                            Im Wiki steht er zurzeit
                            <strong>{{ wikiCategory.inMenu === false ? 'unter „Ausgeblendet"' : 'unter „Kategorien"' }}</strong>.
                        </p>
                        <p data-testid="wiki-owner" class="muted small">
                            <template v-if="wikiCategory.id === createdWikiCategoryId">Angelegt vom Infoscreen Designer.</template>
                            <template v-else>
                                Nicht als vom Designer angelegt vermerkt – etwa weil es ihn schon gab. Er gehört damit der Gemeinde und
                                wird vom Designer nie gelöscht.
                            </template>
                        </p>
                        <div class="actions">
                            <button class="d-btn" type="button" :disabled="wikiBusy" data-testid="wiki-menu-toggle" @click="toggleWikiMenu">
                                {{ wikiCategory.inMenu === false ? 'Wieder unter „Kategorien" zeigen' : 'Unter „Ausgeblendet" führen' }}
                            </button>
                        </div>
                        <p v-if="wikiError" class="error" role="alert">{{ wikiError }}</p>
                    </section>
                    <p v-else class="empty" data-testid="wiki-empty">
                        <template v-if="demo">Im Demo-Modus nicht verfügbar.</template>
                        <template v-else>
                            Es gibt noch keinen Wiki-Bereich „{{ WIKI_CATEGORY_NAME }}" – der Assistent legt ihn unter „Gruppen und
                            Rechte" an.
                        </template>
                    </p>
                </template>

                <section v-if="page === 'tv'" class="d-card card tv" data-testid="tv-address">
                    <h2>Adresse für einen Fernseher</h2>
                    <p class="muted">
                        Mit dieser Adresse meldet sich der Fernseher bei jedem Start selbst als Geräte-Benutzer an – eine
                        Anmeldung im Browser hielte nur 24 Stunden. Trag sie als Startseite des Kiosk-Browsers ein.
                    </p>
                    <p v-if="!screens.length" class="muted small">Noch keine Screens angelegt.</p>
                    <form v-else class="tv-form" autocomplete="off" @submit.prevent="createTvAddress">
                        <label class="d-field">
                            Screen
                            <select v-model="device.slug" data-testid="tv-screen">
                                <option v-for="screen in screens" :key="screen.id" :value="screen.slug">{{ screen.name }}</option>
                            </select>
                        </label>
                        <label class="d-field">
                            Benutzername des Geräte-Kontos
                            <input
                                v-model="device.username"
                                type="text"
                                autocapitalize="off"
                                spellcheck="false"
                                autocomplete="off"
                                data-testid="tv-username"
                            >
                        </label>
                        <label class="d-field">
                            Passwort des Geräte-Kontos
                            <input v-model="device.password" type="password" autocomplete="new-password" data-testid="tv-password">
                        </label>
                        <div class="actions tv-actions">
                            <button
                                class="d-btn d-btn--primary"
                                type="submit"
                                :disabled="device.busy || !device.username.trim() || !device.password"
                                data-testid="tv-create"
                            >
                                Adresse erzeugen
                            </button>
                            <span v-if="device.busy" class="muted">Meldet an …</span>
                        </div>
                    </form>
                    <p class="muted small">
                        Passwort und Adresse werden nirgends gespeichert. Das Passwort dient nur dazu, bei ChurchTools den
                        Login-Token des Geräte-Kontos abzuholen.
                    </p>
                    <p v-if="device.error" class="error" role="alert" data-testid="tv-error">{{ device.error }}</p>
                    <div v-if="device.url" class="tv-result" data-testid="tv-result">
                        <code class="url">{{ device.url }}</code>
                        <button class="d-btn" type="button" data-testid="tv-copy" @click="copyTvAddress">
                            {{ device.copied ? 'Kopiert' : 'Kopieren' }}
                        </button>
                        <p class="d-banner d-banner--warning small">
                            <strong>Diese Adresse ist ein Schlüssel.</strong> Wer sie hat, sieht ChurchTools mit den Rechten
                            des Geräte-Kontos (Person {{ device.personId }}) – nur lesend, aber ohne Passwort. Nicht per
                            E-Mail oder Chat weitergeben. Ungültig wird sie, sobald das Passwort des Kontos geändert wird.
                        </p>
                    </div>
                </section>
            </template>
            <p v-if="page === 'overview'" class="muted small version" data-testid="app-version">
                Infoscreen Designer {{ APP_VERSION }} – was neu ist, steht unter
                <RouterLink :to="{ name: 'about' }">Über &amp; Neuigkeiten</RouterLink>. Neuere Fassungen stehen unter
                „Releases" auf GitHub und werden in der Extension-Verwaltung von ChurchTools als ZIP hochgeladen.
            </p>
        </div>

        <RemoveSetupDialog
            v-if="removeDialog"
            :groups="removeDialog.groups"
            :own-member-of="removeDialog.ownMemberOf"
            :device-accounts="removeDialog.deviceAccounts"
            :wiki-category-name="wikiCategory?.name"
            @close="removeDialog = null"
            @confirm="confirmRemoveSetup"
        />
    </ModulePage>
</template>

<style scoped>
.setup {
    display: grid;
    gap: 16px;
}
.sides,
.cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(320px, 100%), 1fr));
    gap: 16px;
}
.settings-card {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 16px 20px;
    color: inherit;
    text-decoration: none;
    transition: box-shadow 0.15s, border-color 0.15s;
}
.settings-card:hover {
    border-color: var(--d-interactive);
    box-shadow: 0 4px 12px -4px #0000001f;
}
.settings-card:focus-visible {
    outline: 2px solid var(--d-accent);
    outline-offset: 2px;
}
.settings-card-icon {
    display: grid;
    flex: none;
    place-items: center;
    width: 40px;
    height: 40px;
    border-radius: var(--d-radius-lg);
    background: var(--d-accent-pale);
    color: var(--d-accent);
}
.settings-card-body {
    display: grid;
    flex: 1;
    gap: 4px;
    min-width: 0;
}
.settings-card-body h2 {
    margin: 0;
    font-size: 1.1em;
}
.settings-card-body p {
    margin: 0;
}
.settings-card-forward {
    flex: none;
    color: var(--d-text-muted);
}
.back {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: var(--d-text-muted);
    font-size: var(--d-size-sm);
    text-decoration: none;
}
.back:hover {
    color: var(--d-text);
    text-decoration: underline;
}
.back:focus-visible {
    outline: 2px solid var(--d-accent);
    outline-offset: 2px;
    border-radius: var(--d-radius);
}
.card {
    display: grid;
    align-content: start;
    gap: 10px;
    padding: 16px 20px 20px;
    scroll-margin-top: 16px;
}
.card h2 {
    margin: 0;
    font-size: 1.15em;
}
.card p {
    margin: 0;
}
.check {
    display: flex;
    align-items: center;
    gap: 8px;
}
.checks {
    margin: 4px 0 0;
}
.check-group {
    border-top: 1px solid var(--d-divider);
}
.check-group:last-child {
    border-bottom: 1px solid var(--d-divider);
}
.check-group summary {
    display: grid;
    gap: 4px;
    min-height: 44px;
    padding: 8px 0;
    list-style: none;
    cursor: pointer;
}
.check-group summary::-webkit-details-marker {
    display: none;
}
.check-group summary:focus-visible {
    outline: 2px solid var(--d-accent);
    outline-offset: 2px;
}
.check-group-head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 8px;
    min-height: 28px;
}
.check-group-summary {
    margin-left: auto;
    font-size: var(--d-size-sm);
}
.check-group .chevron {
    color: var(--d-text-muted);
    transition: transform 0.15s;
}
.check-group:not([open]) .chevron {
    transform: rotate(-90deg);
}
.check-notices,
.check-list {
    display: grid;
    gap: 8px;
    margin: 0;
    padding: 0;
    list-style: none;
}
.check-notices {
    padding-left: 28px;
}
.check-list {
    padding: 0 0 12px;
}
.check-notices li,
.check-list li {
    display: grid;
    grid-template-columns: 22px minmax(0, 1fr);
    gap: 6px;
    align-items: start;
    overflow-wrap: anywhere;
}
.check-list small {
    display: block;
}
.symbol {
    display: inline-grid;
    place-items: center;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    color: #fff;
    font-size: 12px;
    font-weight: 700;
}
.check--ok .symbol {
    background: var(--d-success);
}
.check--warn .symbol {
    background: var(--d-warning);
}
.check--fail .symbol {
    background: var(--d-danger);
}
.check--info .symbol {
    background: var(--d-text-muted);
}
.assistant .actions {
    margin: 0;
}
.plan ul,
.log {
    margin: 4px 0 8px;
    padding-left: 20px;
}
.warn {
    color: var(--d-text);
}
.actions {
    display: flex;
    align-items: center;
    gap: 12px;
    margin: 20px 0 8px;
}
/* In the grid, margins add to the gap instead of collapsing: its gap alone spaces the page. */
.setup > .actions,
.setup > p {
    margin: 0;
}
.muted {
    color: var(--d-text-muted);
}
.empty {
    margin: 0;
    color: var(--d-text-muted);
    font-size: var(--d-size-sm);
}
.small {
    font-size: var(--d-size-sm);
}
.error {
    color: var(--d-danger);
}
.actions {
    flex-wrap: wrap;
}
.version {
    margin-top: 24px;
}
.tv-form {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(200px, 100%), 1fr));
    gap: 12px;
    align-items: end;
}
.tv-actions {
    grid-column: 1 / -1;
    margin: 0;
}
.tv-result {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 8px;
    align-items: center;
}
.tv-result .url {
    overflow-wrap: anywhere;
    font-size: var(--d-size-sm);
}
.tv-result .d-banner {
    grid-column: 1 / -1;
}
</style>
