/** Pure editing operations on the data model; the store wires them to history and storage. */
import {
    SCHEMA_VERSION,
    STAGE_PRESETS,
    type Block,
    type BlockType,
    type ScreenBundle,
    type SlideDoc,
    type TextStyle,
} from '../model/schema';
import { DEFAULT_FONT } from '../player/fonts';

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

export function createSlide(name = 'Neue Slide'): SlideDoc {
    return {
        schema: { ...SCHEMA_VERSION },
        kind: 'slide',
        id: newId(),
        name,
        durationSeconds: 10,
        enabled: true,
        background: { kind: 'solid', color: '#1e293b' },
        blocks: [],
    };
}

export function createScreenBundle(options: {
    name: string;
    slug: string;
    orientation: keyof typeof STAGE_PRESETS;
}): ScreenBundle {
    const slide = createSlide('Willkommen');
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
        name: `${slide.name} (Kopie)`,
        blocks: copy.blocks.map((b) => ({ ...b, id: newId() })),
    };
}

const style = (fontSize: number, extra: Partial<TextStyle> = {}): TextStyle => ({
    fontFamily: DEFAULT_FONT,
    fontSize,
    fontWeight: 400,
    color: '#ffffff',
    align: 'left',
    ...extra,
});

export const BLOCK_LABELS: Record<BlockType, string> = {
    text: 'Text',
    image: 'Bild',
    shape: 'Fläche',
    clock: 'Uhr',
    'appointment-list': 'Terminliste',
    'next-appointment': 'Nächster Termin',
    'church-header': 'Gemeindekopf',
};

/** A new block with sensible defaults, centred on the stage. */
export function createBlock(type: BlockType, stage: { width: number; height: number }, calendarIds: number[] = []): Block {
    const size = {
        text: [1200, 200],
        image: [800, 450],
        shape: [600, 300],
        clock: [400, 100],
        'appointment-list': [1400, 600],
        'next-appointment': [1400, 600],
        'church-header': [1200, 100],
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
    switch (type) {
        case 'text':
            return { ...frame, type, text: 'Text', style: style(72) };
        case 'image':
            return { ...frame, type, mediaId: '', fit: 'contain' };
        case 'shape':
            return { ...frame, type, fill: { kind: 'solid', color: '#334155' }, cornerRadius: 0 };
        case 'clock':
            return { ...frame, type, format: 'time', style: style(64, { fontWeight: 600, align: 'right' }) };
        case 'appointment-list':
            return { ...frame, type, calendarIds: calendars, horizonDays: 14, limit: 6, style: style(44) };
        case 'next-appointment':
            return { ...frame, type, calendarIds: calendars, showImage: true, style: style(64, { fontWeight: 600 }) };
        case 'church-header':
            return { ...frame, type, showLogo: true, showName: true, style: style(48, { fontWeight: 600 }) };
    }
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

export function move<T>(items: T[], from: number, to: number): T[] {
    const result = [...items];
    const [item] = result.splice(from, 1);
    if (item === undefined) return items;
    result.splice(Math.max(0, Math.min(to, result.length)), 0, item);
    return result;
}
