/**
 * The persisted data model: Screen → Playlist → Slides → Blocks (Plan.md, E).
 *
 * Every document is one KV value of at most 10,000 characters and carries its
 * own stable `id`. The server-side value id is a storage detail of the
 * repository; references between documents always use these ids.
 */
import * as v from 'valibot';

/** Bump `major` only for changes an older player cannot survive. */
export const SCHEMA_VERSION = { major: 1, minor: 31 } as const;

const Id = v.pipe(v.string(), v.minLength(1), v.maxLength(64));
const Px = v.pipe(v.number(), v.finite());
const PositivePx = v.pipe(v.number(), v.finite(), v.minValue(1));
const Color = v.pipe(v.string(), v.maxLength(64));

const SchemaVersion = v.object({
    major: v.pipe(v.number(), v.integer(), v.minValue(1)),
    minor: v.pipe(v.number(), v.integer(), v.minValue(0)),
});

export const Fill = v.variant('kind', [
    v.object({ kind: v.literal('solid'), color: Color }),
    v.object({
        kind: v.literal('linear-gradient'),
        angle: Px,
        stops: v.pipe(
            v.array(v.object({ color: Color, at: v.pipe(v.number(), v.minValue(0), v.maxValue(1)) })),
            v.minLength(2),
        ),
    }),
]);

export const TextStyle = v.object({
    /** Key into the bundled font list; unknown keys fall back when rendering. */
    fontFamily: v.string(),
    fontSize: PositivePx,
    fontWeight: v.optional(v.picklist([400, 600, 700]), 400),
    color: Color,
    align: v.optional(v.picklist(['left', 'center', 'right']), 'left'),
    /** Since 1.22: shown in capitals; the stored text stays as typed (Plan.md 65). Older players ignore it. */
    uppercase: v.optional(v.boolean()),
    /**
     * Since 1.24: where the content sits in a box taller than it (Plan.md 70). Missing means what the
     * block did before – each block's default lives in the player; older players ignore the field.
     */
    verticalAlign: v.optional(v.picklist(['top', 'middle', 'bottom'])),
});

/** Since 1.31: the soft or strong shadow of a picture, video or gallery (Plan.md F2). */
const BlockShadow = v.picklist(['none', 'soft', 'strong']);
const BlockCorners = v.pipe(v.number(), v.finite(), v.minValue(0));

const BlockFrame = {
    id: Id,
    x: Px,
    y: Px,
    width: PositivePx,
    height: PositivePx,
    /**
     * Since 1.7: locked in the editor – not moved, resized, edited, reordered
     * or deleted until unlocked (Plan.md, Nächste Schritte 25). The player
     * does not care.
     */
    locked: v.optional(v.boolean()),
    /**
     * Since 1.29: blocks sharing a `groupId` on one slide are selected and moved together in the editor
     * (Plan.md D9). No nesting; the player draws every block on its own and ignores the field.
     */
    groupId: v.optional(Id),
    /** Since 1.30: turned about the middle of the frame, in degrees (Plan.md F1). Missing means 0; older players ignore it. */
    rotation: v.optional(v.pipe(v.number(), v.finite(), v.minValue(-180), v.maxValue(180))),
    /** Since 1.30: how opaque the block is, in percent (Plan.md F1). Missing means 100; older players ignore it. */
    opacity: v.optional(v.pipe(v.number(), v.finite(), v.minValue(0), v.maxValue(100))),
};

export const TextBlock = v.object({
    ...BlockFrame,
    type: v.literal('text'),
    text: v.string(),
    style: TextStyle,
});

export const ImageBlock = v.object({
    ...BlockFrame,
    type: v.literal('image'),
    /** Empty until a medium is chosen; the player then shows a calm placeholder. */
    mediaId: v.pipe(v.string(), v.maxLength(64)),
    fit: v.optional(v.picklist(['contain', 'cover']), 'contain'),
    /**
     * Since 1.31: the part of the picture shown at `fit: 'cover'` (Plan.md F2). `x` and `y` are the position as in CSS
     * `object-position` (50 = middle, 0 = the left or top edge of the picture at the frame); `zoom` enlarges. Older
     * players show the whole cover.
     */
    crop: v.optional(
        v.object({
            x: v.pipe(v.number(), v.finite(), v.minValue(0), v.maxValue(100)),
            y: v.pipe(v.number(), v.finite(), v.minValue(0), v.maxValue(100)),
            zoom: v.pipe(v.number(), v.finite(), v.minValue(1), v.maxValue(3)),
        }),
    ),
    /** Since 1.31: rounded corners and a shadow, both only at `fit: 'cover'` (Plan.md F2). Older players ignore them. */
    cornerRadius: v.optional(BlockCorners),
    shadow: v.optional(BlockShadow),
    /** Since 1.31: darkens, lightens or greys the picture's pixels, for text on top of it. */
    tone: v.optional(v.picklist(['none', 'darken', 'lighten', 'grayscale'])),
});

