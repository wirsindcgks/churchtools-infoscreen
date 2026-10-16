import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import TemplateNameDialog from './TemplateNameDialog.vue';

describe('TemplateNameDialog (Plan.md 87)', () => {
    it('saves the trimmed name, and not while the name is empty', async () => {
        const wrapper = mount(TemplateNameDialog, { props: { title: 'Als Vorlage speichern' }, attachTo: document.body });
        const save = wrapper.find('[data-testid="template-name-save"]');
        expect(save.attributes('disabled')).toBeDefined();
        await wrapper.find('[data-testid="template-name"]').setValue('  Seitenkopf ');
        expect(save.attributes('disabled')).toBeUndefined();
        await wrapper.find('form').trigger('submit');
        expect(wrapper.emitted('save')).toEqual([['Seitenkopf']]);
        wrapper.unmount();
    });

    it('limits the name to 40 characters, starts with the name it is given, shows a failure and closes on Escape', async () => {
        const wrapper = mount(TemplateNameDialog, { props: { title: 'Vorlage umbenennen', name: 'Kopf', error: 'Nicht gespeichert' }, attachTo: document.body });
        const input = wrapper.find('[data-testid="template-name"]');
        expect((input.element as HTMLInputElement).value).toBe('Kopf');
        expect(input.attributes('maxlength')).toBe('40');
        expect(wrapper.find('[data-testid="template-name-error"]').text()).toBe('Nicht gespeichert');
        expect(document.activeElement).toBe(input.element);
        await wrapper.find('.d-dialog-backdrop').trigger('keydown', { key: 'Escape' });
        expect(wrapper.emitted('close')).toHaveLength(1);
        wrapper.unmount();
    });
});
