<script setup lang="ts">
/**
 * The running order of the service in the layout of the live view of ChurchTools (schema 1.61, Plan.md 118): "JETZT" and the
 * current point above, "DANN" and the next below, the countdown in a circle at the right with the total time and the delay
 * under it. What is current comes from the position on the server (`src/agenda/live.ts`); this view counts the seconds itself,
 * like the countdown block. Before the agenda is read it shows nothing; read, but no event today, a short line. With `layout: 'card'` the cards of `AgendaCard.vue` take over.
 */
import { computed } from 'vue';
import type { Block } from '../../model/schema';
import { textStyle } from '../format';
import { tp } from '../../i18n/player';
import AgendaCard from './AgendaCard.vue';
import AgendaRing from './AgendaRing.vue';
import { useAgenda } from './use-agenda';

const props = defineProps<{ block: Extract<Block, { type: 'agenda' }> }>();
const { context, display, circle, lateMinutes, left } = useAgenda(() => props.block);

const showCircle = computed(() => props.block.showCountdown && circle.value !== null);
const showDelay = computed(() => props.block.showDelay && lateMinutes.value !== null);
const diameter = computed(() => Math.min(props.block.height * 0.62, props.block.width * 0.34));
</script>

<template>
    <AgendaCard v-if="display && block.layout === 'card'" :block="block" :display="display" :circle="circle" :late-minutes="lateMinutes" :left="left" />
    <div v-else-if="display" class="agenda" :style="textStyle(block.style)" data-testid="agenda">
        <div class="points">
            <div class="point">
                <div class="label" data-testid="agenda-now-label">{{ display.kind === 'soon' ? tp.agenda.soon : tp.agenda.now }}</div>
                <div class="title" data-testid="agenda-now">{{ display.title }}</div>
            </div>
            <div v-if="block.showNext && display.next !== null" class="point point--next">
                <div class="label" data-testid="agenda-next-label">{{ tp.agenda.next }}</div>
                <div class="title title--next" data-testid="agenda-next">{{ display.next }}</div>
            </div>
        </div>
        <div v-if="showCircle || showDelay" class="side">
            <AgendaRing v-if="showCircle && circle" :circle="circle" :left="left" :diameter="diameter" testid="agenda-circle" />
            <div v-if="showDelay && lateMinutes !== null" class="total">
                <span class="label">{{ tp.agenda.total }}</span>
                <span class="delay" :class="{ 'delay--late': lateMinutes > 0 }" data-testid="agenda-delay">{{ tp.agenda.delay(lateMinutes) }}</span>
            </div>
        </div>
    </div>
    <div v-else-if="context.agenda" class="empty" :style="textStyle(block.style)" data-testid="agenda-empty">{{ tp.agenda.none }}</div>
</template>

<style scoped>
/* Quiet on purpose: it says the screen works, not that something is wrong. */
.empty {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    font-size: 0.5em;
    opacity: 0.5;
    text-align: center;
}
.agenda {
    display: flex;
    align-items: stretch;
    gap: 0.8em;
    width: 100%;
    height: 100%;
    line-height: 1.15;
}
.points {
    display: flex;
    flex: 1;
    flex-direction: column;
    justify-content: space-between;
    min-width: 0;
}
.label {
    font-size: 0.4em;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    opacity: 0.7;
}
.title {
    font-weight: 700;
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    line-clamp: 3;
    -webkit-box-orient: vertical;
}
.title--next {
    font-size: 0.6em;
    font-weight: 600;
    opacity: 0.85;
    -webkit-line-clamp: 2;
    line-clamp: 2;
}
.side {
    display: flex;
    flex: none;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.4em;
}
.total {
    display: flex;
    flex-direction: column;
    align-items: center;
}
.delay {
    font-size: 0.5em;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
}
.delay--late {
    color: #e5484d;
}
</style>