export const ShapeBlock = v.object({
    ...BlockFrame,
    type: v.literal('shape'),
    fill: Fill,
    cornerRadius: v.optional(v.pipe(v.number(), v.minValue(0)), 0),
    /** Since 1.30: an ellipse ignores `cornerRadius`. Missing means a rectangle; older players draw a rectangle. */
    shape: v.optional(v.picklist(['rect', 'ellipse'])),
    /** Since 1.30: an edge drawn inside the shape; missing or width 0 means none. Older players ignore it. */
    border: v.optional(v.object({ color: Color, width: v.pipe(v.number(), v.finite(), v.minValue(0)) })),
});

/** Since 1.30: drawn horizontally in the middle of its frame; slanted by `rotation`. Older players skip the block. */
export const LineBlock = v.object({
    ...BlockFrame,
    type: v.literal('line'),
    color: Color,
    thickness: PositivePx,
    dash: v.optional(v.picklist(['solid', 'dashed']), 'solid'),
});

export const ClockBlock = v.object({
    ...BlockFrame,
    type: v.literal('clock'),
    format: v.picklist(['time', 'date', 'datetime']),
    style: TextStyle,
});

export const AppointmentListBlock = v.object({
    ...BlockFrame,
    type: v.literal('appointment-list'),
    calendarIds: v.pipe(v.array(v.pipe(v.number(), v.integer())), v.minLength(1)),
    horizonDays: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(366)),
    /** At most this many – unless `showAll`; then only for players older than schema 1.6. */
    limit: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(50)),
    /**
     * Since 1.6: every appointment of the horizon; what does not fit the block
     * is shown page by page, and the slide stays until every page has run
     * (Plan.md, Nächste Schritte 23).
     */
    showAll: v.optional(v.boolean()),
    /** Seconds per page, at least; default 10. */
    pageSeconds: v.optional(v.pipe(v.number(), v.integer(), v.minValue(3), v.maxValue(120))),
    /**
     * Since 1.8: `cards` – date tile, calendar badge, title, time and place, after
     * the list of the WordPress plugin (Plan.md, 20); `rows` is the plain list.
     */
    layout: v.optional(v.picklist(['rows', 'cards'])),
    /**
     * Since 1.16: the booked rooms beside the place – in the `cards` layout only
     * (Plan.md, Nächste Schritte 50). Missing = off.
     */
    showRooms: v.optional(v.boolean()),
    /** Since 1.17: ids of the services whose people show under the place, cards only (Plan.md, Nächste Schritte 51). Missing or empty = off. */
    services: v.optional(v.pipe(v.array(v.pipe(v.number(), v.integer())), v.maxLength(6))),
    /** Since 1.17: calendars whose appointments show no booked rooms though `showRooms` is on (Plan.md, Nächste Schritte 51). Missing = none left out. */
    roomsOffCalendarIds: v.optional(v.array(v.pipe(v.number(), v.integer()))),
    style: TextStyle,
});

export const NextAppointmentBlock = v.object({
    ...BlockFrame,
    type: v.literal('next-appointment'),
    calendarIds: v.pipe(v.array(v.pipe(v.number(), v.integer())), v.minLength(1)),
    showImage: v.optional(v.boolean(), true),
    /**
     * Since 1.8: `card` – the highlighted event of the WordPress plugin: date
     * tile, badge, large title, description, time and place, the image beside it
     * (Plan.md, 20); `classic` is the plain one.
     */
    layout: v.optional(v.picklist(['classic', 'card'])),
    /** Since 1.16: the booked rooms beside the place, in both layouts (Plan.md, Nächste Schritte 50). Missing = off. */
    showRooms: v.optional(v.boolean()),
    /** Since 1.17: ids of the services whose people show under the place, in both layouts (Plan.md, Nächste Schritte 51). Missing or empty = off. */
    services: v.optional(v.pipe(v.array(v.pipe(v.number(), v.integer())), v.maxLength(6))),
    /** Since 1.17: calendars whose appointments show no booked rooms though `showRooms` is on (Plan.md, Nächste Schritte 51). Missing = none left out. */
    roomsOffCalendarIds: v.optional(v.array(v.pipe(v.number(), v.integer()))),
    style: TextStyle,
});

/** The switchable header from the pitch: congregation name from /info, logo from /logo (G29). */
export const ChurchHeaderBlock = v.object({
    ...BlockFrame,
    type: v.literal('church-header'),
    showLogo: v.optional(v.boolean(), true),
    /**
     * A library image instead of the church logo – for a dark logo on a dark
     * stage. Since schema 1.1; older players drop it and show the church logo.
     */
    logoMediaId: v.optional(v.pipe(v.string(), v.maxLength(64))),
    showName: v.optional(v.boolean(), true),
    style: TextStyle,
});

