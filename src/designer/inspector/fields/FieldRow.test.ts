import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { ref } from 'vue';
import { createHelpRegister, GENERAL_ID, HELP_REGISTER, SECTION_HELP } from '../../help/register';
import { INSPECTOR_MODE } from '../mode';
import FieldRow from './FieldRow.vue';

const topic = { items: [{ term: 'Feld', text: 'Das tut es. Und noch mehr.' }] };

function row(props: Record<string, unknown>, section: typeof topic | null = topic, general: Array<{ term: string; text: string }> = [], mode = 'full') {
    const register = createHelpRegister(() => 'Baustein');
    register.addGeneral(() => general);
    return mount(FieldRow, {
        props: { label: 'Feld', ...props },
        slots: { default: '<input />' },
        global: { provide: { [HELP_REGISTER as symbol]: register, [SECTION_HELP as symbol]: ref(section ?? undefined), [INSPECTOR_MODE as symbol]: mode } },
    });
}

describe('FieldRow – the hint of the label (Plan.md 98, C)', () => {
    it('takes the first sentence of the entry of the section', () => {
        expect(row({}).get('.field-label').attributes('data-tip')).toBe('Das tut es.');
    });

    it('falls back to the entry under "Allgemein"', () => {
        const wrapper = row({}, null, [{ term: 'Feld', text: 'Allgemein erklärt. Mehr.' }]);
        expect(wrapper.get('.field-label').attributes('data-tip')).toBe('Allgemein erklärt.');
        expect(GENERAL_ID).toBe('general');
    });

    it('has no hint without an entry of that name', () => {
        expect(row({ label: 'Anderes' }).get('.field-label').attributes('data-tip')).toBeUndefined();
    });

    it('prefers an explicit tip', () => {
        expect(row({ tip: 'Eigener Text' }).get('.field-label').attributes('data-tip')).toBe('Eigener Text');
    });

    it('has no hint in the short menu', () => {
        const label = row({ quick: true, inline: true }, topic, [], 'quick').find('.field-label');
        expect(label.attributes('data-tip')).toBeUndefined();
    });
});
