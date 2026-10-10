import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { describe, expect, it } from 'vitest';
import { defineComponent, h, provide } from 'vue';
import { provideStageContext } from '../../player/context';
import { MemoryKv } from '../../store/memory-kv';
import { ScreenRepository } from '../../store/screen-repository';
import { useEditorStore } from '../editor-store';
import { createScreenBundle } from '../ops';
import { INSPECTOR_CONTEXT } from './context';
import SlideInspector from './SlideInspector.vue';

async function setup() {
    const repository = new ScreenRepository(new MemoryKv());
    const bundle = createScreenBundle({ name: 'Foyer', slug: 'foyer', orientation: 'landscape' });
    await repository.saveScreen(bundle, { expectedRevision: null, updatedBy: 'Anna' });
    const pinia = createPinia();
    setActivePinia(pinia);
    const editor = useEditorStore();
    editor.attach(repository);
    await editor.open(bundle.screen.defaultPlaylistId);
    const picked: string[] = [];
    const Host = defineComponent({
        setup() {
            provideStageContext({ now: new Date(), timeZone: 'Europe/Berlin', clockConfirmed: true, churchName: '', appointments: [], media: new Map() });
            provide(INSPECTOR_CONTEXT, { pickImage: (kind) => picked.push(kind), calendars: [], groups: [], homepages: [], rooms: null });
            return () => h(SlideInspector);
        },
    });
    const wrapper = mount(Host, { global: { plugins: [pinia], stubs: { RouterLink: true } } });
    return { editor, wrapper, picked };
}

/** The value of the checked radio button in the group with this test id. */
function checked(wrapper: Awaited<ReturnType<typeof setup>>['wrapper'], testid: string): string | undefined {
    return wrapper.get(`[data-testid="${testid}"] input:checked`).attributes('value') ?? undefined;
}

describe('the inspector of the slide (Plan.md 79, B2)', () => {
    it('shows the duration with its unit and "Anzeigen" as a switch', async () => {
        const { editor, wrapper } = await setup();
        const duration = wrapper.get<HTMLInputElement>('[data-testid="duration-input"]');
        expect(duration.element.value).toBe(String(editor.slide!.durationSeconds));
        expect(wrapper.get('[data-testid="slide-inspector"] .unit').text()).toBe('s');
        const enabled = wrapper.get<HTMLInputElement>('[data-testid="slide-enabled"]');
        expect(enabled.attributes('role')).toBe('switch');
        expect(enabled.element.checked).toBe(true);
        await enabled.setValue(false);
        expect(editor.slide!.enabled).toBe(false);
    });

    it('offers the background as one segment, "Farbe · Verlauf · Bild"', async () => {
        const { wrapper } = await setup();
        const group = wrapper.get('[data-testid="background-kind"]');
        expect(group.findAll('.segment-face').map((f) => f.text())).toEqual(['Farbe', 'Verlauf', 'Bild']);
        expect(checked(wrapper, 'background-kind')).toBe('solid');
        // The colour or gradient is edited below; the choice between the two is only in the segment.
        expect(wrapper.find('[data-testid="fill-kind"]').exists()).toBe(false);
        expect(wrapper.find('[data-testid="fill-color"]').exists()).toBe(true);
    });

    it('turns the colour into a gradient and back without losing the colour', async () => {
        const { editor, wrapper } = await setup();
        editor.updateSlide({ background: { kind: 'solid', color: '#123456' } });
        await wrapper.get('[data-testid="background-kind"] input[value="linear-gradient"]').setValue(true);
        expect(editor.slide!.background).toMatchObject({ kind: 'linear-gradient', stops: [{ color: '#123456' }, { color: '#000000' }] });
        await wrapper.get('[data-testid="background-kind"] input[value="solid"]').setValue(true);
        expect(editor.slide!.background).toEqual({ kind: 'solid', color: '#123456' });
    });

    it('"Bild" opens the library and leaves the fill alone until a picture is picked', async () => {
        const { editor, wrapper, picked } = await setup();
        editor.updateSlide({ background: { kind: 'solid', color: '#123456' } });
        await wrapper.get('[data-testid="background-kind"] input[value="media"]').setValue(true);
        expect(picked).toEqual(['background']);
        // Cancelled: the segment says "Bild" and the field waits for one, the slide still has its colour.
        expect(checked(wrapper, 'background-kind')).toBe('media');
        expect(wrapper.get('[data-testid="pick-background"]').text()).toBe('Bild wählen');
        expect(editor.slide!.background).toEqual({ kind: 'solid', color: '#123456' });
        await wrapper.get('[data-testid="background-kind"] input[value="solid"]').setValue(true);
        expect(editor.slide!.background).toEqual({ kind: 'solid', color: '#123456' });
        expect(wrapper.find('[data-testid="fill-color"]').exists()).toBe(true);
    });

    it('with a picture the field says "Bild tauschen"; "Farbe" then starts from black', async () => {
        const { editor, wrapper, picked } = await setup();
        editor.updateSlide({ background: { kind: 'media', mediaId: 'bild-1' } });
        await flushPromises();
        expect(checked(wrapper, 'background-kind')).toBe('media');
        const pick = wrapper.get('[data-testid="pick-background"]');
        expect(pick.text()).toBe('Bild tauschen');
        await pick.trigger('click');
        expect(picked).toEqual(['background']);
        await wrapper.get('[data-testid="background-kind"] input[value="solid"]').setValue(true);
        expect(editor.slide!.background).toEqual({ kind: 'solid', color: '#000000' });
    });
});
