<script setup lang="ts">
/**
 * The people of the group "Infoscreen-People" (schema 1.51, Plan.md 112, Stück 1): cards in a grid of `columns` × `rows`,
 * page by page, with the page bar like GroupsView. The privacy rule lives in `src/groups/members.ts` – this view reads
 * nothing but `Person` fields: name, picture and the member fields the block names.
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { resolveFieldKeys, selectPeople, shownFields, type Person } from '../../groups/members';
import type { Block } from '../../model/schema';
import { imageSource, themeOf, useStageContext } from '../context';
import { sizedImageUrl, textStyle } from '../format';
import { PEOPLE_SECONDS, pageInterval, pageProgressEdge, pageProgressSegments, pageProgressShown } from '../paging';
import PageSegments from './PageSegments.vue';
import { tp } from '../../i18n/player';

const props = defineProps<{ block: Extract<Block, { type: 'people' }>; slideSeconds?: number }>();
const context = useStageContext();

const items = computed(() => selectPeople(context.people ?? undefined, props.block.roleIds, props.block.sort));

/** As calm as "Keine Gruppen": not set up, not allowed, or simply nobody – and nothing while the first read is still on its way. */
const emptyMessage = computed(() => {
    if (context.people === undefined) return '';
    if (context.people === null) return tp.people.noGroup;
    return context.people.denied ? tp.people.denied : tp.people.none;
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

const perPage = computed(() => props.block.columns * props.block.rows);
const pages = computed(() => {
    const list: Person[][] = [];
    for (let i = 0; i < items.value.length; i += perPage.value) list.push(items.value.slice(i, i + perPage.value));
    return list;
});
const page = ref(0);
const shown = computed(() => pages.value[page.value % Math.max(1, pages.value.length)] ?? []);
const paged = computed(() => pages.value.length > 1);

// Tell the rotation how many pages there are.
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
watch([() => pages.value.length, () => props.block.pageSeconds, () => props.slideSeconds, () => context.paging], () => turnPages());
onMounted(turnPages);
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

/** The picture in the cell's shape: a square on the left, or a band on top; the share of the cell it takes is capped. */
function pictureBox(): { width: number; height: number } {
    const { width: w, height: h } = cell.value;
    return landscape.value ? { width: Math.min(h, w * 0.4), height: h } : { width: w, height: Math.min(w, h * 0.55) };
}

/** The fields by id; a block from before holds names, which are mapped to the ids of the group. */
const fieldKeys = computed(() => resolveFieldKeys(props.block.fieldKeys, context.people?.fields ?? []));

const cards = computed(() =>
    shown.value.map((person, index) => {
        const box = pictureBox();
        return {
            key: `${page.value}-${index}`,
            person,
            initial: person.name.charAt(0).toUpperCase(),
            picture: props.block.showImage
                ? { url: person.imageUrl ? imageSource(context, sizedImageUrl(person.imageUrl, box.width, box.height, 'crop')) : null, style: { width: `${box.width}px`, height: `${box.height}px` } }
                : null,
            fields: shownFields(person, fieldKeys.value),
        };
    }),
);
</script>

<template>
    <div class="people" :style="textStyle(block.style)" data-testid="people-cards">
        <div
            v-if="cards.length"
            class="cards"
            :style="{ gap: `${gap}px`, gridTemplateColumns: `repeat(${block.columns}, ${cell.width}px)`, gridAutoRows: `${cell.height}px` }"
        >
            <div v-for="c in cards" :key="c.key" class="card" :class="landscape ? 'card--landscape' : 'card--portrait'" data-testid="person-card">
                <span class="card-bar" :style="{ background: themeOf(context).accent }" />
                <div class="card-content">
                    <template v-if="c.picture">
                        <img v-if="c.picture.url" :key="c.picture.url" class="card-image" :src="c.picture.url" :style="c.picture.style" alt="" data-testid="person-image" @error="hideOnError">
                        <span v-else class="card-image card-initial" :style="{ ...c.picture.style, background: themeOf(context).accent }">{{ c.initial }}</span>
                    </template>
                    <div class="card-text">
                        <div class="person-name" data-testid="person-name">{{ c.person.name }}</div>
                        <div v-for="field in c.fields" :key="field.key" class="person-field" data-testid="person-field">{{ field.text }}</div>
                    </div>
                </div>
            </div>
        </div>
        <div v-else class="empty" data-testid="people-empty">{{ emptyMessage }}</div>
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
/* Card, after GroupsView's .hero – background and radius, a strip of the accent colour down its side. */
.card {
    position: relative;
    display: flex;
    box-sizing: border-box;
    overflow: hidden;
    border-radius: var(--isd-radius, 0.4em);
    background: var(--isd-card, color-mix(in srgb, currentColor 7%, transparent));
}
/* Over the edge of the picture, not beside it: the picture then fills the card, and no seam shows between the two once the stage is scaled. */
.card-bar {
    position: absolute;
    inset: 0 auto 0 0;
    z-index: 1;
    width: 0.25em;
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
.card-image {
    flex: none;
    object-fit: cover;
}
.card-initial {
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.6em;
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
