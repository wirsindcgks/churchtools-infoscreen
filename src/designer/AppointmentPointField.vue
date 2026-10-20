<script setup lang="ts">
/**
 * One end of an appointment rule's window, as the designer says it:
 * "[30] Min. [vor] [Beginn]" (Plan.md, Nächste Schritte 22).
 */
import { t } from '../i18n/designer';
import type { AppointmentPoint } from '../model/schema';
import SelectMenu from './SelectMenu.vue';

const DIRECTIONS = [
    { value: 'before', label: t.common.point.before },
    { value: 'after', label: t.common.point.after },
];
const ANCHORS = [
    { value: 'start', label: t.common.point.start },
    { value: 'end', label: t.common.point.end },
];

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
            :aria-label="t.common.point.minutes"
            data-testid="point-minutes"
            @input="setMinutes(($event.target as HTMLInputElement).value)"
        >
        {{ t.common.point.min }}
        <SelectMenu
            class="point-menu"
            :model-value="point.minutes < 0 ? 'before' : 'after'"
            :options="DIRECTIONS"
            :aria-label="t.common.point.directionLabel"
            testid="point-direction"
            @update:model-value="setDirection(String($event))"
        />
        <SelectMenu
            class="point-menu"
            :model-value="point.anchor"
            :options="ANCHORS"
            :aria-label="t.common.point.anchorLabel"
            testid="point-anchor"
            @update:model-value="setAnchor(String($event))"
        />
    </span>
</template>

<style scoped>
.point {
    display: inline-flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
}
.point input {
    width: auto;
}
.point .point-menu {
    flex: none;
}
.minutes {
    width: 5em !important;
}
</style>
