import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import type { RefreshGroup } from '../setup/provision';
import RefreshRightsDialog from './RefreshRightsDialog.vue';

const groups: RefreshGroup[] = [
    {
        key: 'device',
        name: 'Infoscreen-Devices',
        add: [{ authId: 403, dataId: 5, label: 'Einzelnen Kalender sehen: Bandproben' }],
        remove: [
            { authId: 403, dataId: 3, label: 'Einzelnen Kalender sehen: Jugend' },
            { authId: 2016, dataId: 1, label: 'Anlegen von Screens und Einstellungen' },
            { authId: 2016, dataId: 13, label: 'Anlegen von Screens und Einstellungen' },
        ],
    },
    { key: 'designer', name: 'Infoscreen-Designer', add: [], remove: [] },
];

describe('RefreshRightsDialog (Plan.md 62)', () => {
    it('lists what comes in and what falls away per group, each wording once, and leaves out a group without change', () => {
        const wrapper = mount(RefreshRightsDialog, { props: { groups } });
        expect(wrapper.text()).toContain('Rechte aktualisieren');
        expect(wrapper.get('[data-testid="refresh-group-device"]').text()).toContain('Infoscreen-Devices');
        expect(wrapper.get('[data-testid="refresh-add"]').text()).toBe('Einzelnen Kalender sehen: Bandproben');
        expect(wrapper.findAll('[data-testid="refresh-remove"] li').map((li) => li.text())).toEqual([
            'Einzelnen Kalender sehen: Jugend',
            'Anlegen von Screens und Einstellungen',
        ]);
        expect(wrapper.find('[data-testid="refresh-group-designer"]').exists()).toBe(false);
        expect(wrapper.text()).toContain('Ein entzogenes Recht wirkt bei ChurchTools noch bis zu einer Dreiviertelstunde nach.');
    });

    it('confirms with "Übernehmen" and closes on cancel and on Escape', async () => {
        const wrapper = mount(RefreshRightsDialog, { props: { groups } });
        await wrapper.get('form').trigger('submit');
        expect(wrapper.emitted('confirm')).toHaveLength(1);
        expect(wrapper.get('[data-testid="refresh-rights-confirm"]').text()).toBe('Übernehmen');
        await wrapper.get('.d-dialog-actions button[type="button"]').trigger('click');
        expect(wrapper.emitted('close')).toHaveLength(1);
        await wrapper.get('.d-dialog-backdrop').trigger('keydown.esc');
        expect(wrapper.emitted('close')).toHaveLength(2);
    });
});
