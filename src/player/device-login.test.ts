import { describe, expect, it } from 'vitest';
import {
    readDeviceLogin,
    rememberDeviceLogin,
    rememberedDeviceLogin,
    withDeviceLogin,
    withoutDeviceLogin,
} from './device-login';

const base = 'https://gemeinde.church.tools/ccm/infoscreen-designer/player?screen=foyer';
const login = { loginToken: 'abc+/=', personId: 22 };

describe('withDeviceLogin', () => {
    it('puts token and person into query and fragment, the screen stays', () => {
        const url = new URL(withDeviceLogin(base, login));
        expect(url.searchParams.get('screen')).toBe('foyer');
        expect(url.searchParams.get('login_token')).toBe('abc+/=');
        expect(url.searchParams.get('user_id')).toBe('22');
        expect(new URLSearchParams(url.hash.slice(1)).get('login_token')).toBe('abc+/=');
    });

    it('replaces an older token instead of adding a second one', () => {
        const once = withDeviceLogin(base, { loginToken: 'alt', personId: 22 });
        const url = new URL(withDeviceLogin(once, login));
        expect(url.searchParams.getAll('login_token')).toEqual(['abc+/=']);
    });
});

describe('readDeviceLogin', () => {
    it('reads the fragment – what is left after ChurchTools took the token out of the query (G9)', () => {
        const afterRedirect = new URL(`${base}&user_id=22#login_token=abc%2B%2F%3D&user_id=22`);
        expect(readDeviceLogin(afterRedirect)).toEqual(login);
    });

    it('falls back to the query, as served in development', () => {
        expect(readDeviceLogin(new URL(`${base}&login_token=t&user_id=5`))).toEqual({ loginToken: 't', personId: 5 });
    });

    it('reads what it wrote', () => {
        expect(readDeviceLogin(new URL(withDeviceLogin(base, login)))).toEqual(login);
    });

    it('has no login without token or with a person that is no number', () => {
        expect(readDeviceLogin(new URL(base))).toBeUndefined();
        expect(readDeviceLogin(new URL(`${base}#login_token=t`))).toBeUndefined();
        expect(readDeviceLogin(new URL(`${base}#login_token=t&user_id=x`))).toBeUndefined();
    });
});

describe('withoutDeviceLogin', () => {
    it('takes token and person out of query and fragment, the screen stays', () => {
        const url = new URL(withoutDeviceLogin(withDeviceLogin(base, login)));
        expect(url.toString()).toBe(base);
        expect(url.hash).toBe('');
    });
});

describe('rememberDeviceLogin', () => {
    it('keeps the login for the next reload of the tab', () => {
        const store = new Map<string, string>();
        const storage = { setItem: (k: string, v: string) => void store.set(k, v), getItem: (k: string) => store.get(k) ?? null };
        rememberDeviceLogin(login, storage);
        expect(rememberedDeviceLogin(storage)).toEqual(login);
    });

    it('does without storage when the browser blocks it', () => {
        const blocked = {
            setItem: () => {
                throw new Error('blocked');
            },
            getItem: () => {
                throw new Error('blocked');
            },
        };
        expect(() => rememberDeviceLogin(login, blocked)).not.toThrow();
        expect(rememberedDeviceLogin(blocked)).toBeUndefined();
    });
});
