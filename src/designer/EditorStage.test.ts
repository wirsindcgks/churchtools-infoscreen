import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeAll, describe, expect, it } from 'vitest';
import { defineComponent, h } from 'vue';
import { provideStageContext } from '../player/context';
import { MemoryKv } from '../store/memory-kv';
import { ScreenRepository } from '../store/screen-repository';
import EditorStage from './EditorStage.vue';
import { useEditorStore } from './editor-store';
import { createScreenBundle } from './ops';

async function setup() {
    const repository = new ScreenRepository(new MemoryKv());
    const bundle = createScreenBundle({ name: 'Foyer', slug: 'foyer', orientation: 'landscape' });
    await repository.saveScreen(bundle, { expectedRevision: null, updatedBy: 'Anna' });
    const pinia = createPinia();
    setActivePinia(pinia);
    const editor = useEditorStore();
    editor.attach(repository);
    await editor.open(bundle.screen.defaultPlaylistId);
    const Host = defineComponent({
        setup() {
            provideStageContext({ now: new Date(), timeZone: 'Europe/Berlin', clockConfirmed: true, churchName: '', appointments: [], media: new Map() });
            return () => h(EditorStage);
        },
    });
    const wrapper = mount(Host, { global: { plugins: [pinia] } });
    await flushPromises();
    return { editor, wrapper };
}

describe('the presentation\'s progress bar on the editor stage (Plan.md 105)', () => {
    beforeAll(() => {
        // jsdom has no media queries: the wide layout, nothing listening.
        window.matchMedia ??= ((query: string) => ({ matches: true, media: query, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
        globalThis.ResizeObserver ??= class {
            observe(): void {}
            unobserve(): void {}
            disconnect(): void {}
        };
    });

    it('stands at 40 % while the presentation has a bar, with the number of the open slide, and is gone without', async () => {
        const { editor, wrapper } = await setup();
        expect(wrapper.find('[data-testid="slide-progress"]').exists()).toBe(false);

        editor.addSlide();
        editor.setProgress(true);
        await flushPromises();
        expect(wrapper.find('[data-testid="slide-progress"]').exists()).toBe(true);
        const fill = wrapper.get<HTMLElement>('[data-testid="slide-progress"] .fill').element;
        expect(fill.style.transition).toBe('none');
        expect(fill.style.transform).toBe('scaleX(0.4)');
        expect(editor.slides).toHaveLength(2);
        expect(wrapper.get('[data-testid="slide-number"]').text()).toBe(`${editor.slides.findIndex((s) => s.id === editor.slide!.id) + 1}/2`);

        editor.setProgress(false);
        await flushPromises();
        expect(wrapper.find('[data-testid="slide-progress"]').exists()).toBe(false);
    });

    it('names no number for a slide that is switched off', async () => {
        const { editor, wrapper } = await setup();
        editor.addSlide();
        editor.setProgress(true);
        editor.updateSlide({ enabled: false });
        await flushPromises();
        expect(wrapper.find('[data-testid="slide-progress"]').exists()).toBe(true);
        expect(wrapper.find('[data-testid="slide-number"]').exists()).toBe(false);
    });
});
