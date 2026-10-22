<script setup lang="ts">
/**
 * The segments form of the page progress (schema 1.50, Plan.md 109): one segment per page, post, picture or slide.
 * The finished ones are full, the running one fills over the time of its page, the following ones show only the pale
 * track. Where the pages do not turn (the designer's stage), the first segment stands at 40 %. The parent sets the
 * thickness and the gap with `--segment-height` and `--segment-gap` and restarts the running one with a `:key` or by
 * changing `current`.
 */
defineProps<{
    /** How many segments there are. */
    count: number;
    /** The page on show, from 0. */
    current: number;
    /** Seconds the running segment takes to fill; 0 while nothing turns. */
    seconds: number;
    /** Nothing turns: the running segment stands still at 40 %. */
    held?: boolean;
    /** Flush with the edge: square instead of pill-shaped. */
    edge?: boolean;
    /** Test id of the running segment's fill. */
    fillTestid?: string;
}>();
</script>

<template>
    <span class="segments" :class="{ 'segments--edge': edge }" data-testid="page-segments">
        <span v-for="(_, index) in count" :key="index" class="track" data-testid="page-segment">
            <span v-if="index < current" key="complete" class="fill fill--done" />
            <span v-else-if="index === current && seconds" :key="`active-${current}`" class="fill fill--run" :data-testid="fillTestid" :style="{ animationDuration: `${seconds}s` }" />
            <span v-else-if="index === current && held" key="held" class="fill fill--held" />
        </span>
    </span>
</template>

<style scoped>
.segments {
    flex: 1;
    display: flex;
    align-items: center;
    gap: var(--segment-gap, 0.3em);
}
.track {
    position: relative;
    flex: 1;
    height: var(--segment-height, 0.3em);
    overflow: hidden;
    border-radius: var(--isd-pill, 999px);
}
.segments--edge .track {
    border-radius: 0;
}
/* The pale track as its own layer – an opacity on .track would pale the fill too. */
.track::before {
    content: '';
    position: absolute;
    inset: 0;
    background: currentColor;
    opacity: 0.25;
}
.fill {
    position: relative;
    display: block;
    width: 100%;
    height: 100%;
    background: var(--isd-accent, currentColor);
    transform-origin: left;
}
/* Scaled from nothing to full: the compositor draws it, nothing is laid out again. */
.fill--run {
    animation: segment-progress linear forwards;
}
.fill--held {
    transform: scaleX(0.4);
}
@keyframes segment-progress {
    from {
        transform: scaleX(0);
    }
    to {
        transform: scaleX(1);
    }
}
</style>
