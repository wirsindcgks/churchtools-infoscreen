/**
 * Local time in the instance time zone (`timezone` from /api/config), computed
 * with Intl only. Never a fixed offset: ChurchTools keeps the local time of a
 * series constant across daylight saving time and shifts UTC instead (G19).
 */

export interface ZonedParts {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    /** ISO weekday, 1 = Monday. */
    weekday: number;
}

const formatters = new Map<string, Intl.DateTimeFormat>();
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function formatter(timeZone: string): Intl.DateTimeFormat {
    let f = formatters.get(timeZone);
    if (!f) {
        f = new Intl.DateTimeFormat('en-US', {
            timeZone,
            hourCycle: 'h23',
            year: 'numeric',
            month: 'numeric',
            day: 'numeric',
            hour: 'numeric',
            minute: 'numeric',
            second: 'numeric',
            weekday: 'short',
        });
        formatters.set(timeZone, f);
    }
    return f;
}

export function zonedParts(instant: Date, timeZone: string): ZonedParts & { second: number } {
    const parts = Object.fromEntries(formatter(timeZone).formatToParts(instant).map((p) => [p.type, p.value]));
    return {
        year: Number(parts.year),
        month: Number(parts.month),
        day: Number(parts.day),
        hour: Number(parts.hour),
        minute: Number(parts.minute),
        second: Number(parts.second),
        weekday: WEEKDAYS.indexOf(parts.weekday ?? '') + 1,
    };
}

/** Offset of the zone from UTC at this instant, in milliseconds. */
function offsetAt(instant: Date, timeZone: string): number {
    const p = zonedParts(instant, timeZone);
    const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/**
 * The instant at which the wall clock in `timeZone` shows the given local time.
 * A time skipped by the spring change resolves to the first instant after the gap.
 */
export function zonedTimeToInstant(
    local: { year: number; month: number; day: number; hour?: number; minute?: number },
    timeZone: string,
): Date {
    const wall = Date.UTC(local.year, local.month - 1, local.day, local.hour ?? 0, local.minute ?? 0);
    let guess = wall - offsetAt(new Date(wall), timeZone);
    const corrected = wall - offsetAt(new Date(guess), timeZone);
    if (corrected !== guess) guess = Math.max(guess, corrected);
    return new Date(guess);
}

export function zonedDateKey(instant: Date, timeZone: string): string {
    const p = zonedParts(instant, timeZone);
    return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

export function zonedTimeKey(instant: Date, timeZone: string): string {
    const p = zonedParts(instant, timeZone);
    return `${pad(p.hour)}:${pad(p.minute)}`;
}

export function startOfZonedDay(instant: Date, timeZone: string, addDays = 0): Date {
    const p = zonedParts(instant, timeZone);
    // Date.UTC normalizes day overflow, so adding days across month ends is safe.
    const day = new Date(Date.UTC(p.year, p.month - 1, p.day + addDays));
    return zonedTimeToInstant(
        { year: day.getUTCFullYear(), month: day.getUTCMonth() + 1, day: day.getUTCDate() },
        timeZone,
    );
}

function pad(n: number): string {
    return String(n).padStart(2, '0');
}
