<script setup lang="ts">
/**
 * One appointment of a list – shown, and measured for the pages in the same
 * markup, so that what was measured is what shows. `cards` takes the parts of
 * the WordPress plugin's list (Plan.md, 20) and sets them in one line: date
 * tile, day over time, title with subtitle and place, the category at the end.
 */
import type { Appointment } from '../../appointments/normalize';
import { formatDate, formatShortDate, timeRange } from '../format';
import CalendarBadge from './CalendarBadge.vue';
import DateTile from './DateTile.vue';

/** `measuring`: a row of the hidden copy – not to be found as one that shows. */
defineProps<{ appointment: Appointment; layout: 'rows' | 'cards'; timeZone: string; measuring?: boolean }>();
</script>

<template>
    <!-- One line from left to right: tile, day over time, title, and the category at the end (2026-09-25). -->
    <li v-if="layout === 'cards'" class="row card" :data-testid="measuring ? undefined : 'list-card'">
        <DateTile :start="appointment.start" :time-zone="timeZone" :color="appointment.color" />
        <span class="card-when">
            <span class="meta-item">
                <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5.5" width="16" height="15" rx="2" /><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" /></svg>
                {{ formatDate(appointment.start, timeZone) }}
            </span>
            <span class="meta-item">
                <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></svg>
                {{ timeRange(appointment) }}
            </span>
        </span>
        <span class="card-body">
            <span class="title">{{ appointment.title }}</span>
            <span v-if="appointment.subtitle" class="subtitle">{{ appointment.subtitle }}</span>
            <span v-if="appointment.location" class="meta-item place">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-6.5-6.2-6.5-11a6.5 6.5 0 0 1 13 0c0 4.8-6.5 11-6.5 11z" /><circle cx="12" cy="10" r="2.3" /></svg>
                {{ appointment.location }}
            </span>
        </span>
        <CalendarBadge class="card-badge" :name="appointment.calendarName" :color="appointment.color" />
    </li>
    <li v-else class="row">
        <span class="when">{{ formatShortDate(appointment.start, timeZone) }}</span>
        <span class="time">{{ appointment.allDay ? 'ganztägig' : appointment.startTime }}</span>
        <span class="title">{{ appointment.title }}</span>
    </li>
</template>

<style scoped>
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
/*
 * The plugin's parts in one line: tile, day and time in a column of fixed width – so every title starts at the
 * same place –, the title taking the rest, the category at the right end.
 */
.card {
    grid-template-columns: auto 9em minmax(0, 1fr) auto;
    align-items: center;
    gap: 0.9em;
    padding: 0.55em 0;
}
.card-when {
    display: grid;
    gap: 0.15em;
    min-width: 0;
    font-size: 0.68em;
    font-weight: 600;
}
.card-body {
    display: grid;
    justify-items: start;
    gap: 0.15em;
    min-width: 0;
}
.card .title {
    max-width: 100%;
    font-weight: 700;
    line-height: 1.15;
}
.subtitle,
.place {
    max-width: 100%;
    font-size: 0.68em;
    opacity: 0.8;
}
.subtitle {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.card-badge {
    justify-self: end;
}
.meta-item {
    display: flex;
    align-items: center;
    gap: 0.45em;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
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
</style>
