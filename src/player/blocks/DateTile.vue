<script setup lang="ts">
/** The date as a tile – day large, month small – tinted in the calendar's colour (Plan.md, 20). */
import { computed } from 'vue';
import { dateTile, withAlpha } from '../format';

const props = defineProps<{ start: Date; timeZone: string; color: string | null }>();
const tile = computed(() => dateTile(props.start, props.timeZone));
const background = computed(() => withAlpha(props.color, 0.28) ?? 'rgba(255, 255, 255, 0.12)');
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
    border-radius: 0.3em;
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
