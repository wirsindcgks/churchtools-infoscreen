<script setup lang="ts">
/** The video block (Plan.md 52, 79 B2): the video, the sound, then how it fits the box. Video and sound go to the short menu. */
import { t } from '../../../i18n/designer';
import type { Block } from '../../../model/schema';
import HintRow from '../../HintRow.vue';
import InspectorSection from '../../InspectorSection.vue';
import { useInspectorContext } from '../context';
import MediaField from '../fields/MediaField.vue';
import SegmentField from '../fields/SegmentField.vue';
import ToggleField from '../fields/ToggleField.vue';
import { useBlockEdit } from '../use-block';
import { useInspectorMode } from '../mode';

const props = defineProps<{ block: Extract<Block, { type: 'video' }> }>();
/** Only fields stand in the short menu; a hint or a line of text belongs to the inspector. */
const mode = useInspectorMode();
const { setBlock, videoLabel } = useBlockEdit(() => props.block);
const context = useInspectorContext();

const fits = [
    { value: 'contain', label: t.inspector.fitContain },
    { value: 'cover', label: t.inspector.fitCover },
];

/** The line under the button: the video's name and length, or what is missing. */
function caption(): string {
    return videoLabel(props.block.mediaId) ?? (props.block.mediaId ? t.inspector.videoMissing : t.inspector.noVideo);
}
</script>

<template>
    <MediaField
        quick
        :filled="!!block.mediaId"
        :pick-label="t.inspector.pickVideo"
        :swap-label="t.inspector.swapVideo"
        :caption="caption()"
        :caption-muted="!videoLabel(block.mediaId)"
        :caption-testid="block.mediaId ? 'video-name' : undefined"
        testid="pick-video"
        @pick="context.pickImage('video')"
    />
    <ToggleField quick :model-value="block.sound ?? false" :label="t.inspector.sound" testid="video-sound" @update:model-value="setBlock({ sound: $event })">
        <template #info>{{ t.inspector.soundInfo }}</template>
    </ToggleField>
    <HintRow v-if="mode === 'full'" caption>
        <span>{{ t.inspector.runtime }}</span>
        <template #info>{{ t.inspector.videoRuntimeInfo }}</template>
    </HintRow>
    <InspectorSection id="appearance" :title="t.inspector.appearance" :summary="fits.find((f) => f.value === (block.fit ?? 'contain'))?.label">
        <SegmentField :model-value="block.fit ?? 'contain'" :options="fits" :label="t.inspector.fit" testid="video-fit" @update:model-value="setBlock({ fit: $event })" />
    </InspectorSection>
</template>
