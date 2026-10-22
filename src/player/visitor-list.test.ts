import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h, reactive } from 'vue';
import { normalizeAppointments } from '../appointments/normalize';
import { roomsShownInLayout } from '../appointments/rooms';
import { appointmentServiceIds } from '../appointments/services';
import { readSlide } from '../model/read';
import type { Block } from '../model/schema';
import { DEFAULT_THEME, SCHEMA_VERSION } from '../model/schema';
import { makeSlide } from '../model/testing';
import { provideStageContext, type StageContext } from './context';
import { slideSeconds } from './paging';
import { listLayout } from './theme';
import SlideView from './SlideView.vue';

type List = Extract<Block, { type: 'appointment-list' }>;
const timeZone = 'Europe/Berlin';
const appointments = normalizeAppointments(Array.from({ length: 9 }, (_, i) => ({
    appointment: {
        base: { id: i + 1, title: `Termin ${i + 1}`, subtitle: i === 2 ? '' : 'Gemeinsam essen', allDay: false, calendar: { id: 1, name: 'Veranstaltungen' }, address: { name: 'Eingetragener Ort' } },
        calculated: { startDate: '2026-10-16T08:00:00Z', endDate: '2026-10-16T09:00:00Z' },
    },
    bookings: i === 1 ? [] : [{ base: { resourceId: 1, statusId: 2 } }],
})), timeZone, [{ id: 1, name: 'Saal' }]);
const block = (extra: Partial<List> = {}): List => ({
    id: 'liste', type: 'appointment-list', x: 0, y: 0, width: 1400, height: 400,
    calendarIds: [1], horizonDays: 14, limit: 6, showAll: true, layout: 'visitor', showRooms: true,
    style: { fontFamily: 'sans', fontSize: 40, fontWeight: 400, color: '#abcdef', align: 'left' },
    ...extra,
});

function render(extra: Partial<List> = {}, paging = true) {
    const list = reactive(block(extra));
    const slide = makeSlide({ durationSeconds: 8, blocks: [list] });
    const context = reactive<StageContext>({ now: new Date('2026-10-15T12:00:00Z'), timeZone, clockConfirmed: true, churchName: '', appointments: appointments.map((a) => ({ ...a })), media: new Map(), pages: {}, paging });
    const Host = defineComponent({ setup() {
        provideStageContext(context);
        return () => h(SlideView, { slide, width: 1920, height: 1080 });
    } });
    return { wrapper: mount(Host), context, list, slide };
}

describe('visitor overview as a layout of the appointment list', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (this: HTMLElement) {
            return this.classList.contains('row') ? 100 : 0;
        });
    });
    afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

    it('reads the new layout and keeps the existing theme defaults for rows and cards', () => {
        expect(SCHEMA_VERSION.minor).toBeGreaterThanOrEqual(41);
        expect(readSlide(makeSlide({ blocks: [block()] })).issues).toHaveLength(0);
        expect(listLayout(block(), DEFAULT_THEME)).toBe('visitor');
        expect(listLayout(block({ layout: undefined }), { ...DEFAULT_THEME, appointments: 'native' })).toBe('rows');
        expect(listLayout(block({ layout: undefined }), { ...DEFAULT_THEME, appointments: 'large' })).toBe('cards');
        expect(roomsShownInLayout({ showRooms: true, roomsInRows: false }, 'visitor')).toBe(true);
        expect(appointmentServiceIds(block({ services: [1] }))).toEqual([]);
    });

    it('shows dates over times, subtitles and the booked rooms before the place', async () => {
        const { wrapper } = render();
        await flushPromises();
        const rows = wrapper.findAll('[data-testid="list-visitor-row"]');
        expect(rows).toHaveLength(3);
        expect(rows[0]!.find('.visitor-when').text()).toContain('Morgen');
        expect(rows[0]!.find('.visitor-time').text()).toBe('10:00–11:00');
        expect(rows[0]!.find('.visitor-subtitle').text()).toBe('Gemeinsam essen');
        expect(rows[0]!.find('[data-testid="list-visitor-room"]').text()).toBe('Saal');
        expect(rows[1]!.find('.visitor-title').text()).toBe('Termin 2');
        expect(rows[1]!.find('[data-testid="list-visitor-room"]').text()).toBe('Eingetragener Ort');
        expect(rows[2]!.find('.visitor-subtitle').exists()).toBe(false);
        expect(wrapper.find('.paged').attributes('style')).toContain('color: rgb(171, 205, 239)');
        expect(wrapper.find('.paged').attributes('style')).not.toContain('background');
        wrapper.unmount();
    });

    it('uses the existing room switches without removing appointments, the place standing in', async () => {
        const { wrapper, list } = render({ roomsOffIds: [1], roomsInRows: false });
        await flushPromises();
        expect(wrapper.findAll('[data-testid="list-visitor-row"]')).toHaveLength(3);
        expect(wrapper.findAll('[data-testid="list-visitor-room"]').map((r) => r.text())).toEqual(['Eingetragener Ort', 'Eingetragener Ort', 'Eingetragener Ort']);
        list.roomsOffIds = [];
        await flushPromises();
        expect(wrapper.find('[data-testid="list-visitor-room"]').text()).toBe('Saal');
        list.roomsOffCalendarIds = [1];
        await flushPromises();
        expect(wrapper.findAll('[data-testid="list-visitor-room"]').every((r) => r.text() === 'Eingetragener Ort')).toBe(true);
        expect(wrapper.findAll('[data-testid="list-visitor-row"]')).toHaveLength(3);
        wrapper.unmount();
    });

    it('reuses list paging, duration and timer, with a segment for each page', async () => {
        const { wrapper, context, slide } = render();
        await flushPromises();
        expect(context.pages).toEqual({ liste: 3 });
        expect(wrapper.findAll('.pager--segments .track')).toHaveLength(3);
        expect(slideSeconds(slide, context.pages!)).toBe(30);
        context.now = new Date('2026-10-15T12:00:01Z');
        await vi.advanceTimersByTimeAsync(10_000);
        expect(wrapper.get('[data-testid="list-segments"]').attributes('aria-label')).toBe('Seite 2 von 3');
        expect(wrapper.findAll('[data-testid="list-visitor-row"]')[0]!.text()).toContain('Termin 4');
        expect(wrapper.findAll('.fill--done')).toHaveLength(1);
        await vi.advanceTimersByTimeAsync(20_000);
        expect(wrapper.get('[data-testid="list-segments"]').attributes('aria-label')).toBe('Seite 1 von 3');
        wrapper.unmount();
    });

    it('holds the first page in the designer and preserves the existing limited-list setting', async () => {
        const held = render({}, false);
        await flushPromises();
        expect(held.wrapper.find('[data-testid="list-progress"]').exists()).toBe(false);
        await vi.advanceTimersByTimeAsync(30_000);
        expect(held.wrapper.get('[data-testid="list-segments"]').attributes('aria-label')).toBe('Seite 1 von 3');
        held.wrapper.unmount();
        const limited = render({ showAll: false, limit: 2 });
        await flushPromises();
        expect(limited.wrapper.findAll('[data-testid="list-visitor-row"]')).toHaveLength(2);
        expect(limited.wrapper.find('[data-testid="list-segments"]').exists()).toBe(false);
        limited.wrapper.unmount();
    });
});
