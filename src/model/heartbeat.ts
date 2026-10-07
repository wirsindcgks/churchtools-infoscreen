/**
 * The sign of life of a screen (Plan.md 59): one value per screen in the category `status`, written by a
 * TV with a device login. Not a schema document – no version, and the reader skips what it does not
 * understand, since a forged or foreign value must never break the start page.
 */
export interface HeartbeatDoc {
    kind: 'heartbeat';
    /** Slug of the screen. */
    screen: string;
    /** ISO time of ChurchTools, not of the device clock. */
    at: string;
    /** Version of the player that wrote it. */
    version: string;
    /** The playlist running at that moment. */
    playlistId: string | null;
    clockConfirmed: boolean;
}

/** Reads one value tolerantly: `null` for anything that is not a usable sign of life; never throws. */
export function readHeartbeat(raw: unknown): HeartbeatDoc | null {
    if (typeof raw !== 'object' || raw === null) return null;
    const r = raw as Record<string, unknown>;
    if (r.kind !== 'heartbeat' || typeof r.screen !== 'string' || !r.screen) return null;
    if (typeof r.at !== 'string') return null;
    return {
        kind: 'heartbeat',
        screen: r.screen,
        at: r.at,
        version: typeof r.version === 'string' ? r.version : '',
        playlistId: typeof r.playlistId === 'string' ? r.playlistId : null,
        clockConfirmed: r.clockConfirmed === true,
    };
}

/** Milliseconds of a heartbeat's time; `NaN` when it is not a date. */
export function heartbeatTime(doc: Pick<HeartbeatDoc, 'at'>): number {
    return Date.parse(doc.at);
}
