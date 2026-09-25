<script setup lang="ts">
/**
 * The media library in the editor: choose a picture for a block or the
 * background – the same pictures, with where they are shown, as on the media
 * library page. A single upload is chosen right away.
 */
import { ref } from 'vue';
import type { MediaItem } from '../media/library';
import type { MediaDoc } from '../model/schema';
import MediaGrid from './MediaGrid.vue';
import { useMediaLibrary } from './useMediaLibrary';

const props = defineProps<{ screen: { slug: string; name: string }; selectedMediaId?: string }>();
const emit = defineEmits<{ choose: [MediaDoc]; close: [] }>();

const { items, loading, busy, problem, dragOver, dropZone, upload, adopt, remove } = useMediaLibrary(
    () => props.screen,
    (docs) => {
        if (docs.length === 1) emit('choose', docs[0]!);
    },
);

async function choose(item: MediaItem): Promise<void> {
    const doc = await adopt(item);
    if (doc) emit('choose', doc);
}

const input = ref<HTMLInputElement | null>(null);
async function picked(): Promise<void> {
    await upload(input.value?.files ?? null);
    if (input.value) input.value.value = '';
}
</script>

<template>
    <div class="backdrop" role="dialog" aria-modal="true" aria-label="Mediathek" @click.self="emit('close')">
        <div class="library" :class="{ 'library--drop': dragOver }" data-testid="media-library" v-on="dropZone">
            <header>
                <h2>Mediathek</h2>
                <span class="hint">Neue Bilder landen im Wiki-Bereich „Infoscreen", Seite <code>{{ screen.slug }}</code>.</span>
                <span class="spacer" />
                <button class="d-btn d-btn--create" type="button" :disabled="!!busy || loading" @click="input?.click()">
                    Bilder hochladen
                </button>
                <button class="d-btn" type="button" @click="emit('close')">Schließen</button>
                <input
                    ref="input"
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    multiple
                    hidden
                    data-testid="media-upload"
                    @change="picked"
                >
            </header>
            <p v-if="busy" class="banner">{{ busy }}</p>
            <p v-if="problem" class="banner banner--error" role="alert">{{ problem }}</p>
            <div class="body">
                <p v-if="loading" class="empty">Lade Bilder …</p>
                <MediaGrid
                    v-else-if="items.length"
                    :items="items"
                    :selected-media-id="selectedMediaId"
                    choosable
                    @choose="choose"
                    @remove="remove"
                />
                <p v-else class="empty">Noch keine Bilder. Hochladen per Knopf oder einfach hierher ziehen.</p>
            </div>
        </div>
    </div>
</template>

<style scoped>
.backdrop {
    position: fixed;
    inset: 0;
    z-index: 1000;
    display: grid;
    place-items: center;
    padding: 24px;
    background: rgba(15, 23, 42, 0.45);
}
.library {
    display: flex;
    flex-direction: column;
    width: min(1100px, 100%);
    max-height: 100%;
    min-height: 0;
    border-radius: var(--d-radius-lg);
    background: var(--d-surface);
    box-shadow: var(--d-shadow);
}
.library--drop {
    outline: 2px dashed var(--d-accent);
    outline-offset: -2px;
}
header {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
    padding: 12px 16px;
    border-bottom: 1px solid var(--d-divider);
}
h2 {
    margin: 0;
    font-size: 1.15em;
}
.hint {
    color: var(--d-text-muted);
    font-size: var(--d-size-sm);
}
.spacer {
    flex: 1;
}
.banner {
    margin: 0;
    padding: 6px 16px;
    background: var(--d-accent-pale);
    font-size: var(--d-size-sm);
}
.banner--error {
    background: var(--d-danger-pale);
}
.body {
    overflow-y: auto;
    padding: 16px;
}
.empty {
    margin: 0;
    padding: 24px 0;
    color: var(--d-text-muted);
    text-align: center;
}
@media (max-width: 48rem) {
    .backdrop {
        padding: 8px;
    }
}
</style>
