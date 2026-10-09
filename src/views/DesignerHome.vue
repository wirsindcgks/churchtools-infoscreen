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
import { aliveState } from '../designer/alive';
import { useHeartbeats } from '../designer/useHeartbeats';
import CreateScreenDialog from '../designer/CreateScreenDialog.vue';
import FilterChips from '../designer/FilterChips.vue';
import { FILTERS, FORMAT_SEGMENTS, formatFilter, type FormatFilter } from '../designer/format-filter';
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
import { groupNeeds, postNeeds, roomNeeds } from '../player/data';
import { ruleCalendarIds, runningNow } from '../designer/running';
import { screenCounts, setScreenCounts } from '../designer/section-counts';
import { usePreview } from '../designer/usePreview';
import { getRepository, resetDemoStore } from '../store/backend';
import type { ScreenOverview, ScreenRepository } from '../store/screen-repository';
import { t } from '../i18n/designer';
import { LOCALE } from '../i18n/player';
import { useConfirm } from '../designer/useConfirm';

const { confirm } = useConfirm();

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
/** The screen whose settings or rename dialog is open – administrators only. */
const configuring = ref<{ screen: ScreenDoc; mode: 'settings' | 'rename' } | null>(null);
/** The screen whose schedule dialog is open – the designers' part (Plan.md, Nächste Schritte 17). */
const scheduling = ref<string | null>(null);
/** Administrators set the module up (role concept, Plan.md F); everyone else does not see the way there. */
const admin = ref(false);
const filter = computed(() => formatFilter(route.query.format));
/** The segment writes `?format=` into the address, so the back button and bookmarks keep working. */
const formatChoice = computed<FormatFilter>({
    get: () => filter.value,
    set: (key) => void router.push({ name: 'designer', query: key === 'all' ? {} : { format: key } }),
});
const formatOptions = computed(() => FORMAT_SEGMENTS.map((f) => ({ ...f, count: screenCounts.value?.[f.key] })));
const query = ref('');
/** Loaded: the page shows its frame before, and its content from then on. */
const ready = computed(() => author.value !== null && repository.value !== null);

const isPortrait = (o: ScreenOverview) => o.screen.stage.height > o.screen.stage.width;

const shown = computed(() => {
    const needle = query.value.trim().toLocaleLowerCase(LOCALE);
    return overviews.value.filter(
        (o) =>
            (filter.value === 'all' || (filter.value === 'portrait') === isPortrait(o)) &&
            (!needle || `${o.screen.name} ${o.screen.slug}`.toLocaleLowerCase(LOCALE).includes(needle)),
    );
});

const current = computed(() => FILTERS.find((f) => f.key === filter.value)!);

const theme = ref<ThemeDoc | null>(null);

/** The signs of life by screen slug (Plan.md 59); null while this person cannot see them or loading failed. */
const { heartbeats, now, refreshHeartbeats } = useHeartbeats(repository);

const aliveOf = (slug: string) =>
    heartbeats.value ? aliveState(heartbeats.value.get(slug), now.value, context.timeZone) : null;

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
    computed(() =>
        postNeeds(overviews.value.flatMap((o) => Object.values(o.playlists).flatMap((p) => (p.firstSlide ? [p.firstSlide] : [])))),
    ),
    computed(() =>
        groupNeeds(overviews.value.flatMap((o) => Object.values(o.playlists).flatMap((p) => (p.firstSlide ? [p.firstSlide] : [])))),
    ),
    computed(() =>
        roomNeeds(overviews.value.flatMap((o) => Object.values(o.playlists).flatMap((p) => (p.firstSlide ? [p.firstSlide] : [])))),
    ),
);

async function refresh(): Promise<void> {
    if (!repository.value) return;
    const [list, stored] = await Promise.all([
        repository.value.listScreenOverviews(),
        // The tiles show the theme; without it they show the defaults.
        repository.value.loadTheme().catch(() => null),
        refreshHeartbeats(),
    ]);
    overviews.value = list;
    setScreenCounts(list.map((o) => o.screen));
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
        // An administrator's visit creates the categories of the signs of life and of the drafts; nobody else may (Plan.md 59, 79).
        if (isAdmin) await Promise.all([handle.repository.ensureStatusCategory(), handle.repository.drafts.ensureCategory()]).catch(() => null);
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
                : t.home.unreachable(e instanceof Error ? e.message : null);
    }
});

