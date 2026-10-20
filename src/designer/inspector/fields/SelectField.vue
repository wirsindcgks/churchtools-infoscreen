<script setup lang="ts">
/**
 * A choice from a list, for more than four possibilities (Plan.md 79, B2); for two to four there are `SegmentField` and
 * `TileField`. The label stands above, because an option is often longer than the room beside a label; `inline` puts it left.
 */
import { computed, useId } from 'vue';
import SelectMenu, { type SelectOption } from '../../SelectMenu.vue';
import { chipFace, type ChipFace } from './chip-face';
import FieldRow from './FieldRow.vue';

const props = defineProps<{ modelValue: string | number | undefined; options: readonly SelectOption[]; label: string; testid?: string; inline?: boolean; disabled?: boolean; quick?: boolean; face?: ChipFace }>();
const emit = defineEmits<{ 'update:modelValue': [string | number] }>();
defineSlots<{ info?(): unknown }>();
const labelId = useId();
/** What the chip of the short menu shows: the chosen option's text. */
const chosenFace = computed(() => chipFace(props.face, props.modelValue, props.options.find((o) => String(o.value) === String(props.modelValue))?.label));
</script>

<template>
    <FieldRow :label="label" :label-id="labelId" :stacked="!inline" :quick="quick" :face="chosenFace">
        <SelectMenu :model-value="modelValue" :options="options" :labelledby="labelId" :disabled="disabled" :testid="testid" @update:model-value="emit('update:modelValue', $event)" />
        <template v-if="$slots.info" #info><slot name="info" /></template>
    </FieldRow>
</template>
