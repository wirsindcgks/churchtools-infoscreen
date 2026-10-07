<script setup lang="ts">
/**
 * A small (i) that unfolds an explanation below its row (Plan.md 47) – no popover, nothing floats over the stage.
 * The button always sits at the end of its row (`margin-left: auto`); the text (the slot) is `.hint`, over the full
 * width below it. `HintRow` is the usual row around it. `part` splits the two for a parent that places them apart
 * (a section: the button in its title line, the text in its body) – it then owns `open`.
 */
import Icon from './Icon.vue';

defineProps<{ part?: 'button' | 'text' }>();
const open = defineModel<boolean>('open', { default: false });
</script>

<template>
    <span class="info-hint">
        <button
            v-if="part !== 'text'"
            class="d-btn d-btn--icon info-btn"
            type="button"
            aria-label="Erklärung"
            title="Erklärung"
            :aria-expanded="open"
            @click="open = !open"
        >
            <Icon name="info" :size="14" />
        </button>
        <span v-if="part !== 'button' && open" class="hint" role="note"><slot /></span>
    </span>
</template>

<style scoped>
.info-hint {
    display: contents;
}
.info-btn {
    min-width: 0;
    margin-left: auto;
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
