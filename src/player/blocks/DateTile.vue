<script setup lang="ts">
/** The date as a tile – day large, month small – tinted in the calendar's colour (Plan.md, 20). */
import { computed } from 'vue';
import { themeOf, useStageContext } from '../context';
import { dateTile, withAlpha } from '../format';

const props = defineProps<{ start: Date; timeZone: string; color: string | null }>();
const context = useStageContext();
const tile = computed(() => dateTile(props.start, props.timeZone));
// A calendar without a colour takes the theme's accent (Plan.md, 27).
const background = computed(() => withAlpha(props.color ?? themeOf(context).accent, 0.28) ?? 'rgba(255, 255, 255, 0.12)');
</script>

<template>
    <span class="tile" :style="{ background }">
        <span class="day">{{ tile.day }}</span>
        <span class="month">{{ tile.month }}</span>
    </span>
</template>

<style scoped>
.tile {
    display: inline-grid;
    flex: none;
    place-content: center;
    justify-items: center;
    width: 2.6em;
    height: 2.6em;
    border-radius: var(--isd-radius, 0.3em);
    line-height: 1;
}
.day {
    font-size: 1.15em;
    font-weight: 700;
}
.month {
    margin-top: 0.15em;
    font-size: 0.5em;
    letter-spacing: 0.08em;
    opacity: 0.85;
}
</style>
