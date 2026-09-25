import { describe, expect, it } from 'vitest';
import {
    InvalidDocumentError,
    MAX_VALUE_LENGTH,
    readScreen,
    readSlide,
    SchemaTooNewError,
    serialize,
    ValueTooLargeError,
} from './read';
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
