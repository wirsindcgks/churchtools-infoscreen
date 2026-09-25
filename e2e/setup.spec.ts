import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 1280, height: 900 } });

// Reads groups and rights of the test instance; saving writes only the demo store of this browser.
test('the setup page checks the chosen groups and keeps the choice', async ({ page }) => {
    await page.goto('./');
    await page.getByTestId('open-setup').click();
    await expect(page.getByRole('heading', { name: 'Einstellungen für Infoscreens' })).toBeVisible();
    // Which build is installed, to compare with the releases on GitHub (Plan.md 12).
    await expect(page.getByTestId('app-version')).toContainText(/Infoscreen Designer \d+\.\d+\.\d+/);

    await page.getByTestId('group-device').selectOption({ label: 'Infoscreen-Geraete' });
    const device = page.getByTestId('setup-device');
    await expect(device.locator('.checks')).toContainText('Die Gruppe ist aktiv.');
    await expect(device.locator('.checks')).toContainText('1 Geräte-Benutzer.');

    await page.getByTestId('group-designer').selectOption({ label: 'Gemeindeleitung' });
    await expect(page.getByTestId('setup-designer').locator('.checks')).toContainText('Rolle');

    await page.getByTestId('save-setup').click();
    await expect(page.getByTestId('setup-saved')).toBeVisible();
    await page.screenshot({ path: 'test-results/setup.png', fullPage: true });

    await page.reload();
    await expect(page.getByTestId('group-device')).toHaveValue(/\d+/);
    await expect(device.locator('.checks')).toContainText('Die Gruppe ist aktiv.');
});

test('the assistant explains itself in demo mode instead of offering to write', async ({ page }) => {
    await page.goto('./einstellungen');
    const assistant = page.getByTestId('assistant');
    await expect(assistant).toContainText('Im Demo-Modus nicht verfügbar');
    await expect(page.getByTestId('run-assistant')).toBeDisabled();
    await page.screenshot({ path: 'test-results/setup-assistant.png', fullPage: true });
});

test('the settings make a TV address that signs the device in, without keeping the password (way B)', async ({ page }) => {
    const bodies: unknown[] = [];
    // ChurchTools' answer is simulated: nothing is asked of the instance, nothing written.
    await page.route('**/api/login/token', async (route) => {
        const body = route.request().postDataJSON() as { username: string; password: string };
        bodies.push(body);
        if (body.password !== 'richtig') return route.fulfill({ status: 400, json: { message: 'Login failed' } });
        await route.fulfill({ json: { data: { personId: 22, token: 'geraete-token' } } });
    });
    await page.goto('./einstellungen');
    const card = page.getByTestId('tv-address');
    await card.scrollIntoViewIfNeeded();

    await page.getByTestId('tv-username').fill('muser');
    await page.getByTestId('tv-password').fill('falsch');
    await page.getByTestId('tv-create').click();
    await expect(page.getByTestId('tv-error')).toContainText('Benutzernamen');
    await expect(page.getByTestId('tv-password')).toHaveValue(''); // never kept

    await page.getByTestId('tv-password').fill('richtig');
    await page.getByTestId('tv-create').click();
    const url = new URL((await page.getByTestId('tv-result').locator('code').innerText()).trim());
    expect(url.pathname).toMatch(/\/ccm\/infoscreen-designer\/player$/);
    expect(url.searchParams.get('screen')).toBe('demo');
    expect(url.searchParams.get('login_token')).toBe('geraete-token'); // ChurchTools signs in on load (G9)
    expect(new URLSearchParams(url.hash.slice(1)).get('login_token')).toBe('geraete-token'); // the player's copy
    await expect(card).toContainText('Person 22');
    await expect(page.getByTestId('tv-password')).toHaveValue('');
    expect(bodies).toEqual([
        { username: 'muser', password: 'falsch' },
        { username: 'muser', password: 'richtig' },
    ]);
    await card.screenshot({ path: 'test-results/tv-address.png' });
});
