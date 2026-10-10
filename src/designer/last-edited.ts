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
