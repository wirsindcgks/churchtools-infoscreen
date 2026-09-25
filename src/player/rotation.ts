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

export function useRotation(slides: Readonly<Ref<SlideDoc[]>>, pages: () => Readonly<Record<string, number>>) {
    const index = ref(0);
    /** The preview can hold a slide; the player never pauses. */
    const paused = ref(false);
    const current = computed(() => (slides.value.length ? slides.value[index.value % slides.value.length] : null));

    let rotation: ReturnType<typeof setTimeout> | undefined;
    function scheduleNext(): void {
        clearTimeout(rotation);
        if (paused.value) return;
        const startedAt = Date.now();
        const wait = (ms: number) => {
            rotation = setTimeout(() => {
                const needed = (current.value ? slideSeconds(current.value, pages()) : 10) * 1000;
                const left = needed - (Date.now() - startedAt);
                if (left > 100) return wait(left);
                index.value = slides.value.length ? (index.value + 1) % slides.value.length : 0;
                scheduleNext();
            }, ms);
        };
        wait((current.value?.durationSeconds ?? 10) * 1000);
    }

    /** One slide forward or back, and the full time for it. */
    function step(by: number): void {
        const count = slides.value.length;
        if (!count) return;
        index.value = (((index.value + by) % count) + count) % count;
        scheduleNext();
    }

    function setPaused(value: boolean): void {
        paused.value = value;
        scheduleNext();
    }

    // A changed duration applies at once, not only after the current slide has run out.
    watch(
        () => current.value?.durationSeconds,
        () => scheduleNext(),
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

    return { index, current, paused, scheduleNext, step, setPaused };
}
