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
// Each card by its own shape – landscape: image left, text beside it; portrait: image on top, text below.
const landscape = computed(() => cell.value.width >= cell.value.height);

/** The theme's image shape (Plan.md 27); 'free' has no ratio of its own, so 16:9 like a post without one. */
const imageRatio = computed(() => {
    const ratio = themeOf(context).imageRatio;
    return ratio === 'free' ? 16 / 9 : IMAGE_RATIOS[ratio];
});

/** The group's image in the theme's shape, and how much of the card's height it takes from the text (portrait). */
function cardImage(group: Group): { url: string; style: Record<string, string>; takesHeight: number } | null {
    if (!props.block.show.image || !group.imageUrl) return null;
    const { width: w, height: h } = cell.value;
    if (landscape.value) {
        const width = Math.min(h * imageRatio.value, w * 0.4);
        const url = imageSource(context, sizedImageUrl(group.imageUrl, width, h, 'crop'));
        return { url, style: { width: `${width}px`, height: '100%' }, takesHeight: 0 };
    }
    const height = Math.min(w / imageRatio.value, h * 0.4);
    const url = imageSource(context, sizedImageUrl(group.imageUrl, w, height, 'crop'));
    return { url, style: { width: '100%', height: `${height}px` }, takesHeight: height };
}

/*
 * The QR code sits in the bottom right corner of the text, the text flows around it, the leaders
 * stand bottom left, flush with it (third test, 2026-09-29). One rule for every card shape, so that
 * one to four a page look alike: the side is 35 % of the text's width – measured as if every card
 * had an image, so the codes of one page are the same size –, at most a quarter of the card's height
 * and five times the font size. Never narrower than its caption (2.5em), so that "Zur Gruppe" stays
 * under it and a narrow card's code can still be photographed; never more than half the text's width.
 * All in stage pixels.
 */
const em = computed(() => props.block.style.fontSize);
/** The text's inner margin (0.8em) and the clear space around the code (0.5em). */
const pad = computed(() => 0.8 * em.value);
const safety = computed(() => 0.5 * em.value);
const qrSide = computed(() => {
    const textWidth = (landscape.value ? cell.value.width * 0.6 : cell.value.width) - 0.25 * em.value - 2 * pad.value;
    const wanted = Math.min(textWidth * 0.35, cell.value.height * 0.25, 5 * em.value);
    return Math.min(Math.max(wanted, 2.5 * em.value), textWidth * 0.5);
});
/** The code with its caption: the code, a 0.3em gap and one line of 0.45em at line height 1.2. */
const qrBoxHeight = computed(() => qrSide.value + 0.3 * em.value + 0.54 * em.value);

/**
 * The invisible float that pushes the code down to the bottom: the text's inner height, less the
 * code's box and the clear space above it. A pixel less, so rounding never pushes the code below.
 */
function qrSpacer(image: { takesHeight: number } | null): number {
    const inner = cell.value.height - (image?.takesHeight ?? 0) - 2 * pad.value;
    return Math.max(0, Math.floor(inner - qrBoxHeight.value - safety.value - 1));
}

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
              qrSpacer: qrSpacer(cardImage(group)),
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
 * Measured after each page: where the leaders end on the right, and how far the description runs.
 * It runs as long as the card has room (wish of the user, 2026-09-29) – down to the leaders, or to
 * the bottom without them, flowing around the QR code – and fades out only where it is really cut,
 * so a short one keeps its last line crisp. `offsetTop` is layout size; the stage's scaling does
 * not change it.
 */
const cardsRoot = ref<HTMLElement | null>(null);

/**
 * The leaders stand left of the code, centred on the height of the code itself – not of its caption
 * (fourth test, 2026-09-29) –, and end where the code's box begins, as drawn: the caption may be
 * wider than the code. Where that leaves less than four times the font
 * size – four cards a page in a large font left 112 px, not even room for "Leitung:" – they move
 * above the code instead, over the whole width. Where they would then cover the name or the facts,
 * they give way: name and facts first, then the leaders, the description last.
 */
