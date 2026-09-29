<script setup lang="ts">
/**
 * Groups of a ChurchTools group homepage (schema 1.14, Plan.md, Nächste
 * Schritte 43): cards with a QR code to each group's public page, one to
 * four a page, or as many rows as fit. Both turn their pages and show the
 * page bar like AppointmentListView. The privacy rule lives in
 * `src/groups/normalize.ts` – this view reads nothing but `Group` fields.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { homepageGroups, placesText, selectGroups, whenText, type Group } from '../../groups/normalize';
import { IMAGE_RATIOS, type Block } from '../../model/schema';
import { imageSource, themeOf, useStageContext } from '../context';
import { sizedImageUrl, textStyle } from '../format';
import { postParagraphs } from '../../posts/text';
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

// --- pages: both layouts turn them the same way, with the same bar as AppointmentListView ---

/** The page bar at the bottom: 0.55em text and a little air, like AppointmentListView's. */
const reserve = computed(() => props.block.style.fontSize * 0.9);

/** Card: `perPage` groups a page (wish of the user, 2026-09-29). */
const cardPages = computed(() => {
    const pages: Group[][] = [];
    for (let i = 0; i < items.value.length; i += props.block.perPage) pages.push(items.value.slice(i, i + props.block.perPage));
    return pages;
});

// List: as many whole rows as fit, measured in a hidden copy.
const heights = ref<number[]>([]);
const measureList = ref<HTMLElement | null>(null);
function measure(): void {
    const rows = measureList.value?.querySelectorAll<HTMLElement>(':scope > .row');
    heights.value = rows ? [...rows].map((row) => row.offsetHeight) : [];
}
const listPages = computed(() => paginateByHeight(items.value, heights.value, props.block.height, reserve.value));

const pages = computed(() => (props.block.layout === 'card' ? cardPages.value : listPages.value));
const page = ref(0);
const shown = computed(() => pages.value[page.value % Math.max(1, pages.value.length)] ?? []);
const paged = computed(() => pages.value.length > 1);

// Tell the rotation how many pages there are – of the layout shown, also right after switching it.
watch(
    () => Math.max(1, pages.value.length),
    (count) => {
        if (context.pages) context.pages[props.block.id] = count;
    },
    { immediate: true },
);

let timer: ReturnType<typeof setInterval> | undefined;
/** Seconds of the page shown, for the progress bar; 0 while pages do not turn. */
const turnSeconds = ref(0);
function turnPages(): void {
    clearInterval(timer);
    page.value = 0;
    turnSeconds.value = 0;
    const count = pages.value.length;
    if (count < 2 || context.paging === false) return;
    turnSeconds.value = pageInterval(props.block.pageSeconds ?? GROUP_SECONDS, props.slideSeconds ?? 0, count);
    timer = setInterval(() => (page.value = (page.value + 1) % count), turnSeconds.value * 1000);
}
watch(
    [() => pages.value.length, () => props.block.layout, () => props.block.pageSeconds, () => props.slideSeconds, () => context.paging],
    () => turnPages(),
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
    turnPages();
    void document.fonts?.ready.then(measure);
});
onBeforeUnmount(() => clearInterval(timer));

// --- card geometry: cells side by side in a wide block, stacked in a tall one ---

const gap = computed(() => props.block.style.fontSize * 0.4);
const sideBySide = computed(() => props.block.width >= props.block.height);
/** One card's size; all cells of a page share it, so a last page with fewer cards keeps their size. */
const cell = computed(() => {
    const n = props.block.perPage;
    const height = props.block.height - (paged.value ? reserve.value : 0);
    return sideBySide.value
        ? { width: (props.block.width - gap.value * (n - 1)) / n, height }
        : { width: props.block.width, height: (height - gap.value * (n - 1)) / n };
});
// Each card by its own shape – landscape: image left, text, QR right; portrait: image on top, QR bottom right.
const landscape = computed(() => cell.value.width >= cell.value.height);

/** The theme's image shape (Plan.md 27); 'free' has no ratio of its own, so 16:9 like a post without one. */
const imageRatio = computed(() => {
    const ratio = themeOf(context).imageRatio;
    return ratio === 'free' ? 16 / 9 : IMAGE_RATIOS[ratio];
});

function cardImage(group: Group): { url: string; style: Record<string, string> } | null {
    if (!props.block.show.image || !group.imageUrl) return null;
    const { width: w, height: h } = cell.value;
    if (landscape.value) {
        const width = Math.min(h * imageRatio.value, w * 0.4);
        return { url: imageSource(context, sizedImageUrl(group.imageUrl, width, h, 'crop')), style: { width: `${width}px`, height: '100%' } };
    }
    const height = Math.min(w / imageRatio.value, h * 0.4);
    return { url: imageSource(context, sizedImageUrl(group.imageUrl, w, height, 'crop')), style: { width: '100%', height: `${height}px` } };
}

/** The QR code's side, capped so it never crowds out the text (Plan.md 43). */
const qrSide = computed(() =>
    landscape.value
        ? Math.min(cell.value.height * 0.45, cell.value.width * 0.28)
        : Math.min(cell.value.width * 0.3, cell.value.height * 0.22),
);

