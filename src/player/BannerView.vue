<script setup lang="ts">
/**
 * The band over every slide of a playlist (schema 1.10, Plan.md 32): running
 * text or a standing notice. It lies on the stage beside the slides, so a
 * change of slide does not start it over. It runs by a CSS transform only –
 * the compositor moves one layer, as for the hourglass, which a Pi manages.
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { Banner } from '../model/schema';
import { passSeconds } from './banner';
import { textStyle } from './format';

const props = defineProps<{ banner: Banner; stageWidth: number }>();

const text = ref<HTMLElement | null>(null);
const textWidth = ref(0);
let observer: ResizeObserver | null = null;
function measure(): void {
    textWidth.value = text.value?.offsetWidth ?? 0;
}
onMounted(() => {
    // Fonts arrive late, and the text may change in the editor: the width follows.
    observer = new ResizeObserver(measure);
    if (text.value) observer.observe(text.value);
    measure();
});
onBeforeUnmount(() => observer?.disconnect());
// One element for as long as it runs; only a change between running and standing brings another.
watch(
    text,
    (el, old) => {
        if (old) observer?.unobserve(old);
        if (el) observer?.observe(el);
    },
    { flush: 'post' },
);

const scrolling = computed(() => props.banner.mode !== 'static');
const place = computed(() => ({
    [props.banner.position === 'top' ? 'top' : 'bottom']: '0',
    height: `${props.banner.height ?? 90}px`,
    background: props.banner.background,
    ...textStyle(props.banner.style),
}));
const run = computed(() => ({
    '--from': `${props.stageWidth}px`,
    '--to': `${-textWidth.value}px`,
    animationDuration: `${passSeconds(props.stageWidth, textWidth.value, props.banner.speed ?? 140)}s`,
}));
</script>

<template>
    <div class="banner" :class="{ 'banner--static': !scrolling }" :style="place" data-testid="banner">
        <span v-if="!scrolling" class="static">{{ banner.text }}</span>
        <!-- Hidden until measured: the pass is as long as the text. -->
        <div v-else class="track" :class="{ ready: textWidth > 0 }" :style="run">
            <span ref="text" class="text">{{ banner.text }}</span>
        </div>
    </div>
</template>

<style scoped>
.banner {
    position: absolute;
    left: 0;
    right: 0;
    z-index: 5;
    display: flex;
    align-items: center;
    overflow: hidden;
    line-height: 1.2;
}
.banner--static {
    padding: 0 0.6em;
}
.static {
    overflow: hidden;
    width: 100%;
    white-space: nowrap;
    text-overflow: ellipsis;
}
.track {
    position: absolute;
    left: 0;
    display: flex;
    will-change: transform;
    animation-name: isd-banner-pass;
    animation-timing-function: linear;
    animation-iteration-count: infinite;
}
.text {
    white-space: nowrap;
}
.track:not(.ready) {
    visibility: hidden;
    animation: none;
}
@keyframes isd-banner-pass {
    from {
        transform: translateX(var(--from));
    }
    to {
        transform: translateX(var(--to));
    }
}
</style>
