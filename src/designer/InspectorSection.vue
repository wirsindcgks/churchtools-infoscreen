<script setup lang="ts">
/**
 * A foldable part of the inspector (Plan.md 47) on a native `<details>`: the title, and while it
 * is folded a short summary of what is set inside. Open or closed is remembered per section id,
 * so a section opened once stays open for the next block, too.
 */
import Icon from './Icon.vue';
import { sectionState } from './section-state';

defineProps<{ id: string; title: string; summary?: string }>();

function onToggle(id: string, event: Event): void {
    sectionState[id] = (event.target as HTMLDetailsElement).open;
}
</script>

<template>
    <details class="section" :open="!!sectionState[id]" :data-testid="`section-${id}`" @toggle="onToggle(id, $event)">
        <summary :data-testid="`section-${id}-toggle`">
            <Icon name="chevron-down" :size="14" class="chevron" />
            <span class="title">{{ title }}</span>
            <span v-if="!sectionState[id]" class="summary-text">
                <slot name="summary-extra" />
                <span v-if="summary" class="summary-line">{{ summary }}</span>
            </span>
        </summary>
        <div class="body">
            <slot />
        </div>
    </details>
</template>

<style scoped>
.section {
    min-width: 0;
    border-top: 1px solid var(--d-divider);
}
summary {
    display: flex;
    min-width: 0;
    align-items: center;
    gap: 6px;
    padding: 9px 0;
    list-style: none;
    cursor: pointer;
}
summary::-webkit-details-marker {
    display: none;
}
.chevron {
    color: var(--d-text-muted);
    transition: transform 0.15s;
}
.section:not([open]) .chevron {
    transform: rotate(-90deg);
}
.title {
    font-weight: 600;
}
.summary-text {
    display: flex;
    flex: 1;
    align-items: center;
    justify-content: flex-end;
    gap: 6px;
    min-width: 0;
    color: var(--d-text-muted);
    font-size: var(--d-size-sm);
}
.summary-line {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.body {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 10px;
    padding-bottom: 12px;
}
</style>
