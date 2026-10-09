<script setup lang="ts">
/**
 * Two to four possibilities side by side (Plan.md 79, B2): a group of radio buttons, each with a symbol or a short word.
 * A symbol alone carries its label as `aria-label` and `title`. `testid` stands on the group.
 */
import { computed, useId } from 'vue';
import Icon, { type IconName } from '../../Icon.vue';
import FieldRow from './FieldRow.vue';

export interface SegmentOption {
    value: string | number;
    label: string;
    icon?: IconName;
}

const props = defineProps<{ modelValue: string | number | undefined; options: readonly SegmentOption[]; label: string; testid?: string; stacked?: boolean; disabled?: boolean; quick?: boolean }>();
const emit = defineEmits<{ 'update:modelValue': [string | number] }>();
defineSlots<{ info?(): unknown }>();
const labelId = useId();

/**
 * Words need room: next to the label the control has about 150 px, and a word wants its 10 px of air on both sides (Plan.md
 * 79, B3). A segment of words that does not fit there stands under its label in the full width; symbols stay in the row.
 */
const CHAR_WIDTH = 7;
const FACE_PADDING = 20;
const ROW_ROOM = 150;
const stackedNow = computed(
    () =>
        props.stacked ||
        (!props.options.some((o) => o.icon) && props.options.reduce((sum, o) => sum + o.label.length * CHAR_WIDTH + FACE_PADDING, 0) > ROW_ROOM),
);
const name = useId();
</script>

<template>
    <FieldRow :label="label" :label-id="labelId" :stacked="stackedNow" :quick="quick">
        <div class="segment" role="radiogroup" :aria-labelledby="labelId" :data-testid="testid">
            <label v-for="option in options" :key="option.value" class="segment-option" :title="option.icon ? option.label : undefined">
                <input
                    type="radio"
                    :name="name"
                    :value="option.value"
                    :checked="option.value === modelValue"
                    :disabled="disabled"
                    :aria-label="option.icon ? option.label : undefined"
                    @change="emit('update:modelValue', option.value)"
                >
                <span class="segment-face">
                    <Icon v-if="option.icon" :name="option.icon" :size="16" />
                    <template v-else>{{ option.label }}</template>
                </span>
            </label>
        </div>
        <template v-if="$slots.info" #info><slot name="info" /></template>
    </FieldRow>
</template>

<style scoped>
.segment {
    display: grid;
    flex: 1;
    grid-auto-columns: minmax(0, 1fr);
    grid-auto-flow: column;
    min-width: 0;
    overflow: hidden;
    border: 1px solid var(--d-divider);
    border-radius: var(--d-radius);
    background: var(--d-surface);
}
.segment-option {
    position: relative;
    display: flex;
    min-width: 0;
}
.segment-option + .segment-option {
    border-left: 1px solid var(--d-divider);
}
.segment-option input {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    min-height: 0;
    margin: 0;
    padding: 0;
    border: 0;
    opacity: 0;
    cursor: pointer;
}
.segment-face {
    display: flex;
    flex: 1;
    align-items: center;
    justify-content: center;
    min-height: 2.3em;
    padding: 0 10px;
    overflow: hidden;
    color: var(--d-text);
    font-size: var(--d-size-sm);
    text-overflow: ellipsis;
    white-space: nowrap;
    pointer-events: none;
}
.segment-option:has(input:checked) .segment-face {
    background: var(--d-accent-pale);
    color: var(--d-accent-strong);
    font-weight: 600;
}
.segment-option:has(input:focus-visible) {
    outline: 2px solid var(--d-accent);
    outline-offset: -2px;
}
.segment-option:has(input:disabled) .segment-face {
    opacity: 0.5;
}
@media (pointer: coarse) {
    .segment-face {
        min-height: 40px;
    }
}
</style>
