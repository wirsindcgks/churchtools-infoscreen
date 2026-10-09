<script setup lang="ts">
/**
 * A foldable part of the inspector (Plan.md 47) on a native `<details>`: the title, and while it
 * is folded a short summary of what is set inside. Open or closed is remembered per section id,
 * so a section opened once stays open for the next block, too (a section never touched is closed, unless `defaultOpen`). An `info` slot puts an (i) at the end of the
 * title line while the section is open; its text stands at the top of the body. In the short menu only the body shows.
 */
import { computed, inject, ref, unref } from 'vue';
import Icon from './Icon.vue';
import InfoHint from './InfoHint.vue';
import { INSPECTOR_MODE } from './inspector/mode';
import { sectionState } from './section-state';

const props = defineProps<{ id: string; title: string; summary?: string; defaultOpen?: boolean }>();
const slots = defineSlots<{ default(): unknown; 'summary-extra'?(): unknown; info?(): unknown }>();
const infoOpen = ref(false);
/** In the short menu (Plan.md 79, B2) a section has no head: its fields stand there on their own. */
const mode = inject(INSPECTOR_MODE, 'full');
/** What the viewer chose; a section never chosen follows `defaultOpen`. */
const isOpen = computed(() => sectionState[props.id] ?? !!props.defaultOpen);

function onToggle(id: string, event: Event): void {
    sectionState[id] = (event.target as HTMLDetailsElement).open;
}
</script>

<template>
    <slot v-if="unref(mode) === 'quick'" />
    <details v-else class="section" :open="isOpen" :data-testid="`section-${id}`" @toggle="onToggle(id, $event)">
        <summary :data-testid="`section-${id}-toggle`">
            <Icon name="chevron-down" :size="14" class="chevron" />
            <span class="title">{{ title }}</span>
            <span v-if="!isOpen" class="summary-text">
                <slot name="summary-extra" />
                <span v-if="summary" class="summary-line">{{ summary }}</span>
            </span>
            <InfoHint v-if="slots.info && isOpen" v-model:open="infoOpen" part="button" />
        </summary>
        <div class="body">
            <InfoHint v-if="slots.info" v-model:open="infoOpen" part="text"><slot name="info" /></InfoHint>
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
    gap: var(--d-space-2);
    padding: var(--d-space-3) 0;
    list-style: none;
    cursor: pointer;
}
summary::-webkit-details-marker {
    display: none;
}
.chevron {
    color: var(--d-text-muted);
    transition: transform var(--d-transition);
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
    gap: var(--d-space-3);
    padding-bottom: var(--d-space-3);
}
</style>
