import { ref } from 'vue';
import { getRepository } from '../store/backend';
import type { FormatFilter } from './format-filter';

/**
 * How many screens there are per format – the numbers in the sidebar, on every
 * page of the module. One source: the start page sets them from its overview
 * and after each change; any other page as the first one loads them once.
 */
export const screenCounts = ref<Record<FormatFilter, number> | null>(null);

/** Landscape unless taller than wide, as on the start page. */
export function setScreenCounts(screens: { stage: { width: number; height: number } }[]): void {
    const portrait = screens.filter((s) => s.stage.height > s.stage.width).length;
    screenCounts.value = { all: screens.length, portrait, landscape: screens.length - portrait };
}

let loading = false;

/** Loads the numbers once if nobody has set them; a failure leaves them out, without a message. */
export async function ensureScreenCounts(): Promise<void> {
    if (screenCounts.value || loading) return;
    loading = true;
    try {
        const { repository } = await getRepository();
        const screens = await repository.listScreens();
        // The start page may have been faster.
        if (!screenCounts.value) setScreenCounts(screens);
    } catch {
        // No numbers is what the sidebar showed before loading anyway.
    } finally {
        loading = false;
    }
}
