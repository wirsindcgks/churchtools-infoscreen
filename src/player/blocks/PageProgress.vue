<script setup lang="ts">
/**
 * The thin bar at the bottom edge of a block that fills up over the time one page (post, picture) stays – how long until
 * the next (schema 1.47, Plan.md 105). The same pill track and bar as the page bar of AppointmentListView.vue, lifted off
 * the edge, with the page number beside it like there; at the edge without. With `segments` (Plan.md 109) one segment
 * per page instead, without the number. Where nothing turns (`held`, the designer's stage) the bar stands at 40 %.
 * The parent restarts it with a `:key` whenever the page changes; sizes are stage pixels.
 */
import PageSegments from './PageSegments.vue';

/** `color` tints the pale track and the number; without it the block's text colour does – a gallery has none of its own.
 * `number` counts from 1 and shows beside the bar from two pages on. */
defineProps<{ seconds: number; size: number; inset: number; color?: string; edge?: boolean; number?: number; total?: number; segments?: boolean; held?: boolean }>();
</script>

<template>
    <div
        class="page-progress"
        :class="{ 'page-progress--edge': edge }"
        :style="{ '--segment-height': `${size}px`, '--segment-gap': `${size}px`, fontSize: `${size / 0.3}px`, right: `${edge ? 0 : inset}px`, bottom: `${edge ? 0 : inset}px`, left: `${edge ? 0 : inset}px`, color }"
        data-testid="page-progress"
        aria-hidden="true"
    >
        <PageSegments v-if="segments" :count="total ?? 1" :current="(number ?? 1) - 1" :seconds="held ? 0 : seconds" :held="held" :edge="edge" fill-testid="page-progress-bar" />
        <span v-else class="track" :style="{ height: `${size}px` }">
            <span v-if="!held" class="progress" data-testid="page-progress-bar" :style="{ animationDuration: `${seconds}s` }" />
            <span v-else class="progress progress--held" />
        </span>
        <span v-if="!segments && !edge && number && total && total > 1" class="page-number" data-testid="page-progress-number">{{ number }}/{{ total }}</span>
    </div>
</template>

<style scoped src="./page-bar.css"></style>
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
/* Plan.md 107: flush with the sides and the bottom, square. */
.page-progress--edge .track {
    border-radius: 0;
}
</style>
