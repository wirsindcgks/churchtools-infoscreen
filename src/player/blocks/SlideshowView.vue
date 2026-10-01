<script setup lang="ts">
/**
 * Library images one after the other (schema 1.15, Plan.md, Nächste Schritte
 * 46). Only images that are on the stage's media list show; missing ones are
 * skipped. Two layers lie on top of each other; the next picture comes as a
 * fade, pushed in from the right, wiped in from the left, or at once. Besides, a picture can zoom slowly while
 * it stands (schema 1.19, `motion`): in, out, or alternately – with any transition; the layer keeps the motion of its
 * picture while it fades out. The transition moves the layer, the motion the picture inside it, so they never
 * overwrite each other. Only transform, opacity and clip-path move, which a weak device can draw on its own. The next picture is decoded before the switch, so that a weak
 * device shows a finished picture. The block reports how many pictures it
 * shows; the rotation keeps the slide until each has run once.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { isVideo, type Block } from '../../model/schema';
import { imageSource, useStageContext } from '../context';
import { blockImageUrl } from '../images';
import { pageInterval } from '../paging';
import { effectiveTransition, pictureMotion, type PictureMotion } from '../slideshow';

const props = defineProps<{ block: Extract<Block, { type: 'slideshow' }>; slideSeconds?: number }>();
const context = useStageContext();

/** Where the switch waits for a picture that does not decode: it goes on at the beat regardless. */
const DECODE_WAIT_MS = 1500;

const urls = computed(() =>
    props.block.mediaIds.flatMap((id) => {
        const media = context.media.get(id);
        return media && !isVideo(media) ? [imageSource(context, blockImageUrl(media, props.block))] : [];
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
/** What each layer's picture does while it stands; set when the picture is put in, kept while it fades out. */
const motions = ref<[PictureMotion, PictureMotion]>(['none', 'none']);
const layerEls = ref<HTMLElement[]>([]);
/** How many pictures have come since the start: `alternate` goes by it, not by the picture's place in the list –
 * with an odd number of pictures the last and the first would otherwise both zoom in. */
let turn = 0;

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
    turn += 1;
    motions.value[other] = pictureMotion(props.block, turn);
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
    turn = 0;
    motions.value = [pictureMotion(props.block, 0), 'none'];
    const count = urls.value.length;
    if (count < 2 || context.paging === false) return;
    prepareNext();
    const seconds = pageInterval(props.block.seconds ?? 6, props.slideSeconds ?? 0, count);
    timer = setInterval(() => void advance(), seconds * 1000);
}
watch(
    [urls, () => props.block.seconds, () => props.slideSeconds, () => context.paging, () => props.block.transition, () => props.block.motion],
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

const transition = computed(() => effectiveTransition(props.block));
const FADE_SECONDS = 0.8;
/** A lone picture, and the editor's stage, stand still. */
const moving = computed(() => urls.value.length > 1 && context.paging !== false);
/** The motion lasts as long as the picture stands, plus the time it is still fading out. */
const motionSeconds = computed(() => pageInterval(props.block.seconds ?? 6, props.slideSeconds ?? 0, urls.value.length) + FADE_SECONDS);
</script>

<template>
    <div v-if="urls.length" class="slideshow" :style="{ '--motion-seconds': `${motionSeconds}s` }" data-testid="slideshow">
        <div
            v-for="(url, i) in layers"
            :key="i"
            ref="layerEls"
            class="layer"
            :class="[`layer--${transition}`, `layer--motion-${motions[i]}`, `is-${states[i]}`, { 'layer--moving': moving }]"
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

/* Fade: opacity only. */
.layer--fade {
    opacity: 0;
    transition: opacity 0.8s ease;
}
.layer--fade.is-shown {
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
.layer--fade.is-staged {
    opacity: 0;
}

/* Motion: slowly between 1 and 1.08 while the picture stands, and while it fades out – on the picture, not the layer. */
.layer--moving.is-shown.layer--motion-in .picture,
.layer--moving.is-out.layer--motion-in .picture {
    animation: slideshow-zoom-in var(--motion-seconds) linear forwards;
}
.layer--moving.is-shown.layer--motion-out .picture,
.layer--moving.is-out.layer--motion-out .picture {
    animation: slideshow-zoom-out var(--motion-seconds) linear forwards;
}
@keyframes slideshow-zoom-in {
    from {
        transform: scale(1);
    }
    to {
        transform: scale(1.08);
    }
}
@keyframes slideshow-zoom-out {
    from {
        transform: scale(1.08);
    }
    to {
        transform: scale(1);
    }
}
</style>
