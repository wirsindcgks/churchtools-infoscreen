/**
 * The login token of a device account, from its user name and password
 * (Plan.md, D, way B; G18). The administrator types both in the settings;
 * neither is stored – the token ends up in the TV's address only.
 *
 * Sent without cookies: whatever ChurchTools does with a login here, it must
 * never touch the administrator's own session in this browser.
 */
import type { TokenLogin } from '../ct/client';
import { t } from '../i18n/designer';

export class DeviceLoginError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'DeviceLoginError';
    }
}

export async function createDeviceLogin(
    baseUrl: string,
    username: string,
    password: string,
    fetcher: typeof fetch = fetch,
): Promise<TokenLogin> {
    let response: Response;
    try {
        response = await fetcher(`${baseUrl}/api/login/token`, {
            method: 'POST',
            credentials: 'omit',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ username: username.trim(), password }),
        });
    } catch {
        throw new DeviceLoginError(t.setup.deviceLogin.unreachable);
    }
    if (response.status === 400) {
        // The most common cause is measured: a person without user name cannot log in, whatever the password (G21).
        throw new DeviceLoginError(t.setup.deviceLogin.failed);
    }
    if (response.status === 429) throw new DeviceLoginError(t.setup.deviceLogin.tooMany);
    if (!response.ok) throw new DeviceLoginError(t.setup.deviceLogin.error(response.status));
    const body = (await response.json()) as { data?: { personId?: unknown; token?: unknown } };
    const { personId, token } = body.data ?? {};
    if (typeof token !== 'string' || !token || typeof personId !== 'number') {
        throw new DeviceLoginError(t.setup.deviceLogin.noToken);
    }
    return { loginToken: token, personId };
}
