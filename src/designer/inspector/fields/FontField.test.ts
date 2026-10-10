import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { defineComponent, h, ref } from 'vue';
import type { ThemeDoc } from '../../../model/schema';
import { FONTS } from '../../../player/fonts';
import { providePalette } from '../../palette';
import FontField from './FontField.vue';

function mountField(modelValue: string, designFont?: string) {
    const Host = defineComponent({
        setup() {
            if (designFont) providePalette(ref({ accent: '#000000', text: '#ffffff', background: '#000000', font: designFont } as ThemeDoc));
            return () => h(FontField, { modelValue, label: 'Schriftart', testid: 'f' });
        },
    });
    return mount(Host, { attachTo: document.body });
}

describe('FontField', () => {
    it('shows the current font, set in itself, and a closed list', () => {
        const wrapper = mountField('oswald');
        const button = wrapper.get('[data-testid="f"]');
        expect(button.text()).toContain('Oswald');
        expect(button.attributes('style')).toContain('ISD Oswald');
        expect(button.attributes('aria-expanded')).toBe('false');
        expect(wrapper.find('[role="listbox"]').exists()).toBe(false);
        wrapper.unmount();
    });

    it('puts the font of the design on top with a mark, then all fonts, each in itself', async () => {
        const wrapper = mountField('lato', 'oswald');
        await wrapper.get('[data-testid="f"]').trigger('click');
        const options = wrapper.findAll('[role="option"]');
        expect(options).toHaveLength(FONTS.length + 1);
        expect(options[0]!.text()).toContain('Oswald');
        expect(options[0]!.text()).toContain('Design');
        expect(options[1]!.text()).not.toContain('Design');
        expect(wrapper.text()).toContain('Alle Schriften');
        expect(options[2]!.attributes('style')).toContain('ISD');
        expect(options.filter((o) => o.attributes('aria-selected') === 'true')).toHaveLength(1);
        wrapper.unmount();
    });

    it('has no mark and no „Alle Schriften" where no theme is provided', async () => {
        const wrapper = mountField('lato');
        await wrapper.get('[data-testid="f"]').trigger('click');
        expect(wrapper.findAll('[role="option"]')).toHaveLength(FONTS.length);
        expect(wrapper.text()).not.toContain('Design');
        wrapper.unmount();
    });

    it('is chosen with arrows and Enter, and Escape closes without choosing', async () => {
        const wrapper = mountField('lato');
        await wrapper.get('[data-testid="f"]').trigger('click');
        const list = wrapper.get('[role="listbox"]');
        const start = FONTS.findIndex((f) => f.key === 'lato');
        await list.trigger('keydown', { key: 'ArrowDown' });
        await list.trigger('keydown', { key: 'Enter' });
        const field = wrapper.findComponent(FontField);
        expect(field.emitted('update:modelValue')).toEqual([[FONTS[start + 1]!.key]]);
        expect(wrapper.find('[role="listbox"]').exists()).toBe(false);

        await wrapper.get('[data-testid="f"]').trigger('click');
        await wrapper.get('[role="listbox"]').trigger('keydown', { key: 'Escape' });
        expect(wrapper.find('[role="listbox"]').exists()).toBe(false);
        expect(field.emitted('update:modelValue')).toHaveLength(1);
        wrapper.unmount();
    });

    it('a click on a row chooses it', async () => {
        const wrapper = mountField('lato');
        await wrapper.get('[data-testid="f"]').trigger('click');
        await wrapper.get('[data-testid="f-oswald"]').trigger('click');
        expect(wrapper.findComponent(FontField).emitted('update:modelValue')).toEqual([['oswald']]);
        wrapper.unmount();
    });
});
