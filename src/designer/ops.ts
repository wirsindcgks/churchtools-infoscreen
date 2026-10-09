/** Pure editing operations on the data model; the store wires them to history and storage. */
import * as v from 'valibot';
import type { IconName } from './Icon.vue';
import {
    DEFAULT_THEME,
    GroupFields,
    SCHEMA_VERSION,
    STAGE_PRESETS,
    type Banner,
    type Block,
    type BlockType,
    type ScreenBundle,
    type SlideDoc,
    type TextStyle,
    type ThemeDoc,
} from '../model/schema';
import { t } from '../i18n/designer';
import { LOCALE } from '../i18n/player';
import { tr } from '../i18n/repository';

/** Deep copy of plain JSON data; unlike structuredClone it also accepts Vue proxies. */
export function cloneJson<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
}

export function newId(): string {
    return crypto.randomUUID();
}

/** A suggestion for the device address; the designer checks uniqueness on save. */
export function slugify(name: string): string {
    return name
        .toLowerCase()
        .replaceAll('ä', 'ae')
        .replaceAll('ö', 'oe')
        .replaceAll('ü', 'ue')
        .replaceAll('ß', 'ss')
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 64)
        .replace(/-+$/g, '');
}

/** New slides and blocks start in the theme's colours (Plan.md, 27). */
export function createSlide(name = tr.newSlide, theme: ThemeDoc = DEFAULT_THEME): SlideDoc {
    return {
        schema: { ...SCHEMA_VERSION },
        kind: 'slide',
        id: newId(),
        name,
        durationSeconds: 10,
        enabled: true,
        background: { kind: 'solid', color: theme.background },
        blocks: [],
    };
}

export function createScreenBundle(options: {
    name: string;
    slug: string;
    orientation: keyof typeof STAGE_PRESETS;
}): ScreenBundle {
    const slide = createSlide(t.defaults.welcomeSlide);
    const playlistId = newId();
    return {
        screen: {
            schema: { ...SCHEMA_VERSION },
            kind: 'screen',
            id: newId(),
            slug: options.slug,
            name: options.name,
            stage: { ...STAGE_PRESETS[options.orientation] },
            overscanPercent: 0,
            defaultPlaylistId: playlistId,
            schedule: [],
            revision: 0,
        },
        // The new screen's own playlist, named after it; the schedule can later choose any other (schema 1.4).
        playlists: [
            {
                schema: { ...SCHEMA_VERSION },
                kind: 'playlist',
                id: playlistId,
                name: options.name,
                slideIds: [slide.id],
                stage: { ...STAGE_PRESETS[options.orientation] },
                revision: 1,
            },
        ],
        slides: [slide],
    };
}

/** Copies a slide with fresh ids, so that editing the copy never touches the original. */
export function duplicateSlide(slide: SlideDoc): SlideDoc {
    const copy = cloneJson(slide);
    return {
        ...copy,
        id: newId(),
        name: tr.copyOf(slide.name),
        blocks: copy.blocks.map((b) => ({ ...b, id: newId() })),
    };
}

const style = (fontFamily: string, fontSize: number, color: string, extra: Partial<TextStyle> = {}): TextStyle => ({
    fontFamily,
    fontSize,
    fontWeight: 400,
    color,
    align: 'left',
    ...extra,
});

export const BLOCK_LABELS: Record<BlockType, string> = {
    text: t.blocks.text,
    image: t.blocks.image,
    shape: t.blocks.shape,
    clock: t.blocks.clock,
    'appointment-list': t.blocks['appointment-list'],
    'next-appointment': t.blocks['next-appointment'],
    'church-header': t.blocks['church-header'],
    web: t.blocks.web,
    qr: t.blocks.qr,
    countdown: t.blocks.countdown,
    posts: t.blocks.posts,
    groups: t.blocks.groups,
    slideshow: t.blocks.slideshow,
    rooms: t.blocks.rooms,
    video: t.blocks.video,
};

export const BLOCK_ICONS: Record<BlockType, IconName> = {
    text: 'text',
    image: 'image',
    shape: 'shape',
    clock: 'clock',
    'appointment-list': 'list',
    'next-appointment': 'calendar',
    'church-header': 'header',
    web: 'web',
    qr: 'qr',
    countdown: 'timer',
    posts: 'news',
    groups: 'people',
    slideshow: 'slideshow',
    rooms: 'door',
    video: 'video',
};

