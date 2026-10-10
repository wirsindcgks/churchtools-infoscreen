import { ref } from 'vue';
import { t } from '../i18n/designer';

export interface ConfirmOptions {
    message: string;
    title?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    /** A destructive step: "bestätigen" in red, and the focus starts on "Abbrechen". */
    danger?: boolean;
}

export interface PendingQuestion extends ConfirmOptions {
    /** Only a message with "OK" – there is nothing to decide. */
    notice: boolean;
    resolve: (confirmed: boolean) => void;
}

/** The question on screen, if any; `ConfirmDialog` (mounted once in `App.vue`) shows it. */
export const pendingQuestion = ref<PendingQuestion | null>(null);

function ask(options: ConfirmOptions, notice: boolean): Promise<boolean> {
    // A second question while one is open ends the first with "no" rather than losing its answer.
    pendingQuestion.value?.resolve(false);
    return new Promise((resolve) => {
        pendingQuestion.value = { ...options, notice, resolve };
    });
}

/** Closes the open question with the answer; the promise of `confirm` resolves with it. */
export function answerQuestion(confirmed: boolean): void {
    const question = pendingQuestion.value;
    if (!question) return;
    pendingQuestion.value = null;
    question.resolve(confirmed);
}

/**
 * Our own questions instead of `window.confirm` and `window.alert` (Plan.md 79, B3): the browser's grey
 * window looks like an error message on a phone. Both return a promise – `await` them where the code used to
 * wait for the browser.
 */
export function useConfirm(): {
    confirm: (options: ConfirmOptions | string) => Promise<boolean>;
    notice: (message: string) => Promise<void>;
} {
    return {
        confirm: (options) => ask(typeof options === 'string' ? { message: options } : options, false),
        notice: async (message) => {
            await ask({ message, title: t.common.dialog.noticeTitle }, true);
        },
    };
}
