<script setup lang="ts">
import { churchtoolsClient } from '@churchtools/churchtools-client';
import { computed, onMounted, reactive, ref } from 'vue';
import { EXTENSION_KEY } from '../config';
import Icon from '../designer/Icon.vue';
import ModulePage from '../designer/ModulePage.vue';
import { fetchCalendars, type Calendar } from '../ct/api';
import { httpStatus, instanceBaseUrl } from '../ct/client';
import { playerUrl } from '../designer/player-url';
import { findOrCreateCategory, WIKI_CATEGORY_NAME, type WikiCategory } from '../media/wiki';
import { SCHEMA_VERSION, type ScreenDoc } from '../model/schema';
import { withDeviceLogin } from '../player/device-login';
import { loadAuthCatalog, type AuthCatalog } from '../setup/catalog';
import { AUTH, checkDesignerGroup, checkDeviceGroup, type Check, type RequiredRight } from '../setup/checks';
import {
    canManagePermissions,
    churchToolsProvisionApi,
    deleteGroup,
    findGroupTypeId,
    loadGroupRights,
    loadGroups,
    loadPersonGrants,
    type GroupSummary,
} from '../setup/load';
import { createDeviceLogin } from '../setup/device-token';
import { GROUP_NAMES, GROUP_TYPE_NAME, planProvisioning, provision, refreshGrants, type GroupSpec } from '../setup/provision';
import { getRepository } from '../store/backend';
import { CATEGORIES, type CategoryKey, type ScreenRepository } from '../store/screen-repository';

type Side = 'designer' | 'device';


const groups = ref<GroupSummary[]>([]);
const selected = reactive<Record<Side, number | null>>({ designer: null, device: null });
const checks = reactive<Record<Side, Check[] | null>>({ designer: null, device: null });
const busy = reactive<Record<Side, boolean>>({ designer: false, device: false });
const error = ref<string | null>(null);
const saveState = ref<'idle' | 'saving' | 'saved' | 'failed'>('idle');

let repository: ScreenRepository | null = null;
let wikiCategoryId: number | null = null;
let calendars: Calendar[] = [];
let usedCalendarIds: number[] = [];
let catalog: AuthCatalog | null = null;
let categories: Partial<Record<CategoryKey, number>> = {};

/** The setup assistant (Plan.md, 9): what it would do, and what it did. */
const demo = ref(false);
const plan = ref<GroupSpec[] | null>(null);
const planProblem = ref<string | null>(null);
const createdGroupIds = ref<number[]>([]);
const assistant = reactive({ allowed: false, running: false, log: [] as string[], error: null as string | null });

/** Groups under the assistant's names that it did not create: it never takes them over. */
const wikiMissing = computed(() => plan.value !== null && wikiCategoryIdKnown.value === false);
const wikiCategoryIdKnown = ref(true);

const foreignGroups = computed(() =>
    groups.value.filter(
        (g) => Object.values(GROUP_NAMES).includes(g.name as never) && !createdGroupIds.value.includes(g.id),
    ),
);

const NOT_MODULE: number[] = [AUTH.calendarView, AUTH.wikiView, AUTH.wikiCategoryView, AUTH.wikiCategoryEdit];

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
        });
    } catch (e) {
        planProblem.value = explain(e);
    }
}

