<script setup lang="ts">
/** The line block (Plan.md F1): colour, thickness and solid or dashed. All three go to the short menu. */
import { computed } from 'vue';
import { t } from '../../../i18n/designer';
import type { Block } from '../../../model/schema';
import ColorField from '../../ColorField.vue';
import InspectorSection from '../../InspectorSection.vue';
import { useEdit } from '../edit';
import NumberField from '../fields/NumberField.vue';
import SegmentField from '../fields/SegmentField.vue';
import { useBlockEdit } from '../use-block';

const props = defineProps<{ block: Extract<Block, { type: 'line' }> }>();
const { setBlock } = useBlockEdit(() => props.block);
const edit = useEdit();

const dashes = [
    { value: 'solid', label: t.inspector.lineSolid },
    { value: 'dashed', label: t.inspector.lineDashed },
];
const summary = computed(() => `${props.block.thickness} px`);

/** A line thicker than its frame makes the frame grow with it, so the stroke can be grabbed again. */
function setThickness(thickness: number): void {
    setBlock(thickness > props.block.height ? { thickness, height: thickness + 24 } : { thickness });
}
</script>

<template>
    <InspectorSection id="appearance" :title="t.inspector.appearance" :summary="summary">
        <ColorField quick :label="t.common.fill.solid" :model-value="block.color" @focus="edit.onFocus" @blur="edit.onBlur" @update:model-value="setBlock({ color: $event })" />
        <NumberField quick :model-value="block.thickness" :label="t.inspector.lineThickness" unit="px" :min="1" testid="line-thickness" @update:model-value="setThickness" />
        <SegmentField quick :model-value="block.dash ?? 'solid'" :options="dashes" :label="t.inspector.lineDash" testid="line-dash" @update:model-value="setBlock({ dash: $event })" />
    </InspectorSection>
</template>
