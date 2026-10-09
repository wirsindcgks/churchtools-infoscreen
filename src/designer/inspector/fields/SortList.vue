<script setup lang="ts">
/**
 * A list to reorder (Plan.md 79, B2): per row an optional thumbnail, the label, and the same three symbol buttons
 * everywhere – up, down, remove. The buttons are the way without dragging; `testid` names the parts
 * (`<testid>-list`, `-row`, `-up`, `-down`, `-remove`).
 */
import { t } from '../../../i18n/designer';
import Icon from '../../Icon.vue';
import { useFieldVisible } from '../mode';

export interface SortItem {
    key: string | number;
    label: string;
    /** A thumbnail address; `undefined` draws none, `null` an empty placeholder (the medium is gone). */
    thumb?: string | null;
    dimmed?: boolean;
}

const props = defineProps<{ items: SortItem[]; removeLabel: string; testid: string; quick?: boolean }>();
defineEmits<{ move: [from: number, to: number]; remove: [index: number] }>();
const visible = useFieldVisible(() => props.quick);
</script>

<template>
    <ol v-if="visible" class="sort-list" :data-testid="`${testid}-list`">
        <li v-for="(item, index) in items" :key="item.key" class="sort-row" :data-testid="`${testid}-row`">
            <img v-if="item.thumb" :src="item.thumb" alt="">
            <span v-else-if="item.thumb === null" class="sort-missing" />
            <span class="sort-label" :class="{ 'sort-label--dimmed': item.dimmed }" :title="item.label">{{ item.label }}</span>
            <button
                class="d-btn d-btn--icon"
                type="button"
                :aria-label="t.common.moveUp"
                :title="t.common.moveUp"
                :disabled="index === 0"
                :data-testid="`${testid}-up`"
                @click="$emit('move', index, index - 1)"
            >
                <Icon name="layer-forward" :size="14" />
            </button>
            <button
                class="d-btn d-btn--icon"
                type="button"
                :aria-label="t.common.moveDown"
                :title="t.common.moveDown"
                :disabled="index === items.length - 1"
                :data-testid="`${testid}-down`"
                @click="$emit('move', index, index + 1)"
            >
                <Icon name="layer-backward" :size="14" />
            </button>
            <button
                class="d-btn d-btn--icon"
                type="button"
                :aria-label="removeLabel"
                :title="removeLabel"
                :data-testid="`${testid}-remove`"
                @click="$emit('remove', index)"
            >
                <Icon name="close" :size="14" />
            </button>
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
    display: flex;
    align-items: center;
    gap: 6px;
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
