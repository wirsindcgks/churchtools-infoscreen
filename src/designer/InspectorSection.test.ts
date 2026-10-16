import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import InspectorSection from './InspectorSection.vue';
import { SECTION_GROUP } from './inspector/mode';

function nameOf(props: { group?: string | false }, provided?: string): string | undefined {
    const wrapper = mount(InspectorSection, {
        props: { id: 'x', title: 'X', ...props },
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