/**
 * Since 1.9: another website in a frame – a page of the church website, a widget
 * (Plan.md, Nächste Schritte 28). https only; ChurchTools allows foreign
 * frames (`child-src *`, G15). Empty until set; the player then shows a calm
 * placeholder, offline the frame shows nothing.
 */
export const WebBlock = v.object({
    ...BlockFrame,
    type: v.literal('web'),
    url: v.pipe(v.string(), v.maxLength(2000)),
    /** Size of the page in the block: 2 = twice as large, for pages made for a phone. */
    zoom: v.optional(v.pipe(v.number(), v.minValue(0.25), v.maxValue(4)), 1),
});

/** Since 1.9: a QR code, made on the device – for a link the congregation should open on the phone. */
export const QrBlock = v.object({
    ...BlockFrame,
    type: v.literal('qr'),
    data: v.pipe(v.string(), v.maxLength(1000)),
    color: Color,
    background: Color,
});

/**
 * Since 1.10: the time until the next appointment of some calendars – "Gottesdienst
 * beginnt in 12:34" (Plan.md, Nächste Schritte 32). While one runs, `runningText`
 * stands instead; left empty, the block counts down to the next one.
 */
export const CountdownBlock = v.object({
    ...BlockFrame,
    type: v.literal('countdown'),
    calendarIds: v.pipe(v.array(v.pipe(v.number(), v.integer())), v.minLength(1)),
    showTitle: v.optional(v.boolean(), true),
    runningText: v.optional(v.pipe(v.string(), v.maxLength(200)), 'Läuft gerade'),
    style: TextStyle,
});

/**
 * Since 1.11: posts of ChurchTools groups – title, text, image, published and
 * expiry date (Plan.md, Nächste Schritte 33). `groupIds` starts empty until
 * chosen; the player then shows nothing. Posts older than `maxAgeDays`,
 * banned or not yet published never show (Plan.md, Befunde G37).
 */
export const PostsBlock = v.object({
    ...BlockFrame,
    type: v.literal('posts'),
    groupIds: v.array(v.pipe(v.number(), v.integer())),
    limit: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(10)),
    maxAgeDays: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(365)), 30),
    /** `card` – one post at a time, after the highlighted appointment; `list` – as many rows as fit. */
    layout: v.optional(v.picklist(['card', 'list']), 'card'),
    showImage: v.optional(v.boolean(), true),
    /** Off until switched on: the API hands the author's real name to anyone (G37). */
    showAuthor: v.optional(v.boolean(), false),
    /** Seconds per post while `card` pages through them; default POST_SECONDS. */
    pageSeconds: v.optional(v.pipe(v.number(), v.integer(), v.minValue(5), v.maxValue(120))),
    style: TextStyle,
});

/** The items a `groups` block shows of each group (schema 1.14); all on but the leaders. */
export const GroupFields = v.object({
    name: v.optional(v.boolean(), true),
    image: v.optional(v.boolean(), true),
    /** Weekday and meeting time. */
    when: v.optional(v.boolean(), true),
    targetGroup: v.optional(v.boolean(), true),
    category: v.optional(v.boolean(), true),
    /** The description, a few lines of it. */
    note: v.optional(v.boolean(), true),
    /**
     * Off until switched on, like the author of a post (G37). Even then only
     * names ChurchTools itself shows on the homepage (Plan.md 43, c).
     */
    leaders: v.optional(v.boolean(), false),
    /** The leaders' pictures beside their names; off until switched on, and only with `leaders` (wish of the user, 2026-09-29). */
    leaderImages: v.optional(v.boolean(), false),
    /** "Noch 3 Plätze frei" – only for groups with a maximum. */
    places: v.optional(v.boolean(), true),
    /** A QR code to the group's public page; `card` only. */
    qr: v.optional(v.boolean(), true),
});

/**
 * Since 1.14: the groups of a ChurchTools group homepage – an overview of what
 * groups there are, one at a time with a QR code or as a list (Plan.md,
 * Nächste Schritte 43). The source is the homepage, never `/groups`: it holds
 * only what ChurchTools shows the public (G40). Stored is the id of the
 * homepage's parent group, not the homepage's id or hash – those change when
 * the homepage is made anew. Without it the block shows a calm placeholder.
 */
