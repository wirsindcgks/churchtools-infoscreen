/**
 * Whether this person has seen what is new in the installed release: a dot
 * at "Über & Neuigkeiten" until the page is opened. Kept in this browser
 * only – a convenience; without storage the dot simply stays.
 */
import { ref } from 'vue';
import { releaseOf } from './changelog';

const KEY = 'infoscreen-designer:seen-release';
const RELEASE = releaseOf(__APP_VERSION__);

function stored(): string | null {
    try {
        return window.localStorage.getItem(KEY);
    } catch {
        return null;
    }
}

/** True while the installed release has not been looked at here. */
export const unseenRelease = ref(stored() !== RELEASE);

export function markReleaseSeen(): void {
    unseenRelease.value = false;
    try {
        window.localStorage.setItem(KEY, RELEASE);
    } catch {
        // Private window or blocked storage: the dot comes back next time, nothing worse.
    }
}
