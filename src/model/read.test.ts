import { describe, expect, it } from 'vitest';
import {
    InvalidDocumentError,
    MAX_VALUE_LENGTH,
    readScreen,
    readSlide,
    readTheme,
    SchemaTooNewError,
    serialize,
    ValueTooLargeError,
} from './read';
import { DEFAULT_FONT } from '../player/fonts';
import { SCHEMA_VERSION, THEME_ID } from './schema';
import { makeSlide, makeScreen, textBlock } from './testing';

describe('readSlide – tolerant towards newer data', () => {
    it('skips a block of an unknown type and keeps the rest', () => {
        const raw = { ...makeSlide(), blocks: [textBlock('a'), { id: 'x', type: 'hologram', x: 0 }, textBlock('b')] };
        const { doc, issues } = readSlide(raw);
        expect(doc.blocks.map((b) => b.id)).toEqual(['a', 'b']);
        expect(issues).toHaveLength(1);
        expect(issues[0]?.message).toContain('hologram');
    });

    it('ignores unknown fields on slides and blocks', () => {
        const raw = { ...makeSlide(), sparkle: true, blocks: [{ ...textBlock('a'), glow: 3 }] };
        const { doc, issues } = readSlide(raw);
        expect(issues).toEqual([]);
        expect(doc).not.toHaveProperty('sparkle');
        expect(doc.blocks[0]).not.toHaveProperty('glow');
    });

    it('skips a known block with broken fields instead of failing the slide', () => {
        const raw = { ...makeSlide(), blocks: [{ ...textBlock('a'), width: 'breit' }, textBlock('b')] };
        const { doc, issues } = readSlide(raw);
        expect(doc.blocks.map((b) => b.id)).toEqual(['b']);
        expect(issues[0]?.message).toContain('width');
    });

    it('accepts a newer minor version', () => {
        const raw = { ...makeSlide(), schema: { major: 1, minor: 7 } };
        expect(readSlide(raw).doc.id).toBe(raw.id);
    });

    it('refuses a newer major version so the player can reload', () => {
        expect(() => readSlide({ ...makeSlide(), schema: { major: 2, minor: 0 } })).toThrow(SchemaTooNewError);
        expect(() => readScreen({ ...makeScreen(), schema: { major: 2, minor: 0 } })).toThrow(SchemaTooNewError);
    });

    it('fills defaults for optional fields', () => {
        const raw = makeSlide();
        delete (raw as { enabled?: boolean }).enabled;
        expect(readSlide(raw).doc.enabled).toBe(true);
    });

    it('reads a minimal posts block with its defaults (schema 1.11, Plan.md 33)', () => {
        const block = {
            id: 'p',
            type: 'posts',
            x: 0,
            y: 0,
            width: 1400,
            height: 700,
            groupIds: [],
            limit: 3,
            style: { fontFamily: 'sans', fontSize: 56, fontWeight: 400, color: '#fff', align: 'left' },
        };
        const { doc, issues } = readSlide({ ...makeSlide(), blocks: [block] });
        expect(issues).toEqual([]);
        expect(doc.blocks[0]).toMatchObject({
            maxAgeDays: 30,
            layout: 'card',
            showImage: true,
            showAuthor: false,
        });
    });

    it('reads a minimal groups block with its defaults – leaders off (schema 1.14, Plan.md 43)', () => {
        const block = {
            id: 'g',
            type: 'groups',
            x: 0,
            y: 0,
            width: 1400,
            height: 700,
            groupIds: [],
            style: { fontFamily: 'sans', fontSize: 56, fontWeight: 400, color: '#fff', align: 'left' },
        };
        const { doc, issues } = readSlide({ ...makeSlide(), blocks: [block, { ...block, id: 'h', show: { leaders: true, qr: false } }] });
        expect(issues).toEqual([]);
        expect(doc.blocks[0]).toMatchObject({
            layout: 'card',
            show: { name: true, image: true, when: true, targetGroup: true, category: true, note: true, leaders: false, places: true, qr: true },
        });
        expect(doc.blocks[0]).not.toHaveProperty('parentGroupId');
        expect(doc.blocks[1]).toMatchObject({ show: { name: true, leaders: true, qr: false } });
    });
});

