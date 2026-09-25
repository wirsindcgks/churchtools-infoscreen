<script setup lang="ts">
/**
 * Posts of ChurchTools groups (schema 1.11, Plan.md, Nächste Schritte 33).
 * `card` shows one post at a time, after the highlighted appointment
 * (NextAppointmentView.vue): tile, badge, title, text, meta, image beside it –
 * paging through the posts the way AppointmentListView.vue pages its rows,
 * except every page is exactly one post, so no height measuring is needed.
 * `list` reuses the card rows of AppointmentRow.vue: only whole rows show,
 * measured the same way, without turning pages.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { Block } from '../../model/schema';
import { selectPosts } from '../../posts/normalize';
import { postParagraphs, postSummary } from '../../posts/text';
import { themeOf, useStageContext } from '../context';
import { formatDate, sizedImageUrl, textStyle } from '../format';
import { paginateByHeight, pageInterval, POST_SECONDS } from '../paging';
import { imageBox } from '../theme';
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

/** Room for the image: beside the text, inside the card's padding (0.8em), like NextAppointmentView. */
const room = computed(() => ({
    width: props.block.width * 0.42,
    height: props.block.height - 1.6 * props.block.style.fontSize,
}));
const box = computed(() => imageBox(themeOf(context).imageRatio, room.value.width, room.value.height));
const image = computed(() => {
    const url = props.block.showImage ? current.value?.imageUrl : null;
    if (!url) return null;
    return box.value
        ? sizedImageUrl(url, box.value.width, box.value.height, 'crop')
        : sizedImageUrl(url, room.value.width, props.block.height);
});
const imageStyle = computed(() =>
    box.value ? { width: `${box.value.width}px`, height: `${box.value.height}px`, flex: 'none', objectFit: 'cover' as const } : {},
);

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

    <!-- Card: one post at a time, after the highlighted appointment. -->
    <div v-else class="hero" :class="{ 'hero--image': image }" :style="textStyle(block.style)" data-testid="posts-card">
        <template v-if="current">
            <div class="hero-text">
                <div class="hero-head">
                    <DateTile :start="current.publishedAt" :time-zone="context.timeZone" :color="current.color" />
                    <div class="hero-titles">
                        <CalendarBadge :name="current.groupName" :color="current.color" />
                        <div class="hero-title">{{ current.title }}</div>
                    </div>
                </div>
                <div class="hero-body">
                    <p v-for="(paragraph, i) in postParagraphs(current.content)" :key="i" class="paragraph">
                        <template v-for="(inline, j) in paragraph" :key="j">
                            <strong v-if="inline.kind === 'strong'">{{ inline.text }}</strong>
                            <template v-else>{{ inline.text }}</template>
                        </template>
                    </p>
                </div>
                <div class="hero-meta">
                    <span>
                        <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5.5" width="16" height="15" rx="2" /><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" /></svg>
                        {{ formatDate(current.publishedAt, context.timeZone) }}
                    </span>
                    <span v-if="block.showAuthor && current.author" data-testid="post-author">
                        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.5" /><path d="M5 20c0-3.9 3.1-6 7-6s7 2.1 7 6" /></svg>
                        {{ current.author }}
                    </span>
                </div>
            </div>
            <img v-if="image" class="hero-image" :src="image" :style="imageStyle" alt="" data-testid="post-image">
        </template>
        <div v-else class="hero-text hero-subtitle" data-testid="posts-empty">Keine aktuellen Beiträge</div>
    </div>
</template>

<style scoped>
/* Card, after NextAppointmentView's .hero. */
.hero {
    display: flex;
    gap: 1.2em;
    align-items: stretch;
    box-sizing: border-box;
    width: 100%;
    height: 100%;
    padding: 0.8em;
    border-radius: var(--isd-radius, 0.4em);
    background: rgba(255, 255, 255, 0.07);
}
.hero-text {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 0.6em;
    min-width: 0;
    min-height: 0;
}
.hero-head {
    display: flex;
    flex-shrink: 0;
    align-items: flex-start;
    gap: 0.7em;
}
.hero-titles {
    display: grid;
    justify-items: start;
    gap: 0.25em;
    min-width: 0;
}
.hero-title {
    font-size: 1.5em;
    font-weight: 700;
    line-height: 1.1;
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
    font-size: 0.7em;
    line-height: 1.45;
    opacity: 0.9;
    -webkit-mask-image: linear-gradient(to bottom, black 80%, transparent 100%);
    mask-image: linear-gradient(to bottom, black 80%, transparent 100%);
}
.paragraph {
    margin: 0 0 0.8em;
    white-space: pre-line;
}
.paragraph:last-child {
    margin-bottom: 0;
}
.hero-meta {
    display: grid;
    flex-shrink: 0;
    justify-items: start;
    gap: 0.3em;
    font-size: 0.7em;
    font-weight: 600;
}
.hero-meta span {
    display: inline-flex;
    align-items: center;
    gap: 0.45em;
}
.hero-meta svg {
    flex: none;
    width: 1em;
    height: 1em;
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
}
.hero-image {
    flex: 0 0 42%;
    min-width: 0;
    max-height: 100%;
    align-self: center;
    object-fit: cover;
    border-radius: var(--isd-radius, 0.3em);
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
