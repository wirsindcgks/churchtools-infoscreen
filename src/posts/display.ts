/**
 * Display helpers for the `posts` block's card (Plan.md, Nächste Schritte 33,
 * "Nachgezogen am 2026-09-25"): how old a post reads and how its own image is
 * shaped – both independent of `postParagraphs`' text handling.
 */
import { zonedParts } from '../appointments/zoned';
import { formatDate } from '../player/format';

/**
 * A post's age in words, by calendar day in the instance time zone – not by
 * elapsed hours, so a post from just after midnight reads "gestern" once the
 * day has turned, even minutes later (G19, zoned.ts).
 */
export function relativeAge(published: Date, now: Date, timeZone: string): string {
    const p = zonedParts(published, timeZone);
    const n = zonedParts(now, timeZone);
    const publishedDay = Date.UTC(p.year, p.month - 1, p.day);
    const today = Date.UTC(n.year, n.month - 1, n.day);
    const days = Math.round((today - publishedDay) / 86_400_000);
    if (days <= 0) return 'heute';
    if (days === 1) return 'gestern';
    if (days <= 6) return `vor ${days} Tagen`;
    return formatDate(published, timeZone);
}

/** Instagram's own bounds: 4:5 (tall) to 1.91:1 (wide). */
const MIN_IMAGE_ASPECT = 0.8;
const MAX_IMAGE_ASPECT = 1.91;

/** A post's own image shape, clamped like Instagram's; square without one. */
export function imageAspect(ratio: number | null): number {
    if (!ratio) return 1;
    return Math.min(MAX_IMAGE_ASPECT, Math.max(MIN_IMAGE_ASPECT, ratio));
}
