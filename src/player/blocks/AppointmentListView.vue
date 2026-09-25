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
import { formatShortDate, textStyle } from '../format';
import { PAGE_SECONDS, pageInterval, paginate, rowsPerPage, SHOW_ALL_CAP } from '../paging';

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
function turnPages(): void {
    clearInterval(timer);
    page.value = 0;
    const count = pages.value.length;
    if (!props.block.showAll || count < 2 || context.paging === false) return;
    const seconds = pageInterval(props.block.pageSeconds ?? PAGE_SECONDS, props.slideSeconds ?? 0, count);
    timer = setInterval(() => (page.value = (page.value + 1) % count), seconds * 1000);
}

watch(
    () => [pages.value.length, props.block.showAll, props.block.pageSeconds, props.slideSeconds],
    () => turnPages(),
);
// Rows change height with font, size and block – and once the fonts have loaded.
watch(
    () => [props.block.style.fontFamily, props.block.style.fontSize, props.block.height, items.value.length > 0],
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
            <ul :key="page" class="list">
                <li v-for="a in shown" :key="a.key" class="row">
                    <span class="when">{{ formatShortDate(a.start, context.timeZone) }}</span>
                    <span class="time">{{ a.allDay ? 'ganztägig' : a.startTime }}</span>
                    <span class="title">{{ a.title }}</span>
                </li>
                <!-- An empty week is a normal state and must look like one, not like a failure. -->
                <li v-if="items.length === 0" class="empty">Keine Termine in den nächsten {{ block.horizonDays }} Tagen.</li>
            </ul>
        </Transition>
        <span v-if="pages.length > 1" class="page-number" data-testid="list-page">{{ page + 1 }}/{{ pages.length }}</span>
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
.empty {
    opacity: 0.7;
}
.page-number {
    position: absolute;
    right: 0;
    bottom: 0;
    font-size: 0.55em;
    opacity: 0.6;
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
