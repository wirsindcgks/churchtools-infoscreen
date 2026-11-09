/**
 * Locked rights (Plan.md 110, G80): people entitled to give instructions can lock single rights, and only they may then
 * grant or take them back – for everyone else ChurchTools answers `403`, even when the same grant is sent again. The
 * assistant reads the locks before it writes (`readLocks`), so it can stop with nothing changed, and recognises the
 * refusal where it comes anyway (`withLockNames`).
 */
import { churchtoolsClient } from '@churchtools/churchtools-client';
import { t } from '../i18n/designer';
import { httpStatus } from '../ct/client';
import { ALL_DATA } from './checks';
import type { ProvisionApi } from './provision';

export interface PermissionLock {
    authId: number;
    /** A selection (e.g. a calendar id), `-1` for all selections, `null` for a right without data. */
    dataId: number | null;
}

export interface LockState {
    locks: PermissionLock[];
    /** Whether the current person is entitled to give instructions – for them locks do not apply. */
    authorized: boolean;
}

/** The locks as ChurchTools lists them; `null` where they cannot be read (before 3.138, no right, no network) – then the assistant behaves as before. */
export async function readLocks(): Promise<LockState | null> {
    try {
        const body = (await churchtoolsClient.get('/permissions/locked')) as {
            permissions?: unknown;
            isCurrentUserAuthorizedPerson?: unknown;
        };
        if (!Array.isArray(body?.permissions)) return null;
        const locks = body.permissions
            .filter((p): p is { authId: number; dataId?: unknown } => typeof (p as { authId?: unknown })?.authId === 'number')
            .map((p) => ({ authId: p.authId, dataId: typeof p.dataId === 'number' ? p.dataId : null }));
        return { locks, authorized: body.isCurrentUserAuthorizedPerson === true };
    } catch {
        return null;
    }
}

/** The locks that bind this person: none for someone entitled to give instructions, and none where they are unknown. */
export function bindingLocks(state: LockState | null): PermissionLock[] {
    return state && !state.authorized ? state.locks : [];
}

/** Whether one selection of a right is locked. A lock on `-1` or without data covers every selection of its right. */
export function isLocked(locks: readonly PermissionLock[], authId: number, dataId: number | null): boolean {
    return locks.some((l) => l.authId === authId && (l.dataId === null || l.dataId === ALL_DATA || (dataId !== null && l.dataId === dataId)));
}

/** Whether a grant touches a locked selection. A grant for all data (`[-1]`) counts as locked once any lock lies on the right (careful, not measured). */
export function grantLocked(locks: readonly PermissionLock[], authId: number, dataId: readonly number[] | undefined): boolean {
    if (!dataId?.length) return isLocked(locks, authId, null);
    if (dataId.includes(ALL_DATA)) return locks.some((l) => l.authId === authId);
    return dataId.some((id) => isLocked(locks, authId, id));
}

/** The right ChurchTools names in its refusal of a locked one (`403`, `args.model` "locked permission", `args.id` the right); otherwise `null`. */
export function lockedAuthId(e: unknown): number | null {
    if (httpStatus(e) !== 403) return null;
    const body = (e as { response?: { data?: unknown } } | null)?.response?.data as { args?: { model?: unknown; id?: unknown } } | null | undefined;
    const args = body?.args;
    return args?.model === 'locked permission' && typeof args.id === 'number' ? args.id : null;
}

/** Deliberately without `response` and `status`: it is not a missing right of the administrator. */
export class LockedPermissionError extends Error {
    constructor(
        readonly authId: number,
        name: string,
    ) {
        super(t.setup.locks.single(name));
        this.name = 'LockedPermissionError';
    }
}

/** The api with a refusal of a locked right turned into an error that names the right. */
export function withLockNames(api: ProvisionApi, name: (authId: number) => string | undefined): ProvisionApi {
    const named = async <T>(call: () => Promise<T>): Promise<T> => {
        try {
            return await call();
        } catch (e) {
            const authId = lockedAuthId(e);
            if (authId === null) throw e;
            throw new LockedPermissionError(authId, name(authId) ?? t.setup.locks.fallbackName(authId));
        }
    };
    return {
        ...api,
        grant: (roleId, authId, dataId) => named(() => api.grant(roleId, authId, dataId)),
        revoke: (roleId, authId, dataId) => named(() => api.revoke(roleId, authId, dataId)),
    };
}