/** Every block type in German alphabetical order (Plan.md 47): new types find their place by their label. */
export const PALETTE: [BlockType, string][] = (Object.entries(BLOCK_LABELS) as [BlockType, string][]).sort((a, b) =>
    a[1].localeCompare(b[1], LOCALE),
);

export type TextLevel = 'heading' | 'subtitle' | 'body';

/** The three text levels at a stage whose shorter side is 1080 px (Plan.md 79, C8). */
const TEXT_LEVELS_1080: Record<TextLevel, { fontSize: number; fontWeight: 400 | 600 | 700 }> = {
    heading: { fontSize: 96, fontWeight: 700 },
    subtitle: { fontSize: 60, fontWeight: 600 },
    body: { fontSize: 44, fontWeight: 400 },
};

/** Size and weight of each text level, scaled by the shorter side of the stage – the same for landscape and portrait. */
export function textLevels(stage: { width: number; height: number }): Record<TextLevel, { fontSize: number; fontWeight: 400 | 600 | 700 }> {
    const short = Math.min(stage.width, stage.height);
    const level = (l: TextLevel) => ({ fontSize: Math.round((TEXT_LEVELS_1080[l].fontSize * short) / 1080), fontWeight: TEXT_LEVELS_1080[l].fontWeight });
    return { heading: level('heading'), subtitle: level('subtitle'), body: level('body') };
}

/** The level whose size and weight both match exactly, or null. */
export function levelOf(style: { fontSize: number; fontWeight: number }, stage: { width: number; height: number }): TextLevel | null {
    const levels = textLevels(stage);
    return (Object.keys(levels) as TextLevel[]).find((l) => levels[l].fontSize === style.fontSize && levels[l].fontWeight === style.fontWeight) ?? null;
}

/** A new block with sensible defaults, centred on the stage. */
export function createBlock(
    type: BlockType,
    stage: { width: number; height: number },
    calendarIds: number[] = [],
    theme: ThemeDoc = DEFAULT_THEME,
): Block {
    const size = {
        text: [1200, 200],
        image: [800, 450],
        shape: [600, 300],
        clock: [400, 100],
        'appointment-list': [1400, 600],
        'next-appointment': [1400, 600],
        'church-header': [1200, 100],
        web: [1100, 800],
        qr: [360, 360],
        countdown: [1100, 360],
        posts: [1400, 700],
        groups: [1400, 700],
        slideshow: [1200, 675],
        rooms: [1400, 700],
        video: [1280, 720],
    }[type];
    const width = Math.min(size[0]!, stage.width - 80);
    const height = Math.min(size[1]!, stage.height - 80);
    const frame = {
        id: newId(),
        x: Math.round((stage.width - width) / 2),
        y: Math.round((stage.height - height) / 2),
        width,
        height,
    };
    const calendars = calendarIds.length ? calendarIds.slice(0, 3) : [1];
    const ink = theme.text;
    // In the theme's font (Plan.md 40); blocks that exist keep theirs.
    const textStyle = (fontSize: number, extra: Partial<TextStyle> = {}) => style(theme.font, fontSize, ink, extra);
    switch (type) {
        case 'text':
            return { ...frame, type, text: t.blocks.defaultText, style: textStyle(textLevels(stage).heading.fontSize, { fontWeight: textLevels(stage).heading.fontWeight }) };
        case 'image':
            return { ...frame, type, mediaId: '', fit: 'contain' };
        case 'shape':
            return { ...frame, type, fill: { kind: 'solid', color: '#334155' }, cornerRadius: 0 };
        case 'clock':
            return { ...frame, type, format: 'time', style: textStyle(64, { fontWeight: 600, align: 'right' }) };
        case 'appointment-list':
            return { ...frame, type, calendarIds: calendars, horizonDays: 14, limit: 6, showRooms: true, style: textStyle(44) };
        case 'next-appointment':
            return { ...frame, type, calendarIds: calendars, showImage: true, showRooms: true, style: textStyle(64, { fontWeight: 600 }) };
        case 'church-header':
            return { ...frame, type, showLogo: true, showName: true, style: textStyle(48, { fontWeight: 600 }) };
        case 'web':
            return { ...frame, type, url: '', zoom: 1 };
        case 'qr':
            // Dark on light: that is what every phone camera reads, whatever the slide looks like.
            return { ...frame, type, data: '', color: '#111111', background: '#ffffff' };
        case 'countdown':
            return {
                ...frame,
                type,
                calendarIds: calendars,
                showTitle: true,
                runningText: t.blocks.defaultRunningText,
                style: textStyle(120, { fontWeight: 700, align: 'center' }),
            };
        case 'posts':
            return {
                ...frame,
                type,
                groupIds: [],
                limit: 3,
                maxAgeDays: 30,
                layout: 'card',
                showImage: true,
                showAuthor: false,
                style: textStyle(56),
            };
        case 'rooms':
            // No room yet: the inspector offers the ones the designer may see (Plan.md 46).
            return { ...frame, type, rooms: [], layout: 'overview', days: 1, style: textStyle(44) };
        case 'video':
            // No video yet: the inspector offers the library's; sound stays off until switched on (Plan.md 52).
            return { ...frame, type, fit: 'contain', sound: false };
        case 'slideshow':
            return { ...frame, type, mediaIds: [], fit: 'cover', seconds: 6, transition: 'fade', motion: 'none' };
        case 'groups':
            // No homepage yet: the inspector offers them; the leaders stay off until switched on (Plan.md 43).
            return { ...frame, type, groupIds: [], sort: 'weekday', layout: 'card', perPage: 1, show: v.parse(GroupFields, {}), style: textStyle(56) };
    }
}

