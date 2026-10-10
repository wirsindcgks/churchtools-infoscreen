import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue';

/**
 * The distance of an element from the start of the document. The navigation bar of ChurchTools is sticky
 * and 56 px high, but it renders after our module has mounted (Befunde G55): measured once, the element
 * would seem to sit at the very top. So it is measured again when the window resizes and when the body
 * changes size – which it does when the bar appears.
 */
export function useOffsetTop(el: Ref<HTMLElement | null>): Ref<number> {
    const top = ref(0);
    function measure(): void {
        if (!el.value) return;
        top.value = Math.max(0, el.value.getBoundingClientRect().top + window.scrollY);
    }
    let observer: ResizeObserver | null = null;
    onMounted(() => {
        measure();
        window.addEventListener('resize', measure);
        if (typeof ResizeObserver !== 'undefined') {
            observer = new ResizeObserver(measure);
            observer.observe(document.body);
        }
    });
    onBeforeUnmount(() => {
        window.removeEventListener('resize', measure);
        observer?.disconnect();
        observer = null;
    });
    return top;
}
