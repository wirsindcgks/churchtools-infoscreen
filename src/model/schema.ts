/**
 * The persisted data model: Screen → Playlist → Slides → Blocks (Plan.md, E).
 *
 * Every document is one KV value of at most 10,000 characters and carries its
 * own stable `id`. The server-side value id is a storage detail of the
 * repository; references between documents always use these ids.
 */
import * as v from 'valibot';

/** Bump `major` only for changes an older player cannot survive. */
export const SCHEMA_VERSION = { major: 1, minor: 1 } as const;

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
    limit: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(50)),
    style: TextStyle,
});

export const NextAppointmentBlock = v.object({
    ...BlockFrame,
    type: v.literal('next-appointment'),
    calendarIds: v.pipe(v.array(v.pipe(v.number(), v.integer())), v.minLength(1)),
    showImage: v.optional(v.boolean(), true),
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

export const Block = v.variant('type', [
    TextBlock,
    ImageBlock,
    ShapeBlock,
    ClockBlock,
    AppointmentListBlock,
    NextAppointmentBlock,
    ChurchHeaderBlock,
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

export const PlaylistDoc = v.object({
    ...DocumentBase,
    kind: v.literal('playlist'),
    name: v.pipe(v.string(), v.maxLength(100)),
    slideIds: v.array(Id),
});

/** A schedule rule; the editor for it comes after the MVP (Plan.md, Playlists und Zeitpläne). */
export const ScheduleRule = v.variant('kind', [
    v.object({
        kind: v.literal('appointment'),
        playlistId: Id,
        calendarIds: v.pipe(v.array(v.pipe(v.number(), v.integer())), v.minLength(1)),
        minutesBefore: v.pipe(v.number(), v.integer(), v.minValue(0)),
        minutesAfter: v.pipe(v.number(), v.integer(), v.minValue(0)),
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
    stage: v.object({ width: PositivePx, height: PositivePx }),
    overscanPercent: v.optional(v.pipe(v.number(), v.minValue(0), v.maxValue(20)), 0),
    /** Mandatory: "no rule matches" must never mean a black screen. */
    defaultPlaylistId: Id,
    /** Earlier rules win on overlap. */
    schedule: v.optional(v.array(ScheduleRule), []),
    revision: v.pipe(v.number(), v.integer(), v.minValue(0)),
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
export type ScheduleRule = v.InferOutput<typeof ScheduleRule>;
export type MediaDoc = v.InferOutput<typeof MediaDoc>;
export type SettingsDoc = v.InferOutput<typeof SettingsDoc>;
export type AnyDoc = ScreenDoc | PlaylistDoc | SlideDoc | MediaDoc | SettingsDoc;

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