export const GroupsBlock = v.object({
    ...BlockFrame,
    type: v.literal('groups'),
    parentGroupId: v.optional(v.pipe(v.number(), v.integer())),
    /** Empty: every group of the homepage, in `sort` order; else exactly these, in this order. */
    groupIds: v.pipe(v.array(v.pipe(v.number(), v.integer())), v.maxLength(100)),
    /**
     * Since 1.26: the order of every group when none are chosen (Plan.md 72) – by weekday (Monday first, as
     * before), or by name A–Z or Z–A. A choice keeps its own order. Older players ignore it and sort by weekday.
     */
    sort: v.optional(v.picklist(['weekday', 'name-asc', 'name-desc']), 'weekday'),
    /** `card` – one group after the other, with its QR code; `list` – rows, page by page. */
    layout: v.optional(v.picklist(['card', 'list']), 'card'),
    /**
     * Groups per page as `card` (wish of the user, 2026-09-29): side by side
     * in a wide block, stacked in a tall one; each card takes the shape of
     * its own cell – two in a 16:9 block are portrait cards.
     */
    perPage: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(4)), 1),
    /**
     * What each group shows, one switch per item (wish of the user,
     * 2026-09-29). Missing switches take their default; new items can come
     * without a new field.
     */
    show: v.optional(GroupFields, {}),
    /** Seconds per page, in both layouts; default GROUP_SECONDS. */
    pageSeconds: v.optional(v.pipe(v.number(), v.integer(), v.minValue(5), v.maxValue(120))),
    style: TextStyle,
});

/**
 * Since 1.15: several library images one after the other, with a fade or a cut
 * (Plan.md, Nächste Schritte 46). Empty until images are chosen; the player then
 * shows a calm placeholder. The slide stays until every image has run once. At
 * most 30 images; more makes the block invalid, and it is skipped.
 */
export const SlideshowBlock = v.object({
    ...BlockFrame,
    type: v.literal('slideshow'),
    mediaIds: v.pipe(v.array(Id), v.maxLength(30)),
    fit: v.optional(v.picklist(['contain', 'cover']), 'cover'),
    /** Seconds per image; default 6. */
    seconds: v.optional(v.pipe(v.number(), v.integer(), v.minValue(3), v.maxValue(60)), 6),
    /**
     * How the next image comes: fade, push from the right, wipe from the left, or a cut. `zoom` (a fade with a slow
     * zoom in) is only read since 1.19, for old data: it plays as a fade with `motion: 'in'`.
     */
    transition: v.optional(v.picklist(['fade', 'slide', 'wipe', 'zoom', 'none']), 'fade'),
    /** Since 1.19: a slow zoom of every image while it stands, with any transition; `alternate` zooms every second one out. */
    motion: v.optional(v.picklist(['none', 'in', 'out', 'alternate']), 'none'),
    /** Since 1.31: only at `fit: 'cover'` (Plan.md F2). Older players ignore them. */
    cornerRadius: v.optional(BlockCorners),
    shadow: v.optional(BlockShadow),
});

/** One room of a `rooms` block (schema 1.16). */
export const RoomEntry = v.object({
    resourceId: v.pipe(v.number(), v.integer()),
    /** Wegweiser, e.g. "1. OG, links"; empty = none. */
    hint: v.optional(v.pipe(v.string(), v.maxLength(100)), ''),
    /** Booking titles may carry names ("Gespräch Familie X"); off → "Belegt". */
    showTitles: v.optional(v.boolean(), true),
});

/**
 * Since 1.16: which rooms are taken today – as an overview of all chosen
 * rooms or as the door sign of the first one (Plan.md, Nächste Schritte 46).
 * Only resources of the type room; the privacy rule lives in
 * `src/rooms/normalize.ts`. Empty until rooms are chosen; the player then
 * shows a calm placeholder. At most 30 rooms; more makes the block invalid,
 * and it is skipped.
 */
export const RoomsBlock = v.object({
    ...BlockFrame,
    type: v.literal('rooms'),
    rooms: v.pipe(v.array(RoomEntry), v.maxLength(30)),
    layout: v.optional(v.picklist(['overview', 'door']), 'overview'),
    /** 1 = today, 2 = today and tomorrow. */
    days: v.optional(v.picklist([1, 2]), 1),
    /** Seconds per page of the overview; default PAGE_SECONDS. */
    pageSeconds: v.optional(v.pipe(v.number(), v.integer(), v.minValue(5), v.maxValue(120))),
    style: TextStyle,
});

/**
 * Since 1.18: one library video, played in a loop with or without sound
 * (Plan.md, Nächste Schritte 52). Empty until a video is chosen; the player
 * then shows a calm placeholder. The slide stays at least as long as the video.
 */
export const VideoBlock = v.object({
    ...BlockFrame,
    type: v.literal('video'),
    mediaId: v.optional(Id),
    fit: v.optional(v.picklist(['contain', 'cover']), 'contain'),
    /** Off until switched on; the browser of the device may still keep it muted. */
    sound: v.optional(v.boolean(), false),
    /** Since 1.31: only at `fit: 'cover'` (Plan.md F2). Older players ignore them. */
    cornerRadius: v.optional(BlockCorners),
    shadow: v.optional(BlockShadow),
});

