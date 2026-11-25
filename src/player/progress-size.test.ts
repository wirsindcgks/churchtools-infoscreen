import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PROGRESS_FONT_PX, PROGRESS_PAD_PX, progressReserve } from './progress-size';

describe('progress size', () => {
    it('keeps the list pager CSS at the shared font size', () => {
        const css = readFileSync(resolve(process.cwd(), 'src/player/blocks/pager.css'), 'utf8');
        expect(css).toContain(`font-size: ${PROGRESS_FONT_PX}px;`);
        // The air under and right of the number, in em of the same font, is what the reserve counts as PROGRESS_PAD_PX.
        const padEm = Math.round((PROGRESS_PAD_PX / PROGRESS_FONT_PX) * 100) / 100;
        expect(css).toContain(`padding: 0 ${padEm}em ${padEm}em 0;`);
    });

    it('keeps the bar of the whole presentation at the shared font size', () => {
        const vue = readFileSync(resolve(process.cwd(), 'src/player/ProgressBar.vue'), 'utf8');
        expect(vue).toContain(`font-size: ${PROGRESS_FONT_PX}px;`);
    });

    it('keeps less room for the edge line than for the bar with the number', () => {
        expect(progressReserve(true)).toBe(16);
        // Number line, the air under it and the air over it.
        expect(progressReserve(false)).toBeCloseTo(38.8);
    });
});
