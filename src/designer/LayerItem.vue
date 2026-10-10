<script setup lang="ts">
/**
 * One block as a row of the layer list (Plan.md 79, D6): handle, box in the mode "Mehrere auswählen", symbol, name,
 * short content and a lock button. The list and the open groups share it; the click goes up to the one that knows
 * what it chooses. The mouse over the row outlines the block on the stage.
 */
import { t } from '../i18n/designer';
import type { Block } from '../model/schema';
import { useEditorStore } from './editor-store';
import Icon from './Icon.vue';
import { blockSummary, type SummaryLookup } from './layers';
import { BLOCK_ICONS, BLOCK_LABELS } from './ops';
import { vTip } from './tip';

defineProps<{ block: Block; lookup: SummaryLookup; nested?: boolean }>();
const emit = defineEmits<{ choose: [event: MouseEvent] }>();

const editor = useEditorStore();

/** Only the mouse hovers; a finger leaves no "over" behind. */
function hint(event: PointerEvent, id: string | null): void {
    if (event.pointerType === 'mouse') editor.hoveredBlockId = id;
}
</script>

<template>
    <li
        class="layer-item"
        :class="{ 'layer-item--on': editor.isSelected(block.id), 'layer-item--nested': nested }"
        data-sort-item
        data-testid="layer-row"
        @click="emit('choose', $event)"
        @pointerenter="hint($event, block.id)"
        @pointerleave="hint($event, null)"
    >
        <button class="layer-handle" type="button" data-sort-handle :disabled="!!block.locked" :aria-label="t.common.dragToSort" data-testid="layer-handle" @click.stop>
            <Icon name="grip" :size="14" />
        </button>
        <span
            v-if="editor.multiSelect"
            class="layer-check"
            :class="{ 'layer-check--on': editor.isSelected(block.id) }"
            role="checkbox"
            :aria-checked="editor.isSelected(block.id)"
            data-testid="layer-check"
        >
            <Icon v-if="editor.isSelected(block.id)" name="check" :size="12" />
        </span>
        <Icon :name="BLOCK_ICONS[block.type]" :size="16" class="layer-icon" />
        <span class="layer-name">{{ BLOCK_LABELS[block.type] }}</span>
        <span class="layer-sub">{{ blockSummary(block, lookup) }}</span>
        <button
            v-tip="block.locked ? t.quick.unlock : t.common.lock"
            class="layer-lock"
            :class="{ 'layer-lock--on': block.locked }"
            type="button"
            :aria-pressed="!!block.locked"
            :aria-label="block.locked ? t.quick.unlock : t.common.lock"
            data-testid="layer-lock"
            @click.stop="editor.setLocked([block.id], !block.locked)"
        >
            <Icon :name="block.locked ? 'lock' : 'unlock'" :size="14" />
        </button>
    </li>
</template>

<style>
/* One row of the list – a block or a group: symbol, name and short content; the chosen one on the accent's pale ground. */
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
.layer-item--nested {
    margin-left: var(--d-space-3);
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
.layer-group-toggle {
    display: grid;
    flex: none;
    place-items: center;
    width: 20px;
    height: 32px;
    padding: 0;
    border: 0;
    background: none;
    color: var(--d-text-muted);
    cursor: pointer;
}
.layer-group-toggle--closed > svg {
    transform: rotate(-90deg);
}
</style>
