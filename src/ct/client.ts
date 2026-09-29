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
    churchtoolsClient.setBaseUrl(instanceBaseUrl());
}

export function instanceBaseUrl(): string {
    return (window.settings?.base_url ?? window.location.origin).replace(/\/+$/, '');
}

/**
 * Where to see a person's details in ChurchTools – used for device accounts
 * in „Einrichtung entfernen" (Plan.md, F; G18). `/persons/{id}` itself shows
 * no person; this address, measured 2026-09-28 on the test instance, opens
 * the person view with the given id selected.
 */
export function personUrl(baseUrl: string, personId: number): string {
    return `${baseUrl}/?q=churchdb#PersonView/searchEntry:#${personId}`;
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

let current: Promise<Person> | null = null;

/** The signed-in person, fetched once per page. */
export function currentPerson(): Promise<Person> {
    current ??= fetchCurrentPerson().catch((error: unknown) => {
        current = null;
        throw error;
    });
    return current;
}

export function displayName(person: Person): string {
    return [person.firstName, person.lastName].filter(Boolean).join(' ');
}

/** HTTP status of a failed client call, if the error carries one. */
export function httpStatus(error: unknown): number | null {
    const e = error as { response?: { status?: unknown }; status?: unknown } | null;
    const status = e?.response?.status ?? e?.status;
    return typeof status === 'number' ? status : null;
}

/** ChurchTools recommends waiting 60 seconds after a `429` (G16); the test instance sent no `Retry-After`. */
const RATE_LIMIT_WAIT_MS = 60_000;

/**
 * How long to wait after a `429`, honouring `Retry-After` when ChurchTools sends one – as seconds or
 * as an HTTP date. `undefined` for any other error. `error.response.headers` may be a plain object or
 * an `AxiosHeaders` instance, so this reads the header as a property instead of assuming a `.get()`
 * method; the key is usually lower-cased, `Retry-After` is a fallback. Never less than
 * `RATE_LIMIT_WAIT_MS`, also without a header or with one that cannot be parsed (G16).
 */
export function retryAfterMs(error: unknown, now: number = Date.now()): number | undefined {
    if (httpStatus(error) !== 429) return undefined;
    const headers = (error as { response?: { headers?: Record<string, unknown> } })?.response?.headers;
    const header = headers?.['retry-after'] ?? headers?.['Retry-After'];
    if (typeof header === 'string') {
        const seconds = Number(header);
        if (Number.isFinite(seconds) && seconds >= 0) return Math.max(RATE_LIMIT_WAIT_MS, seconds * 1000);
        const date = Date.parse(header);
        if (!Number.isNaN(date)) return Math.max(RATE_LIMIT_WAIT_MS, date - now);
    }
    return RATE_LIMIT_WAIT_MS;
}

/** The device account from the player address: `login_token` and `user_id`. */
export interface TokenLogin {
    loginToken: string;
    personId: number;
}

/**
 * Someone else is signed in than the device account the address names. Only
 * ids in the message: it appears on a TV in the foyer.
 */
export class WrongPersonError extends Error {
    constructor(
        readonly signedInId: number,
        readonly expectedId: number,
    ) {
        super(
            `Angemeldet ist Person ${signedInId}, nicht der Geräte-Benutzer (Person ${expectedId}). ` +
                'Die Anmeldung mit dem Token aus der Adresse ist gescheitert – login_token und user_id prüfen.',
        );
        this.name = 'WrongPersonError';
    }
}

/**
 * The device logs in with its login token (Plan.md, D). The client signs in
 * again by itself whenever the session has expired – for a device that runs
 * for months, that is the point.
 */
export function enableTokenLogin(login: TokenLogin): void {
    churchtoolsClient.setUnauthorizedInterceptor(login.loginToken, login.personId);
}

export interface SignInApi {
    whoami: () => Promise<Person>;
    loginWithToken: (loginToken: string, personId: number) => Promise<unknown>;
}

const clientSignInApi: SignInApi = {
    whoami: fetchCurrentPerson,
    loginWithToken: (loginToken, personId) => churchtoolsClient.loginWithToken(loginToken, personId),
};

/**
 * Checks who is signed in. With a device account, that person and nobody
 * else: a kiosk browser that still holds a human's session would otherwise
 * show the screen with that human's rights and never use its token – until
 * the session runs out on a Sunday. A mismatch triggers one login with the
 * token; if that does not help, it is an error.
 */
export async function ensureSignedIn(login?: TokenLogin, api: SignInApi = clientSignInApi): Promise<Person> {
    if (!login) return api.whoami();
    let person: Person | null = null;
    try {
        person = await api.whoami();
    } catch (error) {
        if (!(error instanceof NotAuthenticatedError)) throw error;
    }
    if (person?.id === login.personId) return person;

    await api.loginWithToken(login.loginToken, login.personId);
    person = await api.whoami();
    if (person.id !== login.personId) throw new WrongPersonError(person.id, login.personId);
    return person;
}
