<script setup lang="ts" generic="T extends string">
/** Chips that narrow a page's items – one of them is on. */
defineProps<{ options: readonly { key: T; label: string }[]; label: string; testid: string }>();
const value = defineModel<T>({ required: true });
</script>

<template>
    <div class="chips" role="group" :aria-label="label">
        <button
            v-for="o in options"
            :key="o.key"
            type="button"
            class="chip"
            :class="{ on: value === o.key }"
            :aria-pressed="value === o.key"
            :data-testid="`${testid}-${o.key}`"
            @click="value = o.key"
        >
            {{ o.label }}
        </button>
    </div>
</template>

<style scoped>
.chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
}
.chip {
    min-height: 2em;
    padding: 0 0.8em;
    border: 1px solid var(--d-divider);
    border-radius: 999px;
    background: var(--d-surface);
    color: var(--d-text);
    font: inherit;
    font-size: var(--d-size-sm);
    cursor: pointer;
}
.chip.on {
    border-color: var(--d-accent);
    background: var(--d-accent-pale);
    color: var(--d-accent-strong);
    font-weight: 700;
}
</style>
