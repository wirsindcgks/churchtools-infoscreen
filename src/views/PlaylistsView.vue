<script setup lang="ts">
/**
 * The playlists as a section of their own (Plan.md, Nächste Schritte 19):
 * content stands apart from the screens that show it. One playlist may run
 * on several screens; each screen chooses in its schedule. Designers create
 * and delete playlists here – a playlist still shown somewhere stays.
 */
import { computed, onMounted, ref, shallowRef } from 'vue';
import { useRouter } from 'vue-router';
import { currentPerson, displayName } from '../ct/client';
import CreatePlaylistDialog from '../designer/CreatePlaylistDialog.vue';
import { FILTERS, type FormatFilter } from '../designer/format-filter';
import Icon from '../designer/Icon.vue';
import ModulePage from '../designer/ModulePage.vue';
import PlaylistCard from '../designer/PlaylistCard.vue';
import { usePreview } from '../designer/usePreview';
import { canManagePermissions } from '../setup/load';
import { getRepository } from '../store/backend';
import type { PlaylistOverview, ScreenRepository } from '../store/screen-repository';

const router = useRouter();
const repository = shallowRef<ScreenRepository | null>(null);
const author = ref<string | null>(null);
const overviews = ref<PlaylistOverview[]>([]);
const admin = ref(false);
const error = ref<string | null>(null);
const creating = ref(false);
const query = ref('');
const format = ref<FormatFilter>('all');

const isPortrait = (o: PlaylistOverview) => o.playlist.stage.height > o.playlist.stage.width;

const shown = computed(() => {
    const needle = query.value.trim().toLocaleLowerCase('de');
    return overviews.value.filter(
        (o) =>
            (format.value === 'all' || (format.value === 'portrait') === isPortrait(o)) &&
            (!needle ||
                `${o.playlist.name} ${o.screens.map((s) => s.name).join(' ')}`.toLocaleLowerCase('de').includes(needle)),
    );
});

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
    if (repository.value) overviews.value = await repository.value.listPlaylists();
}

onMounted(async () => {
    try {
        const [person, handle, isAdmin] = await Promise.all([
            currentPerson(),
            getRepository(),
            canManagePermissions().catch(() => false),
        ]);
        admin.value = isAdmin;
        repository.value = handle.repository;
        await refresh();
        author.value = displayName(person);
    } catch (e) {
        error.value = e instanceof Error ? e.message : String(e);
    }
});

async function created(id: string): Promise<void> {
    creating.value = false;
    await router.push({ name: 'editor', params: { id } });
}

async function remove(overview: PlaylistOverview): Promise<void> {
    if (!repository.value || !window.confirm(`Playlist „${overview.playlist.name}" löschen?`)) return;
    try {
        await repository.value.deletePlaylist(overview.playlist.id);
    } catch (e) {
        window.alert(e instanceof Error ? e.message : String(e));
    }
    await refresh();
}
</script>

<template>
    <div class="infoscreen-designer home">
        <p v-if="error" class="d-banner d-banner--error page-message" role="alert">{{ error }}</p>
        <template v-else-if="author !== null && repository">
            <ModulePage current="playlists" :admin="admin">
                <template #actions>
                    <button
                        class="d-btn d-btn--create"
                        type="button"
                        data-testid="new-playlist"
                        @click="creating = true"
                    >
                        <Icon name="plus" />
                        <span class="create-label">Playlist erstellen</span>
                    </button>
                </template>

                <div class="page-title">
                    <span class="title-icon"><Icon name="list" :size="20" /></span>
                    <h1 data-testid="playlists-heading">Playlists</h1>
                </div>
                <p class="muted intro">
                    Was die Screens zeigen. Eine Playlist kann auf mehreren Screens laufen; welche wann läuft, legt der
                    Zeitplan eines Screens fest – auf der Seite „Screens" an seiner Kachel.
                </p>

                <label class="search">
                    <Icon name="search" class="search-icon" />
                    <input
                        v-model="query"
                        type="search"
                        placeholder="Suchen nach Playlist oder Screen …"
                        aria-label="Playlists durchsuchen"
                        data-testid="playlist-search"
                    >
                </label>

                <section class="d-card group" aria-labelledby="playlists-group">
                    <header>
                        <span class="group-icon"><Icon name="list" /></span>
                        <div>
                            <h2 id="playlists-group">
                                {{ format === 'all' ? 'Alle Playlists' : FILTERS.find((f) => f.key === format)!.label }}
                            </h2>
                            <span class="muted">{{ shown.length }} {{ shown.length === 1 ? 'Playlist' : 'Playlists' }}</span>
                        </div>
                        <div class="formats" role="group" aria-label="Format">
                            <button
                                v-for="f in FILTERS"
                                :key="f.key"
                                type="button"
                                class="chip"
                                :class="{ on: format === f.key }"
                                :aria-pressed="format === f.key"
                                :data-testid="`playlist-filter-${f.key}`"
                                @click="format = f.key"
                            >
                                {{ f.key === 'all' ? 'Alle' : f.label }}
                            </button>
                        </div>
                    </header>
                    <div v-if="shown.length" class="tiles">
                        <PlaylistCard v-for="o in shown" :key="o.playlist.id" :overview="o" @remove="remove(o)" />
                    </div>
                    <div v-else-if="!overviews.length" class="empty">
                        <p>Noch keine Playlists.</p>
                        <button class="d-btn d-btn--create" type="button" @click="creating = true">
                            <Icon name="plus" /> Erste Playlist erstellen
                        </button>
                    </div>
                    <p v-else class="empty muted">Keine Playlist passt zu Suche und Filter.</p>
                </section>
            </ModulePage>

            <CreatePlaylistDialog
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
.intro {
    margin: -8px 0 0;
}
.formats {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-left: auto;
}
.chip {
    min-height: 2em;
    padding: 0 0.8em;
    border: 1px solid var(--d-divider);
    border-radius: 999px;
    background: var(--d-surface);
    color: var(--d-text);
    font: inherit;
    font-size: var(--d-size-sm);
    cursor: pointer;
}
.chip.on {
    border-color: var(--d-accent);
    background: var(--d-accent-pale);
    color: var(--d-accent-strong);
    font-weight: 700;
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
