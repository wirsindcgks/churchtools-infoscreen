import { onBeforeUnmount, ref, type Ref } from 'vue';

/** Whether the window is a phone's (up to 48rem) – the line CSS draws; reactive, because the window may be resized or turned. */
export function usePhone(): Ref<boolean> {
    const query = window.matchMedia('(max-width: 48rem)');
    const phone = ref(query.matches);
    function onChange(event: MediaQueryListEvent): void {
        phone.value = event.matches;
    }
    query.addEventListener('change', onChange);
    onBeforeUnmount(() => query.removeEventListener('change', onChange));
    return phone;
}

/**
 * How far the on-screen keyboard covers the window's bottom (Plan.md 79, C4): what a fixed bar must rise by; 0 without
 * `visualViewport`, while nothing is being typed into (no keyboard then), and while the page is pinched larger (the
 * visual viewport is smaller then, too).
 */
export function useKeyboardInset(): Ref<number> {
    const inset = ref(0);
    const viewport = window.visualViewport;
    if (!viewport) return inset;
    function update(): void {
        if (!viewport) return;
        const active = document.activeElement;
        const typing = !!active && (active.matches('textarea, input:not([type="checkbox"], [type="radio"], [type="range"], [type="button"])') || (active as HTMLElement).isContentEditable);
        const covered = Math.round(window.innerHeight - viewport.height - viewport.offsetTop);
        inset.value = typing && viewport.scale <= 1.01 ? Math.max(0, covered) : 0;
    }
    update();
    viewport.addEventListener('resize', update);
    viewport.addEventListener('scroll', update);
    document.addEventListener('focusin', update);
    document.addEventListener('focusout', update);
    onBeforeUnmount(() => {
        viewport.removeEventListener('resize', update);
        viewport.removeEventListener('scroll', update);
        document.removeEventListener('focusin', update);
        document.removeEventListener('focusout', update);
    });
    return inset;
}
