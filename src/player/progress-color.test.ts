import { describe, expect, it } from 'vitest';
import { gradientBottomColor, progressTextColor } from './progress-color';

const gradient = (angle: number) => ({ kind: 'linear-gradient' as const, angle, stops: [{ color: '#ffffff', at: 0 }, { color: '#000000', at: 1 }] });

describe('progressTextColor (Plan.md 109)', () => {
    it('is dark on a light colour and white on a dark one', () => {
        expect(progressTextColor({ kind: 'solid', color: '#ffffff' })).toEqual({ color: '#111827', shadow: false });
        expect(progressTextColor({ kind: 'solid', color: '#101820' })).toEqual({ color: '#ffffff', shadow: false });
    });

    it('follows the colour at the bottom of a gradient', () => {
        expect(gradientBottomColor(gradient(180))).toBe('#000000');
        expect(gradientBottomColor(gradient(0))).toBe('#ffffff');
        expect(progressTextColor(gradient(180)).color).toBe('#ffffff');
        expect(progressTextColor(gradient(0)).color).toBe('#111827');
    });

    it('is white with a shadow on a picture or video', () => {
        expect(progressTextColor({ kind: 'media', mediaId: 'm1' })).toEqual({ color: '#ffffff', shadow: true });
    });
});
