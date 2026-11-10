<script setup lang="ts">
/**
 * The running order of the service in the layout of the live view of ChurchTools (schema 1.61, Plan.md 118): "JETZT" and the
 * current point above, "DANN" and the next below, the countdown in a circle at the right with the total time and the delay
 * under it. What is current comes from the position on the server (`src/agenda/live.ts`); this view counts the seconds itself,
 * like the countdown block. Without an event or a reading it shows nothing.
 */
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { agendaDisplay, pickEvent } from '../../agenda/live';
import type { Block } from '../../model/schema';
import { themeOf, useStageContext } from '../context';
import { textStyle } from '../format';
import { tp } from '../../i18n/player';

const props = defineProps<{ block: Extract<Block, { type: 'agenda' }> }>();
const context = useStageContext();

/** The stage's time, carried on by a local second: `context.now` plus what passed since it was set. */
const since = ref(Date.now());
const tick = ref(Date.now());
watch(
    () => context.now,
    () => (since.value = tick.value = Date.now()),
);
const timer = setInterval(() => (tick.value = Date.now()), 1000);
onBeforeUnmount(() => clearInterval(timer));
const nowMs = computed(() => context.now.getTime() + (tick.value - since.value));

const display = computed(() => {
    const feed = context.agenda;
    if (!feed) return null;
    const events = feed.events.filter((e) => props.block.calendarIds.includes(e.calendarId));
    return agendaDisplay(pickEvent(events, feed.positions, nowMs.value), nowMs.value);
});

/** The number in the circle and its unit: whole minutes from a minute up, seconds below; a spent countdown keeps its minus. */
const circle = computed(() => {
    const seconds = display.value?.countdownSeconds;
    if (seconds === null || seconds === undefined) return null;
    const sign = seconds < 0 ? '−' : '';
    const abs = Math.abs(seconds);
    if (abs >= 60) {
        const minutes = Math.ceil(abs / 60);
        return { value: `${sign}${minutes}`, unit: tp.agenda.minutes(minutes) };
    }
    return { value: `${sign}${abs}`, unit: tp.agenda.seconds(abs) };
});

/** Minutes late, rounded; late = positive. */
const lateMinutes = computed(() => {
    const seconds = display.value?.delaySeconds;
    return seconds === null || seconds === undefined ? null : Math.round(seconds / 60);
});

/** How much of the current point is left, 0 … 1 – the ring empties like the one of ChurchTools. */
const left = computed(() => {
    const seconds = display.value?.countdownSeconds;
    const length = display.value?.lengthSeconds;
    if (seconds === null || seconds === undefined || !length || length <= 0) return 0;
    return Math.min(1, Math.max(0, seconds / length));
});

const showCircle = computed(() => props.block.showCountdown && circle.value !== null);
const showDelay = computed(() => props.block.showDelay && lateMinutes.value !== null);
const diameter = computed(() => Math.min(props.block.height * 0.62, props.block.width * 0.34));
</script>

<template>
    <div v-if="display" class="agenda" :style="textStyle(block.style)" data-testid="agenda">
        <div class="points">
            <div class="point">
                <div class="label" data-testid="agenda-now-label">{{ display.kind === 'soon' ? tp.agenda.soon : tp.agenda.now }}</div>
                <div class="title" data-testid="agenda-now">{{ display.title }}</div>
            </div>
            <div v-if="display.next !== null" class="point point--next">
                <div class="label" data-testid="agenda-next-label">{{ tp.agenda.next }}</div>
                <div class="title title--next" data-testid="agenda-next">{{ display.next }}</div>
            </div>
        </div>
        <div v-if="showCircle || showDelay" class="side">
            <div
                v-if="showCircle && circle"
                class="circle"
                :style="{ width: `${diameter}px`, height: `${diameter}px` }"
                data-testid="agenda-circle"
            >
                <svg class="agenda-ring" viewBox="0 0 100 100" aria-hidden="true">
                    <circle class="agenda-ring-track" cx="50" cy="50" r="45" />
                    <circle
                        class="agenda-ring-left"
                        cx="50"
                        cy="50"
                        r="45"
                        pathLength="100"
                        :stroke="themeOf(context).accent"
                        :stroke-dasharray="`${left * 100} 100`"
                        data-testid="agenda-ring"
                    />
                </svg>
                <span class="count">{{ circle.value }}</span>
                <span class="unit">{{ circle.unit }}</span>
            </div>
            <div v-if="showDelay && lateMinutes !== null" class="total">
                <span class="label">{{ tp.agenda.total }}</span>
                <span class="delay" :class="{ 'delay--late': lateMinutes > 0 }" data-testid="agenda-delay">{{ tp.agenda.delay(lateMinutes) }}</span>
            </div>
        </div>
    </div>
</template>

<style scoped>
.agenda {
    display: flex;
    align-items: stretch;
    gap: 0.8em;
    width: 100%;
    height: 100%;
    line-height: 1.15;
}
.points {
    display: flex;
    flex: 1;
    flex-direction: column;
    justify-content: space-between;
    min-width: 0;
}
.label {
    font-size: 0.4em;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    opacity: 0.7;
}
.title {
    font-weight: 700;
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    line-clamp: 3;
    -webkit-box-orient: vertical;
}
.title--next {
    font-size: 0.6em;
    font-weight: 600;
    opacity: 0.85;
    -webkit-line-clamp: 2;
    line-clamp: 2;
}
.side {
    display: flex;
    flex: none;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.4em;
}
.circle {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    position: relative;
    box-sizing: border-box;
}
.agenda-ring {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    transform: rotate(-90deg);
}
.agenda-ring circle {
    fill: none;
    stroke-width: 9;
}
.agenda-ring-track {
    stroke: currentColor;
    opacity: 0.2;
}
.count {
    font-size: 1.3em;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    line-height: 1;
}
.unit {
    font-size: 0.35em;
    opacity: 0.8;
}
.total {
    display: flex;
    flex-direction: column;
    align-items: center;
}
.delay {
    font-size: 0.5em;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
}
.delay--late {
    color: #e5484d;
}
</style>
