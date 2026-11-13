import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue';

/**
 * How far from the top of the window something of the host page lies over a fixed, full-window element: the navigation bar of
 * ChurchTools, on an iPad also the banner for its app. The stage page covers the window (no white frame, v0.59.1), but the bar stays
 * on top and hid its first line – the switch "Designer | Bühne" (user, 2026-11-13, on the PC and the phone). The bar renders after
 * the module (Befunde G55) and differs by device, so it is not guessed but found: down the middle of the window, the first point
 * where the element itself is the topmost. Measured again like `useOffsetTop` – on resize and when the body or its children change.
 */
export function useCoveredTop(el: Ref<HTMLElement | null>, limit = 240): Ref<number> {
    const top = ref(0);
    function measure(): void {
        const own = el.value;
        if (!own || typeof document.elementFromPoint !== 'function') return;
        // Measured from the very top: so a bar that became lower is found as well.
        own.style.top = '0px';
        const x = window.innerWidth / 2;
        let found = 0;
        for (let y = 0; y < limit; y += 2) {
            const hit = document.elementFromPoint(x, y);
            if (hit && own.contains(hit)) {
                found = y;
                break;
            }
        }
        // Set here as well: where the value stays the same, the binding would not write it back.
        own.style.top = `${found}px`;
        top.value = found;
    }
    let resizes: ResizeObserver | null = null;
    let mutations: MutationObserver | null = null;
    onMounted(() => {
        measure();
        window.addEventListener('resize', measure);
        if (typeof ResizeObserver !== 'undefined') {
            resizes = new ResizeObserver(() => measure());
            resizes.observe(document.body);
            for (const child of Array.from(document.body.children)) resizes.observe(child);
        }
        if (typeof MutationObserver !== 'undefined') {
            mutations = new MutationObserver(() => {
                for (const child of Array.from(document.body.children)) resizes?.observe(child);
                measure();
            });
            mutations.observe(document.body, { childList: true });
        }
    });
    onBeforeUnmount(() => {
        window.removeEventListener('resize', measure);
        resizes?.disconnect();
        mutations?.disconnect();
    });
    return top;
}
