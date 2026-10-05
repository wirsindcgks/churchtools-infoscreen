import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import WeekTimeline from './WeekTimeline.vue';

const days = [
    {
        label: 'So',
        title: 'Sonntag, 11. Oktober',
        segments: [
            { start: 0, end: 540, color: '#2563eb', key: 'default', label: 'So 00:00–09:00: Standard' },
            { start: 540, end: 720, color: '#16a34a', key: '0', label: 'So 09:00–12:00: Sonntag – Regel 1' },
            { start: 720, end: 1440, color: null, key: 'none', label: 'nicht sichtbar' },
        ],
    },
    { label: 'Mo', title: 'Montag, 12. Oktober', segments: [{ start: 0, end: 1440, color: '#2563eb', key: 'default', label: 'Mo' }] },
];

describe('WeekTimeline (Plan.md 68)', () => {
    it('draws a row per day and names every stretch for screen readers', () => {
        const wrapper = mount(WeekTimeline, { props: { days } });
        expect(wrapper.findAll('[data-testid="week-day"]')).toHaveLength(2);
        const first = wrapper.findAll('[data-testid="week-segment"]')[1]!;
        expect(first.attributes('aria-label')).toBe('So 09:00–12:00: Sonntag – Regel 1');
        expect(first.attributes('title')).toBe('So 09:00–12:00: Sonntag – Regel 1');
    });

    it('shows a stretch without color as inert nothing', async () => {
        const wrapper = mount(WeekTimeline, { props: { days } });
        expect(wrapper.findAll('[data-testid="week-segment-none"]')).toHaveLength(1);
        await wrapper.get('[data-testid="week-segment-none"]').trigger('click');
        expect(wrapper.emitted('pick')).toBeUndefined();
    });

    it('fades every stretch but the highlighted key', () => {
        const wrapper = mount(WeekTimeline, { props: { days, highlight: '0' } });
        const dim = wrapper.findAll('[data-testid="week-segment"]').map((s) => s.classes('dim'));
        expect(dim).toEqual([true, false, true]);
        const plain = mount(WeekTimeline, { props: { days } });
        expect(plain.findAll('.dim')).toHaveLength(0);
    });

    it('emits pick with the day and the stretch, and hover with its key', async () => {
        const wrapper = mount(WeekTimeline, { props: { days } });
        const segment = wrapper.findAll('[data-testid="week-segment"]')[1]!;
        await segment.trigger('mouseenter');
        await segment.trigger('mouseleave');
        expect(wrapper.emitted('hover')).toEqual([['0'], [null]]);
        await segment.trigger('click');
        expect(wrapper.emitted('pick')![0]).toEqual([{ dayIndex: 0, segment: days[0]!.segments[1] }]);
    });

    it('puts the needle on the given day only', () => {
        const wrapper = mount(WeekTimeline, { props: { days, now: { dayIndex: 1, minute: 720 } } });
        const needles = wrapper.findAll('[data-testid="week-needle"]');
        expect(needles).toHaveLength(1);
        expect(needles[0]!.attributes('style')).toContain('left: 50%');
        expect(wrapper.findAll('[data-testid="week-day"]')[1]!.find('[data-testid="week-needle"]').exists()).toBe(true);
    });
});
