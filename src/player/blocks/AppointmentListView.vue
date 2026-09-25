<script setup lang="ts">
/**
 * Upcoming appointments as a list. With "alle Termine" (schema 1.6, Plan.md,
 * Nächste Schritte 23) every appointment of the horizon shows: what does not
 * fit the block turns page by page, and the block reports its page count so
 * the rotation keeps the slide until every page has run. Rows of the card
 * layout differ in height; a hidden copy of the list measures each one, and
 * only whole rows show.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { selectUpcoming } from '../../appointments/normalize';
import type { Block } from '../../model/schema';
import { themeOf, useStageContext } from '../context';
import { textStyle } from '../format';
import { PAGE_SECONDS, pageInterval, paginateByHeight, SHOW_ALL_CAP } from '../paging';
import { listLayout } from '../theme';
import AppointmentRow from './AppointmentRow.vue';

const props = defineProps<{ block: Extract<Block, { type: 'appointment-list' }>; slideSeconds?: number }>();
const context = useStageContext();
const layout = computed(() => listLayout(props.block, themeOf(context)));

const items = computed(() =>
    selectUpcoming(context.appointments, {
        now: context.now,
        timeZone: context.timeZone,
        horizonDays: props.block.horizonDays,
        limit: props.block.showAll ? SHOW_ALL_CAP : props.block.limit,
        calendarIds: props.block.calendarIds,
    }),
);

/** Height of every row in stage pixels, measured in the hidden copy; empty until laid out. */
const heights = ref<number[]>([]);
const measureList = ref<HTMLElement | null>(null);

function measure(): void {
    // offsetHeight is layout size: the stage's scaling does not change it.
    const rows = measureList.value?.querySelectorAll<HTMLElement>(':scope > .row');
    heights.value = rows ? [...rows].map((row) => row.offsetHeight) : [];
}

/** The page bar at the bottom: 0.55em text and a little air. */
const reserve = computed(() => props.block.style.fontSize * 0.9);
/** Without "alle Termine" only the rows that fit whole – a row cut off at the bottom looks broken. */
const pages = computed(() =>
    props.block.showAll
        ? paginateByHeight(items.value, heights.value, props.block.height, reserve.value)
        : [paginateByHeight(items.value, heights.value, props.block.height, 0)[0]!],
);
const page = ref(0);
const shown = computed(() => pages.value[page.value % pages.value.length] ?? []);

// Tell the rotation how many pages there are (only lists that page count).
watch(
    () => pages.value.length,
    (count) => {
        if (props.block.showAll && context.pages) context.pages[props.block.id] = count;
    },
    { immediate: true },
);

let timer: ReturnType<typeof setInterval> | undefined;
/** Seconds one page shows while the pages turn; 0 while they do not (one page, or the designer's preview). */
const turnSeconds = ref(0);
function turnPages(): void {
    clearInterval(timer);
    page.value = 0;
    turnSeconds.value = 0;
    const count = pages.value.length;
    if (!props.block.showAll || count < 2 || context.paging === false) return;
    turnSeconds.value = pageInterval(props.block.pageSeconds ?? PAGE_SECONDS, props.slideSeconds ?? 0, count);
    timer = setInterval(() => (page.value = (page.value + 1) % count), turnSeconds.value * 1000);
}

// Separate sources, each compared by value: one getter returning a fresh array would count
// as changed on every tick of the clock and start the pages over each second.
watch(
    [() => pages.value.length, () => props.block.showAll, () => props.block.pageSeconds, () => props.slideSeconds, () => context.paging],
    () => turnPages(),
);
// Rows change height with font, size, layout and content – and once the fonts have loaded.
watch(
    [
        () => props.block.style.fontFamily,
        () => props.block.style.fontSize,
        () => props.block.width,
        () => props.block.height,
        layout,
        () => items.value.map((a) => a.key).join(),
    ],
    () => void nextTick(measure),
);
onMounted(() => {
    measure();
    turnPages();
    void document.fonts?.ready.then(measure);
});
onBeforeUnmount(() => clearInterval(timer));
</script>

<template>
    <div class="paged" :style="textStyle(block.style)">
        <!-- Every row once, invisible, in the same markup and width as the shown ones: for pages and whole rows. -->
        <ul ref="measureList" class="list measure" aria-hidden="true">
            <AppointmentRow v-for="a in items" :key="a.key" :appointment="a" :layout="layout" :time-zone="context.timeZone" measuring />
        </ul>
        <Transition name="page" mode="out-in">
            <ul :key="page" class="list" :class="{ 'list--cards': layout === 'cards' }">
                <AppointmentRow v-for="a in shown" :key="a.key" :appointment="a" :layout="layout" :time-zone="context.timeZone" />
                <!-- An empty week is a normal state and must look like one, not like a failure. -->
                <li v-if="items.length === 0" class="empty">Keine Termine in den nächsten {{ block.horizonDays }} Tagen.</li>
            </ul>
        </Transition>
        <div v-if="pages.length > 1" class="pager">
            <!-- Fills up over the time of one page, anew on each page: how long until the next. -->
            <span class="track">
                <span
                    v-if="turnSeconds"
                    :key="page"
                    class="progress"
                    data-testid="list-progress"
                    :style="{ animationDuration: `${turnSeconds}s` }"
                />
            </span>
            <span class="page-number" data-testid="list-page">{{ page + 1 }}/{{ pages.length }}</span>
        </div>
    </div>
</template>

<style scoped>
.paged {
    position: relative;
    width: 100%;
    height: 100%;
}
.list {
    list-style: none;
    margin: 0;
    padding: 0;
    width: 100%;
}
/* Laid out like the shown list, but never seen and never in the way. */
.measure {
    position: absolute;
    top: 0;
    left: 0;
    visibility: hidden;
    pointer-events: none;
}
.empty {
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
/* The pale track as its own layer – an opacity on .track would pale the bar too. */
.track::before {
    content: '';
    position: absolute;
    inset: 0;
    background: currentColor;
    opacity: 0.25;
}
/* Its own layer, scaled from nothing to full: the compositor draws it, nothing is laid out again. */
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
/* Pages cross-fade calmly; opacity alone, which the compositor handles. */
.page-enter-active,
.page-leave-active {
    transition: opacity 0.4s ease;
}
.page-enter-from,
.page-leave-to {
    opacity: 0;
}
</style>
