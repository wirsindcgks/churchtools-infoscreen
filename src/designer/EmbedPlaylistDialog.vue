<script setup lang="ts">
/**
 * A whole presentation of the same format, shown inside this one at the chosen place (Plan.md 120). The main part is edited
 * in its own editor only; here it is embedded as one entry.
 */
import { computed, onMounted, ref } from 'vue';
import { t } from '../i18n/designer';
import { sameStage } from '../model/schema';
import { getRepository } from '../store/backend';
import type { PlaylistOverview, ScreenRepository } from '../store/screen-repository';
import { useEditorStore } from './editor-store';
import SlideThumb from './SlideThumb.vue';
import Tile from './Tile.vue';

const emit = defineEmits<{ close: [] }>();
const editor = useEditorStore();

let repository: ScreenRepository | null = null;
const playlists = ref<PlaylistOverview[]>([]);
const chosen = ref('');
const loading = ref(true);
const taking = ref(false);
const problem = ref<string | null>(null);

/** The same format, not this one, and none that embeds something itself – one level only. */
const candidates = computed(() =>
    playlists.value.filter(
        (o) => o.playlist.id !== editor.draft?.playlist.id && sameStage(o.playlist.stage, editor.stage) && !o.playlist.embeds?.length,
    ),
);

onMounted(async () => {
    try {
        repository = (await getRepository()).repository;
        playlists.value = await repository.listPlaylists();
    } catch (e) {
        problem.value = e instanceof Error ? e.message : String(e);
    } finally {
        loading.value = false;
    }
});

async function take(): Promise<void> {
    if (!repository || !chosen.value || taking.value) return;
    taking.value = true;
    try {
        editor.embedPlaylist(await repository.loadPlaylist(chosen.value));
        emit('close');
    } catch (e) {
        problem.value = e instanceof Error ? e.message : String(e);
    } finally {
        taking.value = false;
    }
}
</script>

<template>
    <div class="d-dialog-backdrop" role="dialog" aria-modal="true" aria-labelledby="embed-title" @click.self="emit('close')">
        <div class="d-dialog embed" data-testid="embed-dialog">
            <h2 id="embed-title">{{ t.editor.embed.title }}</h2>
            <p class="hint">{{ t.editor.embed.hint }}</p>
            <p v-if="problem" class="d-banner d-banner--error" role="alert">{{ problem }}</p>
            <p v-if="loading" class="hint">{{ t.editor.embed.loading }}</p>
            <p v-else-if="!candidates.length" class="hint" data-testid="embed-none">
                {{ t.editor.embed.none }}
            </p>
            <div v-else class="d-tiles tiles">
                <Tile
                    v-for="o in candidates"
                    :key="o.playlist.id"
                    as="label"
                    :class="{ 'd-tile--selected': chosen === o.playlist.id }"
                    data-testid="embed-candidate"
                >
                    <template #media>
                        <span class="d-tile-media"><SlideThumb :slide="o.firstSlide" :stage="editor.stage" /></span>
                        <span class="d-tile-check">
                            <input v-model="chosen" type="radio" name="embed-playlist" :value="o.playlist.id" :aria-label="o.playlist.name">
                        </span>
                    </template>
                    <template #title>{{ o.playlist.name }}</template>
                    <section class="d-tile-section">
                        <ul class="d-facts">
                            <li>{{ t.editor.embed.slideCount(o.slideCount) }}</li>
                        </ul>
                    </section>
                </Tile>
            </div>
            <div class="d-dialog-actions">
                <button class="d-btn" type="button" @click="emit('close')">{{ t.common.cancel }}</button>
                <button class="d-btn d-btn--primary" type="button" :disabled="!chosen || taking" data-testid="embed-take" @click="take">
                    {{ t.editor.embed.take }}
                </button>
            </div>
        </div>
    </div>
</template>

<style scoped>
.embed {
    display: grid;
    gap: 12px;
    width: min(1100px, 100%);
}
.embed h2 {
    margin: 0;
}
.hint {
    margin: 0;
    color: var(--d-text-muted);
    font-size: var(--d-size-sm);
}
.tiles {
    max-height: 50vh;
    overflow-y: auto;
    /* Room for the ring and the shadow of the tiles at the edge. */
    padding: 4px;
}
.tiles label {
    cursor: pointer;
}
</style>
