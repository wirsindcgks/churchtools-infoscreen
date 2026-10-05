<script setup lang="ts">
/**
 * A notice as a picture for its tile (Plan.md 69): the band on a 1920×1080 stage in the theme's colour,
 * as the notice dialog shows it – no slide behind it, the colour stands in for whatever the screen shows.
 * Always standing still: several bands running side by side distract, and a running one starts off the
 * right edge, so its text would hardly show; the tile names the mode in its facts.
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import type { Banner } from '../model/schema';
import BannerView from '../player/BannerView.vue';
import StageView from '../player/StageView.vue';
import { fitStage } from '../player/stage';

const props = defineProps<{ banner: Banner; background: string }>();
const still = computed<Banner>(() => ({ ...props.banner, mode: 'static' }));

const STAGE = { width: 1920, height: 1080 };
const box = ref<HTMLElement | null>(null);
const size = ref({ width: 0, height: 0 });
const fit = computed(() => fitStage(size.value, STAGE));

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
    <div ref="box" class="notice-thumb" data-testid="notice-preview">
        <StageView v-if="size.width" :width="STAGE.width" :height="STAGE.height" :fit="fit">
            <div class="stand-in" :style="{ background }" />
            <BannerView :banner="still" :stage-width="STAGE.width" />
        </StageView>
    </div>
</template>

<style scoped>
.notice-thumb {
    position: relative;
    overflow: hidden;
    width: 100%;
    aspect-ratio: 16 / 9;
    /* Nothing inside a picture reacts to the pointer. */
    pointer-events: none;
}
.stand-in {
    position: absolute;
    inset: 0;
}
</style>
