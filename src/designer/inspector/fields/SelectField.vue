<script setup lang="ts">
/**
 * A choice from a list, for more than four possibilities (Plan.md 79, B2); for two to four there are `SegmentField` and
 * `TileField`. The label stands above, because an option is often longer than the room beside a label; `inline` puts it left.
 */
import { computed, useId } from 'vue';
import Icon from '../../Icon.vue';
import FieldRow from './FieldRow.vue';

export interface SelectOption {
    value: string | number;
    label: string;
    /** Inline style of the option, for a font list in the fonts themselves. */
    style?: Record<string, string>;
}

const props = defineProps<{ modelValue: string | number | undefined; options: readonly SelectOption[]; label: string; testid?: string; inline?: boolean; disabled?: boolean; quick?: boolean }>();
const emit = defineEmits<{ 'update:modelValue': [string | number] }>();
defineSlots<{ info?(): unknown }>();
const id = useId();
/** What the chip of the short menu shows: the chosen option's text. */
const face = computed(() => props.options.find((o) => String(o.value) === String(props.modelValue))?.label);

/** The option's own value, number or string as it was given. */
function onChange(raw: string): void {
    const option = props.options.find((o) => String(o.value) === raw);
    if (option) emit('update:modelValue', option.value);
}
</script>

<template>
    <FieldRow :label="label" :for="id" :stacked="!inline" :quick="quick" :face="face">
        <span class="select-box">
            <select :id="id" :value="modelValue" :disabled="disabled" :data-testid="testid" @change="onChange(($event.target as HTMLSelectElement).value)">
                <option v-for="option in options" :key="option.value" :value="option.value" :style="option.style">{{ option.label }}</option>
            </select>
            <Icon name="chevron-down" :size="14" class="select-icon" />
        </span>
        <template v-if="$slots.info" #info><slot name="info" /></template>
    </FieldRow>
</template>

<style scoped>
/* Looks like the button of `FontField`: same height, border, radius and chevron; the native select stays for keyboard and touch. */
.select-box {
    position: relative;
    display: flex;
    flex: 1;
}
select {
    flex: 1;
    appearance: none;
    background-image: none;
    min-height: 2.3em;
    padding: 0.3em 32px 0.3em 12px;
    border: 1px solid var(--d-divider);
    border-radius: var(--d-radius);
    background: var(--d-surface);
    color: var(--d-text);
    font-size: var(--d-size);
    text-overflow: ellipsis;
    cursor: pointer;
}
select:disabled {
    cursor: default;
    opacity: 0.5;
}
.select-icon {
    position: absolute;
    top: 50%;
    right: 12px;
    transform: translateY(-50%);
    pointer-events: none;
}
</style>
