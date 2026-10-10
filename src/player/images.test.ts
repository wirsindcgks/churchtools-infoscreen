import { describe, expect, it } from 'vitest';
import type { Block, MediaDoc } from '../model/schema';
import { makeSlide } from '../model/testing';
import { blockImageUrl, slideImageUrls } from './images';

const medium: MediaDoc = { schema: { major: 1, minor: 0 }, kind: 'media', id: 'm1', name: 'Plakat', fileId: 46, imageUrl: 'https://example.church.tools/images/46/hash' };
const sized = (w: number, h: number) => `https://example.church.tools/images/46/hash?w=${w}&h=${h}&fit=max`;

describe('blockImageUrl with a crop (Plan.md F2)', () => {
    it('asks for the frame size without a crop and at "Ganz zeigen"', () => {
        expect(blockImageUrl(medium, { width: 960, height: 540 })).toBe(sized(960, 540));
        expect(blockImageUrl(medium, { width: 960, height: 540, fit: 'contain', crop: { zoom: 2 } })).toBe(sized(960, 540));
    });

    it('multiplies the frame by the zoom at "Füllen"', () => {
        expect(blockImageUrl(medium, { width: 600, height: 400, fit: 'cover', crop: { zoom: 2 } })).toBe(sized(1200, 800));
    });

    it('shrinks in proportion until no side is over 1920', () => {
        expect(blockImageUrl(medium, { width: 1920, height: 1080, fit: 'cover', crop: { zoom: 3 } })).toBe(sized(1920, 1080));
        expect(blockImageUrl(medium, { width: 1000, height: 1500, fit: 'cover', crop: { zoom: 2 } })).toBe(sized(1280, 1920));
    });

    it('is the address the slide asks to keep, for the picture with the zoom and for the gallery without', () => {
        const image = { id: 'i', type: 'image' as const, x: 0, y: 0, width: 600, height: 400, mediaId: 'm1', fit: 'cover' as const, crop: { x: 50, y: 50, zoom: 2 } };
        const gallery = { id: 'g', type: 'slideshow', x: 0, y: 0, width: 600, height: 400, mediaIds: ['m1'] } as Block;
        const urls = slideImageUrls(makeSlide({ blocks: [image as Block, gallery] }), new Map([['m1', medium]]), { width: 1920, height: 1080 });
        expect(urls).toEqual([blockImageUrl(medium, image), sized(600, 400)]);
        expect(urls[0]).toBe(sized(1200, 800));
    });
});
