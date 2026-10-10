import { mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h, nextTick, ref } from 'vue';
import { useOffsetTop } from './useOffsetTop';

let offset = 0;
let observers: { callback: () => void; observe: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn> }[] = [];

function host() {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(() => ({ top: offset }) as DOMRect);
    let exposed!: ReturnType<typeof useOffsetTop>;
    const wrapper = mount(
        defineComponent({
            setup() {
                const el = ref<HTMLElement | null>(null);
                exposed = useOffsetTop(el);
                return () => h('div', { ref: el }, String(exposed.value));
            },
        }),
    );
    return { wrapper, top: exposed };
}

describe('useOffsetTop', () => {
    beforeEach(() => {
        offset = 56;
        observers = [];
        vi.stubGlobal(
            'ResizeObserver',
            class {
                observe = vi.fn();
                disconnect = vi.fn();
                constructor(public callback: () => void) {
                    observers.push(this);
                }
            },
        );
    });
    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('measures on a resize and when the body changes size', () => {
        const { wrapper, top } = host();
        expect(top.value).toBe(56);
        offset = 57;
        window.dispatchEvent(new Event('resize'));
        expect(top.value).toBe(57);
        offset = 80;
        observers[0]!.callback();
        expect(top.value).toBe(80);
        expect(observers[0]!.observe).toHaveBeenCalledWith(document.body);
        wrapper.unmount();
    });

    it('measures again when a banner is put above the bar later, and when it goes', async () => {
        const { wrapper, top } = host();
        offset = 112;
        const banner = document.createElement('div');
        document.body.prepend(banner);
        await nextTick();
        await new Promise((resolve) => setTimeout(resolve));
        expect(top.value).toBe(112);
        expect(observers[0]!.observe).toHaveBeenCalledWith(banner);
        offset = 56;
        banner.remove();
        await new Promise((resolve) => setTimeout(resolve));
        expect(top.value).toBe(56);
        wrapper.unmount();
    });

    it('measures at once on mounting', async () => {
        const { wrapper } = host();
        await nextTick();
        expect(wrapper.text()).toBe('56');
        wrapper.unmount();
    });

    it('stops listening once unmounted', () => {
        const { wrapper, top } = host();
        wrapper.unmount();
        expect(observers[0]!.disconnect).toHaveBeenCalled();
        offset = 99;
        window.dispatchEvent(new Event('resize'));
        expect(top.value).toBe(56);
    });
});
