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
/** `hiddenBlockId`: the editor hides the drawn text of the block it is editing on the stage (Plan.md 79, C4); the player never sets it. */
const props = defineProps<{ block: Block; slideSeconds?: number; hiddenBlockId?: string }>();
const context = useStageContext();

/** Rotation and opacity only when set and not their neutral value, so a plain block carries neither (Plan.md F1). */
const frame = computed(() => ({
    left: `${props.block.x}px`,
    top: `${props.block.y}px`,
    width: `${props.block.width}px`,
    height: `${props.block.height}px`,
    ...(props.block.rotation ? { transform: `rotate(${props.block.rotation}deg)` } : {}),
    ...(props.block.opacity !== undefined && props.block.opacity !== 100 ? { opacity: `${props.block.opacity / 100}` } : {}),
    ...pictureFrame(props.block),
}));

/** Shadows of a picture, video or gallery (Plan.md F2), in stage pixels. */
const SHADOWS = { soft: '0 8px 24px rgba(0, 0, 0, 0.35)', strong: '0 16px 48px rgba(0, 0, 0, 0.6)' } as const;
/** Pixel filters of a picture's tone. */
const TONES = { darken: 'brightness(0.55)', lighten: 'brightness(1.35) contrast(0.7)', grayscale: 'grayscale(1)' } as const;

/** Corners and shadow belong to the frame only when the picture fills it: otherwise the frame is not the picture. */
function pictureFrame(block: Block): Record<string, string> {
    if (block.type !== 'image' && block.type !== 'video' && block.type !== 'slideshow') return {};
    // A gallery fills unless told otherwise; picture and video show whole.
    if ((block.fit ?? (block.type === 'slideshow' ? 'cover' : 'contain')) !== 'cover') return {};
    return {
        ...(block.cornerRadius ? { borderRadius: `${block.cornerRadius}px` } : {}),
        ...(block.shadow && block.shadow !== 'none' ? { boxShadow: SHADOWS[block.shadow] } : {}),
    };
}

/** What a crop does to the picture: its place as in `object-position`, enlarged about the same point. */
const imageStyle = computed(() => {
    if (props.block.type !== 'image') return {};
    const { fit, crop, tone } = props.block;
    return {
        objectFit: fit,
        ...(fit === 'cover' && crop ? { objectPosition: `${crop.x}% ${crop.y}%`, transform: `scale(${crop.zoom})`, transformOrigin: `${crop.x}% ${crop.y}%` } : {}),
        ...(tone && tone !== 'none' ? { filter: TONES[tone] } : {}),
    };
});

/** An ellipse ignores the corners; an edge lies inside the shape, so it follows the rounding and keeps the fill in place. */
const shapeStyle = computed(() => {
    if (props.block.type !== 'shape') return {};
    const { border } = props.block;
    return {
        ...fillStyle(props.block.fill),
        borderRadius: props.block.shape === 'ellipse' ? '50%' : `${props.block.cornerRadius}px`,
        ...(border && border.width >= 1 ? { boxShadow: `inset 0 0 0 ${border.width}px ${border.color}` } : {}),
    };
});

/** A horizontal stroke in the middle of the frame; dashes are 3 × the thickness long with 2 × between them. */
const lineStyle = computed(() => {
    if (props.block.type !== 'line') return {};
    const { color, thickness, dash } = props.block;
    const height = Math.min(thickness, props.block.height);
    return dash === 'dashed'
        ? { height: `${height}px`, backgroundImage: `repeating-linear-gradient(to right, ${color} 0 ${3 * thickness}px, transparent ${3 * thickness}px ${5 * thickness}px)` }
        : { height: `${height}px`, background: color, borderRadius: `${height / 2}px` };
});

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
    <div class="block" :class="`block--${block.type}`" :style="frame" :data-block-id="block.id">
        <div v-if="block.type === 'text'" class="text" :style="textStyle(block.style)">
            <div class="text-inner" :style="[vertical, { visibility: hiddenBlockId === block.id ? 'hidden' : undefined }]" data-testid="text-inner">{{ block.text }}</div>
        </div>

        <div
            v-else-if="block.type === 'shape'"
            class="fill"
            :style="shapeStyle"
        />

        <div v-else-if="block.type === 'line'" class="line" :style="lineStyle" />

        <template v-else-if="block.type === 'image'">
            <img v-if="imageUrl" class="image" :src="imageUrl" :style="imageStyle" alt="">
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
.line {
    position: absolute;
    left: 0;
    right: 0;
    top: 50%;
    transform: translateY(-50%);
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
