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
import Icon from '../designer/Icon.vue';
import ModulePage from '../designer/ModulePage.vue';
import { checkDesignerRights, type MissingRight } from '../designer/rights';
import { canManagePermissions } from '../setup/load';
import ScreenCard from '../designer/ScreenCard.vue';
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
/** Administrators set the module up (role concept, Plan.md F); everyone else does not see the way there. */
const admin = ref(false);
const filter = computed(() => formatFilter(route.query.format));
const query = ref('');

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

// The tiles are the player's components: they need the same live data as the editor preview.
usePreview(
    computed(() => [
        ...new Set(
            overviews.value.flatMap((o) =>
                (o.firstSlide?.blocks ?? []).flatMap((b) =>
                    b.type === 'appointment-list' || b.type === 'next-appointment' ? b.calendarIds : [],
                ),
            ),
        ),
    ]),
    computed(() => overviews.value.flatMap((o) => o.media)),
);

async function refresh(): Promise<void> {
    if (repository.value) overviews.value = await repository.value.listScreenOverviews();
}

onMounted(async () => {
    try {
        // Show the page only when both are there: a form without storage would swallow clicks.
        const [signedIn, handle, isAdmin] = await Promise.all([
            currentPerson(),
            getRepository(),
            canManagePermissions().catch(() => false),
        ]);
        admin.value = isAdmin;
        demo.value = handle.demo;
        // A failed check must not lock anyone out; it only means no hint.
        missingRights.value = await checkDesignerRights(handle.repository, handle.demo).catch((e: unknown) => {
            console.warn('Rechteprüfung nicht möglich:', e);
            return [];
        });
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

async function created(slug: string): Promise<void> {
    creating.value = false;
    await router.push({ name: 'editor', params: { slug } });
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
    <div class="infoscreen-designer home">
        <p v-if="error" class="d-banner d-banner--error page-message" role="alert">{{ error }}</p>
        <template v-else-if="author !== null && repository">
            <ModulePage current="screens" :admin="admin" :counts="counts">
                <template #actions>
                    <button
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
                    Demo-Modus: Die Screens liegen in diesem Browser, nicht in ChurchTools; Termine, Name und Logo
                    kommen live. Designer und Player in anderen Tabs dieses Browsers sehen dieselben Screens.
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
                        <RouterLink :to="{ name: 'setup' }">Einstellungen</RouterLink>; dort legt der Assistent die
                        Gruppen samt Rechten an. Rechte einer Gruppe wirken erst, wenn sie den Status „aktiv" hat.
                    </p>
                    <p v-else class="muted">
                        Rechte vergibt ein Administrator deiner Gemeinde: Er nimmt dich in die Gruppe
                        „Infoscreen-Designer" auf.
                    </p>
                </section>

                <div class="page-title">
                    <span class="title-icon"><Icon name="grid" :size="20" /></span>
                    <h1 data-testid="screens-heading">Screens</h1>
                </div>

                <label class="search">
                    <Icon name="search" class="search-icon" />
                    <input
                        v-model="query"
                        type="search"
                        placeholder="Suchen nach Name oder Adresse …"
                        aria-label="Screens durchsuchen"
                        data-testid="search"
                    >
                </label>

                <section class="d-card group" :aria-labelledby="`group-${current.key}`">
                    <header>
                        <span class="group-icon"><Icon :name="current.icon" /></span>
                        <div>
                            <h2 :id="`group-${current.key}`">{{ current.label }}</h2>
                            <span class="muted">{{ shown.length }} {{ shown.length === 1 ? 'Screen' : 'Screens' }}</span>
                        </div>
                    </header>
                    <div v-if="shown.length" class="tiles">
                        <ScreenCard v-for="o in shown" :key="o.screen.id" :overview="o" @remove="remove(o)" />
                    </div>
                    <div v-else-if="!overviews.length" class="empty">
                        <p>Noch keine Screens angelegt.</p>
                        <button class="d-btn d-btn--create" type="button" @click="creating = true">
                            <Icon name="plus" /> Ersten Screen erstellen
                        </button>
                    </div>
                    <p v-else class="empty muted">Kein Screen passt zu diesem Filter.</p>
                </section>
            </ModulePage>

            <CreateScreenDialog
                v-if="creating"
                :repository="repository"
                :author="author"
                @close="creating = false"
                @created="created"
            />
        </template>
        <p v-else class="page-message muted">Lade …</p>
    </div>
</template>

<style scoped>
.home {
    min-height: 100%;
}
.page-message {
    margin: 24px 16px;
}
.page-title {
    display: flex;
    align-items: center;
    gap: 12px;
}
.page-title h1 {
    margin: 0;
    font-size: 1.8em;
}
.title-icon,
.group-icon {
    display: grid;
    place-items: center;
    width: 40px;
    height: 40px;
    border-radius: var(--d-radius-lg);
    background: var(--d-accent-pale);
    color: var(--d-accent);
}
.group-icon {
    border-radius: 50%;
}
.search {
    position: relative;
    display: block;
}
.search-icon {
    position: absolute;
    top: 50%;
    left: 12px;
    color: var(--d-text-muted);
    transform: translateY(-50%);
}
.search input {
    min-height: 44px;
    padding-left: 40px;
    border-radius: var(--d-radius-lg);
}
.group {
    padding: 16px 20px 20px;
}
.group header {
    display: flex;
    align-items: center;
    gap: 14px;
    margin-bottom: 16px;
}
.group h2 {
    margin: 0;
    font-size: 1.15em;
}
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
    .page-title h1 {
        font-size: 1.4em;
    }
    .title-icon {
        display: none;
    }
    .group {
        padding: 12px;
    }
    .tiles {
        grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
        gap: 10px;
    }
}
@media (max-width: 40rem) {
    .create-label {
        display: none;
    }
}
</style>
