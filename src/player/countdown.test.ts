import { mount } from '@vue/test-utils';
import { defineComponent, h, reactive } from 'vue';
import { describe, expect, it } from 'vitest';
import { normalizeAppointments } from '../appointments/normalize';
import { makeSlide } from '../model/testing';
import type { Banner, Block } from '../model/schema';
import { bannerShown, passSeconds, wallTime } from './banner';
import { provideStageContext, type StageContext } from './context';
import { countdownTo, remaining } from './countdown';
import SlideView from './SlideView.vue';

const BERLIN = 'Europe/Berlin';
const style = { fontFamily: 'sans', fontSize: 120, fontWeight: 700 as const, color: '#fff', align: 'center' as const };

const appointment = (id: number, calendar: number, start: string, end: string, allDay = false) => ({
    appointment: {
        base: { id, title: `Termin ${id}`, allDay, calendar: { id: calendar, name: 'Gottesdienste', color: '#16a34a' } },
        calculated: { startDate: start, endDate: end },
    },
});
const appointments = normalizeAppointments(
    [
        appointment(1, 2, '2026-10-04T08:00:00Z', '2026-10-04T09:30:00Z'), // Sunday 10:00–11:30 in Berlin
        appointment(2, 2, '2026-10-11T08:00:00Z', '2026-10-11T09:30:00Z'),
        appointment(3, 5, '2026-10-04T07:00:00Z', '2026-10-04T07:30:00Z'), // another calendar
        appointment(4, 2, '2026-10-03', '2026-10-05', true), // all day: no hour to count to
    ],
    BERLIN,
);

describe('the countdown (Plan.md 32)', () => {
    const options = { calendarIds: [2], runningText: 'Läuft gerade' };

    it('counts down to the next appointment of its calendars, all-day ones left out', () => {
        const state = countdownTo(appointments, { ...options, now: new Date('2026-10-04T07:47:26Z') });
        expect(state).toMatchObject({ kind: 'until', text: '12:34' });
        expect(state.kind === 'until' && state.appointment.title).toBe('Termin 1');
    });

    it('says what runs while it runs, or counts on to the next one without a text', () => {
        const during = new Date('2026-10-04T08:30:00Z');
        expect(countdownTo(appointments, { ...options, now: during }).kind).toBe('running');
        const on = countdownTo(appointments, { ...options, runningText: ' ', now: during });
        expect(on.kind === 'until' && on.appointment.title).toBe('Termin 2');
        expect(countdownTo(appointments, { ...options, now: new Date('2026-12-01T00:00:00Z') })).toEqual({ kind: 'none' });
    });

    it('reads days, hours or minutes', () => {
        expect(remaining(3 * 86_400_000 + 4 * 3_600_000)).toBe('3 Tage 4 Std.');
        expect(remaining(86_400_000)).toBe('1 Tag 0 Std.');
        expect(remaining(3_909_000)).toBe('1:05:09');
        expect(remaining(249_100)).toBe('04:10'); // rounded up: never "00:00" before it starts
        expect(remaining(-5)).toBe('00:00');
    });

    it('shows on the stage with the appointment it counts to', () => {
        const block: Block = { id: 'c', type: 'countdown', x: 0, y: 0, width: 1100, height: 360, calendarIds: [2], showTitle: true, runningText: 'Läuft gerade', style };
        const context = reactive<StageContext>({
            now: new Date('2026-10-04T07:47:26Z'),
            timeZone: BERLIN,
            clockConfirmed: true,
            churchName: '',
            appointments,
            media: new Map(),
        });
        const wrapper = mount(
            defineComponent({
                setup() {
                    provideStageContext(context);
                    return () => h(SlideView, { slide: makeSlide({ blocks: [block] }), width: 1920, height: 1080 });
                },
            }),
        );
        expect(wrapper.find('[data-testid="countdown-time"]').text()).toBe('12:34');
        expect(wrapper.find('[data-testid="countdown"]').text()).toMatch(/Termin 1 beginnt in\s*12:34\s*Sonntag, 4\. Oktober, 10:00 Uhr/);
        wrapper.unmount();
    });
});

describe('the band over a playlist (Plan.md 32)', () => {
    const banner: Banner = {
        text: 'Parkplatz gesperrt',
        mode: 'scroll',
        position: 'bottom',
        height: 90,
        speed: 140,
        background: '#e11d48',
        style: { ...style, fontSize: 48 },
    };

    it('shows while it has text and its time – the church’s wall time – has not come', () => {
        // 17:59 in Berlin is 15:59 UTC in October; a device set to UTC must not keep it two hours longer.
        const now = new Date('2026-10-04T15:59:00Z');
        expect(wallTime(now, BERLIN)).toBe('2026-10-04T17:59');
        expect(bannerShown({ ...banner, until: '2026-10-04T18:00' }, now, BERLIN)).toBe(true);
        expect(bannerShown({ ...banner, until: '2026-10-04T17:59' }, now, BERLIN)).toBe(false);
        expect(bannerShown(banner, now, BERLIN)).toBe(true);
        expect(bannerShown({ ...banner, text: '  ' }, now, BERLIN)).toBe(false);
        expect(bannerShown(undefined, now, BERLIN)).toBe(false);
    });

    it('runs one pass from the right edge out at the left, at its speed', () => {
        expect(passSeconds(1920, 880, 140)).toBe(20);
    });
});
