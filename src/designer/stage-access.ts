import { ref } from 'vue';
import { getRepository } from '../store/backend';

/**
 * Whether this person may steer the song sheet, i.e. sees the category `steuerung` (Plan.md 121): musicians and administrators.
 * The designer shows the entry to the phone page only then. Checked once per page load; null while unknown.
 */
export const stageAccess = ref<boolean | null>(null);

let checking: Promise<void> | null = null;

export function ensureStageAccess(): Promise<void> {
    checking ??= getRepository()
        .then((handle) => handle.repository.controlCategoryId())
        .then((id) => {
            stageAccess.value = id !== null;
        })
        .catch(() => {
            // No hint is better than a broken sidebar; the next page load asks again.
            stageAccess.value = false;
        });
    return checking;
}
