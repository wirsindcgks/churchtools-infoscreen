<script setup lang="ts">
/**
 * Posts of ChurchTools groups (schema 1.11, Plan.md, Nächste Schritte 33).
 * `card` shows one post at a time, after the highlighted appointment
 * (NextAppointmentView.vue), styled after the post itself in ChurchTools –
 * avatar, group name, age, title, text, and its own image beside or above the
 * text like Instagram (Plan.md, "Nachgezogen am 2026-09-25") – paging through
 * the posts the way AppointmentListView.vue pages its rows, except every page
 * is exactly one post, so no height measuring is needed.
 * `list` reuses the card rows of AppointmentRow.vue: only whole rows show,
 * measured the same way, without turning pages.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { Block } from '../../model/schema';
import { postImageArea, postPictures, relativeAge } from '../../posts/display';
import { selectPosts } from '../../posts/normalize';
import { markdownBlocks, markdownText } from '../../ct/markdown';
import { themeOf, useStageContext } from '../context';
import { sizedImageUrl, textStyle } from '../format';
import { paginateByHeight, pageInterval, pageProgressEdge, pageProgressSegments, pageProgressShown, POST_SECONDS } from '../paging';
import CalendarBadge from './CalendarBadge.vue';
import MdInlines from './MdInlines.vue';
import PageProgress from './PageProgress.vue';
import DateTile from './DateTile.vue';
import { tp } from '../../i18n/player';

const props = defineProps<{ block: Extract<Block, { type: 'posts' }>; slideSeconds?: number }>();
const context = useStageContext();

const items = computed(() =>
    selectPosts(context.posts ?? [], {
        groupIds: props.block.groupIds,
        now: context.now,
        maxAgeDays: props.block.maxAgeDays,
        limit: props.block.limit,
    }),
);

// --- card: one post per page, mechanics like AppointmentListView's pages ---
const page = ref(0);
const current = computed(() => (items.value.length ? (items.value[page.value % items.value.length] ?? null) : null));

watch(
    () => items.value.length,
    (count) => {
        if (props.block.layout === 'card' && context.pages) context.pages[props.block.id] = count || 1;
    },
    { immediate: true },
);

let timer: ReturnType<typeof setInterval> | undefined;
/** Seconds one post shows while the posts turn, for the progress bar; 0 while they do not. */
const turnSeconds = ref(0);
/** The designer's stage turns nothing: the progress then stands at 40 % (Plan.md 109). */
const still = computed(() => context.paging === false);
function turnPages(): void {
    clearInterval(timer);
    page.value = 0;
    turnSeconds.value = 0;
    const count = items.value.length;
    if (props.block.layout !== 'card' || count < 2 || context.paging === false) return;
    turnSeconds.value = pageInterval(props.block.pageSeconds ?? POST_SECONDS, props.slideSeconds ?? 0, count);
    timer = setInterval(() => (page.value = (page.value + 1) % count), turnSeconds.value * 1000);
}
watch(
    [() => items.value.length, () => props.block.layout, () => props.block.pageSeconds, () => props.slideSeconds, () => context.paging],
    () => turnPages(),
);
onMounted(turnPages);
onBeforeUnmount(() => clearInterval(timer));

// Landscape: image left over the full height; portrait: image on top over the full width –
// like Instagram, not the theme's own image shape (Plan.md, "Nachgezogen am 2026-09-25").
const landscape = computed(() => props.block.width >= props.block.height);

/** What the head shows: the group, the name (when there is one) and the age; each follows its switch. */
const showName = computed(() => props.block.showAuthor && !!current.value?.author);
const showHead = computed(() => props.block.showGroup || showName.value || props.block.showDate);
/** Without head, title and text the picture fills the whole card (Plan.md 96). */
const textEmpty = computed(() => !showHead.value && !props.block.showTitle && !props.block.showText);

const MAX_IMAGE_SIDE = 1920;
const FOCUS_POSITION ={ center: '50% 50%', top: '50% 0%', bottom: '50% 100%', left: '0% 50%', right: '100% 50%' } as const;

