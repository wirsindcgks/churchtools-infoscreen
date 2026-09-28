/**
 * The band of "Hinweise" (Plan.md, Nächste Schritte 34): playlists whose band
 * reads exactly the same show as one entry – "Heute Parkplatz gesperrt" on
 * three playlists is one notice, not three.
 */
import type { Banner } from '../model/schema';
import { bannerShown, wallTime } from '../player/banner';
import { formatShortDate, formatTime } from '../player/format';
import type { PlaylistOverview, ScreenRef } from '../store/screen-repository';

/** After how many calendar days an expired band leaves "Hinweise" for good (Plan.md, Nächste Schritte 38). */
export const EXPIRED_NOTICE_DAYS = 7;

/**
 * A band whose "until" lies more than `EXPIRED_NOTICE_DAYS` calendar days in the
 * past, reckoned on the church's wall time – as `until` itself is (Plan.md 38).
 * Reckoned as text, not as an instant: 7 calendar days on the naive value stay
 * exact across a time change, a fixed offset would not. A band without an
 * `until` never fades.
 */
export function bannerFaded(banner: Banner, now: Date, timeZone: string): boolean {
    const parsed = banner.until ? /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(banner.until) : null;
    if (!parsed) return false;
    const [, year, month, day, hour, minute] = parsed;
    const faded = new Date(
        Date.UTC(Number(year), Number(month) - 1, Number(day) + EXPIRED_NOTICE_DAYS, Number(hour), Number(minute)),
    );
    const two = (n: number) => String(n).padStart(2, '0');
    const fadedText = `${faded.getUTCFullYear()}-${two(faded.getUTCMonth() + 1)}-${two(faded.getUTCDate())}T${two(faded.getUTCHours())}:${two(faded.getUTCMinutes())}`;
    return fadedText <= wallTime(now, timeZone);
}

export interface BannerGroup {
    banner: Banner;
    playlists: PlaylistOverview[];
    /** Screens any of the group's playlists runs on, without duplicates. */
    screens: ScreenRef[];
    /** Its `until` (Wanduhr der Gemeinde) has passed – the TVs no longer show it. */
    expired: boolean;
}

/** One entry per distinct band – compared as text (`JSON.stringify`), playlists without a band left out. */
export function groupBanners(overviews: readonly PlaylistOverview[], now: Date, timeZone: string): BannerGroup[] {
    const groups: { key: string; group: BannerGroup }[] = [];
    for (const overview of overviews) {
        const banner = overview.playlist.banner;
        if (!banner) continue;
        // Faded more than EXPIRED_NOTICE_DAYS ago: left out entirely, not even under "Abgelaufen" (Plan.md 38).
        if (bannerFaded(banner, now, timeZone)) continue;
        const key = JSON.stringify(banner);
        let entry = groups.find((g) => g.key === key);
        if (!entry) {
            entry = { key, group: { banner, playlists: [], screens: [], expired: !bannerShown(banner, now, timeZone) } };
            groups.push(entry);
        }
        entry.group.playlists.push(overview);
        for (const screen of overview.screens) {
            if (!entry.group.screens.some((s) => s.id === screen.id)) entry.group.screens.push(screen);
        }
    }
    return groups.map((g) => g.group);
}

/**
 * "bis Sa., 27.09., 18:00" – `until` already holds the church's wall time
 * (Plan.md 32), so it is shown as it stands, without converting a time zone.
 * "ohne Ende" without one.
 */
export function untilLabel(until: string | undefined): string {
    const parsed = until ? /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(until) : null;
    if (!parsed) return 'ohne Ende';
    const [, year, month, day, hour, minute] = parsed;
    const instant = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute)));
    return `bis ${formatShortDate(instant, 'UTC')}, ${formatTime(instant, 'UTC')}`;
}
