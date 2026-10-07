import type { HeartbeatDoc } from '../model/heartbeat';
import { lastEdited } from './last-edited';

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

const NEVER_TITLE =
    'Dieser Screen hat sich noch nie gemeldet – ein Fernseher meldet sich alle fünf Minuten, sobald er läuft und das Recht dazu hat.';

/**
 * What a tile says about the life of a screen. Compared with the clock of this browser; a sign of life
 * in the future (a device clock that runs ahead) counts as online. Unreadable counts as never.
 */
export function aliveState(heartbeat: HeartbeatDoc | undefined, now: Date, timeZone: string): AliveState {
    const at = heartbeat ? Date.parse(heartbeat.at) : Number.NaN;
    if (!heartbeat || Number.isNaN(at)) return { kind: 'never', text: 'noch nie abgerufen', title: NEVER_TITLE };
    const when = lastEdited(heartbeat.at, null, timeZone, 'Letztes Lebenszeichen');
    const title = `${when?.whenTitle ?? ''}${heartbeat.version ? ` · Player ${heartbeat.version}` : ''}`;
    if (now.getTime() - at <= ALIVE_WINDOW_MS) return { kind: 'online', text: 'online', title };
    return { kind: 'offline', text: `nicht online seit ${when?.when ?? ''}`, title };
}
