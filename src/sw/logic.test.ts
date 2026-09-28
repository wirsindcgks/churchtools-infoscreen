import { describe, expect, it } from 'vitest';
import {
    cacheName,
    classify,
    isPlayerNavigation,
    looksLikePlayerPage,
    pageCacheKey,
    shouldCachePlayerPage,
    type RequestLike,
} from './logic';

const BASE = '/ccm/infoscreen-designer/';
const ORIGIN = 'https://example.church.tools';
const PLAYER_URL = `${ORIGIN}${BASE}player?screen=demo&user_id=22`;

describe('pageCacheKey', () => {
    it('drops the login token', () => {
        expect(pageCacheKey(`${PLAYER_URL}&login_token=geheim`)).toBe(pageCacheKey(PLAYER_URL));
    });

    it('keeps a request without a token unchanged in substance', () => {
        expect(pageCacheKey(PLAYER_URL)).toBe(`${ORIGIN}${BASE}player?screen=demo&user_id=22`);
    });

    it('drops the fragment, which never reaches the server', () => {
        expect(pageCacheKey(`${PLAYER_URL}#login_token=geheim&user_id=22`)).toBe(pageCacheKey(PLAYER_URL));
    });

    it('is independent of the parameter order', () => {
        const swapped = `${ORIGIN}${BASE}player?user_id=22&login_token=geheim&screen=demo`;
        expect(pageCacheKey(swapped)).toBe(pageCacheKey(PLAYER_URL));
    });
});

describe('isPlayerNavigation', () => {
    it('is true for exactly the player path', () => {
        expect(isPlayerNavigation(PLAYER_URL, BASE)).toBe(true);
    });

    it('is false for the designer and for a sub-path', () => {
        expect(isPlayerNavigation(`${ORIGIN}${BASE}`, BASE)).toBe(false);
        expect(isPlayerNavigation(`${ORIGIN}${BASE}player/x`, BASE)).toBe(false);
    });
});

describe('looksLikePlayerPage', () => {
    it('recognises the player page by its own bundle', () => {
        const html = `<html><head><script type="module" src="${BASE}assets/index-abc123.js"></script></head></html>`;
        expect(looksLikePlayerPage(html, BASE)).toBe(true);
    });

    it('does not mistake the ChurchTools login page for it', () => {
        const html = `<html><head><script src="/system/churchcore/base.js?32882"></script></head></html>`;
        expect(looksLikePlayerPage(html, BASE)).toBe(false);
    });
});

function request(overrides: Partial<RequestLike>): RequestLike {
    return { method: 'GET', url: PLAYER_URL, destination: 'document', origin: ORIGIN, clientUrl: null, ...overrides };
}

describe('classify', () => {
    it('is the player page for a navigation to it', () => {
        expect(classify(request({}), BASE)).toBe('player-page');
    });

    it('passes a navigation to the designer', () => {
        expect(classify(request({ url: `${ORIGIN}${BASE}` }), BASE)).toBe('pass');
    });

    it('passes the API', () => {
        expect(
            classify(request({ url: `${ORIGIN}/api/whoami`, destination: '', clientUrl: PLAYER_URL }), BASE),
        ).toBe('pass');
    });

    it('passes the image service', () => {
        expect(
            classify(request({ url: `${ORIGIN}/images/abc`, destination: 'image', clientUrl: PLAYER_URL }), BASE),
        ).toBe('pass');
    });

    it('passes the church logo', () => {
        expect(classify(request({ url: `${ORIGIN}/logo`, destination: 'image', clientUrl: PLAYER_URL }), BASE)).toBe(
            'pass',
        );
    });

    it('passes anything that is not GET', () => {
        expect(classify(request({ method: 'POST' }), BASE)).toBe('pass');
    });

    it('is an own asset when a player page asks for the bundle', () => {
        const script = request({
            url: `${ORIGIN}${BASE}assets/index-abc123.js`,
            destination: 'script',
            clientUrl: PLAYER_URL,
        });
        expect(classify(script, BASE)).toBe('own-asset');
    });

    it('is a host asset for a ChurchTools script requested by a player page', () => {
        const script = request({
            url: `${ORIGIN}/system/churchcore/base.js?32882`,
            destination: 'script',
            clientUrl: PLAYER_URL,
        });
        expect(classify(script, BASE)).toBe('host-asset');
    });

    it('passes the very same ChurchTools script when the designer asked for it', () => {
        const script = request({
            url: `${ORIGIN}/system/churchcore/base.js?32882`,
            destination: 'script',
            clientUrl: `${ORIGIN}${BASE}`,
        });
        expect(classify(script, BASE)).toBe('pass');
    });

    it('passes another origin entirely', () => {
        const script = request({
            url: 'https://fonts.example.com/font.woff2',
            destination: 'font',
            clientUrl: PLAYER_URL,
        });
        expect(classify(script, BASE)).toBe('pass');
    });
});

describe('shouldCachePlayerPage', () => {
    const html = `<script src="${BASE}assets/index-abc123.js"></script>`;

    it('accepts a 200 HTML response that loads the own bundle', () => {
        expect(shouldCachePlayerPage({ status: 200, contentType: 'text/html; charset=utf-8', html }, BASE)).toBe(true);
    });

    it('rejects the login page ChurchTools answers with 200 as well', () => {
        const login = '<script src="/system/churchcore/base.js?32882"></script>';
        expect(shouldCachePlayerPage({ status: 200, contentType: 'text/html', html: login }, BASE)).toBe(false);
    });

    it('rejects a redirect', () => {
        expect(shouldCachePlayerPage({ status: 302, contentType: 'text/html', html }, BASE)).toBe(false);
    });

    it('rejects a non-HTML response', () => {
        expect(shouldCachePlayerPage({ status: 200, contentType: 'application/javascript', html }, BASE)).toBe(false);
    });
});

describe('cacheName', () => {
    it('embeds the version so a new one never reuses an old cache', () => {
        expect(cacheName('0.2.3+abc1234')).not.toBe(cacheName('0.2.4+def5678'));
        expect(cacheName('0.2.3+abc1234')).toContain('0.2.3+abc1234');
    });
});
