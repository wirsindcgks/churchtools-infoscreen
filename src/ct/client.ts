import { churchtoolsClient } from '@churchtools/churchtools-client';
import type { Person } from './types';

declare global {
    interface Window {
        settings?: { base_url?: string };
    }
}

/**
 * Inside ChurchTools the host page provides `window.settings.base_url`.
 * In development the app talks to its own origin and the Vite proxy forwards
 * /api to the instance, so no instance URL is ever compiled into the bundle.
 */
export function configureClient(): void {
    churchtoolsClient.setBaseUrl(window.settings?.base_url ?? window.location.origin);
}

/** ChurchTools answers anonymous requests as this pseudo person (G20). */
export const ANONYMOUS_PERSON_ID = -1;

export class NotAuthenticatedError extends Error {
    constructor() {
        super('Nicht bei ChurchTools angemeldet.');
        this.name = 'NotAuthenticatedError';
    }
}

/**
 * A failed login does not look like an error: ChurchTools returns 200 with
 * empty data (G20). Every identity check therefore rejects the anonymous
 * pseudo person instead of trusting the status code.
 */
export function assertAuthenticated(person: Person | null | undefined): Person {
    if (!person || person.id === ANONYMOUS_PERSON_ID || person.id <= 0) {
        throw new NotAuthenticatedError();
    }
    return person;
}

export async function fetchCurrentPerson(): Promise<Person> {
    const person = await churchtoolsClient.get<Person>('/whoami', { only_allow_authenticated: 'true' });
    return assertAuthenticated(person);
}

/** HTTP status of a failed client call, if the error carries one. */
export function httpStatus(error: unknown): number | null {
    const e = error as { response?: { status?: unknown }; status?: unknown } | null;
    const status = e?.response?.status ?? e?.status;
    return typeof status === 'number' ? status : null;
}

/**
 * The device logs in with its login token (Plan.md, D). The client signs in
 * again by itself whenever the session has expired – for a device that runs
 * for months, that is the point.
 */
export function enableTokenLogin(loginToken: string, personId: number): void {
    churchtoolsClient.setUnauthorizedInterceptor(loginToken, personId);
}
