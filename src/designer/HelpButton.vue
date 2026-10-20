<script setup lang="ts">
/**
 * The round "?" that opens the help bar (Plan.md 98): at the end of an open section's title line and in the head of the
 * inspector. Outlined and turquoise – not the blue of the switches and buttons, and not grey, which was overlooked. A click
 * must not fold the `<details>` it may stand in. `shown`: the bar is open on the topic this button stands for. The button is as
 * wide as a symbol button, the 22 px circle in its middle, so every "?" stands on one line with the buttons above and below.
 */
defineProps<{ label: string; shown: boolean }>();
defineEmits<{ toggle: [] }>();
</script>

<template>
    <button class="help-btn" type="button" :aria-label="label" :aria-expanded="shown" @click.prevent.stop="$emit('toggle')"><span class="help-mark" aria-hidden="true">?</span></button>
</template>

<style scoped>
.help-btn {
    display: inline-grid;
    flex: none;
    place-items: center;
    align-self: center;
    box-sizing: border-box;
    width: var(--d-control-h);
    min-width: 0;
    height: 22px;
    min-height: 0;
    margin-left: auto;
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--d-help);
    font: inherit;
    font-size: var(--d-size-sm);
    font-weight: var(--d-weight-button);
    line-height: 1;
    cursor: pointer;
}
.help-mark {
    display: inline-grid;
    place-items: center;
    box-sizing: border-box;
    width: 22px;
    height: 22px;
    border: 1px solid color-mix(in oklab, var(--d-help) 55%, transparent);
    border-radius: 50%;
    transition: background-color var(--d-transition), border-color var(--d-transition);
}
.help-btn:hover .help-mark {
    border-color: var(--d-help);
    background: var(--d-help-pale);
}
.help-btn[aria-expanded='true'] .help-mark {
    border-color: var(--d-help);
    background: var(--d-help);
    color: var(--d-surface);
}
.help-btn:focus-visible {
    outline: none;
}
.help-btn:focus-visible .help-mark {
    outline: 2px solid var(--d-help);
    outline-offset: 1px;
}
@media (pointer: coarse) {
    /* The mark stays 22 px; the hit area reaches the 44 px of a finger (the width has it already). */
    .help-btn {
        position: relative;
    }
    .help-btn::after {
        content: '';
        position: absolute;
        inset: -11px -2px;
    }
}
</style>
