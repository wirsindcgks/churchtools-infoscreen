<script setup lang="ts">
/**
 * One appointment of a list – shown, and measured for the pages in the same
 * markup, so that what was measured is what shows. `cards` follows the list of
 * the WordPress plugin (Plan.md, 20): date tile, calendar label, title,
 * subtitle, and date, time and place one below the other.
 */
import type { Appointment } from '../../appointments/normalize';
import { formatDate, formatShortDate, timeRange } from '../format';
import CalendarBadge from './CalendarBadge.vue';
import DateTile from './DateTile.vue';

/** `measuring`: a row of the hidden copy – not to be found as one that shows. */
defineProps<{ appointment: Appointment; layout: 'rows' | 'cards'; timeZone: string; measuring?: boolean }>();
</script>

<template>
    <li v-if="layout === 'cards'" class="row card" :data-testid="measuring ? undefined : 'list-card'">
        <DateTile :start="appointment.start" :time-zone="timeZone" :color="appointment.color" />
        <span class="card-body">
            <CalendarBadge :name="appointment.calendarName" :color="appointment.color" />
            <span class="title">{{ appointment.title }}</span>
            <span v-if="appointment.subtitle" class="subtitle">{{ appointment.subtitle }}</span>
            <span class="card-meta">
                <span class="meta-item">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5.5" width="16" height="15" rx="2" /><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" /></svg>
                    {{ formatDate(appointment.start, timeZone) }}
                </span>
                <span class="meta-item">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></svg>
                    {{ timeRange(appointment) }}
                </span>
                <span v-if="appointment.location" class="meta-item">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-6.5-6.2-6.5-11a6.5 6.5 0 0 1 13 0c0 4.8-6.5 11-6.5 11z" /><circle cx="12" cy="10" r="2.3" /></svg>
                    {{ appointment.location }}
                </span>
            </span>
        </span>
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
/* The plugin's row: the tile in the middle of its height, the text beside it. */
.card {
    display: flex;
    align-items: center;
    gap: 0.9em;
    padding: 0.55em 0;
}
.card-body {
    display: grid;
    justify-items: start;
    gap: 0.2em;
    min-width: 0;
}
.card .title {
    max-width: 100%;
    font-weight: 700;
    line-height: 1.15;
}
.subtitle {
    max-width: 100%;
    overflow: hidden;
    font-size: 0.72em;
    opacity: 0.75;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.card-meta {
    display: grid;
    gap: 0.15em;
    margin-top: 0.1em;
    font-size: 0.68em;
    font-weight: 600;
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