/** A new screen comes with its own playlist, named after it: straight into its editor. */
async function created(playlistId: string): Promise<void> {
    creating.value = false;
    await router.push({ name: 'editor', params: { id: playlistId } });
}

async function resetDemoAndReload(): Promise<void> {
    if (!(await confirm({ message: t.home.resetDemoConfirm, confirmLabel: t.home.resetDemo, danger: true }))) return;
    resetDemoStore();
    window.location.reload();
}

async function remove(overview: ScreenOverview): Promise<void> {
    const { name, slug } = overview.screen;
    const question = t.home.deleteConfirm(name, slug);
    if (!repository.value || !(await confirm({ message: question, confirmLabel: t.common.delete, danger: true }))) return;
    await repository.value.deleteScreen(slug);
    await refresh();
}
</script>

<template>
    <ModulePage>
        <p v-if="demo" class="d-banner" data-testid="demo-notice">
            {{ t.home.demoNotice }}
            <button class="link" type="button" data-testid="reset-demo" @click="resetDemoAndReload">
                {{ t.home.resetDemo }}
            </button>
        </p>

        <section
            v-if="missingRights.length"
            class="d-banner d-banner--warning rights"
            role="status"
            data-testid="missing-rights"
        >
            <strong>{{ t.home.rightsMissing }}</strong>
            <ul>
                <li v-for="right in missingRights" :key="`${right.area}-${right.key ?? right.text}`">
                    {{ right.text }}
                    <code v-if="right.key">{{ right.key }}</code>
                    <span v-if="right.detail" class="muted"> – {{ right.detail }}</span>
                </li>
            </ul>
            <p v-if="admin" class="muted">
                {{ t.home.rightsAdminBefore }}
                <RouterLink :to="{ name: 'setup-groups' }">{{ t.common.settings }}</RouterLink>{{ t.home.rightsAdminAfter }}
            </p>
            <p v-else class="muted">
                {{ t.home.rightsOther }}
            </p>
        </section>

        <PageHeader icon="tv" :title="t.common.screens" testid="screens-heading">
            {{ t.home.intro }}
            <template #actions>
                <button
                    v-if="screensAdmin"
                    class="d-btn d-btn--create"
                    type="button"
                    :aria-label="t.home.create.title"
                    data-testid="new-screen"
                    @click="creating = true"
                >
                    <Icon name="plus" />
                    <span class="create-label">{{ t.home.create.title }}</span>
                </button>
            </template>
        </PageHeader>

        <p v-if="error" class="d-banner d-banner--error" role="alert">{{ error }}</p>
        <p v-else-if="!ready" class="empty">{{ t.common.loading }}</p>
        <template v-else>
            <div class="d-toolbar">
                <SearchField
                    v-model="query"
                    :placeholder="t.home.searchPlaceholder"
                    :label="t.home.searchLabel"
                    testid="search"
                />
                <FilterChips v-model="formatChoice" :options="formatOptions" :label="t.common.format" testid="filter" />
            </div>

            <GroupCard
                :icon="current.icon"
                :title="current.label"
                :count="t.common.screenCount(shown.length)"
                :heading-id="`group-${current.key}`"
                hide-heading
            >
                <div v-if="shown.length" class="d-tiles">
                    <ScreenCard
                        v-for="o in shown"
                        :key="o.screen.id"
                        :overview="o"
                        :admin="screensAdmin"
                        :running="runningNow(o.screen, context)"
                        :alive="aliveOf(o.screen.slug)"
                        @remove="remove(o)"
                        @settings="configuring = { screen: o.screen, mode: 'settings' }"
                        @rename="configuring = { screen: o.screen, mode: 'rename' }"
                        @schedule="scheduling = o.screen.slug"
                    />
                </div>
                <div v-else-if="!overviews.length" class="empty">
                    <p>{{ t.home.empty }}</p>
                    <p v-if="!screensAdmin">{{ t.home.emptyNoAdmin }}</p>
                    <button v-if="screensAdmin" class="d-btn d-btn--create" type="button" @click="creating = true">
                        <Icon name="plus" /> {{ t.home.createFirst }}
                    </button>
                </div>
                <p v-else class="empty">{{ t.home.noMatch }}</p>
            </GroupCard>
        </template>

        <template v-if="repository && author !== null">
            <ScreenSettingsDialog
                v-if="configuring"
                :screen="configuring.screen"
                :mode="configuring.mode"
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
</style>
