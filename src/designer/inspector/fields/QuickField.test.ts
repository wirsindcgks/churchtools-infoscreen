import { mount, type VueWrapper } from '@vue/test-utils';
import { createPinia } from 'pinia';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h, provide, ref } from 'vue';
import { INSPECTOR_MODE, QUICK_OPEN } from '../mode';
import NumberField from './NumberField.vue';
import SegmentField from './SegmentField.vue';

const words = [{ value: 'a', label: 'Eins' }, { value: 'b', label: 'Zwei' }];

/** Two fields in the short menu, as `QuickMenu` provides it. */
function menu(onKeydown = () => undefined) {
    const Host = defineComponent({
        setup() {
            provide(INSPECTOR_MODE, 'quick');
            provide(QUICK_OPEN, ref<string | null>(null));
            return () =>
                h('div', { onKeydown }, [
                    h(NumberField, { modelValue: 12, label: 'Ecken', unit: 'px', quick: true }),
                    h(SegmentField, { modelValue: 'b', options: words, label: 'Einpassen', quick: true }),
                ]);
        },
    });
    return mount(Host, { attachTo: document.body, global: { plugins: [createPinia()] } });
}

const chips = (wrapper: VueWrapper) => wrapper.findAll('[data-testid="quick-chip"]');
const dialogs = (wrapper: VueWrapper) => wrapper.findAll('[data-testid="quick-popover"]');

describe('QuickField (Plan.md 79, C1)', () => {
    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('a chip opens its field below it, as a dialog named after the field', async () => {
        const wrapper = menu();
        const [chip] = chips(wrapper);
        expect(chip!.attributes('aria-haspopup')).toBe('dialog');
        expect(chip!.attributes('aria-expanded')).toBe('false');
        await chip!.trigger('click');
        expect(chip!.attributes('aria-expanded')).toBe('true');
        const [dialog] = dialogs(wrapper);
        expect(dialog!.attributes('role')).toBe('dialog');
        expect(dialog!.attributes('aria-label')).toBe('Ecken');
        // The field as the inspector draws it: with its visible label, and the number in it.
        expect(dialog!.find('.field-label').text()).toBe('Ecken');
        expect(dialog!.find('input[type="number"]').element).toBe(document.activeElement);
        wrapper.unmount();
    });

    it('the field in it is the full one: a segment of words shows all its words', async () => {
        const wrapper = menu();
        await chips(wrapper)[1]!.trigger('click');
        expect(dialogs(wrapper)[0]!.findAll('.segment-option')).toHaveLength(2);
        // The chosen one has the focus.
        expect((document.activeElement as HTMLInputElement).value).toBe('b');
        wrapper.unmount();
    });

    it('only one field is open at a time', async () => {
        const wrapper = menu();
        await chips(wrapper)[0]!.trigger('click');
        await chips(wrapper)[1]!.trigger('click');
        expect(dialogs(wrapper)).toHaveLength(1);
        expect(dialogs(wrapper)[0]!.attributes('aria-label')).toBe('Einpassen');
        expect(chips(wrapper)[0]!.attributes('aria-expanded')).toBe('false');
        wrapper.unmount();
    });

    it('a second click on the chip closes it', async () => {
        const wrapper = menu();
        await chips(wrapper)[0]!.trigger('click');
        await chips(wrapper)[0]!.trigger('click');
        expect(dialogs(wrapper)).toHaveLength(0);
        wrapper.unmount();
    });

    it('Escape closes the field, gives the focus back to the chip and goes no further', async () => {
        const reached = vi.fn();
        const wrapper = menu(reached);
        await chips(wrapper)[0]!.trigger('click');
        await dialogs(wrapper)[0]!.find('input').trigger('keydown', { key: 'Escape' });
        expect(dialogs(wrapper)).toHaveLength(0);
        expect(document.activeElement).toBe(chips(wrapper)[0]!.element);
        expect(reached).not.toHaveBeenCalled();
        // With nothing open, Escape passes: the editor deselects the block.
        await chips(wrapper)[0]!.trigger('keydown', { key: 'Escape' });
        expect(reached).toHaveBeenCalledOnce();
        wrapper.unmount();
    });

    it('a press outside the chip and its field closes it', async () => {
        const wrapper = menu();
        await chips(wrapper)[0]!.trigger('click');
        document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
        await Promise.resolve();
        expect(dialogs(wrapper)).toHaveLength(0);
        wrapper.unmount();
    });

    it('a press inside the field does not close it', async () => {
        const wrapper = menu();
        await chips(wrapper)[0]!.trigger('click');
        dialogs(wrapper)[0]!.element.dispatchEvent(new Event('pointerdown', { bubbles: true }));
        await Promise.resolve();
        expect(dialogs(wrapper)).toHaveLength(1);
        wrapper.unmount();
    });

    it('stands in the menu without a label on screen when it is inline, and is invisible in the inspector', () => {
        const symbols = [{ value: 'a', label: 'Links', icon: 'align-left' as const }];
        const inMenu = mount(SegmentField, {
            props: { modelValue: 'a', options: symbols, label: 'Ausrichtung', quick: true },
            global: { provide: { [INSPECTOR_MODE as symbol]: 'quick' } },
        });
        expect(inMenu.find('[data-quick-inline] .field-label').text()).toBe('Ausrichtung');
        const inspector = mount(SegmentField, { props: { modelValue: 'a', options: symbols, label: 'Ausrichtung', quick: true } });
        expect(inspector.find('[data-quick-inline]').exists()).toBe(false);
        expect(inspector.find('[data-testid="quick-chip"]').exists()).toBe(false);
    });
});
