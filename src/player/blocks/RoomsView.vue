<script setup lang="ts">
/**
 * Room occupancy (schema 1.16, Plan.md, Nächste Schritte 46): an overview of
 * the chosen rooms – page by page like the appointment list – or the door
 * sign of the first one. What is shown, and the privacy switch "Titel
 * zeigen", is decided in `src/rooms/display.ts`; what a booking may carry at
 * all in `src/rooms/normalize.ts`.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { Block } from '../../model/schema';
import { doorSign, emptyText, overviewRows } from '../../rooms/display';
import { useStageContext } from '../context';
import { textStyle } from '../format';
import { PAGE_SECONDS, pageInterval, paginateByHeight } from '../paging';
import RoomRow from './RoomRow.vue';

const props = defineProps<{ block: Extract<Block, { type: 'rooms' }>; slideSeconds?: number }>();
const context = useStageContext();

const rows = computed(() =>
    props.block.layout === 'overview'
        ? overviewRows(context.rooms ?? [], props.block.rooms, context.now, context.timeZone, props.block.days)
        : [],
);
/**
 * None of the block's rooms came back – no right for any of them, or all deleted. That is not the same as
 * "nothing booked" (AGENTS.md: an empty list proves nothing), so the overview says so; the setup page names
 * the missing right.
 */
const unreadable = computed(
    () => props.block.rooms.length > 0 && !props.block.rooms.some((e) => (context.rooms ?? []).some((r) => r.resourceId === e.resourceId)),
);
const door = computed(() =>
    props.block.layout === 'door'
        ? doorSign(context.rooms ?? [], props.block.rooms, context.now, context.timeZone, props.block.days)
        : null,
);

// --- pages of the overview: as many whole rooms as fit, measured in a hidden copy ---

const heights = ref<number[]>([]);
const measureList = ref<HTMLElement | null>(null);
function measure(): void {
    const items = measureList.value?.querySelectorAll<HTMLElement>(':scope > .row');
    heights.value = items ? [...items].map((row) => row.offsetHeight) : [];
}

/** The page bar at the bottom: 0.55em text and a little air, like AppointmentListView's. */
const reserve = computed(() => props.block.style.fontSize * 0.9);
const pages = computed(() => paginateByHeight(rows.value, heights.value, props.block.height, reserve.value));
const page = ref(0);
const shown = computed(() => pages.value[page.value % Math.max(1, pages.value.length)] ?? []);

// Tell the rotation how many pages there are – the door sign is one.
watch(
    () => (props.block.layout === 'overview' ? Math.max(1, pages.value.length) : 1),
    (count) => {
        if (context.pages) context.pages[props.block.id] = count;
    },
    { immediate: true },
);