/**
 * The post's picture in its area: capped at 60 % of the card in the cross direction, or the whole card without
 * text. `cover` crops – on the server at the centre, else the full picture is asked for and `object-position`
 * crops; `contain` shows all of the best fitting picture (Plan.md 96).
 */
const image = computed(() => {
    if (!props.block.showImage || !current.value) return null;
    const fit = props.block.imageFit;
    const focus = props.block.imageFocus;
    const full = textEmpty.value;
    const found = postImageArea(postPictures(current.value), props.block, { fit, full });
    if (!found) return null;
    const { picture, width, height } = found;
    // No side over 1920, like blockImageUrl in images.ts: a tall picture covering a wide card would ask for far more.
    const sized = (w: number, h: number, mode: 'crop' | 'max') => {
        const shrink = Math.min(1, MAX_IMAGE_SIDE / w, MAX_IMAGE_SIDE / h);
        return sizedImageUrl(picture.url, w * shrink, h * shrink, mode);
    };
    let url: string;
    if (fit === 'cover' && focus === 'center') {
        url = sized(width, height, 'crop');
    } else if (fit === 'contain') {
        url = sized(width, height, 'max');
    } else {
        // The short side of the picture covers the area; the long side stands over and is cut by `object-position`.
        const ratio = picture.ratio || width / height;
        url = ratio > width / height ? sized(height * ratio, height, 'max') : sized(width, width / ratio, 'max');
    }
    const size = full ? { width: '100%', height: '100%' } : landscape.value ? { width: `${width}px`, height: '100%' } : { width: '100%', height: `${height}px` };
    return { url, style: { ...size, objectFit: fit, objectPosition: FOCUS_POSITION[fit === 'cover' ? focus : 'center'] } };
});

/** The group avatar: a square crop of its picture, sized like the CSS box below (1.6em). */
const avatarSize = computed(() => 1.6 * props.block.style.fontSize);
const avatarImage = computed(() => {
    const url = current.value?.groupImageUrl;
    return url ? sizedImageUrl(url, avatarSize.value, avatarSize.value, 'crop') : null;
});
// A group without a colour takes the theme's accent (Plan.md, 27), like CalendarBadge and DateTile.
const avatarColor = computed(() => current.value?.color ?? themeOf(context).accent);

// --- list: whole rows only, measured like AppointmentListView ---
/** One track per part that shows, so a hidden part leaves no empty column; the badge always sits in the last one. */
const rowStyle = computed(() => {
    const tracks = [props.block.showDate && 'auto', (props.block.showTitle || props.block.showText || (props.block.showDate && props.block.showGroup)) && 'minmax(0, 1fr)', props.block.showGroup && 'auto'];
    return { gridTemplateColumns: tracks.filter(Boolean).join(' ') || '1fr' };
});
const measureList = ref<HTMLElement | null>(null);
const heights = ref<number[]>([]);
function measure(): void {
    const rows = measureList.value?.querySelectorAll<HTMLElement>(':scope > .row');
    heights.value = rows ? [...rows].map((row) => row.offsetHeight) : [];
}
const rows = computed(() => paginateByHeight(items.value, heights.value, props.block.height, 0)[0] ?? []);
watch(
    [
        () => props.block.style.fontFamily,
        () => props.block.style.fontSize,
        () => props.block.width,
        () => props.block.height,
        () => props.block.layout,
        () => props.block.showGroup,
        () => props.block.showTitle,
        () => props.block.showText,
        () => props.block.showDate,
        () => items.value.map((p) => p.id).join(),
    ],
    () => void nextTick(measure),
);
onMounted(() => {
    measure();
    void document.fonts?.ready.then(measure);
});
</script>

