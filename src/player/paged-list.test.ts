import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h, reactive } from 'vue';
import { normalizeAppointments } from '../appointments/normalize';
import { makeSlide } from '../model/testing';
import type { Block } from '../model/schema';
import { provideStageContext, type StageContext } from './context';
import SlideView from './SlideView.vue';

const BERLIN = 'Europe/Berlin';
const style = { fontFamily: 'sans', fontSize: 40, fontWeight: 400 as const, color: '#fff', align: 'left' as const };

/** 20 services, one a day from 2026-10-05. */
const appointments = normalizeAppointments(
    Array.from({ length: 20 }, (_, i) => ({
        appointment: {
            base: { id: i + 1, title: `Termin ${i + 1}`, allDay: false, calendar: { id: 2, name: 'Gemeinde' } },
            calculated: {
                startDate: new Date(Date.UTC(2026, 9, 5 + i, 8)).toISOString(),
                endDate: new Date(Date.UTC(2026, 9, 5 + i, 9)).toISOString(),
            },
        },
    })),
    BERLIN,
);

const list = (overrides: Partial<Extract<Block, { type: 'appointment-list' }>> = {}): Block => ({
    id: 'liste',
    type: 'appointment-list',
    x: 0,
    y: 0,
    width: 1600,
    height: 600,
    calendarIds: [2],
    horizonDays: 30,
    limit: 5,
    showAll: true,
    style,
    ...overrides,
});

function render(block: Block, durationSeconds: number, paging = true) {
    const context = reactive<StageContext>({
        now: new Date('2026-10-04T08:00:00Z'),
        timeZone: BERLIN,
        clockConfirmed: true,
        churchName: '',
        appointments,
        media: new Map(),
        pages: {},
        paging,
    });
    const Host = defineComponent({
        setup() {
            provideStageContext(context);
            return () => h(SlideView, { slide: makeSlide({ durationSeconds, blocks: [block] }), width: 1920, height: 1080 });
        },
    });
    return { wrapper: mount(Host), context };
}

describe('an appointment list with every appointment, page by page (Plan.md, 23)', () => {
    // jsdom lays nothing out: a row is 70 stage pixels high here, as in a browser at 40 px.
    let spy: ReturnType<typeof vi.spyOn>;
    beforeEach(() => {
        vi.useFakeTimers();
        spy = vi
            .spyOn(HTMLElement.prototype, 'offsetHeight', 'get')
            .mockImplementation(function (this: HTMLElement) {
                return this.classList.contains('row') ? 70 : 0;
            });
    });
    afterEach(() => {
        spy.mockRestore();
        vi.useRealTimers();
    });

    it('shows as many as fit, turns the page every 10 s and reports the pages to the rotation', async () => {
        const { wrapper, context } = render(list(), 8);
        // The player's clock ticks every second – that must not start the pages over (seen on the TV, 2026-09-25).
        setInterval(() => (context.now = new Date(context.now.getTime() + 1000)), 1000);
        await flushPromises();
        // 600 px, rows of 70, room for the page number: 7 rows a page, 3 pages for 20.
        expect(wrapper.findAll('.row')).toHaveLength(7);
        expect(wrapper.find('[data-testid="list-page"]').text()).toBe('1/3');
        expect(context.pages).toEqual({ liste: 3 });
        expect(wrapper.text()).toContain('Termin 1');

        // A bar fills up over the 10 s of each page, anew on every page.
        const bar = () => wrapper.find('[data-testid="list-progress"]');
        expect(bar().attributes('style')).toContain('animation-duration: 10s');
        const first = bar().element;

        await vi.advanceTimersByTimeAsync(10_000);
        expect(wrapper.find('[data-testid="list-page"]').text()).toBe('2/3');
        await vi.advanceTimersByTimeAsync(1_000); // after the cross-fade
        expect(wrapper.text()).toContain('Termin 8');
        expect(bar().element).not.toBe(first);
        await vi.advanceTimersByTimeAsync(9_000);
        expect(wrapper.find('[data-testid="list-page"]').text()).toBe('3/3');
        wrapper.unmount();
    });

    it('shares out a longer slide among its pages', async () => {
        const { wrapper } = render(list(), 60);
        await flushPromises();
        await vi.advanceTimersByTimeAsync(10_000);
        expect(wrapper.find('[data-testid="list-page"]').text()).toBe('1/3'); // 60 s / 3 pages = 20 s each
        await vi.advanceTimersByTimeAsync(10_000);
        expect(wrapper.find('[data-testid="list-page"]').text()).toBe('2/3');
        wrapper.unmount();
    });

    it('holds page 1 in the designer preview, and keeps the old limit without "alle"', async () => {
        const held = render(list(), 8, false);
        await flushPromises();
        await vi.advanceTimersByTimeAsync(30_000);
        expect(held.wrapper.find('[data-testid="list-page"]').text()).toBe('1/3');
        expect(held.context.pages).toEqual({ liste: 3 }); // the inspector names the pages
        expect(held.wrapper.find('[data-testid="list-progress"]').exists()).toBe(false); // nothing runs while designing
        held.wrapper.unmount();

        const limited = render(list({ showAll: false }), 8);
        await flushPromises();
        expect(limited.wrapper.findAll('.row')).toHaveLength(5);
        expect(limited.wrapper.find('[data-testid="list-page"]').exists()).toBe(false);
        expect(limited.context.pages).toEqual({});
        limited.wrapper.unmount();
    });
});
