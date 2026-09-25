/**
 * What a screen shows right now, for the designer: the player's own rule
 * matching with the live appointments of the preview – so a tile and the
 * schedules page say what the TV says (Plan.md 17, 21).
 */
import type { ScreenDoc } from '../model/schema';
import type { StageContext } from '../player/context';
import { matchingRuleIndex } from '../player/schedule';

export interface Running {
    /** The rule that decides; -1 for the default playlist. */
    ruleIndex: number;
    playlistId: string;
}

export function runningNow(screen: ScreenDoc, context: Pick<StageContext, 'now' | 'timeZone' | 'appointments'>): Running {
    const ruleIndex = matchingRuleIndex(screen, {
        now: context.now,
        timeZone: context.timeZone,
        clockConfirmed: true,
        appointments: context.appointments,
    });
    return { ruleIndex, playlistId: ruleIndex < 0 ? screen.defaultPlaylistId : screen.schedule[ruleIndex]!.playlistId };
}

/** The calendars whose appointments the rules of these screens react to. */
export function ruleCalendarIds(screens: readonly ScreenDoc[]): number[] {
    return [...new Set(screens.flatMap((s) => s.schedule.flatMap((r) => (r.kind === 'appointment' ? r.calendarIds : []))))];
}
