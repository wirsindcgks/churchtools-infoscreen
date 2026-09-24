<script setup lang="ts">
import { computed } from 'vue';
import type { SlideDoc } from '../model/schema';
import BlockView from './blocks/BlockView.vue';
import { imageSource, useStageContext } from './context';
import { fillStyle } from './fill';
import { backgroundImageUrl } from './images';

const props = defineProps<{ slide: SlideDoc; width: number; height: number }>();
const context = useStageContext();

const background = computed(() => {
    const bg = props.slide.background;
    if (bg.kind !== 'media') return fillStyle(bg);
    const media = context.media.get(bg.mediaId);
    return media
        ? {
              backgroundImage: `url("${imageSource(context, backgroundImageUrl(media, props))}")`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
          }
        : { background: '#000' };
});
</script>

<template>
    <div class="slide" :style="background">
        <BlockView v-for="block in slide.blocks" :key="block.id" :block="block" />
    </div>
</template>

<style scoped>
.slide {
    position: absolute;
    inset: 0;
}
</style>
