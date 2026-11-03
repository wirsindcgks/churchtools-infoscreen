<script setup lang="ts">
/**
 * The people of the group "Infoscreen-People" (schema 1.51, Plan.md 112, Stück 1): cards in a grid of `columns` × `rows`,
 * or, since 1.55, one row a person (small round picture, name, role, fields), page by page, with the page bar like GroupsView. The privacy rule lives in `src/groups/members.ts` – this view reads
 * nothing but `Person` fields: name, picture, the member fields the block names and, since 1.54, the released person fields it chose.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { groupOfBlock, resolveFieldKeys, selectPeople, shownFields, shownPersonFields, type Person } from '../../groups/members';
import type { Block } from '../../model/schema';
import { imageSource, themeOf, useStageContext } from '../context';
import { sizedImageUrl, textStyle } from '../format';
import { PEOPLE_SECONDS, pageInterval, paginateByHeight, pageProgressEdge, pageProgressSegments, pageProgressShown } from '../paging';
import PageSegments from './PageSegments.vue';
import { tp } from '../../i18n/player';

const props = defineProps<{ block: Extract<Block, { type: 'people' }>; slideSeconds?: number }>();
const context = useStageContext();

/** The block's group: `undefined` while the first read is on its way, `null` where "Infoscreen-People" is not set up. */
const group = computed(() => groupOfBlock(context.people, props.block.sourceGroupId));
const items = computed(() => selectPeople(group.value ?? undefined, props.block.roleIds, props.block.sort));

/** As calm as "Keine Gruppen": not set up, not released, not allowed, or simply nobody – and nothing while the first read is still on its way. */
const emptyMessage = computed(() => {
    if (group.value === undefined) return '';
    if (group.value === null) return tp.people.noGroup;
    if (group.value.unreleased) return tp.people.unreleased;
    return group.value.denied ? tp.people.denied : tp.people.none;
});

/** A broken image on a TV looks worse than none – hide it, the card keeps its space. */
function hideOnError(event: Event): void {
    (event.target as HTMLElement).style.display = 'none';
}

// --- pages ---

const progressOn = computed(() => pageProgressShown(props.block, context));
const edge = computed(() => pageProgressEdge(props.block));
const segments = computed(() => pageProgressSegments(props.block));
const held = computed(() => context.paging === false);
/** Room kept free for the page bar; the edge line is thinner and has no number beside it. */
const reserve = computed(() => (progressOn.value ? props.block.style.fontSize * (edge.value ? 0.365 : 0.9) : 0));

const isList = computed(() => props.block.layout === 'list');

/** Card: `columns` × `rows` cards a page. */
const perPage = computed(() => props.block.columns * props.block.rows);
const cardPages = computed(() => {
    const list: Person[][] = [];
    for (let i = 0; i < items.value.length; i += perPage.value) list.push(items.value.slice(i, i + perPage.value));
    return list;
});

// List: as many whole rows as fit, measured in a hidden copy (like GroupsView).
const heights = ref<number[]>([]);
const measureList = ref<HTMLElement | null>(null);
function measure(): void {
    const rows = measureList.value?.querySelectorAll<HTMLElement>(':scope > .row');
    heights.value = rows ? [...rows].map((row) => row.offsetHeight) : [];
}
const listPages = computed(() => paginateByHeight(items.value, heights.value, props.block.height, reserve.value));

const pages = computed(() => (isList.value ? listPages.value : cardPages.value));
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
    turnSeconds.value = pageInterval(props.block.pageSeconds ?? PEOPLE_SECONDS, props.slideSeconds ?? 0, count);
    timer = setInterval(() => (page.value = (page.value + 1) % count), turnSeconds.value * 1000);
}
watch([() => pages.value.length, () => props.block.layout, () => props.block.pageSeconds, () => props.slideSeconds, () => context.paging], () => turnPages());
watch(
    [
        () => props.block.style.fontFamily,
        () => props.block.style.fontSize,
        () => props.block.width,
        () => props.block.height,
        () => props.block.layout,
        () => props.block.showImage,
        () => props.block.fieldKeys.join(),
        () => props.block.personFieldKeys?.join(),
        () => items.value.map((p) => `${p.name}|${p.roleId}|${Object.values(p.fields).join()}|${Object.values(p.personFields ?? {}).join()}`).join(),
    ],
    () => void nextTick(measure),
);
onMounted(() => {
    measure();
    turnPages();
    void document.fonts?.ready.then(measure);
});
onBeforeUnmount(() => clearInterval(timer));

