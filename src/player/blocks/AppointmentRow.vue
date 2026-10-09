<script setup lang="ts">
/**
 * One appointment of a list – shown, and measured for the pages in the same
 * markup, so that what was measured is what shows. `cards` takes the parts of
 * the WordPress plugin's list (Plan.md, 20) and sets them in one line: date
 * tile, day over time, title with subtitle and place, the category at the end.
 */
import { computed } from 'vue';
import type { Appointment } from '../../appointments/normalize';
import { formatDate, formatShortDate, WIDEST_DATE, placeLine, servicesLine, timeRange } from '../format';
import CalendarBadge from './CalendarBadge.vue';
import DateTile from './DateTile.vue';
import { tp } from '../../i18n/player';

/** `measuring`: a row of the hidden copy – not to be found as one that shows. */
const props = defineProps<{
    appointment: Appointment;
    layout: 'rows' | 'cards';
    timeZone: string;
    measuring?: boolean;
    /** The booked rooms beside the place – in the card form only (schema 1.16). */
    showRooms?: boolean;
    /** The services this block shows under the place – in the card form only (schema 1.17). */
    services?: number[];
}>();
const place = computed(() => placeLine(props.appointment, props.showRooms));
const widestDate = computed(() => formatDate(WIDEST_DATE, props.timeZone));
const people = computed(() => servicesLine(props.appointment, props.services));
</script>

<template>
    <!-- One line from left to right: tile, day over time, title, and the category at the end (2026-09-25). -->
    <li v-if="layout === 'cards'" class="row card" :data-testid="measuring ? undefined : 'list-card'">
        <DateTile :start="appointment.start" :time-zone="timeZone" :color="appointment.color" />
        <span class="card-when">
            <!-- The widest date there is, unseen: the column is as wide on every row and every page. -->
            <span class="meta-item card-measure" aria-hidden="true">
                <svg viewBox="0 0 24 24"><rect x="4" y="5.5" width="16" height="15" rx="2" /><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" /></svg>
                {{ widestDate }}
            </span>
            <span class="meta-item">
                <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5.5" width="16" height="15" rx="2" /><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" /></svg>
                {{ formatDate(appointment.start, timeZone) }}
            </span>
            <span class="meta-item">
                <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></svg>
                {{ timeRange(appointment) }}
            </span>
            <span v-if="place" class="card-place-box">
                <span class="meta-item card-place" :data-testid="measuring ? undefined : 'list-place'">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-6.5-6.2-6.5-11a6.5 6.5 0 0 1 13 0c0 4.8-6.5 11-6.5 11z" /><circle cx="12" cy="10" r="2.3" /></svg>
                    <span class="meta-text">{{ place }}</span>
                </span>
            </span>
        </span>
        <span class="card-body">
            <span class="title">{{ appointment.title }}</span>
            <span v-if="appointment.subtitle" class="subtitle">{{ appointment.subtitle }}</span>
            <span v-if="people" class="meta-item place" :data-testid="measuring ? undefined : 'list-services'">
                <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.5" /><path d="M5 20c0-3.9 3.1-6.5 7-6.5s7 2.6 7 6.5" /></svg>
                <span class="meta-text">{{ people }}</span>
            </span>
        </span>
        <CalendarBadge class="card-badge" :name="appointment.calendarName" :color="appointment.color" />
    </li>
    <li v-else class="row">
        <span class="when">{{ formatShortDate(appointment.start, timeZone) }}</span>
        <span class="time">{{ appointment.allDay ? tp.time.allDay : appointment.startTime }}</span>
        <span class="title">{{ appointment.title }}</span>
    </li>
</template>

<style scoped>
.row {
    display: grid;
    grid-template-columns: 6.5em 5.5em 1fr;
    gap: 0.5em;
    padding: 0.25em 0;
    border-bottom: 1px solid color-mix(in srgb, currentColor 15%, transparent);
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
    grid-template-columns: auto max-content minmax(0, 1fr) auto;
    align-items: center;
    gap: 0.9em;
    padding: 0.55em 0;
}
.card-when {
    display: grid;
    gap: 0.15em;
    min-width: 0;
    font-size: 0.68em;
    font-weight: 400;
}
.card-measure {
    height: 0;
    visibility: hidden;
}
/*
 * Place and room under day and time: they never widen the column, they end with an ellipsis. The box has no
 * width of its own – the line lies in it, taking the width the date gives (`width: 0; min-width: 100%` does not
 * resolve in a grid).
 */
.card-place-box {
    position: relative;
    height: 1.3em;
}
.card-place {
    position: absolute;
    inset: 0;
    font-weight: 400;
    opacity: 0.8;
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
.meta-text {
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
