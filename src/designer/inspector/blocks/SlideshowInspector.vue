<script setup lang="ts">
/**
 * The gallery (Plan.md 46, 79 B2): library pictures one after the other – the pictures with their order, then as the look how long each
 * stays, the transition, the motion and how a picture fits the box. "Bilder hinzufügen" and the
 * transition go to the short menu.
 */
import { computed } from 'vue';
import { t } from '../../../i18n/designer';
import { th } from '../../../i18n/help';
import { useGeneralHelp } from '../../help/register';
import type { Block } from '../../../model/schema';
import { effectiveMotion, effectiveTransition } from '../../../player/slideshow';
import PageProgressHint from '../PageProgressHint.vue';
import PageProgressOptions from '../PageProgressOptions.vue';
import PageProgressToggle from '../PageProgressToggle.vue';
import InspectorSection from '../../InspectorSection.vue';
import { useInspectorContext } from '../context';
import MediaField from '../fields/MediaField.vue';
import NumberField from '../fields/NumberField.vue';
import SegmentField from '../fields/SegmentField.vue';
import SortList, { type SortItem } from '../fields/SortList.vue';
import TileField from '../fields/TileField.vue';
import { MOTION_TILES, TRANSITION_TILES } from '../layouts';
import { move as moveItem } from '../../ops';
import { lookSummary } from './picture-look';
import PictureFrameFields from './PictureFrameFields.vue';
import { useBlockEdit } from '../use-block';
import { useInspectorMode } from '../mode';

/** Most pictures a gallery holds – the schema's limit. */
const SLIDESHOW_MAX = 30;

const props = defineProps<{ block: Extract<Block, { type: 'slideshow' }> }>();
/** Only fields stand in the short menu; a hint or a line of text belongs to the inspector. */
const mode = useInspectorMode();
const { editor, setBlock, mediaUrl } = useBlockEdit(() => props.block);
const context = useInspectorContext();
useGeneralHelp(() => [th.general.slideshowAdd]);
const s = th.slideshow;
const help = { intro: s.intro, items: [s.seconds, th.pageProgress('das nächste Bild'), th.pageProgressStyle, th.pageProgressPlacement, s.transition, s.motion, s.fit, th.pictureFrame.corners, th.pictureFrame.shadow] };

const fits = [
    { value: 'contain', label: t.inspector.fitContain },
    { value: 'cover', label: t.inspector.fitCover },
];

/** "Ohne" alone does not say what is missing in the chip. */
function transitionFace(value: string | number | undefined): string {
    return value === 'none' ? t.inspector.transitionNoneFace : (TRANSITION_TILES.find((o) => o.value === value)?.label ?? '');
}

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
        :disabled="block.mediaIds.length >= SLIDESHOW_MAX"
        testid="pick-slideshow"
        @pick="context.pickImage('slideshow')"
    />
    <p v-if="mode === 'full' && !block.mediaIds.length" class="hint">{{ t.inspector.noImages }}</p>
    <InspectorSection v-else id="slideshow-images" :title="t.inspector.images" :summary="t.common.countOf(block.mediaIds.length, SLIDESHOW_MAX)" :help="s.images">
        <SortList :items="items" :remove-label="t.inspector.removeImage" testid="slideshow" @move="move" @remove="remove" />
    </InspectorSection>
    <InspectorSection
        id="appearance"
        :title="t.inspector.appearance"
        :summary="lookSummary(block, `${block.seconds ?? 6} ${t.inspector.unitSeconds}`, TRANSITION_TILES.find((o) => o.value === effectiveTransition(block))?.label)"
        :help="help"
    >
        <NumberField
            :model-value="block.seconds ?? 6"
            :label="t.inspector.secondsPerImage"
            :unit="t.inspector.unitSeconds"
            :min="3"
            :max="60"
            testid="slideshow-seconds"
            @update:model-value="setBlock({ seconds: $event })"
        />
        <PageProgressToggle :block="block" />
        <PageProgressOptions :block="block" />
        <PageProgressHint />
        <TileField
            quick
            :model-value="effectiveTransition(block)"
            :options="TRANSITION_TILES"
            :face="transitionFace"
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
        <PictureFrameFields v-if="(block.fit ?? 'cover') === 'cover'" :block="block" />
    </InspectorSection>
</template>

<style scoped>
.hint {
    margin: 0;
    color: var(--d-text-muted);
    font-size: var(--d-size-sm);
}
</style>
