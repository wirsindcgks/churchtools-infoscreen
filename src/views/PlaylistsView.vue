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
import FilterChips from '../designer/FilterChips.vue';
import { FILTERS, FORMAT_SEGMENTS, type FormatFilter } from '../designer/format-filter';
import GroupCard from '../designer/GroupCard.vue';
import Icon from '../designer/Icon.vue';
import ModulePage from '../designer/ModulePage.vue';
import PageHeader from '../designer/PageHeader.vue';
import PlaylistCard from '../designer/PlaylistCard.vue';
import SearchField from '../designer/SearchField.vue';
import { useHeartbeats } from '../designer/useHeartbeats';
import { usePreview } from '../designer/usePreview';
import { blockCalendarIds, type ThemeDoc } from '../model/schema';
import { groupNeeds, postNeeds, roomNeeds } from '../player/data';
import { getRepository } from '../store/backend';
import type { PlaylistOverview, ScreenRepository } from '../store/screen-repository';
import { t } from '../i18n/designer';
import { LOCALE } from '../i18n/player';
import { useConfirm } from '../designer/useConfirm';

const { confirm, notice } = useConfirm();

const router = useRouter();
const repository = shallowRef<ScreenRepository | null>(null);
const author = ref<string | null>(null);
const overviews = ref<PlaylistOverview[]>([]);
const error = ref<string | null>(null);
const creating = ref(false);
/** Loaded: the page shows its frame before, and its content from then on. */
const ready = computed(() => author.value !== null && repository.value !== null);
const query = ref('');
const format = ref<FormatFilter>('all');

const isPortrait = (o: PlaylistOverview) => o.playlist.stage.height > o.playlist.stage.width;

const formatOptions = computed(() =>
    FORMAT_SEGMENTS.map((f) => ({
        ...f,
        count: overviews.value.filter((o) => f.key === 'all' || (f.key === 'portrait') === isPortrait(o)).length,
    })),
);

const shown = computed(() => {
    const needle = query.value.trim().toLocaleLowerCase(LOCALE);
    return overviews.value.filter(
        (o) =>
            (format.value === 'all' || (format.value === 'portrait') === isPortrait(o)) &&
            (!needle ||
                `${o.playlist.name} ${o.screens.map((s) => s.name).join(' ')}`.toLocaleLowerCase(LOCALE).includes(needle)),
    );
});

const theme = ref<ThemeDoc | null>(null);

/** Which playlist a screen shows right now (Plan.md 77); the tiles mark those that run. */
const { heartbeats, now, refreshHeartbeats } = useHeartbeats(repository);

// The tiles are the player's components: they need the same live data as the editor preview.
usePreview(
    computed(() => [
        ...new Set(overviews.value.flatMap((o) => (o.firstSlide?.blocks ?? []).flatMap(blockCalendarIds))),
    ]),
    computed(() => overviews.value.flatMap((o) => o.media)),
    theme,
    computed(() => postNeeds(overviews.value.flatMap((o) => (o.firstSlide ? [o.firstSlide] : [])))),
    computed(() => groupNeeds(overviews.value.flatMap((o) => (o.firstSlide ? [o.firstSlide] : [])))),
    computed(() => roomNeeds(overviews.value.flatMap((o) => (o.firstSlide ? [o.firstSlide] : [])))),
);

async function refresh(): Promise<void> {
    if (!repository.value) return;
    const [list, stored] = await Promise.all([
        repository.value.listPlaylists(),
        // The tiles show the theme; without it they show the defaults.
        repository.value.loadTheme().catch(() => null),
        refreshHeartbeats(),
    ]);
    overviews.value = list;
    theme.value = stored;
}

