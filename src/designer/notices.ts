/**
 * The band of "Hinweise" (Plan.md, Nächste Schritte 34): playlists whose band
 * reads exactly the same show as one entry – "Heute Parkplatz gesperrt" on
 * three playlists is one notice, not three.
 */
import type { Banner } from '../model/schema';
import { bannerShown } from '../player/banner';
import { formatShortDate, formatTime } from '../player/format';
import type { PlaylistOverview, ScreenRef } from '../store/screen-repository';

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
