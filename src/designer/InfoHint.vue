<script setup lang="ts">
/**
 * A small (i) that unfolds an explanation below its row (Plan.md 47) – no popover, nothing floats over the stage.
 * The button always sits at the end of its row (`margin-left: auto`); the text (the slot) is `.hint`, over the full
 * width below it. `HintRow` is the usual row around it. `part` splits the two for a parent that places them apart
 * (a section: the button in its title line, the text in its body) – it then owns `open`.
 */
import { t } from '../i18n/designer';
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
            :aria-label="t.common.explanation"
            :title="t.common.explanation"
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
/* In the accent colour, round and tinted: grey it read as part of the label and was overlooked. */
.info-btn {
    flex: none;
    align-self: center;
    width: 22px;
    min-width: 0;
    height: 22px;
    min-height: 0;
    margin-left: auto;
    padding: 0;
    border-color: color-mix(in oklab, var(--d-accent) 35%, transparent);
    border-radius: 50%;
    background: var(--d-accent-pale);
    color: var(--d-accent);
}
.info-btn:hover {
    border-color: var(--d-accent);
    background: var(--d-accent-pale);
}
.info-btn[aria-expanded='true'] {
    border-color: var(--d-accent);
    background: var(--d-accent);
    color: var(--d-accent-text);
}
.hint {
    flex-basis: 100%;
    margin: 0;
    color: var(--d-text-muted);
    font-size: var(--d-size-sm);
}
</style>
