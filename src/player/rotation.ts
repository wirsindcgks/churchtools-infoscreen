/**
 * The slide rotation, shared by the player and the editor's preview so that
 * the preview runs exactly like the TV: each slide for its duration – or
 * longer, when a paged list on it needs more time for all its pages
 * (Plan.md, 23). The page count is known only once the list has measured
 * itself, so the time is checked again when it runs out rather than fixed
 * at the start.
 */
import { computed, onBeforeUnmount, ref, watch, type Ref } from 'vue';
import type { SlideDoc } from '../model/schema';
import { slideSeconds } from './paging';

/** A slide's place among the slides the rotation shows (the enabled ones), from 1; 0 where it is not among them. */
export function placeInRotation(slides: readonly SlideDoc[], slideId: string): { number: number; total: number } {
    const shown = slides.filter((s) => s.enabled);
    return { number: shown.findIndex((s) => s.id === slideId) + 1, total: shown.length };
}

/** How long a slide stays at least after a viewer has paged to it (s); Plan.md 127 A, adjustable per screen later (127 B). */
export const KIOSK_WAIT_SECONDS = 30;

export function useRotation(slides: Readonly<Ref<SlideDoc[]>>, pages: () => Readonly<Record<string, number>>) {
    const index = ref(0);
    /** The preview can hold a slide; the player never pauses. */
    const paused = ref(false);
    const current = computed(() => (slides.value.length ? slides.value[index.value % slides.value.length] : null));

    /** When the slide on show began (ms) – what a progress bar counts from. */
    const startedAt = ref(Date.now());
    /** Milliseconds the slide had run when it was held; `null` while it runs. */
    const heldAt = ref<number | null>(null);
    /** The least time (s) the slide on show stays after a viewer paged to it; 0 when the slide runs on its own time. */
    const minimum = ref(0);
    /** The slide a step landed on: a duration change caused by the step itself keeps the minimum. */
    let steppedTo: string | undefined;
    /** How long the slide on show stays (s); grows once a paged list has measured its pages, or by the minimum. */
    const seconds = computed(() => (current.value ? Math.max(slideSeconds(current.value, pages()), minimum.value) : 0));

    let rotation: ReturnType<typeof setTimeout> | undefined;
    function scheduleNext(): void {
        begin(0);
    }
    function begin(least: number): void {
        clearTimeout(rotation);
        minimum.value = least;
        if (least === 0) steppedTo = undefined;
        if (paused.value) return;
        const began = Date.now();
        startedAt.value = began;
        heldAt.value = null;
        const wait = (ms: number) => {
            rotation = setTimeout(() => {
                const needed = (current.value ? Math.max(slideSeconds(current.value, pages()), least) : 10) * 1000;
                const left = needed - (Date.now() - began);
                if (left > 100) return wait(left);
                index.value = slides.value.length ? (index.value + 1) % slides.value.length : 0;
                scheduleNext();
            }, ms);
        };
        wait(Math.max(current.value?.durationSeconds ?? 10, least) * 1000);
    }

    /** One slide forward or back, and the full time for it – at least `minSeconds`, counted from now. */
    function step(by: number, minSeconds = 0): void {
        const count = slides.value.length;
        if (!count) return;
        index.value = (((index.value + by) % count) + count) % count;
        // Held, the new slide has not run yet: its bar stands at the start.
        if (paused.value) {
            startedAt.value = Date.now();
            heldAt.value = 0;
        }
        steppedTo = minSeconds > 0 ? current.value?.id : undefined;
        begin(minSeconds);
    }

    function setPaused(value: boolean): void {
        paused.value = value;
        if (value && heldAt.value === null) heldAt.value = Date.now() - startedAt.value;
        scheduleNext();
    }

    // A changed duration applies at once, not only after the current slide has run out.
    watch(
        () => current.value?.durationSeconds,
        () => begin(current.value?.id === steppedTo ? minimum.value : 0),
    );
    // After a change the rotation stays on the slide it shows; only if that slide is gone
    // (or another playlist took over) does it start from the beginning.
    // Compared as a string: the list may be recomputed every second (it depends on the clock),
    // and a new array each time must not count as a change – that would stall the rotation.
    watch(
        () => slides.value.map((s) => s.id).join(','),
        (joined, previousJoined) => {
            const ids = joined ? joined.split(',') : [];
            const previous = previousJoined ? previousJoined.split(',') : [];
            const shown = previous[index.value % Math.max(previous.length, 1)];
            const position = shown ? ids.indexOf(shown) : -1;
            index.value = position >= 0 ? position : 0;
            scheduleNext();
        },
    );
    onBeforeUnmount(() => clearTimeout(rotation));

    return { index, current, paused, startedAt, heldAt, seconds, scheduleNext, step, setPaused };
}
