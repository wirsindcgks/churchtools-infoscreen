<script setup lang="ts">
/** The media library in the editor: choose a picture for a block or the background. */
import type { MediaDoc } from '../model/schema';
import MediaLibraryPanel from './MediaLibraryPanel.vue';

defineProps<{ screen: { slug: string; name: string }; selectedMediaId?: string }>();
const emit = defineEmits<{ choose: [MediaDoc]; close: [] }>();
</script>

<template>
    <div class="backdrop" role="dialog" aria-modal="true" aria-label="Mediathek" @click.self="emit('close')">
        <MediaLibraryPanel
            class="library"
            :target="screen"
            :selected-media-id="selectedMediaId"
            choosable
            @choose="emit('choose', $event)"
        >
            <template #title>
                <h2>Mediathek</h2>
                <span class="hint">Neue Bilder landen im Wiki-Bereich „Infoscreen", Seite <code>{{ screen.slug }}</code>.</span>
            </template>
            <template #actions>
                <button class="d-btn" type="button" @click="emit('close')">Schließen</button>
            </template>
        </MediaLibraryPanel>
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
    width: min(1100px, 100%);
    box-shadow: var(--d-shadow);
}
h2 {
    margin: 0;
    font-size: 1.15em;
}
.hint {
    color: var(--d-text-muted);
    font-size: var(--d-size-sm);
}
@media (max-width: 48rem) {
    .backdrop {
        padding: 8px;
    }
}
</style>
