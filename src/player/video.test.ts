import { describe, expect, it } from 'vitest';
import { videoSrc } from './video';

const url = 'https://ct.example/?q=public/filedownload&id=451&filename=abc';

describe('videoSrc', () => {
    it('takes the download address of the file', () => {
        expect(videoSrc({ fileUrl: url })).toBe(import.meta.env.DEV ? '/?q=public/filedownload&id=451&filename=abc' : url);
    });

    it('has none without an address, or with one that is not http(s)', () => {
        expect(videoSrc(undefined)).toBeNull();
        expect(videoSrc({})).toBeNull();
        expect(videoSrc({ fileUrl: '' })).toBeNull();
        expect(videoSrc({ fileUrl: 'javascript:alert(1)' })).toBeNull();
    });
});