export const Block = v.variant('type', [
    TextBlock,
    ImageBlock,
    ShapeBlock,
    ClockBlock,
    AppointmentListBlock,
    NextAppointmentBlock,
    ChurchHeaderBlock,
    WebBlock,
    QrBlock,
    CountdownBlock,
    PostsBlock,
    GroupsBlock,
    SlideshowBlock,
    RoomsBlock,
    VideoBlock,
    LineBlock,
]);

/** The calendars whose appointments a block shows or counts down to. */
export function blockCalendarIds(block: Block): number[] {
    return block.type === 'appointment-list' || block.type === 'next-appointment' || block.type === 'countdown'
        ? block.calendarIds
        : [];
}

/**
 * Since 1.10: a band over every slide of a playlist – running text or a
 * standing notice, "Parkplatz heute gesperrt" (Plan.md, Nächste Schritte 32).
 * It lies on the stage, not on a slide, so it runs on when the slide changes.
 * From `until` on it is gone by itself; older players do not show it.
 */
export const Banner = v.object({
    text: v.pipe(v.string(), v.maxLength(500)),
    mode: v.optional(v.picklist(['scroll', 'static']), 'scroll'),
    position: v.optional(v.picklist(['bottom', 'top']), 'bottom'),
    /** Height in stage pixels. */
    height: v.optional(v.pipe(v.number(), v.minValue(30), v.maxValue(400)), 90),
    /** Stage pixels per second while it scrolls. */
    speed: v.optional(v.pipe(v.number(), v.minValue(20), v.maxValue(800)), 140),
    background: Color,
    style: TextStyle,
    /**
     * The church's wall time from which it is gone, `YYYY-MM-DDTHH:mm` – as a
     * date field gives it, compared in the church's time zone, not the
     * device's. Empty or missing: until someone removes it.
     */
    until: v.optional(v.pipe(v.string(), v.maxLength(40))),
    /**
     * Since 1.23: when and by whom the band itself last changed (Plan.md 66) –
     * the playlist's own stamp also moves when only a slide changes. Set by
     * the repository (`stampBanner`), never by the editors; not part of what
     * makes two bands the same (`bannerKey`).
     */
    updatedAt: v.optional(v.string()),
    updatedBy: v.optional(v.string()),
});

const Background = v.variant('kind', [
    ...Fill.options,
    v.object({ kind: v.literal('media'), mediaId: Id }),
]);

const DocumentBase = {
    schema: SchemaVersion,
    id: Id,
    updatedAt: v.optional(v.string()),
};

export const SlideDoc = v.object({
    ...DocumentBase,
    kind: v.literal('slide'),
    name: v.pipe(v.string(), v.maxLength(100)),
    durationSeconds: v.pipe(v.number(), v.minValue(1), v.maxValue(3600)),
    enabled: v.optional(v.boolean(), true),
    background: Background,
    /** Array order is paint order: later blocks lie on top. */
    blocks: v.array(Block),
});

/**
 * Since 1.28 (Plan.md 79, Paket E): what a designer has changed in a playlist and not published yet.
 * One per playlist, in the category `drafts`, which devices cannot see. The player does not know it.
 */
export const PlaylistDraftDoc = v.object({
    schema: SchemaVersion,
    kind: v.literal('playlist-draft'),
    /** The id of the playlist. */
    id: Id,
    name: v.pipe(v.string(), v.maxLength(100)),
    slideIds: v.array(Id),
    /** Counts up with every save; the second designer saving against an older one gets a conflict. */
    revision: v.pipe(v.number(), v.integer(), v.minValue(1)),
    updatedBy: v.string(),
    updatedAt: v.string(),
});

/** Since 1.28: the changed slide of a draft, whole – so the limit of 10,000 characters is the slide's own. */
export const SlideDraftDoc = v.object({
    schema: SchemaVersion,
    kind: v.literal('slide-draft'),
    /** `<playlist id>/<slide id>` */
    id: v.pipe(v.string(), v.minLength(1), v.maxLength(129)),
    playlistId: Id,
    slide: SlideDoc,
    updatedBy: v.string(),
    updatedAt: v.string(),
});

const Stage = v.object({ width: PositivePx, height: PositivePx });

/**
 * The content: slides in order. Since schema 1.4 a playlist stands on its
 * own and screens choose it – one playlist may run on several screens
 * (Plan.md, Nächste Schritte 19). Its slides are designed for `stage`;
 * older playlists get it from the screen that shows them (`withPlaylistDefaults`).
 */
