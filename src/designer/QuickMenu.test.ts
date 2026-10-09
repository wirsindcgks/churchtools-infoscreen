import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { describe, expect, it } from 'vitest';
import { defineComponent, h, provide, ref } from 'vue';
import { provideStageContext } from '../player/context';
import { INSPECTOR_CONTEXT } from './inspector/context';
import { createBlock } from './ops';
import QuickMenu from './QuickMenu.vue';

function mountMenu() {
    const pinia = createPinia();
    setActivePinia(pinia);
    const block = createBlock('clock', { width: 1920, height: 1080 }, [1]);
    const frame = ref({ left: 400, top: 300, width: 200, height: 100 });
    const Host = defineComponent({
        setup() {
            provideStageContext({ now: new Date(), timeZone: 'Europe/Berlin', clockConfirmed: true, churchName: '', appointments: [], media: new Map() });
            provide(INSPECTOR_CONTEXT, { pickImage: () => undefined, calendars: [], groups: [], homepages: [], rooms: [] });
            return () => h(QuickMenu, { block, frame: frame.value, host: { width: 1000, height: 600 } });
        },
    });
    const wrapper = mount(Host, { attachTo: document.body, global: { plugins: [pinia] } });
    const left = () => (wrapper.find('[data-testid="quick-menu"]').element as HTMLElement).style.left;
    return { wrapper, frame, left };
}

describe('QuickMenu (Plan.md 79, C1)', () => {
    it('follows the block, but stands still while the focus is in it', async () => {
        const { wrapper, frame, left } = mountMenu();
        await wrapper.vm.$nextTick();
        expect(left()).toBe('500px');
        frame.value = { left: 600, top: 300, width: 200, height: 100 };
        await wrapper.vm.$nextTick();
        expect(left()).toBe('700px');

        // Focus in the menu: the block moves on, the menu keeps its place.
        await wrapper.find('[data-testid="quick-lock"]').trigger('focusin');
        frame.value = { left: 100, top: 300, width: 200, height: 100 };
        await wrapper.vm.$nextTick();
        expect(left()).toBe('700px');

        // Focus out of the menu: it takes the new place.
        await wrapper.find('[data-testid="quick-menu"]').trigger('focusout', { relatedTarget: document.body });
        expect(left()).toBe('200px');
        wrapper.unmount();
    });

    it('keeps Delete and Backspace from the editor, whose shortcut would remove the block', async () => {
        const { wrapper } = mountMenu();
        const reached: string[] = [];
        document.body.addEventListener('keydown', (e) => reached.push(e.key), { once: false });
        await wrapper.find('[data-testid="quick-lock"]').trigger('keydown', { key: 'Delete' });
        await wrapper.find('[data-testid="quick-lock"]').trigger('keydown', { key: 'a' });
        expect(reached).toEqual(['a']);
        wrapper.unmount();
    });
});
