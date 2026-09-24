<script setup lang="ts">
import { computed } from 'vue';
import { selectUpcoming } from '../../appointments/normalize';
import type { Block } from '../../model/schema';
import { useStageContext } from '../context';
import { formatShortDate, textStyle } from '../format';

const props = defineProps<{ block: Extract<Block, { type: 'appointment-list' }> }>();
const context = useStageContext();

const items = computed(() =>
    selectUpcoming(context.appointments, {
        now: context.now,
        timeZone: context.timeZone,
        horizonDays: props.block.horizonDays,
        limit: props.block.limit,
        calendarIds: props.block.calendarIds,
    }),
);
</script>

<template>
    <ul class="list" :style="textStyle(block.style)">
        <li v-for="a in items" :key="a.key" class="row">
            <span class="when">{{ formatShortDate(a.start, context.timeZone) }}</span>
            <span class="time">{{ a.allDay ? 'ganztägig' : a.startTime }}</span>
            <span class="title">{{ a.title }}</span>
        </li>
        <!-- An empty week is a normal state and must look like one, not like a failure. -->
        <li v-if="items.length === 0" class="empty">Keine Termine in den nächsten {{ block.horizonDays }} Tagen.</li>
    </ul>
</template>

<style scoped>
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
</style>
