import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useEditorStore } from '../../editor-store';
import NumberField from './NumberField.vue';

function field(props: Record<string, unknown> = {}) {
    const pinia = createPinia();
    setActivePinia(pinia);
    const wrapper = mount(NumberField, { props: { modelValue: 50, label: 'Größe', unit: 'px', min: 8, max: 100, testid: 'size', ...props }, global: { plugins: [pinia] } });
    return { wrapper, input: wrapper.get('[data-testid="size"]') };
}

const last = (wrapper: ReturnType<typeof field>['wrapper']) => wrapper.emitted('update:modelValue')?.at(-1)?.[0];

describe('NumberField', () => {
    beforeEach(() => setActivePinia(createPinia()));

    it('shows the unit inside the field', () => {
        const { wrapper, input } = field();
        expect((input.element as HTMLInputElement).value).toBe('50');
        expect(wrapper.get('.unit').text()).toBe('px');
    });

    it('takes a value within the limits while typing, and keeps one outside them waiting', async () => {
        const { wrapper, input } = field();
        await input.setValue('70');
        expect(last(wrapper)).toBe(70);
        await input.setValue('3'); // below the minimum – half-typed, nothing lands in the document
        await input.setValue('500');
        expect(wrapper.emitted('update:modelValue')).toEqual([[70]]);
        expect((input.element as HTMLInputElement).value).toBe('500');
    });

    it('limits to the range only when the field is left', async () => {
        const { wrapper, input } = field();
        await input.setValue('500');
        await input.trigger('blur');
        expect(last(wrapper)).toBe(100);
        expect((input.element as HTMLInputElement).value).toBe('100');
        await input.setValue('2');
        await input.trigger('blur');
        expect(last(wrapper)).toBe(8);
    });

    it('goes back to the old number when left empty', async () => {
        const { wrapper, input } = field();
        await input.setValue('');
        await input.trigger('blur');
        expect(wrapper.emitted('update:modelValue')).toBeUndefined();
        expect((input.element as HTMLInputElement).value).toBe('50');
    });

    it('steps by 1 with the arrow keys and by 10 with Shift, within the limits', async () => {
        const { wrapper, input } = field();
        await input.trigger('keydown', { key: 'ArrowUp' });
        expect(last(wrapper)).toBe(51);
        await input.trigger('keydown', { key: 'ArrowDown', shiftKey: true });
        expect(last(wrapper)).toBe(41); // from what the field shows, 51
        await input.setValue('98');
        await input.trigger('keydown', { key: 'ArrowUp', shiftKey: true });
        expect(last(wrapper)).toBe(100);
    });

    it('is one undo step from focus to blur', async () => {
        const { input } = field();
        const editor = useEditorStore();
        const begin = vi.spyOn(editor, 'beginGesture');
        const end = vi.spyOn(editor, 'endGesture');
        await input.trigger('focus');
        await input.trigger('blur');
        expect([begin.mock.calls.length, end.mock.calls.length]).toEqual([1, 1]);
    });
});
