<script setup lang="ts">
/** The text block (Plan.md 79, B2): the text itself, then the text level and the font. The short menu will take level, colour and alignment. */
import { t } from '../../../i18n/designer';
import type { Block } from '../../../model/schema';
import { computed } from 'vue';
import { levelOf, textLevels, type TextLevel } from '../../ops';
import SegmentField from '../fields/SegmentField.vue';
import TextField from '../fields/TextField.vue';
import FontSection from '../FontSection.vue';
import { useBlockEdit } from '../use-block';

const props = defineProps<{ block: Extract<Block, { type: 'text' }> }>();
const { editor, setBlock, setStyle } = useBlockEdit(() => props.block);

const levelOptions = [
    { value: 'heading', label: t.inspector.textLevels.heading },
    { value: 'subtitle', label: t.inspector.textLevels.subtitle },
    { value: 'body', label: t.inspector.textLevels.body },
];
/** The level that size and weight both fit, else none is chosen (Plan.md 79, C8). */
const level = computed(() => levelOf(props.block.style, editor.stage) ?? undefined);
/** Size and weight change together: one step in the history. */
function chooseLevel(value: string | number): void {
    setStyle(textLevels(editor.stage)[value as TextLevel]);
}
</script>

<template>
    <TextField multiline :rows="3" :model-value="block.text" :label="t.inspector.text" testid="text-input" @update:model-value="setBlock({ text: $event })" />
    <SegmentField :model-value="level" :options="levelOptions" :label="t.inspector.textLevel" testid="text-level" quick @update:model-value="chooseLevel" />
    <FontSection :block="block" align-quick />
</template>
