import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import ToggleField from './ToggleField.vue';

describe('ToggleField', () => {
    it('is a switch that is still a checkbox, labelled by its row', () => {
        const wrapper = mount(ToggleField, { props: { modelValue: true, label: 'Ton', testid: 'sound' } });
        const input = wrapper.get('[data-testid="sound"]');
        expect(input.attributes('type')).toBe('checkbox');
        expect(input.attributes('role')).toBe('switch');
        expect((input.element as HTMLInputElement).checked).toBe(true);
        expect(wrapper.get('label').attributes('for')).toBe(input.attributes('id'));
    });

    it('reports the new state', async () => {
        const wrapper = mount(ToggleField, { props: { modelValue: false, label: 'Ton', testid: 'sound' } });
        await wrapper.get('[data-testid="sound"]').setValue(true);
        expect(wrapper.emitted('update:modelValue')).toEqual([[true]]);
    });

    it('keeps its (i) at a distance from label and switch, as a real button', () => {
        const wrapper = mount(ToggleField, { props: { modelValue: false, label: 'Ton' }, slots: { info: 'Erklärung' } });
        const button = wrapper.get('button.info-btn');
        expect(button.attributes('aria-label')).toBeTruthy();
        expect(button.attributes('type')).toBe('button');
    });
});
