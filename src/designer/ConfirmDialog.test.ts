import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, describe, expect, it } from 'vitest';
import ConfirmDialog from './ConfirmDialog.vue';
import { pendingQuestion, useConfirm } from './useConfirm';

let wrapper: VueWrapper | null = null;

function open(): VueWrapper {
    wrapper = mount(ConfirmDialog, { attachTo: document.body });
    return wrapper;
}

afterEach(() => {
    pendingQuestion.value?.resolve(false);
    pendingQuestion.value = null;
    wrapper?.unmount();
    wrapper = null;
});

describe('ConfirmDialog and useConfirm (Plan.md 79, B3: eigene Rückfragen statt Browserfenster)', () => {
    it('shows nothing until a question is asked', () => {
        expect(open().find('[data-testid="confirm-dialog"]').exists()).toBe(false);
    });

    it('resolves true on the confirm button and shows title, text and labels', async () => {
        const dialog = open();
        const answer = useConfirm().confirm({ message: 'Folie „A" entfernen?', title: 'Folie', confirmLabel: 'Entfernen' });
        await flushPromises();
        expect(dialog.get('h2').text()).toBe('Folie');
        expect(dialog.get('.message').text()).toBe('Folie „A" entfernen?');
        expect(dialog.get('[data-testid="confirm-ok"]').text()).toBe('Entfernen');
        await dialog.get('[data-testid="confirm-ok"]').trigger('click');
        expect(await answer).toBe(true);
        expect(dialog.find('[data-testid="confirm-dialog"]').exists()).toBe(false);
    });

    it('resolves false on "Abbrechen", with a generic title and the default wording for a plain string', async () => {
        const dialog = open();
        const answer = useConfirm().confirm('Wirklich?');
        await flushPromises();
        expect(dialog.get('h2').text()).toBe('Bitte bestätigen');
        expect(dialog.get('[data-testid="confirm-cancel"]').text()).toBe('Abbrechen');
        await dialog.get('[data-testid="confirm-cancel"]').trigger('click');
        expect(await answer).toBe(false);
    });

    it('cancels on Escape, wherever the focus is', async () => {
        open();
        const answer = useConfirm().confirm({ message: 'Löschen?', danger: true });
        await flushPromises();
        document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
        expect(await answer).toBe(false);
        expect(pendingQuestion.value).toBeNull();
    });

    it('cancels on a click beside the dialog, not on a click inside it', async () => {
        const dialog = open();
        const answer = useConfirm().confirm('Wirklich?');
        await flushPromises();
        await dialog.get('.d-dialog').trigger('click');
        expect(pendingQuestion.value).not.toBeNull();
        await dialog.get('.d-dialog-backdrop').trigger('click');
        expect(await answer).toBe(false);
    });

    it('starts on "Abbrechen" for a dangerous step, on the confirm button otherwise', async () => {
        const dialog = open();
        void useConfirm().confirm({ message: 'Löschen?', danger: true });
        await flushPromises();
        expect(document.activeElement).toBe(dialog.get('[data-testid="confirm-cancel"]').element);
        expect(dialog.get('[data-testid="confirm-ok"]').classes()).toContain('confirm-danger');
        await dialog.get('[data-testid="confirm-cancel"]').trigger('click');

        void useConfirm().confirm('Weiter?');
        await flushPromises();
        expect(document.activeElement).toBe(dialog.get('[data-testid="confirm-ok"]').element);
        expect(dialog.get('[data-testid="confirm-ok"]').classes()).not.toContain('confirm-danger');
    });

    it('shows a notice with "OK" only', async () => {
        const dialog = open();
        const done = useConfirm().notice('Das ging schief.');
        await flushPromises();
        expect(dialog.find('[data-testid="confirm-cancel"]').exists()).toBe(false);
        expect(dialog.get('h2').text()).toBe('Hinweis');
        await dialog.get('[data-testid="confirm-ok"]').trigger('click');
        await done;
    });

    it('ends an open question with "no" when another one is asked', async () => {
        open();
        const first = useConfirm().confirm('Erste?');
        void useConfirm().confirm('Zweite?');
        expect(await first).toBe(false);
        expect(pendingQuestion.value?.message).toBe('Zweite?');
    });
});
