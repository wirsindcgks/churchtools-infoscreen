import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 1280, height: 900 } });

// Reads groups and rights of the test instance; saving writes only the demo store of this browser.
test('the setup page checks the chosen groups and keeps the choice', async ({ page }) => {
    await page.goto('./');
    await page.getByTestId('open-setup').click();
    await expect(page.getByTestId('setup-heading')).toHaveText('Einstellungen');
    // An overview of cards (Plan.md 36): each "settings-card-…" leads to a page of its own.
    await expect(page.getByTestId('settings-card-groups')).toBeVisible();
    await expect(page.getByTestId('settings-card-tv')).toBeVisible();
    // Which build is installed, to compare with the releases on GitHub (Plan.md 12).
    await expect(page.getByTestId('app-version')).toContainText(/Infoscreen Designer \d+\.\d+\.\d+/);

    await page.getByTestId('settings-card-groups').click();
    await expect(page).toHaveURL(/\/einstellungen\/gruppen$/);
    await expect(page.getByTestId('setup-heading')).toHaveText('Gruppen und Rechte');

    // The back link returns to the overview.
    await page.getByTestId('settings-back').click();
    await expect(page).toHaveURL(/\/einstellungen$/);
    await page.getByTestId('settings-card-groups').click();
    await expect(page).toHaveURL(/\/einstellungen\/gruppen$/);

    // Group checks read live from the test instance, which can take longer than the default 5 s.
    const LIVE = { timeout: 15_000 };
    await page.getByTestId('group-device').selectOption({ label: 'Infoscreen-Devices' });
    const device = page.getByTestId('setup-device');
    await expect(device.locator('.checks')).toContainText('Die Gruppe ist aktiv.', LIVE);
    await expect(device.locator('.checks')).toContainText('1 Geräte-Benutzer.', LIVE);

    await page.getByTestId('group-designer').selectOption({ label: 'Gemeindeleitung' });
    await expect(page.getByTestId('setup-designer').locator('.checks')).toContainText('Rolle', LIVE);

    await page.getByTestId('save-setup').click();
    await expect(page.getByTestId('setup-saved')).toBeVisible();
    await page.screenshot({ path: 'test-results/setup.png', fullPage: true });

    await page.reload();
    await expect(page.getByTestId('group-device')).toHaveValue(/\d+/);
    await expect(device.locator('.checks')).toContainText('Die Gruppe ist aktiv.', LIVE);
});

// Reads groups and rights of the test instance, writes nothing.
test('the checks of a group are folded by category, and the head names what is not fine', async ({ page }, testInfo) => {
    const LIVE = { timeout: 15_000 };
    await page.goto('./einstellungen/gruppen');
    await page.getByTestId('group-device').selectOption({ label: 'Infoscreen-Devices' });
    const device = page.getByTestId('checks-device');
    await expect(device.getByTestId('check-group').first()).toBeVisible(LIVE);

    // Folded at first, whatever the level.
    const groups = device.getByTestId('check-group');
    for (const group of await groups.all()) await expect(group).not.toHaveAttribute('open', '');
    await page.getByTestId('setup-device').scrollIntoViewIfNeeded();
    if (testInfo.project.name === 'chromium') await page.getByTestId('setup-device').screenshot({ path: 'test-results/setup-checks-closed.png' });

    const calendars = device.locator('[data-testid="check-group"][data-category="calendars"]');
    if (await calendars.count()) {
        await expect(calendars).not.toHaveAttribute('open', '');
        await calendars.locator('summary').click();
        await expect(calendars).toHaveAttribute('open', '');
        await expect(calendars).toContainText(/ist sichtbar\./);
    }

    // A group with a warning shows it in its head.
    for (const warned of await device.locator('.check-group--warn').all()) {
        await expect(warned.locator('summary').getByTestId('check-notice').first()).toBeVisible();
    }

    // Any group with something to say, for the picture: open, its lines come below the head with their
    // explanations – and the head no longer says the same a second time.
    const noisy = device.locator('.check-group--fail, .check-group--warn, .check-group--info');
    if (await noisy.count()) {
        await expect(noisy.first().locator('summary').getByTestId('check-notice').first()).toBeVisible();
        await noisy.first().locator('summary').click();
        await expect(noisy.first()).toHaveAttribute('open', '');
        await expect(noisy.first().locator('summary').getByTestId('check-notice').first()).toBeHidden();
        await expect(noisy.first().locator('.check-list li').first()).toBeVisible();
        if (testInfo.project.name === 'chromium') await page.getByTestId('setup-device').screenshot({ path: 'test-results/setup-checks-open.png' });
    }
});

test('the folded checks fit a phone', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'one screenshot is enough');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('./einstellungen/gruppen');
    await page.getByTestId('group-device').selectOption({ label: 'Infoscreen-Devices' });
    await expect(page.getByTestId('checks-device').getByTestId('check-group').first()).toBeVisible({ timeout: 15_000 });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await page.getByTestId('setup-device').scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'test-results/setup-checks-phone.png' });
});

test('the assistant explains itself in demo mode instead of offering to write', async ({ page }) => {
    await page.goto('./einstellungen/gruppen');
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
    await page.goto('./einstellungen/fernseher');
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
