import { describe, expect, it, vi } from 'vitest';
import { fetchChurchLogoUrl } from '../ct/api';
import type { Block, MediaDoc } from '../model/schema';
import { makeSlide } from '../model/testing';
import { headerLogoUrl, slideImageUrls } from './images';

const BASE = 'https://gemeinde.example';
const TARGET = `${BASE}/images/109/abcdef0123456789abcdef0123456789`;

/** What fetch returns after following /logo – only the fields the code reads. */
function answer(url: string, contentType: string | null, ok = true) {
    return vi.fn(async () => ({ ok, url, headers: new Headers(contentType ? { 'content-type': contentType } : {}) }) as Response);
}

describe('fetchChurchLogoUrl', () => {
    it('takes the redirect target of /logo, without the 150×150 query it carries (G29)', async () => {
        const fetcher = answer(`${TARGET}?fit=contain`, 'image/png');
        await expect(fetchChurchLogoUrl(BASE, fetcher)).resolves.toBe(TARGET);
        expect(fetcher).toHaveBeenCalledWith(`${BASE}/logo`, expect.objectContaining({ credentials: 'omit' }));
    });

    it('treats anything but an image as "no logo" – that answer is unmeasured', async () => {
        await expect(fetchChurchLogoUrl(BASE, answer(`${BASE}/logo`, 'text/html'))).resolves.toBeNull();
        await expect(fetchChurchLogoUrl(BASE, answer(`${BASE}/logo`, null, false))).resolves.toBeNull();
    });

    it('does not take an image from elsewhere for the image service', async () => {
        await expect(fetchChurchLogoUrl(BASE, answer(`${BASE}/system/assets/img/ct-logo.png`, 'image/png'))).resolves.toBeNull();
    });
});

describe('headerLogoUrl', () => {
    const style = { fontFamily: 'sans', fontSize: 40, fontWeight: 400 as const, color: '#fff', align: 'left' as const };
    const header = (overrides: Partial<Extract<Block, { type: 'church-header' }>> = {}) => ({
        id: 'h',
        type: 'church-header' as const,
        x: 0,
        y: 0,
        width: 800,
        height: 100,
        showLogo: true,
        showName: true,
        style,
        ...overrides,
    });
    const own: MediaDoc = {
        schema: { major: 1, minor: 1 },
        kind: 'media',
        id: 'weiss',
        name: 'Logo weiß',
        fileId: 7,
        imageUrl: `${BASE}/images/7/0123456789abcdef0123456789abcdef`,
    };
    const media = new Map([[own.id, own]]);

    it('requests the church logo in the size of the block – /logo alone would give 150×150', () => {
        expect(headerLogoUrl(header(), media, TARGET)).toBe(`${TARGET}?w=800&h=100&fit=max`);
    });

    it('prefers the own library image, for a dark logo on a dark stage', () => {
        expect(headerLogoUrl(header({ logoMediaId: 'weiss' }), media, TARGET)).toContain('/images/7/');
    });

    it('falls back to the church logo when the own image is gone', () => {
        expect(headerLogoUrl(header({ logoMediaId: 'geloescht' }), media, TARGET)).toContain('/images/109/');
    });

    it('asks for nothing when the logo is switched off or there is none', () => {
        expect(headerLogoUrl(header({ showLogo: false }), media, TARGET)).toBeNull();
        expect(headerLogoUrl(header(), media, null)).toBeNull();
    });

    it('puts the logo on the list of images the device keeps (G28)', () => {
        const slide = makeSlide({ blocks: [header()] });
        expect(slideImageUrls(slide, media, { width: 1920, height: 1080 }, TARGET)).toEqual([
            `${TARGET}?w=800&h=100&fit=max`,
        ]);
    });
});
