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
    it('tints the badge with the colour itself, also when ChurchTools sends a name', () => {
        const badge = withContext(CalendarBadge, { name: 'Gottesdienst', color: 'black' }).find('.badge');
        expect(badge.attributes('style')).toContain('color-mix(in srgb, black 90%, transparent)');
        expect(badge.attributes('style')).toContain('color: rgb(255, 255, 255)'); // white on black
    });

    it('tints the date tile with the colour itself, also when ChurchTools sends a name', () => {
        const tile = withContext(DateTile, { start: new Date('2026-10-04T08:00:00Z'), timeZone: 'Europe/Berlin', color: 'black' }).find('.tile');
        expect(tile.attributes('style')).toContain('color-mix(in srgb, black 28%, transparent)');
        expect(tile.attributes('style')).not.toContain('rgba');
    });
});
