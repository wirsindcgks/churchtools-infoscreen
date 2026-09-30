import { reactive, watch } from 'vue';

const KEY = 'infoscreen-designer:inspector-sections';

function stored(): Record<string, boolean> {
    try {
        const parsed: unknown = JSON.parse(window.localStorage.getItem(KEY) ?? '{}');
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {};
        return Object.fromEntries(Object.entries(parsed).filter(([, open]) => typeof open === 'boolean'));
    } catch {
        return {};
    }
}

/** Which inspector sections stand open (Plan.md 47), remembered per viewer; a section not listed is closed. */
export const sectionState = reactive<Record<string, boolean>>(stored());

watch(sectionState, (state) => {
    try {
        window.localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
        // Private window or blocked storage: the sections start closed again next time.
    }
});
