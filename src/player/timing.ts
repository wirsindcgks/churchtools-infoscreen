/**
 * Consideration for the API and for a device nobody watches (Plan.md, Player):
 * random offset on every interval so screens do not ask in the same second
 * after a power cut, exponential backoff on errors, and a time limit on every
 * request – the test instance once took 25 seconds for `whoami`.
 */

export const INTERVALS = {
    /** Screen configuration: short, so a designer sees the change before leaving. */
    configMs: 2 * 60_000,
    /**
     * The quick check of what designers saved (Plan.md, 26): one small request,
     * so a saved change is on the TV within about 20 seconds.
     */
    quickCheckMs: 20_000,
    /** ChurchTools data. */
    dataMs: 10 * 60_000,
    requestTimeoutMs: 20_000,
    maxBackoffMs: 30 * 60_000,
    /** Failing this long without a break, the player starts afresh – if the page itself can load. */
    reloadAfterFailingMs: 30 * 60_000,
} as const;

/** Spreads an interval by ±`spread` so that many devices drift apart. */
export function withJitter(ms: number, random = Math.random, spread = 0.2): number {
    return Math.round(ms * (1 - spread + 2 * spread * random()));
}

/** Delay after `failures` consecutive errors; honours `Retry-After` when given. */
export function backoffDelay(baseMs: number, failures: number, retryAfterMs?: number): number {
    const exponential = Math.min(baseMs * 2 ** Math.max(failures - 1, 0), INTERVALS.maxBackoffMs);
    return Math.max(exponential, retryAfterMs ?? 0);
}

export class TimeoutError extends Error {
    constructor(ms: number) {
        super(`Keine Antwort nach ${Math.round(ms / 1000)} Sekunden.`);
        this.name = 'TimeoutError';
    }
}

export function withTimeout<T>(promise: Promise<T>, ms: number = INTERVALS.requestTimeoutMs): Promise<T> {
    let timer: ReturnType<typeof setTimeout>;
    return Promise.race([
        promise,
        new Promise<never>((_, reject) => {
            timer = setTimeout(() => reject(new TimeoutError(ms)), ms);
        }),
    ]).finally(() => clearTimeout(timer));
}

/** Milliseconds until the next local 03:xx, for the nightly reload. */
export function msUntilNightlyReload(now: Date, random = Math.random): number {
    const next = new Date(now);
    next.setHours(3, Math.floor(random() * 60), 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
    return next.getTime() - now.getTime();
}
