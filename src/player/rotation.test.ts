import { mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, reactive, ref } from 'vue';
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

    it('stands at the start on a slide stepped to while held', () => {
        const { rotation } = setup([makeSlide({ id: 'a', durationSeconds: 10 }), makeSlide({ id: 'b', durationSeconds: 10 })]);
        vi.advanceTimersByTime(4000);
        rotation.setPaused(true);
        rotation.step(1);
        expect(rotation.current.value?.id).toBe('b');
        expect(rotation.heldAt.value).toBe(0);
    });
});
