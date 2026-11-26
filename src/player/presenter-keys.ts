import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue';

/**
 * A presenter on the phone (Plan.md 124 A): a Bluetooth presenter connects as a keyboard and sends page and arrow keys. Forward and
 * back step the song parts like the buttons "Weiter" and "Zurück". Up and down stay with the page, they scroll it; the space bar
 * too – on a focused button it would also press the button and step twice.
 */
const FORWARD = new Set(['PageDown', 'ArrowRight']);
const BACK = new Set(['PageUp', 'ArrowLeft']);

/** The part of a key event this needs. */
export interface PresenterKey {
    key: string;
    repeat?: boolean;
    ctrlKey?: boolean;
    metaKey?: boolean;
    altKey?: boolean;
    target?: EventTarget | null;
}

/** Something one types into: a key there is no click of the presenter. */
function typing(target: EventTarget | null | undefined): boolean {
    const el = target as { tagName?: string; isContentEditable?: boolean } | null | undefined;
    return !!el && (el.isContentEditable === true || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName ?? ''));
}

/** 1 forward, -1 back, `null` for a key that is no click – held down, with a modifier or while typing. */
export function presenterStep(event: PresenterKey): 1 | -1 | null {
    if (event.repeat || event.ctrlKey || event.metaKey || event.altKey || typing(event.target)) return null;
    if (FORWARD.has(event.key)) return 1;
    if (BACK.has(event.key)) return -1;
    return null;
}

/** The keys a presenter sends for a black screen (`b` and the full stop, as in a slide show program) – only the player listens for them. */
const BLACK = new Set(['b', 'B', '.']);

/**
 * What a key does at the device of a screen (Plan.md 124 E): the steps of {@link presenterStep} and black. `null` for a key that is no click
 * – held down, with a modifier or while typing.
 */
export function presenterAction(event: PresenterKey): 'next' | 'previous' | 'black' | null {
    const by = presenterStep(event);
    if (by !== null) return by === 1 ? 'next' : 'previous';
    if (event.repeat || event.ctrlKey || event.metaKey || event.altKey || typing(event.target)) return null;
    return BLACK.has(event.key) ? 'black' : null;
}

/**
 * Listens for the presenter while the component lives; `step` gets 1 or -1. Returns whether a presenter key came – the page then
 * says so once, so the musician knows the presenter reaches it.
 */
export function usePresenterKeys(step: (by: 1 | -1) => void): Ref<boolean> {
    const detected = ref(false);
    const onKey = (event: KeyboardEvent) => {
        const by = presenterStep(event);
        if (by === null) return;
        event.preventDefault();
        detected.value = true;
        step(by);
    };
    onMounted(() => window.addEventListener('keydown', onKey));
    onBeforeUnmount(() => window.removeEventListener('keydown', onKey));
    return detected;
}
