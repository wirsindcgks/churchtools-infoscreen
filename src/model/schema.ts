/**
 * The persisted data model: Screen → Playlist → Slides → Blocks (Plan.md, E).
 *
 * Every document is one KV value of at most 10,000 characters and carries its
 * own stable `id`. The server-side value id is a storage detail of the
 * repository; references between documents always use these ids.
 */
import * as v from 'valibot';

/** Bump `major` only for changes an older player cannot survive. */
export const SCHEMA_VERSION = { major: 1, minor: 9 } as const;

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
});

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
});

export const ShapeBlock = v.object({
    ...BlockFrame,
    type: v.literal('shape'),
    fill: Fill,
    cornerRadius: v.optional(v.pipe(v.number(), v.minValue(0)), 0),
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
]);

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
 * for text and background are what new slides and blocks start with.
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
});

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
});

export type Fill = v.InferOutput<typeof Fill>;
export type TextStyle = v.InferOutput<typeof TextStyle>;
export type Block = v.InferOutput<typeof Block>;
export type BlockType = Block['type'];
export type SlideDoc = v.InferOutput<typeof SlideDoc>;
export type PlaylistDoc = v.InferOutput<typeof PlaylistDoc>;
export type ScreenDoc = v.InferOutput<typeof ScreenDoc>;
export type ScheduleDoc = v.InferOutput<typeof ScheduleDoc>;
export type ScheduleRule = v.InferOutput<typeof ScheduleRule>;
export type AppointmentPoint = v.InferOutput<typeof AppointmentPoint>;
export type MediaDoc = v.InferOutput<typeof MediaDoc>;
export type SettingsDoc = v.InferOutput<typeof SettingsDoc>;
export type ThemeDoc = v.InferOutput<typeof ThemeDoc>;
export type AnyDoc = ScreenDoc | PlaylistDoc | ScheduleDoc | SlideDoc | MediaDoc | SettingsDoc | ThemeDoc;

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
 * A playlist as the designer handles it. Before schema 1.4 a playlist had
 * no format and was usually called "Standard": it takes both from the
 * screen that shows it, until the next save stores them.
 */
export function withPlaylistDefaults(
    playlist: PlaylistDoc,
    screens: readonly ScreenDoc[],
): PlaylistDoc & { stage: { width: number; height: number }; revision: number } {
    const users = screens.filter((s) => playlistIdsOf(s).includes(playlist.id));
    const legacyName = !playlist.stage && playlist.name === 'Standard' && users.length === 1;
    return {
        ...playlist,
        name: legacyName ? users[0]!.name : playlist.name,
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