async function persistSettings(): Promise<void> {
    await repository!.saveSettings({
        schema: { ...SCHEMA_VERSION },
        designerGroupId: selected.designer ?? undefined,
        deviceGroupId: selected.device ?? undefined,
        createdGroupIds: createdGroupIds.value.length ? createdGroupIds.value : undefined,
    });
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
        const groupTypeId = await findGroupTypeId(GROUP_TYPE_NAME);
        if (groupTypeId === null) throw new Error(`Den Gruppentyp „${GROUP_TYPE_NAME}" gibt es auf dieser Instanz nicht.`);
        if (wikiCategoryId === null) {
            wikiCategoryId = (await findOrCreateCategory()).id;
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

async function removeSetup(): Promise<void> {
    const names = groups.value.filter((g) => createdGroupIds.value.includes(g.id)).map((g) => `„${g.name}"`);
    const question = `Die vom Assistenten angelegten Gruppen ${names.join(' und ')} samt ihrer Rechte löschen?\n\nIhre Mitglieder verlieren damit den Zugang.`;
    if (!repository || !window.confirm(question)) return;
    assistant.running = true;
    assistant.error = null;
    try {
        for (const id of createdGroupIds.value) {
            await deleteGroup(id);
            if (selected.designer === id) selected.designer = null;
            if (selected.device === id) selected.device = null;
        }
        assistant.log = [`${createdGroupIds.value.length} Gruppen gelöscht.`];
        createdGroupIds.value = [];
        await persistSettings();
        groups.value = await loadGroups();
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
        if (side === 'designer') {
            checks.designer = checkDesignerGroup({
                statusId: rights.group.statusId,
                roles: rights.roles,
                wikiCategoryId,
                moduleRights: moduleRights('designer'),
                forbidden: forbiddenRights('designer'),
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
                wikiCategoryId,
                moduleRights: moduleRights('device'),
            });
        }
        if (selected.designer !== null && selected.designer === selected.device) {
            checks[side]!.unshift({
                level: 'warn',
                text: 'Gestalter und Geräte sind dieselbe Gruppe.',
                detail: 'Dann bekommen die Geräte die Rechte der Gestalter – mehr, als ein unbeaufsichtigtes Gerät haben sollte.',
            });
        }
    } catch (e) {
        checks[side] = [{ level: 'fail', text: 'Prüfen nicht möglich.', detail: explain(e) }];
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

onMounted(async () => {
    try {
        admin.value = await canManagePermissions().catch(() => false);
        if (!admin.value) return;
        const handle = await getRepository();
        repository = handle.repository;
        demo.value = handle.demo;
        const [list, settings, wikiCategories, calendarList, used, screenList] = await Promise.all([
            loadGroups(),
            repository.loadSettings(),
            churchtoolsClient.get<WikiCategory[]>('/wiki/categories'),
            fetchCalendars(),
            repository.calendarIdsInUse(),
            repository.listScreens(),
        ]);
        screens.value = screenList;
        device.slug = screenList[0]?.slug ?? '';
        groups.value = list;
        wikiCategoryId = wikiCategories.find((c) => c.name === WIKI_CATEGORY_NAME)?.id ?? null;
        wikiCategoryIdKnown.value = wikiCategoryId !== null;
        calendars = calendarList;
        usedCalendarIds = used;
        selected.designer = settings?.designerGroupId ?? null;
        selected.device = settings?.deviceGroupId ?? null;
        createdGroupIds.value = settings?.createdGroupIds ?? [];
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
        purpose: 'Die Konten, mit denen sich die Fernseher anmelden. Sie brauchen nur Leserechte auf die Kalender ihrer Screens – sonst nichts.',
    },
];
</script>

<template>
    <ModulePage current="setup" :admin="admin === true">
        <div class="setup">
            <div class="page-title">
                <span class="title-icon"><Icon name="settings" :size="22" /></span>
                <h1>Einstellungen für Infoscreens</h1>
            </div>
            <p v-if="admin === null" class="muted">Lade …</p>
            <section v-else-if="!admin" class="d-banner d-banner--warning" data-testid="setup-admins-only">
                <strong>Die Einstellungen sind Sache der ChurchTools-Administratoren.</strong>
                <p>
                    Sie legen die Gruppen für Gestalter und Geräte an und vergeben deren Rechte. Wer Infoscreens gestaltet,
                    braucht diese Seite nicht – fehlt dir ein Recht, wende dich an einen Administrator deiner Gemeinde.
                </p>
            </section>
            <template v-else>
                <p class="lead">
                    Rechte vergibt ChurchTools an Rollen in Gruppen. Am einfachsten legt der Assistent die beiden Gruppen samt
                    Rechten an. Wer eigene Gruppen nutzt, wählt sie unten aus – die Prüfung sagt, was fehlt, und ändert nichts.
                </p>
                <p v-if="error" class="error" role="alert">{{ error }}</p>

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
                            <button class="d-btn d-btn--danger" type="button" :disabled="assistant.running" data-testid="remove-setup" @click="removeSetup">
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
                        <ul v-else-if="checks[side]" class="checks">
                            <li v-for="(c, i) in checks[side]" :key="i" :class="`check--${c.level}`">
                                <span class="symbol" aria-hidden="true">{{ SYMBOL[c.level] }}</span>
                                <span>
                                    {{ c.text }}
                                    <small v-if="c.detail" class="muted">{{ c.detail }}</small>
                                </span>
                            </li>
                        </ul>
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

                <section id="fernseher" class="d-card card tv" data-testid="tv-address">
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
            <p class="muted small version" data-testid="app-version">
                Infoscreen Designer {{ APP_VERSION }} – neuere Fassungen stehen unter „Releases" auf GitHub und werden in
                der Extension-Verwaltung von ChurchTools als ZIP hochgeladen.
            </p>
        </div>
    </ModulePage>
</template>

<style scoped>
.setup {
    width: 100%;
    max-width: 1100px;
    margin: 0 auto;
}
.page-title {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 8px;
}
.page-title h1 {
    margin: 0;
    font-size: 1.8em;
}
.title-icon {
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    border-radius: var(--d-radius-lg);
    background: var(--d-accent-pale);
    color: var(--d-accent);
}
.lead {
    max-width: 70ch;
}
.sides {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(320px, 100%), 1fr));
    gap: 16px;
    margin-top: 16px;
}
.card {
    display: grid;
    align-content: start;
    gap: 10px;
    padding: 16px;
    scroll-margin-top: 16px;
}
.card h2 {
    margin: 0;
    font-size: 1.15em;
}
.card p {
    margin: 0;
}
.checks {
    display: grid;
    gap: 8px;
    margin: 4px 0 0;
    padding: 0;
    list-style: none;
}
.checks li {
    display: grid;
    grid-template-columns: 22px 1fr;
    gap: 6px;
    align-items: start;
}
.checks small {
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
.assistant {
    margin-top: 16px;
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
.muted {
    color: var(--d-text-muted);
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
.tv {
    margin-top: 16px;
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
@media (max-width: 48rem) {
    .page-title h1 {
        font-size: 1.4em;
    }
    .title-icon {
        display: none;
    }
}
</style>