export const PlaylistDoc = v.object({
    ...DocumentBase,
    kind: v.literal('playlist'),
    name: v.pipe(v.string(), v.maxLength(100)),
    slideIds: v.array(Id),
    stage: v.optional(Stage),
    /** Since 1.10: running text or a notice over every slide. */
    banner: v.optional(Banner),
    /** The designers save against it; missing counts as 0. */
    revision: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0))),
    updatedBy: v.optional(v.string()),
});

/**
 * A point in time relative to an appointment: its start or end, shifted by
 * signed minutes (negative = before). Since schema 1.5 (Plan.md, 22).
 */
export const AppointmentPoint = v.object({
    anchor: v.picklist(['start', 'end']),
    minutes: v.pipe(v.number(), v.integer(), v.minValue(-24 * 60), v.maxValue(24 * 60)),
});

/** A schedule rule (Plan.md, Playlists und Zeitpläne; edited in the schedule dialog). */
export const ScheduleRule = v.variant('kind', [
    v.object({
        kind: v.literal('appointment'),
        playlistId: Id,
        calendarIds: v.pipe(v.array(v.pipe(v.number(), v.integer())), v.minLength(1)),
        /** The window before 1.5: from start minus these … */
        minutesBefore: v.pipe(v.number(), v.integer(), v.minValue(0)),
        /** … to end plus these. Kept filled as the nearest such window, for players older than 1.5. */
        minutesAfter: v.pipe(v.number(), v.integer(), v.minValue(0)),
        /** Since 1.5: where the window begins and ends – e.g. 30 min before start to 10 min after start. */
        from: v.optional(AppointmentPoint),
        to: v.optional(AppointmentPoint),
    }),
    v.object({
        kind: v.literal('time'),
        playlistId: Id,
        /** ISO weekdays, 1 = Monday. */
        weekdays: v.array(v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(7))),
        from: v.pipe(v.string(), v.regex(/^\d{2}:\d{2}$/)),
        to: v.pipe(v.string(), v.regex(/^\d{2}:\d{2}$/)),
    }),
]);

export const Slug = v.pipe(v.string(), v.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/), v.maxLength(64));

export const ScreenDoc = v.object({
    ...DocumentBase,
    kind: v.literal('screen'),
    slug: Slug,
    name: v.pipe(v.string(), v.maxLength(100)),
    stage: Stage,
    overscanPercent: v.optional(v.pipe(v.number(), v.minValue(0), v.maxValue(20)), 0),
    /** Mandatory: "no rule matches" must never mean a black screen. */
    defaultPlaylistId: Id,
    /** Earlier rules win on overlap. */
    schedule: v.optional(v.array(ScheduleRule), []),
    revision: v.pipe(v.number(), v.integer(), v.minValue(0)),
    updatedBy: v.optional(v.string()),
});

/**
 * What runs on a screen and when – the default playlist and the rules (schema
 * 1.2). Written by the designers, while the screen document itself belongs to
 * the administrators (Plan.md, F; Nächste Schritte 15). Stored in the category
 * `playlists`, which designers may write anyway; its revision is the one the
 * editor's conflict detection uses. Missing, the values in the screen apply.
 */
export const ScheduleDoc = v.object({
    ...DocumentBase,
    kind: v.literal('schedule'),
    screenId: Id,
    defaultPlaylistId: Id,
    /** Earlier rules win on overlap. */
    rules: v.array(ScheduleRule),
    /** Schema 1.3 only, when playlists belonged to one screen; ignored since 1.4. */
    playlistIds: v.optional(v.array(Id)),
    revision: v.pipe(v.number(), v.integer(), v.minValue(0)),
    updatedBy: v.optional(v.string()),
});

/**
 * The look of all screens (schema 1.9, Plan.md, Nächste Schritte 27): one
 * document in the category `playlists`, which designers write and devices
 * read – no new rights. Blocks that set their own layout keep it; the colours
 * for text and background and the font are what new slides and blocks start
 * with.
 */
