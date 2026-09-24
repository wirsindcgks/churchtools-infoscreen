import { describe, expect, it } from 'vitest';
import { serialize } from '../model/read';
import { textBlock, makeSlide } from '../model/testing';
import { BLOCK_LABELS, clampFrame, createBlock, createScreenBundle, duplicateSlide, move, reorder, slugify } from './ops';
import { History } from './history';
import type { BlockType } from '../model/schema';

const stage = { width: 1920, height: 1080 };

describe('designer operations', () => {
    it('suggests readable slugs', () => {
        expect(slugify('Foyer – Große Leinwand')).toBe('foyer-grosse-leinwand');
        expect(slugify('  Café Süd ')).toBe('cafe-sued');
    });

    it('creates a new screen that is valid to store', () => {
        const bundle = createScreenBundle({ name: 'Foyer', slug: 'foyer', orientation: 'portrait' });
        expect(bundle.screen.stage).toEqual({ width: 1080, height: 1920 });
        expect(bundle.playlists[0]?.slideIds).toEqual([bundle.slides[0]?.id]);
        expect(() => [bundle.screen, ...bundle.playlists, ...bundle.slides].forEach(serialize)).not.toThrow();
    });

    it('creates every block type valid and on the stage', () => {
        for (const type of Object.keys(BLOCK_LABELS) as BlockType[]) {
            const block = createBlock(type, stage, [2]);
            expect(() => serialize(makeSlide({ blocks: [block] }))).not.toThrow();
            expect(block.x + block.width).toBeLessThanOrEqual(stage.width);
        }
    });

    it('duplicates a slide with fresh ids', () => {
        const original = makeSlide({ blocks: [textBlock('a')] });
        const copy = duplicateSlide(original);
        expect(copy.id).not.toBe(original.id);
        expect(copy.blocks[0]?.id).not.toBe('a');
        expect(copy.name).toContain('Kopie');
    });

    it('never lets a block vanish from the stage or shrink to nothing', () => {
        expect(clampFrame({ x: 5000, y: -5000, width: 3.4, height: 100 }, stage)).toEqual({
            x: 1900,
            y: -80,
            width: 20,
            height: 100,
        });
    });

    it('changes paint order', () => {
        expect(reorder(['a', 'b', 'c'], 0, 'front')).toEqual(['b', 'c', 'a']);
        expect(reorder(['a', 'b', 'c'], 2, 'back')).toEqual(['c', 'a', 'b']);
        expect(reorder(['a', 'b', 'c'], 1, 'forward')).toEqual(['a', 'c', 'b']);
        expect(reorder(['a', 'b', 'c'], 1, 'backward')).toEqual(['b', 'a', 'c']);
    });

    it('moves list items', () => {
        expect(move(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a']);
        expect(move(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b']);
    });
});

describe('History', () => {
    it('undoes and redoes snapshots', () => {
        const history = new History<{ n: number }>();
        let state = { n: 1 };
        history.record(state);
        state = { n: 2 };
        state = history.undo(state)!;
        expect(state).toEqual({ n: 1 });
        state = history.redo(state)!;
        expect(state).toEqual({ n: 2 });
    });

    it('drops the redo branch after a new change', () => {
        const history = new History<number>();
        history.record(1);
        history.undo(2);
        history.record(1);
        expect(history.canRedo).toBe(false);
    });

    it('is not affected by later mutation of a recorded object', () => {
        const history = new History<{ n: number }>();
        const state = { n: 1 };
        history.record(state);
        state.n = 5;
        expect(history.undo(state)).toEqual({ n: 1 });
    });

    it('keeps a bounded number of steps', () => {
        const history = new History<number>(2);
        [1, 2, 3].forEach((n) => history.record(n));
        expect(history.undo(4)).toBe(3);
        expect(history.undo(3)).toBe(2);
        expect(history.undo(2)).toBeNull();
    });
});
