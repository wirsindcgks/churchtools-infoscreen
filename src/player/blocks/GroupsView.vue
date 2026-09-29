<script setup lang="ts">
/**
 * Groups of a ChurchTools group homepage (schema 1.14, Plan.md, Nächste
 * Schritte 43): one group at a time as a card with a QR code to its public
 * page, or as many rows as fit. Paging works like PostsView's card and
 * AppointmentListView's list. The privacy rule lives in
 * `src/groups/normalize.ts` – this view reads nothing but `Group` fields.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { homepageGroups, placesText, selectGroups, whenText, type Group } from '../../groups/normalize';
import { IMAGE_RATIOS, type Block } from '../../model/schema';
import { imageSource, themeOf, useStageContext } from '../context';
import { sizedImageUrl, textStyle } from '../format';
import { GROUP_SECONDS, pageInterval, paginateByHeight } from '../paging';
import { qrShape } from '../qr';
import CalendarBadge from './CalendarBadge.vue';

const props = defineProps<{ block: Extract<Block, { type: 'groups' }>; slideSeconds?: number }>();
const context = useStageContext();

const items = computed(() =>
    selectGroups(homepageGroups(context.groupHomepages, props.block.parentGroupId), props.block.groupIds),
);

/** As calm as "Keine aktuellen Beiträge" – before a homepage is chosen, and after it turns out empty. */
const emptyMessage = computed(() => (props.block.parentGroupId === undefined ? 'Keine Gruppen-Homepage gewählt' : 'Keine Gruppen'));

/** A broken image on a TV looks worse than none – hide it, the layout keeps its space empty. */
function hideOnError(event: Event): void {
    (event.target as HTMLElement).style.display = 'none';
}

// --- card: one group per page, mechanics like PostsView's ---
const page = ref(0);
const current = computed(() => (items.value.length ? (items.value[page.value % items.value.length] ?? null) : null));

let cardTimer: ReturnType<typeof setInterval> | undefined;
function turnCardPages(): void {
    clearInterval(cardTimer);
    page.value = 0;
    const count = items.value.length;
    if (props.block.layout !== 'card' || count < 2 || context.paging === false) return;
    const seconds = pageInterval(props.block.pageSeconds ?? GROUP_SECONDS, props.slideSeconds ?? 0, count);
    cardTimer = setInterval(() => (page.value = (page.value + 1) % count), seconds * 1000);
}
watch(
    [() => items.value.length, () => props.block.layout, () => props.block.pageSeconds, () => props.slideSeconds, () => context.paging],
    () => turnCardPages(),
);
onMounted(turnCardPages);
onBeforeUnmount(() => clearInterval(cardTimer));

// Landscape: image left, text, QR right; portrait: image on top, text, QR bottom right.
const landscape = computed(() => props.block.width >= props.block.height);

/** The theme's image shape (Plan.md 27); 'free' has no ratio of its own, so 16:9 like a post without one. */
const imageRatio = computed(() => {
    const ratio = themeOf(context).imageRatio;
    return ratio === 'free' ? 16 / 9 : IMAGE_RATIOS[ratio];
});

const image = computed(() => {
    const url = props.block.show.image ? current.value?.imageUrl : null;
    if (!url) return null;
    if (landscape.value) {
        const width = Math.min(props.block.height * imageRatio.value, props.block.width * 0.4);
        return { url: imageSource(context, sizedImageUrl(url, width, props.block.height, 'crop')), style: { width: `${width}px`, height: '100%' } };
    }
    const height = Math.min(props.block.width / imageRatio.value, props.block.height * 0.4);
    return { url: imageSource(context, sizedImageUrl(url, props.block.width, height, 'crop')), style: { width: '100%', height: `${height}px` } };
});

