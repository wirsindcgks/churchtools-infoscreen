import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h, reactive } from 'vue';
import { normalizeAppointments } from '../appointments/normalize';
import { makeSlide } from '../model/testing';
import type { Block, MediaDoc } from '../model/schema';
import type { Post } from '../posts/normalize';
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

function render(block: Block, durationSeconds: number, paging = true, extra: Partial<StageContext> = {}) {
    const context = reactive<StageContext>({
        now: new Date('2026-10-04T08:00:00Z'),
        timeZone: BERLIN,
        clockConfirmed: true,
        churchName: '',
        appointments,
        media: new Map(),
        pages: {},
        paging,
        ...extra,
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
        // 600 px, rows of 70, room for the page bar: 8 rows a page, 3 pages for 20.
        expect(wrapper.findAll('.list:not(.measure) > .row')).toHaveLength(8); // 600 - 36 for the bar leaves 564: 8 rows of 70
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
        expect(limited.wrapper.findAll('.list:not(.measure) > .row')).toHaveLength(5);
        expect(limited.wrapper.find('[data-testid="list-page"]').exists()).toBe(false);
        expect(limited.context.pages).toEqual({});
        limited.wrapper.unmount();

        // More than fit, without pages: whole rows only, none cut off at the bottom.
        const crowded = render(list({ showAll: false, limit: 12 }), 8);
        await flushPromises();
        expect(crowded.wrapper.findAll('.list:not(.measure) > .row')).toHaveLength(8); // 8 × 70 = 560 of 600
        crowded.wrapper.unmount();
    });
});

describe('the progress bar can be switched off or on (schema 1.47, Plan.md 105)', () => {
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

    it('keeps the appointment list as it was without the field, and drops bar and figures with false', async () => {
        const kept = render(list({ height: 650 }), 8);
        await flushPromises();
        expect(kept.wrapper.find('[data-testid="list-progress"]').exists()).toBe(true);
        expect(kept.wrapper.find('[data-testid="list-page"]').exists()).toBe(true);
        expect(kept.wrapper.findAll('.list:not(.measure) > .row')).toHaveLength(8); // 650 - 36 for the bar: 8 rows of 70
        kept.wrapper.unmount();

        const off = render(list({ height: 650, pageProgress: false }), 8);
        await flushPromises();
        expect(off.wrapper.find('[data-testid="list-progress"]').exists()).toBe(false);
        expect(off.wrapper.find('[data-testid="list-page"]').exists()).toBe(false);
        expect(off.wrapper.findAll('.list:not(.measure) > .row')).toHaveLength(9); // the room of the bar goes to the rows
        // The pages still turn.
        expect(off.context.pages).toEqual({ liste: 3 });
        off.wrapper.unmount();
    });

    const post = (id: number): Post => ({
        id,
        groupId: 31,
        groupName: 'Gruppe',
        color: '#14b8a6',
        groupInitials: 'G',
        groupImageUrl: null,
        title: `Beitrag ${id}`,
        content: 'Text',
        publishedAt: new Date('2026-10-01T08:00:00Z'),
        expiresAt: null,
        author: null,
        imageUrl: null,
        imageRatio: null,
    });
    const posts = (overrides: Partial<Extract<Block, { type: 'posts' }>> = {}): Block => ({
        id: 'beitraege',
        type: 'posts',
        x: 0,
        y: 0,
        width: 1400,
        height: 700,
        groupIds: [31],
        limit: 3,
        maxAgeDays: 30,
        layout: 'card',
        showImage: true,
        showAuthor: false,
        showGroup: true,
        showTitle: true,
        showText: true,
        showDate: true,
        imageFit: 'cover',
        imageFocus: 'center',
        style,
        ...overrides,
    });

    it('shows no bar on posts without the field; with true one that starts over with every post', async () => {
        const without = render(posts(), 8, true, { posts: [post(1), post(2)] });
        await flushPromises();
        expect(without.wrapper.find('[data-testid="page-progress"]').exists()).toBe(false);
        without.wrapper.unmount();

        const on = render(posts({ pageProgress: true }), 8, true, { posts: [post(1), post(2)] });
        await flushPromises();
        const bar = () => on.wrapper.find('[data-testid="page-progress-bar"]');
        expect(bar().attributes('style')).toContain('animation-duration: 15s');
        const first = bar().element;
        await vi.advanceTimersByTimeAsync(15_000);
        expect(on.wrapper.text()).toContain('Beitrag 2');
        expect(bar().element).not.toBe(first);
        on.wrapper.unmount();

        // One post, a list, or a stage that holds the posts: nothing turns, so nothing runs.
        const single = render(posts({ pageProgress: true }), 8, true, { posts: [post(1)] });
        const list = render(posts({ pageProgress: true, layout: 'list' }), 8, true, { posts: [post(1), post(2)] });
        const held = render(posts({ pageProgress: true }), 8, false, { posts: [post(1), post(2)] });
        await flushPromises();
        for (const other of [single, list, held]) {
            expect(other.wrapper.find('[data-testid="page-progress"]').exists()).toBe(false);
            other.wrapper.unmount();
        }
    });

    describe('the gallery', () => {
        const media = new Map<string, MediaDoc>(
            ['m1', 'm2'].map((id) => [id, { id, kind: 'media', name: id, fileId: 1, imageUrl: `https://example.test/images/${id}/h` } as MediaDoc]),
        );
        const gallery = (overrides: Partial<Extract<Block, { type: 'slideshow' }>> = {}): Block => ({
            id: 'galerie',
            type: 'slideshow',
            x: 0,
            y: 0,
            width: 800,
            height: 450,
            mediaIds: ['m1', 'm2'],
            fit: 'cover',
            seconds: 6,
            transition: 'fade',
            motion: 'none',
            ...overrides,
        });
        beforeEach(() => {
            // jsdom does not decode pictures.
            Object.defineProperty(HTMLImageElement.prototype, 'decode', { configurable: true, value: () => Promise.resolve() });
        });
        afterEach(() => {
            Reflect.deleteProperty(HTMLImageElement.prototype, 'decode');
        });

        it('has no bar without the field; with true one that starts over with each picture', async () => {
            const without = render(gallery(), 6, true, { media });
            await flushPromises();
            expect(without.wrapper.find('[data-testid="page-progress"]').exists()).toBe(false);
            without.wrapper.unmount();

            const on = render(gallery({ pageProgress: true }), 6, true, { media });
            await flushPromises();
            const bar = () => on.wrapper.find('[data-testid="page-progress-bar"]');
            expect(bar().attributes('style')).toContain('animation-duration: 6s');
            const first = bar().element;
            await vi.advanceTimersByTimeAsync(6_000);
            expect(bar().element).not.toBe(first);
            on.wrapper.unmount();

            const one = render(gallery({ pageProgress: true, mediaIds: ['m1'] }), 6, true, { media });
            const held = render(gallery({ pageProgress: true }), 6, false, { media });
            await flushPromises();
            expect(one.wrapper.find('[data-testid="page-progress"]').exists()).toBe(false);
            expect(held.wrapper.find('[data-testid="page-progress"]').exists()).toBe(false);
            one.wrapper.unmount();
            held.wrapper.unmount();
        });
    });
});
