<script setup lang="ts">
/**
 * The countdown of the block "Ablauf" in a ring that empties (Plan.md 118), shared by both looks: the number large, the unit
 * small beneath it. `warn` turns the number red once the countdown is spent; `scaled` sizes the number from the ring instead of
 * the text, for the card of the look "Kacheln", where the ring is the part read from the stage.
 */
import { themeOf, useStageContext } from '../context';

defineProps<{
    circle: { value: string; unit: string; negative: boolean };
    /** How much of the point is left, 0 … 1. */
    left: number;
    diameter: number;
    testid: string;
    warn?: boolean;
    scaled?: boolean;
}>();
const context = useStageContext();
</script>

<template>
    <div class="circle" :style="{ width: `${diameter}px`, height: `${diameter}px`, ...(scaled ? { fontSize: `${diameter * 0.3}px` } : {}) }" :data-testid="testid">
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
        <span class="count" :class="{ 'count--spent': warn && circle.negative }">{{ circle.value }}</span>
        <span class="unit">{{ circle.unit }}</span>
    </div>
</template>

<style scoped>
.circle {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    position: relative;
    box-sizing: border-box;
    flex: none;
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
.count--spent {
    color: #e5484d;
}
.unit {
    font-size: 0.35em;
    opacity: 0.8;
}
</style>
