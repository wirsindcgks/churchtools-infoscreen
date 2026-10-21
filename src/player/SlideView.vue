<script setup lang="ts">
import { computed } from 'vue';
import { isVideo, type SlideDoc, type TemplateDoc } from '../model/schema';
import { expandTemplates } from '../model/templates';
import BlockView from './blocks/BlockView.vue';
import { imageSource, themeOf, useStageContext } from './context';
import { fillStyle } from './fill';
import { backgroundImageUrl } from './images';
import { themeVars } from './theme';

/** `hiddenBlockId`: see `BlockView` – only the editor sets it. `bare`: without the background – the editor lays this slide over another while it edits a template. */
const props = defineProps<{ slide: SlideDoc; width: number; height: number; hiddenBlockId?: string; bare?: boolean }>();
const context = useStageContext();
const NO_TEMPLATES: ReadonlyMap<string, TemplateDoc> = new Map();
const shown = computed(() => expandTemplates(props.slide, context.templates ?? NO_TEMPLATES));

const background = computed(() => {
    const bg = props.slide.background;
    if (bg.kind !== 'media') return fillStyle(bg);
    const media = context.media.get(bg.mediaId);
    return media && !isVideo(media)
        ? {
              backgroundImage: `url("${imageSource(context, backgroundImageUrl(media, props))}")`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
          }
        : { background: '#000' };
});
const look = computed(() => ({ ...(props.bare ? {} : background.value), ...themeVars(themeOf(context)) }));
</script>

<template>
    <div class="slide" :style="look">
        <BlockView
            v-for="block in shown.blocks"
            :key="block.id"
            :block="block"
            :slide-seconds="shown.durationSeconds"
            :hidden-block-id="hiddenBlockId"
        />
    </div>
</template>

<style scoped>
.slide {
    position: absolute;
    inset: 0;
    /*
     * Digits of equal width: a clock does not twitch when a minute turns, and times in a list line up.
     * Works where the font has tabular figures (or has only those); Oswald and Poppins have neither.
     */
    font-variant-numeric: tabular-nums;
    /* Layers inside blocks (gallery, page bar) stay inside the slide: whatever the stage lays over it stays on top (Plan.md 107). */
    isolation: isolate;
}
</style>