/** A band for a playlist that has none (Plan.md 32): in the accent colour and the theme's font, at the bottom, running. */
export function createBanner(theme: ThemeDoc = DEFAULT_THEME): Banner {
    return {
        text: '',
        mode: 'scroll',
        position: 'bottom',
        height: 90,
        speed: 140,
        background: theme.accent,
        style: style(theme.font, 48, '#ffffff', { fontWeight: 600 }),
    };
}

/** How far a new block steps down and right when another one already sits on its spot (Plan.md 79, A6). */
export const SPOT_STEP = 40;

/**
 * Where a new block goes so that none lies exactly on another: if a block has the same top left corner, the
 * frame steps 40 px down and right, as often as needed; at the stage edge it starts again at the top left, 40 px in.
 */
export function freeSpot<T extends { x: number; y: number; width: number; height: number }>(
    frame: T,
    blocks: readonly { x: number; y: number }[],
    stage: { width: number; height: number },
): T {
    let { x, y } = frame;
    let wrapped = false;
    while (blocks.some((b) => b.x === x && b.y === y)) {
        x += SPOT_STEP;
        y += SPOT_STEP;
        if (x + frame.width > stage.width || y + frame.height > stage.height) {
            // A second time at the edge: the stage is full of stacked blocks; stay on the corner.
            if (wrapped) return { ...frame, x: SPOT_STEP, y: SPOT_STEP };
            wrapped = true;
            x = SPOT_STEP;
            y = SPOT_STEP;
        }
    }
    return { ...frame, x, y };
}

/** A block that does not fit the stage (copied from landscape to portrait) shrinks in its aspect ratio until it does. */
export function fitToStage<T extends { width: number; height: number }>(frame: T, stage: { width: number; height: number }): T {
    const scale = Math.min(1, stage.width / frame.width, stage.height / frame.height);
    if (scale >= 1) return frame;
    return { ...frame, width: Math.floor(frame.width * scale), height: Math.floor(frame.height * scale) };
}

export const MIN_BLOCK_SIZE = 20;

/**
 * Keeps a frame usable: at least MIN_BLOCK_SIZE, whole pixels, and never
 * entirely off the stage – a block you cannot see you cannot select.
 */
export function clampFrame(
    frame: { x: number; y: number; width: number; height: number },
    stage: { width: number; height: number },
): { x: number; y: number; width: number; height: number } {
    const width = Math.max(MIN_BLOCK_SIZE, Math.round(frame.width));
    const height = Math.max(MIN_BLOCK_SIZE, Math.round(frame.height));
    const keep = MIN_BLOCK_SIZE;
    return {
        width,
        height,
        x: Math.round(Math.min(Math.max(frame.x, keep - width), stage.width - keep)),
        y: Math.round(Math.min(Math.max(frame.y, keep - height), stage.height - keep)),
    };
}

export type Layer = 'front' | 'forward' | 'backward' | 'back';

