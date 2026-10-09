<script setup lang="ts">
/**
 * A list to reorder (Plan.md 79, B2, D7): per row the handle ⋮⋮, an optional thumbnail, the label and a small × to remove. The
 * rows are dragged by the handle or moved with the arrow keys on it (`useSortable`); `testid` names the parts
 * (`<testid>-list`, `-row`, `-handle`, `-name`, `-remove`; `rowTestid` renames the row). The `row` slot adds fields of
 * the item under its line, such as the way-finder of a room.
 */
import { ref } from 'vue';
import { t } from '../../../i18n/designer';
import Icon from '../../Icon.vue';
import { useSortable } from '../../useSortable';
import { useFieldVisible } from '../mode';

export interface SortItem {
    key: string | number;
    label: string;
    /** A thumbnail address; `undefined` draws none, `null` an empty placeholder (the medium is gone). */
    thumb?: string | null;
    dimmed?: boolean;
    /** The remove button stays off, e.g. for the last of a list that must not be empty. */
    keep?: boolean;
}

const props = defineProps<{ items: SortItem[]; removeLabel: string; testid: string; rowTestid?: string; quick?: boolean }>();
const emit = defineEmits<{ move: [from: number, to: number]; remove: [index: number] }>();
defineSlots<{ row?(props: { item: SortItem; index: number }): unknown }>();
const visible = useFieldVisible(() => props.quick);

const list = ref<HTMLElement | null>(null);
useSortable({ container: list, onMove: (from, to) => emit('move', from, to) });
</script>

<template>
    <ol v-if="visible" ref="list" class="sort-list" :data-testid="`${testid}-list`">
        <li v-for="(item, index) in items" :key="item.key" class="sort-row" data-sort-item :data-testid="rowTestid ?? `${testid}-row`">
            <div class="sort-head">
                <button class="sort-handle" type="button" data-sort-handle :aria-label="t.common.dragToSort" :data-testid="`${testid}-handle`">
                    <Icon name="grip" :size="16" />
                </button>
                <img v-if="item.thumb" :src="item.thumb" alt="">
                <span v-else-if="item.thumb === null" class="sort-missing" />
                <span class="sort-label" :class="{ 'sort-label--dimmed': item.dimmed }" :title="item.label" :data-testid="`${testid}-name`">{{ item.label }}</span>
                <button
                    class="sort-remove"
                    type="button"
                    :aria-label="removeLabel"
                    :disabled="item.keep"
                    :data-testid="`${testid}-remove`"
                    @click="$emit('remove', index)"
                >
                    <Icon name="close" :size="14" />
                </button>
            </div>
            <slot name="row" :item="item" :index="index" />
        </li>
    </ol>
</template>

<style scoped>
.sort-list {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    min-width: 0;
    gap: 6px;
    margin: 0;
    padding: 0;
    list-style: none;
}
.sort-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 6px;
    min-width: 0;
}
.sort-head {
    display: flex;
    align-items: center;
    gap: 6px;
}
/* The handle: quiet until pointed at; a finger finds it as wide as a button. */
.sort-handle,
.sort-remove {
    display: grid;
    flex: none;
    place-items: center;
    width: 28px;
    height: 32px;
    padding: 0;
    border: 0;
    border-radius: var(--d-radius);
    background: none;
    color: var(--d-text-muted);
    cursor: pointer;
}
.sort-handle {
    cursor: grab;
    touch-action: manipulation;
    user-select: none;
    -webkit-touch-callout: none;
}
.sort-handle:hover,
.sort-remove:hover:not(:disabled) {
    background: var(--d-panel);
    color: var(--d-text);
}
.sort-remove:disabled {
    opacity: 0.4;
    cursor: default;
}
@media (pointer: coarse) {
    .sort-handle,
    .sort-remove {
        width: 36px;
        height: 44px;
    }
}
.sort-row img,
.sort-missing {
    flex: none;
    width: 48px;
    height: 27px;
    border-radius: 3px;
    background: var(--d-panel);
    object-fit: cover;
}
.sort-label {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    font-size: var(--d-size-sm);
    text-overflow: ellipsis;
    white-space: nowrap;
}
.sort-label--dimmed {
    color: var(--d-text-muted);
}
</style>
