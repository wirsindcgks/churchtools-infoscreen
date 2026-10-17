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

describe('CalendarField – search in a long list (Plan.md 93)', () => {
    const many = ['Gottesdienst', 'Jugendkreis', 'Kinderkirche', 'Chor', 'Hauskreis Nord', 'Hauskreis Süd', 'Senioren', 'Frauenfrühstück', 'Männertreff'].map((name, i) => ({ id: i + 1, name }));
    const names = (wrapper: ReturnType<typeof mount>) => wrapper.findAll('label').map((l) => l.text()).filter((text) => many.some((c) => c.name === text));

    it('has no search with up to eight calendars', () => {
        const wrapper = mount(CalendarField, { props: { calendars: many.slice(0, 8), chosenIds: [], hidden: [] } });
        expect(wrapper.find('[data-testid="calendars-search"]').exists()).toBe(false);
    });

    it('finds by parts of the name and keeps the chosen ones', async () => {
        const wrapper = mount(CalendarField, { props: { calendars: many, chosenIds: [1], hidden: [] } });
        await wrapper.get('[data-testid="calendars-search"]').setValue('haus sü');
        expect(names(wrapper)).toEqual(['Gottesdienst', 'Hauskreis Süd']);
        expect(wrapper.find('[data-testid="calendars-search-empty"]').exists()).toBe(false);
        await wrapper.get('[data-testid="calendars-search"]').setValue('orgel');
        expect(names(wrapper)).toEqual(['Gottesdienst']);
        expect(wrapper.get('[data-testid="calendars-search-empty"]').text()).toBe('Nichts gefunden zu „orgel“.');
    });
});