let timer: ReturnType<typeof setInterval> | undefined;
/** Seconds one page shows while the pages turn; 0 while they do not. */
const turnSeconds = ref(0);
function turnPages(): void {
    clearInterval(timer);
    page.value = 0;
    turnSeconds.value = 0;
    const count = pages.value.length;
    if (props.block.layout !== 'overview' || count < 2 || context.paging === false) return;
    turnSeconds.value = pageInterval(props.block.pageSeconds ?? PAGE_SECONDS, props.slideSeconds ?? 0, count);
    timer = setInterval(() => (page.value = (page.value + 1) % count), turnSeconds.value * 1000);
}
// Separate sources, each compared by value – the clock must not start the pages over.
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
        () => rows.value.map((r) => `${r.resourceId}:${r.lines.map((l) => l.key).join('+')}`).join(),
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
    <!-- Nothing chosen yet: a calm placeholder, like the gallery. -->
    <div v-if="block.rooms.length === 0" class="placeholder" :style="textStyle(block.style)" data-testid="rooms-placeholder">
        Räume wählen
    </div>

    <div v-else-if="block.layout === 'door'" class="door" :style="textStyle(block.style)" data-testid="rooms-door">
        <template v-if="door">
            <div class="door-name" data-testid="door-name">{{ door.name }}</div>
            <div v-if="door.hint" class="door-hint" data-testid="door-hint">{{ door.hint }}</div>
            <div class="door-state" :class="door.current ? 'door-state--busy' : 'door-state--free'" data-testid="door-state">
                <div class="door-label">Jetzt</div>
                <template v-if="door.current">
                    <div class="door-title" data-testid="door-current">{{ door.current.title }}</div>
                    <div class="door-until">{{ door.current.until }}</div>
                </template>
                <template v-else>
                    <div class="door-title" data-testid="door-current">Frei</div>
                    <div v-if="door.freeUntil" class="door-until">{{ door.freeUntil }}</div>
                </template>
            </div>
            <div v-if="door.next.length" class="door-next" data-testid="door-next">
                <div class="door-label">Danach</div>
                <ul class="door-list">
                    <li v-for="line in door.next" :key="line.key" class="door-line" data-testid="door-line">
                        <span v-if="line.tomorrow" class="tomorrow">Morgen</span>
                        <span class="time">{{ line.time }}</span>
                        <span class="title">{{ line.title }}</span>
                    </li>
                </ul>
            </div>
        </template>
        <div v-else class="door-gone" data-testid="door-gone">Raum nicht verfügbar</div>
    </div>

    <div v-else class="paged" :style="textStyle(block.style)" data-testid="rooms-overview">
        <!-- Every room once, invisible, in the same markup and width as the shown ones: for pages and whole rooms. -->
        <ul ref="measureList" class="list measure" aria-hidden="true">
            <RoomRow v-for="r in rows" :key="r.resourceId" :row="r" measuring />
        </ul>
        <Transition name="page" mode="out-in">
            <ul :key="page" class="list">
                <RoomRow v-for="r in shown" :key="r.resourceId" :row="r" />
                <!-- A day without bookings is a normal state and must look like one. -->
                <li v-if="unreadable" class="empty" data-testid="rooms-unreadable">Raumbelegung nicht verfügbar</li>
                <li v-else-if="rows.length === 0" class="empty" data-testid="rooms-empty">{{ emptyText(block.days) }}</li>
            </ul>
        </Transition>
        <div v-if="pages.length > 1" class="pager" data-testid="rooms-pager">
            <span class="track">
                <span
                    v-if="turnSeconds"
                    :key="page"
                    class="progress"
                    data-testid="rooms-progress"
                    :style="{ animationDuration: `${turnSeconds}s` }"
                />
            </span>
            <span class="page-number" data-testid="rooms-page">{{ page + 1 }}/{{ pages.length }}</span>
        </div>
    </div>
</template>

<style scoped>
.placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    /* No colour of its own beyond the slide's: a middle grey shows on light and dark slides alike (Plan.md 48). */
    background: rgba(128, 128, 128, 0.15);
    opacity: 0.85;
}
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
    padding: 0.25em 0;
    opacity: 0.7;
}

/* The door sign: the room large, then what is going on now, then what follows. */
.door {
    display: flex;
    flex-direction: column;
    gap: 0.25em;
    width: 100%;
    height: 100%;
    overflow: hidden;
}
.door-name {
    font-size: 1.8em;
    font-weight: 700;
    line-height: 1.1;
}
.door-hint {
    font-size: 0.7em;
    opacity: 0.75;
}
.door-state {
    margin-top: 0.5em;
    padding: 0.3em 0.6em 0.4em;
    border-left: 0.25em solid currentColor;
    border-radius: 0 var(--isd-radius, 0.3em) var(--isd-radius, 0.3em) 0;
    background: color-mix(in srgb, currentColor 8%, transparent);
}
.door-state--busy {
    border-left-color: var(--isd-accent, currentColor);
    background: color-mix(in srgb, var(--isd-accent, currentColor) 22%, transparent);
}
.door-label {
    font-size: 0.55em;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    opacity: 0.7;
}
.door-title {
    font-size: 1.3em;
    font-weight: 700;
    line-height: 1.15;
    overflow-wrap: anywhere;
}
.door-until {
    font-size: 0.75em;
    opacity: 0.85;
}
.door-next {
    margin-top: 0.4em;
    min-height: 0;
}
.door-list {
    margin: 0;
    padding: 0;
    list-style: none;
}
.door-line {
    display: flex;
    align-items: baseline;
    gap: 0.6em;
    padding: 0.2em 0;
    font-size: 0.8em;
    border-bottom: 1px solid color-mix(in srgb, currentColor 15%, transparent);
}
.door-gone {
    opacity: 0.7;
}
.time {
    flex: none;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
}
.title {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.tomorrow {
    flex: none;
    padding: 0 0.45em;
    font-size: 0.7em;
    font-weight: 600;
    line-height: 1.5;
    border: 1px solid currentColor;
    border-radius: var(--isd-pill, 999px);
    opacity: 0.8;
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
    line-height: 1;
    white-space: nowrap;
    text-box: trim-both cap alphabetic;
}
.page-enter-active,
.page-leave-active {
    transition: opacity 0.4s ease;
}
.page-enter-from,
.page-leave-to {
    opacity: 0;
}
</style>
