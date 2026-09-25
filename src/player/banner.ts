/** The band over a playlist's slides (schema 1.10, Plan.md, Nächste Schritte 32). */
import { zonedParts } from '../appointments/zoned';
import type { Banner } from '../model/schema';

/** Shown: it has text, and its `until` – the church's wall time – has not come yet. */
export function bannerShown(banner: Banner | null | undefined, now: Date, timeZone: string): banner is Banner {
    if (!banner?.text.trim()) return false;
    if (!banner.until) return true;
    return wallTime(now, timeZone) < banner.until.slice(0, 16);
}

/** `YYYY-MM-DDTHH:mm` in the church's time zone – comparable as text with what a date field gives. */
export function wallTime(now: Date, timeZone: string): string {
    const p = zonedParts(now, timeZone);
    const two = (n: number) => String(n).padStart(2, '0');
    return `${p.year}-${two(p.month)}-${two(p.day)}T${two(p.hour)}:${two(p.minute)}`;
}

/** Seconds for one pass: the text comes in at the right edge and leaves at the left, at `speed` px/s. */
export function passSeconds(stageWidth: number, textWidth: number, speed: number): number {
    return (stageWidth + textWidth) / Math.max(1, speed);
}
