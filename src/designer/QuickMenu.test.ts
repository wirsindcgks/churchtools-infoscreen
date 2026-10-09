import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { describe, expect, it } from 'vitest';
import { defineComponent, h, provide, ref } from 'vue';
import { provideStageContext } from '../player/context';
import { INSPECTOR_CONTEXT } from './inspector/context';
import { createBlock } from './ops';
import QuickMenu from './QuickMenu.vue';

function mountMenu(variant?: 'bar', locked = false, count = 1) {
    const pinia = createPinia();
    setActivePinia(pinia);
    const block = { ...createBlock('clock', { width: 1920, height: 1080 }, [1]), locked };
    const blocks = Array.from({ length: count }, (_, i) => ({ ...block, id: `${block.id}-${i}` }));
    const frame = ref({ left: 400, top: 300, width: 200, height: 100 });
    const Host = defineComponent({
        setup() {
            provideStageContext({ now: new Date(), timeZone: 'Europe/Berlin', clockConfirmed: true, churchName: '', appointments: [], media: new Map() });
            provide(INSPECTOR_CONTEXT, { pickImage: () => undefined, calendars: [], groups: [], homepages: [], rooms: [] });
            return () => h(QuickMenu, variant ? { blocks, variant } : { blocks, frame: frame.value, host: { width: 1000, height: 600 } });
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

    it('as the bar of a phone: the symbol of the block, lock and unlock inside "⋯" and no place of its own', async () => {
        const { wrapper } = mountMenu('bar');
        const menu = wrapper.find('[data-testid="quick-menu"]');
        expect((menu.element as HTMLElement).style.left).toBe('');
        expect(menu.classes()).toContain('quick-menu--bar');
        expect(wrapper.find('[data-testid="quick-kind"]').attributes('aria-label')).toBe('Uhr');
        // Duplicate, delete, lock and unlock move into the list behind "⋯"; "Auswahl aufheben" stays in the bar.
        expect(wrapper.find('[data-testid="quick-deselect"]').attributes('aria-label')).toBe('Auswahl aufheben');
        expect(wrapper.find('[data-testid="quick-duplicate"]').exists()).toBe(false);
        expect(wrapper.find('[data-testid="quick-lock"]').exists()).toBe(false);
        await wrapper.find('[data-testid="quick-more"]').trigger('click');
        expect(wrapper.find('[data-testid="quick-duplicate"]').exists()).toBe(true);
        expect(wrapper.find('[data-testid="quick-lock"]').text()).toBe('Sperren');
        expect(wrapper.find('[data-testid="quick-all-settings"]').exists()).toBe(true);
        wrapper.unmount();
    });

    it('as the bar of a phone, a locked block keeps only its symbol and "⋯" with "Entsperren"', async () => {
        const { wrapper } = mountMenu('bar', true);
        expect(wrapper.find('[data-testid="quick-kind"]').exists()).toBe(true);
        expect(wrapper.find('[data-testid="quick-duplicate"]').exists()).toBe(false);
        expect(wrapper.find('.quick-fields').exists()).toBe(false);
        await wrapper.find('[data-testid="quick-more"]').trigger('click');
        expect(wrapper.find('[data-testid="quick-lock"]').text()).toBe('Entsperren');
        expect(wrapper.find('[data-testid="quick-layer-front"]').exists()).toBe(false);
        wrapper.unmount();
    });

    it('of several blocks: "3 Bausteine", lock, duplicate and delete, and in "⋯" copy, cut and let go (Plan.md 79, D5)', async () => {
        const { wrapper } = mountMenu(undefined, false, 3);
        expect(wrapper.find('[data-testid="quick-menu"]').attributes('aria-label')).toBe('Kurzmenü: 3 Bausteine');
        expect(wrapper.find('[data-testid="quick-count"]').text()).toBe('3 Bausteine');
        expect(wrapper.find('.quick-fields').exists()).toBe(false);
        for (const id of ['quick-lock', 'quick-duplicate', 'quick-delete']) expect(wrapper.find(`[data-testid="${id}"]`).exists()).toBe(true);
        await wrapper.find('[data-testid="quick-more"]').trigger('click');
        const items = wrapper.findAll('[data-testid="quick-more-list"] [role="menuitem"]').map((b) => b.attributes('data-testid'));
        expect(items).toEqual(['quick-copy', 'quick-cut', 'quick-deselect']);
        wrapper.unmount();
    });

    it('of several blocks as the bar of a phone: the count, and lock, duplicate, delete and all settings inside "⋯"', async () => {
        const { wrapper } = mountMenu('bar', false, 2);
        expect(wrapper.find('[data-testid="quick-count"]').text()).toBe('2 Bausteine');
        expect(wrapper.find('[data-testid="quick-deselect"]').exists()).toBe(true);
        expect(wrapper.find('[data-testid="quick-duplicate"]').exists()).toBe(false);
        await wrapper.find('[data-testid="quick-more"]').trigger('click');
        const items = wrapper.findAll('[data-testid="quick-more-list"] [role="menuitem"]').map((b) => b.attributes('data-testid'));
        expect(items).toEqual(['quick-lock', 'quick-duplicate', 'quick-copy', 'quick-cut', 'quick-all-settings', 'quick-delete']);
        wrapper.unmount();
    });
});
