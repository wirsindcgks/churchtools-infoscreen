import { describe, expect, it } from 'vitest';
import { targetSize } from './scale';

describe('targetSize', () => {
    it('keeps images that fit', () => {
        expect(targetSize(1920, 1080)).toEqual({ width: 1920, height: 1080 });
    });

    it('shrinks a phone photo to 4K on its long edge, keeping the aspect ratio', () => {
        expect(targetSize(4032, 3024)).toEqual({ width: 3840, height: 2880 });
        expect(targetSize(3024, 4032)).toEqual({ width: 2880, height: 3840 });
    });
});
