<script setup lang="ts">
import { computed } from 'vue';
import { isVideo, type Block } from '../../model/schema';
import { imageSource, useStageContext } from '../context';
import { fillStyle } from '../fill';
import { textStyle, verticalAlignOf, verticalStyle } from '../format';
import { blockImageUrl, headerLogoUrl } from '../images';
import { qrShape } from '../qr';
import { webFrame } from '../web';
import AppointmentListView from './AppointmentListView.vue';
import ClockView from './ClockView.vue';
import CountdownView from './CountdownView.vue';
import GroupsView from './GroupsView.vue';
import NextAppointmentView from './NextAppointmentView.vue';
import PostsView from './PostsView.vue';
import RoomsView from './RoomsView.vue';
import SlideshowView from './SlideshowView.vue';
import VideoView from './VideoView.vue';

/** `slideSeconds`: how long the slide shows – a paged list shares it out among its pages. */
const props = defineProps<{ block: Block; slideSeconds?: number }>();
const context = useStageContext();

const frame = computed(() => ({
    left: `${props.block.x}px`,
    top: `${props.block.y}px`,
    width: `${props.block.width}px`,
    height: `${props.block.height}px`,
}));

const logoUrl = computed(() => {
    if (props.block.type !== 'church-header') return null;
    const url = headerLogoUrl(props.block, context.media, context.churchLogo ?? null);
    return url ? imageSource(context, url) : null;
});

/** Logo and name sit side by side; the block's alignment places the pair. */
const JUSTIFY = { left: 'flex-start', center: 'center', right: 'flex-end' } as const;

/** Margins for the content of a block with a vertical choice (Plan.md 70). */
const vertical = computed(() => verticalStyle(verticalAlignOf(props.block) ?? 'top'));

const web = computed(() => (props.block.type === 'web' ? webFrame(props.block.url, window.location.origin) : null));
/** The page laid out at block size ÷ zoom and scaled back up: zoom 2 shows a phone page twice as large. */
const webStyle = computed(() => {
    const zoom = props.block.type === 'web' ? props.block.zoom : 1;
    return {
        width: `${props.block.width / zoom}px`,
        height: `${props.block.height / zoom}px`,
        transform: `scale(${zoom})`,
    };
});

const qr = computed(() => (props.block.type === 'qr' ? qrShape(props.block.data) : null));

const imageUrl = computed(() => {
    if (props.block.type !== 'image') return null;
    const media = context.media.get(props.block.mediaId);
    return media && !isVideo(media) ? imageSource(context, blockImageUrl(media, props.block)) : null;
});
</script>

<template>
    <div class="block" :class="`block--${block.type}`" :style="frame">
        <div v-if="block.type === 'text'" class="text" :style="textStyle(block.style)">
            <div class="text-inner" :style="vertical" data-testid="text-inner">{{ block.text }}</div>
        </div>

        <div
            v-else-if="block.type === 'shape'"
            class="fill"
            :style="{ ...fillStyle(block.fill), borderRadius: `${block.cornerRadius}px` }"
        />

        <template v-else-if="block.type === 'image'">
            <img v-if="imageUrl" class="image" :src="imageUrl" :style="{ objectFit: block.fit }" alt="">
            <!-- A calm placeholder, never a broken-image icon on a TV. -->
            <div v-else class="placeholder" />
        </template>

        <div
            v-else-if="block.type === 'church-header'"
            class="header"
            :style="{ ...textStyle(block.style), justifyContent: JUSTIFY[block.style.align] }"
        >
            <img v-if="logoUrl" class="logo" :class="{ 'logo--beside-name': block.showName }" :style="vertical" :src="logoUrl" alt="">
            <span v-if="block.showName" class="name" :style="vertical">{{ context.churchName }}</span>
        </div>

        <template v-else-if="block.type === 'web'">
            <!-- Nobody clicks a TV: the page only shows, and in the designer the block stays draggable. -->
            <iframe
                v-if="web"
                class="web"
                :src="web.src"
                :sandbox="web.sandbox"
                :style="webStyle"
                referrerpolicy="no-referrer"
                tabindex="-1"
                title=""
                data-testid="web-frame"
            />
            <div v-else class="placeholder" />
        </template>

        <svg
            v-else-if="block.type === 'qr' && qr"
            class="qr"
            :viewBox="`0 0 ${qr.size} ${qr.size}`"
            preserveAspectRatio="xMidYMid meet"
            shape-rendering="crispEdges"
            data-testid="qr-code"
        >
            <rect :width="qr.size" :height="qr.size" :fill="block.background" />
            <path :d="qr.path" :fill="block.color" />
        </svg>
        <div v-else-if="block.type === 'qr'" class="placeholder" />

        <ClockView v-else-if="block.type === 'clock'" :block="block" />
        <AppointmentListView v-else-if="block.type === 'appointment-list'" :block="block" :slide-seconds="slideSeconds" />
        <NextAppointmentView v-else-if="block.type === 'next-appointment'" :block="block" />
        <CountdownView v-else-if="block.type === 'countdown'" :block="block" />
        <PostsView v-else-if="block.type === 'posts'" :block="block" :slide-seconds="slideSeconds" />
        <GroupsView v-else-if="block.type === 'groups'" :block="block" :slide-seconds="slideSeconds" />
        <RoomsView v-else-if="block.type === 'rooms'" :block="block" :slide-seconds="slideSeconds" />
        <SlideshowView v-else-if="block.type === 'slideshow'" :block="block" :slide-seconds="slideSeconds" />
        <VideoView v-else-if="block.type === 'video'" :block="block" />
    </div>
</template>

<style scoped>
.block {
    position: absolute;
    overflow: hidden;
}
.text {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    overflow: hidden;
    white-space: pre-wrap;
    overflow-wrap: break-word;
}
/* The item keeps the full width, so the text's own alignment works; the margins place it. */
.text-inner {
    flex: none;
}
.header {
    display: flex;
    align-items: flex-start;
    gap: 0.5em;
    width: 100%;
    height: 100%;
}
.logo {
    flex: none;
    height: 100%;
    width: auto;
    max-width: 100%;
    object-fit: contain;
}
.logo--beside-name {
    max-width: 50%;
}
.name {
    min-width: 0;
    overflow-wrap: break-word;
}
.fill,
.image,
.placeholder {
    display: block;
    width: 100%;
    height: 100%;
}
.placeholder {
    /* Image and web page have no text colour of their own: a middle grey shows on light and dark slides alike (Plan.md 48). */
    background: rgba(128, 128, 128, 0.15);
}
.web {
    display: block;
    border: 0;
    transform-origin: 0 0;
    pointer-events: none;
    background: transparent;
}
.qr {
    display: block;
    width: 100%;
    height: 100%;
}
</style>
