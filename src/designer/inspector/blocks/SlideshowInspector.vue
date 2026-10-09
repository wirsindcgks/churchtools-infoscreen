<script setup lang="ts">
/**
 * The gallery (Plan.md 46, 79 B2): library pictures one after the other – the pictures with their order, how long each
 * stays, then the transition, the motion and how a picture fits the box as the look. "Bilder hinzufügen" and the
 * transition go to the short menu.
 */
import { computed } from 'vue';
import { t } from '../../../i18n/designer';
import type { Block } from '../../../model/schema';
import { effectiveMotion, effectiveTransition } from '../../../player/slideshow';
import HintRow from '../../HintRow.vue';
import InspectorSection from '../../InspectorSection.vue';
import { useInspectorContext } from '../context';
import MediaField from '../fields/MediaField.vue';
import NumberField from '../fields/NumberField.vue';
import SegmentField from '../fields/SegmentField.vue';
import SortList, { type SortItem } from '../fields/SortList.vue';
import TileField from '../fields/TileField.vue';
import { MOTION_TILES, TRANSITION_TILES } from '../layouts';
import { move as moveItem } from '../../ops';
import { useBlockEdit } from '../use-block';

/** Most pictures a gallery holds – the schema's limit. */
const SLIDESHOW_MAX = 30;

const props = defineProps<{ block: Extract<Block, { type: 'slideshow' }> }>();
const { editor, setBlock, mediaUrl } = useBlockEdit(() => props.block);
const context = useInspectorContext();

const fits = [
    { value: 'contain', label: t.inspector.fitContain },
    { value: 'cover', label: t.inspector.fitCover },
];

/** An old block with the transition `zoom` is written as fade plus motion the moment either one changes. */
function setSlideshow(patch: { transition?: string; motion?: string }): void {
    setBlock({ transition: effectiveTransition(props.block), motion: effectiveMotion(props.block), ...patch });
}

const items = computed<SortItem[]>(() =>
    props.block.mediaIds.map((id, index) => {
        const name = editor.media.find((m) => m.id === id)?.name ?? null;
        return { key: `${id}-${index}`, label: name ?? t.inspector.imageMissing, thumb: mediaUrl(id), dimmed: !name };
    }),
);

function move(from: number, to: number): void {
    if (to < 0 || to >= props.block.mediaIds.length) return;
    setBlock({ mediaIds: moveItem(props.block.mediaIds, from, to) });
}

function remove(index: number): void {
    setBlock({ mediaIds: props.block.mediaIds.filter((_, i) => i !== index) });
}
</script>

<template>
    <!-- Plan.md, 46: library pictures one after the other. -->
    <MediaField
        quick
        :filled="false"
        :pick-label="t.inspector.addImages"
        :swap-label="t.inspector.addImages"
        :caption="t.common.countOf(block.mediaIds.length, SLIDESHOW_MAX)"
        caption-muted
        caption-testid="slideshow-count"
        :disabled="block.mediaIds.length >= SLIDESHOW_MAX"
        testid="pick-slideshow"
        @pick="context.pickImage('slideshow')"
    />
    <p v-if="!block.mediaIds.length" class="hint">{{ t.inspector.noImages }}</p>
    <InspectorSection v-else id="slideshow-images" :title="t.inspector.images" :summary="t.inspector.imageCount(block.mediaIds.length)">
        <SortList :items="items" :remove-label="t.inspector.removeImage" testid="slideshow" @move="move" @remove="remove" />
    </InspectorSection>
    <NumberField
        :model-value="block.seconds ?? 6"
        :label="t.inspector.secondsPerImage"
        :unit="t.inspector.unitSeconds"
        :min="3"
        :max="60"
        testid="slideshow-seconds"
        @update:model-value="setBlock({ seconds: $event })"
    />
    <InspectorSection id="appearance" :title="t.inspector.appearance" :summary="TRANSITION_TILES.find((o) => o.value === effectiveTransition(block))?.label">
        <TileField
            quick
            :model-value="effectiveTransition(block)"
            :options="TRANSITION_TILES"
            :label="t.inspector.transition"
            testid="slideshow-transition"
            @update:model-value="setSlideshow({ transition: String($event) })"
        />
        <TileField
            :model-value="effectiveMotion(block)"
            :options="MOTION_TILES"
            :label="t.inspector.motion"
            testid="slideshow-motion"
            @update:model-value="setSlideshow({ motion: String($event) })"
        />
        <SegmentField :model-value="block.fit ?? 'cover'" :options="fits" :label="t.inspector.fit" testid="slideshow-fit" @update:model-value="setBlock({ fit: $event })" />
    </InspectorSection>
    <HintRow caption>
        <span>{{ t.inspector.runtime }}</span>
        <template #info>{{ t.inspector.slideshowRuntimeInfo }}</template>
    </HintRow>
</template>

<style scoped>
.hint {
    margin: 0;
    color: var(--d-text-muted);
    font-size: var(--d-size-sm);
}
</style>
