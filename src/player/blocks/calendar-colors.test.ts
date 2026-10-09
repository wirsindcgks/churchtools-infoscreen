import { mount } from '@vue/test-utils';
import { defineComponent, h, reactive } from 'vue';
import { describe, expect, it } from 'vitest';
import { provideStageContext, type StageContext } from '../context';
import CalendarBadge from './CalendarBadge.vue';
import DateTile from './DateTile.vue';

function withContext(component: unknown, props: Record<string, unknown>) {
    const context = reactive<StageContext>({
        now: new Date('2026-10-04T08:00:00Z'),
        timeZone: 'Europe/Berlin',
        clockConfirmed: true,
        churchName: 'Gemeinde am Markt',
        appointments: [],
        media: new Map(),
    });
    return mount(
        defineComponent({
            setup() {
                provideStageContext(context);
                return () => h(component as never, props);
            },
        }),
    );
}

describe('calendar colours on badge and date tile', () => {
    it('frames the badge in the colour itself, with a dot in it; the name keeps the text colour (Plan.md 79)', () => {
        const wrapper = withContext(CalendarBadge, { name: 'Gottesdienst', color: 'black' });
        const style = wrapper.find('.badge').attributes('style');
        expect(style).toContain('border-color: color-mix(in srgb, black 60%, transparent)');
        expect(style).toContain('color-mix(in srgb, black 14%, transparent)');
        expect(style).not.toMatch(/(^|;)\s*color:/);
        expect(wrapper.find('.dot').attributes('style')).toContain('background: black');
        expect(wrapper.find('.name').text()).toBe('Gottesdienst');
    });

    it('tints the date tile with the colour itself, also when ChurchTools sends a name', () => {
        const tile = withContext(DateTile, { start: new Date('2026-10-04T08:00:00Z'), timeZone: 'Europe/Berlin', color: 'black' }).find('.tile');
        expect(tile.attributes('style')).toContain('color-mix(in srgb, black 28%, transparent)');
        expect(tile.attributes('style')).not.toContain('rgba');
    });
});
