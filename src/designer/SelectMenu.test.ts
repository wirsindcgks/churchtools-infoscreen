import { DOMWrapper, mount } from '@vue/test-utils';
import { afterEach, describe, expect, it } from 'vitest';
import { defineComponent, h, ref } from 'vue';
import SelectMenu, { type SelectOption } from './SelectMenu.vue';

const FOUR: SelectOption[] = [
    { value: 'a', label: 'Apfel' },
    { value: 'b', label: 'Birne' },
    { value: 'c', label: 'Dattel' },
    { value: 'd', label: 'Dornen' },
];
const FIVE: SelectOption[] = [...FOUR, { value: 'e', label: 'Erdbeere' }];

/** The list is set into the page, not into the menu: it is looked for there. */
const page = () => new DOMWrapper(document.body);

function mountMenu(options: SelectOption[], modelValue: string | number | undefined = 'a', extra: Record<string, unknown> = {}) {
    const Host = defineComponent({
        setup() {
            const value = ref(modelValue);
            return () => h(SelectMenu, { modelValue: value.value, options, testid: 'm', ariaLabel: 'Obst', 'onUpdate:modelValue': (v: string | number) => (value.value = v), ...extra });
        },
    });
    return mount(Host, { attachTo: document.body });
}

const button = (w: ReturnType<typeof mountMenu>) => w.get('[data-testid="m"]');

let wrapper: ReturnType<typeof mountMenu> | undefined;
afterEach(() => {
    wrapper?.unmount();
    wrapper = undefined;
});

describe('SelectMenu', () => {
    it('shows the chosen text on a closed combobox', () => {
        wrapper = mountMenu(FOUR, 'b');
        expect(button(wrapper).text()).toBe('Birne');
        expect(button(wrapper).attributes('role')).toBe('combobox');
        expect(button(wrapper).attributes('aria-expanded')).toBe('false');
        expect(page().find('[role="listbox"]').exists()).toBe(false);
    });

    it('shows the placeholder while nothing is chosen', async () => {
        wrapper = mountMenu(FOUR, '', { placeholder: 'Obst wählen …' });
        expect(button(wrapper).text()).toBe('Obst wählen …');
        await button(wrapper).trigger('click');
        expect(page().findAll('[role="option"]').filter((o) => o.attributes('aria-selected') === 'true')).toHaveLength(0);
    });

    it('opens with aria-expanded and marks the chosen option', async () => {
        wrapper = mountMenu(FOUR, 'b');
        await button(wrapper).trigger('click');
        expect(button(wrapper).attributes('aria-expanded')).toBe('true');
        expect(button(wrapper).attributes('aria-controls')).toBe(page().get('[role="listbox"]').attributes('id'));
        const options = page().findAll('[data-testid="m-option"]');
        expect(options.map((o) => o.attributes('data-value'))).toEqual(['a', 'b', 'c', 'd']);
        expect(options.map((o) => o.attributes('aria-selected'))).toEqual(['false', 'true', 'false', 'false']);
    });

    it('is chosen with arrows and Enter, and the focus returns to the button', async () => {
        wrapper = mountMenu(FOUR, 'a');
        await button(wrapper).trigger('click');
        const panel = page().get('.select-panel');
        await panel.trigger('keydown', { key: 'ArrowDown' });
        await panel.trigger('keydown', { key: 'Enter' });
        expect(button(wrapper).text()).toBe('Birne');
        expect(page().find('[role="listbox"]').exists()).toBe(false);
        expect(document.activeElement).toBe(button(wrapper).element);
    });

    it('opens from the button with an arrow key; Home and End jump; Space takes', async () => {
        wrapper = mountMenu(FOUR, 'b');
        await button(wrapper).trigger('keydown', { key: 'ArrowDown' });
        const panel = page().get('.select-panel');
        await panel.trigger('keydown', { key: 'End' });
        expect(page().get('.select-option.active').text()).toBe('Dornen');
        await panel.trigger('keydown', { key: 'Home' });
        expect(page().get('.select-option.active').text()).toBe('Apfel');
        await panel.trigger('keydown', { key: ' ' });
        expect(button(wrapper).text()).toBe('Apfel');
    });

    it('Escape closes without choosing and Tab closes too', async () => {
        wrapper = mountMenu(FOUR, 'a');
        await button(wrapper).trigger('click');
        await page().get('.select-panel').trigger('keydown', { key: 'ArrowDown' });
        await page().get('.select-panel').trigger('keydown', { key: 'Escape' });
        expect(page().find('[role="listbox"]').exists()).toBe(false);
        expect(button(wrapper).text()).toBe('Apfel');
        expect(document.activeElement).toBe(button(wrapper).element);

        await button(wrapper).trigger('click');
        await page().get('.select-panel').trigger('keydown', { key: 'Tab' });
        expect(page().find('[role="listbox"]').exists()).toBe(false);
    });

    it('a letter jumps to the first entry that starts with it, without a search field', async () => {
        wrapper = mountMenu(FOUR, 'a');
        await button(wrapper).trigger('click');
        expect(page().find('input').exists()).toBe(false);
        await page().get('.select-panel').trigger('keydown', { key: 'd' });
        expect(page().get('.select-option.active').text()).toBe('Dattel');
    });

    it('has a search field from five entries on, not at four', async () => {
        wrapper = mountMenu(FOUR);
        await button(wrapper).trigger('click');
        expect(page().find('[data-testid="m-search"]').exists()).toBe(false);
        wrapper.unmount();

        wrapper = mountMenu(FIVE);
        await button(wrapper).trigger('click');
        const search = page().get('[data-testid="m-search"]');
        expect(document.activeElement).toBe(search.element);
        await search.setValue('dorn');
        expect(page().findAll('[role="option"]').map((o) => o.text())).toEqual(['Dornen']);
        await search.setValue('xyz');
        expect(page().findAll('[role="option"]')).toHaveLength(0);
        expect(page().get('.select-caption').text()).toContain('xyz');
    });

    it('arrows in the search field act on the filtered list', async () => {
        wrapper = mountMenu(FIVE);
        await button(wrapper).trigger('click');
        await page().get('[data-testid="m-search"]').setValue('r');
        const shown = page().findAll('[role="option"]').map((o) => o.text());
        expect(shown).toEqual(['Birne', 'Dornen', 'Erdbeere']);
        await page().get('.select-panel').trigger('keydown', { key: 'ArrowDown' });
        await page().get('.select-panel').trigger('keydown', { key: 'Enter' });
        expect(button(wrapper).text()).toBe('Dornen');
    });

    it('sets a caption before the first option of each group', async () => {
        wrapper = mountMenu([
            { value: 'a', label: 'Apfel', group: 'Kern' },
            { value: 'b', label: 'Birne', group: 'Kern' },
            { value: 'c', label: 'Dattel', group: 'Stein' },
        ]);
        await button(wrapper).trigger('click');
        expect(page().findAll('.select-caption').map((c) => c.text())).toEqual(['Kern', 'Stein']);
    });

    it('does not open while disabled', async () => {
        wrapper = mountMenu(FOUR, 'a', { disabled: true });
        await button(wrapper).trigger('click');
        expect(page().find('[role="listbox"]').exists()).toBe(false);
    });
});