describe('readSlide – slideshow block (schema 1.15, Plan.md 46)', () => {
    const slideshow = { id: 'd', type: 'slideshow', x: 0, y: 0, width: 1200, height: 675, mediaIds: ['a', 'b'] };

    it('reads a minimal slideshow with its defaults', () => {
        const { doc, issues } = readSlide({ ...makeSlide(), blocks: [slideshow, { ...slideshow, id: 'e', mediaIds: [] }] });
        expect(issues).toEqual([]);
        expect(doc.blocks[0]).toMatchObject({ mediaIds: ['a', 'b'], fit: 'cover', seconds: 6, transition: 'fade' });
        expect(doc.blocks[1]).toMatchObject({ mediaIds: [] });
    });

    it('skips a slideshow with more than 30 images, with an issue', () => {
        const many = Array.from({ length: 31 }, (_, i) => `m${i}`);
        const ok = Array.from({ length: 30 }, (_, i) => `m${i}`);
        const { doc, issues } = readSlide({ ...makeSlide(), blocks: [{ ...slideshow, mediaIds: many }, { ...slideshow, id: 'e', mediaIds: ok }] });
        expect(doc.blocks.map((b) => b.id)).toEqual(['e']);
        expect(issues).toHaveLength(1);
    });

    it('reads the five transitions and skips a slideshow with an unknown one', () => {
        for (const transition of ['fade', 'slide', 'wipe', 'zoom', 'none']) {
            const { doc, issues } = readSlide({ ...makeSlide(), blocks: [{ ...slideshow, transition }] });
            expect(issues).toEqual([]);
            expect(doc.blocks[0]).toMatchObject({ transition });
        }
        const { doc, issues } = readSlide({ ...makeSlide(), blocks: [{ ...slideshow, transition: 'spin' }] });
        expect(doc.blocks).toEqual([]);
        expect(issues).toHaveLength(1);
    });

    it('skips a slideshow with seconds outside 3 to 60', () => {
        for (const seconds of [2, 61]) {
            const { doc, issues } = readSlide({ ...makeSlide(), blocks: [{ ...slideshow, seconds }] });
            expect(doc.blocks).toEqual([]);
            expect(issues).toHaveLength(1);
        }
    });
});

describe('readTheme – the font new blocks start with (schema 1.13, Plan.md 40)', () => {
    const theme = { schema: { major: 1, minor: 12 }, kind: 'theme', id: THEME_ID };

    it('reads a theme from before 1.13 with Lato, the font new blocks had until then', () => {
        expect(readTheme(theme).font).toBe('lato');
        expect(readTheme(theme).font).toBe(DEFAULT_FONT);
    });

    it('keeps a font key it does not know; drawing falls back, saving does not lose it', () => {
        expect(readTheme({ ...theme, schema: { ...SCHEMA_VERSION }, font: 'comic-neue' }).font).toBe('comic-neue');
    });
});

describe('serialize – strict towards what we write', () => {
    it('rejects an invalid document', () => {
        expect(() => serialize({ ...makeScreen(), slug: 'Foyer Links' })).toThrow(InvalidDocumentError);
    });

    it('rejects a document over the 10,000 character limit before anything is written', () => {
        const slide = makeSlide({ blocks: [textBlock('a', 'x'.repeat(MAX_VALUE_LENGTH))] });
        expect(() => serialize(slide)).toThrow(ValueTooLargeError);
    });

    it('round-trips a valid document', () => {
        const slide = makeSlide({ blocks: [textBlock('a')] });
        expect(readSlide(JSON.parse(serialize(slide))).doc).toEqual(slide);
    });
});

describe('readSlide – rooms block (schema 1.16, Plan.md 46)', () => {
    const rooms = { id: 'r', type: 'rooms', x: 0, y: 0, width: 1400, height: 700, rooms: [], style: { fontFamily: 'sans', fontSize: 44, color: '#fff' } };

    it('reads an empty block with its defaults, and a room with its defaults', () => {
        const { doc, issues } = readSlide({ ...makeSlide(), blocks: [rooms, { ...rooms, id: 's', rooms: [{ resourceId: 3 }] }] });
        expect(issues).toEqual([]);
        expect(doc.blocks[0]).toMatchObject({ rooms: [], layout: 'overview', days: 1 });
        expect(doc.blocks[0]).not.toHaveProperty('pageSeconds');
        expect(doc.blocks[1]).toMatchObject({ rooms: [{ resourceId: 3, hint: '', showTitles: true }] });
    });

    it('skips a block with more than 30 rooms, with an issue', () => {
        const many = Array.from({ length: 31 }, (_, i) => ({ resourceId: i + 1 }));
        const ok = Array.from({ length: 30 }, (_, i) => ({ resourceId: i + 1 }));
        const { doc, issues } = readSlide({ ...makeSlide(), blocks: [{ ...rooms, rooms: many }, { ...rooms, id: 's', rooms: ok }] });
        expect(doc.blocks.map((b) => b.id)).toEqual(['s']);
        expect(issues).toHaveLength(1);
    });

    it('takes days 1 and 2 only, and the two layouts only', () => {
        for (const days of [0, 3]) expect(readSlide({ ...makeSlide(), blocks: [{ ...rooms, days }] }).doc.blocks).toEqual([]);
        expect(readSlide({ ...makeSlide(), blocks: [{ ...rooms, days: 2, layout: 'door' }] }).doc.blocks[0]).toMatchObject({ days: 2, layout: 'door' });
        expect(readSlide({ ...makeSlide(), blocks: [{ ...rooms, layout: 'grid' }] }).doc.blocks).toEqual([]);
    });

    it('skips a block whose way-finder is longer than 100 characters', () => {
        const { doc, issues } = readSlide({ ...makeSlide(), blocks: [{ ...rooms, rooms: [{ resourceId: 1, hint: 'x'.repeat(101) }] }] });
        expect(doc.blocks).toEqual([]);
        expect(issues).toHaveLength(1);
    });
});
