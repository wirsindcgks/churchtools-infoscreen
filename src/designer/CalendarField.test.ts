import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import CalendarField from './CalendarField.vue';

const calendars = [
    { id: 1, name: 'Gottesdienst' },
    { id: 3, name: 'Gemeindeleitung' },
];

describe('CalendarField – released calendars (Plan.md 85 b)', () => {
    it('marks a released calendar as not public, and only that one', () => {
        const wrapper = mount(CalendarField, { props: { calendars, chosenIds: [1], hidden: [], released: [3] } });
        const text = wrapper.text();
        expect(text).toContain('Gemeindeleitung · nicht öffentlich');
        expect(text).not.toContain('Gottesdienst · nicht öffentlich');
    });

    it('marks nothing without released calendars', () => {
        const wrapper = mount(CalendarField, { props: { calendars, chosenIds: [1], hidden: [] } });
        expect(wrapper.text()).not.toContain('nicht öffentlich');
    });
});
