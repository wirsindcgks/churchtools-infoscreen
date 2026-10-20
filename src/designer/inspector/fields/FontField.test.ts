import { DOMWrapper, mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { defineComponent, h, ref } from 'vue';
import type { ThemeDoc } from '../../../model/schema';
import { FONTS } from '../../../player/fonts';
import { providePalette } from '../../palette';
import FontField from './FontField.vue';

/** The list is set into the page, not into the field: it is looked for there. */
const page = () => new DOMWrapper(document.body);

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
        expect(page().find('[role="listbox"]').exists()).toBe(false);
        wrapper.unmount();
    });

    it('puts the font of the design on top under its own caption, then all fonts, each in itself', async () => {
        const wrapper = mountField('lato', 'oswald');
        await wrapper.get('[data-testid="f"]').trigger('click');
        const options = page().findAll('[role="option"]');
        expect(options).toHaveLength(FONTS.length + 1);
        expect(options[0]!.text()).toContain('Oswald');
        expect(page().get('.select-caption').text()).toBe('Design');
        expect(page().text()).toContain('Alle Schriften');
        expect(options[2]!.attributes('style')).toContain('ISD');
        expect(options.filter((o) => o.attributes('aria-selected') === 'true')).toHaveLength(1);
        wrapper.unmount();
    });

    it('has no caption „Design" where no theme is provided', async () => {
        const wrapper = mountField('lato');
        await wrapper.get('[data-testid="f"]').trigger('click');
        expect(page().findAll('[role="option"]')).toHaveLength(FONTS.length);
        expect(page().text()).not.toContain('Design');
        wrapper.unmount();
    });

    it('is chosen with arrows and Enter, and Escape closes without choosing', async () => {
        const wrapper = mountField('lato');
        await wrapper.get('[data-testid="f"]').trigger('click');
        const list = page().get('[role="listbox"]');
        const start = FONTS.findIndex((f) => f.key === 'lato');
        await list.trigger('keydown', { key: 'ArrowDown' });
        await list.trigger('keydown', { key: 'Enter' });
        const field = wrapper.findComponent(FontField);
        expect(field.emitted('update:modelValue')).toEqual([[FONTS[start + 1]!.key]]);
        expect(page().find('[role="listbox"]').exists()).toBe(false);

        await wrapper.get('[data-testid="f"]').trigger('click');
        await page().get('[role="listbox"]').trigger('keydown', { key: 'Escape' });
        expect(page().find('[role="listbox"]').exists()).toBe(false);
        expect(field.emitted('update:modelValue')).toHaveLength(1);
        wrapper.unmount();
    });

    it('a click on a row chooses it', async () => {
        const wrapper = mountField('lato');
        await wrapper.get('[data-testid="f"]').trigger('click');
        await page().get('[data-value="oswald"]').trigger('click');
        expect(wrapper.findComponent(FontField).emitted('update:modelValue')).toEqual([['oswald']]);
        wrapper.unmount();
    });
});