/** Everything a card shows, worked out once per page – QR codes are not free to make. */
const cards = computed(() =>
    props.block.layout !== 'card'
        ? []
        : shown.value.map((group) => ({
              group,
              image: cardImage(group),
              qr: props.block.show.qr ? qrShape(group.publicUrl) : null,
              barColor: group.color ?? themeOf(context).accent,
              when: props.block.show.when ? whenText(group) : '',
              targetCategory: [
                  props.block.show.targetGroup ? group.targetGroup : '',
                  props.block.show.category ? group.category : '',
              ]
                  .filter((part) => part !== '')
                  .join(' · '),
              places: props.block.show.places ? placesText(group) : null,
              // `**bold**` and links read as in posts; paragraphs become line breaks, so three lines stay three.
              note: props.block.show.note ? postParagraphs(group.note) : [],
          })),
);

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
            <li v-for="g in shown" :key="g.id" class="row" data-testid="group-row">
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
        <div v-if="paged" class="pager" data-testid="groups-pager">
            <span class="track">
                <span v-if="turnSeconds" :key="page" class="progress" :style="{ animationDuration: `${turnSeconds}s` }" />
            </span>
            <span class="page-number">{{ page + 1 }}/{{ pages.length }}</span>
        </div>
    </div>

    <!-- Cards: one to four a page, each image, text with a coloured bar, and a QR code to its public page. -->
    <div v-else class="groups-cards" :style="textStyle(block.style)" data-testid="groups-card">
        <div
            v-if="cards.length"
            class="cells"
            :class="sideBySide ? 'cells--row' : 'cells--column'"
            :style="{ gap: `${gap}px` }"
        >
            <div
                v-for="c in cards"
                :key="c.group.id"
                class="hero"
                :class="landscape ? 'hero--landscape' : 'hero--portrait'"
                :style="{ width: `${cell.width}px`, height: `${cell.height}px` }"
                data-testid="group-card"
            >
                <!-- Keyed by address: a hidden broken image must not hide the next group's. -->
                <img v-if="c.image" :key="c.image.url" class="hero-image" :src="c.image.url" :style="c.image.style" alt="" @error="hideOnError">
                <!-- Text and QR code share a row: beside the image in landscape, below it in portrait. -->
                <div class="hero-main">
                    <div class="hero-text">
                        <span class="group-bar" :style="{ background: c.barColor }" />
                        <div class="hero-body">
                            <div v-if="block.show.name" class="group-name">{{ c.group.name }}</div>
                            <div v-if="c.when" class="meta-line">{{ c.when }}</div>
                            <div v-if="c.targetCategory" class="meta-line">{{ c.targetCategory }}</div>
                            <div v-if="c.places" class="meta-line">{{ c.places }}</div>
                            <div v-if="c.note.length" class="group-note" data-testid="group-note">
                                <template v-for="(paragraph, i) in c.note" :key="i">
                                    <template v-if="i > 0">{{ '\n' }}</template>
                                    <template v-for="(inline, j) in paragraph" :key="j">
                                        <strong v-if="inline.kind === 'strong'">{{ inline.text }}</strong>
                                        <template v-else>{{ inline.text }}</template>
                                    </template>
                                </template>
                            </div>
                            <div v-if="block.show.leaders && c.group.leaders.length" class="group-leaders" data-testid="group-leaders">
                                Leitung: {{ c.group.leaders.join(', ') }}
                            </div>
                        </div>
                    </div>
                    <div v-if="c.qr" class="group-qr" data-testid="group-qr" :style="{ width: `${qrSide}px` }">
                        <svg
                            class="qr-code"
                            :viewBox="`0 0 ${c.qr.size} ${c.qr.size}`"
                            preserveAspectRatio="xMidYMid meet"
                            shape-rendering="crispEdges"
                            :style="{ width: `${qrSide}px`, height: `${qrSide}px` }"
                        >
                            <rect :width="c.qr.size" :height="c.qr.size" fill="#ffffff" />
                            <path :d="c.qr.path" fill="#111111" />
                        </svg>
                        <span class="qr-caption">Zur Gruppe</span>
                    </div>
                </div>
            </div>
        </div>
        <div v-else class="hero hero-subtitle" data-testid="groups-empty">{{ emptyMessage }}</div>
        <div v-if="paged" class="pager" data-testid="groups-pager">
            <span class="track">
                <span v-if="turnSeconds" :key="page" class="progress" :style="{ animationDuration: `${turnSeconds}s` }" />
            </span>
            <span class="page-number">{{ page + 1 }}/{{ pages.length }}</span>
        </div>
    </div>
</template>

<style scoped>
/* Cards: the cells fill the block above the page bar. */
.groups-cards {
    position: relative;
    width: 100%;
    height: 100%;
}
.cells {
    display: flex;
}
.cells--column {
    flex-direction: column;
}
/* Card, after PostsView's .hero – background and radius, bleeding image. */
.hero {
    display: flex;
    flex: none;
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
/* Text and QR code side by side; the text takes what the QR code leaves. */
.hero-main {
    display: flex;
    flex: 1;
    min-width: 0;
    min-height: 0;
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
    flex-shrink: 0;
    overflow: hidden;
    font-size: 1.1em;
    font-weight: 700;
    line-height: 1.2;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
}
.meta-line {
    flex-shrink: 0;
    font-size: 0.62em;
    opacity: 0.85;
}
.group-note {
    display: -webkit-box;
    /* The only item that gives way when the card is short: the name and the facts keep their lines. */
    flex-shrink: 1;
    min-height: 0;
    overflow: hidden;
    margin-top: 0.2em;
    font-size: 0.72em;
    line-height: 1.4;
    white-space: pre-line;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 3;
}
.group-leaders {
    flex-shrink: 0;
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
/* The QR code: centred beside the text in landscape, at the bottom right in portrait. */
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
