import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import ControlRehearsalSheet from './ControlRehearsalSheet.vue';

const one = [{ id: 'p1', name: 'Probenblatt' }];
const two = [...one, { id: 'p2', name: 'Band' }];
const mountSheet = (playlists = one, over: Record<string, unknown> = {}) =>
    mount(ControlRehearsalSheet, { props: { monitorName: 'Bühne', playlists, busy: false, notSaved: false, ...over }, attachTo: document.body });

describe('ControlRehearsalSheet (Plan.md 135 D)', () => {
    it('is a modal dialog titled with the monitor, with the only presentation chosen and 2 hours preselected', () => {
        const wrapper = mountSheet();
        const dialog = wrapper.get('[role="dialog"]');
        expect(dialog.attributes('aria-modal')).toBe('true');
        expect(wrapper.get('h2').text()).toBe('Probe auf „Bühne“');
        expect(dialog.attributes('aria-labelledby')).toBe(wrapper.get('h2').attributes('id'));
        expect(wrapper.get('[data-testid="rehearsal-sheet-playlist"]').text()).toBe('Probenblatt');
        expect(wrapper.get('[data-testid="rehearsal-sheet-hours-2"]').attributes('aria-pressed')).toBe('true');
        wrapper.unmount();
    });

    it('starts with the chosen presentation and duration', async () => {
        const wrapper = mountSheet(two);
        await wrapper.findAll('.choice').find((b) => b.text() === 'Band')!.trigger('click');
        await wrapper.get('[data-testid="rehearsal-sheet-hours-3"]').trigger('click');
        await wrapper.get('[data-testid="rehearsal-sheet-start"]').trigger('click');
        expect(wrapper.emitted('start')).toEqual([['p2', 3]]);
        wrapper.unmount();
    });

    it('takes the first presentation of several until another is chosen', async () => {
        const wrapper = mountSheet(two);
        await wrapper.get('[data-testid="rehearsal-sheet-start"]').trigger('click');
        expect(wrapper.emitted('start')).toEqual([['p1', 2]]);
        wrapper.unmount();
    });

    it('closes with "Abbrechen", with a tap beside the sheet and with Escape', async () => {
        const wrapper = mountSheet();
        await wrapper.get('[data-testid="control-sheet-cancel"]').trigger('click');
        await wrapper.get('[data-testid="control-sheet-backdrop"]').trigger('click');
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        expect(wrapper.emitted('close')).toHaveLength(3);
        // A tap in the sheet is no tap beside it.
        await wrapper.get('[data-testid="control-sheet"]').trigger('click');
        expect(wrapper.emitted('close')).toHaveLength(3);
        wrapper.unmount();
    });

    it('rests the button while a write runs, and says where it failed', () => {
        const wrapper = mountSheet(one, { busy: true, notSaved: true });
        expect(wrapper.get('[data-testid="rehearsal-sheet-start"]').attributes('disabled')).toBeDefined();
        expect(wrapper.get('[role="alert"]').text()).toContain('Nicht gespeichert');
        wrapper.unmount();
    });

    it('says whom to ask without a released presentation, and offers no start', () => {
        const wrapper = mountSheet([]);
        expect(wrapper.get('[data-testid="rehearsal-sheet-none"]').text()).toContain('freigegeben');
        expect(wrapper.find('[data-testid="rehearsal-sheet-start"]').exists()).toBe(false);
        wrapper.unmount();
    });
});
