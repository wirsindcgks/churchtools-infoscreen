/**
 * The hint of a button that shows only a symbol (Plan.md 79, B3): `v-tip="'Duplizieren (Strg+D)'"`. A small dark
 * face under the button, 300 ms after the pointer arrives and at once for the keyboard (`:focus-visible`); it goes
 * on leaving, on Escape and on a click. A finger never sees it – `aria-label` carries the name there. One face for
 * the whole page, set into the designer's own element so the theme's variables reach it.
 */
import type { Directive } from 'vue';

const DELAY_MS = 300;
const GAP = 8;
const EDGE = 8;

interface TipState {
    text: string;
    timer: number | undefined;
    off: () => void;
}

const states = new WeakMap<HTMLElement, TipState>();
let face: HTMLElement | null = null;
let owner: HTMLElement | null = null;

function hide(): void {
    face?.remove();
    document.removeEventListener('keydown', onEscape, true);
    owner = null;
}

/** Escape closes the hint and nothing else: the block stays chosen, the dialog open. */
function onEscape(event: KeyboardEvent): void {
    if (event.key !== 'Escape') return;
    event.stopPropagation();
    hide();
}

/** Under the button, centred, kept inside the window; above it where there is no room below. */
function place(el: HTMLElement, tip: HTMLElement): void {
    const rect = el.getBoundingClientRect();
    const { width, height } = tip.getBoundingClientRect();
    const left = Math.max(EDGE, Math.min(rect.left + rect.width / 2 - width / 2, window.innerWidth - width - EDGE));
    const below = rect.bottom + GAP;
    const top = below + height > window.innerHeight - EDGE ? Math.max(EDGE, rect.top - GAP - height) : below;
    tip.style.left = `${Math.round(left)}px`;
    tip.style.top = `${Math.round(top)}px`;
}

function show(el: HTMLElement): void {
    const state = states.get(el);
    if (!state?.text) return;
    hide();
    face ??= Object.assign(document.createElement('div'), { className: 'd-tip' });
    face.setAttribute('aria-hidden', 'true');
    face.setAttribute('data-testid', 'tip');
    face.textContent = state.text;
    (el.closest('.infoscreen-designer') ?? document.body).append(face);
    place(el, face);
    owner = el;
    document.addEventListener('keydown', onEscape, true);
}

function keyboardFocus(el: HTMLElement): boolean {
    try {
        return el.matches(':focus-visible');
    } catch {
        return true;
    }
}

export const vTip: Directive<HTMLElement, string | undefined> = {
    mounted(el, binding) {
        const state: TipState = { text: binding.value ?? '', timer: undefined, off: () => {} };
        const later = (): void => {
            window.clearTimeout(state.timer);
            state.timer = window.setTimeout(() => show(el), DELAY_MS);
        };
        const gone = (): void => {
            window.clearTimeout(state.timer);
            if (owner === el) hide();
        };
        const enter = (event: Event): void => {
            // A finger has no hover; the name is in `aria-label`.
            if ((event as PointerEvent).pointerType === 'touch') return;
            later();
        };
        const focus = (): void => {
            if (keyboardFocus(el)) show(el);
        };
        el.addEventListener('pointerenter', enter);
        el.addEventListener('pointerleave', gone);
        el.addEventListener('pointerdown', gone);
        el.addEventListener('click', gone);
        el.addEventListener('focus', focus);
        el.addEventListener('blur', gone);
        state.off = () => {
            gone();
            el.removeEventListener('pointerenter', enter);
            el.removeEventListener('pointerleave', gone);
            el.removeEventListener('pointerdown', gone);
            el.removeEventListener('click', gone);
            el.removeEventListener('focus', focus);
            el.removeEventListener('blur', gone);
        };
        states.set(el, state);
    },
    updated(el, binding) {
        const state = states.get(el);
        if (!state || state.text === (binding.value ?? '')) return;
        state.text = binding.value ?? '';
        if (owner === el && face) {
            face.textContent = state.text;
            place(el, face);
        }
    },
    unmounted(el) {
        states.get(el)?.off();
        states.delete(el);
    },
};
