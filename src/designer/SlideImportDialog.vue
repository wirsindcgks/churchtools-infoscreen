<script setup lang="ts">
/**
 * Slides from another playlist of the same format, taken over as copies:
 * editing them here never changes the other playlist (Plan.md 31).
 */
import { computed, onMounted, ref, watch } from 'vue';
import { sameStage, type SlideDoc } from '../model/schema';
import { getRepository } from '../store/backend';
import type { PlaylistOverview, ScreenRepository } from '../store/screen-repository';
import { useEditorStore } from './editor-store';
import SlideThumb from './SlideThumb.vue';

const emit = defineEmits<{ close: [] }>();
const editor = useEditorStore();

let repository: ScreenRepository | null = null;
const playlists = ref<PlaylistOverview[]>([]);
const playlistId = ref('');
const slides = ref<SlideDoc[]>([]);
const chosen = ref(new Set<string>());
const loading = ref(true);
const problem = ref<string | null>(null);

/** Only playlists of the same format: a portrait slide on a landscape stage would be cut. */
const candidates = computed(() =>
    playlists.value.filter((o) => o.playlist.id !== editor.draft?.playlist.id && sameStage(o.playlist.stage, editor.stage)),
);

onMounted(async () => {
    try {
        repository = (await getRepository()).repository;
        playlists.value = await repository.listPlaylists();
        playlistId.value = candidates.value[0]?.playlist.id ?? '';
    } catch (e) {
        problem.value = e instanceof Error ? e.message : String(e);
    } finally {
        loading.value = false;
    }
});

watch(playlistId, async (id) => {
    chosen.value = new Set();
    slides.value = [];
    if (!id || !repository) return;
    try {
        const loaded = await repository.loadPlaylist(id);
        const byId = new Map(loaded.slides.map((s) => [s.id, s]));
        if (playlistId.value === id) slides.value = loaded.playlist.slideIds.flatMap((s) => byId.get(s) ?? []);
    } catch (e) {
        problem.value = e instanceof Error ? e.message : String(e);
    }
});

function toggle(id: string): void {
    const next = new Set(chosen.value);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    chosen.value = next;
}

function take(): void {
    editor.insertSlides(slides.value.filter((s) => chosen.value.has(s.id)));
    emit('close');
}
</script>

<template>
    <div class="d-dialog-backdrop" role="dialog" aria-modal="true" aria-labelledby="import-title" @click.self="emit('close')">
        <div class="d-dialog import" data-testid="slide-import">
            <h2 id="import-title">Slides aus anderer Playlist</h2>
            <p class="hint">Übernommen werden Kopien – was du hier änderst, bleibt in der anderen Playlist, wie es ist.</p>
            <p v-if="problem" class="d-banner d-banner--error" role="alert">{{ problem }}</p>
            <p v-if="loading" class="hint">Lade Playlists …</p>
            <p v-else-if="!candidates.length" class="hint" data-testid="slide-import-none">
                Es gibt keine andere Playlist in diesem Format.
            </p>
            <template v-else>
                <label class="d-field">
                    Playlist
                    <select v-model="playlistId" data-testid="slide-import-playlist">
                        <option v-for="o in candidates" :key="o.playlist.id" :value="o.playlist.id">
                            {{ o.playlist.name }} ({{ o.slideCount }} {{ o.slideCount === 1 ? 'Slide' : 'Slides' }})
                        </option>
                    </select>
                </label>
                <ul class="slides">
                    <li v-for="slide in slides" :key="slide.id">
                        <label :class="{ on: chosen.has(slide.id) }" data-testid="slide-import-item">
                            <SlideThumb :slide="slide" :stage="editor.stage" />
                            <span class="name">
                                <input type="checkbox" :checked="chosen.has(slide.id)" @change="toggle(slide.id)">
                                {{ slide.name }}
                            </span>
                        </label>
                    </li>
                </ul>
            </template>
            <div class="d-dialog-actions">
                <button class="d-btn" type="button" @click="emit('close')">Abbrechen</button>
                <button
                    class="d-btn d-btn--primary"
                    type="button"
                    :disabled="!chosen.size"
                    data-testid="slide-import-take"
                    @click="take"
                >
                    {{ chosen.size === 1 ? '1 Slide übernehmen' : `${chosen.size} Slides übernehmen` }}
                </button>
            </div>
        </div>
    </div>
</template>

<style scoped>
.import {
    display: grid;
    gap: 12px;
    width: min(760px, 100%);
}
.import h2 {
    margin: 0;
}
.hint {
    margin: 0;
    color: var(--d-text-muted);
    font-size: var(--d-size-sm);
}
.slides {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 10px;
    max-height: 50vh;
    overflow-y: auto;
    margin: 0;
    padding: 2px;
    list-style: none;
}
.slides label {
    display: grid;
    gap: 4px;
    padding: 4px;
    border: 2px solid transparent;
    border-radius: var(--d-radius-lg);
    cursor: pointer;
}
.slides label.on {
    border-color: var(--d-accent);
    background: var(--d-accent-pale);
}
.slides :deep(.slide-thumb) {
    border-radius: var(--d-radius);
}
.name {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: var(--d-size-sm);
    overflow-wrap: anywhere;
}
.name input {
    flex: none;
}
</style>
