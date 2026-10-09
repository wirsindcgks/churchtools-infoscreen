<script setup lang="ts">
/**
 * A medium of the library as one field (Plan.md 79, B2): the preview above, one button under it – "Bild wählen" while
 * empty, "Bild tauschen" once filled (the words come in as properties, so images, videos and logos share it). The
 * default slot takes further buttons, such as "Logo aus ChurchTools verwenden". In the short menu (Plan.md 79, C1) it is
 * only the button, a chip that opens the library.
 */
import { useInspectorMode } from '../mode';

defineProps<{
    filled: boolean;
    pickLabel: string;
    swapLabel: string;
    previewUrl?: string | null;
    /** A logo is shown whole on a checkerboard, so white and black logos are visible alike. */
    contain?: boolean;
    /** The line under the preview: the video's name, or what is missing. */
    caption?: string | null;
    captionMuted?: boolean;
    captionTestid?: string;
    testid?: string;
    disabled?: boolean;
    quick?: boolean;
}>();
defineEmits<{ pick: [] }>();
defineSlots<{ default?(): unknown }>();
const mode = useInspectorMode();
</script>

<template>
    <template v-if="mode === 'quick'">
        <button
            v-if="quick"
            class="quick-chip"
            type="button"
            :disabled="disabled"
            :data-testid="testid"
            data-quick-open
            data-quick-stop
            @click="$emit('pick')"
        >
            {{ filled ? swapLabel : pickLabel }}
        </button>
    </template>
    <div v-else class="media-field">
        <img v-if="previewUrl" :class="{ 'media-preview--contain': contain }" :src="previewUrl" alt="">
        <p v-if="caption" :class="captionMuted ? 'hint' : 'media-name'" :data-testid="captionTestid">{{ caption }}</p>
        <button class="d-btn media-pick" type="button" :disabled="disabled" :data-testid="testid" @click="$emit('pick')">
            {{ filled ? swapLabel : pickLabel }}
        </button>
        <slot />
    </div>
</template>

<style scoped>
.media-field {
    display: grid;
    gap: 6px;
}
img {
    width: 100%;
    aspect-ratio: 16 / 9;
    object-fit: cover;
    border-radius: var(--d-radius);
    background: var(--d-panel);
}
img.media-preview--contain {
    object-fit: contain;
    background: repeating-conic-gradient(var(--d-panel) 0 25%, var(--d-interactive) 0 50%) 0 0 / 16px 16px;
}
.media-name {
    margin: 0;
    overflow-wrap: anywhere;
    font-weight: var(--d-weight-normal);
}
.hint {
    margin: 0;
    color: var(--d-text-muted);
    font-size: var(--d-size-sm);
}
.media-pick {
    justify-content: center;
}
</style>
