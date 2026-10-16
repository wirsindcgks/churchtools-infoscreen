import { describe, expect, it } from 'vitest';
import { serialize } from '../model/read';
import type { ContentBlock } from '../model/schema';
import { makeSlide, makeTemplate, templateBlock, textBlock } from '../model/testing';
import { dissolveTemplate, templateFromBlocks, withTemplateFrames } from './templates';

const stage = { width: 1920, height: 1080 };
const at = (id: string, x: number, y: number, width = 100, height = 50, extra: Partial<ContentBlock> = {}): ContentBlock =>
    ({ ...textBlock(id), x, y, width, height, ...extra }) as ContentBlock;

describe('withTemplateFrames', () => {
    it('gives the template blocks the frame of their template and leaves a missing template alone', () => {
        const slide = makeSlide({ blocks: [templateBlock('a', 'known'), templateBlock('b', 'gone'), textBlock('t')] });
        const byId = new Map([['known', makeTemplate({ id: 'known', width: 800, height: 120 })]]);
        const framed = withTemplateFrames(slide, byId);
        expect(framed.blocks[0]).toMatchObject({ width: 800, height: 120 });
        expect(framed.blocks[1]).toBe(slide.blocks[1]);
        expect(framed.blocks[2]).toBe(slide.blocks[2]);
        expect(slide.blocks[0]).toMatchObject({ width: 1920, height: 200 });
    });

    it('shows the block of a template fixed in place as locked, without writing it', () => {
        const slide = makeSlide({ blocks: [templateBlock('a', 'fixed'), templateBlock('b', 'free')] });
        const byId = new Map([
            ['fixed', makeTemplate({ id: 'fixed', locked: true })],
            ['free', makeTemplate({ id: 'free' })],
        ]);
        const framed = withTemplateFrames(slide, byId);
        expect(framed.blocks[0]).toMatchObject({ locked: true });
        expect(framed.blocks[1]).not.toHaveProperty('locked');
        expect(slide.blocks[0]).not.toHaveProperty('locked');
    });

    it('returns the same slide without a template block', () => {
        const slide = makeSlide({ blocks: [textBlock('t')] });
        expect(withTemplateFrames(slide, new Map())).toBe(slide);
    });
});

describe('templateFromBlocks', () => {
    it('frames the blocks, puts them relative to the corner and keeps the paint order', () => {
        const blocks = [at('a', 300, 100, 200, 50), at('b', 100, 200, 100, 100)];
        const made = templateFromBlocks(blocks, stage, ' Kopf ');
        expect(made).toMatchObject({ name: 'Kopf', stage, x: 100, y: 100, width: 400, height: 200 });
        expect(made.blocks.map((b) => [b.id, b.x, b.y])).toEqual([['a', 200, 0], ['b', 0, 100]]);
        expect(blocks[0]!.x).toBe(300);
        expect(() => serialize({ ...makeTemplate(), ...made, revision: 1, updatedBy: 'x' } as never)).not.toThrow();
    });

    it('counts a turned block by its outer box', () => {
        const made = templateFromBlocks([at('a', 100, 100, 200, 100, { rotation: 90 })], stage, 'Gedreht');
        // 200 x 100 turned by 90 degrees fills 100 x 200 around the same middle (200, 150).
        expect(made).toMatchObject({ x: 150, y: 50, width: 100, height: 200 });
        expect(made.blocks[0]).toMatchObject({ x: -50, y: 50, rotation: 90 });
    });

    it('keeps groups and dissolves a group of one', () => {
        const made = templateFromBlocks([at('a', 0, 0, 10, 10, { groupId: 'g' }), at('b', 20, 0, 10, 10, { groupId: 'g' }), at('c', 40, 0, 10, 10, { groupId: 'h' })], stage, 'G');
        expect(made.blocks.map((b) => b.groupId)).toEqual(['g', 'g', undefined]);
    });

    it('cuts a long name', () => {
        expect(templateFromBlocks([at('a', 0, 0)], stage, 'x'.repeat(60)).name).toHaveLength(40);
    });
});

describe('dissolveTemplate', () => {
    it('makes own blocks with new ids, moved to the template block, as one group', () => {
        const template = makeTemplate({ blocks: [at('a', 0, 0, 10, 10, { groupId: 'old' }), at('b', 50, 20, 10, 10)] });
        const copies = dissolveTemplate({ x: 100, y: 200 }, template);
        expect(copies.map((b) => [b.x, b.y])).toEqual([[100, 200], [150, 220]]);
        expect(copies.map((b) => b.id)).not.toContain('a');
        expect(new Set(copies.map((b) => b.id)).size).toBe(2);
        expect(copies[0]!.groupId).toBeTruthy();
        expect(copies[0]!.groupId).toBe(copies[1]!.groupId);
        expect(copies[0]!.groupId).not.toBe('old');
        expect(template.blocks[0]!.id).toBe('a');
    });

    it('makes no group of one block', () => {
        const copies = dissolveTemplate({ x: 0, y: 0 }, makeTemplate({ blocks: [at('a', 0, 0, 10, 10, { groupId: 'old' })] }));
        expect(copies).toHaveLength(1);
        expect(copies[0]!.groupId).toBeUndefined();
    });
});
