<script setup lang="ts">
/**
 * One line of the inspector with an (i) at its end (Plan.md 47): a switch, a label or a legend in the default slot,
 * the explanation in `info`. Without `info` it is only the line. `caption` reads as a small caption, not as a switch.
 */
import InfoHint from './InfoHint.vue';

defineProps<{ caption?: boolean }>();
</script>

<template>
    <div class="hint-row" :class="{ 'hint-row--caption': caption }">
        <slot />
        <InfoHint v-if="$slots.info"><slot name="info" /></InfoHint>
    </div>
</template>

<style scoped>
.hint-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 6px;
    min-width: 0;
}
/* A field in the row takes the width, the (i) stands at its end. */
.hint-row > :slotted(.d-field) {
    flex: 1 1 0;
    min-width: 0;
}
.hint-row--caption {
    color: var(--d-text-muted);
    font-size: var(--d-size-sm);
}
</style>
