import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue';

/**
 * The distance of an element from the start of the document. The navigation bar of ChurchTools is sticky
 * and 56 px high, but it renders after our module has mounted (Befunde G55): measured once, the element
 * would seem to sit at the very top. So it is measured again when the window resizes and when the body
 * changes size – which it does when the bar appears. On an iPad ChurchTools also puts a 56 px banner for
 * its app above the bar, later still and without the body changing size (its height is the window's):
 * so each child of the body is watched as well, and a child added or removed measures again.
 */
export function useOffsetTop(el: Ref<HTMLElement | null>): Ref<number> {
    const top = ref(0);
    function measure(): void {
        if (!el.value) return;
        top.value = Math.max(0, el.value.getBoundingClientRect().top + window.scrollY);
    }
    let resizes: ResizeObserver | null = null;
    let mutations: MutationObserver | null = null;
    function watchChildren(): void {
        for (const child of Array.from(document.body.children)) resizes?.observe(child);
    }
    onMounted(() => {
        measure();
        window.addEventListener('resize', measure);
        if (typeof ResizeObserver !== 'undefined') {
            resizes = new ResizeObserver(measure);
            resizes.observe(document.body);
            watchChildren();
        }
        if (typeof MutationObserver !== 'undefined') {
            mutations = new MutationObserver(() => {
                watchChildren();
                measure();
            });
            mutations.observe(document.body, { childList: true });
        }
    });
    onBeforeUnmount(() => {
        window.removeEventListener('resize', measure);
        resizes?.disconnect();
        resizes = null;
        mutations?.disconnect();
        mutations = null;
    });
    return top;
}