<template>
    <!-- List: rows like the card rows of the appointment list, only whole ones, no paging. -->
    <div v-if="block.layout === 'list'" class="posts-list" :style="textStyle(block.style)" data-testid="posts-list">
        <ul ref="measureList" class="rows measure" aria-hidden="true">
            <li v-for="p in items" :key="p.id" class="row" :style="rowStyle">
                <DateTile v-if="block.showDate" :start="p.publishedAt" :time-zone="context.timeZone" :color="p.color" />
                <span v-if="block.showTitle || block.showText" class="body">
                    <span v-if="block.showTitle" class="title">{{ p.title }}</span>
                    <span v-if="block.showText" class="summary">{{ markdownText(p.content, true) }}</span>
                </span>
                <CalendarBadge v-if="block.showGroup" class="row-badge" :name="p.groupName" :color="p.color" />
            </li>
        </ul>
        <ul class="rows">
            <li v-for="p in rows" :key="p.id" class="row" :style="rowStyle" data-testid="post-row">
                <DateTile v-if="block.showDate" :start="p.publishedAt" :time-zone="context.timeZone" :color="p.color" />
                <span v-if="block.showTitle || block.showText" class="body">
                    <span v-if="block.showTitle" class="title">{{ p.title }}</span>
                    <span v-if="block.showText" class="summary">{{ markdownText(p.content, true) }}</span>
                </span>
                <CalendarBadge v-if="block.showGroup" class="row-badge" :name="p.groupName" :color="p.color" />
            </li>
            <li v-if="items.length === 0" class="empty" data-testid="posts-empty">{{ tp.posts.none }}</li>
        </ul>
    </div>

    <!-- Card: one post at a time, styled after the post itself in ChurchTools (avatar, name, age, title, text)
         with its own image beside or above the text, like Instagram. The card bleeds to its own rounded
         corners – `overflow: hidden` on `.hero` clips the image, not the image's own radius. -->
    <div
        v-else
        class="hero"
        :class="landscape ? 'hero--landscape' : 'hero--portrait'"
        :style="textStyle(block.style)"
        data-testid="posts-card"
    >
        <template v-if="current">
            <img v-if="image" class="hero-image" :src="image.url" :style="image.style" alt="" data-testid="post-image">
            <div v-if="!textEmpty" class="hero-text" :class="{ 'hero-text--plain': !image }">
                <div v-if="showHead" class="hero-head">
                    <div v-if="block.showGroup" class="hero-avatar" :style="{ background: avatarColor }">
                        <img v-if="avatarImage" :src="avatarImage" alt="">
                        <span v-else>{{ current.groupInitials }}</span>
                    </div>
                    <div class="hero-head-text">
                        <div v-if="block.showGroup" class="hero-group">{{ current.groupName }}</div>
                        <div v-if="showName || block.showDate" class="hero-age">
                            <template v-if="showName">
                                <span data-testid="post-author">{{ current.author }}</span><template v-if="block.showDate"> ·</template>
                            </template>
                            <template v-if="block.showDate"> {{ relativeAge(current.publishedAt, context.now, context.timeZone) }}</template>
                        </div>
                    </div>
                </div>
                <div v-if="block.showTitle" class="hero-title">{{ current.title }}</div>
                <div v-if="block.showText" class="hero-body">
                    <template v-for="(mdBlock, i) in markdownBlocks(current.content)" :key="i">
                        <ul v-if="mdBlock.kind === 'list' && !mdBlock.ordered" class="md-list">
                            <li v-for="(item, j) in mdBlock.items" :key="j"><MdInlines :parts="item" /></li>
                        </ul>
                        <ol v-else-if="mdBlock.kind === 'list'" class="md-list" :start="mdBlock.start">
                            <li v-for="(item, j) in mdBlock.items" :key="j"><MdInlines :parts="item" /></li>
                        </ol>
                        <blockquote v-else-if="mdBlock.kind === 'quote'" class="paragraph md-quote">
                            <MdInlines :parts="mdBlock.inlines" />
                        </blockquote>
                        <div v-else :class="['paragraph', { 'md-heading': mdBlock.kind === 'heading' }]">
                            <MdInlines :parts="mdBlock.inlines" />
                        </div>
                    </template>
                </div>
            </div>
        </template>
        <div v-else class="hero-text hero-subtitle" data-testid="posts-empty">{{ tp.posts.none }}</div>
        <PageProgress v-if="(turnSeconds || (still && block.layout === 'card' && items.length > 1)) && pageProgressShown(block, context)" :key="page" :seconds="turnSeconds" :held="still" :segments="pageProgressSegments(block)" :size="block.style.fontSize * 0.165" :inset="block.style.fontSize * 0.8" :edge="pageProgressEdge(block)" :number="(page % items.length) + 1" :total="items.length" />
    </div>
