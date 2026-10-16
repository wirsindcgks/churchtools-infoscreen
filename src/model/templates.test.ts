import { describe, expect, it } from 'vitest';
import type { TemplateDoc } from './schema';
import { expandTemplates, templateIdsOf } from './templates';
import { makeSlide, makeTemplate, templateBlock, textBlock } from './testing';

const head = makeTemplate({ blocks: [{ ...textBlock('title'), x: 10, y: 20 }, { ...textBlock('clock'), x: 500, y: 40, groupId: 'g' }] });
const templates = new Map<string, TemplateDoc>([[head.id, head]]);

describe('expandTemplates (Plan.md 87)', () => {
    it('moves the blocks of the template by the position of the block', () => {
        const slide = makeSlide({ blocks: [templateBlock('kopf', 'template-1', 100, 50)] });
        const [title, clock] = expandTemplates(slide, templates).blocks;
        expect([title?.x, title?.y]).toEqual([110, 70]);
        expect([clock?.x, clock?.y]).toEqual([600, 90]);
    });

    it('keeps the place in the paint order', () => {
        const slide = makeSlide({ blocks: [textBlock('unten'), templateBlock('kopf'), textBlock('oben')] });
        expect(expandTemplates(slide, templates).blocks.map((b) => b.id)).toEqual(['unten', 'kopf/title', 'kopf/clock', 'oben']);
    });

    it('drops the block of a template that is missing', () => {
        const slide = makeSlide({ blocks: [textBlock('a'), templateBlock('kopf', 'weg')] });
        expect(expandTemplates(slide, templates).blocks.map((b) => b.id)).toEqual(['a']);
    });

    it('composes the ids and the group id', () => {
        const slide = makeSlide({ blocks: [templateBlock('kopf')] });
        const [title, clock] = expandTemplates(slide, templates).blocks;
        expect(title?.id).toBe('kopf/title');
        expect(title?.groupId).toBeUndefined();
        expect(clock?.groupId).toBe('kopf/g');
    });

    it('ignores width, height, rotation, opacity and lock of the template block', () => {
        const odd = { ...templateBlock('kopf'), width: 5, height: 7, rotation: 45, opacity: 10, locked: true };
        const [title] = expandTemplates(makeSlide({ blocks: [odd] }), templates).blocks;
        expect(title).toMatchObject({ width: 800, height: 200 });
        expect(title).not.toHaveProperty('rotation');
        expect(title).not.toHaveProperty('locked');
    });

    it('returns the very same slide without a template block', () => {
        const slide = makeSlide({ blocks: [textBlock('a')] });
        expect(expandTemplates(slide, templates)).toBe(slide);
    });

    it('names the templates a slide uses, once each', () => {
        const slide = makeSlide({ blocks: [templateBlock('a', 'x'), textBlock('t'), templateBlock('b', 'y'), templateBlock('c', 'x')] });
        expect(templateIdsOf(slide)).toEqual(['x', 'y']);
        expect(templateIdsOf(makeSlide())).toEqual([]);
    });
});
