import { describe, expect, it } from 'vitest';
import { grantLocked, isLocked, LockedPermissionError, lockedAuthId, withLockNames, bindingLocks } from './locks';
import type { ProvisionApi } from './provision';

/** The refusal as ChurchTools 3.138 sends it (G80). */
const refusal = (id: number, model = 'locked permission') => ({
    response: {
        status: 403,
        data: { message: 'Forbidden to update locked permission[403].', messageKey: 'error.forbidden.update', args: { model, id }, errors: [] },
    },
});

describe('isLocked and grantLocked (G80)', () => {
    const locks = [{ authId: 403, dataId: 5 }];
    it('locks only the selection it names', () => {
        expect(isLocked(locks, 403, 5)).toBe(true);
        expect(isLocked(locks, 403, 4)).toBe(false);
        expect(isLocked(locks, 205, 5)).toBe(false);
        expect(grantLocked(locks, 403, [4, 5])).toBe(true);
        expect(grantLocked(locks, 403, [4])).toBe(false);
    });
    it('locks everything of the right with -1 or without data', () => {
        for (const dataId of [-1, null]) {
            expect(isLocked([{ authId: 403, dataId }], 403, 7)).toBe(true);
            expect(isLocked([{ authId: 403, dataId }], 403, null)).toBe(true);
        }
    });
    it('does not lock a right without data by a lock on one selection', () => {
        expect(grantLocked(locks, 403, undefined)).toBe(false);
        expect(grantLocked([{ authId: 403, dataId: null }], 403, undefined)).toBe(true);
    });
    it('counts a grant for all data as locked once any lock lies on the right', () => {
        expect(grantLocked(locks, 403, [-1])).toBe(true);
        expect(grantLocked(locks, 205, [-1])).toBe(false);
    });
    it('binds only those who are not entitled to give instructions', () => {
        expect(bindingLocks({ locks, authorized: false })).toEqual(locks);
        expect(bindingLocks({ locks, authorized: true })).toEqual([]);
        expect(bindingLocks(null)).toEqual([]);
    });
});

describe('lockedAuthId', () => {
    it('reads the right out of the refusal', () => expect(lockedAuthId(refusal(403))).toBe(403));
    it('ignores a 403 for another reason, other statuses and errors without a response', () => {
        expect(lockedAuthId(refusal(403, 'person'))).toBeNull();
        expect(lockedAuthId({ response: { status: 403, data: {} } })).toBeNull();
        expect(lockedAuthId({ response: { status: 403 } })).toBeNull();
        expect(lockedAuthId({ response: { status: 404, data: refusal(403).response.data } })).toBeNull();
        expect(lockedAuthId(new Error('x'))).toBeNull();
        expect(lockedAuthId(null)).toBeNull();
    });
});

describe('withLockNames', () => {
    const api = {
        grant: async (_r: number, authId: number) => {
            if (authId === 403) throw refusal(403);
            if (authId === 1) throw new Error('other');
        },
        revoke: async () => {
            throw refusal(403);
        },
    } as unknown as ProvisionApi;
    const wrapped = withLockNames(api, (id) => (id === 403 ? 'Kalender: Einzelnen Kalender sehen' : undefined));

    it('names the right in the error, for grant and revoke', async () => {
        const e = await wrapped.grant(1, 403, [5]).catch((x: unknown) => x);
        expect(e).toBeInstanceOf(LockedPermissionError);
        expect((e as Error).message).toContain('„Kalender: Einzelnen Kalender sehen“');
        expect(await wrapped.revoke(1, 403, [5]).catch((x: unknown) => x)).toBeInstanceOf(LockedPermissionError);
    });
    it('does not look like a 403 to the page', async () => {
        const e = (await wrapped.grant(1, 403).catch((x: unknown) => x)) as object;
        expect('response' in e || 'status' in e).toBe(false);
    });
    it('passes anything else on unchanged', async () => {
        await expect(wrapped.grant(1, 1)).rejects.toThrow('other');
        await expect(wrapped.grant(1, 2)).resolves.toBeUndefined();
    });
    it('names a right without a name by its number', async () => {
        const plain = withLockNames(api, () => undefined);
        await expect(plain.grant(1, 403)).rejects.toThrow('„Recht 403“');
    });
});