// --- card geometry: every cell of a page has the same size, so a last page with fewer cards keeps it ---

const gap = computed(() => props.block.style.fontSize * 0.4);
const cell = computed(() => {
    const { columns, rows, width, height } = props.block;
    const room = height - (paged.value ? reserve.value : 0);
    return { width: (width - gap.value * (columns - 1)) / columns, height: (room - gap.value * (rows - 1)) / rows };
});
/** A wide cell puts the picture beside the text, a tall one above it. */
const landscape = computed(() => cell.value.width >= cell.value.height * 1.2);

/** Air around the round picture, in px (the card's text size scales with the block's font size). */
const pad = computed(() => props.block.style.fontSize * 0.6);

/** The profile picture: a circle (its diameter), beside the text in a wide cell, above it in a tall one; the share of the cell it takes is capped. */
function pictureSize(): number {
    const { width: w, height: h } = cell.value;
    const size = landscape.value ? Math.min(h - 2 * pad.value, w * 0.4) : Math.min(w - 2 * pad.value, h * 0.55 - pad.value);
    return Math.max(0, Math.floor(size));
}

/** The fields by id; a block from before holds names, which are mapped to the ids of the group. */
const fieldKeys = computed(() => resolveFieldKeys(props.block.fieldKeys, group.value?.fields ?? []));

/** Member fields first, then the person fields (schema 1.54) – only those the group was read for, i.e. still released. */
function fieldsOf(person: Person) {
    return [...shownFields(person, fieldKeys.value), ...shownPersonFields(person, group.value ?? undefined, props.block.personFieldKeys)];
}

const cards = computed(() =>
    isList.value ? [] : shown.value.map((person, index) => {
        const size = pictureSize();
        return {
            key: `${page.value}-${index}`,
            person,
            initial: person.name.charAt(0).toUpperCase(),
            picture: props.block.showImage
                ? { size, url: person.imageUrl ? imageSource(context, sizedImageUrl(person.imageUrl, size, size, 'crop')) : null, style: { width: `${size}px`, height: `${size}px`, margin: landscape.value ? `0 0 0 ${pad.value}px` : `${pad.value}px 0 0` } }
                : null,
            fields: fieldsOf(person),
        };
    }),
);

// --- list rows: the picture is a small circle of 2.2 em, the line under the name holds the role and the fields ---

const rowPicture = computed(() => Math.round(props.block.style.fontSize * 2.2));
function roleName(person: Person): string {
    return group.value?.roles.find((r) => r.id === person.roleId)?.name ?? '';
}
function rowEntry(person: Person, index: number, withImage: boolean) {
    return {
        key: `${page.value}-${index}`,
        person,
        initial: person.name.charAt(0).toUpperCase(),
        url: withImage && person.imageUrl ? imageSource(context, sizedImageUrl(person.imageUrl, rowPicture.value, rowPicture.value, 'crop')) : null,
        meta: [roleName(person), ...fieldsOf(person).map((f) => f.text)].filter(Boolean).join(' · '),
    };
}
const rowsShown = computed(() => (isList.value ? shown.value.map((p, i) => rowEntry(p, i, true)) : []));
/** Every person, laid out like the shown rows, to measure their heights (no pictures needed: the circle has a fixed size). */
const rowsMeasured = computed(() => (isList.value ? items.value.map((p, i) => rowEntry(p, i, false)) : []));
</script>

