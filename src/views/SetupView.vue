<script setup lang="ts">
import { churchtoolsClient } from '@churchtools/churchtools-client';
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { EXTENSION_KEY } from '../config';
import { t } from '../i18n/designer';
import Icon, { type IconName } from '../designer/Icon.vue';
import ModulePage from '../designer/ModulePage.vue';
import PageHeader from '../designer/PageHeader.vue';
import { fetchCalendars, fetchPublicCalendars, fetchResourceMasterdata, fetchServiceGroups, fetchServices, type Calendar } from '../ct/api';
import { serviceChoices, type ServiceInfo } from '../appointments/services';
import { currentPerson, httpStatus, instanceBaseUrl, personUrl } from '../ct/client';
import { playerUrl } from '../designer/player-url';
import { GROUP_RIGHT_NAMES, settingsAbilities, type GroupPermissions, type SettingsButton } from '../setup/abilities';
import RefreshRightsDialog from '../designer/RefreshRightsDialog.vue';
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
    loadGroupPermissions,
    loadGroupTypes,
    groupMemberNames,
    loadGroupRights,
    loadGroups,
    loadPersonGrants,
    personGroupIds,
    personGroups,
    type GroupSummary,
} from '../setup/load';
import { settingsToSave, type SettingsFields } from '../setup/settings-doc';
import { wikiCategoryCreation } from '../setup/wiki-creation';
import { createDeviceLogin } from '../setup/device-token';
import {
    devicePasswordRecommendationLogLine,
    GROUP_NAMES,
    defaultGroupTypeId,
    planProvisioning,
    provision,
    applyRefresh,
    readRefresh,
    refreshIsEmpty,
    refreshLogLine,
    type RefreshState,
    REMOVE_SETUP_NEXT_STEPS_LOG_LINE,
    removeCreatedGroups,
    type GroupSpec,
    type GroupTypeChoice,
} from '../setup/provision';
import { isAdministrator } from '../designer/administrator';
import { useConfirm } from '../designer/useConfirm';
import { getRepository } from '../store/backend';
import { CATEGORIES, type CategoryKey, type ScreenRepository } from '../store/screen-repository';