/** The QR code's side, capped so it never crowds out the text (Plan.md 43). */
const qrSide = computed(() =>
    landscape.value
        ? Math.min(props.block.height * 0.45, props.block.width * 0.28)
        : Math.min(props.block.width * 0.3, props.block.height * 0.22),
);
const qr = computed(() => (props.block.show.qr && current.value ? qrShape(current.value.publicUrl) : null));

const barColor = computed(() => current.value?.color ?? themeOf(context).accent);
const whenLine = computed(() => (props.block.show.when && current.value ? whenText(current.value) : ''));
const targetCategoryLine = computed(() => {
    if (!current.value) return '';
    const parts: string[] = [];
    if (props.block.show.targetGroup && current.value.targetGroup) parts.push(current.value.targetGroup);
    if (props.block.show.category && current.value.category) parts.push(current.value.category);
    return parts.join(' · ');
});
const placesLine = computed(() => (props.block.show.places && current.value ? placesText(current.value) : null));

// --- list: as many rows as fit, page by page, after AppointmentListView ---
const heights = ref<number[]>([]);
const measureList = ref<HTMLElement | null>(null);
function measure(): void {
    const rows = measureList.value?.querySelectorAll<HTMLElement>(':scope > .row');
    heights.value = rows ? [...rows].map((row) => row.offsetHeight) : [];
}
/** The page bar at the bottom, like AppointmentListView's. */
const reserve = computed(() => props.block.style.fontSize * 0.9);
const listPages = computed(() => paginateByHeight(items.value, heights.value, props.block.height, reserve.value));
const listPage = ref(0);
const shownRows = computed(() => listPages.value[listPage.value % listPages.value.length] ?? []);

// Tell the rotation how many pages there are – of the layout shown, also right after switching it.
const pageCount = computed(() => (props.block.layout === 'card' ? items.value.length || 1 : listPages.value.length));
watch(
    pageCount,
    (count) => {
        if (context.pages) context.pages[props.block.id] = count;
    },
    { immediate: true },
);

let listTimer: ReturnType<typeof setInterval> | undefined;
const turnSeconds = ref(0);
function turnListPages(): void {
    clearInterval(listTimer);
    listPage.value = 0;
    turnSeconds.value = 0;
    const count = listPages.value.length;
    if (props.block.layout !== 'list' || count < 2 || context.paging === false) return;
    turnSeconds.value = pageInterval(props.block.pageSeconds ?? GROUP_SECONDS, props.slideSeconds ?? 0, count);
    listTimer = setInterval(() => (listPage.value = (listPage.value + 1) % count), turnSeconds.value * 1000);
}
watch(
    [() => listPages.value.length, () => props.block.layout, () => props.block.pageSeconds, () => props.slideSeconds, () => context.paging],
    () => turnListPages(),
);
watch(
    [
        () => props.block.style.fontFamily,
        () => props.block.style.fontSize,
        () => props.block.width,
        () => props.block.height,
        () => props.block.layout,
        () => items.value.map((g) => g.id).join(),
    ],
    () => void nextTick(measure),
);
onMounted(() => {
    measure();
    turnListPages();
    void document.fonts?.ready.then(measure);
});
onBeforeUnmount(() => clearInterval(listTimer));

function rowColor(group: Group): string {
    return group.color ?? themeOf(context).accent;
}
/** Cropped to the avatar's own square (2.2em); the letter shows while there is none. */
function rowImage(group: Group): string | null {
    if (!props.block.show.image || !group.imageUrl) return null;
    const side = 2.2 * props.block.style.fontSize;
    return imageSource(context, sizedImageUrl(group.imageUrl, side, side, 'crop'));
}
/** "Mittwoch · 19:30 · Noch 3 Plätze frei" – whatever of the three switches is on and has something to say. */
function rowMeta(group: Group): string {
    const parts: string[] = [];
    if (props.block.show.when) {
        const when = whenText(group);
        if (when) parts.push(when);
    }
    if (props.block.show.targetGroup && group.targetGroup) parts.push(group.targetGroup);
    if (props.block.show.places) {
        const text = placesText(group);
        if (text) parts.push(text);
    }
    return parts.join(' · ');
}
function rowLeaders(group: Group): string | null {
    return props.block.show.leaders && group.leaders.length ? `Leitung: ${group.leaders.join(', ')}` : null;
}
</script>

