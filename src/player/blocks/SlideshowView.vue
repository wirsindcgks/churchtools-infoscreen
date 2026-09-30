<script setup lang="ts">
/**
 * Library images one after the other (schema 1.15, Plan.md, Nächste Schritte
 * 46). Only images that are on the stage's media list show; missing ones are
 * skipped. Two layers lie on top of each other; the next picture comes as a
 * fade, pushed in from the right, wiped in from the left, faded in with a
 * slow zoom, or at once. Only transform, opacity and clip-path move, which a
 * weak device can draw on its own. The next picture is decoded before the switch, so that a weak
 * device shows a finished picture. The block reports how many pictures it
 * shows; the rotation keeps the slide until each has run once.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { Block } from '../../model/schema';
import { imageSource, useStageContext } from '../context';
import { blockImageUrl } from '../images';
import { pageInterval } from '../paging';

const props = defineProps<{ block: Extract<Block, { type: 'slideshow' }>; slideSeconds?: number }>();
const context = useStageContext();

/** Where the switch waits for a picture that does not decode: it goes on at the beat regardless. */
const DECODE_WAIT_MS = 1500;

const urls = computed(() =>
    props.block.mediaIds.flatMap((id) => {
        const media = context.media.get(id);
        return media ? [imageSource(context, blockImageUrl(media, props.block))] : [];
    }),
);

watch(
    () => Math.max(1, urls.value.length),
    (count) => {
        if (context.pages) context.pages[props.block.id] = count;
    },
    { immediate: true },
);

const index = ref(0);
const active = ref(0);
const layers = ref<[string, string]>(['', '']);
/** `staged`: ready to come in, out of sight; `shown`: in; `out`: on its way out or gone. */
type LayerState = 'staged' | 'shown' | 'out';
const states = ref<[LayerState, LayerState]>(['shown', 'staged']);
const layerEls = ref<HTMLElement[]>([]);

let timer: ReturnType<typeof setInterval> | undefined;
let held: HTMLImageElement | undefined;

/** Starts decoding a picture; resolves when done, on error, or after a wait. */
function preload(url: string): Promise<void> {
    if (held) held.removeAttribute('src');
    const image = new Image();
    image.src = url;
    held = image;
    const decoded = image.decode().catch(() => undefined);
    const patience = new Promise<void>((resolve) => setTimeout(resolve, DECODE_WAIT_MS));
    return Promise.race([decoded, patience]);
}

let next: Promise<void> = Promise.resolve();
function prepareNext(): void {
    const list = urls.value;
    if (list.length > 1) next = preload(list[(index.value + 1) % list.length]!);
}

async function advance(): Promise<void> {
    const list = urls.value;
    if (list.length < 2) return;
    await next;
    // The list may have changed while waiting.
    if (urls.value !== list) return;
    index.value = (index.value + 1) % list.length;
    const other = 1 - active.value;
    layers.value[other] = list[index.value]!;
    // Back to the start position without animating, then in.
    states.value[other] = 'staged';
    await nextTick();
    void layerEls.value[other]?.offsetWidth;
    if (urls.value !== list) return;
    states.value[other] = 'shown';
    states.value[active.value] = 'out';
    active.value = other;
    prepareNext();
}

function start(): void {
    clearInterval(timer);
    index.value = 0;
    active.value = 0;
    layers.value = [urls.value[0] ?? '', ''];
    states.value = ['shown', 'staged'];
    const count = urls.value.length;
    if (count < 2 || context.paging === false) return;
    prepareNext();
    const seconds = pageInterval(props.block.seconds ?? 6, props.slideSeconds ?? 0, count);
    timer = setInterval(() => void advance(), seconds * 1000);
}
watch(
    [urls, () => props.block.seconds, () => props.slideSeconds, () => context.paging, () => props.block.transition],
    (now, before) => {
        // Sizes and unrelated changes rebuild `urls` with the same addresses; the picture on show then stays.
        if (before && now[0].join('|') === before[0].join('|') && now.slice(1).every((v, i) => v === before[i + 1])) return;
        start();
    },
);
onMounted(start);
onBeforeUnmount(() => {
    clearInterval(timer);
    held?.removeAttribute('src');
});

const transition = computed(() => props.block.transition ?? 'fade');
const FADE_SECONDS = 0.8;
/** A lone picture, and the editor's stage, stand still. */
const moving = computed(() => urls.value.length > 1 && context.paging !== false);
/** The zoom lasts as long as the picture stands, plus the time it is still fading out. */
const zoomSeconds = computed(() => pageInterval(props.block.seconds ?? 6, props.slideSeconds ?? 0, urls.value.length) + FADE_SECONDS);
</script>

<template>
    <div v-if="urls.length" class="slideshow" :style="{ '--zoom-seconds': `${zoomSeconds}s` }" data-testid="slideshow">
        <div
            v-for="(url, i) in layers"
            :key="i"
            ref="layerEls"
            class="layer"
            :class="[`layer--${transition}`, `is-${states[i]}`, { 'layer--moving': moving }]"
            :data-active="active === i ? '' : undefined"
        >
            <img v-if="url" class="picture" :src="url" :style="{ objectFit: block.fit }" alt="">
        </div>
    </div>
    <!-- A calm placeholder, never a broken-image icon on a TV. -->
    <div v-else class="placeholder" />
</template>

<style scoped>
.slideshow,
.placeholder {
    position: relative;
    display: block;
    width: 100%;
    height: 100%;
}
.slideshow {
    overflow: hidden;
    /* Nobody clicks a TV, and in the designer the block stays draggable. */
    pointer-events: none;
}
.placeholder {
    background: rgba(128, 128, 128, 0.15);
}
.layer {
    position: absolute;
    inset: 0;
    z-index: 2;
    overflow: hidden;
}
.layer.is-out {
    z-index: 1;
}
.picture {
    display: block;
    width: 100%;
    height: 100%;
}

/* Fade, and the zoom's fade: opacity only. */
.layer--fade,
.layer--zoom {
    opacity: 0;
    transition: opacity 0.8s ease;
}
.layer--fade.is-shown,
.layer--zoom.is-shown {
    opacity: 1;
}
.layer--none {
    opacity: 0;
}
.layer--none.is-shown {
    opacity: 1;
}

/* Push: the new picture from the right, the old one out to the left. */
.layer--slide {
    transform: translateX(100%);
    transition: transform 0.8s ease;
}
.layer--slide.is-shown {
    transform: translateX(0);
}
.layer--slide.is-out {
    transform: translateX(-100%);
}

/* Wipe: the new picture on top, uncovered from the left; the old one stays under it. */
.layer--wipe {
    clip-path: inset(0 100% 0 0);
    transition: clip-path 0.8s ease;
}
.layer--wipe.is-shown,
.layer--wipe.is-out {
    clip-path: inset(0 0 0 0);
}

/* Ready to come in: at the start position, without animating there. */
.layer.is-staged {
    transition: none;
}
.layer--fade.is-staged,
.layer--zoom.is-staged {
    opacity: 0;
}

/* Zoom: slowly from 1 to 1.08 while the picture stands, and while it fades out. */
.layer--zoom.layer--moving.is-shown .picture,
.layer--zoom.layer--moving.is-out .picture {
    animation: slideshow-zoom var(--zoom-seconds) linear forwards;
}
@keyframes slideshow-zoom {
    from {
        transform: scale(1);
    }
    to {
        transform: scale(1.08);
    }
}
</style>
