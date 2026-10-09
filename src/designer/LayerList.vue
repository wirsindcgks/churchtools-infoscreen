<script setup lang="ts">
/**
 * The blocks of the slide as a list, top layer first (Plan.md 79, D6): symbol, name, short content and a lock button.
 * A click chooses the block (Shift, Ctrl or ⌘ adds it; in the mode "Mehrere auswählen" every click does, and a box
 * stands before each row), a drag changes the layer. The mouse over a row outlines the block on the stage.
 * It stands in "Anordnen" and, while nothing is chosen, over the slide's settings.
 */
import { computed, onBeforeUnmount, ref } from 'vue';
import { t } from '../i18n/designer';
import { useEditorStore } from './editor-store';
import Icon from './Icon.vue';
import { useInspectorContext } from './inspector/context';
import { blockSummary, layerRows } from './layers';
import { BLOCK_ICONS, BLOCK_LABELS } from './ops';
import { vTip } from './tip';
import { useSortable } from './useSortable';

/** A row was chosen on its own (no added click, outside the mode): on a phone the sheet closes then. */
const emit = defineEmits<{ picked: [] }>();

const editor = useEditorStore();
const context = useInspectorContext();

/** The layers, top first; a drag reorders them in the slide (a locked block keeps its place). */
const rows = computed(() => layerRows(editor.slide?.blocks ?? []));
const layerList = ref<HTMLElement | null>(null);
const isLockedAt = (index: number): boolean => !!editor.slide?.blocks[index]?.locked;
// The list shows the array backwards: place d of the list is place n - 1 - d of the slide.
useSortable({
    container: layerList,
    fixed: (index) => isLockedAt(rows.value.length - 1 - index),
    onMove: (from, to) => editor.moveBlockLayer(rows.value.length - 1 - from, rows.value.length - 1 - to),
});

const lookup = {
    mediaName: (id: string) => editor.media.find((m) => m.id === id)?.name,
    calendarName: (id: number) => [...context.calendars, ...(context.hiddenCalendars ?? [])].find((c) => c.id === id)?.name,
    roomName: (id: number) => context.rooms?.find((r) => r.id === id)?.name,
};

function choose(id: string, event: MouseEvent): void {
    if (event.shiftKey || event.ctrlKey || event.metaKey || editor.multiSelect) {
        editor.toggleBlock(id);
        return;
    }
    editor.selectBlock(id);
    emit('picked');
}

/** Only the mouse hovers; a finger leaves no "over" behind. */
function hint(event: PointerEvent, id: string | null): void {
    if (event.pointerType === 'mouse') editor.hoveredBlockId = id;
}
onBeforeUnmount(() => {
    editor.hoveredBlockId = null;
});
</script>

<template>
    <ol ref="layerList" class="layer-list" data-testid="layer-list">
        <li
            v-for="row in rows"
            :key="row.block.id"
            class="layer-item"
            :class="{ 'layer-item--on': editor.isSelected(row.block.id) }"
            data-sort-item
            data-testid="layer-row"
            @click="choose(row.block.id, $event)"
            @pointerenter="hint($event, row.block.id)"
            @pointerleave="hint($event, null)"
        >
            <button
                class="layer-handle"
                type="button"
                data-sort-handle
                :disabled="!!row.block.locked"
                :aria-label="t.common.dragToSort"
                data-testid="layer-handle"
                @click.stop
            >
                <Icon name="grip" :size="14" />
            </button>
            <span
                v-if="editor.multiSelect"
                class="layer-check"
                :class="{ 'layer-check--on': editor.isSelected(row.block.id) }"
                role="checkbox"
                :aria-checked="editor.isSelected(row.block.id)"
                data-testid="layer-check"
            >
                <Icon v-if="editor.isSelected(row.block.id)" name="check" :size="12" />
            </span>
            <Icon :name="BLOCK_ICONS[row.block.type]" :size="16" class="layer-icon" />
            <span class="layer-name">{{ BLOCK_LABELS[row.block.type] }}</span>
            <span class="layer-sub">{{ blockSummary(row.block, lookup) }}</span>
            <button
                v-tip="row.block.locked ? t.quick.unlock : t.common.lock"
                class="layer-lock"
                :class="{ 'layer-lock--on': row.block.locked }"
                type="button"
                :aria-pressed="!!row.block.locked"
                :aria-label="row.block.locked ? t.quick.unlock : t.common.lock"
                data-testid="layer-lock"
                @click.stop="editor.setLocked([row.block.id], !row.block.locked)"
            >
                <Icon :name="row.block.locked ? 'lock' : 'unlock'" :size="14" />
            </button>
        </li>
    </ol>
</template>

<style scoped>
/* The layers, top first: symbol, name and short content; the chosen one on the accent's pale ground. */
.layer-list {
    display: grid;
    gap: 2px;
    margin: 0;
    padding: 0;
    list-style: none;
}
.layer-item {
    display: flex;
    align-items: center;
    gap: var(--d-space-2);
    min-width: 0;
    min-height: 36px;
    padding: 0 var(--d-space-2);
    border-radius: var(--d-radius);
    cursor: pointer;
    user-select: none;
    -webkit-touch-callout: none;
}
.layer-item:hover {
    background: var(--d-panel);
}
.layer-item--on,
.layer-item--on:hover {
    background: var(--d-accent-pale);
    color: var(--d-accent-strong);
}
.layer-handle {
    display: grid;
    flex: none;
    place-items: center;
    width: 20px;
    height: 32px;
    padding: 0;
    border: 0;
    background: none;
    color: var(--d-text-faint);
    cursor: grab;
}
.layer-handle:disabled {
    opacity: 0.3;
    cursor: default;
}
/* The box of the mode "Mehrere auswählen": no click of its own, the row toggles. */
.layer-check {
    display: grid;
    flex: none;
    place-items: center;
    width: 18px;
    height: 18px;
    border: 1px solid var(--d-edge);
    border-radius: 4px;
    background: var(--d-surface);
}
.layer-check--on {
    border-color: var(--d-accent);
    background: var(--d-accent);
    color: var(--d-accent-text);
}
.layer-icon {
    flex: none;
    color: var(--d-text-muted);
}
.layer-name {
    flex: none;
    font-size: var(--d-size-sm);
    font-weight: var(--d-weight-normal);
}
.layer-sub {
    min-width: 0;
    flex: 1;
    overflow: hidden;
    color: var(--d-text-muted);
    font-size: var(--d-size-sm);
    text-overflow: ellipsis;
    white-space: nowrap;
}
/* Pale like the handle while open, in the accent while locked. */
.layer-lock {
    display: grid;
    flex: none;
    place-items: center;
    width: 28px;
    height: 32px;
    padding: 0;
    border: 0;
    background: none;
    color: var(--d-text-faint);
    cursor: pointer;
}
.layer-lock--on {
    color: var(--d-accent-strong);
}
</style>
