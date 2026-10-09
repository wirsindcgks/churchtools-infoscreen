import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import ShortcutsDialog from './ShortcutsDialog.vue';

describe('ShortcutsDialog (Plan.md 79, B3)', () => {
    it('shows Strg on a keyboard that is no Mac', () => {
        const text = mount(ShortcutsDialog, { props: { mac: false } }).text();
        expect(text).toContain('Strg+S');
        expect(text).toContain('Strg+Umschalt+Z');
        expect(text).not.toContain('⌘');
    });

    it('shows ⌘ on a Mac', () => {
        const text = mount(ShortcutsDialog, { props: { mac: true } }).text();
        expect(text).toContain('⌘S');
        expect(text).not.toContain('Strg');
    });

    it('closes on "Schließen" and on Escape', async () => {
        const dialog = mount(ShortcutsDialog, { props: { mac: false } });
        await dialog.get('[data-testid="shortcuts-close"]').trigger('click');
        await dialog.get('[data-testid="shortcuts-dialog"]').trigger('keydown', { key: 'Escape' });
        expect(dialog.emitted('close')).toHaveLength(2);
    });
});
