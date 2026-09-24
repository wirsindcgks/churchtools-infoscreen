/**
 * A Raspberry Pi has no battery-backed clock: after a power cut it starts with
 * the time of its last shutdown until NTP catches up. The player therefore
 * compares the device time with the `Date` header of a server response and
 * treats the clock as unconfirmed while they disagree (Plan.md, Player).
 */
export const MAX_CLOCK_SKEW_MS = 2 * 60_000;

export interface ClockState {
    confirmed: boolean;
    /** Server time minus device time, in milliseconds. */
    skewMs: number | null;
}

export function checkClock(serverDateHeader: string | null | undefined, deviceNow: Date): ClockState {
    const server = serverDateHeader ? Date.parse(serverDateHeader) : Number.NaN;
    if (Number.isNaN(server)) return { confirmed: false, skewMs: null };
    const skewMs = server - deviceNow.getTime();
    return { confirmed: Math.abs(skewMs) <= MAX_CLOCK_SKEW_MS, skewMs };
}