function placeLeaders(text: HTMLElement, leaders: HTMLElement, qr: HTMLElement | null): void {
    const inner = text.clientWidth - 2 * pad.value;
    const beside = qr ? inner - qr.offsetWidth - safety.value : inner;
    const above = qr !== null && beside < 4 * em.value;
    leaders.style.right = `${above || !qr ? pad.value : pad.value + qr.offsetWidth + safety.value}px`;
    if (above && qr) leaders.style.bottom = `${pad.value + qr.offsetHeight + safety.value}px`;
    else if (qr) {
        // The code's middle, from the bottom: the caption line (0.54em), the gap (0.3em) and half the code.
        const middle = pad.value + 0.84 * em.value + qrSide.value / 2;
        leaders.style.bottom = `${Math.max(pad.value, middle - leaders.offsetHeight / 2)}px`;
    } else leaders.style.bottom = `${pad.value}px`;
    leaders.classList.toggle('leaders-box--above', above);
    const facts = [...text.querySelectorAll<HTMLElement>('.group-name, .fact')];
    const factsEnd = Math.max(0, ...facts.map((f) => f.offsetTop + f.offsetHeight));
    leaders.classList.toggle('leaders-box--hidden', leaders.offsetTop < factsEnd + 0.3 * em.value);
}

function fitCards(): void {
    cardsRoot.value?.querySelectorAll<HTMLElement>('.hero-text').forEach((text) => {
        const leaders = text.querySelector<HTMLElement>('.leaders-box');
        const qr = text.querySelector<HTMLElement>('.group-qr');
        if (leaders) placeLeaders(text, leaders, qr);
        const note = text.querySelector<HTMLElement>('.group-note');
        if (!note) return;
        const shown = leaders && !leaders.classList.contains('leaders-box--hidden') ? leaders : null;
        const bottom = shown ? shown.offsetTop - 0.3 * em.value : text.clientHeight - pad.value;
        const room = Math.max(0, bottom - note.offsetTop);
        note.style.maxHeight = `${room}px`;
        note.classList.toggle('group-note--cut', note.scrollHeight > room + 1);
    });
}
watch(cards, () => void nextTick(fitCards));
onMounted(() => {
    void nextTick(fitCards);
    void document.fonts?.ready.then(fitCards);
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
                    <div class="hero-text">
                        <!-- The code in the bottom right corner: an invisible float pushes it down, the text flows around it. -->
                        <template v-if="c.qr">
                            <span class="qr-spacer" :style="{ height: `${c.qrSpacer}px` }" />
                            <div
                                class="group-qr"
                                data-testid="group-qr"
                                :style="{ marginTop: `${safety}px`, marginLeft: `${safety}px` }"
                            >
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
                        </template>
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
                        <!-- Bottom left, flush with the code: "Leitung:" on one line, the names below. -->
                        <!-- How far it reaches to the right is measured against the drawn code (fitCards). -->
                        <div v-if="c.leaders.length" class="leaders-box">
                            <div class="group-leaders" data-testid="group-leaders">
                                <span class="leaders-label">Leitung:</span>
                                <span class="leader-list">
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
                                        <span class="leader-name">{{ leader.name }}</span>
                                    </span>
                                </span>
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
/* One flow for every card shape: name, facts and description, the QR code floated into the bottom
   right corner, the leaders absolutely in the bottom left. Not a flex box – floats need a flow. */
.hero-text {
    position: relative;
    flex: 1;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
    padding: 0.8em;
}
.qr-spacer {
    float: right;
    width: 0;
}
/* Sized by its code alone – the page around the player counts padding into widths. */
.group-qr {
    display: flex;
    float: right;
    clear: right;
    flex-direction: column;
    align-items: center;
    gap: 0.3em;
    box-sizing: content-box;
    padding: 0;
}
.qr-code {
    display: block;
    border-radius: var(--isd-radius, 0.3em);
}
.qr-caption {
    font-size: 0.45em;
    line-height: 1.2;
    white-space: nowrap;
    opacity: 0.8;
}
/* A narrow strip in the group's colour, the whole height of the card. */
.group-bar {
    flex: none;
    width: 0.25em;
}
.group-name {
    display: -webkit-box;
    overflow: hidden;
    margin-bottom: 0.2em;
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
    align-items: center;
    gap: 0.45em;
    margin-bottom: 0.4em;
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
/* Its height is set where it is measured (fitCards). `clip`, not `hidden`: hidden would make it a
   block of its own that stands beside the QR code instead of flowing around it. */
.group-note {
    overflow: clip;
    margin-top: 0.3em;
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
.leaders-box {
    position: absolute;
    right: 0.8em;
    bottom: 0.8em;
    left: 0.8em;
    /* Whatever does not fit stays left of the code rather than running into it. */
    overflow: hidden;
}
.leaders-box--hidden {
    visibility: hidden;
}
.group-leaders {
    display: flex;
    flex-direction: column;
    gap: 0.25em;
    font-size: 0.6em;
    opacity: 0.85;
}
.leader-list {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.3em 0.8em;
}
.leader {
    display: inline-flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.4em;
    max-width: 100%;
}
/* Only a single word wider than the whole space breaks; names are not hyphenated. */
.leader-name {
    overflow-wrap: break-word;
}
.leader-image {
    flex: none;
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
