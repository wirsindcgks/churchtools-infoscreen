<script setup lang="ts">
/**
 * One room of the overview: name and way-finder on the left, what is booked
 * on the right. Shown, and measured for the pages in the same markup, so that
 * what was measured is what shows.
 */
import type { RoomRow } from '../../rooms/display';

/** `measuring`: a row of the hidden copy – not to be found as one that shows. */
defineProps<{ row: RoomRow; measuring?: boolean }>();
</script>

<template>
    <li class="row" :data-testid="measuring ? undefined : 'room-row'">
        <span class="who">
            <span class="name">{{ row.name }}</span>
            <span v-if="row.hint" class="hint">{{ row.hint }}</span>
        </span>
        <ul class="lines">
            <li v-for="line in row.lines" :key="line.key" class="line" :class="{ 'line--now': line.now }" :data-testid="measuring ? undefined : 'room-line'" :data-now="line.now ? '' : undefined">
                <span v-if="line.tomorrow" class="tomorrow">Morgen</span>
                <span class="time">{{ line.time }}</span>
                <span class="title">{{ line.title }}</span>
            </li>
        </ul>
    </li>
</template>

<style scoped>
.row {
    display: grid;
    grid-template-columns: minmax(0, 0.38fr) minmax(0, 1fr);
    align-items: start;
    gap: 0.9em;
    padding: 0.5em 0;
    border-bottom: 1px solid color-mix(in srgb, currentColor 15%, transparent);
}
.who {
    display: grid;
    justify-items: start;
    gap: 0.1em;
    min-width: 0;
}
.name {
    max-width: 100%;
    overflow: hidden;
    font-weight: 700;
    line-height: 1.15;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.hint {
    max-width: 100%;
    overflow: hidden;
    font-size: 0.62em;
    text-overflow: ellipsis;
    white-space: nowrap;
    opacity: 0.75;
}
.lines {
    display: grid;
    gap: 0.15em;
    min-width: 0;
    margin: 0;
    padding: 0;
    list-style: none;
}
.line {
    display: flex;
    align-items: baseline;
    gap: 0.6em;
    min-width: 0;
    padding: 0.05em 0.4em;
    font-size: 0.8em;
    border-left: 0.2em solid transparent;
}
/* The running booking: a tint of the accent behind the text, which keeps the slide's colour – readable on light and dark. */
.line--now {
    font-weight: 700;
    background: color-mix(in srgb, var(--isd-accent, currentColor) 22%, transparent);
    border-left-color: var(--isd-accent, currentColor);
    border-radius: 0 var(--isd-radius, 0.3em) var(--isd-radius, 0.3em) 0;
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
</style>
