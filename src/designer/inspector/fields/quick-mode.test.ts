import { mount } from '@vue/test-utils';
import { createPinia } from 'pinia';
import { describe, expect, it } from 'vitest';
import { nextTick, ref, type Component } from 'vue';
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

/** Every kind of field, with the properties it needs; the mark `quick` is added or left out by the test. */
const FIELDS: [string, Component, Record<string, unknown>][] = [
    ['ToggleField', ToggleField, { modelValue: true, label: 'Ton' }],
    ['SegmentField', SegmentField, { modelValue: 'a', options, label: 'Einpassen' }],
    ['TileField', TileField, { modelValue: 'a', options: tiles, label: 'Darstellung' }],
    ['NumberField', NumberField, { modelValue: 1, label: 'Ecken' }],
    ['TextField', TextField, { modelValue: '', label: 'Inhalt' }],
    ['SelectField', SelectField, { modelValue: 'a', options, label: 'Größe der Seite' }],
    ['MediaField', MediaField, { filled: false, pickLabel: 'Bild wählen', swapLabel: 'Bild tauschen' }],
    ['SortList', SortList, { items: [{ key: 1, label: 'Eins' }], removeLabel: 'Entfernen', testid: 'sort' }],
    ['ColorField', ColorField, { modelValue: '#ffffff', label: 'Farbe' }],
];

function draw(component: Component, props: Record<string, unknown>, mode?: InspectorMode) {
    return mount(component, {
        props,
        global: { plugins: [createPinia()], ...(mode ? { provide: { [INSPECTOR_MODE as symbol]: mode } } : {}) },
    });
}

describe('the mode of the inspector (Plan.md 79, B2: short menu prepared)', () => {
    it.each(FIELDS)('%s draws itself in the inspector, with or without the mark', (_name, component, props) => {
        expect(draw(component, props).html()).not.toBe('<!--v-if-->');
        expect(draw(component, { ...props, quick: true }).html()).not.toBe('<!--v-if-->');
    });

    it.each(FIELDS)('%s draws nothing in the short menu without the mark', (_name, component, props) => {
        expect(draw(component, props, 'quick').html()).toBe('<!--v-if-->');
    });

    it.each(FIELDS)('%s draws itself in the short menu with the mark', (_name, component, props) => {
        expect(draw(component, { ...props, quick: true }, 'quick').html()).not.toBe('<!--v-if-->');
    });

    it('takes the mode from a ref, too, so the short menu can switch it', async () => {
        const mode = ref<InspectorMode>('quick');
        const wrapper = mount(ToggleField, { props: { modelValue: true, label: 'Ton' }, global: { provide: { [INSPECTOR_MODE as symbol]: mode } } });
        expect(wrapper.html()).toBe('<!--v-if-->');
        mode.value = 'full';
        await nextTick();
        expect(wrapper.html()).not.toBe('<!--v-if-->');
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
