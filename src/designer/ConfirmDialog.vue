<script setup lang="ts">
/**
 * The one question dialog of the module (Plan.md 79, B3), in place of the browser's `window.confirm` and
 * `window.alert`: title, text, "Abbrechen" and the answer – in red for a deletion. Escape and a click beside
 * the dialog cancel. The focus starts on "Abbrechen" when the step cannot be undone, and returns to where it
 * was. Mounted once in `App.vue`; `useConfirm()` asks, this answers.
 */
import { nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { t } from '../i18n/designer';
import { answerQuestion, pendingQuestion } from './useConfirm';

const dialog = ref<HTMLElement | null>(null);
const cancelButton = ref<HTMLButtonElement | null>(null);
const confirmButton = ref<HTMLButtonElement | null>(null);
let before: HTMLElement | null = null;

/**
 * Capture phase on the window: while the question is open the editor's keys (Delete, Escape …) must not reach
 * the page behind it, which the browser's own window used to guarantee. A key whose target lies in the dialog
 * is left alone, so Enter and Space still press the focused button.
 */
function onKey(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        answerQuestion(false);
        return;
    }
    const inside = dialog.value?.contains(event.target as Node) ?? false;
    if (event.key === 'Tab') {
        const buttons = [cancelButton.value, confirmButton.value].filter((b): b is HTMLButtonElement => !!b);
        const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
        if (!inside || index < 0 || (event.shiftKey ? index === 0 : index === buttons.length - 1)) {
            event.preventDefault();
            (event.shiftKey ? buttons[buttons.length - 1] : buttons[0])?.focus();
        }
        event.stopPropagation();
    } else if (!inside) {
        event.stopPropagation();
    }
}

watch(
    pendingQuestion,
    async (question, previous) => {
        if (question && !previous) {
            before = document.activeElement instanceof HTMLElement ? document.activeElement : null;
            window.addEventListener('keydown', onKey, true);
        } else if (!question && previous) {
            window.removeEventListener('keydown', onKey, true);
            before?.focus();
            before = null;
        }
        if (question) {
            await nextTick();
            (question.danger ? cancelButton.value : confirmButton.value)?.focus();
        }
    },
    { flush: 'post' },
);
onBeforeUnmount(() => window.removeEventListener('keydown', onKey, true));
</script>

<template>
    <div v-if="pendingQuestion" class="infoscreen-designer confirm-root">
        <div class="d-dialog-backdrop" @click.self="answerQuestion(false)">
            <div
                ref="dialog"
                class="d-dialog confirm"
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="confirm-title"
                aria-describedby="confirm-message"
                data-testid="confirm-dialog"
                @keydown.stop
            >
                <h2 id="confirm-title">{{ pendingQuestion.title ?? t.common.dialog.confirmTitle }}</h2>
                <p id="confirm-message" class="message">{{ pendingQuestion.message }}</p>
                <div class="d-dialog-actions">
                    <button
                        v-if="!pendingQuestion.notice"
                        ref="cancelButton"
                        class="d-btn"
                        type="button"
                        data-testid="confirm-cancel"
                        @click="answerQuestion(false)"
                    >
                        {{ pendingQuestion.cancelLabel ?? t.common.cancel }}
                    </button>
                    <button
                        ref="confirmButton"
                        class="d-btn"
                        :class="pendingQuestion.danger ? 'confirm-danger' : 'd-btn--primary'"
                        type="button"
                        data-testid="confirm-ok"
                        @click="answerQuestion(true)"
                    >
                        {{ pendingQuestion.confirmLabel ?? t.common.ok }}
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.confirm {
    width: min(440px, 100%);
}
.message {
    margin: 0;
    color: var(--d-text-muted);
    /* The texts carry their own line breaks, and lists of places ("• Foyer › Begrüßung"). */
    white-space: pre-line;
    overflow-wrap: anywhere;
}
.confirm-danger {
    border-color: var(--d-danger);
    background: var(--d-danger);
    color: var(--d-accent-text);
}
.confirm-danger:hover:not(:disabled) {
    border-color: var(--d-danger);
    background: var(--d-danger);
    filter: brightness(0.92);
}
</style>
