import type { HeartbeatDoc } from '../model/heartbeat';
import type { ScreenRef } from '../store/screen-repository';
import { lastEdited } from './last-edited';
import { t } from '../i18n/designer';
import { LOCALE } from '../i18n/player';

/**
 * A screen counts as online while its last sign of life is at most this old: twice the longest jittered
 * beat of 6 minutes, plus a reserve – one missed beat colours nothing red (Plan.md 59).
 */
export const ALIVE_WINDOW_MS = 15 * 60_000;

export interface AliveState {
    kind: 'online' | 'offline' | 'never';
    text: string;
    title: string;
}

/**
 * What a tile says about the life of a screen. Compared with the clock of this browser; a sign of life
 * in the future (a device clock that runs ahead) counts as online. Unreadable counts as never.
 */
export function aliveState(heartbeat: HeartbeatDoc | undefined, now: Date, timeZone: string): AliveState {
    const at = heartbeat ? Date.parse(heartbeat.at) : Number.NaN;
    if (!heartbeat || Number.isNaN(at)) return { kind: 'never', text: t.common.alive.neverText, title: t.common.alive.neverTitle };
    const when = lastEdited(heartbeat.at, null, timeZone, t.common.edited.lastSign);
    const title = `${when?.whenTitle ?? ''}${heartbeat.version ? t.common.alive.playerVersion(heartbeat.version) : ''}`;
    if (now.getTime() - at <= ALIVE_WINDOW_MS) return { kind: 'online', text: t.common.alive.online, title };
    return { kind: 'offline', text: t.common.alive.offlineSince(when?.when ?? ''), title };
}

/** A screen whose sign of life says it shows a playlist right now, with the time of that sign. */
export interface LiveScreen {
    screen: ScreenRef;
    /** ISO time of the sign of life. */
    at: string;
}

/**
 * The screens of `screens` on which the playlist runs right now (Plan.md 77): online by `aliveState` and
 * reporting this playlist's id. Unreadable signs of life (`null`) give none – no hint either way.
 */
export function liveScreens(
    playlistId: string,
    screens: ScreenRef[],
    heartbeats: Map<string, HeartbeatDoc> | null,
    now: Date,
): LiveScreen[] {
    if (!heartbeats) return [];
    const live: LiveScreen[] = [];
    for (const screen of screens) {
        const heartbeat = heartbeats.get(screen.slug);
        if (heartbeat?.playlistId !== playlistId) continue;
        // The kind does not depend on the time zone.
        if (aliveState(heartbeat, now, 'UTC').kind === 'online') live.push({ screen, at: heartbeat.at });
    }
    return live;
}

const quoted = (live: LiveScreen[]) => live.map((l) => `„${l.screen.name}“`).join(', ');

/** "Läuft gerade auf „Foyer links“ – laut Lebenszeichen von 14:32"; with several screens, the youngest sign. */
export function liveTitle(live: LiveScreen[], timeZone: string): string {
    const youngest = Math.max(...live.map((l) => Date.parse(l.at)));
    const time = new Intl.DateTimeFormat(LOCALE, { timeZone, hour: '2-digit', minute: '2-digit' }).format(youngest);
    return t.common.runningOn(quoted(live), time);
}

/** The tooltip of "Veröffentlichen" while the playlist runs: where the change will show up, and when. */
export function liveSaveTitle(live: LiveScreen[]): string {
    return t.editor.saveOnLive(quoted(live));
}
