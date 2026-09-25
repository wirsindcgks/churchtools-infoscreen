<script setup lang="ts">
/**
 * The start page, built after the group overview of ChurchTools (Plan.md,
 * Nächste Schritte 10): bar with sections and "+ Screen erstellen", filters
 * on the left, search, tiles with the first slide of each screen. Below
 * 48rem the filters become a row to swipe and the tiles one or two columns.
 */
import { computed, onMounted, ref, shallowRef } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { currentPerson, displayName, NotAuthenticatedError } from '../ct/client';
import CreateScreenDialog from '../designer/CreateScreenDialog.vue';
import { FILTERS, formatFilter, type FormatFilter } from '../designer/format-filter';
import GroupCard from '../designer/GroupCard.vue';
import Icon from '../designer/Icon.vue';
import ModulePage from '../designer/ModulePage.vue';
import PageHeader from '../designer/PageHeader.vue';
import { checkDesignerRights, type MissingRight } from '../designer/rights';
import { isAdministrator } from '../designer/administrator';
import SearchField from '../designer/SearchField.vue';
import ScreenCard from '../designer/ScreenCard.vue';
import ScheduleDialog from '../designer/ScheduleDialog.vue';
import ScreenSettingsDialog from '../designer/ScreenSettingsDialog.vue';
import { blockCalendarIds, type ScreenDoc, type ThemeDoc } from '../model/schema';
import { ruleCalendarIds, runningNow } from '../designer/running';
import { usePreview } from '../designer/usePreview';
import { getRepository, resetDemoStore } from '../store/backend';
import type { ScreenOverview, ScreenRepository } from '../store/screen-repository';

const router = useRouter();
const route = useRoute();
const author = ref<string | null>(null);
const overviews = ref<ScreenOverview[]>([]);
const demo = ref(false);
const error = ref<string | null>(null);
const missingRights = ref<MissingRight[]>([]);
const repository = shallowRef<ScreenRepository | null>(null);
const creating = ref(false);
/**
 * May create, configure and delete screens – the module right on `screens`
 * (Plan.md, F), not the ChurchTools admin right that opens the settings page.
 */
const screensAdmin = ref(false);
/** The screen whose settings dialog is open – administrators only. */
const configuring = ref<ScreenDoc | null>(null);
/** The screen whose schedule dialog is open – the designers' part (Plan.md, Nächste Schritte 17). */
const scheduling = ref<string | null>(null);
/** Administrators set the module up (role concept, Plan.md F); everyone else does not see the way there. */
const admin = ref(false);
const filter = computed(() => formatFilter(route.query.format));
const query = ref('');
/** Loaded: the page shows its frame before, and its content from then on. */
const ready = computed(() => author.value !== null && repository.value !== null);

const isPortrait = (o: ScreenOverview) => o.screen.stage.height > o.screen.stage.width;

const counts = computed<Record<FormatFilter, number>>(() => {
    const portrait = overviews.value.filter(isPortrait).length;
    return { all: overviews.value.length, portrait, landscape: overviews.value.length - portrait };
});

const shown = computed(() => {
    const needle = query.value.trim().toLocaleLowerCase('de');
    return overviews.value.filter(
        (o) =>
            (filter.value === 'all' || (filter.value === 'portrait') === isPortrait(o)) &&
            (!needle || `${o.screen.name} ${o.screen.slug}`.toLocaleLowerCase('de').includes(needle)),
    );
});

const current = computed(() => FILTERS.find((f) => f.key === filter.value)!);

const theme = ref<ThemeDoc | null>(null);

// The tiles are the player's components: they need the same live data as the editor preview –
// and the appointments of the rule calendars, to know which playlist runs now (Plan.md 17).
const { context } = usePreview(
    computed(() => [
        ...new Set([
            ...ruleCalendarIds(overviews.value.map((o) => o.screen)),
            ...overviews.value.flatMap((o) =>
                Object.values(o.playlists).flatMap((p) => (p.firstSlide?.blocks ?? []).flatMap(blockCalendarIds)),
            ),
        ]),
    ]),
    computed(() => overviews.value.flatMap((o) => o.media)),
    theme,
);

