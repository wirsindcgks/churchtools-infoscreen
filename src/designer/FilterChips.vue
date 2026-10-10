<script setup lang="ts" generic="T extends string">
/**
 * A segment that narrows a page's items – one of its options is on (Plan.md 79, B3). An option may carry a
 * symbol and a number ("Quer 1"); the buttons wrap under each other on a narrow phone.
 */
import Icon, { type IconName } from './Icon.vue';

defineProps<{
    options: readonly { key: T; label: string; icon?: IconName; count?: number }[];
    label: string;
    testid: string;
}>();
const value = defineModel<T>({ required: true });
</script>

<template>
    <div class="segment" role="group" :aria-label="label">
        <button
            v-for="o in options"
            :key="o.key"
            type="button"
            class="option"
            :class="{ on: value === o.key }"
            :aria-pressed="value === o.key"
            :data-testid="`${testid}-${o.key}`"
            @click="value = o.key"
        >
            <Icon v-if="o.icon" :name="o.icon" :size="16" />
            {{ o.label }}
            <span v-if="o.count !== undefined" class="count">{{ o.count }}</span>
        </button>
    </div>
</template>

<style scoped>
.segment {
    display: inline-flex;
    flex-wrap: wrap;
    gap: 2px;
    padding: 3px;
    border-radius: var(--d-radius-lg);
    background: color-mix(in oklab, var(--d-panel) 88%, var(--d-text));
}
.option {
    display: inline-flex;
    align-items: center;
    gap: var(--d-space-2);
    box-sizing: border-box;
    min-height: calc(var(--d-control-h) - 6px);
    padding: 0 var(--d-space-4);
    border: 0;
    border-radius: var(--d-radius);
    background: transparent;
    color: var(--d-text-muted);
    font: inherit;
    font-weight: var(--d-weight-normal);
    cursor: pointer;
    transition: background-color var(--d-transition), color var(--d-transition);
}
.option:hover:not(.on) {
    color: var(--d-text);
}
.option.on {
    background: var(--d-surface);
    color: var(--d-text);
    box-shadow: 0 1px 2px #0f172a26;
}
.count {
    color: var(--d-text-faint);
    font-weight: 400;
}
</style>
