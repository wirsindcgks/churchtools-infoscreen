<script setup lang="ts">
/**
 * A small (i) that unfolds an explanation below its row (Plan.md 47) – no popover, nothing floats over the stage.
 * The button belongs beside a label; the text (the slot) is `.hint`, placed by the parent under the row.
 */
import { ref } from 'vue';
import Icon from './Icon.vue';

const open = ref(false);
</script>

<template>
    <span class="info-hint">
        <button
            class="d-btn d-btn--icon info-btn"
            type="button"
            aria-label="Erklärung"
            title="Erklärung"
            :aria-expanded="open"
            @click="open = !open"
        >
            <Icon name="info" :size="14" />
        </button>
        <span v-if="open" class="hint" role="note"><slot /></span>
    </span>
</template>

<style scoped>
.info-hint {
    display: contents;
}
.info-btn {
    min-width: 0;
    padding: 0.15em;
    border-color: transparent;
    background: none;
    color: var(--d-text-muted);
}
.hint {
    flex-basis: 100%;
    margin: 0;
    color: var(--d-text-muted);
    font-size: var(--d-size-sm);
}
</style>
