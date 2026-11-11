/**
 * What both looks of the agenda block calculate (Plan.md 118; the block "Liedblatt" reads the same agenda, Plan.md 121 B): the stage's time carried on by a local second, what the live
 * agenda shows at that time, the countdown as number and unit, and the delay in minutes.
 */
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { agendaDisplay, pickEvent } from '../../agenda/live';
import type { Block } from '../../model/schema';
import { useStageContext } from '../context';
import { tp } from '../../i18n/player';

export function useAgenda(block: () => Extract<Block, { type: 'agenda' | 'songsheet' }>) {
    const context = useStageContext();

    /** The stage's time, carried on by a local second: `context.now` plus what passed since it was set. */
    const since = ref(Date.now());
    const tick = ref(Date.now());
    watch(
        () => context.now,
        () => (since.value = tick.value = Date.now()),
    );
    const timer = setInterval(() => (tick.value = Date.now()), 1000);
    onBeforeUnmount(() => clearInterval(timer));
    const nowMs = computed(() => context.now.getTime() + (tick.value - since.value));

    /** The event the block follows among those of its calendars. */
    const pick = computed(() => {
        const feed = context.agenda;
        if (!feed) return null;
        const events = feed.events.filter((e) => block().calendarIds.includes(e.calendarId));
        return pickEvent(events, feed.positions, nowMs.value);
    });
    const display = computed(() => agendaDisplay(pick.value, nowMs.value));

    /** The number of the countdown and its unit: whole minutes from a minute up, seconds below; a spent countdown keeps its minus. */
    const circle = computed(() => {
        const seconds = display.value?.countdownSeconds;
        if (seconds === null || seconds === undefined) return null;
        const sign = seconds < 0 ? '−' : '';
        const abs = Math.abs(seconds);
        if (abs >= 60) {
            const minutes = Math.ceil(abs / 60);
            return { value: `${sign}${minutes}`, unit: tp.agenda.minutes(minutes), negative: seconds < 0 };
        }
        return { value: `${sign}${abs}`, unit: tp.agenda.seconds(abs), negative: seconds < 0 };
    });

    /** Minutes late, rounded; late = positive. */
    const lateMinutes = computed(() => {
        const seconds = display.value?.delaySeconds;
        return seconds === null || seconds === undefined ? null : Math.round(seconds / 60);
    });

    /** How much of the current point is left, 0 … 1 – the ring empties like the one of ChurchTools. */
    const left = computed(() => {
        const seconds = display.value?.countdownSeconds;
        const length = display.value?.lengthSeconds;
        if (seconds === null || seconds === undefined || !length || length <= 0) return 0;
        return Math.min(1, Math.max(0, seconds / length));
    });

    return { context, nowMs, pick, display, circle, lateMinutes, left };
}
