import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { defineComponent, h, ref } from 'vue';
import type { SlideDoc, ThemeDoc } from '../model/schema';
import ColorField from './ColorField.vue';
import { providePalette } from './palette';

const theme = { accent: '#3b82f6', text: '#ffffff', background: '#1e293b', palette: [{ name: 'Sonnengelb', color: '#f5b301' }] } as ThemeDoc;
const slide = { blocks: [{ style: { color: '#12ab34' } }] } as unknown as SlideDoc;

/** The field below a page that provides theme and slide, as in the editor. */
function mountField(modelValue: string, provided = true) {
    const Host = defineComponent({
        setup() {
            if (provided) providePalette(ref(theme), ref(slide));
            return () => h(ColorField, { modelValue, label: 'Farbe', testid: 'c' });
        },
    });
    return mount(Host);
}

describe('ColorField, design first (Plan.md 79, B2)', () => {
    it('lists the design colours, then the colours of the slide, then „Eigene Farbe"', () => {
        const html = mountField('#ffffff').html();
        expect(html.indexOf('palette-group')).toBeGreaterThan(-1);
        expect(html.indexOf('palette-group')).toBeLessThan(html.indexOf('slide-colors-group'));
        expect(html.indexOf('slide-colors-group')).toBeLessThan(html.indexOf('Eigene Farbe'));
        const wrapper = mountField('#ffffff');
        expect(wrapper.get('[data-testid="palette-group"]').findAll('button')).toHaveLength(4);
        expect(wrapper.get('[data-testid="palette-group"]').findAll('button')[0]!.attributes('aria-label')).toBe('Akzent (#3B82F6)');
    });

    it('stays folded on a colour of the palette and marks the chosen swatch', () => {
        const wrapper = mountField('#F5B301');
        expect(wrapper.find('input[type="color"]').exists()).toBe(false);
        expect(wrapper.find('input.hex').exists()).toBe(false);
        expect(wrapper.get('[data-testid="c-custom"]').attributes('aria-expanded')).toBe('false');
        const pressed = wrapper.findAll('[aria-pressed="true"]');
        expect(pressed.map((p) => p.attributes('aria-label'))).toEqual(expect.arrayContaining(['Sonnengelb (#F5B301)']));
    });

    it('is open on a free colour, and the button folds and unfolds it', async () => {
        const wrapper = mountField('#12ab34');
        expect(wrapper.find('input.hex').exists()).toBe(true);
        expect(wrapper.get('[data-testid="c-custom"]').attributes('aria-expanded')).toBe('true');
        await wrapper.get('[data-testid="c-custom"]').trigger('click');
        expect(wrapper.find('input.hex').exists()).toBe(false);
        await wrapper.get('[data-testid="c-custom"]').trigger('click');
        expect(wrapper.find('input.hex').exists()).toBe(true);
    });

    it('a click on a swatch sets its hex value', async () => {
        const wrapper = mountField('#12ab34');
        await wrapper.get('[data-testid="c-swatch"]').trigger('click');
        const field = wrapper.findComponent(ColorField);
        expect(field.emitted('update:modelValue')).toEqual([['#3b82f6']]);
    });

    it('without a page that provides the theme, picker and hex stand alone, with no fold', () => {
        const wrapper = mountField('#12ab34', false);
        expect(wrapper.find('input.hex').exists()).toBe(true);
        expect(wrapper.find('[data-testid="c-custom"]').exists()).toBe(false);
    });
});
