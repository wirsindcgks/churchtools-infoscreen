/** Builders for tests. They create data from the types, not from recorded fixtures. */
import { SCHEMA_VERSION, type Block, type ContentBlock, type PlaylistDoc, type ScreenDoc, type SlideDoc, type TemplateDoc } from './schema';

const version = { ...SCHEMA_VERSION };

export function textBlock(id: string, text = 'Willkommen'): ContentBlock {
    return {
        id,
        type: 'text',
        x: 100,
        y: 100,
        width: 800,
        height: 200,
        text,
        style: { fontFamily: 'sans', fontSize: 64, fontWeight: 400, color: '#ffffff', align: 'left' },
    };
}

export function makeSlide(overrides: Partial<SlideDoc> = {}): SlideDoc {
    return {
        schema: version,
        kind: 'slide',
        id: 'slide-1',
        name: 'Begrüßung',
        durationSeconds: 10,
        enabled: true,
        background: { kind: 'solid', color: '#000000' },
        blocks: [],
        ...overrides,
    };
}

export function makePlaylist(overrides: Partial<PlaylistDoc> = {}): PlaylistDoc {
    return { schema: version, kind: 'playlist', id: 'playlist-1', name: 'Standard', slideIds: [], ...overrides };
}

export function makeScreen(overrides: Partial<ScreenDoc> = {}): ScreenDoc {
    return {
        schema: version,
        kind: 'screen',
        id: 'screen-1',
        slug: 'foyer-links',
        name: 'Foyer links',
        stage: { width: 1920, height: 1080 },
        overscanPercent: 0,
        defaultPlaylistId: 'playlist-1',
        schedule: [],
        revision: 0,
        ...overrides,
    };
}

export function makeTemplate(overrides: Partial<TemplateDoc> = {}): TemplateDoc {
    return {
        schema: version,
        kind: 'template',
        id: 'template-1',
        name: 'Seitenkopf',
        stage: { width: 1920, height: 1080 },
        width: 1920,
        height: 200,
        blocks: [],
        revision: 1,
        updatedBy: 'Anna',
        ...overrides,
    };
}

/** A template block as a slide holds it. */
export function templateBlock(id: string, templateId = 'template-1', x = 0, y = 0): Block {
    return { id, type: 'template', templateId, x, y, width: 1920, height: 200 };
}
