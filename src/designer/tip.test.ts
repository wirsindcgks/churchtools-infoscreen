import { mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h, withDirectives } from 'vue';
import { vTip } from './tip';

const Host = defineComponent({
    props: { text: { type: String, default: 'Duplizieren (Strg+D)' } },
    setup(props) {
        return () => h('div', { class: 'infoscreen-designer' }, [withDirectives(h('button', { 'aria-label': 'Duplizieren' }, 'x'), [[vTip, props.text]])]);
    },
});

const face = () => document.querySelector('[data-testid="tip"]');

/** jsdom calls a programmatic focus no keyboard focus; the browser's `:focus-visible` is stood in for here. */
function tab(button: HTMLElement): void {
    vi.spyOn(button, 'matches').mockImplementation((selector) => selector === ':focus-visible');
    button.focus();
}

describe('v-tip (Plan.md 79, B3)', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => {
        vi.useRealTimers();
        document.body.innerHTML = '';
    });

    it('shows after 300 ms of hovering and goes when the pointer leaves', () => {
        const wrapper = mount(Host, { attachTo: document.body });
        const button = wrapper.get('button').element;
        button.dispatchEvent(new Event('pointerenter'));
        vi.advanceTimersByTime(299);
        expect(face()).toBeNull();
        vi.advanceTimersByTime(1);
        expect(face()?.textContent).toBe('Duplizieren (Strg+D)');
        button.dispatchEvent(new Event('pointerleave'));
        expect(face()).toBeNull();
    });

    it('shows at once on keyboard focus and closes on Escape', () => {
        const wrapper = mount(Host, { attachTo: document.body });
        tab(wrapper.get('button').element);
        expect(face()?.textContent).toBe('Duplizieren (Strg+D)');
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        expect(face()).toBeNull();
    });

    it('closes on a click and never shows for a finger', () => {
        const wrapper = mount(Host, { attachTo: document.body });
        const button = wrapper.get('button').element;
        const touch = Object.assign(new Event('pointerenter'), { pointerType: 'touch' });
        button.dispatchEvent(touch);
        vi.advanceTimersByTime(1000);
        expect(face()).toBeNull();
        tab(button);
        expect(face()).not.toBeNull();
        button.dispatchEvent(new Event('click'));
        expect(face()).toBeNull();
    });

    it('sits in the designer element and follows a changed text', async () => {
        const wrapper = mount(Host, { attachTo: document.body });
        tab(wrapper.get('button').element);
        expect(face()?.parentElement?.classList.contains('infoscreen-designer')).toBe(true);
        await wrapper.setProps({ text: 'Kopieren (Strg+C)' });
        expect(face()?.textContent).toBe('Kopieren (Strg+C)');
        wrapper.unmount();
        expect(face()).toBeNull();
    });
});
