<script setup lang="ts">
/**
 * One library video in a loop (schema 1.18, Plan.md, Nächste Schritte 52),
 * played from the download address of its file – not from the cache: the
 * device needs the network for it, and without it the block stays empty. It
 * starts from the beginning each time the slide comes up. With sound on, the
 * browser may refuse to start unmuted without a click; the video then runs
 * muted. Once the length is known the block reports it as seconds in
 * `context.pages`, where a list reports its pages, and the slide stays that
 * long – not rounded up, or the loop would show its first frames again before
 * the slide leaves. On the designer's stage (`paging` off) only a still shows.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { Block } from '../../model/schema';
import { useStageContext } from '../context';
import { videoSrc } from '../video';

const props = defineProps<{ block: Extract<Block, { type: 'video' }> }>();
const context = useStageContext();

const media = computed(() => (props.block.mediaId ? context.media.get(props.block.mediaId) : undefined));
const src = computed(() => videoSrc(media.value));
/**
 * An error: a calm placeholder instead. The next mount tries again, and so does a timer – a playlist of one
 * slide never mounts anew, and a `403` before the sign-in stands looks like any other error (G42).
 */
const failed = ref(false);
const RETRY_MS = 30_000;
let retry: ReturnType<typeof setTimeout> | undefined;
const video = ref<HTMLVideoElement | null>(null);
const playing = computed(() => context.paging !== false);
/** The preview never plays sound by itself; it offers a button instead. */
const silenced = computed(() => context.silent === true);
const muted = ref(!props.block.sound || silenced.value);

watch([() => props.block.sound, silenced], () => (muted.value = !props.block.sound || silenced.value));
// Sound switched on while the video runs – e.g. the fresh state after the cached one: start again, so that a refused
// unmuted start falls back to muted. Only unmuting the running element would make the browser pause it (Plan.md 60).
watch(
    () => props.block.sound,
    () => void nextTick(start),
);
watch(src, () => {
    failed.value = false;
    void nextTick(start);
});

function report(): void {
    const element = video.value;
    if (!context.pages) return;
    if (playing.value && element && Number.isFinite(element.duration) && element.duration > 0) {
        context.pages[props.block.id] = Math.round(element.duration * 10) / 10;
    } else {
        delete context.pages[props.block.id];
    }
}

async function start(): Promise<void> {
    const element = video.value;
    if (!element) return;
    if (!playing.value) {
        element.pause();
        report();
        return;
    }
    element.currentTime = 0;
    try {
        await element.play();
    } catch (error) {
        // The browser keeps sound from a page nobody clicked: run on muted. Any other refusal is the error event's business.
        if (error instanceof DOMException && error.name === 'NotAllowedError' && !element.muted) {
            muted.value = true;
            element.muted = true;
            await element.play().catch(() => undefined);
        }
    }
    report();
}

function failedToLoad(): void {
    failed.value = true;
    if (context.pages) delete context.pages[props.block.id];
    clearTimeout(retry);
    retry = setTimeout(() => {
        failed.value = false;
        void nextTick(start);
    }, RETRY_MS);
}

function soundOn(): void {
    muted.value = false;
    if (video.value) video.value.muted = false;
}

onMounted(() => void start());
watch(playing, () => void start());
onBeforeUnmount(() => {
    clearTimeout(retry);
    if (context.pages) delete context.pages[props.block.id];
    video.value?.pause();
});
</script>

<template>
    <div v-if="src && !failed" class="video-block">
        <video
            ref="video"
            class="video"
            :src="src"
            :muted="muted || !playing"
            :preload="playing ? 'auto' : 'metadata'"
            :style="{ objectFit: block.fit }"
            loop
            playsinline
            data-testid="video"
            @loadedmetadata="report"
            @error="failedToLoad"
        />
        <button
            v-if="silenced && block.sound && muted && playing"
            class="sound-on"
            type="button"
            data-testid="video-sound-on"
            @click="soundOn"
        >
            Ton an
        </button>
    </div>
    <!-- A calm placeholder, never a broken player on a TV; the designer says what is missing. -->
    <div v-else class="placeholder" data-testid="video-placeholder">
        <template v-if="!block.mediaId && !playing">Video wählen</template>
    </div>
</template>

<style scoped>
.video-block,
.placeholder {
    position: relative;
    display: block;
    width: 100%;
    height: 100%;
}
.video {
    display: block;
    width: 100%;
    height: 100%;
    background: #000;
    /* Nobody clicks a TV, and in the designer the block stays draggable. */
    pointer-events: none;
}
.placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 32px;
    /* No colour of its own beyond the slide's: a middle grey shows on light and dark slides alike (Plan.md 48). */
    background: rgba(128, 128, 128, 0.15);
    opacity: 0.85;
}
.sound-on {
    position: absolute;
    right: 16px;
    bottom: 16px;
    padding: 8px 16px;
    border: 0;
    border-radius: 999px;
    background: rgb(15 23 42 / 0.82);
    color: #fff;
    font: 600 24px/1.2 system-ui, sans-serif;
    cursor: pointer;
}
</style>
