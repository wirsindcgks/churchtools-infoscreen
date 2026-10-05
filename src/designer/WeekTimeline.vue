<script setup lang="ts">
/**
 * A strip per day, 0 to 24 h, for the week-at-a-glance of a tile (Plan.md 68): it knows days and
 * stretches of minutes with a color, not what a stretch means – the page names them. A stretch with
 * `color: null` is "nothing here" (a notice that is not shown, Plan.md 69): a pale, inert area.
 * `highlight` is a key; every other stretch fades, so a line elsewhere can point at its stretches.
 */
export interface TimelineSegment {
    /** Minutes after local midnight, 0 to 1440; `end` is exclusive. */
    start: number;
    end: number;
    /** CSS color; `null` for nothing – a neutral area that cannot be picked. */
    color: string | null;
    /** What ties the stretch to a line elsewhere. */
    key: string;
    label: string;
}
export interface TimelineDay {
    /** Short name, two characters: "Mo". */
    label: string;
    /** The date in words, as tooltip of the row. */
    title: string;
    segments: TimelineSegment[];
}

defineProps<{
    days: TimelineDay[];
    /** The needle: on this day, at this minute. */
    now?: { dayIndex: number; minute: number };
    highlight?: string | null;
}>();
const emit = defineEmits<{
    hover: [key: string | null];
    pick: [pick: { dayIndex: number; segment: TimelineSegment }];
}>();
</script>

<template>
    <div class="week" data-testid="week-timeline">
        <div v-for="(day, dayIndex) in days" :key="dayIndex" class="day" :title="day.title" data-testid="week-day">
            <span class="label" aria-hidden="true">{{ day.label }}</span>
            <div class="strip">
                <template v-for="segment in day.segments" :key="segment.start">
                    <button
                        v-if="segment.color !== null"
                        type="button"
                        class="segment"
                        :class="{ dim: highlight != null && highlight !== segment.key }"
                        :style="{ flexGrow: segment.end - segment.start, background: segment.color }"
                        :aria-label="segment.label"
                        :title="segment.label"
                        :data-key="segment.key"
                        :data-dim="highlight != null && highlight !== segment.key"
                        data-testid="week-segment"
                        @click="emit('pick', { dayIndex, segment })"
                        @mouseenter="emit('hover', segment.key)"
                        @mouseleave="emit('hover', null)"
                        @focus="emit('hover', segment.key)"
                        @blur="emit('hover', null)"
                    />
                    <span
                        v-else
                        class="segment segment--none"
                        :style="{ flexGrow: segment.end - segment.start }"
                        :title="segment.label"
                        :data-key="segment.key"
                        data-testid="week-segment-none"
                    />
                </template>
                <span
                    v-if="now?.dayIndex === dayIndex"
                    class="needle"
                    :style="{ left: `${(now.minute / 1440) * 100}%` }"
                    aria-hidden="true"
                    data-testid="week-needle"
                />
            </div>
        </div>
        <div class="scale" aria-hidden="true">
            <span /><span class="ticks"><span>0</span><span>6</span><span>12</span><span>18</span><span>24</span></span>
        </div>
    </div>
</template>

<style scoped>
.week {
    display: grid;
    gap: 3px;
}
.day,
.scale {
    display: grid;
    grid-template-columns: 1.6rem minmax(0, 1fr);
    align-items: center;
    gap: 6px;
}
.label {
    color: var(--d-text-muted);
    font-size: var(--d-size-sm);
}
.strip {
    position: relative;
    display: flex;
    height: 10px;
    overflow: hidden;
    border-radius: 3px;
}
.segment {
    flex-basis: 0;
    min-width: 0;
    padding: 0;
    border: 0;
    border-right: 1px solid rgb(255 255 255 / 0.5);
    transition: opacity 0.12s;
}
button.segment {
    cursor: pointer;
}
.segment:last-of-type {
    border-right: 0;
}
.segment--none {
    background: var(--d-panel);
}
.segment.dim {
    opacity: 0.25;
}
button.segment:focus-visible {
    outline: 2px solid var(--d-accent);
    outline-offset: -2px;
}
.needle {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 2px;
    margin-left: -1px;
    background: var(--d-text);
    box-shadow: 0 0 0 1px var(--d-surface);
    pointer-events: none;
}
.ticks {
    display: flex;
    justify-content: space-between;
    color: var(--d-text-muted);
    font-size: 0.7rem;
}
</style>
