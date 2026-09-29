import { describe, expect, it, vi } from 'vitest';
import {
    assertAuthenticated,
    ensureSignedIn,
    NotAuthenticatedError,
    personUrl,
    retryAfterMs,
    WrongPersonError,
    type SignInApi,
} from './client';
import type { Person } from './types';

const rateLimited = (headers: Record<string, string> = {}) =>
    Object.assign(new Error('429'), { response: { status: 429, headers } });

describe('personUrl (G18: /persons/{id} shows no person, measured 2026-09-28)', () => {
    it('opens the person view of the instance with the id selected', () => {
        expect(personUrl('https://example.church.tools', 22)).toBe('https://example.church.tools/?q=churchdb#PersonView/searchEntry:#22');
    });
});

describe('retryAfterMs (G16: ChurchTools recommends 60 s after a 429)', () => {
    const now = new Date('2026-09-29T10:00:00Z').getTime();

    it('waits at least 60 s on a 429 without a Retry-After header', () => {
        expect(retryAfterMs(rateLimited(), now)).toBe(60_000);
    });

    it('honours a longer Retry-After in seconds', () => {
        expect(retryAfterMs(rateLimited({ 'retry-after': '120' }), now)).toBe(120_000);
    });

    it('never waits less than 60 s, even with a short Retry-After', () => {
        expect(retryAfterMs(rateLimited({ 'retry-after': '5' }), now)).toBe(60_000);
    });

    it('reads a Retry-After given as an HTTP date', () => {
        const in90s = new Date(now + 90_000).toUTCString();
        expect(retryAfterMs(rateLimited({ 'retry-after': in90s }), now)).toBe(90_000);
    });

    it('is undefined for any other error', () => {
        const serverError = Object.assign(new Error('500'), { response: { status: 500 } });
        expect(retryAfterMs(serverError, now)).toBeUndefined();
    });
});

describe('assertAuthenticated', () => {
    it('accepts a real person', () => {
        const person = { id: 16, firstName: 'Anna', lastName: 'Muster' };
        expect(assertAuthenticated(person)).toBe(person);
    });

    it('rejects the anonymous pseudo person ChurchTools returns with status 200', () => {
        expect(() => assertAuthenticated({ id: -1, firstName: '', lastName: 'Anonymous' })).toThrow(
            NotAuthenticatedError,
        );
    });

    it('rejects a missing response', () => {
        expect(() => assertAuthenticated(undefined)).toThrow(NotAuthenticatedError);
    });
});

describe('ensureSignedIn', () => {
    const person = (id: number): Person => ({ id, firstName: 'Vorname', lastName: 'Nachname' });
    const device = { loginToken: 'token', personId: 22 };

    /** `whoami` answers with the given people in turn; logging in only records the call. */
    function fakeApi(...answers: (Person | Error)[]): SignInApi & { logins: number } {
        const api = {
            logins: 0,
            whoami: vi.fn(async () => {
                const next = answers.shift();
                if (!next) throw new Error('unexpected whoami');
                if (next instanceof Error) throw next;
                return next;
            }),
            loginWithToken: vi.fn(async () => {
                api.logins++;
            }),
        };
        return api;
    }

    it('accepts any real person without a device account', async () => {
        const api = fakeApi(person(5));
        await expect(ensureSignedIn(undefined, api)).resolves.toEqual(person(5));
        expect(api.logins).toBe(0);
    });

    it('does not log in again when the device account is already signed in', async () => {
        const api = fakeApi(person(22));
        await expect(ensureSignedIn(device, api)).resolves.toEqual(person(22));
        expect(api.logins).toBe(0);
    });

    it('replaces a human session left in the kiosk browser by the device account', async () => {
        const api = fakeApi(person(5), person(22));
        await expect(ensureSignedIn(device, api)).resolves.toEqual(person(22));
        expect(api.loginWithToken).toHaveBeenCalledWith('token', 22);
    });

    it('logs in with the token when nobody is signed in', async () => {
        const api = fakeApi(new NotAuthenticatedError(), person(22));
        await expect(ensureSignedIn(device, api)).resolves.toEqual(person(22));
        expect(api.logins).toBe(1);
    });

    it('fails with both ids when the token does not change who is signed in', async () => {
        const api = fakeApi(person(5), person(5));
        const error = await ensureSignedIn(device, api).catch((e: unknown) => e);
        expect(error).toBeInstanceOf(WrongPersonError);
        expect((error as Error).message).toContain('Person 5');
        expect((error as Error).message).toContain('Person 22');
    });

    it('passes network errors through instead of logging in blindly', async () => {
        const api = fakeApi(new Error('Network Error'));
        await expect(ensureSignedIn(device, api)).rejects.toThrow('Network Error');
        expect(api.logins).toBe(0);
    });
});
