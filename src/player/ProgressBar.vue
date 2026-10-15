<script setup lang="ts">
/**
 * The thin bar at the bottom of the stage that shows how long the slide stays (schema 1.39, Plan.md 86). One CSS
 * transition over the time that is left – no frame loop and no recount every second, which a Pi would feel. A new
 * slide starts it at 0; a changed duration continues it from where it stands; a held preview freezes it.
 */
import { onMounted, ref, watch } from 'vue';

const props = defineProps<{
    /** When the slide began (ms). */
    startedAt: number;
    /** How long it stays (s). */
    seconds: number;
    /** Milliseconds it had run when held; `null` while it runs. */
    held: number | null;
    /** Distance from the stage's bottom edge – the height of a band standing there. */
    bottom: number;
    color: string;
}>();

const bar = ref<HTMLElement | null>(null);

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
watch(() => [props.startedAt, props.seconds, props.held], apply, { flush: 'post' });
</script>

<template>
    <div class="progress" :style="{ bottom: `${bottom}px` }" data-testid="slide-progress">
        <div ref="bar" class="fill" :style="{ background: color }" />
    </div>
</template>

<style scoped>
/* On top of the blocks and on the band's upper edge. */
.progress {
    position: absolute;
    left: 0;
    right: 0;
    z-index: 6;
    height: 6px;
    pointer-events: none;
}
.fill {
    width: 100%;
    height: 100%;
    transform: scaleX(0);
    transform-origin: left;
    will-change: transform;
}
</style>
