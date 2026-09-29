<script setup lang="ts">
/**
 * The building blocks, right above the stage they go on (Plan.md, Nächste
 * Schritte 11): as a row of plain buttons in the top bar they were lost.
 * Symbol and name, the grid next to them – it is about the stage, too. On a
 * phone six of eleven sat unseen to the right of the row (Plan.md 44, M3):
 * below 48rem a button "+ Baustein" opens a sheet with all of them as a grid.
 */
import { onBeforeUnmount, ref } from 'vue';
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
    posts: 'news',
    groups: 'people',
};
const palette = Object.entries(BLOCK_LABELS) as [BlockType, string][];

const sheetOpen = ref(false);

/**
 * Escape here closes the sheet only – not the editor's own key handler,
 * which would otherwise also deselect the block just inserted (Plan.md 44,
 * M3). `stopPropagation` keeps that from happening: a bubbling key event
 * reaches `document` before it reaches `window`, where the editor listens,
 * so stopping it here is enough and needs no coordination with the editor.
 */
function closeOnEscape(event: KeyboardEvent): void {
    if (event.key !== 'Escape') return;
    event.stopPropagation();
    closeSheet();
}
function openSheet(): void {
    sheetOpen.value = true;
    document.addEventListener('keydown', closeOnEscape);
}
function closeSheet(): void {
    sheetOpen.value = false;
    document.removeEventListener('keydown', closeOnEscape);
}
function addFromSheet(type: BlockType): void {
    editor.addBlock(type);
    closeSheet();
}
onBeforeUnmount(() => document.removeEventListener('keydown', closeOnEscape));
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
        <button
            class="d-btn add-block-btn"
            type="button"
            :disabled="!editor.slide"
            data-testid="add-block-menu"
            @click="openSheet"
        >
            <Icon name="plus" :size="16" /> Baustein
        </button>
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

        <div
            v-if="sheetOpen"
            class="d-dialog-backdrop block-sheet-backdrop"
            role="dialog"
            aria-modal="true"
            aria-label="Baustein einfügen"
            data-testid="block-sheet"
            @click.self="closeSheet"
        >
            <div class="block-sheet-panel">
                <header class="sheet-head">
                    <h2>Baustein einfügen</h2>
                    <button class="d-btn d-btn--icon" type="button" aria-label="Schließen" @click="closeSheet">
                        <Icon name="close" :size="16" />
                    </button>
                </header>
                <div class="sheet-grid">
                    <button
                        v-for="[type, label] in palette"
                        :key="type"
                        class="sheet-block"
                        type="button"
                        :disabled="!editor.slide"
                        :data-testid="`sheet-add-${type}`"
                        @click="addFromSheet(type)"
                    >
                        <Icon :name="ICONS[type]" :size="24" />
                        <span>{{ label }}</span>
                    </button>
                </div>
            </div>
        </div>
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
/* Ten blocks do not fit beside the grid on a laptop: a second row beats a block out of sight. */
.blocks {
    flex: 1;
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    min-width: 0;
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
.add-block-btn {
    display: none;
}
/* Phone and tablet: the row of blocks is gone (Plan.md 44, M3; 45) – a button opens a sheet with all of them instead. */
@media (max-width: 48rem), (min-width: 48.0625rem) and (max-width: 75rem) {
    .blocks {
        display: none;
    }
    .add-block-btn {
        display: inline-flex;
        flex: none;
    }
    .grid-select {
        margin-left: auto;
    }
}

.sheet-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
}
.sheet-head h2 {
    margin: 0;
    font-size: 1.1em;
}
.sheet-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
}
.sheet-block {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    min-height: 64px;
    padding: 8px;
    border: 1px solid var(--d-divider);
    border-radius: var(--d-radius);
    background: var(--d-surface);
    color: var(--d-text);
    font: inherit;
    font-size: var(--d-size-sm);
    cursor: pointer;
}
.sheet-block:hover:not(:disabled) {
    border-color: var(--d-accent-pale);
    background: var(--d-accent-pale);
}
.sheet-block:disabled {
    opacity: 0.5;
    cursor: default;
}
.sheet-block :deep(.d-icon) {
    color: var(--d-accent);
}
/* Below 48rem the backdrop of the "+ Baustein" sheet sits at the bottom, not centred. */
@media (max-width: 48rem) {
    .block-sheet-backdrop {
        align-items: end;
    }
    .block-sheet-panel {
        box-sizing: border-box;
        width: 100%;
        max-height: 80vh;
        overflow-y: auto;
        padding: 16px;
        border-radius: var(--d-radius-lg) var(--d-radius-lg) 0 0;
        background: var(--d-surface);
        box-shadow: var(--d-shadow);
    }
}
/* On a tablet the sheet is a dialog in the middle (Plan.md 45), sized like `.d-dialog`. */
@media (min-width: 48.0625rem) and (max-width: 75rem) {
    .block-sheet-panel {
        box-sizing: border-box;
        width: min(460px, 100%);
        max-height: calc(100vh - 32px);
        overflow-y: auto;
        padding: 16px;
        border-radius: var(--d-radius-lg);
        background: var(--d-surface);
        box-shadow: var(--d-shadow);
    }
}
</style>
