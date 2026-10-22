<script setup lang="ts">
/**
 * The thin bar at the bottom edge of a block that fills up over the time one page (post, picture) stays – how long until
 * the next (schema 1.47, Plan.md 105). The same pill track and bar as the page bar of AppointmentListView.vue, lifted off
 * the edge, with the page number beside it like there; at the edge without. The parent restarts it with a `:key`
 * whenever the page changes; sizes are stage pixels.
 */
/** `color` tints the pale track and the number; without it the block's text colour does – a gallery has none of its own.
 * `number` counts from 1 and shows beside the bar from two pages on. */
defineProps<{ seconds: number; size: number; inset: number; color?: string; edge?: boolean; number?: number; total?: number }>();
</script>

<template>
    <div
        class="page-progress"
        :class="{ 'page-progress--edge': edge }"
        :style="{ fontSize: `${size / 0.3}px`, right: `${edge ? 0 : inset}px`, bottom: `${edge ? 0 : inset}px`, left: `${edge ? 0 : inset}px`, color }"
        data-testid="page-progress"
        aria-hidden="true"
    >
        <span class="track" :style="{ height: `${size}px` }">
            <span class="progress" data-testid="page-progress-bar" :style="{ animationDuration: `${seconds}s` }" />
        </span>
        <span v-if="!edge && number && total && total > 1" class="page-number" data-testid="page-progress-number">{{ number }}/{{ total }}</span>
    </div>
</template>

<style scoped>
/* Over the content, never in its way. */
.page-progress {
    position: absolute;
    z-index: 3;
    display: flex;
    align-items: center;
    gap: 0.6em;
    pointer-events: none;
}
.track {
    position: relative;
    flex: 1;
    overflow: hidden;
    border-radius: var(--isd-pill, 999px);
}
/* Plan.md 107: flush with the sides and the bottom, square. */
.page-progress--edge .track {
    border-radius: 0;
}
/* The pale track as its own layer – an opacity on the track would pale the bar too. */
.track::before {
    content: '';
    position: absolute;
    inset: 0;
    background: currentColor;
    opacity: 0.25;
}
/* Its own layer, scaled from nothing to full: the compositor draws it, nothing is laid out again. */
.progress {
    position: relative;
    display: block;
    width: 100%;
    height: 100%;
    background: var(--isd-accent, currentColor);
    transform-origin: left;
    animation: page-progress linear forwards;
}
@keyframes page-progress {
    from {
        transform: scaleX(0);
    }
    to {
        transform: scaleX(1);
    }
}
/* As in AppointmentListView.vue (Plan.md 47): the figures, not the line, decide the middle. */
.page-number {
    opacity: 0.6;
    line-height: 1;
    white-space: nowrap;
    text-box: trim-both cap alphabetic;
}
</style>
