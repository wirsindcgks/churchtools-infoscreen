import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { describe, expect, it } from 'vitest';
import { defineComponent, h } from 'vue';
import { provideStageContext } from '../player/context';
import { MemoryKv } from '../store/memory-kv';
import { ScreenRepository } from '../store/screen-repository';
import { useEditorStore } from './editor-store';
import Inspector from './Inspector.vue';
import { createScreenBundle } from './ops';

/** The inspector below a stage, as in the editor – with nothing chosen it shows the slide's settings. */
function mountInspector() {
    const Host = defineComponent({
        setup() {
            provideStageContext({ now: new Date(), timeZone: 'Europe/Berlin', clockConfirmed: true, churchName: '', appointments: [], media: new Map() });
            return () => h(Inspector, { calendars: [], groups: [], homepages: [], rooms: null });
        },
    });
    return mount(Host);
}

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

describe('the layers (Plan.md 79, B3; Plan.md 88: the list stands with nothing chosen)', () => {
    it('lists the top layer first, selects by click, and says in "Anordnen" which layer the chosen block is', async () => {
        const editor = await open();
        editor.addBlock('text');
        editor.addBlock('shape');
        editor.addBlock('clock');
        const [text, shape] = editor.slide!.blocks;
        editor.selectBlock(null);
        const wrapper = mountInspector();
        const rows = wrapper.findAll('[data-testid="layer-row"]');
        expect(rows.map((r) => r.find('.layer-name').text())).toEqual(['Uhr', 'Fläche', 'Text']);
        await rows[1]!.trigger('click');
        expect(editor.block?.id).toBe(shape!.id);
        expect(wrapper.find('[data-testid="layer-row"]').exists()).toBe(false);
        expect(wrapper.get('[data-testid="layer-position"]').text()).toBe('Ebene 2 von 3');
        expect(text).toBeDefined();
    });

    it('marks a locked block with a lock and does not offer its handle', async () => {
        const editor = await open();
        editor.addBlock('text');
        editor.addBlock('shape');
        editor.setLocked([editor.slide!.blocks[0]!.id], true);
        editor.selectBlock(null);
        const wrapper = mountInspector();
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

describe('"Termine mit diesen Tags ausblenden" (Plan.md 82 C)', () => {
    const props = (tags?: { id: number; name: string; color?: string }[] | null) => ({ calendars: [], groups: [], homepages: [], rooms: null, tags });

    it('hides tags by switch, takes the field away with the last one, and offers a deleted tag to be removed', async () => {
        const editor = await open();
        editor.addBlock('countdown');
        const wrapper = mount(Inspector, { props: props([{ id: 4, name: 'Intern', color: 'basic' }, { id: 5, name: 'Probe', color: 'red' }]) });
        const hidden = () => (editor.block as { hideTagIds?: number[] }).hideTagIds;
        await wrapper.get('[data-testid="section-hide-tags-toggle"]').trigger('click');
        await wrapper.get('[data-testid="hide-tag-5"]').setValue(true);
        await wrapper.get('[data-testid="hide-tag-4"]').setValue(true);
        expect(hidden()).toEqual([4, 5]);
        await wrapper.get('[data-testid="hide-tag-4"]').setValue(false);
        await wrapper.get('[data-testid="hide-tag-5"]').setValue(false);
        expect(hidden()).toBeUndefined();

        editor.updateBlock(editor.block!.id, { hideTagIds: [9] } as never);
        await wrapper.vm.$nextTick();
        expect(wrapper.get('[data-testid="hide-tag-gone-9"]').text()).toContain('Tag gelöscht');
        await wrapper.get('[data-testid="hide-tag-gone-9"] button').trigger('click');
        expect(hidden()).toBeUndefined();
    });

    it('says there are no tags, and stays away where they could not be loaded', async () => {
        const editor = await open();
        editor.addBlock('countdown');
        const none = mount(Inspector, { props: props([]) });
        expect(none.get('[data-testid="hide-tags-none"]').text()).toContain('noch keine Termin-Tags');
        const failed = mount(Inspector, { props: props(null) });
        expect(failed.find('[data-testid="hide-tags-none"]').exists()).toBe(false);
        expect(failed.find('[data-testid="section-hide-tags"]').exists()).toBe(false);
    });
});