</template>

<style scoped>
/* Card: the post itself in ChurchTools, not the old date-tile/badge/meta-row layout. */
.hero {
    position: relative;
    display: flex;
    box-sizing: border-box;
    width: 100%;
    height: 100%;
    overflow: hidden;
    border-radius: var(--isd-radius, 0.4em);
    background: var(--isd-card, color-mix(in srgb, currentColor 7%, transparent));
}
.hero--landscape {
    flex-direction: row;
}
.hero--portrait {
    flex-direction: column;
}
.hero-image {
    flex: none;
}
/* The text column carries its own inset; the image bleeds to the card's edges (Plan.md, "Nachgezogen…"). */
.hero-text {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 0.5em;
    min-width: 0;
    min-height: 0;
    padding: 0.8em;
}
.hero-head {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    gap: 0.5em;
}
/* The group's picture, cropped square, or its initials on the group's colour – as in ChurchTools itself. */
.hero-avatar {
    display: flex;
    flex: none;
    align-items: center;
    justify-content: center;
    width: 1.6em;
    height: 1.6em;
    overflow: hidden;
    border-radius: var(--isd-radius, 0.3em);
}
.hero-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}
.hero-avatar span {
    font-size: 0.65em;
    font-weight: 700;
    color: #fff;
}
.hero-head-text {
    display: grid;
    justify-items: start;
    gap: 0.1em;
    min-width: 0;
}
.hero-group {
    font-size: 0.62em;
    font-weight: 700;
}
.hero-age {
    font-size: 0.5em;
    opacity: 0.75;
}
.hero-title {
    display: -webkit-box;
    flex-shrink: 0;
    overflow: hidden;
    font-size: 1.1em;
    font-weight: 700;
    line-height: 1.15;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 3;
}
.hero-subtitle {
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.75em;
    opacity: 0.8;
}
/* The text takes what is left and fades out at the bottom instead of a fixed line count. */
.hero-body {
    flex: 1;
    min-height: 0;
    overflow: hidden;
    font-size: 0.72em;
    line-height: 1.4;
    opacity: 0.9;
    -webkit-mask-image: linear-gradient(to bottom, black 80%, transparent 100%);
    mask-image: linear-gradient(to bottom, black 80%, transparent 100%);
}
/* Without an image the text column stands alone and can afford to read larger. */
.hero-text--plain .hero-title {
    font-size: 1.3em;
}
.hero-text--plain .hero-body {
    font-size: 0.85em;
}
.paragraph {
    margin: 0 0 0.8em;
    white-space: pre-line;
}
.paragraph:last-child {
    margin-bottom: 0;
}
.md-heading {
    font-size: 1.15em;
    font-weight: 700;
}
.md-list {
    margin: 0 0 0.8em;
    padding-left: 1.4em;
    white-space: pre-line;
}
.md-quote {
    margin-left: 0;
    padding-left: 0.8em;
    border-left: 0.2em solid color-mix(in srgb, currentColor 40%, transparent);
    opacity: 0.85;
}

/* List, after AppointmentRow's .card rows. */
.posts-list {
    position: relative;
    width: 100%;
    height: 100%;
}
.rows {
    list-style: none;
    margin: 0;
    padding: 0;
    width: 100%;
}
.measure {
    position: absolute;
    top: 0;
    left: 0;
    visibility: hidden;
    pointer-events: none;
}
.row {
    display: grid;
    align-items: center;
    gap: 0.9em;
    padding: 0.55em 0;
    border-bottom: 1px solid color-mix(in srgb, currentColor 15%, transparent);
}
.body {
    display: grid;
    justify-items: start;
    gap: 0.15em;
    min-width: 0;
}
.title {
    max-width: 100%;
    overflow: hidden;
    font-weight: 700;
    line-height: 1.15;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.summary {
    max-width: 100%;
    overflow: hidden;
    font-size: 0.68em;
    text-overflow: ellipsis;
    white-space: nowrap;
    opacity: 0.8;
}
.row-badge {
    grid-column: -2 / -1;
    justify-self: end;
}
.empty {
    padding: 0.55em 0;
    opacity: 0.7;
}
</style>