<template>
    <!-- List: rows like the card rows of the posts and appointment lists, page by page. -->
    <div v-if="block.layout === 'list'" class="groups-list" :style="textStyle(block.style)" data-testid="groups-list">
        <ul ref="measureList" class="rows measure" aria-hidden="true">
            <li v-for="g in items" :key="g.id" class="row">
                <div class="row-avatar" :style="{ background: rowColor(g) }">
                    <img v-if="rowImage(g)" :src="rowImage(g)!" alt="" @error="hideOnError">
                    <span v-else>{{ g.name.charAt(0).toUpperCase() }}</span>
                </div>
                <span class="body">
                    <span v-if="block.show.name" class="title">{{ g.name }}</span>
                    <span v-if="rowMeta(g)" class="summary">{{ rowMeta(g) }}</span>
                    <span v-if="rowLeaders(g)" class="summary" data-testid="group-leaders">{{ rowLeaders(g) }}</span>
                </span>
                <CalendarBadge v-if="block.show.category && g.category" class="row-badge" :name="g.category" :color="rowColor(g)" />
            </li>
        </ul>
        <ul class="rows">
            <li v-for="g in shownRows" :key="g.id" class="row" data-testid="group-row">
                <div class="row-avatar" :style="{ background: rowColor(g) }">
                    <img v-if="rowImage(g)" :src="rowImage(g)!" alt="" @error="hideOnError">
                    <span v-else>{{ g.name.charAt(0).toUpperCase() }}</span>
                </div>
                <span class="body">
                    <span v-if="block.show.name" class="title">{{ g.name }}</span>
                    <span v-if="rowMeta(g)" class="summary">{{ rowMeta(g) }}</span>
                    <span v-if="rowLeaders(g)" class="summary" data-testid="group-leaders">{{ rowLeaders(g) }}</span>
                </span>
                <CalendarBadge v-if="block.show.category && g.category" class="row-badge" :name="g.category" :color="rowColor(g)" />
            </li>
            <li v-if="items.length === 0" class="empty" data-testid="groups-empty">{{ emptyMessage }}</li>
        </ul>
        <div v-if="listPages.length > 1" class="pager">
            <span class="track">
                <span v-if="turnSeconds" :key="listPage" class="progress" :style="{ animationDuration: `${turnSeconds}s` }" />
            </span>
            <span class="page-number">{{ listPage + 1 }}/{{ listPages.length }}</span>
        </div>
    </div>

    <!-- Card: one group at a time – image, text with a coloured bar, and a QR code to its public page. -->
    <div v-else class="hero" :class="landscape ? 'hero--landscape' : 'hero--portrait'" :style="textStyle(block.style)" data-testid="groups-card">
        <template v-if="current">
            <!-- Keyed by address: a hidden broken image must not hide the next group's. -->
            <img v-if="image" :key="image.url" class="hero-image" :src="image.url" :style="image.style" alt="" @error="hideOnError">
            <div class="hero-text">
                <span class="group-bar" :style="{ background: barColor }" />
                <div class="hero-body">
                    <div v-if="block.show.name" class="group-name">{{ current.name }}</div>
                    <div v-if="whenLine" class="meta-line">{{ whenLine }}</div>
                    <div v-if="targetCategoryLine" class="meta-line">{{ targetCategoryLine }}</div>
                    <div v-if="placesLine" class="meta-line">{{ placesLine }}</div>
                    <div v-if="block.show.note && current.note" class="group-note">{{ current.note }}</div>
                    <div v-if="block.show.leaders && current.leaders.length" class="group-leaders" data-testid="group-leaders">
                        Leitung: {{ current.leaders.join(', ') }}
                    </div>
                </div>
            </div>
            <div v-if="qr" class="group-qr" data-testid="group-qr" :style="{ width: `${qrSide}px` }">
                <svg
                    class="qr-code"
                    :viewBox="`0 0 ${qr.size} ${qr.size}`"
                    preserveAspectRatio="xMidYMid meet"
                    shape-rendering="crispEdges"
                    :style="{ width: `${qrSide}px`, height: `${qrSide}px` }"
                >
                    <rect :width="qr.size" :height="qr.size" fill="#ffffff" />
                    <path :d="qr.path" fill="#111111" />
                </svg>
                <span class="qr-caption">Zur Gruppe</span>
            </div>
        </template>
        <div v-else class="hero-text hero-subtitle" data-testid="groups-empty">{{ emptyMessage }}</div>
    </div>
