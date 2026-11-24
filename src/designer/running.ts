/**
 * What a screen shows right now, for the designer: the player's own rule
 * matching with the live appointments of the preview – so a tile and the
 * schedules page say what the TV says (Plan.md 17, 21).
 */
import type { OverrideDoc } from '../agenda/control';
import type { ScreenDoc } from '../model/schema';
import type { StageContext } from '../player/context';
import { activeOverride, matchingRuleIndex, type OverrideRelease } from '../player/schedule';

export interface Running {
    /** The rule that decides; -1 for the default playlist. */
    ruleIndex: number;
    playlistId: string;
    /** The override by the musicians that runs now (Plan.md 125 D); it beats the rule above. */
    override?: OverrideDoc;
}

/** `override`: the latest override of this screen with the release from the settings; without it, none applies. */
export function runningNow(
    screen: ScreenDoc,
    context: Pick<StageContext, 'now' | 'timeZone' | 'appointments'>,
    override?: { doc: OverrideDoc | null | undefined; release: OverrideRelease },
): Running {
    const schedule = { now: context.now, timeZone: context.timeZone, clockConfirmed: true, appointments: context.appointments };
    const ruleIndex = matchingRuleIndex(screen, schedule);
    const playlistId = ruleIndex < 0 ? screen.defaultPlaylistId : screen.schedule[ruleIndex]!.playlistId;
    // The player's own decision, so the tile says what the TV shows.
    const doc = override ? activeOverride(screen, override.doc, override.release, schedule) : null;
    return doc ? { ruleIndex, playlistId: doc.playlistId, override: doc } : { ruleIndex, playlistId };
}

/** The calendars whose appointments the rules of these screens react to. */
export function ruleCalendarIds(screens: readonly ScreenDoc[]): number[] {
    return [...new Set(screens.flatMap((s) => s.schedule.flatMap((r) => (r.kind === 'appointment' ? r.calendarIds : []))))];
}
