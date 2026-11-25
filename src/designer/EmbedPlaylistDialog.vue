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
            <ul v-else class="playlists">
                <li v-for="o in candidates" :key="o.playlist.id">
                    <label :class="{ on: chosen === o.playlist.id }" data-testid="embed-candidate">
                        <SlideThumb :slide="o.firstSlide" :stage="editor.stage" />
                        <span class="name">
                            <input v-model="chosen" type="radio" name="embed-playlist" :value="o.playlist.id">
                            {{ o.playlist.name }}
                        </span>
                        <span class="hint">{{ t.editor.embed.slideCount(o.slideCount) }}</span>
                    </label>
                </li>
            </ul>
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
    width: min(760px, 100%);
}
.embed h2 {
    margin: 0;
}
.hint {
    margin: 0;
    color: var(--d-text-muted);
    font-size: var(--d-size-sm);
}
.playlists {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 10px;
    max-height: 50vh;
    overflow-y: auto;
    margin: 0;
    padding: 2px;
    list-style: none;
}
.playlists label {
    display: grid;
    gap: 4px;
    padding: 4px;
    border: 2px solid transparent;
    border-radius: var(--d-radius-lg);
    cursor: pointer;
}
.playlists label.on {
    border-color: var(--d-accent);
    background: var(--d-accent-pale);
}
.playlists :deep(.slide-thumb) {
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
