/**
 * The band of "Hinweise" (Plan.md, Nächste Schritte 34): playlists whose band
 * reads exactly the same show as one entry – "Heute Parkplatz gesperrt" on
 * three playlists is one notice, not three.
 */
import type { Appointment } from '../appointments/normalize';
import { bannerKey, type Banner, type ScreenDoc } from '../model/schema';
import { bannerShown, wallTime } from '../player/banner';
import { formatShortDate, formatTime } from '../player/format';
import type { PlaylistOverview, ScreenRef } from '../store/screen-repository';
import { weekTimeline, type WeekDay } from './schedule-ops';

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
    /** The newest stamp among the group's bands (Plan.md 66); missing for bands saved before schema 1.23. */
    updatedAt?: string;
    updatedBy?: string;
}

/** One entry per distinct band – compared as text (`bannerKey`, without the stamp), playlists without a band left out. */
export function groupBanners(overviews: readonly PlaylistOverview[], now: Date, timeZone: string): BannerGroup[] {
    const groups: { key: string; group: BannerGroup }[] = [];
    for (const overview of overviews) {
        const banner = overview.playlist.banner;
        if (!banner) continue;
        // Faded more than EXPIRED_NOTICE_DAYS ago: left out entirely, not even under "Abgelaufen" (Plan.md 38).
        if (bannerFaded(banner, now, timeZone)) continue;
        const key = bannerKey(banner);
        let entry = groups.find((g) => g.key === key);
        if (!entry) {
            entry = { key, group: { banner, playlists: [], screens: [], expired: !bannerShown(banner, now, timeZone) } };
            groups.push(entry);
        }
        entry.group.playlists.push(overview);
        if (banner.updatedAt && banner.updatedAt > (entry.group.updatedAt ?? '')) {
            entry.group.updatedAt = banner.updatedAt;
            entry.group.updatedBy = banner.updatedBy;
        }
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

/** A stretch of a day on which the band stands on the same screens throughout; none at all when `visible` is false. */
export interface NoticeSegment {
    /** Minutes after local midnight; `end` is exclusive. */
    start: number;
    end: number;
    visible: boolean;
    /** The screens the band stands on during the stretch; empty when it is not shown. */
    screenIds: string[];
}

export interface NoticeDay {
    date: WeekDay['date'];
    weekday: number;
    segments: NoticeSegment[];
}

/**
 * When the band actually stands on a TV (Plan.md 69): over `days` days from `start`, the stretches
 * during which a playlist of the group runs on a screen, cut at `until`. `until` is the church's wall
 * time as text (Plan.md 32), so each day is compared by its date as text – no offset involved.
 */
export function noticeTimeline(
    group: BannerGroup,
    screens: readonly ScreenDoc[],
    start: { year: number; month: number; day: number },
    days: number,
    timeZone: string,
    appointments: Appointment[],
): NoticeDay[] {
    const playlistIds = new Set(group.playlists.map((o) => o.playlist.id));
    const onScreens = screens.filter((s) => group.screens.some((r) => r.id === s.id));
    const weeks = onScreens.map((s) => ({ id: s.id, week: weekTimeline(s, start, days, timeZone, appointments) }));
    const until = group.banner.until ? /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/.exec(group.banner.until) : null;
    const two = (n: number) => String(n).padStart(2, '0');

    return Array.from({ length: days }, (_, index) => {
        const { date, weekday } = dateAfter(start, index);
        const dateText = `${date.year}-${two(date.month)}-${two(date.day)}`;
        // Minutes of this day on which the band is still allowed to stand.
        const limit = !until || dateText < until[1]! ? 1440 : dateText === until[1] ? Number(until[2]) * 60 + Number(until[3]) : 0;

        const shown = weeks.map(({ id, week }) => ({
            id,
            stretches: (week[index]?.segments ?? [])
                .filter((seg) => playlistIds.has(seg.playlistId))
                .map((seg) => ({ start: seg.start, end: Math.min(seg.end, limit) }))
                .filter((seg) => seg.end > seg.start),
        }));
        const bounds = [...new Set([0, 1440, ...shown.flatMap((s) => s.stretches.flatMap((r) => [r.start, r.end]))])].sort((a, b) => a - b);
        const segments: NoticeSegment[] = [];
        for (let i = 0; i < bounds.length - 1; i++) {
            const from = bounds[i]!;
            const to = bounds[i + 1]!;
            const screenIds = shown.filter((s) => s.stretches.some((r) => r.start <= from && to <= r.end)).map((s) => s.id);
            const last = segments.at(-1);
            if (last && last.screenIds.join('|') === screenIds.join('|')) last.end = to;
            else segments.push({ start: from, end: to, visible: screenIds.length > 0, screenIds });
        }
        return { date, weekday, segments };
    });
}

/** The calendar day `offset` days after `start`, with its ISO weekday (1 = Monday) – a date has its weekday in every zone. */
function dateAfter(start: { year: number; month: number; day: number }, offset: number) {
    const counted = new Date(Date.UTC(start.year, start.month - 1, start.day + offset));
    const date = { year: counted.getUTCFullYear(), month: counted.getUTCMonth() + 1, day: counted.getUTCDate() };
    return { date, weekday: ((counted.getUTCDay() + 6) % 7) + 1 };
}
