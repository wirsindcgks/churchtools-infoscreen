import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import RemoveSetupDialog from './RemoveSetupDialog.vue';

const groups = [
    { id: 25, name: 'Infoscreen-Designer', memberCount: 2 },
    { id: 28, name: 'Infoscreen-Devices' },
];

describe('RemoveSetupDialog (Plan.md, F: eigene Sicherung statt window.confirm)', () => {
    it('names every group, with a member count where one is known', () => {
        const wrapper = mount(RemoveSetupDialog, { props: { groups } });
        const items = wrapper.findAll('.groups li').map((li) => li.text());
        expect(items[0]).toContain('„Infoscreen-Designer"');
        expect(items[0]).toContain('2 Mitglieder');
        expect(items[1]).toBe('„Infoscreen-Devices"');
    });

    it('names a group that is gone already by its id, not by a name it no longer has', () => {
        const wrapper = mount(RemoveSetupDialog, { props: { groups: [{ id: 25, name: null }] } });
        expect(wrapper.find('.groups li').text()).toBe('Gruppe 25 (gibt es nicht mehr)');
    });

    it('keeps the confirm button locked without the right word, frees it with "entfernen" in any case or spacing', async () => {
        const wrapper = mount(RemoveSetupDialog, { props: { groups } });
        const button = wrapper.get('[data-testid="remove-setup-confirm"]');
        const input = wrapper.get('[data-testid="remove-setup-confirm-input"]');
        expect(button.attributes('disabled')).toBeDefined();

        await input.setValue('lösch');
        expect(button.attributes('disabled')).toBeDefined();

        await input.setValue('Entfernen');
        expect(button.attributes('disabled')).toBeUndefined();

        await input.setValue(' entfernen ');
        expect(button.attributes('disabled')).toBeUndefined();
    });

    it('emits confirm only once the word is right, never from a locked button', async () => {
        const wrapper = mount(RemoveSetupDialog, { props: { groups } });
        await wrapper.get('form').trigger('submit');
        expect(wrapper.emitted('confirm')).toBeUndefined();

        await wrapper.get('[data-testid="remove-setup-confirm-input"]').setValue('entfernen');
        await wrapper.get('form').trigger('submit');
        expect(wrapper.emitted('confirm')).toHaveLength(1);
    });

    it('emits close on cancel', async () => {
        const wrapper = mount(RemoveSetupDialog, { props: { groups } });
        await wrapper.get('.d-dialog-actions button[type="button"]').trigger('click');
        expect(wrapper.emitted('close')).toHaveLength(1);
    });

    it('shows the warning about locking oneself out only when passed', () => {
        const without = mount(RemoveSetupDialog, { props: { groups } });
        expect(without.find('[data-testid="remove-setup-own-warning"]').exists()).toBe(false);

        const withWarning = mount(RemoveSetupDialog, { props: { groups, ownMemberOf: ['Infoscreen-Designer'] } });
        const warning = withWarning.get('[data-testid="remove-setup-own-warning"]');
        expect(warning.text()).toContain('„Infoscreen-Designer"');
        expect(warning.text()).toContain('Schritt 2');
    });

    it('names the wiki area when one is known, so administrators know where the pictures wait', () => {
        const wrapper = mount(RemoveSetupDialog, { props: { groups, wikiCategoryName: 'Infoscreen' } });
        expect(wrapper.text()).toContain(
            'der Wiki-Bereich „Infoscreen" mit den Bildern wird wieder im Wiki angezeigt, damit Administratoren sie sichern können',
        );
    });

    it('leaves the wiki sentence out without a known area', () => {
        const wrapper = mount(RemoveSetupDialog, { props: { groups } });
        expect(wrapper.text()).not.toContain('Wiki-Bereich');
    });

    it('focuses the confirm input on mount, so a stray click cannot confirm by pasting elsewhere', () => {
        const wrapper = mount(RemoveSetupDialog, { props: { groups }, attachTo: document.body });
        expect(wrapper.get('[data-testid="remove-setup-confirm-input"]').element).toBe(document.activeElement);
        wrapper.unmount();
    });
});
