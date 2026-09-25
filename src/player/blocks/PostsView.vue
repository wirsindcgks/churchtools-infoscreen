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
import { imageAspect, relativeAge } from '../../posts/display';
import { selectPosts } from '../../posts/normalize';
import { postParagraphs, postSummary } from '../../posts/text';
import { themeOf, useStageContext } from '../context';
import { sizedImageUrl, textStyle } from '../format';
import { paginateByHeight, pageInterval, POST_SECONDS } from '../paging';
import CalendarBadge from './CalendarBadge.vue';
import DateTile from './DateTile.vue';

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
function turnPages(): void {
    clearInterval(timer);
    page.value = 0;
    const count = items.value.length;
    if (props.block.layout !== 'card' || count < 2 || context.paging === false) return;
    const seconds = pageInterval(props.block.pageSeconds ?? POST_SECONDS, props.slideSeconds ?? 0, count);
    timer = setInterval(() => (page.value = (page.value + 1) % count), seconds * 1000);
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

/** The post's own image, capped at 60 % of the card in the cross direction and cropped to fit. */
const image = computed(() => {
    const url = props.block.showImage ? current.value?.imageUrl : null;
    if (!url) return null;
    const aspect = imageAspect(current.value?.imageRatio ?? null);
    if (landscape.value) {
        const width = Math.min(props.block.height * aspect, props.block.width * 0.6);
        return { url: sizedImageUrl(url, width, props.block.height, 'crop'), style: { width: `${width}px`, height: '100%' } };
    }
    const height = Math.min(props.block.width / aspect, props.block.height * 0.6);
    return { url: sizedImageUrl(url, props.block.width, height, 'crop'), style: { width: '100%', height: `${height}px` } };
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
            <li v-for="p in items" :key="p.id" class="row">
                <DateTile :start="p.publishedAt" :time-zone="context.timeZone" :color="p.color" />
                <span class="body">
                    <span class="title">{{ p.title }}</span>
                    <span class="summary">{{ postSummary(p.content) }}</span>
                </span>
                <CalendarBadge class="row-badge" :name="p.groupName" :color="p.color" />
            </li>
        </ul>
        <ul class="rows">
            <li v-for="p in rows" :key="p.id" class="row" data-testid="post-row">
                <DateTile :start="p.publishedAt" :time-zone="context.timeZone" :color="p.color" />
                <span class="body">
                    <span class="title">{{ p.title }}</span>
                    <span class="summary">{{ postSummary(p.content) }}</span>
                </span>
                <CalendarBadge class="row-badge" :name="p.groupName" :color="p.color" />
            </li>
            <li v-if="items.length === 0" class="empty" data-testid="posts-empty">Keine aktuellen Beiträge</li>
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
            <div class="hero-text" :class="{ 'hero-text--plain': !image }">
                <div class="hero-head">
                    <div class="hero-avatar" :style="{ background: avatarColor }">
                        <img v-if="avatarImage" :src="avatarImage" alt="">
                        <span v-else>{{ current.groupInitials }}</span>
                    </div>
                    <div class="hero-head-text">
                        <div class="hero-group">{{ current.groupName }}</div>
                        <div class="hero-age">
                            <template v-if="block.showAuthor && current.author">
                                <span data-testid="post-author">{{ current.author }}</span> ·
                            </template>
                            {{ relativeAge(current.publishedAt, context.now, context.timeZone) }}
                        </div>
                    </div>
                </div>
                <div class="hero-title">{{ current.title }}</div>
                <div class="hero-body">
                    <div v-for="(paragraph, i) in postParagraphs(current.content)" :key="i" class="paragraph">
                        <template v-for="(inline, j) in paragraph" :key="j">
                            <strong v-if="inline.kind === 'strong'">{{ inline.text }}</strong>
                            <template v-else>{{ inline.text }}</template>
                        </template>
                    </div>
                </div>
            </div>
        </template>
        <div v-else class="hero-text hero-subtitle" data-testid="posts-empty">Keine aktuellen Beiträge</div>
    </div>
</template>

<style scoped>
/* Card: the post itself in ChurchTools, not the old date-tile/badge/meta-row layout. */
.hero {
    display: flex;
    box-sizing: border-box;
    width: 100%;
    height: 100%;
    overflow: hidden;
    border-radius: var(--isd-radius, 0.4em);
    background: rgba(255, 255, 255, 0.07);
}
.hero--landscape {
    flex-direction: row;
}
.hero--portrait {
    flex-direction: column;
}
.hero-image {
    flex: none;
    object-fit: cover;
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
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 0.9em;
    padding: 0.55em 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.15);
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
    justify-self: end;
}
.empty {
    padding: 0.55em 0;
    opacity: 0.7;
}
</style>
