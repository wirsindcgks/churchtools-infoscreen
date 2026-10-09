<script setup lang="ts">
/**
 * "+ Baustein" above the stage, on every width (Plan.md 47): the row of twelve
 * buttons is gone – it took two lines and was the busiest spot of the editor.
 * The button opens a sheet with all blocks, alphabetical, as symbol, name and a sentence, with a search above:
 * at the bottom below 48rem, a dialog in the middle above (Plan.md 44, M3; 45).
 * The grid choice sits beside it – it is about the stage, too.
 */
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { t } from '../i18n/designer';
import type { BlockType } from '../model/schema';
import { useEditorStore } from './editor-store';
import { searchBlocks } from './block-search';
import Icon from './Icon.vue';
import { BLOCK_ICONS, BLOCK_LABELS, PALETTE } from './ops';
import SearchField from './SearchField.vue';
import { KEYS, withKeys } from './shortcuts';
import { GRID_SIZES } from './snap';

const editor = useEditorStore();

/** The sheet's state lives in the store: the button on an empty slide opens it, too (Plan.md 79, A7). */
const sheetOpen = computed(() => editor.blockSheetOpen);

/** What "Einfügen" would put on the slide, named for the tooltip ("Text einfügen"). */
const pasteTitle = computed(() => {
    const [first] = editor.clipboard;
    if (!first) return '';
    return t.editor.palette.pasteWhat(BLOCK_LABELS[first.type]);
});

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
    editor.blockSheetOpen = true;
}
function closeSheet(): void {
    editor.blockSheetOpen = false;
}

/** The search of the sheet: empty on every opening; the field has the focus at a desktop, not on a phone (the keyboard would jump up). */
const query = ref('');
const sheet = ref<HTMLElement | null>(null);
const found = computed(() => new Set(searchBlocks(query.value)));
const shown = computed(() => PALETTE.filter(([type]) => found.value.has(type)));
watch(sheetOpen, async (open) => {
    if (open) {
        document.addEventListener('keydown', closeOnEscape);
        query.value = '';
        await nextTick();
        if (window.matchMedia('(min-width: 48.0625rem)').matches) sheet.value?.querySelector('input')?.focus();
    } else document.removeEventListener('keydown', closeOnEscape);
});
function addFromSheet(type: BlockType): void {
    editor.addBlock(type);
    closeSheet();
}
onBeforeUnmount(() => document.removeEventListener('keydown', closeOnEscape));
</script>

<template>
    <div class="block-palette">
        <button
            class="d-btn d-btn--create"
            type="button"
            :aria-label="t.editor.palette.addBlock"
            :disabled="!editor.slide"
            data-testid="add-block-menu"
            @click="openSheet"
        >
            <Icon name="plus" :size="16" /> <span class="create-label">{{ t.editor.palette.addBlock }}</span>
        </button>
        <button
            v-if="editor.clipboard.length"
            class="d-btn"
            type="button"
            :disabled="!editor.slide"
            :title="withKeys(pasteTitle, KEYS.paste)"
            data-testid="paste-block"
            @click="editor.pasteBlocks()"
        >
            {{ t.editor.palette.paste }}
        </button>
        <!-- The symbol alone was not recognised (Plan.md 47): the word stays beside it. -->
        <label class="grid-select" :title="t.editor.palette.guidesTitle">
            <Icon name="grid" :size="16" />
            <span class="grid-label">{{ t.editor.palette.guides }}</span>
            <select
                :aria-label="t.editor.palette.guides"
                :value="editor.gridSize"
                data-testid="grid-size"
                @change="editor.setGridSize(Number(($event.target as HTMLSelectElement).value))"
            >
                <option v-for="size in GRID_SIZES" :key="size" :value="size">{{ size ? `${size} px` : t.editor.palette.gridOff }}</option>
            </select>
        </label>

        <div
            v-if="sheetOpen"
            class="d-dialog-backdrop block-sheet-backdrop"
            role="dialog"
            aria-modal="true"
            :aria-label="t.editor.palette.insertBlock"
            data-testid="block-sheet"
            @click.self="closeSheet"
        >
            <div ref="sheet" class="block-sheet-panel">
                <header class="sheet-head">
                    <h2>{{ t.editor.palette.insertBlock }}</h2>
                    <button class="d-btn d-btn--icon" type="button" :aria-label="t.common.close" @click="closeSheet">
                        <Icon name="close" :size="16" />
                    </button>
                </header>
                <SearchField v-model="query" class="sheet-search" :placeholder="t.editor.palette.searchBlock" :label="t.editor.palette.searchBlock" testid="block-search" />
                <div class="sheet-grid">
                    <button
                        v-for="[type, label] in shown"
                        :key="type"
                        class="sheet-block"
                        type="button"
                        :disabled="!editor.slide"
                        :data-testid="`sheet-add-${type}`"
                        @click="addFromSheet(type)"
                    >
                        <Icon :name="BLOCK_ICONS[type]" :size="24" />
                        <span class="sheet-text">
                            <span class="sheet-name">{{ label }}</span>
                            <span class="sheet-description">{{ t.editor.palette.descriptions[type] }}</span>
                        </span>
                    </button>
                </div>
                <p v-if="!shown.length" class="sheet-empty" data-testid="block-search-empty">{{ t.editor.palette.noBlockFound }}</p>
            </div>
        </div>
    </div>
</template>

<style scoped>
.block-palette {
    display: flex;
    align-items: center;
    gap: var(--d-space-2);
    /* No surface of its own: the bar lies on the workspace above the stage (Plan.md 79, B3). */
    padding: var(--d-space-2) var(--d-space-3);
}
.grid-select {
    flex: none;
    display: flex;
    align-items: center;
    gap: 6px;
    margin-left: auto;
    color: var(--d-text-muted);
}
.grid-select :deep(.d-icon) {
    flex: none;
}
.grid-label {
    font-size: var(--d-size-sm);
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
.sheet-search {
    margin-bottom: 12px;
}
.sheet-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 8px;
}
.sheet-block {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 44px;
    padding: 8px 12px;
    border: 1px solid var(--d-divider);
    border-radius: var(--d-radius);
    background: var(--d-surface);
    color: var(--d-text);
    font: inherit;
    text-align: left;
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
    flex: none;
    color: var(--d-text-muted);
}
.sheet-text {
    display: flex;
    flex-direction: column;
    min-width: 0;
}
.sheet-name {
    font-weight: var(--d-weight-button);
}
.sheet-description {
    color: var(--d-text-muted);
    font-size: var(--d-size-sm);
    font-weight: var(--d-weight-normal);
}
.sheet-empty {
    margin: 16px 0 8px;
    color: var(--d-text-muted);
    text-align: center;
}
/* Above 48rem the bar is as tall as the heads of the columns beside it, so their rules meet (Plan.md 47). */
@media (min-width: 48.0625rem) {
    .block-palette {
        box-sizing: border-box;
        flex: none;
        height: var(--editor-head-h);
        padding: 0 var(--d-space-2);
    }
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
/* Above 48rem the sheet is a dialog in the middle (Plan.md 45), wide enough for two columns of blocks with a sentence each (Plan.md 79, C7). */
@media (min-width: 48.0625rem) {
    .block-sheet-panel {
        box-sizing: border-box;
        width: min(720px, 100%);
        max-height: calc(100vh - 32px);
        overflow-y: auto;
        padding: 16px;
        border-radius: var(--d-radius-lg);
        background: var(--d-surface);
        box-shadow: var(--d-shadow);
    }
    .sheet-grid {
        grid-template-columns: repeat(2, 1fr);
    }
}
</style>
