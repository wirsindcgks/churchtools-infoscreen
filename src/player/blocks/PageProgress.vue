<script setup lang="ts">
/**
 * The thin bar at the bottom edge of a block that fills up over the time one page (post, picture) stays – how long until
 * the next (schema 1.47, Plan.md 105). The same pill track and bar as the page bar of AppointmentListView.vue, lifted off
 * the edge, without the page number. The parent restarts it with a `:key` whenever the page changes; sizes are stage pixels.
 */
/** `color` tints the pale track; without it the block's text colour does – a gallery has none of its own. */
defineProps<{ seconds: number; size: number; inset: number; color?: string }>();
</script>

<template>
    <div class="page-progress" :style="{ height: `${size}px`, right: `${inset}px`, bottom: `${inset}px`, left: `${inset}px`, color }" data-testid="page-progress" aria-hidden="true">
        <span class="progress" data-testid="page-progress-bar" :style="{ animationDuration: `${seconds}s` }" />
    </div>
</template>

<style scoped>
/* Over the content, never in its way. */
.page-progress {
    position: absolute;
    z-index: 3;
    overflow: hidden;
    border-radius: var(--isd-pill, 999px);
    pointer-events: none;
}
/* The pale track as its own layer – an opacity on the track would pale the bar too. */
.page-progress::before {
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
</style>
