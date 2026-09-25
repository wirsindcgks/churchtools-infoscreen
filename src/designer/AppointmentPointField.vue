<script setup lang="ts">
/**
 * One end of an appointment rule's window, as the designer says it:
 * "[30] Min. [vor] [Beginn]" (Plan.md, Nächste Schritte 22).
 */
import type { AppointmentPoint } from '../model/schema';

const props = defineProps<{ point: AppointmentPoint; label: string; testid: string }>();
const emit = defineEmits<{ change: [point: AppointmentPoint] }>();

function setMinutes(value: string): void {
    const n = Math.round(Number(value));
    if (value === '' || !Number.isFinite(n) || n < 0 || n > 24 * 60) return;
    emit('change', { ...props.point, minutes: props.point.minutes < 0 ? -n : n });
}

function setDirection(value: string): void {
    const n = Math.abs(props.point.minutes);
    emit('change', { ...props.point, minutes: value === 'before' ? -n : n });
}

function setAnchor(value: string): void {
    emit('change', { ...props.point, anchor: value === 'end' ? 'end' : 'start' });
}
</script>

<template>
    <span class="point" role="group" :aria-label="label" :data-testid="testid">
        <input
            class="minutes"
            type="number"
            min="0"
            max="1440"
            :value="Math.abs(point.minutes)"
            aria-label="Minuten"
            data-testid="point-minutes"
            @input="setMinutes(($event.target as HTMLInputElement).value)"
        >
        Min.
        <select
            :value="point.minutes < 0 ? 'before' : 'after'"
            aria-label="vor oder nach"
            data-testid="point-direction"
            @change="setDirection(($event.target as HTMLSelectElement).value)"
        >
            <option value="before">vor</option>
            <option value="after">nach</option>
        </select>
        <select
            :value="point.anchor"
            aria-label="Beginn oder Ende des Termins"
            data-testid="point-anchor"
            @change="setAnchor(($event.target as HTMLSelectElement).value)"
        >
            <option value="start">Beginn</option>
            <option value="end">Ende</option>
        </select>
    </span>
</template>

<style scoped>
.point {
    display: inline-flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
}
.point input,
.point select {
    width: auto;
}
.minutes {
    width: 5em !important;
}
</style>
