<script setup lang="ts">
/**
 * The building blocks, right above the stage they go on (Plan.md, Nächste
 * Schritte 11): as a row of plain buttons in the top bar they were lost.
 * Symbol and name, the grid next to them – it is about the stage, too.
 */
import type { BlockType } from '../model/schema';
import { useEditorStore } from './editor-store';
import Icon, { type IconName } from './Icon.vue';
import { BLOCK_LABELS } from './ops';
import { GRID_SIZES } from './snap';

const editor = useEditorStore();

const ICONS: Record<BlockType, IconName> = {
    text: 'text',
    image: 'image',
    shape: 'shape',
    clock: 'clock',
    'appointment-list': 'list',
    'next-appointment': 'calendar',
    'church-header': 'header',
    web: 'web',
    qr: 'qr',
    countdown: 'timer',
};
const palette = Object.entries(BLOCK_LABELS) as [BlockType, string][];
</script>

<template>
    <div class="block-palette">
        <div class="blocks" role="group" aria-label="Baustein einfügen">
            <button
                v-for="[type, label] in palette"
                :key="type"
                class="block"
                type="button"
                :title="`${label} einfügen`"
                :data-testid="`add-${type}`"
                :disabled="!editor.slide"
                @click="editor.addBlock(type)"
            >
                <Icon :name="ICONS[type]" :size="20" />
                <span>{{ label }}</span>
            </button>
        </div>
        <label class="grid-select" title="Blöcke rasten am Raster ein; mit gedrückter Alt-Taste frei platzieren">
            Raster
            <select
                :value="editor.gridSize"
                data-testid="grid-size"
                @change="editor.setGridSize(Number(($event.target as HTMLSelectElement).value))"
            >
                <option v-for="size in GRID_SIZES" :key="size" :value="size">{{ size ? `${size} px` : 'aus' }}</option>
            </select>
        </label>
    </div>
</template>

<style scoped>
.block-palette {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 6px 10px;
    border-bottom: 1px solid var(--d-divider);
    background: var(--d-surface);
}
.blocks {
    flex: 1;
    display: flex;
    gap: 4px;
    min-width: 0;
    overflow-x: auto;
}
.block {
    flex: none;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    min-width: 64px;
    padding: 6px 8px;
    border: 1px solid transparent;
    border-radius: var(--d-radius);
    background: none;
    color: var(--d-text);
    font: inherit;
    font-size: var(--d-size-sm);
    white-space: nowrap;
    cursor: pointer;
}
.block :deep(.d-icon) {
    color: var(--d-accent);
}
.block:hover:not(:disabled) {
    border-color: var(--d-accent-pale);
    background: var(--d-accent-pale);
}
.block:disabled {
    opacity: 0.5;
    cursor: default;
}
.grid-select {
    flex: none;
    display: flex;
    align-items: center;
    gap: 6px;
    color: var(--d-text-muted);
    font-size: var(--d-size-sm);
}
.grid-select select {
    width: auto;
}
/* Phone: the blocks get the whole width to swipe, the grid a line below. */
@media (max-width: 48rem) {
    .block-palette {
        flex-wrap: wrap;
        gap: 4px 12px;
    }
    .blocks {
        flex-basis: 100%;
    }
    .grid-select {
        margin-left: auto;
    }
}
</style>