export const ThemeDoc = v.object({
    ...DocumentBase,
    kind: v.literal('theme'),
    corners: v.optional(v.picklist(['round', 'square']), 'round'),
    /** Tiles, labels and bars where a calendar has no colour of its own. */
    accent: v.optional(Color, '#3b82f6'),
    text: v.optional(Color, '#ffffff'),
    background: v.optional(Color, '#1e293b'),
    /** `native`: the plain list and next appointment; `large`: the cards after the WordPress plugin. */
    appointments: v.optional(v.picklist(['native', 'large']), 'native'),
    /** Shape of appointment images; `free` shows them as they are. */
    imageRatio: v.optional(v.picklist(['16:9', '4:3', '3:2', '1:1', 'free']), '16:9'),
    /**
     * The font new blocks and banners start with (schema 1.13, Plan.md 40) – a
     * key into the bundled fonts like `TextStyle.fontFamily`. A literal, not
     * `DEFAULT_FONT`, so that the model imports nothing from the player; a
     * test keeps the two equal.
     */
    font: v.optional(v.string(), 'lato'),
    /** Since 1.21: the church's named colours (Plan.md 64), offered at every colour field in the editor; copied on use, so none is referenced. */
    palette: v.optional(v.pipe(v.array(v.object({ name: v.pipe(v.string(), v.maxLength(40)), color: Color })), v.maxLength(12))),
    /**
     * Since 1.27: the surface of the blocks' cards (Plan.md 74) – the card of „Nächster Termin", „Beiträge" and
     * „Gruppen", and the door of „Raumbelegung". `tint`: the text colour at 7 %, as before, so it shows on light
     * and dark slides alike; `none`: no surface; `color`: `cardColor` at `cardOpacity` per cent. Colours that mean
     * something – calendars, the accent of what is running – stay as they are. Older players ignore it and tint.
     */
    cards: v.optional(v.picklist(['tint', 'none', 'color']), 'tint'),
    cardColor: v.optional(Color, '#1e293b'),
    cardOpacity: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(100)), 80),
    revision: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0))),
    updatedBy: v.optional(v.string()),
});

/** A reference to a ChurchTools file – never the file itself (Plan.md, Medien). */
export const MediaDoc = v.object({
    ...DocumentBase,
    kind: v.literal('media'),
    name: v.pipe(v.string(), v.maxLength(200)),
    fileId: v.pipe(v.number(), v.integer()),
    /** Image service address; always requested with both `w` and `h` (G14). */
    imageUrl: v.pipe(v.string(), v.maxLength(1000)),
    width: v.optional(PositivePx),
    height: v.optional(PositivePx),
    /** Since 1.18: missing = an image. The image service takes no videos (G42), so `imageUrl` is `''` for one. */
    mediaType: v.optional(v.picklist(['image', 'video'])),
    /** Since 1.18: download address of a video; the player plays it from there (G47). */
    fileUrl: v.optional(v.pipe(v.string(), v.maxLength(1000))),
    /** Since 1.18: length of a video in seconds, when it could be read. */
    durationSeconds: v.optional(v.pipe(v.number(), v.minValue(0))),
});

export function isVideo(doc: MediaDoc): boolean {
    return doc.mediaType === 'video';
}

/**
 * Module-wide settings, one document in the category `settings`. Written by
 * whoever sets the module up, read by the setup page. The group ids point to
 * ChurchTools groups whose roles carry the rights (Plan.md, F).
 */
export const SettingsDoc = v.object({
    ...DocumentBase,
    kind: v.literal('settings'),
    designerGroupId: v.optional(v.pipe(v.number(), v.integer())),
    deviceGroupId: v.optional(v.pipe(v.number(), v.integer())),
    /** Groups the setup assistant created – the only ones it may change or delete. */
    createdGroupIds: v.optional(v.array(v.pipe(v.number(), v.integer()))),
    /**
     * Since 1.25: the group type the assistant created its groups with (Plan.md 71) – chosen by the
     * administrator, since a church may have deleted or renamed „Merkmal". Missing means „Merkmal", as before.
     */
    createdGroupTypeId: v.optional(v.pipe(v.number(), v.integer())),
    /**
     * The wiki category the setup assistant created – the only one the module
     * may ever delete. Absent for a category it found, and for installations
     * older than this field.
     */
    createdWikiCategoryId: v.optional(v.pipe(v.number(), v.integer())),
    /** Since 1.20: the services an administrator allows on screens (Plan.md 58); missing or empty = none. */
    allowedServiceIds: v.optional(v.pipe(v.array(v.pipe(v.number(), v.integer())), v.maxLength(50))),
});

export type Fill = v.InferOutput<typeof Fill>;
export type TextStyle = v.InferOutput<typeof TextStyle>;
export type Block = v.InferOutput<typeof Block>;
export type GroupSort = NonNullable<v.InferOutput<typeof GroupsBlock>['sort']>;
export type GroupFields = v.InferOutput<typeof GroupFields>;
export type RoomEntry = v.InferOutput<typeof RoomEntry>;
export type BlockType = Block['type'];
export type SlideDoc = v.InferOutput<typeof SlideDoc>;
export type PlaylistDoc = v.InferOutput<typeof PlaylistDoc>;
export type PlaylistDraftDoc = v.InferOutput<typeof PlaylistDraftDoc>;
export type SlideDraftDoc = v.InferOutput<typeof SlideDraftDoc>;
export type Banner = v.InferOutput<typeof Banner>;
export type ScreenDoc = v.InferOutput<typeof ScreenDoc>;
export type ScheduleDoc = v.InferOutput<typeof ScheduleDoc>;
export type ScheduleRule = v.InferOutput<typeof ScheduleRule>;
export type AppointmentPoint = v.InferOutput<typeof AppointmentPoint>;
export type MediaDoc = v.InferOutput<typeof MediaDoc>;
export type SettingsDoc = v.InferOutput<typeof SettingsDoc>;
export type ThemeDoc = v.InferOutput<typeof ThemeDoc>;
export type AnyDoc =
    | ScreenDoc
    | PlaylistDoc
    | ScheduleDoc
    | SlideDoc
    | MediaDoc
    | SettingsDoc
    | ThemeDoc
    | PlaylistDraftDoc
    | SlideDraftDoc;

