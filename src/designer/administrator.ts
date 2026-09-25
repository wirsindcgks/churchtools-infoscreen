/**
 * Whether the person administers ChurchTools – asked once per visit, not on
 * every page of the module: the frame of each page shows at once, and its
 * "Einstellungen" must not appear a moment later (role concept, Plan.md F).
 */
import { ref } from 'vue';
import { canManagePermissions } from '../setup/load';

/** null until the first answer. */
export const administrator = ref<boolean | null>(null);

let asked: Promise<boolean> | null = null;

export function isAdministrator(): Promise<boolean> {
    asked ??= canManagePermissions().then(
        (answer) => (administrator.value = answer),
        () => {
            // A failed check means no way to the settings, not a lock-out; ask again next time.
            asked = null;
            return (administrator.value = false);
        },
    );
    return asked;
}
