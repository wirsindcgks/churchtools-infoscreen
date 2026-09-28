<script setup lang="ts">
import { computed } from 'vue';
import type { StageFit } from './stage';

const props = defineProps<{ width: number; height: number; fit: StageFit }>();

const style = computed(() => ({
    width: `${props.width}px`,
    height: `${props.height}px`,
    transform: `translate(${props.fit.offsetX}px, ${props.fit.offsetY}px) scale(${props.fit.scale})`,
}));
</script>

<template>
    <div class="stage" :style="style">
        <!-- `all: initial` drops the page's language as well, and on the stage itself it outranks `lang`:
             set it again inside, or German titles do not hyphenate. -->
        <div class="language" lang="de"><slot /></div>
    </div>
</template>

<style scoped>
/* The wall towards the host page: nothing inherited from ChurchTools reaches the blocks. */
.stage {
    all: initial;
    position: absolute;
    top: 0;
    left: 0;
    display: block;
    overflow: hidden;
    transform-origin: 0 0;
    background: #000;
    /* Only for messages on the stage; blocks set their own font. */
    font-family: 'ISD Lato', sans-serif;
    line-height: 1.2;
}
.language {
    display: contents;
}
</style>
