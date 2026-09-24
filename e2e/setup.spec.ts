import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 1280, height: 900 } });

// Reads groups and rights of the test instance; saving writes only the demo store of this browser.
test('the setup page checks the chosen groups and keeps the choice', async ({ page }) => {
    await page.goto('./');
    await page.getByTestId('open-setup').click();
    await expect(page.getByRole('heading', { name: 'Einrichtung' })).toBeVisible();

    await page.getByTestId('group-device').selectOption({ label: 'Infoscreen-Geraete' });
    const device = page.getByTestId('setup-device');
    await expect(device.locator('.checks')).toContainText('Die Gruppe ist aktiv.');
    await expect(device.locator('.checks')).toContainText('1 Geräte-Benutzer.');

    await page.getByTestId('group-designer').selectOption({ label: 'Gemeindeleitung' });
    await expect(page.getByTestId('setup-designer').locator('.checks')).toContainText('Rolle');

    // Way A: the address carries no secret, only the screen.
    const addresses = page.getByTestId('player-addresses');
    await expect(addresses).toContainText('/ccm/infoscreen-designer/player?screen=demo');
    await expect(addresses).not.toContainText('login_token');

    await page.getByTestId('save-setup').click();
    await expect(page.getByTestId('setup-saved')).toBeVisible();
    await page.screenshot({ path: 'test-results/setup.png', fullPage: true });

    await page.reload();
    await expect(page.getByTestId('group-device')).toHaveValue(/\d+/);
    await expect(device.locator('.checks')).toContainText('Die Gruppe ist aktiv.');
});
