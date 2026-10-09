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
