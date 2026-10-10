<script setup lang="ts">
/** The image block (Plan.md 79, B2; F2): the picture, then how it fits the box, its tone and, at "Füllen", crop, corners and shadow. Picture, fit and tone go to the short menu. */
import { computed } from 'vue';
import { t } from '../../../i18n/designer';
import type { Block } from '../../../model/schema';
import InspectorSection from '../../InspectorSection.vue';
import { useInspectorContext } from '../context';
import MediaField from '../fields/MediaField.vue';
import SegmentField from '../fields/SegmentField.vue';
import { useInspectorMode } from '../mode';
import { useBlockEdit } from '../use-block';
import { lookSummary } from './picture-look';
import PictureFrameFields from './PictureFrameFields.vue';

const props = defineProps<{ block: Extract<Block, { type: 'image' }> }>();
const { editor, setBlock, mediaUrl } = useBlockEdit(() => props.block);
const context = useInspectorContext();
/** Only fields stand in the short menu; the button belongs to the inspector. */
const mode = useInspectorMode();

const fits = [
    { value: 'contain', label: t.inspector.fitContain },
    { value: 'cover', label: t.inspector.fitCover },
];
const tones = [
    { value: 'none', label: t.inspector.toneNone },
    { value: 'darken', label: t.inspector.toneDarken },
    { value: 'lighten', label: t.inspector.toneLighten },
    { value: 'grayscale', label: t.inspector.toneGrayscale },
];
const preview = computed(() => mediaUrl(props.block.mediaId));
const summary = computed(() =>
    lookSummary(props.block, fits.find((f) => f.value === props.block.fit)?.label, tones.find((o) => o.value === props.block.tone && o.value !== 'none')?.label),
);
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
    <InspectorSection id="appearance" :title="t.inspector.appearance" :summary="summary">
        <SegmentField quick :model-value="block.fit" :options="fits" :label="t.inspector.fit" testid="image-fit" @update:model-value="setBlock({ fit: $event })" />
        <SegmentField quick :model-value="block.tone ?? 'none'" :options="tones" :label="t.inspector.tone" testid="image-tone" @update:model-value="setBlock({ tone: $event === 'none' ? undefined : $event })" />
        <template v-if="block.fit === 'cover'">
            <button v-if="mode === 'full' && block.mediaId && !block.locked" class="d-btn" type="button" data-testid="image-crop" @click="editor.startCrop(block.id)">
                {{ t.inspector.cropChoose }}
            </button>
            <PictureFrameFields :block="block" />
        </template>
    </InspectorSection>
</template>