<template>
    <div class="people" :style="textStyle(block.style)" :data-testid="isList ? 'people-list' : 'people-cards'">
        <!-- List: rows like GroupsView's, page by page; the rows are measured in a hidden copy. -->
        <template v-if="isList">
            <ul ref="measureList" class="rows measure" aria-hidden="true">
                <li v-for="r in rowsMeasured" :key="r.key" class="row">
                    <span v-if="block.showImage" class="row-avatar" />
                    <span class="body">
                        <span class="title">{{ r.person.name }}</span>
                        <span v-if="r.meta" class="summary">{{ r.meta }}</span>
                    </span>
                </li>
            </ul>
            <ul v-if="items.length" class="rows">
                <li v-for="r in rowsShown" :key="r.key" class="row" data-testid="person-row">
                    <template v-if="block.showImage">
                        <img v-if="r.url" :key="r.url" class="row-avatar" :src="r.url" alt="" data-testid="person-image" @error="hideOnError">
                        <span v-else class="row-avatar row-initial" :style="{ background: themeOf(context).accent }"><span>{{ r.initial }}</span></span>
                    </template>
                    <span class="body">
                        <span class="title" data-testid="person-name">{{ r.person.name }}</span>
                        <span v-if="r.meta" class="summary" data-testid="person-meta">{{ r.meta }}</span>
                    </span>
                </li>
            </ul>
        </template>
        <div
            v-else-if="cards.length"
            class="cards"
            :style="{ gap: `${gap}px`, gridTemplateColumns: `repeat(${block.columns}, ${cell.width}px)`, gridAutoRows: `${cell.height}px` }"
        >
            <div v-for="c in cards" :key="c.key" class="card" :class="landscape ? 'card--landscape' : 'card--portrait'" data-testid="person-card">
                <div class="card-content">
                    <template v-if="c.picture">
                        <img v-if="c.picture.url" :key="c.picture.url" class="card-image" :src="c.picture.url" :style="c.picture.style" alt="" data-testid="person-image" @error="hideOnError">
                        <span v-else class="card-image card-initial" :style="{ ...c.picture.style, background: themeOf(context).accent, fontSize: `${c.picture.size * 0.45}px` }">{{ c.initial }}</span>
                    </template>
                    <div class="card-text">
                        <div class="person-name" data-testid="person-name">{{ c.person.name }}</div>
                        <div v-for="field in c.fields" :key="field.key" class="person-field" data-testid="person-field">{{ field.text }}</div>
                    </div>
                </div>
            </div>
        </div>
        <div v-if="!items.length" class="empty" data-testid="people-empty">{{ emptyMessage }}</div>
        <div v-if="paged && progressOn" class="pager" :class="{ 'pager--edge': edge }" data-testid="people-pager">
            <PageSegments v-if="segments" :count="pages.length" :current="page" :seconds="turnSeconds" :held="held" :edge="edge" />
            <template v-else>
                <span class="track">
                    <span v-if="turnSeconds" :key="page" class="progress" :style="{ animationDuration: `${turnSeconds}s` }" />
                    <span v-else-if="held" class="progress progress--held" />
                </span>
                <span v-if="!edge" class="page-number">{{ page + 1 }}/{{ pages.length }}</span>
            </template>
        </div>
    </div>
</template>

<style scoped src="./paged-list.css"></style>
<style scoped src="./pager.css"></style>
<style scoped src="./page-bar.css"></style>
<style scoped>
.people {
    position: relative;
    width: 100%;
    height: 100%;
}
.cards {
    display: grid;
}
/* Card, after GroupsView's .hero – background and radius; the picture is a round profile picture inside it, not a band that fills it. */
.card {
    position: relative;
    display: flex;
    box-sizing: border-box;
    overflow: hidden;
    border-radius: var(--isd-radius, 0.4em);
    background: var(--isd-card, color-mix(in srgb, currentColor 7%, transparent));
}
.card-content {
    display: flex;
    flex: 1;
    min-width: 0;
    min-height: 0;
}
.card--portrait .card-content {
    flex-direction: column;
}
/* Fixed size inside the card (set inline); centred across the card, so a text of any length leaves it in place. */
.card-image {
    flex: none;
    align-self: center;
    border-radius: 50%;
    object-fit: cover;
}
.card-initial {
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    color: #fff;
}
.card-text {
    flex: 1;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
    padding: 0.6em 0.8em;
}
.person-name {
    display: -webkit-box;
    overflow: hidden;
    margin-bottom: 0.25em;
    overflow-wrap: break-word;
    font-size: 1.05em;
    font-weight: 700;
    line-height: 1.2;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
}
.person-field {
    overflow: hidden;
    font-size: 0.7em;
    line-height: 1.35;
    text-overflow: ellipsis;
    white-space: nowrap;
    opacity: 0.85;
}
/* List row, after GroupsView's .row. */
.row {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    gap: 0.9em;
    padding: 0.55em 0;
    border-bottom: 1px solid color-mix(in srgb, currentColor 15%, transparent);
}
.row:not(:has(.row-avatar)) {
    grid-template-columns: minmax(0, 1fr);
}
.row-avatar {
    flex: none;
    width: 2.2em;
    height: 2.2em;
    border-radius: 50%;
    object-fit: cover;
}
.row-initial {
    display: flex;
    align-items: center;
    justify-content: center;
}
.row-initial span {
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
.empty {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    font-size: 0.75em;
    opacity: 0.8;
}
</style>