</template>

<style scoped>
/* Card, after PostsView's .hero – background and radius, bleeding image. */
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
    align-items: stretch;
}
.hero--portrait {
    flex-direction: column;
}
.hero-image {
    flex: none;
    object-fit: cover;
}
.hero-text {
    position: relative;
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
    padding: 0.8em 0.8em 0.8em 1.1em;
}
/* A narrow strip in the group's colour, the whole height of the text column. */
.group-bar {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 0;
    width: 0.25em;
}
.hero-body {
    display: flex;
    flex-direction: column;
    gap: 0.3em;
    min-height: 0;
    overflow: hidden;
}
.group-name {
    display: -webkit-box;
    overflow: hidden;
    font-size: 1.1em;
    font-weight: 700;
    line-height: 1.2;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
}
.meta-line {
    font-size: 0.62em;
    opacity: 0.85;
}
.group-note {
    display: -webkit-box;
    overflow: hidden;
    margin-top: 0.2em;
    font-size: 0.72em;
    line-height: 1.4;
    white-space: pre-line;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 3;
}
.group-leaders {
    margin-top: auto;
    font-size: 0.6em;
    opacity: 0.75;
}
.hero-subtitle {
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.75em;
    opacity: 0.8;
}
/* The QR code: centred beside the text in landscape, hugging the bottom right in portrait. */
.group-qr {
    display: flex;
    flex: none;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.3em;
    padding: 0.8em;
}
.hero--portrait .group-qr {
    align-self: flex-end;
}
.qr-code {
    display: block;
    border-radius: var(--isd-radius, 0.3em);
}
.qr-caption {
    font-size: 0.45em;
    opacity: 0.8;
}

/* List, after PostsView's .posts-list. */
.groups-list {
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
.row-avatar {
    display: flex;
    flex: none;
    align-items: center;
    justify-content: center;
    width: 2.2em;
    height: 2.2em;
    overflow: hidden;
    border-radius: var(--isd-radius, 0.3em);
}
.row-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}
.row-avatar span {
    font-size: 0.9em;
    font-weight: 700;
    color: #fff;
}
.body {
    display: grid;
    justify-items: start;
    gap: 0.1em;
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
    font-size: 0.62em;
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
.pager {
    position: absolute;
    right: 0;
    bottom: 0;
    left: 0;
    display: flex;
    align-items: center;
    gap: 0.6em;
    font-size: 0.55em;
}
.track {
    position: relative;
    flex: 1;
    height: 0.3em;
    overflow: hidden;
    border-radius: var(--isd-pill, 999px);
}
.track::before {
    content: '';
    position: absolute;
    inset: 0;
    background: currentColor;
    opacity: 0.25;
}
.progress {
    position: relative;
    display: block;
    width: 100%;
    height: 100%;
    background: var(--isd-accent, currentColor);
    transform-origin: left;
    animation: page-progress linear forwards;
}
@keyframes page-progress {
    from {
        transform: scaleX(0);
    }
    to {
        transform: scaleX(1);
    }
}
.page-number {
    opacity: 0.6;
    white-space: nowrap;
}
</style>
