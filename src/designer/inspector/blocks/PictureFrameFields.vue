<script setup lang="ts">
/** Rounded corners and a shadow around a picture, video or gallery that fills its frame (Plan.md F2). 0 and "Ohne" take the field away. */
import { t } from '../../../i18n/designer';
import type { Block } from '../../../model/schema';
import NumberField from '../fields/NumberField.vue';
import SegmentField from '../fields/SegmentField.vue';
import { useBlockEdit } from '../use-block';

type PictureBlock = Extract<Block, { type: 'image' | 'video' | 'slideshow' }>;
const props = defineProps<{ block: PictureBlock }>();
const { setBlock } = useBlockEdit(() => props.block);

const shadows = [
    { value: 'none', label: t.inspector.shadowNone },
    { value: 'soft', label: t.inspector.shadowSoft },
    { value: 'strong', label: t.inspector.shadowStrong },
];
</script>

<template>
    <NumberField
        :model-value="block.cornerRadius ?? 0"
        :label="t.inspector.cornerRadius"
        unit="px"
        :min="0"
        :testid="`${block.type}-corners`"
        @update:model-value="setBlock({ cornerRadius: $event || undefined })"
    />
    <SegmentField
        :model-value="block.shadow ?? 'none'"
        :options="shadows"
        :label="t.inspector.shadow"
        :testid="`${block.type}-shadow`"
        @update:model-value="setBlock({ shadow: $event === 'none' ? undefined : $event })"
    />
</template>
