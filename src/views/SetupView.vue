<script setup lang="ts">
import { churchtoolsClient } from '@churchtools/churchtools-client';
import { computed, onMounted, reactive, ref } from 'vue';
import { EXTENSION_KEY } from '../config';
import { fetchCalendars, type Calendar } from '../ct/api';
import { httpStatus } from '../ct/client';
import { findOrCreateCategory, WIKI_CATEGORY_NAME, type WikiCategory } from '../media/wiki';
import { SCHEMA_VERSION, type ScreenDoc } from '../model/schema';
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
import { GROUP_NAMES, GROUP_TYPE_NAME, planProvisioning, provision, type GroupSpec } from '../setup/provision';
import { getRepository } from '../store/backend';
import { CATEGORIES, type CategoryKey, type ScreenRepository } from '../store/screen-repository';

type Side = 'designer' | 'device';

const groups = ref<GroupSummary[]>([]);
const selected = reactive<Record<Side, number | null>>({ designer: null, device: null });
const checks = reactive<Record<Side, Check[] | null>>({ designer: null, device: null });
const busy = reactive<Record<Side, boolean>>({ designer: false, device: false });
const error = ref<string | null>(null);
const saveState = ref<'idle' | 'saving' | 'saved' | 'failed'>('idle');
const screens = ref<ScreenDoc[]>([]);
const copied = ref<string | null>(null);

/**
 * The address a TV opens (way A, decided 2026-09-24): no secret in it, the
 * browser of the TV signs in once as the device account – like the built-in
 * info screen. It lives where the designer lives, so the origin is right in
 * ChurchTools and in development alike.
 */
function playerUrl(slug: string): string {
    return new URL(`player?screen=${encodeURIComponent(slug)}`, window.location.origin + import.meta.env.BASE_URL).toString();
}

async function copy(slug: string): Promise<void> {
    try {
        await navigator.clipboard.writeText(playerUrl(slug));
        copied.value = slug;
    } catch {
        // Without clipboard access the address stays visible for copying by hand.
        copied.value = null;
    }
}

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
    const privateCalendarIds = usedCalendarIds.filter((id) => calendars.some((c) => c.id === id && !c.isPublic));
    try {
        plan.value = planProvisioning({
            catalog,
            moduleKey: EXTENSION_KEY,
            categories: categories as Record<CategoryKey, number>,
            wikiCategoryId,
            privateCalendarIds,
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

onMounted(async () => {
    try {
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
            [categories, catalog, assistant.allowed] = await Promise.all([
                repository.visibleCategories(),
                loadAuthCatalog().catch(() => null),
                canManagePermissions().catch(() => false),
            ]);
        }
        computePlan();
        await Promise.all([check('designer'), check('device')]);
    } catch (e) {
        error.value = explain(e);
    }
});

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
    <main class="infoscreen-designer setup">
        <RouterLink class="d-link back" :to="{ name: 'designer' }">← Screens</RouterLink>
        <h1>Einrichtung</h1>
        <p class="lead">
            Rechte vergibt ChurchTools an Rollen in Gruppen. Am einfachsten legt der Assistent die beiden Gruppen samt
            Rechten an. Wer eigene Gruppen nutzt, wählt sie unten aus – die Prüfung sagt, was fehlt, und ändert nichts.
        </p>
        <p v-if="error" class="error" role="alert">{{ error }}</p>

        <section class="card assistant" data-testid="assistant">
            <h2>Automatisch einrichten</h2>
            <template v-if="createdGroupIds.length">
                <p>
                    Die Gruppen des Infoscreens sind eingerichtet. Wer gestalten soll, wird Mitglied in „{{ GROUP_NAMES.designer }}",
                    die Konten der Fernseher in „{{ GROUP_NAMES.device }}" – mehr ist nicht zu tun.
                </p>
                <div class="actions">
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
                <p v-if="plan && !assistant.allowed" class="muted small">
                    Nur wer in ChurchTools Berechtigungen verwalten darf, kann das auslösen.
                </p>
            </template>
            <ul v-if="assistant.log.length" class="log" data-testid="assistant-log">
                <li v-for="(line, i) in assistant.log" :key="i">{{ line }}</li>
            </ul>
            <p v-if="assistant.error" class="error" role="alert">{{ assistant.error }}</p>
        </section>

        <div class="sides">
            <section v-for="{ side, title, purpose } in SIDES" :key="side" class="card" :data-testid="`setup-${side}`">
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

                <div v-if="side === 'device'" class="addresses" data-testid="player-addresses">
                    <h3>Adressen für die Fernseher</h3>
                    <p class="muted small">
                        Im Browser des Fernsehers einmal mit dem Geräte-Benutzer bei ChurchTools anmelden und „Angemeldet
                        bleiben" wählen. Dann die Adresse des Screens öffnen. In der Adresse steht kein Passwort.
                    </p>
                    <p v-if="!screens.length" class="muted small">Noch keine Screens angelegt.</p>
                    <ul>
                        <li v-for="screen in screens" :key="screen.id">
                            <strong>{{ screen.name }}</strong>
                            <code class="url">{{ playerUrl(screen.slug) }}</code>
                            <button class="d-btn" type="button" :data-testid="`copy-${screen.slug}`" @click="copy(screen.slug)">
                                {{ copied === screen.slug ? 'Kopiert' : 'Kopieren' }}
                            </button>
                        </li>
                    </ul>
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
    </main>
</template>

<style scoped>
.setup {
    max-width: 1100px;
    margin: 0 auto;
    padding: 24px 16px 48px;
}
.back {
    color: var(--d-accent-strong);
}
h1 {
    margin: 8px 0 4px;
}
.lead {
    max-width: 70ch;
}
.sides {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
    gap: 16px;
    margin-top: 16px;
}
.card {
    display: grid;
    align-content: start;
    gap: 10px;
    padding: 16px;
    border: 1px solid var(--d-divider);
    border-radius: var(--d-radius-lg);
    background: var(--d-panel);
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
.addresses {
    display: grid;
    gap: 6px;
    padding-top: 10px;
    border-top: 1px solid var(--d-divider);
}
.addresses h3 {
    margin: 0;
    font-size: 1em;
}
.addresses ul {
    display: grid;
    gap: 8px;
    margin: 0;
    padding: 0;
    list-style: none;
}
.addresses li {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 2px 8px;
    align-items: center;
}
.addresses .url {
    grid-column: 1;
    overflow-wrap: anywhere;
    font-size: var(--d-size-sm);
}
.addresses .d-btn {
    grid-column: 2;
    grid-row: 1 / span 2;
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
</style>