async function refresh(): Promise<void> {
    if (!repository.value) return;
    const [list, stored] = await Promise.all([
        repository.value.listScreenOverviews(),
        // The tiles show the theme; without it they show the defaults.
        repository.value.loadTheme().catch(() => null),
    ]);
    overviews.value = list;
    theme.value = stored;
}

onMounted(async () => {
    try {
        // Show the page only when both are there: a form without storage would swallow clicks.
        const [signedIn, handle, isAdmin] = await Promise.all([
            currentPerson(),
            getRepository(),
            isAdministrator(),
        ]);
        admin.value = isAdmin;
        demo.value = handle.demo;
        // A failed check must not lock anyone out; it only means no hint.
        const rights = await checkDesignerRights(handle.repository, handle.demo).catch((e: unknown) => {
            console.warn('Rechteprüfung nicht möglich:', e);
            return { missing: [], configureScreens: isAdmin };
        });
        missingRights.value = rights.missing;
        // Demo mode has no module rights: there the ChurchTools admin right stands in, so the roles can be tried out.
        screensAdmin.value = rights.configureScreens ?? isAdmin;
        repository.value = handle.repository;
        try {
            await refresh();
        } catch (e) {
            // Without rights, reading fails too – the list of missing rights says more than a 403.
            if (!missingRights.value.length) throw e;
        }
        author.value = displayName(signedIn);
    } catch (e) {
        error.value =
            e instanceof NotAuthenticatedError
                ? e.message
                : `ChurchTools ist gerade nicht erreichbar${e instanceof Error ? ` (${e.message})` : ''}.`;
    }
});

/** A new screen comes with its own playlist, named after it: straight into its editor. */
async function created(playlistId: string): Promise<void> {
    creating.value = false;
    await router.push({ name: 'editor', params: { id: playlistId } });
}

function resetDemoAndReload(): void {
    if (!window.confirm('Alle Demo-Screens verwerfen und mit dem Beispiel neu beginnen?')) return;
    resetDemoStore();
    window.location.reload();
}

async function remove(overview: ScreenOverview): Promise<void> {
    const { name, slug } = overview.screen;
    const question =
        `Screen „${name}" löschen?\n\n` + `Ein Gerät, das die Adresse „${slug}" aufruft, zeigt danach eine Fehlermeldung.`;
    if (!repository.value || !window.confirm(question)) return;
    await repository.value.deleteScreen(slug);
    await refresh();
}
</script>

