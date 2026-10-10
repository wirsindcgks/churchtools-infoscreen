<script setup lang="ts">
/** The shape block (Plan.md 79, B2): its fill, then the rounding of the corners. Both go to the short menu. */
import { t } from '../../../i18n/designer';
import type { Block } from '../../../model/schema';
import FillEditor from '../../FillEditor.vue';
import InspectorSection from '../../InspectorSection.vue';
import { useEdit } from '../edit';
import NumberField from '../fields/NumberField.vue';
import { useBlockEdit } from '../use-block';

const props = defineProps<{ block: Extract<Block, { type: 'shape' }> }>();
const { setBlock } = useBlockEdit(() => props.block);
const edit = useEdit();
</script>

<template>
    <FillEditor quick :model-value="block.fill" @focus="edit.onFocus" @blur="edit.onBlur" @update:model-value="setBlock({ fill: $event })" />
    <InspectorSection id="appearance" :title="t.inspector.appearance" :summary="`${block.cornerRadius ?? 0} px`">
        <NumberField quick :model-value="block.cornerRadius ?? 0" :label="t.inspector.cornerRadius" unit="px" :min="0" testid="shape-corners" @update:model-value="setBlock({ cornerRadius: $event })" />
    </InspectorSection>
</template>
