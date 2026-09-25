<script setup lang="ts">
/**
 * "Gottesdienst beginnt in 12:34" (schema 1.10, Plan.md 32). It counts in
 * seconds on its own: the preview in the designer updates its clock only
 * every 30 s, the TV every second – both look alike this way.
 */
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import type { Block } from '../../model/schema';
import { useStageContext } from '../context';
import { countdownTo } from '../countdown';
import { formatDate, textStyle } from '../format';

const props = defineProps<{ block: Extract<Block, { type: 'countdown' }> }>();
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
const now = computed(() => new Date(context.now.getTime() + (tick.value - since.value)));

const state = computed(() =>
    countdownTo(context.appointments, {
        calendarIds: props.block.calendarIds,
        now: now.value,
        runningText: props.block.runningText ?? '',
    }),
);
</script>

<template>
    <div class="countdown" :style="textStyle(block.style)" data-testid="countdown">
        <template v-if="state.kind === 'until'">
            <div class="caption">
                {{ block.showTitle ? `${state.appointment.title} beginnt in` : 'Beginnt in' }}
            </div>
            <div class="time" data-testid="countdown-time">{{ state.text }}</div>
            <div class="when">
                {{ formatDate(state.appointment.start, context.timeZone) }}, {{ state.appointment.startTime }} Uhr
            </div>
        </template>
        <template v-else-if="state.kind === 'running'">
            <div v-if="block.showTitle" class="caption">{{ state.appointment.title }}</div>
            <div class="running" data-testid="countdown-running">{{ block.runningText }}</div>
        </template>
        <div v-else class="none">Kein Termin in Sicht</div>
    </div>
</template>

<style scoped>
.countdown {
    display: flex;
    flex-direction: column;
    justify-content: center;
    width: 100%;
    height: 100%;
    line-height: 1.1;
}
.caption,
.when {
    font-size: 0.32em;
    font-weight: 600;
    opacity: 0.85;
}
.caption {
    margin-bottom: 0.15em;
}
.time {
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
}
.when {
    margin-top: 0.3em;
    font-weight: 400;
}
.running {
    font-size: 0.6em;
}
.none {
    font-size: 0.3em;
    opacity: 0.6;
}
</style>
