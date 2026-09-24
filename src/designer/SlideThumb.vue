<script setup lang="ts">
/**
 * A slide as a picture of any size: the player's own components, scaled to
 * the box the layout gives it. The box keeps its aspect ratio (`aspect`); a
 * slide of another format sits letterboxed in it – so tiles of landscape and
 * portrait screens line up in one grid.
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import type { SlideDoc } from '../model/schema';
import SlideView from '../player/SlideView.vue';
import StageView from '../player/StageView.vue';
import { fitStage } from '../player/stage';

const props = withDefaults(
    defineProps<{ slide: SlideDoc | null; stage: { width: number; height: number }; aspect?: number }>(),
    { aspect: 16 / 9 },
);

const box = ref<HTMLElement | null>(null);
const size = ref({ width: 0, height: 0 });
const fit = computed(() => fitStage(size.value, props.stage));

let observer: ResizeObserver | null = null;
onMounted(() => {
    observer = new ResizeObserver(([entry]) => {
        if (entry) size.value = { width: entry.contentRect.width, height: entry.contentRect.height };
    });
    if (box.value) observer.observe(box.value);
});
onBeforeUnmount(() => observer?.disconnect());
</script>

<template>
    <div ref="box" class="slide-thumb" :style="{ aspectRatio: String(aspect) }">
        <StageView v-if="slide && size.width" :width="stage.width" :height="stage.height" :fit="fit">
            <SlideView :slide="slide" :width="stage.width" :height="stage.height" />
        </StageView>
        <span v-else-if="!slide" class="empty">Keine Slide</span>
    </div>
</template>

<style scoped>
.slide-thumb {
    position: relative;
    overflow: hidden;
    width: 100%;
    background: var(--d-text);
    /* Nothing inside a picture reacts to the pointer: the tile around it is the target. */
    pointer-events: none;
}
.empty {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    color: var(--d-text-faint);
    font-size: var(--d-size-sm);
}
</style>
