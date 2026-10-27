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

/** A line under "online" (Plan.md 111): the software of the player, or the state of the presentation it shows. */
export interface AliveDetail {
    text: string;
    /** Tooltip; empty when there is nothing to add. */
    title: string;
    /** Differs from what is expected – coloured as a hint. */
    notice: boolean;
}

export interface AliveState {
    kind: 'online' | 'offline' | 'never';
    text: string;
    title: string;
    /** Only while the screen has reported at all; both lines are the state of its last sign of life. */
    software?: AliveDetail;
    content?: AliveDetail;
}

/**
 * The sign of life is taken for the player's report if it is this much younger than the publication: the quick
 * check takes over a change in about 20 seconds (`INTERVALS.quickCheckMs`); with the pause until the next beat
 * the player could not have said anything yet.
 */
export const REPORT_GRACE_MS = 2 * 60_000;

/** "Player aktuell", or the deviation; the version of the designer is the installed one (Plan.md 111). */
function softwareDetail(version: string, installed: string, notice: string): AliveDetail {
    if (!version) return { text: t.common.alive.playerUnknown, title: notice, notice: false };
    if (version === installed) return { text: t.common.alive.playerCurrent, title: notice, notice: false };
    return { text: t.common.alive.playerDiffers(version, installed), title: notice, notice: true };
}

/**
 * "Stand vom …" of what the player loaded. "veraltet" when the playlist has a newer published state that the
 * player had time to take over – see `REPORT_GRACE_MS`.
 */
function contentDetail(heartbeat: HeartbeatDoc, publishedAt: string | null, timeZone: string, notice: string): AliveDetail {
    const when = heartbeat.contentAt ? lastEdited(heartbeat.contentAt, null, timeZone)?.when : null;
    if (!heartbeat.contentAt || !when) return { text: t.common.alive.standUnknown, title: notice, notice: false };
    const published = publishedAt ? Date.parse(publishedAt) : Number.NaN;
    const stale =
        published > Date.parse(heartbeat.contentAt) && published < Date.parse(heartbeat.at) - REPORT_GRACE_MS;
    return { text: stale ? t.common.alive.standStale(when) : t.common.alive.standOf(when), title: notice, notice: stale };
}

/**
 * What a tile says about the life of a screen. Compared with the clock of this browser; a sign of life
 * in the future (a device clock that runs ahead) counts as online. Unreadable counts as never.
 */
export function aliveState(
    heartbeat: HeartbeatDoc | undefined,
    now: Date,
    timeZone: string,
    /** The published state of the playlist the screen reported (`ScreenPlaylist.editedAt`), if known. */
    publishedAt: string | null = null,
    installed: string = __APP_VERSION__,
): AliveState {
    const at = heartbeat ? Date.parse(heartbeat.at) : Number.NaN;
    if (!heartbeat || Number.isNaN(at)) return { kind: 'never', text: t.common.alive.neverText, title: t.common.alive.neverTitle };
    const when = lastEdited(heartbeat.at, null, timeZone, t.common.edited.lastSign);
    const title = `${when?.whenTitle ?? ''}${heartbeat.version ? t.common.alive.playerVersion(heartbeat.version) : ''}`;
    const online = now.getTime() - at <= ALIVE_WINDOW_MS;
    // Offline, the lines are the state of the last sign of life, not of now (Plan.md 111).
    const notice = online ? '' : t.common.alive.lastReported;
    const details = {
        software: softwareDetail(heartbeat.version, installed, notice),
        content: contentDetail(heartbeat, publishedAt, timeZone, notice),
    };
    if (online) return { kind: 'online', text: t.common.alive.online, title, ...details };
    return { kind: 'offline', text: t.common.alive.offlineSince(when?.when ?? ''), title, ...details };
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
