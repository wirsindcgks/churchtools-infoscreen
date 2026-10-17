/**
 * Whether this person has seen the card that offers the introduction to the editor (Plan.md 81). Kept in this
 * browser only – a convenience; without storage the card simply comes back.
 */
import { ref } from 'vue';

export const INTRO_SEEN_KEY = 'infoscreen-designer:intro-seen';

function stored(): boolean {
    try {
        return window.localStorage.getItem(INTRO_SEEN_KEY) === '1';
    } catch {
        return false;
    }
}

/** True once the card was started, dismissed or closed here. */
export const introSeen = ref(stored());

export function markIntroSeen(): void {
    introSeen.value = true;
    try {
        window.localStorage.setItem(INTRO_SEEN_KEY, '1');
    } catch {
        // Private window or blocked storage: the card comes back next time, nothing worse.
    }
}
