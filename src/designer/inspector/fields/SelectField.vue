<script setup lang="ts">
/**
 * A choice from a list, for more than four possibilities (Plan.md 79, B2); for two to four there are `SegmentField` and
 * `TileField`. The label stands above, because an option is often longer than the room beside a label; `inline` puts it left.
 */
import { useId } from 'vue';
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

/** The option's own value, number or string as it was given. */
function onChange(raw: string): void {
    const option = props.options.find((o) => String(o.value) === raw);
    if (option) emit('update:modelValue', option.value);
}
</script>

<template>
    <FieldRow :label="label" :for="id" :stacked="!inline" :quick="quick">
        <select :id="id" :value="modelValue" :disabled="disabled" :data-testid="testid" @change="onChange(($event.target as HTMLSelectElement).value)">
            <option v-for="option in options" :key="option.value" :value="option.value" :style="option.style">{{ option.label }}</option>
        </select>
        <template v-if="$slots.info" #info><slot name="info" /></template>
    </FieldRow>
</template>

<style scoped>
select {
    flex: 1;
}
</style>