/** Paint order is array order: later blocks lie on top. */
export function reorder<T>(items: T[], index: number, layer: Layer): T[] {
    const result = [...items];
    const [item] = result.splice(index, 1);
    if (item === undefined) return items;
    const target = {
        front: result.length,
        back: 0,
        forward: Math.min(index + 1, result.length),
        backward: Math.max(index - 1, 0),
    }[layer];
    result.splice(target, 0, item);
    return result;
}

/**
 * The layers of several blocks at once (Plan.md 79, D1): `indices` are the places in `items` that move. To the front or
 * the back they keep their order among themselves; a step forward or back moves each one place, but none passes another
 * chosen block – a group at the top stays where it is when it is sent forward.
 */
export function reorderMany<T>(items: readonly T[], indices: readonly number[], layer: Layer): T[] {
    const chosen = new Set(indices.filter((i) => i >= 0 && i < items.length));
    if (!chosen.size) return [...items];
    if (layer === 'front' || layer === 'back') {
        const picked = items.filter((_, i) => chosen.has(i));
        const rest = items.filter((_, i) => !chosen.has(i));
        return layer === 'front' ? [...rest, ...picked] : [...picked, ...rest];
    }
    const result = [...items];
    const flags = items.map((_, i) => chosen.has(i));
    const swap = (a: number, b: number) => {
        [result[a], result[b]] = [result[b]!, result[a]!];
        [flags[a], flags[b]] = [flags[b]!, flags[a]!];
    };
    if (layer === 'forward') {
        for (let i = result.length - 2; i >= 0; i--) if (flags[i] && !flags[i + 1]) swap(i, i + 1);
    } else {
        for (let i = 1; i < result.length; i++) if (flags[i] && !flags[i - 1]) swap(i, i - 1);
    }
    return result;
}

/** The smallest rectangle around the given frames (Plan.md 79, D3); null for none. */
export function boundingBox(frames: readonly { x: number; y: number; width: number; height: number }[]): { x: number; y: number; width: number; height: number } | null {
    if (!frames.length) return null;
    const left = Math.min(...frames.map((f) => f.x));
    const top = Math.min(...frames.map((f) => f.y));
    const right = Math.max(...frames.map((f) => f.x + f.width));
    const bottom = Math.max(...frames.map((f) => f.y + f.height));
    return { x: left, y: top, width: right - left, height: bottom - top };
}

export function move<T>(items: T[], from: number, to: number): T[] {
    const result = [...items];
    const [item] = result.splice(from, 1);
    if (item === undefined) return items;
    result.splice(Math.max(0, Math.min(to, result.length)), 0, item);
    return result;
}

/** The order of `count` items when `from` is dropped at `to`; items `fixed` keep their place and the others pass them by. */
export function reorderAround(count: number, from: number, to: number, fixed?: (index: number) => boolean): number[] {
    const order = Array.from({ length: count }, (_, i) => i);
    if (from < 0 || from >= count) return order;
    const rest = order.filter((i) => i !== from);
    const target = Math.max(0, Math.min(to, rest.length));
    if (!fixed) {
        rest.splice(target, 0, from);
        return rest;
    }
    // Only the free places are shuffled; the fixed items stay at their index.
    const places = rest.slice(0, target).filter((i) => !fixed(i)).length;
    const free = rest.filter((i) => !fixed(i));
    free.splice(places, 0, from);
    let next = 0;
    return order.map((i) => (fixed(i) ? i : free[next++]!));
}

/** `items` in the order `reorderAround` gives. */
export function moveAround<T>(items: readonly T[], from: number, to: number, fixed?: (index: number) => boolean): T[] {
    return reorderAround(items.length, from, to, fixed).map((i) => items[i]!);
}

/**
 * The block a click on a locked one reaches through to (Plan.md 25): the
 * topmost unlocked block below it at that point of the stage – so a locked
 * picture over others does not block choosing them. Null if there is none.
 */
export function blockBelow(blocks: readonly Block[], clicked: Block, point: { x: number; y: number }): Block | null {
    const index = blocks.findIndex((b) => b.id === clicked.id);
    for (let i = index - 1; i >= 0; i--) {
        const b = blocks[i]!;
        if (!b.locked && point.x >= b.x && point.x <= b.x + b.width && point.y >= b.y && point.y <= b.y + b.height) return b;
    }
    return null;
}
