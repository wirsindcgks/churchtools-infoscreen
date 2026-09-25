import { describe, expect, it, vi } from 'vitest';
import { createDeviceLogin, DeviceLoginError } from './device-token';

function answer(status: number, json: unknown = {}) {
    return vi.fn(async () => new Response(JSON.stringify(json), { status }));
}

describe('createDeviceLogin', () => {
    it('asks for the token without cookies, so the administrator stays signed in as themselves', async () => {
        const fetcher = answer(200, { data: { personId: 22, token: 'tok' } });
        const login = await createDeviceLogin('https://gemeinde.church.tools', ' muser ', 'geheim', fetcher);
        expect(login).toEqual({ loginToken: 'tok', personId: 22 });
        const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
        expect(url).toBe('https://gemeinde.church.tools/api/login/token');
        expect(init.credentials).toBe('omit');
        expect(JSON.parse(init.body as string)).toEqual({ username: 'muser', password: 'geheim' });
    });

    it('names the missing user name as the likely cause of a failed login (G21)', async () => {
        await expect(createDeviceLogin('', 'muser', 'falsch', answer(400))).rejects.toThrow(/Benutzernamen/);
    });

    it('says so when ChurchTools slows down or answers without a token', async () => {
        await expect(createDeviceLogin('', 'a', 'b', answer(429))).rejects.toThrow(/Zu viele Versuche/);
        await expect(createDeviceLogin('', 'a', 'b', answer(200, { data: {} }))).rejects.toBeInstanceOf(DeviceLoginError);
    });

    it('turns a network failure into a readable message', async () => {
        const offline = vi.fn(async () => {
            throw new TypeError('Failed to fetch');
        });
        await expect(createDeviceLogin('', 'a', 'b', offline)).rejects.toThrow('nicht erreichbar');
    });
});
