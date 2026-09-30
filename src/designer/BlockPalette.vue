<script setup lang="ts">
/**
 * "+ Baustein" above the stage, on every width (Plan.md 47): the row of twelve
 * buttons is gone – it took two lines and was the busiest spot of the editor.
 * The button opens a sheet with all blocks, alphabetical, as symbol and name:
 * at the bottom below 48rem, a dialog in the middle above (Plan.md 44, M3; 45).
 * The grid choice sits beside it – it is about the stage, too.
 */
import { onBeforeUnmount, ref } from 'vue';
import type { BlockType } from '../model/schema';
import { useEditorStore } from './editor-store';
import Icon from './Icon.vue';
import { BLOCK_ICONS, PALETTE } from './ops';
import { GRID_SIZES } from './snap';

const editor = useEditorStore();

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
        <button
            class="d-btn"
            type="button"
            :disabled="!editor.slide"
            data-testid="add-block-menu"
            @click="openSheet"
        >
            <Icon name="plus" :size="16" /> Baustein
        </button>
        <label class="grid-select" title="Raster: Blöcke rasten ein; mit gedrückter Alt-Taste frei platzieren">
            <Icon name="grid" :size="16" />
            <select
                aria-label="Raster"
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
                        v-for="[type, label] in PALETTE"
                        :key="type"
                        class="sheet-block"
                        type="button"
                        :disabled="!editor.slide"
                        :data-testid="`sheet-add-${type}`"
                        @click="addFromSheet(type)"
                    >
                        <Icon :name="BLOCK_ICONS[type]" :size="24" />
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
.grid-select {
    flex: none;
    display: flex;
    align-items: center;
    gap: 6px;
    margin-left: auto;
    color: var(--d-text-muted);
}
.grid-select select {
    width: auto;
    font-size: var(--d-size-sm);
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
    color: var(--d-text-muted);
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
/* Above 48rem the sheet is a dialog in the middle (Plan.md 45), sized like `.d-dialog`; on a desktop with four columns (Plan.md 47). */
@media (min-width: 48.0625rem) {
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
@media (min-width: 75.0625rem) {
    .block-sheet-panel {
        width: min(600px, 100%);
    }
    .sheet-grid {
        grid-template-columns: repeat(4, 1fr);
    }
}
</style>