const { confirm } = useConfirm();

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
        title: t.common.settings,
        intro: t.setup.overview.intro,
    },
    groups: {
        icon: 'person',
        title: t.setup.groups.title,
        intro: t.setup.groups.intro,
    },
    tv: {
        icon: 'tv',
        title: t.setup.tv.title,
        intro: t.setup.tv.intro,
    },
    wiki: {
        icon: 'image',
        title: t.setup.wiki.title,
        intro: t.setup.wiki.intro,
    },
    services: {
        icon: 'person',
        title: t.setup.services.title,
        intro: t.setup.services.intro,
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
/** The calendars the public user sees – "public" (Plan.md 73, G53). */
let publicCalendarIds: number[] = [];
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
/** `status` is the category of the signs of life (Plan.md 59), no required one: the plan takes it when it is there. */
let categories: Partial<Record<CategoryKey, number>> & { status?: number } = {};

/** The setup assistant (Plan.md, 9): what it would do, and what it did. */
const demo = ref(false);
const plan = ref<GroupSpec[] | null>(null);
const planProblem = ref<string | null>(null);
const createdGroupIds = ref<number[]>([]);
/** The group rights of this account (Plan.md 63); `undefined` while unknown or unreadable – then nothing is greyed out. */
const groupPermissions = ref<GroupPermissions | undefined>(undefined);
/** The group types of the instance (Plan.md 71); `undefined` while unknown, `null` when they could not be loaded. */
const groupTypes = ref<GroupTypeChoice[] | null | undefined>(undefined);
/** The type the administrator picks for the new groups – „Merkmal" where the instance has it. */
const chosenTypeId = ref<number | null>(null);
/** The type the assistant created its groups with: from the settings, else „Merkmal" (installations before 1.25). */
const createdTypeId = ref<number | null>(null);
const abilities = computed(() =>
    settingsAbilities(groupTypes.value === undefined || groupTypes.value === null ? undefined : groupPermissions.value, createdGroupIds.value, {
        createTypeId: chosenTypeId.value,
        createdTypeId: createdTypeId.value,
    }),
);
const typeName = (id: number | null): string | undefined => groupTypes.value?.find((type) => type.id === id)?.name;
const chosenTypeName = computed(() => typeName(chosenTypeId.value));
function abilityHint(button: SettingsButton): string | null {
    const { allowed, missing } = abilities.value[button];
    if (allowed) return null;
    const typeRight = missing.some((m) => m === GROUP_RIGHT_NAMES.createType || m === GROUP_RIGHT_NAMES.viewType);
    return t.setup.abilityHint(missing, typeRight ? chosenTypeName.value : undefined);
}
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

/** Only public calendars get a right for their events; the rest is named by the check (Plan.md 73). */
function grantableCalendars(ids: number[]): number[] {
    const showable = new Set(publicCalendarIds);
    return ids.filter((id) => showable.has(id));
}

function computePlan(): void {
    plan.value = null;
    planProblem.value = null;
    if (demo.value) {
        planProblem.value = t.setup.plan.demo;
        return;
    }
    if (!catalog) {
        planProblem.value = t.setup.plan.catalog;
        return;
    }
    const keys = Object.keys(CATEGORIES) as CategoryKey[];
    if (keys.some((k) => categories[k] === undefined)) {
        planProblem.value = t.setup.plan.categories;
        return;
    }
    try {
        plan.value = planProvisioning({
            catalog,
            moduleKey: EXTENSION_KEY,
            categories: categories as Record<CategoryKey, number> & { status?: number },
            wikiCategoryId,
            roomIds: rooms.map((r) => r.id),
            usedRoomIds,
            appointmentRooms,
            serviceCalendarIds: grantableCalendars(serviceCalendarIds),
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
                createdGroupTypeId: createdGroupIds.value.length ? (createdTypeId.value ?? undefined) : undefined,
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
    if (on) {
        const name = serviceList.value.find((s) => s.id === id)?.name ?? t.setup.services.fallbackName(id);
        if (!(await confirm({ message: t.setup.services.confirm(name), confirmLabel: t.setup.services.release }))) {
            box.checked = false;
            return;
        }
    }
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
    const groupTypeId = chosenTypeId.value;
    if (groupTypeId === null) return;
    const question = t.setup.assistantRun.question(chosenTypeName.value, GROUP_NAMES.designer, GROUP_NAMES.device);
    if (!repository || !(await confirm({ message: question, confirmLabel: t.setup.groups.create }))) return;
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
        if (creation.create) {
            wikiCategory.value = await createCategory();
            wikiCategoryId = wikiCategory.value.id;
            createdWikiCategoryId.value = wikiCategory.value.id;
            assistant.log.push(t.setup.assistantRun.wikiCreated(WIKI_CATEGORY_NAME));
        }
        computePlan();
        if (!plan.value) throw new Error(planProblem.value ?? t.setup.plan.none);
        const result = await provision(plan.value, groupTypeId, churchToolsProvisionApi);
        assistant.log.push(...result.log);
        assistant.error = result.error;
        createdGroupIds.value = [...createdGroupIds.value, ...Object.values(result.groupIds)];
        createdTypeId.value = groupTypeId;
        selected.designer = result.groupIds.designer ?? selected.designer;
        selected.device = result.groupIds.device ?? selected.device;
        // Saved even after a failure: what was created must stay removable.
        await persistSettings();
        groups.value = await loadGroups();
        await Promise.all([check('designer'), check('device')]);
    } catch (e) {
        assistant.error = explain(e);
        assistant.log.push(t.setup.assistantRun.aborted(assistant.error));
    } finally {
        assistant.running = false;
    }
}

/** What „Rechte aktualisieren" found, while the dialog asks (Plan.md 62). */
const refreshDialog = ref<{ state: RefreshState } | null>(null);

/**
 * First step of „Rechte aktualisieren": reads what the created groups hold and plans. Changes show in a dialog
 * before anything is written; without changes the log just says so. Only calendars and rooms the administrator
 * sees can be taken back (Plan.md 62).
 */
async function updateRights(): Promise<void> {
    if (!plan.value) return;
    const groupIds = {
        designer: createdGroupIds.value.includes(selected.designer ?? -1) ? selected.designer! : undefined,
        device: createdGroupIds.value.includes(selected.device ?? -1) ? selected.device! : undefined,
    };
    assistant.running = true;
    assistant.error = null;
    try {
        const known = { calendarIds: calendars.map((c) => c.id), roomIds: rooms.map((r) => r.id) };
        const names = {
            calendars: new Map(calendars.map((c) => [c.id, c.name] as const)),
            rooms: new Map(rooms.map((r) => [r.id, r.name] as const)),
        };
        const state = await readRefresh(plan.value, groupIds, known, names, churchToolsProvisionApi);
        if (refreshIsEmpty(state.groups)) {
            assistant.log = state.groups.map(refreshLogLine);
            return;
        }
        refreshDialog.value = { state };
    } catch (e) {
        assistant.error = explain(e);
        assistant.log = [t.setup.assistantRun.aborted(assistant.error)];
    } finally {
        assistant.running = false;
    }
}

/** Second step, after „Übernehmen": writes what the dialog showed. */
async function confirmRefresh(): Promise<void> {
    const open = refreshDialog.value;
    refreshDialog.value = null;
    if (!open || !plan.value) return;
    assistant.running = true;
    assistant.error = null;
    try {
        const result = await applyRefresh(plan.value, open.state, churchToolsProvisionApi);
        assistant.log = result.log;
        assistant.error = result.error;
        await Promise.all([check('designer'), check('device')]);
    } finally {
        assistant.running = false;
    }
}

/**
 * Opens the confirmation dialog for „Automatische Einrichtung rückgängig machen" – but only
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
            httpStatus(e) === 403 ? t.setup.removeNotAllowed403 : t.setup.removeNotSaved(explain(e));
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
        ownMemberOf: affected.filter((g) => ownGroupIds.includes(g.id)).map((g) => g.name ?? t.setup.groupFallback(g.id)),
        deviceAccounts,
    };
}

/**
 * The device group's id for „Automatische Einrichtung rückgängig machen" (Plan.md, F; G18): by
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
        return t.setup.rightsOfOthers;
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
                    // Only the warning depends on this read: if it fails, the member is checked without it.
                    const otherGroups = await personGroups(m.personId)
                        .then((list) => list.filter((g) => g.id !== groupId).map((g) => g.name))
                        .catch(() => undefined);
                    return { label: person.label, grants: [...m.roleGrants, ...person.grants], otherGroups };
                }),
            );
            checks.device = checkDeviceGroup({
                statusId: rights.group.statusId,
                members,
                calendars,
                usedCalendarIds,
                publicCalendarIds,
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
                text: t.setup.groups.sameGroup,
                detail: t.setup.groups.sameGroupDetail,
            });
        }
    } catch (e) {
        checks[side] = [{ level: 'fail', category: 'group', text: t.setup.groups.checkFailed, detail: explain(e) }];
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
        const [list, settings, wikiCategories, calendarList, publicCalendars, used, screenList, masterdata, usedRooms, roomsAtAppointments, serviceCalendars, videos, permissions, types] = await Promise.all([
            loadGroups(),
            repository.loadSettings(),
            churchtoolsClient.get<WikiCategory[]>('/wiki/categories'),
            fetchCalendars(),
            fetchPublicCalendars(instanceBaseUrl()),
            repository.calendarIdsInUse(),
            repository.listScreens(),
            fetchResourceMasterdata().catch(() => null),
            repository.roomIdsInUse(),
            repository.appointmentRoomsInUse(),
            repository.serviceCalendarIdsInUse(),
            repository.videoInUse(),
            loadGroupPermissions(),
            loadGroupTypes().catch(() => null),
        ]);
        groupPermissions.value = permissions;
        groupTypes.value = types;
        screens.value = screenList;
        device.slug = screenList[0]?.slug ?? '';
        groups.value = list;
        wikiCategory.value = wikiCategories.find((c) => c.name === WIKI_CATEGORY_NAME) ?? null;
        wikiCategoryId = wikiCategory.value?.id ?? null;
        wikiCategoryIdKnown.value = wikiCategoryId !== null;
        settingsLoaded.value = true;
        calendars = calendarList;
        publicCalendarIds = publicCalendars.map((c) => c.id);
        usedCalendarIds = used;
        rooms = masterdata ? roomsOf(masterdata) : [];
        usedRoomIds = usedRooms;
        appointmentRooms = roomsAtAppointments;
        serviceCalendarIds = serviceCalendars;
        videoInUse = videos;
        selected.designer = settings?.designerGroupId ?? null;
        selected.device = settings?.deviceGroupId ?? null;
        createdGroupIds.value = settings?.createdGroupIds ?? [];
        // Known from the settings read above; `loadServices` reads them again before the list can change anything.
        allowedServices.value = settings?.allowedServiceIds ?? [];
        const merkmal = types ? defaultGroupTypeId(types) : null;
        createdTypeId.value = settings?.createdGroupTypeId ?? merkmal;
        chosenTypeId.value = merkmal;
        createdWikiCategoryId.value = settings?.createdWikiCategoryId ?? null;
        if (!demo.value) {
            // Without these the assistant only explains; the page itself still works.
            // An administrator's visit creates the category of the signs of life, if it is missing (Plan.md 59).
            const statusId = (admin.value ? repository.ensureStatusCategory() : repository.statusCategoryId()).catch(() => null);
            let visible: Partial<Record<CategoryKey, number>>;
            [visible, catalog] = await Promise.all([repository.visibleCategories(), loadAuthCatalog().catch(() => null)]);
            const status = await statusId;
            categories = status === null ? visible : { ...visible, status };
            assistant.allowed = true;
        }
        computePlan();
        await Promise.all([check('designer'), check('device')]);
    } catch (e) {
        error.value = explain(e);
    }
});

type CardStatus = { tone: 'ok' | 'warn' | 'neutral'; text: string };

/**
 * The mark on the card "Gruppen und Rechte", from the checks the page runs on arrival anyway – no request of
 * its own. Nothing while they run (a mark that changes would jump), and nothing in the demo, which has no groups.
 */
const groupsStatus = computed<CardStatus | null>(() => {
    const word = t.setup.overview.status;
    if (!settingsLoaded.value || demo.value) return null;
    if (selected.designer === null && selected.device === null) return { tone: 'neutral', text: word.notSet };
    if (busy.designer || busy.device) return null;
    if ((selected.designer !== null && !checks.designer) || (selected.device !== null && !checks.device)) return null;
    const problems = [...(checks.designer ?? []), ...(checks.device ?? [])].filter((c) => c.level === 'fail' || c.level === 'warn').length;
    if (problems) return { tone: 'warn', text: word.toCheck(problems) };
    if (selected.designer === null || selected.device === null) return { tone: 'warn', text: word.groupMissing };
    return { tone: 'ok', text: word.allWell };
});

/** The services released so far, from the settings read on arrival. */
const servicesStatus = computed<CardStatus | null>(() => {
    const word = t.setup.overview.status;
    if (!settingsLoaded.value) return null;
    const n = allowedServices.value.length;
    return n ? { tone: 'warn', text: word.released(n) } : { tone: 'neutral', text: word.noneReleased };
});

/** The cards of the overview, each to a page of its own; the wiki card only where there is an area (as before). */
const overviewCards = computed(() => {
    const wiki = settingsLoaded.value && wikiCategory.value && !demo.value;
    const cards: { key: string; route: string; icon: IconName; title: string; intro: string; status: CardStatus | null }[] = [
        { key: 'groups', route: 'setup-groups', icon: 'people', title: t.setup.groups.title, intro: t.setup.groups.intro, status: groupsStatus.value },
        { key: 'tv', route: 'setup-tv', icon: 'link', title: t.setup.tv.title, intro: t.setup.tv.intro, status: null },
    ];
    if (wiki) {
        cards.push({ key: 'wiki', route: 'setup-wiki', icon: 'image', title: t.setup.wiki.title, intro: t.setup.wiki.intro, status: { tone: 'ok', text: t.setup.overview.status.done } });
    }
    cards.push({ key: 'services', route: 'setup-services', icon: 'person', title: t.setup.services.title, intro: t.setup.services.intro, status: servicesStatus.value });
    return cards;
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
        title: t.setup.groups.designer.title,
        purpose: t.setup.groups.designer.purpose,
    },
    {
        side: 'device',
        title: t.setup.groups.device.title,
        purpose: t.setup.groups.device.purpose,
    },
];
</script>

<template>
    <ModulePage>
        <div class="setup">
            <RouterLink v-if="page !== 'overview'" class="back" :to="{ name: 'setup' }" data-testid="settings-back">
                <Icon name="back" :size="16" /> {{ t.common.settings }}
            </RouterLink>
            <PageHeader :icon="header.icon" :title="header.title" testid="setup-heading">
                {{ header.intro }}
            </PageHeader>
            <p v-if="admin === null" class="empty">{{ t.common.loading }}</p>
            <section v-else-if="!admin" class="d-banner d-banner--warning" data-testid="setup-admins-only">
                <strong>{{ t.setup.adminsOnly.title }}</strong>
                <p>{{ t.setup.adminsOnly.text }}</p>
            </section>
            <template v-else>
                <p v-if="error" class="error" role="alert">{{ error }}</p>

                <div v-if="page === 'overview'" class="cards">
                    <RouterLink
                        v-for="card in overviewCards"
                        :key="card.key"
                        class="d-card settings-card"
                        :to="{ name: card.route }"
                        :data-testid="`settings-card-${card.key}`"
                    >
                        <span class="settings-card-head">
                            <span class="settings-card-icon"><Icon :name="card.icon" :size="18" /></span>
                            <h2>{{ card.title }}</h2>
                            <span
                                v-if="card.status"
                                class="status"
                                :class="`status--${card.status.tone}`"
                                :data-testid="`settings-status-${card.key}`"
                            >
                                <Icon v-if="card.status.tone === 'ok'" name="check" :size="12" />
                                {{ card.status.text }}
                            </span>
                        </span>
                        <p class="muted">{{ card.intro }}</p>
                        <span class="settings-card-open">{{ t.common.open }} <Icon name="forward" :size="16" /></span>
                    </RouterLink>
                </div>

                <template v-if="page === 'groups'">
                    <p class="lead">{{ t.setup.groups.lead }}</p>

                    <section class="d-card card assistant" data-testid="assistant">
                        <h2>{{ t.setup.groups.assistant }}</h2>
                        <template v-if="createdGroupIds.length">
                            <p>{{ t.setup.groups.done(GROUP_NAMES.designer, GROUP_NAMES.device) }}</p>
                            <p class="muted small">{{ t.setup.groups.doneHint }}</p>
                            <div class="actions">
                                <button
                                    class="d-btn d-btn--primary"
                                    type="button"
                                    :disabled="!assistant.allowed || !plan || assistant.running || !abilities.refresh.allowed"
                                    data-testid="update-rights"
                                    @click="updateRights"
                                >
                                    {{ t.setup.groups.updateRights }}
                                </button>
                                <button class="d-btn d-btn--danger" type="button" :disabled="assistant.running || !abilities.remove.allowed" data-testid="remove-setup" @click="openRemoveSetup">
                                    {{ t.setup.groups.removeSetup }}
                                </button>
                            </div>
                            <p v-for="button in (['refresh', 'remove'] as const).filter((b) => abilityHint(b))" :key="button" class="muted small" :data-testid="`ability-hint-${button}`">
                                {{ abilityHint(button) }}
                            </p>
                        </template>
                        <template v-else>
                            <p>{{ t.setup.groups.fresh }}</p>
                            <p v-if="planProblem" class="muted">{{ planProblem }}</p>
                            <p v-else-if="foreignGroups.length" class="warn">
                                {{ t.setup.groups.foreign(foreignGroups.map((g) => `„${g.name}"`).join(' und ')) }}
                            </p>
                            <details v-if="plan" class="plan">
                                <summary>{{ t.setup.groups.whatHappens }}</summary>
                                <div v-for="group in plan" :key="group.key">
                                    <strong>{{ group.name }}</strong> – {{ t.setup.groups.allRoles }}
                                    <ul>
                                        <li v-for="grant in group.grants" :key="`${grant.authId}`">{{ grant.label }}</li>
                                    </ul>
                                </div>
                                <p v-if="wikiMissing" class="muted small">{{ t.setup.groups.wikiWillBeCreated }}</p>
                            </details>
                            <label class="d-field">
                                {{ t.setup.groups.type }}
                                <select
                                    :value="chosenTypeId ?? ''"
                                    data-testid="group-type"
                                    @change="chosenTypeId = Number(($event.target as HTMLSelectElement).value) || null"
                                >
                                    <option v-if="chosenTypeId === null" value="">{{ t.setup.groups.pleaseChoose }}</option>
                                    <option v-for="type in groupTypes ?? []" :key="type.id" :value="type.id">{{ type.name }}</option>
                                </select>
                            </label>
                            <p v-if="groupTypes === null" class="muted small">{{ t.setup.groups.typesFailed }}</p>
                            <p v-else class="muted small">{{ t.setup.groups.typeRecommended }}</p>
                            <div class="actions">
                                <button
                                    class="d-btn d-btn--primary"
                                    type="button"
                                    data-testid="run-assistant"
                                    :disabled="!assistant.allowed || !plan || foreignGroups.length > 0 || assistant.running || chosenTypeId === null || !abilities.create.allowed"
                                    @click="runAssistant"
                                >
                                    {{ t.setup.groups.create }}
                                </button>
                                <span v-if="assistant.running" class="muted">{{ t.setup.groups.working }}</span>
                            </div>
                            <p v-if="abilityHint('create')" class="muted small" data-testid="ability-hint-create">{{ abilityHint('create') }}</p>
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
                                {{ t.setup.groups.group }}
                                <select
                                    :value="selected[side] ?? ''"
                                    :data-testid="`group-${side}`"
                                    @change="choose(side, ($event.target as HTMLSelectElement).value)"
                                >
                                    <option value="">{{ t.setup.groups.noneChosen }}</option>
                                    <option v-for="g in groups" :key="g.id" :value="g.id">{{ g.name }}</option>
                                </select>
                            </label>
                            <p v-if="!groups.length && !error" class="muted">{{ t.setup.groups.loadingGroups }}</p>
                            <p class="muted small">{{ t.setup.groups.noSuitable }}</p>

                            <p v-if="busy[side]" class="muted">{{ t.setup.groups.checking }}</p>
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
                        <button class="d-btn d-btn--primary" type="button" data-testid="save-setup" @click="save">{{ t.setup.groups.saveSelection }}</button>
                        <span v-if="saveState === 'saved'" class="muted" data-testid="setup-saved">{{ t.setup.groups.saved }}</span>
                        <span v-else-if="saveState === 'saving'" class="muted">{{ t.setup.groups.saving }}</span>
                    </div>
                    <p class="muted small">{{ t.setup.groups.checkNote }}</p>
                </template>

                <template v-if="page === 'services'">
                    <section class="d-card card" data-testid="allowed-services">
                        <!-- Before the list, not beside it: releasing a service publishes names (Plan.md 58). -->
                        <div class="privacy-alert" role="note" data-testid="allowed-services-warning">
                            <h2>{{ t.setup.services.privacyTitle }}</h2>
                            <p>{{ t.setup.services.privacy }}</p>
                            <p><strong>{{ t.setup.services.privacyAsk }}</strong></p>
                        </div>
                        <p class="lead">{{ t.setup.services.lead }}</p>
                        <p v-if="servicesFailed" class="error" role="alert" data-testid="allowed-services-failed">
                            {{ t.setup.services.failed }}
                        </p>
                        <p v-else-if="!serviceList" class="empty">{{ t.common.loading }}</p>
                        <p v-else-if="!serviceList.length" class="muted" data-testid="allowed-services-none">
                            {{ t.setup.services.none }}
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
                            <p v-if="servicesSaved" class="muted small" role="status" data-testid="allowed-services-saved">{{ t.setup.services.saved }}</p>
                        </template>
                    </section>
                </template>

                <template v-if="page === 'wiki'">
                    <section v-if="wikiCategory && !demo" class="d-card card" data-testid="wiki-menu">
                        <h2>{{ t.setup.wiki.title }}</h2>
                        <p class="muted">{{ t.setup.wiki.text(WIKI_CATEGORY_NAME) }}</p>
                        <p data-testid="wiki-menu-state">
                            {{ t.setup.wiki.stateBefore }}
                            <strong>{{ wikiCategory.inMenu === false ? t.setup.wiki.stateHidden : t.setup.wiki.stateShown }}</strong>.
                        </p>
                        <p data-testid="wiki-owner" class="muted small">
                            <template v-if="wikiCategory.id === createdWikiCategoryId">{{ t.setup.wiki.ownerCreated }}</template>
                            <template v-else>{{ t.setup.wiki.ownerForeign }}</template>
                        </p>
                        <div class="actions">
                            <button class="d-btn" type="button" :disabled="wikiBusy" data-testid="wiki-menu-toggle" @click="toggleWikiMenu">
                                {{ wikiCategory.inMenu === false ? t.setup.wiki.showAgain : t.setup.wiki.hide }}
                            </button>
                        </div>
                        <p v-if="wikiError" class="error" role="alert">{{ wikiError }}</p>
                    </section>
                    <p v-else class="empty" data-testid="wiki-empty">
                        <template v-if="demo">{{ t.setup.wiki.demo }}</template>
                        <template v-else>{{ t.setup.wiki.missing(WIKI_CATEGORY_NAME) }}</template>
                    </p>
                </template>

                <section v-if="page === 'tv'" class="d-card card tv" data-testid="tv-address">
                    <h2>{{ t.setup.tv.formTitle }}</h2>
                    <p class="muted">{{ t.setup.tv.text }}</p>
                    <p v-if="!screens.length" class="muted small">{{ t.setup.tv.noScreens }}</p>
                    <form v-else class="tv-form" autocomplete="off" @submit.prevent="createTvAddress">
                        <label class="d-field">
                            {{ t.setup.tv.screen }}
                            <select v-model="device.slug" data-testid="tv-screen">
                                <option v-for="screen in screens" :key="screen.id" :value="screen.slug">{{ screen.name }}</option>
                            </select>
                        </label>
                        <label class="d-field">
                            {{ t.setup.tv.username }}
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
                            {{ t.setup.tv.password }}
                            <input v-model="device.password" type="password" autocomplete="new-password" data-testid="tv-password">
                        </label>
                        <div class="actions tv-actions">
                            <button
                                class="d-btn d-btn--primary"
                                type="submit"
                                :disabled="device.busy || !device.username.trim() || !device.password"
                                data-testid="tv-create"
                            >
                                {{ t.setup.tv.create }}
                            </button>
                            <span v-if="device.busy" class="muted">{{ t.setup.tv.signingIn }}</span>
                        </div>
                    </form>
                    <p class="muted small">{{ t.setup.tv.note }}</p>
                    <p v-if="device.error" class="error" role="alert" data-testid="tv-error">{{ device.error }}</p>
                    <div v-if="device.url" class="tv-result" data-testid="tv-result">
                        <code class="url">{{ device.url }}</code>
                        <button class="d-btn" type="button" data-testid="tv-copy" @click="copyTvAddress">
                            {{ device.copied ? t.setup.tv.copied : t.setup.tv.copy }}
                        </button>
                        <p class="d-banner d-banner--warning small">
                            <strong>{{ t.setup.tv.keyTitle }}</strong> {{ t.setup.tv.keyText(device.personId) }}
                        </p>
                    </div>
                </section>
            </template>
            <p v-if="page === 'overview'" class="muted small version" data-testid="app-version">
                {{ t.setup.version.before(APP_VERSION) }}
                <RouterLink :to="{ name: 'about' }">{{ t.about.title }}</RouterLink>{{ t.setup.version.after }}
            </p>
        </div>

        <RefreshRightsDialog
            v-if="refreshDialog"
            :groups="refreshDialog.state.groups"
            @close="refreshDialog = null"
            @confirm="confirmRefresh"
        />
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
    gap: var(--d-space-4);
}
.sides {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(320px, 100%), 1fr));
    gap: var(--d-space-4);
}
/* Two cards to a row where they fit, as in the draft. */
.cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(420px, 100%), 1fr));
    gap: var(--d-space-4);
    align-items: stretch;
}
.settings-card {
    display: flex;
    flex-direction: column;
    gap: var(--d-space-3);
    padding: var(--d-space-5);
    color: inherit;
    text-decoration: none;
    transition: box-shadow var(--d-transition);
}
.settings-card:hover {
    box-shadow: var(--d-shadow-card-hover);
}
.settings-card-head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--d-space-2) var(--d-space-3);
}
.settings-card-icon {
    display: grid;
    flex: none;
    place-items: center;
    width: 34px;
    height: 34px;
    border-radius: var(--d-radius-lg);
    background: var(--d-accent-pale);
    color: var(--d-accent);
}
.settings-card h2 {
    flex: 1 1 auto;
    min-width: 0;
    margin: 0;
    font-size: 1.2em;
    font-weight: 800;
}
.settings-card p {
    margin: 0;
}
.settings-card-open {
    display: inline-flex;
    align-items: center;
    gap: var(--d-space-1);
    margin-top: auto;
    color: var(--d-accent-strong);
    font-weight: 700;
}
/* The mark beside a card's title: calm green, amber where names go public or something waits, grey otherwise. */
.status {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-left: auto;
    padding: 3px 10px;
    border-radius: 999px;
    font-size: var(--d-size-sm);
    font-weight: 700;
}
.status--ok {
    background: color-mix(in oklab, var(--d-success) 16%, var(--d-surface));
    color: color-mix(in oklab, var(--d-success) 55%, var(--d-text));
}
.status--warn {
    background: var(--d-warning-pale);
    color: color-mix(in oklab, var(--d-warning) 35%, var(--d-text));
}
.status--neutral {
    background: var(--d-workspace);
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
    gap: var(--d-space-3);
    padding: var(--d-space-5);
    scroll-margin-top: var(--d-space-4);
}
.card h2 {
    margin: 0;
    font-size: 1.15em;
    font-weight: 800;
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
.check-list {
    display: grid;
    gap: 8px;
    margin: 0;
    padding: 0;
    list-style: none;
}
.check-list {
    padding: 0 0 12px;
}
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
.privacy-alert {
    padding: 14px 16px;
    border: 1px solid var(--d-danger);
    border-left-width: 4px;
    border-radius: var(--d-radius);
    background: var(--d-danger-pale);
}
.privacy-alert h2 {
    margin: 0 0 6px;
    color: var(--d-danger);
}
.privacy-alert p {
    margin: 0;
}
.privacy-alert p + p {
    margin-top: 6px;
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
