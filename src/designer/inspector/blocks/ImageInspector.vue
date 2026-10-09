<script setup lang="ts">
/** The image block (Plan.md 79, B2): the picture, then how it fits the box. Both go to the short menu. */
import { computed } from 'vue';
import { t } from '../../../i18n/designer';
import type { Block } from '../../../model/schema';
import InspectorSection from '../../InspectorSection.vue';
import { useInspectorContext } from '../context';
import MediaField from '../fields/MediaField.vue';
import SegmentField from '../fields/SegmentField.vue';
import { useBlockEdit } from '../use-block';

const props = defineProps<{ block: Extract<Block, { type: 'image' }> }>();
const { setBlock, mediaUrl } = useBlockEdit(() => props.block);
const context = useInspectorContext();

const fits = [
    { value: 'contain', label: t.inspector.fitContain },
    { value: 'cover', label: t.inspector.fitCover },
];
const preview = computed(() => mediaUrl(props.block.mediaId));
</script>

<template>
    <MediaField
        quick
        :filled="!!block.mediaId"
        :pick-label="t.inspector.pickImage"
        :swap-label="t.inspector.swapImage"
        :preview-url="preview"
        :caption="preview ? null : t.inspector.noImage"
        caption-muted
        testid="pick-image"
        @pick="context.pickImage('block')"
    />
    <InspectorSection id="appearance" :title="t.inspector.appearance" :summary="fits.find((f) => f.value === block.fit)?.label">
        <SegmentField quick :model-value="block.fit" :options="fits" :label="t.inspector.fit" testid="image-fit" @update:model-value="setBlock({ fit: $event })" />
    </InspectorSection>
</template>
