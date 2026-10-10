import { mount } from '@vue/test-utils';
import { createPinia } from 'pinia';
import { describe, expect, it } from 'vitest';
import { nextTick, ref, type Component } from 'vue';
import CalendarField from '../../CalendarField.vue';
import ColorField from '../../ColorField.vue';
import InspectorSection from '../../InspectorSection.vue';
import { INSPECTOR_MODE, type InspectorMode } from '../mode';
import MediaField from './MediaField.vue';
import NumberField from './NumberField.vue';
import SegmentField from './SegmentField.vue';
import SelectField from './SelectField.vue';
import SortList from './SortList.vue';
import TextField from './TextField.vue';
import TileField from './TileField.vue';
import ToggleField from './ToggleField.vue';

const options = [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }];
const tiles = [{ value: 'a', label: 'A', pictogram: 'clock-time' as const }];

/**
 * Every kind of field, with the properties it needs and the shape it takes in the short menu (Plan.md 79, C1): a `chip` that
 * opens the field, one that `stands` in the menu with its label hidden, or the button of a medium. The mark `quick` is added
 * or left out by the test.
 */
type Shape = 'chip' | 'stands' | 'button' | 'list';
const FIELDS: [string, Component, Record<string, unknown>, Shape][] = [
    ['ToggleField', ToggleField, { modelValue: true, label: 'Ton' }, 'stands'],
    ['SegmentField of words', SegmentField, { modelValue: 'a', options, label: 'Einpassen' }, 'chip'],
    ['SegmentField of symbols', SegmentField, { modelValue: 'a', options: [{ value: 'a', label: 'Links', icon: 'align-left' }], label: 'Ausrichtung' }, 'stands'],
    ['TileField', TileField, { modelValue: 'a', options: tiles, label: 'Darstellung' }, 'chip'],
    ['NumberField', NumberField, { modelValue: 1, label: 'Ecken' }, 'chip'],
    ['TextField', TextField, { modelValue: '', label: 'Inhalt' }, 'chip'],
    ['SelectField', SelectField, { modelValue: 'a', options, label: 'Größe der Seite' }, 'chip'],
    ['MediaField', MediaField, { filled: false, pickLabel: 'Bild wählen', swapLabel: 'Bild tauschen' }, 'button'],
    ['SortList', SortList, { items: [{ key: 1, label: 'Eins' }], removeLabel: 'Entfernen', testid: 'sort' }, 'list'],
    ['ColorField', ColorField, { modelValue: '#ffffff', label: 'Farbe' }, 'chip'],
    ['CalendarField', CalendarField, { calendars: [{ id: 1, name: 'Gottesdienst' }], chosenIds: [1], hidden: [] }, 'chip'],
];

function draw(component: Component, props: Record<string, unknown>, mode?: InspectorMode) {
    return mount(component, {
        props,
        global: { plugins: [createPinia()], ...(mode ? { provide: { [INSPECTOR_MODE as symbol]: mode } } : {}) },
    });
}

/** Nothing drawn: no element, however a component without content renders its comment. */
const nothing = (html: string) => html.replace(/<!--.*?-->/g, '').trim() === '';

describe('the mode of the inspector (Plan.md 79, B2 and C1: the short menu)', () => {
    it.each(FIELDS)('%s draws itself in the inspector, with or without the mark', (_name, component, props) => {
        expect(nothing(draw(component, props).html())).toBe(false);
        expect(nothing(draw(component, { ...props, quick: true }).html())).toBe(false);
        expect(draw(component, { ...props, quick: true }).find('[data-testid="quick-chip"]').exists()).toBe(false);
    });

    it.each(FIELDS)('%s draws nothing in the short menu without the mark', (_name, component, props) => {
        expect(nothing(draw(component, props, 'quick').html())).toBe(true);
    });

    it.each(FIELDS)('%s draws its compact form in the short menu with the mark', (_name, component, props, shape) => {
        const wrapper = draw(component, { ...props, quick: true }, 'quick');
        if (shape === 'chip') {
            expect(wrapper.findAll('[data-testid="quick-chip"]')).toHaveLength(1);
            // The field itself stays closed until the chip is clicked.
            expect(wrapper.find('[data-testid="quick-popover"]').exists()).toBe(false);
        } else if (shape === 'stands') {
            expect(wrapper.find('[data-quick-inline]').exists()).toBe(true);
            expect(wrapper.find('[data-testid="quick-chip"]').exists()).toBe(false);
        } else if (shape === 'button') {
            expect(wrapper.find('button.quick-chip[data-quick-open][data-quick-stop]').text()).toBe('Bild wählen');
        } else expect(nothing(wrapper.html())).toBe(false);
    });

    it('a chip says what the field holds', async () => {
        const face = (component: Component, props: Record<string, unknown>) => draw(component, { ...props, quick: true }, 'quick').find('[data-testid="quick-chip"]');
        expect(face(SegmentField, { modelValue: 'b', options, label: 'Einpassen' }).text()).toBe('B');
        expect(face(TileField, { modelValue: 'a', options: tiles, label: 'Darstellung' }).attributes('aria-label')).toBe('Darstellung: A');
        expect(face(SelectField, { modelValue: 'b', options, label: 'Größe' }).text()).toBe('B');
        expect(face(NumberField, { modelValue: 12, label: 'Ecken', unit: 'px' }).text()).toBe('Ecken 12 px');
        expect(face(CalendarField, { calendars: [{ id: 1, name: 'A' }, { id: 2, name: 'B' }], chosenIds: [1, 2], hidden: [] }).text()).toBe('Kalender · 2');
        const swatch = face(ColorField, { modelValue: '#ff0000', label: 'Farbe' });
        expect(swatch.text()).toBe('');
        expect(swatch.attributes('aria-label')).toBe('Farbe');
        expect(swatch.find('.quick-swatch').attributes('style')).toContain('background');
    });

    it('a toggle in the short menu is a chip with the word and still a real checkbox', async () => {
        const wrapper = draw(ToggleField, { modelValue: false, label: 'Ton', quick: true }, 'quick');
        expect(wrapper.find('.toggle-chip').text()).toBe('Ton');
        const box = wrapper.find('input[type="checkbox"]');
        expect(box.attributes('aria-label')).toBe('Ton');
        await box.setValue(true);
        expect(wrapper.emitted('update:modelValue')).toEqual([[true]]);
        await wrapper.setProps({ modelValue: true });
        expect(wrapper.find('.toggle-chip').classes()).toContain('toggle-chip--on');
    });

    it('takes the mode from a ref, too, so the short menu can switch it', async () => {
        const mode = ref<InspectorMode>('quick');
        const wrapper = mount(ToggleField, { props: { modelValue: true, label: 'Ton' }, global: { provide: { [INSPECTOR_MODE as symbol]: mode } } });
        expect(nothing(wrapper.html())).toBe(true);
        mode.value = 'full';
        await nextTick();
        expect(nothing(wrapper.html())).toBe(false);
    });

    it('a section has no head in the short menu, only its fields', () => {
        const slots = { default: '<span data-testid="inside">Feld</span>' };
        const full = mount(InspectorSection, { props: { id: 'x-test', title: 'Darstellung' }, slots });
        expect(full.find('summary').exists()).toBe(true);
        const quick = mount(InspectorSection, { props: { id: 'x-test', title: 'Darstellung' }, slots, global: { provide: { [INSPECTOR_MODE as symbol]: 'quick' } } });
        expect(quick.find('summary').exists()).toBe(false);
        expect(quick.find('[data-testid="inside"]').exists()).toBe(true);
    });
});
