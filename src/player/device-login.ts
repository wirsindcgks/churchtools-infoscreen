/**
 * Way B (Plan.md, D; G9, G32): the TV's address carries the device account's
 * login token twice.
 *
 * - **In the query**, ChurchTools signs the browser in while loading the page –
 *   also after a restart with an expired session – and then redirects to the
 *   same address without it. Without a session it would not even include our
 *   script (G33).
 * - **In the fragment** (`#…`), which never reaches the server and survives
 *   that redirect (measured in Chromium and WebKit, G9). The player reads the
 *   token there, signs in again by itself when the session runs out (24 hours,
 *   G32), and reloads only through the address with the token in the query.
 *
 * The player then takes the token out of the address bar – ChurchTools does
 * so only when it signs in, not in a browser that is already signed in – and
 * keeps it for its own reloads in the tab's session storage. That keeps it
 * off photos and screenshots; it stays in the kiosk configuration and the
 * browser history, so it is tidiness, not protection.
 */
import type { TokenLogin } from '../ct/client';

const TOKEN = 'login_token';
const PERSON = 'user_id';

function fromParams(params: URLSearchParams): TokenLogin | undefined {
    const loginToken = params.get(TOKEN);
    const personId = Number(params.get(PERSON));
    return loginToken && Number.isInteger(personId) && personId > 0 ? { loginToken, personId } : undefined;
}

/** The device login an address carries: from the fragment, else from the query (development serves it unchanged). */
export function readDeviceLogin(url: URL): TokenLogin | undefined {
    return fromParams(new URLSearchParams(url.hash.slice(1))) ?? fromParams(url.searchParams);
}

/** The address with the device login in query and fragment – what a TV opens, and where the player reloads to. */
export function withDeviceLogin(address: string | URL, login: TokenLogin): string {
    const url = new URL(address);
    url.searchParams.set(TOKEN, login.loginToken);
    url.searchParams.set(PERSON, String(login.personId));
    url.hash = new URLSearchParams({ [TOKEN]: login.loginToken, [PERSON]: String(login.personId) }).toString();
    return url.toString();
}

/** The address without the device login – what the address bar shows once the player has read it. */
export function withoutDeviceLogin(address: string | URL): string {
    const url = new URL(address);
    url.searchParams.delete(TOKEN);
    url.searchParams.delete(PERSON);
    const hash = new URLSearchParams(url.hash.slice(1));
    hash.delete(TOKEN);
    hash.delete(PERSON);
    url.hash = hash.toString();
    return url.toString();
}

const STORAGE_KEY = 'infoscreen-designer.device-login';

/** Keeps the login for reloads of this tab. Storage may be unavailable – then only the address carries it. */
export function rememberDeviceLogin(login: TokenLogin, storage: Pick<Storage, 'setItem'> | undefined = globalThis.sessionStorage): void {
    try {
        storage?.setItem(STORAGE_KEY, JSON.stringify(login));
    } catch {
        // Private mode or blocked storage: nothing to keep.
    }
}

export function rememberedDeviceLogin(storage: Pick<Storage, 'getItem'> | undefined = globalThis.sessionStorage): TokenLogin | undefined {
    try {
        const value = JSON.parse(storage?.getItem(STORAGE_KEY) ?? 'null') as Partial<TokenLogin> | null;
        return typeof value?.loginToken === 'string' && Number.isInteger(value.personId)
            ? { loginToken: value.loginToken, personId: value.personId! }
            : undefined;
    } catch {
        return undefined;
    }
}