<template>
    <ModulePage current="screens" :counts="ready ? counts : undefined">
        <template #actions>
            <button
                v-if="screensAdmin"
                class="d-btn d-btn--create"
                type="button"
                aria-label="Screen erstellen"
                data-testid="new-screen"
                @click="creating = true"
            >
                <Icon name="plus" />
                <span class="create-label">Screen erstellen</span>
            </button>
        </template>

        <p v-if="demo" class="d-banner" data-testid="demo-notice">
            Demo-Modus: Die Screens liegen in diesem Browser, nicht in ChurchTools; Termine, Name und Logo kommen live.
            Designer und Player in anderen Tabs dieses Browsers sehen dieselben Screens.
            <button class="link" type="button" data-testid="reset-demo" @click="resetDemoAndReload">
                Demo zurücksetzen
            </button>
        </p>

        <section
            v-if="missingRights.length"
            class="d-banner d-banner--warning rights"
            role="status"
            data-testid="missing-rights"
        >
            <strong>Dir fehlen Rechte, um hier alles zu nutzen:</strong>
            <ul>
                <li v-for="right in missingRights" :key="`${right.area}-${right.key ?? right.text}`">
                    {{ right.text }}
                    <code v-if="right.key">{{ right.key }}</code>
                    <span v-if="right.detail" class="muted"> – {{ right.detail }}</span>
                </li>
            </ul>
            <p v-if="admin" class="muted">
                Was eine Gruppe noch braucht, zeigen die
                <RouterLink :to="{ name: 'setup' }">Einstellungen</RouterLink>; dort legt der Assistent die Gruppen samt
                Rechten an. Rechte einer Gruppe wirken erst, wenn sie den Status „aktiv" hat.
            </p>
            <p v-else class="muted">
                Rechte vergibt ein Administrator deiner Gemeinde: Er nimmt dich in die Gruppe „Infoscreen-Designer" auf.
            </p>
        </section>

        <PageHeader icon="grid" title="Screens" testid="screens-heading">
            Die Fernseher und was sie gerade zeigen. Ein Klick auf eine Kachel öffnet ihre Standard-Playlist im Editor;
            Adresse, Zeitplan und Einstellungen stecken im Menü „…".
        </PageHeader>

        <p v-if="error" class="d-banner d-banner--error" role="alert">{{ error }}</p>
        <p v-else-if="!ready" class="empty">Lade …</p>
        <template v-else>
            <SearchField
                v-model="query"
                placeholder="Suchen nach Name oder Adresse …"
                label="Screens durchsuchen"
                testid="search"
            />

            <GroupCard
                :icon="current.icon"
                :title="current.label"
                :count="`${shown.length} ${shown.length === 1 ? 'Screen' : 'Screens'}`"
                :heading-id="`group-${current.key}`"
            >
                <div v-if="shown.length" class="tiles">
                    <ScreenCard
                        v-for="o in shown"
                        :key="o.screen.id"
                        :overview="o"
                        :admin="screensAdmin"
                        :running="runningNow(o.screen, context)"
                        @remove="remove(o)"
                        @settings="configuring = o.screen"
                        @schedule="scheduling = o.screen.slug"
                    />
                </div>
                <div v-else-if="!overviews.length" class="empty">
                    <p>Noch keine Screens angelegt.</p>
                    <p v-if="!screensAdmin">Screens legt ein Administrator an – danach gestaltest du sie hier.</p>
                    <button v-if="screensAdmin" class="d-btn d-btn--create" type="button" @click="creating = true">
                        <Icon name="plus" /> Ersten Screen erstellen
                    </button>
                </div>
                <p v-else class="empty">Kein Screen passt zu diesem Filter.</p>
            </GroupCard>
        </template>

        <template v-if="repository && author !== null">
            <ScreenSettingsDialog
                v-if="configuring"
                :screen="configuring"
                :repository="repository"
                :author="author"
                @close="configuring = null"
                @saved="configuring = null; refresh()"
            />
            <ScheduleDialog
                v-if="scheduling"
                :slug="scheduling"
                :repository="repository"
                :author="author"
                @close="scheduling = null"
                @saved="scheduling = null; refresh()"
            />
            <CreateScreenDialog
                v-if="creating && screensAdmin"
                :repository="repository"
                :author="author"
                @close="creating = false"
                @created="created"
            />
        </template>
    </ModulePage>
</template>

<style scoped>
.tiles {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 14px;
}
.empty {
    display: grid;
    justify-items: start;
    gap: 10px;
    margin: 0;
    color: var(--d-text-muted);
    font-size: var(--d-size-sm);
}
.empty p {
    margin: 0;
}
.rights ul {
    margin: 6px 0;
    padding-left: 20px;
}
.rights p {
    margin: 0;
}
.link {
    padding: 0;
    border: 0;
    background: none;
    color: var(--d-accent-strong);
    font: inherit;
    text-decoration: underline;
    cursor: pointer;
}
.muted {
    color: var(--d-text-muted);
    font-size: var(--d-size-sm);
}

/* Phone: one or two columns of tiles. */
@media (max-width: 48rem) {
    .tiles {
        grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
        gap: 10px;
    }
}
</style>