/** The one theme document; every screen shares it. */
export const THEME_ID = 'theme';

/** The look without a theme document – what every screen had before 1.9. */
export const DEFAULT_THEME: ThemeDoc = v.parse(ThemeDoc, { schema: { ...SCHEMA_VERSION }, kind: 'theme', id: THEME_ID });

export const IMAGE_RATIOS: Record<Exclude<ThemeDoc['imageRatio'], 'free'>, number> = {
    '16:9': 16 / 9,
    '4:3': 4 / 3,
    '3:2': 3 / 2,
    '1:1': 1,
};

/** The schedule document's id for a screen: one per screen, found without a search. */
export function scheduleIdFor(screenId: string): string {
    return `schedule-${screenId}`;
}

/** The playlists a screen shows: the default and those the rules switch to. */
export function playlistIdsOf(screen: ScreenDoc): string[] {
    return [...new Set([screen.defaultPlaylistId, ...screen.schedule.map((r) => r.playlistId)])];
}

export function sameStage(a: { width: number; height: number }, b: { width: number; height: number }): boolean {
    return a.width === b.width && a.height === b.height;
}

/**
 * A playlist as the designer handles it: with a format and a revision. Both are optional in the
 * stored document; a playlist without a format takes that of the screen that shows it.
 */
export function withPlaylistDefaults(
    playlist: PlaylistDoc,
    screens: readonly ScreenDoc[],
): PlaylistDoc & { stage: { width: number; height: number }; revision: number } {
    const users = screens.filter((s) => playlistIdsOf(s).includes(playlist.id));
    return {
        ...playlist,
        stage: playlist.stage ?? { ...(users[0]?.stage ?? STAGE_PRESETS.landscape) },
        revision: playlist.revision ?? 0,
    };
}

/**
 * The screen as it runs: the schedule document, where there is one,
 * overrides default playlist and rules of the screen document. Who saved
 * last is shown from whichever changed later.
 */
export function withSchedule(screen: ScreenDoc, schedule: ScheduleDoc | null | undefined): ScreenDoc {
    if (!schedule || schedule.screenId !== screen.id) return screen;
    const later = (schedule.updatedAt ?? '') >= (screen.updatedAt ?? '');
    return {
        ...screen,
        defaultPlaylistId: schedule.defaultPlaylistId,
        schedule: schedule.rules,
        ...(later ? { updatedAt: schedule.updatedAt, updatedBy: schedule.updatedBy } : {}),
    };
}

function withoutStamp(banner: Banner): Banner {
    const content = { ...banner };
    delete content.updatedAt;
    delete content.updatedBy;
    return content;
}

/** What makes two bands the same notice: everything but the stamp of who changed it last. */
export function bannerKey(banner: Banner): string {
    return JSON.stringify(withoutStamp(banner));
}

/**
 * The band as it is to be stored: a changed or new one carries this save's
 * stamp, an unchanged one keeps the stamp it had – so saving a playlist for a
 * slide does not make its notice look edited.
 */
export function stampBanner(previous: Banner | undefined, next: Banner, updatedBy: string, now: string): Banner {
    if (!previous || bannerKey(previous) !== bannerKey(next)) return { ...withoutStamp(next), updatedAt: now, updatedBy };
    return {
        ...withoutStamp(next),
        ...(previous.updatedAt ? { updatedAt: previous.updatedAt } : {}),
        ...(previous.updatedBy ? { updatedBy: previous.updatedBy } : {}),
    };
}

/** One playlist with its slides – what the editor edits and saves. */
export interface PlaylistBundle {
    playlist: PlaylistDoc & { stage: { width: number; height: number } };
    slides: SlideDoc[];
}

/** Everything that makes up one screen, as the player needs it. */
export interface ScreenBundle {
    screen: ScreenDoc;
    playlists: PlaylistDoc[];
    slides: SlideDoc[];
}

export const STAGE_PRESETS = {
    landscape: { width: 1920, height: 1080 },
    portrait: { width: 1080, height: 1920 },
} as const;
