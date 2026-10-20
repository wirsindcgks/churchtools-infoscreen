import { mount } from '@vue/test-utils';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { defineComponent, h, nextTick, ref } from 'vue';
import HelpBar from './HelpBar.vue';
import { provideHelp, useGeneralHelp, type HelpRegister } from './help/register';
import InspectorSection from './InspectorSection.vue';
import { sectionState } from './section-state';

/** A page as the editor builds it: a register, the bar, and an inspector with two sections and one loose explanation. */
function page(opts: { general?: boolean } = {}) {
    const subject = ref('Text');
    const withGeneral = ref(opts.general ?? true);
    const withSections = ref(true);
    let register!: HelpRegister;
    const Loose = defineComponent({
        setup() {
            useGeneralHelp(() => (withGeneral.value ? [{ term: 'Adresse', text: 'Die Seite muss sich einbetten lassen.' }] : []));
            return () => null;
        },
    });
    const Host = defineComponent({
        setup() {
            register = provideHelp(() => subject.value);
            return () =>
                h('div', [
                    h(HelpBar),
                    h(Loose),
                    ...(withSections.value
                        ? [
                              h(InspectorSection, { id: 'calendars', title: 'Kalender', summary: '2', help: { intro: 'Erster Absatz.\n\nZweiter Absatz.' } }, () => 'x'),
                              h(InspectorSection, { id: 'appearance', title: 'Darstellung', summary: 'Zeilen', help: { items: [{ term: 'Zeitraum', text: 'Wie weit voraus die Termine zählen.' }] } }, () => 'y'),
                          ]
                        : []),
                ]);
        },
    });
    const wrapper = mount(Host, { attachTo: document.body });
    return { wrapper, register, subject, withGeneral, withSections };
}

beforeAll(() => {
    // jsdom has no media queries: a desktop window, which never matches the phone line.
    vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: () => undefined, removeEventListener: () => undefined }));
});

afterEach(() => {
    sectionState.calendars = false;
    sectionState.appearance = false;
    document.body.innerHTML = '';
});

describe('HelpBar (Plan.md 98)', () => {
    it('is not there while closed, and shows the subject and the tabs once open', async () => {
        sectionState.calendars = true;
        sectionState.appearance = true;
        const { wrapper, register } = page();
        await nextTick();
        expect(wrapper.find('[data-testid="help-bar"]').exists()).toBe(false);
        register.toggleStart();
        await nextTick();
        expect(wrapper.get('[data-testid="help-title"]').text()).toBe('Hilfe · Text');
        const tabs = wrapper.findAll('[role="tab"]').map((tab) => tab.text());
        expect(tabs).toEqual(['Allgemein', 'Kalender', 'Darstellung']);
        expect(wrapper.get('[data-testid="help-tab-general"]').attributes('aria-selected')).toBe('true');
        expect(wrapper.get('[data-testid="help-panel"]').text()).toContain('Die Seite muss sich einbetten lassen.');
    });

    it('lists the topics in the order of the page, without "Allgemein" when nothing loose is explained', async () => {
        sectionState.calendars = true;
        sectionState.appearance = true;
        const { wrapper, register } = page({ general: false });
        await nextTick();
        register.toggle('appearance');
        await nextTick();
        expect(wrapper.findAll('[role="tab"]').map((tab) => tab.text())).toEqual(['Kalender', 'Darstellung']);
        expect(wrapper.get('[data-testid="help-panel"]').text()).toContain('Zeitraum');
        expect(wrapper.get('[data-testid="help-panel"]').text()).toContain('Wie weit voraus');
    });

    it('splits an introduction into paragraphs and moves with the arrow keys', async () => {
        sectionState.calendars = true;
        const { wrapper, register } = page();
        await nextTick();
        register.toggle('calendars');
        await nextTick();
        expect(wrapper.findAll('[data-testid="help-panel"] p').map((p) => p.text())).toEqual(['Erster Absatz.', 'Zweiter Absatz.']);
        await wrapper.get('[data-testid="help-tab-calendars"]').trigger('keydown', { key: 'ArrowLeft' });
        expect(register.active.value).toBe('general');
        await wrapper.get('[data-testid="help-tab-general"]').trigger('keydown', { key: 'End' });
        expect(register.active.value).toBe('appearance');
    });

    it('searches across all topics and groups the hits by topic', async () => {
        sectionState.calendars = true;
        sectionState.appearance = true;
        const { wrapper, register } = page();
        await nextTick();
        register.toggleStart();
        await nextTick();
        await wrapper.get('[data-testid="help-search"]').setValue('voraus');
        expect(wrapper.find('[data-testid="help-hit-appearance"]').exists()).toBe(true);
        expect(wrapper.find('[data-testid="help-hit-general"]').exists()).toBe(false);
        await wrapper.get('[data-testid="help-search"]').setValue('absatz');
        expect(wrapper.get('[data-testid="help-hit-calendars"]').text()).toContain('Zweiter Absatz.');
        await wrapper.get('[data-testid="help-search"]').setValue('gibtesnicht');
        expect(wrapper.find('[data-testid="help-empty"]').exists()).toBe(true);
    });

    it('closes with the ✕ and forgets the search', async () => {
        sectionState.calendars = true;
        const { wrapper, register } = page();
        await nextTick();
        register.toggleStart();
        await nextTick();
        await wrapper.get('[data-testid="help-search"]').setValue('adresse');
        await wrapper.get('[data-testid="help-close"]').trigger('click');
        expect(register.open.value).toBe(false);
        expect(wrapper.find('[data-testid="help-bar"]').exists()).toBe(false);
        register.toggleStart();
        await nextTick();
        expect((wrapper.get('[data-testid="help-search"]').element as HTMLInputElement).value).toBe('');
    });

    it('follows the subject: keeps its tab, else takes the first one, and closes without any topic', async () => {
        const { wrapper, register, subject, withGeneral, withSections } = page();
        await nextTick();
        register.toggle('appearance');
        await nextTick();
        subject.value = 'Bild';
        await nextTick();
        expect(wrapper.get('[data-testid="help-title"]').text()).toBe('Hilfe · Bild');
        expect(register.active.value).toBe('appearance');
        // "Allgemein" goes away: the bar takes the first topic that is left.
        register.toggle('general');
        await nextTick();
        withGeneral.value = false;
        await nextTick();
        expect(register.active.value).toBe('calendars');
        expect(register.open.value).toBe(true);
        // Nothing is left: the bar closes.
        withSections.value = false;
        await nextTick();
        await nextTick();
        expect(register.sections.value).toEqual([]);
        expect(register.open.value).toBe(false);
    });
});
