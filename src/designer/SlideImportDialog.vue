<script setup lang="ts">
/**
 * Slides from another playlist of the same format, taken over as copies –
 * editing them here never changes the other playlist (Plan.md 31) – or, by
 * choice, linked: the very same slides, a change counts in both (Plan.md 49).
 */
import { computed, onMounted, ref, watch } from 'vue';
import { t } from '../i18n/designer';
import { sameStage, type SlideDoc } from '../model/schema';
import { getRepository } from '../store/backend';
import type { LoadedPlaylist, PlaylistOverview, ScreenRepository } from '../store/screen-repository';
import { useEditorStore } from './editor-store';
import SlideThumb from './SlideThumb.vue';

const emit = defineEmits<{ close: [] }>();
const editor = useEditorStore();

let repository: ScreenRepository | null = null;
const playlists = ref<PlaylistOverview[]>([]);
const playlistId = ref('');
const slides = ref<SlideDoc[]>([]);
const sourceShared = ref<LoadedPlaylist['sharedWith']>({});
const chosen = ref(new Set<string>());
const mode = ref<'copy' | 'linked'>('copy');
const loading = ref(true);
const sourceName = computed(() => playlists.value.find((o) => o.playlist.id === playlistId.value)?.playlist.name ?? '');
/** A slide already in this playlist cannot be linked a second time. */
const here = computed(() => new Set(editor.draft?.slides.map((s) => s.id)));
function unavailable(id: string): boolean {
    return mode.value === 'linked' && here.value.has(id);
}
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
        if (playlistId.value === id) {
            slides.value = loaded.playlist.slideIds.flatMap((s) => byId.get(s) ?? []);
            sourceShared.value = loaded.sharedWith;
        }
    } catch (e) {
        problem.value = e instanceof Error ? e.message : String(e);
    }
});

watch(mode, () => {
    chosen.value = new Set([...chosen.value].filter((id) => !unavailable(id)));
});

function toggle(id: string): void {
    if (unavailable(id)) return;
    const next = new Set(chosen.value);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    chosen.value = next;
}

function take(): void {
    const picked = slides.value.filter((s) => chosen.value.has(s.id));
    if (mode.value === 'linked') {
        editor.insertSlides(picked, {
            linked: true,
            from: { id: playlistId.value, name: sourceName.value },
            sharedWith: sourceShared.value,
        });
    } else {
        editor.insertSlides(picked);
    }
    emit('close');
}
</script>

<template>
    <div class="d-dialog-backdrop" role="dialog" aria-modal="true" aria-labelledby="import-title" @click.self="emit('close')">
        <div class="d-dialog import" data-testid="slide-import">
            <h2 id="import-title">{{ t.editor.import.title }}</h2>
            <fieldset class="mode" data-testid="slide-import-mode">
                <legend>{{ t.editor.import.takeAs }}</legend>
                <div class="mode-options">
                    <label>
                        <input v-model="mode" type="radio" value="copy" data-testid="slide-import-copy">
                        {{ t.editor.import.asCopy }}
                    </label>
                    <label>
                        <input v-model="mode" type="radio" value="linked" data-testid="slide-import-linked">
                        {{ t.editor.import.asLinked }}
                    </label>
                </div>
            </fieldset>
            <p v-if="mode === 'copy'" class="hint">
                {{ t.editor.import.copyHint }}
            </p>
            <p v-else class="hint" data-testid="slide-import-linked-hint">
                {{ t.editor.import.linkedHint(sourceName) }}
            </p>
            <p v-if="problem" class="d-banner d-banner--error" role="alert">{{ problem }}</p>
            <p v-if="loading" class="hint">{{ t.editor.import.loading }}</p>
            <p v-else-if="!candidates.length" class="hint" data-testid="slide-import-none">
                {{ t.editor.import.none }}
            </p>
            <template v-else>
                <label class="d-field">
                    {{ t.editor.import.playlist }}
                    <select v-model="playlistId" data-testid="slide-import-playlist">
                        <option v-for="o in candidates" :key="o.playlist.id" :value="o.playlist.id">
                            {{ o.playlist.name }} ({{ t.editor.import.slideCount(o.slideCount) }})
                        </option>
                    </select>
                </label>
                <ul class="slides">
                    <li v-for="slide in slides" :key="slide.id">
                        <label :class="{ on: chosen.has(slide.id), off: unavailable(slide.id) }" data-testid="slide-import-item">
                            <SlideThumb :slide="slide" :stage="editor.stage" />
                            <span class="name">
                                <input
                                    type="checkbox"
                                    :checked="chosen.has(slide.id)"
                                    :disabled="unavailable(slide.id)"
                                    @change="toggle(slide.id)"
                                >
                                {{ slide.name }}
                            </span>
                            <span v-if="unavailable(slide.id)" class="hint" data-testid="slide-import-here">{{ t.editor.import.alreadyHere }}</span>
                        </label>
                    </li>
                </ul>
            </template>
            <div class="d-dialog-actions">
                <button class="d-btn" type="button" @click="emit('close')">{{ t.common.cancel }}</button>
                <button
                    class="d-btn d-btn--primary"
                    type="button"
                    :disabled="!chosen.size"
                    data-testid="slide-import-take"
                    @click="take"
                >
                    <template v-if="mode === 'linked'">
                        {{ t.editor.import.link(chosen.size) }}
                    </template>
                    <template v-else>
                        {{ t.editor.import.take(chosen.size) }}
                    </template>
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
.mode {
    margin: 0;
    padding: 0;
    border: 0;
}
/* A div inside: WebKit lays a flex fieldset out wrongly. */
.mode-options {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 16px;
}
.mode legend {
    padding: 0;
    margin-bottom: 4px;
    color: var(--d-text-muted);
    font-size: var(--d-size-sm);
}
.mode label {
    display: flex;
    align-items: center;
    gap: 6px;
}
.mode input[type='radio'] {
    flex: none;
    width: auto;
}
.slides label.off {
    cursor: default;
    opacity: 0.5;
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
