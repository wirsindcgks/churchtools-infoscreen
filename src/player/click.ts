import type { PlaylistDoc } from '../model/schema';

/**
 * How the running presentation moves on at this screen (Plan.md 124 C): its setting – but only where the settings release the screen for
 * the click steering. Without the release no click could ever arrive, and "per click" would hold a screen on its first slide for good;
 * it then runs by time.
 */
export function effectiveAdvance(playlist: Pick<PlaylistDoc, 'advance'> | null | undefined, screenId: string, clickScreenIds: readonly string[] | undefined): 'time' | 'time-click' | 'click' {
    if (!playlist || !clickScreenIds?.includes(screenId)) return 'time';
    return playlist.advance ?? 'time';
}
