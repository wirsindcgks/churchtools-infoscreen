<script setup lang="ts">
/**
 * Upcoming appointments as a list. With "alle Termine" (schema 1.6, Plan.md,
 * Nächste Schritte 23) every appointment of the horizon shows: what does not
 * fit the block turns page by page, and the block reports its page count so
 * the rotation keeps the slide until every page has run.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { selectUpcoming } from '../../appointments/normalize';
import type { Block } from '../../model/schema';
import { useStageContext } from '../context';
import { formatShortDate, formatWeekday, textStyle, timeRange } from '../format';
import { PAGE_SECONDS, pageInterval, paginate, rowsPerPage, SHOW_ALL_CAP } from '../paging';
import CalendarBadge from './CalendarBadge.vue';
import DateTile from './DateTile.vue';

const props = defineProps<{ block: Extract<Block, { type: 'appointment-list' }>; slideSeconds?: number }>();
const context = useStageContext();

const items = computed(() =>
    selectUpcoming(context.appointments, {
        now: context.now,
        timeZone: context.timeZone,
        horizonDays: props.block.horizonDays,
        limit: props.block.showAll ? SHOW_ALL_CAP : props.block.limit,
        calendarIds: props.block.calendarIds,
    }),
);

/** Height of one row in stage pixels, measured; 0 until the list has been laid out. */
const rowHeight = ref(0);
const root = ref<HTMLElement | null>(null);

function measure(): void {
    // offsetHeight is layout size: the stage's scaling does not change it.
    const row = root.value?.querySelector<HTMLElement>('.row');
    if (row && row.offsetHeight > 0) rowHeight.value = row.offsetHeight;
}

const pages = computed(() =>
    props.block.showAll
        ? paginate(items.value, rowsPerPage(props.block.height, rowHeight.value, items.value.length))
        : [items.value],
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
// Rows change height with font, size and block – and once the fonts have loaded.
watch(
    [() => props.block.style.fontFamily, () => props.block.style.fontSize, () => props.block.height, () => items.value.length > 0],
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
    <div ref="root" class="paged" :style="textStyle(block.style)">
        <Transition name="page" mode="out-in">
            <ul :key="page" class="list" :class="{ 'list--cards': block.layout === 'cards' }">
                <template v-if="block.layout === 'cards'">
                    <!-- After the WordPress plugin's list; two fixed lines, so every row is as high as the measured one. -->
                    <li v-for="a in shown" :key="a.key" class="row card" data-testid="list-card">
                        <DateTile :start="a.start" :time-zone="context.timeZone" :color="a.color" />
                        <span class="card-body">
                            <span class="card-head">
                                <CalendarBadge :name="a.calendarName" :color="a.color" />
                                <span class="title">{{ a.title }}</span>
                            </span>
                            <span class="card-meta">
                                <span class="meta-item">
                                    <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></svg>
                                    {{ formatWeekday(a.start, context.timeZone) }}, {{ timeRange(a) }}
                                </span>
                                <span v-if="a.location" class="meta-item">
                                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-6.5-6.2-6.5-11a6.5 6.5 0 0 1 13 0c0 4.8-6.5 11-6.5 11z" /><circle cx="12" cy="10" r="2.3" /></svg>
                                    {{ a.location }}
                                </span>
                                <span v-else-if="a.subtitle" class="meta-item">{{ a.subtitle }}</span>
                            </span>
                        </span>
                    </li>
                </template>
                <template v-else>
                    <li v-for="a in shown" :key="a.key" class="row">
                        <span class="when">{{ formatShortDate(a.start, context.timeZone) }}</span>
                        <span class="time">{{ a.allDay ? 'ganztägig' : a.startTime }}</span>
                        <span class="title">{{ a.title }}</span>
                    </li>
                </template>
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
.row {
    display: grid;
    grid-template-columns: 6.5em 5.5em 1fr;
    gap: 0.5em;
    padding: 0.25em 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.15);
}
.when,
.time {
    font-variant-numeric: tabular-nums;
    opacity: 0.8;
}
.title {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.card {
    display: flex;
    grid-template-columns: none;
    align-items: center;
    gap: 0.6em;
    padding: 0.35em 0;
}
.card-body {
    display: grid;
    gap: 0.15em;
    min-width: 0;
}
.card-head {
    display: flex;
    align-items: center;
    gap: 0.5em;
    min-width: 0;
}
.card .title {
    font-weight: 700;
}
.card-meta {
    display: flex;
    gap: 1.2em;
    min-width: 0;
    font-size: 0.7em;
    opacity: 0.85;
    white-space: nowrap;
}
.meta-item {
    display: inline-flex;
    align-items: center;
    gap: 0.35em;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
}
.meta-item svg {
    flex: none;
    width: 1em;
    height: 1em;
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
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
    border-radius: 999px;
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
    background: currentColor;
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
