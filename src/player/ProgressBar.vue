<script setup lang="ts">
/**
 * The thin bar at the bottom of the stage that shows how long the slide stays (schema 1.39, Plan.md 86), lifted off the
 * edge like the page bar of the appointment list, with the number of the slide beside it. One CSS
 * transition over the time that is left – no frame loop and no recount every second, which a Pi would feel. A new
 * slide starts it at 0; a changed duration continues it from where it stands; a held preview freezes it.
 */
import { computed, onMounted, ref, watch } from 'vue';

/** The gap to the left, right and bottom edge of the stage (stage pixels), the same on all three sides. */
const INSET = 32;

const props = defineProps<{
    /** When the slide began (ms). */
    startedAt: number;
    /** How long it stays (s). */
    seconds: number;
    /** Milliseconds it had run when held; `null` while it runs. */
    held: number | null;
    /** Distance from the stage's bottom edge – the height of a band standing there. */
    bottom: number;
    /** The bar's colour: the theme's accent. */
    color: string;
    /** The pale track and the number: the theme's text colour, in its font. */
    textColor: string;
    fontFamily: string;
    /** Place of the slide in the playlist, from 1, and how many there are; the number shows from two on. */
    number: number;
    total: number;
    /** Plan.md 107: a line flush with the sides and the bottom, without the number, instead of the pill set off from the edge. */
    edge?: boolean;
    /** Plan.md 109: one track per slide instead of one for the whole – the finished ones full, the running one fills, no number. */
    segments?: boolean;
}>();

const bar = ref<HTMLElement | null>(null);
/** The running slide among the segments, from 0. */
const current = computed(() => Math.min(Math.max(props.number - 1, 0), Math.max(props.total - 1, 0)));
function setBar(el: unknown): void {
    if (el) bar.value = el as HTMLElement;
}

function apply(): void {
    const el = bar.value;
    if (!el) return;
    const total = Math.max(props.seconds, 0.1) * 1000;
    const elapsed = Math.min(Math.max(props.held ?? Date.now() - props.startedAt, 0), total);
    el.style.transition = 'none';
    el.style.transform = `scaleX(${elapsed / total})`;
    if (props.held !== null) return;
    // The start value must be painted before the transition is set, or it jumps straight to the end.
    void el.offsetWidth;
    el.style.transition = `transform ${total - elapsed}ms linear`;
    el.style.transform = 'scaleX(1)';
}

onMounted(apply);
watch(() => [props.startedAt, props.seconds, props.held, props.number, props.segments], apply, { flush: 'post' });
</script>

<template>
    <div
        class="progress"
        :class="{ 'progress--edge': edge }"
        :style="edge ? { left: 0, right: 0, bottom: `${bottom}px`, color: textColor, fontFamily } : { left: `${INSET}px`, right: `${INSET}px`, bottom: `${bottom + INSET}px`, color: textColor, fontFamily }"
        data-testid="slide-progress"
    >
        <div v-if="segments" class="segments">
            <div v-for="index in Math.max(total, 1)" :key="index" class="track" data-testid="slide-segment">
                <div v-if="index - 1 < current" class="fill fill--done" :style="{ background: color }" />
                <div v-else-if="index - 1 === current" :ref="setBar" class="fill" :style="{ background: color }" />
            </div>
        </div>
        <div v-else class="track">
            <div ref="bar" class="fill" :style="{ background: color }" />
        </div>
        <span v-if="!segments && total > 1 && !edge" class="slide-number" data-testid="slide-number">{{ number }}/{{ total }}</span>
    </div>
</template>

<style scoped>
/* On top of the blocks, in stage pixels; the same look as the page bar of AppointmentListView. */
.progress {
    position: absolute;
    z-index: var(--progress-z, 6);
    display: flex;
    align-items: center;
    gap: 0.6em;
    font-size: 24px;
    pointer-events: none;
}
.track {
    position: relative;
    flex: 1;
    height: 0.3em;
    overflow: hidden;
    border-radius: var(--isd-pill, 999px);
}
.segments {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 0.3em;
}
.progress--edge .track {
    border-radius: 0;
}
/* The pale track as its own layer – an opacity on .track would pale the bar too. */
.track::before {
    content: '';
    position: absolute;
    inset: 0;
    background: currentColor;
    opacity: 0.25;
}
.fill {
    position: relative;
    width: 100%;
    height: 100%;
    transform: scaleX(0);
    transform-origin: left;
    will-change: transform;
}
.fill--done {
    transform: scaleX(1);
}
.slide-number {
    opacity: 0.6;
    line-height: 1;
    white-space: nowrap;
    text-box: trim-both cap alphabetic;
}
</style>
