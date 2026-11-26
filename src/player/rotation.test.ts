import { mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, nextTick, reactive, ref } from 'vue';
import type { Block, SlideDoc } from '../model/schema';
import { makeSlide } from '../model/testing';
import { PAGE_SECONDS } from './paging';
import { useRotation } from './rotation';

function setup(initial: SlideDoc[]) {
    const slides = ref(initial);
    const pages = reactive<Record<string, number>>({});
    let rotation!: ReturnType<typeof useRotation>;
    mount(
        defineComponent({
            setup() {
                rotation = useRotation(slides, () => pages);
                return () => null;
            },
        }),
    );
    rotation.scheduleNext();
    return { rotation, pages };
}

describe('useRotation – what a progress bar counts from (Plan.md 86)', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-10-15T10:00:00Z'));
    });
    afterEach(() => vi.useRealTimers());

    const list = { id: 'l', type: 'appointment-list', showAll: true } as unknown as Block;

    it('starts anew with every slide and follows its duration', () => {
        const { rotation } = setup([makeSlide({ id: 'a', durationSeconds: 5 }), makeSlide({ id: 'b', durationSeconds: 8 })]);
        const first = rotation.startedAt.value;
        expect(rotation.seconds.value).toBe(5);
        vi.advanceTimersByTime(5000);
        expect(rotation.current.value?.id).toBe('b');
        expect(rotation.startedAt.value).toBe(first + 5000);
        expect(rotation.seconds.value).toBe(8);
    });

    it('grows once a list has reported its pages', () => {
        const { rotation, pages } = setup([makeSlide({ id: 'a', durationSeconds: 5, blocks: [list] })]);
        expect(rotation.seconds.value).toBe(5);
        pages.l = 3;
        expect(rotation.seconds.value).toBe(3 * PAGE_SECONDS);
    });

    it('keeps how far it had run while held, and begins again on resuming', () => {
        const { rotation } = setup([makeSlide({ id: 'a', durationSeconds: 10 })]);
        vi.advanceTimersByTime(4000);
        rotation.setPaused(true);
        expect(rotation.heldAt.value).toBe(4000);
        vi.advanceTimersByTime(20000);
        expect(rotation.heldAt.value).toBe(4000);
        rotation.setPaused(false);
        expect(rotation.heldAt.value).toBeNull();
        expect(rotation.startedAt.value).toBe(Date.now());
    });

    it('held without end (per click, Plan.md 124 C) stays on its slide however long, and a step moves it on', () => {
        const { rotation } = setup([makeSlide({ id: 'a', durationSeconds: 5 }), makeSlide({ id: 'b', durationSeconds: 5 }), makeSlide({ id: 'c', durationSeconds: 5 })]);
        rotation.setPaused(true);
        vi.advanceTimersByTime(3_600_000);
        expect(rotation.current.value?.id).toBe('a');
        rotation.step(1);
        vi.advanceTimersByTime(3_600_000);
        expect(rotation.current.value?.id).toBe('b');
        // `step(0)` – a page turned within the slide – leaves it where it is, and so does a step back to the start.
        rotation.step(0);
        expect(rotation.current.value?.id).toBe('b');
        rotation.step(-1);
        rotation.step(-1);
        expect(rotation.current.value?.id).toBe('c');
        vi.advanceTimersByTime(3_600_000);
        expect(rotation.current.value?.id).toBe('c');
    });

    it('stands at the start on a slide stepped to while held', () => {
        const { rotation } = setup([makeSlide({ id: 'a', durationSeconds: 10 }), makeSlide({ id: 'b', durationSeconds: 10 })]);
        vi.advanceTimersByTime(4000);
        rotation.setPaused(true);
        rotation.step(1);
        expect(rotation.current.value?.id).toBe('b');
        expect(rotation.heldAt.value).toBe(0);
    });
});

describe('useRotation – a minimum time after paging (Plan.md 127 A)', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-10-15T10:00:00Z'));
    });
    afterEach(() => vi.useRealTimers());

    const three = () => [
        makeSlide({ id: 'a', durationSeconds: 5 }),
        makeSlide({ id: 'b', durationSeconds: 8 }),
        makeSlide({ id: 'c', durationSeconds: 40 }),
    ];

    it('holds the slide until the minimum when that is longer than its time', async () => {
        const { rotation } = setup(three());
        rotation.step(1, 30);
        await nextTick();
        vi.advanceTimersByTime(29_000);
        expect(rotation.current.value?.id).toBe('b');
        vi.advanceTimersByTime(1_000);
        expect(rotation.current.value?.id).toBe('c');
    });

    it('keeps the full slide time when that is longer than the minimum', async () => {
        const { rotation } = setup(three());
        rotation.step(2, 30);
        await nextTick();
        vi.advanceTimersByTime(39_000);
        expect(rotation.current.value?.id).toBe('c');
        vi.advanceTimersByTime(1_000);
        expect(rotation.current.value?.id).toBe('a');
    });

    it('counts anew with every further step', async () => {
        const { rotation } = setup(three());
        rotation.step(1, 30);
        vi.advanceTimersByTime(20_000);
        rotation.step(-1, 30);
        await nextTick();
        vi.advanceTimersByTime(29_000);
        expect(rotation.current.value?.id).toBe('a');
        vi.advanceTimersByTime(1_000);
        expect(rotation.current.value?.id).toBe('b');
    });

    it('is gone after the natural advance, and after a step without one', async () => {
        const { rotation } = setup(three());
        rotation.step(1, 30);
        vi.advanceTimersByTime(30_000);
        expect(rotation.current.value?.id).toBe('c');
        expect(rotation.seconds.value).toBe(40);
        rotation.step(-1);
        await nextTick();
        expect(rotation.seconds.value).toBe(8);
        vi.advanceTimersByTime(8_000);
        expect(rotation.current.value?.id).toBe('c');
    });

    it('reports the minimum as the time the slide stays', () => {
        const { rotation } = setup(three());
        rotation.step(1, 30);
        expect(rotation.seconds.value).toBe(30);
    });

    it('stays on the slide with step(0): the full time anew, at least the minimum from now', async () => {
        const { rotation } = setup(three());
        vi.advanceTimersByTime(3_000);
        rotation.step(0, 30);
        await nextTick();
        expect(rotation.current.value?.id).toBe('a');
        expect(rotation.seconds.value).toBe(30);
        expect(rotation.startedAt.value).toBe(Date.now());
        vi.advanceTimersByTime(29_000);
        expect(rotation.current.value?.id).toBe('a');
        vi.advanceTimersByTime(1_000);
        expect(rotation.current.value?.id).toBe('b');
    });
});
