import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import SegmentField from './SegmentField.vue';

const words = [
    { value: 'contain', label: 'Ganz zeigen' },
    { value: 'cover', label: 'Füllen' },
];

describe('SegmentField', () => {
    it('is a labelled group of radio buttons with the data-testid on the group', () => {
        const wrapper = mount(SegmentField, { props: { modelValue: 'cover', options: words, label: 'Einpassen', testid: 'fit' } });
        const group = wrapper.get('[data-testid="fit"]');
        expect(group.attributes('role')).toBe('radiogroup');
        expect(group.attributes('aria-labelledby')).toBeTruthy();
        const radios = group.findAll('input[type="radio"]');
        expect(radios.map((r) => r.attributes('value'))).toEqual(['contain', 'cover']);
        expect(radios.map((r) => (r.element as HTMLInputElement).checked)).toEqual([false, true]);
        expect(radios[0]!.attributes('name')).toBe(radios[1]!.attributes('name'));
    });

    it('reports a chosen value in its own type', async () => {
        const weights = [{ value: 400, label: 'Normal' }, { value: 700, label: 'Fett' }];
        const wrapper = mount(SegmentField, { props: { modelValue: 400, options: weights, label: 'Stärke' } });
        await wrapper.get('input[value="700"]').setValue(true);
        expect(wrapper.emitted('update:modelValue')).toEqual([[700]]);
    });

    it('labels a symbol alone for assistive technology and shows a word as text', () => {
        const options = [{ value: 'left', label: 'Links', icon: 'align-left' as const }, { value: 'right', label: 'Rechts' }];
        const wrapper = mount(SegmentField, { props: { modelValue: 'left', options, label: 'Ausrichtung' } });
        const radios = wrapper.findAll('input');
        expect(radios[0]!.attributes('aria-label')).toBe('Links');
        expect(wrapper.findAll('svg')).toHaveLength(1);
        expect(radios[1]!.attributes('aria-label')).toBeUndefined();
        expect(wrapper.text()).toContain('Rechts');
    });
});
