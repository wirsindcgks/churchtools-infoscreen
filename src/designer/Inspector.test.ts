import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { describe, expect, it } from 'vitest';
import { MemoryKv } from '../store/memory-kv';
import { ScreenRepository } from '../store/screen-repository';
import { useEditorStore } from './editor-store';
import Inspector from './Inspector.vue';
import { createScreenBundle } from './ops';

async function open() {
    const repository = new ScreenRepository(new MemoryKv());
    const bundle = createScreenBundle({ name: 'Foyer', slug: 'foyer', orientation: 'landscape' });
    await repository.saveScreen(bundle, { expectedRevision: null, updatedBy: 'Anna' });
    setActivePinia(createPinia());
    const editor = useEditorStore();
    editor.attach(repository);
    await editor.open(bundle.screen.defaultPlaylistId);
    return editor;
}

describe('the layers in "Anordnen" (Plan.md 79, B3)', () => {
    it('lists the top layer first, says which layer the chosen block is, and selects by click', async () => {
        const editor = await open();
        editor.addBlock('text');
        editor.addBlock('shape');
        editor.addBlock('clock');
        const [text, shape, clock] = editor.slide!.blocks;
        editor.selectBlock(shape!.id);
        const wrapper = mount(Inspector, { props: { calendars: [], groups: [], homepages: [], rooms: null } });
        const rows = wrapper.findAll('[data-testid="layer-row"]');
        expect(rows.map((r) => r.find('.layer-name').text())).toEqual(['Uhr', 'Fläche', 'Text']);
        expect(rows[1]!.classes()).toContain('layer-item--on');
        expect(wrapper.get('[data-testid="layer-position"]').text()).toBe('Ebene 2 von 3');
        await rows[0]!.trigger('click');
        expect(editor.block?.id).toBe(clock!.id);
        expect(text).toBeDefined();
    });

    it('marks a locked block with a lock and does not offer its handle', async () => {
        const editor = await open();
        editor.addBlock('text');
        editor.addBlock('shape');
        editor.setLocked([editor.slide!.blocks[0]!.id], true);
        const wrapper = mount(Inspector, { props: { calendars: [], groups: [], homepages: [], rooms: null } });
        const rows = wrapper.findAll('[data-testid="layer-row"]');
        expect(rows[1]!.find('[data-testid="layer-lock"]').exists()).toBe(true);
        expect(rows[1]!.get('[data-testid="layer-handle"]').attributes('disabled')).toBeDefined();
        expect(rows[0]!.get('[data-testid="layer-handle"]').attributes('disabled')).toBeUndefined();
    });
});

describe('"Drehung und Deckkraft" (Plan.md F1)', () => {
    it('writes rotation and opacity, and takes the field away again at 0° and 100 %', async () => {
        const editor = await open();
        editor.addBlock('shape');
        const wrapper = mount(Inspector, { props: { calendars: [], groups: [], homepages: [], rooms: null } });
        expect(wrapper.find('[data-testid="inspector-rotation"]').exists()).toBe(true);
        const set = async (testid: string, value: string) => {
            const input = wrapper.get(`[data-testid="${testid}"]`);
            await input.setValue(value);
            await input.trigger('change');
        };
        await set('inspector-rotation', '45');
        await set('inspector-opacity', '60');
        expect(editor.slide!.blocks[0]).toMatchObject({ rotation: 45, opacity: 60 });
        await set('inspector-rotation', '0');
        await set('inspector-opacity', '100');
        expect(editor.slide!.blocks[0]).not.toHaveProperty('rotation');
        expect(editor.slide!.blocks[0]).not.toHaveProperty('opacity');
    });

    it('is not offered for several chosen blocks', async () => {
        const editor = await open();
        editor.addBlock('shape');
        editor.addBlock('text');
        editor.selectAll();
        const wrapper = mount(Inspector, { props: { calendars: [], groups: [], homepages: [], rooms: null } });
        expect(wrapper.find('[data-testid="inspector-rotation"]').exists()).toBe(false);
    });
});
