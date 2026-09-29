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

/** Line-art symbols for the facts, drawn in the text's own colour – no icon font on a TV. */
const FACT_ICONS = {
    when: ['M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18z', 'M12 7v5l3 2'],
    who: ['M9 11a3 3 0 1 0 0-6a3 3 0 1 0 0 6z', 'M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6', 'M16 5a3 3 0 0 1 0 6', 'M18 14.5c1.8.8 3 2.9 3 5.5'],
    category: ['M3 12V4h8l10 10-8 8z', 'M7.5 7.5h.01'],
    places: ['M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18z', 'M8 12l3 3 5-6'],
} as const;

/** A leader's picture, cropped square to the size it shows at (2em of the 0.6em leaders line). */
function leaderImage(url: string): string {
    const side = 1.2 * props.block.style.fontSize;
    return imageSource(context, sizedImageUrl(url, side, side, 'crop'));
}

/** Everything a card shows, worked out once per page – QR codes are not free to make. */
const cards = computed(() =>
    props.block.layout !== 'card'
        ? []
        : shown.value.map((group) => ({
              group,
              image: cardImage(group),
              qr: props.block.show.qr ? qrShape(group.publicUrl) : null,
              barColor: group.color ?? themeOf(context).accent,
              // Each fact on its own line with its symbol (wish of the user, 2026-09-29).
              facts: [
                  { icon: 'when' as const, text: props.block.show.when ? whenText(group) : '' },
                  { icon: 'who' as const, text: props.block.show.targetGroup ? group.targetGroup : '' },
                  { icon: 'category' as const, text: props.block.show.category ? group.category : '' },
                  { icon: 'places' as const, text: (props.block.show.places ? placesText(group) : null) ?? '' },
              ].filter((fact) => fact.text !== ''),
              leaders: props.block.show.leaders
                  ? group.leaders.map((leader) => ({
                        name: leader.name,
                        image: props.block.show.leaderImages && leader.imageUrl ? leaderImage(leader.imageUrl) : null,
                    }))
                  : [],
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
    return props.block.show.leaders && group.leaders.length ? `Leitung: ${group.leaders.map((l) => l.name).join(', ')}` : null;
}

/**
 * The description runs as long as the card has room (wish of the user, 2026-09-29) and fades out
 * only where it is really cut – a short one keeps its last line crisp. Measured after each page.
 */
const cardsRoot = ref<HTMLElement | null>(null);
function markCutNotes(): void {
    cardsRoot.value?.querySelectorAll<HTMLElement>('.group-note').forEach((note) => {
        note.classList.toggle('group-note--cut', note.scrollHeight > note.clientHeight + 1);
    });
}
watch(cards, () => void nextTick(markCutNotes));
onMounted(() => {
    void nextTick(markCutNotes);
    void document.fonts?.ready.then(markCutNotes);
});
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
    <!-- lang="de": hyphenation needs a language, and what the page around sets is unknown (Plan.md 44, M5). -->
    <div v-else ref="cardsRoot" class="groups-cards" lang="de" :style="textStyle(block.style)" data-testid="groups-card">
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
                <!-- The group's colour runs down the whole card, the image included (wish of the user, 2026-09-29). -->
                <span class="group-bar" :style="{ background: c.barColor }" />
                <div class="hero-content">
                    <!-- Keyed by address: a hidden broken image must not hide the next group's. -->
                    <img v-if="c.image" :key="c.image.url" class="hero-image" :src="c.image.url" :style="c.image.style" alt="" @error="hideOnError">
                    <!-- Text and QR code share a row: beside the image in landscape, below it in portrait. -->
                    <div class="hero-main">
                        <div class="hero-text">
                            <div v-if="block.show.name" class="group-name">{{ c.group.name }}</div>
                            <div v-for="fact in c.facts" :key="fact.icon" class="fact" :data-testid="`group-fact-${fact.icon}`">
                                <svg class="fact-icon" viewBox="0 0 24 24" aria-hidden="true">
                                    <path v-for="(d, k) in FACT_ICONS[fact.icon]" :key="k" :d="d" />
                                </svg>
                                <span>{{ fact.text }}</span>
                            </div>
                            <div v-if="c.note.length" class="group-note" data-testid="group-note">
                                <template v-for="(paragraph, i) in c.note" :key="i">
                                    <template v-if="i > 0">{{ '\n' }}</template>
                                    <template v-for="(inline, j) in paragraph" :key="j">
                                        <strong v-if="inline.kind === 'strong'">{{ inline.text }}</strong>
                                        <template v-else>{{ inline.text }}</template>
                                    </template>
                                </template>
                            </div>
                            <div v-if="landscape && c.leaders.length" class="group-leaders" data-testid="group-leaders">
                                <span>Leitung:</span>
                                <span v-for="(leader, k) in c.leaders" :key="k" class="leader">
                                    <img
                                        v-if="leader.image"
                                        :key="leader.image"
                                        class="leader-image"
                                        :src="leader.image"
                                        alt=""
                                        data-testid="leader-image"
                                        @error="hideOnError"
                                    >
                                    {{ leader.name }}
                                </span>
                            </div>
                        </div>
                        <!-- Landscape: the QR code beside the text. Portrait: a foot below the full-width text,
                             the leaders on the left and the QR code on the right – beside the text it left
                             four narrow cards a few letters each (second test, 2026-09-29). -->
                        <div v-if="c.qr || (!landscape && c.leaders.length)" class="hero-side">
                            <div v-if="!landscape && c.leaders.length" class="group-leaders" data-testid="group-leaders">
                                <span>Leitung:</span>
                                <span v-for="(leader, k) in c.leaders" :key="k" class="leader">
                                    <img
                                        v-if="leader.image"
                                        :key="leader.image"
                                        class="leader-image"
                                        :src="leader.image"
                                        alt=""
                                        data-testid="leader-image"
                                        @error="hideOnError"
                                    >
                                    {{ leader.name }}
                                </span>
                            </div>
                            <div v-if="c.qr" class="group-qr" data-testid="group-qr">
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
/* Bar, then image and text – side by side in landscape, one above the other in portrait. */
.hero-content {
    display: flex;
    flex: 1;
    min-width: 0;
    min-height: 0;
}
.hero--portrait .hero-content {
    flex-direction: column;
}
.hero-image {
    flex: none;
    object-fit: cover;
}
.hero-text {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 0.3em;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
    padding: 0.8em;
}
/* Landscape: text and QR code side by side. Portrait: the text above, the foot with leaders and QR below. */
.hero-main {
    display: flex;
    flex: 1;
    min-width: 0;
    min-height: 0;
}
.hero--portrait .hero-main {
    flex-direction: column;
}
.hero-side {
    display: flex;
    flex: none;
}
.hero--portrait .hero-side {
    align-items: flex-end;
}
.hero--portrait .hero-side .group-leaders {
    flex: 1;
    min-width: 0;
    margin: 0;
    padding: 0 0 0.8em 0.8em;
}
/* A narrow strip in the group's colour, the whole height of the card. */
.group-bar {
    flex: none;
    width: 0.25em;
}
.group-name {
    display: -webkit-box;
    flex-shrink: 0;
    overflow: hidden;
    /* A long name in a narrow card breaks by syllable instead of running off the edge. */
    overflow-wrap: break-word;
    hyphens: auto;
    font-size: 1.1em;
    font-weight: 700;
    line-height: 1.2;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
}
.fact {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    gap: 0.45em;
    font-size: 0.62em;
    opacity: 0.85;
}
.fact-icon {
    flex: none;
    width: 1.1em;
    height: 1.1em;
    fill: none;
    stroke: currentColor;
    stroke-linecap: round;
    stroke-linejoin: round;
    stroke-width: 2;
}
/* As long as the card has room; the only item that gives way – the name and the facts keep their lines. */
.group-note {
    flex: 0 1 auto;
    min-height: 0;
    overflow: hidden;
    margin-top: 0.2em;
    font-size: 0.72em;
    line-height: 1.4;
    white-space: pre-line;
}
.group-note--cut {
    -webkit-mask-image: linear-gradient(to bottom, black calc(100% - 2.8em), transparent 100%);
    mask-image: linear-gradient(to bottom, black calc(100% - 2.8em), transparent 100%);
}
/* The page around the player styles <strong> of its own – dark on a dark card. */
.group-note strong {
    color: inherit;
    font-weight: 700;
}
.group-leaders {
    display: flex;
    flex-shrink: 0;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.3em 0.8em;
    margin-top: auto;
    padding-top: 0.3em;
    font-size: 0.6em;
    opacity: 0.85;
}
.leader {
    display: inline-flex;
    align-items: center;
    gap: 0.4em;
}
.leader-image {
    width: 2em;
    height: 2em;
    border-radius: 50%;
    object-fit: cover;
}
.hero-subtitle {
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.75em;
    opacity: 0.8;
}
/* The QR code: centred beside the text in landscape, at the bottom right in portrait. Sized by its
   code alone – the page around the player counts padding into widths, which pushed it off the edge. */
.group-qr {
    display: flex;
    flex: none;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.3em;
    box-sizing: content-box;
    padding: 0.8em;
}
.qr-code {
    display: block;
    border-radius: var(--isd-radius, 0.3em);
}
.qr-caption {
    font-size: 0.45em;
    white-space: nowrap;
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