onMounted(async () => {
    try {
        const [person, handle] = await Promise.all([currentPerson(), getRepository()]);
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

/** The playlist being duplicated, while the dialog asks how (Plan.md 49). */
const duplicating = ref<PlaylistOverview | null>(null);
const duplicateMode = ref<'copy' | 'linked'>('copy');

function askDuplicate(overview: PlaylistOverview): void {
    duplicateMode.value = 'copy';
    duplicating.value = overview;
}

/** A copy with copies of the slides – or linked to the same ones; it opens in the editor, since one duplicates to change something. */
async function duplicate(overview: PlaylistOverview, linked: boolean): Promise<void> {
    duplicating.value = null;
    if (!repository.value || author.value === null) return;
    try {
        const copy = await repository.value.duplicatePlaylist(overview.playlist.id, author.value, new Date(), { linked });
        await router.push({ name: 'editor', params: { id: copy.id } });
    } catch (e) {
        await notice(e instanceof Error ? e.message : String(e));
    }
}

async function remove(overview: PlaylistOverview): Promise<void> {
    if (!repository.value) return;
    if (!(await confirm({ message: t.playlists.deleteConfirm(overview.playlist.name), confirmLabel: t.common.delete, danger: true }))) return;
    try {
        await repository.value.deletePlaylist(overview.playlist.id);
    } catch (e) {
        await notice(e instanceof Error ? e.message : String(e));
    }
    await refresh();
}
</script>

<template>
    <ModulePage>
        <PageHeader icon="list" :title="t.common.playlists" testid="playlists-heading">
            {{ t.playlists.intro }}
            <template #actions>
                <button
                    class="d-btn d-btn--create"
                    type="button"
                    :aria-label="t.playlists.create.title"
                    :disabled="!ready"
                    data-testid="new-playlist"
                    @click="creating = true"
                >
                    <Icon name="plus" />
                    <span class="create-label">{{ t.playlists.create.title }}</span>
                </button>
            </template>
        </PageHeader>

        <p v-if="error" class="d-banner d-banner--error" role="alert">{{ error }}</p>
        <p v-else-if="!ready" class="empty">{{ t.common.loading }}</p>
        <template v-else>
            <div class="d-toolbar">
                <SearchField
                    v-model="query"
                    :placeholder="t.playlists.searchPlaceholder"
                    :label="t.playlists.searchLabel"
                    testid="playlist-search"
                />
                <FilterChips v-model="format" :options="formatOptions" :label="t.common.format" testid="playlist-filter" />
            </div>

            <GroupCard
                icon="list"
                :title="format === 'all' ? t.playlists.all : FILTERS.find((f) => f.key === format)!.label"
                :count="t.playlists.count(shown.length)"
                heading-id="playlists-group"
                hide-heading
            >
                <div v-if="shown.length" class="d-tiles">
                    <PlaylistCard
                        v-for="o in shown"
                        :key="o.playlist.id"
                        :overview="o"
                        :heartbeats="heartbeats"
                        :now="now"
                        @remove="remove(o)"
                        @duplicate="askDuplicate(o)"
                    />
                </div>
                <div v-else-if="!overviews.length" class="empty">
                    <p>{{ t.playlists.empty }}</p>
                    <button class="d-btn d-btn--create" type="button" @click="creating = true">
                        <Icon name="plus" /> {{ t.playlists.createFirst }}
                    </button>
                </div>
                <p v-else class="empty">{{ t.playlists.noMatch }}</p>
            </GroupCard>
        </template>

        <div
            v-if="duplicating"
            class="d-dialog-backdrop"
            role="dialog"
            aria-modal="true"
            aria-labelledby="duplicate-title"
            @click.self="duplicating = null"
        >
            <div class="d-dialog duplicate" data-testid="duplicate-dialog">
                <h2 id="duplicate-title">{{ t.playlists.duplicate.title }}</h2>
                <div class="options" role="radiogroup" aria-labelledby="duplicate-title">
                    <label>
                        <input v-model="duplicateMode" type="radio" value="copy" data-testid="duplicate-copy">
                        {{ t.playlists.duplicate.copy }}
                    </label>
                    <label>
                        <input v-model="duplicateMode" type="radio" value="linked" data-testid="duplicate-linked">
                        {{ t.playlists.duplicate.linked }}
                    </label>
                </div>
                <div class="d-dialog-actions">
                    <button class="d-btn" type="button" @click="duplicating = null">{{ t.common.cancel }}</button>
                    <button
                        class="d-btn d-btn--primary"
                        type="button"
                        data-testid="duplicate-confirm"
                        @click="duplicate(duplicating, duplicateMode === 'linked')"
                    >
                        {{ t.playlists.card.duplicate }}
                    </button>
                </div>
            </div>
        </div>

        <CreatePlaylistDialog
            v-if="creating && repository && author !== null"
            :repository="repository"
            :author="author"
            @close="creating = false"
            @created="created"
        />
    </ModulePage>
</template>

<style scoped>
.duplicate {
    display: grid;
    gap: 12px;
    width: min(460px, 100%);
}
.duplicate h2 {
    margin: 0;
}
.options {
    display: grid;
    gap: 8px;
}
.duplicate label {
    display: flex;
    align-items: baseline;
    gap: 8px;
}
.duplicate input[type='radio'] {
    flex: none;
    width: auto;
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
</style>
