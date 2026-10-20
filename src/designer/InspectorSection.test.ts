import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { nextTick } from 'vue';
import { createHelpRegister, HELP_REGISTER } from './help/register';
import InspectorSection from './InspectorSection.vue';
import { INSPECTOR_MODE, SECTION_GROUP } from './inspector/mode';
import { sectionState } from './section-state';

function nameOf(props: { group?: string | false }, provided?: string): string | undefined {
    const wrapper = mount(InspectorSection, {
        props: { id: 'x', title: 'X', summary: '', ...props },
        slots: { default: 'Inhalt' },
        global: provided ? { provide: { [SECTION_GROUP as symbol]: provided } } : {},
    });
    return wrapper.find('details').attributes('name');
}

describe('InspectorSection – group (Plan.md 91)', () => {
    it('has no name without a provided group', () => {
        expect(nameOf({})).toBeUndefined();
    });

    it('takes the provided group', () => {
        expect(nameOf({}, 'inspector')).toBe('inspector');
    });

    it('prefers its own group over the provided one', () => {
        expect(nameOf({ group: 'x' }, 'inspector')).toBe('x');
    });

    it('stays out of any group with group=false', () => {
        expect(nameOf({ group: false }, 'inspector')).toBeUndefined();
    });
});

describe('InspectorSection – the "?" of the help (Plan.md 98)', () => {
    const help = { intro: 'Erklärung', items: [{ term: 'Feld', text: 'Was es tut.' }] };

    function inPage(props: Record<string, unknown> = {}, mode: 'full' | 'quick' = 'full') {
        const register = createHelpRegister(() => 'Baustein');
        const wrapper = mount(InspectorSection, {
            attachTo: document.body,
            props: { id: 'appearance', title: 'Darstellung', summary: 'Kurz', help, ...props },
            slots: { default: 'Inhalt' },
            global: { provide: { [HELP_REGISTER as symbol]: register, [INSPECTOR_MODE as symbol]: mode } },
        });
        return { register, wrapper };
    }

    it('stands only while the section is open, and only with a topic', async () => {
        sectionState.appearance = false;
        const { wrapper } = inPage();
        expect(wrapper.find('[data-testid="section-appearance-help"]').exists()).toBe(false);
        sectionState.appearance = true;
        await nextTick();
        expect(wrapper.get('[data-testid="section-appearance-help"]').text()).toBe('?');
        expect(wrapper.get('[data-testid="section-appearance-help"]').attributes('aria-label')).toBe('Hilfe zu „Darstellung“');
        await wrapper.setProps({ help: undefined });
        expect(wrapper.find('[data-testid="section-appearance-help"]').exists()).toBe(false);
        wrapper.unmount();
    });

    it('opens the bar on its topic, closes it on a second click and leaves the fold alone', async () => {
        sectionState.appearance = true;
        const { register, wrapper } = inPage();
        await nextTick();
        const button = wrapper.get('[data-testid="section-appearance-help"]');
        expect(button.attributes('aria-expanded')).toBe('false');
        await button.trigger('click');
        expect(register.open.value).toBe(true);
        expect(register.active.value).toBe('appearance');
        expect(button.attributes('aria-expanded')).toBe('true');
        expect(sectionState.appearance).toBe(true);
        await button.trigger('click');
        expect(register.open.value).toBe(false);
        wrapper.unmount();
    });

    it('announces itself to the register, and leaves it with its unmount', async () => {
        sectionState.appearance = true;
        const { register, wrapper } = inPage();
        await nextTick();
        expect(register.sections.value.map((s) => s.id)).toEqual(['appearance']);
        wrapper.unmount();
        expect(register.sections.value).toEqual([]);
    });

    it('does not announce itself in the short menu, and has no "?" there', async () => {
        sectionState.appearance = true;
        const { register, wrapper } = inPage({}, 'quick');
        await nextTick();
        expect(register.sections.value).toEqual([]);
        expect(wrapper.find('[data-testid="section-appearance-help"]').exists()).toBe(false);
        wrapper.unmount();
    });

    it('does nothing without a register', () => {
        sectionState.appearance = true;
        const wrapper = mount(InspectorSection, { props: { id: 'appearance', title: 'Darstellung', summary: 'Kurz', help }, slots: { default: 'Inhalt' } });
        expect(wrapper.find('[data-testid="section-appearance-help"]').exists()).toBe(false);
    });
});
