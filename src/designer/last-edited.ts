import { t } from '../i18n/designer';
import { LOCALE } from '../i18n/player';

/** What a tile says about the last change: when and by whom, each with a tooltip (Plan.md 66). */
export interface LastEdited {
    /** "05.10.2026, 14:32"; null without a valid date. */
    when: string | null;
    whenTitle: string | null;
    /** The name; null without one. */
    by: string | null;
    byTitle: string | null;
}

/**
 * The time in the church's time zone, like every time here – through `Intl`, never a fixed offset.
 * `verb` opens the tooltips: `t.common.edited.changed` for what is edited, `t.common.edited.uploaded` for a file.
 * Null when neither a valid date nor a name is there, so the tile shows no line at all.
 */
export function lastEdited(
    at: string | null | undefined,
    by: string | null | undefined,
    timeZone: string,
    verb: string = t.common.edited.changed,
): LastEdited | null {
    const date = at ? new Date(at) : null;
    const valid = date !== null && !Number.isNaN(date.getTime());
    const name = by?.trim() || null;
    if (!valid && !name) return null;
    const format = (options: Intl.DateTimeFormatOptions) =>
        new Intl.DateTimeFormat(LOCALE, { timeZone, ...options }).format(date!);
    return {
        when: valid
            ? format({ day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
            : null,
        // Date and time apart: a combined style reads "um" or "," depending on the ICU version.
        whenTitle: valid ? t.common.edited.on(verb, format({ dateStyle: 'long' }), format({ timeStyle: 'short' })) : null,
        by: name,
        byTitle: name ? t.common.edited.by(verb, name) : null,
    };
}

const clock = (date: Date, timeZone: string) =>
    new Intl.DateTimeFormat(LOCALE, { timeZone, hour: '2-digit', minute: '2-digit' }).format(date);

/** The calendar day of `date` in the time zone, as numbers – to compare days without an offset. */
function dayIn(date: Date, timeZone: string): { year: number; month: number; day: number } {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(date);
    const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
    return { year: get('year'), month: get('month'), day: get('day') };
}

/** "14:32" in the church's time zone. */
export function clockTime(at: string | Date, timeZone: string): string {
    return clock(new Date(at), timeZone);
}

/** "heute 14:32", "gestern 14:32", else "05.10., 14:32" – with the year when it is not this one. Days count in the time zone. */
export function relativeWhen(at: string | Date, timeZone: string, now: Date = new Date()): string {
    const date = new Date(at);
    const day = dayIn(date, timeZone);
    const today = dayIn(now, timeZone);
    const dayNumber = (d: { year: number; month: number; day: number }) => Date.UTC(d.year, d.month - 1, d.day) / 86_400_000;
    const diff = dayNumber(today) - dayNumber(day);
    if (diff === 0) return `${t.common.edited.today} ${clock(date, timeZone)}`;
    if (diff === 1) return `${t.common.edited.yesterday} ${clock(date, timeZone)}`;
    const dayText = new Intl.DateTimeFormat(LOCALE, {
        timeZone,
        day: '2-digit',
        month: '2-digit',
        ...(day.year === today.year ? {} : { year: 'numeric' as const }),
    }).format(date);
    return `${dayText}, ${clock(date, timeZone)}`;
}
