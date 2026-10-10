import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import TileField from './TileField.vue';

const formats = [
    { value: 'time', label: 'Uhrzeit', pictogram: 'clock-time' as const },
    { value: 'date', label: 'Datum', pictogram: 'clock-date' as const },
    { value: 'datetime', label: 'Datum und Uhrzeit', pictogram: 'clock-datetime' as const },
];

describe('TileField', () => {
    it('draws a pictogram and a word per tile, in a group that carries the data-testid', () => {
        const wrapper = mount(TileField, { props: { modelValue: 'date', options: formats, label: 'Darstellung', testid: 'clock-format' } });
        const group = wrapper.get('[data-testid="clock-format"]');
        expect(group.attributes('role')).toBe('radiogroup');
        expect(group.findAll('svg')).toHaveLength(3);
        expect(group.findAll('.tile-word').map((w) => w.text())).toEqual(['Uhrzeit', 'Datum', 'Datum und Uhrzeit']);
        expect(group.findAll('input').map((r) => (r.element as HTMLInputElement).checked)).toEqual([false, true, false]);
    });

    it('reports the chosen tile', async () => {
        const wrapper = mount(TileField, { props: { modelValue: 'time', options: formats, label: 'Darstellung' } });
        await wrapper.get('input[value="datetime"]').setValue(true);
        expect(wrapper.emitted('update:modelValue')).toEqual([['datetime']]);
    });
});
